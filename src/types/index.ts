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
  | 'interactive_puppet'
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
  | 'health'
  | 'jiggle'
  | 'stroke_wiggle'
  | 'slider'
  | 'rotate_drag'
  | 'snap'
  | 'driven_animation';

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
  oneWayPlatform?: boolean; // Plateforme traversable par le bas (atterrissage uniquement par le haut)
  worldPinEnabled?: boolean;        // Épingle souple dans le monde (résiste au drag jusqu'à rupture)
  worldPinStiffness?: number;       // Raideur 0.05..0.95 (défaut 0.25)
  worldPinDamping?: number;         // Amortissement 0.02..0.6 (défaut 0.15)
  worldPinBreakable?: boolean;      // Cassable par traction/drag (défaut true)
  worldPinBreakDistance?: number;   // Distance d'étirement avant rupture en px (défaut 60)
  worldPinBrokenStateId?: StateId;  // État déclenché automatiquement lors de l'arrachement
}

export interface AutoDestroyBehaviorConfig extends BaseBehaviorConfig {
  type: 'auto_destroy';
  delay: number; // Durée de vie en secondes avant destruction automatique (ex: 3s)
}

export type GrabRotationMode = 'free' | 'damped_limited';

export interface DraggableBehaviorConfig extends BaseBehaviorConfig {
  type: 'draggable';
  throwable: boolean;    // Inertie / élan au lâcher de la souris
  maxThrowSpeed?: number; // Plafond de vitesse (défaut 1500 px/s)
  precisePhysicsGrab?: boolean; // Saisie physique au point cliqué (pivote/penche sous gravité via contrainte Matter.js)
  grabRotationMode?: GrabRotationMode; // 'free' (libre 360°) ou 'damped_limited' (angle max + frein amorti)
  grabMaxAngle?: number;         // Débattement max ±° en mode limité (défaut 45)
  grabBrakeAngle?: number;       // Zone de freinage doux aux extrémités en ° (défaut 15)
  grabAngularStiffness?: number; // Raideur du rappel vers la verticale (défaut 140)
  grabAngularDamping?: number;   // Amortissement du balancement (défaut 8)
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
  lookMode?: 'rotate' | 'pupil_orbit'; // défaut 'rotate' ; 'pupil_orbit' déplace l'enfant dans un rayon autour de son attache
  rotationOffset: number; // degrees, default 0
  smoothSpeed: number;    // 0 = instant, >0 = smooth lerp speed
  maxAngle?: number;      // 0 ou >= 180 = libre 360° ; sinon cône max ±maxAngle° (ex: tête ±35°)
  orbitRadius?: number;   // px (mode 'pupil_orbit'), rayon horizontal max, défaut 8
  orbitRadiusY?: number;  // px optionnel (mode 'pupil_orbit'), rayon vertical max, défaut = orbitRadius
  flipMode?: 'none' | 'flipX';         // 'flipX' retourne horizontalement quand la cible change de côté (évite la tête à l'envers)
  facingDirection?: 'right' | 'left';  // Orientation d'origine du dessin (défaut 'right' = 0°)
  flipDeadzone?: number;               // Zone morte horizontale en px (défaut 12) anti-scintillement
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
  followMode?: 'constant_speed' | 'spring'; // défaut 'constant_speed'
  springStiffness?: number;  // raideur du ressort (défaut 120)
  springDamping?: number;    // amortissement du ressort (défaut 10)
  springMaxDistance?: number; // distance max d'élongation en px (0 = libre)
  flipOnMove?: boolean;
  flipInvert?: boolean;
  movementSpace?: 'free_2d' | 'grounded'; // 'free_2d' = 2D libre (défaut), 'grounded' = au sol / plateforme avec gravité
  autoJump?: boolean;        // Saut automatique si la cible est plus haute ou face à un obstacle
  jumpForce?: number;        // px/s, défaut 420
  jumpCooldown?: number;     // secondes entre 2 sauts auto, défaut 0.7
  jumpHeightThreshold?: number; // hauteur min au-dessus de l'entité pour sauter (px), défaut 36
  jumpOnWall?: boolean;      // Sauter aussi en cas d'obstacle mural, défaut true
  stateBindings?: {
    idleStateId?: StateId;
    moveStateId?: StateId;
    jumpStateId?: StateId;
    fallStateId?: StateId;
    minFallHeight?: number; // px minimum de chute avant fallStateId, défaut 20
  };
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

export type PatrolMode = 'symmetric' | 'one_way_return' | 'waypoints';
export type PatrolWaypointLoopMode = 'ping_pong' | 'loop';

export interface PatrolWaypoint {
  id: string;
  mode?: 'position' | 'entity';
  x: number;
  y: number;
  entityId?: EntityId;
  pauseDuration?: number;
  pauseSec?: number;
}

export interface PatrolBehaviorConfig extends BaseBehaviorConfig {
  type: 'patrol';
  axis: 'horizontal' | 'vertical';
  range: number;       // px, default 120
  speed: number;       // px/s, default 100
  pauseDuration: number; // seconds, default 0.5
  pauseAtEnds?: number;  // seconds at each end (optional alias)
  acceleration?: number; // 0.05..1 (réactivité aux demi-tours)
  damping?: number;      // 0..0.99 (inertie en pause)
  flipOnMove?: boolean;
  flipInvert?: boolean;
  patrolMode?: PatrolMode;                // 'symmetric' [-range, +range], 'one_way_return' [0, +range], 'waypoints'
  waypoints?: PatrolWaypoint[];
  waypointLoopMode?: PatrolWaypointLoopMode; // 'ping_pong' | 'loop'
  movementSpace?: 'free_2d' | 'grounded'; // Utilisé notamment en mode waypoints pour préserver la gravité (vy)
  turnOnWall?: boolean;                   // Demi-tour sur collision mur/obstacle
  turnOnCollision?: boolean;              // Demi-tour sur collision avec d'autres entités
  collisionTargetType?: 'any' | 'type' | 'tag' | 'entity';
  collisionTargetEntityId?: EntityId;
  collisionTargetEntityType?: EntityType;
  collisionTargetTag?: string;
  collisionIgnoreSensors?: boolean;       // défaut true : ignorer capteurs/triggers sans collision solide
  collisionTurnCooldownSec?: number;      // défaut 0.25s : anti-oscillation après contact
  detectLedges?: boolean;                 // Détection du vide / bord de plateforme
  ledgeCheckDepth?: number;               // Profondeur de sonde vers le bas en px (défaut 28)
  initialDirection?: 1 | -1;              // Sens initial (défaut 1)
  stateBindings?: {
    idleStateId?: StateId;
    moveStateId?: StateId;
    turnStateId?: StateId;
    turnDuration?: number; // secondes, défaut 0.15
    fallStateId?: StateId;
    minFallHeight?: number; // px minimum de chute avant fallStateId, défaut 20
  };
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
  turnOnWall?: boolean;    // Demi-tour sur mur/obstacle en mode sol
  detectLedges?: boolean;  // Détection du vide en mode sol
  ledgeCheckDepth?: number; // Profondeur sonde (défaut 28 px)
  flipOnMove?: boolean;
  flipInvert?: boolean;
  stateBindings?: {
    idleStateId?: StateId;
    moveStateId?: StateId;
    fallStateId?: StateId;
    minFallHeight?: number; // px minimum de chute avant fallStateId, défaut 20
  };
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
    landStateId?: StateId;
    landDuration?: number; // secondes, défaut 0.15
    minFallHeight?: number; // px minimum de chute avant fall/land, défaut 20
  };
}

