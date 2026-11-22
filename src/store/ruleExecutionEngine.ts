import {
  ActionTargetMode,
  AppMode,
  CustomSound,
  DynamicRule,
  Entity,
  EntityId,
  EntityType,
  ParentOffset,
  Position,
  RuleAction,
  SceneCameraConfig,
  SceneTransitionType,
  Size,
  StateId,
} from '../types';
import {
  applyEntityImpulseAction,
  applyEntityMoveAction,
  getActiveDragPositions,
  getEffectiveBehaviors,
  queueEntityInitialVelocity,
  setActiveDragPosition,
  snapEntityToTargetRuntime,
  unsnapEntityRuntime,
} from '../utils/matterPhysicsEngine';
import { PhysicsBehaviorConfig, SnapBehaviorConfig } from '../types';
import {
  computeRelativeParticleOrigin,
  emitParticlesBurst,
  getLatestMouseWorldPos,
  resolveParticleDirectionAngle,
  startTimedRuleParticleEmitter,
} from '../utils/particleSystem';
import { soundSynth } from '../utils/sound';
import { dispatchPlayCameraAction } from '../utils/cameraRuntime';
import { resolveWorldBounds } from '../utils/cameraSolver';
import { getCollisionContactPoint } from './collisionHelpers';
import {
  computeRelativeParentOffset,
  resolveEntityHierarchyScopeIds,
  resolveEntityReference,
} from './parentingHelpers';
import { isSnapParentAttachBehavior } from '../utils/physics/snapSolver';
import { computeRandomSpawnPosition } from '../utils/spawnHelpers';
import {
  canRuleFireWithGate,
  clearTriggerGateState,
  recordRuleFired,
  resetPlaySessionClock,
} from './triggerGate';

export interface RuleEngineStoreSnapshot {
  appMode: AppMode;
  gameScore: number;
  gameVariables: Record<string, number>;
  customSounds: CustomSound[];
  entities: Record<EntityId, Entity>;
  sceneBounds: Size;
  editSceneBounds?: Size;
  camera?: SceneCameraConfig;
  customArchetypes: Record<string, Entity>;
  setEntityParent: (childId: EntityId, parentId: EntityId | null, customOffset?: ParentOffset) => void;
  detachEntity: (childId: EntityId) => void;
  updateEntityPosition: (id: EntityId, position: Position) => void;
  changeSceneInPlay: (targetSceneId: string, transition?: SceneTransitionType, duration?: number) => void;
}

export interface RuleEngineStoreBridge {
  getState: () => RuleEngineStoreSnapshot;
  setState: (partial: { gameScore?: number; gameVariables?: Record<string, number> }) => void;
}

let storeBridge: RuleEngineStoreBridge | null = null;

export function registerRuleEngineStoreBridge(bridge: RuleEngineStoreBridge) {
  storeBridge = bridge;
}

function getBridgeState(): RuleEngineStoreSnapshot | null {
  return storeBridge ? storeBridge.getState() : null;
}

// Anti-Infinite Loop & Rapid Bounce Protections
export const RULE_COOLDOWN_MS = 350; // Minimum interval between identical rule trigger on same entities
export const ENTITY_STATE_COOLDOWN_MS = 250; // Prevents oscillating state ping-pong

export const ruleCooldowns: Record<string, number> = {};
export const entityStateTimestamps: Record<string, number> = {};
export const preCollisionStates: Record<
  string,
  {
    subjectState?: string;
    targetState?: string;
    lastOverlapPosA?: Position;
    lastOverlapPosB?: Position;
  }
> = {};
export const preEventAutoRevertStates: Record<string, string> = {};
export const lastCollisionContacts: Record<string, Position> = {};
export const firedCollisionOnceKeys: Record<string, boolean> = {};
export const prevEvaluatedVariables: Record<string, number> = {};
export const activeDelayTimers = new Set<ReturnType<typeof setTimeout>>();

let isEvaluatingRules = false;
// Dernière instance créée dynamiquement en mode Play (Piste C : Référence "Dernier objet apparu")
let lastSpawnedEntityId: EntityId | null = null;

export function getIsEvaluatingRules(): boolean {
  return isEvaluatingRules;
}

export function setIsEvaluatingRules(evaluating: boolean) {
  isEvaluatingRules = evaluating;
}

