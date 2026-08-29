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
} from '../types';
import { soundSynth } from '../utils/sound';

interface SceneState {
  entities: Record<EntityId, Entity>;
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
  addStateToEntity: (entityId: EntityId, name: string) => void;
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
  spawnEntity: (params: {
    type: EntityType;
    position: Position;
    initialStateId?: StateId;
  }) => void;
  deleteEntity: (id: EntityId) => void;
  clearAllEntities: () => void;
  clearProject: () => void;
  restoreDefaultScene: () => void;

  // Rules management
  addRule: (rule: Omit<DynamicRule, 'id'>) => string;
  updateRule: (id: string, partial: Partial<DynamicRule>) => void;
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

// Vérification de la collision AABB
const checkCollision = (ent1: Entity, ent2: Entity) => {
  return (
    ent1.position.x < ent2.position.x + ent2.size.width &&
    ent1.position.x + ent1.size.width > ent2.position.x &&
    ent1.position.y < ent2.position.y + ent2.size.height &&
    ent1.position.y + ent1.size.height > ent2.position.y
  );
};

export const useSceneStore = create<SceneState>((set, get) => ({
  entities: initialEntities,
  rules: initialRules,
  activeCollisions: {},
  selectedEntityId: 'plant-1',
  appMode: 'edit',
  snapshotEntities: null,
  settings: {
    showCanvasLabels: false,
    showGrid: true,
    gridStyle: 'dots',
    showTagsSystem: false,
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
      set({ appMode: 'edit' });
    }
  },

  resetScene: () => {
    const { snapshotEntities } = get();
    if (snapshotEntities) {
      set({
        entities: JSON.parse(JSON.stringify(snapshotEntities)),
        activeCollisions: {},
      });
    } else {
      set({
        entities: JSON.parse(JSON.stringify(initialEntities)),
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
      const entity = state.entities[id];
      if (!entity) return state;
      return {
        entities: {
          ...state.entities,
          [id]: { ...entity, ...partial },
        },
      };
    });
  },

  addTagToEntity: (id, rawTag) => {
    const cleanTag = rawTag.toLowerCase().trim().replace(/^#/, '');
    if (!cleanTag) return;
    set((state) => {
      const targetEntity = state.entities[id];
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

      return { entities: updatedEntities };
    });
  },

  removeTagFromEntity: (id, tagToRemove) => {
    set((state) => {
      const targetEntity = state.entities[id];
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

      return { entities: updatedEntities };
    });
  },

  updateStateProperties: (entityId, stateId, partial) => {
    set((state) => {
      const targetEntity = state.entities[entityId];
      if (!targetEntity) return state;
      const targetType = targetEntity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType && e.states[stateId]) {
          const updatedState = { ...e.states[stateId], ...partial };
          const isCurrentState = e.currentStateId === stateId;
          const newVectorPaths = partial.vectorPaths !== undefined ? partial.vectorPaths : e.vectorPaths;

          updatedEntities[e.id] = {
            ...e,
            vectorPaths: isCurrentState ? newVectorPaths : e.vectorPaths,
            states: {
              ...e.states,
              [stateId]: updatedState,
            },
          };
        }
      });

      return { entities: updatedEntities };
    });
  },

  addStateToEntity: (entityId, name) => {
    set((state) => {
      const targetEntity = state.entities[entityId];
      if (!targetEntity) return state;
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

      return { entities: updatedEntities };
    });
  },

  removeStateFromEntity: (entityId, stateId) => {
    set((state) => {
      const targetEntity = state.entities[entityId];
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

      return { entities: updatedEntities };
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
    const entities = get().entities;
    const count = Object.keys(entities).length + 1;
    const id = `custom-${Date.now().toString(36)}`;
    const entityType = type || name.toLowerCase().trim().replace(/\s+/g, '_') || 'custom';
    const mainColor = color || '#8b5cf6';

    const newEntity: Entity = {
      id,
      name: name || `Entité #${count}`,
      type: entityType,
      icon: icon || '🎨',
      drawingDataUrl,
      vectorPaths,
      tags: tags && tags.length > 0 ? tags : [entityType, 'custom'],
      position: { x: 200 + ((count * 30) % 200), y: 150 + ((count * 25) % 150) },
      size: { width: 80, height: 80 },
      currentStateId: 'state_a',
      isDraggable: true,
      states: {
        state_a: {
          id: 'state_a',
          name: 'A',
          color: mainColor,
          scale: 1,
          rotation: 0,
          vectorPaths: vectorPaths ? JSON.parse(JSON.stringify(vectorPaths)) : [],
        },
        state_b: {
          id: 'state_b',
          name: 'B',
          color: mainColor,
          scale: 1,
          rotation: 0,
          vectorPaths: [],
        },
      },
    };

    set((state) => ({
      entities: {
        ...state.entities,
        [id]: newEntity,
      },
      selectedEntityId: id,
    }));
  },

  spawnEntity: ({ type, position, initialStateId }) => {
    const currentEntities = Object.values(get().entities);
    const existingPeer = currentEntities.find((e) => e.type === type);

    const count = currentEntities.length + 1;
    const id = `${type}-${Date.now().toString(36)}`;

    let newEntity: Entity;

    if (existingPeer) {
      const clonedStates = JSON.parse(JSON.stringify(existingPeer.states));
      const targetState = initialStateId && clonedStates[initialStateId] ? initialStateId : existingPeer.currentStateId;
      newEntity = {
        ...JSON.parse(JSON.stringify(existingPeer)),
        id,
        name: `${existingPeer.name.replace(/#\d+/, '').trim()} #${count}`,
        position,
        currentStateId: targetState,
      };
    } else if (type === 'apple') {
      newEntity = {
        id,
        name: `Pomme #${count}`,
        type: 'apple',
        tags: ['nourriture', 'fruit'],
        position,
        size: { width: 64, height: 64 },
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
        size: { width: 120, height: 160 },
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
        size: { width: 80, height: 80 },
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
    }));
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
    });
  },