export interface BoundaryBehaviorConfig extends BaseBehaviorConfig {
  type: 'boundary_behavior';
  mode: 'bounce' | 'wrap' | 'clamp';
  bounciness?: number; // 0..1, default 0.8
  boundarySpace?: 'world' | 'viewport'; // 'world' = niveau complet (défaut), 'viewport' = cadre visible caméra
}

export type ParticleShape = 'circle' | 'square' | 'spark' | 'star' | 'custom';
export type CustomParticleUsageMode = 'random' | 'sequence' | 'lifetime_anim';
export type ParticleColorMode = 'single' | 'two_colors' | 'gradient_lifetime';
export type ParticleEmissionShape = 'point' | 'circle' | 'box';
export type ParticleDirectionMode = 'angle' | 'facing' | 'toward_target' | 'away_target' | 'mouse';
export type ParticleAnchorPreset =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top_left'
  | 'top_right'
  | 'bottom_left'
  | 'bottom_right'
  | 'pivot';

export interface CustomParticlePreset {
  id: string;
  name: string;
  vectorPaths: VectorPath[];
  useTint?: boolean;
  createdAt: number;
}

export interface ParticleEffectConfig {
  shape: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useParticleTint?: boolean;
  color: string;
  color2?: string;
  colorMode?: ParticleColorMode;
  rate?: number;
  rateMax?: number;
  count?: number;
  countMax?: number;
  speed: number;
  speedMax?: number;
  size: number;
  sizeMax?: number;
  endSizeScale?: number;
  lifetime: number;
  lifetimeMax?: number;
  gravity: number;
  drag?: number;
  opacityStart?: number;
  opacityEnd?: number;
  spinSpeed?: number;
  spread: number;
  angle: number;
  directionMode?: ParticleDirectionMode;
  directionTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  directionTargetEntityId?: EntityId;
  directionTargetEntityType?: EntityType;
  directionTargetTag?: string;
  offsetX?: number;
  offsetY?: number;
  anchor?: ParticleAnchorPreset;
  followRotation?: boolean;
  emissionShape?: ParticleEmissionShape;
  emissionRadius?: number;
  emissionWidth?: number;
  emissionHeight?: number;
  emitterDuration?: number;
  emitterLoop?: boolean;
  initialBurstCount?: number;
  burstInterval?: number;
  burstCount?: number;
}

export interface ParticleEffectPreset {
  id: string;
  name: string;
  createdAt: number;
  updatedAt?: number;
  config: ParticleEffectConfig;
  embeddedCustomSprites?: CustomParticlePreset[];
}

export interface ParticleEmitterBehaviorConfig extends BaseBehaviorConfig {
  type: 'particle_emitter';
  rate: number;          // particules / seconde (1..40+)
  rateMax?: number;
  color: string;
  color2?: string;
  colorMode?: ParticleColorMode;
  shape: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useParticleTint?: boolean;
  speed: number;         // px/s
  speedMax?: number;
  size: number;          // px
  sizeMax?: number;
  endSizeScale?: number;
  lifetime: number;      // secondes
  lifetimeMax?: number;
  gravity: number;       // px/s²
  drag?: number;
  opacityStart?: number;
  opacityEnd?: number;
  spinSpeed?: number;
  spread: number;        // cône en degrés (0..360)
  angle: number;         // direction en degrés (-90 = haut)
  directionMode?: ParticleDirectionMode;
  directionTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  directionTargetEntityId?: EntityId;
  directionTargetEntityType?: EntityType;
  directionTargetTag?: string;
  offsetX?: number;      // décalage X par rapport à l'ancre
  offsetY?: number;      // décalage Y par rapport à l'ancre
  anchor?: ParticleAnchorPreset;
  followRotation?: boolean;
  emissionShape?: ParticleEmissionShape;
  emissionRadius?: number;
  emissionWidth?: number;
  emissionHeight?: number;
  emitterDuration?: number;    // 0 ou undefined = infini ; > 0 = durée finie en secondes
  emitterLoop?: boolean;
  initialBurstCount?: number;  // salve immédiate au démarrage
  burstInterval?: number;      // salves périodiques toutes les X s
  burstCount?: number;
}

export interface FleeBehaviorConfig extends BaseBehaviorConfig {
  type: 'flee';
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag';
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  speed: number;           // px/s, default 160 (0 = réaction sur place uniquement)
  fleeRadius: number;      // rayon de fuite en px (0 = toujours fuir), default 220
  axisMode?: 'free_2d' | 'horizontal'; // 2D libre ou sol horizontal
  acceleration?: number;   // 0.05..1
  damping?: number;        // 0..0.98
  flipOnMove?: boolean;
  flipInvert?: boolean;
  pauseWhileDragged?: boolean; // défaut true : ne pas fuir pendant que le joueur tient l'entité
  stateBindings?: {
    calmStateId?: StateId;
    scaredStateId?: StateId;
  };
}

