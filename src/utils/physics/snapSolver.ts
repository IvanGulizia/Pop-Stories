import {
  Entity,
  EntityId,
  ParentOffset,
  ParticleAnchorPreset,
  Position,
  SnapAttachBehavior,
  SnapBehaviorConfig,
  StateId,
} from '../../types';
import { computeRelativeParentOffset } from '../../store/parentingHelpers';

export interface SnapRuntimeEntry {
  isSnapped: boolean;
  snappedTargetId: string | null;
  attachBehavior: SnapAttachBehavior | null;
  cooldownRemaining: number;
  snappedAtPos?: Position;
}

export interface SnapCandidateMatch {
  target: Entity;
  distance: number;
  goalTopLeft: Position;
  goalRotationDeg?: number;
  sourceAnchorWorld: Position;
  targetAnchorWorld: Position;
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
}

export function createInitialSnapRuntimeEntry(): SnapRuntimeEntry {
  return {
    isSnapped: false,
    snappedTargetId: null,
    attachBehavior: null,
    cooldownRemaining: 0,
  };
}

function getLocalAnchorOffset(size: { width: number; height: number }, anchor: ParticleAnchorPreset = 'center'): Position {
  const hw = size.width / 2;
  const hh = size.height / 2;
  switch (anchor) {
    case 'top':
      return { x: 0, y: -hh };
    case 'bottom':
      return { x: 0, y: hh };
    case 'left':
      return { x: -hw, y: 0 };
    case 'right':
      return { x: hw, y: 0 };
    case 'top_left':
      return { x: -hw, y: -hh };
    case 'top_right':
      return { x: hw, y: -hh };
    case 'bottom_left':
      return { x: -hw, y: hh };
    case 'bottom_right':
      return { x: hw, y: hh };
    case 'center':
    default:
      return { x: 0, y: 0 };
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

export function getEntityAnchorPoint(
  entity: Pick<Entity, 'position' | 'size' | 'states' | 'currentStateId'>,
  anchor: ParticleAnchorPreset = 'center',
  rotationOverrideDeg?: number
): Position {
  const cx = entity.position.x + entity.size.width / 2;
  const cy = entity.position.y + entity.size.height / 2;
  const local = getLocalAnchorOffset(entity.size, anchor);
  const rotDeg = rotationOverrideDeg ?? entity.states[entity.currentStateId]?.rotation ?? 0;
  const rotated = rotateVec(local.x, local.y, rotDeg);
  return {
    x: cx + rotated.x,
    y: cy + rotated.y,
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
    const srcAnchor = config.sourceAnchor || 'center';
    const tarAnchor = config.targetAnchor || 'center';
    const sourceAnchorWorld = getEntityAnchorPoint(entity, srcAnchor, entityRot);
    const targetAnchorWorld = getEntityAnchorPoint(target, tarAnchor, targetRot);
    const desiredTargetPoint = {
      x: targetAnchorWorld.x + rotatedOffset.x,
      y: targetAnchorWorld.y + rotatedOffset.y,
    };
    const srcLocalAtGoal = rotateVec(
      getLocalAnchorOffset(entity.size, srcAnchor).x,
      getLocalAnchorOffset(entity.size, srcAnchor).y,
      effectiveGoalRot
    );
    const goalCenterX = desiredTargetPoint.x - srcLocalAtGoal.x;
    const goalCenterY = desiredTargetPoint.y - srcLocalAtGoal.y;
    const metricDistance = Math.hypot(
      sourceAnchorWorld.x - desiredTargetPoint.x,
      sourceAnchorWorld.y - desiredTargetPoint.y
    );
    return {
      goalTopLeft: {
        x: Math.round((goalCenterX - entity.size.width / 2) * 100) / 100,
        y: Math.round((goalCenterY - entity.size.height / 2) * 100) / 100,
      },
      goalRotationDeg,
      sourceAnchorWorld,
      targetAnchorWorld,
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

    let srcAnchor: ParticleAnchorPreset = 'left';
    let tarAnchor: ParticleAnchorPreset = 'right';
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

    const sourceAnchorWorld = getEntityAnchorPoint(entity, srcAnchor, entityRot);
    const targetAnchorWorld = getEntityAnchorPoint(target, tarAnchor, targetRot);
    const desiredTargetPoint = {
      x: targetAnchorWorld.x + rotatedOffset.x,
      y: targetAnchorWorld.y + rotatedOffset.y,
    };
    const srcLocalAtGoal = rotateVec(
      getLocalAnchorOffset(entity.size, srcAnchor).x,
      getLocalAnchorOffset(entity.size, srcAnchor).y,
      effectiveGoalRot
    );
    const goalCenterX = desiredTargetPoint.x - srcLocalAtGoal.x;
    const goalCenterY = desiredTargetPoint.y - srcLocalAtGoal.y;
    const metricDistance = Math.hypot(
      sourceAnchorWorld.x - desiredTargetPoint.x,
      sourceAnchorWorld.y - desiredTargetPoint.y
    );
    return {
      goalTopLeft: {
        x: Math.round((goalCenterX - entity.size.width / 2) * 100) / 100,
        y: Math.round((goalCenterY - entity.size.height / 2) * 100) / 100,
      },
      goalRotationDeg,
      sourceAnchorWorld,
      targetAnchorWorld,
      metricDistance,
    };
  }

  // 'center'
  const desiredCenter = {
    x: tarCx + rotatedOffset.x,
    y: tarCy + rotatedOffset.y,
  };
  const metricDistance = Math.hypot(entCx - desiredCenter.x, entCy - desiredCenter.y);
  return {
    goalTopLeft: {
      x: Math.round((desiredCenter.x - entity.size.width / 2) * 100) / 100,
      y: Math.round((desiredCenter.y - entity.size.height / 2) * 100) / 100,
    },
    goalRotationDeg,
    sourceAnchorWorld: { x: entCx, y: entCy },
    targetAnchorWorld: { x: tarCx, y: tarCy },
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

export function findBestSnapCandidate(
  entity: Entity,
  allEntities: Record<EntityId, Entity>,
  config: SnapBehaviorConfig,
  positionOverride?: Position | null,
  currentEntityRotDeg?: number
): SnapCandidateMatch | null {
  const radius = Math.max(4, Number.isFinite(config.snapRadius) ? config.snapRadius : 48);
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
        };
      }
    }
  }
  return best;
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
    const snappedTarget = allEntities[nextRuntime.snappedTargetId];
    if (!snappedTarget || snappedTarget.disabled || snappedTarget.visible === false) {
      const wasParented =
        entity.parentId === nextRuntime.snappedTargetId ||
        nextRuntime.attachBehavior === 'parent_rigid' ||
        nextRuntime.attachBehavior === 'parent_spring';
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

    // Pull-to-unsnap si on tire l'entité au-delà de la distance d'arrachement
    if (isDragging && allowPullUnsnap && dragPos) {
      const pullDist = Math.hypot(
        dragPos.x - goal.goalTopLeft.x,
        dragPos.y - goal.goalTopLeft.y
      );
      if (pullDist > unsnapDist) {
        const wasParented =
          entity.parentId === snappedTarget.id ||
          nextRuntime.attachBehavior === 'parent_rigid' ||
          nextRuntime.attachBehavior === 'parent_spring';
        nextRuntime.isSnapped = false;
        nextRuntime.snappedTargetId = null;
        nextRuntime.attachBehavior = null;
        nextRuntime.cooldownRemaining = cooldownSec;
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
              : undefined,
        };
      }
    }

    // Maintien du snap actif
    const isParentMode = attachBehavior === 'parent_rigid' || attachBehavior === 'parent_spring';
    const isFreezeMode = attachBehavior === 'freeze_physics';
    const isPosOnlyMode = attachBehavior === 'position_only';

    let nextPosition: Position | undefined;
    let nextRotationDeg: number | undefined;
    let parentMutation: SnapStepResult['parentMutation'];

    if (isParentMode) {
      if (entity.parentId !== snappedTarget.id) {
        const alignedChild = { ...entity, position: goal.goalTopLeft };
        const computed = computeRelativeParentOffset(alignedChild, snappedTarget, {
          x: 0,
          y: 0,
          attachmentMode: attachBehavior === 'parent_spring' ? 'spring' : 'rigid',
          inheritRotation: Boolean(config.matchTargetRotation),
          rotationOffset: config.rotationOffset ?? 0,
          springStiffness: config.springStiffness ?? 0.25,
          springDamping: config.springDamping ?? 0.18,
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
      activeLink: {
        from: {
          x: (nextPosition?.x ?? entity.position.x) + entity.size.width / 2,
          y: (nextPosition?.y ?? entity.position.y) + entity.size.height / 2,
        },
        to: goal.targetAnchorWorld,
        snapped: true,
        targetId: snappedTarget.id,
      },
    };
  }

  // 2. Non snappé : vérifier si un candidat est à portée
  const candidate = findBestSnapCandidate(
    probeEntity,
    allEntities,
    config,
    probePos,
    currentRotationDeg
  );

  if (!candidate) {
    return {
      nextRuntime,
      zeroVelocity: false,
      freezeStatic: false,
    };
  }

  const triggerMode = config.snapTrigger || 'on_release';
  const canTriggerNow =
    nextRuntime.cooldownRemaining <= 0 &&
    (triggerMode === 'always_when_near' || (triggerMode === 'on_release' && justReleased));

  if (!canTriggerNow) {
    // Retourner le lien visuel de prévisualisation pendant l'approche
    return {
      nextRuntime,
      zeroVelocity: false,
      freezeStatic: false,
      activeLink: {
        from: candidate.sourceAnchorWorld,
        to: candidate.targetAnchorWorld,
        snapped: false,
        targetId: candidate.target.id,
      },
    };
  }

  // Déclenchement d'un nouveau snap !
  nextRuntime.isSnapped = true;
  nextRuntime.snappedTargetId = candidate.target.id;
  nextRuntime.attachBehavior = attachBehavior;
  nextRuntime.snappedAtPos = candidate.goalTopLeft;

  const isParentMode = attachBehavior === 'parent_rigid' || attachBehavior === 'parent_spring';
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
    const computed = computeRelativeParentOffset(alignedChild, candidate.target, {
      x: 0,
      y: 0,
      attachmentMode: attachBehavior === 'parent_spring' ? 'spring' : 'rigid',
      inheritRotation: Boolean(config.matchTargetRotation),
      rotationOffset: config.rotationOffset ?? 0,
      springStiffness: config.springStiffness ?? 0.25,
      springDamping: config.springDamping ?? 0.18,
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
      from: {
        x: nextPosition.x + entity.size.width / 2,
        y: nextPosition.y + entity.size.height / 2,
      },
      to: candidate.targetAnchorWorld,
      snapped: true,
      targetId: candidate.target.id,
    },
  };
}
