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
  DrawingLayer,
  AppSettings,
  ProjectExportData,
  RuleFolder,
  CustomSound,
  ProjectSlot,
  SceneAspectRatio,
  SceneLayer,
  SceneLayerGroup,
  SceneLayerKind,
  EntityBehavior,
  BehaviorOverride,
  ProjectPaletteColor,
  ParentOffset,
  SpawnReferenceMode,
  CustomParticlePreset,
  ColliderType,
  ColliderBounds,
} from '../types';
import { soundSynth } from '../utils/sound';
import { getEntityWorldColliderBounds } from '../utils/collider';
import {
  resetMatterPhysicsRuntime,
  getActivePhysicsCollisionPairs,
  getPhysicsCollisionContact,
  checkEntityAgainstColliderLayer,
  getActiveDragPositions,
  setActiveDragPosition,
  applyEntityMoveAction,
} from '../utils/matterPhysicsEngine';
import {
  clearParticles,
  emitParticlesBurst,
  invalidateCustomParticleSprite,
} from '../utils/particleSystem';
import {
  DEFAULT_SOFT_QUOTA_MB,
  getSoftQuotaMb,
  setSoftQuotaMb,
  estimateJsonBytes,
  getBrowserStorageEstimate,
  loadAllSlotsFromDB,
  putSlotInDB,
  deleteSlotFromDB,
  loadCollectionFromDB,
  saveCollectionInDB,
} from '../utils/localStorageDB';
import defaultCursorPack from '../data/defaultCursorPack.json';

export const DEFAULT_PROJECT_PALETTE: ProjectPaletteColor[] = [
  { id: 'pal-1', name: 'Noir encre', color: '#000000' },
  { id: 'pal-2', name: 'Blanc pur', color: '#ffffff' },
  { id: 'pal-3', name: 'Gris ardoise', color: '#475569' },
  { id: 'pal-4', name: 'Gris perle', color: '#94a3b8' },
  { id: 'pal-5', name: 'Rouge vif', color: '#ef4444' },
  { id: 'pal-6', name: 'Orange ambré', color: '#f97316' },
  { id: 'pal-7', name: 'Jaune or', color: '#f59e0b' },
  { id: 'pal-8', name: 'Citron vert', color: '#84cc16' },
  { id: 'pal-9', name: 'Émeraude', color: '#10b981' },
  { id: 'pal-10', name: 'Sarcelle', color: '#14b8a6' },
  { id: 'pal-11', name: 'Cyan azur', color: '#06b6d4' },
  { id: 'pal-12', name: 'Bleu océan', color: '#3b82f6' },
  { id: 'pal-13', name: 'Indigo', color: '#6366f1' },
  { id: 'pal-14', name: 'Violet', color: '#8b5cf6' },
  { id: 'pal-15', name: 'Rose vif', color: '#ec4899' },
  { id: 'pal-16', name: 'Terre de Sienne', color: '#92400e' },
];

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
        coordinateSpace: 'world',
        role: 'visual',
        vectorPaths: [],
      },
    ],
  },
  {
    id: 'group-col',
    name: 'Colliders de Décor (Murs / Sols)',
    kind: 'collider',
    isCollapsed: false,
    layers: [],
  },
  {
    id: 'group-fg',
    name: 'Premier-plan (Foreground)',
    kind: 'foreground',
    isCollapsed: false,
    layers: [],
  },
];

// Clé de stockage fallback (collection migrée vers IndexedDB)
const COLLECTION_STORAGE_KEY = 'atelier-vivant-custom-entity-collection-v1';

export interface SceneHistorySnapshot {
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  layerGroups: SceneLayerGroup[];
  rules: DynamicRule[];
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
}

function captureSceneSnapshot(state: {
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  layerGroups: SceneLayerGroup[];
  rules: DynamicRule[];
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
}): SceneHistorySnapshot {
  return {
    entities: JSON.parse(JSON.stringify(state.entities)),
    entityOrder: [...(state.entityOrder || Object.keys(state.entities))],
    layerGroups: JSON.parse(JSON.stringify(state.layerGroups || [])),
    rules: JSON.parse(JSON.stringify(state.rules || [])),
    selectedEntityId: state.selectedEntityId,
    selectedLayerId: state.selectedLayerId,
  };
}

function loadLocalCollectionFromStorage(): Record<string, Entity> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (e) {
    console.error('Failed to load local entity collection:', e);
    return {};
  }
}

function saveLocalCollectionToStorage(coll: Record<string, Entity>) {
  if (typeof window === 'undefined') return;
  saveCollectionInDB(coll).catch((e) => {
    console.error('Failed to save local entity collection to IndexedDB:', e);
  });
}

interface SceneState {
  entities: Record<EntityId, Entity>;
  customArchetypes: Record<string, Entity>;
  localEntityCollection: Record<string, Entity>;
  saveToLocalCollection: (entityOrType: string) => { success: boolean; message: string };
  removeFromLocalCollection: (type: string) => void;
  instantiateFromCollection: (type: string, position?: Position) => string;
  exportCollectionJSON: () => { version: number; exportedAt: string; collection: Record<string, Entity> };
  importCollectionJSON: (data: any) => { success: boolean; message: string; count: number };
  rules: DynamicRule[];
  folders: RuleFolder[];
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  addCustomParticle: (preset: Omit<CustomParticlePreset, 'id' | 'createdAt'>) => string;
  updateCustomParticle: (id: string, partial: Partial<CustomParticlePreset>) => void;
  deleteCustomParticle: (id: string) => void;
  layerGroups: SceneLayerGroup[];
  projectPalette: ProjectPaletteColor[];
  updateProjectPaletteColor: (paletteId: string, newHexColor: string) => void;
  resetProjectPalette: () => void;
  activeCollisions: Record<string, boolean>; // Trace l'état de collision pour chaque pair (ruleId_subId_tarId)
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
  appMode: AppMode;
  sceneBounds: Size;
  setSceneBounds: (bounds: Size) => void;
  entityOrder: EntityId[];
  snapshotEntities: Record<EntityId, Entity> | null;
  snapshotEntityOrder: EntityId[] | null;
  snapshotRules: DynamicRule[] | null;
  settings: AppSettings;
  currentSlotId: string | null;
  collapsedRuleIds: Record<string, boolean>;
  toggleRuleCollapse: (ruleId: string) => void;
  ruleBookPage: number;
  setRuleBookPage: (page: number) => void;
  gameScore: number;
  triggerKeyEvent: (keyName: string, phase?: 'down' | 'up') => void;

  // Direct scene canvas drawing tools state
  drawingTool: 'pencil' | 'line' | 'rectangle' | 'circle' | 'bucket' | 'eraser_stroke' | 'eraser_partial' | 'select';
  drawingStrokeColor: string;
  drawingStrokeColorId?: string;
  drawingFillColor: string;
  drawingFillColorId?: string;
  drawingStrokeWidth: number;
  setDrawingTool: (tool: 'pencil' | 'line' | 'rectangle' | 'circle' | 'bucket' | 'eraser_stroke' | 'eraser_partial' | 'select') => void;
  setDrawingStrokeColor: (color: string, colorId?: string) => void;
  setDrawingFillColor: (color: string, colorId?: string) => void;
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
  reorderEntities: (sourceId: EntityId, targetId: EntityId, position?: 'above' | 'below') => void;

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
  updateEntityBehaviors: (entityId: EntityId, behaviors: EntityBehavior[]) => void;
  updateStateBehaviorOverride: (entityId: EntityId, stateId: StateId, behaviorId: string, override: BehaviorOverride) => void;
  removeStateBehaviorOverride: (entityId: EntityId, stateId: StateId, behaviorId: string) => void;
  batchUpdateEntityTransforms: (updates: Record<EntityId, { position?: Position; rotation?: number; flipX?: boolean }>) => void;
  setEntityParent: (childId: EntityId, parentId: EntityId | null, customOffset?: ParentOffset) => void;
  updateEntityParentOffset: (childId: EntityId, partial: Partial<ParentOffset>) => void;
  detachEntity: (childId: EntityId) => void;
  addStateToEntity: (entityId: EntityId, name?: string) => string;
  duplicateStateInEntity: (entityId: EntityId, stateId: StateId) => string;
  removeStateFromEntity: (entityId: EntityId, stateId: StateId) => void;
  addEntity: (type: EntityType) => void;
  addCustomEntity: (customData: {
    name: string;
    type?: string;
    icon?: string;
    drawingDataUrl?: string;
    vectorPaths?: VectorPath[];
    drawingLayers?: DrawingLayer[];
    color?: string;
    tags?: string[];
    colliderType?: ColliderType;
    colliderBounds?: ColliderBounds;
  }) => void;
  deleteCustomArchetype: (type: string) => void;
  spawnEntity: (params: {
    type: EntityType;
    position: Position;
    initialStateId?: StateId;
    size?: Size;
    tags?: string[];
  }) => EntityId;
  deleteEntity: (id: EntityId) => void;
  clearAllEntities: () => void;
  clearProject: () => void;
  restoreDefaultScene: () => void;

  // Project Import / Export
  exportProject: () => ProjectExportData;
  importProject: (data: any) => { success: boolean; message?: string };

  // Project Slots (Stockage local IndexedDB sur la machine de l'utilisateur + quota ajustable)
  projectSlots: ProjectSlot[];
  storageHydrated: boolean;
  quotaLimitMb: number;
  setQuotaLimitMb: (mb: number) => void;
  hydrateLocalStorage: () => Promise<void>;
  getStorageStats: () => Promise<{
    slotsBytes: number;
    collectionBytes: number;
    totalAppBytes: number;
    quotaMb: number;
    browserUsageBytes?: number;
    browserQuotaBytes?: number;
  }>;
  getProjectSlots: () => ProjectSlot[];
  saveProjectToSlot: (name: string, slotId?: string) => {
    success: boolean;
    slotId: string;
    message: string;
    quotaExceeded?: boolean;
    usedBytes?: number;
    limitBytes?: number;
  };
  loadProjectFromSlot: (slotId: string) => { success: boolean; message: string };
  deleteProjectSlot: (slotId: string) => { success: boolean; message: string };
  duplicateProjectSlot: (slotId: string) => {
    success: boolean;
    newSlotId: string;
    message: string;
    quotaExceeded?: boolean;
  };
  renameProjectSlot: (slotId: string, newName: string) => { success: boolean; message: string };

  // Historique Undo / Redo de scène & calques
  sceneUndoStack: SceneHistorySnapshot[];
  sceneRedoStack: SceneHistorySnapshot[];
  pushSceneHistory: () => void;
  undoScene: () => boolean;
  redoScene: () => boolean;

  // Rules & Folders management
  addRule: (rule: Omit<DynamicRule, 'id'>) => string;
  updateRule: (id: string, partial: Partial<DynamicRule>) => void;
  duplicateRule: (id: string) => string;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  reorderRules: (sourceId: string, targetId: string, position?: 'above' | 'below') => void;
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
  updateCustomSound: (id: string, partial: Partial<CustomSound>) => void;

