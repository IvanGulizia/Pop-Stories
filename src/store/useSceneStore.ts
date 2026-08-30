import { create } from 'zustand';
import {
  Entity,
  EntityId,
  EntityState,
  Position,
  Size,
  StateId,
  EntityType,
  DynamicRule,
  RuleAction,
  TriggerPhase,
  SelectionMode,
  ActionTargetMode,
  AppMode,
  VectorPath,
  AppSettings,
  ProjectExportData,
} from '../types';
import { soundSynth } from '../utils/sound';

// Nettoyage proactif de tout cache local précédent
if (typeof window !== 'undefined' && window.localStorage) {
  try {
    window.localStorage.removeItem('atelier-vivant-project-v1');
    window.localStorage.removeItem('atelier-vivant-state');
  } catch (_) {}
}

interface SceneState {
  entities: Record<EntityId, Entity>;
  customArchetypes: Record<string, Entity>;
  rules: DynamicRule[];
  activeCollisions: Record<string, boolean>; // Trace l'état de collision pour chaque pair (ruleId_subId_tarId)
  selectedEntityId: EntityId | null;
  appMode: AppMode;
  snapshotEntities: Record<EntityId, Entity> | null;
  settings: AppSettings;

  updateSettings: (partial: Partial<AppSettings>) => void;

  // State actions
  setAppMode: (mode: AppMode) => void;
  resetScene: () => void;
  selectEntity: (id: EntityId | null) => void;
  updateEntityPosition: (id: EntityId, position: Position) => void;
  updateEntitySize: (id: EntityId, size: Size) => void;
  updateEntityState: (id: EntityId, stateId: StateId) => void;
  updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
  addTagToEntity: (id: EntityId, tag: string) => void;
  removeTagFromEntity: (id: EntityId, tag: string) => void;
  updateStateProperties: (entityId: EntityId, stateId: StateId, partial: Partial<EntityState>) => void;
  addStateToEntity: (entityId: EntityId, name?: string) => string;
  removeStateFromEntity: (entityId: EntityId, stateId: StateId) => void;
  addEntity: (type: EntityType) => void;
  addCustomEntity: (customData: {
    name: string;
    type?: string;
    icon?: string;
    drawingDataUrl?: string;
    vectorPaths?: VectorPath[];
    color?: string;
    tags?: string[];
  }) => void;
  deleteCustomArchetype: (type: string) => void;
  spawnEntity: (params: {
    type: EntityType;
    position: Position;
    initialStateId?: StateId;
    size?: Size;
  }) => void;
  deleteEntity: (id: EntityId) => void;
  clearAllEntities: () => void;
  clearProject: () => void;
  restoreDefaultScene: () => void;

  // Project Import / Export
  exportProject: () => ProjectExportData;
  importProject: (data: any) => { success: boolean; message?: string };

  // Rules management
  addRule: (rule: Omit<DynamicRule, 'id'>) => string;
  updateRule: (id: string, partial: Partial<DynamicRule>) => void;
  duplicateRule: (id: string) => string;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  triggerClickEvent: (entityId: EntityId) => void;
  triggerPointerEvent: (entityId: EntityId, phase: TriggerPhase) => void;
  triggerDragRelease: (subjectId: EntityId) => void;
  evaluateRules: () => void;
  evaluateRulesWithTemp: (tempPositions?: Record<EntityId, Position>) => void;
}

