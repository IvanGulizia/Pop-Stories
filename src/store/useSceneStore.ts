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
  RuleFolder,
  CustomSound,
  ProjectSlot,
  SceneAspectRatio,
  SceneLayer,
  SceneLayerGroup,
  SceneLayerKind,
} from '../types';
import { soundSynth } from '../utils/sound';
import { getEntityColliderBounds } from '../utils/collider';
import defaultCursorPack from '../data/defaultCursorPack.json';

// Groupes de calques initiaux de la scène
export const initialSceneLayerGroups: SceneLayerGroup[] = [
  {
    id: 'group-bg',
    name: 'Arrière-plan (Background)',
    kind: 'background',
    isCollapsed: false,
    layers: [
      {
        id: 'layer-bg-1',
        name: 'Fond décoratif #1',
        visible: true,
        opacity: 1,
        parallaxFactor: 0,
        vectorPaths: [],
      },
    ],
  },
  {
    id: 'group-fg',
    name: 'Premier-plan (Foreground)',
    kind: 'foreground',
    isCollapsed: false,
    layers: [],
  },
];

// Clé de stockage des slots de projets locaux
const SLOTS_STORAGE_KEY = 'atelier-vivant-project-slots-v1';

interface SceneState {
  entities: Record<EntityId, Entity>;
  customArchetypes: Record<string, Entity>;
  rules: DynamicRule[];
  folders: RuleFolder[];
  customSounds: CustomSound[];
  layerGroups: SceneLayerGroup[];
  activeCollisions: Record<string, boolean>; // Trace l'état de collision pour chaque pair (ruleId_subId_tarId)
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
  appMode: AppMode;
  entityOrder: EntityId[];
  snapshotEntities: Record<EntityId, Entity> | null;
  snapshotEntityOrder: EntityId[] | null;
  settings: AppSettings;
  currentSlotId: string | null;
  collapsedRuleIds: Record<string, boolean>;
  toggleRuleCollapse: (ruleId: string) => void;
  gameScore: number;
  triggerKeyEvent: (keyName: string) => void;

  // Direct scene canvas drawing tools state
  drawingTool: 'pencil' | 'line' | 'rectangle' | 'circle' | 'bucket' | 'eraser_stroke' | 'eraser_partial' | 'select';
  drawingStrokeColor: string;
  drawingFillColor: string;
  drawingStrokeWidth: number;
  setDrawingTool: (tool: 'pencil' | 'line' | 'rectangle' | 'circle' | 'bucket' | 'eraser_stroke' | 'eraser_partial' | 'select') => void;
  setDrawingStrokeColor: (color: string) => void;
  setDrawingFillColor: (color: string) => void;
  setDrawingStrokeWidth: (width: number) => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  setAspectRatio: (ratio: SceneAspectRatio) => void;

  // Scene Layers & Groups management
  addLayerGroup: (name: string, kind?: SceneLayerKind) => string;
  deleteLayerGroup: (groupId: string) => void;
  toggleLayerGroupCollapse: (groupId: string) => void;
  addLayerToGroup: (groupId: string, name?: string) => string;
  deleteLayer: (layerId: string) => void;
  updateLayer: (layerId: string, partial: Partial<SceneLayer>) => void;
  setLayerVectorPaths: (layerId: string, vectorPaths: VectorPath[]) => void;
  selectLayer: (layerId: string | null) => void;

  // Z-Index and Layer Ordering
  bringForward: (id: EntityId) => void;
  sendBackward: (id: EntityId) => void;
  bringToFront: (id: EntityId) => void;
  sendToBack: (id: EntityId) => void;
  duplicateEntity: (id: EntityId) => string;
  reorderEntities: (sourceId: EntityId, targetId: EntityId) => void;

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

  // Project Slots (Sauvegardes locales dans le navigateur)
  getProjectSlots: () => ProjectSlot[];
  saveProjectToSlot: (name: string, slotId?: string) => { success: boolean; slotId: string; message: string };
  loadProjectFromSlot: (slotId: string) => { success: boolean; message: string };
  deleteProjectSlot: (slotId: string) => { success: boolean; message: string };
  duplicateProjectSlot: (slotId: string) => { success: boolean; newSlotId: string; message: string };
  renameProjectSlot: (slotId: string, newName: string) => { success: boolean; message: string };

  // Rules & Folders management
  addRule: (rule: Omit<DynamicRule, 'id'>) => string;
  updateRule: (id: string, partial: Partial<DynamicRule>) => void;
  duplicateRule: (id: string) => string;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  reorderRules: (sourceId: string, targetId: string) => void;
  setRuleFolder: (ruleId: string, folderId?: string) => void;

  // Folder CRUD
  addFolder: (name: string, color?: string) => string;
  updateFolder: (id: string, partial: Partial<RuleFolder>) => void;
  deleteFolder: (id: string) => void;
  toggleFolderCollapse: (id: string) => void;