export interface HealthBehaviorConfig extends BaseBehaviorConfig {
  type: 'health';
  maxHp: number;
  damageTag?: string;
  damageCooldown?: number;
  blinkOnDamage?: boolean;           // effet d'opacité / clignotement pendant l'invincibilité (désactivé par défaut)
  hurtStateId?: StateId;
  recoverStateId?: StateId;
  knockbackForce?: number;
  showHealthBar?: boolean;
  vulnerableTop?: boolean;           // défaut true (false = immunisé par le haut, style Goomba)
  vulnerableBottom?: boolean;        // défaut true
  vulnerableLeft?: boolean;          // défaut true
  vulnerableRight?: boolean;         // défaut true
  immuneTopWhenFalling?: boolean;    // si true, immunisé en haut quand l'attaquant descend (vy > 0)
  onDeath: 'destroy' | 'change_state' | 'none' | 'restart_scene' | 'change_scene';
  deathStateId?: StateId;
  deathDelaySec?: number;            // délai en secondes avant reload/change_scene (défaut 0)
  deathTargetSceneId?: string;       // scène cible si onDeath === 'change_scene'
  deathSceneTransition?: SceneTransitionType;
  deathSceneTransitionDuration?: number;
  disableControlsOnDeath?: boolean;  // bloque contrôles/colliders durant le délai de mort (défaut true)
}

export interface InteractivePuppetDragOverRule {
  id: string;
  targetMode: 'entity' | 'type' | 'tag';
  targetEntityId?: string;
  targetEntityType?: EntityType;
  targetTag?: string;
  stateId?: StateId;
}

export interface InteractivePuppetBehaviorConfig extends BaseBehaviorConfig {
  type: 'interactive_puppet';
  // Drag & Lancer
  throwable?: boolean;
  maxThrowSpeed?: number;
  precisePhysicsGrab?: boolean;   // Saisie physique au point cliqué si composant Physique ou Joint actif
  grabRotationMode?: GrabRotationMode; // 'free' (libre 360°) ou 'damped_limited' (angle max + frein amorti)
  grabMaxAngle?: number;          // Débattement max ±° en mode limité (défaut 45)
  grabBrakeAngle?: number;        // Zone de freinage doux aux extrémités en ° (défaut 15)
  grabAngularStiffness?: number;  // Raideur du rappel vers la verticale (défaut 140)
  grabAngularDamping?: number;    // Amortissement du balancement (défaut 8)
  // Balancement & Pendule (les deux pistes : auto-tilt physique et/ou états visuels)
  swingMode?: 'pendulum' | 'states' | 'both';
  swingAroundGrabPoint?: boolean; // Pivoter/balancer autour du point exact saisi sur l'objet
  pendulumIntensity?: number;   // 0.2..2.5, défaut 1.0
  pendulumMaxAngle?: number;    // degrés max 5..75, défaut 32
  pendulumSmoothing?: number;   // 0.05..0.5, défaut 0.18
  swingSpeedThreshold?: number; // px/s, défaut 320
  shakeThreshold?: number;      // inversions rapides pour état Secousse, défaut 3
  // Seuils de distance curseur (avant hover)
  approachFarDistance?: number;  // px, défaut 280
  approachNearDistance?: number; // px, défaut 120
  // Temporisations, Maintiens & Chute
  hoverEnterDuration?: number;   // s, défaut 0.18
  hoverDwellDelay?: number;      // s, défaut 1.5
  hoverReturnDelay?: number;     // s, défaut 0 (grâce avant retour à la normale quand le curseur quitte)
  hoverExitDuration?: number;    // s, défaut 0.2
  dragStartDuration?: number;    // s, défaut 0.18
  dragDwellDelay?: number;       // s, défaut 2.0
  swingReturnDelay?: number;     // s, défaut 0.15 (maintien de l'état Balancement avant retour au Drag normal)
  shakeHoldDuration?: number;    // s, défaut 0.45 (maintien de l'état Secousse avant retour à la normale)
  dragOverReturnDelay?: number;  // s, défaut 0 (maintien du sous-état sur cible avant retour au Drag)
  dragReleaseDuration?: number;  // s, défaut 0.2
  minFallHeight?: number;        // px, défaut 20
  landDuration?: number;         // s, défaut 0.18
  // Détection drag au-dessus d'autres entités / tags
  dragOverTargets?: InteractivePuppetDragOverRule[];
  // Permet à une interaction active de Marionnette d'interrompre les états de locomotion IA (défaut true)
  allowInterruptLocomotion?: boolean;
  // Liaisons automatiques d'états visuels (avec garde-fou non-écrasant)
  stateBindings?: {
    idleStateId?: StateId;
    approachFarStateId?: StateId;
    approachNearStateId?: StateId;
    hoverEnterStateId?: StateId;
    hoverStateId?: StateId;
    hoverDwellStateId?: StateId;
    hoverExitStateId?: StateId;
    dragStartStateId?: StateId;
    dragStateId?: StateId;
    dragDwellStateId?: StateId;
    swingStateId?: StateId;
    swingLeftStateId?: StateId;
    swingRightStateId?: StateId;
    shakeStateId?: StateId;
    dragReleaseStateId?: StateId;
    fallStateId?: StateId;
    landStateId?: StateId;
  };
}

export type EntityBehavior =
  | PhysicsBehaviorConfig
  | DraggableBehaviorConfig
  | InteractivePuppetBehaviorConfig
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
  | HealthBehaviorConfig
  | JiggleBehaviorConfig
  | StrokeWiggleBehaviorConfig
  | SliderBehaviorConfig
  | RotateDragBehaviorConfig
  | SnapBehaviorConfig
  | DrivenAnimationBehaviorConfig;

export interface EntityPivot {
  x: number; // normalisé 0..1 (0.5 = centre horizontal)
  y: number; // normalisé 0..1 (0.5 = centre vertical)
}

export interface JiggleBehaviorConfig extends BaseBehaviorConfig {
  type: 'jiggle';
  stiffness: number;       // Raideur angulaire (défaut 180)
  damping: number;         // Amortissement (défaut 9)
  inertia: number;         // Sensibilité à l'accélération du parent/mouvement (défaut 1.0)
  maxAngle: number;        // Débattement max ±degrés (défaut 35)
  gravityPull: number;     // Attraction gravitationnelle sur le centre de masse (défaut 40)
  restAngleOffset?: number;    // Angle de repos en degrés (défaut 0)
  initialAngleOffset?: number; // Angle de départ au lancement Play en degrés (défaut 0 = égal au repos)
  squashIntensity?: number;    // Déformation élastique MudBun 0..1.5 (défaut 0.25)
  collideWithWorld?: boolean; // Réagir aux impacts contre murs/sols/objets (défaut true)
  useCustomPivot?: boolean; // Overrider le pivot de l'entité pour ce jiggle
  pivotOverride?: EntityPivot;
}

