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

export interface DrawingLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0 to 1
}

export interface VectorPath {
  id: string;
  d: string;
  stroke: string;
  strokeColorId?: string;
  strokeWidth: number;
  fill?: string;
  fillColorId?: string;
  transform?: string;
  // Metadata for geometric manipulation & interpolation
  type?: 'freehand' | 'polyline' | 'rectangle' | 'circle' | 'straight' | 'fill_bucket';
  points?: VectorPoint[];
  rect?: VectorRect;
  layerId?: string;
}

export interface ProjectPaletteColor {
  id: string;
  name?: string;
  color: string; // hex color ex: '#000000'
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

// ==========================================
// COMPOSANTS & COMPORTEMENTS (BEHAVIORS)
// ==========================================

export type BehaviorType =
  | 'physics'
  | 'draggable'
  | 'auto_destroy'
  | 'constant_velocity'
  | 'look_at'
  | 'follow'
  | 'move_to'
  | 'patrol'
  | 'wandering'
  | 'keyboard_control'
  | 'boundary_behavior'
  | 'particle_emitter';

export interface BaseBehaviorConfig {
  id: string;
  type: BehaviorType;
  enabled: boolean;
}

export interface PhysicsBehaviorConfig extends BaseBehaviorConfig {
  type: 'physics';
  gravity: number;   // px/s^2, default 400
  bounce: number;    // restitution 0..1, default 0.4
  friction: number;  // 0..1, default 0.98
  mass: number;      // default 1
  isTrigger?: boolean; // false = solide avec rebond/blocage physique, true = trigger/fantôme
  isStatic?: boolean;  // true = obstacle fixe infranchissable
  freezeRotation?: boolean; // Rigidbody2D Freeze Rotation (empêche la rotation sous les chocs)
}

export interface AutoDestroyBehaviorConfig extends BaseBehaviorConfig {
  type: 'auto_destroy';
  delay: number; // Durée de vie en secondes avant destruction automatique (ex: 3s)
}

export interface DraggableBehaviorConfig extends BaseBehaviorConfig {
  type: 'draggable';
  throwable: boolean;    // Inertie / élan au lâcher de la souris
  maxThrowSpeed?: number; // Plafond de vitesse (défaut 1500 px/s)
}

export interface ConstantVelocityBehaviorConfig extends BaseBehaviorConfig {
  type: 'constant_velocity';
  vx: number;        // px/s
  vy: number;        // px/s
  angularVelocity?: number; // deg/s
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface LookAtBehaviorConfig extends BaseBehaviorConfig {
  type: 'look_at';
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag';
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  rotationOffset: number; // degrees, default 0
  smoothSpeed: number;    // 0 = instant, >0 = smooth lerp speed
}

export interface FollowBehaviorConfig extends BaseBehaviorConfig {
  type: 'follow';
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag';
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  speed: number;       // px/s, default 150
  minDistance: number; // stop distance, default 40
  smoothing: number;   // lerp factor 0..1, default 0.1
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface MoveToBehaviorConfig extends BaseBehaviorConfig {
  type: 'move_to';
  targetType: 'position' | 'entity' | 'nearest_type' | 'nearest_tag';
  targetPosition?: { x: number; y: number };
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  speed: number;       // px/s, default 120
  stopOnArrival: boolean;
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface PatrolBehaviorConfig extends BaseBehaviorConfig {
  type: 'patrol';
  axis: 'horizontal' | 'vertical';
  range: number;       // px, default 120
  speed: number;       // px/s, default 100
  pauseDuration: number; // seconds, default 0.5
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface WanderingBehaviorConfig extends BaseBehaviorConfig {
  type: 'wandering';
  mode: 'free_2d' | 'horizontal'; // Zone 2D libre ou sol/plateforme horizontal
  radius: number;          // Rayon de la zone de balade (px), défaut 160
  speed: number;           // Vitesse (px/s), défaut 90
  randomness: number;      // Niveau d'aléatoire (0..100%), défaut 65
  changeInterval: number;  // Fréquence de changement de cap (s), défaut 1.5
  pauseDuration: number;   // Pause aléatoire max (s), défaut 0.8
  orientToMovement?: boolean; // Orienter dans le sens du déplacement
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface KeyboardControlBehaviorConfig extends BaseBehaviorConfig {
  type: 'keyboard_control';
  layout: 'arrows' | 'wasd' | 'both';
  speed: number;       // px/s, default 180
  mode: 'top_down' | 'platformer';
  jumpForce?: number;  // px/s, default 450
  allowHorizontal?: boolean; // default true
  allowVertical?: boolean;   // default true (used in top_down)
  allowJump?: boolean;       // default true (used in platformer)
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface BoundaryBehaviorConfig extends BaseBehaviorConfig {
  type: 'boundary_behavior';
  mode: 'bounce' | 'wrap' | 'clamp';
  bounciness?: number; // 0..1, default 0.8
}

export type ParticleShape = 'circle' | 'square' | 'spark' | 'star' | 'custom';

export interface CustomParticlePreset {
  id: string;
  name: string;
  vectorPaths: VectorPath[];
  useTint?: boolean;
  createdAt: number;
}

export interface ParticleEmitterBehaviorConfig extends BaseBehaviorConfig {
  type: 'particle_emitter';
  rate: number;          // particules / seconde (1..40)
  color: string;
  color2?: string;
  shape: ParticleShape;
  customParticleId?: string;
  useParticleTint?: boolean;
  speed: number;         // px/s
  size: number;          // px
  lifetime: number;      // secondes
  gravity: number;       // px/s²
  spread: number;        // cône en degrés (0..360)
  angle: number;         // direction en degrés (-90 = haut)
  offsetX?: number;      // décalage X par rapport au centre
  offsetY?: number;      // décalage Y par rapport au centre
}

export type EntityBehavior =
  | PhysicsBehaviorConfig
  | DraggableBehaviorConfig
  | AutoDestroyBehaviorConfig
  | ConstantVelocityBehaviorConfig
  | LookAtBehaviorConfig
  | FollowBehaviorConfig
  | MoveToBehaviorConfig
  | PatrolBehaviorConfig
  | WanderingBehaviorConfig
  | KeyboardControlBehaviorConfig
  | BoundaryBehaviorConfig
  | ParticleEmitterBehaviorConfig;

export type BehaviorOverride = {
  enabled?: boolean;
  type?: BehaviorType;
  [key: string]: any;
};

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
  drawingLayers?: DrawingLayer[];
  drawingDataUrl?: string;
  // Surcharges de comportements par état
  behaviorOverrides?: Record<string, BehaviorOverride>;
  // Specific visual properties for drawing customization
  stemHeight?: number;
  flowerColor?: string;
  flowerPetals?: number;
}

export interface ParentOffset {
  x: number;
  y: number;
  rotationOffset?: number;
  inheritRotation?: boolean;
  inheritFlip?: boolean;
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
  drawingLayers?: DrawingLayer[];
  behaviors?: EntityBehavior[];
  zIndex?: number;
  flipX?: boolean;
  parentId?: EntityId;
  parentOffset?: ParentOffset;
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
  | 'down'              // Appui (bouton souris ou touche clavier)
  | 'up'                // Relâchement (bouton souris ou touche clavier)
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
  autoRevert?: boolean;   // Restauration automatique de l'état initial lors de la fin d'événement (Hover Exit, Mouse Up, Key Up, etc.)
  
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

export type ActionTargetMode = 'subject' | 'target' | 'type' | 'tag' | 'instance' | 'last_spawned';

export type ActionType =
  | 'change_state'
  | 'toggle_state'
  | 'toggle_draggable'
  | 'delete_entity'
  | 'spawn_entity'
  | 'play_sound'
  | 'add_score'
  | 'delay'
  | 'attach_to_parent'
  | 'detach_parent'
  | 'emit_particles';

export type SpawnLocationMode =
  | 'at_subject'
  | 'at_target'
  | 'at_entity'
  | 'at_event_point'
  | 'offset_subject'
  | 'offset_target'
  | 'offset_entity'
  | 'offset_event_point'
  | 'random'
  | 'absolute';

export type SpawnReferenceMode = 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';

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
  targetMode?: ActionTargetMode; // 'subject' (le sujet), 'target' (la cible), 'type', 'tag', 'last_spawned'
  targetId?: EntityId;
  targetType?: EntityType;
  targetTag?: string;
  targetStateId?: StateId;
  toggleMode?: 'two_states' | 'current_and_target' | 'cycle_all';
  toggleStateAId?: StateId;
  toggleStateBId?: StateId;
  toggleTargetStateId?: StateId;
  onlyInStateId?: StateId; // Condition optionnelle sur l'état actuel pour appliquer l'action

  // Champs pour 'delay' (Attendre / Pause)
  delayDuration?: number; // durée en secondes (ex: 1, 2, 0.5)

  // Champs pour 'spawn_entity'
  spawnEntityType?: EntityType;
  spawnInitialStateId?: StateId;
  spawnTags?: string[]; // Tags supplémentaires attribués à l'instance créée
  spawnLocation?: SpawnLocationMode;
  spawnLocationMode?: SpawnLocationMode;
  spawnReferenceMode?: SpawnReferenceMode;
  spawnReferenceEntityId?: EntityId;
  spawnReferenceEntityType?: EntityType;
  spawnReferenceTag?: string;
  spawnPosition?: Position;
  spawnAbsoluteCoords?: Position;
  spawnOffset?: Position;
  spawnSizeMode?: 'default' | 'match_target' | 'match_subject' | 'match_reference' | 'custom';
  spawnScaleMultiplier?: number;
  spawnCustomSize?: Size;

  // Champs pour 'attach_to_parent'
  parentTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  parentEntityId?: EntityId;
  parentEntityType?: EntityType;
  parentEntityTag?: string;
  parentOffset?: ParentOffset;

  // Champs pour 'emit_particles'
  particleOriginMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'event_point';
  particleOriginEntityId?: EntityId;
  particleOriginEntityType?: EntityType;
  particleOriginTag?: string;
  particleCount?: number;
  particleColor?: string;
  particleColor2?: string;
  particleShape?: ParticleShape;
  customParticleId?: string;
  useParticleTint?: boolean;
  particleSpeed?: number;
  particleSize?: number;
  particleLifetime?: number;
  particleGravity?: number;
  particleSpread?: number;
  particleAngle?: number;

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
  projectPalette?: ProjectPaletteColor[];
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
  customParticles?: CustomParticlePreset[];
  layerGroups?: SceneLayerGroup[];
  settings?: AppSettings;
  projectPalette?: ProjectPaletteColor[];
}


