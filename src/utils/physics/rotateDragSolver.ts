import {
  Position,
  RotateDragBehaviorConfig,
  RotateDragGestureMode,
} from '../../types';

export interface RotateDragRuntimeState {
  baseAngleDeg: number; // Angle initial de l'entité au début du mode Play
  angleDeg: number;     // Décalage angulaire courant (degrés relatifs à baseAngleDeg, ou absolu si on inclut base)
  angularVel: number;   // Vitesse angulaire en deg/s
  isGrabbed: boolean;
  pivotWorld: Position;
  grabStartPointer: Position;
  lastPointer: Position;
  grabStartAngleDeg: number;
  lastPointerAngleDeg: number;
  targetAngleDeg: number;
}

export function normalizeDeg180(deg: number): number {
  let d = deg % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

export function shortestDegDelta(fromDeg: number, toDeg: number): number {
  return normalizeDeg180(toDeg - fromDeg);
}

export function getRotateDragBounds(config: RotateDragBehaviorConfig): {
  limitRange: boolean;
  minAngle: number;
  maxAngle: number;
} {
  const limitRange = Boolean(config.limitRange);
  const rawMin = config.minAngle ?? -135;
  const rawMax = config.maxAngle ?? 135;
  const minAngle = Math.min(rawMin, rawMax);
  const maxAngle = Math.max(rawMin, rawMax);
  return { limitRange, minAngle, maxAngle };
}

export function clampRotateDragAngle(
  angleDeg: number,
  angularVel: number,
  config: RotateDragBehaviorConfig
): { angleDeg: number; angularVel: number; hitBoundary: boolean } {
  const { limitRange, minAngle, maxAngle } = getRotateDragBounds(config);
  if (!limitRange) {
    return { angleDeg, angularVel, hitBoundary: false };
  }
  const bounce = Math.max(0, Math.min(0.95, config.boundaryBounce ?? 0.3));
  let nextAngle = angleDeg;
  let nextVel = angularVel;
  let hitBoundary = false;
  if (nextAngle < minAngle) {
    nextAngle = minAngle;
    if (nextVel < 0) nextVel = -nextVel * bounce;
    hitBoundary = true;
  } else if (nextAngle > maxAngle) {
    nextAngle = maxAngle;
    if (nextVel > 0) nextVel = -nextVel * bounce;
    hitBoundary = true;
  }
  return { angleDeg: nextAngle, angularVel: nextVel, hitBoundary };
}

export function getNearestRotateDragStep(
  angleDeg: number,
  config: RotateDragBehaviorConfig
): { snappedDeg: number; stepIndex: number; stepSpacingDeg: number } {
  const { limitRange, minAngle, maxAngle } = getRotateDragBounds(config);
  const steps = Math.max(0, Math.round(config.steps ?? 0));
  const stepAngleDeg = Math.max(1, config.stepAngleDeg ?? 30);

  if (limitRange && steps >= 2 && maxAngle > minAngle + 1e-4) {
    const t = Math.max(0, Math.min(1, (angleDeg - minAngle) / (maxAngle - minAngle)));
    const idx = Math.round(t * (steps - 1));
    const spacing = (maxAngle - minAngle) / (steps - 1);
    return {
      snappedDeg: minAngle + idx * spacing,
      stepIndex: idx,
      stepSpacingDeg: spacing,
    };
  }

  if (steps >= 2) {
    const spacing = 360 / steps;
    const rawIdx = Math.round(angleDeg / spacing);
    const wrappedIdx = ((rawIdx % steps) + steps) % steps;
    return {
      snappedDeg: rawIdx * spacing,
      stepIndex: wrappedIdx,
      stepSpacingDeg: spacing,
    };
  }

  if ((config.stepAngleDeg ?? 0) >= 2 && !limitRange) {
    const rawIdx = Math.round(angleDeg / stepAngleDeg);
    return {
      snappedDeg: rawIdx * stepAngleDeg,
      stepIndex: rawIdx,
      stepSpacingDeg: stepAngleDeg,
    };
  }

  return { snappedDeg: angleDeg, stepIndex: 0, stepSpacingDeg: 0 };
}

export function hasRotateDragSteps(config: RotateDragBehaviorConfig): boolean {
  const steps = Math.max(0, Math.round(config.steps ?? 0));
  const { limitRange } = getRotateDragBounds(config);
  if (steps >= 2) return true;
  if (!limitRange && (config.stepAngleDeg ?? 0) >= 2) return true;
  return false;
}

export function createRotateDragGrabState(params: {
  currentAngleDeg: number;
  baseAngleDeg: number;
  pivotWorld: Position;
  pointerWorld: Position;
  config: RotateDragBehaviorConfig;
}): RotateDragRuntimeState {
  const ptrAngle =
    (Math.atan2(params.pointerWorld.y - params.pivotWorld.y, params.pointerWorld.x - params.pivotWorld.x) *
      180) /
    Math.PI;
  return {
    baseAngleDeg: params.baseAngleDeg,
    angleDeg: params.currentAngleDeg,
    angularVel: 0,
    isGrabbed: true,
    pivotWorld: { ...params.pivotWorld },
    grabStartPointer: { ...params.pointerWorld },
    lastPointer: { ...params.pointerWorld },
    grabStartAngleDeg: params.currentAngleDeg,
    lastPointerAngleDeg: ptrAngle,
    targetAngleDeg: params.currentAngleDeg,
  };
}

export function updateRotateDragPointerTarget(
  state: RotateDragRuntimeState,
  pointerWorld: Position,
  pivotWorld: Position,
  config: RotateDragBehaviorConfig
): void {
  state.pivotWorld = { ...pivotWorld };
  state.lastPointer = { ...pointerWorld };
  const gestureMode: RotateDragGestureMode = config.gestureMode || 'circular';
  const sensitivity = Math.max(0.1, config.sensitivity ?? 0.85);

  if (gestureMode === 'linear_x') {
    const dx = pointerWorld.x - state.grabStartPointer.x;
    state.targetAngleDeg = state.grabStartAngleDeg + dx * sensitivity;
    return;
  }

  if (gestureMode === 'linear_y') {
    const dy = state.grabStartPointer.y - pointerWorld.y;
    state.targetAngleDeg = state.grabStartAngleDeg + dy * sensitivity;
    return;
  }

  // 'circular' : angle déplié continu autour du pivot (supporte plusieurs tours sans saut +/-180°)
  const dx = pointerWorld.x - pivotWorld.x;
  const dy = pointerWorld.y - pivotWorld.y;
  if (Math.hypot(dx, dy) < 4) return;
  const ptrAngle = (Math.atan2(dy, dx) * 180) / Math.PI;
  const delta = shortestDegDelta(state.lastPointerAngleDeg, ptrAngle);
  state.lastPointerAngleDeg = ptrAngle;
  state.targetAngleDeg += delta;
}

export function computeRotateDragOutputs(
  angleDeg: number,
  config: RotateDragBehaviorConfig
): {
  angleDeg: number;
  normalized: number;
  mappedValue: number;
  stepIndex: number;
  updates: Record<string, number>;
} {
  const { limitRange, minAngle, maxAngle } = getRotateDragBounds(config);
  const stepInfo = getNearestRotateDragStep(angleDeg, config);
  const outMin = config.outputMin ?? 0;
  const outMax = config.outputMax ?? 100;

  let normalized = 0;
  let mappedValue = angleDeg;
  if (limitRange && maxAngle > minAngle + 1e-4) {
    normalized = Math.max(0, Math.min(1, (angleDeg - minAngle) / (maxAngle - minAngle)));
    mappedValue = outMin + normalized * (outMax - outMin);
  } else {
    normalized = angleDeg / 360;
    mappedValue = outMin + normalized * (outMax - outMin);
  }

  const cleanAngle = Math.round(angleDeg * 100) / 100;
  const cleanNorm = Math.round(normalized * 1000) / 1000;
  const cleanMapped = Math.round(mappedValue * 100) / 100;

  const updates: Record<string, number> = {};
  const angleVar = config.outputAngleVariable?.trim();
  const normVar = config.outputNormalizedVariable?.trim();
  const stepVar = config.outputStepVariable?.trim();

  if (angleVar) updates[angleVar] = cleanAngle;
  if (normVar) updates[normVar] = limitRange ? cleanMapped : cleanNorm;
  if (stepVar) updates[stepVar] = stepInfo.stepIndex;

  return {
    angleDeg: cleanAngle,
    normalized: cleanNorm,
    mappedValue: cleanMapped,
    stepIndex: stepInfo.stepIndex,
    updates,
  };
}

export function stepRotateDragPhysics(params: {
  state: RotateDragRuntimeState;
  config: RotateDragBehaviorConfig;
  dt: number;
}): {
  angleDeg: number;
  outputs: ReturnType<typeof computeRotateDragOutputs>;
} {
  const { state, config, dt } = params;
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const dragMode = config.dragMode || 'physics_spring';
  const stepMode = config.stepMode || 'magnetic';
  const returnMode = config.returnMode || 'none';
  const stepsActive = hasRotateDragSteps(config);

  const restRaw = config.restAngle ?? 0;
  const restClamped = clampRotateDragAngle(restRaw, 0, config).angleDeg;

  if (state.isGrabbed && dragMode === 'direct') {
    const clampedTarget = clampRotateDragAngle(state.targetAngleDeg, 0, config);
    let nextAngle = clampedTarget.angleDeg;
    if (stepsActive && stepMode === 'strict') {
      nextAngle = getNearestRotateDragStep(nextAngle, config).snappedDeg;
    }
    state.angularVel = (nextAngle - state.angleDeg) / safeDt;
    state.angleDeg = nextAngle;
    return {
      angleDeg: state.angleDeg,
      outputs: computeRotateDragOutputs(state.angleDeg, config),
    };
  }

  const subSteps = 2;
  const subDt = safeDt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    let torque = 0;

    if (state.isGrabbed) {
      const targetClamped = clampRotateDragAngle(state.targetAngleDeg, 0, config).angleDeg;
      const k = Math.max(15, config.dragStiffness ?? 240);
      const c = Math.max(1, config.dragDamping ?? 16);
      torque += k * (targetClamped - state.angleDeg) - c * state.angularVel;
    } else if (returnMode === 'spring_return') {
      const kRet = Math.max(5, config.returnStiffness ?? 140);
      const cRet = Math.max(1, config.returnDamping ?? 12);
      torque += kRet * (restClamped - state.angleDeg) - cRet * state.angularVel;
    } else {
      const freeDamp = Math.max(0.5, config.inertiaDamping ?? 4);
      torque -= freeDamp * state.angularVel;
    }

    if (stepsActive && stepMode === 'magnetic') {
      const step = getNearestRotateDragStep(state.angleDeg, config);
      if (step.stepSpacingDeg > 0.5) {
        const diff = step.snappedDeg - state.angleDeg;
        const wellRadius = Math.max(2, step.stepSpacingDeg * 0.55);
        if (Math.abs(diff) < wellRadius) {
          const strength = Math.max(10, config.magneticStrength ?? 140);
          const scale = state.isGrabbed ? 0.35 : 1.0;
          torque += (diff / wellRadius) * strength * 8 * scale;
          if (!state.isGrabbed && returnMode === 'none') {
            torque -= 3.5 * state.angularVel;
          }
        }
      }
    }

    state.angularVel += torque * subDt;
    state.angleDeg += state.angularVel * subDt;

    const clamped = clampRotateDragAngle(state.angleDeg, state.angularVel, config);
    state.angleDeg = clamped.angleDeg;
    state.angularVel = clamped.angularVel;
  }

  if (stepsActive && stepMode === 'strict') {
    const snapped = getNearestRotateDragStep(state.angleDeg, config).snappedDeg;
    state.angleDeg = snapped;
    state.angularVel = 0;
  }

  if (!state.isGrabbed && Math.abs(state.angularVel) < 1.2) {
    if (returnMode === 'spring_return' && Math.abs(state.angleDeg - restClamped) < 0.35) {
      state.angleDeg = restClamped;
      state.angularVel = 0;
    } else if (stepsActive && stepMode === 'magnetic') {
      const snapped = getNearestRotateDragStep(state.angleDeg, config).snappedDeg;
      if (Math.abs(state.angleDeg - snapped) < 0.6) {
        state.angleDeg = snapped;
        state.angularVel = 0;
      }
    } else if (returnMode === 'none' && Math.abs(state.angularVel) < 0.3) {
      state.angularVel = 0;
    }
  }

  return {
    angleDeg: state.angleDeg,
    outputs: computeRotateDragOutputs(state.angleDeg, config),
  };
}
