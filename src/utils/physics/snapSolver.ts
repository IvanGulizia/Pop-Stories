import {
  Entity,
  EntityId,
  ParentOffset,
  Position,
  SnapAnchorPreset,
  SnapAttachBehavior,
  SnapBehaviorConfig,
  StateId,
} from '../../types';
import { computeRelativeParentOffset } from '../../store/parentingHelpers';
import { getEffectiveBehaviors } from './behaviorResolution';
import { getPivotWorldPosition, resolveEffectivePivot } from './pivotHelpers';

export interface SnapRuntimeEntry {
  isSnapped: boolean;
  snappedTargetId: string | null;
  attachBehavior: SnapAttachBehavior | null;
  cooldownRemaining: number;
  snappedAtPos?: Position;
  isApproaching?: boolean;
  isPulling?: boolean;
  prePullStateId?: StateId;
}

export interface SnapCandidateMatch {
  target: Entity;
  distance: number;
  goalTopLeft: Position;
  goalRotationDeg?: number;
  sourceAnchorWorld: Position;
  targetAnchorWorld: Position;
  desiredTargetPoint: Position;
}

export interface SnapStepInput {
  entity: Entity;
  config: SnapBehaviorConfig;
  runtime: SnapRuntimeEntry;
  allEntities: Record<EntityId, Entity>;
  dt: number;
  isDragging: boolean;
  justReleased: boolean;
  dragPos?: Position | null;
  currentRotationDeg?: number;
}

export interface SnapStepResult {
  nextRuntime: SnapRuntimeEntry;
  nextPosition?: Position;
  nextRotationDeg?: number;
  zeroVelocity: boolean;
  freezeStatic: boolean;
  snapEvent?: {
    phase: 'enter' | 'exit';
    targetEntityId?: string;
    eventPosition: Position;
  };
  parentMutation?: {
    childId: string;
    parentId: string | null;
    customOffset?: ParentOffset;
  };
  stateChange?: StateId;
  activeLink?: {
    from: Position;
    to: Position;
    snapped: boolean;
    targetId: string;
  };
  magnetPull?: {
    vxPxPerSec: number;
    vyPxPerSec: number;
    distance: number;
    magnetRadius: number;
    targetId: string;
    from: Position;
    to: Position;
  };
}

export function createInitialSnapRuntimeEntry(): SnapRuntimeEntry {
  return {
    isSnapped: false,
    snappedTargetId: null,
    attachBehavior: null,
    cooldownRemaining: 0,
    isApproaching: false,
    isPulling: false,
    prePullStateId: undefined,
  };
}

function getNormalizedPresetAnchor(anchor: SnapAnchorPreset = 'center'): Position {
  switch (anchor) {
    case 'top':
      return { x: 0.5, y: 0 };
    case 'bottom':
      return { x: 0.5, y: 1 };
    case 'left':
      return { x: 0, y: 0.5 };
    case 'right':
      return { x: 1, y: 0.5 };
    case 'top_left':
      return { x: 0, y: 0 };
    case 'top_right':
      return { x: 1, y: 0 };
    case 'bottom_left':
      return { x: 0, y: 1 };
    case 'bottom_right':
      return { x: 1, y: 1 };
    case 'center':
    default:
      return { x: 0.5, y: 0.5 };
  }
}

function rotateVec(x: number, y: number, deg: number): Position {
  if (!deg) return { x, y };
  const rad = (deg * Math.PI) / 180;
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return {
    x: x * c - y * s,
    y: x * s + y * c,
  };
}

export function resolveEntitySnapAnchorNorm(
  entity: Pick<
    Entity,
    'size' | 'states' | 'currentStateId' | 'pivot' | 'runtimePivot' | 'flipX' | 'parentId' | 'parentOffset'
  >,
  anchor: SnapAnchorPreset = 'center',
  customNorm?: Position
): Position {
  if (anchor === 'pivot') {
    const st = entity.states?.[entity.currentStateId];
    return resolveEffectivePivot(entity, st);
  }
  if (anchor === 'custom_canvas') {
    const rawX = typeof customNorm?.x === 'number' && Number.isFinite(customNorm.x) ? customNorm.x : 0.5;
    const rawY = typeof customNorm?.y === 'number' && Number.isFinite(customNorm.y) ? customNorm.y : 0.5;
    return {
      x: entity.flipX ? 1 - rawX : rawX,
      y: rawY,
    };
  }
  return getNormalizedPresetAnchor(anchor);
}

/**
 * Retourne la position monde d'un point d'ancre Snap sur une entité
 * en tenant compte du pivot effectif, de `flipX` et de la rotation.
 */
