import { Entity } from '../../types';

export function getRootAncestorId(entityId: string, entities: Record<string, Entity>): string {
  let curr = entities[entityId];
  const visited = new Set<string>();
  while (curr && curr.parentId && entities[curr.parentId] && !visited.has(curr.id)) {
    visited.add(curr.id);
    curr = entities[curr.parentId];
  }
  return curr ? curr.id : entityId;
}

export function getHierarchyCollisionGroup(
  entity: Entity,
  entities: Record<string, Entity>,
  hierarchyGroupIds: Map<string, number>,
  allocateGroupId: () => number
): number {
  const hasChildren = Object.values(entities).some((e) => e.parentId === entity.id);
  const hasParent = !!(entity.parentId && entities[entity.parentId]);
  if (!hasParent && !hasChildren) return 0;

  const rootId = getRootAncestorId(entity.id, entities);
  let group = hierarchyGroupIds.get(rootId);
  if (!group) {
    group = allocateGroupId();
    hierarchyGroupIds.set(rootId, group);
  }
  return group;
}

export function sortEntitiesTopologically(entities: Record<string, Entity>): Entity[] {
  const list = Object.values(entities);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: Entity[] = [];

  const visit = (ent: Entity) => {
    if (visited.has(ent.id)) return;
    if (visiting.has(ent.id)) return; // cycle guard
    visiting.add(ent.id);
    if (ent.parentId && entities[ent.parentId]) {
      visit(entities[ent.parentId]);
    }
    visiting.delete(ent.id);
    visited.add(ent.id);
    result.push(ent);
  };

  for (const ent of list) {
    visit(ent);
  }
  return result;
}
