import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AnimationFrame,
  DrivenAnimationBehaviorConfig,
  Entity,
} from '../types';
import {
  applyDrivenCurve,
  applyEndBehavior,
  applyManualAnimationControl,
  computeMappedRangeProgress,
  createInitialDrivenAnimationRuntime,
  resolveFrameIndexFromProgress,
  stepDrivenAnimationEntity,
} from '../utils/physics/drivenAnimationSolver';
import {
  controlEntityAnimationRuntime,
  getGizmoRuntimeDebugData,
  resetMatterPhysicsRuntime,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';
import { executeRuleActions } from '../store/ruleExecutionEngine';
import { clearTriggerGateState, resetPlaySessionClock } from '../store/triggerGate';
import { useSceneStore } from '../store/useSceneStore';
import { getEntityWorldColliderBounds } from '../utils/collider';

function makeFrames(count: number): AnimationFrame[] {
  return Array.from({ length: count }, (_, idx) => ({
    id: `frame-${idx + 1}`,
    vectorPaths: [],
  }));
}

function makeDrivenConfig(
  overrides: Partial<DrivenAnimationBehaviorConfig> = {}
): DrivenAnimationBehaviorConfig {
  return {
    id: 'beh-driven',
    type: 'driven_animation',
    enabled: true,
    sourceType: 'proximity',
    progressionMode: 'reversible',
    curve: 'linear',
    endBehavior: 'clamp',
    driveFlipbook: true,
    ...overrides,
  };
}

function makeEntity(id: string, overrides: Partial<Entity> = {}): Entity {
  const baseStateId = overrides.currentStateId || 'state-default';
  const baseState = {
    id: baseStateId,
    name: 'Normal',
    color: '#f97316',
    scale: 1,
    rotation: 0,
    frames: makeFrames(3),
  };
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 100, y: 100 },
    size: { width: 40, height: 40 },
    currentStateId: baseStateId,
    isDraggable: false,
    states: {
      [baseStateId]: baseState,
      ...(overrides.states || {}),
    },
    ...overrides,
  };
}

