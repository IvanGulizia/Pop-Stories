import { describe, it, expect } from 'vitest';
import { Entity } from '../types';
import {
  DEFAULT_PIVOT,
  computeLocalGrabPivotFromClientPoint,
  getBodyWorldCenterFromPivot,
  getEntityTopLeftFromBodyWorldCenter,
  getEntityTopLeftFromPivotWorld,
  getPivotWorldPosition,
  reanchorPositionForPivotChange,
  resolveEffectivePivot,
  resolveRawPivot,
} from '../utils/physics/pivotHelpers';
import {
  createJointBreakRuntimeState,
  evaluateJointBreakState,
} from '../utils/physics/jointBreakSolver';
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

describe('matterPhysicsEngine — physics_joint pendulum & queued spawn impulse', () => {
  it('swings physics_joint arm and attached ball across the anchor rather than spinning in place', async () => {
    const { buildPhysicsTestScene } = await import('../store/physicsTestScenes');
    const { resetMatterPhysicsRuntime, stepMatterPhysics } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const scene = buildPhysicsTestScene('physics-joint-pendulum');
    let entities = { ...scene.entities };

    let minArmRot = Infinity;
    let maxArmRot = -Infinity;
    let minBallX = Infinity;
    let maxBallX = -Infinity;

    const colliderLayers = scene.layerGroups.flatMap((g) =>
      g.layers.filter((l) => (l.role === 'collider' || g.kind === 'collider') && l.visible)
    );

    for (let i = 0; i < 150; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
        colliderLayers,
      });

      const nextEntities: Record<string, Entity> = { ...entities };
      for (const [id, patch] of Object.entries(res.updatedTransforms)) {
        const cur = nextEntities[id];
        if (!cur) continue;
        const nextState =
          patch.rotation !== undefined
            ? {
                ...cur.states[cur.currentStateId],
                rotation: patch.rotation,
              }
            : cur.states[cur.currentStateId];
        nextEntities[id] = {
          ...cur,
          position: patch.position ?? cur.position,
          flipX: patch.flipX ?? cur.flipX,
          states: {
            ...cur.states,
            [cur.currentStateId]: nextState,
          },
        };
      }
      entities = nextEntities;

      const armRot = entities['test-joint-arm'].states['state_1'].rotation;
      const ballCenterX = entities['test-joint-ball'].position.x + entities['test-joint-ball'].size.width / 2;
      minArmRot = Math.min(minArmRot, armRot);
      maxArmRot = Math.max(maxArmRot, armRot);
      minBallX = Math.min(minBallX, ballCenterX);
      maxBallX = Math.max(maxBallX, ballCenterX);
    }

    // Arm pivots around top-center (400, 100), so its rotation swings across 0° (-35° -> +)
    // and attached ball swings across x = 400!
    expect(maxArmRot - minArmRot).toBeGreaterThan(25);
    expect(maxArmRot).toBeGreaterThan(0);
    expect(minArmRot).toBeLessThan(-10);
    expect(maxBallX - minBallX).toBeGreaterThan(60);
    expect(minBallX).toBeLessThan(400);
    expect(maxBallX).toBeGreaterThan(400);
    resetMatterPhysicsRuntime();
  });

  it('launches newly spawned entity along queued initial velocity vector', async () => {
    const { queueEntityInitialVelocity, resetMatterPhysicsRuntime, stepMatterPhysics } = await import(
      '../utils/matterPhysicsEngine'
    );

    resetMatterPhysicsRuntime();
    const projectile = makeEntity({
      id: 'proj-1',
      position: { x: 200, y: 200 },
      size: { width: 32, height: 32 },
    });
    queueEntityInitialVelocity('proj-1', 360, -180);

    let entities: Record<string, Entity> = { 'proj-1': projectile };
    for (let i = 0; i < 15; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (res.updatedTransforms['proj-1']?.position) {
        entities = {
          'proj-1': {
            ...entities['proj-1'],
            position: res.updatedTransforms['proj-1'].position!,
          },
        };
      }
    }

    expect(entities['proj-1'].position.x).toBeGreaterThan(250);
    expect(entities['proj-1'].position.y).toBeLessThan(175);
    resetMatterPhysicsRuntime();
  });
});

