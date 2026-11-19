import { describe, it, expect } from 'vitest';
import { Entity, LookAtBehaviorConfig, SceneLayer } from '../types';
import { getEffectiveBehaviors, isEntityDraggable } from '../utils/physics/behaviorResolution';
import { shortestAngleDiffRad, computeLookAtRotationAndFlip, resolveTargetWorldPoint } from '../utils/physics/lookAtSolver';
import { getRootAncestorId, sortEntitiesTopologically } from '../utils/physics/hierarchyPhysicsSync';
import {
  closestPointOnSegment,
  decimatePolyline,
  checkEntityAgainstColliderLayerGeometry,
} from '../utils/physics/colliderLayerPhysics';

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

describe('behaviorResolution', () => {
  it('merges state behaviorOverrides and filters out disabled behaviors', () => {
    const ent = makeEntity({
      id: 'hero',
      behaviors: [
        { id: 'b-drag', type: 'draggable', enabled: true, throwable: true, maxThrowSpeed: 1200 },
        { id: 'b-phys', type: 'physics', enabled: true, gravity: 400, isStatic: false, bounce: 0.2, friction: 0.5, mass: 1 },
        { id: 'b-off', type: 'patrol', enabled: false, axis: 'horizontal', speed: 80, range: 100, pauseDuration: 0 },
      ],
      states: {
        default: {
          id: 'default',
          name: 'Idle',
          color: '#000',
          scale: 1,
          rotation: 0,
          behaviorOverrides: {
            'b-drag': { maxThrowSpeed: 600 },
            'b-phys': { enabled: false },
          },
        },
      },
    });

    const effective = getEffectiveBehaviors(ent, ent.states.default);
    expect(effective).toHaveLength(1);
    expect(effective[0].id).toBe('b-drag');
    expect((effective[0] as any).maxThrowSpeed).toBe(600);
  });

  it('requires dynamic physics for throwable drag and enables drag when interactive_puppet is active', () => {
    const noPhysicsDrag = makeEntity({
      id: 'nophys',
      behaviors: [{ id: 'd1', type: 'draggable', enabled: true, throwable: true, maxThrowSpeed: 1500 }],
    });
    expect(isEntityDraggable(noPhysicsDrag, noPhysicsDrag.states.default)).toEqual({
      canDrag: true,
      throwable: false,
      maxThrowSpeed: 1500,
      hasDynamicPhysics: false,
      precisePhysicsGrab: false,
      swingAroundGrabPoint: false,
      grabRotationMode: 'free',
      grabMaxAngle: 45,
      grabBrakeAngle: 15,
      grabAngularStiffness: 140,
      grabAngularDamping: 8,
    });

    const puppetDynamic = makeEntity({
      id: 'puppet',
      behaviors: [
        { id: 'p1', type: 'interactive_puppet', enabled: true, throwable: true, maxThrowSpeed: 900 },
        { id: 'ph1', type: 'physics', enabled: true, gravity: 400, isStatic: false, bounce: 0.1, friction: 0.5, mass: 1 },
      ],
    });
    expect(isEntityDraggable(puppetDynamic, puppetDynamic.states.default)).toEqual({
      canDrag: true,
      throwable: true,
      maxThrowSpeed: 900,
      hasDynamicPhysics: true,
      precisePhysicsGrab: false,
      swingAroundGrabPoint: false,
      grabRotationMode: 'free',
      grabMaxAngle: 45,
      grabBrakeAngle: 15,
      grabAngularStiffness: 140,
      grabAngularDamping: 8,
    });
  });
});

