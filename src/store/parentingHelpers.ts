import { Entity, EntityId, EntityType, ParentOffset, Position, SpawnReferenceMode } from '../types';

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
  const pCenterX = parent.position.x + parent.size.width / 2;
  const pCenterY = parent.position.y + parent.size.height / 2;
  const cCenterX = child.position.x + child.size.width / 2;
  const cCenterY = child.position.y + child.size.height / 2;

  const parentRotDeg = parent.states[parent.currentStateId]?.rotation ?? 0;
  const childRotDeg = child.states[child.currentStateId]?.rotation ?? 0;
  const inheritRotation = prevOffset?.inheritRotation ?? true;
  const inheritFlip = prevOffset?.inheritFlip ?? true;

  const angleRad = (-parentRotDeg * Math.PI) / 180;
  const dx = cCenterX - pCenterX;
  const dy = cCenterY - pCenterY;
  const cos = Math.cos(angleRad);
  const sin = Math.sin(angleRad);
  let localX = dx * cos - dy * sin;
  const localY = dx * sin + dy * cos;

  if (inheritFlip && parent.flipX) {
    localX = -localX;
  }

  return {
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

  const pCenterX = parent.position.x + parent.size.width / 2;
  const pCenterY = parent.position.y + parent.size.height / 2;
  const parentRotDeg = parent.states[parent.currentStateId]?.rotation ?? 0;
  const parentAngleRad = (parentRotDeg * Math.PI) / 180;

  let lx = offset.x || 0;
  const ly = offset.y || 0;
  if (inheritFlip && parent.flipX) {
    lx = -lx;
  }

  let worldOffsetX = lx;
  let worldOffsetY = ly;
  if (inheritRotation && parentAngleRad !== 0) {
    const cos = Math.cos(parentAngleRad);
    const sin = Math.sin(parentAngleRad);
    worldOffsetX = lx * cos - ly * sin;
    worldOffsetY = lx * sin + ly * cos;
  }

  return {
    position: {
      x: Math.round((pCenterX + worldOffsetX - child.size.width / 2) * 10) / 10,
      y: Math.round((pCenterY + worldOffsetY - child.size.height / 2) * 10) / 10,
    },
    rotation: inheritRotation ? parentRotDeg + (offset.rotationOffset || 0) : (child.states[child.currentStateId]?.rotation ?? 0),
    flipX: inheritFlip ? Boolean(parent.flipX) : Boolean(child.flipX),
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
