import Matter from 'matter-js';
import {
  Entity,
  EntityBehavior,
  EntityState,
  Position,
  PhysicsBehaviorConfig,
  DraggableBehaviorConfig,
  InteractivePuppetBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  LookAtBehaviorConfig,
  FollowBehaviorConfig,
  MoveToBehaviorConfig,
  PatrolBehaviorConfig,
  WanderingBehaviorConfig,
  FleeBehaviorConfig,
  KeyboardControlBehaviorConfig,
  BoundaryBehaviorConfig,
  AutoDestroyBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  HealthBehaviorConfig,
  JiggleBehaviorConfig,
  SliderBehaviorConfig,
  RotateDragBehaviorConfig,
  EntityPivot,
  GrabRotationMode,
  SceneLayer,
  SceneTransitionType,
} from '../types';
import { getEntityColliderBounds, getEntityWorldColliderBounds, resolveColliderState } from './collider';
import { emitParticlesBurst } from './particleSystem';

import {
  getEffectiveBehaviors,
  isEntityDraggable,
} from './physics/behaviorResolution';
import {
  shortestAngleDiffRad,
  resolveTargetWorldPoint as resolveTargetWorldPointBase,
  computeLookAtRotationAndFlip as computeLookAtRotationAndFlipBase,
} from './physics/lookAtSolver';
import {
  getHierarchyCollisionGroup as getHierarchyCollisionGroupBase,
  sortEntitiesTopologically,
} from './physics/hierarchyPhysicsSync';
import {
  checkEntityAgainstColliderLayerGeometry,
  buildColliderLayerBodies,
} from './physics/colliderLayerPhysics';
import { computeMovementFlipX, HorizontalIntent } from './physics/flipHelpers';
import {
  resolveEffectivePivot,
  getPivotWorldPosition,
  getBodyWorldCenterFromPivot,
  getEntityTopLeftFromBodyWorldCenter,
  getParentAnchorWorldPosition,
  reanchorPositionForPivotChange,
  rotateVector,
} from './physics/pivotHelpers';
import {
  Spring2DState,
  JiggleRuntimeState,
  stepSpring2D,
  stepJiggleRotational,
} from './physics/springJiggleSolver';
import {
  clampJointBodyAngle,
  computeJointRestWorldDeg,
  stepJointAngularForces,
} from './physics/jointAngularSolver';
import {
  JointBreakRuntimeState,
  createJointBreakRuntimeState,
  evaluateJointBreakState,
} from './physics/jointBreakSolver';
import {
  SliderRuntimeState,
  SliderTrackGeometry,
  stepSliderPhysics,
} from './physics/sliderSolver';
import {
  RotateDragRuntimeState,
  createRotateDragGrabState,
  updateRotateDragPointerTarget,
  stepRotateDragPhysics,
} from './physics/rotateDragSolver';
import {
  PatrolRuntimeState,
  stepPatrolBehavior,
  detectLedgeAheadFromSolids,
} from './physics/patrolSolver';
import {
  computeDirectionalCollisionSide,
  shouldIgnoreOneWayCollision,
} from '../store/collisionHelpers';

export { getEffectiveBehaviors, isEntityDraggable };

const { Engine, World, Bodies, Body, Constraint } = Matter;

// État mémoire de la simulation Matter.js
let engine: Matter.Engine | null = null;
const bodyMap = new Map<string, Matter.Body>();
const colliderOffsets = new Map<string, { relCenterX: number; relCenterY: number }>();
const bodyPivotMeta = new Map<string, { width: number; height: number; effPivot: EntityPivot }>();
const bodySignatures = new Map<string, string>();
const colliderLayerBodyMap = new Map<string, Matter.Body[]>();
const colliderLayerSignatures = new Map<string, string>();
const boundaryBodies: Matter.Body[] = [];
const patrolStates = new Map<string, PatrolRuntimeState>();
interface WanderingRuntimeState {
  origin: Position;
  targetPoint: Position | null;
  moveTimer: number;
  pauseTimer: number;
  currentAngle: number;
}
const wanderingStates = new Map<string, WanderingRuntimeState>();
const activeKeys = new Set<string>();
let listenersAttached = false;

function handleKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.add(e.key.toLowerCase());
  activeKeys.add(e.code);
}

function handleKeyUp(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.delete(e.key.toLowerCase());
  activeKeys.delete(e.code);
}

export function startKeyboardListening() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  listenersAttached = true;
}

