import { EntityPivot } from '../../types';

export interface Spring2DState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Spring2DStepParams {
  state: Spring2DState;
  targetX: number;
  targetY: number;
  stiffness: number;       // ~10..800 (défaut 160)
  damping: number;         // ~0..40 (défaut 12)
  gravity?: number;        // px/s² vers le bas (+Y), défaut 0
  maxDistance?: number;    // laisse max en px (0 = illimité sauf si limitMaxDistance === true)
  limitMaxDistance?: boolean; // si true et maxDistance === 0, bride strictement à 0 px sans jeu
  dt: number;              // secondes
}

/**
 * Intégrateur ressort-amortisseur 2D (semi-implicite avec sous-pas pour stabilité numérique).
 * Utilisé à la fois pour le Parenting élastique (Spring/Damping) et pour le Follow ressort.
 */
export function stepSpring2D(params: Spring2DStepParams): {
  x: number;
  y: number;
  vx: number;
  vy: number;
  clampedByLeash: boolean;
} {
  const {
    state,
    targetX,
    targetY,
    stiffness,
    damping,
    gravity = 0,
    maxDistance = 0,
    limitMaxDistance = false,
    dt,
  } = params;

  const safeDt = Math.max(0.0001, Math.min(dt, 0.05));
  const k = Math.max(1, stiffness);
  const c = Math.max(0, damping);
  const substeps = safeDt > 0.012 ? 3 : safeDt > 0.006 ? 2 : 1;
  const subDt = safeDt / substeps;

  let x = state.x;
  let y = state.y;
  let vx = state.vx;
  let vy = state.vy;

  for (let i = 0; i < substeps; i++) {
    const ax = (targetX - x) * k - c * vx;
    const ay = (targetY - y) * k - c * vy + gravity;

    vx += ax * subDt;
    vy += ay * subDt;

    // Garde-fou vitesse max anti-divergence
    const maxSpeed = 6000;
    const speedSq = vx * vx + vy * vy;
    if (speedSq > maxSpeed * maxSpeed) {
      const ratio = maxSpeed / Math.sqrt(speedSq);
      vx *= ratio;
      vy *= ratio;
    }

    x += vx * subDt;
    y += vy * subDt;
  }

  let clampedByLeash = false;
  const hasMaxLimit = limitMaxDistance ? maxDistance >= 0 : maxDistance > 0;
  if (hasMaxLimit) {
    if (maxDistance <= 0.0001) {
      clampedByLeash = true;
      x = targetX;
      y = targetY;
      vx = 0;
      vy = 0;
    } else {
      const dx = x - targetX;
      const dy = y - targetY;
      const dist = Math.hypot(dx, dy);
      if (dist > maxDistance && dist > 0.0001) {
        clampedByLeash = true;
        const nx = dx / dist;
        const ny = dy / dist;
        x = targetX + nx * maxDistance;
        y = targetY + ny * maxDistance;
        // Supprime la composante de vitesse qui tire encore vers l'extérieur
        const outwardVel = vx * nx + vy * ny;
        if (outwardVel > 0) {
          vx -= outwardVel * nx;
          vy -= outwardVel * ny;
        }
      }
    }
  }

  state.x = x;
  state.y = y;
  state.vx = vx;
  state.vy = vy;

  return { x, y, vx, vy, clampedByLeash };
}

export interface JiggleRuntimeState {
  angleDeg: number;
  angularVelDeg: number;
  squashX: number;
  squashY: number;
}

export interface JiggleStepParams {
  state: JiggleRuntimeState;
  accelX: number;           // accélération horizontale en px/s²
  accelY: number;           // accélération verticale en px/s²
  baseWorldRotDeg: number;  // angle de base dans le monde (incluant parent + état + restOffset)
  effPivot: EntityPivot;    // pivot effectif (détermine le bras de levier vers le centre géométrique 0.5, 0.5)
  stiffness: number;        // raideur angulaire (~10..600)
  damping: number;          // amortissement (~0.5..35)
  inertia: number;          // couplage accélération -> couple (~0..4)
  maxAngle: number;         // borne ±degrés (~2..180)
  gravityPull: number;      // attraction gravité sur le centre de masse (-200..400)
  squashIntensity: number;  // déformation MudBun 0..1.5
  impactImpulseDeg?: number; // impulsion supplémentaire en deg/s (ex: collision monde)
  dt: number;
}

/**
 * Oscillateur rotationnel Jiggle autour du pivot effectif + Squash & Stretch borné.
 * Modélise un bras de levier entre le pivot et le centre géométrique (0.5, 0.5) pour réagir
 * naturellement à l'accélération linéaire et à la gravité quelle que soit la position du pivot.
 */