// Helper pour valider si une entité correspond aux critères d'un filtre (Instance, Type ou Tag)
export function matchesEntityFilter(
  entity: Entity,
  mode?: SelectionMode,
  id?: string,
  type?: EntityType,
  tag?: string
): boolean {
  if (!entity) return false;
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

// État initial
const initialEntities: Record<EntityId, Entity> = {
  'plant-1': {
    id: 'plant-1',
    name: 'Plante Magique',
    type: 'plant',
    tags: ['plante', 'nature'],
    position: { x: 420, y: 260 },
    size: { width: 120, height: 160 },
    currentStateId: 'pousse',
    isDraggable: false,
    states: {
      'pousse': {
        id: 'pousse',
        name: 'Jeune Pousse',
        color: '#22c55e',
        scale: 0.85,
        rotation: 0,
        stemHeight: 30,
        flowerColor: '#f472b6',
        flowerPetals: 0,
      },
      'fleur': {
        id: 'fleur',
        name: 'Grande Fleur',
        color: '#16a34a',
        scale: 1.15,
        rotation: 0,
        stemHeight: 85,
        flowerColor: '#ec4899',
        flowerPetals: 8,
      },
    },
  },
  'apple-1': {
    id: 'apple-1',
    name: 'Pomme Rouge',
    type: 'apple',
    tags: ['nourriture', 'fruit'],
    position: { x: 140, y: 160 },
    size: { width: 64, height: 64 },
    currentStateId: 'default',
    isDraggable: true,
    states: {
      'default': {
        id: 'default',
        name: 'Normal',
        color: '#ef4444',
        scale: 1.0,
        rotation: 0,
      },
      'croquee': {
        id: 'croquee',
        name: 'Croquée',
        color: '#dc2626',
        scale: 0.85,
        rotation: -12,
      },
    },
  },
};

const defaultCustomArchetypes: Record<string, Entity> = {
  'plant': {
    id: 'plant-archetype',
    name: 'Plante',
    type: 'plant',
    tags: ['plante', 'nature'],
    position: { x: 0, y: 0 },
    size: { width: 120, height: 160 },
    currentStateId: 'pousse',
    isDraggable: false,
    states: {
      'pousse': {
        id: 'pousse',
        name: 'Jeune Pousse',
        color: '#22c55e',
        scale: 0.85,
        rotation: 0,
        stemHeight: 30,
        flowerColor: '#f472b6',
        flowerPetals: 0,
      },
      'fleur': {
        id: 'fleur',
        name: 'Grande Fleur',
        color: '#16a34a',
        scale: 1.15,
        rotation: 0,
        stemHeight: 85,
        flowerColor: '#ec4899',
        flowerPetals: 8,
      },
    },
  },
  'apple': {
    id: 'apple-archetype',
    name: 'Pomme',
    type: 'apple',
    tags: ['nourriture', 'fruit'],
    position: { x: 0, y: 0 },
    size: { width: 64, height: 64 },
    currentStateId: 'default',
    isDraggable: true,
    states: {
      'default': {
        id: 'default',
        name: 'Normal',
        color: '#ef4444',
        scale: 1.0,
        rotation: 0,
      },
      'croquee': {
        id: 'croquee',
        name: 'Croquée',
        color: '#dc2626',
        scale: 0.85,
        rotation: -12,
      },
    },
  },
  'custom': {
    id: 'star-archetype',
    name: 'Étoile',
    type: 'custom',
    tags: ['magique', 'etoile'],
    position: { x: 0, y: 0 },
    size: { width: 70, height: 70 },
    currentStateId: 'default',
    isDraggable: true,
    icon: '⭐',
    states: {
      'default': {
        id: 'default',
        name: 'Calme',
        color: '#eab308',
        scale: 1,
        rotation: 0,
      },
      'brillant': {
        id: 'brillant',
        name: 'Étincelant',
        color: '#facc15',
        scale: 1.3,
        rotation: 45,
      },
    },
  },
};

const initialRules: DynamicRule[] = [
  {
    id: 'rule-plant-bloom',
    name: 'Floraison de toutes les plantes au contact de la nourriture',
    enabled: true,
    trigger: {
      type: 'collision',
      phase: 'enter',
      subjectMode: 'type',
      subjectType: 'apple', // Toutes les pommes
      targetMode: 'type',
      targetType: 'plant', // Toutes les plantes
    },
    actions: [
      {
        id: 'act-1',
        type: 'change_state',
        targetMode: 'target', // Modifie la plante qui touche la pomme
        targetStateId: 'fleur',
      },
    ],
  },
];

// Anti-Infinite Loop & Rapid Bounce Protections
const ruleCooldowns: Record<string, number> = {};
const entityStateTimestamps: Record<string, number> = {};
const preCollisionStates: Record<string, { subjectState?: string; targetState?: string }> = {};
const RULE_COOLDOWN_MS = 350; // Minimum interval between identical rule trigger on same entities
const ENTITY_STATE_COOLDOWN_MS = 250; // Prevents oscillating state ping-pong

// Vérification de la collision avec support des Colliders (Boîte / Cercle / Polygone)
const checkCollision = (ent1: Entity, ent2: Entity) => {
  const currentState1 = ent1.states[ent1.currentStateId];
  const currentState2 = ent2.states[ent2.currentStateId];

  const collider1 = currentState1?.colliderType || ent1.colliderType || (ent1.type === 'apple' ? 'circle' : 'box');
  const collider2 = currentState2?.colliderType || ent2.colliderType || (ent2.type === 'apple' ? 'circle' : 'box');

  const s1 = currentState1?.scale ?? 1;
  const s2 = currentState2?.scale ?? 1;

  const w1 = ent1.size.width * s1;
  const h1 = ent1.size.height * s1;
  const cx1 = ent1.position.x + ent1.size.width / 2;
  const cy1 = ent1.position.y + ent1.size.height / 2;
  const x1 = cx1 - w1 / 2;
  const y1 = cy1 - h1 / 2;

  const w2 = ent2.size.width * s2;
  const h2 = ent2.size.height * s2;
  const cx2 = ent2.position.x + ent2.size.width / 2;
  const cy2 = ent2.position.y + ent2.size.height / 2;
  const x2 = cx2 - w2 / 2;
  const y2 = cy2 - h2 / 2;

  // Cercle vs Cercle
  if (collider1 === 'circle' && collider2 === 'circle') {
    const r1 = Math.min(w1, h1) / 2;
    const r2 = Math.min(w2, h2) / 2;
    const dx = cx1 - cx2;
    const dy = cy1 - cy2;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }

  // Cercle vs Boîte / Polygone
  if (collider1 === 'circle' && (collider2 === 'box' || collider2 === 'polygon')) {
    const r1 = Math.min(w1, h1) / 2;
    const closestX = Math.max(x2, Math.min(cx1, x2 + w2));
    const closestY = Math.max(y2, Math.min(cy1, y2 + h2));
    const dx = cx1 - closestX;
    const dy = cy1 - closestY;
    return dx * dx + dy * dy <= r1 * r1;
  }

  if ((collider1 === 'box' || collider1 === 'polygon') && collider2 === 'circle') {
    const r2 = Math.min(w2, h2) / 2;
    const closestX = Math.max(x1, Math.min(cx2, x1 + w1));
    const closestY = Math.max(y1, Math.min(cy1, y1 + h1));
    const dx = cx2 - closestX;
    const dy = cy2 - closestY;
    return dx * dx + dy * dy <= r2 * r2;
  }

  // Boîte AABB vs Boîte AABB
  return (
    x1 < x2 + w2 &&
    x1 + w1 > x2 &&
    y1 < y2 + h2 &&
    y1 + h1 > y2
  );
};

export const useSceneStore = create<SceneState>()((set, get) => ({
  entities: {},
  customArchetypes: {},
  rules: [],
  activeCollisions: {},
  selectedEntityId: null,
  appMode: 'edit',
  snapshotEntities: null,
  settings: {
    showCanvasLabels: false,
    showGrid: false,
    gridStyle: 'dots',
    showTagsSystem: false,
    showRuleFilters: false,
  },

  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
  },

  setAppMode: (mode) => {
    if (mode === 'play') {
      // Sauvegarder un instantané propre pour le Reset
      const snapshot = JSON.parse(JSON.stringify(get().entities));
      set({ appMode: 'play', snapshotEntities: snapshot });
    } else {
      // Quand on repasse en mode édition, reset automatique de la scène
      get().resetScene();
      set({ appMode: 'edit' });
    }
  },

  resetScene: () => {
    const { snapshotEntities, customArchetypes, entities } = get();
    if (snapshotEntities) {
      const restoredEntities: Record<EntityId, Entity> = {};

      Object.entries(snapshotEntities).forEach(([id, snapEnt]) => {
        const currentEnt = entities[id];
        const currentArch = customArchetypes[snapEnt.type];

        const latestStates = currentEnt?.states || currentArch?.states || snapEnt.states;
        const latestName = currentEnt?.name || currentArch?.name || snapEnt.name;
        const latestTags = currentEnt?.tags || currentArch?.tags || snapEnt.tags;
        const latestVectorPaths = currentEnt?.vectorPaths || currentArch?.vectorPaths || snapEnt.vectorPaths;
        const latestColliderType = currentEnt?.colliderType || currentArch?.colliderType || snapEnt.colliderType;

        restoredEntities[id] = {
          ...snapEnt,
          name: latestName,
          tags: latestTags,
          states: JSON.parse(JSON.stringify(latestStates)),
          vectorPaths: latestVectorPaths ? JSON.parse(JSON.stringify(latestVectorPaths)) : snapEnt.vectorPaths,
          colliderType: latestColliderType,
          position: snapEnt.position,
          currentStateId: snapEnt.currentStateId in latestStates ? snapEnt.currentStateId : Object.keys(latestStates)[0],
        };
      });

      // Preserve newly user-created entities that were not in initial snapshot and not spawned by rules
      Object.entries(entities).forEach(([id, currEnt]) => {
        if (!snapshotEntities[id] && !id.startsWith('spawn-')) {
          restoredEntities[id] = currEnt;
        }
      });

      set({
        entities: restoredEntities,
        activeCollisions: {},
      });
    } else {
      set({
        entities: {},
        activeCollisions: {},
      });
    }
    get().evaluateRules();
  },

  selectEntity: (id) => set({ selectedEntityId: id }),

  updateEntityPosition: (id, position) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, position },
        },
      };
    });
    get().evaluateRules();
  },

  updateEntityState: (id, stateId) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity || !entity.states[stateId]) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, currentStateId: stateId },
        },
      };
    });
  },

  updateEntitySize: (id, size) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: {
            ...entity,
            size: {
              width: Math.max(24, Math.round(size.width)),
              height: Math.max(24, Math.round(size.height)),
            },
          },
        },
      };
    });
  },

  updateEntityDetails: (id, partial) => {
    set((state) => {
      const entity =
        state.entities[id] ||
        state.customArchetypes[id] ||
        Object.values(state.entities).find((e) => e.type === id) ||
        Object.values(state.customArchetypes).find((a) => a.type === id);

      if (!entity) return state;
      const targetType = entity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            ...partial,
            // Keep instance-specific position intact unless specifically modifying position
            position: partial.position !== undefined && e.id === id ? partial.position : e.position,
          };
        } else if (e.id === id) {
          updatedEntities[e.id] = { ...e, ...partial };
        }
      });

      let updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          ...partial,
          position: { x: 0, y: 0 },
        };
      }

      return {
        entities: updatedEntities,
        customArchetypes: updatedArchetypes,
      };
    });
  },

  addTagToEntity: (id, rawTag) => {
    const cleanTag = rawTag.toLowerCase().trim().replace(/^#/, '');
    if (!cleanTag) return;
    set((state) => {
      const targetEntity = state.entities[id] || state.customArchetypes[id];
      if (!targetEntity) return state;
      const targetType = targetEntity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          const currentTags = e.tags || [];
          if (!currentTags.includes(cleanTag)) {
            updatedEntities[e.id] = { ...e, tags: [...currentTags, cleanTag] };
          }
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        const currentTags = updatedArchetypes[targetType].tags || [];
        if (!currentTags.includes(cleanTag)) {
          updatedArchetypes[targetType] = {
            ...updatedArchetypes[targetType],
            tags: [...currentTags, cleanTag],
          };
        }
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  removeTagFromEntity: (id, tagToRemove) => {
    set((state) => {
      const targetEntity = state.entities[id] || state.customArchetypes[id];
      if (!targetEntity) return state;
      const targetType = targetEntity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType && e.tags) {
          updatedEntities[e.id] = {
            ...e,
            tags: e.tags.filter((t) => t !== tagToRemove),
          };
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType] && updatedArchetypes[targetType].tags) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          tags: updatedArchetypes[targetType].tags.filter((t) => t !== tagToRemove),
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  updateStateProperties: (entityId, stateId, partial) => {
    set((state) => {
      const targetEntity =
        state.entities[entityId] ||
        state.customArchetypes[entityId] ||
        Object.values(state.entities).find((e) => e.type === entityId) ||
        Object.values(state.customArchetypes).find((a) => a.type === entityId);

      if (!targetEntity) return state;
      const targetType = targetEntity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          const existingState = e.states[stateId] || { id: stateId, name: stateId, color: '#3b82f6', scale: 1, rotation: 0 };
          const updatedState: EntityState = {
            id: stateId,
            name: partial.name ?? existingState.name ?? stateId,
            color: partial.color ?? existingState.color ?? '#3b82f6',
            scale: partial.scale ?? existingState.scale ?? 1,
            rotation: partial.rotation ?? existingState.rotation ?? 0,
            ...existingState,
            ...partial,
          };
          const isCurrentState = e.currentStateId === stateId;
          const newVectorPaths = partial.vectorPaths !== undefined ? partial.vectorPaths : e.vectorPaths;
          const newColliderType = partial.colliderType !== undefined ? partial.colliderType : e.colliderType;

          updatedEntities[e.id] = {
            ...e,
            vectorPaths: isCurrentState ? newVectorPaths : e.vectorPaths,
            colliderType: isCurrentState ? newColliderType : e.colliderType,
            states: {
              ...e.states,
              [stateId]: updatedState,
            },
          };
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        const existingArchState = updatedArchetypes[targetType].states[stateId] || { id: stateId, name: stateId, color: '#3b82f6', scale: 1, rotation: 0 };
        const updatedArchState: EntityState = {
          id: stateId,
          name: partial.name ?? existingArchState.name ?? stateId,
          color: partial.color ?? existingArchState.color ?? '#3b82f6',
          scale: partial.scale ?? existingArchState.scale ?? 1,
          rotation: partial.rotation ?? existingArchState.rotation ?? 0,
          ...existingArchState,
          ...partial,
        };
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: {
            ...updatedArchetypes[targetType].states,
            [stateId]: updatedArchState,
          },
        };
        if (partial.vectorPaths) {
          updatedArchetypes[targetType].vectorPaths = partial.vectorPaths;
        }
        if (partial.colliderType) {
          updatedArchetypes[targetType].colliderType = partial.colliderType;
        }
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  addStateToEntity: (entityId, name) => {
    const targetEntity =
      get().entities[entityId] ||
      get().customArchetypes[entityId] ||
      Object.values(get().entities).find((e) => e.type === entityId) ||
      Object.values(get().customArchetypes).find((a) => a.type === entityId);

    if (!targetEntity) return '';
    const targetType = targetEntity.type;

    const existingStateKeys = Object.keys(targetEntity.states);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nextLetter = alphabet[existingStateKeys.length] || `État ${existingStateKeys.length + 1}`;
    const stateName = name && name.trim() ? name.trim() : nextLetter;
    const newId = `state_${stateName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now().toString(36)}`;

    const newState: EntityState = {
      id: newId,
      name: stateName,
      color: targetEntity.states[targetEntity.currentStateId]?.color || '#3b82f6',
      scale: 1,
      rotation: 0,
      stemHeight: 50,
      flowerColor: '#a855f7',
      flowerPetals: 6,
      vectorPaths: [], // Canvas vide pour le nouvel état
    };

    set((state) => {
      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            states: {
              ...e.states,
              [newId]: newState,
            },
          };
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: {
            ...updatedArchetypes[targetType].states,
            [newId]: newState,
          },
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });

    return newId;
  },

  removeStateFromEntity: (entityId, stateId) => {
    set((state) => {
      const targetEntity =
        state.entities[entityId] ||
        state.customArchetypes[entityId] ||
        Object.values(state.entities).find((e) => e.type === entityId) ||
        Object.values(state.customArchetypes).find((a) => a.type === entityId);

      if (!targetEntity) return state;
      const targetType = targetEntity.type;

      const stateKeys = Object.keys(targetEntity.states);
      if (stateKeys.length <= 1) return state;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          const { [stateId]: _, ...remainingStates } = e.states;
          const nextStateId =
            e.currentStateId === stateId ? Object.keys(remainingStates)[0] : e.currentStateId;
          updatedEntities[e.id] = {
            ...e,
            states: remainingStates,
            currentStateId: nextStateId,
          };
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        const { [stateId]: _, ...remainingArchStates } = updatedArchetypes[targetType].states;
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: remainingArchStates,
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  addEntity: (type) => {
    const id = `${type}-${Date.now().toString(36)}`;
    const currentEntities = Object.values(get().entities);
    const count = currentEntities.length + 1;

    let newEntity: Entity;

    // Check if an entity of this type already exists to inherit tags and states
    const existingPeer = currentEntities.find((e) => e.type === type);

    if (type === 'plant') {
      newEntity = {
        id,
        name: `Plante #${count}`,
        type: 'plant',
        tags: existingPeer ? [...(existingPeer.tags || [])] : ['plante', 'nature'],
        position: { x: 200 + ((count * 30) % 200), y: 250 },
        size: { width: 120, height: 160 },
        currentStateId: 'pousse',
        isDraggable: true,
        states: existingPeer
          ? JSON.parse(JSON.stringify(existingPeer.states))
          : {
              'pousse': {
                id: 'pousse',
                name: 'Pousse',
                color: '#22c55e',
                scale: 0.9,
                rotation: 0,
                stemHeight: 40,
                flowerColor: '#8b5cf6',
                flowerPetals: 0,
              },
              'fleur': {
                id: 'fleur',
                name: 'Fleurie',
                color: '#15803d',
                scale: 1.1,
                rotation: 0,
                stemHeight: 75,
                flowerColor: '#ec4899',
                flowerPetals: 6,
              },
            },
      };
    } else if (type === 'apple') {
      newEntity = {
        id,
        name: `Pomme #${count}`,
        type: 'apple',
        tags: existingPeer ? [...(existingPeer.tags || [])] : ['nourriture', 'fruit'],
        position: { x: 100 + ((count * 40) % 250), y: 100 },
        size: { width: 64, height: 64 },
        currentStateId: 'default',
        isDraggable: true,
        states: existingPeer
          ? JSON.parse(JSON.stringify(existingPeer.states))
          : {
              'default': {
                id: 'default',
                name: 'Normal',
                color: '#ef4444',
                scale: 1,
                rotation: 0,
              },
              'croquee': {
                id: 'croquee',
                name: 'Croquée',
                color: '#dc2626',
                scale: 0.85,
                rotation: -12,
              },
            },
      };
    } else {
      newEntity = {
        id,
        name: `Étoile #${count}`,
        type: 'custom',
        tags: existingPeer ? [...(existingPeer.tags || [])] : ['magique', 'etoile'],
        position: { x: 300, y: 150 },
        size: { width: 70, height: 70 },
        currentStateId: 'default',
        isDraggable: true,
        states: existingPeer
          ? JSON.parse(JSON.stringify(existingPeer.states))
          : {
              'default': {
                id: 'default',
                name: 'Calme',
                color: '#eab308',
                scale: 1,
                rotation: 0,
              },
              'brillant': {
                id: 'brillant',
                name: 'Étincelant',
                color: '#facc15',
                scale: 1.3,
                rotation: 45,
              },
            },
      };
    }

    set((state) => ({
      entities: {
        ...state.entities,
        [id]: newEntity,
      },
      selectedEntityId: id,
    }));
  },

  addCustomEntity: ({ name, type, icon, drawingDataUrl, vectorPaths, color, tags }) => {
    const cleanName = (name && name.trim()) || 'Mon Dessin';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'dessin';
    const uniqueType = type || `custom_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const mainColor = color || '#8b5cf6';
    const id = `custom-${Date.now().toString(36)}`;
    const currentEntities = Object.values(get().entities);
    const count = currentEntities.length + 1;

    const newEntity: Entity = {
      id,
      name: cleanName,
      type: uniqueType,
      icon: icon || '🎨',
      drawingDataUrl,
      vectorPaths: vectorPaths ? JSON.parse(JSON.stringify(vectorPaths)) : [],
      tags: tags && tags.length > 0 ? tags : [slug, 'custom'],
      position: { x: 180 + ((count * 35) % 220), y: 140 + ((count * 30) % 180) },
      size: { width: 80, height: 80 },
      currentStateId: 'state_1',
      isDraggable: true,
      states: {
        state_1: {
          id: 'state_1',
          name: 'Normal',
          color: mainColor,
          scale: 1,
          rotation: 0,
          vectorPaths: vectorPaths ? JSON.parse(JSON.stringify(vectorPaths)) : [],
        },
      },
    };

    set((state) => ({
      entities: {
        ...state.entities,
        [id]: newEntity,
      },
      customArchetypes: {
        ...state.customArchetypes,
        [uniqueType]: JSON.parse(JSON.stringify(newEntity)),
      },
      selectedEntityId: id,
    }));
    get().evaluateRules();
  },

  deleteCustomArchetype: (type: string) => {
    set((state) => {
      const { [type]: _, ...remainingArchetypes } = state.customArchetypes;
      return { customArchetypes: remainingArchetypes };
    });
  },

  spawnEntity: ({ type, position, initialStateId, size }) => {
    const currentEntities = Object.values(get().entities);
    const archetype = get().customArchetypes[type] || currentEntities.find((e) => e.type === type);

    const count = currentEntities.length + 1;
    const id = `spawn-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    let newEntity: Entity;

    if (archetype) {
      const clonedStates = JSON.parse(JSON.stringify(archetype.states));
      const targetState = initialStateId && clonedStates[initialStateId] ? initialStateId : archetype.currentStateId;
      newEntity = {
        ...JSON.parse(JSON.stringify(archetype)),
        id,
        name: `${archetype.name.replace(/#\d+/, '').trim()} #${count}`,
        position,
        currentStateId: targetState,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : archetype.size,
      };
    } else if (type === 'apple') {
      newEntity = {
        id,
        name: `Pomme #${count}`,
        type: 'apple',
        tags: ['nourriture', 'fruit'],
        position,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 64, height: 64 },
        currentStateId: initialStateId || 'default',
        isDraggable: true,
        states: {
          'default': { id: 'default', name: 'Normal', color: '#ef4444', scale: 1, rotation: 0 },
          'croquee': { id: 'croquee', name: 'Croquée', color: '#dc2626', scale: 0.85, rotation: -12 },
        },
      };
    } else if (type === 'plant') {
      newEntity = {
        id,
        name: `Plante #${count}`,
        type: 'plant',
        tags: ['plante', 'nature'],
        position,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 120, height: 160 },
        currentStateId: initialStateId || 'pousse',
        isDraggable: true,
        states: {
          'pousse': { id: 'pousse', name: 'Pousse', color: '#22c55e', scale: 0.9, rotation: 0, stemHeight: 40, flowerColor: '#8b5cf6', flowerPetals: 0 },
          'fleur': { id: 'fleur', name: 'Fleurie', color: '#15803d', scale: 1.1, rotation: 0, stemHeight: 75, flowerColor: '#ec4899', flowerPetals: 6 },
        },
      };
    } else {
      newEntity = {
        id,
        name: `Entité #${count}`,
        type,
        tags: [type],
        position,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 80, height: 80 },
        currentStateId: initialStateId || 'default',
        isDraggable: true,
        states: {
          'default': { id: 'default', name: 'Normal', color: '#8b5cf6', scale: 1, rotation: 0 },
          'actif': { id: 'actif', name: 'Actif', color: '#f59e0b', scale: 1.25, rotation: 15 },
        },
      };
    }

    set((state) => ({
      entities: {
        ...state.entities,
        [id]: newEntity,
      },
      selectedEntityId: id,
    }));
    get().evaluateRules();
  },

  deleteEntity: (id) => {
    set((state) => {
      const { [id]: _, ...remainingEntities } = state.entities;
      const nextSelected =
        state.selectedEntityId === id ? Object.keys(remainingEntities)[0] || null : state.selectedEntityId;

      return {
        entities: remainingEntities,
        selectedEntityId: nextSelected,
      };
    });
  },

  clearAllEntities: () => {
    set({
      entities: {},
      selectedEntityId: null,
    });
  },

  clearProject: () => {
    set({
      entities: {},
      rules: [],
      selectedEntityId: null,
      activeCollisions: {},
      snapshotEntities: null,
    });
  },

  restoreDefaultScene: () => {
    set({
      entities: JSON.parse(JSON.stringify(initialEntities)),
      customArchetypes: JSON.parse(JSON.stringify(defaultCustomArchetypes)),
      rules: JSON.parse(JSON.stringify(initialRules)),
      snapshotEntities: null,
      selectedEntityId: 'plant-1',
      activeCollisions: {},
      appMode: 'edit',
    });
    get().evaluateRules();
  },

  exportProject: () => {
    const { entities, customArchetypes, rules, settings } = get();
    return {
      version: 1,
      name: 'Projet Atelier Vivant',
      exportedAt: new Date().toISOString(),
      entities,
      customArchetypes,
      rules,
      settings,
    };
  },

  importProject: (data: any) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Format de fichier JSON invalide.' };
      }
      if (!data.entities && !data.rules) {
        return { success: false, message: 'Le fichier ne contient ni entités ni règles.' };
      }

      const importedEntities = data.entities && typeof data.entities === 'object' ? data.entities : {};
      const importedArchetypes =
        data.customArchetypes && typeof data.customArchetypes === 'object'
          ? { ...defaultCustomArchetypes, ...data.customArchetypes }
          : { ...defaultCustomArchetypes };
      const importedRules = Array.isArray(data.rules) ? data.rules : [];
      const importedSettings = data.settings && typeof data.settings === 'object' ? data.settings : undefined;

      set((state) => ({
        entities: importedEntities,
        customArchetypes: importedArchetypes,
        rules: importedRules,
        settings: importedSettings ? { ...state.settings, ...importedSettings } : state.settings,
        selectedEntityId: Object.keys(importedEntities)[0] || null,
        activeCollisions: {},
        appMode: 'edit',
        snapshotEntities: null,
      }));

      get().evaluateRules();
      return { success: true, message: 'Projet importé avec succès !' };
    } catch (err: any) {
      return { success: false, message: err?.message || "Erreur lors de l'importation." };
    }
  },

  // Gestion des Règles
  addRule: (ruleData) => {
    const id = `rule-${Date.now().toString(36)}`;
    const newRule: DynamicRule = { ...ruleData, id };
    set((state) => ({
      rules: [...state.rules, newRule],
    }));
    get().evaluateRules();
    return id;
  },

  updateRule: (id, partial) => {
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    }));
    get().evaluateRules();
  },

  duplicateRule: (id) => {
    const existingRule = get().rules.find((r) => r.id === id);
    if (!existingRule) return '';
    const newId = `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const clonedRule: DynamicRule = {
      ...JSON.parse(JSON.stringify(existingRule)),
      id: newId,
      name: `${existingRule.name} (Copie)`,
      actions: (existingRule.actions || []).map((act: RuleAction) => ({
        ...act,
        id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      })),
    };

    set((state) => {
      const idx = state.rules.findIndex((r) => r.id === id);
      const newRules = [...state.rules];
      if (idx !== -1) {
        newRules.splice(idx + 1, 0, clonedRule);
      } else {
        newRules.push(clonedRule);
      }
      return { rules: newRules };
    });

    get().evaluateRules();
    return newId;
  },

  deleteRule: (id) => {
    set((state) => ({
      rules: state.rules.filter((r) => r.id !== id),
    }));
  },

  toggleRule: (id) => {
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
    }));
    get().evaluateRules();
  },

  triggerClickEvent: (entityId) => {
    get().triggerPointerEvent(entityId, 'click');
  },

  triggerPointerEvent: (entityId, phase) => {
    // Les règles ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[entityId];
    if (!subject) return;

    const now = Date.now();

    const activeClickRules = rules.filter((r) => {
      if (!r.enabled || r.trigger.type !== 'click') return false;

      // Vérifier si le sujet correspond au filtre
      const isSubjectMatch = matchesEntityFilter(
        subject,
        r.trigger.subjectMode,
        r.trigger.subjectId,
        r.trigger.subjectType,
        r.trigger.subjectTag
      );
      if (!isSubjectMatch) return false;

      // Vérifier la phase spécifiée
      const rulePhase = r.trigger.phase || 'click';
      if (rulePhase !== phase) return false;

      // Vérifier l'état requis pour le sujet
      if (
        r.trigger.subjectStateId &&
        r.trigger.subjectStateId !== '' &&
        subject.currentStateId !== r.trigger.subjectStateId
      ) {
        return false;
      }
      return true;
    });

    activeClickRules.forEach((rule) => {
      const cooldownKey = `click_${rule.id}_${subject.id}_${phase}`;
      if (now - (ruleCooldowns[cooldownKey] || 0) < RULE_COOLDOWN_MS) {
        return;
      }
      ruleCooldowns[cooldownKey] = now;

      rule.actions.forEach((act) => {
        executeAction(act, {
          subject,
          allEntities: entities,
          updateEntityState,
          updateEntityDetails,
          deleteEntity,
          spawnEntity,
        });
      });
    });
  },

  triggerDragRelease: (subjectId) => {
    // Les règles ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[subjectId];
    if (!subject) return;

    const now = Date.now();
    const allEntitiesList = Object.values(entities);

    // 1. Règles spécifiques au Drag / Relâchement (type 'drag' ou phase 'drag_release')
    const dragReleaseRules = rules.filter(
      (r) =>
        r.enabled &&
        (r.trigger.type === 'drag' || r.trigger.phase === 'drag_release')
    );

    dragReleaseRules.forEach((rule) => {
      if (
        !matchesEntityFilter(
          subject,
          rule.trigger.subjectMode,
          rule.trigger.subjectId,
          rule.trigger.subjectType,
          rule.trigger.subjectTag
        )
      ) {
        return;
      }

      if (
        rule.trigger.subjectStateId &&
        rule.trigger.subjectStateId !== '' &&
        subject.currentStateId !== rule.trigger.subjectStateId
      ) {
        return;
      }

      const cooldownKey = `drag_release_${rule.id}_${subject.id}`;
      if (now - (ruleCooldowns[cooldownKey] || 0) < RULE_COOLDOWN_MS) {
        return;
      }
      ruleCooldowns[cooldownKey] = now;

      rule.actions.forEach((act) => {
        executeAction(act, {
          subject,
          allEntities: entities,
          updateEntityState,
          updateEntityDetails,
          deleteEntity,
          spawnEntity,
        });
      });
    });

// Stockage temporaire des états avant collision pour le mode Contact Continu (Toggle)
const preCollisionStates: Record<string, { subjectState?: StateId; targetState?: StateId }> = {};

    // 2. Règles de collision avec phase 'collision_release' ou 'release' (Relâchement au-dessus d'une cible)
    const collisionReleaseRules = rules.filter(
      (r) =>
        r.enabled &&
        r.trigger.type === 'collision' &&
        (r.trigger.phase === 'collision_release' || r.trigger.phase === 'release' || r.trigger.phase === 'enter')
    );

    collisionReleaseRules.forEach((rule) => {
      // Vérifier si le sujet correspond (Sens 1)
      const isSub1 = matchesEntityFilter(
        subject,
        rule.trigger.subjectMode,
        rule.trigger.subjectId,
        rule.trigger.subjectType,
        rule.trigger.subjectTag
      );

      // Vérifier si le sujet correspond comme cible (Sens 2 - Bidirectionnel)
      const isSub2 = matchesEntityFilter(
        subject,
        rule.trigger.targetMode,
        rule.trigger.targetId,
        rule.trigger.targetType,
        rule.trigger.targetTag
      );

      allEntitiesList.forEach((other) => {
        if (other.id === subject.id) return;
        if (!checkCollision(subject, other)) return;

        // Cas 1: subject = Sujet, other = Cible
        if (isSub1 && matchesEntityFilter(other, rule.trigger.targetMode, rule.trigger.targetId, rule.trigger.targetType, rule.trigger.targetTag)) {
          if ((!rule.trigger.subjectStateId || subject.currentStateId === rule.trigger.subjectStateId) &&
              (!rule.trigger.targetStateId || other.currentStateId === rule.trigger.targetStateId)) {
            const cooldownKey = `coll_rel_${rule.id}_${subject.id}_${other.id}`;
            if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
              ruleCooldowns[cooldownKey] = now;
              rule.actions.forEach((act) => {
                executeAction(act, {
                  subject,
                  target: other,
                  allEntities: entities,
                  updateEntityState,
                  updateEntityDetails,
                  deleteEntity,
                  spawnEntity,
                });
              });
            }
          }
        }

        // Cas 2: other = Sujet, subject = Cible (Bidirectionnel)
        if (isSub2 && matchesEntityFilter(other, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)) {
          if ((!rule.trigger.subjectStateId || other.currentStateId === rule.trigger.subjectStateId) &&
              (!rule.trigger.targetStateId || subject.currentStateId === rule.trigger.targetStateId)) {
            const cooldownKey = `coll_rel_${rule.id}_${other.id}_${subject.id}`;
            if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
              ruleCooldowns[cooldownKey] = now;
              rule.actions.forEach((act) => {
                executeAction(act, {
                  subject: other,
                  target: subject,
                  allEntities: entities,
                  updateEntityState,
                  updateEntityDetails,
                  deleteEntity,
                  spawnEntity,
                });
              });
            }
          }
        }
      });
    });
  },

  evaluateRules: () => {
    get().evaluateRulesWithTemp();
  },

  evaluateRulesWithTemp: (tempPositions) => {
    // Les règles de collision et d'animation ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { entities, rules, activeCollisions, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const collisionRules = rules.filter((r) => r.enabled && r.trigger.type === 'collision');
    if (collisionRules.length === 0) return;

    const nextCollisions: Record<string, boolean> = { ...activeCollisions };
    const allEntitiesList = Object.values(entities);
    const now = Date.now();

    collisionRules.forEach((rule) => {
      // Chercher toutes les paires d'entités distinctes
      for (let i = 0; i < allEntitiesList.length; i++) {
        for (let j = i + 1; j < allEntitiesList.length; j++) {
          const entA = allEntitiesList[i];
          const entB = allEntitiesList[j];

          let posA = entA.position;
          if (tempPositions && tempPositions[entA.id]) {
            posA = tempPositions[entA.id];
          }

          let posB = entB.position;
          if (tempPositions && tempPositions[entB.id]) {
            posB = tempPositions[entB.id];
          }

          const tempA = { ...entA, position: posA };
          const tempB = { ...entB, position: posB };

          const isColliding = checkCollision(tempA, tempB);

          // Vérifier dans le Sens 1 : entA = Sujet, entB = Cible
          const matchAAsSubject = matchesEntityFilter(
            entA,
            rule.trigger.subjectMode,
            rule.trigger.subjectId,
            rule.trigger.subjectType,
            rule.trigger.subjectTag
          );
          const matchBAsTarget = matchesEntityFilter(
            entB,
            rule.trigger.targetMode,
            rule.trigger.targetId,
            rule.trigger.targetType,
            rule.trigger.targetTag
          );

          if (matchAAsSubject && matchBAsTarget) {
            handleCollisionPair(
              rule,
              entA,
              entB,
              isColliding,
              nextCollisions,
              activeCollisions,
              now,
              {
                entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
              }
            );
          }

          // Vérifier dans le Sens 2 (Bidirectionnel) : entB = Sujet, entA = Cible
          const matchBAsSubject = matchesEntityFilter(
            entB,
            rule.trigger.subjectMode,
            rule.trigger.subjectId,
            rule.trigger.subjectType,
            rule.trigger.subjectTag
          );
          const matchAAsTarget = matchesEntityFilter(
            entA,
            rule.trigger.targetMode,
            rule.trigger.targetId,
            rule.trigger.targetType,
            rule.trigger.targetTag
          );

          if (matchBAsSubject && matchAAsTarget && entA.id !== entB.id) {
            handleCollisionPair(
              rule,
              entB,
              entA,
              isColliding,
              nextCollisions,
              activeCollisions,
              now,
              {
                entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
              }
            );
          }
        }
      }
    });

    set({ activeCollisions: nextCollisions });
  },
}));

// Helper pour traiter les paires de collision avec anti-boucle
function handleCollisionPair(
  rule: DynamicRule,
  subject: Entity,
  target: Entity,
  isColliding: boolean,
  nextCollisions: Record<string, boolean>,
  activeCollisions: Record<string, boolean>,
  now: number,
  helpers: {
    entities: Record<EntityId, Entity>;
    updateEntityState: (id: EntityId, stateId: StateId) => void;
    updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
    deleteEntity: (id: EntityId) => void;
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId }) => void;
  }
) {
  const collisionKey = `${rule.id}_${subject.id}_${target.id}`;

  // Filtrer par état spécifique du sujet
  if (
    rule.trigger.subjectStateId &&
    rule.trigger.subjectStateId !== '' &&
    subject.currentStateId !== rule.trigger.subjectStateId
  ) {
    nextCollisions[collisionKey] = false;
    return;
  }

  // Filtrer par état spécifique de la cible
  if (
    rule.trigger.targetStateId &&
    rule.trigger.targetStateId !== '' &&
    target.currentStateId !== rule.trigger.targetStateId
  ) {
    nextCollisions[collisionKey] = false;
    return;
  }

  const wasColliding = !!activeCollisions[collisionKey];
  const rulePhase = rule.trigger.phase || 'enter';
  let shouldExecute = false;

  if (isColliding && !wasColliding) {
    // Enregistrer les états précédents pour le mode stay / revertOnExit
    preCollisionStates[collisionKey] = {
      subjectState: subject.currentStateId,
      targetState: target.currentStateId,
    };

    // Premier contact (On Enter)
    if (rulePhase === 'enter' || rulePhase === 'stay') {
      shouldExecute = true;
    }
    nextCollisions[collisionKey] = true;
  } else if (isColliding && wasColliding) {
    // Contact continu (Stay)
    if (rulePhase === 'stay') {
      shouldExecute = true;
    }
    nextCollisions[collisionKey] = true;
  } else if (!isColliding && wasColliding) {
    // Sortie / Séparation (Release / Exit)
    if (rulePhase === 'release') {
      shouldExecute = true;
    }

    // Toggle / Revert pour le contact continu (stay)
    if (rulePhase === 'stay' && rule.trigger.revertOnExit !== false) {
      const pre = preCollisionStates[collisionKey];
      if (pre) {
        if (pre.subjectState && subject.states[pre.subjectState] && subject.currentStateId !== pre.subjectState) {
          helpers.updateEntityState(subject.id, pre.subjectState);
        }
        if (pre.targetState && target.states[pre.targetState] && target.currentStateId !== pre.targetState) {
          helpers.updateEntityState(target.id, pre.targetState);
        }
      }
    }

    delete preCollisionStates[collisionKey];
    nextCollisions[collisionKey] = false;
  }

  if (shouldExecute) {
    // Anti-loop cooldown debounce
    const cooldownKey = `collision_${rule.id}_${subject.id}_${target.id}`;
    if (now - (ruleCooldowns[cooldownKey] || 0) < RULE_COOLDOWN_MS) {
      return;
    }
    ruleCooldowns[cooldownKey] = now;

    rule.actions.forEach((act) => {
      executeAction(act, {
        subject,
        target,
        allEntities: helpers.entities,
        updateEntityState: helpers.updateEntityState,
        updateEntityDetails: helpers.updateEntityDetails,
        deleteEntity: helpers.deleteEntity,
        spawnEntity: helpers.spawnEntity,
      });
    });
  }
}

// Helper pour exécuter une action ciblée
function executeAction(
  act: RuleAction,
  helpers: {
    subject?: Entity;
    target?: Entity;
    allEntities: Record<EntityId, Entity>;
    updateEntityState: (id: EntityId, stateId: StateId) => void;
    updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
    deleteEntity: (id: EntityId) => void;
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId; size?: Size }) => void;
  }
) {
  if (act.type === 'play_sound') {
    soundSynth.play(act.soundType || 'pop');
    return;
  }

  if (act.type === 'spawn_entity') {
    const spawnType = act.spawnEntityType || 'custom';
    let basePos = { x: 250, y: 200 };
    const locMode = act.spawnLocationMode || act.spawnLocation || (helpers.target ? 'at_target' : 'at_subject');

    if (locMode === 'at_target' && helpers.target) {
      basePos = { ...helpers.target.position };
    } else if (locMode === 'at_subject' && helpers.subject) {
      basePos = { ...helpers.subject.position };
    } else if (locMode === 'offset_subject' && helpers.subject) {
      basePos = {
        x: helpers.subject.position.x + (act.spawnOffset?.x || 0),
        y: helpers.subject.position.y + (act.spawnOffset?.y || 0),
      };
    } else if (locMode === 'offset_target' && helpers.target) {
      basePos = {
        x: helpers.target.position.x + (act.spawnOffset?.x || 0),
        y: helpers.target.position.y + (act.spawnOffset?.y || 0),
      };
    } else if (locMode === 'random') {
      basePos = {
        x: Math.floor(Math.random() * 400 + 80),
        y: Math.floor(Math.random() * 250 + 80),
      };
    } else if (locMode === 'absolute' && act.spawnPosition) {
      basePos = { ...act.spawnPosition };
    } else if (helpers.target) {
      basePos = { ...helpers.target.position };
    } else if (helpers.subject) {
      basePos = { ...helpers.subject.position };
    }

    const isPreciseMode = locMode === 'absolute' || locMode === 'offset_subject' || locMode === 'offset_target';
    const spawnX = isPreciseMode ? basePos.x : basePos.x + Math.floor(Math.random() * 30 - 15);
    const spawnY = isPreciseMode ? basePos.y : basePos.y + Math.floor(Math.random() * 30 - 15);

    let spawnSize: Size | undefined = undefined;
    if (act.spawnSizeMode === 'match_target' && helpers.target) {
      spawnSize = { ...helpers.target.size };
    } else if (act.spawnSizeMode === 'match_subject' && helpers.subject) {
      spawnSize = { ...helpers.subject.size };
    } else if (act.spawnSizeMode === 'custom' && act.spawnCustomSize) {
      spawnSize = { ...act.spawnCustomSize };
    }

    helpers.spawnEntity({
      type: spawnType,
      position: { x: Math.max(10, spawnX), y: Math.max(10, spawnY) },
      initialStateId: act.spawnInitialStateId,
      size: spawnSize,
    });
    return;
  }

  const targetEntities: Entity[] = [];

  const targetMode: ActionTargetMode = act.targetMode || 'subject';

  if (targetMode === 'subject' && helpers.subject) {
    targetEntities.push(helpers.subject);
  } else if (targetMode === 'target') {
    if (helpers.target) {
      targetEntities.push(helpers.target);
    } else if (act.targetType) {
      Object.values(helpers.allEntities).forEach((e) => {
        if (e.type === act.targetType) targetEntities.push(e);
      });
    } else if (helpers.subject) {
      // Pour les événements au clic (pas de collision/cible), fallback vers le sujet cliqué
      targetEntities.push(helpers.subject);
    }
  } else if (targetMode === 'instance' && act.targetId) {
    const e = helpers.allEntities[act.targetId];
    if (e) targetEntities.push(e);
  } else if (targetMode === 'type' && act.targetType) {
    Object.values(helpers.allEntities).forEach((e) => {
      if (e.type === act.targetType) targetEntities.push(e);
    });
  } else if (targetMode === 'tag' && act.targetTag) {
    const cleanTag = act.targetTag.toLowerCase().trim().replace(/^#/, '');
    Object.values(helpers.allEntities).forEach((e) => {
      if (e.tags?.includes(cleanTag)) targetEntities.push(e);
    });
  } else if (act.targetType && act.targetType !== helpers.subject?.type) {
    // Si l'action cible explicitement un type d'entité distinct
    Object.values(helpers.allEntities).forEach((e) => {
      if (e.type === act.targetType) targetEntities.push(e);
    });
  } else if (act.targetId) {
    // Fallback
    const e = helpers.allEntities[act.targetId];
    if (e) targetEntities.push(e);
  }

  targetEntities.forEach((entity) => {
    // Si un filtre d'état source est spécifié pour l'action, vérifier qu'elle y correspond
    if (act.onlyInStateId && act.onlyInStateId !== '' && entity.currentStateId !== act.onlyInStateId) {
      return;
    }

    if (act.type === 'change_state' && act.targetStateId) {
      const now = Date.now();
      if (now - (entityStateTimestamps[entity.id] || 0) < ENTITY_STATE_COOLDOWN_MS) {
        return; // Évite les oscillations d'état infinies immédiates
      }
      if (entity.currentStateId !== act.targetStateId && entity.states[act.targetStateId]) {
        entityStateTimestamps[entity.id] = now;
        helpers.updateEntityState(entity.id, act.targetStateId);
      }
    } else if (act.type === 'toggle_state') {
      const now = Date.now();
      if (now - (entityStateTimestamps[entity.id] || 0) < ENTITY_STATE_COOLDOWN_MS) {
        return;
      }

      const stateKeys = Object.keys(entity.states);
      let nextStateId: StateId | null = null;

      if (act.toggleStateAId && act.toggleStateBId) {
        if (entity.currentStateId === act.toggleStateAId) {
          nextStateId = act.toggleStateBId;
        } else {
          nextStateId = act.toggleStateAId;
        }
      } else if (act.targetStateId) {
        if (entity.currentStateId === act.targetStateId) {
          const otherStates = stateKeys.filter((s) => s !== act.targetStateId);
          nextStateId = otherStates[0] || stateKeys[0];
        } else {
          nextStateId = act.targetStateId;
        }
      } else if (stateKeys.length > 1) {
        const currentIndex = stateKeys.indexOf(entity.currentStateId);
        const nextIndex = (currentIndex + 1) % stateKeys.length;
        nextStateId = stateKeys[nextIndex];
      }

      if (nextStateId && entity.states[nextStateId]) {
        entityStateTimestamps[entity.id] = now;
        helpers.updateEntityState(entity.id, nextStateId);
      }
    } else if (act.type === 'toggle_draggable') {
      helpers.updateEntityDetails(entity.id, { isDraggable: !entity.isDraggable });
    } else if (act.type === 'delete_entity') {
      helpers.deleteEntity(entity.id);
    }
  });
}
