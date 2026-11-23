import { create } from 'zustand';
import {
  Entity,
  EntityId,
  EntityPivot,
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
  UnifiedDrawTool,
  AnimationFrame,
  AnimationLoopMode,
  AutoSaveDraft,
  StateFolder,
  EntityGroup,
  SpawnRandomZone,
  ProjectScene,
  SceneTransitionType,
  SceneCameraConfig,
  ParticleEffectPreset,
  SetEntityEnabledScope,
  SnapAnchorPreset,
  SnapBehaviorConfig,
} from '../types';
import { getEntityWorldColliderBounds } from '../utils/collider';
import { DEFAULT_SCENE_CAMERA_CONFIG, resolveWorldBounds } from '../utils/cameraSolver';
import {
  initPlayCameraRuntime,
  resetPlayCameraRuntime,
  getPlayVisibleViewportRect,
} from '../utils/cameraRuntime';
import {
  captureStageSnapshot,
  releaseTransitionSnapshot,
  clearAllTransitionSnapshots,
} from '../utils/transitionSnapshotCache';
import {
  resetMatterPhysicsRuntime,
  checkEntityAgainstColliderLayer,
  getActiveDragPositions,
  setActiveDragPosition,
} from '../utils/matterPhysicsEngine';
import {
  clearParticles,
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
  loadAutoSaveDraftFromDB,
  saveAutoSaveDraftInDB,
  clearAutoSaveDraftFromDB,
  loadParticleCollectionFromDB,
  saveParticleCollectionInDB,
} from '../utils/localStorageDB';
import defaultCursorPack from '../data/defaultCursorPack.json';
import { DEFAULT_GIZMO_SETTINGS, resolveGizmoSettings } from '../utils/gizmoHelpers';
import {
  EMPTY_RECORD,
  EMPTY_LIST,
  DEFAULT_SCENE_BOUNDS,
  DEFAULT_PROJECT_PALETTE,
  initialSceneLayerGroups,
  initialEntities,
  defaultCustomArchetypes,
  initialFolders,
  initialRules,
} from './storeDefaults';
import {
  wouldCreateParentCycle,
  collectDescendantIds,
  resolveEntityHierarchyScopeIds,
  computeRelativeParentOffset,
  computeChildWorldFromParent,
  computeParentOffsetFromWorldPin,
} from './parentingHelpers';
import { computeSnapCustomAnchorFromWorld } from '../utils/physics/snapSolver';
import {
  matchesEntityFilter,
  checkCollision,
  getCollisionContactPoint,
  findTargetEntityOrArchetype,
  checkDirectionalCollisionSide,
  computeBoundaryHitEdges,
} from './collisionHelpers';
import {
  RULE_COOLDOWN_MS,
  ruleCooldowns,
  preEventAutoRevertStates,
  lastCollisionContacts,
  prevEvaluatedVariables,
  activeDelayTimers,
  getIsEvaluatingRules,
  setIsEvaluatingRules,
  clearPlayRuntimeState,
  handleCollisionPair,
  executeRuleActions,
  registerRuleEngineStoreBridge,
} from './ruleExecutionEngine';
import {
  canRuleFireWithGate,
  markContinuousConditionFalse,
  recordRuleFired,
  resetPlaySessionClock,
} from './triggerGate';
import { buildPhysicsTestScene, PhysicsTestSceneId } from './physicsTestScenes';

export {
  EMPTY_RECORD,
  EMPTY_LIST,
  DEFAULT_SCENE_BOUNDS,
  DEFAULT_PROJECT_PALETTE,
  initialSceneLayerGroups,
  matchesEntityFilter,
};

// Clé de stockage fallback (collection migrée vers IndexedDB)
const COLLECTION_STORAGE_KEY = 'atelier-vivant-custom-entity-collection-v1';

export const DEFAULT_SCENE_ID = 'scene-1';

function normalizeLayerGroups(raw: any): SceneLayerGroup[] {
  const base: SceneLayerGroup[] =
    Array.isArray(raw) && raw.length > 0
      ? JSON.parse(JSON.stringify(raw))
      : JSON.parse(JSON.stringify(initialSceneLayerGroups));
  const normalized = base.map((g) => ({
    ...g,
    layers: (g.layers || []).map((l) => ({
      ...l,
      coordinateSpace:
        l.coordinateSpace || ((l.vectorPaths?.length || 0) === 0 ? 'world' : 'legacy_200'),
    })),
  }));
  if (!normalized.some((g) => g.kind === 'collider')) {
    normalized.splice(1, 0, {
      id: 'group-col',
      name: 'Colliders de Décor (Murs / Sols)',
      kind: 'collider',
      isCollapsed: true,
      layers: [],
    });
  }
  return normalized;
}

function buildDefaultScene(
  id: string = DEFAULT_SCENE_ID,
  name: string = 'Scène 1',
  overrides?: Partial<ProjectScene>
): ProjectScene {
  return {
    id,
    name,
    entities: overrides?.entities ? JSON.parse(JSON.stringify(overrides.entities)) : {},
    entityOrder: overrides?.entityOrder
      ? [...overrides.entityOrder]
      : overrides?.entities
      ? Object.keys(overrides.entities)
      : [],
    rules: overrides?.rules ? JSON.parse(JSON.stringify(overrides.rules)) : [],
    folders: overrides?.folders
      ? JSON.parse(JSON.stringify(overrides.folders))
      : JSON.parse(JSON.stringify(initialFolders)),
    layerGroups: overrides?.layerGroups
      ? normalizeLayerGroups(overrides.layerGroups)
      : JSON.parse(JSON.stringify(initialSceneLayerGroups)),
    backgroundColor: overrides?.backgroundColor || '#ffffff',
    camera: overrides?.camera
      ? { ...DEFAULT_SCENE_CAMERA_CONFIG, ...overrides.camera }
      : { ...DEFAULT_SCENE_CAMERA_CONFIG },
  };
}

function syncActiveSceneIntoScenes(state: {
  scenes: ProjectScene[];
  activeSceneId: string;
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  rules: DynamicRule[];
  folders: RuleFolder[];
  layerGroups: SceneLayerGroup[];
  backgroundColor?: string;
  camera?: SceneCameraConfig;
}): ProjectScene[] {
  const currentSnapshot: ProjectScene = {
    id: state.activeSceneId || DEFAULT_SCENE_ID,
    name:
      state.scenes.find((s) => s.id === state.activeSceneId)?.name || 'Scène 1',
    entities: JSON.parse(JSON.stringify(state.entities || {})),
    entityOrder: [...(state.entityOrder || Object.keys(state.entities || {}))],
    rules: JSON.parse(JSON.stringify(state.rules || [])),
    folders: JSON.parse(JSON.stringify(state.folders || [])),
    layerGroups: JSON.parse(JSON.stringify(state.layerGroups || [])),
    backgroundColor: state.backgroundColor || '#ffffff',
    camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(state.camera || {}) },
  };
  const idx = state.scenes.findIndex((s) => s.id === currentSnapshot.id);
  if (idx === -1) {
    return [...state.scenes, currentSnapshot];
  }
  return state.scenes.map((s, i) => (i === idx ? currentSnapshot : s));
}

export interface SceneHistorySnapshot {
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  layerGroups: SceneLayerGroup[];
  rules: DynamicRule[];
  backgroundColor?: string;
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
}

function captureSceneSnapshot(state: {
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  layerGroups: SceneLayerGroup[];
  rules: DynamicRule[];
  backgroundColor?: string;
  selectedEntityId: EntityId | null;
  selectedLayerId: string | null;
}): SceneHistorySnapshot {
  return {
    entities: JSON.parse(JSON.stringify(state.entities)),
    entityOrder: [...(state.entityOrder || Object.keys(state.entities))],
    layerGroups: JSON.parse(JSON.stringify(state.layerGroups || [])),
    rules: JSON.parse(JSON.stringify(state.rules || [])),
    backgroundColor: state.backgroundColor || '#ffffff',
    selectedEntityId: state.selectedEntityId,
    selectedLayerId: state.selectedLayerId,
  };
}

function loadLocalCollectionFromStorage(): Record<string, Entity> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(COLLECTION_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
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
  entityGroups: EntityGroup[];
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  addCustomParticle: (preset: Omit<CustomParticlePreset, 'id' | 'createdAt'>) => string;
  updateCustomParticle: (id: string, partial: Partial<CustomParticlePreset>) => void;
  deleteCustomParticle: (id: string) => void;
  projectParticlePresets: ParticleEffectPreset[];
  localParticleCollection: Record<string, ParticleEffectPreset>;
  saveProjectParticlePreset: (
    preset: Omit<ParticleEffectPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => string;
  deleteProjectParticlePreset: (id: string) => void;
  saveParticleToLocalCollection: (
    preset: Omit<ParticleEffectPreset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => string;
  deleteParticleFromLocalCollection: (id: string) => void;
  importEmbeddedParticleSprites: (sprites?: CustomParticlePreset[]) => Record<string, string>;
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
  editSceneBounds: Size;
  setEditSceneBounds: (bounds: Size) => void;
  entityOrder: EntityId[];
  scenes: ProjectScene[];
  activeSceneId: string;
  backgroundColor: string;
  camera: SceneCameraConfig;
  editorCamera: { x: number; y: number; zoom: number };
  editorPanToolActive: boolean;
  updateSceneCamera: (partial: Partial<SceneCameraConfig>) => void;
  setEditorCamera: (partial: Partial<{ x: number; y: number; zoom: number }>) => void;
  resetEditorCamera: () => void;
  setEditorPanToolActive: (active: boolean) => void;
  snapshotScenes: ProjectScene[] | null;
  snapshotActiveSceneId: string | null;
  activeSceneTransition: {
    id: string;
    type: SceneTransitionType;
    duration: number;
    phase: 'out' | 'in';
    outgoingSnapshotKey?: string;
  } | null;
  createScene: (name?: string) => string;
  switchScene: (sceneId: string) => void;
  renameScene: (sceneId: string, name: string) => void;
  duplicateScene: (sceneId: string) => string;
  deleteScene: (sceneId: string) => boolean;
  setSceneBackgroundColor: (color: string) => void;
  changeSceneInPlay: (targetSceneId: string, transition?: SceneTransitionType, duration?: number) => void;
  restartSceneInPlay: (transition?: SceneTransitionType, duration?: number) => void;
  snapshotEntities: Record<EntityId, Entity> | null;
  snapshotEntityOrder: EntityId[] | null;
  snapshotRules: DynamicRule[] | null;
  settings: AppSettings;
  currentSlotId: string | null;
  collapsedRuleIds: Record<string, boolean>;
  toggleRuleCollapse: (ruleId: string) => void;
  expandedBehaviorCards: Record<string, boolean>;
  setBehaviorCardExpanded: (cardKey: string, expanded: boolean) => void;
  ruleBookPage: number;
  setRuleBookPage: (page: number) => void;
  gameScore: number;
  initialGameVariables: Record<string, number>;
  gameVariables: Record<string, number>;
  setInitialGameVariable: (name: string, value: number) => void;
  deleteInitialGameVariable: (name: string) => void;
  setGameVariable: (name: string, value: number) => void;
  batchSetGameVariables: (updates: Record<string, number>) => void;
  triggerKeyEvent: (keyName: string, phase?: 'down' | 'up', keyCode?: string) => void;

  // Direct scene canvas drawing tools state
  drawingTool: UnifiedDrawTool;
  drawingStrokeColor: string;
  drawingStrokeColorId?: string;
  drawingFillColor: string;
  drawingFillColorId?: string;
  drawingStrokeWidth: number;
  drawingShowGrid: boolean;
  drawingSnapToGrid: boolean;
  setDrawingTool: (tool: UnifiedDrawTool) => void;
  setDrawingStrokeColor: (color: string, colorId?: string) => void;
  setDrawingFillColor: (color: string, colorId?: string) => void;
  setDrawingStrokeWidth: (width: number) => void;
  setDrawingShowGrid: (show: boolean) => void;
  setDrawingSnapToGrid: (snap: boolean) => void;
  layerDrawingActions: {
    layerId: string;
    polyPointsCount: number;
    selectedCount: number;
    finishPolyline: (close?: boolean) => void;
    cancelPolyline: () => void;
    duplicateSelected: () => void;
    deleteSelected: () => void;
  } | null;
  setLayerDrawingActions: (
    actions: {
      layerId: string;
      polyPointsCount: number;
      selectedCount: number;
      finishPolyline: (close?: boolean) => void;
      cancelPolyline: () => void;
      duplicateSelected: () => void;
      deleteSelected: () => void;
    } | null
  ) => void;

  // Interactive live canvas coordinate picker for Rule SpawnLocationPicker
  spawnCanvasPick: {
    requestId: string;
    mode: 'absolute' | 'offset' | 'random_zone';
    snapToGrid: boolean;
    gridStep: number;
    refCenter?: { x: number; y: number };
    spawnSize?: { width: number; height: number };
    initialZone?: SpawnRandomZone;
  } | null;
  spawnCanvasPickResult: {
    requestId: string;
    x: number;
    y: number;
    zone?: SpawnRandomZone;
  } | null;
  startSpawnCanvasPick: (req: {
    requestId: string;
    mode: 'absolute' | 'offset' | 'random_zone';
    snapToGrid: boolean;
    gridStep: number;
    refCenter?: { x: number; y: number };
    spawnSize?: { width: number; height: number };
    initialZone?: SpawnRandomZone;
  }) => void;
  updateSpawnCanvasPickSnap: (snapToGrid: boolean, gridStep?: number) => void;
  completeSpawnCanvasPick: (x: number, y: number, zone?: SpawnRandomZone) => void;
  cancelSpawnCanvasPick: () => void;
  clearSpawnCanvasPickResult: (requestId?: string) => void;

  // Placement tactile (iPad/tablette) depuis la galerie d'entités vers la scène
  pendingCatalogSpawnType: EntityType | null;
  setPendingCatalogSpawnType: (type: EntityType | null) => void;

  // Interactive live canvas joint attachment pin picker & direct pin drag
  jointCanvasPick: {
    childId: EntityId;
    parentId: EntityId;
  } | null;
  startJointCanvasPick: (childId: EntityId) => void;
  cancelJointCanvasPick: () => void;
  completeJointCanvasPick: (worldX: number, worldY: number) => void;
  moveJointAttachmentPin: (childId: EntityId, worldX: number, worldY: number, skipHistory?: boolean) => void;

  // Interactive live canvas Snap custom pin picker & direct pin drag
  snapPinCanvasPick: {
    entityId: EntityId;
    behaviorId: string;
    stateId?: StateId;
    pinRole: 'source' | 'target';
    referenceEntityId: EntityId;
  } | null;
  startSnapPinCanvasPick: (req: {
    entityId: EntityId;
    behaviorId: string;
    stateId?: StateId;
    pinRole: 'source' | 'target';
    referenceEntityId: EntityId;
  }) => void;
  cancelSnapPinCanvasPick: () => void;
  completeSnapPinCanvasPick: (worldX: number, worldY: number) => void;
  moveSnapCustomPin: (params: {
    entityId: EntityId;
    behaviorId: string;
    stateId?: StateId;
    pinRole: 'source' | 'target';
    referenceEntityId: EntityId;
    worldX: number;
    worldY: number;
    skipHistory?: boolean;
  }) => void;

  updateSettings: (partial: Partial<AppSettings>) => void;
  setAspectRatio: (ratio: SceneAspectRatio) => void;

  // Scene Layers & Groups management
  addLayerGroup: (name: string, kind?: SceneLayerKind) => string;
  deleteLayerGroup: (groupId: string) => void;
  toggleLayerGroupCollapse: (groupId: string) => void;
  addLayerToGroup: (groupId: string, name?: string) => string;
  deleteLayer: (layerId: string) => void;
  updateLayer: (layerId: string, partial: Partial<SceneLayer>) => void;
  setLayerVectorPaths: (layerId: string, vectorPaths: VectorPath[], skipHistory?: boolean) => void;
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
  updateEntityDetails: (
    id: EntityId,
    partial: Partial<Entity>,
    options?: { instanceOnly?: boolean }
  ) => void;
  setEntityDisabledCascade: (id: EntityId, disabled: boolean, scope?: SetEntityEnabledScope) => void;
  addTagToEntity: (id: EntityId, tag: string) => void;
  removeTagFromEntity: (id: EntityId, tag: string) => void;
  updateStateProperties: (entityId: EntityId, stateId: StateId, partial: Partial<EntityState>) => void;
  updateEntityBehaviors: (entityId: EntityId, behaviors: EntityBehavior[]) => void;
  updateStateBehaviorOverride: (entityId: EntityId, stateId: StateId, behaviorId: string, override: BehaviorOverride) => void;
  removeStateBehaviorOverride: (entityId: EntityId, stateId: StateId, behaviorId: string) => void;
  batchUpdateEntityTransforms: (
    updates: Record<
      EntityId,
      {
        position?: Position;
        rotation?: number;
        flipX?: boolean;
        runtimeTilt?: number;
        runtimeJiggleAngle?: number;
        runtimeScaleX?: number;
        runtimeScaleY?: number;
        runtimePivot?: EntityPivot | null;
        runtimeAnimFrameIndex?: number | null;
        runtimeAnimScale?: number;
        runtimeAnimRotation?: number;
        runtimeAnimOpacity?: number;
      }
    >
  ) => void;
  setEntityParent: (childId: EntityId, parentId: EntityId | null, customOffset?: ParentOffset) => void;
  updateEntityParentOffset: (childId: EntityId, partial: Partial<ParentOffset>) => void;
  detachEntity: (childId: EntityId) => void;
  addStateToEntity: (entityId: EntityId, name?: string, folderId?: string) => string;
  duplicateStateInEntity: (entityId: EntityId, stateId: StateId) => string;
  removeStateFromEntity: (entityId: EntityId, stateId: StateId) => void;
  addStateFolder: (entityId: EntityId, name: string) => string;
  updateStateFolder: (entityId: EntityId, folderId: string, partial: Partial<Pick<StateFolder, 'name' | 'isCollapsed'>>) => void;
  deleteStateFolder: (entityId: EntityId, folderId: string) => void;
  setStateFolder: (entityId: EntityId, stateId: StateId, folderId: string | undefined) => void;
  addEntityGroup: (name: string) => string;
  updateEntityGroup: (groupId: string, partial: Partial<Pick<EntityGroup, 'name' | 'isCollapsed'>>) => void;
  deleteEntityGroup: (groupId: string) => void;
  assignEntityTypeToGroup: (entityType: string, groupId: string | null) => void;
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
    pivot?: EntityPivot;
    frames?: AnimationFrame[];
    frameRate?: number;
    animationLoop?: AnimationLoopMode;
  }) => void;
  duplicateCustomArchetype: (sourceType: string) => string;
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
  loadTestScenePreset: (presetId: PhysicsTestSceneId) => void;

  // Project Import / Export
  exportProject: () => ProjectExportData;
  importProject: (data: any) => { success: boolean; message?: string };

  // Project Slots (Stockage local IndexedDB sur la machine de l'utilisateur + quota ajustable)
  projectSlots: ProjectSlot[];
  storageHydrated: boolean;
  quotaLimitMb: number;
  autoSaveDraft: AutoSaveDraft | null;
  hasRecoveryDraftOnBoot: boolean;
  lastAutoSaveAt: number | null;
  triggerAutoSave: () => Promise<void>;
  restoreAutoSaveDraft: () => { success: boolean; message: string };
  discardAutoSaveDraft: () => void;
  dismissRecoveryBanner: () => void;
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
  reorderRuleActions: (
    ruleId: string,
    sourceActionId: string,
    targetActionId: string,
    position?: 'before' | 'after'
  ) => void;
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
  triggerJointBreak: (childId: EntityId, parentId: EntityId, breakPoint?: Position) => void;
  triggerCameraFollowEvent: (targetEntityId: EntityId) => void;
  triggerTargetArrivedEvent: (subjectId: EntityId, targetEntityId?: EntityId, eventPosition?: Position) => void;
  triggerSnapEvent: (
    subjectId: EntityId,
    targetEntityId: EntityId | undefined,
    phase: 'enter' | 'exit',
    eventPosition?: Position
  ) => void;
  evaluateRules: () => void;
  evaluateRulesWithTemp: (tempPositions?: Record<EntityId, Position>) => void;
}