export function stepJiggleRotational(params: JiggleStepParams): {
  angleDeg: number;
  angularVelDeg: number;
  squashX: number;
  squashY: number;
} {
  const {
    state,
    accelX,
    accelY,
    baseWorldRotDeg,
    effPivot,
    stiffness,
    damping,
    inertia,
    maxAngle,
    gravityPull,
    squashIntensity,
    impactImpulseDeg = 0,
    dt,
  } = params;

  const safeDt = Math.max(0.0001, Math.min(dt, 0.05));
  const k = Math.max(1, stiffness);
  const c = Math.max(0.1, damping);
  const limit = Math.max(1, Math.min(180, maxAngle));

  // Vecteur local du pivot vers le centre de masse (normalisé)
  let leverX = 0.5 - effPivot.x;
  let leverY = 0.5 - effPivot.y;
  const leverLen = Math.hypot(leverX, leverY);
  if (leverLen < 0.05) {
    // Pivot quasiment centré : bras de levier virtuel vers le bas pour garder un balancement intuitif
    leverX = 0;
    leverY = 0.35;
  }

  let angleDeg = state.angleDeg;
  let angularVelDeg = state.angularVelDeg + impactImpulseDeg;

  const substeps = safeDt > 0.012 ? 3 : 2;
  const subDt = safeDt / substeps;

  for (let i = 0; i < substeps; i++) {
    const worldRad = ((baseWorldRotDeg + angleDeg) * Math.PI) / 180;
    const cos = Math.cos(worldRad);
    const sin = Math.sin(worldRad);

    // Vecteur bras de levier tourné dans l'espace monde
    const rx = leverX * cos - leverY * sin;
    const ry = leverX * sin + leverY * cos;

    // Force inertielle opposée à l'accélération : F_inert = -accel * inertia
    // Couple 2D = cross(r, F_inert) = rx * Fy - ry * Fx
    const clampedAccelX = Math.max(-6000, Math.min(6000, accelX));
    const clampedAccelY = Math.max(-6000, Math.min(6000, accelY));
    const inertTorqueDeg = (rx * (-clampedAccelY) - ry * (-clampedAccelX)) * inertia * 0.45;

    // Couple de gravité (+Y vers le bas) : cross(r, (0, gravityPull)) = rx * gravityPull
    const gravityTorqueDeg = rx * gravityPull * 8.5;

    // Rappel ressort vers angleDeg = 0 + amortissement visqueux
    const springAccelDeg = -k * angleDeg - c * angularVelDeg + inertTorqueDeg + gravityTorqueDeg;

    angularVelDeg += springAccelDeg * subDt;
    angleDeg += angularVelDeg * subDt;

    if (angleDeg > limit) {
      if (state.angleDeg <= limit + 0.01) {
        angleDeg = limit;
        if (angularVelDeg > 0) angularVelDeg *= -0.35;
      } else if (angularVelDeg > 0) {
        angularVelDeg = 0;
      }
    } else if (angleDeg < -limit) {
      if (state.angleDeg >= -limit - 0.01) {
        angleDeg = -limit;
        if (angularVelDeg < 0) angularVelDeg *= -0.35;
      } else if (angularVelDeg < 0) {
        angularVelDeg = 0;
      }
    }
  }

  // Squash & stretch volumique style MudBun (borné pour préserver la lisibilité)
  const squashFactor = Math.max(0, Math.min(1.5, squashIntensity));
  let targetSquashX = 1;
  let targetSquashY = 1;
  if (squashFactor > 0.001) {
    const velMag = Math.min(1, Math.abs(angularVelDeg) / 420);
    const accelMag = Math.min(1, Math.hypot(accelX, accelY) / 3000);
    const stretch = Math.min(0.28, (velMag * 0.18 + accelMag * 0.14) * squashFactor);
    // Alterne subtilement selon l'axe principal ou l'angle
    const bias = Math.cos(((angleDeg) * Math.PI) / 180);
    targetSquashX = 1 + stretch * 0.65 * (bias >= 0 ? 1 : -1) - stretch * 0.35;
    targetSquashY = 1 / Math.max(0.74, Math.min(1.32, targetSquashX));
    targetSquashX = Math.max(0.74, Math.min(1.32, targetSquashX));
  }

  const blend = Math.min(1, safeDt * 18);
  const squashX = state.squashX + (targetSquashX - state.squashX) * blend;
  const squashY = state.squashY + (targetSquashY - state.squashY) * blend;

  state.angleDeg = Math.round(angleDeg * 100) / 100;
  state.angularVelDeg = angularVelDeg;
  state.squashX = Math.round(squashX * 1000) / 1000;
  state.squashY = Math.round(squashY * 1000) / 1000;

  return {
    angleDeg: state.angleDeg,
    angularVelDeg: state.angularVelDeg,
    squashX: state.squashX,
    squashY: state.squashY,
  };
}