describe('jointAngularSolver & canvas pin placement (7-1 & 7-2)', () => {
  it('pulls deflected joint toward restWorldDeg via angular spring and cushions velocity in 2nd braking zone', async () => {
    const { stepJointAngularForces, clampJointBodyAngle } = await import(
      '../utils/physics/jointAngularSolver'
    );

    // 1. Angular spring pulls a +50° deflected joint back toward rest (0°)
    const springRes = stepJointAngularForces({
      currentAngleDeg: 50,
      angularVelDegPerSec: 0,
      restWorldDeg: 0,
      offset: {
        x: 0,
        y: 0,
        jointAngularStiffness: 180,
        jointAngularDamping: 4,
      },
      dt: 1 / 60,
    });
    expect(springRes.nextAngularVelDegPerSec).toBeLessThan(-100);

    // 2. 2nd braking zone near upper limit slows outward angular speed much faster than center zone
    const unbraked = stepJointAngularForces({
      currentAngleDeg: 20,
      angularVelDegPerSec: 240,
      restWorldDeg: 0,
      offset: {
        x: 0,
        y: 0,
        jointEnableAngleLimits: true,
        jointMinAngle: -75,
        jointMaxAngle: 75,
        jointBrakeAngle: 20,
        jointBrakeStrength: 90,
        jointAngularDamping: 0,
      },
      dt: 1 / 60,
    });
    expect(unbraked.inBrakeZone).toBe(false);

    const braked = stepJointAngularForces({
      currentAngleDeg: 68, // inside [55, 75] braking wedge
      angularVelDegPerSec: 240,
      restWorldDeg: 0,
      offset: {
        x: 0,
        y: 0,
        jointEnableAngleLimits: true,
        jointMinAngle: -75,
        jointMaxAngle: 75,
        jointBrakeAngle: 20,
        jointBrakeStrength: 90,
        jointAngularDamping: 0,
      },
      dt: 1 / 60,
    });
    expect(braked.inBrakeZone).toBe(true);
    expect(braked.brakeRatio).toBeGreaterThan(0.5);
    expect(braked.nextAngularVelDegPerSec).toBeLessThan(unbraked.nextAngularVelDegPerSec);

    // 3. Hard clamp limits angle and zeroes outward velocity, preserving inward velocity
    const clampedOut = clampJointBodyAngle({
      currentAngleDeg: 82,
      angularVelDegPerSec: 120,
      restWorldDeg: 0,
      offset: { x: 0, y: 0, jointEnableAngleLimits: true, jointMinAngle: -75, jointMaxAngle: 75 },
    });
    expect(clampedOut.clamped).toBe(true);
    expect(clampedOut.nextAngleDeg).toBe(75);
    expect(clampedOut.nextAngularVelDegPerSec).toBe(0);

    const clampedIn = clampJointBodyAngle({
      currentAngleDeg: -82,
      angularVelDegPerSec: 50, // moving inward toward rest
      restWorldDeg: 0,
      offset: { x: 0, y: 0, jointEnableAngleLimits: true, jointMinAngle: -75, jointMaxAngle: 75 },
    });
    expect(clampedIn.clamped).toBe(true);
    expect(clampedIn.nextAngleDeg).toBe(-75);
    expect(clampedIn.nextAngularVelDegPerSec).toBe(50);
  });

  it('places attachment pin directly on canvas without moving rotated child and round-trips through computeChildWorldFromParent', async () => {
    const {
      computeParentOffsetFromWorldPin,
      getChildAttachmentPinWorld,
    } = await import('../store/parentingHelpers');

    const parent = makeEntity({
      id: 'torso',
      position: { x: 100, y: 100 },
      size: { width: 100, height: 100 }, // center (150, 150)
      states: { default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 20 } },
    });
    const child = makeEntity({
      id: 'limb',
      position: { x: 180, y: 140 },
      size: { width: 40, height: 120 },
      pivot: { x: 0.5, y: 0.5 },
      parentId: 'torso',
      states: { default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 35 } },
    });

    const oldCenter = getBodyWorldCenterFromPivot(
      child.position,
      child.size,
      child.size.width / 2,
      child.size.height / 2,
      resolveEffectivePivot(child),
      35
    );

    const worldPin = { x: 195, y: 148 };
    const { parentOffset, childPosition } = computeParentOffsetFromWorldPin(
      child,
      parent,
      worldPin,
      { x: 0, y: 0, attachmentMode: 'physics_joint' }
    );

    expect(parentOffset.jointChildPivot).toBeDefined();
    expect(parentOffset.attachmentMode).toBe('physics_joint');

    const updatedChild: Entity = {
      ...child,
      position: childPosition,
      parentOffset,
    };

    // Child's visual world center remains virtually unchanged around worldPin
    const newCenter = getBodyWorldCenterFromPivot(
      updatedChild.position,
      updatedChild.size,
      updatedChild.size.width / 2,
      updatedChild.size.height / 2,
      resolveEffectivePivot(updatedChild),
      35
    );
    expect(newCenter.x).toBeCloseTo(oldCenter.x, 0);
    expect(newCenter.y).toBeCloseTo(oldCenter.y, 0);

    // Attachment pin matches clicked world coordinates
    const pinCheck = getChildAttachmentPinWorld(updatedChild, parent);
    expect(pinCheck.x).toBeCloseTo(worldPin.x, 0);
    expect(pinCheck.y).toBeCloseTo(worldPin.y, 0);

    // Round-trip via computeChildWorldFromParent reproduces childPosition & rotation
    const synced = computeChildWorldFromParent(updatedChild, parent);
    expect(synced.position.x).toBeCloseTo(childPosition.x, 0);
    expect(synced.position.y).toBeCloseTo(childPosition.y, 0);
    expect(synced.rotation).toBeCloseTo(35, 0);
  });

  it('simulates multi-link physics_joint chain with initial angle offset, angular spring, and hard angle limits', async () => {
    const { resetMatterPhysicsRuntime, stepMatterPhysics } = await import(
      '../utils/matterPhysicsEngine'
    );
    const { getParentAnchorWorldPosition } = await import('../utils/physics/pivotHelpers');

    resetMatterPhysicsRuntime();

    const base = makeEntity({
      id: 'chain-base',
      position: { x: 380, y: 80 },
      size: { width: 40, height: 40 },
    });

    const link1 = makeEntity({
      id: 'chain-link-1',
      position: { x: 385, y: 100 },
      size: { width: 30, height: 100 },
      pivot: { x: 0.5, y: 0 },
      parentId: base.id,
      parentOffset: {
        x: 0,
        y: 0,
        rotationOffset: 0,
        inheritRotation: false,
        inheritFlip: true,
        attachmentMode: 'physics_joint',
        springStiffness: 420,
        springDamping: 8,
        springGravity: 300,
        collideWithWorld: false,
        jointChildPivot: { x: 0.5, y: 0 },
        jointEnableAngleLimits: true,
        jointMinAngle: -60,
        jointMaxAngle: 60,
        jointBrakeAngle: 18,
        jointBrakeStrength: 80,
        jointInitialAngleOffset: 50,
        jointAngularStiffness: 90,
        jointAngularDamping: 3,
      },
    });

    const link2 = makeEntity({
      id: 'chain-link-2',
      position: { x: 388, y: 190 },
      size: { width: 24, height: 80 },
      pivot: { x: 0.5, y: 0 },
      parentId: link1.id,
      parentOffset: {
        x: 0,
        y: 40, // +40 px below link1's center = (0.5, 0.9) on 100px tall link1
        rotationOffset: 0,
        inheritRotation: true,
        inheritFlip: true,
        attachmentMode: 'physics_joint',
        springStiffness: 420,
        springDamping: 8,
        springGravity: 320,
        collideWithWorld: false,
        jointChildPivot: { x: 0.5, y: 0 },
        jointEnableAngleLimits: true,
        jointMinAngle: -65,
        jointMaxAngle: 65,
        jointBrakeAngle: 15,
        jointBrakeStrength: 75,
        jointInitialAngleOffset: 20,
        jointAngularStiffness: 70,
        jointAngularDamping: 3,
      },
    });

    let entities: Record<string, Entity> = {
      [base.id]: base,
      [link1.id]: link1,
      [link2.id]: link2,
    };

    let minRot1 = Infinity;
    let maxRot1 = -Infinity;
    let maxPinError = 0;

    for (let i = 0; i < 60; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });

      const next: Record<string, Entity> = { ...entities };
      for (const [id, patch] of Object.entries(res.updatedTransforms)) {
        const cur = next[id];
        if (!cur) continue;
        next[id] = {
          ...cur,
          position: patch.position ?? cur.position,
          states:
            patch.rotation !== undefined
              ? {
                  ...cur.states,
                  [cur.currentStateId]: {
                    ...cur.states[cur.currentStateId],
                    rotation: patch.rotation,
                  },
                }
              : cur.states,
        };
      }
      entities = next;

      const r1 = entities[link1.id].states.default.rotation;
      minRot1 = Math.min(minRot1, r1);
      maxRot1 = Math.max(maxRot1, r1);

      const expectedPin2 = getParentAnchorWorldPosition({
        parentPosition: entities[link1.id].position,
        parentSize: entities[link1.id].size,
        parentPivot: resolveEffectivePivot(entities[link1.id]),
        parentRotDeg: r1,
        parentFlipX: false,
        offsetX: 0,
        offsetY: 40,
        inheritRotation: true,
        inheritFlip: true,
      });
      const actualPin2 = getPivotWorldPosition(
        entities[link2.id].position,
        entities[link2.id].size,
        resolveEffectivePivot(entities[link2.id])
      );
      maxPinError = Math.max(
        maxPinError,
        Math.hypot(actualPin2.x - expectedPin2.x, actualPin2.y - expectedPin2.y)
      );
    }

    // Link1 starts near +50°, swings back under angular spring + gravity, and never exceeds ±60° limit
    expect(maxRot1).toBeGreaterThan(30);
    expect(maxRot1).toBeLessThanOrEqual(60.5);
    expect(minRot1).toBeGreaterThanOrEqual(-60.5);
    expect(minRot1).toBeLessThan(maxRot1 - 15);
    // Link2's hinge stays tightly coupled to Link1's tip along the chain
    expect(maxPinError).toBeLessThan(12);
    resetMatterPhysicsRuntime();
  });

  it('computes exact local grab pivot and reanchors position without visual jump on pivot change', () => {
    const pos = { x: 100, y: 200 };
    const size = { width: 120, height: 80 };
    const currentEff = { x: 0.5, y: 0.5 };
    const rotDeg = 35;

    // Click near top-right corner (u=0.9, v=0.1) in rotated screen space
    const pivotWorld = getPivotWorldPosition(pos, size, currentEff);
    const rad = (rotDeg * Math.PI) / 180;
    const dx = (0.9 - 0.5) * size.width;
    const dy = (0.1 - 0.5) * size.height;
    const clickWorld = {
      x: pivotWorld.x + dx * Math.cos(rad) - dy * Math.sin(rad),
      y: pivotWorld.y + dx * Math.sin(rad) + dy * Math.cos(rad),
    };

    const rawPivot = computeLocalGrabPivotFromClientPoint({
      canvasPoint: clickWorld,
      entityPosition: pos,
      entitySize: size,
      currentEffPivot: currentEff,
      totalRotationDeg: rotDeg,
      flipX: false,
    });

    expect(rawPivot.x).toBeCloseTo(0.9, 2);
    expect(rawPivot.y).toBeCloseTo(0.1, 2);

    // Reanchor when switching transformOrigin from center to grabbed corner: center point world position must remain invariant
    const reanchored = reanchorPositionForPivotChange({
      position: pos,
      size,
      oldEffPivot: currentEff,
      newEffPivot: rawPivot,
      rotationDeg: rotDeg,
    });
    const centerBefore = getBodyWorldCenterFromPivot(pos, size, 60, 40, currentEff, rotDeg);
    const centerAfter = getBodyWorldCenterFromPivot(reanchored, size, 60, 40, rawPivot, rotDeg);
    expect(centerAfter.x).toBeCloseTo(centerBefore.x, 3);
    expect(centerAfter.y).toBeCloseTo(centerBefore.y, 3);
  });

  it('evaluates breakable joint pull force and shake fatigue while respecting startup grace window', () => {
    const offset = {
      x: 0,
      y: 0,
      jointBreakable: true,
      jointBreakForce: 200,
      jointBreakShakeThreshold: 100,
    };

    // 1. Grace window (< 80ms) must not break even under sudden initial pull
    let state = createJointBreakRuntimeState();
    const earlyRes = evaluateJointBreakState({
      state,
      offset,
      pinAWorld: { x: 100, y: 100 },
      pinBWorld: { x: 140, y: 100 },
      angVelDegPerSec: 0,
      dt: 0.016,
    });
    expect(earlyRes.broken).toBe(false);

    // 2. Advance past grace period and trigger pull break
    state = { ...earlyRes.nextState, ageSec: 0.12 };
    const forceBreak = evaluateJointBreakState({
      state,
      offset,
      pinAWorld: { x: 100, y: 100 },
      pinBWorld: { x: 130, y: 100 }, // 30px * 8 = 240 >= 200
      angVelDegPerSec: 0,
      dt: 0.016,
    });
    expect(forceBreak.broken).toBe(true);
    expect(forceBreak.reason).toBe('force');

    // 3. Repeated rapid velocity reversals trigger shake break
    let shakeState = { ...createJointBreakRuntimeState(), ageSec: 0.2, hasPrevSample: true, prevAngVelDegPerSec: 400 };
    let brokeByShake = false;
    let breakReason: string | null = null;
    for (let i = 0; i < 12; i++) {
      const targetVel = i % 2 === 0 ? -420 : 420;
      const res = evaluateJointBreakState({
        state: shakeState,
        offset: { ...offset, jointBreakForce: 900 },
        pinAWorld: { x: 100, y: 100 },
        pinBWorld: { x: 102, y: 100 },
        angVelDegPerSec: targetVel,
        dt: 0.016,
      });
      shakeState = res.nextState;
      if (res.broken) {
        brokeByShake = true;
        breakReason = res.reason;
        break;
      }
    }
    expect(brokeByShake).toBe(true);
    expect(breakReason).toBe('shake');
  });

  it('tilts a dynamic box when grabbed at a corner with precisePhysicsGrab', async () => {
    const {
      endPhysicsGrab,
      resetMatterPhysicsRuntime,
      startPhysicsGrab,
      stepMatterPhysics,
      updatePhysicsGrabTarget,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const box = makeEntity({
      id: 'grab-box',
      position: { x: 200, y: 200 },
      size: { width: 120, height: 60 },
      colliderType: 'box',
      behaviors: [
        {
          id: 'drag-1',
          type: 'draggable',
          enabled: true,
          throwable: true,
          precisePhysicsGrab: true,
        },
        {
          id: 'phys-1',
          type: 'physics',
          enabled: true,
          gravity: 500,
          mass: 1,
          bounce: 0.2,
          friction: 0.4,
        },
      ],
    });

    let entities: Record<string, Entity> = { [box.id]: box };
    // Initialize Matter body on first tick
    stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });

    // Grab top-right corner (312, 206) and hold it up while gravity pulls the left side down
    const started = startPhysicsGrab(box.id, 312, 206);
    expect(started).toBe(true);
    updatePhysicsGrabTarget(box.id, 312, 160);

    for (let i = 0; i < 35; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[box.id];
      if (patch) {
        entities[box.id] = {
          ...entities[box.id],
          position: patch.position ?? entities[box.id].position,
          states:
            patch.rotation !== undefined
              ? { ...entities[box.id].states, default: { ...entities[box.id].states.default, rotation: patch.rotation } }
              : entities[box.id].states,
        };
      }
    }

    endPhysicsGrab(box.id, false);
    const finalRot = Math.abs(entities[box.id].states.default.rotation);
    expect(finalRot).toBeGreaterThan(8);
    resetMatterPhysicsRuntime();
  });

  it('breaks a breakable physics_joint when pulled forcefully, keeps child grabbed, and drops under gravity on release', async () => {
    const {
      endPhysicsGrab,
      isEntityPhysicsGrabbed,
      resetMatterPhysicsRuntime,
      startPhysicsGrab,
      stepMatterPhysics,
      updatePhysicsGrabTarget,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const branch = makeEntity({
      id: 'branch-parent',
      position: { x: 350, y: 100 },
      size: { width: 80, height: 30 },
      colliderType: 'box',
    });

    const leaf = makeEntity({
      id: 'leaf-child',
      position: { x: 375, y: 115 },
      size: { width: 30, height: 60 },
      pivot: { x: 0.5, y: 0 },
      colliderType: 'box',
      parentId: branch.id,
      parentOffset: {
        x: 0,
        y: 0,
        attachmentMode: 'physics_joint',
        springStiffness: 300,
        springDamping: 8,
        springGravity: 300,
        collideWithWorld: true,
        jointChildPivot: { x: 0.5, y: 0 },
        jointBreakable: true,
        jointBreakForce: 140,
        jointBreakShakeThreshold: 0,
        jointBreakFallWithGravity: true,
      },
      behaviors: [
        {
          id: 'drag-leaf',
          type: 'draggable',
          enabled: true,
          throwable: false,
          precisePhysicsGrab: true,
        },
      ],
    });

    let entities: Record<string, Entity> = { [branch.id]: branch, [leaf.id]: leaf };
    // Run 8 ticks past startup grace window (8 * 16.6ms ~ 133ms > 80ms)
    for (let i = 0; i < 8; i++) {
      stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });
    }

    // Grab leaf tip and yank far down-right to exceed jointBreakForce=140
    expect(startPhysicsGrab(leaf.id, 390, 165)).toBe(true);
    let breakEvent: { childId: string; parentId: string; reason: 'force' | 'shake' } | null = null;

    for (let i = 0; i < 20; i++) {
      updatePhysicsGrabTarget(leaf.id, 390 + i * 8, 165 + i * 12);
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (res.brokenJointEvents && res.brokenJointEvents.length > 0) {
        breakEvent = res.brokenJointEvents[0];
        // Simulate Scene detaching parentId
        const { parentId: _p, parentOffset: _o, ...detached } = entities[leaf.id];
        entities = { ...entities, [leaf.id]: detached as Entity };
        break;
      }
    }

    expect(breakEvent).not.toBeNull();
    expect(breakEvent?.childId).toBe(leaf.id);
    expect(breakEvent?.parentId).toBe(branch.id);
    expect(breakEvent?.reason).toBe('force');
    // Child stays held in hand until user releases
    expect(isEntityPhysicsGrabbed(leaf.id)).toBe(true);

    // Release and confirm broken leaf falls under gravity even with no explicit physics behavior
    endPhysicsGrab(leaf.id, false);
    const yAtRelease = entities[leaf.id].position.y;
    for (let i = 0; i < 25; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[leaf.id];
      if (patch?.position) {
        entities[leaf.id] = { ...entities[leaf.id], position: patch.position };
      }
    }
    expect(entities[leaf.id].position.y).toBeGreaterThan(yAtRelease + 25);
    resetMatterPhysicsRuntime();
  });

  it('activates runtimePivot during drag when interactive_puppet has swingAroundGrabPoint', async () => {
    const {
      notifyEntityDragLifecycle,
      resetMatterPhysicsRuntime,
      setActiveDragPosition,
      setPuppetGrabPivot,
      stepMatterPhysics,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const puppet = makeEntity({
      id: 'puppet-grab',
      position: { x: 200, y: 200 },
      size: { width: 100, height: 140 },
      behaviors: [
        {
          id: 'beh-puppet',
          type: 'interactive_puppet',
          enabled: true,
          swingMode: 'pendulum',
          swingAroundGrabPoint: true,
          pendulumMaxAngle: 35,
        },
      ],
    });

    const entities: Record<string, Entity> = { [puppet.id]: puppet };
    setPuppetGrabPivot(puppet.id, { x: 0.85, y: 0.15 });
    notifyEntityDragLifecycle(puppet.id, 'start', puppet.position);

    let lastRes = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    for (let i = 1; i <= 5; i++) {
      setActiveDragPosition(puppet.id, { x: 200 + i * 25, y: 200 });
      lastRes = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
    }

    expect(lastRes.updatedTransforms[puppet.id]?.runtimePivot).toEqual({ x: 0.85, y: 0.15 });
    expect(Math.abs(lastRes.updatedTransforms[puppet.id]?.runtimeTilt ?? 0)).toBeGreaterThan(0);

    setActiveDragPosition(puppet.id, null);
    notifyEntityDragLifecycle(puppet.id, 'end', undefined, true);
    resetMatterPhysicsRuntime();
  });

  it('hit-tests rotated entity with off-center pivot accurately inside green collider via EntityHitTestContext', async () => {
    const { isPointInsideEntityCollider } = await import('../utils/collider');
    const arm = makeEntity({
      id: 'rotated-arm',
      position: { x: 200, y: 150 },
      size: { width: 40, height: 120 },
      pivot: { x: 0.5, y: 0 }, // Top-center hinge at (220, 150)
      colliderBounds: {
        mode: 'manual',
        shape: 'box',
        x: 20,
        y: 10,
        width: 160,
        height: 180,
      },
      states: {
        default: {
          id: 'default',
          name: 'Idle',
          color: '#000',
          scale: 1,
          rotation: -90, // Rotated -90° CCW around top-center (220, 150) -> extends right to (340, 150)
        },
      },
    });

    const containerRect = { left: 0, top: 0, width: 800, height: 500 };
    const ctx = {
      position: arm.position,
      totalRotationDeg: -90,
      scaleX: 1,
      scaleY: 1,
      effPivot: { x: 0.5, y: 0 },
      containerRect,
    };

    // Tip midpoint of the arm swung to ~(280, 150) should be strictly inside
    expect(isPointInsideEntityCollider(280, 150, null, arm, arm.states.default, ctx)).toBe(true);
    // Point below unrotated box (220, 240) should NOT register when arm is rotated -90°
    expect(isPointInsideEntityCollider(220, 240, null, arm, arm.states.default, ctx)).toBe(false);
  });

  it('does not teleport a rotated/off-center entity on non-precise drag release', async () => {
    const {
      resetMatterPhysicsRuntime,
      setActiveDragPosition,
      stepMatterPhysics,
      syncEntityDragPosition,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const plank = makeEntity({
      id: 'rotated-plank',
      position: { x: 180, y: 120 },
      size: { width: 140, height: 40 },
      pivot: { x: 0.2, y: 0.5 },
      colliderType: 'box',
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 35 },
      },
      behaviors: [
        { id: 'd1', type: 'draggable', enabled: true, throwable: false, precisePhysicsGrab: false },
        { id: 'p1', type: 'physics', enabled: true, gravity: 500, mass: 1, bounce: 0.1, friction: 0.5 },
      ],
    });

    let entities: Record<string, Entity> = { [plank.id]: plank };
    // Initialize body
    stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });

    // Drag cleanly to (310, 220) while rotated 35° around off-center pivot (0.2, 0.5)
    const draggedPos = { x: 310, y: 220 };
    for (let i = 0; i < 6; i++) {
      syncEntityDragPosition(
        plank.id,
        draggedPos.x,
        draggedPos.y,
        plank.size.width,
        plank.size.height,
        { x: 0.2, y: 0.5 }
      );
      stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });
    }

    // Release at final dragged position
    syncEntityDragPosition(
      plank.id,
      draggedPos.x,
      draggedPos.y,
      plank.size.width,
      plank.size.height,
      { x: 0.2, y: 0.5 }
    );
    setActiveDragPosition(plank.id, null);
    entities = { [plank.id]: { ...entities[plank.id], position: draggedPos } };

    // Immediate next tick after release must stay right at draggedPos (no teleport)
    const afterRelease = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    const outPos = afterRelease.updatedTransforms[plank.id]?.position ?? draggedPos;
    expect(Math.hypot(outPos.x - draggedPos.x, outPos.y - draggedPos.y)).toBeLessThan(2);
    resetMatterPhysicsRuntime();
  });

  it('bounds rotation within ±grabMaxAngle in damped_limited precisePhysicsGrab mode', async () => {
    const {
      endPhysicsGrab,
      resetMatterPhysicsRuntime,
      startPhysicsGrab,
      stepMatterPhysics,
      updatePhysicsGrabTarget,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const box = makeEntity({
      id: 'limited-grab-box',
      position: { x: 250, y: 150 },
      size: { width: 160, height: 60 },
      colliderType: 'box',
      behaviors: [
        {
          id: 'd1',
          type: 'draggable',
          enabled: true,
          throwable: false,
          precisePhysicsGrab: true,
          grabRotationMode: 'damped_limited',
          grabMaxAngle: 28,
          grabBrakeAngle: 10,
          grabAngularStiffness: 60,
          grabAngularDamping: 6,
        },
        { id: 'p1', type: 'physics', enabled: true, gravity: 700, mass: 1, bounce: 0.1, friction: 0.5 },
      ],
    });

    const entities: Record<string, Entity> = { [box.id]: box };
    stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });

    expect(
      startPhysicsGrab(box.id, 405, 155, {
        rotationMode: 'damped_limited',
        maxAngle: 28,
        brakeAngle: 10,
        angularStiffness: 60,
        angularDamping: 6,
      })
    ).toBe(true);
    updatePhysicsGrabTarget(box.id, 405, 120);

    let maxObservedAbsRot = 0;
    for (let i = 0; i < 45; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[box.id];
      if (patch?.rotation !== undefined) {
        maxObservedAbsRot = Math.max(maxObservedAbsRot, Math.abs(patch.rotation));
      }
    }

    endPhysicsGrab(box.id, false);
    expect(maxObservedAbsRot).toBeGreaterThan(3);
    expect(maxObservedAbsRot).toBeLessThanOrEqual(28.5);
    resetMatterPhysicsRuntime();
  });

  it('produces stationary gravity lean when holding kinematic puppet off-center without Physics', async () => {
    const {
      notifyEntityDragLifecycle,
      resetMatterPhysicsRuntime,
      setActiveDragPosition,
      setPuppetGrabPivot,
      stepMatterPhysics,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    const puppet = makeEntity({
      id: 'kinematic-lean-puppet',
      position: { x: 200, y: 180 },
      size: { width: 100, height: 140 },
      behaviors: [
        {
          id: 'beh-puppet',
          type: 'interactive_puppet',
          enabled: true,
          swingMode: 'pendulum',
          swingAroundGrabPoint: true,
          pendulumMaxAngle: 35,
        },
      ],
    });

    const entities: Record<string, Entity> = { [puppet.id]: puppet };
    // Grabbed at top-left corner (0.1, 0.1) and held completely still (zero drag velocity)
    setPuppetGrabPivot(puppet.id, { x: 0.1, y: 0.1 });
    notifyEntityDragLifecycle(puppet.id, 'start', puppet.position);
    setActiveDragPosition(puppet.id, puppet.position);

    let tilt = 0;
    for (let i = 0; i < 20; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (res.updatedTransforms[puppet.id]?.runtimeTilt !== undefined) {
        tilt = res.updatedTransforms[puppet.id].runtimeTilt!;
      }
    }

    // Grabbed top-left -> hangs clockwise (+tilt) even without horizontal mouse movement
    expect(tilt).toBeGreaterThan(5);

    setActiveDragPosition(puppet.id, null);
    notifyEntityDragLifecycle(puppet.id, 'end', undefined, false);
    resetMatterPhysicsRuntime();
  });

  it('preserves grabPivot and gravity lean across ticks between pointerdown (hold) and drag threshold even with custom entity.pivot', async () => {
    const {
      notifyEntityDragLifecycle,
      releasePuppetGrabHold,
      resetMatterPhysicsRuntime,
      setActiveDragPosition,
      setPuppetGrabPivot,
      stepMatterPhysics,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    let puppet = makeEntity({
      id: 'custom-pivot-puppet',
      position: { x: 200, y: 150 },
      size: { width: 100, height: 180 },
      pivot: { x: 0.5, y: 0.9 }, // Pivot de base aux pieds
      behaviors: [
        {
          id: 'beh-puppet',
          type: 'interactive_puppet',
          enabled: true,
          swingMode: 'both',
          swingAroundGrabPoint: true,
          pendulumMaxAngle: 35,
        },
      ],
    });

    // Simulation exacte de onPointerDown avant le seuil de 3px de Framer Motion
    setPuppetGrabPivot(puppet.id, { x: 0.15, y: 0.15 }, true);
    puppet = { ...puppet, runtimePivot: { x: 0.15, y: 0.15 } };

    // 5 frames s'écoulent AVANT que handleDragStart ne se déclenche
    let tiltBeforeMove = 0;
    for (let i = 0; i < 5; i++) {
      const res = stepMatterPhysics({
        entities: { [puppet.id]: puppet },
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[puppet.id];
      // Le pivot saisi ne doit JAMAIS être effacé avant le dragStart
      expect(patch?.runtimePivot).not.toBeNull();
      if (patch?.runtimeTilt !== undefined) {
        tiltBeforeMove = patch.runtimeTilt;
        puppet = { ...puppet, runtimeTilt: patch.runtimeTilt };
      }
    }
    expect(tiltBeforeMove).toBeGreaterThan(0.5);
    expect(resolveEffectivePivot(puppet, puppet.states[puppet.currentStateId])).toEqual({
      x: 0.15,
      y: 0.15,
    });

    // Maintenant l'utilisateur bouge > 3px (dragStart + drag)
    notifyEntityDragLifecycle(puppet.id, 'start', puppet.position);
    setActiveDragPosition(puppet.id, { x: 240, y: 150 });
    const dragRes = stepMatterPhysics({
      entities: { [puppet.id]: puppet },
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    expect(dragRes.updatedTransforms[puppet.id]?.runtimePivot).not.toBeNull();

    // Relâchement : le pivot reste actif jusqu'au retour à 0°, puis restaure le pivot de base (0.5, 0.9)
    setActiveDragPosition(puppet.id, null);
    releasePuppetGrabHold(puppet.id);
    notifyEntityDragLifecycle(puppet.id, 'end', undefined, true);
    let restoredPivot = false;
    for (let i = 0; i < 120; i++) {
      const res = stepMatterPhysics({
        entities: { [puppet.id]: puppet },
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[puppet.id];
      if (patch) {
        puppet = {
          ...puppet,
          ...(patch.runtimeTilt !== undefined ? { runtimeTilt: patch.runtimeTilt } : {}),
          ...(patch.runtimePivot === null
            ? { runtimePivot: undefined }
            : patch.runtimePivot
            ? { runtimePivot: patch.runtimePivot }
            : {}),
        };
        if (patch.runtimePivot === null) {
          restoredPivot = true;
          break;
        }
      }
    }
    expect(restoredPivot).toBe(true);
    expect(resolveEffectivePivot(puppet, puppet.states[puppet.currentStateId])).toEqual({
      x: 0.5,
      y: 0.9,
    });
    resetMatterPhysicsRuntime();
  });

  it('does not allow Jiggle to overwrite or clear swingAroundGrabPoint runtimePivot during drag', async () => {
    const {
      notifyEntityDragLifecycle,
      releasePuppetGrabHold,
      resetMatterPhysicsRuntime,
      setActiveDragPosition,
      setPuppetGrabPivot,
      stepMatterPhysics,
    } = await import('../utils/matterPhysicsEngine');

    resetMatterPhysicsRuntime();
    let entity = makeEntity({
      id: 'puppet-plus-jiggle',
      position: { x: 220, y: 160 },
      size: { width: 100, height: 140 },
      pivot: { x: 0.5, y: 0.8 },
      behaviors: [
        {
          id: 'beh-puppet',
          type: 'interactive_puppet',
          enabled: true,
          swingMode: 'pendulum',
          swingAroundGrabPoint: true,
          pendulumMaxAngle: 35,
        },
        {
          id: 'beh-jiggle',
          type: 'jiggle',
          enabled: true,
          useCustomPivot: true,
          pivotOverride: { x: 0.5, y: 1.0 },
          stiffness: 180,
          damping: 9,
          inertia: 1.0,
          maxAngle: 35,
          gravityPull: 40,
        },
      ],
    });

    setPuppetGrabPivot(entity.id, { x: 0.1, y: 0.2 }, true);
    notifyEntityDragLifecycle(entity.id, 'start', entity.position);

    for (let i = 1; i <= 10; i++) {
      setActiveDragPosition(entity.id, { x: 220 + i * 15, y: 160 });
      const res = stepMatterPhysics({
        entities: { [entity.id]: entity },
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      const patch = res.updatedTransforms[entity.id];
      if (patch) {
        entity = {
          ...entity,
          ...(patch.runtimeTilt !== undefined ? { runtimeTilt: patch.runtimeTilt } : {}),
          ...(patch.runtimeJiggleAngle !== undefined
            ? { runtimeJiggleAngle: patch.runtimeJiggleAngle }
            : {}),
          ...(patch.runtimePivot === null
            ? { runtimePivot: undefined }
            : patch.runtimePivot
            ? { runtimePivot: patch.runtimePivot }
            : {}),
        };
      }
      // Pendant tout le drag, runtimePivot doit rester exactement au point saisi (0.1, 0.2)
      expect(entity.runtimePivot).toEqual({ x: 0.1, y: 0.2 });
    }

    setActiveDragPosition(entity.id, null);
    releasePuppetGrabHold(entity.id);
    notifyEntityDragLifecycle(entity.id, 'end', undefined, true);
    resetMatterPhysicsRuntime();
  });
});
