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

export type TriggerType =
  | 'collision'
  | 'click'
  | 'drag'
  | 'hover'
  | 'timer'
  | 'keyboard'
  | 'state_change'
  | 'proximity'
  | 'boundary'
  | 'variable';

export type TriggerPhase =
  | 'click'             // Clic complet (sans drag)
  | 'mouse_down'        // Appui (MouseDown / PointerDown)
  | 'mouse_up'          // Relâchement souris (MouseUp / PointerUp)
  | 'down'              // Appui bouton souris
  | 'up'                // Relâchement bouton souris
  | 'drag_release'      // Relâchement du glissement (On Release / Drop)
  | 'drag_start'        // Début du glissement
  | 'enter'             // Entrée en collision ou en survol
  | 'exit'              // Sortie de survol ou de collision
  | 'hover_enter'       // Entrée du survol souris
  | 'hover_exit'        // Sortie du survol souris
  | 'stay'              // Pendant la collision (Contact continu)
  | 'release'           // Sortie de collision (Fin de contact / Séparation)
  | 'collision_release' // Relâchement d'un objet pendant une collision avec la cible
  | 'timer'             // Chronomètre / Minuteur
  | 'key_down'          // Touche enfoncée
  | 'key_up'            // Touche relâchée
  | 'state_enter'       // Passage à un état
  | 'proximity_enter'   // Approche / Proximité
  | 'boundary_hit';     // Contact bord de scène

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

  // Cible (Pour collision, proximité)
  targetMode?: SelectionMode;
  targetId?: EntityId;        // Si mode = 'instance'
  targetType?: EntityType;
  targetTag?: string;
  targetStateId?: StateId;

  // Configuration Minuteur / Timer
  timerInterval?: number;       // secondes (ex: 2, 5, 10)
  timerType?: 'once' | 'repeat'; // 'once' (après X sec) | 'repeat' (toutes les X sec)

  // Configuration Touche Clavier
  keyName?: string;             // 'ArrowUp' | 'ArrowDown' | 'ArrowLeft' | 'ArrowRight' | 'Space' | 'Enter' | 'a' | 'w' | 's' | 'd'

  // Configuration Proximité / Distance
  proximityDistance?: number;   // pixels en rayon (ex: 60, 100)

  // Configuration Bords de Scène
  boundaryEdge?: 'any' | 'top' | 'bottom' | 'left' | 'right';

  // Configuration Compteur / Score
  variableName?: string;        // 'score' | 'counter'
  variableOperator?: '>=' | '==' | '<=';
  variableValue?: number;
}

export type ActionTargetMode = 'subject' | 'target' | 'type' | 'tag' | 'instance';

export type ActionType = 'change_state' | 'toggle_state' | 'toggle_draggable' | 'delete_entity' | 'spawn_entity' | 'play_sound' | 'add_score' | 'delay';

export type SpawnLocationMode = 'at_subject' | 'at_target' | 'offset_subject' | 'offset_target' | 'random' | 'absolute';

export type SoundType = 'pop' | 'bell' | 'laser' | 'bounce' | 'magic' | 'win';

export interface CustomSound {
  id: string;
  name: string;
  dataUrl: string;
  duration?: number;
  source: 'mic' | 'upload';
  createdAt: number;
}

export interface RuleFolder {
  id: string;
  name: string;
  color?: string; // ex: 'indigo', 'emerald', 'amber', 'rose', 'purple', 'sky'
  isCollapsed?: boolean;
}

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

  // Champs pour 'delay' (Attendre / Pause)
  delayDuration?: number; // durée en secondes (ex: 1, 2, 0.5)

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
  customSoundId?: string;

  // Champs pour 'add_score'
  scoreAmount?: number;
}

export interface DynamicRule {
  id: string;
  name: string;
  enabled: boolean;
  folderId?: string; // Dossier thématique de classement
  trigger: RuleTrigger;
  actions: RuleAction[];
}

export type AppMode = 'edit' | 'play';

export type SceneAspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'free';

export interface ProjectSlot {
  id: string;
  name: string;
  updatedAt: number;
  entitiesCount: number;
  rulesCount: number;
  aspectRatio?: SceneAspectRatio;
  data: ProjectExportData;
}

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
  playModeOverlay?: boolean;
  playModeDimOpacity?: 'light' | 'medium' | 'dark';
  aspectRatio?: SceneAspectRatio;
  showRuleFolders?: boolean;
  entityFilterDisplayMode?: 'icon_only' | 'icon_and_text' | 'text_only';
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

export type SceneLayerKind = 'background' | 'foreground' | 'custom';

export interface SceneLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked?: boolean;
  parallaxFactor?: number; // 0 = statique, 0.5 = demi-vitesse, 1 = normal
  vectorPaths: VectorPath[];
}

export interface SceneLayerGroup {
  id: string;
  name: string;
  kind: SceneLayerKind;
  isCollapsed?: boolean;
  layers: SceneLayer[];
}

export interface ProjectExportData {
  version: number;
  name?: string;
  exportedAt: string;
  entities: Record<EntityId, Entity>;
  customArchetypes?: Record<string, Entity>;
  rules: DynamicRule[];
  folders?: RuleFolder[];
  customSounds?: CustomSound[];
  layerGroups?: SceneLayerGroup[];
  settings?: AppSettings;
}


