import {
  BehaviorOverride,
  BehaviorType,
  Entity,
  EntityBehavior,
  EntityState,
} from '../types';
import { createDefaultBehaviorConfig } from '../components/behaviors/behaviorMetadata';

export interface CopiedBehaviorPayload {
  behavior: EntityBehavior;
  override?: BehaviorOverride;
  sourceEntityId: string;
  sourceEntityName: string;
  sourceStateId?: string;
  sourceStateName?: string;
  sourceStates: Record<string, EntityState>;
}

const TOP_LEVEL_STATE_KEYS = [
  'worldPinPullingStateId',
  'worldPinBrokenStateId',
  'hurtStateId',
  'recoverStateId',
  'deathStateId',
  'approachingStateId',
  'snappedStateId',
  'pullingStateId',
  'unsnappedStateId',
  'triggerStateOnCompleteId',
] as const;

export function remapStateIdForEntity(
  stateId: string | undefined,
  sourceStates: Record<string, EntityState> | undefined,
  targetEntity: Entity
): string | undefined {
  if (!stateId) return undefined;
  if (targetEntity.states && targetEntity.states[stateId]) {
    return stateId;
  }
  const sourceName = sourceStates?.[stateId]?.name?.trim().toLowerCase();
  if (!sourceName) return undefined;
  const targetMatch = Object.values(targetEntity.states || {}).find(
    (st) => st.name.trim().toLowerCase() === sourceName
  );
  return targetMatch?.id;
}

function remapStateReferencesInObject<T extends Record<string, any>>(
  obj: T,
  sourceStates: Record<string, EntityState> | undefined,
  targetEntity: Entity
): T {
  const next: Record<string, any> = JSON.parse(JSON.stringify(obj));

  for (const key of TOP_LEVEL_STATE_KEYS) {
    if (key in next && next[key] !== undefined) {
      const mapped = remapStateIdForEntity(next[key], sourceStates, targetEntity);
      if (mapped !== undefined) {
        next[key] = mapped;
      } else {
        delete next[key];
      }
    }
  }

  if (next.stateBindings && typeof next.stateBindings === 'object') {
    const remappedBindings: Record<string, any> = { ...next.stateBindings };
    for (const [bKey, bVal] of Object.entries(remappedBindings)) {
      if (bKey.endsWith('StateId') && typeof bVal === 'string') {
        const mapped = remapStateIdForEntity(bVal, sourceStates, targetEntity);
        if (mapped !== undefined) {
          remappedBindings[bKey] = mapped;
        } else {
          delete remappedBindings[bKey];
        }
      }
    }
    next.stateBindings = remappedBindings;
  }

  if (Array.isArray(next.dragOverTargets)) {
    next.dragOverTargets = next.dragOverTargets.map((rule: any) => ({
      ...rule,
      stateId: remapStateIdForEntity(rule?.stateId, sourceStates, targetEntity),
    }));
  }

  return next as T;
}

/**
 * Prépare un composant copié pour être collé sur une entité cible :
 * - si targetBehaviorId est fourni, conserve son id (écrasement des valeurs du composant existant)
 * - sinon génère un nouvel id unique
 * - remappe intelligemment toutes les références d'états (ID exact -> nom d'état -> undefined)
 */
export function remapPastedBehaviorForEntity(
  payload: CopiedBehaviorPayload,
  targetEntity: Entity,
  targetBehaviorId?: string
): EntityBehavior {
  const effectiveSource: Record<string, any> = {
    ...JSON.parse(JSON.stringify(payload.behavior)),
    ...(payload.override ? JSON.parse(JSON.stringify(payload.override)) : {}),
  };

  const remapped = remapStateReferencesInObject(
    effectiveSource,
    payload.sourceStates,
    targetEntity
  );

  remapped.id =
    targetBehaviorId ||
    `beh-${remapped.type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

  return remapped as EntityBehavior;
}

/**
 * Prépare un patch d'override pour l'état cible lors d'un collage sur un override actif.
 */
export function remapPastedBehaviorOverrideForEntity(
  payload: CopiedBehaviorPayload,
  targetEntity: Entity,
  targetBehaviorId: string
): BehaviorOverride {
  const remappedFull = remapPastedBehaviorForEntity(payload, targetEntity, targetBehaviorId);
  const { id: _id, ...rest } = remappedFull as any;
  return rest as BehaviorOverride;
}

/**
 * Construit les valeurs par défaut d'un type de composant tout en conservant son id.
 */
export function buildBehaviorResetConfig(
  behavior: EntityBehavior,
  entity: Entity
): EntityBehavior {
  const fresh = createDefaultBehaviorConfig(behavior.type, entity);
  return {
    ...fresh,
    id: behavior.id,
    enabled: behavior.enabled,
  } as EntityBehavior;
}

/**
 * Applique un patch partiel sur un composant sans écraser les propriétés non modifiées,
 * y compris pour les sous-objets structurés (stateBindings, jointConfig).
 */
export function mergeBehaviorPartialPatch<T extends EntityBehavior>(
  current: T,
  partial: Partial<T> & Record<string, any>
): T {
  const next: Record<string, any> = { ...current };
  for (const [key, val] of Object.entries(partial || {})) {
    if (key === 'id' || key === 'type') continue;
    if (
      (key === 'stateBindings' || key === 'jointConfig') &&
      val &&
      typeof val === 'object' &&
      !Array.isArray(val)
    ) {
      next[key] = {
        ...(next[key] && typeof next[key] === 'object' ? next[key] : {}),
        ...val,
      };
    } else {
      next[key] = val;
    }
  }
  return next as T;
}

/**
 * Retourne l'ordre des types de composants présents sur TOUTES les entités sélectionnées.
 */
export function findCommonBehaviorTypes(entities: Entity[]): BehaviorType[] {
  if (entities.length === 0) return [];
  const firstTypes = Array.from(
    new Set((entities[0].behaviors || []).map((b) => b.type))
  );
  return firstTypes.filter((bType) =>
    entities.every((ent) => (ent.behaviors || []).some((b) => b.type === bType))
  );
}

/**
 * Calcule la liste des clés top-level dont les valeurs diffèrent entre les entités sélectionnées.
 */
export function computeMixedBehaviorKeys(
  entities: Entity[],
  behaviorType: BehaviorType
): Set<string> {
  const mixed = new Set<string>();
  if (entities.length <= 1) return mixed;

  const configs = entities
    .map((e) => (e.behaviors || []).find((b) => b.type === behaviorType))
    .filter(Boolean) as Record<string, any>[];

  if (configs.length <= 1) return mixed;

  const allKeys = new Set<string>();
  configs.forEach((cfg) => {
    Object.keys(cfg).forEach((k) => {
      if (k !== 'id' && k !== 'type') allKeys.add(k);
    });
  });

  allKeys.forEach((key) => {
    const firstSerialized = JSON.stringify(configs[0][key] ?? null);
    for (let i = 1; i < configs.length; i++) {
      const currentSerialized = JSON.stringify(configs[i][key] ?? null);
      if (currentSerialized !== firstSerialized) {
        mixed.add(key);
        break;
      }
    }
  });

  return mixed;
}
