import { Entity, EntityId, EntityPivot, EntityState, EntityType, ParentOffset, Position, SetEntityEnabledScope, SpawnReferenceMode } from '../types';
import {
  getParentAnchorWorldPosition,
  getPivotWorldPosition,
  resolveEffectivePivot,
  rotateVector,
  sanitizePivot,
} from '../utils/physics/pivotHelpers';

/**
 * Résout le ParentOffset effectif d'un enfant en fusionnant sa configuration de base
 * avec une éventuelle surcharge définie sur son état actif (parentOffsetOverride).
 * Ne mute jamais entity.parentOffset.
 */
export function resolveEffectiveParentOffset(
  entity: Pick<Entity, 'parentId' | 'parentOffset' | 'states' | 'currentStateId'>,
  stateOverride?: EntityState | null
): ParentOffset | undefined {
  const st = stateOverride ?? entity.states?.[entity.currentStateId];
  const ov = st?.parentOffsetOverride;
  if (!entity.parentOffset && !ov) return undefined;
  return {
    x: 0,
    y: 0,
    rotationOffset: 0,
    inheritRotation: true,
    inheritFlip: true,
    ...(entity.parentOffset || {}),
    ...(ov || {}),
  };
}

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

/**
 * Résout la liste dédupliquée des IDs d'entités concernés selon la portée hiérarchique :
 * - 'self' : l'entité uniquement
 * - 'with_children' : l'entité + tous ses descendants
 * - 'with_parent' : l'entité + son parent direct (si existant)
 * - 'entire_hierarchy' : toute la famille depuis l'ancêtre racine + tous ses descendants
 */
export function resolveEntityHierarchyScopeIds(
  entities: Record<EntityId, Entity>,
  rootId: EntityId,
  scope: SetEntityEnabledScope = 'self'
): EntityId[] {
  if (!entities[rootId]) return [];
  if (scope === 'self') return [rootId];

  if (scope === 'with_children') {
    const seen = new Set<EntityId>([rootId]);
    const out: EntityId[] = [rootId];
    for (const dId of collectDescendantIds(entities, rootId)) {
      if (!seen.has(dId) && entities[dId]) {
        seen.add(dId);
        out.push(dId);
      }
    }
    return out;
  }

  if (scope === 'with_parent') {
    const out: EntityId[] = [rootId];
    const pId = entities[rootId]?.parentId;
    if (pId && pId !== rootId && entities[pId]) {
      out.push(pId);
    }
    return out;
  }

  // 'entire_hierarchy' : remonter jusqu'au parent racine sans boucle puis collecter toute l'arborescence
  let topId: EntityId = rootId;
  const climbVisited = new Set<EntityId>([rootId]);
  while (entities[topId]?.parentId) {
    const parentId = entities[topId].parentId!;
    if (!entities[parentId] || climbVisited.has(parentId)) break;
    climbVisited.add(parentId);
    topId = parentId;
  }

  const seen = new Set<EntityId>([topId]);
  const out: EntityId[] = [topId];
  for (const dId of collectDescendantIds(entities, topId)) {
    if (!seen.has(dId) && entities[dId]) {
      seen.add(dId);
      out.push(dId);
    }
  }
  return out;
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

  const rawRotDiff = childRotDeg - (inheritRotation ? parentRotDeg : 0);
  const rotOffset = rawRotDiff * (inheritFlip && parent.flipX ? -1 : 1);

  return {
    ...(prevOffset || {}),
    x: Math.round(localX * 10) / 10,
    y: Math.round(localY * 10) / 10,
    rotationOffset: Math.round(rotOffset * 10) / 10,
    inheritRotation,
    inheritFlip,
  };
}

/**
 * Calcule le nouvel offset parent + pivot d'attache enfant à partir d'un point monde P(worldX, worldY)
 * cliqué ou glissé directement sur le canvas, tout en maintenant visuellement l'enfant exactement
 * à sa place (même s'il possède une rotation).
 */