describe('Driven Animation (Kitty / Draco)', () => {
  beforeEach(() => {
    resetMatterPhysicsRuntime();
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.setState({
      entities: {},
      entityOrder: [],
      rules: [],
      gameVariables: {},
      appMode: 'edit',
    });
  });

  afterEach(() => {
    resetMatterPhysicsRuntime();
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.setState({
      entities: {},
      entityOrder: [],
      rules: [],
      gameVariables: {},
      appMode: 'edit',
    });
  });

  describe('Pure Solver (drivenAnimationSolver)', () => {
    it('applies curves, end behaviors, and range mapping accurately', () => {
      expect(applyDrivenCurve(0.5, 'linear')).toBeCloseTo(0.5);
      expect(applyDrivenCurve(0.5, 'ease_in')).toBeCloseTo(0.25);
      expect(applyDrivenCurve(0.5, 'ease_out')).toBeCloseTo(0.75);
      expect(applyDrivenCurve(0.5, 'ease_in_out')).toBeCloseTo(0.5);

      expect(applyEndBehavior(1.25, 'clamp')).toBeCloseTo(1);
      expect(applyEndBehavior(1.25, 'loop')).toBeCloseTo(0.25);
      expect(applyEndBehavior(1.25, 'ping_pong')).toBeCloseTo(0.75);

      // Proximity mapping: start=200 -> 0, end=50 -> 1
      expect(computeMappedRangeProgress(250, 200, 50)).toBeCloseTo(0);
      expect(computeMappedRangeProgress(125, 200, 50)).toBeCloseTo(0.5);
      expect(computeMappedRangeProgress(20, 200, 50)).toBeCloseTo(1);

      expect(resolveFrameIndexFromProgress(0, 4)).toBe(0);
      expect(resolveFrameIndexFromProgress(0.34, 4)).toBe(1);
      expect(resolveFrameIndexFromProgress(0.67, 4)).toBe(2);
      expect(resolveFrameIndexFromProgress(1, 4)).toBe(3);
    });

    it('supports reversible proximity scrubbing with smoothing and visual transform', () => {
      const cfg = makeDrivenConfig({
        sourceType: 'proximity',
        progressionMode: 'reversible',
        proximityDistanceStart: 200,
        proximityDistanceEnd: 0,
        smoothing: 0.5,
        driveVisualTransform: true,
        scaleStart: 1,
        scaleEnd: 2,
        rotationStart: 0,
        rotationEnd: 90,
        opacityStart: 1,
        opacityEnd: 0.2,
      });

      let rt = createInitialDrivenAnimationRuntime('s1');
      // Approach to midpoint (100px -> target 0.5)
      const step1 = stepDrivenAnimationEntity({
        config: cfg,
        runtime: rt,
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.05,
        inputs: { proximityDistance: 100 },
      });
      expect(step1.effectiveProgress).toBeGreaterThan(0);
      expect(step1.effectiveProgress).toBeLessThan(0.5);
      expect(step1.visualScale).toBeGreaterThan(1);
      expect(step1.visualRotation).toBeGreaterThan(0);
      expect(step1.visualOpacity).toBeLessThan(1);

      // Settle without smoothing at target distance 0
      const noSmoothCfg = { ...cfg, smoothing: 0 };
      const stepFull = stepDrivenAnimationEntity({
        config: noSmoothCfg,
        runtime: step1.nextRuntime,
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.05,
        inputs: { proximityDistance: 0 },
      });
      expect(stepFull.effectiveProgress).toBeCloseTo(1);
      expect(stepFull.frameIndex).toBe(4);
      expect(stepFull.visualScale).toBeCloseTo(2);
      expect(stepFull.visualRotation).toBeCloseTo(90);
      expect(stepFull.visualOpacity).toBeCloseTo(0.2);

      // Retreat away in reversible mode -> returns to frame 0
      const stepBack = stepDrivenAnimationEntity({
        config: noSmoothCfg,
        runtime: stepFull.nextRuntime,
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.05,
        inputs: { proximityDistance: 300 },
      });
      expect(stepBack.effectiveProgress).toBeCloseTo(0);
      expect(stepBack.frameIndex).toBe(0);
    });

    it('supports irreversible collision_step orange-juicer workflow with requireExit and cooldown', () => {
      const cfg = makeDrivenConfig({
        sourceType: 'collision_step',
        progressionMode: 'irreversible',
        collisionStepMode: 'one_frame',
        collisionRequireExit: true,
        collisionCooldownSec: 0.25,
      });

      let rt = createInitialDrivenAnimationRuntime('s-orange');

      // Initial idle outside juicer -> frame 0
      const s0 = stepDrivenAnimationEntity({
        config: cfg,
        runtime: rt,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.016,
        inputs: { isTouchingTarget: false },
      });
      expect(s0.frameIndex).toBe(0);

      // 1st entry into juicer -> frame 1 (half orange)
      const s1 = stepDrivenAnimationEntity({
        config: cfg,
        runtime: s0.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.016,
        inputs: { isTouchingTarget: true },
      });
      expect(s1.frameIndex).toBe(1);
      expect(s1.completedJustNow).toBe(false);

      // Staying inside juicer while requireExit=true -> stays at frame 1
      const sHold = stepDrivenAnimationEntity({
        config: cfg,
        runtime: s1.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.5,
        inputs: { isTouchingTarget: true },
      });
      expect(sHold.frameIndex).toBe(1);

      // Exit juicer -> stays at frame 1 because irreversible!
      const sExit = stepDrivenAnimationEntity({
        config: cfg,
        runtime: sHold.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.05,
        inputs: { isTouchingTarget: false },
      });
      expect(sExit.frameIndex).toBe(1);

      // Re-enter quickly before cooldown expires -> still frame 1
      const sTooFast = stepDrivenAnimationEntity({
        config: cfg,
        runtime: sExit.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.05,
        inputs: { isTouchingTarget: true },
      });
      expect(sTooFast.frameIndex).toBe(1);

      // Exit and wait for cooldown -> re-enter -> frame 2 (juiced!) & completedJustNow
      const sExit2 = stepDrivenAnimationEntity({
        config: cfg,
        runtime: sTooFast.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.3,
        inputs: { isTouchingTarget: false },
      });
      const s2 = stepDrivenAnimationEntity({
        config: cfg,
        runtime: sExit2.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.016,
        inputs: { isTouchingTarget: true },
      });
      expect(s2.frameIndex).toBe(2);
      expect(s2.completedJustNow).toBe(true);

      // Exit permanently -> still frame 2
      const sDoneExit = stepDrivenAnimationEntity({
        config: cfg,
        runtime: s2.nextRuntime,
        currentStateId: 's-orange',
        frameCount: 3,
        dt: 0.1,
        inputs: { isTouchingTarget: false },
      });
      expect(sDoneExit.frameIndex).toBe(2);
    });

    it('loops collision_step cleanly back to frame 0 after reaching end', () => {
      const cfg = makeDrivenConfig({
        sourceType: 'collision_step',
        progressionMode: 'irreversible',
        collisionStepMode: 'one_frame',
        collisionRequireExit: true,
        collisionCooldownSec: 0,
        endBehavior: 'loop',
      });

      let rt = createInitialDrivenAnimationRuntime('s1');
      const frames: (number | undefined)[] = [];
      for (let pass = 0; pass < 4; pass++) {
        const enter = stepDrivenAnimationEntity({
          config: cfg,
          runtime: rt,
          currentStateId: 's1',
          frameCount: 3,
          dt: 0.02,
          inputs: { isTouchingTarget: true },
        });
        frames.push(enter.frameIndex);
        const exit = stepDrivenAnimationEntity({
          config: cfg,
          runtime: enter.nextRuntime,
          currentStateId: 's1',
          frameCount: 3,
          dt: 0.02,
          inputs: { isTouchingTarget: false },
        });
        rt = exit.nextRuntime;
      }
      expect(frames).toEqual([1, 2, 0, 1]);
    });

    it('supports variable, speed, health, and collision_hold sources', () => {
      const varCfg = makeDrivenConfig({
        sourceType: 'variable',
        variableName: 'charge',
        variableMin: 10,
        variableMax: 50,
      });
      const resVar = stepDrivenAnimationEntity({
        config: varCfg,
        runtime: createInitialDrivenAnimationRuntime('s1'),
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.016,
        inputs: { variableValue: 30 },
      });
      expect(resVar.effectiveProgress).toBeCloseTo(0.5);
      expect(resVar.frameIndex).toBe(2);

      const healthCfg = makeDrivenConfig({
        sourceType: 'health',
        invertHealth: true,
      });
      const resHealth = stepDrivenAnimationEntity({
        config: healthCfg,
        runtime: createInitialDrivenAnimationRuntime('s1'),
        currentStateId: 's1',
        frameCount: 4,
        dt: 0.016,
        inputs: { healthRatio: 0.33 },
      });
      expect(resHealth.effectiveProgress).toBeCloseTo(0.67);
      expect(resHealth.frameIndex).toBe(2);

      const holdCfg = makeDrivenConfig({
        sourceType: 'collision_hold',
        progressionMode: 'reversible',
        collisionHoldRatePerSec: 100, // 100%/s
      });
      const hold1 = stepDrivenAnimationEntity({
        config: holdCfg,
        runtime: createInitialDrivenAnimationRuntime('s1'),
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.1,
        inputs: { isTouchingTarget: true },
      });
      const hold2 = stepDrivenAnimationEntity({
        config: holdCfg,
        runtime: hold1.nextRuntime,
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.1,
        inputs: { isTouchingTarget: true },
      });
      expect(hold2.effectiveProgress).toBeCloseTo(0.2);
      const holdRelease = stepDrivenAnimationEntity({
        config: holdCfg,
        runtime: hold2.nextRuntime,
        currentStateId: 's1',
        frameCount: 5,
        dt: 0.1,
        inputs: { isTouchingTarget: false },
      });
      expect(holdRelease.effectiveProgress).toBeCloseTo(0.1);
    });

    it('handles manual animation control (set_frame, step_frame, set_progress, reset)', () => {
      let rt = createInitialDrivenAnimationRuntime('s1');
      const r1 = applyManualAnimationControl({
        runtime: rt,
        currentStateId: 's1',
        frameCount: 4,
        hasDrivenBehavior: true,
        mode: 'set_frame',
        frameNumber: 3,
      });
      expect(r1.frameIndex).toBe(2);
      expect(r1.progress01).toBeCloseTo(2 / 3);

      const r2 = applyManualAnimationControl({
        runtime: r1.nextRuntime,
        currentStateId: 's1',
        frameCount: 4,
        hasDrivenBehavior: true,
        mode: 'step_frame',
        stepDelta: 2,
        loop: true,
      });
      expect(r2.frameIndex).toBe(0); // (2 + 2) % 4 = 0

      const r3 = applyManualAnimationControl({
        runtime: r2.nextRuntime,
        currentStateId: 's1',
        frameCount: 4,
        hasDrivenBehavior: true,
        mode: 'set_progress',
        progressPercent: 100,
      });
      expect(r3.frameIndex).toBe(3);

      const r4 = applyManualAnimationControl({
        runtime: r3.nextRuntime,
        currentStateId: 's1',
        frameCount: 4,
        hasDrivenBehavior: true,
        mode: 'reset',
      });
      expect(r4.frameIndex).toBe(0);
      expect(r4.nextRuntime.maxReachedProgress).toBe(0);
    });
  });

  describe('Physics Engine & RuleBook Integration', () => {
    it('evaluates proximity driven_animation, populates gizmo links, variables, and state completion in stepMatterPhysics', () => {
      const targetObj = makeEntity('magnet', {
        position: { x: 200, y: 100 },
        size: { width: 40, height: 40 },
      });
      const flower = makeEntity('flower', {
        position: { x: 100, y: 100 }, // center 120, target center 220 -> dist 100
        size: { width: 40, height: 40 },
        states: {
          'state-default': {
            id: 'state-default',
            name: 'Closed',
            color: '#f43f5e',
            scale: 1,
            rotation: 0,
            frames: makeFrames(3),
          },
          'state-bloomed': {
            id: 'state-bloomed',
            name: 'Bloomed',
            color: '#10b981',
            scale: 1,
            rotation: 0,
            frames: makeFrames(1),
          },
        },
        behaviors: [
          makeDrivenConfig({
            sourceType: 'proximity',
            targetType: 'entity',
            targetEntityId: 'magnet',
            proximityDistanceStart: 200,
            proximityDistanceEnd: 0,
            outputVariableName: 'bloom_pct',
            outputVariableMode: 'percent',
            outputFrameVariableName: 'bloom_frame',
            triggerStateOnCompleteId: 'state-bloomed',
          }),
        ],
      });

      const tick1 = stepMatterPhysics({
        entities: { flower, magnet: targetObj },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });

      expect(tick1.updatedTransforms.flower?.runtimeAnimFrameIndex).toBe(1);
      expect(tick1.variableUpdates?.bloom_pct).toBeCloseTo(50);
      expect(tick1.variableUpdates?.bloom_frame).toBe(2);
      expect(tick1.stateChanges?.flower).toBeUndefined();

      const gizmoData = getGizmoRuntimeDebugData();
      expect(gizmoData.drivenAnimLinks.flower).toBeDefined();
      expect(gizmoData.drivenAnimLinks.flower.frameIndex).toBe(1);
      expect(gizmoData.drivenAnimLinks.flower.targetPoint).toEqual({ x: 220, y: 120 });

      // Move magnet directly onto flower -> 100% -> triggers completion state
      const tick2 = stepMatterPhysics({
        entities: {
          flower,
          magnet: { ...targetObj, position: { x: 100, y: 100 } },
        },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tick2.updatedTransforms.flower?.runtimeAnimFrameIndex).toBe(2);
      expect(tick2.variableUpdates?.bloom_pct).toBeCloseTo(100);
      expect(tick2.stateChanges?.flower).toBe('state-bloomed');
    });

    it('detects collision_step overlap for non-physics Draggable orange on trigger_only juicer and triggers destroyOnComplete', () => {
      const juicer = makeEntity('juicer', {
        type: 'juicer_machine',
        position: { x: 300, y: 200 },
        size: { width: 80, height: 80 },
        colliderMode: 'trigger_only',
        colliderType: 'box',
      });

      const orange = makeEntity('orange', {
        isDraggable: true,
        position: { x: 100, y: 200 },
        size: { width: 40, height: 40 },
        behaviors: [
          makeDrivenConfig({
            sourceType: 'collision_step',
            progressionMode: 'irreversible',
            targetType: 'entity',
            targetEntityId: 'juicer',
            collisionStepMode: 'one_frame',
            collisionRequireExit: true,
            collisionCooldownSec: 0,
            destroyOnComplete: true,
            outputVariableName: 'juice_progress',
            outputVariableMode: 'percent',
          }),
        ],
      });

      // Outside juicer
      const t0 = stepMatterPhysics({
        entities: { orange, juicer },
        deltaTime: 0.02,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(t0.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(0);

      // Dragged into juicer -> frame 1
      const orangeInside = { ...orange, position: { x: 310, y: 210 } };
      const t1 = stepMatterPhysics({
        entities: { orange: orangeInside, juicer },
        deltaTime: 0.02,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(t1.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(1);
      expect(t1.variableUpdates?.juice_progress).toBeCloseTo(50);
      expect(t1.entitiesToDestroy || []).toEqual([]);

      // Dragged back out -> stays at frame 1 (irreversible)
      const tOut = stepMatterPhysics({
        entities: { orange, juicer },
        deltaTime: 0.02,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tOut.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(1);

      // Dragged back in 2nd time -> frame 2 -> 100% -> destroyOnComplete
      const t2 = stepMatterPhysics({
        entities: { orange: orangeInside, juicer },
        deltaTime: 0.02,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(t2.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(2);
      expect(t2.variableUpdates?.juice_progress).toBeCloseTo(100);
      expect(t2.entitiesToDestroy).toContain('orange');
    });

    it('executes control_animation RuleBook actions immediately on flipbook and driven entities', () => {
      const sprite = makeEntity('sprite', {
        states: {
          'state-default': {
            id: 'state-default',
            name: 'Normal',
            color: '#8b5cf6',
            scale: 1,
            rotation: 0,
            frames: makeFrames(4),
          },
        },
      });

      useSceneStore.setState({
        appMode: 'play',
        entities: { sprite },
        entityOrder: ['sprite'],
      });

      const runControl = (
        animControlMode: 'set_frame' | 'step_frame' | 'set_progress' | 'reset',
        extra: Record<string, unknown> = {}
      ) => {
        const store = useSceneStore.getState();
        executeRuleActions(
          [
            {
              id: `act-${animControlMode}`,
              type: 'control_animation',
              targetMode: 'instance',
              targetId: 'sprite',
              animControlMode,
              ...extra,
            },
          ],
          {
            subject: store.entities.sprite,
            allEntities: store.entities,
            updateEntityState: store.updateEntityState,
            updateEntityDetails: store.updateEntityDetails,
            deleteEntity: store.deleteEntity,
            spawnEntity: store.spawnEntity,
          }
        );
      };

      runControl('set_frame', { animFrameNumber: 3 });
      expect(useSceneStore.getState().entities.sprite.runtimeAnimFrameIndex).toBe(2);

      runControl('step_frame', { animStepDelta: 2, animLoopOnStep: true });
      expect(useSceneStore.getState().entities.sprite.runtimeAnimFrameIndex).toBe(0);

      runControl('set_progress', { animProgressPercent: 100 });
      expect(useSceneStore.getState().entities.sprite.runtimeAnimFrameIndex).toBe(3);

      runControl('reset');
      expect(useSceneStore.getState().entities.sprite.runtimeAnimFrameIndex).toBe(0);

      // Direct runtime helper pins frame 1; physics step syncs undefined entity field to 1
      const direct = controlEntityAnimationRuntime({
        entity: useSceneStore.getState().entities.sprite,
        mode: 'set_frame',
        frameNumber: 2,
      });
      expect(direct.frameIndex).toBe(1);

      const tick = stepMatterPhysics({
        entities: useSceneStore.getState().entities,
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tick.updatedTransforms.sprite?.runtimeAnimFrameIndex).toBe(1);
    });

    it('supports collision_traverse single-pass slicing and collision_travel scrubbing in irreversible mode', () => {
      const saw = makeEntity('saw', {
        position: { x: 300, y: 200 },
        size: { width: 100, height: 80 },
        colliderMode: 'trigger_only',
        colliderType: 'box',
      });

      const orange = makeEntity('orange', {
        position: { x: 240, y: 210 },
        size: { width: 60, height: 60 },
        colliderType: 'box',
        states: {
          'state-default': {
            id: 'state-default',
            name: 'Orange',
            color: '#f97316',
            scale: 1,
            rotation: 0,
            frames: makeFrames(5),
          },
        },
        behaviors: [
          makeDrivenConfig({
            sourceType: 'collision_traverse',
            progressionMode: 'irreversible',
            targetType: 'entity',
            targetEntityId: 'saw',
            traverseAxis: 'left_to_right',
          }),
        ],
      });

      // Just touching left edge (x=240..300 vs saw 300..400 -> 0%)
      const tEnter = stepMatterPhysics({
        entities: { orange, saw },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tEnter.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(0);

      // Halfway across saw (center at x=350 -> x=320..380) -> ~50% -> frame 2
      const tMid = stepMatterPhysics({
        entities: { orange: { ...orange, position: { x: 320, y: 210 } }, saw },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tMid.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(2);

      // Near right exit (bSelf ~ 388..436 overlapping saw bOther 310..390 -> ~98%) -> frame 4; then move back left -> stays irreversible at frame 4!
      const tExit = stepMatterPhysics({
        entities: { orange: { ...orange, position: { x: 382, y: 210 } }, saw },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tExit.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(4);

      const tBack = stepMatterPhysics({
        entities: { orange: { ...orange, position: { x: 100, y: 210 } }, saw },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tBack.updatedTransforms.orange?.runtimeAnimFrameIndex).toBe(4);

      // Test collision_travel accumulation inside contact
      resetMatterPhysicsRuntime();
      const grater = makeEntity('grater', {
        position: { x: 200, y: 200 },
        size: { width: 160, height: 120 },
        colliderMode: 'trigger_only',
        colliderType: 'box',
      });
      const cheese = makeEntity('cheese', {
        position: { x: 220, y: 220 },
        size: { width: 40, height: 40 },
        colliderType: 'box',
        behaviors: [
          makeDrivenConfig({
            sourceType: 'collision_travel',
            progressionMode: 'irreversible',
            targetType: 'entity',
            targetEntityId: 'grater',
            collisionTravelDistancePx: 100,
          }),
        ],
      });
      stepMatterPhysics({
        entities: { cheese, grater },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      const tr2 = stepMatterPhysics({
        entities: { cheese: { ...cheese, position: { x: 270, y: 220 } }, grater },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tr2.updatedTransforms.cheese?.runtimeAnimFrameIndex).toBe(1);
      const tr3 = stepMatterPhysics({
        entities: { cheese: { ...cheese, position: { x: 320, y: 220 } }, grater },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tr3.updatedTransforms.cheese?.runtimeAnimFrameIndex).toBe(2);
    });

    it('filters contacts by colliderSide and shrinks collider dynamically with syncColliderToFrame', () => {
      // block bSelf bounds: x=208..272, y=168..232; sensor height=40 -> bOther y=[pos.y+4..pos.y+36]
      const topSensor = makeEntity('topSensor', {
        position: { x: 200, y: 136 }, // y=140..172 overlaps top edge y=168
        size: { width: 80, height: 40 },
        colliderMode: 'trigger_only',
        colliderType: 'box',
      });
      const block = makeEntity('block', {
        position: { x: 200, y: 160 },
        size: { width: 80, height: 80 },
        colliderType: 'box',
        states: {
          'state-default': {
            id: 'state-default',
            name: 'Normal',
            color: '#8b5cf6',
            scale: 1,
            rotation: 0,
            frames: [
              { id: 'f0', vectorPaths: [{ id: 'p0', d: 'M 20 20', stroke: '#000', strokeWidth: 2, rect: { x: 20, y: 20, width: 160, height: 160 } }] },
              { id: 'f1', vectorPaths: [{ id: 'p1', d: 'M 80 80', stroke: '#000', strokeWidth: 2, rect: { x: 80, y: 80, width: 40, height: 40 } }] },
            ],
          },
        },
        behaviors: [
          makeDrivenConfig({
            sourceType: 'collision_step',
            progressionMode: 'irreversible',
            targetType: 'entity',
            targetEntityId: 'topSensor',
            colliderSide: 'bottom', // Expects bottom contact, NOT top
            syncColliderToFrame: true,
          }),
        ],
      });

      // Touching top edge should NOT advance because colliderSide is 'bottom'
      const tTop = stepMatterPhysics({
        entities: { block, topSensor },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tTop.updatedTransforms.block?.runtimeAnimFrameIndex).toBe(0);

      // Moving sensor to bottom edge (y=226 -> 230..262 overlaps bottom edge y=232) SHOULD advance to frame 1 & shrink collider to match f1
      const bottomSensor = { ...topSensor, position: { x: 200, y: 226 } };
      const tBottom = stepMatterPhysics({
        entities: { block, topSensor: bottomSensor },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });
      expect(tBottom.updatedTransforms.block?.runtimeAnimFrameIndex).toBe(1);

      const blockAtF1 = { ...block, runtimeAnimFrameIndex: 1 };
      const shrunkBounds = getEntityWorldColliderBounds(blockAtF1);
      expect(shrunkBounds.width).toBeLessThan(30);
    });

    it('supports component-linked sources: pull_tension, puppet_shake, rotation_angle, slider_value', () => {
      let rt = createInitialDrivenAnimationRuntime('state-default');
      const baseCfg = {
        id: 'da-comp',
        type: 'driven_animation' as const,
        enabled: true,
        progressionMode: 'reversible' as const,
      };

      const pullRes = stepDrivenAnimationEntity({
        config: { ...baseCfg, sourceType: 'pull_tension' },
        runtime: rt,
        currentStateId: 'state-default',
        frameCount: 5,
        dt: 0.016,
        inputs: { pullTensionRatio: 0.75 },
      });
      expect(pullRes.effectiveProgress).toBeCloseTo(0.75);
      expect(pullRes.frameIndex).toBe(3);

      const shakeRes = stepDrivenAnimationEntity({
        config: { ...baseCfg, sourceType: 'puppet_shake' },
        runtime: rt,
        currentStateId: 'state-default',
        frameCount: 5,
        dt: 0.016,
        inputs: { puppetShakeRatio: 0.5 },
      });
      expect(shakeRes.effectiveProgress).toBeCloseTo(0.5);
      expect(shakeRes.frameIndex).toBe(2);

      const rotRes = stepDrivenAnimationEntity({
        config: { ...baseCfg, sourceType: 'rotation_angle', angleMin: 0, angleMax: 180 },
        runtime: rt,
        currentStateId: 'state-default',
        frameCount: 5,
        dt: 0.016,
        inputs: { rotationAngleDeg: 90 },
      });
      expect(rotRes.effectiveProgress).toBeCloseTo(0.5);
      expect(rotRes.frameIndex).toBe(2);

      const sliderRes = stepDrivenAnimationEntity({
        config: { ...baseCfg, sourceType: 'slider_value' },
        runtime: rt,
        currentStateId: 'state-default',
        frameCount: 5,
        dt: 0.016,
        inputs: { sliderNormalizedValue: 1 },
      });
      expect(sliderRes.effectiveProgress).toBeCloseTo(1);
      expect(sliderRes.frameIndex).toBe(4);
    });
  });
});