export interface StrokeWiggleBehaviorConfig extends BaseBehaviorConfig {
  type: 'stroke_wiggle';
  amplitude: number;              // Amplitude de tremblement en unités SVG 0..15 (défaut 2.2)
  fps: number;                    // Vitesse de cycle des traits 1..24 Hz (défaut 6)
  frameCount: number;             // Nombre de variantes pré-calculées en boucle 2..6 (défaut 4)
  detail?: 'low' | 'medium' | 'high'; // Densité de subdivision des traits (défaut 'medium')
  segmentStep?: number;           // Pas exact de subdivision en unités SVG (6..48)
  verticalScale?: number;         // Multiplicateur d'amplitude verticale 0..2 (défaut 1)
  endpointStability?: number;     // Stabilisation des extrémités sur traits ouverts 0..1 (défaut 0)
  seed?: number;                  // Graine aléatoire déterministe 0..999 (défaut 0)
  affectFill?: boolean;           // Animer aussi les formes remplies (défaut true)
  previewInEdit?: boolean;        // Aperçu animé également en mode Édition (défaut false)
  amplitudeVariableName?: string;       // Variable pilotant dynamiquement l'amplitude
  amplitudeVariableMultiplier?: number; // Multiplicateur de variable pour l'amplitude
  fpsVariableName?: string;             // Variable pilotant dynamiquement la cadence (FPS)
  fpsVariableMultiplier?: number;       // Multiplicateur de variable pour les FPS
}

export type SliderGeometryMode = 'line_1d' | 'rect_2d' | 'circle_2d';
export type SliderDragMode = 'direct' | 'physics_spring';
export type SliderStepMode = 'strict' | 'magnetic';
export type SliderReturnMode = 'none' | 'spring_return';

export interface SliderBehaviorConfig extends BaseBehaviorConfig {
  type: 'slider';
  geometryMode: SliderGeometryMode;
  length?: number;           // Rail 1D : longueur totale en px (défaut 220)
  angle?: number;            // Rail 1D : angle en degrés (0 = horizontal, 90 = vertical)
  width?: number;            // Zone 2D Rect : largeur en px (défaut 180)
  height?: number;           // Zone 2D Rect : hauteur en px (défaut 180)
  radius?: number;           // Zone 2D Disque : rayon en px (défaut 90)
  dragMode: SliderDragMode;  // 'direct' | 'physics_spring'
  dragStiffness?: number;    // Raideur ressort curseur en mode physique (défaut 220)
  dragDamping?: number;      // Amortissement en mode physique (défaut 16)
  boundaryBounce?: number;   // Rebond sur les butées 0..0.95 (défaut 0.35)
  stepsX?: number;           // Crans sur X / rail (0 = continu, >=2 = N crans)
  stepsY?: number;           // Crans sur Y en 2D Rect (0 = continu, >=2 = N crans)
  stepMode?: SliderStepMode; // 'strict' | 'magnetic'
  magneticStrength?: number; // Force d'aimantation des crans magnétiques (défaut 140)
  returnMode?: SliderReturnMode; // 'none' | 'spring_return'
  returnPosition?: number;   // Position de rappel 1D normalisée 0..1 (défaut 0.5 = centre)
  returnStiffness?: number;  // Raideur du ressort de retour (défaut 140)
  returnDamping?: number;    // Amortissement du ressort de retour (défaut 12)
  outputVariableX?: string;  // Variable liée à l'axe X / progression 1D
  outputVariableY?: string;  // Variable liée à l'axe Y (2D)
  outputStepVariable?: string; // Variable entière du cran courant (0..N-1)
  outputMin?: number;        // Borne min de sortie (défaut 0 en 1D, -1 en 2D)
  outputMax?: number;        // Borne max de sortie (défaut 100 en 1D, 1 en 2D)
  showTrackInPlay?: boolean; // Afficher le rail / zone de glissière en Mode Play (défaut true)
}

export type RotateDragGestureMode = 'circular' | 'linear_x' | 'linear_y';
export type RotateDragBehaviorMode = 'direct' | 'physics_spring';
export type RotateDragStepMode = 'strict' | 'magnetic';
export type RotateDragReturnMode = 'none' | 'spring_return';

export interface RotateDragBehaviorConfig extends BaseBehaviorConfig {
  type: 'rotate_drag';
  gestureMode: RotateDragGestureMode;   // 'circular' | 'linear_x' | 'linear_y'
  dragMode: RotateDragBehaviorMode;     // 'direct' | 'physics_spring'
  sensitivity?: number;                 // Degrés par pixel en mode linéaire (défaut 0.85)
  dragStiffness?: number;               // Raideur ressort curseur (défaut 240)
  dragDamping?: number;                 // Amortissement en mode physique (défaut 16)
  inertiaDamping?: number;              // Freinage en roue libre après relâchement (défaut 4)
  limitRange?: boolean;                 // Activer butées min/max en degrés
  minAngle?: number;                    // Butée min en degrés (défaut -135)
  maxAngle?: number;                    // Butée max en degrés (défaut 135)
  boundaryBounce?: number;              // Rebond sur les butées 0..0.95 (défaut 0.3)
  steps?: number;                       // Nombre de crans (0 = continu, >=2 = N crans dans la plage, sinon stepAngleDeg)
  stepAngleDeg?: number;                // Pas en degrés si rotation libre infinie (défaut 30)
  stepMode?: RotateDragStepMode;        // 'strict' | 'magnetic'
  magneticStrength?: number;            // Force d'aimantation vers les crans (défaut 140)
  returnMode?: RotateDragReturnMode;    // 'none' | 'spring_return'
  restAngle?: number;                   // Angle de repos en degrés (défaut 0)
  returnStiffness?: number;             // Raideur du ressort de retour (défaut 140)
  returnDamping?: number;               // Amortissement du ressort de retour (défaut 12)
  outputAngleVariable?: string;         // Variable écrite : angle courant en degrés
  outputNormalizedVariable?: string;    // Variable écrite : 0..1 (si borné) ou tours
  outputStepVariable?: string;          // Variable écrite : index du cran courant
  outputMin?: number;                   // Borne min mappée (défaut 0)
  outputMax?: number;                   // Borne max mappée (défaut 100)
  showDialInPlay?: boolean;             // Afficher le cadran/arc repère en Play (défaut true)
}

