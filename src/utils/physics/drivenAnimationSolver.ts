import {
  DrivenAnimationBehaviorConfig,
  DrivenAnimationCurve,
  DrivenAnimationEndBehavior,
} from '../../types';

export interface DrivenAnimationRuntimeState {
  progress: number;
  maxReachedProgress: number;
  pingPongDir: 1 | -1;
  lastStateId: string;
  wasTouching: boolean;
  cooldownRemaining: number;
  hasCompletedOnce: boolean;
  manualPinnedFrame: number | null;
}

export function createInitialDrivenAnimationRuntime(
  stateId: string
): DrivenAnimationRuntimeState {
  return {
    progress: 0,
    maxReachedProgress: 0,
    pingPongDir: 1,
    lastStateId: stateId,
    wasTouching: false,
    cooldownRemaining: 0,
    hasCompletedOnce: false,
    manualPinnedFrame: null,
  };
}

export function clamp01(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(1, v));
}

export function applyDrivenCurve(t: number, curve: DrivenAnimationCurve = 'linear'): number {
  const x = clamp01(t);
  switch (curve) {
    case 'ease_in':
      return x * x;
    case 'ease_out':
      return 1 - (1 - x) * (1 - x);
    case 'ease_in_out':
      return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
    case 'linear':
    default:
      return x;
  }
}

export function applyEndBehavior(
  rawProgress: number,
  endBehavior: DrivenAnimationEndBehavior = 'clamp'
): number {
  if (!Number.isFinite(rawProgress)) return 0;
  if (endBehavior === 'loop') {
    if (rawProgress <= 0) return 0;
    const mod = rawProgress % 1;
    return mod < 1e-6 && rawProgress > 0.999999 ? 0 : mod;
  }
  if (endBehavior === 'ping_pong') {
    if (rawProgress <= 0) return 0;
    const mod = rawProgress % 2;
    return mod <= 1 ? mod : 2 - mod;
  }
  return clamp01(rawProgress);
}

export function computeMappedRangeProgress(
  value: number,
  start: number,
  end: number
): number {
  if (!Number.isFinite(value)) return 0;
  const span = end - start;
  if (Math.abs(span) < 1e-6) {
    return value >= end ? 1 : 0;
  }
  return clamp01((value - start) / span);
}

export function resolveFrameIndexFromProgress(
  progress01: number,
  frameCount: number
): number {
  if (frameCount <= 1) return 0;
  const p = clamp01(progress01);
  return Math.max(0, Math.min(frameCount - 1, Math.round(p * (frameCount - 1))));
}

export interface DrivenAnimationInputs {
  proximityDistance?: number | null;
  variableValue?: number;
  isTouchingTarget?: boolean;
  speedPxPerSec?: number;
  healthRatio?: number;
}

export interface DrivenAnimationStepOutput {
  nextRuntime: DrivenAnimationRuntimeState;
  rawProgress: number;
  effectiveProgress: number;
  frameIndex: number | undefined;
  visualScale: number | undefined;
  visualRotation: number | undefined;
  visualOpacity: number | undefined;
  completedJustNow: boolean;
}

function advanceDiscreteStep(
  current: number,
  step: number,
  endBehavior: DrivenAnimationEndBehavior,
  pingPongDir: 1 | -1
): { nextProgress: number; nextDir: 1 | -1; wrappedOrHitEnd: boolean } {
  if (endBehavior === 'loop') {
    if (current >= 1 - 1e-4) {
      return { nextProgress: 0, nextDir: 1, wrappedOrHitEnd: false };
    }
    const next = Math.min(1, current + step);
    return {
      nextProgress: next,
      nextDir: 1,
      wrappedOrHitEnd: next >= 1 - 1e-4,
    };
  }
  if (endBehavior === 'ping_pong') {
    const next = current + pingPongDir * step;
    if (next >= 1 - 1e-4) {
      return { nextProgress: 1, nextDir: -1, wrappedOrHitEnd: true };
    }
    if (next <= 1e-4) {
      return { nextProgress: 0, nextDir: 1, wrappedOrHitEnd: false };
    }
    return { nextProgress: clamp01(next), nextDir: pingPongDir, wrappedOrHitEnd: false };
  }
  const next = Math.min(1, current + step);
  return {
    nextProgress: next,
    nextDir: 1,
    wrappedOrHitEnd: next >= 1 - 1e-4,
  };
}