export function getLastSpawnedEntityId(): EntityId | null {
  return lastSpawnedEntityId;
}

export function setLastSpawnedEntityId(id: EntityId | null) {
  lastSpawnedEntityId = id;
}

export function clearPlayRuntimeState() {
  activeDelayTimers.forEach((t) => clearTimeout(t));
  activeDelayTimers.clear();
  Object.keys(ruleCooldowns).forEach((k) => delete ruleCooldowns[k]);
  Object.keys(entityStateTimestamps).forEach((k) => delete entityStateTimestamps[k]);
  Object.keys(preCollisionStates).forEach((k) => delete preCollisionStates[k]);
  Object.keys(preEventAutoRevertStates).forEach((k) => delete preEventAutoRevertStates[k]);
  Object.keys(lastCollisionContacts).forEach((k) => delete lastCollisionContacts[k]);
  Object.keys(firedCollisionOnceKeys).forEach((k) => delete firedCollisionOnceKeys[k]);
  Object.keys(prevEvaluatedVariables).forEach((k) => delete prevEvaluatedVariables[k]);
  Object.keys(getActiveDragPositions()).forEach((id) => setActiveDragPosition(id, null));
  clearTriggerGateState();
  resetPlaySessionClock();
  lastSpawnedEntityId = null;
}

export interface RuleActionExecutionHelpers {
  subject?: Entity;
  target?: Entity;
  eventPosition?: Position;
  allEntities: Record<EntityId, Entity>;
  updateEntityState: (id: EntityId, stateId: StateId) => void;
  updateEntityDetails: (
    id: EntityId,
    partial: Partial<Entity>,
    options?: { instanceOnly?: boolean }
  ) => void;
  deleteEntity: (id: EntityId) => void;
  spawnEntity: (params: {
    type: EntityType;
    position: Position;
    initialStateId?: StateId;
    size?: Size;
    tags?: string[];
  }) => EntityId;
}

// Helper pour traiter les paires de collision avec anti-boucle, continuité d'état et mémorisation du point de contact
export function handleCollisionPair(
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
    spawnEntity: (params: {
      type: EntityType;
      position: Position;
      initialStateId?: StateId;
      size?: Size;
      tags?: string[];
    }) => EntityId;
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

    // Cooldown séparé enter vs exit + limites universelles (once / N fois / cooldown / délai initial)
    const cooldownKey = `collision_${rule.id}_${subject.id}_${target.id}_${isExiting ? 'exit' : 'enter'}`;
    const cooldownDuration = isExiting ? 120 : RULE_COOLDOWN_MS;
    if (!canRuleFireWithGate(rule, now, cooldownDuration, { cooldownKey })) {
      return;
    }
    recordRuleFired(rule, now, { cooldownKey });

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
export function executeRuleActions(actions: RuleAction[], helpers: RuleActionExecutionHelpers) {
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
        const snap = getBridgeState();
        if (snap && snap.appMode !== 'play') return;
        executeAction(act, frozenHelpers);
      }, delayMs);
      activeDelayTimers.add(timerId);
    } else {
      executeAction(act, helpers);
    }
  }
}