// Defaults, collision helpers, and rule execution engine moved to storeDefaults.ts, collisionHelpers.ts, and ruleExecutionEngine.ts.
export function reorderRuleActionsInList(
  actions: RuleAction[],
  sourceActionId: string,
  targetActionId: string,
  position: 'before' | 'after' = 'before'
): RuleAction[] {
  if (!sourceActionId || sourceActionId === targetActionId) return actions;
  const next = [...actions];
  const fromIdx = next.findIndex((a) => a.id === sourceActionId);
  if (fromIdx === -1) return actions;
  const [moved] = next.splice(fromIdx, 1);
  const toIdx = next.findIndex((a) => a.id === targetActionId);
  if (toIdx === -1) {
    next.push(moved);
  } else {
    const insertIdx = position === 'after' ? toIdx + 1 : toIdx;
    next.splice(insertIdx, 0, moved);
  }
  return next;
}

export const useSceneStore = create<SceneState>()((set, get) => ({
  entities: {},
  customArchetypes: {},
  localEntityCollection: loadLocalCollectionFromStorage(),
  projectSlots: [],
  storageHydrated: false,
  quotaLimitMb: getSoftQuotaMb(),
  autoSaveDraft: null,
  hasRecoveryDraftOnBoot: false,
  lastAutoSaveAt: null,
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
    const nextEntities = JSON.parse(JSON.stringify(targetSnap.entities));
    const nextOrder = [...targetSnap.entityOrder];
    const nextLayers = JSON.parse(JSON.stringify(targetSnap.layerGroups));
    const nextRules = JSON.parse(JSON.stringify(targetSnap.rules));
    const nextBg = targetSnap.backgroundColor || '#ffffff';
    set({
      entities: nextEntities,
      entityOrder: nextOrder,
      layerGroups: nextLayers,
      rules: nextRules,
      backgroundColor: nextBg,
      scenes: syncActiveSceneIntoScenes({
        ...state,
        entities: nextEntities,
        entityOrder: nextOrder,
        layerGroups: nextLayers,
        rules: nextRules,
        backgroundColor: nextBg,
      }),
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
    const nextEntities = JSON.parse(JSON.stringify(targetSnap.entities));
    const nextOrder = [...targetSnap.entityOrder];
    const nextLayers = JSON.parse(JSON.stringify(targetSnap.layerGroups));
    const nextRules = JSON.parse(JSON.stringify(targetSnap.rules));
    const nextBg = targetSnap.backgroundColor || '#ffffff';
    set({
      entities: nextEntities,
      entityOrder: nextOrder,
      layerGroups: nextLayers,
      rules: nextRules,
      backgroundColor: nextBg,
      scenes: syncActiveSceneIntoScenes({
        ...state,
        entities: nextEntities,
        entityOrder: nextOrder,
        layerGroups: nextLayers,
        rules: nextRules,
        backgroundColor: nextBg,
      }),
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
      const [slots, coll, particleColl, draft] = await Promise.all([
        loadAllSlotsFromDB(),
        loadCollectionFromDB(),
        loadParticleCollectionFromDB(),
        loadAutoSaveDraftFromDB(),
      ]);
      const hasContentInDraft = Boolean(
        draft &&
          (draft.entitiesCount > 0 ||
            draft.rulesCount > 0 ||
            (draft.data?.scenes?.length || 1) > 1 ||
            draft.data?.layerGroups?.some((g) => g.layers?.some((l) => (l.vectorPaths?.length || 0) > 0)) ||
            draft.data?.scenes?.some(
              (sc) =>
                Object.keys(sc.entities || {}).length > 0 ||
                (sc.rules?.length || 0) > 0 ||
                sc.layerGroups?.some((g) => g.layers?.some((l) => (l.vectorPaths?.length || 0) > 0))
            ))
      );
      set((state) => ({
        projectSlots: slots,
        localEntityCollection:
          Object.keys(coll).length > 0 ? coll : state.localEntityCollection,
        localParticleCollection:
          particleColl && typeof particleColl === 'object' ? particleColl : state.localParticleCollection,
        autoSaveDraft: draft,
        lastAutoSaveAt: draft?.updatedAt || null,
        hasRecoveryDraftOnBoot: hasContentInDraft,
        storageHydrated: true,
      }));
    } catch (err) {
      console.error('Failed to hydrate IndexedDB storage:', err);
      set({ storageHydrated: true });
    }
  },

  triggerAutoSave: async () => {
    const state = get();
    if (state.appMode !== 'edit' || state.settings.autoSaveEnabled === false || !state.storageHydrated) {
      return;
    }
    const currentData = state.exportProject();
    const entitiesCount = Object.keys(currentData.entities || {}).length;
    const rulesCount = (currentData.rules || []).length;
    const hasStrokes = Boolean(
      currentData.layerGroups?.some((g) => g.layers?.some((l) => (l.vectorPaths?.length || 0) > 0))
    );
    const hasOtherSceneContent = Boolean(
      (currentData.scenes?.length || 1) > 1 ||
        currentData.scenes?.some(
          (sc) =>
            Object.keys(sc.entities || {}).length > 0 ||
            (sc.rules?.length || 0) > 0 ||
            sc.layerGroups?.some((g) => g.layers?.some((l) => (l.vectorPaths?.length || 0) > 0))
        )
    );
    if (entitiesCount === 0 && rulesCount === 0 && !hasStrokes && !hasOtherSceneContent && !state.autoSaveDraft) {
      return;
    }
    const sizeBytes = estimateJsonBytes(currentData);
    const activeSlot = state.currentSlotId
      ? state.projectSlots.find((s) => s.id === state.currentSlotId)
      : undefined;
    const draft: AutoSaveDraft = {
      updatedAt: Date.now(),
      sourceSlotId: state.currentSlotId,
      sourceSlotName: activeSlot?.name || null,
      entitiesCount,
      rulesCount,
      sizeBytes,
      data: currentData,
    };
    await saveAutoSaveDraftInDB(draft);
    set({
      autoSaveDraft: draft,
      lastAutoSaveAt: draft.updatedAt,
    });
  },

  restoreAutoSaveDraft: () => {
    const draft = get().autoSaveDraft;
    if (!draft || !draft.data) {
      return { success: false, message: 'Aucun brouillon Auto-Save disponible.' };
    }
    const res = get().importProject(draft.data);
    if (res.success) {
      set({
        currentSlotId: draft.sourceSlotId || null,
        hasRecoveryDraftOnBoot: false,
      });
      return { success: true, message: 'Brouillon Auto-Save restauré avec succès !' };
    }
    return { success: false, message: res.message || 'Impossible de restaurer le brouillon.' };
  },

  discardAutoSaveDraft: () => {
    set({ autoSaveDraft: null, hasRecoveryDraftOnBoot: false, lastAutoSaveAt: null });
    clearAutoSaveDraftFromDB();
  },

  dismissRecoveryBanner: () => set({ hasRecoveryDraftOnBoot: false }),

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
  entityGroups: [],
  customSounds: [],
  customParticles: [],
  projectParticlePresets: [],
  localParticleCollection: {},
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
  editSceneBounds: { width: 800, height: 500 },
  setEditSceneBounds: (bounds) => {
    const w = Math.max(100, Math.round(bounds.width));
    const h = Math.max(100, Math.round(bounds.height));
    const prev = get().editSceneBounds;
    if (prev.width !== w || prev.height !== h) {
      set({ editSceneBounds: { width: w, height: h } });
    }
  },
  entityOrder: ['plant-1', 'apple-1'],
  layerGroups: JSON.parse(JSON.stringify(initialSceneLayerGroups)),
  selectedLayerId: null,
  scenes: [
    buildDefaultScene(DEFAULT_SCENE_ID, 'Scène 1', {
      entities: {},
      entityOrder: ['plant-1', 'apple-1'],
      rules: [],
      folders: initialFolders,
      layerGroups: initialSceneLayerGroups,
      backgroundColor: '#ffffff',
    }),
  ],
  activeSceneId: DEFAULT_SCENE_ID,
  backgroundColor: '#ffffff',
  camera: { ...DEFAULT_SCENE_CAMERA_CONFIG },
  editorCamera: { x: 0, y: 0, zoom: 1 },
  editorPanToolActive: false,
  snapshotScenes: null,
  snapshotActiveSceneId: null,
  activeSceneTransition: null,
  snapshotEntities: null,
  snapshotEntityOrder: null,
  snapshotRules: null,
  currentSlotId: null,

  updateSceneCamera: (partial) => {
    set((state) => {
      const nextCamera: SceneCameraConfig = {
        ...DEFAULT_SCENE_CAMERA_CONFIG,
        ...state.camera,
        ...partial,
      };
      return {
        camera: nextCamera,
        scenes: state.scenes.map((s) =>
          s.id === state.activeSceneId ? { ...s, camera: nextCamera } : s
        ),
      };
    });
  },

  setEditorCamera: (partial) => {
    set((state) => {
      const nextZoom =
        partial.zoom !== undefined
          ? Math.max(0.25, Math.min(3, Math.round(partial.zoom * 1000) / 1000))
          : state.editorCamera.zoom;
      return {
        editorCamera: {
          x: partial.x !== undefined && Number.isFinite(partial.x) ? partial.x : state.editorCamera.x,
          y: partial.y !== undefined && Number.isFinite(partial.y) ? partial.y : state.editorCamera.y,
          zoom: nextZoom,
        },
      };
    });
  },

  resetEditorCamera: () => {
    set({ editorCamera: { x: 0, y: 0, zoom: 1 } });
  },

  setEditorPanToolActive: (active) => {
    set({ editorPanToolActive: active });
  },

  createScene: (name) => {
    const state = get();
    const syncedScenes = syncActiveSceneIntoScenes(state);
    const newId = `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const nextIdx = syncedScenes.length + 1;
    const newScene = buildDefaultScene(
      newId,
      name?.trim() || `Scène ${nextIdx}`
    );
    const nextScenes = [...syncedScenes, newScene];
    set({
      scenes: nextScenes,
      activeSceneId: newId,
      entities: JSON.parse(JSON.stringify(newScene.entities)),
      entityOrder: [...newScene.entityOrder],
      rules: JSON.parse(JSON.stringify(newScene.rules)),
      folders: JSON.parse(JSON.stringify(newScene.folders)),
      layerGroups: JSON.parse(JSON.stringify(newScene.layerGroups)),
      backgroundColor: newScene.backgroundColor || '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(newScene.camera || {}) },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      selectedEntityId: null,
      selectedLayerId: null,
      activeCollisions: {},
      sceneUndoStack: [],
      sceneRedoStack: [],
    });
    return newId;
  },

  switchScene: (sceneId) => {
    const state = get();
    if (state.appMode !== 'edit' || sceneId === state.activeSceneId) return;
    const syncedScenes = syncActiveSceneIntoScenes(state);
    const target = syncedScenes.find((s) => s.id === sceneId);
    if (!target) return;
    const targetEntities = JSON.parse(JSON.stringify(target.entities || {}));
    const targetOrder =
      target.entityOrder && target.entityOrder.length > 0
        ? [...target.entityOrder]
        : Object.keys(targetEntities);
    set({
      scenes: syncedScenes,
      activeSceneId: target.id,
      entities: targetEntities,
      entityOrder: targetOrder,
      rules: JSON.parse(JSON.stringify(target.rules || [])),
      folders: JSON.parse(JSON.stringify(target.folders || initialFolders)),
      layerGroups: normalizeLayerGroups(target.layerGroups),
      backgroundColor: target.backgroundColor || '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(target.camera || {}) },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      selectedEntityId: targetOrder[0] || null,
      selectedLayerId: null,
      activeCollisions: {},
      sceneUndoStack: [],
      sceneRedoStack: [],
    });
  },

  renameScene: (sceneId, name) => {
    const clean = name.trim();
    if (!clean) return;
    set((state) => ({
      scenes: state.scenes.map((s) => (s.id === sceneId ? { ...s, name: clean } : s)),
    }));
  },

  duplicateScene: (sceneId) => {
    const state = get();
    const syncedScenes = syncActiveSceneIntoScenes(state);
    const source = syncedScenes.find((s) => s.id === sceneId);
    if (!source) return '';
    const newId = `scene-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;
    const cloned: ProjectScene = {
      ...JSON.parse(JSON.stringify(source)),
      id: newId,
      name: `${source.name.replace(/\(Copie.*?\)/g, '').trim()} (Copie)`,
    };
    const nextScenes = [...syncedScenes, cloned];
    const targetOrder =
      cloned.entityOrder && cloned.entityOrder.length > 0
        ? [...cloned.entityOrder]
        : Object.keys(cloned.entities || {});
    set({
      scenes: nextScenes,
      activeSceneId: newId,
      entities: JSON.parse(JSON.stringify(cloned.entities || {})),
      entityOrder: targetOrder,
      rules: JSON.parse(JSON.stringify(cloned.rules || [])),
      folders: JSON.parse(JSON.stringify(cloned.folders || initialFolders)),
      layerGroups: normalizeLayerGroups(cloned.layerGroups),
      backgroundColor: cloned.backgroundColor || '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(cloned.camera || {}) },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      selectedEntityId: targetOrder[0] || null,
      selectedLayerId: null,
      activeCollisions: {},
      sceneUndoStack: [],
      sceneRedoStack: [],
    });
    return newId;
  },

  deleteScene: (sceneId) => {
    const state = get();
    const syncedScenes = syncActiveSceneIntoScenes(state);
    if (syncedScenes.length <= 1) return false;
    const idx = syncedScenes.findIndex((s) => s.id === sceneId);
    if (idx === -1) return false;
    const remaining = syncedScenes.filter((s) => s.id !== sceneId);
    if (state.activeSceneId === sceneId) {
      const nextScene = remaining[Math.max(0, idx - 1)] || remaining[0];
      const nextEntities = JSON.parse(JSON.stringify(nextScene.entities || {}));
      const nextOrder =
        nextScene.entityOrder && nextScene.entityOrder.length > 0
          ? [...nextScene.entityOrder]
          : Object.keys(nextEntities);
      set({
        scenes: remaining,
        activeSceneId: nextScene.id,
        entities: nextEntities,
        entityOrder: nextOrder,
        rules: JSON.parse(JSON.stringify(nextScene.rules || [])),
        folders: JSON.parse(JSON.stringify(nextScene.folders || initialFolders)),
        layerGroups: normalizeLayerGroups(nextScene.layerGroups),
        backgroundColor: nextScene.backgroundColor || '#ffffff',
        camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(nextScene.camera || {}) },
        editorCamera: { x: 0, y: 0, zoom: 1 },
        selectedEntityId: nextOrder[0] || null,
        selectedLayerId: null,
        activeCollisions: {},
        sceneUndoStack: [],
        sceneRedoStack: [],
      });
    } else {
      set({ scenes: remaining });
    }
    return true;
  },

  setSceneBackgroundColor: (color) => {
    const clean = color || '#ffffff';
    set((state) => ({
      backgroundColor: clean,
      scenes: state.scenes.map((s) =>
        s.id === state.activeSceneId ? { ...s, backgroundColor: clean } : s
      ),
    }));
  },

  changeSceneInPlay: (targetSceneId, transition = 'fade', duration = 0.45) => {
    const initialState = get();
    if (initialState.appMode !== 'play') return;
    const baseScenes = initialState.snapshotScenes || initialState.scenes;
    const targetExists = baseScenes.some((s) => s.id === targetSceneId);
    if (!targetExists) return;
    if (initialState.activeSceneTransition) return;

    const commitSwap = () => {
      const cur = get();
      if (cur.appMode !== 'play') return;
      const curBaseScenes = cur.snapshotScenes || cur.scenes;
      // Conserver les éventuelles règles/dossiers modifiés en Play sur la scène sortante
      const updatedSnapshotScenes = curBaseScenes.map((s) =>
        s.id === cur.activeSceneId
          ? {
              ...s,
              rules: JSON.parse(JSON.stringify(cur.rules)),
              folders: JSON.parse(JSON.stringify(cur.folders)),
            }
          : s
      );
      const target = updatedSnapshotScenes.find((s) => s.id === targetSceneId);
      if (!target) return;

      resetMatterPhysicsRuntime();
      clearParticles();
      clearPlayRuntimeState();
      resetPlaySessionClock();

      const targetEntities = JSON.parse(JSON.stringify(target.entities || {}));
      const targetOrder =
        target.entityOrder && target.entityOrder.length > 0
          ? [...target.entityOrder]
          : Object.keys(targetEntities);
      const targetCamera: SceneCameraConfig = {
        ...DEFAULT_SCENE_CAMERA_CONFIG,
        ...(target.camera || {}),
      };
      initPlayCameraRuntime(targetCamera, cur.sceneBounds, targetEntities, cur.editSceneBounds);

      set({
        activeSceneId: target.id,
        entities: targetEntities,
        entityOrder: targetOrder,
        rules: JSON.parse(JSON.stringify(target.rules || [])),
        folders: JSON.parse(JSON.stringify(target.folders || initialFolders)),
        layerGroups: normalizeLayerGroups(target.layerGroups),
        backgroundColor: target.backgroundColor || '#ffffff',
        camera: targetCamera,
        snapshotScenes: updatedSnapshotScenes,
        activeCollisions: {},
        selectedEntityId: null,
        selectedLayerId: null,
      });
      get().evaluateRules();
    };

    if (transition === 'none' || duration <= 0.02) {
      commitSwap();
      return;
    }

    const transId = `trans-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`;

    // Transition Push : capture instantanée de la scène sortante, bascule immédiate sur la nouvelle scène
    // et glissement simultané (sortante poussée dehors + entrante qui rentre).
    if (transition.startsWith('push_')) {
      const captured = captureStageSnapshot(transId, initialState.backgroundColor);
      const outgoingSnapshotKey = captured ? transId : undefined;
      commitSwap();
      const totalMs = Math.max(80, Math.round(duration * 1000));
      set({
        activeSceneTransition: {
          id: transId,
          type: transition,
          duration,
          phase: 'in',
          outgoingSnapshotKey,
        },
      });
      const endTimer = setTimeout(() => {
        activeDelayTimers.delete(endTimer);
        if (outgoingSnapshotKey) {
          releaseTransitionSnapshot(outgoingSnapshotKey);
        }
        set((s) => (s.activeSceneTransition?.id === transId ? { activeSceneTransition: null } : s));
      }, totalMs);
      activeDelayTimers.add(endTimer);
      return;
    }

    const halfMs = Math.max(50, Math.round(duration * 500));
    set({
      activeSceneTransition: {
        id: transId,
        type: transition,
        duration,
        phase: 'out',
      },
    });
    const midTimer = setTimeout(() => {
      activeDelayTimers.delete(midTimer);
      if (get().appMode !== 'play') return;
      commitSwap();
      set({
        activeSceneTransition: {
          id: transId,
          type: transition,
          duration,
          phase: 'in',
        },
      });
      const endTimer = setTimeout(() => {
        activeDelayTimers.delete(endTimer);
        set((s) => (s.activeSceneTransition?.id === transId ? { activeSceneTransition: null } : s));
      }, halfMs);
      activeDelayTimers.add(endTimer);
    }, halfMs);
    activeDelayTimers.add(midTimer);
  },

  restartSceneInPlay: (transition = 'fade', duration = 0.45) => {
    const cur = get();
    if (cur.appMode !== 'play') return;
    cur.changeSceneInPlay(cur.activeSceneId, transition, duration);
  },
  collapsedRuleIds: {},
  expandedBehaviorCards: {},
  setBehaviorCardExpanded: (cardKey, expanded) =>
    set((state) => ({
      expandedBehaviorCards: {
        ...state.expandedBehaviorCards,
        [cardKey]: expanded,
      },
    })),
  ruleBookPage: 1,
  setRuleBookPage: (page) => set({ ruleBookPage: Math.max(1, page) }),
  gameScore: 0,
  initialGameVariables: { score: 0 },
  gameVariables: { score: 0 },
  setInitialGameVariable: (rawName, value) => {
    const cleanName = rawName.trim();
    if (!cleanName) return;
    const numeric = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    set((state) => {
      const nextInit = { ...state.initialGameVariables, [cleanName]: numeric };
      if (state.appMode === 'edit') {
        const nextVars = { ...state.gameVariables, [cleanName]: numeric };
        return {
          initialGameVariables: nextInit,
          gameVariables: nextVars,
          ...(cleanName === 'score' ? { gameScore: numeric } : {}),
        };
      }
      return { initialGameVariables: nextInit };
    });
  },
  deleteInitialGameVariable: (name) => {
    const cleanName = name.trim();
    if (!cleanName || cleanName === 'score') return;
    set((state) => {
      const nextInit = { ...state.initialGameVariables };
      delete nextInit[cleanName];
      const nextVars = { ...state.gameVariables };
      if (state.appMode === 'edit') {
        delete nextVars[cleanName];
      }
      return {
        initialGameVariables: nextInit,
        ...(state.appMode === 'edit' ? { gameVariables: nextVars } : {}),
      };
    });
  },
  setGameVariable: (rawName, value) => {
    const cleanName = rawName.trim();
    if (!cleanName) return;
    const numeric = Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
    let didChange = false;
    set((state) => {
      if (state.gameVariables[cleanName] === numeric) return state;
      didChange = true;
      return {
        gameVariables: {
          ...state.gameVariables,
          [cleanName]: numeric,
        },
        ...(cleanName === 'score' ? { gameScore: numeric } : {}),
      };
    });
    if (didChange && get().appMode === 'play' && !getIsEvaluatingRules()) {
      get().evaluateRules();
    }
  },
  batchSetGameVariables: (updates) => {
    const entries = Object.entries(updates);
    if (entries.length === 0) return;
    let didChange = false;
    set((state) => {
      let changed = false;
      const nextVars = { ...state.gameVariables };
      let nextScore = state.gameScore;
      for (const [k, rawVal] of entries) {
        const cleanKey = k.trim();
        if (!cleanKey) continue;
        const val = Number.isFinite(rawVal) ? Math.round(rawVal * 100) / 100 : 0;
        if (nextVars[cleanKey] !== val) {
          nextVars[cleanKey] = val;
          changed = true;
          if (cleanKey === 'score') nextScore = val;
        }
      }
      if (!changed) return state;
      didChange = true;
      return {
        gameVariables: nextVars,
        ...(nextScore !== state.gameScore ? { gameScore: nextScore } : {}),
      };
    });
    if (didChange && get().appMode === 'play' && !getIsEvaluatingRules()) {
      get().evaluateRules();
    }
  },
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
  drawingShowGrid: false,
  drawingSnapToGrid: false,
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
  setDrawingShowGrid: (show) => set({ drawingShowGrid: show }),
  setDrawingSnapToGrid: (snap) => set({ drawingSnapToGrid: snap }),
  layerDrawingActions: null,
  setLayerDrawingActions: (actions) => set({ layerDrawingActions: actions }),

  spawnCanvasPick: null,
  spawnCanvasPickResult: null,
  startSpawnCanvasPick: (req) =>
    set({
      spawnCanvasPick: req,
      spawnCanvasPickResult: null,
    }),
  updateSpawnCanvasPickSnap: (snapToGrid, gridStep) =>
    set((state) =>
      state.spawnCanvasPick
        ? {
            spawnCanvasPick: {
              ...state.spawnCanvasPick,
              snapToGrid,
              ...(gridStep !== undefined ? { gridStep } : {}),
            },
          }
        : state
    ),
  completeSpawnCanvasPick: (x, y, zone) =>
    set((state) =>
      state.spawnCanvasPick
        ? {
            spawnCanvasPick: null,
            spawnCanvasPickResult: {
              requestId: state.spawnCanvasPick.requestId,
              x: Math.round(x),
              y: Math.round(y),
              ...(zone
                ? {
                    zone: {
                      x: Math.round(zone.x),
                      y: Math.round(zone.y),
                      width: Math.max(20, Math.round(zone.width)),
                      height: Math.max(20, Math.round(zone.height)),
                    },
                  }
                : {}),
            },
          }
        : state
    ),
  cancelSpawnCanvasPick: () => set({ spawnCanvasPick: null }),
  clearSpawnCanvasPickResult: (requestId) =>
    set((state) => {
      if (!state.spawnCanvasPickResult) return state;
      if (requestId && state.spawnCanvasPickResult.requestId !== requestId) return state;
      return { spawnCanvasPickResult: null };
    }),

  pendingCatalogSpawnType: null,
  setPendingCatalogSpawnType: (type) => set({ pendingCatalogSpawnType: type }),

  jointCanvasPick: null,
  startJointCanvasPick: (childId) =>
    set((state) => {
      const child = state.entities[childId];
      if (!child || !child.parentId || !state.entities[child.parentId]) return state;
      return {
        spawnCanvasPick: null,
        jointCanvasPick: { childId, parentId: child.parentId },
      };
    }),
  cancelJointCanvasPick: () => set({ jointCanvasPick: null }),
  completeJointCanvasPick: (worldX, worldY) => {
    const state = get();
    const pick = state.jointCanvasPick;
    if (!pick) return;
    const child = state.entities[pick.childId];
    const parent = state.entities[pick.parentId];
    if (!child || !parent || child.parentId !== parent.id) {
      set({ jointCanvasPick: null });
      return;
    }
    state.pushSceneHistory();
    const res = computeParentOffsetFromWorldPin(
      child,
      parent,
      { x: worldX, y: worldY },
      child.parentOffset
    );
    set((cur) => {
      const liveChild = cur.entities[pick.childId];
      if (!liveChild) return { jointCanvasPick: null };
      return {
        jointCanvasPick: null,
        entities: {
          ...cur.entities,
          [pick.childId]: {
            ...liveChild,
            position: res.childPosition,
            parentOffset: res.parentOffset,
          },
        },
      };
    });
  },
  moveJointAttachmentPin: (childId, worldX, worldY, skipHistory = false) => {
    const state = get();
    const child = state.entities[childId];
    if (!child || !child.parentId) return;
    const parent = state.entities[child.parentId];
    if (!parent) return;
    if (!skipHistory) {
      state.pushSceneHistory();
    }
    const res = computeParentOffsetFromWorldPin(
      child,
      parent,
      { x: worldX, y: worldY },
      child.parentOffset
    );
    set((cur) => {
      const liveChild = cur.entities[childId];
      if (!liveChild) return cur;
      return {
        entities: {
          ...cur.entities,
          [childId]: {
            ...liveChild,
            position: res.childPosition,
            parentOffset: res.parentOffset,
          },
        },
      };
    });
  },

  snapPinCanvasPick: null,
  startSnapPinCanvasPick: (req) =>
    set((state) => {
      const refEnt = state.entities[req.referenceEntityId];
      if (!refEnt) return state;
      return {
        spawnCanvasPick: null,
        jointCanvasPick: null,
        snapPinCanvasPick: req,
      };
    }),
  cancelSnapPinCanvasPick: () => set({ snapPinCanvasPick: null }),
  completeSnapPinCanvasPick: (worldX, worldY) => {
    const pick = get().snapPinCanvasPick;
    if (!pick) return;
    get().moveSnapCustomPin({
      ...pick,
      worldX,
      worldY,
      skipHistory: false,
    });
    set({ snapPinCanvasPick: null });
  },
  moveSnapCustomPin: ({
    entityId,
    behaviorId,
    stateId,
    pinRole,
    referenceEntityId,
    worldX,
    worldY,
    skipHistory = false,
  }) => {
    const state = get();
    const refEnt = state.entities[referenceEntityId];
    const ownerEnt = findTargetEntityOrArchetype(state, entityId);
    if (!refEnt || !ownerEnt) return;
    if (!skipHistory) {
      state.pushSceneHistory();
    }
    const norm = computeSnapCustomAnchorFromWorld(refEnt, { x: worldX, y: worldY });
    const anchorField = pinRole === 'source' ? 'sourceAnchor' : 'targetAnchor';
    const pinField = pinRole === 'source' ? 'customSourceAnchor' : 'customTargetAnchor';
    const patch: Partial<SnapBehaviorConfig> = {
      [anchorField]: 'custom_canvas' as SnapAnchorPreset,
      [pinField]: norm,
    };
    const hasOverride = Boolean(stateId && ownerEnt.states[stateId]?.behaviorOverrides?.[behaviorId]);
    if (hasOverride && stateId) {
      state.updateStateBehaviorOverride(entityId, stateId, behaviorId, patch);
    } else {
      const updatedBehaviors = (ownerEnt.behaviors || []).map((b) =>
        b.id === behaviorId && b.type === 'snap' ? { ...b, ...patch } : b
      );
      state.updateEntityBehaviors(entityId, updatedBehaviors);
    }
  },

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
    showColliderDebugGizmos: true,
    gizmos: JSON.parse(JSON.stringify(DEFAULT_GIZMO_SETTINGS)),
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
    autoSaveEnabled: true,
    coloredOnionSkin: true,
  },

  updateSettings: (partial) => {
    set((state) => {
      const nextSettings: AppSettings = { ...state.settings, ...partial };
      // Synchronisation bidirectionnelle showColliderDebugGizmos <-> gizmos.categories.hitboxes
      if (partial.showColliderDebugGizmos !== undefined && !partial.gizmos) {
        const resolved = resolveGizmoSettings(nextSettings);
        nextSettings.gizmos = {
          ...resolved,
          categories: {
            ...resolved.categories,
            hitboxes: partial.showColliderDebugGizmos ? 'edit' : 'off',
          },
        };
      } else if (partial.gizmos) {
        const hitMode = partial.gizmos.categories?.hitboxes;
        if (hitMode !== undefined) {
          nextSettings.showColliderDebugGizmos = partial.gizmos.masterEnabled && hitMode !== 'off';
        }
      }
      return { settings: nextSettings };
    });
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

  setLayerVectorPaths: (layerId, vectorPaths, skipHistory = false) => {
    if (!skipHistory) {
      get().pushSceneHistory();
    }
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
      ...(layerId ? {} : { layerDrawingActions: null }),
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
    if (get().appMode === 'play' && !getIsEvaluatingRules()) {
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
      resetPlaySessionClock();
      const curState = get();
      const syncedScenes = syncActiveSceneIntoScenes(curState);
      // Sauvegarder un instantané propre des scènes et entités (les règles restent persistantes même modifiées en Play)
      const snapshot = JSON.parse(JSON.stringify(curState.entities));
      const orderSnapshot = [...(curState.entityOrder || Object.keys(curState.entities))];
      const resetVars = { score: 0, ...curState.initialGameVariables };
      initPlayCameraRuntime(curState.camera, curState.sceneBounds, curState.entities, curState.editSceneBounds);
      set({
        appMode: 'play',
        scenes: syncedScenes,
        snapshotScenes: JSON.parse(JSON.stringify(syncedScenes)),
        snapshotActiveSceneId: curState.activeSceneId,
        activeSceneTransition: null,
        spawnCanvasPick: null,
        jointCanvasPick: null,
        snapPinCanvasPick: null,
        pendingCatalogSpawnType: null,
        snapshotEntities: snapshot,
        snapshotEntityOrder: orderSnapshot,
        snapshotRules: null,
        gameVariables: resetVars,
        gameScore: resetVars.score ?? 0,
      });
    } else {
      // Quand on repasse en mode édition, restaurer la scène de départ mais conserver les règles créées/modifiées en Play
      resetMatterPhysicsRuntime();
      clearParticles();
      clearPlayRuntimeState();
      resetPlayCameraRuntime();
      clearAllTransitionSnapshots();
      const {
        snapshotScenes,
        snapshotActiveSceneId,
        activeSceneId,
        rules,
        folders,
        snapshotEntities,
        snapshotEntityOrder,
        initialGameVariables,
      } = get();
      const resetVars = { score: 0, ...initialGameVariables };
      if (snapshotScenes && snapshotScenes.length > 0) {
        // Synchroniser les règles/dossiers édités en Play dans la scène courante avant restauration
        const mergedScenes = snapshotScenes.map((s) =>
          s.id === activeSceneId
            ? {
                ...s,
                rules: JSON.parse(JSON.stringify(rules)),
                folders: JSON.parse(JSON.stringify(folders)),
              }
            : s
        );
        const startId = snapshotActiveSceneId || activeSceneId;
        const startScene = mergedScenes.find((s) => s.id === startId) || mergedScenes[0];
        const restoredEntities = JSON.parse(JSON.stringify(startScene.entities || {}));
        const restoredOrder =
          startScene.entityOrder && startScene.entityOrder.length > 0
            ? [...startScene.entityOrder]
            : Object.keys(restoredEntities);
        set({
          scenes: JSON.parse(JSON.stringify(mergedScenes)),
          activeSceneId: startScene.id,
          entities: restoredEntities,
          entityOrder: restoredOrder,
          rules: JSON.parse(JSON.stringify(startScene.rules || [])),
          folders: JSON.parse(JSON.stringify(startScene.folders || initialFolders)),
          layerGroups: normalizeLayerGroups(startScene.layerGroups),
          backgroundColor: startScene.backgroundColor || '#ffffff',
          camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(startScene.camera || {}) },
          activeSceneTransition: null,
          activeCollisions: {},
          appMode: 'edit',
          gameVariables: resetVars,
          gameScore: resetVars.score ?? 0,
        });
      } else if (snapshotEntities) {
        set({
          entities: JSON.parse(JSON.stringify(snapshotEntities)),
          entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
          activeSceneTransition: null,
          activeCollisions: {},
          appMode: 'edit',
          gameVariables: resetVars,
          gameScore: resetVars.score ?? 0,
        });
      } else {
        set({
          appMode: 'edit',
          activeSceneTransition: null,
          activeCollisions: {},
          gameVariables: resetVars,
          gameScore: resetVars.score ?? 0,
        });
      }
    }
  },

  resetScene: () => {
    resetMatterPhysicsRuntime();
    clearParticles();
    clearPlayRuntimeState();
    resetPlaySessionClock();
    clearAllTransitionSnapshots();
    const {
      snapshotScenes,
      snapshotActiveSceneId,
      activeSceneId,
      rules,
      folders,
      snapshotEntities,
      snapshotEntityOrder,
      initialGameVariables,
      sceneBounds,
      camera,
    } = get();
    const resetVars = { score: 0, ...initialGameVariables };
    if (snapshotScenes && snapshotScenes.length > 0) {
      const mergedScenes = snapshotScenes.map((s) =>
        s.id === activeSceneId
          ? {
              ...s,
              rules: JSON.parse(JSON.stringify(rules)),
              folders: JSON.parse(JSON.stringify(folders)),
            }
          : s
      );
      const startId = snapshotActiveSceneId || activeSceneId;
      const startScene = mergedScenes.find((s) => s.id === startId) || mergedScenes[0];
      const restoredEntities = JSON.parse(JSON.stringify(startScene.entities || {}));
      const restoredOrder =
        startScene.entityOrder && startScene.entityOrder.length > 0
          ? [...startScene.entityOrder]
          : Object.keys(restoredEntities);
      const startCam: SceneCameraConfig = { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(startScene.camera || {}) };
      initPlayCameraRuntime(startCam, sceneBounds, restoredEntities, get().editSceneBounds);
      set({
        snapshotScenes: mergedScenes,
        scenes: JSON.parse(JSON.stringify(mergedScenes)),
        activeSceneId: startScene.id,
        entities: restoredEntities,
        entityOrder: restoredOrder,
        rules: JSON.parse(JSON.stringify(startScene.rules || [])),
        folders: JSON.parse(JSON.stringify(startScene.folders || initialFolders)),
        layerGroups: normalizeLayerGroups(startScene.layerGroups),
        backgroundColor: startScene.backgroundColor || '#ffffff',
        camera: startCam,
        activeSceneTransition: null,
        activeCollisions: {},
        gameVariables: resetVars,
        gameScore: resetVars.score ?? 0,
      });
    } else if (snapshotEntities) {
      const restoredEnts = JSON.parse(JSON.stringify(snapshotEntities));
      initPlayCameraRuntime(camera, sceneBounds, restoredEnts, get().editSceneBounds);
      set({
        entities: restoredEnts,
        entityOrder: snapshotEntityOrder ? [...snapshotEntityOrder] : Object.keys(snapshotEntities),
        activeSceneTransition: null,
        activeCollisions: {},
        gameVariables: resetVars,
        gameScore: resetVars.score ?? 0,
      });
    } else {
      // Ne jamais vider la scène si aucun instantané n'a été créé
      set({
        activeSceneTransition: null,
        activeCollisions: {},
        gameVariables: resetVars,
        gameScore: resetVars.score ?? 0,
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
    const prevEntity = get().entities[id];
    const didChangeState = Boolean(
      prevEntity && prevEntity.states[stateId] && prevEntity.currentStateId !== stateId
    );
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

    if (didChangeState && get().appMode === 'play') {
      const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
      const subject = entities[id];
      if (!subject || subject.disabled) return;
      const now = Date.now();
      const stateRules = rules.filter(
        (r) =>
          r.enabled &&
          r.trigger.type === 'state_change' &&
          matchesEntityFilter(
            subject,
            r.trigger.subjectMode,
            r.trigger.subjectId,
            r.trigger.subjectType,
            r.trigger.subjectTag
          ) &&
          (!r.trigger.subjectStateId || r.trigger.subjectStateId === '' || r.trigger.subjectStateId === stateId)
      );
      stateRules.forEach((rule) => {
        const cooldownKey = `state_${rule.id}_${id}`;
        if (!canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) return;
        recordRuleFired(rule, now, { cooldownKey });
        executeRuleActions(rule.actions, {
          subject,
          allEntities: entities,
          updateEntityState,
          updateEntityDetails,
          deleteEntity,
          spawnEntity,
        });
      });
    }
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

  updateEntityDetails: (id, partial, options) => {
    set((state) => {
      if (options?.instanceOnly && state.entities[id]) {
        return {
          entities: {
            ...state.entities,
            [id]: {
              ...state.entities[id],
              ...partial,
            },
          },
        };
      }

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

  setEntityDisabledCascade: (id, disabled, scope = 'self') => {
    set((state) => {
      if (!state.entities[id]) return state;
      const targetIds = resolveEntityHierarchyScopeIds(state.entities, id, scope);
      if (targetIds.length === 0) return state;
      const nextEntities = { ...state.entities };
      let changed = false;
      targetIds.forEach((tid) => {
        const target = nextEntities[tid];
        if (target && Boolean(target.disabled) !== Boolean(disabled)) {
          nextEntities[tid] = {
            ...target,
            disabled: Boolean(disabled),
          };
          changed = true;
        }
      });
      return changed ? { entities: nextEntities } : state;
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
      const rotatedParentsInCurrentState: EntityId[] = [];
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

          if (state.appMode === 'edit' && partial.rotation !== undefined && isCurrentState) {
            rotatedParentsInCurrentState.push(e.id);
          }
        }
      });

      if (state.appMode === 'edit' && rotatedParentsInCurrentState.length > 0) {
        // Si l'entité tournée est elle-même un enfant attaché (et son parent n'a pas tourné dans ce lot),
        // maintenir parentOffset.rotationOffset synchronisé avec la nouvelle rotation manuelle.
        rotatedParentsInCurrentState.forEach((entId) => {
          const ent = updatedEntities[entId];
          if (!ent || !ent.parentId || rotatedParentsInCurrentState.includes(ent.parentId)) return;
          const parent = updatedEntities[ent.parentId];
          if (!parent) return;
          const off = ent.parentOffset || { x: 0, y: 0, inheritRotation: true, inheritFlip: true };
          const inheritRot = off.inheritRotation !== false;
          const inheritFlip = off.inheritFlip !== false;
          const parentRot = parent.states[parent.currentStateId]?.rotation ?? 0;
          const childRot = ent.states[ent.currentStateId]?.rotation ?? 0;
          const rawDiff = childRot - (inheritRot ? parentRot : 0);
          const rotOffset = Math.round(rawDiff * (inheritFlip && parent.flipX ? -1 : 1) * 10) / 10;
          updatedEntities[entId] = {
            ...ent,
            parentOffset: {
              ...off,
              rotationOffset: rotOffset,
            },
          };
        });

        const synced = new Set<EntityId>();
        rotatedParentsInCurrentState.forEach((parentRootId) => {
          const descendants = collectDescendantIds(updatedEntities, parentRootId);
          descendants.forEach((childId) => {
            if (synced.has(childId)) return;
            synced.add(childId);
            const child = updatedEntities[childId];
            if (!child || !child.parentId) return;
            const parent = updatedEntities[child.parentId];
            if (!parent) return;
            const nextChildWorld = computeChildWorldFromParent(child, parent);
            const childState = child.states[child.currentStateId];
            updatedEntities[childId] = {
              ...child,
              position: nextChildWorld.position,
              flipX: nextChildWorld.flipX,
              states: childState
                ? {
                    ...child.states,
                    [child.currentStateId]: {
                      ...childState,
                      rotation: nextChildWorld.rotation,
                    },
                  }
                : child.states,
            };
          });
        });
      }

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

        if (transform.runtimeTilt !== undefined && (entity.runtimeTilt ?? 0) !== transform.runtimeTilt) {
          modified = true;
        }

        if (
          transform.runtimeJiggleAngle !== undefined &&
          (entity.runtimeJiggleAngle ?? 0) !== transform.runtimeJiggleAngle
        ) {
          modified = true;
        }

        if (
          transform.runtimeScaleX !== undefined &&
          (entity.runtimeScaleX ?? 1) !== transform.runtimeScaleX
        ) {
          modified = true;
        }

        if (
          transform.runtimeScaleY !== undefined &&
          (entity.runtimeScaleY ?? 1) !== transform.runtimeScaleY
        ) {
          modified = true;
        }

        const hasRuntimePivotChange =
          transform.runtimePivot !== undefined &&
          ((transform.runtimePivot === null && entity.runtimePivot !== undefined) ||
            (transform.runtimePivot !== null &&
              (entity.runtimePivot?.x !== transform.runtimePivot.x ||
                entity.runtimePivot?.y !== transform.runtimePivot.y)));

        if (hasRuntimePivotChange) {
          modified = true;
        }

        const hasAnimFrameChange =
          transform.runtimeAnimFrameIndex !== undefined &&
          ((transform.runtimeAnimFrameIndex === null && entity.runtimeAnimFrameIndex !== undefined) ||
            (transform.runtimeAnimFrameIndex !== null &&
              entity.runtimeAnimFrameIndex !== transform.runtimeAnimFrameIndex));
        if (hasAnimFrameChange) {
          modified = true;
        }

        if (
          transform.runtimeAnimScale !== undefined &&
          (entity.runtimeAnimScale ?? 1) !== transform.runtimeAnimScale
        ) {
          modified = true;
        }

        if (
          transform.runtimeAnimRotation !== undefined &&
          (entity.runtimeAnimRotation ?? 0) !== transform.runtimeAnimRotation
        ) {
          modified = true;
        }

        if (
          transform.runtimeAnimOpacity !== undefined &&
          (entity.runtimeAnimOpacity ?? 1) !== transform.runtimeAnimOpacity
        ) {
          modified = true;
        }

        if (modified) {
          hasChanges = true;
          const updatedEnt: Entity = {
            ...entity,
            position: newPos,
            states: newStates,
            ...(transform.flipX !== undefined ? { flipX: transform.flipX } : {}),
            ...(transform.runtimeTilt !== undefined ? { runtimeTilt: transform.runtimeTilt } : {}),
            ...(transform.runtimeJiggleAngle !== undefined
              ? { runtimeJiggleAngle: transform.runtimeJiggleAngle }
              : {}),
            ...(transform.runtimeScaleX !== undefined ? { runtimeScaleX: transform.runtimeScaleX } : {}),
            ...(transform.runtimeScaleY !== undefined ? { runtimeScaleY: transform.runtimeScaleY } : {}),
            ...(transform.runtimePivot && transform.runtimePivot !== null
              ? { runtimePivot: transform.runtimePivot }
              : {}),
            ...(transform.runtimeAnimFrameIndex !== undefined && transform.runtimeAnimFrameIndex !== null
              ? { runtimeAnimFrameIndex: transform.runtimeAnimFrameIndex }
              : {}),
            ...(transform.runtimeAnimScale !== undefined ? { runtimeAnimScale: transform.runtimeAnimScale } : {}),
            ...(transform.runtimeAnimRotation !== undefined
              ? { runtimeAnimRotation: transform.runtimeAnimRotation }
              : {}),
            ...(transform.runtimeAnimOpacity !== undefined
              ? { runtimeAnimOpacity: transform.runtimeAnimOpacity }
              : {}),
          };
          if (transform.runtimePivot === null) {
            delete updatedEnt.runtimePivot;
          }
          if (transform.runtimeAnimFrameIndex === null) {
            delete updatedEnt.runtimeAnimFrameIndex;
          }
          nextEntities[id] = updatedEnt;
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

      const nextOffset: ParentOffset = customOffset
        ? {
            ...(child.parentOffset || {}),
            ...customOffset,
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
      const prev = child.parentOffset;
      const nextOffset: ParentOffset = {
        ...(prev || {}),
        ...partial,
        x: partial.x ?? prev?.x ?? 0,
        y: partial.y ?? prev?.y ?? 0,
        rotationOffset: partial.rotationOffset ?? prev?.rotationOffset ?? 0,
        inheritRotation: partial.inheritRotation ?? prev?.inheritRotation ?? true,
        inheritFlip: partial.inheritFlip ?? prev?.inheritFlip ?? true,
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

  addStateToEntity: (entityId, name, folderId) => {
    const targetEntity = findTargetEntityOrArchetype(get(), entityId);

    if (!targetEntity) return '';
    const targetType = targetEntity.type;

    const existingStateKeys = Object.keys(targetEntity.states);
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const nextLetter = alphabet[existingStateKeys.length] || `État ${existingStateKeys.length + 1}`;
    const stateName = name && name.trim() ? name.trim() : nextLetter;
    const newId = `state_${stateName.toLowerCase().replace(/[^a-z0-9]/gi, '_')}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;

    const newState: EntityState = {
      id: newId,
      name: stateName,
      color: targetEntity.states[targetEntity.currentStateId]?.color || '#3b82f6',
      scale: 1,
      rotation: 0,
      ...(folderId ? { folderId } : {}),
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

  addStateFolder: (entityId, name) => {
    const targetEntity = findTargetEntityOrArchetype(get(), entityId);
    if (!targetEntity) return '';
    const targetType = targetEntity.type;
    const cleanName = name.trim() || 'Nouveau dossier';
    const existing = (targetEntity.stateFolders || []).find(
      (f) => f.name.toLowerCase() === cleanName.toLowerCase()
    );
    if (existing) return existing.id;

    const newFolder: StateFolder = {
      id: `stfolder_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      isCollapsed: false,
    };

    set((state) => {
      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            stateFolders: [...(e.stateFolders || []), newFolder],
          };
        }
      });
      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          stateFolders: [...(updatedArchetypes[targetType].stateFolders || []), newFolder],
        };
      }
      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
    return newFolder.id;
  },

  updateStateFolder: (entityId, folderId, partial) => {
    set((state) => {
      const targetEntity = findTargetEntityOrArchetype(state, entityId);
      if (!targetEntity) return state;
      const targetType = targetEntity.type;
      const patchFolders = (list?: StateFolder[]) =>
        (list || []).map((f) => (f.id === folderId ? { ...f, ...partial } : f));

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = { ...e, stateFolders: patchFolders(e.stateFolders) };
        }
      });
      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          stateFolders: patchFolders(updatedArchetypes[targetType].stateFolders),
        };
      }
      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  deleteStateFolder: (entityId, folderId) => {
    set((state) => {
      const targetEntity = findTargetEntityOrArchetype(state, entityId);
      if (!targetEntity) return state;
      const targetType = targetEntity.type;
      const cleanStates = (states: Record<StateId, EntityState>) => {
        const next: Record<StateId, EntityState> = {};
        Object.entries(states).forEach(([sid, st]) => {
          next[sid] = st.folderId === folderId ? { ...st, folderId: undefined } : st;
        });
        return next;
      };

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType) {
          updatedEntities[e.id] = {
            ...e,
            stateFolders: (e.stateFolders || []).filter((f) => f.id !== folderId),
            states: cleanStates(e.states),
          };
        }
      });
      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          stateFolders: (updatedArchetypes[targetType].stateFolders || []).filter((f) => f.id !== folderId),
          states: cleanStates(updatedArchetypes[targetType].states),
        };
      }
      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  setStateFolder: (entityId, stateId, folderId) => {
    set((state) => {
      const targetEntity = findTargetEntityOrArchetype(state, entityId);
      if (!targetEntity || !targetEntity.states[stateId]) return state;
      const targetType = targetEntity.type;

      const updatedEntities = { ...state.entities };
      Object.values(updatedEntities).forEach((e) => {
        if (e.type === targetType && e.states[stateId]) {
          updatedEntities[e.id] = {
            ...e,
            states: {
              ...e.states,
              [stateId]: { ...e.states[stateId], folderId },
            },
          };
        }
      });
      const updatedArchetypes = { ...state.customArchetypes };
      if (updatedArchetypes[targetType] && updatedArchetypes[targetType].states[stateId]) {
        updatedArchetypes[targetType] = {
          ...updatedArchetypes[targetType],
          states: {
            ...updatedArchetypes[targetType].states,
            [stateId]: { ...updatedArchetypes[targetType].states[stateId], folderId },
          },
        };
      }
      return { entities: updatedEntities, customArchetypes: updatedArchetypes };
    });
  },

  addEntityGroup: (name) => {
    const id = `entgroup_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const newGroup: EntityGroup = {
      id,
      name: name.trim() || 'Nouveau groupe',
      isCollapsed: false,
      entityTypes: [],
    };
    set((state) => ({
      entityGroups: [...(state.entityGroups || []), newGroup],
    }));
    return id;
  },

  updateEntityGroup: (groupId, partial) => {
    set((state) => ({
      entityGroups: (state.entityGroups || []).map((g) =>
        g.id === groupId ? { ...g, ...partial } : g
      ),
    }));
  },

  deleteEntityGroup: (groupId) => {
    set((state) => ({
      entityGroups: (state.entityGroups || []).filter((g) => g.id !== groupId),
    }));
  },

  assignEntityTypeToGroup: (entityType, groupId) => {
    set((state) => ({
      entityGroups: (state.entityGroups || []).map((g) => {
        const cleaned = g.entityTypes.filter((t) => t !== entityType);
        if (groupId && g.id === groupId) {
          return { ...g, entityTypes: [...cleaned, entityType] };
        }
        return cleaned.length !== g.entityTypes.length ? { ...g, entityTypes: cleaned } : g;
      }),
    }));
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
        name: 'Plante',
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
        name: 'Pomme',
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
        name: 'Étoile',
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

  addCustomEntity: ({
    name,
    type,
    icon,
    drawingDataUrl,
    vectorPaths,
    drawingLayers,
    color,
    tags,
    colliderType,
    colliderBounds,
    pivot,
    frames,
    frameRate,
    animationLoop,
  }) => {
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
    const clonedFrames = frames && frames.length > 0
      ? JSON.parse(JSON.stringify(frames))
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
      ...(pivot ? { pivot: { x: pivot.x, y: pivot.y } } : {}),
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
          ...(clonedFrames ? { frames: clonedFrames } : {}),
          ...(frameRate !== undefined ? { frameRate } : {}),
          ...(animationLoop !== undefined ? { animationLoop } : {}),
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
    if (get().appMode === 'play' && !getIsEvaluatingRules()) {
      get().evaluateRules();
    }
  },

  duplicateCustomArchetype: (sourceType: string) => {
    const cur = get();
    const representativeEntity = Object.values(cur.entities).find((e) => e.type === sourceType);
    let source: Entity | undefined = cur.customArchetypes[sourceType] || representativeEntity;

    if (!source) {
      if (sourceType === 'apple') {
        source = {
          id: 'apple',
          name: 'Pomme',
          type: 'apple',
          tags: ['nourriture', 'fruit'],
          position: { x: 0, y: 0 },
          size: { width: 256, height: 256 },
          currentStateId: 'default',
          isDraggable: false,
          states: {
            default: { id: 'default', name: 'Normal', color: '#ef4444', scale: 1, rotation: 0 },
            croquee: { id: 'croquee', name: 'Croquée', color: '#dc2626', scale: 0.85, rotation: -12 },
          },
        };
      } else if (sourceType === 'plant') {
        source = {
          id: 'plant',
          name: 'Plante',
          type: 'plant',
          tags: ['plante', 'nature'],
          position: { x: 0, y: 0 },
          size: { width: 256, height: 256 },
          currentStateId: 'pousse',
          isDraggable: false,
          states: {
            pousse: {
              id: 'pousse',
              name: 'Pousse',
              color: '#22c55e',
              scale: 0.9,
              rotation: 0,
              stemHeight: 40,
              flowerColor: '#8b5cf6',
              flowerPetals: 0,
            },
            fleur: {
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
      }
    }

    if (!source) return '';
    if (cur.appMode === 'edit') {
      cur.pushSceneHistory();
    }

    const newType = `custom_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`;
    const cloned: Entity = JSON.parse(JSON.stringify(source));
    delete cloned.parentId;
    delete cloned.parentOffset;

    const existingNames = new Set([
      ...Object.values(cur.customArchetypes).map((a) => a.name.toLowerCase()),
      ...Object.values(cur.entities).map((e) => e.name.toLowerCase()),
    ]);
    const cleanBase =
      (source.name || 'Entité').replace(/\s*\(Copie(?:\s+\d+)?\)$/i, '').trim() || 'Entité';
    let copyName = `${cleanBase} (Copie)`;
    let idx = 2;
    while (existingNames.has(copyName.toLowerCase())) {
      copyName = `${cleanBase} (Copie ${idx})`;
      idx += 1;
    }

    // Si on duplique une entité intégrée sans vectorPaths ('apple' ou 'plant'), générer un rendu vectoriel propre
    if (
      (sourceType === 'apple' || sourceType === 'plant') &&
      Object.values(cloned.states).every((s) => !s.vectorPaths || s.vectorPaths.length === 0)
    ) {
      Object.values(cloned.states).forEach((s) => {
        if (sourceType === 'apple') {
          s.vectorPaths = [
            {
              id: `path-apple-${s.id}`,
              d: 'M 100 54 C 128 42 154 68 150 108 C 146 146 120 166 100 160 C 80 166 54 146 50 108 C 46 68 72 42 100 54 Z',
              stroke: '#7f1d1d',
              strokeWidth: 4,
              fill: s.color || '#ef4444',
            },
            {
              id: `path-apple-leaf-${s.id}`,
              d: 'M 104 46 C 118 28 140 32 134 48 C 126 56 112 54 104 46 Z',
              stroke: '#15803d',
              strokeWidth: 3,
              fill: '#22c55e',
            },
          ];
        } else {
          s.vectorPaths = [
            {
              id: `path-plant-pot-${s.id}`,
              d: 'M 65 130 L 135 130 L 125 170 L 75 170 Z',
              stroke: '#78350f',
              strokeWidth: 4,
              fill: '#92400e',
            },
            {
              id: `path-plant-stem-${s.id}`,
              d: 'M 100 130 L 100 72 M 100 104 Q 72 86 68 104 Q 82 114 100 104 M 100 94 Q 128 76 132 94 Q 118 104 100 94',
              stroke: s.color || '#16a34a',
              strokeWidth: 6,
              fill: s.color || '#22c55e',
            },
          ];
        }
      });
    }

    const independentArchetype: Entity = {
      ...cloned,
      id: newType,
      type: newType,
      name: copyName,
      position: { x: 0, y: 0 },
    };

    set((state) => ({
      customArchetypes: {
        ...state.customArchetypes,
        [newType]: independentArchetype,
      },
      entityGroups: (state.entityGroups || []).map((g) => {
        if (!g.entityTypes.includes(sourceType)) return g;
        const nextTypes = [...g.entityTypes];
        const srcIdx = nextTypes.indexOf(sourceType);
        nextTypes.splice(srcIdx + 1, 0, newType);
        return { ...g, entityTypes: nextTypes };
      }),
      selectedEntityId: newType,
      selectedLayerId: null,
      pendingCatalogSpawnType: null,
    }));

    return newType;
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
        entityGroups: (state.entityGroups || []).map((g) => ({
          ...g,
          entityTypes: g.entityTypes.filter((t) => t !== type),
        })),
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
        name: archetype.name.replace(/\s*#\d+$/g, '').trim() || archetype.name,
        position,
        currentStateId: targetState,
        size: size ? { width: Math.max(16, size.width), height: Math.max(16, size.height) } : (archetype.size || { width: 256, height: 256 }),
      };
    } else if (type === 'apple') {
      newEntity = {
        id,
        name: 'Pomme',
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
        name: 'Plante',
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
        name: 'Entité',
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
    resetPlayCameraRuntime();
    const emptyScene = buildDefaultScene(DEFAULT_SCENE_ID, 'Scène 1');
    set({
      entities: {},
      customArchetypes: {},
      entityOrder: [],
      rules: [],
      folders: initialFolders,
      entityGroups: [],
      customSounds: [],
      customParticles: [],
      projectParticlePresets: [],
      layerGroups: JSON.parse(JSON.stringify(emptyScene.layerGroups)),
      backgroundColor: '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      scenes: [emptyScene],
      activeSceneId: DEFAULT_SCENE_ID,
      snapshotScenes: null,
      snapshotActiveSceneId: null,
      activeSceneTransition: null,
      projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
      selectedEntityId: null,
      selectedLayerId: null,
      activeCollisions: {},
      snapshotEntities: null,
      snapshotEntityOrder: null,
      snapshotRules: null,
      hasRecoveryDraftOnBoot: false,
      initialGameVariables: { score: 0 },
      gameVariables: { score: 0 },
      gameScore: 0,
      sceneUndoStack: [],
      sceneRedoStack: [],
    });
  },

  restoreDefaultScene: () => {
    clearPlayRuntimeState();
    resetPlayCameraRuntime();
    const defScene = buildDefaultScene(DEFAULT_SCENE_ID, 'Scène 1', {
      entities: initialEntities,
      entityOrder: ['plant-1', 'apple-1'],
      rules: initialRules,
      folders: initialFolders,
      layerGroups: initialSceneLayerGroups,
      backgroundColor: '#ffffff',
    });
    set({
      entities: JSON.parse(JSON.stringify(defScene.entities)),
      entityOrder: [...defScene.entityOrder],
      customArchetypes: JSON.parse(JSON.stringify(defaultCustomArchetypes)),
      entityGroups: [],
      rules: JSON.parse(JSON.stringify(defScene.rules)),
      folders: JSON.parse(JSON.stringify(defScene.folders)),
      customSounds: [],
      customParticles: [],
      projectParticlePresets: [],
      layerGroups: JSON.parse(JSON.stringify(defScene.layerGroups)),
      backgroundColor: '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      scenes: [defScene],
      activeSceneId: DEFAULT_SCENE_ID,
      snapshotScenes: null,
      snapshotActiveSceneId: null,
      activeSceneTransition: null,
      projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
      snapshotEntities: null,
      snapshotEntityOrder: null,
      snapshotRules: null,
      selectedEntityId: 'plant-1',
      selectedLayerId: null,
      activeCollisions: {},
      appMode: 'edit',
      hasRecoveryDraftOnBoot: false,
      initialGameVariables: { score: 0 },
      gameVariables: { score: 0 },
      gameScore: 0,
      sceneUndoStack: [],
      sceneRedoStack: [],
    });
    get().evaluateRules();
  },

  loadTestScenePreset: (presetId) => {
    get().pushSceneHistory();
    clearPlayRuntimeState();
    resetPlayCameraRuntime();
    const built = buildPhysicsTestScene(presetId);
    const curGizmos = resolveGizmoSettings(get().settings);
    const presetScene = buildDefaultScene(DEFAULT_SCENE_ID, 'Scène 1', {
      entities: built.entities,
      entityOrder: built.entityOrder,
      rules: built.rules,
      folders: built.folders,
      layerGroups: built.layerGroups,
      backgroundColor: '#ffffff',
    });
    set((state) => ({
      entities: built.entities,
      entityOrder: built.entityOrder,
      customArchetypes: JSON.parse(JSON.stringify(defaultCustomArchetypes)),
      entityGroups: [],
      rules: built.rules,
      folders: built.folders,
      customSounds: [],
      customParticles: [],
      projectParticlePresets: [],
      layerGroups: built.layerGroups,
      backgroundColor: '#ffffff',
      camera: { ...DEFAULT_SCENE_CAMERA_CONFIG },
      editorCamera: { x: 0, y: 0, zoom: 1 },
      scenes: [presetScene],
      activeSceneId: DEFAULT_SCENE_ID,
      snapshotScenes: null,
      snapshotActiveSceneId: null,
      activeSceneTransition: null,
      projectPalette: built.projectPalette,
      snapshotEntities: null,
      snapshotEntityOrder: null,
      snapshotRules: null,
      selectedEntityId: built.selectedEntityId,
      selectedLayerId: null,
      activeCollisions: {},
      appMode: 'edit',
      hasRecoveryDraftOnBoot: false,
      settings: {
        ...state.settings,
        gizmos: {
          ...curGizmos,
          masterEnabled: true,
          categories: {
            ...curGizmos.categories,
            springsAndJiggle: 'both',
            colliderLayers: 'both',
            lookAt: 'both',
          },
        },
      },
    }));
    get().evaluateRules();
  },

  exportProject: () => {
    const state = get();
    const syncedScenes = syncActiveSceneIntoScenes(state);
    return {
      version: 1,
      name: 'Projet Atelier Vivant',
      exportedAt: new Date().toISOString(),
      entities: state.entities,
      customArchetypes: state.customArchetypes,
      entityGroups: state.entityGroups,
      rules: state.rules,
      folders: state.folders,
      customSounds: state.customSounds,
      customParticles: state.customParticles,
      particlePresets: state.projectParticlePresets,
      layerGroups: state.layerGroups,
      backgroundColor: state.backgroundColor,
      camera: state.camera,
      scenes: syncedScenes,
      activeSceneId: state.activeSceneId,
      settings: {
        ...state.settings,
        projectPalette: state.projectPalette,
      },
      projectPalette: state.projectPalette,
      initialGameVariables: state.initialGameVariables,
    };
  },

  importProject: (data: any) => {
    try {
      if (!data || typeof data !== 'object') {
        return { success: false, message: 'Format de fichier JSON invalide.' };
      }
      if (!data.entities && !data.rules && !data.layerGroups && !Array.isArray(data.scenes)) {
        return { success: false, message: 'Le fichier ne contient pas de données de projet valides.' };
      }

      clearPlayRuntimeState();
      resetPlayCameraRuntime();

      let importedScenes: ProjectScene[] = [];
      if (Array.isArray(data.scenes) && data.scenes.length > 0) {
        importedScenes = data.scenes.map((sc: any, idx: number) => {
          const scEntities = sc?.entities && typeof sc.entities === 'object' ? sc.entities : {};
          const scOrder = Array.isArray(sc?.entityOrder)
            ? [...sc.entityOrder]
            : Object.keys(scEntities);
          return buildDefaultScene(
            sc?.id || `scene-${idx + 1}`,
            sc?.name || `Scène ${idx + 1}`,
            {
              entities: scEntities,
              entityOrder: scOrder,
              rules: Array.isArray(sc?.rules) ? sc.rules : [],
              folders: Array.isArray(sc?.folders) ? sc.folders : initialFolders,
              layerGroups: sc?.layerGroups,
              backgroundColor: sc?.backgroundColor || '#ffffff',
              camera: sc?.camera,
            }
          );
        });
      } else {
        const legacyEntities = data.entities && typeof data.entities === 'object' ? data.entities : {};
        const legacyOrder = Array.isArray(data.entityOrder)
          ? [...data.entityOrder]
          : Object.keys(legacyEntities);
        importedScenes = [
          buildDefaultScene(DEFAULT_SCENE_ID, 'Scène 1', {
            entities: legacyEntities,
            entityOrder: legacyOrder,
            rules: Array.isArray(data.rules) ? data.rules : [],
            folders: Array.isArray(data.folders) ? data.folders : initialFolders,
            layerGroups: data.layerGroups,
            backgroundColor: data.backgroundColor || '#ffffff',
            camera: data.camera,
          }),
        ];
      }

      const targetActiveScene =
        importedScenes.find((s) => s.id === data.activeSceneId) || importedScenes[0];
      const importedEntities = JSON.parse(JSON.stringify(targetActiveScene.entities || {}));
      const importedOrder =
        targetActiveScene.entityOrder && targetActiveScene.entityOrder.length > 0
          ? [...targetActiveScene.entityOrder]
          : Object.keys(importedEntities);

      // Respect exact project archetypes : do not inject the 3 default items (plant, apple, custom) if not present
      let importedArchetypes: Record<string, Entity> = {};
      if (data.customArchetypes && typeof data.customArchetypes === 'object') {
        importedArchetypes = { ...data.customArchetypes };
      } else {
        // Deduce archetypes strictly from all scenes' imported entities
        importedScenes.forEach((sc) => {
          Object.values(sc.entities || {}).forEach((ent: any) => {
            if (ent && ent.type && !importedArchetypes[ent.type]) {
              importedArchetypes[ent.type] = {
                ...ent,
                position: { x: 0, y: 0 },
              };
            }
          });
        });
      }
      const importedRules = JSON.parse(JSON.stringify(targetActiveScene.rules || []));
      const importedFolders = JSON.parse(JSON.stringify(targetActiveScene.folders || initialFolders));
      const importedEntityGroups = Array.isArray(data.entityGroups) ? data.entityGroups : [];
      const importedCustomSounds = Array.isArray(data.customSounds) ? data.customSounds : [];
      const importedCustomParticles = Array.isArray(data.customParticles) ? data.customParticles : [];
      const importedParticlePresets = Array.isArray(data.particlePresets) ? data.particlePresets : [];
      const importedLayerGroups = normalizeLayerGroups(targetActiveScene.layerGroups);
      const importedSettings = data.settings && typeof data.settings === 'object' ? data.settings : undefined;
      const importedPalette: ProjectPaletteColor[] = Array.isArray(data.projectPalette) && data.projectPalette.length > 0
        ? data.projectPalette
        : Array.isArray(importedSettings?.projectPalette) && importedSettings.projectPalette.length > 0
        ? importedSettings.projectPalette
        : JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE));

      const importedVariables: Record<string, number> = {
        score: 0,
        ...(data.initialGameVariables && typeof data.initialGameVariables === 'object' && !Array.isArray(data.initialGameVariables)
          ? Object.fromEntries(
              Object.entries(data.initialGameVariables).filter(
                ([k, v]) => typeof k === 'string' && typeof v === 'number' && Number.isFinite(v)
              )
            )
          : {}),
      };

      set((state) => ({
        scenes: importedScenes,
        activeSceneId: targetActiveScene.id,
        backgroundColor: targetActiveScene.backgroundColor || '#ffffff',
        camera: { ...DEFAULT_SCENE_CAMERA_CONFIG, ...(targetActiveScene.camera || {}) },
        editorCamera: { x: 0, y: 0, zoom: 1 },
        entities: importedEntities,
        entityOrder: importedOrder,
        customArchetypes: importedArchetypes,
        entityGroups: importedEntityGroups,
        rules: importedRules,
        folders: importedFolders,
        customSounds: importedCustomSounds,
        customParticles: importedCustomParticles,
        projectParticlePresets: importedParticlePresets,
        layerGroups: importedLayerGroups,
        projectPalette: importedPalette,
        initialGameVariables: importedVariables,
        gameVariables: { ...importedVariables },
        gameScore: importedVariables.score ?? 0,
        settings: importedSettings
          ? {
              ...state.settings,
              ...importedSettings,
              gizmos: resolveGizmoSettings({ ...state.settings, ...importedSettings }),
              projectPalette: importedPalette,
            }
          : { ...state.settings, projectPalette: importedPalette },
        selectedEntityId: importedOrder[0] || Object.keys(importedEntities)[0] || null,
        selectedLayerId: null,
        activeCollisions: {},
        appMode: 'edit',
        snapshotScenes: null,
        snapshotActiveSceneId: null,
        activeSceneTransition: null,
        snapshotEntities: null,
        snapshotEntityOrder: null,
        snapshotRules: null,
        hasRecoveryDraftOnBoot: false,
        sceneUndoStack: [],
        sceneRedoStack: [],
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
      const slotSizeBytes = estimateJsonBytes(currentData);
      const slotId = targetSlotId || `slot-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
      const cleanName = name.trim() || `Projet ${new Date().toLocaleDateString('fr-FR')}`;

      const existingIndex = slots.findIndex((s) => s.id === slotId);
      const newSlot: ProjectSlot = {
        id: slotId,
        name: cleanName,
        updatedAt: Date.now(),
        entitiesCount: Object.keys(currentData.entities || {}).length,
        rulesCount: (currentData.rules || []).length,
        sizeBytes: slotSizeBytes,
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
        autoSaveDraft: null,
        hasRecoveryDraftOnBoot: false,
        lastAutoSaveAt: null,
      });

      putSlotInDB(newSlot).catch((err) => {
        console.error('Failed to persist slot in IndexedDB:', err);
      });
      clearAutoSaveDraftFromDB();

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
        sizeBytes: source.sizeBytes ?? estimateJsonBytes(source.data || source),
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
    const id = `rule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
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

  reorderRuleActions: (ruleId, sourceActionId, targetActionId, position = 'before') => {
    if (!ruleId || !sourceActionId || sourceActionId === targetActionId) return;
    set((state) => ({
      rules: state.rules.map((r) =>
        r.id === ruleId
          ? {
              ...r,
              actions: reorderRuleActionsInList(r.actions, sourceActionId, targetActionId, position),
            }
          : r
      ),
    }));
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

  importEmbeddedParticleSprites: (sprites) => {
    const idMap: Record<string, string> = {};
    if (!sprites || sprites.length === 0) return idMap;

    const existing = get().customParticles;
    const toAdd: CustomParticlePreset[] = [];

    sprites.forEach((sprite) => {
      if (!sprite || !sprite.id) return;
      const serialized = JSON.stringify(sprite.vectorPaths || []);
      const sameId = existing.find((e) => e.id === sprite.id);
      if (sameId && JSON.stringify(sameId.vectorPaths || []) === serialized) {
        idMap[sprite.id] = sameId.id;
        return;
      }
      const sameGeom = existing.find(
        (e) => e.name === sprite.name && JSON.stringify(e.vectorPaths || []) === serialized
      );
      if (sameGeom) {
        idMap[sprite.id] = sameGeom.id;
        return;
      }
      const newId = sameId
        ? `part-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
        : sprite.id;
      idMap[sprite.id] = newId;
      toAdd.push({
        ...JSON.parse(JSON.stringify(sprite)),
        id: newId,
        createdAt: sprite.createdAt || Date.now(),
      });
    });

    if (toAdd.length > 0) {
      set((state) => ({
        customParticles: [...state.customParticles, ...toAdd],
      }));
      toAdd.forEach((s) => invalidateCustomParticleSprite(s.id));
    }

    return idMap;
  },

  saveProjectParticlePreset: (presetData) => {
    const state = get();
    const now = Date.now();
    const cleanConfig = JSON.parse(JSON.stringify(presetData.config));
    const referencedIds = new Set<string>();
    if (cleanConfig.customParticleId) referencedIds.add(cleanConfig.customParticleId);
    if (Array.isArray(cleanConfig.customParticleIds)) {
      cleanConfig.customParticleIds.forEach((cid: string) => cid && referencedIds.add(cid));
    }
    const embeddedSprites =
      presetData.embeddedCustomSprites && presetData.embeddedCustomSprites.length > 0
        ? JSON.parse(JSON.stringify(presetData.embeddedCustomSprites))
        : state.customParticles
            .filter((sp) => referencedIds.has(sp.id))
            .map((sp) => JSON.parse(JSON.stringify(sp)));

    const existingIdx = presetData.id
      ? state.projectParticlePresets.findIndex((p) => p.id === presetData.id)
      : -1;
    const id =
      existingIdx >= 0
        ? state.projectParticlePresets[existingIdx].id
        : presetData.id || `fx-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const entry: ParticleEffectPreset = {
      id,
      name: (presetData.name || 'Effet particules').trim() || 'Effet particules',
      createdAt: existingIdx >= 0 ? state.projectParticlePresets[existingIdx].createdAt : now,
      updatedAt: now,
      config: cleanConfig,
      ...(embeddedSprites.length > 0 ? { embeddedCustomSprites: embeddedSprites } : {}),
    };

    const nextList =
      existingIdx >= 0
        ? state.projectParticlePresets.map((p, idx) => (idx === existingIdx ? entry : p))
        : [...state.projectParticlePresets, entry];
    set({ projectParticlePresets: nextList });
    return id;
  },

  deleteProjectParticlePreset: (id) => {
    set((state) => ({
      projectParticlePresets: state.projectParticlePresets.filter((p) => p.id !== id),
    }));
  },

  saveParticleToLocalCollection: (presetData) => {
    const state = get();
    const now = Date.now();
    const cleanConfig = JSON.parse(JSON.stringify(presetData.config));
    const referencedIds = new Set<string>();
    if (cleanConfig.customParticleId) referencedIds.add(cleanConfig.customParticleId);
    if (Array.isArray(cleanConfig.customParticleIds)) {
      cleanConfig.customParticleIds.forEach((cid: string) => cid && referencedIds.add(cid));
    }
    const embeddedSprites =
      presetData.embeddedCustomSprites && presetData.embeddedCustomSprites.length > 0
        ? JSON.parse(JSON.stringify(presetData.embeddedCustomSprites))
        : state.customParticles
            .filter((sp) => referencedIds.has(sp.id))
            .map((sp) => JSON.parse(JSON.stringify(sp)));

    const existing = presetData.id ? state.localParticleCollection[presetData.id] : undefined;
    const id = existing
      ? existing.id
      : presetData.id || `gfx-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

    const entry: ParticleEffectPreset = {
      id,
      name: (presetData.name || 'Effet particules').trim() || 'Effet particules',
      createdAt: existing ? existing.createdAt : now,
      updatedAt: now,
      config: cleanConfig,
      ...(embeddedSprites.length > 0 ? { embeddedCustomSprites: embeddedSprites } : {}),
    };

    const nextColl = {
      ...state.localParticleCollection,
      [id]: entry,
    };
    set({ localParticleCollection: nextColl });
    saveParticleCollectionInDB(nextColl).catch((err) => {
      console.error('Failed to save particle collection to DB:', err);
    });
    return id;
  },

  deleteParticleFromLocalCollection: (id) => {
    const state = get();
    if (!state.localParticleCollection[id]) return;
    const nextColl = { ...state.localParticleCollection };
    delete nextColl[id];
    set({ localParticleCollection: nextColl });
    saveParticleCollectionInDB(nextColl).catch((err) => {
      console.error('Failed to delete particle preset from DB:', err);
    });
  },

  triggerKeyEvent: (keyName, phase = 'down', keyCode) => {
    if (get().appMode !== 'play') return;
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const now = Date.now();

    const kbRules = rules.filter((r) => r.enabled && r.trigger.type === 'keyboard');
    if (kbRules.length === 0) return;

    const normalizedInput = keyName === ' ' ? 'space' : keyName.toLowerCase();
    const normalizedInputCode = (keyCode || '').toLowerCase();

    kbRules.forEach((rule) => {
      const targetKey = rule.trigger.keyName || 'Space';
      const targetNorm = targetKey.toLowerCase();
      const targetCodeNorm = (rule.trigger.keyCode || '').toLowerCase();
      const isAsciiLetterRule = /^key[a-z]$/.test(targetCodeNorm) && /^[a-z]$/.test(targetNorm);
      const isKeyMatch =
        targetKey === 'any' ||
        targetNorm === normalizedInput ||
        (targetKey === 'Space' && (keyName === ' ' || keyName === 'Space' || keyCode === 'Space')) ||
        (targetKey === 'Escape' && (keyName === 'Escape' || keyName === 'Esc' || keyCode === 'Escape')) ||
        (targetKey === 'Enter' && (keyName === 'Enter' || keyCode === 'Enter' || keyCode === 'NumpadEnter')) ||
        (targetKey === 'Backspace' && (keyName === 'Backspace' || keyCode === 'Backspace')) ||
        (targetKey === 'Tab' && (keyName === 'Tab' || keyCode === 'Tab')) ||
        (targetKey === 'Shift' && (keyName === 'Shift' || keyCode === 'ShiftLeft' || keyCode === 'ShiftRight')) ||
        (targetKey === 'Control' && (keyName === 'Control' || keyCode === 'ControlLeft' || keyCode === 'ControlRight')) ||
        (targetKey === 'Alt' && (keyName === 'Alt' || keyCode === 'AltLeft' || keyCode === 'AltRight')) ||
        (targetKey === 'Meta' && (keyName === 'Meta' || keyCode === 'MetaLeft' || keyCode === 'MetaRight')) ||
        (!isAsciiLetterRule && targetCodeNorm !== '' && normalizedInputCode !== '' && targetCodeNorm === normalizedInputCode);

      if (!isKeyMatch) return;

      const allEnts = Object.values(entities).filter((e) => !e.disabled);
      const subject = allEnts.find((e) =>
        matchesEntityFilter(e, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)
      ) || allEnts[0];

      const revertKey = `kb_${subject?.id || 'global'}_${rule.id}`;

      if (rule.trigger.autoRevert && subject) {
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

      // Accepter down/key_down/enter/click pour appui et up/key_up/exit/release pour relâchement
      const rulePhase = rule.trigger.phase || 'down';
      const isUpRule =
        rulePhase === 'up' || rulePhase === 'key_up' || rulePhase === 'exit' || rulePhase === 'release';
      const phaseMatch = phase === 'up' ? isUpRule : !isUpRule;

      if (!phaseMatch) return;

      const cooldownKey = `key_${rule.id}_${normalizedInput}_${normalizedInputCode}_${phase}`;
      if (!canRuleFireWithGate(rule, now, 50, { cooldownKey })) return;
      recordRuleFired(rule, now, { cooldownKey });

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
    if (!subject || subject.disabled) return;

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
        if (!canRuleFireWithGate(rule, now, 0, { cooldownKey })) {
          return;
        }
        recordRuleFired(rule, now, { cooldownKey });
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
    if (!subject || subject.disabled) return;

    const now = Date.now();
    const allEntitiesList = Object.values(entities).filter((e) => !e.disabled);
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
      if (!canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) {
        return;
      }
      recordRuleFired(rule, now, { cooldownKey });

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
        if (other.id === subject.id || other.disabled) return;
        if (!checkCollision(subject, other)) return;

        const contactPt = getCollisionContactPoint(subject, other);

        // Cas 1: subject = Sujet, other = Cible
        if (isSub1 && matchesEntityFilter(other, rule.trigger.targetMode, rule.trigger.targetId, rule.trigger.targetType, rule.trigger.targetTag)) {
          if ((!rule.trigger.subjectStateId || subject.currentStateId === rule.trigger.subjectStateId) &&
              (!rule.trigger.targetStateId || other.currentStateId === rule.trigger.targetStateId)) {
            const cooldownKey = `coll_rel_${rule.id}_${subject.id}_${other.id}`;
            if (canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) {
              recordRuleFired(rule, now, { cooldownKey });
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
            if (canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) {
              recordRuleFired(rule, now, { cooldownKey });
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

  triggerJointBreak: (childId, parentId, breakPoint) => {
    // Les règles ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;

    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[childId];
    if (!subject || subject.disabled) return;

    const parent = entities[parentId];
    const resolvedPoint = breakPoint || {
      x: subject.position.x + subject.size.width / 2,
      y: subject.position.y + subject.size.height / 2,
    };
    const now = Date.now();

    const breakRules = rules.filter(
      (r) =>
        r.enabled &&
        (r.trigger.type === 'joint_break' || r.trigger.phase === 'joint_break')
    );

    breakRules.forEach((rule) => {
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

      const cooldownKey = `joint_break_${rule.id}_${subject.id}`;
      if (!canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) {
        return;
      }
      recordRuleFired(rule, now, { cooldownKey });

      executeRuleActions(rule.actions, {
        subject,
        target: parent,
        eventPosition: resolvedPoint,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });
  },

  triggerCameraFollowEvent: (targetEntityId) => {
    if (get().appMode !== 'play') return;
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[targetEntityId];
    if (!subject || subject.disabled) return;

    const now = Date.now();
    const camRules = rules.filter((r) => r.enabled && r.trigger.type === 'camera_follow');
    if (camRules.length === 0) return;

    camRules.forEach((rule) => {
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
      const cooldownKey = `cam_follow_${rule.id}_${subject.id}`;
      if (!canRuleFireWithGate(rule, now, 60, { cooldownKey })) return;
      recordRuleFired(rule, now, { cooldownKey });

      executeRuleActions(rule.actions, {
        subject,
        eventPosition: {
          x: Math.round(subject.position.x + subject.size.width / 2),
          y: Math.round(subject.position.y + subject.size.height / 2),
        },
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });
  },

  triggerTargetArrivedEvent: (subjectId, targetEntityId, eventPosition) => {
    if (get().appMode !== 'play') return;
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[subjectId];
    if (!subject || subject.disabled) return;

    const target = targetEntityId ? entities[targetEntityId] : undefined;
    const resolvedPoint = eventPosition || {
      x: Math.round(subject.position.x + subject.size.width / 2),
      y: Math.round(subject.position.y + subject.size.height / 2),
    };
    const now = Date.now();

    const arrivalRules = rules.filter(
      (r) => r.enabled && (r.trigger.type === 'target_arrived' || r.trigger.phase === 'target_arrived')
    );
    if (arrivalRules.length === 0) return;

    arrivalRules.forEach((rule) => {
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

      const targetMode = rule.trigger.targetMode || 'any';
      if (targetMode !== 'any') {
        if (!target) return;
        if (
          !matchesEntityFilter(
            target,
            targetMode,
            rule.trigger.targetId,
            rule.trigger.targetType,
            rule.trigger.targetTag
          )
        ) {
          return;
        }
        if (
          rule.trigger.targetStateId &&
          rule.trigger.targetStateId !== '' &&
          target.currentStateId !== rule.trigger.targetStateId
        ) {
          return;
        }
      }

      const cooldownKey = `target_arrived_${rule.id}_${subject.id}_${target?.id || 'pos'}`;
      if (!canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey })) {
        return;
      }
      recordRuleFired(rule, now, { cooldownKey });

      executeRuleActions(rule.actions, {
        subject,
        target,
        eventPosition: resolvedPoint,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });
  },

  triggerSnapEvent: (subjectId, targetEntityId, phase, eventPosition) => {
    if (get().appMode !== 'play') return;
    const { rules, entities, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
    const subject = entities[subjectId];
    if (!subject || subject.disabled) return;

    const target = targetEntityId ? entities[targetEntityId] : undefined;
    const resolvedPoint = eventPosition || {
      x: Math.round(subject.position.x + subject.size.width / 2),
      y: Math.round(subject.position.y + subject.size.height / 2),
    };
    const now = Date.now();

    const snapRules = rules.filter((r) => r.enabled && r.trigger.type === 'snap');
    if (snapRules.length === 0) return;

    snapRules.forEach((rule) => {
      const expectedPhase = rule.trigger.phase === 'exit' ? 'exit' : 'enter';
      if (expectedPhase !== phase) return;

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

      const targetMode = rule.trigger.targetMode || 'any';
      if (targetMode !== 'any') {
        if (!target) return;
        if (
          !matchesEntityFilter(
            target,
            targetMode,
            rule.trigger.targetId,
            rule.trigger.targetType,
            rule.trigger.targetTag
          )
        ) {
          return;
        }
        if (
          rule.trigger.targetStateId &&
          rule.trigger.targetStateId !== '' &&
          target.currentStateId !== rule.trigger.targetStateId
        ) {
          return;
        }
      }

      const cooldownKey = `snap_${phase}_${rule.id}_${subject.id}_${target?.id || 'any'}`;
      if (!canRuleFireWithGate(rule, now, 120, { cooldownKey })) {
        return;
      }
      recordRuleFired(rule, now, { cooldownKey });

      executeRuleActions(rule.actions, {
        subject,
        target,
        eventPosition: resolvedPoint,
        allEntities: entities,
        updateEntityState,
        updateEntityDetails,
        deleteEntity,
        spawnEntity,
      });
    });
  },

  evaluateRules: () => {
    get().evaluateRulesWithTemp();
  },

  evaluateRulesWithTemp: (tempPositions) => {
    // Les règles de collision et d'animation ne s'exécutent QU'EN mode PLAY
    if (get().appMode !== 'play') return;
    if (getIsEvaluatingRules()) return;
    setIsEvaluatingRules(true);
    try {
      const { entities, rules, activeCollisions, sceneBounds, editSceneBounds, camera, layerGroups, updateEntityState, updateEntityDetails, deleteEntity, spawnEntity } = get();
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
      const allEntitiesList = Object.values(entities).filter((e) => !e.disabled);
      const now = Date.now();
      const worldBounds = resolveWorldBounds(sceneBounds || { width: 800, height: 500 }, camera, editSceneBounds);
      const sceneW = Math.max(100, worldBounds.width);
      const sceneH = Math.max(100, worldBounds.height);

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
                const dirMatch1 =
                  !isColliding ||
                  checkDirectionalCollisionSide({
                    subject: tempA,
                    target: tempB,
                    sideFilter: rule.trigger.collisionSide,
                    sideTarget: rule.trigger.collisionSideTarget,
                    requireDownward: rule.trigger.collisionRequireDownward,
                  });
                handleCollisionPair(
                  rule,
                  tempA,
                  tempB,
                  isColliding && dirMatch1,
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
                const dirMatch2 =
                  !isColliding ||
                  checkDirectionalCollisionSide({
                    subject: tempB,
                    target: tempA,
                    sideFilter: rule.trigger.collisionSide,
                    sideTarget: rule.trigger.collisionSideTarget,
                    requireDownward: rule.trigger.collisionRequireDownward,
                  });
                handleCollisionPair(
                  rule,
                  tempB,
                  tempA,
                  isColliding && dirMatch2,
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
              if (ent.colliderMode === 'disabled') continue;
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

                let dirMatchLayer = true;
                if (
                  hit.colliding &&
                  hit.contactPoint &&
                  ((rule.trigger.collisionSide && rule.trigger.collisionSide !== 'any') ||
                    rule.trigger.collisionRequireDownward)
                ) {
                  const contactTargetProxy: Entity = {
                    ...layerProxy,
                    position: {
                      x: hit.contactPoint.x - 2,
                      y: hit.contactPoint.y - 2,
                    },
                    size: { width: 4, height: 4 },
                  };
                  dirMatchLayer = checkDirectionalCollisionSide({
                    subject: tempEnt,
                    target: contactTargetProxy,
                    sideFilter: rule.trigger.collisionSide,
                    sideTarget: rule.trigger.collisionSideTarget,
                    requireDownward: rule.trigger.collisionRequireDownward,
                  });
                }

                handleCollisionPair(
                  rule,
                  tempEnt,
                  layerProxy,
                  hit.colliding && dirMatchLayer,
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
        if (!canRuleFireWithGate(rule, now, 0, { cooldownKey })) {
          return;
        }
        ruleCooldowns[cooldownKey] = now;
        recordRuleFired(rule, now, { cooldownKey });
        const allEnts = Object.values(entities).filter((e) => !e.disabled);
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
          const pairKey = `prox_${rule.id}_${entA.id}_${entB.id}`;

          if (dist <= reqDist) {
            if (canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey: pairKey, edgeKey: pairKey, useEdgeGating: true })) {
              recordRuleFired(rule, now, { cooldownKey: pairKey, edgeKey: pairKey });
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
          } else {
            markContinuousConditionFalse(rule, pairKey);
          }
        });
      });
    });

    // 5. Règles de Bords de Scène / Canvas (Monde complet ou Cadre visible Viewport)
    const boundaryRules = rules.filter((r) => r.enabled && r.trigger.type === 'boundary');
    const edgeTol = 2;
    const viewportBoundsRect = getPlayVisibleViewportRect(sceneBounds || { width: 800, height: 500 });
    const worldBoundsRect = { x: 0, y: 0, width: sceneW, height: sceneH };

    boundaryRules.forEach((rule) => {
      const edge = rule.trigger.boundaryEdge || 'any';
      const activeBoundsRect =
        rule.trigger.boundarySpace === 'viewport' ? viewportBoundsRect : worldBoundsRect;

      allEntitiesList.forEach((subject) => {
        if (!matchesEntityFilter(subject, rule.trigger.subjectMode, rule.trigger.subjectId, rule.trigger.subjectType, rule.trigger.subjectTag)) return;

        // État spécifique requis si défini
        if (rule.trigger.subjectStateId && subject.currentStateId !== rule.trigger.subjectStateId) return;

        const subjPos = effectivePositions?.[subject.id] ?? subject.position;
        const effectiveSubject = subjPos === subject.position ? subject : { ...subject, position: subjPos };
        const wb = getEntityWorldColliderBounds(effectiveSubject);
        const { hitLeft, hitRight, hitTop, hitBottom, hitEdge } = computeBoundaryHitEdges(
          wb,
          activeBoundsRect,
          edge,
          edgeTol
        );

        const boundKey = `bound_${rule.id}_${subject.id}`;
        if (hitEdge) {
          if (canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS, { cooldownKey: boundKey, edgeKey: boundKey, useEdgeGating: true })) {
            recordRuleFired(rule, now, { cooldownKey: boundKey, edgeKey: boundKey });
            const boundaryPt: Position = {
              x: hitLeft && (edge === 'left' || edge === 'any')
                ? Math.round(activeBoundsRect.x)
                : hitRight && (edge === 'right' || edge === 'any')
                ? Math.round(activeBoundsRect.x + activeBoundsRect.width)
                : Math.round(wb.centerX),
              y: hitTop && (edge === 'top' || edge === 'any')
                ? Math.round(activeBoundsRect.y)
                : hitBottom && (edge === 'bottom' || edge === 'any')
                ? Math.round(activeBoundsRect.y + activeBoundsRect.height)
                : Math.round(wb.centerY),
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
        } else {
          markContinuousConditionFalse(rule, boundKey);
        }
      });
    });

    // 6. Règles de Variables / Compteur de Score
    const variableRules = rules.filter((r) => r.enabled && r.trigger.type === 'variable');
    const liveVars = get().gameVariables || { score: get().gameScore || 0 };
    variableRules.forEach((rule) => {
      const varName = (rule.trigger.variableName || 'score').trim() || 'score';
      const currentVal =
        varName === 'score' ? (liveVars.score ?? get().gameScore ?? 0) : (liveVars[varName] ?? 0);
      const triggerMode = rule.trigger.variableTriggerMode || 'threshold';

      if (triggerMode === 'on_change') {
        const changeKey = `varRule_${rule.id}_${varName}`;
        if (prevEvaluatedVariables[changeKey] === undefined) {
          prevEvaluatedVariables[changeKey] = currentVal;
          return;
        }
        if (Math.abs(currentVal - prevEvaluatedVariables[changeKey]) > 1e-4) {
          prevEvaluatedVariables[changeKey] = currentVal;
          const cooldownKey = `var_${rule.id}`;
          if (canRuleFireWithGate(rule, now, 40, { cooldownKey })) {
            recordRuleFired(rule, now, { cooldownKey });
            const allEnts = Object.values(entities).filter((e) => !e.disabled);
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
        return;
      }

      const targetVal = rule.trigger.variableValue ?? 5;
      const op = rule.trigger.variableOperator || '>=';
      let satisfied = false;
      if (op === '>=' && currentVal >= targetVal) satisfied = true;
      else if (op === '==' && Math.abs(currentVal - targetVal) <= 1e-4) satisfied = true;
      else if (op === '<=' && currentVal <= targetVal) satisfied = true;
      else if (op === '>' && currentVal > targetVal) satisfied = true;
      else if (op === '<' && currentVal < targetVal) satisfied = true;
      else if (op === '!=' && Math.abs(currentVal - targetVal) > 1e-4) satisfied = true;

      const cooldownKey = `var_${rule.id}`;
      if (satisfied) {
        if (canRuleFireWithGate(rule, now, RULE_COOLDOWN_MS * 2, { cooldownKey, edgeKey: rule.id, useEdgeGating: true })) {
          recordRuleFired(rule, now, { cooldownKey, edgeKey: rule.id });
          const allEnts = Object.values(entities).filter((e) => !e.disabled);
          executeRuleActions(rule.actions, {
            subject: allEnts[0],
            allEntities: entities,
            updateEntityState,
            updateEntityDetails,
            deleteEntity,
            spawnEntity,
          });
        }
      } else {
        markContinuousConditionFalse(rule, rule.id);
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
      setIsEvaluatingRules(false);
    }
  },
}));

registerRuleEngineStoreBridge({
  getState: () => useSceneStore.getState(),
  setState: (partial) => useSceneStore.setState(partial),
});

if (typeof window !== 'undefined') {
  useSceneStore.getState().hydrateLocalStorage();
}