export function stepDrivenAnimationEntity(params: {
  config: DrivenAnimationBehaviorConfig;
  runtime: DrivenAnimationRuntimeState;
  currentStateId: string;
  frameCount: number;
  dt: number;
  inputs: DrivenAnimationInputs;
}): DrivenAnimationStepOutput {
  const { config, currentStateId, frameCount, dt, inputs } = params;
  const safeDt = Math.max(0, Math.min(dt, 0.1));
  const endBehavior: DrivenAnimationEndBehavior = config.endBehavior || 'clamp';
  const isIrreversible = config.progressionMode === 'irreversible';

  let rt: DrivenAnimationRuntimeState = { ...params.runtime };
  if (rt.lastStateId !== currentStateId) {
    rt.lastStateId = currentStateId;
    rt.manualPinnedFrame = null;
    if (config.resetOnStateChange) {
      rt.progress = 0;
      rt.maxReachedProgress = 0;
      rt.pingPongDir = 1;
      rt.wasTouching = false;
      rt.cooldownRemaining = 0;
      rt.hasCompletedOnce = false;
    }
  }

  rt.cooldownRemaining = Math.max(0, rt.cooldownRemaining - safeDt);

  let rawProgress = rt.progress;

  if (config.sourceType === 'collision_step') {
    const touching = Boolean(inputs.isTouchingTarget);
    const requireExit = config.collisionRequireExit !== false;
    const canTriggerEnter = touching && (!requireExit || !rt.wasTouching) && rt.cooldownRemaining <= 0;
    const oneFrameStep =
      frameCount > 1
        ? 1 / (frameCount - 1)
        : Math.max(0.01, (config.collisionStepPercent ?? 25) / 100);
    const step =
      config.collisionStepMode === 'custom_percent'
        ? Math.max(0.01, (config.collisionStepPercent ?? 25) / 100)
        : oneFrameStep;

    if (canTriggerEnter) {
      const stepped = advanceDiscreteStep(rt.progress, step, endBehavior, rt.pingPongDir);
      rawProgress = stepped.nextProgress;
      rt.pingPongDir = stepped.nextDir;
      rt.maxReachedProgress = Math.max(rt.maxReachedProgress, rawProgress);
      rt.cooldownRemaining = Math.max(0, config.collisionCooldownSec ?? 0.25);
    } else if (!isIrreversible && !touching && rt.wasTouching) {
      rawProgress = Math.max(0, rt.progress - step);
    }
    rt.wasTouching = touching;
    rt.progress = rawProgress;
  } else if (config.sourceType === 'collision_hold') {
    const touching = Boolean(inputs.isTouchingTarget);
    const rate = Math.max(0.01, (config.collisionHoldRatePerSec ?? 50) / 100);
    if (touching) {
      if (endBehavior === 'loop') {
        const next = rt.progress + rate * safeDt;
        rawProgress = next >= 1 ? next % 1 : next;
      } else if (endBehavior === 'ping_pong') {
        const next = rt.progress + rt.pingPongDir * rate * safeDt;
        if (next >= 1) {
          rawProgress = Math.max(0, 2 - next);
          rt.pingPongDir = -1;
        } else if (next <= 0) {
          rawProgress = Math.min(1, -next);
          rt.pingPongDir = 1;
        } else {
          rawProgress = next;
        }
      } else {
        rawProgress = Math.min(1, rt.progress + rate * safeDt);
      }
      rt.maxReachedProgress = Math.max(rt.maxReachedProgress, rawProgress);
    } else if (!isIrreversible) {
      rawProgress = Math.max(0, rt.progress - rate * safeDt);
    }
    rt.wasTouching = touching;
    rt.progress = rawProgress;
  } else {
    let target01 = rt.progress;
    if (config.sourceType === 'proximity') {
      const dist = inputs.proximityDistance;
      if (dist !== null && dist !== undefined && Number.isFinite(dist)) {
        const dStart = config.proximityDistanceStart ?? 260;
        const dEnd = config.proximityDistanceEnd ?? 50;
        target01 = computeMappedRangeProgress(dist, dStart, dEnd);
      } else {
        target01 = isIrreversible ? rt.maxReachedProgress : 0;
      }
    } else if (config.sourceType === 'variable') {
      const val = inputs.variableValue ?? 0;
      const minV = config.variableMin ?? 0;
      const maxV = config.variableMax ?? 100;
      target01 = computeMappedRangeProgress(val, minV, maxV);
    } else if (config.sourceType === 'speed') {
      const spd = Math.max(0, inputs.speedPxPerSec ?? 0);
      const minS = config.speedMin ?? 0;
      const maxS = config.speedMax ?? 300;
      target01 = computeMappedRangeProgress(spd, minS, maxS);
    } else if (config.sourceType === 'health') {
      const ratio = clamp01(inputs.healthRatio ?? 1);
      target01 = config.invertHealth !== false ? 1 - ratio : ratio;
    }

    if (isIrreversible) {
      rt.maxReachedProgress = Math.max(rt.maxReachedProgress, target01);
      rawProgress = rt.maxReachedProgress;
    } else {
      const smoothing = clamp01(config.smoothing ?? 0);
      if (smoothing > 0.005 && safeDt > 0) {
        const speedFactor = 2 + (1 - smoothing) * 28;
        const alpha = 1 - Math.exp(-speedFactor * safeDt);
        rawProgress = rt.progress + (target01 - rt.progress) * alpha;
      } else {
        rawProgress = target01;
      }
    }
    rt.progress = rawProgress;
  }

  const bounded01 =
    config.sourceType === 'collision_step' || config.sourceType === 'collision_hold'
      ? clamp01(rawProgress)
      : applyEndBehavior(rawProgress, endBehavior);

  const curved01 = applyDrivenCurve(bounded01, config.curve || 'linear');
  const effectiveProgress = config.invertOutput ? 1 - curved01 : curved01;

  const isCompleteNow = bounded01 >= 1 - 1e-4;
  let completedJustNow = false;
  if (isCompleteNow && !rt.hasCompletedOnce) {
    completedJustNow = true;
    rt.hasCompletedOnce = true;
  } else if (!isCompleteNow && bounded01 < 0.95 && !isIrreversible) {
    rt.hasCompletedOnce = false;
  }

  const frameIndex =
    config.driveFlipbook !== false
      ? resolveFrameIndexFromProgress(effectiveProgress, frameCount)
      : undefined;

  let visualScale: number | undefined;
  let visualRotation: number | undefined;
  let visualOpacity: number | undefined;
  if (config.driveVisualTransform) {
    const s0 = config.scaleStart ?? 1;
    const s1 = config.scaleEnd ?? 1;
    visualScale = s0 + (s1 - s0) * effectiveProgress;

    const r0 = config.rotationStart ?? 0;
    const r1 = config.rotationEnd ?? 0;
    visualRotation = r0 + (r1 - r0) * effectiveProgress;

    const o0 = clamp01(config.opacityStart ?? 1);
    const o1 = clamp01(config.opacityEnd ?? 1);
    visualOpacity = clamp01(o0 + (o1 - o0) * effectiveProgress);
  }

  return {
    nextRuntime: rt,
    rawProgress: bounded01,
    effectiveProgress,
    frameIndex,
    visualScale,
    visualRotation,
    visualOpacity,
    completedJustNow,
  };
}

