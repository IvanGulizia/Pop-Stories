import { Entity, LookAtBehaviorConfig, Position } from '../../types';

const defaultLookAtFlipStates = new Map<string, boolean>();

/**
 * Calcule la différence angulaire la plus courte en radians dans [-PI, +PI],
 * sans bogue de modulo négatif ni saut autour de ±180°.
 */
export function shortestAngleDiffRad(fromRad: number, toRad: number): number {
  const twoPi = Math.PI * 2;
  return ((((toRad - fromRad) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
}

export function resolveTargetWorldPoint(
  selfId: string,
  selfX: number,
  selfY: number,
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag',
  targetEntityId: string | undefined,
  targetEntityType: string | undefined,
  targetTag: string | undefined,
  entities: Record<string, Entity>,
  mousePos?: { x: number; y: number } | null,
  colliderOffsets?: Map<string, { relCenterX: number; relCenterY: number }>
): Position | null {
  if (targetType === 'mouse') {
    return mousePos ? { x: mousePos.x, y: mousePos.y } : null;
  }
  if (targetType === 'entity' && targetEntityId) {
    const targetEntity = entities[targetEntityId];
    if (!targetEntity) return null;
    const tOffset = colliderOffsets?.get(targetEntity.id) || {
      relCenterX: targetEntity.size.width / 2,
      relCenterY: targetEntity.size.height / 2,
    };
    return {
      x: targetEntity.position.x + tOffset.relCenterX,
      y: targetEntity.position.y + tOffset.relCenterY,
    };
  }
  if (targetType === 'nearest_type' || targetType === 'nearest_tag') {
    const cleanTag = targetTag ? targetTag.toLowerCase().trim().replace(/^#/, '') : '';
    let nearest: Entity | undefined;
    let minDistSq = Infinity;
    for (const candidate of Object.values(entities)) {
      if (candidate.id === selfId) continue;
      if (targetType === 'nearest_type') {
        if (!targetEntityType || candidate.type !== targetEntityType) continue;
      } else {
        if (
          !cleanTag ||
          !(candidate.tags || []).some((t) => t.toLowerCase().trim().replace(/^#/, '') === cleanTag)
        ) {
          continue;
        }
      }
      const cOffset = colliderOffsets?.get(candidate.id) || {
        relCenterX: candidate.size.width / 2,
        relCenterY: candidate.size.height / 2,
      };
      const cx = candidate.position.x + cOffset.relCenterX;
      const cy = candidate.position.y + cOffset.relCenterY;
      const distSq = (cx - selfX) ** 2 + (cy - selfY) ** 2;
      if (distSq < minDistSq) {
        minDistSq = distSq;
        nearest = candidate;
      }
    }
    if (!nearest) return null;
    const nOffset = colliderOffsets?.get(nearest.id) || {
      relCenterX: nearest.size.width / 2,
      relCenterY: nearest.size.height / 2,
    };
    return {
      x: nearest.position.x + nOffset.relCenterX,
      y: nearest.position.y + nOffset.relCenterY,
    };
  }
  return null;
}

export function computeLookAtRotationAndFlip(params: {
  entityId: string;
  originX: number;
  originY: number;
  targetPt: Position;
  lookAt: LookAtBehaviorConfig;
  currentAngleDeg: number;
  baseRestRotDeg: number;
  currentFlipX: boolean;
  dt: number;
  flipStates?: Map<string, boolean>;
}): {
  nextAngleRad: number;
  nextRotDeg: number;
  nextFlipX: boolean;
  flipUpdated: boolean;
} {
  const {
    entityId,
    originX,
    originY,
    targetPt,
    lookAt,
    currentAngleDeg,
    baseRestRotDeg,
    currentFlipX,
    dt,
    flipStates = defaultLookAtFlipStates,
  } = params;

  const dx = targetPt.x - originX;
  const dy = targetPt.y - originY;
  const useFlipX = lookAt.flipMode === 'flipX';
  const baseLeft = lookAt.facingDirection === 'left';
  let nextFlipX = currentFlipX;
  let targetAngleRad: number;

  if (useFlipX) {
    const dz = Math.max(0, lookAt.flipDeadzone ?? 12);
    let lookingLeft = flipStates.get(entityId) ?? (baseLeft ? !currentFlipX : currentFlipX);
    if (dx < -dz) {
      lookingLeft = true;
    } else if (dx > dz) {
      lookingLeft = false;
    }
    flipStates.set(entityId, lookingLeft);

    nextFlipX = baseLeft ? !lookingLeft : lookingLeft;
    const rawAngle = lookingLeft ? Math.atan2(-dy, -dx) : Math.atan2(dy, dx);
    const sideOffsetRad = (nextFlipX ? -1 : 1) * (((lookAt.rotationOffset || 0) * Math.PI) / 180);
    targetAngleRad = rawAngle + sideOffsetRad;

    if (lookAt.maxAngle && lookAt.maxAngle > 0 && lookAt.maxAngle < 180) {
      const maxRad = (lookAt.maxAngle * Math.PI) / 180;
      const restAngleRad = (baseRestRotDeg * Math.PI) / 180 + sideOffsetRad;
      const diffFromRest = shortestAngleDiffRad(restAngleRad, targetAngleRad);
      targetAngleRad = restAngleRad + Math.max(-maxRad, Math.min(maxRad, diffFromRest));
    }
  } else {
    const offsetRad = ((lookAt.rotationOffset || 0) * Math.PI) / 180;
    const facingOffset = baseLeft ? Math.PI : 0;
    const restAngleRad = (baseRestRotDeg * Math.PI) / 180 + offsetRad;
    targetAngleRad = Math.atan2(dy, dx) + facingOffset + offsetRad;

    if (lookAt.maxAngle && lookAt.maxAngle > 0 && lookAt.maxAngle < 180) {
      const maxRad = (lookAt.maxAngle * Math.PI) / 180;
      const diffFromRest = shortestAngleDiffRad(restAngleRad, targetAngleRad);
      targetAngleRad = restAngleRad + Math.max(-maxRad, Math.min(maxRad, diffFromRest));
    }
  }

  const currentAngleRad = (currentAngleDeg * Math.PI) / 180;
  const diff = shortestAngleDiffRad(currentAngleRad, targetAngleRad);
  const smoothSpeed = lookAt.smoothSpeed ?? 0;
  let nextAngleRad = targetAngleRad;
  if (smoothSpeed > 0) {
    const maxStep = ((smoothSpeed * Math.PI) / 180) * dt;
    nextAngleRad =
      Math.abs(diff) <= maxStep ? targetAngleRad : currentAngleRad + Math.sign(diff) * maxStep;
  }

  const nextRotDeg = Math.round(((nextAngleRad * 180) / Math.PI) * 10) / 10;
  return {
    nextAngleRad,
    nextRotDeg,
    nextFlipX,
    flipUpdated: useFlipX,
  };
}