  restoreDefaultScene: () => {
    set({
      entities: JSON.parse(JSON.stringify(initialEntities)),
      snapshotEntities: null,
      selectedEntityId: 'plant-1',
      activeCollisions: {},
    });
    get().evaluateRules();
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
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[entityId];
    if (!subject) return;

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
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[subjectId];
    if (!subject) return;

    // Trouver les règles de collision avec phase 'release'
    const releaseRules = rules.filter(
      (r) => r.enabled && r.trigger.type === 'collision' && r.trigger.phase === 'release'
    );

    const allEntitiesList = Object.values(entities);

    releaseRules.forEach((rule) => {
      // Le sujet correspond-il à la règle ?
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

      // État du sujet
      if (
        rule.trigger.subjectStateId &&
        rule.trigger.subjectStateId !== '' &&
        subject.currentStateId !== rule.trigger.subjectStateId
      ) {
        return;
      }

      // Trouver toutes les cibles potentielles en collision au moment du release
      const candidateTargets = allEntitiesList.filter(
        (target) =>
          target.id !== subject.id &&
          matchesEntityFilter(
            target,
            rule.trigger.targetMode,
            rule.trigger.targetId,
            rule.trigger.targetType,
            rule.trigger.targetTag
          )
      );

      candidateTargets.forEach((target) => {
        // État de la cible
        if (
          rule.trigger.targetStateId &&
          rule.trigger.targetStateId !== '' &&
          target.currentStateId !== rule.trigger.targetStateId
        ) {
          return;
        }

        // Vérifier si collision au moment précis du release
        if (checkCollision(subject, target)) {
          rule.actions.forEach((act) => {
            executeAction(act, {
              subject,
              target,
              allEntities: entities,
              updateEntityState,
              updateEntityDetails,
              deleteEntity,
              spawnEntity,
            });
          });
        }
      });
    });
  },

