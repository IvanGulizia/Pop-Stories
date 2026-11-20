import { FollowBehaviorConfig, Position, Size, WanderingBehaviorConfig } from '../../types';
import { Spring2DState, stepSpring2D } from './springJiggleSolver';

export interface WanderingRuntimeState {
  origin: Position;
  targetPoint: Position | null;
  moveTimer: number;
  pauseTimer: number;
  currentAngle: number;
  wallTurnCooldown?: number;
  ledgeTurnCooldown?: number;
}

export interface FollowJumpRuntimeState {
  jumpCooldownTimer: number;
}

export interface ArrivalTrackerState {
  wasWithinArrival: boolean;
}

/**
 * Interpolation fluide de vitesse (Accélération + Inertie/Damping) compatible à 100% avec les comportements existants.
 */
export function approachAxisVelocity(
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
 * Détermine la direction horizontale courante de l'errance (utile pour sonder le vide avant stepWanderingBehavior).
 */
export function getWanderingMoveDirX(state: WanderingRuntimeState, currentCenter: Position): 1 | -1 | 0 {
  if (state.pauseTimer > 0 || !state.targetPoint) return 0;
  const dx = state.targetPoint.x - currentCenter.x;
  if (Math.abs(dx) <= 6) return 0;
  return dx > 0 ? 1 : -1;
}

/**
 * Pas de simulation pur pour le comportement Errance / Wandering (Libre 2D ou Sol horizontal avec murs/vide).
 */
export function stepWanderingBehavior(params: {
  state: WanderingRuntimeState;
  currentCenter: Position;
  currentVelocity: Position; // px/frame
  config: WanderingBehaviorConfig;
  canvasBounds: Size;
  dt: number;
  wallHit?: { left: boolean; right: boolean; up: boolean; down: boolean };
  ledgeAhead?: boolean;
  randomFn?: () => number;
}): {
  vx: number;
  vy: number;
  preserveVerticalVelocity: boolean;
  isMoving: boolean;
  targetAngleRad?: number;
} {
  const {
    state,
    currentCenter,
    currentVelocity,
    config,
    canvasBounds,
    dt,
    wallHit,
    ledgeAhead = false,
    randomFn = Math.random,
  } = params;

  const safeDt = Math.max(0.0001, Math.min(0.05, dt));
  const mode = config.mode || 'free_2d';
  const radius = Math.max(20, config.radius ?? 160);
  const speedPxFrame = Math.max(0, config.speed ?? 90) / 60;
  const randomnessFactor = Math.max(0, Math.min(100, config.randomness ?? 65)) / 100;
  const interval = Math.max(0.2, config.changeInterval ?? 1.5);
  const maxPause = Math.max(0, config.pauseDuration ?? 0.8);
  const wAccel = config.acceleration;
  const wDamp = config.damping ?? 0.78;

  state.wallTurnCooldown = Math.max(0, (state.wallTurnCooldown ?? 0) - safeDt);
  state.ledgeTurnCooldown = Math.max(0, (state.ledgeTurnCooldown ?? 0) - safeDt);

  const pickNextWanderTarget = (forcedDirX?: 1 | -1) => {
    const durationJitter = 1 - randomnessFactor * 0.4 + randomFn() * (randomnessFactor * 0.9);
    state.moveTimer = Math.max(0.2, interval * durationJitter);

    if (mode === 'horizontal') {
      const offsetX = currentCenter.x - state.origin.x;
      let dir: number;
      if (forcedDirX !== undefined) {
        dir = forcedDirX;
      } else if (Math.abs(offsetX) > radius * 0.85) {
        dir = offsetX > 0 ? -1 : 1;
      } else if (randomFn() < 0.25 + randomnessFactor * 0.65) {
        dir = randomFn() < 0.5 ? -1 : 1;
      } else {
        dir = Math.cos(state.currentAngle) >= 0 ? 1 : -1;
      }
      const stepDist = radius * (0.3 + randomFn() * 0.7);
      const rawTargetX = currentCenter.x + dir * stepDist;
      const minBoundX = Math.max(20, state.origin.x - radius);
      const maxBoundX = Math.min(Math.max(40, canvasBounds.width - 20), state.origin.x + radius);
      const clampedX = Math.max(minBoundX, Math.min(maxBoundX, rawTargetX));
      state.targetPoint = { x: clampedX, y: currentCenter.y };
      state.currentAngle = dir >= 0 ? 0 : Math.PI;
      return;
    }

    // Mode 2D libre dans une zone circulaire autour de origin
    const dxOrigin = currentCenter.x - state.origin.x;
    const dyOrigin = currentCenter.y - state.origin.y;
    const distFromOrigin = Math.hypot(dxOrigin, dyOrigin);

    let nextAngle: number;
    if (distFromOrigin > radius * 0.85) {
      const toCenterAngle = Math.atan2(-dyOrigin, -dxOrigin);
      nextAngle = toCenterAngle + (randomFn() - 0.5) * (Math.PI * 0.6);
    } else {
      const maxTurn = 0.35 + randomnessFactor * (Math.PI - 0.35);
      nextAngle = state.currentAngle + (randomFn() * 2 - 1) * maxTurn;
    }

    const stepDist = radius * (0.35 + randomFn() * 0.65);
    let tx = currentCenter.x + Math.cos(nextAngle) * stepDist;
    let ty = currentCenter.y + Math.sin(nextAngle) * stepDist;

    const ox = tx - state.origin.x;
    const oy = ty - state.origin.y;
    const od = Math.hypot(ox, oy);
    if (od > radius) {
      tx = state.origin.x + (ox / od) * radius;
      ty = state.origin.y + (oy / od) * radius;
    }

    tx = Math.max(24, Math.min(Math.max(48, canvasBounds.width - 24), tx));
    ty = Math.max(24, Math.min(Math.max(48, canvasBounds.height - 24), ty));

    state.targetPoint = { x: tx, y: ty };
    state.currentAngle = Math.atan2(ty - currentCenter.y, tx - currentCenter.x);
  };

  if (state.pauseTimer > 0) {
    state.pauseTimer -= safeDt;
    if (state.pauseTimer <= 0) {
      state.pauseTimer = 0;
      pickNextWanderTarget();
    }
    return {
      vx: currentVelocity.x * wDamp,
      vy: mode === 'horizontal' ? currentVelocity.y : currentVelocity.y * wDamp,
      preserveVerticalVelocity: mode === 'horizontal',
      isMoving: false,
    };
  }

  if (!state.targetPoint || state.moveTimer <= 0) {
    pickNextWanderTarget();
  }

  state.moveTimer -= safeDt;
  const target = state.targetPoint!;
  const dx = target.x - currentCenter.x;
  const dy = target.y - currentCenter.y;

  if (mode === 'horizontal') {
    const moveDir: 1 | -1 = dx >= 0 ? 1 : -1;
    const hitWall =
      Boolean(config.turnOnWall) &&
      (state.wallTurnCooldown ?? 0) <= 0 &&
      ((moveDir === 1 && wallHit?.right) || (moveDir === -1 && wallHit?.left));
    const hitLedge =
      Boolean(config.detectLedges) &&
      (state.ledgeTurnCooldown ?? 0) <= 0 &&
      Boolean(ledgeAhead);

    if (hitWall || hitLedge) {
      if (hitWall) state.wallTurnCooldown = 0.22;
      if (hitLedge) state.ledgeTurnCooldown = 0.26;
      const oppositeDir: 1 | -1 = moveDir === 1 ? -1 : 1;
      pickNextWanderTarget(oppositeDir);
      // Petite pause réaliste avant de repartir dans le sens opposé si configurée
      if (maxPause > 0) {
        state.pauseTimer = Math.min(0.25, maxPause * 0.35);
      }
      return {
        vx: 0,
        vy: currentVelocity.y,
        preserveVerticalVelocity: true,
        isMoving: false,
      };
    }

    const dist = Math.abs(dx);
    if (dist > 6 && state.moveTimer > 0) {
      const nextVx = approachAxisVelocity(currentVelocity.x, Math.sign(dx) * speedPxFrame, wAccel, wDamp, wDamp);
      return {
        vx: nextVx,
        vy: currentVelocity.y,
        preserveVerticalVelocity: true,
        isMoving: true,
      };
    }
    if (maxPause > 0 && randomFn() < 0.7) {
      state.pauseTimer = maxPause * (0.25 + randomFn() * 0.75);
      return {
        vx: currentVelocity.x * wDamp,
        vy: currentVelocity.y,
        preserveVerticalVelocity: true,
        isMoving: false,
      };
    }
    pickNextWanderTarget();
    return {
      vx: currentVelocity.x,
      vy: currentVelocity.y,
      preserveVerticalVelocity: true,
      isMoving: false,
    };
  }

  // Mode free_2d
  const dist = Math.hypot(dx, dy);
  if (dist > 6 && state.moveTimer > 0) {
    const nextVx = approachAxisVelocity(currentVelocity.x, (dx / dist) * speedPxFrame, wAccel, wDamp, wDamp);
    const nextVy = approachAxisVelocity(currentVelocity.y, (dy / dist) * speedPxFrame, wAccel, wDamp, wDamp);
    return {
      vx: nextVx,
      vy: nextVy,
      preserveVerticalVelocity: false,
      isMoving: true,
      targetAngleRad: config.orientToMovement ? Math.atan2(dy, dx) : undefined,
    };
  }
  if (maxPause > 0 && randomFn() < 0.7) {
    state.pauseTimer = maxPause * (0.25 + randomFn() * 0.75);
    return {
      vx: currentVelocity.x * wDamp,
      vy: currentVelocity.y * wDamp,
      preserveVerticalVelocity: false,
      isMoving: false,
    };
  }
  pickNextWanderTarget();
  return {
    vx: currentVelocity.x,
    vy: currentVelocity.y,
    preserveVerticalVelocity: false,
    isMoving: false,
  };
}

/**
 * Pas de simulation pur pour Follow (Libre 2D ou Au sol / Plateforme avec saut automatique).
 */
export function stepFollowBehavior(params: {
  currentCenter: Position;
  currentVelocity: Position; // px/frame
  targetCenter: Position;
  config: FollowBehaviorConfig;
  springState?: Spring2DState;
  jumpState: FollowJumpRuntimeState;
  isGrounded: boolean;
  wallHit?: { left: boolean; right: boolean; up: boolean; down: boolean };
  dt: number;
}): {
  vx: number;
  vy: number;
  preserveVerticalVelocity: boolean;
  triggeredJump: boolean;
  isMoving: boolean;
  nextSpringState?: Spring2DState;
} {
  const {
    currentCenter,
    currentVelocity,
    targetCenter,
    config,
    springState,
    jumpState,
    isGrounded,
    wallHit,
    dt,
  } = params;

  const safeDt = Math.max(0.0001, Math.min(0.05, dt));
  const dx = targetCenter.x - currentCenter.x;
  const dy = targetCenter.y - currentCenter.y;
  const minDistance = Math.max(0, config.minDistance ?? 40);
  const space = config.movementSpace || 'free_2d';

  jumpState.jumpCooldownTimer = Math.max(0, jumpState.jumpCooldownTimer - safeDt);

  if (space === 'grounded') {
    const distX = Math.abs(dx);
    let vx = currentVelocity.x;
    let nextSpringState: Spring2DState | undefined = springState;

    if (config.followMode === 'spring') {
      const fSpring: Spring2DState = springState
        ? { ...springState, x: currentCenter.x, y: currentCenter.y }
        : { x: currentCenter.x, y: currentCenter.y, vx: currentVelocity.x * 60, vy: 0 };
      const goalX = distX > minDistance && distX > 0.001 ? targetCenter.x - Math.sign(dx) * minDistance : currentCenter.x;
      const res = stepSpring2D({
        state: fSpring,
        targetX: goalX,
        targetY: currentCenter.y,
        stiffness: config.springStiffness ?? 120,
        damping: config.springDamping ?? 10,
        maxDistance: config.springMaxDistance ?? 0,
        dt: safeDt,
      });
      vx = res.vx / 60;
      fSpring.vx = res.vx;
      fSpring.vy = 0;
      nextSpringState = fSpring;
    } else {
      nextSpringState = undefined;
      const followAccel =
        config.acceleration ?? (config.smoothing !== undefined ? Math.max(0.04, Math.min(1, config.smoothing)) : undefined);
      const followDamp = config.damping ?? 0.8;
      if (distX > minDistance) {
        const speed = Math.max(0, config.speed ?? 150) / 60;
        vx = approachAxisVelocity(currentVelocity.x, Math.sign(dx) * speed, followAccel, followDamp, 0.8);
      } else {
        vx = currentVelocity.x * followDamp;
      }
    }

    // Saut automatique si la cible est au-dessus ou face à un obstacle horizontal
    let vy = currentVelocity.y;
    let triggeredJump = false;
    let preserveVerticalVelocity = true;
    if (config.autoJump && isGrounded && jumpState.jumpCooldownTimer <= 0) {
      const heightThresh = Math.max(8, config.jumpHeightThreshold ?? 36);
      const targetIsAbove = dy <= -heightThresh;
      const blockedByWall =
        config.jumpOnWall !== false &&
        distX > minDistance &&
        ((dx > 2 && Boolean(wallHit?.right)) || (dx < -2 && Boolean(wallHit?.left)));
      if (targetIsAbove || blockedByWall) {
        triggeredJump = true;
        preserveVerticalVelocity = false;
        vy = -(Math.max(50, config.jumpForce ?? 420) / 60);
        jumpState.jumpCooldownTimer = Math.max(0.1, config.jumpCooldown ?? 0.7);
      }
    }

    return {
      vx,
      vy,
      preserveVerticalVelocity,
      triggeredJump,
      isMoving: distX > minDistance && Math.abs(vx) > 0.15,
      nextSpringState,
    };
  }

  // Mode Libre 2D (strictement identique au comportement historique)
  const dist = Math.hypot(dx, dy);
  if (config.followMode === 'spring') {
    const fSpring: Spring2DState = springState
      ? { ...springState, x: currentCenter.x, y: currentCenter.y }
      : {
          x: currentCenter.x,
          y: currentCenter.y,
          vx: currentVelocity.x * 60,
          vy: currentVelocity.y * 60,
        };
    let goalX = currentCenter.x;
    let goalY = currentCenter.y;
    if (dist > minDistance && dist > 0.001) {
      goalX = targetCenter.x - (dx / dist) * minDistance;
      goalY = targetCenter.y - (dy / dist) * minDistance;
    }
    const res = stepSpring2D({
      state: fSpring,
      targetX: goalX,
      targetY: goalY,
      stiffness: config.springStiffness ?? 120,
      damping: config.springDamping ?? 10,
      maxDistance: config.springMaxDistance ?? 0,
      dt: safeDt,
    });
    fSpring.vx = res.vx;
    fSpring.vy = res.vy;
    return {
      vx: res.vx / 60,
      vy: res.vy / 60,
      preserveVerticalVelocity: false,
      triggeredJump: false,
      isMoving: dist > minDistance && Math.hypot(res.vx, res.vy) > 9,
      nextSpringState: fSpring,
    };
  }

  const followAccel =
    config.acceleration ?? (config.smoothing !== undefined ? Math.max(0.04, Math.min(1, config.smoothing)) : undefined);
  const followDamp = config.damping ?? 0.8;

  if (dist > minDistance && dist > 0.001) {
    const speed = Math.max(0, config.speed ?? 150) / 60;
    const nextVx = approachAxisVelocity(currentVelocity.x, (dx / dist) * speed, followAccel, followDamp, 0.8);
    const nextVy = approachAxisVelocity(currentVelocity.y, (dy / dist) * speed, followAccel, followDamp, 0.8);
    return {
      vx: nextVx,
      vy: nextVy,
      preserveVerticalVelocity: false,
      triggeredJump: false,
      isMoving: true,
    };
  }

  return {
    vx: currentVelocity.x * followDamp,
    vy: currentVelocity.y * followDamp,
    preserveVerticalVelocity: false,
    triggeredJump: false,
    isMoving: false,
  };
}

/**
 * Détection sur front montant avec hystérésis pour l'événement RuleBook "Arrivé sur cible".
 */
export function evaluateTargetArrivalEdge(params: {
  tracker: ArrivalTrackerState;
  distance: number;
  arrivalThreshold: number;
  exitMargin?: number;
  hasValidTarget: boolean;
}): boolean {
  const { tracker, distance, arrivalThreshold, exitMargin = 14, hasValidTarget } = params;
  if (!hasValidTarget) {
    tracker.wasWithinArrival = false;
    return false;
  }
  const enterThresh = Math.max(1, arrivalThreshold);
  const exitThresh = enterThresh + Math.max(4, exitMargin);
  if (distance <= enterThresh) {
    if (!tracker.wasWithinArrival) {
      tracker.wasWithinArrival = true;
      return true;
    }
    return false;
  }
  if (distance > exitThresh) {
    tracker.wasWithinArrival = false;
  }
  return false;
}

export interface StateCandidateInput {
  boundIds: Set<string>;
  desiredStateId?: string;
}

/**
 * Option A — Coordination propre et non-écrasante des états entre Marionnette Interactive,
 * Contrôle Clavier, Fuite, Suivre, Patrouille et Errance.
 * Les états externes (ex: Blessé, Mort, Attaque, Ramasser) restent 100% intacts.
 */
export function resolveLocomotionAndPuppetState(params: {
  currentStateId: string;
  validStateIds: Set<string>;
  hasHealthOverride?: boolean;
  puppet?: StateCandidateInput & {
    isActiveInteraction: boolean;
    allowInterruptLocomotion: boolean;
  };
  keyboard?: StateCandidateInput;
  flee?: StateCandidateInput & { isScared: boolean };
  follow?: StateCandidateInput;
  patrol?: StateCandidateInput;
  wandering?: StateCandidateInput;
}): string | undefined {
  const {
    currentStateId,
    validStateIds,
    hasHealthOverride = false,
    puppet,
    keyboard,
    flee,
    follow,
    patrol,
    wandering,
  } = params;

  if (hasHealthOverride) return undefined;

  const isValid = (sid?: string): sid is string => Boolean(sid && validStateIds.has(sid));

  const locomotionBoundIds = new Set<string>();
  [keyboard, flee, follow, patrol, wandering].forEach((cand) => {
    if (!cand) return;
    cand.boundIds.forEach((id) => locomotionBoundIds.add(id));
  });

  const puppetHasBounds = Boolean(puppet && puppet.boundIds.size > 0);
  const currentInPuppet = Boolean(puppet && puppet.boundIds.has(currentStateId));
  const currentInLocomotion = locomotionBoundIds.has(currentStateId);

  // 1. Interaction active de Marionnette (Drag, Swing, Shake, Survol, Approche, Chute/Atterrissage Marionnette)
  if (puppet && puppet.isActiveInteraction && puppetHasBounds) {
    const canPuppetControl =
      currentInPuppet || (puppet.allowInterruptLocomotion !== false && currentInLocomotion);
    if (canPuppetControl && isValid(puppet.desiredStateId)) {
      return puppet.desiredStateId !== currentStateId ? puppet.desiredStateId : undefined;
    }
  }

  // 2. Priorité des comportements de locomotion : Keyboard > Flee (effrayé) > Follow > Patrol > Wandering > Flee (calme)
  const orderedLocomotion: Array<StateCandidateInput | undefined> = [
    keyboard,
    flee?.isScared ? flee : undefined,
    follow,
    patrol,
    wandering,
    flee && !flee.isScared ? flee : undefined,
  ];

  // Un comportement de locomotion peut prendre la main si l'état courant est dans locomotionBoundIds
  // OU si la marionnette vient de relâcher (état courant dans puppet.boundIds et !puppet.isActiveInteraction)
  const canLocomotionRun =
    currentInLocomotion || (Boolean(puppet && !puppet.isActiveInteraction) && currentInPuppet);

  if (canLocomotionRun) {
    for (const cand of orderedLocomotion) {
      if (!cand || cand.boundIds.size === 0) continue;
      const candOwnsOrHandoff =
        cand.boundIds.has(currentStateId) ||
        currentInLocomotion ||
        (Boolean(puppet && !puppet.isActiveInteraction) && currentInPuppet);
      if (candOwnsOrHandoff && isValid(cand.desiredStateId)) {
        return cand.desiredStateId !== currentStateId ? cand.desiredStateId : undefined;
      }
    }
  }

  // 3. Marionnette au repos (si aucune locomotion n'a d'état à jouer, ou si Marionnette est seule)
  if (puppet && puppetHasBounds && currentInPuppet && isValid(puppet.desiredStateId)) {
    return puppet.desiredStateId !== currentStateId ? puppet.desiredStateId : undefined;
  }

  return undefined;
}