export function applyManualAnimationControl(params: {
  runtime: DrivenAnimationRuntimeState;
  currentStateId: string;
  frameCount: number;
  hasDrivenBehavior: boolean;
  mode: 'set_frame' | 'step_frame' | 'set_progress' | 'reset';
  frameNumber?: number;
  stepDelta?: number;
  progressPercent?: number;
  loop?: boolean;
  currentDisplayedFrame?: number;
}): {
  nextRuntime: DrivenAnimationRuntimeState;
  frameIndex: number;
  progress01: number;
} {
  const {
    currentStateId,
    frameCount,
    hasDrivenBehavior,
    mode,
    frameNumber = 1,
    stepDelta = 1,
    progressPercent = 0,
    loop = false,
    currentDisplayedFrame = 0,
  } = params;

  const safeTotal = Math.max(1, frameCount);
  const rt: DrivenAnimationRuntimeState = {
    ...params.runtime,
    lastStateId: currentStateId,
  };

  let targetIdx = currentDisplayedFrame;
  if (rt.manualPinnedFrame !== null && rt.manualPinnedFrame !== undefined) {
    targetIdx = rt.manualPinnedFrame;
  } else if (hasDrivenBehavior) {
    targetIdx = resolveFrameIndexFromProgress(rt.progress, safeTotal);
  }

  let nextProgress = rt.progress;

  if (mode === 'reset') {
    targetIdx = 0;
    nextProgress = 0;
    rt.maxReachedProgress = 0;
    rt.hasCompletedOnce = false;
    rt.pingPongDir = 1;
    rt.manualPinnedFrame = hasDrivenBehavior ? null : 0;
  } else if (mode === 'set_frame') {
    const rawIdx = Math.round(frameNumber) - 1;
    targetIdx = Math.max(0, Math.min(safeTotal - 1, rawIdx));
    nextProgress = safeTotal > 1 ? targetIdx / (safeTotal - 1) : 0;
    rt.maxReachedProgress = nextProgress;
    rt.hasCompletedOnce = nextProgress >= 1 - 1e-4;
    rt.manualPinnedFrame = hasDrivenBehavior ? null : targetIdx;
  } else if (mode === 'step_frame') {
    const nextRaw = targetIdx + Math.round(stepDelta);
    if (loop && safeTotal > 1) {
      targetIdx = ((nextRaw % safeTotal) + safeTotal) % safeTotal;
    } else {
      targetIdx = Math.max(0, Math.min(safeTotal - 1, nextRaw));
    }
    nextProgress = safeTotal > 1 ? targetIdx / (safeTotal - 1) : 0;
    rt.maxReachedProgress = nextProgress;
    rt.hasCompletedOnce = nextProgress >= 1 - 1e-4;
    rt.manualPinnedFrame = hasDrivenBehavior ? null : targetIdx;
  } else if (mode === 'set_progress') {
    nextProgress = clamp01(progressPercent / 100);
    targetIdx = resolveFrameIndexFromProgress(nextProgress, safeTotal);
    rt.maxReachedProgress = nextProgress;
    rt.hasCompletedOnce = nextProgress >= 1 - 1e-4;
    rt.manualPinnedFrame = hasDrivenBehavior ? null : targetIdx;
  }

  rt.progress = nextProgress;
  return {
    nextRuntime: rt,
    frameIndex: targetIdx,
    progress01: nextProgress,
  };
}
