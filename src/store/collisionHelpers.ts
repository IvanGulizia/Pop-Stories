import { CollisionSideFilter, Entity, EntityId, EntityType, Position, SelectionMode } from '../types';
import { getEntityWorldColliderBounds, WorldColliderBounds } from '../utils/collider';
import {
  getActivePhysicsCollisionPairs,
  getPhysicsCollisionContact,
  getPhysicsCollisionContactInfo,
} from '../utils/matterPhysicsEngine';

export type ConcreteCollisionSide = 'top' | 'bottom' | 'left' | 'right';

// Helper pour valider si une entité correspond aux critères d'un filtre (Instance, Type ou Tag)
export function matchesEntityFilter(
  entity: Entity,
  mode?: SelectionMode,
  id?: string,
  type?: EntityType,
  tag?: string
): boolean {
  if (!entity) return false;
  if (mode === 'any') return true;
  if (mode === 'instance' && id) {
    return entity.id === id;
  }
  if (mode === 'type' || (!mode && type)) {
    return entity.type === type;
  }
  if (mode === 'tag' || (!mode && tag)) {
    return !!tag && !!entity.tags?.includes(tag.toLowerCase().trim().replace(/^#/, ''));
  }
  // Fallback si pas de mode explicite (compatibilité)
  if (type && entity.type === type) return true;
  if (id && entity.id === id) return true;
  if (id && entity.type === (id as any)) return true;
  return false;
}

/**
 * Calcule le côté de contact sur `referenceBounds` lorsque `referenceBounds` touche `otherBounds`.
 * Ex: si le Joueur (reference) atterrit sur un Goomba (other), retourne `'bottom'` pour le Joueur,
 * et `'top'` pour le Goomba.
 */
export function computeDirectionalCollisionSide(
  referenceBounds: Pick<WorldColliderBounds, 'x' | 'y' | 'width' | 'height' | 'centerX' | 'centerY'>,
  otherBounds: Pick<WorldColliderBounds, 'x' | 'y' | 'width' | 'height' | 'centerX' | 'centerY'>,
  normalFromRefToOther?: { nx: number; ny: number } | null
): ConcreteCollisionSide {
  const dxCenter = otherBounds.centerX - referenceBounds.centerX;
  const dyCenter = otherBounds.centerY - referenceBounds.centerY;

  if (normalFromRefToOther) {
    let { nx, ny } = normalFromRefToOther;
    // Aligner le signe pour qu'il pointe de reference vers other
    if (dxCenter * nx + dyCenter * ny < 0) {
      nx = -nx;
      ny = -ny;
    }
    if (Math.abs(ny) >= Math.abs(nx)) {
      return ny >= 0 ? 'bottom' : 'top';
    }
    return nx >= 0 ? 'right' : 'left';
  }

  const overlapX =
    Math.min(referenceBounds.x + referenceBounds.width, otherBounds.x + otherBounds.width) -
    Math.max(referenceBounds.x, otherBounds.x);
  const overlapY =
    Math.min(referenceBounds.y + referenceBounds.height, otherBounds.y + otherBounds.height) -
    Math.max(referenceBounds.y, otherBounds.y);

  // Si les boîtes se chevauchent (ou se frôlent sur une face) :
  if (overlapX > 0 && overlapY > 0) {
    if (overlapX >= overlapY) {
      return dyCenter >= 0 ? 'bottom' : 'top';
    }
    return dxCenter >= 0 ? 'right' : 'left';
  }

  // Sinon, normaliser par demi-somme des dimensions
  const halfSumW = Math.max(1, (referenceBounds.width + otherBounds.width) / 2);
  const halfSumH = Math.max(1, (referenceBounds.height + otherBounds.height) / 2);
  if (Math.abs(dyCenter) / halfSumH >= Math.abs(dxCenter) / halfSumW) {
    return dyCenter >= 0 ? 'bottom' : 'top';
  }
  return dxCenter >= 0 ? 'right' : 'left';
}

export function matchesCollisionSide(
  side: ConcreteCollisionSide,
  filter?: CollisionSideFilter
): boolean {
  if (!filter || filter === 'any') return true;
  if (filter === 'horizontal') return side === 'left' || side === 'right';
  if (filter === 'vertical') return side === 'top' || side === 'bottom';
  return side === filter;
}

export function checkDirectionalCollisionSide(params: {
  subject: Entity;
  target: Entity;
  sideFilter?: CollisionSideFilter;
  sideTarget?: 'subject' | 'target';
  requireDownward?: boolean;
}): boolean {
  const { subject, target, sideFilter, sideTarget = 'subject', requireDownward } = params;
  const info = getPhysicsCollisionContactInfo(subject.id, target.id);

  if (requireDownward) {
    const vy = info?.vyA ?? 0;
    const bSub = getEntityWorldColliderBounds(subject);
    const bTar = getEntityWorldColliderBounds(target);
    // Exiger soit une vitesse descendante > 5px/s, soit une chute claire au-dessus de la cible
    if (vy < 5 && bSub.centerY >= bTar.centerY) {
      return false;
    }
  }

  if (!sideFilter || sideFilter === 'any') {
    return true;
  }

  const bSub = getEntityWorldColliderBounds(subject);
  const bTar = getEntityWorldColliderBounds(target);

  const refBounds = sideTarget === 'target' ? bTar : bSub;
  const otherBounds = sideTarget === 'target' ? bSub : bTar;
  const normal = info
    ? sideTarget === 'target'
      ? { nx: -info.nx, ny: -info.ny }
      : { nx: info.nx, ny: info.ny }
    : null;

  const side = computeDirectionalCollisionSide(refBounds, otherBounds, normal);
  return matchesCollisionSide(side, sideFilter);
}

export function shouldIgnoreOneWayCollision(params: {
  entityBounds: { x: number; y: number; width: number; height: number };
  platformBounds: { x: number; y: number; width: number; height: number };
  entityVy: number;
  prevEntityBottom?: number;
  wasPassingThrough?: boolean;
}): boolean {
  const { entityBounds, platformBounds, entityVy, prevEntityBottom, wasPassingThrough } = params;
  if (wasPassingThrough) return true;
  // Si l'entité monte vers le haut, traverser librement
  if (entityVy < -12) return true;
  const bottom = prevEntityBottom ?? entityBounds.y + entityBounds.height;
  // Solide uniquement si les pieds étaient au niveau du haut de la plateforme (marge 10px)
  return bottom > platformBounds.y + 10;
}

export function computeBoundaryHitEdges(
  bounds: Pick<WorldColliderBounds, 'x' | 'y' | 'width' | 'height' | 'centerX' | 'centerY'>,
  rect: { x: number; y: number; width: number; height: number },
  edge: 'any' | 'top' | 'bottom' | 'left' | 'right' = 'any',
  tolerance: number = 2
): {
  hitLeft: boolean;
  hitRight: boolean;
  hitTop: boolean;
  hitBottom: boolean;
  hitAny: boolean;
  hitEdge: boolean;
} {
  const minX = rect.x;
  const minY = rect.y;
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;
  const hitLeft = bounds.x <= minX + tolerance;
  const hitRight = bounds.x + bounds.width >= maxX - tolerance;
  const hitTop = bounds.y <= minY + tolerance;
  const hitBottom = bounds.y + bounds.height >= maxY - tolerance;
  const hitAny = hitLeft || hitRight || hitTop || hitBottom;
  let hitEdge = hitAny;
  if (edge === 'left') hitEdge = hitLeft;
  else if (edge === 'right') hitEdge = hitRight;
  else if (edge === 'top') hitEdge = hitTop;
  else if (edge === 'bottom') hitEdge = hitBottom;
  return {
    hitLeft,
    hitRight,
    hitTop,
    hitBottom,
    hitAny,
    hitEdge,
  };
}

// Vérification de la collision avec support précis des Colliders (flipX + scale centrée) et écoute native Matter.js
export function checkCollision(ent1: Entity, ent2: Entity, tolerancePx: number = 3): boolean {
  if (ent1.colliderMode === 'disabled' || ent2.colliderMode === 'disabled') {
    return false;
  }

  // 1. Détection prioritaire directe depuis le moteur physique Matter.js
  const activePairs = getActivePhysicsCollisionPairs();
  if (activePairs.has(`${ent1.id}:::${ent2.id}`) || activePairs.has(`${ent2.id}:::${ent1.id}`)) {
    return true;
  }

  const b1 = getEntityWorldColliderBounds(ent1);
  const b2 = getEntityWorldColliderBounds(ent2);

  // Marge de contact (3px par défaut, ou augmentée par hystérésis lors de la sortie)
  const tol = tolerancePx;

  // Cercle vs Cercle
  if (b1.colliderType === 'circle' && b2.colliderType === 'circle') {
    const dx = b1.centerX - b2.centerX;
    const dy = b1.centerY - b2.centerY;
    const maxR = b1.radius + b2.radius + tol;
    return dx * dx + dy * dy <= maxR * maxR;
  }

  // Cercle vs Boîte / Polygone
  if (b1.colliderType === 'circle' && (b2.colliderType === 'box' || b2.colliderType === 'polygon')) {
    const closestX = Math.max(b2.x, Math.min(b1.centerX, b2.x + b2.width));
    const closestY = Math.max(b2.y, Math.min(b1.centerY, b2.y + b2.height));
    const dx = b1.centerX - closestX;
    const dy = b1.centerY - closestY;
    const maxR = b1.radius + tol;
    return dx * dx + dy * dy <= maxR * maxR;
  }

  if ((b1.colliderType === 'box' || b1.colliderType === 'polygon') && b2.colliderType === 'circle') {
    const closestX = Math.max(b1.x, Math.min(b2.centerX, b1.x + b1.width));
    const closestY = Math.max(b1.y, Math.min(b2.centerY, b1.y + b1.height));
    const dx = b2.centerX - closestX;
    const dy = b2.centerY - closestY;
    const maxR = b2.radius + tol;
    return dx * dx + dy * dy <= maxR * maxR;
  }

  // Boîte AABB vs Boîte AABB avec tolérance
  return (
    b1.x <= b2.x + b2.width + tol &&
    b1.x + b1.width + tol >= b2.x &&
    b1.y <= b2.y + b2.height + tol &&
    b1.y + b1.height + tol >= b2.y
  );
}

// Calcul du point exact de contact entre deux entités (Matter.js prioritaire, sinon analytique)
export function getCollisionContactPoint(ent1: Entity, ent2: Entity): Position {
  const matterPt = getPhysicsCollisionContact(ent1.id, ent2.id) || getPhysicsCollisionContact(ent2.id, ent1.id);
  if (matterPt) return matterPt;

  const b1 = getEntityWorldColliderBounds(ent1);
  const b2 = getEntityWorldColliderBounds(ent2);

  if (b1.colliderType === 'circle' && b2.colliderType === 'circle') {
    const totalR = b1.radius + b2.radius;
    const t = totalR > 0 ? b1.radius / totalR : 0.5;
    return {
      x: Math.round((b1.centerX + (b2.centerX - b1.centerX) * t) * 10) / 10,
      y: Math.round((b1.centerY + (b2.centerY - b1.centerY) * t) * 10) / 10,
    };
  }

  if (b1.colliderType === 'circle' && b2.colliderType !== 'circle') {
    const cx = Math.max(b2.x, Math.min(b1.centerX, b2.x + b2.width));
    const cy = Math.max(b2.y, Math.min(b1.centerY, b2.y + b2.height));
    return { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 };
  }

  if (b1.colliderType !== 'circle' && b2.colliderType === 'circle') {
    const cx = Math.max(b1.x, Math.min(b2.centerX, b1.x + b1.width));
    const cy = Math.max(b1.y, Math.min(b2.centerY, b1.y + b2.height));
    return { x: Math.round(cx * 10) / 10, y: Math.round(cy * 10) / 10 };
  }

  const left = Math.max(b1.x, b2.x);
  const right = Math.min(b1.x + b1.width, b2.x + b2.width);
  const top = Math.max(b1.y, b2.y);
  const bottom = Math.min(b1.y + b1.height, b2.y + b2.height);

  if (right >= left && bottom >= top) {
    return {
      x: Math.round(((left + right) / 2) * 10) / 10,
      y: Math.round(((top + bottom) / 2) * 10) / 10,
    };
  }

  return {
    x: Math.round(((b1.centerX + b2.centerX) / 2) * 10) / 10,
    y: Math.round(((b1.centerY + b2.centerY) / 2) * 10) / 10,
  };
}

export function findTargetEntityOrArchetype(
  state: { entities: Record<EntityId, Entity>; customArchetypes: Record<string, Entity> },
  idOrType: string
): Entity | undefined {
  return (
    state.entities[idOrType] ||
    state.customArchetypes[idOrType] ||
    Object.values(state.entities).find((e) => e.type === idOrType) ||
    Object.values(state.customArchetypes).find((a) => a.id === idOrType || a.type === idOrType)
  );
}