export type SnapTargetType = 'entity' | 'type' | 'tag' | 'any';
export type SnapTriggerMode = 'on_release' | 'always_when_near';
export type SnapAnimationMode = 'instant' | 'magnetic_smooth';
export type SnapAlignmentMode = 'center' | 'anchor_offset' | 'edge_closest';
export type SnapAnchorPreset = ParticleAnchorPreset | 'custom_canvas';
export type SnapRole = 'magnet_object' | 'receptacle';
export type SnapAttachBehavior =
  | 'position_only'
  | 'parent_rigid'
  | 'parent_spring'
  | 'parent_physics_joint'
  | 'freeze_physics';

export interface SnapBehaviorConfig extends BaseBehaviorConfig {
  type: 'snap';
  snapRole?: SnapRole;                  // 'magnet_object' (défaut) | 'receptacle'
  maxCapacity?: number;                 // utilisé si snapRole === 'receptacle' (défaut 1)
  targetType: SnapTargetType;
  targetEntityId?: EntityId;
  targetEntityType?: EntityType;
  targetTag?: string;
  snapTrigger: SnapTriggerMode;         // 'on_release' | 'always_when_near'
  snapRadius: number;                   // px, défaut 48
  snapMode: SnapAnimationMode;          // 'instant' | 'magnetic_smooth'
  smoothSpeed?: number;                 // 0.05..1, défaut 0.3
  snapAlignment: SnapAlignmentMode;     // 'center' | 'anchor_offset' | 'edge_closest'
  sourceAnchor?: SnapAnchorPreset;      // point d'ancre sur l'objet snappé
  targetAnchor?: SnapAnchorPreset;      // point d'ancre sur la cible
  customSourceAnchor?: Position;        // repère normalisé posé sur le canvas (source)
  customTargetAnchor?: Position;        // repère normalisé posé sur le canvas (cible)
  offsetX?: number;
  offsetY?: number;
  matchTargetRotation?: boolean;
  rotationOffset?: number;
  attachBehavior: SnapAttachBehavior;   // 'position_only' | 'parent_rigid' | 'parent_spring' | 'parent_physics_joint' | 'freeze_physics'
  springStiffness?: number;             // utilisé si attachBehavior === 'parent_spring'
  springDamping?: number;
  jointConfig?: Partial<ParentOffset>;  // configuration avancée du joint physique + Break Joint
  magnetEnabled?: boolean;              // champ d'attraction magnétique avant snap
  magnetRadius?: number;                // rayon du champ d'attraction en px (défaut 120)
  magnetForce?: number;                 // intensité de la force d'attraction (défaut 260)
  approachingStateId?: StateId;         // état déclenché quand une cible entre dans le champ d'attraction
  allowPullUnsnap?: boolean;            // défaut true
  unsnapDistance?: number;              // px (hystérésis d'arrachement, défaut ~1.5x rayon)
  reSnapCooldownSec?: number;           // s avant ré-aimantation après détachement (défaut 0.35)
  snappedStateId?: StateId;
  unsnappedStateId?: StateId;
}

export type DrivenAnimationSourceType =
  | 'proximity'
  | 'variable'
  | 'collision_step'
  | 'collision_hold'
  | 'speed'
  | 'health';

export type DrivenAnimationProgressionMode = 'reversible' | 'irreversible';
export type DrivenAnimationCurve = 'linear' | 'ease_in' | 'ease_out' | 'ease_in_out';
export type DrivenAnimationEndBehavior = 'clamp' | 'loop' | 'ping_pong';

export interface DrivenAnimationBehaviorConfig extends BaseBehaviorConfig {
  type: 'driven_animation';
  sourceType: DrivenAnimationSourceType;
  targetType?: 'mouse' | 'entity' | 'type' | 'tag' | 'nearest_type' | 'nearest_tag' | 'any';
  targetEntityId?: EntityId;
  targetEntityType?: EntityType;
  targetTag?: string;
  proximityDistanceStart?: number;
  proximityDistanceEnd?: number;
  collisionRequireExit?: boolean;
  collisionCooldownSec?: number;
  collisionStepMode?: 'one_frame' | 'custom_percent';
  collisionStepPercent?: number;
  collisionHoldRatePerSec?: number;
  collisionIgnoreSensors?: boolean;
  variableName?: string;
  variableMin?: number;
  variableMax?: number;
  speedMin?: number;
  speedMax?: number;
  invertHealth?: boolean;
  progressionMode: DrivenAnimationProgressionMode;
  smoothing?: number;
  curve?: DrivenAnimationCurve;
  invertOutput?: boolean;
  endBehavior?: DrivenAnimationEndBehavior;
  resetOnStateChange?: boolean;
  driveFlipbook?: boolean;
  driveVisualTransform?: boolean;
  scaleStart?: number;
  scaleEnd?: number;
  rotationStart?: number;
  rotationEnd?: number;
  opacityStart?: number;
  opacityEnd?: number;
  outputVariableName?: string;
  outputVariableMode?: 'percent' | 'normalized' | 'frame_number';
  outputFrameVariableName?: string;
  triggerStateOnCompleteId?: StateId;
  destroyOnComplete?: boolean;
}

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

export interface StateFolder {
  id: string;
  name: string;
  isCollapsed?: boolean;
}

export interface EntityState {
  id: StateId;
  name: string;
  color: string;
  scale: number;
  rotation: number;
  pivot?: EntityPivot; // Override optionnel du pivot pour cet état
  folderId?: string;
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
  // Overrides de comportements par état
  behaviorOverrides?: Record<string, BehaviorOverride>;
  // Override optionnel des paramètres d'attachement / joint physique pour cet état
  parentOffsetOverride?: Partial<ParentOffset>;
  // Specific visual properties for drawing customization
  stemHeight?: number;
  flowerColor?: string;
  flowerPetals?: number;
}

export type ParentAttachmentMode = 'rigid' | 'spring' | 'physics_joint';

