import { describe, it, expect } from 'vitest';
import { Entity } from '../types';
import {
  DEFAULT_PIVOT,
  getBodyWorldCenterFromPivot,
  getEntityTopLeftFromBodyWorldCenter,
  getEntityTopLeftFromPivotWorld,
  getPivotWorldPosition,
  resolveEffectivePivot,
  resolveRawPivot,
} from '../utils/physics/pivotHelpers';
import {
  JiggleRuntimeState,
  Spring2DState,
  stepJiggleRotational,
  stepSpring2D,
} from '../utils/physics/springJiggleSolver';
import {
  computeChildWorldFromParent,
  computeRelativeParentOffset,
} from '../store/parentingHelpers';

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Entity ${id}`,
    type: 'custom',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Idle',
        color: '#000000',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

describe('pivotHelpers', () => {
  it('resolves raw & effective pivot with priority hierarchy and flipX mirroring', () => {
    const entity = makeEntity({
      id: 'arm',
      flipX: true,
      pivot: { x: 0.2, y: 0.1 },
      states: {
        default: {
          id: 'default',
          name: 'Idle',
          color: '#000',
          scale: 1,
          rotation: 0,
          pivot: { x: 0.3, y: 0.4 },
        },
      },
    });

    // State pivot overrides entity pivot
    expect(resolveRawPivot(entity)).toEqual({ x: 0.3, y: 0.4 });
    // FlipX mirrors X around 0.5 -> 1 - 0.3 = 0.7
    const effFlipped = resolveEffectivePivot(entity);
    expect(effFlipped.x).toBeCloseTo(0.7, 5);
    expect(effFlipped.y).toBeCloseTo(0.4, 5);

    // Explicit override (e.g. Jiggle custom pivot) beats state/entity/runtime pivot
    expect(resolveRawPivot({ ...entity, runtimePivot: { x: 0.8, y: 0.9 } })).toEqual({
      x: 0.8,
      y: 0.9,
    });
    expect(resolveRawPivot(entity, entity.states.default, { x: 0.1, y: 0.2 })).toEqual({
      x: 0.1,
      y: 0.2,
    });
  });

  it('round-trips world pivot and rotated collider body center accurately', () => {
    const pos = { x: 120, y: 80 };
    const size = { width: 80, height: 160 };
    const effPivot = { x: 0.5, y: 0.1 }; // Top-center hinge

    const pw = getPivotWorldPosition(pos, size, effPivot);
    expect(pw).toEqual({ x: 160, y: 96 });
    expect(getEntityTopLeftFromPivotWorld(pw, size, effPivot)).toEqual(pos);

    // Default center equivalence
    expect(getPivotWorldPosition(pos, size, DEFAULT_PIVOT)).toEqual({ x: 160, y: 160 });

    // Body center relative to top-left (for example slightly off-center collider at (42, 95))
    const relCenterX = 42;
    const relCenterY = 95;
    for (const rotDeg of [0, 45, -65, 135]) {
      const bodyWorldCenter = getBodyWorldCenterFromPivot(
        pos,
        size,
        relCenterX,
        relCenterY,
        effPivot,
        rotDeg
      );
      const recovered = getEntityTopLeftFromBodyWorldCenter(
        bodyWorldCenter,
        size,
        relCenterX,
        relCenterY,
        effPivot,
        rotDeg
      );
      expect(recovered.x).toBeCloseTo(pos.x, 4);
      expect(recovered.y).toBeCloseTo(pos.y, 4);
    }
  });
});

describe('springJiggleSolver — stepSpring2D', () => {
  it('converges smoothly toward moving target', () => {
    const state: Spring2DState = { x: 0, y: 0, vx: 0, vy: 0 };
    for (let i = 0; i < 180; i++) {
      stepSpring2D({
        state,
        targetX: 200,
        targetY: -100,
        stiffness: 180,
        damping: 18,
        dt: 1 / 60,
      });
    }
    expect(state.x).toBeCloseTo(200, 0);
    expect(state.y).toBeCloseTo(-100, 0);
  });

  it('enforces maxDistance leash constraint and cancels outward velocity', () => {
    const state: Spring2DState = { x: 300, y: 0, vx: 500, vy: 0 };
    const res = stepSpring2D({
      state,
      targetX: 100,
      targetY: 0,
      stiffness: 100,
      damping: 10,
      maxDistance: 50,
      dt: 1 / 60,
    });
    expect(res.clampedByLeash).toBe(true);
    const dist = Math.hypot(res.x - 100, res.y);
    expect(dist).toBeCloseTo(50, 3);
    expect(res.vx).toBeLessThanOrEqual(0.001);
  });

  it('settles at expected vertical sag equilibrium under gravity', () => {
    const state: Spring2DState = { x: 100, y: 100, vx: 0, vy: 0 };
    const stiffness = 100;
    const gravity = 400;
    for (let i = 0; i < 240; i++) {
      stepSpring2D({
        state,
        targetX: 100,
        targetY: 100,
        stiffness,
        damping: 20,
        gravity,
        dt: 1 / 60,
      });
    }
    // Equilibrium: (targetY - y) * k + g = 0 => y = targetY + g / k = 104
    expect(state.y).toBeCloseTo(100 + gravity / stiffness, 1);
  });
});

describe('springJiggleSolver — stepJiggleRotational', () => {
  it('reacts to linear acceleration, respects maxAngle limits, and bounds MudBun squash', () => {
    const state: JiggleRuntimeState = {
      angleDeg: 0,
      angularVelDeg: 0,
      squashX: 1,
      squashY: 1,
    };

    const res = stepJiggleRotational({
      state,
      accelX: 4000,
      accelY: 0,
      baseWorldRotDeg: 0,
      effPivot: { x: 0.5, y: 0 }, // hanging downward (leverY = +0.5)
      stiffness: 180,
      damping: 8,
      inertia: 1.5,
      maxAngle: 25,
      gravityPull: 0,
      squashIntensity: 1.5,
      dt: 1 / 60,
    });

    // Should accelerate rotationally & keep squash bounded in [0.74, 1.32]
    expect(Math.abs(res.angularVelDeg)).toBeGreaterThan(10);
    expect(res.squashX).toBeGreaterThanOrEqual(0.74);
    expect(res.squashX).toBeLessThanOrEqual(1.32);
    expect(res.squashY).toBeGreaterThanOrEqual(0.74);
    expect(res.squashY).toBeLessThanOrEqual(1.32);

    // Push hard to test ±maxAngle clamping
    for (let i = 0; i < 40; i++) {
      stepJiggleRotational({
        state,
        accelX: 6000,
        accelY: 0,
        baseWorldRotDeg: 0,
        effPivot: { x: 0.5, y: 0 },
        stiffness: 80,
        damping: 3,
        inertia: 2.5,
        maxAngle: 25,
        gravityPull: 0,
        squashIntensity: 1.5,
        dt: 1 / 60,
      });
    }
    expect(Math.abs(state.angleDeg)).toBeLessThanOrEqual(25);
  });

  it('produces rotational droop from gravityPull when lever arm is horizontal', () => {
    const state: JiggleRuntimeState = {
      angleDeg: 0,
      angularVelDeg: 0,
      squashX: 1,
      squashY: 1,
    };
    const res = stepJiggleRotational({
      state,
      accelX: 0,
      accelY: 0,
      baseWorldRotDeg: 0,
      effPivot: { x: 0, y: 0.5 }, // pivot on left, CoM on right (+rx)
      stiffness: 120,
      damping: 10,
      inertia: 1,
      maxAngle: 45,
      gravityPull: 80,
      squashIntensity: 0,
      dt: 1 / 60,
    });
    // Gravity pulls CoM (+X) downward (+Y) -> positive clockwise torque (+angleDeg)
    expect(res.angleDeg).toBeGreaterThan(0);
    expect(res.squashX).toBe(1);
    expect(res.squashY).toBe(1);
  });
});

describe('parentingHelpers — off-center pivots & spring/collision metadata', () => {
  it('round-trips non-center child pivot across parent rotation and flipX while preserving spring settings', () => {
    const parent = makeEntity({
      id: 'torso',
      position: { x: 200, y: 200 },
      size: { width: 100, height: 100 },
      flipX: true,
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 30 },
      },
    });
    const child = makeEntity({
      id: 'cape',
      position: { x: 260, y: 240 },
      size: { width: 40, height: 80 },
      pivot: { x: 0.5, y: 0 }, // top hinge
      parentId: 'torso',
      parentOffset: {
        x: 0,
        y: 0,
        attachmentMode: 'spring',
        springStiffness: 220,
        springDamping: 14,
        springMaxDistance: 65,
        springGravity: 300,
        collideWithWorld: true,
      },
    });

    const computedOffset = computeRelativeParentOffset(child, parent, child.parentOffset);
    expect(computedOffset.attachmentMode).toBe('spring');
    expect(computedOffset.springStiffness).toBe(220);
    expect(computedOffset.springDamping).toBe(14);
    expect(computedOffset.springMaxDistance).toBe(65);
    expect(computedOffset.springGravity).toBe(300);
    expect(computedOffset.collideWithWorld).toBe(true);

    const attachedChild: Entity = { ...child, parentOffset: computedOffset };
    const reconstructed = computeChildWorldFromParent(attachedChild, parent);
    expect(reconstructed.position.x).toBeCloseTo(child.position.x, 0);
    expect(reconstructed.position.y).toBeCloseTo(child.position.y, 0);
    expect(reconstructed.flipX).toBe(true);
  });

  it('computes exact child anchor around off-center parent pivot for Jiggle chains', async () => {
    const { getParentAnchorWorldPosition } = await import('../utils/physics/pivotHelpers');
    const parent = makeEntity({
      id: 'link-1',
      position: { x: 100, y: 100 },
      size: { width: 40, height: 100 },
      pivot: { x: 0.5, y: 0 }, // Top hinge at (120, 100)
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 90 },
      },
    });
    const child = makeEntity({
      id: 'link-2',
      position: { x: 105, y: 195 }, // Pivot (120, 195) is +95 px below parent's top hinge (45 px below parent center)
      size: { width: 30, height: 80 },
      pivot: { x: 0.5, y: 0 },
      parentId: 'link-1',
    });

    // Compute offset before rotation
    const parentUnrotated = makeEntity({
      ...parent,
      states: { default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 0 } },
    });
    const offset = computeRelativeParentOffset(child, parentUnrotated);
    expect(offset.x).toBeCloseTo(0, 3);
    expect(offset.y).toBeCloseTo(45, 3);

    // When parent rotates +90° around top hinge (120, 100), anchor (+95 down from hinge) swings to (-95 left, 0) -> (25, 100)
    const rotatedAnchor = getParentAnchorWorldPosition({
      parentPosition: parent.position,
      parentSize: parent.size,
      parentPivot: { x: 0.5, y: 0 },
      parentRotDeg: 90,
      parentFlipX: false,
      offsetX: offset.x,
      offsetY: offset.y,
    });
    expect(rotatedAnchor.x).toBeCloseTo(25, 2);
    expect(rotatedAnchor.y).toBeCloseTo(100, 2);
  });
});

describe('live drag target tracking & Jiggle initialAngleOffset', () => {
  it('resolves live dragged entity position in resolveTargetWorldPoint without waiting for release', async () => {
    const { resolveTargetWorldPoint } = await import('../utils/physics/lookAtSolver');
    const target = makeEntity({
      id: 'head',
      position: { x: 50, y: 50 },
      size: { width: 80, height: 80 },
    });
    const patchedEntities = {
      head: { ...target, position: { x: 300, y: 180 } },
    };
    const pt = resolveTargetWorldPoint(
      'eye',
      100,
      100,
      'entity',
      'head',
      undefined,
      undefined,
      patchedEntities,
      null
    );
    expect(pt).toEqual({ x: 340, y: 220 });
  });

  it('starts deflected at initialAngleOffset and springs smoothly back within ±maxAngle', () => {
    const state: JiggleRuntimeState = {
      angleDeg: 55, // initialAngleOffset (55°) - restAngleOffset (0°)
      angularVelDeg: 0,
      squashX: 1,
      squashY: 1,
    };
    const firstStep = stepJiggleRotational({
      state,
      accelX: 0,
      accelY: 0,
      baseWorldRotDeg: 0,
      effPivot: { x: 0.5, y: 0 },
      stiffness: 180,
      damping: 5,
      inertia: 1.4,
      maxAngle: 35,
      gravityPull: 0,
      squashIntensity: 0,
      dt: 1 / 60,
    });
    // Does not jump straight from 55° to 35° on frame 1; pulls smoothly toward 0
    expect(firstStep.angleDeg).toBeGreaterThan(35);
    expect(firstStep.angleDeg).toBeLessThan(55);
  });
});

describe('physicsTestScenes — playable presets validation', () => {
  it('builds valid acyclic test scenes with existing parentId and currentStateId', async () => {
    const { PHYSICS_TEST_SCENE_DESCRIPTORS, buildPhysicsTestScene } = await import(
      '../store/physicsTestScenes'
    );
    expect(PHYSICS_TEST_SCENE_DESCRIPTORS.length).toBe(3);

    for (const desc of PHYSICS_TEST_SCENE_DESCRIPTORS) {
      const scene = buildPhysicsTestScene(desc.id);
      expect(scene.entityOrder.length).toBeGreaterThanOrEqual(3);
      expect(scene.entities[scene.selectedEntityId]).toBeDefined();
      for (const id of scene.entityOrder) {
        const ent = scene.entities[id];
        expect(ent).toBeDefined();
        expect(ent.states[ent.currentStateId]).toBeDefined();
        if (ent.parentId) {
          expect(scene.entities[ent.parentId]).toBeDefined();
          expect(ent.parentId).not.toBe(ent.id);
        }
      }
    }
  });
});