describe('lookAtSolver', () => {
  it('computes shortest signed angular difference across +-PI wraparound', () => {
    const from = (170 * Math.PI) / 180;
    const to = (-170 * Math.PI) / 180;
    const diffDeg = (shortestAngleDiffRad(from, to) * 180) / Math.PI;
    expect(diffDeg).toBeCloseTo(20, 4);

    const revDeg = (shortestAngleDiffRad(to, from) * 180) / Math.PI;
    expect(revDeg).toBeCloseTo(-20, 4);
  });

  it('flips horizontally with deadzone hysteresis and clamps within maxAngle', () => {
    const flipStates = new Map<string, boolean>();
    const lookAt: LookAtBehaviorConfig = {
      id: 'la1',
      type: 'look_at',
      enabled: true,
      targetType: 'mouse',
      flipMode: 'flipX',
      facingDirection: 'right',
      flipDeadzone: 15,
      rotationOffset: 0,
      maxAngle: 30,
      smoothSpeed: 0,
    };

    // Target to the left -> should flipX = true, rotation clamped within +-30 deg
    const resLeft = computeLookAtRotationAndFlip({
      entityId: 'head',
      originX: 100,
      originY: 100,
      targetPt: { x: 50, y: 10 },
      lookAt,
      currentAngleDeg: 0,
      baseRestRotDeg: 0,
      currentFlipX: false,
      dt: 0.016,
      flipStates,
    });
    expect(resLeft.flipUpdated).toBe(true);
    expect(resLeft.nextFlipX).toBe(true);
    expect(Math.abs(resLeft.nextRotDeg)).toBeLessThanOrEqual(30.1);

    // Target inside deadzone (+5px) -> keeps previous lookingLeft state (true)
    const resDeadzone = computeLookAtRotationAndFlip({
      entityId: 'head',
      originX: 100,
      originY: 100,
      targetPt: { x: 105, y: 100 },
      lookAt,
      currentAngleDeg: resLeft.nextRotDeg,
      baseRestRotDeg: 0,
      currentFlipX: resLeft.nextFlipX,
      dt: 0.016,
      flipStates,
    });
    expect(resDeadzone.nextFlipX).toBe(true);

    // Target clearly to the right (+40px) -> flips back to right (flipX = false)
    const resRight = computeLookAtRotationAndFlip({
      entityId: 'head',
      originX: 100,
      originY: 100,
      targetPt: { x: 140, y: 100 },
      lookAt,
      currentAngleDeg: resDeadzone.nextRotDeg,
      baseRestRotDeg: 0,
      currentFlipX: resDeadzone.nextFlipX,
      dt: 0.016,
      flipStates,
    });
    expect(resRight.nextFlipX).toBe(false);
  });

  it('resolves nearest_tag target excluding self', () => {
    const self = makeEntity({ id: 'self', position: { x: 0, y: 0 }, tags: ['enemy'] });
    const far = makeEntity({ id: 'far', position: { x: 500, y: 0 }, tags: ['enemy'] });
    const near = makeEntity({ id: 'near', position: { x: 100, y: 0 }, tags: ['enemy'] });

    const pt = resolveTargetWorldPoint(
      'self',
      50,
      50,
      'nearest_tag',
      undefined,
      undefined,
      '#Enemy',
      { self, far, near }
    );
    expect(pt).toEqual({ x: 150, y: 50 });
  });
});

describe('hierarchyPhysicsSync', () => {
  it('sorts parents before children and guards against malformed cycles', () => {
    const child = makeEntity({ id: 'child', parentId: 'parent' });
    const grandChild = makeEntity({ id: 'grand', parentId: 'child' });
    const parent = makeEntity({ id: 'parent' });

    const sorted = sortEntitiesTopologically({ grand: grandChild, child, parent });
    expect(sorted.map((e) => e.id)).toEqual(['parent', 'child', 'grand']);
    expect(getRootAncestorId('grand', { grand: grandChild, child, parent })).toBe('parent');

    // Cycle resilience
    const c1 = makeEntity({ id: 'c1', parentId: 'c2' });
    const c2 = makeEntity({ id: 'c2', parentId: 'c1' });
    expect(sortEntitiesTopologically({ c1, c2 })).toHaveLength(2);
    expect(getRootAncestorId('c1', { c1, c2 })).toBeDefined();
  });
});

describe('colliderLayerPhysics', () => {
  it('computes closest point on a segment and decimates dense polylines', () => {
    const hit = closestPointOnSegment(50, 25, 0, 0, 100, 0);
    expect(hit.x).toBe(50);
    expect(hit.y).toBe(0);
    expect(hit.dist).toBe(25);

    const pts = [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 5, y: 0 },
      { x: 20, y: 0 },
      { x: 21, y: 0 },
    ];
    expect(decimatePolyline(pts, 10)).toEqual([
      { x: 0, y: 0 },
      { x: 20, y: 0 },
      { x: 21, y: 0 },
    ]);
  });

  it('detects collisions against rect and polyline collider layers in world space', () => {
    const layer: SceneLayer = {
      id: 'col-1',
      name: 'Ground',
      visible: true,
      opacity: 1,
      parallaxFactor: 0,
      coordinateSpace: 'world',
      role: 'collider',
      vectorPaths: [
        {
          id: 'p-rect',
          d: '',
          stroke: '#000',
          strokeWidth: 4,
          rect: { x: 0, y: 400, width: 800, height: 40 },
        },
      ],
    };

    const touching = checkEntityAgainstColliderLayerGeometry(
      { x: 100, y: 310, width: 80, height: 90, centerX: 140, centerY: 355, radius: 45, colliderType: 'box' },
      'player',
      layer,
      { width: 800, height: 500 },
      3
    );
    expect(touching.colliding).toBe(true);

    const airborne = checkEntityAgainstColliderLayerGeometry(
      { x: 100, y: 100, width: 80, height: 80, centerX: 140, centerY: 140, radius: 40, colliderType: 'box' },
      'player',
      layer,
      { width: 800, height: 500 },
      3
    );
    expect(airborne.colliding).toBe(false);
  });
});
