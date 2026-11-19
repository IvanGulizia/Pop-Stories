import { ParentOffset, Position } from '../../types';

export interface JointBreakRuntimeState {
  ageSec: number;
  shakeFatigue: number; // 0..1 (>= 1 => rupture)
  prevAngVelDegPerSec: number;
  prevLinearSpeed: number;
  hasPrevSample: boolean;
}

export function createJointBreakRuntimeState(): JointBreakRuntimeState {
  return {
    ageSec: 0,
    shakeFatigue: 0,
    prevAngVelDegPerSec: 0,
    prevLinearSpeed: 0,
    hasPrevSample: false,
  };
}

export interface EvaluateJointBreakParams {
  state: JointBreakRuntimeState;
  offset?: ParentOffset;
  pinAWorld: Position;
  pinBWorld: Position;
  angVelDegPerSec: number;
  linearSpeedPxPerSec?: number;
  cursorStretchPx?: number;
  dt: number;
}

export interface EvaluateJointBreakResult {
  broken: boolean;
  reason: 'force' | 'shake' | null;
  stressRatio: number; // 0..1+ (max du ratio force et ratio fatigue secousses)
  forceRatio: number;
  shakeFatigue: number;
  nextState: JointBreakRuntimeState;
}

/**
 * Évalue à chaque pas si un joint cassable (`jointBreakable`) doit rompre
 * par traction excessive (`jointBreakForce`) ou par fatigue aux secousses (`jointBreakShakeThreshold`).
 * Respecte une grâce initiale de 80 ms au lancement Play pour éviter toute fausse rupture
 * liée à `jointInitialAngleOffset` ou à la mise en place de la gravité.
 */
export function evaluateJointBreakState(params: EvaluateJointBreakParams): EvaluateJointBreakResult {
  const {
    state,
    offset,
    pinAWorld,
    pinBWorld,
    angVelDegPerSec,
    linearSpeedPxPerSec = 0,
    cursorStretchPx = 0,
    dt,
  } = params;

  const safeDt = Math.max(0.0001, Math.min(dt, 0.05));
  const nextAgeSec = state.ageSec + safeDt;

  if (!offset?.jointBreakable) {
    return {
      broken: false,
      reason: null,
      stressRatio: 0,
      forceRatio: 0,
      shakeFatigue: 0,
      nextState: {
        ageSec: nextAgeSec,
        shakeFatigue: 0,
        prevAngVelDegPerSec: angVelDegPerSec,
        prevLinearSpeed: linearSpeedPxPerSec,
        hasPrevSample: true,
      },
    };
  }

  const STARTUP_GRACE_SEC = 0.08;
  if (nextAgeSec < STARTUP_GRACE_SEC) {
    return {
      broken: false,
      reason: null,
      stressRatio: 0,
      forceRatio: 0,
      shakeFatigue: 0,
      nextState: {
        ageSec: nextAgeSec,
        shakeFatigue: 0,
        prevAngVelDegPerSec: angVelDegPerSec,
        prevLinearSpeed: linearSpeedPxPerSec,
        hasPrevSample: true,
      },
    };
  }

  // 1. Traction / Étirement du joint
  const breakForceThreshold = Math.max(40, offset.jointBreakForce ?? 240);
  const separationPx = Math.hypot(pinAWorld.x - pinBWorld.x, pinAWorld.y - pinBWorld.y);
  const effectiveForce = separationPx * 8 + Math.max(0, cursorStretchPx) * 2.5;
  const forceRatio = effectiveForce / breakForceThreshold;

  if (forceRatio >= 1) {
    return {
      broken: true,
      reason: 'force',
      stressRatio: forceRatio,
      forceRatio,
      shakeFatigue: state.shakeFatigue,
      nextState: {
        ageSec: nextAgeSec,
        shakeFatigue: state.shakeFatigue,
        prevAngVelDegPerSec: angVelDegPerSec,
        prevLinearSpeed: linearSpeedPxPerSec,
        hasPrevSample: true,
      },
    };
  }

  // 2. Fatigue aux secousses rapides / inversions brutales de direction
  const shakeThreshold = offset.jointBreakShakeThreshold ?? 100;
  let nextFatigue = state.shakeFatigue * Math.exp(-0.75 * safeDt);

  if (shakeThreshold > 0 && state.hasPrevSample) {
    const prevVel = state.prevAngVelDegPerSec;
    const absCur = Math.abs(angVelDegPerSec);
    const absPrev = Math.abs(prevVel);

    // Inversion rapide du sens de rotation (secousse vive)
    const isReversal =
      angVelDegPerSec * prevVel < 0 && (absCur > 110 || absPrev > 110);
    const reversalPoints = isReversal
      ? Math.min(34, (absCur + absPrev) * 0.048)
      : 0;

    // À-coup angulaire (jerk) + à-coup linéaire (utile pour mode Ressort sans rotation)
    const deltaAngVel = Math.abs(angVelDegPerSec - prevVel);
    const angularJerkPoints = Math.max(0, deltaAngVel - 210) * 0.036;
    const deltaLinSpeed = Math.abs(linearSpeedPxPerSec - state.prevLinearSpeed);
    const linearJerkPoints = Math.max(0, deltaLinSpeed - 380) * 0.022;

    const damagePoints =
      (reversalPoints + angularJerkPoints + linearJerkPoints) *
      (100 / Math.max(20, shakeThreshold));

    nextFatigue = Math.min(1.5, Math.max(0, nextFatigue + damagePoints / 100));
  } else if (shakeThreshold <= 0) {
    nextFatigue = 0;
  }

  if (shakeThreshold > 0 && nextFatigue >= 1) {
    return {
      broken: true,
      reason: 'shake',
      stressRatio: Math.max(forceRatio, nextFatigue),
      forceRatio,
      shakeFatigue: nextFatigue,
      nextState: {
        ageSec: nextAgeSec,
        shakeFatigue: nextFatigue,
        prevAngVelDegPerSec: angVelDegPerSec,
        prevLinearSpeed: linearSpeedPxPerSec,
        hasPrevSample: true,
      },
    };
  }

  return {
    broken: false,
    reason: null,
    stressRatio: Math.max(forceRatio, nextFatigue),
    forceRatio,
    shakeFatigue: nextFatigue,
    nextState: {
      ageSec: nextAgeSec,
      shakeFatigue: nextFatigue,
      prevAngVelDegPerSec: angVelDegPerSec,
      prevLinearSpeed: linearSpeedPxPerSec,
      hasPrevSample: true,
    },
  };
}