export interface ParentOffset {
  x: number;
  y: number;
  rotationOffset?: number;
  inheritRotation?: boolean;
  inheritFlip?: boolean;
  attachmentMode?: ParentAttachmentMode; // défaut 'rigid'
  springStiffness?: number;   // Raideur du ressort (défaut 160)
  springDamping?: number;     // Amortissement (défaut 12)
  springMaxDistance?: number; // Laisse max en px (0 = libre sauf si springLimitMaxDistance === true)
  springLimitMaxDistance?: boolean; // Si true, autorise explicitement une distance max stricte dès 0 px
  springGravity?: number;     // Chute/pesanteur locale sur l'enfant en px/s² (défaut 0)
  collideWithWorld?: boolean; // Collisionner avec murs, sols et objets externes
  // Point d'attache personnalisé côté enfant (posé directement sur le canvas)
  jointChildPivot?: EntityPivot;
  // Contraintes angulaires, zone de freinage & ressort angulaire pour Joint Physique
  jointEnableAngleLimits?: boolean;
  jointMinAngle?: number;
  jointMaxAngle?: number;
  jointBrakeAngle?: number;         // 2e angle : zone de freinage doux avant les extrémités
  jointBrakeStrength?: number;      // Intensité du freinage 0..100
  jointInitialAngleOffset?: number; // Angle de départ au lancement Play (degrés)
  jointAngularStiffness?: number;   // Ressort angulaire vers l'angle de repos (0 = libre)
  jointAngularDamping?: number;     // Amortissement angulaire du pivot
  // Rupture du Joint (Breakable Joint)
  jointBreakable?: boolean;         // Active la rupture sous tension ou secousses
  jointBreakForce?: number;         // Seuil de traction/étirement pour casser (défaut 240)
  jointBreakShakeThreshold?: number; // Tolérance aux secousses/inversions rapides (défaut 100 ; 0 = désactivé)
  jointBreakFallWithGravity?: boolean; // Après rupture, tombe librement avec gravité (défaut true)
  disableCollisionsWhileAttached?: boolean; // Désactive les collisions physiques solides de l'enfant tant qu'il est attaché
}

export type EntityColliderMode = 'default' | 'trigger_only' | 'disabled';
export type PointerDelegationMode = 'self' | 'parent' | 'root_parent';

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
  colliderMode?: EntityColliderMode;         // 'default' | 'trigger_only' | 'disabled' (désactive le collider physique/règles)
  pointerDelegation?: PointerDelegationMode; // 'self' | 'parent' | 'root_parent' (transmet clic/survol/drag en Play)
  ignorePointer?: boolean;                   // En Mode Play, rend la hitbox transparente à la souris (pointer-events: none)
  visible?: boolean;                         // false = objet masqué visuellement sur le canvas (conserve sa logique)
  disabled?: boolean;                        // true = objet totalement désactivé en Play (rendu, physique, règles, pointeur)
  states: Record<StateId, EntityState>;
  icon?: string;
  drawingDataUrl?: string;
  vectorPaths?: VectorPath[];
  drawingLayers?: DrawingLayer[];
  behaviors?: EntityBehavior[];
  zIndex?: number;
  flipX?: boolean;
  pivot?: EntityPivot; // Pivot de base de l'entité (défaut { x: 0.5, y: 0.5 })
  parentId?: EntityId;
  parentOffset?: ParentOffset;
  sharedCollider?: boolean;          // Conserver le même collider physique même si l'état/dessin change
  colliderReferenceStateId?: StateId; // État de référence pour la géométrie du collider partagé
  sharedColliderType?: ColliderType;
  sharedColliderBounds?: ColliderBounds;
  stateFolders?: StateFolder[];
  runtimeTilt?: number;        // Inclinaison pendulaire transitoire en mode Play (non sauvegardée en Édition)
  runtimeJiggleAngle?: number; // Oscillation rotative Jiggle en mode Play
  runtimeScaleX?: number;      // Squash & stretch horizontal transitoire en mode Play
  runtimeScaleY?: number;      // Squash & stretch vertical transitoire en mode Play
  runtimePivot?: EntityPivot;  // Pivot effectif temporaire (ex: jiggle pivotOverride) en mode Play
  runtimeAnimFrameIndex?: number; // Index frame Flipbook piloté par Animation Pilotée / RuleBook en Play
  runtimeAnimScale?: number;      // Multiplicateur d'échelle animé par Animation Pilotée en Play
  runtimeAnimRotation?: number;   // Rotation additive (°) animée par Animation Pilotée en Play
  runtimeAnimOpacity?: number;    // Opacité (0..1) animée par Animation Pilotée en Play
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
  | 'variable'
  | 'joint_break'
  | 'camera_follow'
  | 'target_arrived'
  | 'snap';

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
  | 'boundary_hit'      // Contact bord de scène
  | 'joint_break'       // Rupture d'un joint d'attachement
  | 'camera_follow'     // La caméra commence à suivre une entité
  | 'target_arrived';   // Arrivé sur cible (Follow / MoveTo)

export type SelectionMode = 'type' | 'tag' | 'instance' | 'any';
export type CollisionSideFilter = 'any' | 'top' | 'bottom' | 'left' | 'right' | 'horizontal' | 'vertical';

export interface RuleTrigger {
  type: TriggerType;
  phase?: TriggerPhase; // Phase optionnelle (défaut: 'click' pour clic, 'enter' pour collision)
  revertOnExit?: boolean; // Pour 'stay' : revenir à l'état précédent quand le contact cesse (Toggle)
  autoRevert?: boolean;   // Restauration automatique de l'état initial lors de la fin d'événement (Hover Exit, Mouse Up, Key Up, etc.)
  collisionExitMargin?: number;   // Marge d'hystérésis supplémentaire (px) exigée pour quitter la collision (anti-scintillement)
  collisionTriggerOnce?: boolean; // Si true, la collision ne se déclenche qu'une seule fois par paire pendant la session Play
  collisionSide?: CollisionSideFilter;       // Côté du contact (haut/bas/gauche/droite/horizontal/vertical)
  collisionSideTarget?: 'subject' | 'target'; // Entité de référence du côté (défaut 'subject')
  collisionRequireDownward?: boolean;        // Exiger une vitesse descendante du sujet (écrasement style Goomba)

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
  keyName?: string;             // 'ArrowUp' | 'Space' | 'Enter' | 'a' | 'F1' | 'Any' ...
  keyCode?: string;             // optionnel : code physique (ex: 'Digit1')

  // Configuration Proximité / Distance
  proximityDistance?: number;   // pixels en rayon (ex: 60, 100)

  // Configuration Bords de Scène / Monde
  boundaryEdge?: 'any' | 'top' | 'bottom' | 'left' | 'right';
  boundarySpace?: 'world' | 'viewport'; // 'world' = limites du niveau (défaut), 'viewport' = cadre visible caméra