  evaluateRules: () => {
    get().evaluateRulesWithTemp();
  },

  evaluateRulesWithTemp: (tempPositions) => {
    const { entities, rules, activeCollisions, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();

    const collisionRules = rules.filter((r) => r.enabled && r.trigger.type === 'collision');
    const nextCollisions: Record<string, boolean> = { ...activeCollisions };
    const allEntitiesList = Object.values(entities);

    collisionRules.forEach((rule) => {
      // Trouver tous les sujets potentiels
      const candidateSubjects = allEntitiesList.filter((e) =>
        matchesEntityFilter(
          e,
          rule.trigger.subjectMode,
          rule.trigger.subjectId,
          rule.trigger.subjectType,
          rule.trigger.subjectTag
        )
      );

      // Trouver toutes les cibles potentielles
      const candidateTargets = allEntitiesList.filter((e) =>
        matchesEntityFilter(
          e,
          rule.trigger.targetMode,
          rule.trigger.targetId,
          rule.trigger.targetType,
          rule.trigger.targetTag
        )
      );

      candidateSubjects.forEach((subject) => {
        candidateTargets.forEach((target) => {
          if (subject.id === target.id) return; // Ne se résout pas sur lui-même

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

          let subPos = subject.position;
          if (tempPositions && tempPositions[subject.id]) {
            subPos = tempPositions[subject.id];
          }

          let tarPos = target.position;
          if (tempPositions && tempPositions[target.id]) {
            tarPos = tempPositions[target.id];
          }

          const tempSubject = { ...subject, position: subPos };
          const tempTarget = { ...target, position: tarPos };

          const isColliding = checkCollision(tempSubject, tempTarget);
          const wasColliding = !!activeCollisions[collisionKey];

          const rulePhase = rule.trigger.phase || 'enter';
          let shouldExecute = false;

          if (isColliding && !wasColliding) {
            // Premier contact
            if (rulePhase === 'enter' || rulePhase === 'stay') {
              shouldExecute = true;
            }
            nextCollisions[collisionKey] = true;
          } else if (isColliding && wasColliding) {
            // Contact continu
            if (rulePhase === 'stay') {
              shouldExecute = true;
            }
            nextCollisions[collisionKey] = true;
          } else if (!isColliding && wasColliding) {
            // Séparation / Relâchement physique (Release)
            if (rulePhase === 'release') {
              shouldExecute = true;
            }
            nextCollisions[collisionKey] = false;
          }

          if (shouldExecute) {
            rule.actions.forEach((act) => {
              executeAction(act, {
                subject,
                target,
                allEntities: entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
              });
            });
          }
        });
      });
    });

    set({ activeCollisions: nextCollisions });
  },
}));

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
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId }) => void;
  }
) {
  if (act.type === 'play_sound') {
    soundSynth.play(act.soundType || 'pop');
    return;
  }

  if (act.type === 'spawn_entity') {
    const spawnType = act.spawnEntityType || 'apple';
    const basePos = helpers.subject?.position || helpers.target?.position || { x: 250, y: 200 };
    const spawnX = basePos.x + Math.floor(Math.random() * 50 - 25);
    const spawnY = basePos.y + Math.floor(Math.random() * 50 - 25);

    helpers.spawnEntity({
      type: spawnType,
      position: { x: Math.max(20, spawnX), y: Math.max(20, spawnY) },
      initialStateId: act.spawnInitialStateId,
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
      if (entity.currentStateId !== act.targetStateId && entity.states[act.targetStateId]) {
        helpers.updateEntityState(entity.id, act.targetStateId);
      }
    } else if (act.type === 'toggle_draggable') {
      helpers.updateEntityDetails(entity.id, { isDraggable: !entity.isDraggable });
    } else if (act.type === 'delete_entity') {
      helpers.deleteEntity(entity.id);
    }
  });
}