export function stopKeyboardListening() {
  if (!listenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  activeKeys.clear();
  listenersAttached = false;
}

const activePhysicsCollisionPairs = new Set<string>();
const activePhysicsCollisionContacts = new Map<string, Position>();
const activePhysicsCollisionNormals = new Map<string, { nx: number; ny: number }>();
const lastEntityVelocities = new Map<string, { vx: number; vy: number }>();
const oneWayPlatformIds = new Set<string>();
const oneWayPassThroughPairs = new Set<string>();
const prevEntityBottoms = new Map<string, number>();
const lateralWallHits = new Map<string, { left: boolean; right: boolean; up: boolean; down: boolean }>();
const groundedEntityIds = new Set<string>();
const jumpTrackers = new Map<string, { jumpsUsed: number; wasJumpPressed: boolean }>();
const keyboardMoveInput = new Map<string, boolean>();
const keyboardHorizIntent = new Map<string, HorizontalIntent>();
const controllerAirStates = new Map<
  string,
  {
    wasGrounded: boolean;
    groundedGraceTimer: number;
    airborneTime: number;
    peakAirY: number;
    maxFallDropPx: number;
    landTimer: number;
    moveGraceTimer: number;
  }
>();
const rebuildingBodyIds = new Set<string>();
const activeDragPositions: Record<string, Position> = {};
const pendingInitialVelocities = new Map<string, { vx: number; vy: number }>();
const impulseDrivenEntityIds = new Set<string>();
const autoDestroyTimers = new Map<string, number>();
const particleEmitterAccumulators = new Map<string, number>();
const hierarchyGroupIds = new Map<string, number>();
let nextNegativeGroupId = -100;

interface PuppetRuntimeState {
  domHovered: boolean;
  wasHovered: boolean;
  hoverTime: number;
  hoverEnterTimer: number;
  hoverReturnTimer: number;
  hoverExitTimer: number;
  dragPhaseActive: boolean;
  wasDragging: boolean;
  hadDragMovement: boolean;
  dragTime: number;
  dragStartTimer: number;
  dragReleaseTimer: number;
  lastDragX: number;
  lastDragY: number;
  smoothDragVx: number;
  smoothDragVy: number;
  grabPivot?: EntityPivot | null;
  grabHoldActive: boolean;
  swingHoldTimer: number;
  swingLastStateId?: string;
  dragOverHoldTimer: number;
  lastDragOverStateId?: string;
  pendulumAngle: number;
  pendulumVel: number;
  shakeCount: number;
  shakeWindowTimer: number;
  shakeActiveTimer: number;
  lastVxSign: -1 | 0 | 1;
  wasGrounded: boolean;
  groundedGraceTimer: number;
  airborneTime: number;
  peakAirY: number;
  maxFallDropPx: number;
  landTimer: number;
}
const puppetRuntimeStates = new Map<string, PuppetRuntimeState>();

function getOrCreatePuppetRuntime(entityId: string, x = 0, y = 0): PuppetRuntimeState {
  let rt = puppetRuntimeStates.get(entityId);
  if (!rt) {
    rt = {
      domHovered: false,
      wasHovered: false,
      hoverTime: 0,
      hoverEnterTimer: 0,
      hoverReturnTimer: 0,
      hoverExitTimer: 0,
      dragPhaseActive: false,
      wasDragging: false,
      hadDragMovement: false,
      dragTime: 0,
      dragStartTimer: 0,
      dragReleaseTimer: 0,
      lastDragX: x,
      lastDragY: y,
      smoothDragVx: 0,
      smoothDragVy: 0,
      grabPivot: null,
      grabHoldActive: false,
      swingHoldTimer: 0,
      swingLastStateId: undefined,
      dragOverHoldTimer: 0,
      lastDragOverStateId: undefined,
      pendulumAngle: 0,
      pendulumVel: 0,
      shakeCount: 0,
      shakeWindowTimer: 0,
      shakeActiveTimer: 0,
      lastVxSign: 0,
      wasGrounded: true,
      groundedGraceTimer: 0.075,
      airborneTime: 0,
      peakAirY: y,
      maxFallDropPx: 0,
      landTimer: 0,
    };
    puppetRuntimeStates.set(entityId, rt);
  }
  return rt;
}

export function setPuppetGrabPivot(
  entityId: string,
  pivot: EntityPivot | null,
  holdActive = false
) {
  const rt = getOrCreatePuppetRuntime(entityId);
  rt.grabPivot = pivot ? { x: pivot.x, y: pivot.y } : null;
  rt.grabHoldActive = Boolean(pivot && holdActive);
}

export function releasePuppetGrabHold(entityId: string) {
  const rt = puppetRuntimeStates.get(entityId);
  if (rt) {
    rt.grabHoldActive = false;
  }
}

function getActivePuppetGrabRawPivot(
  entityId: string,
  effectiveBehaviors: EntityBehavior[]
): EntityPivot | null {
  const puppet = effectiveBehaviors.find((b) => b.type === 'interactive_puppet') as
    | InteractivePuppetBehaviorConfig
    | undefined;
  if (!puppet || puppet.enabled === false || !puppet.swingAroundGrabPoint) {
    return null;
  }
  if (mouseGrabConstraints.has(entityId)) {
    return null;
  }
  return puppetRuntimeStates.get(entityId)?.grabPivot ?? null;
}

export function notifyEntityHoverState(entityId: string, isHovered: boolean) {
  const rt = getOrCreatePuppetRuntime(entityId);
  rt.domHovered = isHovered;
}

export function notifyEntityDragLifecycle(
  entityId: string,
  phase: 'start' | 'move' | 'end',
  pos?: Position,
  hadMovement?: boolean
) {
  const rt = getOrCreatePuppetRuntime(entityId, pos?.x ?? 0, pos?.y ?? 0);
  if (phase === 'start') {
    rt.dragPhaseActive = true;
    rt.hadDragMovement = false;
    if (pos) {
      rt.lastDragX = pos.x;
      rt.lastDragY = pos.y;
    }
  } else if (phase === 'move') {
    rt.dragPhaseActive = true;
    if (hadMovement) {
      rt.hadDragMovement = true;
    }
  } else {
    rt.dragPhaseActive = false;
    rt.grabHoldActive = false;
    if (hadMovement !== undefined) {
      rt.hadDragMovement = hadMovement;
    }
  }
}

interface HealthRuntimeState {
  hp: number;
  maxHp: number;
  invincibilityTimer: number;
  preHurtStateId?: string;
  hurtStateId?: string;
  dead: boolean;
  deathActionTimer?: number;
  deathActionDispatched?: boolean;
}
const healthRuntimeMap = new Map<string, HealthRuntimeState>();

interface LookAtOrbitRuntime {
  ox: number;
  oy: number;
  anchorX?: number;
  anchorY?: number;
}
const lookAtOrbitStates = new Map<string, LookAtOrbitRuntime>();
const lookAtFlipStates = new Map<string, boolean>();
const debugLookAtTargets = new Map<string, Position>();
const springLinkStates = new Map<string, Spring2DState>();
const followSpringStates = new Map<string, Spring2DState>();
const jiggleStates = new Map<string, JiggleRuntimeState>();
const prevAnchorKinematics = new Map<string, { x: number; y: number; vx: number; vy: number }>();
const prevCollidingJiggle = new Set<string>();
const parentJointConstraints = new Map<string, Matter.Constraint>();
const jointBreakStates = new Map<string, JointBreakRuntimeState>();
const brokenJointDynamicIds = new Set<string>();

export interface PhysicsGrabOptions {
  rotationMode?: GrabRotationMode;
  maxAngle?: number;
  brakeAngle?: number;
  angularStiffness?: number;
  angularDamping?: number;
}

interface MouseGrabRuntime {
  localPointFromBodyCenter: Position; // repère local non tourné autour de body.position
  targetWorld: Position;
  constraint: Matter.Constraint;
  rotationMode: GrabRotationMode;
  maxAngle: number;
  brakeAngle: number;
  angularStiffness: number;
  angularDamping: number;
  restAngleDeg: number;
  engagedLimit: boolean;
}
const mouseGrabConstraints = new Map<string, MouseGrabRuntime>();

const debugSpringAnchors = new Map<string, Position>();
const debugJointStressRatios = new Map<string, number>();
const debugGrabPins = new Map<string, { target: Position; grabWorld: Position }>();
const debugJiggleInfos = new Map<
  string,
  { world: Position; angleDeg: number; restDeg: number; squashX: number; squashY: number }
>();

const sliderStates = new Map<string, SliderRuntimeState>();
const lastSliderOutputValues = new Map<string, number>();
const debugSliderTracks = new Map<
  string,
  { geom: SliderTrackGeometry; config: SliderBehaviorConfig; valueX: number; valueY: number; stepIndex: number }
>();

const rotateDragStates = new Map<string, RotateDragRuntimeState>();
const lastRotateDragOutputValues = new Map<string, number>();
const debugRotateDragTracks = new Map<
  string,
  {
    pivotWorld: Position;
    angleDeg: number;
    baseAngleDeg: number;
    config: RotateDragBehaviorConfig;
    radius: number;
    stepIndex: number;
  }
>();

export function startRotateDragGrab(params: {
  entityId: string;
  pointerWorld: Position;
  pivotWorld: Position;
  currentRotationDeg: number;
  config: RotateDragBehaviorConfig;
}): boolean {
  const { entityId, pointerWorld, pivotWorld, currentRotationDeg, config } = params;
  const existing = rotateDragStates.get(entityId);
  if (existing) {
    const updated = createRotateDragGrabState({
      currentAngleDeg: existing.angleDeg,
      baseAngleDeg: existing.baseAngleDeg,
      pivotWorld,
      pointerWorld,
      config,
    });
    updated.angularVel = existing.angularVel;
    rotateDragStates.set(entityId, updated);
    return true;
  }
  rotateDragStates.set(
    entityId,
    createRotateDragGrabState({
      currentAngleDeg: 0,
      baseAngleDeg: currentRotationDeg,
      pivotWorld,
      pointerWorld,
      config,
    })
  );
  return true;
}

export function updateRotateDragGrabTarget(
  entityId: string,
  pointerWorld: Position,
  pivotWorld: Position,
  config: RotateDragBehaviorConfig
): void {
  const st = rotateDragStates.get(entityId);
  if (!st || !st.isGrabbed) return;
  updateRotateDragPointerTarget(st, pointerWorld, pivotWorld, config);
}

export function endRotateDragGrab(entityId: string): void {
  const st = rotateDragStates.get(entityId);
  if (!st) return;
  st.isGrabbed = false;
}

export function startSliderGrab(
  entityId: string,
  worldX: number,
  worldY: number,
  entityCenter?: Position
): boolean {
  const existing = sliderStates.get(entityId);
  if (existing) {
    const cx = existing.originCx + (existing.localX === 0 && existing.localY === 0 ? 0 : 0);
    // Compute current center safely using stored last known or fallback to entityCenter
    const curCenter = entityCenter || { x: cx, y: existing.originCy };
    existing.isGrabbed = true;
    existing.grabOffsetWorld = {
      x: curCenter.x - worldX,
      y: curCenter.y - worldY,
    };
    existing.targetWorld = { x: worldX, y: worldY };
    return true;
  }
  if (!entityCenter) return false;
  sliderStates.set(entityId, {
    originCx: entityCenter.x,
    originCy: entityCenter.y,
    localX: 0,
    localY: 0,
    vx: 0,
    vy: 0,
    isGrabbed: true,
    grabOffsetWorld: {
      x: entityCenter.x - worldX,
      y: entityCenter.y - worldY,
    },
    targetWorld: { x: worldX, y: worldY },
  });
  return true;
}

export function updateSliderGrabTarget(entityId: string, worldX: number, worldY: number) {
  const st = sliderStates.get(entityId);
  if (!st || !st.isGrabbed) return;
  st.targetWorld = { x: worldX, y: worldY };
}

export function endSliderGrab(entityId: string) {
  const st = sliderStates.get(entityId);
  if (!st) return;
  st.isGrabbed = false;
}

export function isEntityPhysicsGrabbed(entityId: string): boolean {
  return mouseGrabConstraints.has(entityId);
}

/**
 * Saisit un corps Matter.js dynamique exactement au point monde cliqué (contrainte ressort 0-longueur),
 * permettant au corps de pencher/pivoter naturellement sous gravité et collisions ou de tirer un joint.
 */
export function startPhysicsGrab(
  entityId: string,
  worldGrabX: number,
  worldGrabY: number,
  grabOptions?: PhysicsGrabOptions
): boolean {
  if (!engine) return false;
  const body = bodyMap.get(entityId);
  if (!body || body.isStatic) return false;

  const existing = mouseGrabConstraints.get(entityId);
  if (existing) {
    World.remove(engine.world, existing.constraint);
    mouseGrabConstraints.delete(entityId);
  }

  delete activeDragPositions[entityId];
  Matter.Sleeping.set(body, false);

  const localPt = rotateVector(
    worldGrabX - body.position.x,
    worldGrabY - body.position.y,
    -body.angle
  );
  const rotatedPtB = rotateVector(localPt.x, localPt.y, body.angle);
  const constraintDef: Record<string, unknown> = {
    pointA: { x: worldGrabX, y: worldGrabY },
    bodyB: body,
    pointB: rotatedPtB,
    angleB: body.angle,
    length: 0,
    stiffness: 0.24,
    damping: 0.14,
  };
  const constraint = Constraint.create(constraintDef as unknown as Matter.IConstraintDefinition);
  (constraint as unknown as { angleB: number }).angleB = body.angle;

  const rotationMode: GrabRotationMode = grabOptions?.rotationMode || 'free';
  const maxAngle = Math.max(5, Math.min(170, grabOptions?.maxAngle ?? 35));
  const brakeAngle = Math.max(0, Math.min(maxAngle - 1, grabOptions?.brakeAngle ?? 15));
  const angularStiffness = Math.max(0, Math.min(500, grabOptions?.angularStiffness ?? 120));
  const angularDamping = Math.max(0, Math.min(30, grabOptions?.angularDamping ?? 6));
  const curDeg = (body.angle * 180) / Math.PI;
  const wrappedCur = ((curDeg % 360) + 540) % 360 - 180;

  mouseGrabConstraints.set(entityId, {
    localPointFromBodyCenter: localPt,
    targetWorld: { x: worldGrabX, y: worldGrabY },
    constraint,
    rotationMode,
    maxAngle,
    brakeAngle,
    angularStiffness,
    angularDamping,
    restAngleDeg: 0,
    engagedLimit: rotationMode !== 'damped_limited' || Math.abs(wrappedCur) <= maxAngle,
  });
  World.add(engine.world, constraint);
  return true;
}

export function updatePhysicsGrabTarget(entityId: string, worldX: number, worldY: number) {
  const grab = mouseGrabConstraints.get(entityId);
  if (!grab) return;
  grab.targetWorld.x = worldX;
  grab.targetWorld.y = worldY;
  grab.constraint.pointA.x = worldX;
  grab.constraint.pointA.y = worldY;
}

export function endPhysicsGrab(
  entityId: string,
  throwable: boolean = true,
  maxThrowSpeed: number = 1500
) {
  const grab = mouseGrabConstraints.get(entityId);
  if (grab) {
    if (engine) {
      World.remove(engine.world, grab.constraint);
    }
    mouseGrabConstraints.delete(entityId);
  }
  const body = bodyMap.get(entityId);
  if (!body || body.isStatic) return;

  Matter.Sleeping.set(body, false);
  if (!throwable) {
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
    return;
  }

  const vxPxPerSec = body.velocity.x * 60;
  const vyPxPerSec = body.velocity.y * 60;
  const speed = Math.hypot(vxPxPerSec, vyPxPerSec);
  const maxAllowed = Math.max(50, maxThrowSpeed || 1500);
  if (speed > maxAllowed) {
    const scale = maxAllowed / speed / 60;
    Body.setVelocity(body, {
      x: vxPxPerSec * scale,
      y: vyPxPerSec * scale,
    });
  }
}

export function getGizmoRuntimeDebugData(): {
  wanderOrigins: Record<string, { origin: Position; targetPoint: Position | null }>;
  patrolOrigins: Record<string, Position>;
  lookAtTargets: Record<string, Position>;
  springAnchors: Record<string, Position>;
  jointStressRatios: Record<string, number>;
  grabPins: Record<string, { target: Position; grabWorld: Position }>;
  jigglePivots: Record<string, { world: Position; angleDeg: number; restDeg: number; squashX: number; squashY: number }>;
  sliderTracks: Record<string, { geom: SliderTrackGeometry; config: SliderBehaviorConfig; valueX: number; valueY: number; stepIndex: number }>;
  rotateDragTracks: Record<
    string,
    {
      pivotWorld: Position;
      angleDeg: number;
      baseAngleDeg: number;
      config: RotateDragBehaviorConfig;
      radius: number;
      stepIndex: number;
    }
  >;
} {
  const wanderOrigins: Record<string, { origin: Position; targetPoint: Position | null }> = {};
  wanderingStates.forEach((v, k) => {
    wanderOrigins[k] = { origin: v.origin, targetPoint: v.targetPoint };
  });
  const patrolOrigins: Record<string, Position> = {};
  patrolStates.forEach((v, k) => {
    patrolOrigins[k] = v.originCenter;
  });
  const lookAtTargets: Record<string, Position> = {};
  debugLookAtTargets.forEach((v, k) => {
    lookAtTargets[k] = v;
  });
  const springAnchors: Record<string, Position> = {};
  debugSpringAnchors.forEach((v, k) => {
    springAnchors[k] = v;
  });
  const jointStressRatios: Record<string, number> = {};
  debugJointStressRatios.forEach((v, k) => {
    jointStressRatios[k] = v;
  });
  const grabPins: Record<string, { target: Position; grabWorld: Position }> = {};
  debugGrabPins.forEach((v, k) => {
    grabPins[k] = v;
  });
  const jigglePivots: Record<
    string,
    { world: Position; angleDeg: number; restDeg: number; squashX: number; squashY: number }
  > = {};
  debugJiggleInfos.forEach((v, k) => {
    jigglePivots[k] = v;
  });
  const sliderTracks: Record<
    string,
    { geom: SliderTrackGeometry; config: SliderBehaviorConfig; valueX: number; valueY: number; stepIndex: number }
  > = {};
  debugSliderTracks.forEach((v, k) => {
    sliderTracks[k] = v;
  });
  const rotateDragTracks: Record<
    string,
    {
      pivotWorld: Position;
      angleDeg: number;
      baseAngleDeg: number;
      config: RotateDragBehaviorConfig;
      radius: number;
      stepIndex: number;
    }
  > = {};
  debugRotateDragTracks.forEach((v, k) => {
    rotateDragTracks[k] = v;
  });
  return {
    wanderOrigins,
    patrolOrigins,
    lookAtTargets,
    springAnchors,
    jointStressRatios,
    grabPins,
    jigglePivots,
    sliderTracks,
    rotateDragTracks,
  };
}

function resolveTargetWorldPoint(
  selfId: string,
  selfX: number,
  selfY: number,
  targetType: 'mouse' | 'entity' | 'nearest_type' | 'nearest_tag',
  targetEntityId: string | undefined,
  targetEntityType: string | undefined,
  targetTag: string | undefined,
  entities: Record<string, Entity>,
  mousePos?: { x: number; y: number } | null
): Position | null {
  return resolveTargetWorldPointBase(
    selfId,
    selfX,
    selfY,
    targetType,
    targetEntityId,
    targetEntityType,
    targetTag,
    entities,
    mousePos,
    colliderOffsets
  );
}

export function getEntityRuntimeHealth(entityId: string): {
  hp: number;
  maxHp: number;
  isInvincible: boolean;
  dead: boolean;
} | null {
  const rt = healthRuntimeMap.get(entityId);
  if (!rt) return null;
  return {
    hp: rt.hp,
    maxHp: rt.maxHp,
    isInvincible: rt.invincibilityTimer > 0,
    dead: rt.dead,
  };
}

function getHierarchyCollisionGroup(entity: Entity, entities: Record<string, Entity>): number {
  return getHierarchyCollisionGroupBase(entity, entities, hierarchyGroupIds, () => nextNegativeGroupId--);
}

export function getActivePhysicsCollisionPairs(): Set<string> {
  return activePhysicsCollisionPairs;
}

export function getPhysicsCollisionContact(idA: string, idB: string): Position | undefined {
  return activePhysicsCollisionContacts.get(`${idA}:::${idB}`);
}

export function getPhysicsCollisionContactInfo(
  idA: string,
  idB: string
):
  | {
      contact?: Position;
      nx: number;
      ny: number;
      vxA: number;
      vyA: number;
      vxB: number;
      vyB: number;
    }
  | undefined {
  const normal = activePhysicsCollisionNormals.get(`${idA}:::${idB}`);
  const velA = lastEntityVelocities.get(idA) || { vx: 0, vy: 0 };
  const velB = lastEntityVelocities.get(idB) || { vx: 0, vy: 0 };
  const contact = activePhysicsCollisionContacts.get(`${idA}:::${idB}`);
  if (!normal && !contact && !lastEntityVelocities.has(idA) && !lastEntityVelocities.has(idB)) {
    return undefined;
  }
  return {
    contact,
    nx: normal?.nx ?? 0,
    ny: normal?.ny ?? 0,
    vxA: velA.vx,
    vyA: velA.vy,
    vxB: velB.vx,
    vyB: velB.vy,
  };
}

/**
 * Vérifie si une entité entre en contact avec un calque Collider de décor (via Matter.js ou géométrie exacte des segments).
 */
export function checkEntityAgainstColliderLayer(
  entityBounds: { x: number; y: number; width: number; height: number; centerX: number; centerY: number; radius: number; colliderType: string },
  entityId: string,
  layer: SceneLayer,
  canvasBounds: { width: number; height: number },
  tolerancePx: number = 3
): { colliding: boolean; contactPoint?: Position } {
  return checkEntityAgainstColliderLayerGeometry(
    entityBounds,
    entityId,
    layer,
    canvasBounds,
    tolerancePx,
    activePhysicsCollisionPairs,
    activePhysicsCollisionContacts
  );
}

export function resetMatterPhysicsRuntime() {
  if (engine) {
    World.clear(engine.world, false);
    Engine.clear(engine);
    engine = null;
  }
  bodyMap.clear();
  colliderOffsets.clear();
  bodyPivotMeta.clear();
  bodySignatures.clear();
  colliderLayerBodyMap.clear();
  colliderLayerSignatures.clear();
  boundaryBodies.length = 0;
  patrolStates.clear();
  wanderingStates.clear();
  activeKeys.clear();
  activePhysicsCollisionPairs.clear();
  activePhysicsCollisionContacts.clear();
  activePhysicsCollisionNormals.clear();
  lastEntityVelocities.clear();
  oneWayPlatformIds.clear();
  oneWayPassThroughPairs.clear();
  prevEntityBottoms.clear();
  lateralWallHits.clear();
  groundedEntityIds.clear();
  jumpTrackers.clear();
  keyboardMoveInput.clear();
  keyboardHorizIntent.clear();
  controllerAirStates.clear();
  rebuildingBodyIds.clear();
  Object.keys(activeDragPositions).forEach((k) => delete activeDragPositions[k]);
  pendingInitialVelocities.clear();
  impulseDrivenEntityIds.clear();
  autoDestroyTimers.clear();
  particleEmitterAccumulators.clear();
  hierarchyGroupIds.clear();
  healthRuntimeMap.clear();
  puppetRuntimeStates.clear();
  lookAtOrbitStates.clear();
  lookAtFlipStates.clear();
  debugLookAtTargets.clear();
  springLinkStates.clear();
  followSpringStates.clear();
  jiggleStates.clear();
  prevAnchorKinematics.clear();
  prevCollidingJiggle.clear();
  parentJointConstraints.clear();
  jointBreakStates.clear();
  brokenJointDynamicIds.clear();
  mouseGrabConstraints.clear();
  debugSpringAnchors.clear();
  debugJointStressRatios.clear();
  debugGrabPins.clear();
  debugJiggleInfos.clear();
  sliderStates.clear();
  lastSliderOutputValues.clear();
  debugSliderTracks.clear();
  rotateDragStates.clear();
  lastRotateDragOutputValues.clear();
  debugRotateDragTracks.clear();
  nextNegativeGroupId = -100;
}

/**
 * Déplace une entité pendant le mode Play (translation directe exacte ou impulsion physique)
 * tout en maintenant le corps Matter.js parfaitement synchronisé.
 */
export function applyEntityMoveAction(
  entityId: string,
  dx: number,
  dy: number,
  mode: 'instant' | 'impulse' = 'instant'
): boolean {
  const body = bodyMap.get(entityId);
  if (!body) return false;

  Matter.Sleeping.set(body, false);
  if (mode === 'impulse' && !body.isStatic) {
    // Impulsion proportionnelle à la distance (dx/dy px convertis en vitesse initiale px/frame)
    const scale = 3.5 / 60;
    const maxStepSpeed = 25;
    const vx = Math.max(-maxStepSpeed, Math.min(maxStepSpeed, body.velocity.x + dx * scale));
    const vy = Math.max(-maxStepSpeed, Math.min(maxStepSpeed, body.velocity.y + dy * scale));
    Body.setVelocity(body, { x: vx, y: vy });
    return true;
  }

  Body.translate(body, { x: dx, y: dy });
  return false;
}

/**
 * Injecte instantanément une vitesse physique dans un corps Matter.js (ex: lancer à la souris)
 * vx et vy sont fournis en px/s et convertis rigoureusement en unités de pas Matter.js (~60Hz).
 */
export function setEntityRuntimeVelocity(entityId: string, vx: number, vy: number) {
  const body = bodyMap.get(entityId);
  if (body) {
    // Si l'objet est statique (pas de physique dynamique), refuser toute impulsion
    if (body.isStatic) return;

    Matter.Sleeping.set(body, false);

    // Conversion px/s -> px/frame Matter.js (~60Hz)
    const matterVx = vx / 60;
    const matterVy = vy / 60;

    // Plafond de sécurité absolu (max 25 px/frame = 1500 px/s)
    const maxSpeedPerTick = 25;
    const speed = Math.hypot(matterVx, matterVy);
    let finalVx = matterVx;
    let finalVy = matterVy;
    if (speed > maxSpeedPerTick) {
      finalVx = (matterVx / speed) * maxSpeedPerTick;
      finalVy = (matterVy / speed) * maxSpeedPerTick;
    }

    Body.setVelocity(body, { x: finalVx, y: finalVy });
  }
}

/**
 * Programme une vitesse initiale (px/s) pour une entité nouvellement créée (spawn_entity),
 * appliquée dès la création de son corps Matter.js au prochain tick (ou immédiatement s'il existe déjà).
 */
export function queueEntityInitialVelocity(entityId: string, vx: number, vy: number) {
  if (!Number.isFinite(vx) || !Number.isFinite(vy)) return;
  impulseDrivenEntityIds.add(entityId);
  const existingBody = bodyMap.get(entityId);
  if (existingBody && !existingBody.isStatic) {
    setEntityRuntimeVelocity(entityId, vx, vy);
    return;
  }
  pendingInitialVelocities.set(entityId, { vx, vy });
}

export function setActiveDragPosition(entityId: string, position: Position | null) {
  if (position && !Number.isNaN(position.x) && !Number.isNaN(position.y)) {
    activeDragPositions[entityId] = { x: position.x, y: position.y };
  } else {
    delete activeDragPositions[entityId];
  }
}

export function getActiveDragPositions(): Record<string, Position> {
  return activeDragPositions;
}

/**
 * Synchronise la position d'un corps pendant un drag manuel à la souris
 * en tenant compte du décalage exact du collider calculé depuis le mode dessin.
 */
export function syncEntityDragPosition(
  entityId: string,
  left: number,
  top: number,
  width?: number,
  height?: number,
  effPivotOverride?: EntityPivot
) {
  setActiveDragPosition(entityId, { x: left, y: top });
  const body = bodyMap.get(entityId);
  if (body) {
    const offset = colliderOffsets.get(entityId) || {
      relCenterX: (width ?? 100) / 2,
      relCenterY: (height ?? 100) / 2,
    };
    const meta = bodyPivotMeta.get(entityId);
    const entSize = {
      width: width ?? meta?.width ?? offset.relCenterX * 2,
      height: height ?? meta?.height ?? offset.relCenterY * 2,
    };
    const effPivot = effPivotOverride ?? meta?.effPivot ?? { x: 0.5, y: 0.5 };
    const rotDeg = (body.angle * 180) / Math.PI;
    const worldCenter = getBodyWorldCenterFromPivot(
      { x: left, y: top },
      entSize,
      offset.relCenterX,
      offset.relCenterY,
      effPivot,
      rotDeg
    );
    Matter.Sleeping.set(body, false);
    Body.setPosition(body, worldCenter);
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }
}

export interface PhysicsTickResult {
  updatedTransforms: Record<
    string,
    {
      position?: Position;
      rotation?: number;
      flipX?: boolean;
      runtimeTilt?: number;
      runtimeJiggleAngle?: number;
      runtimeScaleX?: number;
      runtimeScaleY?: number;
      runtimePivot?: EntityPivot | null;
    }
  >;
  entitiesToDestroy?: string[];
  stateChanges?: Record<string, string>;
  variableUpdates?: Record<string, number>;
  brokenJointEvents?: {
    childId: string;
    parentId: string;
    breakPoint: Position;
    reason: 'force' | 'shake';
  }[];
  healthDeathSceneAction?: {
    action: 'restart_scene' | 'change_scene';
    targetSceneId?: string;
    transition?: SceneTransitionType;
    duration?: number;
  };
}

function computeLookAtRotationAndFlip(params: {
  entityId: string;
  originX: number;
  originY: number;
  targetPt: Position;
  lookAt: LookAtBehaviorConfig;
  currentAngleDeg: number;
  baseRestRotDeg: number;
  currentFlipX: boolean;
  dt: number;
}): {
  nextAngleRad: number;
  nextRotDeg: number;
  nextFlipX: boolean;
  flipUpdated: boolean;
} {
  return computeLookAtRotationAndFlipBase({
    ...params,
    flipStates: lookAtFlipStates,
  });
}

/**
 * Initialise le monde physique Matter.js avec les entités et bordures de scène
 * en calibrant les corps rigides rigoureusement sur les colliders verts du mode dessin.
 */
function ensurePhysicsWorld(
  canvasBounds: { width: number; height: number },
  entities: Record<string, Entity>,
  colliderLayers: SceneLayer[] = []
) {
  if (!engine) {
    engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: false,
    });

    const getBodyLabel = (b: Matter.Body) => b.parent?.label || b.label;

    const handleOneWayCheck = (pair: Matter.Pair): boolean => {
      const idA = getBodyLabel(pair.bodyA);
      const idB = getBodyLabel(pair.bodyB);
      if (!idA || !idB) return false;
      const isAOneWay = oneWayPlatformIds.has(idA);
      const isBOneWay = oneWayPlatformIds.has(idB);
      if (!isAOneWay && !isBOneWay) return false;
      if (pair.bodyA.isSensor || pair.bodyB.isSensor) return false;

      const platBody = isAOneWay ? pair.bodyA : pair.bodyB;
      const moverBody = isAOneWay ? pair.bodyB : pair.bodyA;
      const platId = isAOneWay ? idA : idB;
      const moverId = isAOneWay ? idB : idA;
      const pairKey = `${moverId}:::${platId}`;

      const ignore = shouldIgnoreOneWayCollision({
        entityBounds: {
          x: moverBody.bounds.min.x,
          y: moverBody.bounds.min.y,
          width: Math.max(1, moverBody.bounds.max.x - moverBody.bounds.min.x),
          height: Math.max(1, moverBody.bounds.max.y - moverBody.bounds.min.y),
        },
        platformBounds: {
          x: platBody.bounds.min.x,
          y: platBody.bounds.min.y,
          width: Math.max(1, platBody.bounds.max.x - platBody.bounds.min.x),
          height: Math.max(1, platBody.bounds.max.y - platBody.bounds.min.y),
        },
        entityVy: moverBody.velocity.y * 60,
        prevEntityBottom: prevEntityBottoms.get(moverId),
        wasPassingThrough: oneWayPassThroughPairs.has(pairKey),
      });

      if (ignore) {
        pair.isActive = false;
        oneWayPassThroughPairs.add(pairKey);
        return true;
      }
      oneWayPassThroughPairs.delete(pairKey);
      return false;
    };

    const recordContactFromPair = (pair: Matter.Pair) => {
      const idA = getBodyLabel(pair.bodyA);
      const idB = getBodyLabel(pair.bodyB);
      if (!idA || !idB) return;

      activePhysicsCollisionPairs.add(`${idA}:::${idB}`);
      activePhysicsCollisionPairs.add(`${idB}:::${idA}`);

      const contacts = (pair as any).activeContacts || (pair as any).contacts || [];
      let contactX = (pair.bodyA.position.x + pair.bodyB.position.x) / 2;
      let contactY = (pair.bodyA.position.y + pair.bodyB.position.y) / 2;
      if (contacts.length > 0) {
        let sx = 0;
        let sy = 0;
        let count = 0;
        for (const c of contacts) {
          const v = c?.vertex || c;
          if (v && typeof v.x === 'number' && typeof v.y === 'number') {
            sx += v.x;
            sy += v.y;
            count++;
          }
        }
        if (count > 0) {
          contactX = sx / count;
          contactY = sy / count;
        }
      }
      const pt = { x: Math.round(contactX * 10) / 10, y: Math.round(contactY * 10) / 10 };
      activePhysicsCollisionContacts.set(`${idA}:::${idB}`, pt);
      activePhysicsCollisionContacts.set(`${idB}:::${idA}`, pt);

      // Enregistrer la normale unitaire orientée de A vers B
      const rawNormal = (pair as any).collision?.normal;
      let nxAB = rawNormal?.x ?? 0;
      let nyAB = rawNormal?.y ?? 0;
      const dxAB = pair.bodyB.position.x - pair.bodyA.position.x;
      const dyAB = pair.bodyB.position.y - pair.bodyA.position.y;
      if (dxAB * nxAB + dyAB * nyAB < 0) {
        nxAB = -nxAB;
        nyAB = -nyAB;
      }
      if (Math.hypot(nxAB, nyAB) > 0.01) {
        activePhysicsCollisionNormals.set(`${idA}:::${idB}`, { nx: nxAB, ny: nyAB });
        activePhysicsCollisionNormals.set(`${idB}:::${idA}`, { nx: -nxAB, ny: -nyAB });
      }

      // Détection précise du contact au sol (surfaces solides sous l'entité) et des murs latéraux (pour Patrouille)
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      if (!bodyA.isSensor && !bodyB.isSensor) {
        if (idB === 'boundary_ground') {
          groundedEntityIds.add(idA);
        } else if (idA === 'boundary_ground') {
          groundedEntityIds.add(idB);
        } else {
          const normalY = Math.abs((pair as any).collision?.normal?.y ?? 0);
          if (normalY > 0.38) {
            if (!idA.startsWith('boundary_') && !idA.startsWith('layercol::') && contactY >= bodyA.position.y - 4) {
              groundedEntityIds.add(idA);
            }
            if (!idB.startsWith('boundary_') && !idB.startsWith('layercol::') && contactY >= bodyB.position.y - 4) {
              groundedEntityIds.add(idB);
            }
          }
        }

        // Enregistrement des contacts murs / obstacles solides (axe horizontal & vertical)
        const recordWallHit = (entId: string, dirX: number, dirY: number) => {
          if (entId.startsWith('boundary_') || entId.startsWith('layercol::')) return;
          const hit = lateralWallHits.get(entId) || { left: false, right: false, up: false, down: false };
          if (dirX > 0.65) hit.right = true;
          if (dirX < -0.65) hit.left = true;
          if (dirY > 0.65) hit.down = true;
          if (dirY < -0.65) hit.up = true;
          lateralWallHits.set(entId, hit);
        };
        if (idB === 'boundary_left') recordWallHit(idA, -1, 0);
        else if (idB === 'boundary_right') recordWallHit(idA, 1, 0);
        else if (idB === 'boundary_ceiling') recordWallHit(idA, 0, -1);
        else if (idB === 'boundary_ground') recordWallHit(idA, 0, 1);
        else if (idA === 'boundary_left') recordWallHit(idB, -1, 0);
        else if (idA === 'boundary_right') recordWallHit(idB, 1, 0);
        else if (idA === 'boundary_ceiling') recordWallHit(idB, 0, -1);
        else if (idA === 'boundary_ground') recordWallHit(idB, 0, 1);
        else {
          if (bodyB.isStatic || idB.startsWith('layercol::')) recordWallHit(idA, nxAB, nyAB);
          if (bodyA.isStatic || idA.startsWith('layercol::')) recordWallHit(idB, -nxAB, -nyAB);
        }
      }
    };

    // Écouteur de collisions pour capture temps-réel et rebond calibré
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        if (handleOneWayCheck(pair)) return;
        const idA = getBodyLabel(pair.bodyA);
        const idB = getBodyLabel(pair.bodyB);
        recordContactFromPair(pair);

        // Calibrage du rebond selon la surface heurtée
        const isWallA = idA.startsWith('boundary_');
        const isWallB = idB.startsWith('boundary_');
        if (isWallA || isWallB) {
          const entityBody = isWallA ? pair.bodyB : pair.bodyA;
          pair.restitution = entityBody.restitution || 0.0;
        } else {
          pair.restitution = Math.max(pair.bodyA.restitution || 0, pair.bodyB.restitution || 0);
        }
      });
    });

    Matter.Events.on(engine, 'collisionActive', (event) => {
      event.pairs.forEach((pair) => {
        if (handleOneWayCheck(pair)) return;
        recordContactFromPair(pair);
      });
    });

    Matter.Events.on(engine, 'collisionEnd', (event) => {
      event.pairs.forEach((pair) => {
        const idA = getBodyLabel(pair.bodyA);
        const idB = getBodyLabel(pair.bodyB);
        if (idA && idB) {
          if (rebuildingBodyIds.has(idA) || rebuildingBodyIds.has(idB)) {
            return;
          }
          // Ignorer le collisionEnd d'un ancien corps détruit/reconstruit lors d'un changement d'état
          const currentBodyA = bodyMap.get(idA);
          const currentBodyB = bodyMap.get(idB);
          const isStaleBodyA = !idA.startsWith('boundary_') && !idA.startsWith('layercol::') && currentBodyA && currentBodyA !== pair.bodyA;
          const isStaleBodyB = !idB.startsWith('boundary_') && !idB.startsWith('layercol::') && currentBodyB && currentBodyB !== pair.bodyB;
          if (isStaleBodyA || isStaleBodyB) {
            return;
          }
          activePhysicsCollisionPairs.delete(`${idA}:::${idB}`);
          activePhysicsCollisionPairs.delete(`${idB}:::${idA}`);
          activePhysicsCollisionContacts.delete(`${idA}:::${idB}`);
          activePhysicsCollisionContacts.delete(`${idB}:::${idA}`);
          activePhysicsCollisionNormals.delete(`${idA}:::${idB}`);
          activePhysicsCollisionNormals.delete(`${idB}:::${idA}`);
          oneWayPassThroughPairs.delete(`${idA}:::${idB}`);
          oneWayPassThroughPairs.delete(`${idB}:::${idA}`);
        }
      });
    });
  }

  // Création / mise à jour des bordures solides de scène
  // wallThickness placé strictement à l'extérieur des coordonnées [0, w] et [0, h]
  const wallThickness = 100;
  const w = Math.max(100, canvasBounds.width);
  const h = Math.max(100, canvasBounds.height);

  if (boundaryBodies.length === 0) {
    const span = Math.max(10000, w * 4, h * 4);
    // Murs avec restitution neutre 0.0 : le rebond est déterminé par la variable rebond de l'entité
    const ground = Bodies.rectangle(w / 2, h + wallThickness / 2, span, wallThickness, {
      isStatic: true,
      label: 'boundary_ground',
      restitution: 0.0,
      friction: 0.1,
    });
    const ceiling = Bodies.rectangle(w / 2, -wallThickness / 2, span, wallThickness, {
      isStatic: true,
      label: 'boundary_ceiling',
      restitution: 0.0,
      friction: 0.1,
    });
    const leftWall = Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, span, {
      isStatic: true,
      label: 'boundary_left',
      restitution: 0.0,
      friction: 0.1,
    });
    const rightWall = Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, span, {
      isStatic: true,
      label: 'boundary_right',
      restitution: 0.0,
      friction: 0.1,
    });

    boundaryBodies.push(ground, ceiling, leftWall, rightWall);
    World.add(engine.world, boundaryBodies);
  } else {
    // Repositionner les murs si la taille du canvas a changé
    Body.setPosition(boundaryBodies[0], { x: w / 2, y: h + wallThickness / 2 });
    Body.setPosition(boundaryBodies[1], { x: w / 2, y: -wallThickness / 2 });
    Body.setPosition(boundaryBodies[2], { x: -wallThickness / 2, y: h / 2 });
    Body.setPosition(boundaryBodies[3], { x: w + wallThickness / 2, y: h / 2 });
  }

  // Synchronisation des corps d'entités dans Matter.World (parents initialisés avant enfants pour les chaînes)
  const entityList = sortEntitiesTopologically(entities);
  const currentEntityIds = new Set(entityList.map((e) => e.id));

  // Retirer les corps des entités détruites
  for (const [id, body] of bodyMap.entries()) {
    if (!currentEntityIds.has(id)) {
      const jc = parentJointConstraints.get(id);
      if (jc) {
        World.remove(engine.world, jc);
        parentJointConstraints.delete(id);
      }
      World.remove(engine.world, body);
      bodyMap.delete(id);
      colliderOffsets.delete(id);
      bodyPivotMeta.delete(id);
      bodySignatures.delete(id);
      patrolStates.delete(id);
      wanderingStates.delete(id);
      puppetRuntimeStates.delete(id);
      lookAtOrbitStates.delete(id);
      springLinkStates.delete(id);
      followSpringStates.delete(id);
      jiggleStates.delete(id);
      prevAnchorKinematics.delete(id);
      prevCollidingJiggle.delete(id);
      impulseDrivenEntityIds.delete(id);
      pendingInitialVelocities.delete(id);
    }
  }

  // Créer ou mettre à jour les corps existants
  for (const entity of entityList) {
    const colliderMode = entity.colliderMode || 'default';
    if (colliderMode === 'disabled') {
      const existingConstraint = parentJointConstraints.get(entity.id);
      if (existingConstraint) {
        World.remove(engine.world, existingConstraint);
        parentJointConstraints.delete(entity.id);
      }
      const existing = bodyMap.get(entity.id);
      if (existing) {
        rebuildingBodyIds.add(entity.id);
        World.remove(engine.world, existing);
        rebuildingBodyIds.delete(entity.id);
        bodyMap.delete(entity.id);
        bodySignatures.delete(entity.id);
        colliderOffsets.delete(entity.id);
        bodyPivotMeta.delete(entity.id);
      }
      continue;
    }

    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);

    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const sliderBeh = effectiveBehaviors.find((b) => b.type === 'slider') as SliderBehaviorConfig | undefined;
    const rotateDragBeh = effectiveBehaviors.find((b) => b.type === 'rotate_drag') as RotateDragBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;
    const hasMovement = effectiveBehaviors.some((b) =>
      ['keyboard_control', 'constant_velocity', 'patrol', 'wandering', 'move_to', 'follow', 'flee'].includes(b.type)
    );
    const isAttachedChild = !!(entity.parentId && entities[entity.parentId]);
    const attachMode = entity.parentOffset?.attachmentMode || 'rigid';
    const isCollisionAttachedChild =
      isAttachedChild &&
      (attachMode === 'physics_joint' || (attachMode === 'spring' && entity.parentOffset?.collideWithWorld === true));

    // Enregistrement des plateformes traversables par le bas (one-way)
    if (physics?.oneWayPlatform && physics?.isStatic && !physics?.isTrigger && colliderMode !== 'trigger_only') {
      oneWayPlatformIds.add(entity.id);
    } else {
      oneWayPlatformIds.delete(entity.id);
    }

    // RÈGLE D'OR : Sans composant physics explicite, l'objet n'a PAS de physique dynamique,
    // SAUF si l'enfant attaché demande explicitement un Joint Physique / collision monde,
    // ou s'il vient de rompre son joint cassable avec chute libre active.
    // Un objet Slider ou RotateDrag reste statique/cinématique pour ne pas tomber sous la gravité.
    const isBrokenDynamic = brokenJointDynamicIds.has(entity.id);
    let isStatic = true;
    if (sliderBeh && sliderBeh.enabled !== false && !isCollisionAttachedChild) {
      isStatic = true;
    } else if (rotateDragBeh && rotateDragBeh.enabled !== false && !isCollisionAttachedChild) {
      isStatic = true;
    } else if (isAttachedChild) {
      isStatic = !isCollisionAttachedChild;
    } else if (isBrokenDynamic) {
      isStatic = false;
    } else if (physics) {
      isStatic = physics.isStatic === true;
    } else if (hasMovement || impulseDrivenEntityIds.has(entity.id) || pendingInitialVelocities.has(entity.id)) {
      isStatic = false;
    }

    const isSensor =
      colliderMode === 'trigger_only'
        ? true
        : physics
        ? physics.isTrigger === true
        : isCollisionAttachedChild || isBrokenDynamic
        ? false
        : true;
    const collisionGroup = getHierarchyCollisionGroup(entity, entities);

    // Calcul précis du collider issu du mode dessin (supporte sharedCollider entre états)
    const colliderState = resolveColliderState(entity, currentState);
    const geom = getEntityColliderBounds(entity, currentState, Boolean(entity.flipX));
    const scale = colliderState?.scale ?? 1;
    const scaleX = (entity.size.width * scale) / 200;
    const scaleY = (entity.size.height * scale) / 200;
    const originOffsetX = (entity.size.width * (1 - scale)) / 2;
    const originOffsetY = (entity.size.height * (1 - scale)) / 2;

    const relCenterX = originOffsetX + geom.centerX * scaleX;
    const relCenterY = originOffsetY + geom.centerY * scaleY;
    const effPivot = resolveEffectivePivot(entity, currentState);

    // Angle initial au démarrage (prend en compte jointInitialAngleOffset pour physics_joint)
    let initAngleDeg = currentState?.rotation || 0;
    if (
      isAttachedChild &&
      attachMode === 'physics_joint' &&
      entity.parentOffset?.jointInitialAngleOffset !== undefined &&
      Math.abs(entity.parentOffset.jointInitialAngleOffset) > 0.01
    ) {
      const parentEnt = entities[entity.parentId!];
      const pState = parentEnt?.states[parentEnt.currentStateId];
      const pBody = parentEnt ? bodyMap.get(parentEnt.id) : undefined;
      const pRotDeg =
        pBody && !pBody.isStatic
          ? (pBody.angle * 180) / Math.PI
          : (pState?.rotation || 0) + (parentEnt?.runtimeTilt || 0) + (parentEnt?.runtimeJiggleAngle || 0);
      const restDeg = computeJointRestWorldDeg({
        offset: entity.parentOffset,
        parentRotDeg: pRotDeg,
        parentFlipX: Boolean(parentEnt?.flipX),
      });
      const inheritFlip = entity.parentOffset?.inheritFlip !== false;
      const flipSign = inheritFlip && parentEnt?.flipX ? -1 : 1;
      initAngleDeg = restDeg + entity.parentOffset.jointInitialAngleOffset * flipSign;
    }

    const bodyWorldInit = getBodyWorldCenterFromPivot(
      entity.position,
      entity.size,
      relCenterX,
      relCenterY,
      effPivot,
      initAngleDeg
    );
    const worldCenterX = bodyWorldInit.x;
    const worldCenterY = bodyWorldInit.y;
    const colliderType = geom.colliderType;

    const colliderWidth = Math.max(12, Math.round(geom.width * scaleX));
    const colliderHeight = Math.max(12, Math.round(geom.height * scaleY));
    const colliderRadius = Math.max(6, Math.round(geom.radius * Math.max(scaleX, scaleY)));

    const freezeRotation = physics?.freezeRotation === true;
    const signature = `${colliderMode}_${colliderType}_${colliderWidth}_${colliderHeight}_${colliderRadius}_${isStatic}_${isSensor}_${freezeRotation}`;
    let body = bodyMap.get(entity.id);

    // Si le corps n'existe pas ou si la forme du collider a été modifiée dans le mode dessin, le recréer
    if (!body || bodySignatures.get(entity.id) !== signature) {
      const prevVel = body ? { x: body.velocity.x, y: body.velocity.y } : null;
      if (body) {
        rebuildingBodyIds.add(entity.id);
        World.remove(engine.world, body);
        rebuildingBodyIds.delete(entity.id);
        bodyMap.delete(entity.id);
      }

      const restitution = physics?.bounce ?? boundary?.bounciness ?? 0.0;
      const friction = Math.max(0, Math.min(1, physics?.friction ?? 0.6));
      const frictionStatic = Math.max(0, Math.min(2, physics?.frictionStatic ?? Math.max(0.2, friction * 1.1)));
      const frictionAir = Math.max(0, Math.min(0.25, physics?.frictionAir ?? 0.015));

      const bodyOptions: Matter.IBodyDefinition = {
        label: entity.id,
        isStatic,
        isSensor,
        restitution,
        friction,
        frictionStatic,
        frictionAir,
        mass: Math.max(0.1, physics?.mass || 1),
        inertia: freezeRotation ? Infinity : undefined,
        collisionFilter: { group: collisionGroup },
      };

      if (colliderType === 'circle') {
        body = Bodies.circle(worldCenterX, worldCenterY, colliderRadius, bodyOptions);
      } else {
        body = Bodies.rectangle(worldCenterX, worldCenterY, colliderWidth, colliderHeight, bodyOptions);
      }

      if (freezeRotation) {
        Body.setInertia(body, Infinity);
        Body.setAngle(body, 0);
        Body.setAngularVelocity(body, 0);
      } else if (Math.abs(initAngleDeg) > 0.001) {
        Body.setAngle(body, (initAngleDeg * Math.PI) / 180);
      }

      if (prevVel && !isStatic) {
        Body.setVelocity(body, prevVel);
      }

      const queuedVel = pendingInitialVelocities.get(entity.id);
      if (queuedVel) {
        pendingInitialVelocities.delete(entity.id);
        if (!isStatic) {
          const maxStepSpeed = 25;
          const mvx = queuedVel.vx / 60;
          const mvy = queuedVel.vy / 60;
          const spd = Math.hypot(mvx, mvy);
          const fx = spd > maxStepSpeed ? (mvx / spd) * maxStepSpeed : mvx;
          const fy = spd > maxStepSpeed ? (mvy / spd) * maxStepSpeed : mvy;
          Matter.Sleeping.set(body, false);
          Body.setVelocity(body, { x: fx, y: fy });
        }
      }

      bodyMap.set(entity.id, body);
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      bodyPivotMeta.set(entity.id, { width: entity.size.width, height: entity.size.height, effPivot });
      bodySignatures.set(entity.id, signature);
      World.add(engine.world, body);
    } else {
      const prevOffset = colliderOffsets.get(entity.id);
      if (
        prevOffset &&
        (Math.abs(relCenterX - prevOffset.relCenterX) > 0.5 ||
          Math.abs(relCenterY - prevOffset.relCenterY) > 0.5)
      ) {
        Body.setPosition(body, {
          x: body.position.x + (relCenterX - prevOffset.relCenterX),
          y: body.position.y + (relCenterY - prevOffset.relCenterY),
        });
      }
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      bodyPivotMeta.set(entity.id, { width: entity.size.width, height: entity.size.height, effPivot });
      body.isSensor = isSensor;
      body.collisionFilter.group = collisionGroup;
      if (physics) {
        const nextFriction = Math.max(0, Math.min(1, physics.friction ?? 0.6));
        body.restitution = physics.bounce ?? 0.0;
        body.friction = nextFriction;
        body.frictionStatic = Math.max(0, Math.min(2, physics.frictionStatic ?? Math.max(0.2, nextFriction * 1.1)));
        body.frictionAir = Math.max(0, Math.min(0.25, physics.frictionAir ?? 0.015));
        const targetMass = Math.max(0.1, physics.mass || 1);
        if (!isStatic && Math.abs(body.mass - targetMass) > 0.05) {
          Body.setMass(body, targetMass);
        }
        if (physics.freezeRotation) {
          Body.setInertia(body, Infinity);
          Body.setAngle(body, 0);
          Body.setAngularVelocity(body, 0);
        }
      }
    }
  }

  // Synchronisation des calques Colliders de décor dans Matter.World
  const activeLayerIds = new Set(colliderLayers.map((l) => l.id));
  for (const [layerId, bodies] of colliderLayerBodyMap.entries()) {
    if (!activeLayerIds.has(layerId)) {
      bodies.forEach((b) => World.remove(engine!.world, b));
      colliderLayerBodyMap.delete(layerId);
      colliderLayerSignatures.delete(layerId);
    }
  }

  for (const layer of colliderLayers) {
    const sig = JSON.stringify({
      isTrig: Boolean(layer.colliderIsTrigger),
      fric: layer.colliderFriction ?? 0.9,
      bnc: layer.colliderBounce ?? 0,
      cs: layer.coordinateSpace || 'world',
      wh: layer.coordinateSpace === 'legacy_200' ? `${Math.round(w)}x${Math.round(h)}` : 'world',
      paths: (layer.vectorPaths || []).map((p) => `${p.id}:${p.d}:${p.strokeWidth}:${p.points?.length || 0}`),
    });

    if (colliderLayerSignatures.get(layer.id) !== sig) {
      const prevBodies = colliderLayerBodyMap.get(layer.id);
      if (prevBodies) {
        prevBodies.forEach((b) => World.remove(engine!.world, b));
      }
      const nextBodies = buildColliderLayerBodies(layer, canvasBounds);
      if (nextBodies.length > 0) {
        World.add(engine!.world, nextBodies);
      }
      colliderLayerBodyMap.set(layer.id, nextBodies);
      colliderLayerSignatures.set(layer.id, sig);
    }
  }
}