  // Configuration Compteur / Variables
  variableName?: string;        // 'score' | 'slider_x' | ...
  variableOperator?: '>=' | '==' | '<=' | '>' | '<' | '!=';
  variableValue?: number;
  variableTriggerMode?: 'threshold' | 'on_change';

  // Limites de déclenchement & Délais universels
  triggerMaxCount?: number;     // 0 / undefined = illimité, 1 = une seule fois ("once"), N > 1 = N fois max
  triggerCooldownSec?: number;  // Délai minimum en secondes entre deux déclenchements de cette règle
  triggerStartDelaySec?: number;// Délai initial (secondes) après le début du Play / entrée scène avant activation
  triggerRequireReset?: boolean;// Front montant : doit redevenir faux avant de pouvoir se redéclencher
}

export type ActionTargetMode = 'subject' | 'target' | 'type' | 'tag' | 'instance' | 'last_spawned';

export type SceneTransitionType =
  | 'none'
  | 'fade'
  | 'fade_white'
  | 'slide_left'
  | 'slide_right'
  | 'slide_up'
  | 'slide_down'
  | 'push_left'
  | 'push_right'
  | 'push_up'
  | 'push_down'
  | 'iris'
  | 'iris_white'
  | 'wipe_left'
  | 'curtain'
  | 'zoom_fade';

export type CameraFollowMode = 'none' | 'entity' | 'type' | 'tag';
export type CameraFollowAxis = 'both' | 'horizontal' | 'vertical';

export interface SceneCameraConfig {
  worldMode?: 'viewport' | 'custom';
  worldWidth?: number;
  worldHeight?: number;
  followMode?: CameraFollowMode;
  followEntityId?: EntityId;
  followEntityType?: EntityType;
  followTag?: string;
  followAxis?: CameraFollowAxis;
  followSmoothing?: number; // 0.02..1 (défaut 0.14)
  deadzoneX?: number;       // px (défaut 0)
  deadzoneY?: number;       // px (défaut 0)
  offsetX?: number;         // px (défaut 0)
  offsetY?: number;         // px (défaut 0)
  clampToWorld?: boolean;   // défaut true
  zoom?: number;            // 0.25..3 (défaut 1)
  initialX?: number;        // défaut 0
  initialY?: number;        // défaut 0
  showWorldBoundsInEdit?: boolean; // défaut true
  playAspectRatio?: SceneAspectRatio | 'inherit'; // Format caméra spécifique au Mode Play (sans bandes noires)
}

export interface CameraRuntimeState {
  x: number;
  y: number;
  zoom: number;
  shakeX: number;
  shakeY: number;
  shakeRotation: number;
}

export type ActionType =
  | 'change_state'
  | 'toggle_state'
  | 'toggle_draggable'
  | 'delete_entity'
  | 'spawn_entity'
  | 'play_sound'
  | 'add_score'
  | 'set_variable'
  | 'delay'
  | 'attach_to_parent'
  | 'detach_parent'
  | 'emit_particles'
  | 'move_entity'
  | 'apply_impulse'
  | 'set_entity_enabled'
  | 'change_scene'
  | 'camera_action'
  | 'snap_to'
  | 'unsnap'
  | 'control_animation';

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

export interface SpawnRandomZone {
  x: number;
  y: number;
  width: number;
  height: number;
}

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
  delayTime?: number;     // 0.012..0.8s
  delayFeedback?: number; // 0..0.85
  filterType?: 'none' | 'lowpass' | 'highpass' | 'bandpass';
  filterFreq?: number;    // 150..12000 Hz
  drive?: number;         // 0..1 saturation douce
  reverse?: boolean;      // lecture inversée
  presetId?: string;      // identifiant du filtre / preset rapide appliqué
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