export function computeParentOffsetFromWorldPin(
  child: Entity,
  parent: Entity,
  worldPin: Position,
  prevOffset?: ParentOffset
): {
  parentOffset: ParentOffset;
  childPosition: Position;
} {
  const inheritRotation = prevOffset?.inheritRotation ?? true;
  const inheritFlip = prevOffset?.inheritFlip ?? true;

  // 1. Coordonnées locales sur le parent par rapport au centre du parent
  const parentEffPivot = resolveEffectivePivot(parent);
  const pPivotWorld = getPivotWorldPosition(parent.position, parent.size, parentEffPivot);
  const parentRotDeg = parent.states[parent.currentStateId]?.rotation ?? 0;
  const unrotParent = inheritRotation
    ? rotateVector(worldPin.x - pPivotWorld.x, worldPin.y - pPivotWorld.y, (-parentRotDeg * Math.PI) / 180)
    : { x: worldPin.x - pPivotWorld.x, y: worldPin.y - pPivotWorld.y };

  let localParentX = unrotParent.x - (0.5 - parentEffPivot.x) * parent.size.width;
  const localParentY = unrotParent.y - (0.5 - parentEffPivot.y) * parent.size.height;
  if (inheritFlip && parent.flipX) {
    localParentX = -localParentX;
  }

  // 2. Coordonnées locales normalisées du pivot d'attache sur l'enfant (en préservant son visuel actuel)
  const childState = child.states[child.currentStateId];
  const childRotDeg = childState?.rotation ?? 0;
  const oldEffPivot = resolveEffectivePivot(child, childState);
  const oldPivotWorld = getPivotWorldPosition(child.position, child.size, oldEffPivot);
  const unrotChildFromOldPivot = rotateVector(
    worldPin.x - oldPivotWorld.x,
    worldPin.y - oldPivotWorld.y,
    (-childRotDeg * Math.PI) / 180
  );
  const localChildX = oldEffPivot.x * child.size.width + unrotChildFromOldPivot.x;
  const localChildY = oldEffPivot.y * child.size.height + unrotChildFromOldPivot.y;

  const safeW = Math.max(1, child.size.width);
  const safeH = Math.max(1, child.size.height);
  const effPivotX = Math.round((localChildX / safeW) * 1000) / 1000;
  const effPivotY = Math.round((localChildY / safeH) * 1000) / 1000;

  const nextFlipX = inheritFlip ? Boolean(parent.flipX) : Boolean(child.flipX);
  const rawPivot: EntityPivot = sanitizePivot({
    x: nextFlipX ? Math.round((1 - effPivotX) * 1000) / 1000 : effPivotX,
    y: effPivotY,
  });
  const clampedEffPivot: EntityPivot = {
    x: nextFlipX ? 1 - rawPivot.x : rawPivot.x,
    y: rawPivot.y,
  };

  // 3. Position top-left garantissant que la silhouette de l'enfant reste immobile autour de worldPin
  const nextChildPosition: Position = {
    x: Math.round((worldPin.x - clampedEffPivot.x * child.size.width) * 10) / 10,
    y: Math.round((worldPin.y - clampedEffPivot.y * child.size.height) * 10) / 10,
  };

  const rawRotDiff = childRotDeg - (inheritRotation ? parentRotDeg : 0);
  const rotOffset = rawRotDiff * (inheritFlip && parent.flipX ? -1 : 1);

  return {
    parentOffset: {
      ...(prevOffset || {}),
      x: Math.round(localParentX * 10) / 10,
      y: Math.round(localParentY * 10) / 10,
      rotationOffset: Math.round(rotOffset * 10) / 10,
      inheritRotation,
      inheritFlip,
      jointChildPivot: rawPivot,
    },
    childPosition: nextChildPosition,
  };
}

/**
 * Retourne la position monde exacte du point d'attache d'un enfant sur son parent.
 */
export function getChildAttachmentPinWorld(child: Entity, parent: Entity): Position {
  const offset = resolveEffectiveParentOffset(child) || { x: 0, y: 0 };
  const pState = parent.states[parent.currentStateId];
  const parentEffPivot = resolveEffectivePivot(parent, pState);
  const parentRotDeg = pState?.rotation ?? 0;
  return getParentAnchorWorldPosition({
    parentPosition: parent.position,
    parentSize: parent.size,
    parentPivot: parentEffPivot,
    parentRotDeg,
    parentFlipX: Boolean(parent.flipX),
    offsetX: offset.x || 0,
    offsetY: offset.y || 0,
    inheritRotation: offset.inheritRotation !== false,
    inheritFlip: offset.inheritFlip !== false,
  });
}

export function computeChildWorldFromParent(
  child: Entity,
  parent: Entity
): { position: Position; rotation: number; flipX: boolean } {
  const offset = resolveEffectiveParentOffset(child) || {
    x: 0,
    y: 0,
    rotationOffset: 0,
    inheritRotation: true,
    inheritFlip: true,
  };
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
  const rotOffset = (offset.rotationOffset || 0) * (inheritFlip && parent.flipX ? -1 : 1);

  return {
    position: {
      x: Math.round((anchorWorld.x - childEffPivot.x * child.size.width) * 10) / 10,
      y: Math.round((anchorWorld.y - childEffPivot.y * child.size.height) * 10) / 10,
    },
    rotation: inheritRotation ? parentRotDeg + rotOffset : (child.states[child.currentStateId]?.rotation ?? 0),
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
  lastSpawnedEntityId?: EntityId | null,
  includeDisabled: boolean = false
): Entity | undefined {
  const isAllowed = (e?: Entity): e is Entity => Boolean(e && (includeDisabled || !e.disabled));
  if (mode === 'subject') {
    const resolved = subject ? liveEntities[subject.id] || subject : undefined;
    return isAllowed(resolved) ? resolved : undefined;
  }
  if (mode === 'target') {
    const resolved = target ? liveEntities[target.id] || target : undefined;
    return isAllowed(resolved) ? resolved : undefined;
  }
  if (mode === 'last_spawned') {
    const resolved = lastSpawnedEntityId ? liveEntities[lastSpawnedEntityId] : undefined;
    return isAllowed(resolved) ? resolved : undefined;
  }
  if ((mode === 'entity' || mode === 'instance') && entityId) {
    const resolved = liveEntities[entityId];
    return isAllowed(resolved) ? resolved : undefined;
  }
  if (mode === 'type' && entityType) {
    return Object.values(liveEntities).find((e) => e.type === entityType && isAllowed(e));
  }
  if (mode === 'tag' && tag) {
    const cleanTag = tag.toLowerCase().trim().replace(/^#/, '');
    if (cleanTag) {
      return Object.values(liveEntities).find((e) => e.tags?.includes(cleanTag) && isAllowed(e));
    }
  }
  return undefined;
}
