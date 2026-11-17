import { Entity, EntityId, EntityType, ParentOffset, Position, SpawnReferenceMode } from '../types';
import {
  getParentAnchorWorldPosition,
  getPivotWorldPosition,
  resolveEffectivePivot,
} from '../utils/physics/pivotHelpers';

export function wouldCreateParentCycle(
  entities: Record<EntityId, Entity>,
  childId: EntityId,
  candidateParentId: EntityId
): boolean {
  let cur: EntityId | undefined = candidateParentId;
  const visited = new Set<string>();
  while (cur && !visited.has(cur)) {
    if (cur === childId) return true;
    visited.add(cur);
    cur = entities[cur]?.parentId;
  }
  return false;
}

export function collectDescendantIds(entities: Record<EntityId, Entity>, rootId: EntityId): EntityId[] {
  const result: EntityId[] = [];
  const queue: EntityId[] = [rootId];
  const visited = new Set<EntityId>([rootId]);
  while (queue.length > 0) {
    const cur = queue.shift()!;
    Object.values(entities).forEach((ent) => {
      if (ent.parentId === cur && !visited.has(ent.id)) {
        visited.add(ent.id);
        result.push(ent.id);
        queue.push(ent.id);
      }
    });
  }
  return result;
}

export function computeRelativeParentOffset(
  child: Entity,
  parent: Entity,
  prevOffset?: ParentOffset
): ParentOffset {
  const parentEffPivot = resolveEffectivePivot(parent);
  const pPivotWorld = getPivotWorldPosition(parent.position, parent.size, parentEffPivot);
  const childEffPivot = resolveEffectivePivot(child);
  const cAnchorX = child.position.x + childEffPivot.x * child.size.width;
  const cAnchorY = child.position.y + childEffPivot.y * child.size.height;

  const parentRotDeg = parent.states[parent.currentStateId]?.rotation ?? 0;
  const childRotDeg = child.states[child.currentStateId]?.rotation ?? 0;
  const inheritRotation = prevOffset?.inheritRotation ?? true;
  const inheritFlip = prevOffset?.inheritFlip ?? true;

  const angleRad = inheritRotation ? (-parentRotDeg * Math.PI) / 180 : 0;
  const dx = cAnchorX - pPivotWorld.x;
  const dy = cAnchorY - pPivotWorld.y;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  const unrotFromPivotX = dx * cos - dy * sin;
  const unrotFromPivotY = dx * sin + dy * cos;

  let localX = unrotFromPivotX - (0.5 - parentEffPivot.x) * parent.size.width;
  const localY = unrotFromPivotY - (0.5 - parentEffPivot.y) * parent.size.height;

  if (inheritFlip && parent.flipX) {
    localX = -localX;
  }

  return {
    ...(prevOffset || {}),
    x: Math.round(localX * 10) / 10,
    y: Math.round(localY * 10) / 10,
    rotationOffset: Math.round((childRotDeg - parentRotDeg) * 10) / 10,
    inheritRotation,
    inheritFlip,
  };
}

export function computeChildWorldFromParent(
  child: Entity,
  parent: Entity
): { position: Position; rotation: number; flipX: boolean } {
  const offset = child.parentOffset || { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true };
  const inheritRotation = offset.inheritRotation !== false;
  const inheritFlip = offset.inheritFlip !== false;

  const parentEffPivot = resolveEffectivePivot(parent);
  const parentRotDeg = parent.states[parent.currentStateId]?.rotation ?? 0;
  const anchorWorld = getParentAnchorWorldPosition({
    parentPosition: parent.position,
    parentSize: parent.size,
    parentPivot: parentEffPivot,
    parentRotDeg,
    parentFlipX: Boolean(parent.flipX),
    offsetX: offset.x || 0,
    offsetY: offset.y || 0,
    inheritRotation,
    inheritFlip,
  });

  const nextFlipX = inheritFlip ? Boolean(parent.flipX) : Boolean(child.flipX);
  const childEffPivot = resolveEffectivePivot(child, undefined, undefined, nextFlipX);

  return {
    position: {
      x: Math.round((anchorWorld.x - childEffPivot.x * child.size.width) * 10) / 10,
      y: Math.round((anchorWorld.y - childEffPivot.y * child.size.height) * 10) / 10,
    },
    rotation: inheritRotation ? parentRotDeg + (offset.rotationOffset || 0) : (child.states[child.currentStateId]?.rotation ?? 0),
    flipX: nextFlipX,
  };
}

export function resolveEntityReference(
  mode: SpawnReferenceMode | 'subject' | 'target' | 'entity' | 'instance' | 'type' | 'tag' | 'last_spawned' | undefined,
  entityId: string | undefined,
  entityType: EntityType | undefined,
  tag: string | undefined,
  subject: Entity | undefined,
  target: Entity | undefined,
  liveEntities: Record<EntityId, Entity>,
  lastSpawnedEntityId?: EntityId | null
): Entity | undefined {
  if (mode === 'subject') {
    return subject ? liveEntities[subject.id] || subject : undefined;
  }
  if (mode === 'target') {
    return target ? liveEntities[target.id] || target : undefined;
  }
  if (mode === 'last_spawned') {
    return lastSpawnedEntityId ? liveEntities[lastSpawnedEntityId] : undefined;
  }
  if ((mode === 'entity' || mode === 'instance') && entityId) {
    return liveEntities[entityId];
  }
  if (mode === 'type' && entityType) {
    return Object.values(liveEntities).find((e) => e.type === entityType);
  }
  if (mode === 'tag' && tag) {
    const cleanTag = tag.toLowerCase().trim().replace(/^#/, '');
    if (cleanTag) {
      return Object.values(liveEntities).find((e) => e.tags?.includes(cleanTag));
    }
  }
  return undefined;
}
