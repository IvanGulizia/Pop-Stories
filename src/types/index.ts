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
  circle?: { cx: number; cy: number; r: number };
  layerId?: string;
}

export type UnifiedDrawTool =
  | 'select'
  | 'pencil'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'lasso_fill'
  | 'bucket'
  | 'eraser_partial'
  | 'eraser_stroke';

export interface ProjectPaletteColor {
  id: string;
  name?: string;
  color: string; // hex color ex: '#000000'
}

export type ColliderType = 'box' | 'circle' | 'polygon';

export interface ColliderBounds {
  mode?: 'auto' | 'manual'; // 'auto' = calculé depuis le dessin, 'manual' = position/taille définie à la main
  shape: ColliderType;
  x?: number;      // offset X en espace 0..200 (pour box)
  y?: number;      // offset Y en espace 0..200 (pour box)
  width?: number;  // largeur en espace 0..200 (pour box)
  height?: number; // hauteur en espace 0..200 (pour box)
  centerX?: number; // centre X en espace 0..200 (pour circle)
  centerY?: number; // centre Y en espace 0..200 (pour circle)
  radius?: number; // rayon en espace 0..200 (pour circle)
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
  | 'flee'
  | 'keyboard_control'
  | 'boundary_behavior'
  | 'particle_emitter'
  | 'health';

export interface BaseBehaviorConfig {
  id: string;
  type: BehaviorType;
  enabled: boolean;
}

export interface PhysicsBehaviorConfig extends BaseBehaviorConfig {
  type: 'physics';
  gravity: number;       // px/s^2, default 400
  bounce: number;        // restitution 0..1, default 0.4
  friction: number;      // 0..1 surface friction (0 = glace sans rotation, 1 = caoutchouc qui roule), default 0.5
  frictionStatic?: number; // 0..2 static friction, default 0.5
  frictionAir?: number;    // 0..0.25 air drag damping, default 0.015
  mass: number;          // default 1
  isTrigger?: boolean;   // false = solide avec rebond/blocage physique, true = trigger/fantôme
  isStatic?: boolean;    // true = obstacle fixe infranchissable
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
  acceleration?: number; // 0.05..1 (réactivité vers la vitesse cible, 1 = instantané)
  damping?: number;      // 0..0.99 (inertie / amortissement de dérive)
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
  acceleration?: number; // 0.05..1 (réactivité au démarrage)
  damping?: number;      // 0..0.99 (inertie / glisse à l'arrêt)
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
  acceleration?: number; // 0.05..1 (réactivité)
  damping?: number;      // 0..0.99 (inertie à l'arrivée)
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface PatrolBehaviorConfig extends BaseBehaviorConfig {
  type: 'patrol';
  axis: 'horizontal' | 'vertical';
  range: number;       // px, default 120
  speed: number;       // px/s, default 100
  pauseDuration: number; // seconds, default 0.5
  acceleration?: number; // 0.05..1 (réactivité aux demi-tours)
  damping?: number;      // 0..0.99 (inertie en pause)
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
  acceleration?: number;   // 0.05..1 (douceur des virages / accélérations)
  damping?: number;        // 0..0.99 (glisse en pause)
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
  maxJumps?: number;         // default 1 (1 = saut simple, 2 = double saut, etc.)
  acceleration?: number;     // 0.05..1 (réactivité au démarrage)
  damping?: number;          // 0..0.99 (inertie / glisse au relâchement)
  flipOnMove?: boolean;
  flipInvert?: boolean;
  stateBindings?: {
    idleStateId?: StateId;
    moveStateId?: StateId;
    jumpStateId?: StateId;
    fallStateId?: StateId;
  };
}

export interface BoundaryBehaviorConfig extends BaseBehaviorConfig {
  type: 'boundary_behavior';
  mode: 'bounce' | 'wrap' | 'clamp';
  bounciness?: number; // 0..1, default 0.8
}

export type ParticleShape = 'circle' | 'square' | 'spark' | 'star' | 'custom';
export type CustomParticleUsageMode = 'random' | 'sequence' | 'lifetime_anim';

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
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
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

export interface FleeBehaviorConfig extends BaseBehaviorConfig {
  type: 'flee';
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag';
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  speed: number;           // px/s, default 160
  fleeRadius: number;      // rayon de fuite en px (0 = toujours fuir), default 220
  axisMode?: 'free_2d' | 'horizontal'; // 2D libre ou sol horizontal
  acceleration?: number;   // 0.05..1
  damping?: number;        // 0..0.98
  flipOnMove?: boolean;
  flipInvert?: boolean;
}

export interface HealthBehaviorConfig extends BaseBehaviorConfig {
  type: 'health';
  maxHp: number;
  damageTag?: string;
  damageCooldown?: number;
  hurtStateId?: StateId;
  recoverStateId?: StateId;
  knockbackForce?: number;
  showHealthBar?: boolean;
  onDeath: 'destroy' | 'change_state' | 'none';
  deathStateId?: StateId;
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
  | FleeBehaviorConfig
  | KeyboardControlBehaviorConfig
  | BoundaryBehaviorConfig
  | ParticleEmitterBehaviorConfig
  | HealthBehaviorConfig;

export type BehaviorOverride = {
  enabled?: boolean;
  type?: BehaviorType;
  [key: string]: any;
};

export type AnimationLoopMode = 'loop' | 'ping_pong' | 'once';

export interface AnimationFrame {
  id: string;
  vectorPaths: VectorPath[];
  drawingLayers?: DrawingLayer[];
}

export interface EntityState {
  id: StateId;
  name: string;
  color: string;
  scale: number;
  rotation: number;
  colliderType?: ColliderType;
  colliderBounds?: ColliderBounds;
  overrideCollider?: boolean; // Lorsque sharedCollider est actif sur l'entité, force cet état à utiliser son propre collider
  // Vector drawing overrides per state
  vectorPaths?: VectorPath[];
  drawingLayers?: DrawingLayer[];
  drawingDataUrl?: string;
  // Flipbook animation frames per state (frame 0 synchronisé avec vectorPaths / drawingLayers)
  frames?: AnimationFrame[];
  frameRate?: number;
  animationLoop?: AnimationLoopMode;
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
  sharedCollider?: boolean;          // Conserver le même collider physique même si l'état/dessin change
  colliderReferenceStateId?: StateId; // État de référence pour la géométrie du collider partagé
  sharedColliderType?: ColliderType;
  sharedColliderBounds?: ColliderBounds;
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

export type SelectionMode = 'type' | 'tag' | 'instance' | 'any';

export interface RuleTrigger {
  type: TriggerType;
  phase?: TriggerPhase; // Phase optionnelle (défaut: 'click' pour clic, 'enter' pour collision)
  revertOnExit?: boolean; // Pour 'stay' : revenir à l'état précédent quand le contact cesse (Toggle)
  autoRevert?: boolean;   // Restauration automatique de l'état initial lors de la fin d'événement (Hover Exit, Mouse Up, Key Up, etc.)
  collisionExitMargin?: number;   // Marge d'hystérésis supplémentaire (px) exigée pour quitter la collision (anti-scintillement)
  collisionTriggerOnce?: boolean; // Si true, la collision ne se déclenche qu'une seule fois par paire pendant la session Play
  
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
  | 'emit_particles'
  | 'move_entity';

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

export interface CustomSoundEditParams {
  trimStart: number;    // 0..1 normalized
  trimEnd: number;      // 0..1 normalized
  fadeIn: number;       // seconds
  fadeOut: number;      // seconds
  attack: number;       // seconds (ADSR)
  decay: number;        // seconds (ADSR)
  sustain: number;      // 0..1 level (ADSR)
  release: number;      // seconds (ADSR)
  gain: number;         // 0.1..2.5 volume boost
  playbackRate: number; // 0.5..2.0 speed/pitch
  // Effets Studio avancés (rétrocompatibles)
  reverbMix?: number;     // 0..1
  reverbDecay?: number;   // 0.2..3.5s
  reverbDamping?: number; // 0..1
  delayMix?: number;      // 0..1
  delayTime?: number;     // 0.04..0.8s
  delayFeedback?: number; // 0..0.85
  filterType?: 'none' | 'lowpass' | 'highpass';
  filterFreq?: number;    // 150..12000 Hz
  drive?: number;         // 0..1 saturation douce
  reverse?: boolean;      // lecture inversée
}

export interface CustomSound {
  id: string;
  name: string;
  dataUrl: string;
  rawDataUrl?: string;
  editParams?: CustomSoundEditParams;
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
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useParticleTint?: boolean;
  particleSpeed?: number;
  particleSize?: number;
  particleLifetime?: number;
  particleGravity?: number;
  particleSpread?: number;
  particleAngle?: number;