export type SetEntityEnabledScope = 'self' | 'with_children' | 'with_parent' | 'entire_hierarchy';

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
  spawnRandomScope?: 'canvas' | 'zone'; // 'canvas' = tout le canvas (défaut), 'zone' = zone rectangulaire
  spawnRandomZone?: SpawnRandomZone;    // Zone en px sur le canvas si spawnRandomScope === 'zone'
  spawnOffset?: Position;
  spawnSizeMode?: 'default' | 'match_target' | 'match_subject' | 'match_reference' | 'custom';
  spawnScaleMultiplier?: number;
  spawnCustomSize?: Size;
  spawnImpulseSpeed?: number;  // Vitesse d'impulsion initiale en px/s au spawn (0 ou undefined = immobile)
  spawnImpulseAngle?: number;  // Angle de lancement en degrés (0 = droite, -90 = haut, 90 = bas, 180 = gauche)

  // Champs pour 'attach_to_parent' & 'detach_parent'
  parentTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  parentEntityId?: EntityId;
  parentEntityType?: EntityType;
  parentEntityTag?: string;
  parentOffset?: ParentOffset;
  attachKeepCurrentOffset?: boolean; // Conserver la position relative actuelle (même si ΔX/ΔY saisis)
  attachDisableCollisions?: boolean; // Désactiver les collisions solides tant que l'objet est attaché
  detachImpulseSpeed?: number;       // Vitesse d'éjection/lancer en px/s au détachement (0 = lâcher sur place)
  detachImpulseAngle?: number;       // Angle d'éjection en degrés (0 = droite, -90 = haut)

  // Champs pour 'emit_particles'
  particleOriginMode?:
    | 'subject'
    | 'target'
    | 'entity'
    | 'type'
    | 'tag'
    | 'last_spawned'
    | 'event_point'
    | 'coordinates'
    | 'mouse';
  particleOriginEntityId?: EntityId;
  particleOriginEntityType?: EntityType;
  particleOriginTag?: string;
  particleCoords?: Position;
  particleAnchor?: ParticleAnchorPreset;
  particleOffsetX?: number;
  particleOffsetY?: number;
  particleMatchOriginRotation?: boolean;
  particleCount?: number;
  particleCountMax?: number;
  particleColor?: string;
  particleColor2?: string;
  particleColorMode?: ParticleColorMode;
  particleShape?: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useParticleTint?: boolean;
  particleSpeed?: number;
  particleSpeedMax?: number;
  particleSize?: number;
  particleSizeMax?: number;
  particleEndSizeScale?: number;
  particleLifetime?: number;
  particleLifetimeMax?: number;
  particleGravity?: number;
  particleDrag?: number;
  particleOpacityStart?: number;
  particleOpacityEnd?: number;
  particleSpinSpeed?: number;
  particleSpread?: number;
  particleAngle?: number;
  particleDirectionMode?: ParticleDirectionMode;
  particleDirectionTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  particleDirectionTargetEntityId?: EntityId;
  particleDirectionTargetEntityType?: EntityType;
  particleDirectionTargetTag?: string;
  particleEmitDuration?: number;
  particleEmitRate?: number;
  particleBurstCount?: number;
  particleBurstInterval?: number;
  particleEmissionShape?: ParticleEmissionShape;
  particleEmissionRadius?: number;
  particleEmissionWidth?: number;
  particleEmissionHeight?: number;

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

  // Champs pour 'apply_impulse' (Force / Impulsion physique en px/s)
  impulseStrength?: number;
  impulseDirectionMode?: 'cardinal' | 'angle' | 'facing' | 'toward_target' | 'away_target';
  impulseCardinal?: 'up' | 'down' | 'left' | 'right';
  impulseAngle?: number;
  impulseApplyMode?: 'add' | 'set';
  impulseTargetMode?: 'target' | 'subject' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  impulseTargetEntityId?: EntityId;
  impulseTargetEntityType?: EntityType;
  impulseTargetTag?: string;
  impulseAngular?: number;

  // Champs pour 'set_entity_enabled' (Activer / Désactiver une entité en Play)
  enabledActionMode?: 'enable' | 'disable' | 'toggle';
  enabledScope?: SetEntityEnabledScope;

  // Champs pour 'play_sound'
  soundType?: 'pop' | 'bell' | 'laser' | 'bounce' | 'magic' | 'win';
  customSoundId?: string;

  // Champs pour 'add_score'
  scoreAmount?: number;

  // Champs pour 'set_variable'
  variableName?: string;
  variableOperation?: 'set' | 'add' | 'subtract' | 'multiply';
  variableValue?: number;

  // Champs pour 'change_scene'
  targetSceneId?: string;
  sceneTransition?: SceneTransitionType;
  sceneTransitionDuration?: number;

  // Champs pour 'camera_action'
  cameraCommand?: 'shake' | 'zoom' | 'follow' | 'move_to' | 'reset';
  cameraShakeIntensity?: number;
  cameraShakeDuration?: number;
  cameraZoom?: number;
  cameraDuration?: number;
  cameraFollowMode?: CameraFollowMode;
  cameraTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  cameraTargetId?: EntityId;
  cameraTargetType?: EntityType;
  cameraTargetTag?: string;
  cameraPosition?: Position;

  // Champs pour 'snap_to' et 'unsnap' (Aimantation / Détachement magnétique)
  snapTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'any';
  snapTargetEntityId?: EntityId;
  snapTargetEntityType?: EntityType;
  snapTargetTag?: string;
  snapRadius?: number;
  snapAlignment?: SnapAlignmentMode;
  snapSourceAnchor?: SnapAnchorPreset;
  snapTargetAnchor?: SnapAnchorPreset;
  snapCustomSourceAnchor?: Position;
  snapCustomTargetAnchor?: Position;
  snapOffsetX?: number;
  snapOffsetY?: number;
  snapMatchRotation?: boolean;
  snapRotationOffset?: number;
  snapAttachBehavior?: SnapAttachBehavior;
  snapJointConfig?: Partial<ParentOffset>;
  unsnapImpulseSpeed?: number;
  unsnapImpulseAngle?: number;
  unsnapCooldownSec?: number;

  // Champs pour 'control_animation' (Piloter l'animation / frame Flipbook)
  animControlMode?: 'set_frame' | 'step_frame' | 'set_progress' | 'reset';
  animFrameNumber?: number;
  animStepDelta?: number;
  animProgressPercent?: number;
  animLoopOnStep?: boolean;
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
  sizeBytes?: number;
  aspectRatio?: SceneAspectRatio;
  data: ProjectExportData;
}

export interface AutoSaveDraft {
  updatedAt: number;
  sourceSlotId?: string | null;
  sourceSlotName?: string | null;
  entitiesCount: number;
  rulesCount: number;
  sizeBytes: number;
  data: ProjectExportData;
}

export type GizmoVisibilityMode = 'off' | 'edit' | 'play' | 'both';

export type GizmoCategoryId =
  | 'hitboxes'
  | 'colliderLayers'
  | 'hierarchy'
  | 'lookAt'
  | 'puppetZones'
  | 'aiZones'
  | 'physicsVectors'
  | 'springsAndJiggle'
  | 'sliders'
  | 'drivenAnim';

export interface GizmoSettings {
  masterEnabled: boolean;
  onlySelected: boolean;
  categories: Record<GizmoCategoryId, GizmoVisibilityMode>;
}

export interface AppSettings {
  showCanvasLabels: boolean;
  showGrid: boolean;
  gridStyle: 'dots' | 'lines' | 'clean';
  showTagsSystem: boolean;
  showRuleFilters?: boolean;
  showColliderDebugGizmos?: boolean; // Rétrocompatibilité synchronisée avec gizmos.categories.hitboxes
  gizmos?: GizmoSettings;
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
  autoSaveEnabled?: boolean;
  stylusOnlyDrawing?: boolean;
  coloredOnionSkin?: boolean;
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

export interface EntityGroup {
  id: string;
  name: string;
  isCollapsed?: boolean;
  entityTypes: string[];
}

export interface ProjectScene {
  id: string;
  name: string;
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  rules: DynamicRule[];
  folders: RuleFolder[];
  layerGroups: SceneLayerGroup[];
  backgroundColor?: string;
  camera?: SceneCameraConfig;
}

export interface ProjectExportData {
  version: number;
  name?: string;
  exportedAt: string;
  entities: Record<EntityId, Entity>;
  customArchetypes?: Record<string, Entity>;
  entityGroups?: EntityGroup[];
  rules: DynamicRule[];
  folders?: RuleFolder[];
  customSounds?: CustomSound[];
  customParticles?: CustomParticlePreset[];
  particlePresets?: ParticleEffectPreset[];
  layerGroups?: SceneLayerGroup[];
  backgroundColor?: string;
  camera?: SceneCameraConfig;
  scenes?: ProjectScene[];
  activeSceneId?: string;
  settings?: AppSettings;
  projectPalette?: ProjectPaletteColor[];
  initialGameVariables?: Record<string, number>;
}