// Helper pour exécuter une action ciblée
export function executeAction(act: RuleAction, helpers: RuleActionExecutionHelpers) {
  const bridgeSnap = getBridgeState();

  if (act.type === 'change_scene') {
    if (act.targetSceneId) {
      bridgeSnap?.changeSceneInPlay(
        act.targetSceneId,
        act.sceneTransition || 'fade',
        act.sceneTransitionDuration ?? 0.45
      );
    }
    return;
  }

  if (act.type === 'add_score') {
    const amount = act.scoreAmount ?? 1;
    const current = bridgeSnap?.gameVariables?.score ?? bridgeSnap?.gameScore ?? 0;
    const nextScore = Math.round((current + amount) * 100) / 100;
    storeBridge?.setState({
      gameScore: nextScore,
      gameVariables: {
        ...(bridgeSnap?.gameVariables || { score: 0 }),
        score: nextScore,
      },
    });
    soundSynth.play('win');
    return;
  }

  if (act.type === 'set_variable') {
    const varName = (act.variableName || 'score').trim() || 'score';
    const op = act.variableOperation || 'set';
    const operand = Number(act.variableValue ?? 1);
    const curVars = bridgeSnap?.gameVariables || { score: bridgeSnap?.gameScore ?? 0 };
    const currentVal = varName === 'score' ? (curVars.score ?? bridgeSnap?.gameScore ?? 0) : (curVars[varName] ?? 0);
    let nextVal = currentVal;
    if (op === 'set') nextVal = operand;
    else if (op === 'add') nextVal = currentVal + operand;
    else if (op === 'subtract') nextVal = currentVal - operand;
    else if (op === 'multiply') nextVal = currentVal * operand;
    const rounded = Math.round(nextVal * 100) / 100;
    storeBridge?.setState({
      gameVariables: {
        ...curVars,
        [varName]: rounded,
      },
      ...(varName === 'score' ? { gameScore: rounded } : {}),
    });
    return;
  }

  if (act.type === 'play_sound') {
    if (act.customSoundId && bridgeSnap) {
      const sounds = bridgeSnap.customSounds;
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
  const liveEntities = bridgeSnap?.entities || helpers.allEntities;
  const viewportBounds = bridgeSnap?.sceneBounds || { width: 800, height: 500 };
  const editBounds = bridgeSnap?.editSceneBounds;
  const sceneBounds = resolveWorldBounds(viewportBounds, bridgeSnap?.camera, editBounds);

  if (act.type === 'camera_action') {
    dispatchPlayCameraAction(
      act,
      {
        subject: helpers.subject,
        target: helpers.target,
        entities: liveEntities,
        lastSpawnedId: lastSpawnedEntityId,
      },
      viewportBounds,
      bridgeSnap?.camera,
      editBounds
    );
    return;
  }

  if (act.type === 'emit_particles') {
    const originMode = act.particleOriginMode || (helpers.target ? 'target' : 'subject');
    let originX = 300;
    let originY = 200;
    let emitAngle = act.particleAngle ?? -90;
    let originEntity: Entity | undefined;

    if (originMode === 'coordinates') {
      originX = act.particleCoords?.x ?? 300;
      originY = act.particleCoords?.y ?? 200;
    } else if (originMode === 'mouse') {
      const mPos = helpers.eventPosition || getLatestMouseWorldPos();
      originX = (mPos?.x ?? 300) + (act.particleOffsetX ?? 0);
      originY = (mPos?.y ?? 200) + (act.particleOffsetY ?? 0);
    } else if (originMode === 'event_point' && helpers.eventPosition) {
      originX = helpers.eventPosition.x + (act.particleOffsetX ?? 0);
      originY = helpers.eventPosition.y + (act.particleOffsetY ?? 0);
    } else {
      const origin =
        resolveEntityReference(
          originMode === 'event_point' ? (helpers.target ? 'target' : 'subject') : originMode,
          act.particleOriginEntityId,
          act.particleOriginEntityType,
          act.particleOriginTag,
          helpers.subject,
          helpers.target,
          liveEntities,
          lastSpawnedEntityId
        ) ||
        helpers.subject ||
        helpers.target;

      if (origin) {
        originEntity = origin;
        const rel = computeRelativeParticleOrigin({
          entity: origin,
          anchor: act.particleAnchor || 'center',
          offsetX: act.particleOffsetX ?? 0,
          offsetY: act.particleOffsetY ?? 0,
          baseAngleDeg: act.particleAngle ?? -90,
          followRotation: act.particleMatchOriginRotation !== false,
        });
        originX = rel.x;
        originY = rel.y;
        emitAngle = rel.angleDeg;
      } else if (helpers.eventPosition) {
        originX = helpers.eventPosition.x + (act.particleOffsetX ?? 0);
        originY = helpers.eventPosition.y + (act.particleOffsetY ?? 0);
      }
    }

    const mouseNow = getLatestMouseWorldPos();
    const resolvedAngle = resolveParticleDirectionAngle({
      directionMode: act.particleDirectionMode || 'angle',
      baseAngleDeg: emitAngle,
      originX,
      originY,
      originEntity,
      targetMode: act.particleDirectionTargetMode || (helpers.target ? 'target' : 'mouse'),
      targetEntityId: act.particleDirectionTargetEntityId,
      targetEntityType: act.particleDirectionTargetEntityType,
      targetTag: act.particleDirectionTargetTag,
      entities: liveEntities,
      subject: helpers.subject,
      target: helpers.target,
      eventPosition: helpers.eventPosition,
      mousePos: mouseNow,
      lastSpawnedId: lastSpawnedEntityId,
    });

    const burstBaseOpts = {
      count: act.particleCount ?? 18,
      countMax: act.particleCountMax,
      color: act.particleColor ?? '#f59e0b',
      color2: act.particleColor2,
      colorMode: act.particleColorMode,
      shape: act.particleShape ?? ('circle' as const),
      customParticleId: act.customParticleId,
      customParticleIds: act.customParticleIds,
      customParticleMode: act.customParticleMode,
      useTint: act.useParticleTint,
      speed: act.particleSpeed ?? 180,
      speedMax: act.particleSpeedMax,
      size: act.particleSize ?? 6,
      sizeMax: act.particleSizeMax,
      endSizeScale: act.particleEndSizeScale,
      lifetime: act.particleLifetime ?? 0.7,
      lifetimeMax: act.particleLifetimeMax,
      gravity: act.particleGravity ?? 220,
      drag: act.particleDrag,
      opacityStart: act.particleOpacityStart,
      opacityEnd: act.particleOpacityEnd,
      spinSpeed: act.particleSpinSpeed,
      spread: act.particleSpread ?? 360,
      emissionShape: act.particleEmissionShape,
      emissionRadius: act.particleEmissionRadius,
      emissionWidth: act.particleEmissionWidth,
      emissionHeight: act.particleEmissionHeight,
    };

    const emitDuration = act.particleEmitDuration ?? 0;
    if (emitDuration > 0) {
      startTimedRuleParticleEmitter(
        {
          burstBaseOpts,
          fallbackOriginX: originX,
          fallbackOriginY: originY,
          fallbackAngleDeg: resolvedAngle,
          durationSec: emitDuration,
          rate: act.particleEmitRate ?? 0,
          burstCount: act.particleBurstCount ?? 0,
          burstInterval: act.particleBurstInterval ?? 0,
          originMode,
          originEntityId: originEntity?.id,
          anchor: act.particleAnchor || 'center',
          offsetX: act.particleOffsetX ?? 0,
          offsetY: act.particleOffsetY ?? 0,
          followRotation: act.particleMatchOriginRotation !== false,
          baseAngleDeg: act.particleAngle ?? -90,
          directionMode: act.particleDirectionMode || 'angle',
          directionTargetMode: act.particleDirectionTargetMode || (helpers.target ? 'target' : 'mouse'),
          directionTargetEntityId: act.particleDirectionTargetEntityId,
          directionTargetEntityType: act.particleDirectionTargetEntityType,
          directionTargetTag: act.particleDirectionTargetTag,
          subjectId: helpers.subject?.id,
          targetId: helpers.target?.id,
          eventPosition: helpers.eventPosition,
        },
        liveEntities,
        mouseNow,
        lastSpawnedEntityId
      );
      return;
    }

    emitParticlesBurst({
      ...burstBaseOpts,
      x: originX,
      y: originY,
      angle: resolvedAngle,
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
        liveEntities,
        lastSpawnedEntityId
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
      bridgeSnap?.customArchetypes[spawnType];
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
      const rndPos = computeRandomSpawnPosition({
        sceneBounds,
        spawnSize,
        scope: act.spawnRandomScope || 'canvas',
        zone: act.spawnRandomZone,
      });
      spawnX = rndPos.x;
      spawnY = rndPos.y;
    } else if (locMode === 'absolute') {
      const targetCoord =
        act.spawnPosition ||
        (act as any).spawnAbsoluteCoords || {
          x: Math.round(sceneBounds.width / 2),
          y: Math.round(sceneBounds.height / 2),
        };
      spawnX = Math.round(targetCoord.x - spawnSize.width / 2);
      spawnY = Math.round(targetCoord.y - spawnSize.height / 2);
    } else if (locMode === 'at_event_point' || locMode === 'offset_event_point') {
      const basePt =
        helpers.eventPosition ||
        (emitter
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

    const minClamp = locMode === 'random' && act.spawnRandomScope === 'zone' ? 0 : 10;
    const spawnedId = helpers.spawnEntity({
      type: spawnType,
      position: { x: Math.max(minClamp, spawnX), y: Math.max(minClamp, spawnY) },
      initialStateId: act.spawnInitialStateId,
      size: spawnSize,
      tags: act.spawnTags,
    });
    if (spawnedId) {
      lastSpawnedEntityId = spawnedId;
      const impulseSpeed = act.spawnImpulseSpeed ?? 0;
      if (impulseSpeed > 0) {
        const angleRad = ((act.spawnImpulseAngle ?? 0) * Math.PI) / 180;
        const vx = Math.cos(angleRad) * impulseSpeed;
        const vy = Math.sin(angleRad) * impulseSpeed;
        queueEntityInitialVelocity(spawnedId, vx, vy);
      }
    }
    return;
  }

  const rawTargets: Entity[] = [];

  const targetMode: ActionTargetMode = act.targetMode || 'subject';

  if (targetMode === 'subject' && helpers.subject) {
    const liveSubject = liveEntities[helpers.subject.id] || helpers.subject;
    rawTargets.push(liveSubject);
  } else if (targetMode === 'target') {
    if (helpers.target) {
      const liveTarget = liveEntities[helpers.target.id] || helpers.target;
      rawTargets.push(liveTarget);
    } else if (act.targetType) {
      Object.values(liveEntities).forEach((e) => {
        if (e.type === act.targetType) rawTargets.push(e);
      });
    } else if (helpers.subject) {
      // Pour les événements au clic (pas de collision/cible), fallback vers le sujet cliqué
      const liveSubject = liveEntities[helpers.subject.id] || helpers.subject;
      rawTargets.push(liveSubject);
    }
  } else if (targetMode === 'last_spawned') {
    if (lastSpawnedEntityId && liveEntities[lastSpawnedEntityId]) {
      rawTargets.push(liveEntities[lastSpawnedEntityId]);
    }
  } else if (targetMode === 'instance' && act.targetId) {
    const e = liveEntities[act.targetId];
    if (e) rawTargets.push(e);
  } else if (targetMode === 'type' && act.targetType) {
    Object.values(liveEntities).forEach((e) => {
      if (e.type === act.targetType) rawTargets.push(e);
    });
  } else if (targetMode === 'tag' && act.targetTag) {
    const cleanTag = act.targetTag.toLowerCase().trim().replace(/^#/, '');
    Object.values(liveEntities).forEach((e) => {
      if (e.tags?.includes(cleanTag)) rawTargets.push(e);
    });
  } else if (act.targetType && act.targetType !== helpers.subject?.type) {
    // Si l'action cible explicitement un type d'entité distinct
    Object.values(liveEntities).forEach((e) => {
      if (e.type === act.targetType) rawTargets.push(e);
    });
  } else if (act.targetId) {
    // Fallback
    const e = liveEntities[act.targetId];
    if (e) rawTargets.push(e);
  }

  const allowDisabledTargets = act.type === 'set_entity_enabled';
  const targetEntities = allowDisabledTargets
    ? rawTargets
    : rawTargets.filter((e) => !e.disabled);

  targetEntities.forEach((entity) => {
    // Si un filtre d'état source est spécifié pour l'action, vérifier qu'elle y correspond
    if (act.onlyInStateId && act.onlyInStateId !== '' && entity.currentStateId !== act.onlyInStateId) {
      return;
    }

    if (act.type === 'set_entity_enabled') {
      const mode = act.enabledActionMode || 'disable';
      const nextDisabled =
        mode === 'enable' ? false : mode === 'disable' ? true : !Boolean(entity.disabled);
      const scopeIds = resolveEntityHierarchyScopeIds(
        liveEntities,
        entity.id,
        act.enabledScope || 'with_children'
      );
      scopeIds.forEach((targetId) => {
        helpers.updateEntityDetails(targetId, { disabled: nextDisabled }, { instanceOnly: true });
      });
      return;
    }

    if (act.type === 'attach_to_parent') {
      const freshSnap = getBridgeState();
      const parentEnt = resolveEntityReference(
        act.parentTargetMode || (helpers.target ? 'target' : 'subject'),
        act.parentEntityId,
        act.parentEntityType,
        act.parentEntityTag,
        helpers.subject,
        helpers.target,
        freshSnap?.entities || liveEntities,
        lastSpawnedEntityId
      );
      if (parentEnt && parentEnt.id !== entity.id) {
        const disableCollisions = act.attachDisableCollisions;
        let resolvedOffset = act.parentOffset ? { ...act.parentOffset } : undefined;
        if (act.attachKeepCurrentOffset === true) {
          const curChild = (freshSnap?.entities || liveEntities)[entity.id] || entity;
          const curParent = (freshSnap?.entities || liveEntities)[parentEnt.id] || parentEnt;
          const mergedPreset: ParentOffset | undefined =
            curChild.parentOffset || act.parentOffset
              ? {
                  x: 0,
                  y: 0,
                  ...(curChild.parentOffset || {}),
                  ...(act.parentOffset || {}),
                }
              : undefined;
          resolvedOffset = computeRelativeParentOffset(curChild, curParent, mergedPreset);
        }
        if (disableCollisions !== undefined) {
          if (resolvedOffset) {
            resolvedOffset = { ...resolvedOffset, disableCollisionsWhileAttached: disableCollisions };
          } else {
            const curChild = (freshSnap?.entities || liveEntities)[entity.id] || entity;
            const curParent = (freshSnap?.entities || liveEntities)[parentEnt.id] || parentEnt;
            resolvedOffset = {
              ...computeRelativeParentOffset(curChild, curParent, curChild.parentOffset),
              disableCollisionsWhileAttached: disableCollisions,
            };
          }
        }
        freshSnap?.setEntityParent(entity.id, parentEnt.id, resolvedOffset);
      }
      return;
    }

    if (act.type === 'detach_parent') {
      getBridgeState()?.detachEntity(entity.id);
      const impulseSpeed = act.detachImpulseSpeed ?? 0;
      if (impulseSpeed > 0) {
        const angleRad = ((act.detachImpulseAngle ?? 0) * Math.PI) / 180;
        queueEntityInitialVelocity(
          entity.id,
          Math.cos(angleRad) * impulseSpeed,
          Math.sin(angleRad) * impulseSpeed
        );
      }
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
            liveEntities,
            lastSpawnedEntityId
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
          getBridgeState()?.updateEntityPosition(entity.id, {
            x: Math.round((entity.position.x + dx) * 10) / 10,
            y: Math.round((entity.position.y + dy) * 10) / 10,
          });
        }
      }
    } else if (act.type === 'apply_impulse') {
      const strength = act.impulseStrength ?? 350;
      const dirMode = act.impulseDirectionMode || 'cardinal';
      let vx = 0;
      let vy = 0;

      if (dirMode === 'cardinal') {
        const card = act.impulseCardinal || 'up';
        if (card === 'right') vx = strength;
        else if (card === 'left') vx = -strength;
        else if (card === 'up') vy = -strength;
        else if (card === 'down') vy = strength;
      } else if (dirMode === 'angle') {
        const rad = ((act.impulseAngle ?? -90) * Math.PI) / 180;
        vx = Math.cos(rad) * strength;
        vy = Math.sin(rad) * strength;
      } else if (dirMode === 'facing') {
        const rot = entity.states[entity.currentStateId]?.rotation || 0;
        const rad = (rot * Math.PI) / 180;
        const sign = entity.flipX ? -1 : 1;
        vx = Math.cos(rad) * strength * sign;
        vy = Math.sin(rad) * strength * sign;
      } else if (dirMode === 'toward_target' || dirMode === 'away_target') {
        const ex = entity.position.x + entity.size.width / 2;
        const ey = entity.position.y + entity.size.height / 2;
        let rx: number | null = null;
        let ry: number | null = null;
        if (act.impulseTargetMode === 'mouse') {
          if (helpers.eventPosition) {
            rx = helpers.eventPosition.x;
            ry = helpers.eventPosition.y;
          }
        } else {
          const refMode = act.impulseTargetMode || (helpers.target ? 'target' : 'subject');
          const ref = resolveEntityReference(
            refMode,
            act.impulseTargetEntityId,
            act.impulseTargetEntityType,
            act.impulseTargetTag,
            helpers.subject,
            helpers.target,
            liveEntities,
            lastSpawnedEntityId
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
            vx = ((rx - ex) / len) * strength * mult;
            vy = ((ry - ey) / len) * strength * mult;
          }
        }
      }

      const ang = act.impulseAngular ?? 0;
      if (vx !== 0 || vy !== 0 || ang !== 0 || (act.impulseApplyMode || 'add') === 'set') {
        const effBehaviors = getEffectiveBehaviors(entity, entity.states[entity.currentStateId]);
        const physicsCfg = effBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
        const isExplicitStatic = physicsCfg?.isStatic === true;
        applyEntityImpulseAction(entity.id, vx, vy, act.impulseApplyMode || 'add', ang, isExplicitStatic);
      }
    } else if (act.type === 'snap_to') {
      const refMode = act.snapTargetMode || (helpers.target ? 'target' : 'entity');
      let targetEnt: Entity | undefined;
      if (refMode === 'any') {
        const ex = entity.position.x + entity.size.width / 2;
        const ey = entity.position.y + entity.size.height / 2;
        let bestDist = Infinity;
        for (const cand of Object.values(liveEntities)) {
          if (!cand || cand.id === entity.id || cand.disabled || cand.visible === false) continue;
          const dist = Math.hypot(
            cand.position.x + cand.size.width / 2 - ex,
            cand.position.y + cand.size.height / 2 - ey
          );
          if (dist < bestDist) {
            bestDist = dist;
            targetEnt = cand;
          }
        }
      } else {
        targetEnt = resolveEntityReference(
          refMode,
          act.snapTargetEntityId,
          act.snapTargetEntityType,
          act.snapTargetTag,
          helpers.subject,
          helpers.target,
          liveEntities,
          lastSpawnedEntityId
        );
      }
      if (!targetEnt || targetEnt.id === entity.id) return;

      const curState = entity.states[entity.currentStateId];
      const effBehaviors = getEffectiveBehaviors(entity, curState);
      const existingSnapCfg = effBehaviors.find((b) => b.type === 'snap') as
        | SnapBehaviorConfig
        | undefined;
      const snapRes = snapEntityToTargetRuntime({
        entity,
        target: targetEnt,
        snapConfig: existingSnapCfg,
        snapAlignment: act.snapAlignment,
        sourceAnchor: act.snapSourceAnchor,
        targetAnchor: act.snapTargetAnchor,
        customSourceAnchor: act.snapCustomSourceAnchor,
        customTargetAnchor: act.snapCustomTargetAnchor,
        offsetX: act.snapOffsetX,
        offsetY: act.snapOffsetY,
        matchTargetRotation: act.snapMatchRotation,
        rotationOffset: act.snapRotationOffset,
        attachBehavior: act.snapAttachBehavior,
        jointConfig: act.snapJointConfig,
      });

      const snapBridge = getBridgeState();
      snapBridge?.updateEntityPosition(entity.id, snapRes.goalTopLeft);
      if (snapRes.goalRotationDeg !== undefined && curState) {
        helpers.updateEntityDetails(
          entity.id,
          {
            states: {
              ...entity.states,
              [entity.currentStateId]: {
                ...curState,
                rotation: snapRes.goalRotationDeg,
              },
            },
          },
          { instanceOnly: true }
        );
      }
      if (isSnapParentAttachBehavior(snapRes.attachBehavior) && snapRes.parentOffset) {
        snapBridge?.setEntityParent(entity.id, targetEnt.id, snapRes.parentOffset);
      }
    } else if (act.type === 'unsnap') {
      const unsnapRes = unsnapEntityRuntime(entity.id, act.unsnapCooldownSec ?? 0.35);
      const snapBridge = getBridgeState();
      if (unsnapRes.wasParented || entity.parentId) {
        snapBridge?.detachEntity(entity.id);
      }
      if (act.unsnapImpulseSpeed && act.unsnapImpulseSpeed > 0) {
        const angRad = ((act.unsnapImpulseAngle ?? 0) * Math.PI) / 180;
        const speed = act.unsnapImpulseSpeed;
        const curState = entity.states[entity.currentStateId];
        const effBehaviors = getEffectiveBehaviors(entity, curState);
        const physicsCfg = effBehaviors.find((b) => b.type === 'physics') as
          | PhysicsBehaviorConfig
          | undefined;
        applyEntityImpulseAction(
          entity.id,
          Math.cos(angRad) * speed,
          Math.sin(angRad) * speed,
          'add',
          0,
          physicsCfg?.isStatic === true
        );
      }
    } else if (act.type === 'delete_entity') {
      helpers.deleteEntity(entity.id);
    }
  });
}
