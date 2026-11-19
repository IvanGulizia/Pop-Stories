import { ParentOffset } from '../../types';

export function normalizeAngleDeg(deg: number): number {
  let a = deg % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
}

export function computeJointRestWorldDeg(params: {
  offset?: ParentOffset;
  parentRotDeg: number;
  parentFlipX: boolean;
}): number {
  const { offset, parentRotDeg, parentFlipX } = params;
  const inheritRot = offset?.inheritRotation !== false;
  const inheritFlip = offset?.inheritFlip !== false;
  const rotOffset = (offset?.rotationOffset ?? 0) * (inheritFlip && parentFlipX ? -1 : 1);
  return (inheritRot ? parentRotDeg : 0) + rotOffset;
}

export function resolveJointLimits(offset?: ParentOffset): {
  enabled: boolean;
  minAngle: number;
  maxAngle: number;
  brakeAngle: number;
  brakeStrength: number;
} {
  const enabled = Boolean(offset?.jointEnableAngleLimits);
  const rawMin = offset?.jointMinAngle ?? -75;
  const rawMax = offset?.jointMaxAngle ?? 75;
  const minAngle = Math.max(-179, Math.min(179, Math.min(rawMin, rawMax)));
  const maxAngle = Math.max(-179, Math.min(179, Math.max(rawMin, rawMax)));
  const span = Math.max(2, maxAngle - minAngle);
  const rawBrake = Math.max(0, offset?.jointBrakeAngle ?? 20);
  const brakeAngle = Math.min(rawBrake, span * 0.48);
  const brakeStrength = Math.max(0, Math.min(100, offset?.jointBrakeStrength ?? 75));
  return { enabled, minAngle, maxAngle, brakeAngle, brakeStrength };
}

export interface JointAngularStepResult {
  nextAngularVelDegPerSec: number;
  inBrakeZone: boolean;
  brakeRatio: number;
}

/**
 * Applique en pré-pas (avant Engine.update) le ressort angulaire vers l'angle de repos,
 * l'amortissement du pivot et le 2e angle de freinage progressif à l'approche des extrémités.
 */
export function stepJointAngularForces(params: {
  currentAngleDeg: number;
  angularVelDegPerSec: number;
  restWorldDeg: number;
  offset?: ParentOffset;
  dt: number;
}): JointAngularStepResult {
  const { currentAngleDeg, angularVelDegPerSec, restWorldDeg, offset, dt } = params;
  const safeDt = Math.max(0.0001, Math.min(dt, 0.05));
  const relDeg = normalizeAngleDeg(currentAngleDeg - restWorldDeg);

  let vel = angularVelDegPerSec;

  // 1. Ressort angulaire vers restWorldDeg + amortissement visqueux
  const stiffness = Math.max(0, offset?.jointAngularStiffness ?? 0);
  const damping = Math.max(0, offset?.jointAngularDamping ?? 3);

  if (stiffness > 0) {
    const accelDeg = -stiffness * relDeg - damping * vel;
    vel += accelDeg * safeDt;
  } else if (damping > 0) {
    vel *= Math.exp(-damping * safeDt);
  }

  // 2. Deuxième angle : zone de freinage progressif aux extrémités des butées [minAngle, maxAngle]
  const limits = resolveJointLimits(offset);
  let inBrakeZone = false;
  let brakeRatio = 0;

  if (limits.enabled && limits.brakeAngle > 0.1 && limits.brakeStrength > 0.1) {
    const strength = limits.brakeStrength / 100;
    const upperStart = limits.maxAngle - limits.brakeAngle;
    const lowerStart = limits.minAngle + limits.brakeAngle;

    if (relDeg > upperStart) {
      inBrakeZone = true;
      brakeRatio = Math.max(0, Math.min(1, (relDeg - upperStart) / limits.brakeAngle));
      if (vel > 0) {
        vel *= Math.exp(-(6 + 42 * strength) * (0.25 + 0.75 * brakeRatio * brakeRatio) * safeDt);
      }
      vel -= (50 + 260 * strength) * brakeRatio * safeDt;
    } else if (relDeg < lowerStart) {
      inBrakeZone = true;
      brakeRatio = Math.max(0, Math.min(1, (lowerStart - relDeg) / limits.brakeAngle));
      if (vel < 0) {
        vel *= Math.exp(-(6 + 42 * strength) * (0.25 + 0.75 * brakeRatio * brakeRatio) * safeDt);
      }
      vel += (50 + 260 * strength) * brakeRatio * safeDt;
    }
  }

  // Plafond anti-divergence angulaire
  const maxAngVel = 1440;
  if (vel > maxAngVel) vel = maxAngVel;
  else if (vel < -maxAngVel) vel = -maxAngVel;

  return {
    nextAngularVelDegPerSec: vel,
    inBrakeZone,
    brakeRatio,
  };
}

/**
 * Vérifie et applique la butée dure [minAngle, maxAngle] autour de restWorldDeg.
 */
export function clampJointBodyAngle(params: {
  currentAngleDeg: number;
  angularVelDegPerSec: number;
  restWorldDeg: number;
  offset?: ParentOffset;
}): {
  clamped: boolean;
  nextAngleDeg: number;
  nextAngularVelDegPerSec: number;
} {
  const { currentAngleDeg, angularVelDegPerSec, restWorldDeg, offset } = params;
  const limits = resolveJointLimits(offset);
  if (!limits.enabled) {
    return {
      clamped: false,
      nextAngleDeg: currentAngleDeg,
      nextAngularVelDegPerSec: angularVelDegPerSec,
    };
  }

  const relDeg = normalizeAngleDeg(currentAngleDeg - restWorldDeg);
  if (relDeg > limits.maxAngle) {
    return {
      clamped: true,
      nextAngleDeg: restWorldDeg + limits.maxAngle,
      nextAngularVelDegPerSec: angularVelDegPerSec > 0 ? 0 : angularVelDegPerSec,
    };
  }
  if (relDeg < limits.minAngle) {
    return {
      clamped: true,
      nextAngleDeg: restWorldDeg + limits.minAngle,
      nextAngularVelDegPerSec: angularVelDegPerSec < 0 ? 0 : angularVelDegPerSec,
    };
  }

  return {
    clamped: false,
    nextAngleDeg: currentAngleDeg,
    nextAngularVelDegPerSec: angularVelDegPerSec,
  };
}