  // Custom Audio management
  addCustomSound: (sound: Omit<CustomSound, 'id' | 'createdAt'>) => string;
  deleteCustomSound: (id: string) => void;
  updateCustomSoundName: (id: string, name: string) => void;

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
    size: { width: 256, height: 256 },
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
    size: { width: 256, height: 256 },
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
    size: { width: 256, height: 256 },
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
    size: { width: 256, height: 256 },
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

const initialFolders: RuleFolder[] = [
  { id: 'folder-interactions', name: 'Interactions & Contacts', color: 'indigo', isCollapsed: false },
  { id: 'folder-clicks', name: 'Contrôles & Clics', color: 'amber', isCollapsed: false },
  { id: 'folder-effects', name: 'Effets & Sons', color: 'emerald', isCollapsed: false },
];

const initialRules: DynamicRule[] = [
  {
    id: 'rule-plant-bloom',
    name: 'Floraison de toutes les plantes au contact de la nourriture',
    enabled: true,
    folderId: 'folder-interactions',
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

// Vérification de la collision avec support précis des Colliders (Boîte / Cercle / Polygone)
const checkCollision = (ent1: Entity, ent2: Entity) => {
  const currentState1 = ent1.states[ent1.currentStateId];
  const currentState2 = ent2.states[ent2.currentStateId];

  const s1 = currentState1?.scale ?? 1;
  const s2 = currentState2?.scale ?? 1;

  // Calcul des géométries de colliders verts réelles (en espace de coordonnées canevas 200x200)
  const geom1 = getEntityColliderBounds(ent1, currentState1);
  const geom2 = getEntityColliderBounds(ent2, currentState2);

  const scaleX1 = (ent1.size.width * s1) / 200;
  const scaleY1 = (ent1.size.height * s1) / 200;
  const scaleX2 = (ent2.size.width * s2) / 200;
  const scaleY2 = (ent2.size.height * s2) / 200;

  const collider1 = geom1.colliderType;
  const collider2 = geom2.colliderType;

  // Cercle vs Cercle
  if (collider1 === 'circle' && collider2 === 'circle') {
    const cx1 = ent1.position.x + geom1.centerX * scaleX1;
    const cy1 = ent1.position.y + geom1.centerY * scaleY1;
    const r1 = geom1.radius * Math.max(scaleX1, scaleY1);

    const cx2 = ent2.position.x + geom2.centerX * scaleX2;
    const cy2 = ent2.position.y + geom2.centerY * scaleY2;
    const r2 = geom2.radius * Math.max(scaleX2, scaleY2);

    const dx = cx1 - cx2;
    const dy = cy1 - cy2;
    return dx * dx + dy * dy <= (r1 + r2) * (r1 + r2);
  }

  // Cercle vs Boîte / Polygone
  if (collider1 === 'circle' && (collider2 === 'box' || collider2 === 'polygon')) {
    const cx1 = ent1.position.x + geom1.centerX * scaleX1;
    const cy1 = ent1.position.y + geom1.centerY * scaleY1;
    const r1 = geom1.radius * Math.max(scaleX1, scaleY1);

    const bx2 = ent2.position.x + geom2.x * scaleX2;
    const by2 = ent2.position.y + geom2.y * scaleY2;
    const bw2 = geom2.width * scaleX2;
    const bh2 = geom2.height * scaleY2;

    const closestX = Math.max(bx2, Math.min(cx1, bx2 + bw2));
    const closestY = Math.max(by2, Math.min(cy1, by2 + bh2));
    const dx = cx1 - closestX;
    const dy = cy1 - closestY;
    return dx * dx + dy * dy <= r1 * r1;
  }

  if ((collider1 === 'box' || collider1 === 'polygon') && collider2 === 'circle') {
    const cx2 = ent2.position.x + geom2.centerX * scaleX2;
    const cy2 = ent2.position.y + geom2.centerY * scaleY2;
    const r2 = geom2.radius * Math.max(scaleX2, scaleY2);

    const bx1 = ent1.position.x + geom1.x * scaleX1;
    const by1 = ent1.position.y + geom1.y * scaleY1;
    const bw1 = geom1.width * scaleX1;
    const bh1 = geom1.height * scaleY1;

    const closestX = Math.max(bx1, Math.min(cx2, bx1 + bw1));
    const closestY = Math.max(by1, Math.min(cy2, by1 + bh1));
    const dx = cx2 - closestX;
    const dy = cy2 - closestY;
    return dx * dx + dy * dy <= r2 * r2;
  }

  // Boîte AABB vs Boîte AABB
  const bx1 = ent1.position.x + geom1.x * scaleX1;
  const by1 = ent1.position.y + geom1.y * scaleY1;
  const bw1 = geom1.width * scaleX1;
  const bh1 = geom1.height * scaleY1;

  const bx2 = ent2.position.x + geom2.x * scaleX2;
  const by2 = ent2.position.y + geom2.y * scaleY2;
  const bw2 = geom2.width * scaleX2;
  const bh2 = geom2.height * scaleY2;

  return (
    bx1 < bx2 + bw2 &&
    bx1 + bw1 > bx2 &&
    by1 < by2 + bh2 &&
    by1 + bh1 > by2
  );
};

export const useSceneStore = create<SceneState>()((set, get) => ({
  entities: {},
  customArchetypes: {},
  rules: [],
  folders: initialFolders,
  customSounds: [],
  activeCollisions: {},
  selectedEntityId: null,
  appMode: 'edit',
  entityOrder: ['plant-1', 'apple-1'],
  layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
  selectedLayerId: null,
  snapshotEntities: null,
  snapshotEntityOrder: null,
  currentSlotId: null,
  collapsedRuleIds: {},
  gameScore: 0,
  toggleRuleCollapse: (ruleId) => {
    set((state) => ({
      collapsedRuleIds: {
        ...state.collapsedRuleIds,
        [ruleId]: !state.collapsedRuleIds?.[ruleId],
      },
    }));
  },

  drawingTool: 'pencil',
  drawingStrokeColor: '#6366f1',
  drawingFillColor: 'none',
  drawingStrokeWidth: 6,
  setDrawingTool: (tool) => set({ drawingTool: tool }),
  setDrawingStrokeColor: (color) => set({ drawingStrokeColor: color }),
  setDrawingFillColor: (color) => set({ drawingFillColor: color }),
  setDrawingStrokeWidth: (width) => set({ drawingStrokeWidth: width }),

  settings: {
    showCanvasLabels: false,
    showGrid: false,
    gridStyle: 'dots',
    showTagsSystem: false,
    showRuleFilters: false,
    useCustomCursors: true,
    cursorShadow: false,
    cursorSourceMode: 'custom_drawn',
    customCursorVectorPaths: (defaultCursorPack as any).customCursorVectorPaths,
    customCursorPaths: (defaultCursorPack as any).customCursorPaths,
    enableHoverScaleAnimation: false,
    playModeOverlay: true,
    playModeDimOpacity: 'light',
    showRuleFolders: false,
    entityFilterDisplayMode: 'icon_and_text',
  },

  updateSettings: (partial) => {
    set((state) => ({
      settings: { ...state.settings, ...partial },
    }));
  },

  setAspectRatio: (ratio) => {
    set((state) => ({
      settings: { ...state.settings, aspectRatio: ratio },
    }));
  },

  // --- Gestion des Calques & Groupes de Scène (Background / Foreground) ---
  addLayerGroup: (name, kind = 'custom') => {
    const id = `group-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const newGroup: SceneLayerGroup = {
      id,
      name: name.trim() || 'Nouveau Groupe',
      kind,
      isCollapsed: false,
      layers: [],
    };
    set((state) => ({
      layerGroups: [...state.layerGroups, newGroup],
    }));
    return id;
  },

  deleteLayerGroup: (groupId) => {
    set((state) => {
      const remaining = state.layerGroups.filter((g) => g.id !== groupId);
      const deletedLayerIds = new Set(
        state.layerGroups.find((g) => g.id === groupId)?.layers.map((l) => l.id) || []
      );
      return {
        layerGroups: remaining,
        selectedLayerId: state.selectedLayerId && deletedLayerIds.has(state.selectedLayerId) ? null : state.selectedLayerId,
      };
    });
  },

  toggleLayerGroupCollapse: (groupId) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((g) =>
        g.id === groupId ? { ...g, isCollapsed: !g.isCollapsed } : g
      ),
    }));
  },

  addLayerToGroup: (groupId, name) => {
    const layerId = `layer-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    set((state) => {
      const targetGroup = state.layerGroups.find((g) => g.id === groupId);
      const count = (targetGroup?.layers.length || 0) + 1;
      const newLayer: SceneLayer = {
        id: layerId,
        name: name?.trim() || `Calque #${count}`,
        visible: true,
        opacity: 1,
        parallaxFactor: targetGroup?.kind === 'background' ? 0 : 1,
        vectorPaths: [],
      };
      return {
        layerGroups: state.layerGroups.map((g) =>
          g.id === groupId ? { ...g, layers: [...g.layers, newLayer] } : g
        ),
        selectedLayerId: layerId,
        selectedEntityId: null, // Dé-sélectionner l'entité lors de la sélection d'un calque
      };
    });
    return layerId;
  },

  deleteLayer: (layerId) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((g) => ({
        ...g,
        layers: g.layers.filter((l) => l.id !== layerId),
      })),
      selectedLayerId: state.selectedLayerId === layerId ? null : state.selectedLayerId,
    }));
  },

  updateLayer: (layerId, partial) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((g) => ({
        ...g,
        layers: g.layers.map((l) => (l.id === layerId ? { ...l, ...partial } : l)),
      })),
    }));
  },

  setLayerVectorPaths: (layerId, vectorPaths) => {
    set((state) => ({
      layerGroups: state.layerGroups.map((g) => ({
        ...g,
        layers: g.layers.map((l) => (l.id === layerId ? { ...l, vectorPaths } : l)),
      })),
    }));
  },

  selectLayer: (layerId) => {
    set({
      selectedLayerId: layerId,
      selectedEntityId: layerId ? null : get().selectedEntityId,
    });
  },

  bringForward: (id) => {
    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      const idx = order.indexOf(id);
      if (idx === -1 || idx >= order.length - 1) return state;
      const temp = order[idx];
      order[idx] = order[idx + 1];
      order[idx + 1] = temp;
      return { entityOrder: order };
    });
  },

  sendBackward: (id) => {
    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      const idx = order.indexOf(id);
      if (idx <= 0) return state;
      const temp = order[idx];
      order[idx] = order[idx - 1];
      order[idx - 1] = temp;
      return { entityOrder: order };
    });
  },

  bringToFront: (id) => {
    set((state) => {
      const order = (state.entityOrder && state.entityOrder.length > 0
        ? state.entityOrder
        : Object.keys(state.entities)
      ).filter((item) => item !== id);
      order.push(id);
      return { entityOrder: order };
    });
  },

  sendToBack: (id) => {
    set((state) => {
      const order = (state.entityOrder && state.entityOrder.length > 0
        ? state.entityOrder
        : Object.keys(state.entities)
      ).filter((item) => item !== id);
      order.unshift(id);
      return { entityOrder: order };
    });
  },

  duplicateEntity: (id) => {
    const current = get().entities[id];
    if (!current) return '';
    const newId = `${current.type}-${Date.now().toString(36)}`;
    const cloned: Entity = {
      ...JSON.parse(JSON.stringify(current)),
      id: newId,
      name: `${current.name.replace(/\(Copie.*?\)/g, '').trim()} (Copie)`,
      position: {
        x: Math.min(800, current.position.x + 32),
        y: Math.min(600, current.position.y + 32),
      },
    };
    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      return {
        entities: {
          ...state.entities,
          [newId]: cloned,
        },
        entityOrder: [...order.filter((i) => i !== newId), newId],
        selectedEntityId: newId,
      };
    });
    get().evaluateRules();
    return newId;
  },

  reorderEntities: (sourceId, targetId) => {
    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      const fromIdx = order.indexOf(sourceId);
      const toIdx = order.indexOf(targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;
      order.splice(fromIdx, 1);
      order.splice(toIdx, 0, sourceId);
      return { entityOrder: order };
    });
  },

  setAppMode: (mode) => {
    if (mode === 'play') {
      // Sauvegarder un instantané propre pour la restauration fidèle
      const snapshot = JSON.parse(JSON.stringify(get().entities));
      const orderSnapshot = [...(get().entityOrder || Object.keys(get().entities))];
      set({
        appMode: 'play',
        snapshotEntities: snapshot,
        snapshotEntityOrder: orderSnapshot,
      });
    } else {
      // Quand on repasse en mode édition, restaurer fidèlement la scène d'avant-jeu
      const { snapshotEntities, snapshotEntityOrder } = get();
      if (snapshotEntities) {
        set({
          entities: JSON.parse(JSON.stringify(snapshotEntities)),
          entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
          activeCollisions: {},
          appMode: 'edit',
        });
      } else {
        set({ appMode: 'edit', activeCollisions: {} });
      }
    }
  },

  resetScene: () => {
    const { snapshotEntities, snapshotEntityOrder, entities } = get();
    if (snapshotEntities) {
      set({
        entities: JSON.parse(JSON.stringify(snapshotEntities)),
        entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
        activeCollisions: {},
      });
    } else {
      // Ne jamais vider la scène si aucun instantané n'a été créé
      set({
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
        size: { width: 256, height: 256 },
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
        size: { width: 256, height: 256 },
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
        size: { width: 256, height: 256 },
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

    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      return {
        entities: {
          ...state.entities,
          [id]: newEntity,
        },
        entityOrder: [...order.filter((i) => i !== id), id],
        selectedEntityId: id,
      };
    });
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
      size: { width: 256, height: 256 },
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

    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      return {
        entities: {
          ...state.entities,
          [id]: newEntity,
        },
        customArchetypes: {
          ...state.customArchetypes,
          [uniqueType]: JSON.parse(JSON.stringify(newEntity)),
        },
        entityOrder: [...order.filter((i) => i !== id), id],
        selectedEntityId: id,
      };
    });
    get().evaluateRules();
  },

  deleteCustomArchetype: (type: string) => {
    set((state) => {
      const { [type]: _, ...remainingArchetypes } = state.customArchetypes;
      
      // Suppression en cascade : supprimer l'entité supprime le catalogue ET toutes ses instances sur scène
      const remainingEntities: Record<EntityId, Entity> = {};
      const deletedIds = new Set<string>();

      Object.entries(state.entities).forEach(([id, entity]) => {
        if (entity.type === type) {
          deletedIds.add(id);
        } else {
          remainingEntities[id] = entity;
        }
      });

      const updatedOrder = (state.entityOrder || []).filter((id) => !deletedIds.has(id));

      let nextSelected = state.selectedEntityId;
      if (nextSelected && (nextSelected === type || deletedIds.has(nextSelected))) {
        nextSelected = updatedOrder.length > 0 ? updatedOrder[updatedOrder.length - 1] : null;
      }

      // Nettoyer les règles faisant référence au type supprimé ou aux instances supprimées
      const cleanedRules = state.rules.filter((rule) => {
        if (rule.trigger.subjectType === type || rule.trigger.targetType === type) return false;
        if (rule.trigger.subjectId && deletedIds.has(rule.trigger.subjectId)) return false;
        if (rule.trigger.targetId && deletedIds.has(rule.trigger.targetId)) return false;
        return true;
      });

      return {
        customArchetypes: remainingArchetypes,
        entities: remainingEntities,
        entityOrder: updatedOrder,
        selectedEntityId: nextSelected,
        rules: cleanedRules,
      };
    });
    get().evaluateRules();
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
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : (archetype.size || { width: 256, height: 256 }),
      };
    } else if (type === 'apple') {
      newEntity = {
        id,
        name: `Pomme #${count}`,
        type: 'apple',
        tags: ['nourriture', 'fruit'],
        position,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 256, height: 256 },
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
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 256, height: 256 },
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
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : { width: 256, height: 256 },
        currentStateId: initialStateId || 'default',
        isDraggable: true,
        states: {
          'default': { id: 'default', name: 'Normal', color: '#8b5cf6', scale: 1, rotation: 0 },
          'actif': { id: 'actif', name: 'Actif', color: '#f59e0b', scale: 1.25, rotation: 15 },
        },
      };
    }

    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      return {
        entities: {
          ...state.entities,
          [id]: newEntity,
        },
        entityOrder: [...order.filter((i) => i !== id), id],
        selectedEntityId: state.appMode === 'play' ? state.selectedEntityId : id,
      };
    });
    get().evaluateRules();
  },

  deleteEntity: (id) => {
    set((state) => {
      const { [id]: _, ...remainingEntities } = state.entities;
      const updatedOrder = (state.entityOrder || []).filter((item) => item !== id);
      const nextSelected =
        state.selectedEntityId === id ? (updatedOrder[updatedOrder.length - 1] || null) : state.selectedEntityId;

      const cleanedRules = state.rules.filter((rule) => {
        if (rule.trigger.subjectId === id || rule.trigger.targetId === id) return false;
        return true;
      });

      return {
        entities: remainingEntities,
        entityOrder: updatedOrder,
        selectedEntityId: nextSelected,
        rules: cleanedRules,
      };
    });
  },

  clearAllEntities: () => {
    set({
      entities: {},
      entityOrder: [],
      selectedEntityId: null,
    });
  },

  clearProject: () => {
    set({
      entities: {},
      entityOrder: [],
      rules: [],
      folders: initialFolders,
      customSounds: [],
      layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
      selectedEntityId: null,
      selectedLayerId: 'layer-bg-1',
      activeCollisions: {},
      snapshotEntities: null,
      snapshotEntityOrder: null,
    });
  },

  restoreDefaultScene: () => {
    set({
      entities: JSON.parse(JSON.stringify(initialEntities)),
      entityOrder: ['plant-1', 'apple-1'],
      customArchetypes: JSON.parse(JSON.stringify(defaultCustomArchetypes)),
      rules: JSON.parse(JSON.stringify(initialRules)),
      folders: JSON.parse(JSON.stringify(initialFolders)),
      customSounds: [],
      layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
      snapshotEntities: null,
      snapshotEntityOrder: null,
      selectedEntityId: 'plant-1',
      selectedLayerId: null,
      activeCollisions: {},
      appMode: 'edit',
    });
    get().evaluateRules();
  },

  exportProject: () => {
    const { entities, customArchetypes, rules, folders, customSounds, layerGroups, settings } = get();
    return {
      version: 1,
      name: 'Projet Atelier Vivant',
      exportedAt: new Date().toISOString(),
      entities,
      customArchetypes,
      rules,
      folders,
      customSounds,
      layerGroups,
      settings,
    };
  },

  importProject: (data: any) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Format de fichier JSON invalide.' };
      }
      if (!data.entities && !data.rules && !data.layerGroups) {
        return { success: false, message: 'Le fichier ne contient pas de données de projet valides.' };
      }

      const importedEntities = data.entities && typeof data.entities === 'object' ? data.entities : {};
      // Respect exact project archetypes : do not inject the 3 default items (plant, apple, custom) if not present
      let importedArchetypes: Record<string, Entity> = {};
      if (data.customArchetypes && typeof data.customArchetypes === 'object') {
        importedArchetypes = { ...data.customArchetypes };
      } else {
        // Deduce archetypes strictly from the imported entities
        Object.values(importedEntities).forEach((ent: any) => {
          if (ent && ent.type && !importedArchetypes[ent.type]) {
            importedArchetypes[ent.type] = {
              ...ent,
              position: { x: 0, y: 0 },
            };
          }
        });
      }
      const importedRules = Array.isArray(data.rules) ? data.rules : [];
      const importedFolders = Array.isArray(data.folders) ? data.folders : initialFolders;
      const importedCustomSounds = Array.isArray(data.customSounds) ? data.customSounds : [];
      const importedLayerGroups = Array.isArray(data.layerGroups) && data.layerGroups.length > 0
        ? data.layerGroups
        : JSON.parse(JSON.stringify(initialSceneLayerGroups));
      const importedSettings = data.settings && typeof data.settings === 'object' ? data.settings : undefined;

      set((state) => ({
        entities: importedEntities,
        customArchetypes: importedArchetypes,
        rules: importedRules,
        folders: importedFolders,
        customSounds: importedCustomSounds,
        layerGroups: importedLayerGroups,
        settings: importedSettings ? { ...state.settings, ...importedSettings } : state.settings,
        selectedEntityId: Object.keys(importedEntities)[0] || null,
        selectedLayerId: null,
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

  // --- Gestion des Slots de Sauvegarde Locale ---
  getProjectSlots: () => {
    if (typeof window === 'undefined' || !window.localStorage) return [];
    try {
      const raw = window.localStorage.getItem(SLOTS_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      }
      return [];
    } catch (e) {
      console.error('Failed to read project slots from localStorage:', e);
      return [];
    }
  },

  saveProjectToSlot: (name: string, targetSlotId?: string) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, slotId: '', message: 'Stockage local non disponible dans cet environnement.' };
    }
    try {
      const slots = get().getProjectSlots();
      const currentData = get().exportProject();
      const slotId = targetSlotId || `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = name.trim() || `Projet ${new Date().toLocaleDateString('fr-FR')}`;

      const existingIndex = slots.findIndex((s) => s.id === slotId);
      const newSlot: ProjectSlot = {
        id: slotId,
        name: cleanName,
        updatedAt: Date.now(),
        entitiesCount: Object.keys(currentData.entities || {}).length,
        rulesCount: (currentData.rules || []).length,
        aspectRatio: currentData.settings?.aspectRatio || 'free',
        data: currentData,
      };

      let updatedSlots: ProjectSlot[];
      if (existingIndex >= 0) {
        updatedSlots = [...slots];
        updatedSlots[existingIndex] = newSlot;
      } else {
        updatedSlots = [newSlot, ...slots];
      }

      window.localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(updatedSlots));
      set({ currentSlotId: slotId });
      return { success: true, slotId, message: `Projet "${cleanName}" sauvegardé avec succès !` };
    } catch (err: any) {
      console.error('Save to slot error:', err);
      return { success: false, slotId: '', message: err?.message || 'Erreur lors de la sauvegarde du slot.' };
    }
  },

  loadProjectFromSlot: (slotId: string) => {
    try {
      const slots = get().getProjectSlots();
      const slot = slots.find((s) => s.id === slotId);
      if (!slot || !slot.data) {
        return { success: false, message: 'Slot introuvable ou vide.' };
      }
      const res = get().importProject(slot.data);
      if (res.success) {
        set({ currentSlotId: slotId });
        return { success: true, message: `Projet "${slot.name}" chargé avec succès !` };
      }
      return { success: false, message: res.message || 'Impossible de charger ce projet.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur lors du chargement du slot.' };
    }
  },

  deleteProjectSlot: (slotId: string) => {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { success: false, message: 'Stockage local non disponible.' };
    }
    try {
      const slots = get().getProjectSlots();
      const filtered = slots.filter((s) => s.id !== slotId);
      window.localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(filtered));
      if (get().currentSlotId === slotId) {
        set({ currentSlotId: null });
      }
      return { success: true, message: 'Slot supprimé avec succès.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur lors de la suppression.' };
    }
  },

  duplicateProjectSlot: (slotId: string) => {
    try {
      const slots = get().getProjectSlots();
      const source = slots.find((s) => s.id === slotId);
      if (!source) return { success: false, newSlotId: '', message: 'Slot source introuvable.' };

      const newId = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newSlot: ProjectSlot = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        name: `${source.name} (Copie)`,
        updatedAt: Date.now(),
      };

      const updated = [newSlot, ...slots];
      window.localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(updated));
      return { success: true, newSlotId: newId, message: `Copie de "${source.name}" créée !` };
    } catch (err: any) {
      return { success: false, newSlotId: '', message: err?.message || 'Erreur lors de la duplication.' };
    }
  },

  renameProjectSlot: (slotId: string, newName: string) => {
    try {
      const slots = get().getProjectSlots();
      const target = slots.find((s) => s.id === slotId);
      if (!target) return { success: false, message: 'Slot introuvable.' };

      const clean = newName.trim();
      if (!clean) return { success: false, message: 'Le nom ne peut pas être vide.' };

      target.name = clean;
      target.updatedAt = Date.now();
      window.localStorage.setItem(SLOTS_STORAGE_KEY, JSON.stringify(slots));
      return { success: true, message: 'Nom du slot modifié avec succès.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur lors du renommage.' };
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

  reorderRules: (sourceId, targetId) => {
    set((state) => {
      const rules = [...state.rules];
      const fromIdx = rules.findIndex((r) => r.id === sourceId);
      const toIdx = rules.findIndex((r) => r.id === targetId);
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return state;
      const [moved] = rules.splice(fromIdx, 1);
      rules.splice(toIdx, 0, moved);
      return { rules };
    });
    get().evaluateRules();
  },

  setRuleFolder: (ruleId, folderId) => {
    set((state) => ({
      rules: state.rules.map((r) => (r.id === ruleId ? { ...r, folderId } : r)),
    }));
  },

  // Dossiers thématiques
  addFolder: (name, color = 'indigo') => {
    const id = `folder-${Date.now().toString(36)}`;
    const newFolder: RuleFolder = {
      id,
      name: name.trim() || 'Nouveau dossier',
      color,
      isCollapsed: false,
    };
    set((state) => ({
      folders: [...state.folders, newFolder],
    }));
    return id;
  },

  updateFolder: (id, partial) => {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, ...partial } : f)),
    }));
  },

  deleteFolder: (id) => {
    set((state) => ({
      folders: state.folders.filter((f) => f.id !== id),
      rules: state.rules.map((r) => (r.folderId === id ? { ...r, folderId: undefined } : r)),
    }));
  },

  toggleFolderCollapse: (id) => {
    set((state) => ({
      folders: state.folders.map((f) => (f.id === id ? { ...f, isCollapsed: !f.isCollapsed } : f)),
    }));
  },

  // Sons personnalisés (Micro & Upload)
  addCustomSound: (soundData) => {
    const id = `sound-${Date.now().toString(36)}`;
    const newSound: CustomSound = {
      ...soundData,
      id,
      createdAt: Date.now(),
    };
    set((state) => ({
      customSounds: [...state.customSounds, newSound],
    }));
    return id;
  },

  deleteCustomSound: (id) => {
    set((state) => ({
      customSounds: state.customSounds.filter((s) => s.id !== id),
    }));
  },

  updateCustomSoundName: (id, name) => {
    set((state) => ({
      customSounds: state.customSounds.map((s) => (s.id === id ? { ...s, name } : s)),
    }));
  },

  triggerKeyEvent: (keyName) => {
    if (get().appMode !== 'play') return;
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const now = Date.now();

    const kbRules = rules.filter((r) => r.enabled && r.trigger.type === 'keyboard');
    if (kbRules.length === 0) return;

    kbRules.forEach((rule) => {
      const targetKey = rule.trigger.keyName || 'Space';
      const isKeyMatch =
        targetKey === 'any' ||
        targetKey.toLowerCase() === keyName.toLowerCase() ||
        (targetKey === 'Space' && (keyName === ' ' || keyName === 'Space')) ||
        (targetKey === 'ArrowUp' && keyName === 'ArrowUp') ||
        (targetKey === 'ArrowDown' && keyName === 'ArrowDown') ||
        (targetKey === 'ArrowLeft' && keyName === 'ArrowLeft') ||
        (targetKey === 'ArrowRight' && keyName === 'ArrowRight');

      if (!isKeyMatch) return;

      const cooldownKey = `key_${rule.id}_${keyName}`;
      if (now - (ruleCooldowns[cooldownKey] || 0) < RULE_COOLDOWN_MS) return;
      ruleCooldowns[cooldownKey] = now;

      const allEnts = Object.values(entities);
      const subject = allEnts.find((e) =>
        matchesEntityFilter(e, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)
      ) || allEnts[0];

      executeRuleActions(rule.actions, {
        subject,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });
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

    const activePointerRules = rules.filter((r) => {
      if (!r.enabled) return false;
      if (r.trigger.type !== 'click' && r.trigger.type !== 'hover') return false;

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
      const rulePhase = r.trigger.phase || (r.trigger.type === 'hover' ? 'enter' : 'click');

      let phaseMatch = false;
      if (r.trigger.type === 'hover') {
        if (phase === 'enter' || phase === 'hover_enter') {
          phaseMatch = rulePhase === 'enter' || rulePhase === 'hover_enter';
        } else if (phase === 'exit' || phase === 'hover_exit') {
          phaseMatch = rulePhase === 'exit' || rulePhase === 'hover_exit';
        }
      } else if (r.trigger.type === 'click') {
        if (phase === 'click') {
          phaseMatch = rulePhase === 'click';
        } else if (phase === 'down' || phase === 'mouse_down') {
          phaseMatch = rulePhase === 'down' || rulePhase === 'mouse_down';
        } else if (phase === 'up' || phase === 'mouse_up') {
          phaseMatch = rulePhase === 'up' || rulePhase === 'mouse_up';
        }
      }

      if (!phaseMatch) return false;

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

    activePointerRules.forEach((rule) => {
      const cooldownKey = `ptr_${rule.id}_${subject.id}_${phase}`;
      const isClickType = phase === 'click' || phase === 'down' || phase === 'up' || phase === 'mouse_down' || phase === 'mouse_up';
      const cooldownMs = isClickType ? 50 : RULE_COOLDOWN_MS;

      if (now - (ruleCooldowns[cooldownKey] || 0) < cooldownMs) {
        return;
      }
      ruleCooldowns[cooldownKey] = now;

      executeRuleActions(rule.actions, {
        subject,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
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

      executeRuleActions(rule.actions, {
        subject,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
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
              executeRuleActions(rule.actions, {
                subject,
                target: other,
                allEntities: entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
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
              executeRuleActions(rule.actions, {
                subject: other,
                target: subject,
                allEntities: entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
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

    // 3. Règles de Minuteur / Chronomètre (Timer)
    const timerRules = rules.filter((r) => r.enabled && r.trigger.type === 'timer');
    timerRules.forEach((rule) => {
      const intervalMs = (rule.trigger.timerInterval || 2) * 1000;
      const cooldownKey = `timer_${rule.id}`;
      const lastTrigger = ruleCooldowns[cooldownKey] || 0;

      if (now - lastTrigger >= intervalMs) {
        if (rule.trigger.timerType === 'once' && lastTrigger > 0) {
          return; // Une seule fois déjà exécutée
        }
        ruleCooldowns[cooldownKey] = now;
        const allEnts = Object.values(entities);
        const subject = allEnts.find((e) =>
          matchesEntityFilter(e, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)
        ) || allEnts[0];

        executeRuleActions(rule.actions, {
          subject,
          allEntities: entities,
          updateEntityState,
          updateEntityDetails,
          deleteEntity,
          spawnEntity,
        });
      }
    });

    // 4. Règles de Proximité / Distance entre objets
    const proximityRules = rules.filter((r) => r.enabled && r.trigger.type === 'proximity');
    proximityRules.forEach((rule) => {
      const reqDist = rule.trigger.proximityDistance || 80;
      allEntitiesList.forEach((entA) => {
        allEntitiesList.forEach((entB) => {
          if (entA.id === entB.id) return;
          if (!matchesEntityFilter(entA, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)) return;
          if (!matchesEntityFilter(entB, rule.trigger.targetMode, rule.trigger.targetId, rule.trigger.targetType, rule.trigger.targetTag)) return;

          const centerA = { x: entA.position.x + entA.size.width / 2, y: entA.position.y + entA.size.height / 2 };
          const centerB = { x: entB.position.x + entB.size.width / 2, y: entB.position.y + entB.size.height / 2 };
          const dist = Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y);

          if (dist <= reqDist) {
            const cooldownKey = `prox_${rule.id}_${entA.id}_${entB.id}`;
            if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
              ruleCooldowns[cooldownKey] = now;
              executeRuleActions(rule.actions, {
                subject: entA,
                target: entB,
                allEntities: entities,
                updateEntityState,
                updateEntityDetails,
                deleteEntity,
                spawnEntity,
              });
            }
          }
        });
      });
    });

    // 5. Règles de Bords de Scène / Canvas (Boundary)
    const boundaryRules = rules.filter((r) => r.enabled && r.trigger.type === 'boundary');
    boundaryRules.forEach((rule) => {
      const edge = rule.trigger.boundaryEdge || 'any';
      allEntitiesList.forEach((subject) => {
        if (!matchesEntityFilter(subject, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)) return;

        let hitEdge = false;
        if (edge === 'left' && subject.position.x <= 15) hitEdge = true;
        if (edge === 'right' && subject.position.x + subject.size.width >= 185) hitEdge = true;
        if (edge === 'top' && subject.position.y <= 15) hitEdge = true;
        if (edge === 'bottom' && subject.position.y + subject.size.height >= 185) hitEdge = true;
        if (edge === 'any' && (subject.position.x <= 15 || subject.position.x + subject.size.width >= 185 || subject.position.y <= 15 || subject.position.y + subject.size.height >= 185)) hitEdge = true;

        if (hitEdge) {
          const cooldownKey = `bound_${rule.id}_${subject.id}`;
          if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
            ruleCooldowns[cooldownKey] = now;
            executeRuleActions(rule.actions, {
              subject,
              allEntities: entities,
              updateEntityState,
              updateEntityDetails,
              deleteEntity,
              spawnEntity,
            });
          }
        }
      });
    });

    // 6. Règles de Variables / Compteur de Score
    const variableRules = rules.filter((r) => r.enabled && r.trigger.type === 'variable');
    variableRules.forEach((rule) => {
      const targetVal = rule.trigger.variableValue ?? 5;
      const op = rule.trigger.variableOperator || '>=';
      const score = get().gameScore || 0;

      let satisfied = false;
      if (op === '>=' && score >= targetVal) satisfied = true;
      if (op === '==' && score === targetVal) satisfied = true;
      if (op === '<=' && score <= targetVal) satisfied = true;

      if (satisfied) {
        const cooldownKey = `var_${rule.id}`;
        if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS * 2) {
          ruleCooldowns[cooldownKey] = now;
          const allEnts = Object.values(entities);
          executeRuleActions(rule.actions, {
            subject: allEnts[0],
            allEntities: entities,
            updateEntityState,
            updateEntityDetails,
            deleteEntity,
            spawnEntity,
          });
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
    if (rulePhase === 'release' || rulePhase === 'exit') {
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

    executeRuleActions(rule.actions, {
      subject,
      target,
      allEntities: helpers.entities,
      updateEntityState: helpers.updateEntityState,
      updateEntityDetails: helpers.updateEntityDetails,
      deleteEntity: helpers.deleteEntity,
      spawnEntity: helpers.spawnEntity,
    });
  }
}

// Helper pour exécuter une séquence d'actions avec support des délais (Attendre / Pause)
function executeRuleActions(
  actions: RuleAction[],
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
  let accumulatedDelay = 0;
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    if (act.type === 'delay') {
      accumulatedDelay += (act.delayDuration ?? 1) * 1000;
      continue;
    }
    if (accumulatedDelay > 0) {
      const delayMs = accumulatedDelay;
      setTimeout(() => {
        executeAction(act, helpers);
      }, delayMs);
    } else {
      executeAction(act, helpers);
    }
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
  if (act.type === 'add_score') {
    const amount = act.scoreAmount ?? 1;
    const current = useSceneStore.getState().gameScore || 0;
    useSceneStore.setState({ gameScore: current + amount });
    soundSynth.play('win');
    return;
  }

  if (act.type === 'play_sound') {
    if (act.customSoundId) {
      const sounds = useSceneStore.getState().customSounds;
      const targetSound = sounds.find((s) => s.id === act.customSoundId);
      if (targetSound?.dataUrl) {
        soundSynth.playCustom(targetSound.dataUrl);
        return;
      }
    }
    soundSynth.play(act.soundType || 'pop');
    return;
  }

  if (act.type === 'spawn_entity') {
    const spawnType = act.spawnEntityType || 'custom';
    const locMode = act.spawnLocationMode || act.spawnLocation || (helpers.target ? 'at_target' : 'at_subject');

    // Find default archetype dimensions
    const sampleEntity = Object.values(helpers.allEntities).find((e) => e.type === spawnType);
    const defaultW = sampleEntity?.size.width || 256;
    const defaultH = sampleEntity?.size.height || 256;

    // Compute dynamic sizing
    const scaleMultiplier = act.spawnScaleMultiplier ?? 1;
    let finalWidth = defaultW;
    let finalHeight = defaultH;

    if (act.spawnSizeMode === 'match_target' && helpers.target) {
      finalWidth = Math.round(helpers.target.size.width * scaleMultiplier);
      finalHeight = Math.round(helpers.target.size.height * scaleMultiplier);
    } else if (act.spawnSizeMode === 'match_subject' && helpers.subject) {
      finalWidth = Math.round(helpers.subject.size.width * scaleMultiplier);
      finalHeight = Math.round(helpers.subject.size.height * scaleMultiplier);
    } else if (act.spawnSizeMode === 'custom' && act.spawnCustomSize) {
      finalWidth = act.spawnCustomSize.width;
      finalHeight = act.spawnCustomSize.height;
    } else if (scaleMultiplier !== 1) {
      finalWidth = Math.round(defaultW * scaleMultiplier);
      finalHeight = Math.round(defaultH * scaleMultiplier);
    }

    const spawnSize: Size = {
      width: Math.max(16, finalWidth),
      height: Math.max(16, finalHeight),
    };

    // Determine emitter entity
    const emitter =
      locMode === 'at_target' || locMode === 'offset_target'
        ? helpers.target || helpers.subject
        : helpers.subject || helpers.target;

    let spawnX = 250;
    let spawnY = 200;

    if (locMode === 'random') {
      spawnX = Math.floor(Math.random() * Math.max(60, 680 - spawnSize.width) + 40);
      spawnY = Math.floor(Math.random() * Math.max(60, 420 - spawnSize.height) + 40);
    } else if (locMode === 'absolute') {
      const targetCoord = act.spawnPosition || (act as any).spawnAbsoluteCoords || { x: 350, y: 220 };
      spawnX = Math.round(targetCoord.x - spawnSize.width / 2);
      spawnY = Math.round(targetCoord.y - spawnSize.height / 2);
    } else if (emitter) {
      const emitterCenterX = emitter.position.x + emitter.size.width / 2;
      const emitterCenterY = emitter.position.y + emitter.size.height / 2;

      if (locMode === 'offset_subject' || locMode === 'offset_target') {
        const dx = act.spawnOffset?.x ?? 50;
        const dy = act.spawnOffset?.y ?? 0;
        const offsetLength = Math.hypot(dx, dy);

        // Adaptive expansion: move the center further out proportionally when object is bigger
        const extraDistance = Math.max(
          0,
          (Math.max(spawnSize.width, spawnSize.height) - Math.max(defaultW, defaultH)) / 2
        );
        const adjustedDx = offsetLength > 0 ? dx + (dx / offsetLength) * extraDistance : dx;
        const adjustedDy = offsetLength > 0 ? dy + (dy / offsetLength) * extraDistance : dy;

        spawnX = Math.round(emitterCenterX + adjustedDx - spawnSize.width / 2);
        spawnY = Math.round(emitterCenterY + adjustedDy - spawnSize.height / 2);
      } else {
        // Direct center alignment on emitter
        spawnX = Math.round(emitterCenterX - spawnSize.width / 2);
        spawnY = Math.round(emitterCenterY - spawnSize.height / 2);
      }
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
      if (stateKeys.length === 0) return;

      let nextStateId: StateId | null = null;

      const stateA = act.toggleStateAId || (act as any).toggleStateA;
      const stateB = act.toggleStateBId || (act as any).toggleStateB;

      // Mode 1 : Bascule binaire explicite entre A et B
      if (stateA && stateB) {
        if (entity.currentStateId === stateA) {
          nextStateId = stateB;
        } else {
          nextStateId = stateA;
        }
      } else if (stateKeys.length > 1) {
        // Mode 2 : Cycle ordonné complet entre TOUS les états
        const currentIndex = stateKeys.indexOf(entity.currentStateId);
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % stateKeys.length : 0;
        nextStateId = stateKeys[nextIndex];
      } else {
        nextStateId = stateKeys[0];
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