export function getSnapAnchorWorldPoint(
  entity: Pick<
    Entity,
    'position' | 'size' | 'states' | 'currentStateId' | 'pivot' | 'runtimePivot' | 'flipX' | 'parentId' | 'parentOffset'
  >,
  anchor: SnapAnchorPreset = 'center',
  customNorm?: Position,
  rotationOverrideDeg?: number
): Position {
  const st = entity.states?.[entity.currentStateId];
  const effPivot = resolveEffectivePivot(entity, st);
  const pivotWorld = getPivotWorldPosition(entity.position, entity.size, effPivot);
  const norm = resolveEntitySnapAnchorNorm(entity, anchor, customNorm);
  const dx = (norm.x - effPivot.x) * entity.size.width;
  const dy = (norm.y - effPivot.y) * entity.size.height;
  const rotDeg = rotationOverrideDeg ?? st?.rotation ?? 0;
  const rotated = rotateVec(dx, dy, rotDeg);
  return {
    x: pivotWorld.x + rotated.x,
    y: pivotWorld.y + rotated.y,
  };
}

/**
 * Compatibilité héritée : alias vers `getSnapAnchorWorldPoint` sans repère custom.
 */
export function getEntityAnchorPoint(
  entity: Pick<
    Entity,
    'position' | 'size' | 'states' | 'currentStateId' | 'pivot' | 'runtimePivot' | 'flipX' | 'parentId' | 'parentOffset'
  >,
  anchor: SnapAnchorPreset = 'center',
  rotationOverrideDeg?: number,
  customNorm?: Position
): Position {
  return getSnapAnchorWorldPoint(entity, anchor, customNorm, rotationOverrideDeg);
}

/**
 * Convertit un point monde cliqué/glissé sur le canvas en coordonnées normalisées brutes
 * (avant `flipX`) relatives à une entité donnée, pour les repères custom Snap.
 */
export function computeSnapCustomAnchorFromWorld(
  entity: Pick<
    Entity,
    'position' | 'size' | 'states' | 'currentStateId' | 'pivot' | 'runtimePivot' | 'flipX' | 'parentId' | 'parentOffset'
  >,
  worldPt: Position
): Position {
  const st = entity.states?.[entity.currentStateId];
  const effPivot = resolveEffectivePivot(entity, st);
  const pivotWorld = getPivotWorldPosition(entity.position, entity.size, effPivot);
  const rotDeg = st?.rotation ?? 0;
  const unrot = rotateVec(worldPt.x - pivotWorld.x, worldPt.y - pivotWorld.y, -rotDeg);
  const safeW = Math.max(1, entity.size.width);
  const safeH = Math.max(1, entity.size.height);
  const effU = effPivot.x + unrot.x / safeW;
  const effV = effPivot.y + unrot.y / safeH;
  const rawX = entity.flipX ? 1 - effU : effU;
  return {
    x: Math.round(rawX * 1000) / 1000,
    y: Math.round(effV * 1000) / 1000,
  };
}

export function isSnapParentAttachBehavior(attachBehavior?: SnapAttachBehavior | null): boolean {
  return (
    attachBehavior === 'parent_rigid' ||
    attachBehavior === 'parent_spring' ||
    attachBehavior === 'parent_physics_joint'
  );
}

export function buildSnapParentOffset(params: {
  alignedChild: Entity;
  target: Entity;
  config: SnapBehaviorConfig;
  attachBehavior: SnapAttachBehavior;
}): ParentOffset {
  const { alignedChild, target, config, attachBehavior } = params;

  if (attachBehavior === 'parent_physics_joint') {
    const jc = config.jointConfig || {};
    let derivedJointChildPivot = jc.jointChildPivot;
    if (!derivedJointChildPivot && config.snapAlignment === 'anchor_offset') {
      const srcAnchor = config.sourceAnchor || 'center';
      if (srcAnchor === 'custom_canvas') {
        derivedJointChildPivot = config.customSourceAnchor
          ? { x: config.customSourceAnchor.x, y: config.customSourceAnchor.y }
          : { x: 0.5, y: 0.5 };
      } else if (srcAnchor !== 'pivot') {
        derivedJointChildPivot = getNormalizedPresetAnchor(srcAnchor);
      }
    }

    const baseSeed: ParentOffset = {
      x: 0,
      y: 0,
      ...jc,
      ...(derivedJointChildPivot ? { jointChildPivot: derivedJointChildPivot } : {}),
      attachmentMode: 'physics_joint',
      inheritRotation: Boolean(config.matchTargetRotation),
      rotationOffset: config.rotationOffset ?? 0,
      collideWithWorld: jc.collideWithWorld !== undefined ? jc.collideWithWorld : true,
    };

    const childWithPivot = derivedJointChildPivot
      ? {
          ...alignedChild,
          parentOffset: {
            ...(alignedChild.parentOffset || { x: 0, y: 0 }),
            jointChildPivot: derivedJointChildPivot,
          },
        }
      : alignedChild;

    return computeRelativeParentOffset(childWithPivot, target, baseSeed);
  }

  return computeRelativeParentOffset(alignedChild, target, {
    x: 0,
    y: 0,
    attachmentMode: attachBehavior === 'parent_spring' ? 'spring' : 'rigid',
    inheritRotation: Boolean(config.matchTargetRotation),
    rotationOffset: config.rotationOffset ?? 0,
    springStiffness: config.springStiffness ?? 0.25,
    springDamping: config.springDamping ?? 0.18,
  });
}

