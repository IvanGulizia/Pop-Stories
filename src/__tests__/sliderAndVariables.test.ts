import { describe, it, expect, beforeEach } from 'vitest';
import { Entity, SliderBehaviorConfig, VectorPath } from '../types';
import { isEntityDraggable } from '../utils/physics/behaviorResolution';
import {
  getSliderTrackGeometry,
  clampSliderLocalToBounds,
  projectPointToSliderConstraint,
  snapSliderLocalToSteps,
  computeMagneticStepForce,
  computeSliderOutputs,
  stepSliderPhysics,
  SliderRuntimeState,
} from '../utils/physics/sliderSolver';
import { buildWiggledPathVariants } from '../utils/strokeWiggle';
import { useSceneStore } from '../store/useSceneStore';

function makeSliderConfig(overrides: Partial<SliderBehaviorConfig> = {}): SliderBehaviorConfig {
  return {
    id: 'slider-1',
    type: 'slider',
    enabled: true,
    geometryMode: 'line_1d',
    length: 200,
    angle: 0,
    width: 160,
    height: 120,
    radius: 80,
    dragMode: 'physics_spring',
    dragStiffness: 240,
    dragDamping: 18,
    boundaryBounce: 0.3,
    stepsX: 0,
    stepsY: 0,
    stepMode: 'magnetic',
    magneticStrength: 150,
    returnMode: 'none',
    returnStiffness: 140,
    returnDamping: 12,
    returnPosition: 0.5,
    outputMin: 0,
    outputMax: 100,
    showTrackInPlay: true,
    ...overrides,
  };
}

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Entity ${id}`,
    type: 'custom',
    position: { x: 100, y: 100 },
    size: { width: 60, height: 60 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Default',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
      active: {
        id: 'active',
        name: 'Active',
        color: '#10b981',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

describe('sliderSolver (1D rail, 2D rect/circle, steps, springs, outputs)', () => {
  it('projects points onto horizontal and vertical 1D rails clamped to length', () => {
    const geomH = getSliderTrackGeometry(300, 200, makeSliderConfig({ geometryMode: 'line_1d', length: 200, angle: 0 }));
    expect(geomH.startPt).toEqual({ x: 200, y: 200 });
    expect(geomH.endPt).toEqual({ x: 400, y: 200 });

    const projH = projectPointToSliderConstraint({ x: 520, y: 350 }, geomH);
    expect(projH.lx).toBeCloseTo(100, 4);
    expect(projH.ly).toBe(0);
    expect(projH.worldCenter.x).toBeCloseTo(400, 4);
    expect(projH.worldCenter.y).toBeCloseTo(200, 4);

    const geomV = getSliderTrackGeometry(300, 200, makeSliderConfig({ geometryMode: 'line_1d', length: 160, angle: 90 }));
    const projV = projectPointToSliderConstraint({ x: 999, y: 50 }, geomV);
    expect(projV.lx).toBeCloseTo(-80, 4);
    expect(projV.worldCenter.x).toBeCloseTo(300, 3);
    expect(projV.worldCenter.y).toBeCloseTo(120, 4);
  });

  it('clamps 2D rect and circle disc bounds and bounces velocity inward', () => {
    const geomRect = getSliderTrackGeometry(200, 200, makeSliderConfig({ geometryMode: 'rect_2d', width: 100, height: 80 }));
    const clampedRect = clampSliderLocalToBounds(75, -60, 100, -50, geomRect, 0.5);
    expect(clampedRect.lx).toBe(50);
    expect(clampedRect.ly).toBe(-40);
    expect(clampedRect.vx).toBeCloseTo(-50, 4);
    expect(clampedRect.vy).toBeCloseTo(25, 4);
    expect(clampedRect.hitBoundary).toBe(true);

    const geomCircle = getSliderTrackGeometry(200, 200, makeSliderConfig({ geometryMode: 'circle_2d', radius: 50 }));
    const clampedCircle = clampSliderLocalToBounds(60, 80, 10, 0, geomCircle, 0);
    expect(Math.hypot(clampedCircle.lx, clampedCircle.ly)).toBeCloseTo(50, 4);
    expect(clampedCircle.hitBoundary).toBe(true);
  });

  it('snaps strictly to configured step counts and pulls magnetically inside step wells', () => {
    const geom = getSliderTrackGeometry(200, 200, makeSliderConfig({ geometryMode: 'line_1d', length: 200, angle: 0 }));
    // 5 steps on [-100, +100] -> positions -100, -50, 0, 50, 100
    const snap = snapSliderLocalToSteps(38, 0, geom, 5, 0);
    expect(snap.lx).toBeCloseTo(50, 4);
    expect(snap.stepIndexX).toBe(3);

    // Magnetic force pulls toward step at lx=50 when at lx=40
    const mag = computeMagneticStepForce(40, 0, geom, 5, 0, 120);
    expect(mag.fx).toBeGreaterThan(0);
    expect(mag.fy).toBe(0);
  });

  it('supports direct strict drag, magnetic settling, and spring_return physics', () => {
    const cfgDirect = makeSliderConfig({
      geometryMode: 'line_1d',
      length: 200,
      dragMode: 'direct',
      stepMode: 'strict',
      stepsX: 3, // -100, 0, +100
      outputMin: 0,
      outputMax: 10,
      outputVariableX: 'power',
      outputStepVariable: 'notch',
    });
    const stateDirect: SliderRuntimeState = {
      originCx: 200,
      originCy: 200,
      localX: 0,
      localY: 0,
      vx: 0,
      vy: 0,
      isGrabbed: true,
      grabOffsetWorld: { x: 0, y: 0 },
      targetWorld: { x: 278, y: 120 },
    };
    const directRes = stepSliderPhysics({ state: stateDirect, config: cfgDirect, dt: 0.016 });
    expect(directRes.worldCenter.x).toBeCloseTo(300, 4);
    expect(directRes.worldCenter.y).toBeCloseTo(200, 4);
    expect(directRes.outputs.updates).toEqual({ power: 10, notch: 2 });

    // Spring return toward start (returnPosition = 0 -> lx = -100) after release
    const cfgReturn = makeSliderConfig({
      geometryMode: 'line_1d',
      length: 200,
      dragMode: 'physics_spring',
      returnMode: 'spring_return',
      returnPosition: 0,
      returnStiffness: 180,
      returnDamping: 16,
      stepsX: 0,
    });
    const stateReturn: SliderRuntimeState = {
      originCx: 200,
      originCy: 200,
      localX: 90,
      localY: 0,
      vx: 0,
      vy: 0,
      isGrabbed: false,
      grabOffsetWorld: { x: 0, y: 0 },
      targetWorld: { x: 200, y: 200 },
    };
    for (let i = 0; i < 120; i++) {
      stepSliderPhysics({ state: stateReturn, config: cfgReturn, dt: 0.016 });
    }
    expect(stateReturn.localX).toBeLessThan(-95);
  });

  it('computes scaled outputs and step indices for 1D and 2D sliders', () => {
    const geom2d = getSliderTrackGeometry(100, 100, makeSliderConfig({ geometryMode: 'rect_2d', width: 200, height: 100 }));
    const out = computeSliderOutputs(
      50,
      -50,
      geom2d,
      makeSliderConfig({
        geometryMode: 'rect_2d',
        width: 200,
        height: 100,
        outputMin: -10,
        outputMax: 10,
        outputVariableX: 'joy_x',
        outputVariableY: 'joy_y',
      })
    );
    expect(out.normX).toBeCloseTo(0.5, 4);
    expect(out.normY).toBeCloseTo(-1, 4);
    expect(out.updates).toEqual({ joy_x: 5, joy_y: -10 });
  });
});

describe('behaviorResolution slider priority', () => {
  it('gives slider priority over draggable and interactive_puppet', () => {
    const ent = makeEntity({
      id: 'handle',
      behaviors: [
        { id: 'd1', type: 'draggable', enabled: true, throwable: true, maxThrowSpeed: 1200 },
        makeSliderConfig({ id: 's1' }),
      ],
    });
    const res = isEntityDraggable(ent, ent.states.default);
    expect(res.canDrag).toBe(true);
    expect(res.hasSlider).toBe(true);
    expect(res.throwable).toBe(false);
    expect(res.precisePhysicsGrab).toBe(false);
  });
});

describe('Wiggle++ extended stroke parameters', () => {
  const straightLine: VectorPath[] = [
    {
      id: 'line-1',
      d: 'M 0 50 L 100 50',
      stroke: '#000000',
      strokeWidth: 4,
      fill: 'none',
      type: 'straight',
      points: [
        { x: 0, y: 50 },
        { x: 100, y: 50 },
      ],
    },
  ];

  it('respects verticalScale=0, endpointStability=1, segmentStep, and user seed', () => {
    const variantsA = buildWiggledPathVariants(straightLine, {
      amplitude: 6,
      frameCount: 3,
      detail: 'medium',
      affectFill: true,
      segmentStep: 20,
      verticalScale: 0,
      endpointStability: 1,
      seed: 12,
    });
    const variantsB = buildWiggledPathVariants(straightLine, {
      amplitude: 6,
      frameCount: 3,
      detail: 'medium',
      affectFill: true,
      segmentStep: 20,
      verticalScale: 0,
      endpointStability: 1,
      seed: 99,
    });

    expect(variantsA).toHaveLength(3);
    // Distinct seeds produce distinct geometry
    expect(variantsA[0][0].d).not.toBe(variantsB[0][0].d);

    // Parse numbers from d: starts at (0, 50) and ends at (100, 50) when endpointStability === 1 & verticalScale === 0
    const dStr = variantsA[0][0].d;
    const nums = dStr.match(/-?\d+(?:\.\d+)?/g)?.map(Number) || [];
    // Subdivided line of length 100 with step 20 -> 6 points -> >= 12 coordinates
    expect(nums.length).toBeGreaterThanOrEqual(12);
    // Start point anchored at (0, 50)
    expect(nums[0]).toBe(0);
    expect(nums[1]).toBe(50);
    // End point anchored at (100, 50)
    expect(nums[nums.length - 2]).toBe(100);
    expect(nums[nums.length - 1]).toBe(50);
    // All y coords remain 50 because verticalScale === 0
    for (let i = 1; i < nums.length; i += 2) {
      expect(nums[i]).toBe(50);
    }
  });
});

describe('gameVariables store, set_variable, and variable triggers', () => {
  beforeEach(() => {
    useSceneStore.setState({
      appMode: 'edit',
      entities: {},
      entityOrder: [],
      rules: [],
      gameScore: 0,
      initialGameVariables: { score: 0 },
      gameVariables: { score: 0 },
    });
  });

  it('syncs score bidirectionally and protects score from deletion', () => {
    const store = useSceneStore.getState();
    store.setInitialGameVariable('score', 10);
    store.setInitialGameVariable('charge', 2.5);
    expect(useSceneStore.getState().initialGameVariables).toEqual({ score: 10, charge: 2.5 });
    expect(useSceneStore.getState().gameVariables).toEqual({ score: 10, charge: 2.5 });
    expect(useSceneStore.getState().gameScore).toBe(10);

    // Protect score from deletion
    store.deleteInitialGameVariable('score');
    store.deleteInitialGameVariable('charge');
    expect(useSceneStore.getState().initialGameVariables).toEqual({ score: 10 });

    // Runtime batch update syncs gameScore when score updates
    store.batchSetGameVariables({ score: 42, slider_x: 75 });
    expect(useSceneStore.getState().gameScore).toBe(42);
    expect(useSceneStore.getState().gameVariables).toEqual({ score: 42, slider_x: 75 });
  });

  it('evaluates threshold and on_change variable rules and executes set_variable actions', () => {
    const lamp = makeEntity({ id: 'lamp' });
    useSceneStore.setState({
      appMode: 'play',
      entities: { lamp },
      entityOrder: ['lamp'],
      initialGameVariables: { score: 0, lever: 0, level: 2 },
      gameVariables: { score: 0, lever: 0, level: 2 },
      rules: [
        {
          id: 'rule-threshold',
          name: 'Level >= 5',
          enabled: true,
          trigger: {
            type: 'variable',
            variableName: 'level',
            variableTriggerMode: 'threshold',
            variableOperator: '>=',
            variableValue: 5,
          },
          actions: [
            {
              id: 'act-var',
              type: 'set_variable',
              variableName: 'bonus',
              variableOperation: 'set',
              variableValue: 50,
            },
            {
              id: 'act-add',
              type: 'set_variable',
              variableName: 'bonus',
              variableOperation: 'add',
              variableValue: 25,
            },
          ],
        },
        {
          id: 'rule-onchange',
          name: 'Lever moved',
          enabled: true,
          trigger: {
            type: 'variable',
            variableName: 'lever',
            variableTriggerMode: 'on_change',
          },
          actions: [
            {
              id: 'act-state',
              type: 'change_state',
              targetMode: 'instance',
              targetId: 'lamp',
              targetStateId: 'active',
            },
          ],
        },
      ],
    });

    const store = useSceneStore.getState();
    // Tick 1: seeds on_change baseline, level=2 does not satisfy >= 5
    store.evaluateRules();
    expect(useSceneStore.getState().gameVariables.bonus).toBeUndefined();
    expect(useSceneStore.getState().entities.lamp.currentStateId).toBe('default');

    // Update variables and evaluate
    store.batchSetGameVariables({ level: 5, lever: 100 });
    store.evaluateRules();

    expect(useSceneStore.getState().gameVariables.bonus).toBe(75);
    expect(useSceneStore.getState().entities.lamp.currentStateId).toBe('active');
  });
});
