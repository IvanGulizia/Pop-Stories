export type EntityId = string;
export type StateId = string;

export interface Position {
  x: number;
  y: number;
}

export interface Size {
  width: number;
  height: number;
}

export type EntityType = 'plant' | 'apple' | 'custom' | string;

export interface VectorPoint {
  x: number;
  y: number;
}

export interface VectorRect {
  x: number;
  y: number;
  width: number;
  height: number;
  cornerRadius?: number;
}

export interface VectorPath {
  id: string;
  d: string;
  stroke: string;
  strokeWidth: number;
  fill?: string;
  transform?: string;
  // Metadata for geometric manipulation & interpolation
  type?: 'freehand' | 'polyline' | 'rectangle';
  points?: VectorPoint[];
  rect?: VectorRect;
}

export type ColliderType = 'box' | 'circle' | 'polygon';

export interface ColliderBounds {
  shape: ColliderType;
  x?: number;      // offset or center in 0-200 canvas
  y?: number;
  width?: number;  // for box
  height?: number;
  radius?: number; // for circle
}

export interface EntityState {
  id: StateId;
  name: string;
  color: string;
  scale: number;
  rotation: number;
  colliderType?: ColliderType;
  colliderBounds?: ColliderBounds;
  // Vector drawing overrides per state
  vectorPaths?: VectorPath[];
  drawingDataUrl?: string;
  // Specific visual properties for drawing customization
  stemHeight?: number;
  flowerColor?: string;
  flowerPetals?: number;
}

export interface Entity {
  id: EntityId;
  name: string;
  type: EntityType;
  tags?: string[];
  position: Position;
  size: Size;
  currentStateId: StateId;
  isDraggable: boolean;
  colliderType?: ColliderType;
  colliderBounds?: ColliderBounds;
  states: Record<StateId, EntityState>;
  icon?: string;
  drawingDataUrl?: string;
  vectorPaths?: VectorPath[];
  zIndex?: number;
}

export type TriggerType = 'collision' | 'click' | 'drag';

export type TriggerPhase =
  | 'click'             // Clic complet (sans drag)
  | 'mouse_down'        // Appui (MouseDown / PointerDown)
  | 'mouse_up'          // Relâchement souris (MouseUp / PointerUp)
  | 'drag_release'      // Relâchement du glissement (On Release / Drop)
  | 'drag_start'        // Début du glissement
  | 'enter'             // Entrée en collision (Premier contact)
  | 'stay'              // Pendant la collision (Contact continu)
  | 'release'           // Sortie de collision (Fin de contact / Séparation)
  | 'collision_release'; // Relâchement d'un objet pendant une collision avec la cible

export type SelectionMode = 'type' | 'tag' | 'instance';

export interface RuleTrigger {
  type: TriggerType;
  phase?: TriggerPhase; // Phase optionnelle (défaut: 'click' pour clic, 'enter' pour collision)
  revertOnExit?: boolean; // Pour 'stay' : revenir à l'état précédent quand le contact cesse (Toggle)
  
  // Sujet (Qui déclenche)
  subjectMode?: SelectionMode; // 'type', 'tag' ou 'instance'
  subjectId?: EntityId;        // Si mode = 'instance'
  subjectType?: EntityType;    // Si mode = 'type'
  subjectTag?: string;         // Si mode = 'tag'
  subjectStateId?: StateId;    // État spécifique requis pour le sujet

  // Cible (Pour collision)
  targetMode?: SelectionMode;
  targetId?: EntityId;        // Si mode = 'instance'
  targetType?: EntityType;
  targetTag?: string;
  targetStateId?: StateId;
}

export type ActionTargetMode = 'subject' | 'target' | 'type' | 'tag' | 'instance';

export type ActionType = 'change_state' | 'toggle_state' | 'toggle_draggable' | 'delete_entity' | 'spawn_entity' | 'play_sound';

export type SpawnLocationMode = 'at_subject' | 'at_target' | 'offset_subject' | 'offset_target' | 'random' | 'absolute';

export type SoundType = 'pop' | 'bell' | 'laser' | 'bounce' | 'magic' | 'win';

export interface RuleAction {
  id: string;
  type: ActionType;
  targetMode?: ActionTargetMode; // 'subject' (le sujet), 'target' (la cible), 'type', 'tag'
  targetId?: EntityId;
  targetType?: EntityType;
  targetTag?: string;
  targetStateId?: StateId;
  toggleStateAId?: StateId;
  toggleStateBId?: StateId;
  onlyInStateId?: StateId; // Condition optionnelle sur l'état actuel pour appliquer l'action

  // Champs pour 'spawn_entity'
  spawnEntityType?: EntityType;
  spawnInitialStateId?: StateId;
  spawnLocation?: SpawnLocationMode; // 'at_subject', 'at_target', 'offset_subject', 'offset_target', 'random', 'absolute'
  spawnLocationMode?: SpawnLocationMode;
  spawnPosition?: Position;
  spawnAbsoluteCoords?: Position;
  spawnOffset?: Position;
  spawnSizeMode?: 'default' | 'match_target' | 'match_subject' | 'custom';
  spawnScaleMultiplier?: number;
  spawnCustomSize?: Size;

  // Champs pour 'play_sound'
  soundType?: 'pop' | 'bell' | 'laser' | 'bounce' | 'magic' | 'win';
}

export interface DynamicRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: RuleTrigger;
  actions: RuleAction[];
}

export type AppMode = 'edit' | 'play';

export interface AppSettings {
  showCanvasLabels: boolean;
  showGrid: boolean;
  gridStyle: 'dots' | 'lines' | 'clean';
  showTagsSystem: boolean;
  showRuleFilters?: boolean;
  showColliderDebugGizmos?: boolean;
  useCustomCursors?: boolean;
  cursorShadow?: boolean;
  cursorSourceMode?: 'hugeicons' | 'custom_drawn';
  customCursorVectorPaths?: Record<string, VectorPath[]>;
  customCursorPaths?: Record<string, string>;
  customCursorHotspots?: Record<string, { x: number; y: number }>;
  enableHoverScaleAnimation?: boolean;
}

export interface CursorPackExportData {
  type: 'vector_cursor_pack';
  version: number;
  name?: string;
  exportedAt: string;
  cursorSourceMode?: 'hugeicons' | 'custom_drawn';
  cursorShadow?: boolean;
  customCursorVectorPaths?: Record<string, VectorPath[]>;
  customCursorPaths?: Record<string, string>;
  customCursorHotspots?: Record<string, { x: number; y: number }>;
}

export interface ProjectExportData {
  version: number;
  name?: string;
  exportedAt: string;
  entities: Record<EntityId, Entity>;
  customArchetypes?: Record<string, Entity>;
  rules: DynamicRule[];
  settings?: AppSettings;
}