function solveTopLeftForAlignedAnchor(params: {
  entity: Entity;
  srcAnchor: SnapAnchorPreset;
  customSourceAnchor?: Position;
  desiredTargetPoint: Position;
  goalRotationDeg: number;
}): Position {
  const { entity, srcAnchor, customSourceAnchor, desiredTargetPoint, goalRotationDeg } = params;
  const st = entity.states?.[entity.currentStateId];
  const effPivot = resolveEffectivePivot(entity, st);
  const srcNorm = resolveEntitySnapAnchorNorm(entity, srcAnchor, customSourceAnchor);
  const dx = (srcNorm.x - effPivot.x) * entity.size.width;
  const dy = (srcNorm.y - effPivot.y) * entity.size.height;
  const rotatedLocalFromPivot = rotateVec(dx, dy, goalRotationDeg);
  const goalPivotWorldX = desiredTargetPoint.x - rotatedLocalFromPivot.x;
  const goalPivotWorldY = desiredTargetPoint.y - rotatedLocalFromPivot.y;
  return {
    x: Math.round((goalPivotWorldX - effPivot.x * entity.size.width) * 100) / 100,
    y: Math.round((goalPivotWorldY - effPivot.y * entity.size.height) * 100) / 100,
  };
}

export function computeSnapGoalForTarget(
  entity: Entity,
  target: Entity,
  config: SnapBehaviorConfig,
  currentEntityRotDeg?: number,
  currentTargetRotDeg?: number
): {
  goalTopLeft: Position;
  goalRotationDeg?: number;
  sourceAnchorWorld: Position;
  targetAnchorWorld: Position;
  desiredTargetPoint: Position;
  metricDistance: number;
} {
  const targetRot = currentTargetRotDeg ?? target.states[target.currentStateId]?.rotation ?? 0;
  const entityRot = currentEntityRotDeg ?? entity.states[entity.currentStateId]?.rotation ?? 0;
  const goalRotationDeg = config.matchTargetRotation
    ? targetRot + (config.rotationOffset ?? 0)
    : undefined;
  const effectiveGoalRot = goalRotationDeg ?? entityRot;

  const entCx = entity.position.x + entity.size.width / 2;
  const entCy = entity.position.y + entity.size.height / 2;
  const tarCx = target.position.x + target.size.width / 2;
  const tarCy = target.position.y + target.size.height / 2;
  const rawOffX = config.offsetX ?? 0;
  const rawOffY = config.offsetY ?? 0;
  const rotatedOffset = config.matchTargetRotation
    ? rotateVec(rawOffX, rawOffY, targetRot)
    : { x: rawOffX, y: rawOffY };

  const alignment = config.snapAlignment || 'center';

  if (alignment === 'anchor_offset') {
    const srcAnchor: SnapAnchorPreset = config.sourceAnchor || 'center';
    const tarAnchor: SnapAnchorPreset = config.targetAnchor || 'center';
    const sourceAnchorWorld = getSnapAnchorWorldPoint(
      entity,
      srcAnchor,
      config.customSourceAnchor,
      entityRot
    );
    const targetAnchorWorld = getSnapAnchorWorldPoint(
      target,
      tarAnchor,
      config.customTargetAnchor,
      targetRot
    );
    const desiredTargetPoint = {
      x: targetAnchorWorld.x + rotatedOffset.x,
      y: targetAnchorWorld.y + rotatedOffset.y,
    };
    const goalTopLeft = solveTopLeftForAlignedAnchor({
      entity,
      srcAnchor,
      customSourceAnchor: config.customSourceAnchor,
      desiredTargetPoint,
      goalRotationDeg: effectiveGoalRot,
    });
    const metricDistance = Math.hypot(
      sourceAnchorWorld.x - desiredTargetPoint.x,
      sourceAnchorWorld.y - desiredTargetPoint.y
    );
    return {
      goalTopLeft,
      goalRotationDeg,
      sourceAnchorWorld,
      targetAnchorWorld,
      desiredTargetPoint,
      metricDistance,
    };
  }

  if (alignment === 'edge_closest') {
    const dx = entCx - tarCx;
    const dy = entCy - tarCy;
    const sumHalfW = Math.max(1, (entity.size.width + target.size.width) / 2);
    const sumHalfH = Math.max(1, (entity.size.height + target.size.height) / 2);
    const nx = dx / sumHalfW;
    const ny = dy / sumHalfH;

    let srcAnchor: SnapAnchorPreset = 'left';
    let tarAnchor: SnapAnchorPreset = 'right';
    if (Math.abs(nx) >= Math.abs(ny)) {
      if (dx >= 0) {
        srcAnchor = 'left';
        tarAnchor = 'right';
      } else {
        srcAnchor = 'right';
        tarAnchor = 'left';
      }
    } else if (dy >= 0) {
      srcAnchor = 'top';
      tarAnchor = 'bottom';
    } else {
      srcAnchor = 'bottom';
      tarAnchor = 'top';
    }

    const sourceAnchorWorld = getSnapAnchorWorldPoint(entity, srcAnchor, undefined, entityRot);
    const targetAnchorWorld = getSnapAnchorWorldPoint(target, tarAnchor, undefined, targetRot);
    const desiredTargetPoint = {
      x: targetAnchorWorld.x + rotatedOffset.x,
      y: targetAnchorWorld.y + rotatedOffset.y,
    };
    const goalTopLeft = solveTopLeftForAlignedAnchor({
      entity,
      srcAnchor,
      desiredTargetPoint,
      goalRotationDeg: effectiveGoalRot,
    });
    const metricDistance = Math.hypot(
      sourceAnchorWorld.x - desiredTargetPoint.x,
      sourceAnchorWorld.y - desiredTargetPoint.y
    );
    return {
      goalTopLeft,
      goalRotationDeg,
      sourceAnchorWorld,
      targetAnchorWorld,
      desiredTargetPoint,
      metricDistance,
    };
  }

  // 'center'
  const desiredTargetPoint = {
    x: tarCx + rotatedOffset.x,
    y: tarCy + rotatedOffset.y,
  };
  const metricDistance = Math.hypot(entCx - desiredTargetPoint.x, entCy - desiredTargetPoint.y);
  return {
    goalTopLeft: {
      x: Math.round((desiredTargetPoint.x - entity.size.width / 2) * 100) / 100,
      y: Math.round((desiredTargetPoint.y - entity.size.height / 2) * 100) / 100,
    },
    goalRotationDeg,
    sourceAnchorWorld: { x: entCx, y: entCy },
    targetAnchorWorld: { x: tarCx, y: tarCy },
    desiredTargetPoint,
    metricDistance,
  };
}

