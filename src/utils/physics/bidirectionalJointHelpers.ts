import Matter from 'matter-js';
import { Entity, ParentOffset, SnapBehaviorConfig } from '../../types';
import { getEntityWorldColliderBounds } from '../collider';
import { rotateVector } from './pivotHelpers';
import { SnapRuntimeEntry } from './snapSolver';
import { clampJointBodyAngle, stepJointAngularForces } from './jointAngularSolver';

const { Body } = Matter;

export function makeBidirectionalPairKey(idA: string, idB: string): string {
  return idA < idB ? `${idA}:::${idB}` : `${idB}:::${idA}`;
}

export function parseBidirectionalPairKey(key: string): [string, string] | null {
  const idx = key.indexOf(':::');
  if (idx <= 0) return null;
  const a = key.slice(0, idx);
  const b = key.slice(idx + 3);
  return a && b ? [a, b] : null;
}

/**
 * Computes negative Matter.js collisionFilter.group IDs so linked `bidirectional_joint`
 * pairs, their hierarchies, and any post-unsnap overlapping grace pairs never collide
 * with one another while still colliding normally with the rest of the world.
 */
export function computeBidirectionalCollisionGroups(params: {
  entities: Record<string, Entity>;
  snapRuntimeStates: Map<string, SnapRuntimeEntry>;
  unsnapGracePairs: Set<string>;
  getSnapConfig: (entity: Entity) => SnapBehaviorConfig | undefined;
}): Map<string, number> {
  const { entities, snapRuntimeStates, unsnapGracePairs, getSnapConfig } = params;
  const parent = new Map<string, string>();
  const degree = new Map<string, number>();

  const find = (id: string): string => {
    let cur = id;
    if (!parent.has(cur)) parent.set(cur, cur);
    while (parent.get(cur) !== cur) {
      cur = parent.get(cur)!;
    }
    let walk = id;
    while (walk !== cur) {
      const nxt = parent.get(walk)!;
      parent.set(walk, cur);
      walk = nxt;
    }
    return cur;
  };

  const union = (a: string, b: string) => {
    if (!a || !b || a === b) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) {
      parent.set(rb, ra);
    }
    degree.set(a, (degree.get(a) || 0) + 1);
    degree.set(b, (degree.get(b) || 0) + 1);
  };

  // 1. Existing parent-child links (so hierarchies and bidirectional joints compose cleanly)
  for (const ent of Object.values(entities)) {
    if (ent.disabled) continue;
    if (ent.parentId && entities[ent.parentId] && !entities[ent.parentId].disabled) {
      union(ent.id, ent.parentId);
    }
  }

  // 2. Active bidirectional_joint Snap links (when ignoreTargetCollision !== false)
  for (const ent of Object.values(entities)) {
    if (ent.disabled) continue;
    const rt = snapRuntimeStates.get(ent.id);
    if (!rt?.isSnapped || rt.attachBehavior !== 'bidirectional_joint' || !rt.snappedTargetId) {
      continue;
    }
    const target = entities[rt.snappedTargetId];
    if (!target || target.disabled) continue;
    const cfg = getSnapConfig(ent);
    if (cfg && cfg.ignoreTargetCollision === false) continue;
    union(ent.id, target.id);
  }

  // 3. Post-unsnap overlap grace pairs (keep collision disabled until colliders separate)
  for (const key of unsnapGracePairs) {
    const parsed = parseBidirectionalPairKey(key);
    if (!parsed) continue;
    const [a, b] = parsed;
    if (entities[a] && entities[b]) {
      union(a, b);
    }
  }

  const rootToGroup = new Map<string, number>();
  const result = new Map<string, number>();
  let nextIdx = 0;

  for (const id of Object.keys(entities)) {
    if ((degree.get(id) || 0) === 0) continue;
    const root = find(id);
    let grp = rootToGroup.get(root);
    if (grp === undefined) {
      grp = -100000 - nextIdx;
      nextIdx += 1;
      rootToGroup.set(root, grp);
    }
    result.set(id, grp);
  }

  return result;
}

/**
 * Checks whether two entities' world colliders currently overlap (plus a small safety margin).
 */