  // Champs pour 'move_entity' (Déplacer de X px dans une direction)
  moveDistance?: number;
  moveDirectionMode?: 'cardinal' | 'angle' | 'facing' | 'toward_target' | 'away_target';
  moveCardinal?: 'up' | 'down' | 'left' | 'right';
  moveAngle?: number;
  moveApplyMode?: 'instant' | 'impulse';
  moveTargetMode?: 'target' | 'subject' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  moveTargetEntityId?: EntityId;
  moveTargetEntityType?: EntityType;
  moveTargetTag?: string;

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

export type SceneLayerKind = 'background' | 'foreground' | 'collider' | 'custom';
export type SceneLayerRole = 'visual' | 'collider';

export interface SceneLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked?: boolean;
  parallaxFactor?: number; // 0 = statique, 0.5 = demi-vitesse, 1 = normal
  coordinateSpace?: 'world' | 'legacy_200'; // 'world' = repère WYSIWYG 1px = 1 unité SVG (prêt caméra)
  role?: SceneLayerRole;          // 'visual' (décor) ou 'collider' (trait physique précis)
  colliderTags?: string[];        // Tags intégrés au calque collider (ex: ['sol', 'lave'])
  colliderIsTrigger?: boolean;    // false = solide infranchissable, true = zone trigger
  colliderFriction?: number;      // 0..1 (défaut 0.9)
  colliderBounce?: number;        // 0..1 (défaut 0)
  showColliderInPlay?: boolean;   // Afficher ou masquer le trait collider pendant le Mode Play
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