/**
 * Interpolation fluide de vitesse (Accélération + Inertie/Damping) compatible à 100% avec les comportements existants.
 */
function approachAxisVelocity(
  current: number,
  target: number | null,
  accel?: number,
  damping?: number,
  fallbackDamping?: number
): number {
  if (target !== null) {
    const a = accel !== undefined ? Math.max(0.02, Math.min(1, accel)) : 1;
    return a >= 0.999 ? target : current + (target - current) * a;
  }
  const d = damping !== undefined ? Math.max(0, Math.min(0.99, damping)) : fallbackDamping;
  return d !== undefined ? current * d : current;
}

/**
 * Exécute un pas de simulation Matter.js et applique les comportements
 */
export function stepMatterPhysics(params: {
  entities: Record<string, Entity>;
  deltaTime: number; // en secondes
  canvasBounds: { width: number; height: number };
  viewportRect?: { x: number; y: number; width: number; height: number };
  mousePos?: { x: number; y: number } | null;
  colliderLayers?: SceneLayer[];
}): PhysicsTickResult {
  const { entities, deltaTime, canvasBounds, viewportRect, mousePos, colliderLayers = [] } = params;
  const dt = Math.min(deltaTime, 0.05);

  const activeDragEntries = Object.entries(activeDragPositions);
  const liveEntities: Record<string, Entity> =
    activeDragEntries.length > 0 ? { ...entities } : entities;
  if (activeDragEntries.length > 0) {
    for (const [dragId, dragPos] of activeDragEntries) {
      const orig = liveEntities[dragId];
      if (orig) {
        liveEntities[dragId] = { ...orig, position: { x: dragPos.x, y: dragPos.y } };
      }
    }
  }

  ensurePhysicsWorld(canvasBounds, liveEntities, colliderLayers);
  if (!engine) return { updatedTransforms: {} };

  const updatedTransforms: PhysicsTickResult['updatedTransforms'] = {};
  const flipUpdates = new Map<string, boolean>();
  const entitiesToDestroy: string[] = [];
  const stateChanges: Record<string, string> = {};
  const variableUpdates: Record<string, number> = {};
  const brokenJointEvents: NonNullable<PhysicsTickResult['brokenJointEvents']> = [];
  const brokenJointIdSet = new Set<string>();
  let healthDeathSceneAction: PhysicsTickResult['healthDeathSceneAction'];
  const entityList = Object.values(liveEntities);
  keyboardMoveInput.clear();
  keyboardHorizIntent.clear();
  debugLookAtTargets.clear();
  debugSpringAnchors.clear();
  debugJointStressRatios.clear();
  debugGrabPins.clear();
  debugJiggleInfos.clear();
  debugSliderTracks.clear();
  debugRotateDragTracks.clear();

  // Pré-calcul des rectangles solides pour la détection du vide (Patrouille 2.0)
  const solidRectsForLedge: Array<{ id: string; x: number; y: number; width: number; height: number }> = [];
  for (const [bId, b] of bodyMap.entries()) {
    if (b.isStatic && !b.isSensor) {
      solidRectsForLedge.push({
        id: bId,
        x: b.bounds.min.x,
        y: b.bounds.min.y,
        width: Math.max(1, b.bounds.max.x - b.bounds.min.x),
        height: Math.max(1, b.bounds.max.y - b.bounds.min.y),
      });
    }
  }

  // Pré-passe : synchroniser / nettoyer les Matter.Constraints des enfants attachés avec collisions monde
  const topoPrepassEntities = sortEntitiesTopologically(liveEntities);
  interface ActiveJointEntry {
    entity: Entity;
    parent: Entity;
    body: Matter.Body;
    parentBody?: Matter.Body;
    useBodyA: boolean;
    localPointA?: Position;
    localPointB: Position;
    anchorPt: Position;
    offset: Entity['parentOffset'];
    isJoint: boolean;
    freezeRotation: boolean;
  }
  const activeJointEntries: ActiveJointEntry[] = [];

  for (const entity of topoPrepassEntities) {
    const parent = entity.parentId ? liveEntities[entity.parentId] : undefined;
    const offset = entity.parentOffset;
    const attachMode = offset?.attachmentMode || 'rigid';
    const isCollisionAttached = Boolean(
      parent &&
        (attachMode === 'physics_joint' || (attachMode === 'spring' && offset?.collideWithWorld === true))
    );
    const body = bodyMap.get(entity.id);
    const existingConstraint = parentJointConstraints.get(entity.id);

    if (!isCollisionAttached || !body || body.isStatic) {
      if (existingConstraint) {
        World.remove(engine.world, existingConstraint);
        parentJointConstraints.delete(entity.id);
      }
      continue;
    }

    const parentState = parent!.states[parent!.currentStateId];
    const pJiggleBeh = getEffectiveBehaviors(parent!, parentState).find((b) => b.type === 'jiggle') as
      | JiggleBehaviorConfig
      | undefined;
    const pRawPivotOverride =
      pJiggleBeh && pJiggleBeh.enabled !== false && pJiggleBeh.useCustomPivot && pJiggleBeh.pivotOverride
        ? pJiggleBeh.pivotOverride
        : undefined;
    const parentEffPivot = resolveEffectivePivot(parent!, parentState, pRawPivotOverride, Boolean(parent!.flipX));
    const parentBody = bodyMap.get(parent!.id);
    const useBodyA = Boolean(parentBody && !parentBody.isStatic && !activeDragPositions[parent!.id]);
    const parentRotDeg = useBodyA && parentBody
      ? (parentBody.angle * 180) / Math.PI
      : (parentState?.rotation || 0) + (parent!.runtimeTilt || 0) + (parent!.runtimeJiggleAngle || 0);
    const inheritFlip = offset?.inheritFlip !== false;
    const inheritRot = offset?.inheritRotation !== false;
    const anchorPt = getParentAnchorWorldPosition({
      parentPosition: parent!.position,
      parentSize: parent!.size,
      parentPivot: parentEffPivot,
      parentRotDeg,
      parentFlipX: Boolean(parent!.flipX),
      offsetX: offset?.x || 0,
      offsetY: offset?.y || 0,
      inheritRotation: inheritRot,
      inheritFlip,
    });
    const anchorX = anchorPt.x;
    const anchorY = anchorPt.y;
    debugSpringAnchors.set(entity.id, { x: anchorX, y: anchorY });

    const currentState = entity.states[entity.currentStateId];
    const effBehs = getEffectiveBehaviors(entity, currentState);
    const physics = effBehs.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const jiggleBeh = effBehs.find((b) => b.type === 'jiggle') as JiggleBehaviorConfig | undefined;
    const rawPivotOverride =
      jiggleBeh && jiggleBeh.enabled !== false && jiggleBeh.useCustomPivot && jiggleBeh.pivotOverride
        ? jiggleBeh.pivotOverride
        : undefined;
    const childFlip = inheritFlip ? Boolean(parent!.flipX) : Boolean(entity.flipX);
    const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, childFlip);
    const cOffset = colliderOffsets.get(entity.id) || {
      relCenterX: entity.size.width / 2,
      relCenterY: entity.size.height / 2,
    };
    const localPointB = {
      x: effPivot.x * entity.size.width - cOffset.relCenterX,
      y: effPivot.y * entity.size.height - cOffset.relCenterY,
    };
    // Matter.Constraint.solve maintient pointB dans le repère monde courant et le fait tourner
    // selon (body.angle - constraint.angleB) : il faut donc toujours fournir le vecteur déjà tourné
    // par body.angle et aligner angleB = body.angle pour éviter tout blocage/rotation sur place.
    const rotatedPointB = rotateVector(localPointB.x, localPointB.y, body.angle);

    let localPointA: Position | undefined;
    let rotatedPointA: Position = { x: anchorX, y: anchorY };
    if (useBodyA && parentBody) {
      const pCOffset = colliderOffsets.get(parent!.id) || {
        relCenterX: parent!.size.width / 2,
        relCenterY: parent!.size.height / 2,
      };
      const lx = inheritFlip && parent!.flipX ? -(offset?.x || 0) : (offset?.x || 0);
      const ly = offset?.y || 0;
      localPointA = {
        x: 0.5 * parent!.size.width + lx - pCOffset.relCenterX,
        y: 0.5 * parent!.size.height + ly - pCOffset.relCenterY,
      };
      rotatedPointA = rotateVector(localPointA.x, localPointA.y, parentBody.angle);
    }

    const stiffness =
      attachMode === 'physics_joint'
        ? offset?.springStiffness !== undefined
          ? Math.max(0.06, Math.min(0.98, offset.springStiffness / 520))
          : 0.85
        : Math.max(0.015, Math.min(0.65, (offset?.springStiffness ?? 160) / 620));
    const damping =
      attachMode === 'physics_joint'
        ? offset?.springDamping !== undefined
          ? Math.max(0.005, Math.min(0.45, offset.springDamping / 140))
          : 0.05
        : Math.max(0.02, Math.min(0.45, (offset?.springDamping ?? 12) / 42));

    const desiredBodyA = useBodyA && parentBody ? parentBody : undefined;
    const prevBodyA = existingConstraint?.bodyA || undefined;
    const needsRecreate =
      !existingConstraint ||
      existingConstraint.bodyB !== body ||
      prevBodyA !== desiredBodyA;

    if (needsRecreate) {
      if (existingConstraint) World.remove(engine.world, existingConstraint);
      const constraintDef: Record<string, unknown> = {
        pointA: rotatedPointA,
        bodyB: body,
        pointB: rotatedPointB,
        angleB: body.angle,
        length: 0,
        stiffness,
        damping,
      };
      if (desiredBodyA) {
        constraintDef.bodyA = desiredBodyA;
        constraintDef.angleA = desiredBodyA.angle;
      }
      const nextConstraint = Constraint.create(constraintDef as unknown as Matter.IConstraintDefinition);
      (nextConstraint as unknown as { angleB: number }).angleB = body.angle;
      if (desiredBodyA) {
        (nextConstraint as unknown as { angleA: number }).angleA = desiredBodyA.angle;
      }
      parentJointConstraints.set(entity.id, nextConstraint);
      World.add(engine.world, nextConstraint);
    } else {
      existingConstraint.pointA.x = rotatedPointA.x;
      existingConstraint.pointA.y = rotatedPointA.y;
      if (desiredBodyA) {
        (existingConstraint as unknown as { angleA: number }).angleA = desiredBodyA.angle;
      }
      existingConstraint.pointB.x = rotatedPointB.x;
      existingConstraint.pointB.y = rotatedPointB.y;
      (existingConstraint as unknown as { angleB: number }).angleB = body.angle;
      existingConstraint.stiffness = stiffness;
      existingConstraint.damping = damping;
    }

    // Gravité locale unifiée (évite tout doublon entre gravité monde, physics.gravity et springGravity)
    const defaultLocalG = physics
      ? (physics.gravity ?? 400)
      : attachMode === 'physics_joint'
      ? 400
      : 0;
    const effectiveG = offset?.springGravity !== undefined ? offset.springGravity : defaultLocalG;
    const netGRatio = effectiveG / 400 - 1;
    if (Math.abs(netGRatio) > 0.001) {
      Body.applyForce(body, body.position, {
        x: 0,
        y: netGRatio * 0.001 * (engine.world.gravity.y || 1) * body.mass,
      });
    }

    activeJointEntries.push({
      entity,
      parent: parent!,
      body,
      parentBody,
      useBodyA,
      localPointA,
      localPointB,
      anchorPt,
      offset,
      isJoint: attachMode === 'physics_joint',
      freezeRotation: physics?.freezeRotation === true,
    });
  }

  for (const entity of entityList) {
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
    const body = bodyMap.get(entity.id);

    // Vérifier l'autodestruction temporisée même sans corps physique dynamique
    const autoDestroy = effectiveBehaviors.find((b) => b.type === 'auto_destroy') as AutoDestroyBehaviorConfig | undefined;
    if (autoDestroy && autoDestroy.enabled !== false) {
      const delay = Math.max(0.1, autoDestroy.delay ?? 3);
      const elapsed = (autoDestroyTimers.get(entity.id) || 0) + dt;
      autoDestroyTimers.set(entity.id, elapsed);
      if (elapsed >= delay) {
        entitiesToDestroy.push(entity.id);
      }
    }

    // Si l'entité est attachée à un parent, sa position/rotation est gérée par contrainte ou cinématique
    if (entity.parentId && liveEntities[entity.parentId]) {
      continue;
    }

    // Si l'entité est actuellement déplacée manuellement à la souris, figer son corps sur le curseur
    const activeDragPos = activeDragPositions[entity.id];
    if (activeDragPos && body) {
      const dragOffset = colliderOffsets.get(entity.id) || {
        relCenterX: entity.size.width / 2,
        relCenterY: entity.size.height / 2,
      };
      const jiggleCfg = effectiveBehaviors.find((b) => b.type === 'jiggle') as JiggleBehaviorConfig | undefined;
      const activeGrabRawPivot = getActivePuppetGrabRawPivot(entity.id, effectiveBehaviors);
      const rawPivotOverride =
        activeGrabRawPivot ??
        (jiggleCfg && jiggleCfg.enabled !== false && jiggleCfg.useCustomPivot && jiggleCfg.pivotOverride
          ? jiggleCfg.pivotOverride
          : undefined);
      const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, entity.flipX ?? false);
      bodyPivotMeta.set(entity.id, { width: entity.size.width, height: entity.size.height, effPivot });
      const worldCenter = getBodyWorldCenterFromPivot(
        activeDragPos,
        entity.size,
        dragOffset.relCenterX,
        dragOffset.relCenterY,
        effPivot,
        (body.angle * 180) / Math.PI
      );
      Body.setPosition(body, worldCenter);
      Body.setVelocity(body, { x: 0, y: 0 });
      Body.setAngularVelocity(body, 0);
      continue;
    }

    if (
      !body ||
      (effectiveBehaviors.length === 0 &&
        !impulseDrivenEntityIds.has(entity.id) &&
        !brokenJointDynamicIds.has(entity.id) &&
        !mouseGrabConstraints.has(entity.id))
    ) {
      continue;
    }

    if (
      effectiveBehaviors.some((b) => (b.type === 'slider' || b.type === 'rotate_drag') && b.enabled !== false)
    ) {
      continue;
    }

    // Récupérer les comportements configurés
    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const constVel = effectiveBehaviors.find((b) => b.type === 'constant_velocity') as ConstantVelocityBehaviorConfig | undefined;
    const keyboard = effectiveBehaviors.find((b) => b.type === 'keyboard_control') as KeyboardControlBehaviorConfig | undefined;
    const patrol = effectiveBehaviors.find((b) => b.type === 'patrol') as PatrolBehaviorConfig | undefined;
    const wandering = effectiveBehaviors.find((b) => b.type === 'wandering') as WanderingBehaviorConfig | undefined;
    const moveTo = effectiveBehaviors.find((b) => b.type === 'move_to') as MoveToBehaviorConfig | undefined;
    const follow = effectiveBehaviors.find((b) => b.type === 'follow') as FollowBehaviorConfig | undefined;
    const flee = effectiveBehaviors.find((b) => b.type === 'flee') as FleeBehaviorConfig | undefined;
    const lookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;

    // Figer la rotation si freezeRotation est activé (Rigidbody 2D Freeze Rotation)
    if (physics?.freezeRotation) {
      Body.setAngle(body, 0);
      Body.setAngularVelocity(body, 0);
    }

    // 0. Annulation de la gravité pour les entités sans composant 'physics' mais avec mouvement actif
    if (!physics && !body.isStatic) {
      Body.applyForce(body, body.position, {
        x: 0,
        y: -0.001 * body.mass * (engine.world.gravity.y || 1),
      });
      // S'il n'y a pas d'action verticale commandée, amortir vy résiduel (sauf projectile sous impulsion)
      if (
        !keyboard &&
        !constVel?.vy &&
        !patrol &&
        !wandering &&
        !moveTo &&
        !follow &&
        !flee &&
        !impulseDrivenEntityIds.has(entity.id)
      ) {
        Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * 0.8 });
      }
    }

    // 1. Gravité personnalisée exacte (400 = gravité standard 1x ; 0 = apesanteur exacte)
    if (physics && !physics.isStatic) {
      const customG = physics.gravity ?? 400;
      const gravityRatio = customG / 400;
      if (Math.abs(gravityRatio - 1) > 0.001) {
        Body.applyForce(body, body.position, {
          x: 0,
          y: (gravityRatio - 1) * 0.001 * (engine.world.gravity.y || 1) * body.mass,
        });
      }
    }

    // 2. Vitesse continue (convertie de px/s vers px/frame avec accélération & damping)
    if (constVel) {
      const targetVx = constVel.vx !== undefined && constVel.vx !== 0 ? constVel.vx / 60 : null;
      const targetVy = constVel.vy !== undefined && constVel.vy !== 0 ? constVel.vy / 60 : null;
      const nextVx = approachAxisVelocity(body.velocity.x, targetVx, constVel.acceleration, constVel.damping);
      const nextVy = approachAxisVelocity(body.velocity.y, targetVy, constVel.acceleration, constVel.damping);
      if (targetVx !== null || targetVy !== null || constVel.damping !== undefined) {
        Body.setVelocity(body, { x: nextVx, y: nextVy });
      }
      if (constVel.angularVelocity) {
        Body.setAngularVelocity(body, ((constVel.angularVelocity / 60) * Math.PI) / 180);
      }
    }

    const healthCfg = effectiveBehaviors.find((b) => b.type === 'health') as HealthBehaviorConfig | undefined;
    const healthRt = healthCfg ? healthRuntimeMap.get(entity.id) : undefined;
    const controlsLockedByDeath = Boolean(
      healthRt?.dead && healthCfg && healthCfg.enabled !== false && healthCfg.disableControlsOnDeath !== false
    );

    // 3. Contrôles Joueur (Clavier)
    if (keyboard && !controlsLockedByDeath) {
      const layout = keyboard.layout || 'both';
      const allowArrows = layout === 'arrows' || layout === 'both';
      const allowWasd = layout === 'wasd' || layout === 'both';
      const allowHorizontal = keyboard.allowHorizontal !== false;
      const allowVertical = keyboard.allowVertical !== false;
      const allowJump = keyboard.allowJump !== false;

      const left =
        allowHorizontal &&
        ((allowArrows && activeKeys.has('arrowleft')) ||
          (allowWasd && (activeKeys.has('a') || activeKeys.has('q') || activeKeys.has('keya'))));
      const right =
        allowHorizontal &&
        ((allowArrows && activeKeys.has('arrowright')) ||
          (allowWasd && (activeKeys.has('d') || activeKeys.has('keyd'))));
      const upVertical =
        allowVertical &&
        ((allowArrows && activeKeys.has('arrowup')) ||
          (allowWasd && (activeKeys.has('w') || activeKeys.has('z') || activeKeys.has('keyw'))) ||
          activeKeys.has(' ') ||
          activeKeys.has('space'));
      const upJump =
        allowJump &&
        ((allowArrows && activeKeys.has('arrowup')) ||
          (allowWasd && (activeKeys.has('w') || activeKeys.has('z') || activeKeys.has('keyw'))) ||
          activeKeys.has(' ') ||
          activeKeys.has('space'));
      const down =
        allowVertical &&
        ((allowArrows && activeKeys.has('arrowdown')) ||
          (allowWasd && (activeKeys.has('s') || activeKeys.has('keys'))));

      const speed = (keyboard.speed ?? 180) / 60; // conversion px/s -> px/frame
      const accel = keyboard.acceleration;
      const damp = keyboard.damping;

      if (keyboard.mode === 'top_down') {
        let mx = 0;
        let my = 0;
        if (left) mx -= 1;
        if (right) mx += 1;
        if (upVertical) my -= 1;
        if (down) my += 1;

        keyboardMoveInput.set(entity.id, mx !== 0 || my !== 0);
        keyboardHorizIntent.set(entity.id, left && !right ? -1 : right && !left ? 1 : 0);

        if (mx !== 0 && my !== 0) {
          mx *= 0.7071;
          my *= 0.7071;
        }

        const nextVx = allowHorizontal
          ? approachAxisVelocity(body.velocity.x, mx !== 0 ? mx * speed : null, accel, damp, !physics ? 0.8 : undefined)
          : body.velocity.x;
        const nextVy = allowVertical
          ? approachAxisVelocity(body.velocity.y, my !== 0 ? my * speed : null, accel, damp, !physics ? 0.8 : undefined)
          : body.velocity.y;
        Body.setVelocity(body, { x: nextVx, y: nextVy });
      } else {
        // Mode Plateforme
        keyboardMoveInput.set(entity.id, Boolean(left || right));
        keyboardHorizIntent.set(entity.id, left && !right ? -1 : right && !left ? 1 : 0);
        let vx = body.velocity.x;
        if (allowHorizontal) {
          const targetVx = left ? -speed : right ? speed : null;
          vx = approachAxisVelocity(body.velocity.x, targetVx, accel, damp, !physics ? 0.8 : undefined);
        }

        // Détection précise du sol + limitation du nombre de sauts (maxJumps, défaut 1)
        const tracker = jumpTrackers.get(entity.id) || { jumpsUsed: 0, wasJumpPressed: false };
        const isBottomFloor = !body.isSensor && body.bounds.max.y >= canvasBounds.height - 3;
        const isGrounded = (groundedEntityIds.has(entity.id) || isBottomFloor) && body.velocity.y >= -0.6;
        if (isGrounded) {
          tracker.jumpsUsed = 0;
        }

        const maxJumps = Math.max(1, keyboard.maxJumps ?? 1);
        const jumpJustPressed = upJump && !tracker.wasJumpPressed;
        let vy = body.velocity.y;
        if (allowJump && jumpJustPressed && tracker.jumpsUsed < maxJumps) {
          vy = -((keyboard.jumpForce ?? 450) / 60);
          tracker.jumpsUsed += 1;
          groundedEntityIds.delete(entity.id);
          const airSt = controllerAirStates.get(entity.id);
          if (airSt) {
            airSt.groundedGraceTimer = 0;
            airSt.wasGrounded = false;
            airSt.peakAirY = body.position.y;
            airSt.maxFallDropPx = 0;
          }
        }
        tracker.wasJumpPressed = upJump;
        jumpTrackers.set(entity.id, tracker);

        Body.setVelocity(body, { x: vx, y: vy });
      }
    }

    // 4. Patrouille 2.0 (Symétrique, Aller simple, Multi-points, Murs & Vide)
    if (patrol && !controlsLockedByDeath) {
      let patrolState = patrolStates.get(entity.id);
      if (!patrolState) {
        patrolState = {
          originCenter: { x: body.position.x, y: body.position.y },
          direction: 1,
          timer: 0,
          waypointIndex: 0,
          waypointDir: 1,
          wallTurnCooldown: 0,
          ledgeTurnCooldown: 0,
        };
        patrolStates.set(entity.id, patrolState);
      }

      const wallHit = lateralWallHits.get(entity.id);
      let ledgeAhead = false;
      if (patrol.detectLedges && patrol.axis === 'horizontal' && patrol.patrolMode !== 'waypoints') {
        const bBounds = {
          x: body.bounds.min.x,
          y: body.bounds.min.y,
          width: Math.max(1, body.bounds.max.x - body.bounds.min.x),
          height: Math.max(1, body.bounds.max.y - body.bounds.min.y),
          centerX: body.position.x,
          centerY: body.position.y,
          radius: Math.max(body.bounds.max.x - body.bounds.min.x, body.bounds.max.y - body.bounds.min.y) / 2,
          colliderType: 'box' as const,
        };
        const filteredSolids = solidRectsForLedge.filter((r) => r.id !== entity.id);
        const extraProbeFn =
          colliderLayers.length > 0
            ? (px: number, py: number) =>
                colliderLayers.some((layer) => {
                  if (layer.colliderIsTrigger) return false;
                  const probeBounds = {
                    x: px - 2,
                    y: py - 2,
                    width: 4,
                    height: 4,
                    centerX: px,
                    centerY: py,
                    radius: 2,
                    colliderType: 'box' as const,
                  };
                  return checkEntityAgainstColliderLayer(probeBounds, entity.id, layer, canvasBounds, 2).colliding;
                })
            : undefined;
        ledgeAhead = detectLedgeAheadFromSolids({
          bounds: bBounds,
          dirX: patrolState.direction,
          checkDepth: patrol.ledgeCheckDepth ?? 28,
          solidRects: filteredSolids,
          sceneBounds: canvasBounds,
          extraProbeFn,
        });
      }

      const patrolConfigMapped: PatrolBehaviorConfig = {
        ...patrol,
        pauseAtEnds: patrol.pauseAtEnds ?? patrol.pauseDuration ?? 0.3,
      };
      const stepRes = stepPatrolBehavior({
        state: patrolState,
        currentCenter: { x: body.position.x, y: body.position.y },
        config: patrolConfigMapped,
        entities: liveEntities,
        dt,
        wallHit,
        ledgeAhead,
      });

      const targetVx = stepRes.vx / 60;
      const targetVy = stepRes.vy / 60;
      const accel = patrol.acceleration;
      const damp = patrol.damping ?? 0;

      if (stepRes.turned) {
        Body.setVelocity(
          body,
          stepRes.preserveVerticalVelocity
            ? { x: body.velocity.x * damp, y: body.velocity.y }
            : { x: body.velocity.x * damp, y: body.velocity.y * damp }
        );
      } else {
        const nextVx = approachAxisVelocity(body.velocity.x, targetVx, accel, damp, 0);
        const nextVy = stepRes.preserveVerticalVelocity
          ? body.velocity.y
          : approachAxisVelocity(body.velocity.y, targetVy, accel, damp, 0);
        Body.setVelocity(body, { x: nextVx, y: nextVy });
      }
    }

    // 4b. Errance / Balade aléatoire (Wandering)
    if (wandering) {
      let wState = wanderingStates.get(entity.id);
      if (!wState) {
        wState = {
          origin: { x: body.position.x, y: body.position.y },
          targetPoint: null,
          moveTimer: 0,
          pauseTimer: 0,
          currentAngle: Math.random() * Math.PI * 2,
        };
        wanderingStates.set(entity.id, wState);
      }

      const mode = wandering.mode || 'free_2d';
      const radius = Math.max(20, wandering.radius ?? 160);
      const speedPxFrame = (wandering.speed ?? 90) / 60;
      const randomnessFactor = Math.max(0, Math.min(100, wandering.randomness ?? 65)) / 100;
      const interval = Math.max(0.2, wandering.changeInterval ?? 1.5);
      const maxPause = Math.max(0, wandering.pauseDuration ?? 0.8);

      const pickNextWanderTarget = () => {
        const durationJitter = 1 - randomnessFactor * 0.4 + Math.random() * (randomnessFactor * 0.9);
        wState!.moveTimer = Math.max(0.2, interval * durationJitter);

        if (mode === 'horizontal') {
          const offsetX = body.position.x - wState!.origin.x;
          let dir: number;
          if (Math.abs(offsetX) > radius * 0.85) {
            dir = offsetX > 0 ? -1 : 1;
          } else if (Math.random() < 0.25 + randomnessFactor * 0.65) {
            dir = Math.random() < 0.5 ? -1 : 1;
          } else {
            dir = Math.cos(wState!.currentAngle) >= 0 ? 1 : -1;
          }
          const stepDist = radius * (0.3 + Math.random() * 0.7);
          const rawTargetX = body.position.x + dir * stepDist;
          const minBoundX = Math.max(20, wState!.origin.x - radius);
          const maxBoundX = Math.min(Math.max(40, canvasBounds.width - 20), wState!.origin.x + radius);
          const clampedX = Math.max(minBoundX, Math.min(maxBoundX, rawTargetX));
          wState!.targetPoint = { x: clampedX, y: body.position.y };
          wState!.currentAngle = clampedX >= body.position.x ? 0 : Math.PI;
          return;
        }

        // Mode 2D libre dans une zone circulaire autour de origin
        const dxOrigin = body.position.x - wState!.origin.x;
        const dyOrigin = body.position.y - wState!.origin.y;
        const distFromOrigin = Math.hypot(dxOrigin, dyOrigin);

        let nextAngle: number;
        if (distFromOrigin > radius * 0.85) {
          // Renvoyer doucement vers l'intérieur de la zone
          const toCenterAngle = Math.atan2(-dyOrigin, -dxOrigin);
          nextAngle = toCenterAngle + (Math.random() - 0.5) * (Math.PI * 0.6);
        } else {
          // À faible aléatoire : cap fluide; à fort aléatoire : virages vifs jusqu'à 360°
          const maxTurn = 0.35 + randomnessFactor * (Math.PI - 0.35);
          nextAngle = wState!.currentAngle + (Math.random() * 2 - 1) * maxTurn;
        }

        const stepDist = radius * (0.35 + Math.random() * 0.65);
        let tx = body.position.x + Math.cos(nextAngle) * stepDist;
        let ty = body.position.y + Math.sin(nextAngle) * stepDist;

        // Contraindre le point cible à l'intérieur du cercle de zone
        const ox = tx - wState!.origin.x;
        const oy = ty - wState!.origin.y;
        const od = Math.hypot(ox, oy);
        if (od > radius) {
          tx = wState!.origin.x + (ox / od) * radius;
          ty = wState!.origin.y + (oy / od) * radius;
        }

        // Garder dans les marges du canvas visible
        tx = Math.max(24, Math.min(Math.max(48, canvasBounds.width - 24), tx));
        ty = Math.max(24, Math.min(Math.max(48, canvasBounds.height - 24), ty));

        wState!.targetPoint = { x: tx, y: ty };
        wState!.currentAngle = Math.atan2(ty - body.position.y, tx - body.position.x);
      };

      const wAccel = wandering.acceleration;
      const wDamp = wandering.damping ?? 0.78;

      if (wState.pauseTimer > 0) {
        wState.pauseTimer -= dt;
        if (mode === 'horizontal') {
          Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y });
        } else {
          Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y * wDamp });
        }
        if (wState.pauseTimer <= 0) {
          pickNextWanderTarget();
        }
      } else {
        if (!wState.targetPoint || wState.moveTimer <= 0) {
          pickNextWanderTarget();
        }

        wState.moveTimer -= dt;
        const target = wState.targetPoint!;
        const dx = target.x - body.position.x;
        const dy = target.y - body.position.y;

        if (mode === 'horizontal') {
          const dist = Math.abs(dx);
          if (dist > 6 && wState.moveTimer > 0) {
            const nextVx = approachAxisVelocity(body.velocity.x, Math.sign(dx) * speedPxFrame, wAccel, wDamp, wDamp);
            Body.setVelocity(body, { x: nextVx, y: body.velocity.y });
          } else if (maxPause > 0 && Math.random() < 0.7) {
            wState.pauseTimer = maxPause * (0.25 + Math.random() * 0.75);
            Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y });
          } else {
            pickNextWanderTarget();
          }
        } else {
          const dist = Math.hypot(dx, dy);
          if (dist > 6 && wState.moveTimer > 0) {
            const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speedPxFrame, wAccel, wDamp, wDamp);
            const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speedPxFrame, wAccel, wDamp, wDamp);
            Body.setVelocity(body, {
              x: nextVx,
              y: nextVy,
            });
            if (wandering.orientToMovement && !physics?.freezeRotation) {
              const targetAngle = Math.atan2(dy, dx);
              const diff = shortestAngleDiffRad(body.angle, targetAngle);
              Body.setAngle(body, body.angle + diff * 0.18);
            }
          } else if (maxPause > 0 && Math.random() < 0.7) {
            wState.pauseTimer = maxPause * (0.25 + Math.random() * 0.75);
            Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y * wDamp });
          } else {
            pickNextWanderTarget();
          }
        }
      }
    } else if (wanderingStates.has(entity.id)) {
      wanderingStates.delete(entity.id);
    }

    // Helper pour rechercher dynamiquement l'instance la plus proche par Type ou par Tag (Piste D)
    const findNearestTarget = (
      mode: 'nearest_type' | 'nearest_tag',
      targetType?: string,
      targetTag?: string
    ): Entity | undefined => {
      const cleanTag = targetTag ? targetTag.toLowerCase().trim().replace(/^#/, '') : '';
      let nearest: Entity | undefined;
      let minDistSq = Infinity;

      for (const candidate of Object.values(liveEntities)) {
        if (candidate.id === entity.id) continue; // Ne pas se cibler soi-même
        if (mode === 'nearest_type') {
          if (!targetType || candidate.type !== targetType) continue;
        } else if (mode === 'nearest_tag') {
          if (!cleanTag || !candidate.tags?.includes(cleanTag)) continue;
        }

        const candOffset = colliderOffsets.get(candidate.id) || {
          relCenterX: candidate.size.width / 2,
          relCenterY: candidate.size.height / 2,
        };
        const candCenterX = candidate.position.x + candOffset.relCenterX;
        const candCenterY = candidate.position.y + candOffset.relCenterY;
        const dx = candCenterX - body.position.x;
        const dy = candCenterY - body.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = candidate;
        }
      }
      return nearest;
    };

    // 5. Move To
    if (moveTo) {
      let targetX = entity.position.x;
      let targetY = entity.position.y;
      let hasValidTarget = false;

      if (moveTo.targetType === 'position' && moveTo.targetPosition) {
        targetX = moveTo.targetPosition.x;
        targetY = moveTo.targetPosition.y;
        hasValidTarget = true;
      } else if (moveTo.targetType === 'entity' && moveTo.targetEntityId) {
        const targetEntity = liveEntities[moveTo.targetEntityId];
        if (targetEntity) {
          targetX = targetEntity.position.x;
          targetY = targetEntity.position.y;
          hasValidTarget = true;
        }
      } else if (moveTo.targetType === 'nearest_type' || moveTo.targetType === 'nearest_tag') {
        const nearestEntity = findNearestTarget(
          moveTo.targetType,
          moveTo.targetEntityType,
          moveTo.targetTag
        );
        if (nearestEntity) {
          targetX = nearestEntity.position.x;
          targetY = nearestEntity.position.y;
          hasValidTarget = true;
        }
      }

      if (hasValidTarget) {
        const offset = colliderOffsets.get(entity.id) || { relCenterX: entity.size.width / 2, relCenterY: entity.size.height / 2 };
        const currentEntityX = body.position.x - offset.relCenterX;
        const currentEntityY = body.position.y - offset.relCenterY;
        const dx = targetX - currentEntityX;
        const dy = targetY - currentEntityY;
        const dist = Math.hypot(dx, dy);
        const dampStop = moveTo.damping ?? 0;

        if (dist > 4) {
          const speed = (moveTo.speed ?? 120) / 60; // px/s -> px/frame
          const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speed, moveTo.acceleration, dampStop, 0);
          const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speed, moveTo.acceleration, dampStop, 0);
          Body.setVelocity(body, { x: nextVx, y: nextVy });
        } else {
          Body.setVelocity(body, { x: body.velocity.x * dampStop, y: body.velocity.y * dampStop });
        }
      }
    }

    // 6. Follow
    if (follow) {
      let targetX = body.position.x;
      let targetY = body.position.y;
      let hasValidTarget = false;

      if (follow.targetType === 'mouse' && mousePos) {
        targetX = mousePos.x;
        targetY = mousePos.y;
        hasValidTarget = true;
      } else if (follow.targetType === 'entity' && follow.targetEntityId) {
        const targetEntity = liveEntities[follow.targetEntityId];
        if (targetEntity) {
          const targetOffset = colliderOffsets.get(targetEntity.id) || { relCenterX: targetEntity.size.width / 2, relCenterY: targetEntity.size.height / 2 };
          targetX = targetEntity.position.x + targetOffset.relCenterX;
          targetY = targetEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      } else if (follow.targetType === 'nearest_type' || follow.targetType === 'nearest_tag') {
        const nearestEntity = findNearestTarget(
          follow.targetType,
          follow.targetEntityType,
          follow.targetTag
        );
        if (nearestEntity) {
          const targetOffset = colliderOffsets.get(nearestEntity.id) || { relCenterX: nearestEntity.size.width / 2, relCenterY: nearestEntity.size.height / 2 };
          targetX = nearestEntity.position.x + targetOffset.relCenterX;
          targetY = nearestEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      }

      if (hasValidTarget) {
        const dx = targetX - body.position.x;
        const dy = targetY - body.position.y;
        const dist = Math.hypot(dx, dy);
        const minDistance = follow.minDistance ?? 40;

        if (follow.followMode === 'spring') {
          let fSpring = followSpringStates.get(entity.id);
          if (!fSpring) {
            fSpring = {
              x: body.position.x,
              y: body.position.y,
              vx: body.velocity.x * 60,
              vy: body.velocity.y * 60,
            };
            followSpringStates.set(entity.id, fSpring);
          } else {
            fSpring.x = body.position.x;
            fSpring.y = body.position.y;
          }

          let goalX = body.position.x;
          let goalY = body.position.y;
          if (dist > minDistance && dist > 0.001) {
            goalX = targetX - (dx / dist) * minDistance;
            goalY = targetY - (dy / dist) * minDistance;
          }
          debugSpringAnchors.set(entity.id, { x: targetX, y: targetY });

          const res = stepSpring2D({
            state: fSpring,
            targetX: goalX,
            targetY: goalY,
            stiffness: follow.springStiffness ?? 120,
            damping: follow.springDamping ?? 10,
            maxDistance: follow.springMaxDistance ?? 0,
            dt,
          });
          Body.setVelocity(body, { x: res.vx / 60, y: res.vy / 60 });
        } else {
          if (followSpringStates.has(entity.id)) followSpringStates.delete(entity.id);
          const followAccel = follow.acceleration ?? (follow.smoothing !== undefined ? Math.max(0.04, Math.min(1, follow.smoothing)) : undefined);
          const followDamp = follow.damping ?? 0.8;

          if (dist > minDistance) {
            const speed = (follow.speed ?? 150) / 60; // px/s -> px/frame
            const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speed, followAccel, followDamp, 0.8);
            const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speed, followAccel, followDamp, 0.8);
            Body.setVelocity(body, { x: nextVx, y: nextVy });
          } else {
            Body.setVelocity(body, { x: body.velocity.x * followDamp, y: body.velocity.y * followDamp });
          }
        }
      }
    } else if (followSpringStates.has(entity.id)) {
      followSpringStates.delete(entity.id);
    }

    // 6b. Flee (Fuir une menace)
    if (flee && (flee.speed ?? 160) > 0) {
      const fleeThreat = resolveTargetWorldPoint(
        entity.id,
        body.position.x,
        body.position.y,
        flee.targetType || 'mouse',
        flee.targetEntityId,
        flee.targetEntityType,
        flee.targetTag,
        liveEntities,
        mousePos
      );

      const fleeAccel = flee.acceleration ?? 0.35;
      const fleeDamp = flee.damping ?? 0.85;
      const axisMode = flee.axisMode || 'free_2d';

      if (fleeThreat) {
        const dx = body.position.x - fleeThreat.x;
        const dy = body.position.y - fleeThreat.y;
        const dist = Math.hypot(dx, dy);
        const radius = flee.fleeRadius ?? 220;
        const shouldFlee = radius <= 0 || dist < radius;

        if (shouldFlee) {
          const speed = (flee.speed ?? 160) / 60;
          if (axisMode === 'horizontal') {
            const dirX = Math.abs(dx) < 1 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
            const nextVx = approachAxisVelocity(body.velocity.x, dirX * speed, fleeAccel, fleeDamp, 0.85);
            Body.setVelocity(body, { x: nextVx, y: body.velocity.y });
          } else {
            const safeDist = Math.max(0.001, dist);
            const dirX = dist < 1 ? Math.cos(Math.random() * Math.PI * 2) : dx / safeDist;
            const dirY = dist < 1 ? Math.sin(Math.random() * Math.PI * 2) : dy / safeDist;
            const nextVx = approachAxisVelocity(body.velocity.x, dirX * speed, fleeAccel, fleeDamp, 0.85);
            const nextVy = approachAxisVelocity(body.velocity.y, dirY * speed, fleeAccel, fleeDamp, 0.85);
            Body.setVelocity(body, { x: nextVx, y: nextVy });
          }
        } else {
          Body.setVelocity(
            body,
            axisMode === 'horizontal'
              ? { x: body.velocity.x * fleeDamp, y: body.velocity.y }
              : { x: body.velocity.x * fleeDamp, y: body.velocity.y * fleeDamp }
          );
        }
      } else {
        Body.setVelocity(
          body,
          axisMode === 'horizontal'
            ? { x: body.velocity.x * fleeDamp, y: body.velocity.y }
            : { x: body.velocity.x * fleeDamp, y: body.velocity.y * fleeDamp }
        );
      }
    }

    // 7. Look At (mode rotation pour entités racines avec corps)
    if (lookAt && (lookAt.lookMode || 'rotate') === 'rotate') {
      const targetPt = resolveTargetWorldPoint(
        entity.id,
        body.position.x,
        body.position.y,
        lookAt.targetType,
        lookAt.targetEntityId,
        lookAt.targetEntityType,
        lookAt.targetTag,
        liveEntities,
        mousePos
      );

      if (targetPt) {
        debugLookAtTargets.set(entity.id, targetPt);
        const res = computeLookAtRotationAndFlip({
          entityId: entity.id,
          originX: body.position.x,
          originY: body.position.y,
          targetPt,
          lookAt,
          currentAngleDeg: (body.angle * 180) / Math.PI,
          baseRestRotDeg: 0,
          currentFlipX: entity.flipX ?? false,
          dt,
        });
        Body.setAngle(body, res.nextAngleRad);
        if (res.flipUpdated) {
          flipUpdates.set(entity.id, res.nextFlipX);
        }
      }
    }

    // 7b. Flip horizontal automatique selon le sens du mouvement
    const otherFlipSource = [patrol, wandering, moveTo, follow, flee, constVel].find(
      (b) => b && (b as { flipOnMove?: boolean }).flipOnMove === true
    ) as { type?: string; flipOnMove?: boolean; flipInvert?: boolean } | undefined;

    const isOtherFlipPaused =
      (otherFlipSource?.type === 'patrol' && (patrolStates.get(entity.id)?.timer ?? 0) > 0) ||
      (otherFlipSource?.type === 'wandering' && (wanderingStates.get(entity.id)?.pauseTimer ?? 0) > 0);

    const nextMoveFlip = computeMovementFlipX({
      keyboard: keyboard?.flipOnMove ? keyboard : undefined,
      keyboardHorizIntent: keyboardHorizIntent.get(entity.id) ?? 0,
      otherFlipBehavior: otherFlipSource
        ? {
            flipOnMove: otherFlipSource.flipOnMove,
            flipInvert: otherFlipSource.flipInvert,
            isActivelyPaused: isOtherFlipPaused,
          }
        : undefined,
      velocityX: body.velocity.x,
    });

    if (nextMoveFlip !== null) {
      flipUpdates.set(entity.id, nextMoveFlip);
    }

    // 8. Gestion des bords de Monde ou de Cadre Visible (Bounce, Wrap, Clamp)
    if (boundary) {
      const mode = boundary.mode || 'bounce';
      const space = boundary.boundarySpace || 'world';
      const box =
        space === 'viewport' && viewportRect
          ? viewportRect
          : { x: 0, y: 0, width: canvasBounds.width, height: canvasBounds.height };
      const minBoxX = box.x;
      const minBoxY = box.y;
      const maxBoxX = box.x + box.width;
      const maxBoxY = box.y + box.height;

      const halfW = Math.max(4, (body.bounds.max.x - body.bounds.min.x) / 2);
      const halfH = Math.max(4, (body.bounds.max.y - body.bounds.min.y) / 2);
      if (mode === 'bounce' && (body.isSensor || space === 'viewport')) {
        const bounceRest = boundary.bounciness ?? 0.8;
        let vx = body.velocity.x;
        let vy = body.velocity.y;
        let nx = body.position.x;
        let ny = body.position.y;
        if (nx < minBoxX + halfW) {
          nx = minBoxX + halfW;
          vx = Math.abs(vx) * bounceRest;
        } else if (nx > maxBoxX - halfW) {
          nx = maxBoxX - halfW;
          vx = -Math.abs(vx) * bounceRest;
        }
        if (ny < minBoxY + halfH) {
          ny = minBoxY + halfH;
          vy = Math.abs(vy) * bounceRest;
        } else if (ny > maxBoxY - halfH) {
          ny = maxBoxY - halfH;
          vy = -Math.abs(vy) * bounceRest;
        }
        if (nx !== body.position.x || ny !== body.position.y) {
          Body.setPosition(body, { x: nx, y: ny });
          Body.setVelocity(body, { x: vx, y: vy });
        }
      } else if (mode === 'wrap') {
        let newX = body.position.x;
        let newY = body.position.y;

        if (body.position.x < minBoxX - halfW) newX = maxBoxX + halfW;
        else if (body.position.x > maxBoxX + halfW) newX = minBoxX - halfW;

        if (body.position.y < minBoxY - halfH) newY = maxBoxY + halfH;
        else if (body.position.y > maxBoxY + halfH) newY = minBoxY - halfH;

        if (newX !== body.position.x || newY !== body.position.y) {
          Body.setPosition(body, { x: newX, y: newY });
        }
      } else if (mode === 'clamp') {
        const minX = minBoxX + halfW;
        const maxX = Math.max(minX, maxBoxX - halfW);
        const minY = minBoxY + halfH;
        const maxY = Math.max(minY, maxBoxY - halfH);

        const clampedX = Math.max(minX, Math.min(maxX, body.position.x));
        const clampedY = Math.max(minY, Math.min(maxY, body.position.y));

        if (clampedX !== body.position.x || clampedY !== body.position.y) {
          Body.setPosition(body, { x: clampedX, y: clampedY });
        }
      }
    }

    // Plafond de vitesse terminale pour éviter toute dérive physique incontrôlée
    const maxVelocity = 30; // 30 px/frame = 1800 px/s
    const currentSpeed = Math.hypot(body.velocity.x, body.velocity.y);
    if (currentSpeed > maxVelocity) {
      Body.setVelocity(body, {
        x: (body.velocity.x / currentSpeed) * maxVelocity,
        y: (body.velocity.y / currentSpeed) * maxVelocity,
      });
    }
  }

  // Mémoriser les pieds et vitesses avant Engine.update pour les plateformes traversables & collisions directionnelles
  for (const [bId, b] of bodyMap.entries()) {
    prevEntityBottoms.set(bId, b.bounds.max.y);
    lastEntityVelocities.set(bId, { vx: b.velocity.x * 60, vy: b.velocity.y * 60 });
  }
  lateralWallHits.clear();

  // Tique d'itération physique du moteur Matter.js avec sous-pas <= 16.666 ms (évite le warning delta > 16.667 ms)
  const totalMs = dt * 1000;
  const maxStepMs = 16.666;
  const subSteps = Math.max(1, Math.ceil(totalMs / maxStepMs));
  const stepMs = totalMs / subSteps;
  const subDt = stepMs / 1000;
  groundedEntityIds.clear();

  for (let s = 0; s < subSteps; s++) {
    // Synchronisation des contraintes de saisie physique précise à la souris (MouseGrab)
    for (const [grabEntId, grab] of mouseGrabConstraints.entries()) {
      const gBody = bodyMap.get(grabEntId);
      if (!gBody || gBody.isStatic) continue;
      if (grab.constraint.bodyB !== gBody) {
        grab.constraint.bodyB = gBody;
      }
      Matter.Sleeping.set(gBody, false);
      grab.constraint.pointA.x = grab.targetWorld.x;
      grab.constraint.pointA.y = grab.targetWorld.y;
      const rotB = rotateVector(
        grab.localPointFromBodyCenter.x,
        grab.localPointFromBodyCenter.y,
        gBody.angle
      );
      grab.constraint.pointB.x = rotB.x;
      grab.constraint.pointB.y = rotB.y;
      (grab.constraint as unknown as { angleB: number }).angleB = gBody.angle;
      debugGrabPins.set(grabEntId, {
        target: { x: grab.targetWorld.x, y: grab.targetWorld.y },
        grabWorld: { x: gBody.position.x + rotB.x, y: gBody.position.y + rotB.y },
      });

      if (grab.rotationMode === 'damped_limited') {
        const curDeg = (gBody.angle * 180) / Math.PI;
        const wrappedRel = ((curDeg - grab.restAngleDeg + 540) % 360) - 180;
        const normalizedCur = grab.restAngleDeg + wrappedRel;
        const curAngVelDegPerSec = (Body.getAngularVelocity(gBody) * 60 * 180) / Math.PI;
        const grabOffsetCfg = {
          x: 0,
          y: 0,
          jointEnableAngleLimits: true,
          jointMinAngle: -grab.maxAngle,
          jointMaxAngle: grab.maxAngle,
          jointBrakeAngle: grab.brakeAngle,
          jointBrakeStrength: 85,
          jointAngularStiffness: grab.angularStiffness,
          jointAngularDamping: grab.angularDamping,
        };
        const angStep = stepJointAngularForces({
          currentAngleDeg: normalizedCur,
          angularVelDegPerSec: curAngVelDegPerSec,
          restWorldDeg: grab.restAngleDeg,
          offset: grabOffsetCfg,
          dt: subDt,
        });
        Body.setAngularVelocity(gBody, ((angStep.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
      }
    }

    // Pré-pas angulaire des Joints Physiques (ressort vers repos, damping, 2e angle de freinage)
    for (const entry of activeJointEntries) {
      if (brokenJointIdSet.has(entry.entity.id)) continue;
      if (!entry.isJoint || entry.freezeRotation) continue;
      const pState = entry.parent.states[entry.parent.currentStateId];
      const pRotDeg =
        entry.parentBody && !entry.parentBody.isStatic && !activeDragPositions[entry.parent.id]
          ? (entry.parentBody.angle * 180) / Math.PI
          : (pState?.rotation || 0) + (entry.parent.runtimeTilt || 0) + (entry.parent.runtimeJiggleAngle || 0);
      const restWorldDeg = computeJointRestWorldDeg({
        offset: entry.offset,
        parentRotDeg: pRotDeg,
        parentFlipX: Boolean(entry.parent.flipX),
      });
      const curAngleDeg = (entry.body.angle * 180) / Math.PI;
      const curAngVelDegPerSec = (Body.getAngularVelocity(entry.body) * 60 * 180) / Math.PI;
      const angStep = stepJointAngularForces({
        currentAngleDeg: curAngleDeg,
        angularVelDegPerSec: curAngVelDegPerSec,
        restWorldDeg,
        offset: entry.offset,
        dt: subDt,
      });
      Body.setAngularVelocity(entry.body, ((angStep.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
    }

    Engine.update(engine, stepMs);

    // Post-pas angulaire pour la saisie physique limitée & amortie (MouseGrab)
    for (const [grabEntId, grab] of mouseGrabConstraints.entries()) {
      if (grab.rotationMode !== 'damped_limited') continue;
      const gBody = bodyMap.get(grabEntId);
      if (!gBody || gBody.isStatic) continue;

      const curDeg = (gBody.angle * 180) / Math.PI;
      const wrappedRel = ((curDeg - grab.restAngleDeg + 540) % 360) - 180;
      const normalizedCur = grab.restAngleDeg + wrappedRel;
      if (!grab.engagedLimit && Math.abs(wrappedRel) <= grab.maxAngle + 0.5) {
        grab.engagedLimit = true;
      }
      if (grab.engagedLimit) {
        const curAngVelDegPerSec = (Body.getAngularVelocity(gBody) * 60 * 180) / Math.PI;
        const clampRes = clampJointBodyAngle({
          currentAngleDeg: normalizedCur,
          angularVelDegPerSec: curAngVelDegPerSec,
          restWorldDeg: grab.restAngleDeg,
          offset: {
            x: 0,
            y: 0,
            jointEnableAngleLimits: true,
            jointMinAngle: -grab.maxAngle,
            jointMaxAngle: grab.maxAngle,
          },
        });
        if (clampRes.clamped) {
          const oldRotB = rotateVector(
            grab.localPointFromBodyCenter.x,
            grab.localPointFromBodyCenter.y,
            gBody.angle
          );
          const pinWorld = {
            x: gBody.position.x + oldRotB.x,
            y: gBody.position.y + oldRotB.y,
          };
          const targetRad = (clampRes.nextAngleDeg * Math.PI) / 180;
          const newRotB = rotateVector(
            grab.localPointFromBodyCenter.x,
            grab.localPointFromBodyCenter.y,
            targetRad
          );
          Body.setPosition(gBody, {
            x: pinWorld.x - newRotB.x,
            y: pinWorld.y - newRotB.y,
          });
          Body.setAngle(gBody, targetRad);
          Body.setAngularVelocity(gBody, ((clampRes.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
          grab.constraint.pointB.x = newRotB.x;
          grab.constraint.pointB.y = newRotB.y;
          (grab.constraint as unknown as { angleB: number }).angleB = targetRad;
        }
      }
    }

    // Post-pas angulaire : butées dures [minAngle, maxAngle] + évaluation rupture (Break Joint)
    for (const entry of activeJointEntries) {
      if (brokenJointIdSet.has(entry.entity.id)) continue;

      let pinWorldA = entry.anchorPt;
      if (entry.useBodyA && entry.parentBody && entry.localPointA) {
        const rotA = rotateVector(entry.localPointA.x, entry.localPointA.y, entry.parentBody.angle);
        pinWorldA = {
          x: entry.parentBody.position.x + rotA.x,
          y: entry.parentBody.position.y + rotA.y,
        };
      }

      if (entry.isJoint && !entry.freezeRotation && entry.offset?.jointEnableAngleLimits) {
        const pState = entry.parent.states[entry.parent.currentStateId];
        const pRotDeg =
          entry.parentBody && !entry.parentBody.isStatic && !activeDragPositions[entry.parent.id]
            ? (entry.parentBody.angle * 180) / Math.PI
            : (pState?.rotation || 0) + (entry.parent.runtimeTilt || 0) + (entry.parent.runtimeJiggleAngle || 0);
        const restWorldDeg = computeJointRestWorldDeg({
          offset: entry.offset,
          parentRotDeg: pRotDeg,
          parentFlipX: Boolean(entry.parent.flipX),
        });
        const curAngleDeg = (entry.body.angle * 180) / Math.PI;
        const curAngVelDegPerSec = (Body.getAngularVelocity(entry.body) * 60 * 180) / Math.PI;
        const clampRes = clampJointBodyAngle({
          currentAngleDeg: curAngleDeg,
          angularVelDegPerSec: curAngVelDegPerSec,
          restWorldDeg,
          offset: entry.offset,
        });
        if (clampRes.clamped) {
          const targetRad = (clampRes.nextAngleDeg * Math.PI) / 180;
          const rotB = rotateVector(entry.localPointB.x, entry.localPointB.y, targetRad);
          Body.setPosition(entry.body, {
            x: pinWorldA.x - rotB.x,
            y: pinWorldA.y - rotB.y,
          });
          Body.setAngle(entry.body, targetRad);
          Body.setAngularVelocity(entry.body, ((clampRes.nextAngularVelDegPerSec * Math.PI) / 180) / 60);
          const jc = parentJointConstraints.get(entry.entity.id);
          if (jc) {
            jc.pointB.x = rotB.x;
            jc.pointB.y = rotB.y;
            (jc as unknown as { angleB: number }).angleB = targetRad;
          }
        }
      }

      // Évaluation de la rupture du joint (traction / secousses)
      if (entry.offset?.jointBreakable) {
        const rotBNow = rotateVector(entry.localPointB.x, entry.localPointB.y, entry.body.angle);
        const pinWorldB = {
          x: entry.body.position.x + rotBNow.x,
          y: entry.body.position.y + rotBNow.y,
        };
        const curAngVelDegPerSec = (Body.getAngularVelocity(entry.body) * 60 * 180) / Math.PI;
        const curLinSpeedPxPerSec = Math.hypot(entry.body.velocity.x * 60, entry.body.velocity.y * 60);

        let cursorStretchPx = 0;
        const activeGrab = mouseGrabConstraints.get(entry.entity.id);
        if (activeGrab) {
          const gRotB = rotateVector(
            activeGrab.localPointFromBodyCenter.x,
            activeGrab.localPointFromBodyCenter.y,
            entry.body.angle
          );
          const grabWorldB = {
            x: entry.body.position.x + gRotB.x,
            y: entry.body.position.y + gRotB.y,
          };
          cursorStretchPx = Math.hypot(
            activeGrab.targetWorld.x - grabWorldB.x,
            activeGrab.targetWorld.y - grabWorldB.y
          );
        }

        const prevBreakState =
          jointBreakStates.get(entry.entity.id) || createJointBreakRuntimeState();
        const breakEval = evaluateJointBreakState({
          state: prevBreakState,
          offset: entry.offset,
          pinAWorld: pinWorldA,
          pinBWorld: pinWorldB,
          angVelDegPerSec: curAngVelDegPerSec,
          linearSpeedPxPerSec: curLinSpeedPxPerSec,
          cursorStretchPx,
          dt: subDt,
        });
        jointBreakStates.set(entry.entity.id, breakEval.nextState);
        debugJointStressRatios.set(entry.entity.id, breakEval.stressRatio);

        if (breakEval.broken && breakEval.reason) {
          brokenJointIdSet.add(entry.entity.id);
          const jc = parentJointConstraints.get(entry.entity.id);
          if (jc) {
            World.remove(engine.world, jc);
            parentJointConstraints.delete(entry.entity.id);
          }
          jointBreakStates.delete(entry.entity.id);
          debugJointStressRatios.delete(entry.entity.id);

          if (entry.offset.jointBreakFallWithGravity !== false) {
            brokenJointDynamicIds.add(entry.entity.id);
            entry.body.isStatic = false;
            const cState = entry.entity.states[entry.entity.currentStateId];
            const cPhysics = getEffectiveBehaviors(entry.entity, cState).find(
              (b) => b.type === 'physics'
            ) as PhysicsBehaviorConfig | undefined;
            entry.body.isSensor = cPhysics ? cPhysics.isTrigger === true : false;
          }

          brokenJointEvents.push({
            childId: entry.entity.id,
            parentId: entry.parent.id,
            breakPoint: {
              x: Math.round(pinWorldB.x * 10) / 10,
              y: Math.round(pinWorldB.y * 10) / 10,
            },
            reason: breakEval.reason,
          });
        }
      } else {
        jointBreakStates.delete(entry.entity.id);
      }
    }
  }

  // Re-verrouiller les corps tenus en drag manuel après Engine.update pour empêcher toute dérive gravitaire avant lâcher
  for (const [dragId, dragPos] of Object.entries(activeDragPositions)) {
    if (mouseGrabConstraints.has(dragId)) continue;
    const ent = liveEntities[dragId];
    if (!ent || (ent.parentId && liveEntities[ent.parentId] && !brokenJointIdSet.has(ent.id))) continue;
    const body = bodyMap.get(dragId);
    if (!body) continue;
    const dragOffset = colliderOffsets.get(dragId) || {
      relCenterX: ent.size.width / 2,
      relCenterY: ent.size.height / 2,
    };
    const meta = bodyPivotMeta.get(dragId);
    const effPivot = meta?.effPivot ?? resolveEffectivePivot(ent, ent.states[ent.currentStateId]);
    const lockedCenter = getBodyWorldCenterFromPivot(
      dragPos,
      ent.size,
      dragOffset.relCenterX,
      dragOffset.relCenterY,
      effPivot,
      (body.angle * 180) / Math.PI
    );
    Body.setPosition(body, lockedCenter);
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, 0);
  }

  // Résolution des transformations dans l'ordre topologique (parents avant enfants)
  const orderedEntities = sortEntitiesTopologically(liveEntities);
  const resolvedTransforms = new Map<string, { position: Position; rotation: number; flipX: boolean }>();

  for (const entity of orderedEntities) {
    const body = bodyMap.get(entity.id);
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const emitter = effectiveBehaviors.find((b) => b.type === 'particle_emitter') as ParticleEmitterBehaviorConfig | undefined;
    const jiggle = effectiveBehaviors.find((b) => b.type === 'jiggle') as JiggleBehaviorConfig | undefined;
    const jiggleRawPivotOverride =
      jiggle && jiggle.enabled !== false && jiggle.useCustomPivot && jiggle.pivotOverride
        ? jiggle.pivotOverride
        : undefined;
    const activePuppetGrabRawPivot = getActivePuppetGrabRawPivot(entity.id, effectiveBehaviors);
    const rawPivotOverride = activePuppetGrabRawPivot ?? jiggleRawPivotOverride;
    const isRotFrozen = physics?.freezeRotation === true;

    let newX = entity.position.x;
    let newY = entity.position.y;
    let newRot = currentState?.rotation || 0;
    let nextFlipX = flipUpdates.get(entity.id) ?? (entity.flipX ?? false);
    let nextRuntimeTilt = entity.runtimeTilt ?? 0;

    let pendingPosUpdate: Position | undefined;
    let pendingRotUpdate: number | undefined;
    let pendingFlipUpdate: boolean | undefined;

    // Cas 1 : Entité enfant attachée à un parent (rigide, ressort élastique ou joint physique avec collisions)
    // Si son joint vient tout juste de rompre sur ce tick, passer immédiatement en entité indépendante
    if (entity.parentId && liveEntities[entity.parentId] && !brokenJointIdSet.has(entity.id)) {
      const parent = liveEntities[entity.parentId];
      const parentState = parent.states[parent.currentStateId];
      const parentTransform = resolvedTransforms.get(parent.id) || {
        position: parent.position,
        rotation: (parentState?.rotation || 0) + (parent.runtimeTilt || 0) + (parent.runtimeJiggleAngle || 0),
        flipX: parent.flipX ?? false,
      };
      const parentBehaviors = getEffectiveBehaviors(parent, parentState);
      const parentJiggle = parentBehaviors.find((b) => b.type === 'jiggle') as
        | JiggleBehaviorConfig
        | undefined;
      const parentGrabRawPivot = getActivePuppetGrabRawPivot(parent.id, parentBehaviors);
      const parentRawPivotOverride =
        parentGrabRawPivot ??
        (parentJiggle && parentJiggle.enabled !== false && parentJiggle.useCustomPivot && parentJiggle.pivotOverride
          ? parentJiggle.pivotOverride
          : undefined);
      const parentEffPivot = resolveEffectivePivot(
        parent,
        parentState,
        parentRawPivotOverride,
        parentTransform.flipX
      );

      const offset = entity.parentOffset || { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true };
      const inheritRot = offset.inheritRotation !== false;
      const inheritFlip = offset.inheritFlip !== false;

      const anchorWorld = getParentAnchorWorldPosition({
        parentPosition: parentTransform.position,
        parentSize: parent.size,
        parentPivot: parentEffPivot,
        parentRotDeg: parentTransform.rotation,
        parentFlipX: parentTransform.flipX,
        offsetX: offset.x,
        offsetY: offset.y,
        inheritRotation: inheritRot,
        inheritFlip,
      });
      const targetAnchorX = anchorWorld.x;
      const targetAnchorY = anchorWorld.y;

      const rotOffset = (offset.rotationOffset || 0) * (inheritFlip && parentTransform.flipX ? -1 : 1);
      const baseRot = (inheritRot ? parentTransform.rotation : 0) + rotOffset;
      nextFlipX = inheritFlip ? parentTransform.flipX : (entity.flipX ?? false);
      const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);

      const attachMode = offset.attachmentMode || 'rigid';
      const isCollisionAttached =
        attachMode === 'physics_joint' || (attachMode === 'spring' && offset.collideWithWorld === true);

      if (isCollisionAttached && body && !body.isStatic) {
        springLinkStates.delete(entity.id);
        debugSpringAnchors.set(entity.id, { x: targetAnchorX, y: targetAnchorY });

        const cOffset = colliderOffsets.get(entity.id) || {
          relCenterX: entity.size.width / 2,
          relCenterY: entity.size.height / 2,
        };
        const currentRotDeg = isRotFrozen ? 0 : Math.round(((body.angle * 180) / Math.PI) * 10) / 10;
        newRot = currentRotDeg;

        // Contrainte de laisse max éventuelle autour de l'ancre parent
        const maxDist = offset.springMaxDistance ?? 0;
        const pivotOffsetLocal = {
          x: effPivot.x * entity.size.width - cOffset.relCenterX,
          y: effPivot.y * entity.size.height - cOffset.relCenterY,
        };
        const pivotRotOffset = rotateVector(pivotOffsetLocal.x, pivotOffsetLocal.y, (newRot * Math.PI) / 180);
        const curPivotWorldX = body.position.x + pivotRotOffset.x;
        const curPivotWorldY = body.position.y + pivotRotOffset.y;

        if (maxDist > 0) {
          const dpx = curPivotWorldX - targetAnchorX;
          const dpy = curPivotWorldY - targetAnchorY;
          const dist = Math.hypot(dpx, dpy);
          if (dist > maxDist && dist > 0.001) {
            const clampedPivotX = targetAnchorX + (dpx / dist) * maxDist;
            const clampedPivotY = targetAnchorY + (dpy / dist) * maxDist;
            Body.setPosition(body, {
              x: clampedPivotX - pivotRotOffset.x,
              y: clampedPivotY - pivotRotOffset.y,
            });
          }
        }

        const childLookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
        if (childLookAt && childLookAt.enabled !== false && (childLookAt.lookMode || 'rotate') === 'rotate') {
          const targetPt = resolveTargetWorldPoint(
            entity.id,
            curPivotWorldX,
            curPivotWorldY,
            childLookAt.targetType,
            childLookAt.targetEntityId,
            childLookAt.targetEntityType,
            childLookAt.targetTag,
            liveEntities,
            mousePos
          );
          if (targetPt) {
            debugLookAtTargets.set(entity.id, targetPt);
            const res = computeLookAtRotationAndFlip({
              entityId: entity.id,
              originX: curPivotWorldX,
              originY: curPivotWorldY,
              targetPt,
              lookAt: childLookAt,
              currentAngleDeg: newRot,
              baseRestRotDeg: baseRot,
              currentFlipX: nextFlipX,
              dt,
            });
            newRot = res.nextRotDeg;
            Body.setAngle(body, (newRot * Math.PI) / 180);
            if (res.flipUpdated) nextFlipX = res.nextFlipX;
          }
        }

        const topLeft = getEntityTopLeftFromBodyWorldCenter(
          body.position,
          entity.size,
          cOffset.relCenterX,
          cOffset.relCenterY,
          effPivot,
          newRot
        );
        newX = Math.round(topLeft.x * 10) / 10;
        newY = Math.round(topLeft.y * 10) / 10;
      } else {
        let childAnchorX = targetAnchorX;
        let childAnchorY = targetAnchorY;

        if (attachMode === 'spring') {
          let spState = springLinkStates.get(entity.id);
          if (!spState) {
            const curPivot = getPivotWorldPosition(entity.position, entity.size, effPivot);
            spState = { x: curPivot.x, y: curPivot.y, vx: 0, vy: 0 };
            springLinkStates.set(entity.id, spState);
          }
          const activeChildDrag = activeDragPositions[entity.id];
          if (activeChildDrag) {
            let dragPivot = getPivotWorldPosition(activeChildDrag, entity.size, effPivot);
            const maxDist = offset.springMaxDistance ?? 0;
            if (maxDist > 0) {
              const ddx = dragPivot.x - targetAnchorX;
              const ddy = dragPivot.y - targetAnchorY;
              const dist = Math.hypot(ddx, ddy);
              if (dist > maxDist && dist > 0.001) {
                dragPivot = {
                  x: targetAnchorX + (ddx / dist) * maxDist,
                  y: targetAnchorY + (ddy / dist) * maxDist,
                };
              }
            }
            spState.x = dragPivot.x;
            spState.y = dragPivot.y;
            spState.vx = 0;
            spState.vy = 0;
            childAnchorX = dragPivot.x;
            childAnchorY = dragPivot.y;
          } else {
            const spRes = stepSpring2D({
              state: spState,
              targetX: targetAnchorX,
              targetY: targetAnchorY,
              stiffness: offset.springStiffness ?? 160,
              damping: offset.springDamping ?? 12,
              gravity: offset.springGravity ?? 0,
              maxDistance: offset.springMaxDistance ?? 0,
              dt,
            });
            childAnchorX = spRes.x;
            childAnchorY = spRes.y;
          }
          debugSpringAnchors.set(entity.id, { x: targetAnchorX, y: targetAnchorY });

          if (offset.jointBreakable) {
            const linSpeed = Math.hypot(spState.vx, spState.vy);
            const prevBreakState = jointBreakStates.get(entity.id) || createJointBreakRuntimeState();
            const breakEval = evaluateJointBreakState({
              state: prevBreakState,
              offset,
              pinAWorld: { x: targetAnchorX, y: targetAnchorY },
              pinBWorld: { x: childAnchorX, y: childAnchorY },
              angVelDegPerSec: 0,
              linearSpeedPxPerSec: linSpeed,
              dt,
            });
            jointBreakStates.set(entity.id, breakEval.nextState);
            debugJointStressRatios.set(entity.id, breakEval.stressRatio);

            if (breakEval.broken && breakEval.reason) {
              brokenJointIdSet.add(entity.id);
              springLinkStates.delete(entity.id);
              jointBreakStates.delete(entity.id);
              debugJointStressRatios.delete(entity.id);
              if (offset.jointBreakFallWithGravity !== false) {
                brokenJointDynamicIds.add(entity.id);
                if (body) {
                  body.isStatic = false;
                  body.isSensor = physics ? physics.isTrigger === true : false;
                }
              }
              brokenJointEvents.push({
                childId: entity.id,
                parentId: parent.id,
                breakPoint: {
                  x: Math.round(childAnchorX * 10) / 10,
                  y: Math.round(childAnchorY * 10) / 10,
                },
                reason: breakEval.reason,
              });
            }
          }
        } else {
          if (springLinkStates.has(entity.id)) springLinkStates.delete(entity.id);
          if (jointBreakStates.has(entity.id)) jointBreakStates.delete(entity.id);
        }

        newRot = Math.round(baseRot * 10) / 10;

        // LookAt sur entité enfant attachée (ex: Tête avec cône maxAngle ou Pupille en Orbite)
        const childLookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
        if (childLookAt && childLookAt.enabled !== false) {
          const targetPt = resolveTargetWorldPoint(
            entity.id,
            childAnchorX,
            childAnchorY,
            childLookAt.targetType,
            childLookAt.targetEntityId,
            childLookAt.targetEntityType,
            childLookAt.targetTag,
            liveEntities,
            mousePos
          );

          if (targetPt) {
            debugLookAtTargets.set(entity.id, targetPt);
          }

          if ((childLookAt.lookMode || 'rotate') === 'pupil_orbit') {
            let orbitRt = lookAtOrbitStates.get(entity.id);
            if (!orbitRt) {
              orbitRt = { ox: 0, oy: 0 };
              lookAtOrbitStates.set(entity.id, orbitRt);
            }
            const rx = Math.max(1, childLookAt.orbitRadius ?? 8);
            const ry = Math.max(1, childLookAt.orbitRadiusY ?? rx);
            let tx = 0;
            let ty = 0;
            if (targetPt) {
              const dx = targetPt.x - childAnchorX;
              const dy = targetPt.y - childAnchorY;
              const dist = Math.hypot(dx, dy);
              if (dist > 0.5) {
                const mag = Math.min(1, dist / Math.max(18, Math.max(rx, ry) * 2.5));
                tx = (dx / dist) * rx * mag;
                ty = (dy / dist) * ry * mag;
              }
            }
            const smooth = childLookAt.smoothSpeed ?? 0;
            const alpha = smooth > 0 ? Math.min(1, dt * Math.max(3, smooth / 22)) : 1;
            orbitRt.ox += (tx - orbitRt.ox) * alpha;
            orbitRt.oy += (ty - orbitRt.oy) * alpha;
            childAnchorX += orbitRt.ox;
            childAnchorY += orbitRt.oy;
          } else if (targetPt) {
            const res = computeLookAtRotationAndFlip({
              entityId: entity.id,
              originX: childAnchorX,
              originY: childAnchorY,
              targetPt,
              lookAt: childLookAt,
              currentAngleDeg: currentState?.rotation || 0,
              baseRestRotDeg: baseRot,
              currentFlipX: nextFlipX,
              dt,
            });
            newRot = res.nextRotDeg;
            if (res.flipUpdated) {
              nextFlipX = res.nextFlipX;
            }
          }
        }

        const effPivotAfterFlip = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);
        newX = Math.round((childAnchorX - effPivotAfterFlip.x * entity.size.width) * 10) / 10;
        newY = Math.round((childAnchorY - effPivotAfterFlip.y * entity.size.height) * 10) / 10;

        // Synchroniser le corps Matter.js du capteur/collider de l'enfant avec sa position monde réelle
        if (body) {
          const cOffset = colliderOffsets.get(entity.id) || {
            relCenterX: entity.size.width / 2,
            relCenterY: entity.size.height / 2,
          };
          const bodyWorldPos = getBodyWorldCenterFromPivot(
            { x: newX, y: newY },
            entity.size,
            cOffset.relCenterX,
            cOffset.relCenterY,
            effPivotAfterFlip,
            newRot
          );
          Body.setPosition(body, bodyWorldPos);
          Body.setAngle(body, (newRot * Math.PI) / 180);
        }
      }

      const posChanged = Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05;
      const rotChanged = Math.abs(newRot - (currentState?.rotation || 0)) > 0.1;
      const flipChanged = (entity.flipX ?? false) !== nextFlipX;

      if (posChanged) pendingPosUpdate = { x: newX, y: newY };
      if (rotChanged) pendingRotUpdate = newRot;
      if (flipChanged) pendingFlipUpdate = nextFlipX;
    } else {
      // Cas 2 : Entité indépendante (ou parent racine, avec ou sans corps physique)
      if (springLinkStates.has(entity.id)) springLinkStates.delete(entity.id);
      const sliderBeh = effectiveBehaviors.find((b) => b.type === 'slider') as SliderBehaviorConfig | undefined;
      const rootLookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
      const hasRotationBehavior = effectiveBehaviors.some(
        (b) =>
          (b.type === 'look_at' && ((b as LookAtBehaviorConfig).lookMode || 'rotate') === 'rotate') ||
          (b.type === 'constant_velocity' && !!(b as ConstantVelocityBehaviorConfig).angularVelocity) ||
          (b.type === 'wandering' && !!(b as WanderingBehaviorConfig).orientToMovement)
      );

      const rotateDragBeh = effectiveBehaviors.find((b) => b.type === 'rotate_drag') as
        | RotateDragBehaviorConfig
        | undefined;

      if (sliderBeh && sliderBeh.enabled !== false) {
        const curCx = entity.position.x + entity.size.width / 2;
        const curCy = entity.position.y + entity.size.height / 2;
        let slState = sliderStates.get(entity.id);
        if (!slState) {
          slState = {
            originCx: curCx,
            originCy: curCy,
            localX: 0,
            localY: 0,
            vx: 0,
            vy: 0,
            isGrabbed: false,
            grabOffsetWorld: { x: 0, y: 0 },
            targetWorld: { x: curCx, y: curCy },
          };
          sliderStates.set(entity.id, slState);
        }
        const slRes = stepSliderPhysics({ state: slState, config: sliderBeh, dt });
        newX = Math.round((slRes.worldCenter.x - entity.size.width / 2) * 10) / 10;
        newY = Math.round((slRes.worldCenter.y - entity.size.height / 2) * 10) / 10;

        if (Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05) {
          pendingPosUpdate = { x: newX, y: newY };
        }

        if (body) {
          const offset = colliderOffsets.get(entity.id) || {
            relCenterX: entity.size.width / 2,
            relCenterY: entity.size.height / 2,
          };
          const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);
          const worldCenter = getBodyWorldCenterFromPivot(
            { x: newX, y: newY },
            entity.size,
            offset.relCenterX,
            offset.relCenterY,
            effPivot,
            newRot
          );
          Body.setPosition(body, worldCenter);
        }

        debugSliderTracks.set(entity.id, {
          geom: slRes.geom,
          config: sliderBeh,
          valueX: slRes.outputs.valueX,
          valueY: slRes.outputs.valueY,
          stepIndex: slRes.outputs.stepIndex,
        });

        for (const [varKey, nextVal] of Object.entries(slRes.outputs.updates)) {
          const prevVal = lastSliderOutputValues.get(varKey);
          if (prevVal === undefined || Math.abs(nextVal - prevVal) > 0.005) {
            lastSliderOutputValues.set(varKey, nextVal);
            variableUpdates[varKey] = nextVal;
          }
        }
      } else if (rotateDragBeh && rotateDragBeh.enabled !== false) {
        if (sliderStates.has(entity.id)) sliderStates.delete(entity.id);
        const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);
        const pivotWorld = getPivotWorldPosition(entity.position, entity.size, effPivot);
        let rdState = rotateDragStates.get(entity.id);
        if (!rdState) {
          rdState = {
            baseAngleDeg: currentState?.rotation || 0,
            angleDeg: 0,
            angularVel: 0,
            isGrabbed: false,
            pivotWorld,
            grabStartPointer: pivotWorld,
            lastPointer: pivotWorld,
            grabStartAngleDeg: 0,
            lastPointerAngleDeg: 0,
            targetAngleDeg: 0,
          };
          rotateDragStates.set(entity.id, rdState);
        } else {
          rdState.pivotWorld = pivotWorld;
        }

        const rdRes = stepRotateDragPhysics({ state: rdState, config: rotateDragBeh, dt });
        newRot = Math.round((rdState.baseAngleDeg + rdRes.angleDeg) * 10) / 10;

        if (Math.abs(newRot - (currentState?.rotation || 0)) > 0.05) {
          pendingRotUpdate = newRot;
        }

        if (body) {
          const offset = colliderOffsets.get(entity.id) || {
            relCenterX: entity.size.width / 2,
            relCenterY: entity.size.height / 2,
          };
          const worldCenter = getBodyWorldCenterFromPivot(
            entity.position,
            entity.size,
            offset.relCenterX,
            offset.relCenterY,
            effPivot,
            newRot
          );
          Body.setPosition(body, worldCenter);
          Body.setAngle(body, (newRot * Math.PI) / 180);
        }

        debugRotateDragTracks.set(entity.id, {
          pivotWorld,
          angleDeg: rdRes.angleDeg,
          baseAngleDeg: rdState.baseAngleDeg,
          config: rotateDragBeh,
          radius: Math.max(36, Math.min(entity.size.width, entity.size.height) * 0.65),
          stepIndex: rdRes.outputs.stepIndex,
        });

        for (const [varKey, nextVal] of Object.entries(rdRes.outputs.updates)) {
          const prevVal = lastRotateDragOutputValues.get(varKey);
          if (prevVal === undefined || Math.abs(nextVal - prevVal) > 0.005) {
            lastRotateDragOutputValues.set(varKey, nextVal);
            variableUpdates[varKey] = nextVal;
          }
        }
      } else {
        if (sliderStates.has(entity.id)) {
          sliderStates.delete(entity.id);
        }
        if (rotateDragStates.has(entity.id)) {
          rotateDragStates.delete(entity.id);
        }

        const isActivelyDragged = Boolean(activeDragPositions[entity.id]);
        if (isActivelyDragged) {
          const dp = activeDragPositions[entity.id];
          newX = dp.x;
          newY = dp.y;
      } else if (rootLookAt && rootLookAt.enabled !== false && rootLookAt.lookMode === 'pupil_orbit') {
        let orbitRt = lookAtOrbitStates.get(entity.id);
        if (!orbitRt) {
          orbitRt = {
            ox: 0,
            oy: 0,
            anchorX: entity.position.x + entity.size.width / 2,
            anchorY: entity.position.y + entity.size.height / 2,
          };
          lookAtOrbitStates.set(entity.id, orbitRt);
        }
        const ax = orbitRt.anchorX ?? entity.position.x + entity.size.width / 2;
        const ay = orbitRt.anchorY ?? entity.position.y + entity.size.height / 2;
        const targetPt = resolveTargetWorldPoint(
          entity.id,
          ax,
          ay,
          rootLookAt.targetType,
          rootLookAt.targetEntityId,
          rootLookAt.targetEntityType,
          rootLookAt.targetTag,
          liveEntities,
          mousePos
        );
        if (targetPt) {
          debugLookAtTargets.set(entity.id, targetPt);
        }
        const rx = Math.max(1, rootLookAt.orbitRadius ?? 8);
        const ry = Math.max(1, rootLookAt.orbitRadiusY ?? rx);
        let tx = 0;
        let ty = 0;
        if (targetPt) {
          const dx = targetPt.x - ax;
          const dy = targetPt.y - ay;
          const dist = Math.hypot(dx, dy);
          if (dist > 0.5) {
            const mag = Math.min(1, dist / Math.max(18, Math.max(rx, ry) * 2.5));
            tx = (dx / dist) * rx * mag;
            ty = (dy / dist) * ry * mag;
          }
        }
        const smooth = rootLookAt.smoothSpeed ?? 0;
        const alpha = smooth > 0 ? Math.min(1, dt * Math.max(3, smooth / 22)) : 1;
        orbitRt.ox += (tx - orbitRt.ox) * alpha;
        orbitRt.oy += (ty - orbitRt.oy) * alpha;
        newX = Math.round((ax + orbitRt.ox - entity.size.width / 2) * 10) / 10;
        newY = Math.round((ay + orbitRt.oy - entity.size.height / 2) * 10) / 10;
        if (Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05) {
          pendingPosUpdate = { x: newX, y: newY };
        }
      } else if (!body) {
        // Entité racine sans collider (colliderMode === 'disabled') : supporter LookAt rotate
        if (rootLookAt && rootLookAt.enabled !== false && (rootLookAt.lookMode || 'rotate') === 'rotate') {
          const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);
          const originPt = getPivotWorldPosition(entity.position, entity.size, effPivot);
          const targetPt = resolveTargetWorldPoint(
            entity.id,
            originPt.x,
            originPt.y,
            rootLookAt.targetType,
            rootLookAt.targetEntityId,
            rootLookAt.targetEntityType,
            rootLookAt.targetTag,
            liveEntities,
            mousePos
          );
          if (targetPt) {
            debugLookAtTargets.set(entity.id, targetPt);
            const res = computeLookAtRotationAndFlip({
              entityId: entity.id,
              originX: originPt.x,
              originY: originPt.y,
              targetPt,
              lookAt: rootLookAt,
              currentAngleDeg: currentState?.rotation || 0,
              baseRestRotDeg: 0,
              currentFlipX: nextFlipX,
              dt,
            });
            newRot = res.nextRotDeg;
            if (res.flipUpdated) nextFlipX = res.nextFlipX;
            if (Math.abs(newRot - (currentState?.rotation || 0)) > 0.1) {
              pendingRotUpdate = newRot;
            }
            if (res.flipUpdated && (entity.flipX ?? false) !== nextFlipX) {
              pendingFlipUpdate = nextFlipX;
            }
          }
        }
      } else if (!body.isStatic || hasRotationBehavior) {
        const offset = colliderOffsets.get(entity.id) || {
          relCenterX: entity.size.width / 2,
          relCenterY: entity.size.height / 2,
        };
        const effPivot = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);

        newRot = isRotFrozen ? 0 : Math.round(((body.angle * 180) / Math.PI) * 10) / 10;
        const topLeft = getEntityTopLeftFromBodyWorldCenter(
          body.position,
          entity.size,
          offset.relCenterX,
          offset.relCenterY,
          effPivot,
          newRot
        );
        newX = Math.round(topLeft.x * 10) / 10;
        newY = Math.round(topLeft.y * 10) / 10;

        const posChanged = Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05;
        const rotChanged = !isRotFrozen && Math.abs(newRot - (currentState?.rotation || 0)) > 0.1;
        const flipChanged = flipUpdates.has(entity.id) && (entity.flipX ?? false) !== nextFlipX;

        if (posChanged) pendingPosUpdate = { x: newX, y: newY };
        if (rotChanged) pendingRotUpdate = newRot;
        else if (isRotFrozen && Math.abs(currentState?.rotation || 0) > 0.1) pendingRotUpdate = 0;
        if (flipChanged) pendingFlipUpdate = nextFlipX;
        }
      }
    }

    // Cas 6a : Calcul du pendule & cycle Marionnette Interactive (avant resolvedTransforms pour que les enfants suivent)
    const puppet = effectiveBehaviors.find((b) => b.type === 'interactive_puppet') as
      | InteractivePuppetBehaviorConfig
      | undefined;
    let puppetDesiredStateId: string | undefined;
    let puppetGrabRuntimePivot: EntityPivot | null | undefined;

    if (puppet && puppet.enabled !== false) {
      const rt = getOrCreatePuppetRuntime(entity.id, newX, newY);
      const activeDragKeys = Object.keys(activeDragPositions);
      const isActivelyDragged = Boolean(activeDragPositions[entity.id]) || rt.dragPhaseActive;
      const otherBeingDragged = activeDragKeys.some((id) => id !== entity.id);

      const worldBounds = getEntityWorldColliderBounds(
        { ...entity, position: { x: newX, y: newY } },
        currentState
      );

      // Distance du curseur au bord du collider (0 = curseur à l'intérieur)
      let distToCollider = Infinity;
      if (mousePos) {
        if (worldBounds.colliderType === 'circle') {
          distToCollider = Math.max(
            0,
            Math.hypot(mousePos.x - worldBounds.centerX, mousePos.y - worldBounds.centerY) - worldBounds.radius
          );
        } else {
          const dx = Math.max(worldBounds.x - mousePos.x, 0, mousePos.x - (worldBounds.x + worldBounds.width));
          const dy = Math.max(worldBounds.y - mousePos.y, 0, mousePos.y - (worldBounds.y + worldBounds.height));
          distToCollider = Math.hypot(dx, dy);
        }
      }

      const rawHovered = !otherBeingDragged && !isActivelyDragged && (rt.domHovered || (mousePos !== null && distToCollider === 0));
      const hoverReturnDelay = Math.max(0, puppet.hoverReturnDelay ?? 0);

      // Cycle Survol (avec délai de maintien avant retour au repos si configuré)
      if (!isActivelyDragged) {
        if (rawHovered && !rt.wasHovered) {
          if (rt.hoverReturnTimer <= 0) {
            rt.hoverEnterTimer = Math.max(0.04, puppet.hoverEnterDuration ?? 0.18);
            rt.hoverTime = 0;
          }
          rt.hoverExitTimer = 0;
          rt.hoverReturnTimer = hoverReturnDelay;
        } else if (rawHovered) {
          rt.hoverTime += dt;
          rt.hoverEnterTimer = Math.max(0, rt.hoverEnterTimer - dt);
          rt.hoverReturnTimer = hoverReturnDelay;
        } else if (!rawHovered && rt.wasHovered) {
          rt.hoverReturnTimer = hoverReturnDelay;
          if (rt.hoverReturnTimer <= 0) {
            rt.hoverExitTimer = Math.max(0.04, puppet.hoverExitDuration ?? 0.2);
            rt.hoverTime = 0;
            rt.hoverEnterTimer = 0;
          }
        } else if (rt.hoverReturnTimer > 0) {
          rt.hoverTime += dt;
          rt.hoverEnterTimer = Math.max(0, rt.hoverEnterTimer - dt);
          rt.hoverReturnTimer = Math.max(0, rt.hoverReturnTimer - dt);
          if (rt.hoverReturnTimer === 0) {
            rt.hoverExitTimer = Math.max(0.04, puppet.hoverExitDuration ?? 0.2);
            rt.hoverTime = 0;
            rt.hoverEnterTimer = 0;
          }
        } else {
          rt.hoverExitTimer = Math.max(0, rt.hoverExitTimer - dt);
        }
      }
      rt.wasHovered = rawHovered;
      const isHovered = rawHovered || rt.hoverReturnTimer > 0;

      // Cycle Drag, Balancement & Secousse
      if (isActivelyDragged && !rt.wasDragging) {
        rt.dragStartTimer = Math.max(0.04, puppet.dragStartDuration ?? 0.18);
        rt.dragTime = 0;
        rt.dragReleaseTimer = 0;
        rt.lastDragX = newX;
        rt.lastDragY = newY;
        rt.smoothDragVx = 0;
        rt.smoothDragVy = 0;
        rt.swingHoldTimer = 0;
        rt.swingLastStateId = undefined;
        rt.dragOverHoldTimer = 0;
        rt.lastDragOverStateId = undefined;
        rt.shakeCount = 0;
        rt.shakeWindowTimer = 0;
        rt.shakeActiveTimer = 0;
        rt.lastVxSign = 0;
      } else if (isActivelyDragged) {
        rt.dragTime += dt;
        rt.dragStartTimer = Math.max(0, rt.dragStartTimer - dt);
        const instVx = Math.max(-3000, Math.min(3000, (newX - rt.lastDragX) / dt));
        const instVy = Math.max(-3000, Math.min(3000, (newY - rt.lastDragY) / dt));
        rt.lastDragX = newX;
        rt.lastDragY = newY;
        rt.smoothDragVx += (instVx - rt.smoothDragVx) * Math.min(1, dt * 14);
        rt.smoothDragVy += (instVy - rt.smoothDragVy) * Math.min(1, dt * 14);

        if (rt.shakeWindowTimer > 0) {
          rt.shakeWindowTimer = Math.max(0, rt.shakeWindowTimer - dt);
          if (rt.shakeWindowTimer === 0) rt.shakeCount = 0;
        }
        if (rt.shakeActiveTimer > 0) {
          rt.shakeActiveTimer = Math.max(0, rt.shakeActiveTimer - dt);
        }
        const vxSign: -1 | 0 | 1 = Math.abs(instVx) > 260 ? (instVx > 0 ? 1 : -1) : 0;
        if (vxSign !== 0 && vxSign !== rt.lastVxSign) {
          if (rt.lastVxSign !== 0) {
            rt.shakeCount += 1;
          }
          rt.lastVxSign = vxSign;
          rt.shakeWindowTimer = 0.45;
          if (rt.shakeCount >= Math.max(2, puppet.shakeThreshold ?? 3)) {
            rt.shakeActiveTimer = Math.max(0.05, puppet.shakeHoldDuration ?? 0.45);
            rt.shakeCount = 0;
          }
        }
      } else if (!isActivelyDragged && rt.wasDragging) {
        if (rt.hadDragMovement) {
          rt.dragReleaseTimer = Math.max(0.04, puppet.dragReleaseDuration ?? 0.2);
        }
        rt.dragTime = 0;
        rt.dragStartTimer = 0;
        rt.smoothDragVx = 0;
        rt.smoothDragVy = 0;
        rt.swingHoldTimer = 0;
        rt.swingLastStateId = undefined;
        rt.dragOverHoldTimer = 0;
        rt.lastDragOverStateId = undefined;
        rt.shakeCount = 0;
        rt.shakeActiveTimer = 0;
        rt.lastVxSign = 0;
        rt.hadDragMovement = false;
      } else {
        rt.dragReleaseTimer = Math.max(0, rt.dragReleaseTimer - dt);
        rt.smoothDragVx *= Math.max(0, 1 - dt * 10);
        rt.smoothDragVy *= Math.max(0, 1 - dt * 10);
      }
      rt.wasDragging = isActivelyDragged;

      // Pendule physique (ressort amorti sur vitesse / bras de levier autour du point saisi)
      const isPhysicsGrabActive = mouseGrabConstraints.has(entity.id);
      const isPendulumHeld =
        isActivelyDragged ||
        Boolean(puppet.swingAroundGrabPoint && !isPhysicsGrabActive && rt.grabHoldActive);
      const swingMode = puppet.swingMode || 'both';
      const usePendulum = (swingMode === 'pendulum' || swingMode === 'both') && !isPhysicsGrabActive;
      if (usePendulum) {
        const intensity = Math.max(0.1, puppet.pendulumIntensity ?? 1.0);
        const maxAngle = Math.max(5, Math.min(75, puppet.pendulumMaxAngle ?? 32));
        const smoothing = Math.max(0.05, Math.min(0.5, puppet.pendulumSmoothing ?? 0.18));

        let driveSpeed = rt.smoothDragVx;
        let gravityLeanDeg = 0;
        if (puppet.swingAroundGrabPoint && rt.grabPivot) {
          const effGrabX = nextFlipX ? 1 - rt.grabPivot.x : rt.grabPivot.x;
          const effGrabY = rt.grabPivot.y;
          const rx = 0.5 - effGrabX;
          const ry = 0.5 - effGrabY;
          if (Math.hypot(rx, ry) >= 0.05) {
            gravityLeanDeg = Math.max(-maxAngle * 0.65, Math.min(maxAngle * 0.65, rx * 2 * maxAngle * 0.65));
            driveSpeed = (ry * rt.smoothDragVx - rx * rt.smoothDragVy) / 0.35;
          }
        }

        const targetAngle = isPendulumHeld
          ? Math.max(-maxAngle, Math.min(maxAngle, gravityLeanDeg + (driveSpeed / 850) * maxAngle * intensity))
          : 0;
        const springK = 140 + (1 - smoothing) * 160;
        const dampingC = 11 + smoothing * 14;
        const accel = springK * (targetAngle - rt.pendulumAngle) - dampingC * rt.pendulumVel;
        rt.pendulumVel += accel * dt;
        rt.pendulumAngle += rt.pendulumVel * dt;
        if (!isPendulumHeld && Math.abs(rt.pendulumAngle) < 0.15 && Math.abs(rt.pendulumVel) < 0.8) {
          rt.pendulumAngle = 0;
          rt.pendulumVel = 0;
        }
      } else {
        rt.pendulumAngle = 0;
        rt.pendulumVel = 0;
      }
      nextRuntimeTilt = Math.round(rt.pendulumAngle * 10) / 10;

      // Maintien propre du pivot temporaire de saisie pendant le drag + retour au repos du pendule
      if (
        puppet.swingAroundGrabPoint &&
        !isPhysicsGrabActive &&
        rt.grabPivot &&
        (isPendulumHeld || Math.abs(rt.pendulumAngle) >= 0.15)
      ) {
        if (
          entity.runtimePivot?.x !== rt.grabPivot.x ||
          entity.runtimePivot?.y !== rt.grabPivot.y
        ) {
          puppetGrabRuntimePivot = { x: rt.grabPivot.x, y: rt.grabPivot.y };
        }
      } else if (rt.grabPivot) {
        const oldGrabEff = {
          x: nextFlipX ? 1 - rt.grabPivot.x : rt.grabPivot.x,
          y: rt.grabPivot.y,
        };
        const restEff = resolveEffectivePivot(entity, currentState, jiggleRawPivotOverride, nextFlipX);
        const curNonTiltRot = newRot + (entity.runtimeJiggleAngle || 0);
        if (Math.abs(curNonTiltRot) > 0.1) {
          const reanchored = reanchorPositionForPivotChange({
            position: { x: newX, y: newY },
            size: entity.size,
            oldEffPivot: oldGrabEff,
            newEffPivot: restEff,
            rotationDeg: curNonTiltRot,
          });
          newX = Math.round(reanchored.x * 10) / 10;
          newY = Math.round(reanchored.y * 10) / 10;
          pendingPosUpdate = { x: newX, y: newY };
        }
        rt.grabPivot = null;
        rt.grabHoldActive = false;
        if (entity.runtimePivot !== undefined) {
          puppetGrabRuntimePivot = null;
        }
      }

      // Gravité / Chute / Atterrissage (si physique dynamique présente)
      const hasDynamicBody = Boolean(body && !body.isStatic);
      const isBottomFloor = Boolean(body && !body.isSensor && body.bounds.max.y >= canvasBounds.height - 3);
      const rawGrounded = hasDynamicBody && body
        ? (groundedEntityIds.has(entity.id) || isBottomFloor) && body.velocity.y >= -0.75
        : true;
      const minFallHeight = Math.max(0, puppet.minFallHeight ?? 20);

      if (isActivelyDragged || !hasDynamicBody || !body) {
        rt.wasGrounded = true;
        rt.groundedGraceTimer = 0.075;
        rt.airborneTime = 0;
        rt.peakAirY = body?.position.y ?? newY;
        rt.maxFallDropPx = 0;
        rt.landTimer = 0;
      } else {
        if (rawGrounded) {
          rt.groundedGraceTimer = 0.075;
        } else if (rt.groundedGraceTimer > 0 && body.velocity.y >= -0.85) {
          rt.groundedGraceTimer = Math.max(0, rt.groundedGraceTimer - dt);
        } else {
          rt.groundedGraceTimer = 0;
        }
        const isGrounded = rawGrounded || rt.groundedGraceTimer > 0;
        if (!isGrounded) {
          if (rt.wasGrounded) {
            rt.peakAirY = body.position.y;
            rt.maxFallDropPx = 0;
          } else {
            rt.peakAirY = Math.min(rt.peakAirY, body.position.y);
          }
          const currentDrop = Math.max(0, body.position.y - rt.peakAirY);
          rt.maxFallDropPx = Math.max(rt.maxFallDropPx, currentDrop);
          rt.airborneTime += dt;
          rt.landTimer = 0;
          rt.wasGrounded = false;
        } else {
          const hasFallenEnough =
            minFallHeight === 0 ? rt.airborneTime >= 0.04 : rt.maxFallDropPx >= minFallHeight;
          if (!rt.wasGrounded && hasFallenEnough) {
            rt.landTimer = Math.max(0.05, Math.min(1.0, puppet.landDuration ?? 0.18));
          } else if (rt.landTimer > 0) {
            rt.landTimer = Math.max(0, rt.landTimer - dt);
          }
          rt.airborneTime = 0;
          rt.peakAirY = body.position.y;
          rt.maxFallDropPx = 0;
          rt.wasGrounded = true;
        }
      }

      // Détection Drag Over sur cibles (Entités / Types / #Tags / Calques collider)
      let dragOverStateId: string | undefined;
      if (isActivelyDragged && puppet.dragOverTargets && puppet.dragOverTargets.length > 0) {
        for (const rule of puppet.dragOverTargets) {
          if (!rule.stateId || !entity.states[rule.stateId]) continue;
          let matched = false;
          const cleanTag = (rule.targetTag || '').toLowerCase().trim().replace(/^#/, '');

          for (const other of entityList) {
            if (other.id === entity.id) continue;
            const matchesTarget =
              (rule.targetMode === 'entity' && other.id === rule.targetEntityId) ||
              (rule.targetMode === 'type' && other.type === rule.targetEntityType) ||
              (rule.targetMode === 'tag' &&
                cleanTag &&
                (other.tags || []).some((t) => t.toLowerCase().trim().replace(/^#/, '') === cleanTag));
            if (!matchesTarget) continue;

            const ob = getEntityWorldColliderBounds(other, other.states[other.currentStateId]);
            if (worldBounds.colliderType === 'circle' && ob.colliderType === 'circle') {
              matched =
                Math.hypot(worldBounds.centerX - ob.centerX, worldBounds.centerY - ob.centerY) <=
                worldBounds.radius + ob.radius + 2;
            } else {
              matched =
                worldBounds.x <= ob.x + ob.width + 2 &&
                worldBounds.x + worldBounds.width + 2 >= ob.x &&
                worldBounds.y <= ob.y + ob.height + 2 &&
                worldBounds.y + worldBounds.height + 2 >= ob.y;
            }
            if (matched) break;
          }

          if (!matched && rule.targetMode === 'tag' && cleanTag && colliderLayers.length > 0) {
            for (const layer of colliderLayers) {
              const lTags = (layer.colliderTags || []).map((t) => t.toLowerCase().trim().replace(/^#/, ''));
              if (!lTags.includes(cleanTag)) continue;
              if (checkEntityAgainstColliderLayer(worldBounds, entity.id, layer, canvasBounds, 2).colliding) {
                matched = true;
                break;
              }
            }
          }

          if (matched) {
            dragOverStateId = rule.stateId;
            break;
          }
        }
      }

      // Résolution d'état avec garde-fou non-écrasant
      const sb = puppet.stateBindings || {};
      const boundIds = new Set(
        [
          sb.idleStateId,
          sb.approachFarStateId,
          sb.approachNearStateId,
          sb.hoverEnterStateId,
          sb.hoverStateId,
          sb.hoverDwellStateId,
          sb.hoverExitStateId,
          sb.dragStartStateId,
          sb.dragStateId,
          sb.dragDwellStateId,
          sb.swingStateId,
          sb.swingLeftStateId,
          sb.swingRightStateId,
          sb.shakeStateId,
          sb.dragReleaseStateId,
          sb.fallStateId,
          sb.landStateId,
          ...(puppet.dragOverTargets || []).map((r) => r.stateId),
        ].filter((sid): sid is string => Boolean(sid && entity.states[sid]))
      );

      if (boundIds.size > 0 && boundIds.has(entity.currentStateId)) {
        const hasState = (sid?: string): sid is string => Boolean(sid && entity.states[sid]);
        const isGroundedNow = !hasDynamicBody || !body || rawGrounded || rt.groundedGraceTimer > 0;
        const fallDropNow = body ? Math.max(0, body.position.y - rt.peakAirY) : 0;
        const canShowFall = minFallHeight === 0 ? rt.airborneTime >= 0.03 : fallDropNow >= minFallHeight;
        const useSwingStates = swingMode === 'states' || swingMode === 'both';
        const swingSpeedThresh = Math.max(40, puppet.swingSpeedThreshold ?? 320);

        if (dragOverStateId) {
          rt.lastDragOverStateId = dragOverStateId;
          rt.dragOverHoldTimer = Math.max(0, puppet.dragOverReturnDelay ?? 0);
        } else if (rt.dragOverHoldTimer > 0 && hasState(rt.lastDragOverStateId)) {
          rt.dragOverHoldTimer = Math.max(0, rt.dragOverHoldTimer - dt);
          dragOverStateId = rt.lastDragOverStateId;
          if (rt.dragOverHoldTimer === 0) {
            rt.lastDragOverStateId = undefined;
          }
        } else {
          rt.lastDragOverStateId = undefined;
        }

        let activeSwingStateId: string | undefined;
        if (useSwingStates && Math.abs(rt.smoothDragVx) >= swingSpeedThresh) {
          if (rt.smoothDragVx < 0 && hasState(sb.swingLeftStateId)) {
            activeSwingStateId = sb.swingLeftStateId;
          } else if (rt.smoothDragVx > 0 && hasState(sb.swingRightStateId)) {
            activeSwingStateId = sb.swingRightStateId;
          } else if (hasState(sb.swingStateId)) {
            activeSwingStateId = sb.swingStateId;
          }
          if (activeSwingStateId) {
            rt.swingLastStateId = activeSwingStateId;
            rt.swingHoldTimer = Math.max(0, puppet.swingReturnDelay ?? 0);
          }
        } else if (useSwingStates && rt.swingHoldTimer > 0 && hasState(rt.swingLastStateId)) {
          rt.swingHoldTimer = Math.max(0, rt.swingHoldTimer - dt);
          activeSwingStateId = rt.swingLastStateId;
          if (rt.swingHoldTimer === 0) {
            rt.swingLastStateId = undefined;
          }
        } else {
          rt.swingLastStateId = undefined;
        }

        if (isActivelyDragged) {
          if (dragOverStateId) {
            puppetDesiredStateId = dragOverStateId;
          } else if (rt.dragStartTimer > 0 && hasState(sb.dragStartStateId)) {
            puppetDesiredStateId = sb.dragStartStateId;
          } else if (rt.shakeActiveTimer > 0 && hasState(sb.shakeStateId)) {
            puppetDesiredStateId = sb.shakeStateId;
          } else if (activeSwingStateId) {
            puppetDesiredStateId = activeSwingStateId;
          } else if (rt.dragTime >= (puppet.dragDwellDelay ?? 2.0) && hasState(sb.dragDwellStateId)) {
            puppetDesiredStateId = sb.dragDwellStateId;
          } else if (hasState(sb.dragStateId)) {
            puppetDesiredStateId = sb.dragStateId;
          }
        } else if (
          !isGroundedNow &&
          hasDynamicBody &&
          body &&
          body.velocity.y > 0.75 &&
          canShowFall &&
          hasState(sb.fallStateId)
        ) {
          puppetDesiredStateId = sb.fallStateId;
        } else if (rt.dragReleaseTimer > 0 && hasState(sb.dragReleaseStateId)) {
          puppetDesiredStateId = sb.dragReleaseStateId;
        } else if (isGroundedNow && rt.landTimer > 0 && hasState(sb.landStateId)) {
          puppetDesiredStateId = sb.landStateId;
        } else if (isHovered) {
          if (rt.hoverEnterTimer > 0 && hasState(sb.hoverEnterStateId)) {
            puppetDesiredStateId = sb.hoverEnterStateId;
          } else if (rt.hoverTime >= (puppet.hoverDwellDelay ?? 1.5) && hasState(sb.hoverDwellStateId)) {
            puppetDesiredStateId = sb.hoverDwellStateId;
          } else if (hasState(sb.hoverStateId)) {
            puppetDesiredStateId = sb.hoverStateId;
          }
        } else if (rt.hoverExitTimer > 0 && hasState(sb.hoverExitStateId)) {
          puppetDesiredStateId = sb.hoverExitStateId;
        } else if (mousePos !== null && !otherBeingDragged) {
          const nearDist = Math.max(0, puppet.approachNearDistance ?? 120);
          const farDist = Math.max(nearDist, puppet.approachFarDistance ?? 280);
          if (distToCollider <= nearDist && hasState(sb.approachNearStateId)) {
            puppetDesiredStateId = sb.approachNearStateId;
          } else if (distToCollider <= farDist && hasState(sb.approachFarStateId)) {
            puppetDesiredStateId = sb.approachFarStateId;
          } else if (hasState(sb.idleStateId)) {
            puppetDesiredStateId = sb.idleStateId;
          }
        } else if (hasState(sb.idleStateId)) {
          puppetDesiredStateId = sb.idleStateId;
        }
      }
    } else if ((entity.runtimeTilt ?? 0) !== 0) {
      nextRuntimeTilt = 0;
    }

    // Cas 6a-bis : Composant Jiggle (Oscillation rotative autour du pivot + Squash & Stretch MudBun)
    let nextRuntimeJiggleAngle = 0;
    let nextRuntimeScaleX = 1;
    let nextRuntimeScaleY = 1;
    let pendingRuntimePivot: EntityPivot | null | undefined;

    const puppetOwnsGrabPivot = Boolean(
      puppetGrabRuntimePivot !== undefined ||
        getActivePuppetGrabRawPivot(entity.id, effectiveBehaviors)
    );

    if (jiggle && jiggle.enabled !== false) {
      const effPivotForJiggle = resolveEffectivePivot(entity, currentState, rawPivotOverride, nextFlipX);
      const pivotWorld = getPivotWorldPosition({ x: newX, y: newY }, entity.size, effPivotForJiggle);

      const prevKin = prevAnchorKinematics.get(entity.id);
      let accelX = 0;
      let accelY = 0;
      let vx = 0;
      let vy = 0;
      if (prevKin) {
        vx = (pivotWorld.x - prevKin.x) / Math.max(0.001, dt);
        vy = (pivotWorld.y - prevKin.y) / Math.max(0.001, dt);
        accelX = (vx - prevKin.vx) / Math.max(0.001, dt);
        accelY = (vy - prevKin.vy) / Math.max(0.001, dt);
      }
      prevAnchorKinematics.set(entity.id, { x: pivotWorld.x, y: pivotWorld.y, vx, vy });

      let impactImpulseDeg = 0;
      const reactToCollisions = jiggle.collideWithWorld !== false;
      if (reactToCollisions) {
        const prefix = `${entity.id}:::`;
        let isCollidingNow = false;
        let contactPt: Position | undefined;
        for (const pairKey of activePhysicsCollisionPairs) {
          if (pairKey.startsWith(prefix)) {
            isCollidingNow = true;
            contactPt = activePhysicsCollisionContacts.get(pairKey);
            break;
          }
        }
        const wasColliding = prevCollidingJiggle.has(entity.id);
        if (isCollidingNow && !wasColliding) {
          const relX = contactPt ? contactPt.x - pivotWorld.x : 0;
          const dirSign = Math.abs(relX) > 2 ? Math.sign(-relX) : vx !== 0 ? Math.sign(-vx) : 1;
          const speedMag = Math.hypot(vx, vy);
          impactImpulseDeg = dirSign * Math.min(460, Math.max(110, speedMag * 0.55));
        }
        if (isCollidingNow) prevCollidingJiggle.add(entity.id);
        else prevCollidingJiggle.delete(entity.id);
      } else {
        prevCollidingJiggle.delete(entity.id);
      }

      const restOffset = jiggle.restAngleOffset ?? 0;
      let jState = jiggleStates.get(entity.id);
      if (!jState) {
        const initialOffset = jiggle.initialAngleOffset ?? restOffset;
        jState = {
          angleDeg: initialOffset - restOffset,
          angularVelDeg: 0,
          squashX: 1,
          squashY: 1,
        };
        jiggleStates.set(entity.id, jState);
      }
      const jRes = stepJiggleRotational({
        state: jState,
        accelX,
        accelY,
        baseWorldRotDeg: newRot + nextRuntimeTilt + restOffset,
        effPivot: effPivotForJiggle,
        stiffness: jiggle.stiffness ?? 180,
        damping: jiggle.damping ?? 9,
        inertia: jiggle.inertia ?? 1.0,
        maxAngle: jiggle.maxAngle ?? 35,
        gravityPull: jiggle.gravityPull ?? 40,
        squashIntensity: jiggle.squashIntensity ?? 0.25,
        impactImpulseDeg,
        dt,
      });

      nextRuntimeJiggleAngle = Math.round((jRes.angleDeg + restOffset) * 10) / 10;
      nextRuntimeScaleX = jRes.squashX;
      nextRuntimeScaleY = jRes.squashY;

      if (!puppetOwnsGrabPivot) {
        if (jiggleRawPivotOverride) {
          if (
            entity.runtimePivot?.x !== jiggleRawPivotOverride.x ||
            entity.runtimePivot?.y !== jiggleRawPivotOverride.y
          ) {
            pendingRuntimePivot = jiggleRawPivotOverride;
          }
        } else if (entity.runtimePivot !== undefined) {
          pendingRuntimePivot = null;
        }
      }

      debugJiggleInfos.set(entity.id, {
        world: pivotWorld,
        angleDeg: nextRuntimeJiggleAngle,
        restDeg: newRot + nextRuntimeTilt + restOffset,
        squashX: nextRuntimeScaleX,
        squashY: nextRuntimeScaleY,
      });
    } else {
      if (jiggleStates.has(entity.id)) jiggleStates.delete(entity.id);
      if (prevAnchorKinematics.has(entity.id)) prevAnchorKinematics.delete(entity.id);
      prevCollidingJiggle.delete(entity.id);
      if (puppetGrabRuntimePivot !== undefined) {
        pendingRuntimePivot = puppetGrabRuntimePivot;
      } else if (entity.runtimePivot !== undefined && !puppetOwnsGrabPivot) {
        pendingRuntimePivot = null;
      }
    }

    if (puppetGrabRuntimePivot !== undefined) {
      pendingRuntimePivot = puppetGrabRuntimePivot;
    }

    const tiltChanged =
      Math.abs(nextRuntimeTilt - (entity.runtimeTilt ?? 0)) > 0.1 ||
      (nextRuntimeTilt === 0 && (entity.runtimeTilt ?? 0) !== 0);
    const jiggleAngleChanged =
      Math.abs(nextRuntimeJiggleAngle - (entity.runtimeJiggleAngle ?? 0)) > 0.08 ||
      (nextRuntimeJiggleAngle === 0 && (entity.runtimeJiggleAngle ?? 0) !== 0);
    const scaleXChanged = Math.abs(nextRuntimeScaleX - (entity.runtimeScaleX ?? 1)) > 0.002;
    const scaleYChanged = Math.abs(nextRuntimeScaleY - (entity.runtimeScaleY ?? 1)) > 0.002;

    if (
      pendingPosUpdate ||
      pendingRotUpdate !== undefined ||
      pendingFlipUpdate !== undefined ||
      tiltChanged ||
      jiggleAngleChanged ||
      scaleXChanged ||
      scaleYChanged ||
      pendingRuntimePivot !== undefined
    ) {
      updatedTransforms[entity.id] = {
        ...(pendingPosUpdate ? { position: pendingPosUpdate } : {}),
        ...(pendingRotUpdate !== undefined ? { rotation: pendingRotUpdate } : {}),
        ...(pendingFlipUpdate !== undefined ? { flipX: pendingFlipUpdate } : {}),
        ...(tiltChanged ? { runtimeTilt: nextRuntimeTilt } : {}),
        ...(jiggleAngleChanged ? { runtimeJiggleAngle: nextRuntimeJiggleAngle } : {}),
        ...(scaleXChanged ? { runtimeScaleX: nextRuntimeScaleX } : {}),
        ...(scaleYChanged ? { runtimeScaleY: nextRuntimeScaleY } : {}),
        ...(pendingRuntimePivot !== undefined ? { runtimePivot: pendingRuntimePivot } : {}),
      };
    }

    resolvedTransforms.set(entity.id, {
      position: { x: newX, y: newY },
      rotation: newRot + nextRuntimeTilt + nextRuntimeJiggleAngle,
      flipX: nextFlipX,
    });

    // Cas 3 : Émetteur de particules continu léger
    if (emitter && emitter.enabled !== false) {
      const rate = Math.max(1, Math.min(40, emitter.rate ?? 12));
      const acc = (particleEmitterAccumulators.get(entity.id) || 0) + dt * rate;
      const toEmit = Math.floor(acc);
      particleEmitterAccumulators.set(entity.id, acc - toEmit);

      if (toEmit > 0) {
        const centerX = newX + entity.size.width / 2;
        const centerY = newY + entity.size.height / 2;
        const rawOx = nextFlipX ? -(emitter.offsetX ?? 0) : (emitter.offsetX ?? 0);
        const rawOy = emitter.offsetY ?? 0;
        const rad = (newRot * Math.PI) / 180;
        const emitX = centerX + rawOx * Math.cos(rad) - rawOy * Math.sin(rad);
        const emitY = centerY + rawOx * Math.sin(rad) + rawOy * Math.cos(rad);

        emitParticlesBurst({
          x: emitX,
          y: emitY,
          count: toEmit,
          color: emitter.color || '#f59e0b',
          color2: emitter.color2,
          shape: emitter.shape || 'circle',
          customParticleId: emitter.customParticleId,
          customParticleIds: emitter.customParticleIds,
          customParticleMode: emitter.customParticleMode,
          useTint: emitter.useParticleTint,
          speed: emitter.speed ?? 120,
          size: emitter.size ?? 6,
          lifetime: emitter.lifetime ?? 0.6,
          gravity: emitter.gravity ?? 150,
          spread: emitter.spread ?? 60,
          angle: (emitter.angle ?? -90) + newRot,
        });
      }
    }
    // Cas 4 : Composant Santé / Dégâts (Health) — modulaire & coopératif avec le Character Controller
    const health = effectiveBehaviors.find((b) => b.type === 'health') as HealthBehaviorConfig | undefined;
    if (health && health.enabled !== false) {
      const maxHp = Math.max(1, Math.round(health.maxHp || 3));
      let rt = healthRuntimeMap.get(entity.id);
      if (!rt) {
        rt = { hp: maxHp, maxHp, invincibilityTimer: 0, dead: false };
        healthRuntimeMap.set(entity.id, rt);
      } else {
        rt.maxHp = maxHp;
        if (rt.hp > maxHp) rt.hp = maxHp;
      }

      if (rt.invincibilityTimer > 0) {
        rt.invincibilityTimer = Math.max(0, rt.invincibilityTimer - dt);
        if (rt.invincibilityTimer === 0 && !rt.dead && rt.hurtStateId) {
          // Restaure l'état de locomotion/repos pour redonner la main au Character Controller
          if (entity.currentStateId === rt.hurtStateId) {
            const fallbackState =
              (health.recoverStateId && entity.states[health.recoverStateId] ? health.recoverStateId : undefined) ||
              (rt.preHurtStateId && entity.states[rt.preHurtStateId] ? rt.preHurtStateId : undefined);
            if (fallbackState && fallbackState !== entity.currentStateId) {
              stateChanges[entity.id] = fallbackState;
            }
          }
          rt.hurtStateId = undefined;
          rt.preHurtStateId = undefined;
        }
      }

      // Décompte différé de changement / redémarrage de scène après mort
      if (rt.dead && !rt.deathActionDispatched && (health.onDeath === 'restart_scene' || health.onDeath === 'change_scene')) {
        rt.deathActionTimer = Math.max(0, (rt.deathActionTimer ?? 0) - dt);
        if (rt.deathActionTimer <= 0 && !healthDeathSceneAction) {
          rt.deathActionDispatched = true;
          healthDeathSceneAction = {
            action: health.onDeath,
            targetSceneId: health.deathTargetSceneId,
            transition: health.deathSceneTransition || 'fade',
            duration: health.deathSceneTransitionDuration ?? 0.45,
          };
        }
      }

      if (!rt.dead && rt.invincibilityTimer <= 0 && health.damageTag) {
        const cleanTag = health.damageTag.toLowerCase().trim().replace(/^#/, '');
        if (cleanTag) {
          let hitHazardCenter: Position | null = null;
          const worldBounds = getEntityWorldColliderBounds(
            { ...entity, position: { x: newX, y: newY } },
            currentState
          );
          const selfVy = body ? body.velocity.y * 60 : 0;

          const isSideDamageAllowed = (
            sideOnSelf: 'top' | 'bottom' | 'left' | 'right',
            attackerVy: number
          ): boolean => {
            if (sideOnSelf === 'top' && health.vulnerableTop === false) return false;
            if (sideOnSelf === 'bottom' && health.vulnerableBottom === false) return false;
            if (sideOnSelf === 'left' && health.vulnerableLeft === false) return false;
            if (sideOnSelf === 'right' && health.vulnerableRight === false) return false;
            if (health.immuneTopWhenFalling) {
              // Protège à la fois : (a) l'entité qui tombe sur un danger (pieds) et (b) une entité touchée par le haut par un objet qui tombe
              if (sideOnSelf === 'bottom' && selfVy > 15) return false;
              if (sideOnSelf === 'top' && attackerVy > 15) return false;
            }
            return true;
          };

          // 1) Vérifier collision avec des entités portant le tag danger
          for (const other of entityList) {
            if (other.id === entity.id) continue;
            const otherTags = (other.tags || []).map((t) => t.toLowerCase().trim().replace(/^#/, ''));
            if (!otherTags.includes(cleanTag)) continue;

            const hasPhysicsContact =
              activePhysicsCollisionPairs.has(`${entity.id}:::${other.id}`) ||
              activePhysicsCollisionPairs.has(`${other.id}:::${entity.id}`);

            const ob = getEntityWorldColliderBounds(other, other.states[other.currentStateId]);
            let colliding = hasPhysicsContact;
            if (!colliding) {
              if (worldBounds.colliderType === 'circle' && ob.colliderType === 'circle') {
                const maxR = worldBounds.radius + ob.radius + 2;
                colliding = Math.hypot(worldBounds.centerX - ob.centerX, worldBounds.centerY - ob.centerY) <= maxR;
              } else {
                colliding =
                  worldBounds.x <= ob.x + ob.width + 2 &&
                  worldBounds.x + worldBounds.width + 2 >= ob.x &&
                  worldBounds.y <= ob.y + ob.height + 2 &&
                  worldBounds.y + worldBounds.height + 2 >= ob.y;
              }
            }

            if (colliding) {
              const contactNormal = activePhysicsCollisionNormals.get(`${entity.id}:::${other.id}`) || null;
              const sideOnSelf = computeDirectionalCollisionSide(worldBounds, ob, contactNormal);
              const otherVel = lastEntityVelocities.get(other.id);
              if (!isSideDamageAllowed(sideOnSelf, otherVel?.vy ?? 0)) {
                continue;
              }
              hitHazardCenter = {
                x: other.position.x + other.size.width / 2,
                y: other.position.y + other.size.height / 2,
              };
              break;
            }
          }

          // 2) Vérifier collision avec des calques Colliders portant le tag danger
          if (!hitHazardCenter && colliderLayers.length > 0) {
            for (const layer of colliderLayers) {
              const lTags = (layer.colliderTags || []).map((t) => t.toLowerCase().trim().replace(/^#/, ''));
              if (!lTags.includes(cleanTag)) continue;
              const check = checkEntityAgainstColliderLayer(worldBounds, entity.id, layer, canvasBounds, 2);
              if (check.colliding) {
                const pt = check.contactPoint || {
                  x: worldBounds.centerX,
                  y: worldBounds.centerY + 12,
                };
                const dx = pt.x - worldBounds.centerX;
                const dy = pt.y - worldBounds.centerY;
                const halfW = Math.max(1, worldBounds.width / 2);
                const halfH = Math.max(1, worldBounds.height / 2);
                const sideOnSelf: 'top' | 'bottom' | 'left' | 'right' =
                  Math.abs(dy) / halfH >= Math.abs(dx) / halfW
                    ? dy >= 0
                      ? 'bottom'
                      : 'top'
                    : dx >= 0
                    ? 'right'
                    : 'left';
                if (!isSideDamageAllowed(sideOnSelf, 0)) {
                  continue;
                }
                hitHazardCenter = pt;
                break;
              }
            }
          }

          if (hitHazardCenter) {
            rt.hp = Math.max(0, rt.hp - 1);

            // Recul physique (Knockback)
            const kb = health.knockbackForce ?? 220;
            if (body && !body.isStatic && kb > 0) {
              const entCx = newX + entity.size.width / 2;
              const entCy = newY + entity.size.height / 2;
              const dx = entCx - hitHazardCenter.x;
              const dy = entCy - hitHazardCenter.y;
              const dist = Math.hypot(dx, dy);
              const kbStep = kb / 60;
              const nx = dist > 1 ? dx / dist : (nextFlipX ? 1 : -1);
              const ny = dist > 1 ? Math.min(-0.45, dy / dist) : -0.65;
              const nLen = Math.hypot(nx, ny) || 1;
              Body.setVelocity(body, {
                x: (nx / nLen) * kbStep,
                y: (ny / nLen) * kbStep,
              });
            }

            if (rt.hp <= 0) {
              rt.dead = true;
              if (health.onDeath === 'destroy') {
                entitiesToDestroy.push(entity.id);
              } else {
                if (health.deathStateId && entity.states[health.deathStateId]) {
                  stateChanges[entity.id] = health.deathStateId;
                }
                if (health.onDeath === 'restart_scene' || health.onDeath === 'change_scene') {
                  const delaySec = Math.max(0, health.deathDelaySec ?? 0);
                  rt.deathActionTimer = delaySec;
                  rt.deathActionDispatched = false;
                  if (delaySec <= 0.01 && !healthDeathSceneAction) {
                    rt.deathActionDispatched = true;
                    healthDeathSceneAction = {
                      action: health.onDeath,
                      targetSceneId: health.deathTargetSceneId,
                      transition: health.deathSceneTransition || 'fade',
                      duration: health.deathSceneTransitionDuration ?? 0.45,
                    };
                  }
                }
              }
            } else {
              rt.invincibilityTimer = Math.max(0.1, health.damageCooldown ?? 1.0);
              if (health.hurtStateId && entity.states[health.hurtStateId]) {
                rt.preHurtStateId = entity.currentStateId;
                rt.hurtStateId = health.hurtStateId;
                stateChanges[entity.id] = health.hurtStateId;
              }
            }
          }
        }
      }
    }

    const lockStateByDeath = Boolean(
      health &&
        health.enabled !== false &&
        healthRuntimeMap.get(entity.id)?.dead &&
        health.disableControlsOnDeath !== false
    );

    // Cas 5 : Character Controller — Liaisons d'états visuels avec garde-fou non-écrasant
    const keyboardCtrl = effectiveBehaviors.find((b) => b.type === 'keyboard_control') as
      | KeyboardControlBehaviorConfig
      | undefined;
    if (!lockStateByDeath && keyboardCtrl && keyboardCtrl.enabled !== false && keyboardCtrl.stateBindings && !stateChanges[entity.id] && body) {
      const sb = keyboardCtrl.stateBindings;
      const boundIds = new Set(
        [sb.idleStateId, sb.moveStateId, sb.jumpStateId, sb.fallStateId, sb.landStateId].filter(
          (sid): sid is string => Boolean(sid && entity.states[sid])
        )
      );

      // Garde-fou strict : ne jamais écraser un état hors locomotion (ex: Blessé, Attaque, Mort)
      if (boundIds.size > 0 && boundIds.has(entity.currentStateId)) {
        const isBottomFloor = !body.isSensor && body.bounds.max.y >= canvasBounds.height - 3;
        const rawGrounded = (groundedEntityIds.has(entity.id) || isBottomFloor) && body.velocity.y >= -0.75;
        const wantsToMove = keyboardMoveInput.get(entity.id) === true;
        const minFallHeight = Math.max(0, sb.minFallHeight ?? 20);
        let desiredStateId: string | undefined;

        const airState = controllerAirStates.get(entity.id) || {
          wasGrounded: rawGrounded,
          groundedGraceTimer: rawGrounded ? 0.075 : 0,
          airborneTime: 0,
          peakAirY: body.position.y,
          maxFallDropPx: 0,
          landTimer: 0,
          moveGraceTimer: 0,
        };

        if (wantsToMove || Math.abs(body.velocity.x) > 0.35) {
          airState.moveGraceTimer = 0.08;
        } else if (airState.moveGraceTimer > 0) {
          airState.moveGraceTimer = Math.max(0, airState.moveGraceTimer - dt);
        }

        if (keyboardCtrl.mode === 'platformer') {
          if (rawGrounded) {
            airState.groundedGraceTimer = 0.075;
          } else if (airState.groundedGraceTimer > 0 && body.velocity.y >= -0.85) {
            airState.groundedGraceTimer = Math.max(0, airState.groundedGraceTimer - dt);
          } else {
            airState.groundedGraceTimer = 0;
          }

          const isGrounded = rawGrounded || airState.groundedGraceTimer > 0;

          if (!isGrounded) {
            if (airState.wasGrounded) {
              airState.peakAirY = body.position.y;
              airState.maxFallDropPx = 0;
            } else {
              airState.peakAirY = Math.min(airState.peakAirY, body.position.y);
            }
            const currentDrop = Math.max(0, body.position.y - airState.peakAirY);
            airState.maxFallDropPx = Math.max(airState.maxFallDropPx, currentDrop);
            airState.airborneTime += dt;
            airState.landTimer = 0;
            airState.wasGrounded = false;
          } else {
            const hasFallenEnough =
              minFallHeight === 0
                ? airState.airborneTime >= 0.04
                : airState.maxFallDropPx >= minFallHeight;
            if (!airState.wasGrounded && hasFallenEnough) {
              airState.landTimer = Math.max(0.05, Math.min(1.0, sb.landDuration ?? 0.15));
            } else if (airState.landTimer > 0) {
              airState.landTimer = Math.max(0, airState.landTimer - dt);
            }
            airState.airborneTime = 0;
            airState.peakAirY = body.position.y;
            airState.maxFallDropPx = 0;
            airState.wasGrounded = true;
          }
          controllerAirStates.set(entity.id, airState);

          const fallDropNow = Math.max(0, body.position.y - airState.peakAirY);
          const canShowFall = minFallHeight === 0 ? airState.airborneTime >= 0.03 : fallDropNow >= minFallHeight;
          const isMovingHorizontally =
            wantsToMove ||
            Math.abs(body.velocity.x) > 0.35 ||
            (entity.currentStateId === sb.moveStateId && airState.moveGraceTimer > 0 && Math.abs(body.velocity.x) > 0.12);

          if (!isGrounded && body.velocity.y < -0.55 && sb.jumpStateId && entity.states[sb.jumpStateId]) {
            desiredStateId = sb.jumpStateId;
          } else if (!isGrounded && body.velocity.y > 0.75 && canShowFall && sb.fallStateId && entity.states[sb.fallStateId]) {
            desiredStateId = sb.fallStateId;
          } else if (isGrounded && airState.landTimer > 0 && sb.landStateId && entity.states[sb.landStateId]) {
            desiredStateId = sb.landStateId;
          } else if (isMovingHorizontally && sb.moveStateId && entity.states[sb.moveStateId]) {
            desiredStateId = sb.moveStateId;
          } else if (sb.idleStateId && entity.states[sb.idleStateId]) {
            desiredStateId = sb.idleStateId;
          }
        } else {
          controllerAirStates.set(entity.id, airState);
          const speedMag = Math.hypot(body.velocity.x, body.velocity.y);
          const isMoving2D =
            wantsToMove ||
            speedMag > 0.35 ||
            (entity.currentStateId === sb.moveStateId && airState.moveGraceTimer > 0 && speedMag > 0.12);
          if (isMoving2D && sb.moveStateId && entity.states[sb.moveStateId]) {
            desiredStateId = sb.moveStateId;
          } else if (sb.idleStateId && entity.states[sb.idleStateId]) {
            desiredStateId = sb.idleStateId;
          }
        }

        if (desiredStateId && desiredStateId !== entity.currentStateId) {
          stateChanges[entity.id] = desiredStateId;
        }
      }
    }

    // Cas 6b : Appliquer la transition d'état de la Marionnette Interactive (si non déjà modifiée par Santé/Controller)
    if (!lockStateByDeath && !stateChanges[entity.id] && puppetDesiredStateId && puppetDesiredStateId !== entity.currentStateId) {
      stateChanges[entity.id] = puppetDesiredStateId;
    }

    // Cas 6c : États visuels de Peur / Conscience du curseur sur Flee (garde-fou actif)
    const fleeBeh = effectiveBehaviors.find((b) => b.type === 'flee') as FleeBehaviorConfig | undefined;
    if (!lockStateByDeath && !stateChanges[entity.id] && fleeBeh && fleeBeh.enabled !== false && fleeBeh.stateBindings) {
      const fsb = fleeBeh.stateBindings;
      const fBound = new Set(
        [fsb.calmStateId, fsb.scaredStateId].filter((sid): sid is string => Boolean(sid && entity.states[sid]))
      );
      if (fBound.size > 0 && fBound.has(entity.currentStateId)) {
        let isSelfOrAncestorDragged = Boolean(activeDragPositions[entity.id]);
        let ancId = entity.parentId;
        let depthGuard = 0;
        while (!isSelfOrAncestorDragged && ancId && liveEntities[ancId] && depthGuard < 16) {
          if (activeDragPositions[ancId]) {
            isSelfOrAncestorDragged = true;
            break;
          }
          ancId = liveEntities[ancId].parentId;
          depthGuard += 1;
        }
        const pausedByDrag = fleeBeh.pauseWhileDragged !== false && isSelfOrAncestorDragged;
        const selfCx = newX + entity.size.width / 2;
        const selfCy = newY + entity.size.height / 2;
        const threatPt = resolveTargetWorldPoint(
          entity.id,
          selfCx,
          selfCy,
          fleeBeh.targetType || 'mouse',
          fleeBeh.targetEntityId,
          fleeBeh.targetEntityType,
          fleeBeh.targetTag,
          liveEntities,
          mousePos
        );
        const radius = fleeBeh.fleeRadius ?? 220;
        const dist = threatPt ? Math.hypot(selfCx - threatPt.x, selfCy - threatPt.y) : Infinity;
        const isScared = Boolean(threatPt && !pausedByDrag && (radius <= 0 || dist < radius));
        const nextFleeState =
          isScared && fsb.scaredStateId && entity.states[fsb.scaredStateId]
            ? fsb.scaredStateId
            : !isScared && fsb.calmStateId && entity.states[fsb.calmStateId]
            ? fsb.calmStateId
            : undefined;
        if (nextFleeState && nextFleeState !== entity.currentStateId) {
          stateChanges[entity.id] = nextFleeState;
        }
      }
    }
  }

  return {
    updatedTransforms,
    ...(entitiesToDestroy.length > 0 ? { entitiesToDestroy } : {}),
    ...(Object.keys(stateChanges).length > 0 ? { stateChanges } : {}),
    ...(Object.keys(variableUpdates).length > 0 ? { variableUpdates } : {}),
    ...(brokenJointEvents.length > 0 ? { brokenJointEvents } : {}),
    ...(healthDeathSceneAction ? { healthDeathSceneAction } : {}),
  };
}