export function checkWorldColliderBoundsOverlap(
  entA: Entity,
  entB: Entity,
  marginPx: number = 4
): boolean {
  const stA = entA.states?.[entA.currentStateId];
  const stB = entB.states?.[entB.currentStateId];
  const a = getEntityWorldColliderBounds(entA, stA);
  const b = getEntityWorldColliderBounds(entB, stB);

  if (a.colliderType === 'circle' && b.colliderType === 'circle') {
    const dist = Math.hypot(b.centerX - a.centerX, b.centerY - a.centerY);
    return dist <= a.radius + b.radius + marginPx;
  }

  if (a.colliderType === 'circle' || b.colliderType === 'circle') {
    const circle = a.colliderType === 'circle' ? a : b;
    const box = a.colliderType === 'circle' ? b : a;
    const clampedX = Math.max(box.x, Math.min(circle.centerX, box.x + box.width));
    const clampedY = Math.max(box.y, Math.min(circle.centerY, box.y + box.height));
    const dist = Math.hypot(circle.centerX - clampedX, circle.centerY - clampedY);
    return dist <= circle.radius + marginPx;
  }

  return (
    a.x <= b.x + b.width + marginPx &&
    a.x + a.width + marginPx >= b.x &&
    a.y <= b.y + b.height + marginPx &&
    a.y + a.height + marginPx >= b.y
  );
}

export interface BidirectionalJointRuntimeEntry {
  entity: Entity;
  targetEnt: Entity;
  bodyA: Matter.Body; // targetEnt
  bodyB: Matter.Body; // entity
  localPointA: { x: number; y: number };
  localPointB: { x: number; y: number };
  constraint: Matter.Constraint;
  snapCfg: SnapBehaviorConfig;
  entityFreezeRot: boolean;
  targetFreezeRot: boolean;
}

function buildAngularOffsetCfg(params: {
  stiffness: number;
  damping: number;
  maxAngle: number;
}): ParentOffset {
  const { stiffness, damping, maxAngle } = params;
  const hasLimit = maxAngle > 0.5;
  const brakeAngle = hasLimit ? Math.min(18, maxAngle * 0.35) : 0;
  return {
    x: 0,
    y: 0,
    jointEnableAngleLimits: hasLimit,
    jointMinAngle: hasLimit ? -maxAngle : -179,
    jointMaxAngle: hasLimit ? maxAngle : 179,
    jointBrakeAngle: brakeAngle,
    jointBrakeStrength: hasLimit ? 75 : 0,
    jointAngularStiffness: stiffness,
    jointAngularDamping: damping,
  };
}

/**
 * Refreshes anchor local offsets on the Matter.Constraint and applies angular spring/damping
 * so puppet swing propagates between linked bodies cleanly.
 */
