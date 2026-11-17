import { Entity, EntityPivot, EntityState, Position, Size } from '../../types';

export const DEFAULT_PIVOT: EntityPivot = { x: 0.5, y: 0.5 };

export function sanitizePivot(pivot?: Partial<EntityPivot> | null): EntityPivot {
  const x = typeof pivot?.x === 'number' && Number.isFinite(pivot.x)
    ? Math.max(-0.5, Math.min(1.5, pivot.x))
    : DEFAULT_PIVOT.x;
  const y = typeof pivot?.y === 'number' && Number.isFinite(pivot.y)
    ? Math.max(-0.5, Math.min(1.5, pivot.y))
    : DEFAULT_PIVOT.y;
  return { x, y };
}

/**
 * Résout le pivot brut (avant flipX) selon la hiérarchie de priorité :
 * override explicit > runtimePivot > state.pivot > entity.pivot > { x: 0.5, y: 0.5 }
 */
export function resolveRawPivot(
  entity: Pick<Entity, 'pivot' | 'runtimePivot' | 'states' | 'currentStateId'>,
  stateOverride?: EntityState | null,
  explicitOverride?: EntityPivot | null
): EntityPivot {
  if (explicitOverride) return sanitizePivot(explicitOverride);
  if (entity.runtimePivot) return sanitizePivot(entity.runtimePivot);
  const state = stateOverride ?? entity.states?.[entity.currentStateId];
  if (state?.pivot) return sanitizePivot(state.pivot);
  if (entity.pivot) return sanitizePivot(entity.pivot);
  return { ...DEFAULT_PIVOT };
}

/**
 * Résout le pivot effectif à l'écran en tenant compte du miroir horizontal (flipX).
 * Puisque flipX retourne le contenu SVG autour du centre local, le pivot CSS/monde
 * côté écran doit être inversé horizontalement : effPivot.x = 1 - raw.x.
 */
export function resolveEffectivePivot(
  entity: Pick<Entity, 'pivot' | 'runtimePivot' | 'states' | 'currentStateId' | 'flipX'>,
  stateOverride?: EntityState | null,
  explicitOverride?: EntityPivot | null,
  flipXOverride?: boolean
): EntityPivot {
  const raw = resolveRawPivot(entity, stateOverride, explicitOverride);
  const isFlipped = flipXOverride !== undefined ? flipXOverride : Boolean(entity.flipX);
  return {
    x: isFlipped ? 1 - raw.x : raw.x,
    y: raw.y,
  };
}

export function getPivotWorldPosition(
  position: Position,
  size: Size,
  effPivot: EntityPivot = DEFAULT_PIVOT
): Position {
  return {
    x: position.x + effPivot.x * size.width,
    y: position.y + effPivot.y * size.height,
  };
}

export function getEntityTopLeftFromPivotWorld(
  pivotWorld: Position,
  size: Size,
  effPivot: EntityPivot = DEFAULT_PIVOT
): Position {
  return {
    x: pivotWorld.x - effPivot.x * size.width,
    y: pivotWorld.y - effPivot.y * size.height,
  };
}

export function rotateVector(dx: number, dy: number, angleRad: number): Position {
  if (angleRad === 0) return { x: dx, y: dy };
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

/**
 * Calcule le centre monde du corps physique (collider) lorsqu'une entité pivote
 * autour d'un pivot potentiellement décentré.
 */
export function getBodyWorldCenterFromPivot(
  position: Position,
  size: Size,
  relCenterX: number,
  relCenterY: number,
  effPivot: EntityPivot,
  rotDeg: number
): Position {
  const pivotWorld = getPivotWorldPosition(position, size, effPivot);
  const dx = relCenterX - effPivot.x * size.width;
  const dy = relCenterY - effPivot.y * size.height;
  if (Math.abs(rotDeg) < 0.0001 || (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001)) {
    return {
      x: pivotWorld.x + dx,
      y: pivotWorld.y + dy,
    };
  }
  const rotated = rotateVector(dx, dy, (rotDeg * Math.PI) / 180);
  return {
    x: pivotWorld.x + rotated.x,
    y: pivotWorld.y + rotated.y,
  };
}

/**
 * Inverse de getBodyWorldCenterFromPivot : retrouve position (top-left) à partir
 * du centre monde du corps physique Matter.js et de sa rotation actuelle.
 */
export function getEntityTopLeftFromBodyWorldCenter(
  bodyWorldCenter: Position,
  size: Size,
  relCenterX: number,
  relCenterY: number,
  effPivot: EntityPivot,
  rotDeg: number
): Position {
  const dx = relCenterX - effPivot.x * size.width;
  const dy = relCenterY - effPivot.y * size.height;
  const rotated =
    Math.abs(rotDeg) < 0.0001 || (Math.abs(dx) < 0.0001 && Math.abs(dy) < 0.0001)
      ? { x: dx, y: dy }
      : rotateVector(dx, dy, (rotDeg * Math.PI) / 180);
  const pivotWorld: Position = {
    x: bodyWorldCenter.x - rotated.x,
    y: bodyWorldCenter.y - rotated.y,
  };
  return getEntityTopLeftFromPivotWorld(pivotWorld, size, effPivot);
}

/**
 * Calcule le point d'ancrage monde d'un enfant attaché à un parent, en tenant compte
 * exactement du pivot de rotation effectif du parent (y compris s'il est décentré,
 * en rotation Jiggle/Pendule ou en FlipX).
 */
export function getParentAnchorWorldPosition(params: {
  parentPosition: Position;
  parentSize: Size;
  parentPivot: EntityPivot;
  parentRotDeg: number;
  parentFlipX: boolean;
  offsetX: number;
  offsetY: number;
  inheritRotation?: boolean;
  inheritFlip?: boolean;
}): Position {
  const {
    parentPosition,
    parentSize,
    parentPivot,
    parentRotDeg,
    parentFlipX,
    offsetX,
    offsetY,
    inheritRotation = true,
    inheritFlip = true,
  } = params;

  const lx = inheritFlip && parentFlipX ? -offsetX : offsetX;
  const ly = offsetY;

  const relFromPivotX = (0.5 - parentPivot.x) * parentSize.width + lx;
  const relFromPivotY = (0.5 - parentPivot.y) * parentSize.height + ly;

  const parentPivotWorld = getPivotWorldPosition(parentPosition, parentSize, parentPivot);
  if (inheritRotation && Math.abs(parentRotDeg) > 0.0001) {
    const rotated = rotateVector(relFromPivotX, relFromPivotY, (parentRotDeg * Math.PI) / 180);
    return {
      x: parentPivotWorld.x + rotated.x,
      y: parentPivotWorld.y + rotated.y,
    };
  }

  return {
    x: parentPivotWorld.x + relFromPivotX,
    y: parentPivotWorld.y + relFromPivotY,
  };
}

