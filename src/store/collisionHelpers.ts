import { Entity, EntityId, EntityType, Position, SelectionMode } from '../types';
import { getEntityWorldColliderBounds } from '../utils/collider';
import { getActivePhysicsCollisionPairs, getPhysicsCollisionContact } from '../utils/matterPhysicsEngine';

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
    const cy = Math.max(b1.y, Math.min(b2.centerY, b1.y + b1.height));
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