export function matchesSnapFilter(
  subjectId: string,
  candidate: Entity,
  config: SnapBehaviorConfig
): boolean {
  if (!candidate || candidate.id === subjectId) return false;
  if (candidate.disabled || candidate.visible === false) return false;
  // Prevent parent cycle (do not snap onto an entity whose parent is this subject)
  if (candidate.parentId === subjectId) return false;

  const targetType = config.targetType || 'any';
  if (targetType === 'any') return true;
  if (targetType === 'entity') {
    return Boolean(config.targetEntityId && candidate.id === config.targetEntityId);
  }
  if (targetType === 'type') {
    return Boolean(config.targetEntityType && candidate.type === config.targetEntityType);
  }
  if (targetType === 'tag') {
    const clean = (config.targetTag || '').trim().replace(/^#/, '').toLowerCase();
    if (!clean) return false;
    return (candidate.tags || []).some(
      (t) => t.trim().replace(/^#/, '').toLowerCase() === clean
    );
  }
  return false;
}

export function findSnapCandidateWithinRadius(
  entity: Entity,
  allEntities: Record<EntityId, Entity>,
  config: SnapBehaviorConfig,
  searchRadius: number,
  positionOverride?: Position | null,
  currentEntityRotDeg?: number
): SnapCandidateMatch | null {
  const radius = Math.max(4, Number.isFinite(searchRadius) ? searchRadius : 48);
  const probeEntity: Entity = positionOverride
    ? { ...entity, position: positionOverride }
    : entity;

  let best: SnapCandidateMatch | null = null;
  for (const candidate of Object.values(allEntities)) {
    if (!matchesSnapFilter(entity.id, candidate, config)) continue;
    const goal = computeSnapGoalForTarget(
      probeEntity,
      candidate,
      config,
      currentEntityRotDeg
    );
    if (goal.metricDistance <= radius) {
      if (!best || goal.metricDistance < best.distance) {
        best = {
          target: candidate,
          distance: goal.metricDistance,
          goalTopLeft: goal.goalTopLeft,
          goalRotationDeg: goal.goalRotationDeg,
          sourceAnchorWorld: goal.sourceAnchorWorld,
          targetAnchorWorld: goal.targetAnchorWorld,
          desiredTargetPoint: goal.desiredTargetPoint,
        };
      }
    }
  }
  return best;
}

export function findBestSnapCandidate(
  entity: Entity,
  allEntities: Record<EntityId, Entity>,
  config: SnapBehaviorConfig,
  positionOverride?: Position | null,
  currentEntityRotDeg?: number
): SnapCandidateMatch | null {
  const radius = Math.max(4, Number.isFinite(config.snapRadius) ? config.snapRadius : 48);
  return findSnapCandidateWithinRadius(
    entity,
    allEntities,
    config,
    radius,
    positionOverride,
    currentEntityRotDeg
  );
}

export function stepSnapSolver(input: SnapStepInput): SnapStepResult {
  const {
    entity,
    config,
    runtime,
    allEntities,
    dt,
    isDragging,
    justReleased,
    dragPos,
    currentRotationDeg,
  } = input;

  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const nextRuntime: SnapRuntimeEntry = {
    ...runtime,
    cooldownRemaining: Math.max(0, (runtime.cooldownRemaining || 0) - safeDt),
  };

  const attachBehavior: SnapAttachBehavior = config.attachBehavior || 'position_only';
  const radius = Math.max(4, Number.isFinite(config.snapRadius) ? config.snapRadius : 48);
  const unsnapDist = Math.max(
    radius + 8,
    Number.isFinite(config.unsnapDistance as number) ? (config.unsnapDistance as number) : Math.round(radius * 1.5)
  );
  const allowPullUnsnap = config.allowPullUnsnap !== false;
  const cooldownSec = Math.max(0, Number.isFinite(config.reSnapCooldownSec as number) ? (config.reSnapCooldownSec as number) : 0.35);

  const probePos = dragPos || entity.position;
  const probeEntity: Entity = probePos === entity.position ? entity : { ...entity, position: probePos };

  // 1. Si déjà snappé : vérifier que la cible existe toujours & gérer l'arrachement (pull-unsnap)
  if (nextRuntime.isSnapped && nextRuntime.snappedTargetId) {
    nextRuntime.isApproaching = false;
    const snappedTarget = allEntities[nextRuntime.snappedTargetId];
    if (!snappedTarget || snappedTarget.disabled || snappedTarget.visible === false) {
      const wasParented =
        entity.parentId === nextRuntime.snappedTargetId ||
        isSnapParentAttachBehavior(nextRuntime.attachBehavior);
      const oldTargetId = nextRuntime.snappedTargetId;
      nextRuntime.isSnapped = false;
      nextRuntime.snappedTargetId = null;
      nextRuntime.attachBehavior = null;
      nextRuntime.cooldownRemaining = cooldownSec;
      return {
        nextRuntime,
        zeroVelocity: false,
        freezeStatic: false,
        parentMutation: wasParented ? { childId: entity.id, parentId: null } : undefined,
        snapEvent: {
          phase: 'exit',
          targetEntityId: oldTargetId,
          eventPosition: {
            x: Math.round(entity.position.x + entity.size.width / 2),
            y: Math.round(entity.position.y + entity.size.height / 2),
          },
        },
        stateChange:
          config.unsnappedStateId && entity.states[config.unsnappedStateId]
            ? config.unsnappedStateId
            : undefined,
      };
    }

    const goal = computeSnapGoalForTarget(probeEntity, snappedTarget, config, currentRotationDeg);

    const pullDist =
      isDragging && dragPos
        ? Math.hypot(dragPos.x - goal.goalTopLeft.x, dragPos.y - goal.goalTopLeft.y)
        : 0;

    // Pull-to-unsnap si on tire l'entité au-delà de la distance d'arrachement
    if (isDragging && allowPullUnsnap && dragPos && pullDist > unsnapDist) {
      const wasParented =
        entity.parentId === snappedTarget.id ||
        isSnapParentAttachBehavior(nextRuntime.attachBehavior);
      const prevBeforePull = nextRuntime.prePullStateId;
      nextRuntime.isSnapped = false;
      nextRuntime.snappedTargetId = null;
      nextRuntime.attachBehavior = null;
      nextRuntime.cooldownRemaining = cooldownSec;
      nextRuntime.isPulling = false;
      nextRuntime.prePullStateId = undefined;
      return {
        nextRuntime,
        nextPosition: dragPos,
        zeroVelocity: true,
        freezeStatic: false,
        parentMutation: wasParented ? { childId: entity.id, parentId: null } : undefined,
        snapEvent: {
          phase: 'exit',
          targetEntityId: snappedTarget.id,
          eventPosition: {
            x: Math.round(dragPos.x + entity.size.width / 2),
            y: Math.round(dragPos.y + entity.size.height / 2),
          },
        },
        stateChange:
          config.unsnappedStateId && entity.states[config.unsnappedStateId]
            ? config.unsnappedStateId
            : prevBeforePull && entity.states[prevBeforePull]
            ? prevBeforePull
            : undefined,
      };
    }

    // Hystérésis d'état en traction / résistance pendant que l'objet est encore attaché
    let pullStateChange: StateId | undefined;
    const wasPulling = Boolean(nextRuntime.isPulling);
    if (!wasPulling && isDragging && dragPos && pullDist > 6) {
      nextRuntime.isPulling = true;
      nextRuntime.prePullStateId = entity.currentStateId;
      if (config.pullingStateId && entity.states[config.pullingStateId]) {
        pullStateChange = config.pullingStateId;
      }
    } else if (wasPulling && (!isDragging || !dragPos || pullDist <= 2)) {
      nextRuntime.isPulling = false;
      const restoreTarget =
        config.snappedStateId && entity.states[config.snappedStateId]
          ? config.snappedStateId
          : nextRuntime.prePullStateId && entity.states[nextRuntime.prePullStateId]
          ? nextRuntime.prePullStateId
          : undefined;
      if (restoreTarget && restoreTarget !== entity.currentStateId) {
        pullStateChange = restoreTarget;
      }
      nextRuntime.prePullStateId = undefined;
    }

    // Maintien du snap actif
    const isParentMode = isSnapParentAttachBehavior(attachBehavior);
    const isFreezeMode = attachBehavior === 'freeze_physics';
    const isPosOnlyMode = attachBehavior === 'position_only';

    let nextPosition: Position | undefined;
    let nextRotationDeg: number | undefined;
    let parentMutation: SnapStepResult['parentMutation'];

    if (isParentMode) {
      if (entity.parentId !== snappedTarget.id) {
        const alignedChild = { ...entity, position: goal.goalTopLeft };
        const computed = buildSnapParentOffset({
          alignedChild,
          target: snappedTarget,
          config,
          attachBehavior,
        });
        nextPosition = goal.goalTopLeft;
        nextRotationDeg = goal.goalRotationDeg;
        parentMutation = {
          childId: entity.id,
          parentId: snappedTarget.id,
          customOffset: computed,
        };
      }
    } else if (!isDragging) {
      const distToGoal = Math.hypot(
        entity.position.x - goal.goalTopLeft.x,
        entity.position.y - goal.goalTopLeft.y
      );
      if (config.snapMode === 'magnetic_smooth' && distToGoal > 1.2) {
        const smooth = Math.max(0.05, Math.min(1, config.smoothSpeed ?? 0.3));
        const alpha = 1 - Math.exp(-(8 + smooth * 42) * safeDt);
        nextPosition = {
          x: Math.round((entity.position.x + (goal.goalTopLeft.x - entity.position.x) * alpha) * 100) / 100,
          y: Math.round((entity.position.y + (goal.goalTopLeft.y - entity.position.y) * alpha) * 100) / 100,
        };
      } else if (distToGoal > 0.2 || isPosOnlyMode || isFreezeMode) {
        nextPosition = goal.goalTopLeft;
      }
      if (goal.goalRotationDeg !== undefined) {
        nextRotationDeg = goal.goalRotationDeg;
      }
    }

    return {
      nextRuntime,
      nextPosition,
      nextRotationDeg,
      zeroVelocity: isFreezeMode || isPosOnlyMode,
      freezeStatic: isFreezeMode,
      parentMutation,
      ...(pullStateChange ? { stateChange: pullStateChange } : {}),
      activeLink: {
        from: goal.sourceAnchorWorld,
        to: goal.targetAnchorWorld,
        snapped: true,
        targetId: snappedTarget.id,
      },
    };
  }

  // 2. Non snappé : vérifier champ d'attraction magnétique & portée de snap
  const magnetEnabled = Boolean(config.magnetEnabled);
  const magnetRadius = Math.max(radius, Number.isFinite(config.magnetRadius as number) ? (config.magnetRadius as number) : 120);
  const magnetForce = Math.max(0, Number.isFinite(config.magnetForce as number) ? (config.magnetForce as number) : 260);

  const candidate = findBestSnapCandidate(
    probeEntity,
    allEntities,
    config,
    probePos,
    currentRotationDeg
  );

  const magnetCandidate =
    magnetEnabled && nextRuntime.cooldownRemaining <= 0
      ? candidate ||
        findSnapCandidateWithinRadius(
          probeEntity,
          allEntities,
          config,
          magnetRadius,
          probePos,
          currentRotationDeg
        )
      : candidate;

  const isApproachingNow = Boolean(magnetCandidate);
  let approachStateChange: StateId | undefined;
  if (
    isApproachingNow &&
    !runtime.isApproaching &&
    config.approachingStateId &&
    entity.states[config.approachingStateId]
  ) {
    approachStateChange = config.approachingStateId;
  }
  nextRuntime.isApproaching = isApproachingNow;

  let magnetPull: SnapStepResult['magnetPull'];
  if (
    magnetEnabled &&
    magnetCandidate &&
    !isDragging &&
    nextRuntime.cooldownRemaining <= 0 &&
    magnetForce > 0
  ) {
    const dx = magnetCandidate.goalTopLeft.x - entity.position.x;
    const dy = magnetCandidate.goalTopLeft.y - entity.position.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.5) {
      const falloff = 0.4 + 0.6 * Math.max(0, 1 - magnetCandidate.distance / Math.max(1, magnetRadius));
      const speedPx = magnetForce * falloff;
      magnetPull = {
        vxPxPerSec: (dx / d) * speedPx,
        vyPxPerSec: (dy / d) * speedPx,
        distance: magnetCandidate.distance,
        magnetRadius,
        targetId: magnetCandidate.target.id,
        from: magnetCandidate.sourceAnchorWorld,
        to: magnetCandidate.targetAnchorWorld,
      };
    }
  }

  if (!candidate) {
    return {
      nextRuntime,
      zeroVelocity: false,
      freezeStatic: false,
      stateChange: approachStateChange,
      ...(magnetCandidate
        ? {
            activeLink: {
              from: magnetCandidate.sourceAnchorWorld,
              to: magnetCandidate.targetAnchorWorld,
              snapped: false,
              targetId: magnetCandidate.target.id,
            },
          }
        : {}),
      ...(magnetPull ? { magnetPull } : {}),
    };
  }

  const triggerMode = config.snapTrigger || 'on_release';
  const canTriggerNow =
    nextRuntime.cooldownRemaining <= 0 &&
    (triggerMode === 'always_when_near' || (triggerMode === 'on_release' && justReleased));

  if (!canTriggerNow) {
    return {
      nextRuntime,
      zeroVelocity: false,
      freezeStatic: false,
      stateChange: approachStateChange,
      activeLink: {
        from: candidate.sourceAnchorWorld,
        to: candidate.targetAnchorWorld,
        snapped: false,
        targetId: candidate.target.id,
      },
      ...(magnetPull ? { magnetPull } : {}),
    };
  }

  // Déclenchement d'un nouveau snap !
  nextRuntime.isSnapped = true;
  nextRuntime.isApproaching = false;
  nextRuntime.snappedTargetId = candidate.target.id;
  nextRuntime.attachBehavior = attachBehavior;
  nextRuntime.snappedAtPos = candidate.goalTopLeft;

  const isParentMode = isSnapParentAttachBehavior(attachBehavior);
  const isFreezeMode = attachBehavior === 'freeze_physics';

  let nextPosition: Position = candidate.goalTopLeft;
  if (config.snapMode === 'magnetic_smooth' && !isParentMode) {
    const smooth = Math.max(0.05, Math.min(1, config.smoothSpeed ?? 0.3));
    const alpha = 1 - Math.exp(-(8 + smooth * 42) * safeDt);
    nextPosition = {
      x: Math.round((probeEntity.position.x + (candidate.goalTopLeft.x - probeEntity.position.x) * alpha) * 100) / 100,
      y: Math.round((probeEntity.position.y + (candidate.goalTopLeft.y - probeEntity.position.y) * alpha) * 100) / 100,
    };
  }

  let parentMutation: SnapStepResult['parentMutation'];
  if (isParentMode && entity.parentId !== candidate.target.id) {
    const alignedChild = { ...entity, position: candidate.goalTopLeft };
    const computed = buildSnapParentOffset({
      alignedChild,
      target: candidate.target,
      config,
      attachBehavior,
    });
    parentMutation = {
      childId: entity.id,
      parentId: candidate.target.id,
      customOffset: computed,
    };
  }

  return {
    nextRuntime,
    nextPosition,
    nextRotationDeg: candidate.goalRotationDeg,
    zeroVelocity: true,
    freezeStatic: isFreezeMode,
    parentMutation,
    snapEvent: {
      phase: 'enter',
      targetEntityId: candidate.target.id,
      eventPosition: {
        x: Math.round(candidate.targetAnchorWorld.x),
        y: Math.round(candidate.targetAnchorWorld.y),
      },
    },
    stateChange:
      config.snappedStateId && entity.states[config.snappedStateId]
        ? config.snappedStateId
        : undefined,
    activeLink: {
      from: candidate.targetAnchorWorld,
      to: candidate.targetAnchorWorld,
      snapped: true,
      targetId: candidate.target.id,
    },
  };
}

/**
 * Calcule le décalage visuel élastique d'attraction magnétique ressenti en temps réel
 * pendant le drag manuel d'une entité non encore snappée (objet aimanté ou proche d'un réceptacle).
 */
export function computeDraggedSnapMagneticOffset(params: {
  entity: Entity;
  rawPos: Position;
  allEntities: Record<EntityId, Entity>;
  snapRuntimeStates?: Map<string, SnapRuntimeEntry>;
}): Position {
  const { entity, rawPos, allEntities, snapRuntimeStates } = params;
  if (!entity || entity.disabled || entity.visible === false) {
    return { x: 0, y: 0 };
  }
  const rt = snapRuntimeStates?.get(entity.id);
  if (rt?.isSnapped || (rt && rt.cooldownRemaining > 0)) {
    return { x: 0, y: 0 };
  }

  const probeEntity: Entity = { ...entity, position: rawPos };
  let bestPull: {
    distance: number;
    goalTopLeft: Position;
    magnetRadius: number;
    magnetForce: number;
  } | null = null;

  // 1) Vérifier le comportement Snap propre à l'entité draguée
  const selfState = entity.states?.[entity.currentStateId];
  const selfBehaviors = getEffectiveBehaviors(entity, selfState);
  const selfSnap = selfBehaviors.find((b) => b.type === 'snap') as SnapBehaviorConfig | undefined;
  if (
    selfSnap &&
    selfSnap.enabled !== false &&
    selfSnap.snapRole !== 'receptacle' &&
    selfSnap.magnetEnabled
  ) {
    const baseRadius = Math.max(4, Number.isFinite(selfSnap.snapRadius) ? selfSnap.snapRadius : 48);
    const magnetRadius = Math.max(
      baseRadius,
      Number.isFinite(selfSnap.magnetRadius as number) ? (selfSnap.magnetRadius as number) : 120
    );
    const magnetForce = Math.max(
      0,
      Number.isFinite(selfSnap.magnetForce as number) ? (selfSnap.magnetForce as number) : 260
    );
    if (magnetForce > 0) {
      const cand = findSnapCandidateWithinRadius(
        probeEntity,
        allEntities,
        selfSnap,
        magnetRadius,
        rawPos
      );
      if (cand) {
        bestPull = {
          distance: cand.distance,
          goalTopLeft: cand.goalTopLeft,
          magnetRadius,
          magnetForce,
        };
      }
    }
  }

  // 2) Vérifier les réceptacles (socles) présents sur la scène
  for (const rec of Object.values(allEntities)) {
    if (!rec || rec.id === entity.id || rec.disabled || rec.visible === false) continue;
    if (rec.parentId === entity.id) continue;
    const recState = rec.states?.[rec.currentStateId];
    const recBehaviors = getEffectiveBehaviors(rec, recState);
    const recSnap = recBehaviors.find((b) => b.type === 'snap') as SnapBehaviorConfig | undefined;
    if (
      !recSnap ||
      recSnap.enabled === false ||
      recSnap.snapRole !== 'receptacle' ||
      !recSnap.magnetEnabled
    ) {
      continue;
    }
    if (!matchesSnapFilter(rec.id, probeEntity, recSnap)) continue;

    // Respecter la capacité max du réceptacle
    const maxCap = Math.max(1, Math.round(recSnap.maxCapacity ?? 1));
    if (snapRuntimeStates) {
      let occupied = 0;
      for (const entry of snapRuntimeStates.values()) {
        if (entry.isSnapped && entry.snappedTargetId === rec.id) {
          occupied += 1;
        }
      }
      if (occupied >= maxCap) continue;
    }

    const baseRadius = Math.max(4, Number.isFinite(recSnap.snapRadius) ? recSnap.snapRadius : 48);
    const magnetRadius = Math.max(
      baseRadius,
      Number.isFinite(recSnap.magnetRadius as number) ? (recSnap.magnetRadius as number) : 120
    );
    const magnetForce = Math.max(
      0,
      Number.isFinite(recSnap.magnetForce as number) ? (recSnap.magnetForce as number) : 260
    );
    if (magnetForce <= 0) continue;

    const candConfig: SnapBehaviorConfig = {
      ...recSnap,
      snapRole: 'magnet_object',
      targetType: 'entity',
      targetEntityId: rec.id,
      sourceAnchor: recSnap.targetAnchor || 'center',
      customSourceAnchor: recSnap.customTargetAnchor,
      targetAnchor: recSnap.sourceAnchor || 'center',
      customTargetAnchor: recSnap.customSourceAnchor,
    };
    const goal = computeSnapGoalForTarget(probeEntity, rec, candConfig);
    if (goal.metricDistance <= magnetRadius) {
      if (!bestPull || goal.metricDistance < bestPull.distance) {
        bestPull = {
          distance: goal.metricDistance,
          goalTopLeft: goal.goalTopLeft,
          magnetRadius,
          magnetForce,
        };
      }
    }
  }

  if (!bestPull) {
    return { x: 0, y: 0 };
  }

  const t = Math.max(0, Math.min(1, 1 - bestPull.distance / Math.max(1, bestPull.magnetRadius)));
  const smoothT = t * t * (3 - 2 * t);
  const forceScale = Math.min(
    0.82,
    Math.max(0.18, 0.25 + 0.42 * Math.min(1.5, bestPull.magnetForce / 260))
  );
  const pullRatio = smoothT * forceScale;
  return {
    x: Math.round((bestPull.goalTopLeft.x - rawPos.x) * pullRatio * 100) / 100,
    y: Math.round((bestPull.goalTopLeft.y - rawPos.y) * pullRatio * 100) / 100,
  };
}