export function stepBidirectionalPreSubStep(params: {
  entry: BidirectionalJointRuntimeEntry;
  entityDragged: boolean;
  targetDragged: boolean;
  subDt: number;
}): void {
  const { entry, entityDragged, targetDragged, subDt } = params;
  const { bodyA, bodyB, localPointA, localPointB, constraint, snapCfg, entityFreezeRot, targetFreezeRot } =
    entry;

  const rotA = rotateVector(localPointA.x, localPointA.y, bodyA.angle);
  const rotB = rotateVector(localPointB.x, localPointB.y, bodyB.angle);
  constraint.pointA.x = rotA.x;
  constraint.pointA.y = rotA.y;
  constraint.pointB.x = rotB.x;
  constraint.pointB.y = rotB.y;
  (constraint as unknown as { angleA: number; angleB: number }).angleA = bodyA.angle;
  (constraint as unknown as { angleA: number; angleB: number }).angleB = bodyB.angle;

  if (snapCfg.bidirectionalFollowSwing === false) {
    return;
  }

  const stiffness = Math.max(0, snapCfg.bidirectionalAngularStiffness ?? 45);
  const damping = Math.max(0, snapCfg.bidirectionalAngularDamping ?? 8);
  const maxAngle = Math.max(0, snapCfg.bidirectionalMaxAngle ?? 55);
  const restOffsetDeg = snapCfg.matchTargetRotation ? snapCfg.rotationOffset ?? 0 : 0;

  const degA = (bodyA.angle * 180) / Math.PI;
  const degB = (bodyB.angle * 180) / Math.PI;
  const angVelA = (Body.getAngularVelocity(bodyA) * 60 * 180) / Math.PI;
  const angVelB = (Body.getAngularVelocity(bodyB) * 60 * 180) / Math.PI;

  const driveBody = (
    follower: Matter.Body,
    currentDeg: number,
    currentVelDeg: number,
    restWorldDeg: number,
    k: number,
    c: number
  ) => {
    const angStep = stepJointAngularForces({
      currentAngleDeg: currentDeg,
      angularVelDegPerSec: currentVelDeg,
      restWorldDeg,
      offset: buildAngularOffsetCfg({ stiffness: k, damping: c, maxAngle }),
      dt: subDt,
    });
    Body.setAngularVelocity(follower, ((angStep.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
  };

  if (entityDragged && !targetDragged) {
    if (!bodyA.isStatic && !targetFreezeRot) {
      driveBody(bodyA, degA, angVelA, degB - restOffsetDeg, stiffness, damping);
    }
  } else if (targetDragged && !entityDragged) {
    if (!bodyB.isStatic && !entityFreezeRot) {
      driveBody(bodyB, degB, angVelB, degA + restOffsetDeg, stiffness, damping);
    }
  } else if (!entityDragged && !targetDragged) {
    // Free-settling or resting: align symmetrically (or dynamic toward static)
    const canMoveA = !bodyA.isStatic && !targetFreezeRot;
    const canMoveB = !bodyB.isStatic && !entityFreezeRot;
    if (canMoveA && !canMoveB) {
      driveBody(bodyA, degA, angVelA, degB - restOffsetDeg, stiffness * 0.7, damping);
    } else if (canMoveB && !canMoveA) {
      driveBody(bodyB, degB, angVelB, degA + restOffsetDeg, stiffness * 0.7, damping);
    } else if (canMoveA && canMoveB) {
      driveBody(bodyA, degA, angVelA, degB - restOffsetDeg, stiffness * 0.35, damping);
      driveBody(bodyB, degB, angVelB, degA + restOffsetDeg, stiffness * 0.35, damping);
    }
  }
}

/**
 * Enforces hard relative angle limits after Engine.update when `bidirectionalMaxAngle > 0`
 * while keeping the joint anchor pinned cleanly without positional drift.
 */
export function stepBidirectionalPostSubStep(params: {
  entry: BidirectionalJointRuntimeEntry;
  entityDragged: boolean;
  targetDragged: boolean;
}): void {
  const { entry, entityDragged, targetDragged } = params;
  const { bodyA, bodyB, localPointA, localPointB, constraint, snapCfg, entityFreezeRot, targetFreezeRot } =
    entry;

  if (snapCfg.bidirectionalFollowSwing === false) return;
  const maxAngle = Math.max(0, snapCfg.bidirectionalMaxAngle ?? 55);
  if (maxAngle <= 0.5) return;

  const restOffsetDeg = snapCfg.matchTargetRotation ? snapCfg.rotationOffset ?? 0 : 0;
  const degA = (bodyA.angle * 180) / Math.PI;
  const degB = (bodyB.angle * 180) / Math.PI;

  const limitCfg = buildAngularOffsetCfg({ stiffness: 0, damping: 0, maxAngle });

  if ((entityDragged && !targetDragged) || (!targetDragged && bodyB.isStatic)) {
    if (bodyA.isStatic || targetFreezeRot) return;
    const angVelA = (Body.getAngularVelocity(bodyA) * 60 * 180) / Math.PI;
    const clampRes = clampJointBodyAngle({
      currentAngleDeg: degA,
      angularVelDegPerSec: angVelA,
      restWorldDeg: degB - restOffsetDeg,
      offset: limitCfg,
    });
    if (clampRes.clamped) {
      const rotB = rotateVector(localPointB.x, localPointB.y, bodyB.angle);
      const pinWorld = { x: bodyB.position.x + rotB.x, y: bodyB.position.y + rotB.y };
      const nextRad = (clampRes.nextAngleDeg * Math.PI) / 180;
      const nextRotA = rotateVector(localPointA.x, localPointA.y, nextRad);
      Body.setPosition(bodyA, { x: pinWorld.x - nextRotA.x, y: pinWorld.y - nextRotA.y });
      Body.setAngle(bodyA, nextRad);
      Body.setAngularVelocity(bodyA, ((clampRes.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
      constraint.pointA.x = nextRotA.x;
      constraint.pointA.y = nextRotA.y;
      (constraint as unknown as { angleA: number }).angleA = nextRad;
    }
  } else if ((targetDragged && !entityDragged) || (!entityDragged && bodyA.isStatic)) {
    if (bodyB.isStatic || entityFreezeRot) return;
    const angVelB = (Body.getAngularVelocity(bodyB) * 60 * 180) / Math.PI;
    const clampRes = clampJointBodyAngle({
      currentAngleDeg: degB,
      angularVelDegPerSec: angVelB,
      restWorldDeg: degA + restOffsetDeg,
      offset: limitCfg,
    });
    if (clampRes.clamped) {
      const rotA = rotateVector(localPointA.x, localPointA.y, bodyA.angle);
      const pinWorld = { x: bodyA.position.x + rotA.x, y: bodyA.position.y + rotA.y };
      const nextRad = (clampRes.nextAngleDeg * Math.PI) / 180;
      const nextRotB = rotateVector(localPointB.x, localPointB.y, nextRad);
      Body.setPosition(bodyB, { x: pinWorld.x - nextRotB.x, y: pinWorld.y - nextRotB.y });
      Body.setAngle(bodyB, nextRad);
      Body.setAngularVelocity(bodyB, ((clampRes.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
      constraint.pointB.x = nextRotB.x;
      constraint.pointB.y = nextRotB.y;
      (constraint as unknown as { angleB: number }).angleB = nextRad;
    }
  }
}
