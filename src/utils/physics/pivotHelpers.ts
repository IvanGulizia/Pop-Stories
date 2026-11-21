import { Entity, EntityPivot, EntityState, Position, Size } from '../../types';

export const DEFAULT_PIVOT: EntityPivot = { x: 0.5, y: 0.5 };

export function sanitizePivot(pivot?: Partial<EntityPivot> | null): EntityPivot {
  const x = typeof pivot?.x === 'number' && Number.isFinite(pivot.x)
    ? pivot.x
    : DEFAULT_PIVOT.x;
  const y = typeof pivot?.y === 'number' && Number.isFinite(pivot.y)
    ? pivot.y
    : DEFAULT_PIVOT.y;
  return { x, y };
}

/**
 * Résout le pivot brut (avant flipX) selon la hiérarchie de priorité :
 * override explicit > runtimePivot > parentOffset.jointChildPivot > state.pivot > entity.pivot > { x: 0.5, y: 0.5 }
 */
export function resolveRawPivot(
  entity: Pick<Entity, 'pivot' | 'runtimePivot' | 'states' | 'currentStateId' | 'parentId' | 'parentOffset'>,
  stateOverride?: EntityState | null,
  explicitOverride?: EntityPivot | null
): EntityPivot {
  if (explicitOverride) return sanitizePivot(explicitOverride);
  if (entity.runtimePivot) return sanitizePivot(entity.runtimePivot);
  const state = stateOverride ?? entity.states?.[entity.currentStateId];
  const effectiveJointChildPivot = state?.parentOffsetOverride?.jointChildPivot ?? entity.parentOffset?.jointChildPivot;
  if (entity.parentId && effectiveJointChildPivot) {
    return sanitizePivot(effectiveJointChildPivot);
  }
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
  entity: Pick<Entity, 'pivot' | 'runtimePivot' | 'states' | 'currentStateId' | 'flipX' | 'parentId' | 'parentOffset'>,
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

/**
 * Convertit un pointeur dans le repère canvas (px) en pivot local normalisé brut (avant flipX)
 * sur l'entité, en compensant exactement la rotation, l'échelle et le flip courants.
 */
export function computeLocalGrabPivotFromClientPoint(params: {
  canvasPoint: Position;
  entityPosition: Position;
  entitySize: Size;
  currentEffPivot: EntityPivot;
  totalRotationDeg: number;
  scaleX?: number;
  scaleY?: number;
  flipX?: boolean;
}): EntityPivot {
  const {
    canvasPoint,
    entityPosition,
    entitySize,
    currentEffPivot,
    totalRotationDeg,
    scaleX = 1,
    scaleY = 1,
    flipX = false,
  } = params;

  const pivotWorld = getPivotWorldPosition(entityPosition, entitySize, currentEffPivot);
  const dx = canvasPoint.x - pivotWorld.x;
  const dy = canvasPoint.y - pivotWorld.y;
  const unrotated = rotateVector(dx, dy, (-totalRotationDeg * Math.PI) / 180);

  const safeW = Math.max(1, entitySize.width) * (Math.abs(scaleX) > 0.05 ? scaleX : 1);
  const safeH = Math.max(1, entitySize.height) * (Math.abs(scaleY) > 0.05 ? scaleY : 1);

  const rawEffX = currentEffPivot.x + unrotated.x / safeW;
  const rawEffY = currentEffPivot.y + unrotated.y / safeH;

  const clampedEffX = Math.max(-0.5, Math.min(1.5, rawEffX));
  const clampedEffY = Math.max(-0.5, Math.min(1.5, rawEffY));

  return {
    x: Math.round((flipX ? 1 - clampedEffX : clampedEffX) * 1000) / 1000,
    y: Math.round(clampedEffY * 1000) / 1000,
  };
}

/**
 * Ajuste la position top-left d'une entité lors d'un changement dynamique de `transformOrigin`
 * (ex: passage au pivot de saisie puis retour au pivot normal) afin d'éviter tout saut visuel
 * lorsque la rotation courante est non nulle.
 */
export function reanchorPositionForPivotChange(params: {
  position: Position;
  size: Size;
  oldEffPivot: EntityPivot;
  newEffPivot: EntityPivot;
  rotationDeg: number;
}): Position {
  const { position, size, oldEffPivot, newEffPivot, rotationDeg } = params;
  if (Math.abs(rotationDeg) < 0.01) {
    return { x: position.x, y: position.y };
  }
  const dxPx = (oldEffPivot.x - newEffPivot.x) * size.width;
  const dyPx = (oldEffPivot.y - newEffPivot.y) * size.height;
  const rotDelta = rotateVector(dxPx, dyPx, (rotationDeg * Math.PI) / 180);
  return {
    x: position.x + (dxPx - rotDelta.x),
    y: position.y + (dyPx - rotDelta.y),
  };
}

