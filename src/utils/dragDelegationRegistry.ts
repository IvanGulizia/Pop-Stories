import type { DragControls } from 'motion/react';
import { Entity, EntityId } from '../types';

const entityDragControlsMap = new Map<EntityId, DragControls>();

export function registerEntityDragControls(entityId: EntityId, controls: DragControls) {
  entityDragControlsMap.set(entityId, controls);
}

export function unregisterEntityDragControls(entityId: EntityId, controls: DragControls) {
  if (entityDragControlsMap.get(entityId) === controls) {
    entityDragControlsMap.delete(entityId);
  }
}

export function getEntityDragControls(entityId: EntityId): DragControls | undefined {
  return entityDragControlsMap.get(entityId);
}

/**
 * Résout l'entité cible effective d'une interaction souris (clic, survol, drag)
 * en suivant la configuration `pointerDelegation` de la carte Hitbox.
 */
export function resolvePointerTargetEntity(
  entity: Entity,
  entities: Record<EntityId, Entity>
): Entity {
  const mode = entity.pointerDelegation || 'self';
  if (mode === 'self' || !entity.parentId) {
    return entity;
  }

  if (mode === 'parent') {
    return entities[entity.parentId] || entity;
  }

  // 'root_parent' : remonter jusqu'au parent final de l'arborescence (garde anti-cycle)
  let current: Entity = entity;
  const visited = new Set<string>([entity.id]);
  while (current.parentId && entities[current.parentId] && !visited.has(current.parentId)) {
    visited.add(current.parentId);
    current = entities[current.parentId];
  }
  return current;
}