  triggerClickEvent: (entityId: EntityId) => void;
  triggerPointerEvent: (entityId: EntityId, phase: TriggerPhase, eventPosition?: Position) => void;
  triggerDragRelease: (subjectId: EntityId, eventPosition?: Position) => void;
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
    isDraggable: false,
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
    isDraggable: false,
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
    isDraggable: false,
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
const preCollisionStates: Record<
  string,
  {
    subjectState?: string;
    targetState?: string;
    lastOverlapPosA?: Position;
    lastOverlapPosB?: Position;
  }
> = {};
const preEventAutoRevertStates: Record<string, string> = {};
const lastCollisionContacts: Record<string, Position> = {};
const firedCollisionOnceKeys: Record<string, boolean> = {};
const activeDelayTimers = new Set<ReturnType<typeof setTimeout>>();
let isEvaluatingRules = false;
const RULE_COOLDOWN_MS = 350; // Minimum interval between identical rule trigger on same entities
const ENTITY_STATE_COOLDOWN_MS = 250; // Prevents oscillating state ping-pong

function clearPlayRuntimeState() {
  activeDelayTimers.forEach((t) => clearTimeout(t));
  activeDelayTimers.clear();
  Object.keys(ruleCooldowns).forEach((k) => delete ruleCooldowns[k]);
  Object.keys(entityStateTimestamps).forEach((k) => delete entityStateTimestamps[k]);
  Object.keys(preCollisionStates).forEach((k) => delete preCollisionStates[k]);
  Object.keys(preEventAutoRevertStates).forEach((k) => delete preEventAutoRevertStates[k]);
  Object.keys(lastCollisionContacts).forEach((k) => delete lastCollisionContacts[k]);
  Object.keys(firedCollisionOnceKeys).forEach((k) => delete firedCollisionOnceKeys[k]);
  Object.keys(getActiveDragPositions()).forEach((id) => setActiveDragPosition(id, null));
  lastSpawnedEntityId = null;
}

// Vérification de la collision avec support précis des Colliders (flipX + scale centrée) et écoute native Matter.js
const checkCollision = (ent1: Entity, ent2: Entity, tolerancePx: number = 3) => {
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
};

// Calcul du point exact de contact entre deux entités (Matter.js prioritaire, sinon analytique)
function getCollisionContactPoint(ent1: Entity, ent2: Entity): Position {
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

function findTargetEntityOrArchetype(
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

export const useSceneStore = create<SceneState>()((set, get) => ({
  entities: {},
  customArchetypes: {},
  localEntityCollection: loadLocalCollectionFromStorage(),
  projectSlots: [],
  storageHydrated: false,
  quotaLimitMb: getSoftQuotaMb(),
  sceneUndoStack: [],
  sceneRedoStack: [],

  pushSceneHistory: () => {
    const state = get();
    if (state.appMode !== 'edit') return;
    const snap = captureSceneSnapshot(state);
    set((prev) => {
      const next = [...prev.sceneUndoStack, snap];
      if (next.length > 35) next.shift();
      return {
        sceneUndoStack: next,
        sceneRedoStack: [],
      };
    });
  },

  undoScene: () => {
    const state = get();
    if (state.appMode !== 'edit' || state.sceneUndoStack.length === 0) return false;
    const currentSnap = captureSceneSnapshot(state);
    const targetSnap = state.sceneUndoStack[state.sceneUndoStack.length - 1];
    set({
      entities: JSON.parse(JSON.stringify(targetSnap.entities)),
      entityOrder: [...targetSnap.entityOrder],
      layerGroups: JSON.parse(JSON.stringify(targetSnap.layerGroups)),
      rules: JSON.parse(JSON.stringify(targetSnap.rules)),
      selectedEntityId:
        targetSnap.selectedEntityId && targetSnap.entities[targetSnap.selectedEntityId]
          ? targetSnap.selectedEntityId
          : null,
      selectedLayerId: state.selectedLayerId ?? targetSnap.selectedLayerId,
      sceneUndoStack: state.sceneUndoStack.slice(0, -1),
      sceneRedoStack: [...state.sceneRedoStack, currentSnap].slice(-35),
    });
    return true;
  },

  redoScene: () => {
    const state = get();
    if (state.appMode !== 'edit' || state.sceneRedoStack.length === 0) return false;
    const currentSnap = captureSceneSnapshot(state);
    const targetSnap = state.sceneRedoStack[state.sceneRedoStack.length - 1];
    set({
      entities: JSON.parse(JSON.stringify(targetSnap.entities)),
      entityOrder: [...targetSnap.entityOrder],
      layerGroups: JSON.parse(JSON.stringify(targetSnap.layerGroups)),
      rules: JSON.parse(JSON.stringify(targetSnap.rules)),
      selectedEntityId:
        targetSnap.selectedEntityId && targetSnap.entities[targetSnap.selectedEntityId]
          ? targetSnap.selectedEntityId
          : null,
      selectedLayerId: state.selectedLayerId ?? targetSnap.selectedLayerId,
      sceneUndoStack: [...state.sceneUndoStack, currentSnap].slice(-35),
      sceneRedoStack: state.sceneRedoStack.slice(0, -1),
    });
    return true;
  },

  setQuotaLimitMb: (mb: number) => {
    const cleanMb = Math.max(0, Math.round(mb));
    setSoftQuotaMb(cleanMb);
    set({ quotaLimitMb: cleanMb });
  },

  hydrateLocalStorage: async () => {
    try {
      const [slots, coll] = await Promise.all([
        loadAllSlotsFromDB(),
        loadCollectionFromDB(),
      ]);
      set((state) => ({
        projectSlots: slots,
        localEntityCollection:
          Object.keys(coll).length > 0 ? coll : state.localEntityCollection,
        storageHydrated: true,
      }));
    } catch (err) {
      console.error('Failed to hydrate IndexedDB storage:', err);
      set({ storageHydrated: true });
    }
  },

  getStorageStats: async () => {
    const state = get();
    const slotsBytes = estimateJsonBytes(state.projectSlots);
    const collectionBytes = estimateJsonBytes(state.localEntityCollection);
    const browserEst = await getBrowserStorageEstimate();
    return {
      slotsBytes,
      collectionBytes,
      totalAppBytes: slotsBytes + collectionBytes,
      quotaMb: state.quotaLimitMb ?? DEFAULT_SOFT_QUOTA_MB,
      browserUsageBytes: browserEst.usageBytes,
      browserQuotaBytes: browserEst.quotaBytes,
    };
  },

  saveToLocalCollection: (entityOrType: string) => {
    const { entities, customArchetypes, localEntityCollection } = get();
    const targetEntity =
      entities[entityOrType] ||
      customArchetypes[entityOrType] ||
      localEntityCollection[entityOrType] ||
      Object.values(entities).find((e) => e.type === entityOrType) ||
      Object.values(customArchetypes).find((a) => a.type === entityOrType);

    if (!targetEntity) {
      return { success: false, message: 'Entité introuvable.' };
    }

    const template: Entity = {
      ...JSON.parse(JSON.stringify(targetEntity)),
      position: { x: 0, y: 0 },
    };

    const updatedCollection = {
      ...localEntityCollection,
      [targetEntity.type]: template,
    };

    saveLocalCollectionToStorage(updatedCollection);
    set({ localEntityCollection: updatedCollection });

    return {
      success: true,
      message: `Entité "${targetEntity.name}" enregistrée dans votre Collection locale !`,
    };
  },

  removeFromLocalCollection: (type: string) => {
    const { localEntityCollection } = get();
    const { [type]: _, ...remaining } = localEntityCollection;
    saveLocalCollectionToStorage(remaining);
    set({ localEntityCollection: remaining });
  },

  instantiateFromCollection: (type: string, position?: Position) => {
    const { localEntityCollection, entities, customArchetypes } = get();
    const template =
      localEntityCollection[type] ||
      customArchetypes[type] ||
      Object.values(entities).find((e) => e.type === type);

    if (!template) return '';

    const currentEntities = Object.values(entities);
    const count = currentEntities.length + 1;
    const id = `coll-${type}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
    const pos = position || { x: 180 + ((count * 35) % 220), y: 140 + ((count * 30) % 180) };

    const newInstance: Entity = {
      ...JSON.parse(JSON.stringify(template)),
      id,
      position: pos,
    };

    set((state) => {
      const order = state.entityOrder && state.entityOrder.length > 0
        ? [...state.entityOrder]
        : Object.keys(state.entities);
      return {
        entities: {
          ...state.entities,
          [id]: newInstance,
        },
        customArchetypes: {
          ...state.customArchetypes,
          [type]: JSON.parse(JSON.stringify(template)),
        },
        entityOrder: [...order.filter((i) => i !== id), id],
        selectedEntityId: id,
      };
    });

    get().evaluateRules();
    return id;
  },

  exportCollectionJSON: () => {
    const { localEntityCollection } = get();
    return {
      version: 1,
      name: 'Collection d\'Entités Atelier Vivant',
      exportedAt: new Date().toISOString(),
      collection: localEntityCollection,
    };
  },

  importCollectionJSON: (data: any) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Format JSON invalide.', count: 0 };
      }
      const rawColl = data.collection || (data.entities ? data.entities : data);
      if (!rawColl || typeof rawColl !== 'object') {
        return { success: false, message: 'Aucune entité trouvée dans ce fichier.', count: 0 };
      }

      const current = { ...get().localEntityCollection };
      let added = 0;
      Object.values(rawColl).forEach((ent: any) => {
        if (ent && ent.type) {
          current[ent.type] = {
            ...JSON.parse(JSON.stringify(ent)),
            position: { x: 0, y: 0 },
          };
          added++;
        }
      });

      saveLocalCollectionToStorage(current);
      set({ localEntityCollection: current });
      return { success: true, message: `${added} entité(s) importée(s) dans votre collection !`, count: added };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Erreur lors de l\'importation.', count: 0 };
    }
  },

  rules: [],
  folders: initialFolders,
  customSounds: [],
  customParticles: [],
  activeCollisions: {},
  selectedEntityId: null,
  appMode: 'edit',
  sceneBounds: { width: 800, height: 500 },
  setSceneBounds: (bounds) => {
    const w = Math.max(100, Math.round(bounds.width));
    const h = Math.max(100, Math.round(bounds.height));
    const prev = get().sceneBounds;
    if (prev.width !== w || prev.height !== h) {
      set({ sceneBounds: { width: w, height: h } });
    }
  },
  entityOrder: ['plant-1', 'apple-1'],
  layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
  selectedLayerId: null,
  snapshotEntities: null,
  snapshotEntityOrder: null,
  snapshotRules: null,
  currentSlotId: null,
  collapsedRuleIds: {},
  ruleBookPage: 1,
  setRuleBookPage: (page) => set({ ruleBookPage: Math.max(1, page) }),
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
  drawingStrokeColor: '#000000',
  drawingStrokeColorId: 'pal-1',
  drawingFillColor: 'none',
  drawingFillColorId: undefined,
  drawingStrokeWidth: 6,
  setDrawingTool: (tool) => set({ drawingTool: tool }),
  setDrawingStrokeColor: (color, colorId) =>
    set((state) => ({
      drawingStrokeColor: color,
      drawingStrokeColorId:
        colorId !== undefined
          ? colorId
          : state.projectPalette.find((p) => p.color.toLowerCase() === color.toLowerCase())?.id,
    })),
  setDrawingFillColor: (color, colorId) =>
    set((state) => ({
      drawingFillColor: color,
      drawingFillColorId:
        colorId !== undefined
          ? colorId
          : color === 'none'
          ? undefined
          : state.projectPalette.find((p) => p.color.toLowerCase() === color.toLowerCase())?.id,
    })),
  setDrawingStrokeWidth: (width) => set({ drawingStrokeWidth: width }),

  projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),

  updateProjectPaletteColor: (paletteId, newHexColor) => {
    set((state) => {
      const oldColorObj = state.projectPalette.find((p) => p.id === paletteId);
      const oldHex = oldColorObj?.color?.toLowerCase();
      const updatedPalette = state.projectPalette.map((p) =>
        p.id === paletteId ? { ...p, color: newHexColor } : p
      );

      const syncPathColor = (p: VectorPath): VectorPath => {
        let nextStroke = p.stroke;
        let nextStrokeId = p.strokeColorId;
        let nextFill = p.fill;
        let nextFillId = p.fillColorId;

        if (p.strokeColorId === paletteId || (!p.strokeColorId && oldHex && p.stroke?.toLowerCase() === oldHex)) {
          nextStroke = newHexColor;
          nextStrokeId = paletteId;
        }
        if (p.fillColorId === paletteId || (!p.fillColorId && oldHex && p.fill && p.fill !== 'none' && p.fill.toLowerCase() === oldHex)) {
          nextFill = newHexColor;
          nextFillId = paletteId;
        }
        if (nextStroke !== p.stroke || nextFill !== p.fill || nextStrokeId !== p.strokeColorId || nextFillId !== p.fillColorId) {
          return { ...p, stroke: nextStroke, strokeColorId: nextStrokeId, fill: nextFill, fillColorId: nextFillId };
        }
        return p;
      };

      const syncEntityColors = (ent: Entity): Entity => {
        const nextStates: Record<StateId, EntityState> = {};
        Object.entries(ent.states).forEach(([stId, st]) => {
          nextStates[stId] = {
            ...st,
            vectorPaths: st.vectorPaths ? st.vectorPaths.map(syncPathColor) : st.vectorPaths,
          };
        });
        return {
          ...ent,
          vectorPaths: ent.vectorPaths ? ent.vectorPaths.map(syncPathColor) : ent.vectorPaths,
          states: nextStates,
        };
      };

      const nextEntities: Record<EntityId, Entity> = {};
      Object.entries(state.entities).forEach(([id, ent]) => {
        nextEntities[id] = syncEntityColors(ent);
      });

      const nextArchetypes: Record<string, Entity> = {};
      Object.entries(state.customArchetypes).forEach(([type, arch]) => {
        nextArchetypes[type] = syncEntityColors(arch);
      });

      const nextLayerGroups = state.layerGroups.map((g) => ({
        ...g,
        layers: g.layers.map((l) => ({
          ...l,
          vectorPaths: l.vectorPaths ? l.vectorPaths.map(syncPathColor) : [],
        })),
      }));

      return {
        projectPalette: updatedPalette,
        entities: nextEntities,
        customArchetypes: nextArchetypes,
        layerGroups: nextLayerGroups,
        drawingStrokeColor:
          state.drawingStrokeColorId === paletteId || (oldHex && state.drawingStrokeColor.toLowerCase() === oldHex)
            ? newHexColor
            : state.drawingStrokeColor,
        drawingFillColor:
          state.drawingFillColorId === paletteId || (oldHex && state.drawingFillColor.toLowerCase() === oldHex)
            ? newHexColor
            : state.drawingFillColor,
        settings: {
          ...state.settings,
          projectPalette: updatedPalette,
        },
      };
    });
  },

  resetProjectPalette: () => {
    const fresh = JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE));
    set((state) => ({
      projectPalette: fresh,
      settings: {
        ...state.settings,
        projectPalette: fresh,
      },
    }));
  },

  settings: {
    aspectRatio: '1:1',
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
    projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
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
      const isColliderGroup = targetGroup?.kind === 'collider';
      const newLayer: SceneLayer = {
        id: layerId,
        name: name?.trim() || (isColliderGroup ? `Collider #${count}` : `Calque #${count}`),
        visible: true,
        opacity: 1,
        parallaxFactor: targetGroup?.kind === 'background' ? 0 : 1,
        coordinateSpace: 'world',
        role: isColliderGroup ? 'collider' : 'visual',
        ...(isColliderGroup
          ? {
              colliderTags: ['sol'],
              colliderIsTrigger: false,
              colliderFriction: 0.9,
              colliderBounce: 0,
              showColliderInPlay: true,
            }
          : {}),
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
    get().pushSceneHistory();
    set((state) => ({
      layerGroups: state.layerGroups.map((g) => ({
        ...g,
        layers: g.layers.map((l) =>
          l.id === layerId
            ? {
                ...l,
                coordinateSpace:
                  l.coordinateSpace || (l.vectorPaths.length === 0 ? 'world' : 'legacy_200'),
                vectorPaths,
              }
            : l
        ),
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
    get().pushSceneHistory();
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
        selectedLayerId: null,
      };
    });
    if (get().appMode === 'play' && !isEvaluatingRules) {
      get().evaluateRules();
    }
    return newId;
  },

  reorderEntities: (sourceId, targetId, position = 'above') => {
    set((state) => {
      const rawOrder = state.entityOrder && state.entityOrder.length > 0
        ? state.entityOrder
        : Object.keys(state.entities);

      if (!rawOrder.includes(sourceId) || !rawOrder.includes(targetId) || sourceId === targetId) {
        return state;
      }

      const filtered = rawOrder.filter((id) => id !== sourceId);
      const targetIdx = filtered.indexOf(targetId);
      if (targetIdx === -1) return state;

      // In display list (reversed): top element in UI = highest Z-index (last in order array)
      // 'above' in UI means higher Z-index -> insert AFTER target in order array
      // 'below' in UI means lower Z-index -> insert BEFORE target in order array
      const insertIdx = position === 'above' ? targetIdx + 1 : targetIdx;
      filtered.splice(insertIdx, 0, sourceId);

      return { entityOrder: filtered };
    });
  },

  setAppMode: (mode) => {
    if (mode === 'play') {
      clearPlayRuntimeState();
      // Sauvegarder un instantané propre (entités + ordre + règles) pour la restauration fidèle
      const snapshot = JSON.parse(JSON.stringify(get().entities));
      const orderSnapshot = [...(get().entityOrder || Object.keys(get().entities))];
      const rulesSnapshot = JSON.parse(JSON.stringify(get().rules));
      set({
        appMode: 'play',
        snapshotEntities: snapshot,
        snapshotEntityOrder: orderSnapshot,
        snapshotRules: rulesSnapshot,
      });
    } else {
      // Quand on repasse en mode édition, restaurer fidèlement la scène et les règles d'avant-jeu
      resetMatterPhysicsRuntime();
      clearParticles();
      clearPlayRuntimeState();
      const { snapshotEntities, snapshotEntityOrder, snapshotRules } = get();
      if (snapshotEntities) {
        set({
          entities: JSON.parse(JSON.stringify(snapshotEntities)),
          entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
          ...(snapshotRules ? { rules: JSON.parse(JSON.stringify(snapshotRules)) } : {}),
          activeCollisions: {},
          appMode: 'edit',
        });
      } else {
        set({
          ...(snapshotRules ? { rules: JSON.parse(JSON.stringify(snapshotRules)) } : {}),
          appMode: 'edit',
          activeCollisions: {},
        });
      }
    }
  },

  resetScene: () => {
    resetMatterPhysicsRuntime();
    clearParticles();
    clearPlayRuntimeState();
    const { snapshotEntities, snapshotEntityOrder, snapshotRules } = get();
    if (snapshotEntities) {
      set({
        entities: JSON.parse(JSON.stringify(snapshotEntities)),
        entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
        ...(snapshotRules ? { rules: JSON.parse(JSON.stringify(snapshotRules)) } : {}),
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

  selectEntity: (id) =>
    set((state) => ({
      selectedEntityId: id,
      selectedLayerId: id ? null : state.selectedLayerId,
    })),

  updateEntityPosition: (id, position) => {
    set((state) => {
      const entity = state.entities[id];
      if (!entity) return state;

      const dx = position.x - entity.position.x;
      const dy = position.y - entity.position.y;
      const nextEntities: Record<EntityId, Entity> = {
        ...state.entities,
        [id]: { ...entity, position },
      };

      // En mode Édition : conserver la hiérarchie parent/enfant WYSIWYG
      if (state.appMode === 'edit') {
        // 1. Si cette entité est un enfant attaché, mettre à jour son parentOffset
        if (entity.parentId && nextEntities[entity.parentId]) {
          const parent = nextEntities[entity.parentId];
          nextEntities[id] = {
            ...nextEntities[id],
            parentOffset: computeRelativeParentOffset(
              { ...entity, position },
              parent,
              entity.parentOffset
            ),
          };
        }

        // 2. Si cette entité a des enfants attachés, déplacer ses descendants avec elle
        if (dx !== 0 || dy !== 0) {
          const descendants = collectDescendantIds(nextEntities, id);
          descendants.forEach((childId) => {
            const child = nextEntities[childId];
            if (child) {
              nextEntities[childId] = {
                ...child,
                position: {
                  x: child.position.x + dx,
                  y: child.position.y + dy,
                },
              };
            }
          });
        }
      }

      return { entities: nextEntities };
    });
    get().evaluateRules();
  },

  updateEntityState: (id, stateId) => {
    set((state) => {
      const entity = state.entities[id];
      if (entity && entity.states[stateId]) {
        return {
          entities: {
            ...state.entities,
            [id]: { ...entity, currentStateId: stateId },
          },
        };
      }
      // Si l'entité sélectionnée est un modèle sans instance sur la scène,
      // permettre de basculer l'état inspecté directement sur son archétype en mode édition.
      if (state.appMode === 'edit') {
        const arch = findTargetEntityOrArchetype(state, id);
        if (arch && arch.states[stateId] && state.customArchetypes[arch.type]) {
          return {
            customArchetypes: {
              ...state.customArchetypes,
              [arch.type]: {
                ...state.customArchetypes[arch.type],
                currentStateId: stateId,
              },
            },
          };
        }
      }
      return state;
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
      const entity = findTargetEntityOrArchetype(state, id);

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
      const targetEntity = findTargetEntityOrArchetype(state, id);
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
      const targetEntity = findTargetEntityOrArchetype(state, id);
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
      const targetEntity = findTargetEntityOrArchetype(state, entityId);

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
          const newColliderBounds = partial.colliderBounds !== undefined ? partial.colliderBounds : e.colliderBounds;

          updatedEntities[e.id] = {
            ...e,
            vectorPaths: isCurrentState ? newVectorPaths : e.vectorPaths,
            colliderType: isCurrentState ? newColliderType : e.colliderType,
            colliderBounds: isCurrentState ? newColliderBounds : e.colliderBounds,
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
        if (partial.vectorPaths !== undefined) {
          updatedArchetypes[targetType].vectorPaths = partial.vectorPaths;
        }
        if (partial.colliderType !== undefined) {
          updatedArchetypes[targetType].colliderType = partial.colliderType;
        }
        if (partial.colliderBounds !== undefined) {
          updatedArchetypes[targetType].colliderBounds = partial.colliderBounds;
        }
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  updateEntityBehaviors: (entityId, behaviors) => {
    set((state) => {
      const target = findTargetEntityOrArchetype(state, entityId);

      if (!target) return state;
      const targetType = target.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            behaviors: JSON.parse(JSON.stringify(behaviors)),
          };
        } else if (e.id === entityId) {
          updatedEntities[e.id] = {
            ...e,
            behaviors: JSON.parse(JSON.stringify(behaviors)),
          };
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          behaviors: JSON.parse(JSON.stringify(behaviors)),
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  updateStateBehaviorOverride: (entityId, stateId, behaviorId, override) => {
    set((state) => {
      const target = findTargetEntityOrArchetype(state, entityId);

      if (!target) return state;
      const targetType = target.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          const st = e.states[stateId];
          if (st) {
            const currentOverrides = st.behaviorOverrides || {};
            const existingOverride = currentOverrides[behaviorId] || {};
            const updatedOverrides = {
              ...currentOverrides,
              [behaviorId]: {
                ...existingOverride,
                ...override,
              },
            };
            updatedEntities[e.id] = {
              ...e,
              states: {
                ...e.states,
                [stateId]: {
                  ...st,
                  behaviorOverrides: updatedOverrides,
                },
              },
            };
          }
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType] && updatedArchetypes[targetType].states[stateId]) {
        const st = updatedArchetypes[targetType].states[stateId];
        const currentOverrides = st.behaviorOverrides || {};
        const existingOverride = currentOverrides[behaviorId] || {};
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: {
            ...updatedArchetypes[targetType].states,
            [stateId]: {
              ...st,
              behaviorOverrides: {
                ...currentOverrides,
                [behaviorId]: {
                  ...existingOverride,
                  ...override,
                },
              },
            },
          },
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  removeStateBehaviorOverride: (entityId, stateId, behaviorId) => {
    set((state) => {
      const target = findTargetEntityOrArchetype(state, entityId);

      if (!target) return state;
      const targetType = target.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          const st = e.states[stateId];
          if (st && st.behaviorOverrides) {
            const copy = { ...st.behaviorOverrides };
            delete copy[behaviorId];
            updatedEntities[e.id] = {
              ...e,
              states: {
                ...e.states,
                [stateId]: {
                  ...st,
                  behaviorOverrides: copy,
                },
              },
            };
          }
        }
      });

      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType] && updatedArchetypes[targetType].states[stateId]?.behaviorOverrides) {
        const st = updatedArchetypes[targetType].states[stateId];
        const copy = { ...st.behaviorOverrides };
        delete copy[behaviorId];
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: {
            ...updatedArchetypes[targetType].states,
            [stateId]: {
              ...st,
              behaviorOverrides: copy,
            },
          },
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  batchUpdateEntityTransforms: (updates) => {
    set((state) => {
      let hasChanges = false;
      const nextEntities = { ...state.entities };

      Object.entries(updates).forEach(([id, transform]) => {
        const entity = nextEntities[id];
        if (!entity) return;

        let modified = false;
        let newPos = entity.position;
        if (
          transform.position &&
          (transform.position.x !== entity.position.x || transform.position.y !== entity.position.y)
        ) {
          newPos = transform.position;
          modified = true;
        }

        let newStates = entity.states;
        if (transform.rotation !== undefined) {
          const curState = entity.states[entity.currentStateId];
          if (curState && curState.rotation !== transform.rotation) {
            newStates = {
              ...entity.states,
              [entity.currentStateId]: {
                ...curState,
                rotation: transform.rotation,
              },
            };
            modified = true;
          }
        }

        if (transform.flipX !== undefined && entity.flipX !== transform.flipX) {
          modified = true;
        }

        if (modified) {
          hasChanges = true;
          nextEntities[id] = {
            ...entity,
            position: newPos,
            states: newStates,
            ...(transform.flipX !== undefined ? { flipX: transform.flipX } : {}),
          };
        }
      });

      return hasChanges ? { entities: nextEntities } : state;
    });
  },

  setEntityParent: (childId, parentId, customOffset) => {
    set((state) => {
      const child = state.entities[childId];
      if (!child) return state;

      if (!parentId) {
        const { parentId: _p, parentOffset: _o, ...rest } = child;
        return {
          entities: {
            ...state.entities,
            [childId]: rest as Entity,
          },
        };
      }

      const parent = state.entities[parentId];
      if (!parent || childId === parentId || wouldCreateParentCycle(state.entities, childId, parentId)) {
        return state;
      }

      const nextOffset = customOffset
        ? {
            x: customOffset.x,
            y: customOffset.y,
            rotationOffset: customOffset.rotationOffset ?? 0,
            inheritRotation: customOffset.inheritRotation ?? true,
            inheritFlip: customOffset.inheritFlip ?? true,
          }
        : computeRelativeParentOffset(child, parent, child.parentOffset);

      const updatedChild: Entity = {
        ...child,
        parentId,
        parentOffset: nextOffset,
      };

      // Si customOffset explicite en mode Édition, positionner immédiatement l'enfant sur le canvas
      if (customOffset && state.appMode === 'edit') {
        const synced = computeChildWorldFromParent(updatedChild, parent);
        updatedChild.position = synced.position;
      }

      return {
        entities: {
          ...state.entities,
          [childId]: updatedChild,
        },
      };
    });
  },

  updateEntityParentOffset: (childId, partial) => {
    set((state) => {
      const child = state.entities[childId];
      if (!child || !child.parentId) return state;
      const nextOffset: ParentOffset = {
        x: partial.x ?? child.parentOffset?.x ?? 0,
        y: partial.y ?? child.parentOffset?.y ?? 0,
        rotationOffset: partial.rotationOffset ?? child.parentOffset?.rotationOffset ?? 0,
        inheritRotation: partial.inheritRotation ?? child.parentOffset?.inheritRotation ?? true,
        inheritFlip: partial.inheritFlip ?? child.parentOffset?.inheritFlip ?? true,
      };
      const updatedChild: Entity = {
        ...child,
        parentOffset: nextOffset,
      };
      const parent = state.entities[child.parentId];
      if (parent && state.appMode === 'edit') {
        const synced = computeChildWorldFromParent(updatedChild, parent);
        updatedChild.position = synced.position;
        if (updatedChild.states[updatedChild.currentStateId]) {
          updatedChild.states = {
            ...updatedChild.states,
            [updatedChild.currentStateId]: {
              ...updatedChild.states[updatedChild.currentStateId],
              rotation: synced.rotation,
            },
          };
        }
        updatedChild.flipX = synced.flipX;
      }
      return {
        entities: {
          ...state.entities,
          [childId]: updatedChild,
        },
      };
    });
  },

  detachEntity: (childId) => {
    set((state) => {
      const child = state.entities[childId];
      if (!child || !child.parentId) return state;
      const { parentId: _p, parentOffset: _o, ...rest } = child;
      return {
        entities: {
          ...state.entities,
          [childId]: rest as Entity,
        },
      };
    });
  },

  addStateToEntity: (entityId, name) => {
    const targetEntity = findTargetEntityOrArchetype(get(), entityId);

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

  duplicateStateInEntity: (entityId, stateId) => {
    const targetEntity = findTargetEntityOrArchetype(get(), entityId);
    if (!targetEntity) return '';
    const sourceState = targetEntity.states[stateId];
    if (!sourceState) return '';

    const targetType = targetEntity.type;
    const baseName = `${sourceState.name} (copie)`;
    const newId = `state_copy_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    const clonedState: EntityState = {
      ...JSON.parse(JSON.stringify(sourceState)),
      id: newId,
      name: baseName,
    };

    set((state) => {
      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            states: {
              ...e.states,
              [newId]: JSON.parse(JSON.stringify(clonedState)),
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
            [newId]: JSON.parse(JSON.stringify(clonedState)),
          },
        };
      }

      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });

    return newId;
  },

  removeStateFromEntity: (entityId, stateId) => {
    set((state) => {
      const targetEntity = findTargetEntityOrArchetype(state, entityId);

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
        isDraggable: false,
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
        isDraggable: false,
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
        isDraggable: false,
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

  addCustomEntity: ({ name, type, icon, drawingDataUrl, vectorPaths, drawingLayers, color, tags, colliderType, colliderBounds }) => {
    const cleanName = (name && name.trim()) || 'Mon Dessin';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'dessin';
    const uniqueType = type || `custom_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const mainColor = color || '#8b5cf6';
    const id = `custom-${Date.now().toString(36)}`;
    const currentEntities = Object.values(get().entities);
    const count = currentEntities.length + 1;
    const clonedLayers = drawingLayers && drawingLayers.length > 0
      ? JSON.parse(JSON.stringify(drawingLayers))
      : undefined;
    const clonedColliderBounds = colliderBounds
      ? JSON.parse(JSON.stringify(colliderBounds))
      : undefined;

    const newEntity: Entity = {
      id,
      name: cleanName,
      type: uniqueType,
      icon: icon || '🎨',
      drawingDataUrl,
      vectorPaths: vectorPaths ? JSON.parse(JSON.stringify(vectorPaths)) : [],
      ...(clonedLayers ? { drawingLayers: clonedLayers } : {}),
      ...(colliderType ? { colliderType } : {}),
      ...(clonedColliderBounds ? { colliderBounds: clonedColliderBounds } : {}),
      tags: tags && tags.length > 0 ? tags : [slug, 'custom'],
      position: { x: 180 + ((count * 35) % 220), y: 140 + ((count * 30) % 180) },
      size: { width: 256, height: 256 },
      currentStateId: 'state_1',
      isDraggable: false,
      states: {
        state_1: {
          id: 'state_1',
          name: 'Normal',
          color: mainColor,
          scale: 1,
          rotation: 0,
          vectorPaths: vectorPaths ? JSON.parse(JSON.stringify(vectorPaths)) : [],
          ...(clonedLayers ? { drawingLayers: JSON.parse(JSON.stringify(clonedLayers)) } : {}),
          ...(colliderType ? { colliderType } : {}),
          ...(clonedColliderBounds ? { colliderBounds: JSON.parse(JSON.stringify(clonedColliderBounds)) } : {}),
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
    if (get().appMode === 'play' && !isEvaluatingRules) {
      get().evaluateRules();
    }
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

      // Détacher proprement les enfants éventuels dont le parent vient d'être supprimé
      Object.entries(remainingEntities).forEach(([id, entity]) => {
        if (entity.parentId && deletedIds.has(entity.parentId)) {
          const { parentId: _p, parentOffset: _o, ...rest } = entity;
          remainingEntities[id] = rest as Entity;
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

  spawnEntity: ({ type, position, initialStateId, size, tags }) => {
    if (get().appMode === 'edit') {
      get().pushSceneHistory();
    }
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
        isDraggable: false,
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
        isDraggable: false,
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
        isDraggable: false,
        states: {
          'default': { id: 'default', name: 'Normal', color: '#8b5cf6', scale: 1, rotation: 0 },
          'actif': { id: 'actif', name: 'Actif', color: '#f59e0b', scale: 1.25, rotation: 15 },
        },
      };
    }

    // Fusionner les tags additionnels attribués au spawn (Piste A)
    if (tags && tags.length > 0) {
      const mergedTags = new Set([
        ...(newEntity.tags || []),
        ...tags.map((t) => t.toLowerCase().trim().replace(/^#/, '')).filter(Boolean),
      ]);
      newEntity.tags = Array.from(mergedTags);
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
    // Ne pas ré-évaluer de manière réentrante pendant une boucle d'actions en Play (la frame RAF suivante s'en chargera proprement)
    return id;
  },

  deleteEntity: (id) => {
    if (get().appMode === 'edit') {
      get().pushSceneHistory();
    }
    setActiveDragPosition(id, null);
    set((state) => {
      const { [id]: _, ...remainingEntities } = state.entities;
      // Détacher proprement tout enfant dont le parent est supprimé
      Object.entries(remainingEntities).forEach(([childId, child]) => {
        if (child.parentId === id) {
          const { parentId: _p, parentOffset: _o, ...rest } = child;
          remainingEntities[childId] = rest as Entity;
        }
      });
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
    get().pushSceneHistory();
    set({
      entities: {},
      entityOrder: [],
      selectedEntityId: null,
    });
  },

  clearProject: () => {
    clearPlayRuntimeState();
    set({
      entities: {},
      customArchetypes: {},
      entityOrder: [],
      rules: [],
      folders: initialFolders,
      customSounds: [],
      customParticles: [],
      layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
      projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
      selectedEntityId: null,
      selectedLayerId: 'layer-bg-1',
      activeCollisions: {},
      snapshotEntities: null,
      snapshotEntityOrder: null,
      snapshotRules: null,
    });
  },

  restoreDefaultScene: () => {
    clearPlayRuntimeState();
    set({
      entities: JSON.parse(JSON.stringify(initialEntities)),
      entityOrder: ['plant-1', 'apple-1'],
      customArchetypes: JSON.parse(JSON.stringify(defaultCustomArchetypes)),
      rules: JSON.parse(JSON.stringify(initialRules)),
      folders: JSON.parse(JSON.stringify(initialFolders)),
      customSounds: [],
      customParticles: [],
      layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
      projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
      snapshotEntities: null,
      snapshotEntityOrder: null,
      snapshotRules: null,
      selectedEntityId: 'plant-1',
      selectedLayerId: null,
      activeCollisions: {},
      appMode: 'edit',
    });
    get().evaluateRules();
  },

  exportProject: () => {
    const { entities, customArchetypes, rules, folders, customSounds, customParticles, layerGroups, settings, projectPalette } = get();
    return {
      version: 1,
      name: 'Projet Atelier Vivant',
      exportedAt: new Date().toISOString(),
      entities,
      customArchetypes,
      rules,
      folders,
      customSounds,
      customParticles,
      layerGroups,
      settings: {
        ...settings,
        projectPalette,
      },
      projectPalette,
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

      clearPlayRuntimeState();
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
      const importedCustomParticles = Array.isArray(data.customParticles) ? data.customParticles : [];
      const rawLayerGroups: SceneLayerGroup[] = Array.isArray(data.layerGroups) && data.layerGroups.length > 0
        ? data.layerGroups
        : JSON.parse(JSON.stringify(initialSceneLayerGroups));
      const normalizedLayerGroups = rawLayerGroups.map((g) => ({
        ...g,
        layers: (g.layers || []).map((l) => ({
          ...l,
          coordinateSpace:
            l.coordinateSpace || ((l.vectorPaths?.length || 0) === 0 ? 'world' : 'legacy_200'),
        })),
      }));
      if (!normalizedLayerGroups.some((g) => g.kind === 'collider')) {
        normalizedLayerGroups.splice(1, 0, {
          id: 'group-col',
          name: 'Colliders de Décor (Murs / Sols)',
          kind: 'collider',
          isCollapsed: false,
          layers: [],
        });
      }
      const importedLayerGroups = normalizedLayerGroups;
      const importedSettings = data.settings && typeof data.settings === 'object' ? data.settings : undefined;
      const importedPalette: ProjectPaletteColor[] = Array.isArray(data.projectPalette) && data.projectPalette.length > 0
        ? data.projectPalette
        : Array.isArray(importedSettings?.projectPalette) && importedSettings.projectPalette.length > 0
        ? importedSettings.projectPalette
        : JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE));

      set((state) => ({
        entities: importedEntities,
        customArchetypes: importedArchetypes,
        rules: importedRules,
        folders: importedFolders,
        customSounds: importedCustomSounds,
        customParticles: importedCustomParticles,
        layerGroups: importedLayerGroups,
        projectPalette: importedPalette,
        settings: importedSettings
          ? { ...state.settings, ...importedSettings, projectPalette: importedPalette }
          : { ...state.settings, projectPalette: importedPalette },
        selectedEntityId: Object.keys(importedEntities)[0] || null,
        selectedLayerId: null,
        activeCollisions: {},
        appMode: 'edit',
        snapshotEntities: null,
        snapshotEntityOrder: null,
        snapshotRules: null,
      }));

      get().evaluateRules();
      return { success: true, message: 'Projet importé avec succès !' };
    } catch (err: any) {
      return { success: false, message: err?.message || "Erreur lors de l'importation." };
    }
  },

  // --- Gestion des Slots de Sauvegarde Locale (IndexedDB sur la machine utilisateur) ---
  getProjectSlots: () => {
    return [...get().projectSlots].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  },

  saveProjectToSlot: (name: string, targetSlotId?: string) => {
    if (typeof window === 'undefined') {
      return { success: false, slotId: '', message: 'Stockage local non disponible dans cet environnement.' };
    }
    try {
      const state = get();
      const slots = state.getProjectSlots();
      const currentData = state.exportProject();
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

      const quotaMb = state.quotaLimitMb ?? DEFAULT_SOFT_QUOTA_MB;
      if (quotaMb > 0) {
        const limitBytes = quotaMb * 1024 * 1024;
        const usedBytes = estimateJsonBytes(updatedSlots) + estimateJsonBytes(state.localEntityCollection);
        if (usedBytes > limitBytes) {
          const usedMo = (usedBytes / (1024 * 1024)).toFixed(1);
          return {
            success: false,
            slotId: '',
            quotaExceeded: true,
            usedBytes,
            limitBytes,
            message: `Quota local atteint (${usedMo} Mo / ${quotaMb} Mo). Augmentez le quota ou supprimez d'anciens slots.`,
          };
        }
      }

      set({
        projectSlots: updatedSlots.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
        currentSlotId: slotId,
      });

      putSlotInDB(newSlot).catch((err) => {
        console.error('Failed to persist slot in IndexedDB:', err);
      });

      return { success: true, slotId, message: `Projet "${cleanName}" sauvegardé localement sur votre machine !` };
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
    if (typeof window === 'undefined') {
      return { success: false, message: 'Stockage local non disponible.' };
    }
    try {
      const slots = get().getProjectSlots();
      const filtered = slots.filter((s) => s.id !== slotId);
      set({
        projectSlots: filtered,
        currentSlotId: get().currentSlotId === slotId ? null : get().currentSlotId,
      });
      deleteSlotFromDB(slotId).catch((err) => {
        console.error('Failed to delete slot from IndexedDB:', err);
      });
      return { success: true, message: 'Slot supprimé avec succès.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur lors de la suppression.' };
    }
  },

  duplicateProjectSlot: (slotId: string) => {
    try {
      const state = get();
      const slots = state.getProjectSlots();
      const source = slots.find((s) => s.id === slotId);
      if (!source) return { success: false, newSlotId: '', message: 'Slot source introuvable.' };

      const newId = `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const newSlot: ProjectSlot = {
        ...JSON.parse(JSON.stringify(source)),
        id: newId,
        name: `${source.name} (Copie)`,
        updatedAt: Date.now(),
      };

      const updated = [newSlot, ...slots].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      const quotaMb = state.quotaLimitMb ?? DEFAULT_SOFT_QUOTA_MB;
      if (quotaMb > 0) {
        const limitBytes = quotaMb * 1024 * 1024;
        const usedBytes = estimateJsonBytes(updated) + estimateJsonBytes(state.localEntityCollection);
        if (usedBytes > limitBytes) {
          return {
            success: false,
            newSlotId: '',
            quotaExceeded: true,
            message: `Quota local atteint (${quotaMb} Mo). Augmentez le quota ou supprimez un slot.`,
          };
        }
      }

      set({ projectSlots: updated });
      putSlotInDB(newSlot).catch((err) => {
        console.error('Failed to duplicate slot in IndexedDB:', err);
      });
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

      const updatedSlot: ProjectSlot = {
        ...target,
        name: clean,
        updatedAt: Date.now(),
      };
      const updatedSlots = slots
        .map((s) => (s.id === slotId ? updatedSlot : s))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
      set({ projectSlots: updatedSlots });
      putSlotInDB(updatedSlot).catch((err) => {
        console.error('Failed to rename slot in IndexedDB:', err);
      });
      return { success: true, message: 'Nom du slot modifié avec succès.' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Erreur lors du renommage.' };
    }
  },

  // Gestion des Règles
  addRule: (ruleData) => {
    get().pushSceneHistory();
    const id = `rule-${Date.now().toString(36)}`;
    const newRule: DynamicRule = { ...ruleData, id };
    set((state) => ({
      rules: [...state.rules, newRule],
    }));
    get().evaluateRules();
    return id;
  },

  updateRule: (id, partial) => {
    get().pushSceneHistory();
    set((state) => ({
      rules: state.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
    }));
    get().evaluateRules();
  },

  duplicateRule: (id) => {
    const existingRule = get().rules.find((r) => r.id === id);
    if (!existingRule) return '';
    get().pushSceneHistory();
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
    get().pushSceneHistory();
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

  reorderRules: (sourceId, targetId, position = 'above') => {
    set((state) => {
      const rules = [...state.rules];
      const fromIdx = rules.findIndex((r) => r.id === sourceId);
      if (fromIdx === -1) return state;
      const [moved] = rules.splice(fromIdx, 1);
      const toIdx = rules.findIndex((r) => r.id === targetId);
      if (toIdx === -1) {
        rules.push(moved);
      } else {
        const insertIdx = position === 'below' ? toIdx + 1 : toIdx;
        rules.splice(insertIdx, 0, moved);
      }
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

  updateCustomSound: (id, partial) => {
    set((state) => ({
      customSounds: state.customSounds.map((s) => (s.id === id ? { ...s, ...partial } : s)),
    }));
  },

  // Particules personnalisées dessinées
  addCustomParticle: (presetData) => {
    const id = `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const newPreset: CustomParticlePreset = {
      ...presetData,
      id,
      createdAt: Date.now(),
    };
    set((state) => ({
      customParticles: [...state.customParticles, newPreset],
    }));
    invalidateCustomParticleSprite(id);
    return id;
  },

  updateCustomParticle: (id, partial) => {
    invalidateCustomParticleSprite(id);
    set((state) => ({
      customParticles: state.customParticles.map((p) => (p.id === id ? { ...p, ...partial } : p)),
    }));
  },

  deleteCustomParticle: (id) => {
    invalidateCustomParticleSprite(id);
    set((state) => ({
      customParticles: state.customParticles.filter((p) => p.id !== id),
    }));
  },

  triggerKeyEvent: (keyName, phase = 'down') => {
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

      const allEnts = Object.values(entities);
      const subject = allEnts.find((e) =>
        matchesEntityFilter(e, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)
      ) || allEnts[0];

      if (!subject) return;

      const revertKey = `kb_${subject.id}_${rule.id}`;

      if (rule.trigger.autoRevert) {
        if (phase === 'down') {
          if (!preEventAutoRevertStates[revertKey]) {
            preEventAutoRevertStates[revertKey] = subject.currentStateId;
          }
        } else if (phase === 'up') {
          const prevState = preEventAutoRevertStates[revertKey];
          if (prevState) {
            updateEntityState(subject.id, prevState);
            delete preEventAutoRevertStates[revertKey];
            return;
          }
        }
      }

      // Verify key event phase ('down' vs 'up')
      const rulePhase = rule.trigger.phase || 'down';
      const phaseMatch =
        rulePhase === phase ||
        (rulePhase === 'key_down' && phase === 'down') ||
        (rulePhase === 'key_up' && phase === 'up') ||
        (rulePhase === 'click' && phase === 'down');

      if (!phaseMatch) return;

      const cooldownKey = `key_${rule.id}_${keyName}_${phase}`;
      if (now - (ruleCooldowns[cooldownKey] || 0) < 50) return;
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

  triggerClickEvent: (entityId) => {
    get().triggerPointerEvent(entityId, 'click');
  },

  triggerPointerEvent: (entityId, phase, eventPosition) => {
    // Les règles ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[entityId];
    if (!subject) return;

    const now = Date.now();
    const isReleasePhase = phase === 'up' || phase === 'mouse_up' || phase === 'exit' || phase === 'hover_exit';
    const resolvedPoint = eventPosition || {
      x: subject.position.x + subject.size.width / 2,
      y: subject.position.y + subject.size.height / 2,
    };

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
          phaseMatch = rulePhase === 'exit' || rulePhase === 'hover_exit' || r.trigger.autoRevert === true;
        }
      } else if (r.trigger.type === 'click') {
        if (phase === 'click') {
          phaseMatch = rulePhase === 'click';
        } else if (phase === 'down' || phase === 'mouse_down') {
          phaseMatch = rulePhase === 'down' || rulePhase === 'mouse_down';
        } else if (phase === 'up' || phase === 'mouse_up') {
          phaseMatch =
            rulePhase === 'up' ||
            rulePhase === 'mouse_up' ||
            (r.trigger.autoRevert === true && (rulePhase === 'down' || rulePhase === 'mouse_down'));
        }
      }

      if (!phaseMatch) return false;

      // Lors de la phase de relâchement/sortie avec autoRevert (ou phase de sortie explicite hover_exit/exit),
      // ne pas bloquer si l'état a déjà changé suite à l'entrée !
      const isExplicitExitRule = r.trigger.phase === 'exit' || r.trigger.phase === 'hover_exit';
      if (!isReleasePhase || (!r.trigger.autoRevert && !isExplicitExitRule)) {
        if (
          r.trigger.subjectStateId &&
          r.trigger.subjectStateId !== '' &&
          subject.currentStateId !== r.trigger.subjectStateId
        ) {
          return false;
        }
      }
      return true;
    });

    activePointerRules.forEach((rule) => {
      const canonicalPhase =
        phase === 'mouse_down'
          ? 'down'
          : phase === 'mouse_up'
          ? 'up'
          : phase === 'hover_enter'
          ? 'enter'
          : phase === 'hover_exit'
          ? 'exit'
          : phase;
      const cooldownKey = `ptr_${rule.id}_${subject.id}_${canonicalPhase}`;
      const isHoverType = canonicalPhase === 'enter' || canonicalPhase === 'exit';
      const cooldownMs = isHoverType ? 60 : canonicalPhase === 'up' ? 20 : 40;

      if (now - (ruleCooldowns[cooldownKey] || 0) < cooldownMs) {
        return;
      }
      ruleCooldowns[cooldownKey] = now;

      const revertKey = `${subject.id}_${rule.id}`;

      if (rule.trigger.autoRevert) {
        if (phase === 'enter' || phase === 'hover_enter' || phase === 'down' || phase === 'mouse_down') {
          if (!preEventAutoRevertStates[revertKey]) {
            preEventAutoRevertStates[revertKey] = subject.currentStateId;
          }
        }
        
        if (isReleasePhase) {
          const prevState = preEventAutoRevertStates[revertKey];
          if (prevState) {
            updateEntityState(subject.id, prevState);
            delete preEventAutoRevertStates[revertKey];
            return;
          }
        }
      }

      // N'exécuter les actions d'entrée/appui que sur les phases non-relâchement (ou si rulePhase est explicitement release)
      if (!isReleasePhase || rule.trigger.phase === 'up' || rule.trigger.phase === 'mouse_up' || rule.trigger.phase === 'exit' || rule.trigger.phase === 'hover_exit') {
        executeRuleActions(rule.actions, {
          subject,
          eventPosition: resolvedPoint,
          allEntities: entities,
          updateEntityState,
          updateEntityDetails,
          deleteEntity,
          spawnEntity,
        });
      }
    });
  },

  triggerDragRelease: (subjectId, eventPosition) => {
    // Les règles ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[subjectId];
    if (!subject) return;

    const now = Date.now();
    const allEntitiesList = Object.values(entities);
    const subjectCenter = eventPosition || {
      x: subject.position.x + subject.size.width / 2,
      y: subject.position.y + subject.size.height / 2,
    };

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
        eventPosition: subjectCenter,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });

    // 2. Règles de collision avec phase stricte 'collision_release' (Relâchement au-dessus d'une cible)
    const collisionReleaseRules = rules.filter(
      (r) =>
        r.enabled &&
        r.trigger.type === 'collision' &&
        r.trigger.phase === 'collision_release'
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

        const contactPt = getCollisionContactPoint(subject, other);

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
                eventPosition: contactPt,
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
                eventPosition: contactPt,
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
    if (isEvaluatingRules) return;
    isEvaluatingRules = true;
    try {
      const { entities, rules, activeCollisions, sceneBounds, layerGroups, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
      const collisionRules = rules.filter((r) => r.enabled && r.trigger.type === 'collision');

      // Fusionner les positions des entités actuellement déplacées à la souris (activeDragPositions)
      // avec d'éventuelles positions temporaires pour éviter toute alternance position-départ / curseur entre onDrag et RAF
      const activeDragMap = getActiveDragPositions();
      const hasActiveDrag = Object.keys(activeDragMap).length > 0;
      const effectivePositions: Record<EntityId, Position> | undefined =
        hasActiveDrag || tempPositions
          ? { ...activeDragMap, ...(tempPositions || {}) }
          : undefined;

      const nextCollisions: Record<string, boolean> = { ...activeCollisions };
      const allEntitiesList = Object.values(entities);
      const now = Date.now();
      const sceneW = Math.max(100, sceneBounds?.width || 800);
      const sceneH = Math.max(100, sceneBounds?.height || 500);

      // Index des paires d'IDs déjà en contact actif sur au moins une règle (évite qu'une règle Exit rate le verrou après un rétrécissement dû à une règle Enter)
      const activeEntityContactPairs = new Set<string>();
      Object.entries(activeCollisions).forEach(([k, val]) => {
        if (!val) return;
        const idx1 = k.indexOf('_');
        if (idx1 === -1) return;
        const rest = k.slice(idx1 + 1);
        const idx2 = rest.indexOf('_');
        if (idx2 === -1) return;
        const id1 = rest.slice(0, idx2);
        const id2 = rest.slice(idx2 + 1);
        activeEntityContactPairs.add(`${id1}:::${id2}`);
        activeEntityContactPairs.add(`${id2}:::${id1}`);
      });

      // Calques Colliders actifs portant des tracés
      const activeColliderLayers = (layerGroups || []).flatMap((g) =>
        (g.layers || [])
          .filter(
            (l) =>
              (l.role === 'collider' || g.kind === 'collider') &&
              l.visible &&
              (l.vectorPaths?.length || 0) > 0
          )
          .map((l) => ({ layer: l, groupKind: g.kind }))
      );

      if (collisionRules.length > 0) {
        collisionRules.forEach((rule) => {
          const exitMargin = Math.max(0, rule.trigger.collisionExitMargin ?? 10);

          // A. Collisions Entité <-> Entité
          for (let i = 0; i < allEntitiesList.length; i++) {
            for (let j = i + 1; j < allEntitiesList.length; j++) {
              const entA = allEntitiesList[i];
              const entB = allEntitiesList[j];

              let posA = entA.position;
              if (effectivePositions && effectivePositions[entA.id]) {
                posA = effectivePositions[entA.id];
              }

              let posB = entB.position;
              if (effectivePositions && effectivePositions[entB.id]) {
                posB = effectivePositions[entB.id];
              }

              const tempA = { ...entA, position: posA };
              const tempB = { ...entB, position: posB };

              const keyAB = `${rule.id}_${entA.id}_${entB.id}`;
              const keyBA = `${rule.id}_${entB.id}_${entA.id}`;
              const wasPairColliding =
                Boolean(activeCollisions[keyAB] || activeCollisions[keyBA]) ||
                activeEntityContactPairs.has(`${entA.id}:::${entB.id}`);
              const effectiveTol = wasPairColliding ? 3 + exitMargin : 3;

              const isColliding = checkCollision(tempA, tempB, effectiveTol);

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
                  tempA,
                  tempB,
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
                  tempB,
                  tempA,
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

          // B. Collisions Entité <-> Calques Colliders de décor (via #Tags ou 'any')
          if (activeColliderLayers.length > 0) {
            for (const ent of allEntitiesList) {
              const matchAsSubject = matchesEntityFilter(
                ent,
                rule.trigger.subjectMode,
                rule.trigger.subjectId,
                rule.trigger.subjectType,
                rule.trigger.subjectTag
              );
              if (!matchAsSubject) continue;

              const tempEnt = effectivePositions && effectivePositions[ent.id]
                ? { ...ent, position: effectivePositions[ent.id] }
                : ent;
              const entBounds = getEntityWorldColliderBounds(tempEnt);

              for (const { layer } of activeColliderLayers) {
                const layerProxy: Entity = {
                  id: `layercol::${layer.id}`,
                  name: layer.name,
                  type: '__collider_layer__',
                  tags: layer.colliderTags || [],
                  position: { x: 0, y: 0 },
                  size: { width: sceneW, height: sceneH },
                  currentStateId: 'A',
                  isDraggable: false,
                  states: {
                    A: {
                      id: 'A',
                      name: 'A',
                      color: 'transparent',
                      scale: 1,
                      rotation: 0,
                    },
                  },
                };

                const matchLayerAsTarget =
                  (rule.trigger.targetMode === 'any' || rule.trigger.targetMode === 'tag') &&
                  matchesEntityFilter(
                    layerProxy,
                    rule.trigger.targetMode,
                    rule.trigger.targetId,
                    rule.trigger.targetType,
                    rule.trigger.targetTag
                  );

                if (!matchLayerAsTarget) continue;

                const cKey = `${rule.id}_${tempEnt.id}_${layerProxy.id}`;
                const wasLayerColliding =
                  Boolean(activeCollisions[cKey]) ||
                  activeEntityContactPairs.has(`${tempEnt.id}:::${layerProxy.id}`);
                const layerTol = wasLayerColliding ? 3 + exitMargin : 3;

                const hit = checkEntityAgainstColliderLayer(entBounds, tempEnt.id, layer, {
                  width: sceneW,
                  height: sceneH,
                }, layerTol);

                if (hit.colliding && hit.contactPoint) {
                  lastCollisionContacts[cKey] = hit.contactPoint;
                }

                handleCollisionPair(
                  rule,
                  tempEnt,
                  layerProxy,
                  hit.colliding,
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
    }

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

          const posA = effectivePositions?.[entA.id] ?? entA.position;
          const posB = effectivePositions?.[entB.id] ?? entB.position;
          const centerA = { x: posA.x + entA.size.width / 2, y: posA.y + entA.size.height / 2 };
          const centerB = { x: posB.x + entB.size.width / 2, y: posB.y + entB.size.height / 2 };
          const dist = Math.hypot(centerA.x - centerB.x, centerA.y - centerB.y);

          if (dist <= reqDist) {
            const cooldownKey = `prox_${rule.id}_${entA.id}_${entB.id}`;
            if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
              ruleCooldowns[cooldownKey] = now;
              const effA = posA === entA.position ? entA : { ...entA, position: posA };
              const effB = posB === entB.position ? entB : { ...entB, position: posB };
              executeRuleActions(rule.actions, {
                subject: effA,
                target: effB,
                eventPosition: {
                  x: Math.round((centerA.x + centerB.x) / 2),
                  y: Math.round((centerA.y + centerB.y) / 2),
                },
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

    // 5. Règles de Bords de Scène / Canvas (Calibrées sur le collider réel et sceneBounds en direct)
    const boundaryRules = rules.filter((r) => r.enabled && r.trigger.type === 'boundary');
    const edgeTol = 2;

    boundaryRules.forEach((rule) => {
      const edge = rule.trigger.boundaryEdge || 'any';
      allEntitiesList.forEach((subject) => {
        if (!matchesEntityFilter(subject, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)) return;

        // État spécifique requis si défini
        if (rule.trigger.subjectStateId && subject.currentStateId !== rule.trigger.subjectStateId) return;

        const subjPos = effectivePositions?.[subject.id] ?? subject.position;
        const effectiveSubject = subjPos === subject.position ? subject : { ...subject, position: subjPos };
        const wb = getEntityWorldColliderBounds(effectiveSubject);
        const hitLeft = wb.x <= edgeTol;
        const hitRight = wb.x + wb.width >= sceneW - edgeTol;
        const hitTop = wb.y <= edgeTol;
        const hitBottom = wb.y + wb.height >= sceneH - edgeTol;

        let hitEdge = false;
        if (edge === 'left' && hitLeft) hitEdge = true;
        if (edge === 'right' && hitRight) hitEdge = true;
        if (edge === 'top' && hitTop) hitEdge = true;
        if (edge === 'bottom' && hitBottom) hitEdge = true;
        if (edge === 'any' && (hitLeft || hitRight || hitTop || hitBottom)) hitEdge = true;

        if (hitEdge) {
          const cooldownKey = `bound_${rule.id}_${subject.id}`;
          if (now - (ruleCooldowns[cooldownKey] || 0) >= RULE_COOLDOWN_MS) {
            ruleCooldowns[cooldownKey] = now;
            const boundaryPt: Position = {
              x: hitLeft && (edge === 'left' || edge === 'any') ? 0 : hitRight && (edge === 'right' || edge === 'any') ? sceneW : Math.round(wb.centerX),
              y: hitTop && (edge === 'top' || edge === 'any') ? 0 : hitBottom && (edge === 'bottom' || edge === 'any') ? sceneH : Math.round(wb.centerY),
            };
            executeRuleActions(rule.actions, {
              subject: effectiveSubject,
              eventPosition: boundaryPt,
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

    // Ne mettre à jour activeCollisions que si au moins un état de collision a changé (zéro re-render superflu à 60 FPS)
    const activeKeys = Object.keys(activeCollisions);
    const nextKeys = Object.keys(nextCollisions);
    let collisionsChanged = activeKeys.length !== nextKeys.length;
    if (!collisionsChanged) {
      for (const k of nextKeys) {
        if (activeCollisions[k] !== nextCollisions[k]) {
          collisionsChanged = true;
          break;
        }
      }
    }
      if (collisionsChanged) {
        set({ activeCollisions: nextCollisions });
      }
    } finally {
      isEvaluatingRules = false;
    }
  },
}));

if (typeof window !== 'undefined') {
  useSceneStore.getState().hydrateLocalStorage();
}

// Dernière instance créée dynamiquement en mode Play (Piste C : Référence "Dernier objet apparu")
let lastSpawnedEntityId: EntityId | null = null;

// Helpers hiérarchie Parent-Enfant
function wouldCreateParentCycle(
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

function collectDescendantIds(entities: Record<EntityId, Entity>, rootId: EntityId): EntityId[] {
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

function computeRelativeParentOffset(
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

function computeChildWorldFromParent(
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

function resolveEntityReference(
  mode: SpawnReferenceMode | 'subject' | 'target' | 'entity' | 'instance' | 'type' | 'tag' | 'last_spawned' | undefined,
  entityId: string | undefined,
  entityType: EntityType | undefined,
  tag: string | undefined,
  subject: Entity | undefined,
  target: Entity | undefined,
  liveEntities: Record<EntityId, Entity>
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

// Helper pour traiter les paires de collision avec anti-boucle, continuité d'état et mémorisation du point de contact
function handleCollisionPair(
  rule: DynamicRule,
  subject: Entity,
  target: Entity,
  rawIsColliding: boolean,
  nextCollisions: Record<string, boolean>,
  activeCollisions: Record<string, boolean>,
  now: number,
  helpers: {
    entities: Record<EntityId, Entity>;
    updateEntityState: (id: EntityId, stateId: StateId) => void;
    updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
    deleteEntity: (id: EntityId) => void;
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId; size?: Size; tags?: string[] }) => EntityId;
  }
) {
  const collisionKey = `${rule.id}_${subject.id}_${target.id}`;
  const wasColliding = !!activeCollisions[collisionKey];

  // Protection anti-scintillement lors d'un changement d'état sur place (sans séparation physique réelle) :
  // Si un changement d'état sur l'une des entités a rétréci/décalé son dessin alors qu'aucune des deux entités
  // n'a bougé de >= 2.5px depuis le dernier chevauchement, maintenir la collision active pour éviter Exit -> Enter en boucle.
  let isColliding = rawIsColliding;
  if (!isColliding && wasColliding) {
    const pre = preCollisionStates[collisionKey];
    if (pre) {
      const stateChanged =
        (pre.subjectState && subject.currentStateId !== pre.subjectState) ||
        (pre.targetState && target.currentStateId !== pre.targetState);
      if (stateChanged) {
        const distA = pre.lastOverlapPosA
          ? Math.hypot(subject.position.x - pre.lastOverlapPosA.x, subject.position.y - pre.lastOverlapPosA.y)
          : 999;
        const distB = pre.lastOverlapPosB
          ? Math.hypot(target.position.x - pre.lastOverlapPosB.x, target.position.y - pre.lastOverlapPosB.y)
          : 999;
        if (distA < 10 && distB < 10) {
          isColliding = true;
        }
      }
    }
  }

  const isExiting = !isColliding && wasColliding;

  // IMPORTANT: Si la collision physique est active, maintenir nextCollisions[collisionKey] = true
  // pour que la sortie de collision et l'auto-remise puissent fonctionner même si l'état a été changé
  // par la règle d'entrée !
  if (isColliding) {
    nextCollisions[collisionKey] = true;
    if (!lastCollisionContacts[collisionKey] || rawIsColliding) {
      lastCollisionContacts[collisionKey] = getCollisionContactPoint(subject, target);
    }
  } else {
    nextCollisions[collisionKey] = false;
  }

  // Filtrer par état spécifique uniquement lors du tout premier contact (On Enter)
  // Ne pas filtrer pendant le contact continu (stay) ni lors de la séparation (isExiting)
  if (!wasColliding && isColliding) {
    if (
      rule.trigger.subjectStateId &&
      rule.trigger.subjectStateId !== '' &&
      subject.currentStateId !== rule.trigger.subjectStateId
    ) {
      nextCollisions[collisionKey] = false;
      return;
    }
    if (
      rule.trigger.targetStateId &&
      rule.trigger.targetStateId !== '' &&
      target.currentStateId !== rule.trigger.targetStateId
    ) {
      nextCollisions[collisionKey] = false;
      return;
    }
  }

  const rulePhase = rule.trigger.phase || 'enter';
  let shouldExecute = false;

  if (isColliding && !wasColliding) {
    // Premier contact (On Enter)
    preCollisionStates[collisionKey] = {
      subjectState: subject.currentStateId,
      targetState: target.currentStateId,
      lastOverlapPosA: { ...subject.position },
      lastOverlapPosB: { ...target.position },
    };

    if (rulePhase === 'enter' || rulePhase === 'stay') {
      shouldExecute = true;
    }
  } else if (isColliding && wasColliding) {
    // Contact continu (Stay) : mémoriser la dernière position où les colliders se chevauchaient réellement
    if (rawIsColliding && preCollisionStates[collisionKey]) {
      preCollisionStates[collisionKey].lastOverlapPosA = { ...subject.position };
      preCollisionStates[collisionKey].lastOverlapPosB = { ...target.position };
    }
    if (rulePhase === 'stay') {
      shouldExecute = true;
    }
  } else if (isExiting) {
    // Sortie / Séparation (Release / Exit)
    if (rulePhase === 'release' || rulePhase === 'exit') {
      shouldExecute = true;
    }

    // Toggle / Revert pour autoRevert ou contact continu (stay) avec anti-rebond
    if (rule.trigger.autoRevert || (rulePhase === 'stay' && rule.trigger.revertOnExit !== false)) {
      const revertCooldownKey = `revert_${rule.id}_${subject.id}_${target.id}`;
      if (now - (ruleCooldowns[revertCooldownKey] || 0) >= 120) {
        ruleCooldowns[revertCooldownKey] = now;
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
    }

    delete preCollisionStates[collisionKey];
  }

  const contactPoint = isColliding
    ? lastCollisionContacts[collisionKey]
    : lastCollisionContacts[collisionKey] || getCollisionContactPoint(subject, target);

  if (isExiting) {
    delete lastCollisionContacts[collisionKey];
  }

  if (shouldExecute) {
    if (rule.trigger.collisionTriggerOnce && firedCollisionOnceKeys[collisionKey]) {
      return;
    }

    // Cooldown séparé enter vs exit (avec amortissement anti-rebond sur exit)
    const cooldownKey = `collision_${rule.id}_${subject.id}_${target.id}_${isExiting ? 'exit' : 'enter'}`;
    const cooldownDuration = isExiting ? 120 : RULE_COOLDOWN_MS;
    if (now - (ruleCooldowns[cooldownKey] || 0) < cooldownDuration) {
      return;
    }
    ruleCooldowns[cooldownKey] = now;

    if (rule.trigger.collisionTriggerOnce) {
      firedCollisionOnceKeys[collisionKey] = true;
    }

    executeRuleActions(rule.actions, {
      subject,
      target,
      eventPosition: contactPoint,
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
    eventPosition?: Position;
    allEntities: Record<EntityId, Entity>;
    updateEntityState: (id: EntityId, stateId: StateId) => void;
    updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
    deleteEntity: (id: EntityId) => void;
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId; size?: Size; tags?: string[] }) => EntityId;
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
      const frozenHelpers = { ...helpers };
      const timerId = setTimeout(() => {
        activeDelayTimers.delete(timerId);
        if (useSceneStore.getState().appMode !== 'play') return;
        executeAction(act, frozenHelpers);
      }, delayMs);
      activeDelayTimers.add(timerId);
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
    eventPosition?: Position;
    allEntities: Record<EntityId, Entity>;
    updateEntityState: (id: EntityId, stateId: StateId) => void;
    updateEntityDetails: (id: EntityId, partial: Partial<Entity>) => void;
    deleteEntity: (id: EntityId) => void;
    spawnEntity: (params: { type: EntityType; position: Position; initialStateId?: StateId; size?: Size; tags?: string[] }) => EntityId;
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

  // Toujours lire l'état à jour des entités (utile après un spawn ou un délai)
  const liveEntities = useSceneStore.getState().entities || helpers.allEntities;
  const sceneBounds = useSceneStore.getState().sceneBounds || { width: 800, height: 500 };

  if (act.type === 'emit_particles') {
    const originMode = act.particleOriginMode || (helpers.target ? 'target' : 'subject');
    let originX = 300;
    let originY = 200;

    if (originMode === 'event_point' && helpers.eventPosition) {
      originX = helpers.eventPosition.x;
      originY = helpers.eventPosition.y;
    } else {
      const origin =
        resolveEntityReference(
          originMode === 'event_point' ? (helpers.target ? 'target' : 'subject') : originMode,
          act.particleOriginEntityId,
          act.particleOriginEntityType,
          act.particleOriginTag,
          helpers.subject,
          helpers.target,
          liveEntities
        ) ||
        helpers.subject ||
        helpers.target;

      if (origin) {
        originX = origin.position.x + origin.size.width / 2;
        originY = origin.position.y + origin.size.height / 2;
      } else if (helpers.eventPosition) {
        originX = helpers.eventPosition.x;
        originY = helpers.eventPosition.y;
      }
    }

    emitParticlesBurst({
      x: originX,
      y: originY,
      count: act.particleCount ?? 18,
      color: act.particleColor ?? '#f59e0b',
      color2: act.particleColor2,
      shape: act.particleShape ?? 'circle',
      customParticleId: act.customParticleId,
      customParticleIds: act.customParticleIds,
      customParticleMode: act.customParticleMode,
      useTint: act.useParticleTint,
      speed: act.particleSpeed ?? 180,
      size: act.particleSize ?? 6,
      lifetime: act.particleLifetime ?? 0.7,
      gravity: act.particleGravity ?? 220,
      spread: act.particleSpread ?? 360,
      angle: act.particleAngle ?? -90,
    });
    return;
  }

  if (act.type === 'spawn_entity') {
    const spawnType = act.spawnEntityType || 'custom';
    const locMode = act.spawnLocationMode || act.spawnLocation || (helpers.target ? 'at_target' : 'at_subject');

    // Résoudre l'entité de référence (Sujet, Cible, Entité précise, Type, Tag, Dernier créé)
    let emitter: Entity | undefined;
    if (act.spawnReferenceMode) {
      emitter = resolveEntityReference(
        act.spawnReferenceMode,
        act.spawnReferenceEntityId,
        act.spawnReferenceEntityType,
        act.spawnReferenceTag,
        helpers.subject,
        helpers.target,
        liveEntities
      );
    }
    if (!emitter) {
      emitter =
        locMode === 'at_target' || locMode === 'offset_target'
          ? helpers.target || helpers.subject
          : helpers.subject || helpers.target;
    }

    // Find default archetype dimensions
    const sampleEntity =
      Object.values(liveEntities).find((e) => e.type === spawnType) ||
      useSceneStore.getState().customArchetypes[spawnType];
    const defaultW = sampleEntity?.size.width || 256;
    const defaultH = sampleEntity?.size.height || 256;

    // Compute dynamic sizing
    const scaleMultiplier = act.spawnScaleMultiplier ?? 1;
    let finalWidth = defaultW;
    let finalHeight = defaultH;

    if (act.spawnSizeMode === 'match_reference' && emitter) {
      finalWidth = Math.round(emitter.size.width * scaleMultiplier);
      finalHeight = Math.round(emitter.size.height * scaleMultiplier);
    } else if (act.spawnSizeMode === 'match_target' && (helpers.target || emitter)) {
      const ref = helpers.target || emitter!;
      finalWidth = Math.round(ref.size.width * scaleMultiplier);
      finalHeight = Math.round(ref.size.height * scaleMultiplier);
    } else if (act.spawnSizeMode === 'match_subject' && (helpers.subject || emitter)) {
      const ref = helpers.subject || emitter!;
      finalWidth = Math.round(ref.size.width * scaleMultiplier);
      finalHeight = Math.round(ref.size.height * scaleMultiplier);
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

    let spawnX = 250;
    let spawnY = 200;

    if (locMode === 'random') {
      const availW = Math.max(40, sceneBounds.width - spawnSize.width - 40);
      const availH = Math.max(40, sceneBounds.height - spawnSize.height - 40);
      spawnX = Math.floor(Math.random() * availW + 20);
      spawnY = Math.floor(Math.random() * availH + 20);
    } else if (locMode === 'absolute') {
      const targetCoord = act.spawnPosition || (act as any).spawnAbsoluteCoords || { x: Math.round(sceneBounds.width / 2), y: Math.round(sceneBounds.height / 2) };
      spawnX = Math.round(targetCoord.x - spawnSize.width / 2);
      spawnY = Math.round(targetCoord.y - spawnSize.height / 2);
    } else if (locMode === 'at_event_point' || locMode === 'offset_event_point') {
      const basePt = helpers.eventPosition || (emitter
        ? { x: emitter.position.x + emitter.size.width / 2, y: emitter.position.y + emitter.size.height / 2 }
        : { x: sceneBounds.width / 2, y: sceneBounds.height / 2 });
      if (locMode === 'offset_event_point') {
        const dx = act.spawnOffset?.x ?? 0;
        const dy = act.spawnOffset?.y ?? 0;
        spawnX = Math.round(basePt.x + dx - spawnSize.width / 2);
        spawnY = Math.round(basePt.y + dy - spawnSize.height / 2);
      } else {
        spawnX = Math.round(basePt.x - spawnSize.width / 2);
        spawnY = Math.round(basePt.y - spawnSize.height / 2);
      }
    } else if (emitter) {
      const emitterCenterX = emitter.position.x + emitter.size.width / 2;
      const emitterCenterY = emitter.position.y + emitter.size.height / 2;

      if (locMode === 'offset_subject' || locMode === 'offset_target' || locMode === 'offset_entity') {
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
        // Direct center alignment on emitter ('at_subject' | 'at_target' | 'at_entity')
        spawnX = Math.round(emitterCenterX - spawnSize.width / 2);
        spawnY = Math.round(emitterCenterY - spawnSize.height / 2);
      }
    }

    const spawnedId = helpers.spawnEntity({
      type: spawnType,
      position: { x: Math.max(10, spawnX), y: Math.max(10, spawnY) },
      initialStateId: act.spawnInitialStateId,
      size: spawnSize,
      tags: act.spawnTags,
    });
    if (spawnedId) {
      lastSpawnedEntityId = spawnedId;
    }
    return;
  }

  const targetEntities: Entity[] = [];

  const targetMode: ActionTargetMode = act.targetMode || 'subject';

  if (targetMode === 'subject' && helpers.subject) {
    const liveSubject = liveEntities[helpers.subject.id] || helpers.subject;
    targetEntities.push(liveSubject);
  } else if (targetMode === 'target') {
    if (helpers.target) {
      const liveTarget = liveEntities[helpers.target.id] || helpers.target;
      targetEntities.push(liveTarget);
    } else if (act.targetType) {
      Object.values(liveEntities).forEach((e) => {
        if (e.type === act.targetType) targetEntities.push(e);
      });
    } else if (helpers.subject) {
      // Pour les événements au clic (pas de collision/cible), fallback vers le sujet cliqué
      const liveSubject = liveEntities[helpers.subject.id] || helpers.subject;
      targetEntities.push(liveSubject);
    }
  } else if (targetMode === 'last_spawned') {
    if (lastSpawnedEntityId && liveEntities[lastSpawnedEntityId]) {
      targetEntities.push(liveEntities[lastSpawnedEntityId]);
    }
  } else if (targetMode === 'instance' && act.targetId) {
    const e = liveEntities[act.targetId];
    if (e) targetEntities.push(e);
  } else if (targetMode === 'type' && act.targetType) {
    Object.values(liveEntities).forEach((e) => {
      if (e.type === act.targetType) targetEntities.push(e);
    });
  } else if (targetMode === 'tag' && act.targetTag) {
    const cleanTag = act.targetTag.toLowerCase().trim().replace(/^#/, '');
    Object.values(liveEntities).forEach((e) => {
      if (e.tags?.includes(cleanTag)) targetEntities.push(e);
    });
  } else if (act.targetType && act.targetType !== helpers.subject?.type) {
    // Si l'action cible explicitement un type d'entité distinct
    Object.values(liveEntities).forEach((e) => {
      if (e.type === act.targetType) targetEntities.push(e);
    });
  } else if (act.targetId) {
    // Fallback
    const e = liveEntities[act.targetId];
    if (e) targetEntities.push(e);
  }

  targetEntities.forEach((entity) => {
    // Si un filtre d'état source est spécifié pour l'action, vérifier qu'elle y correspond
    if (act.onlyInStateId && act.onlyInStateId !== '' && entity.currentStateId !== act.onlyInStateId) {
      return;
    }

    if (act.type === 'attach_to_parent') {
      const parentEnt = resolveEntityReference(
        act.parentTargetMode || (helpers.target ? 'target' : 'subject'),
        act.parentEntityId,
        act.parentEntityType,
        act.parentEntityTag,
        helpers.subject,
        helpers.target,
        useSceneStore.getState().entities || liveEntities
      );
      if (parentEnt && parentEnt.id !== entity.id) {
        useSceneStore.getState().setEntityParent(entity.id, parentEnt.id, act.parentOffset);
      }
      return;
    }

    if (act.type === 'detach_parent') {
      useSceneStore.getState().detachEntity(entity.id);
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
      const targetState = act.toggleTargetStateId;

      // Mode 1 : Bascule binaire explicite entre 2 états précis A et B
      if (act.toggleMode === 'two_states' || (stateA && stateB)) {
        if (entity.currentStateId === stateA) {
          nextStateId = stateB;
        } else {
          nextStateId = stateA;
        }
      }
      // Mode 2 : Bascule entre l'état actuel et un état cible
      else if (act.toggleMode === 'current_and_target' || targetState) {
        const dest = targetState || stateB || stateKeys[0];
        const prevKey = `_prev_toggle_state_${entity.id}`;
        if (entity.currentStateId === dest) {
          const fallback = (entity as any)[prevKey] || stateKeys.find((s) => s !== dest) || stateKeys[0];
          nextStateId = fallback;
        } else {
          (entity as any)[prevKey] = entity.currentStateId;
          nextStateId = dest;
        }
      }
      // Mode 3 : Cycle ordonné complet entre TOUS les états
      else if (stateKeys.length > 1) {
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
      const existingBehaviors = entity.behaviors || [];
      const dragBeh = existingBehaviors.find((b) => b.type === 'draggable');
      if (dragBeh) {
        const nextEnabled = !dragBeh.enabled;
        helpers.updateEntityDetails(entity.id, {
          isDraggable: nextEnabled,
          behaviors: existingBehaviors.map((b) =>
            b.id === dragBeh.id ? { ...b, enabled: nextEnabled } : b
          ),
        });
      } else {
        helpers.updateEntityDetails(entity.id, {
          isDraggable: true,
          behaviors: [
            ...existingBehaviors,
            {
              id: `draggable_${Date.now().toString(36)}`,
              type: 'draggable',
              enabled: true,
              throwable: true,
              maxThrowSpeed: 1500,
            },
          ],
        });
      }
    } else if (act.type === 'move_entity') {
      const dist = act.moveDistance ?? 40;
      const dirMode = act.moveDirectionMode || 'cardinal';
      let dx = 0;
      let dy = 0;

      if (dirMode === 'cardinal') {
        const card = act.moveCardinal || 'right';
        if (card === 'right') dx = dist;
        else if (card === 'left') dx = -dist;
        else if (card === 'up') dy = -dist;
        else if (card === 'down') dy = dist;
      } else if (dirMode === 'angle') {
        const rad = ((act.moveAngle ?? 0) * Math.PI) / 180;
        dx = Math.cos(rad) * dist;
        dy = Math.sin(rad) * dist;
      } else if (dirMode === 'facing') {
        const rot = entity.states[entity.currentStateId]?.rotation || 0;
        const rad = (rot * Math.PI) / 180;
        const sign = entity.flipX ? -1 : 1;
        dx = Math.cos(rad) * dist * sign;
        dy = Math.sin(rad) * dist * sign;
      } else if (dirMode === 'toward_target' || dirMode === 'away_target') {
        const ex = entity.position.x + entity.size.width / 2;
        const ey = entity.position.y + entity.size.height / 2;
        let rx: number | null = null;
        let ry: number | null = null;
        if (act.moveTargetMode === 'mouse') {
          if (helpers.eventPosition) {
            rx = helpers.eventPosition.x;
            ry = helpers.eventPosition.y;
          }
        } else {
          const refMode = act.moveTargetMode || (helpers.target ? 'target' : 'subject');
          const ref = resolveEntityReference(
            refMode,
            act.moveTargetEntityId,
            act.moveTargetEntityType,
            act.moveTargetTag,
            helpers.subject,
            helpers.target,
            liveEntities
          );
          if (ref && ref.id !== entity.id) {
            rx = ref.position.x + ref.size.width / 2;
            ry = ref.position.y + ref.size.height / 2;
          }
        }
        if (rx !== null && ry !== null) {
          const len = Math.hypot(rx - ex, ry - ey);
          if (len > 0.001) {
            const mult = dirMode === 'away_target' ? -1 : 1;
            dx = ((rx - ex) / len) * dist * mult;
            dy = ((ry - ey) / len) * dist * mult;
          }
        }
      }

      if (dx !== 0 || dy !== 0) {
        const applyMode = act.moveApplyMode || 'instant';
        const appliedImpulse = applyEntityMoveAction(entity.id, dx, dy, applyMode);
        if (!appliedImpulse || applyMode === 'instant') {
          useSceneStore.getState().updateEntityPosition(entity.id, {
            x: Math.round((entity.position.x + dx) * 10) / 10,
            y: Math.round((entity.position.y + dy) * 10) / 10,
          });
        }
      }
    } else if (act.type === 'delete_entity') {
      helpers.deleteEntity(entity.id);
    }
  });
}
