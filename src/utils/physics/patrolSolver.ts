import { Entity, PatrolBehaviorConfig, PatrolWaypoint, Position, Size } from '../../types';
import { WorldColliderBounds } from '../collider';

export interface PatrolRuntimeState {
  originCenter: Position;
  direction: 1 | -1;
  timer: number;
  waypointIndex: number;
  waypointDir: 1 | -1;
  wallTurnCooldown: number;
  ledgeTurnCooldown: number;
  entityCollisionTurnCooldown?: number;
  lastLegDistance?: number;
}

export interface ResolvedPatrolPoint {
  x: number;
  y: number;
  pauseSec: number;
}

export function resolvePatrolWaypoints(
  originCenter: Position,
  config: PatrolBehaviorConfig,
  entities: Record<string, Entity>
): ResolvedPatrolPoint[] {
  const points: ResolvedPatrolPoint[] = [];
  const rawList: PatrolWaypoint[] = config.waypoints || [];
  for (const wp of rawList) {
    const isEntityPoint = wp.mode === 'entity' || (!wp.mode && Boolean(wp.entityId));
    const wpPause = Math.max(0, wp.pauseSec ?? wp.pauseDuration ?? 0);
    if (isEntityPoint && wp.entityId) {
      const target = entities[wp.entityId];
      if (target) {
        points.push({
          x: target.position.x + target.size.width / 2,
          y: target.position.y + target.size.height / 2,
          pauseSec: wpPause,
        });
      }
    } else {
      points.push({
        x: wp.x ?? originCenter.x,
        y: wp.y ?? originCenter.y,
        pauseSec: wpPause,
      });
    }
  }
  return points;
}

export function getPatrolMoveDirX(
  state: PatrolRuntimeState,
  currentCenter: Position,
  config: PatrolBehaviorConfig,
  entities: Record<string, Entity>
): 1 | -1 | 0 {
  const patrolMode = config.patrolMode || 'symmetric';
  if (patrolMode === 'waypoints') {
    const waypoints = resolvePatrolWaypoints(state.originCenter, config, entities);
    if (waypoints.length === 0) return 0;
    const idx = Math.max(0, Math.min(waypoints.length - 1, state.waypointIndex));
    const dx = waypoints[idx].x - currentCenter.x;
    return Math.abs(dx) > 1 ? (dx > 0 ? 1 : -1) : 0;
  }
  return (config.axis || 'horizontal') === 'horizontal' ? state.direction : 0;
}

export function stepPatrolBehavior(params: {
  state: PatrolRuntimeState;
  currentCenter: Position;
  config: PatrolBehaviorConfig;
  entities: Record<string, Entity>;
  dt: number;
  wallHit?: { left: boolean; right: boolean; up: boolean; down: boolean };
  ledgeAhead?: boolean; // true = vide détecté devant le sens de déplacement actuel
  entityCollisionHit?: boolean; // true = collision avec une entité filtrée par turnOnCollision
}): {
  vx: number;
  vy: number;
  preserveVerticalVelocity: boolean;
  turned: boolean;
  facingDirX: 1 | -1 | 0;
} {
  const { state, currentCenter, config, entities, dt, wallHit, ledgeAhead, entityCollisionHit } = params;
  const safeDt = Math.max(0.001, Math.min(0.05, dt));
  const speed = Math.max(0, config.speed ?? 120);
  const pauseDuration = Math.max(0, config.pauseAtEnds ?? config.pauseDuration ?? 0.3);
  const axis = config.axis || 'horizontal';
  const patrolMode = config.patrolMode || 'symmetric';
  const isGroundedWaypoints = patrolMode === 'waypoints' && config.movementSpace === 'grounded';

  state.wallTurnCooldown = Math.max(0, state.wallTurnCooldown - safeDt);
  state.ledgeTurnCooldown = Math.max(0, state.ledgeTurnCooldown - safeDt);
  state.entityCollisionTurnCooldown = Math.max(0, (state.entityCollisionTurnCooldown ?? 0) - safeDt);

  if (state.timer > 0) {
    state.timer = Math.max(0, state.timer - safeDt);
    // Ne rester en pause que s'il reste réellement du temps ; si timer vient d'atteindre 0,
    // enchaîner immédiatement sur le déplacement + flip dans la même frame (0 frame de latence).
    if (state.timer > 0) {
      return {
        vx: 0,
        vy: 0,
        preserveVerticalVelocity: (axis === 'horizontal' && patrolMode !== 'waypoints') || isGroundedWaypoints,
        turned: false,
        facingDirX: 0,
      };
    }
  }

  // Mode 3 : Multi-points (Waypoints)
  if (patrolMode === 'waypoints') {
    const waypoints = resolvePatrolWaypoints(state.originCenter, config, entities);
    if (waypoints.length > 0) {
      if (state.waypointIndex >= waypoints.length) {
        state.waypointIndex = waypoints.length - 1;
      }
      if (state.waypointIndex < 0) {
        state.waypointIndex = 0;
      }
      const targetPt = waypoints[state.waypointIndex];
      const dx = targetPt.x - currentCenter.x;
      const dy = targetPt.y - currentCenter.y;
      const dist = isGroundedWaypoints ? Math.abs(dx) : Math.hypot(dx, dy);

      const hitWallInWpDir =
        Boolean(config.turnOnWall) &&
        state.wallTurnCooldown <= 0 &&
        ((dx < -1 && wallHit?.left) || (dx > 1 && wallHit?.right));
      const hitLedgeInWpDir =
        isGroundedWaypoints &&
        Boolean(config.detectLedges) &&
        state.ledgeTurnCooldown <= 0 &&
        Boolean(ledgeAhead);

      const hitEntityInWpDir =
        Boolean(config.turnOnCollision) &&
        (state.entityCollisionTurnCooldown ?? 0) <= 0 &&
        Boolean(entityCollisionHit);

      // Demi-tour mur / vide / collision entité en mode waypoints si configuré
      if (hitWallInWpDir || hitLedgeInWpDir || hitEntityInWpDir) {
        if (hitWallInWpDir) state.wallTurnCooldown = 0.16;
        if (hitLedgeInWpDir) state.ledgeTurnCooldown = 0.22;
        if (hitEntityInWpDir) {
          state.entityCollisionTurnCooldown = Math.max(0.05, config.collisionTurnCooldownSec ?? 0.25);
        }
        if (waypoints.length >= 2) {
          state.waypointDir = state.waypointDir === 1 ? -1 : 1;
          state.waypointIndex = Math.max(0, Math.min(waypoints.length - 1, state.waypointIndex + state.waypointDir));
          const nextPt = waypoints[state.waypointIndex];
          const nextDirX: 1 | -1 | 0 = nextPt
            ? Math.abs(nextPt.x - currentCenter.x) > 1
              ? nextPt.x > currentCenter.x
                ? 1
                : -1
              : 0
            : 0;
          return { vx: 0, vy: 0, preserveVerticalVelocity: isGroundedWaypoints, turned: true, facingDirX: nextDirX };
        }
        state.timer = Math.max(0.2, pauseDuration * 0.5);
        return { vx: 0, vy: 0, preserveVerticalVelocity: isGroundedWaypoints, turned: true, facingDirX: 0 };
      }

      const arrivalRadius = Math.max(6, speed * safeDt * 1.5);
      if (dist <= arrivalRadius) {
        const ptPause = targetPt.pauseSec > 0 ? targetPt.pauseSec : pauseDuration;
        state.timer = ptPause;
        if (waypoints.length >= 2) {
          const loopMode = config.waypointLoopMode || 'ping_pong';
          if (loopMode === 'loop') {
            state.waypointIndex = (state.waypointIndex + 1) % waypoints.length;
          } else {
            let nextIdx = state.waypointIndex + state.waypointDir;
            if (nextIdx >= waypoints.length || nextIdx < 0) {
              state.waypointDir = state.waypointDir === 1 ? -1 : 1;
              nextIdx = state.waypointIndex + state.waypointDir;
            }
            state.waypointIndex = Math.max(0, Math.min(waypoints.length - 1, nextIdx));
          }
        }
        return { vx: 0, vy: 0, preserveVerticalVelocity: isGroundedWaypoints, turned: true, facingDirX: 0 };
      }

      if (isGroundedWaypoints) {
        const vx = Math.sign(dx) * speed;
        return {
          vx,
          vy: 0,
          preserveVerticalVelocity: true,
          turned: false,
          facingDirX: Math.abs(vx) > 5 ? (vx > 0 ? 1 : -1) : 0,
        };
      }

      const ux = dx / dist;
      const uy = dy / dist;
      const vx = ux * speed;
      const vy = uy * speed;
      return {
        vx,
        vy,
        preserveVerticalVelocity: false,
        turned: false,
        facingDirX: Math.abs(vx) > 5 ? (vx > 0 ? 1 : -1) : 0,
      };
    }
  }

  // Modes 1 & 2 : Axe 1D (Symétrique [-range, +range] ou Aller simple [0, +range])
  const range = Math.max(10, config.range ?? 150);
  const minOffset = patrolMode === 'one_way_return' ? 0 : -range;
  const maxOffset = range;

  const offset =
    axis === 'horizontal'
      ? currentCenter.x - state.originCenter.x
      : currentCenter.y - state.originCenter.y;

  // Vérification collision mur latéral, vide ou entité sur l'axe horizontal
  const hitEntityCollision =
    Boolean(config.turnOnCollision) &&
    (state.entityCollisionTurnCooldown ?? 0) <= 0 &&
    Boolean(entityCollisionHit);

  if (axis === 'horizontal') {
    const hitWallInMoveDir =
      Boolean(config.turnOnWall) &&
      state.wallTurnCooldown <= 0 &&
      ((state.direction === 1 && wallHit?.right) || (state.direction === -1 && wallHit?.left));
    const hitLedgeInMoveDir =
      Boolean(config.detectLedges) && state.ledgeTurnCooldown <= 0 && Boolean(ledgeAhead);

    if (hitWallInMoveDir || hitLedgeInMoveDir || hitEntityCollision) {
      state.direction = state.direction === 1 ? -1 : 1;
      state.timer = pauseDuration * 0.4;
      if (hitWallInMoveDir) state.wallTurnCooldown = 0.18;
      if (hitLedgeInMoveDir) state.ledgeTurnCooldown = 0.22;
      if (hitEntityCollision) {
        state.entityCollisionTurnCooldown = Math.max(0.05, config.collisionTurnCooldownSec ?? 0.25);
      }
      return {
        vx: 0,
        vy: 0,
        preserveVerticalVelocity: true,
        turned: true,
        facingDirX: state.direction,
      };
    }
  } else if (
    (config.turnOnWall &&
      state.wallTurnCooldown <= 0 &&
      ((state.direction === 1 && wallHit?.down) || (state.direction === -1 && wallHit?.up))) ||
    hitEntityCollision
  ) {
    state.direction = state.direction === 1 ? -1 : 1;
    state.timer = pauseDuration * 0.4;
    if (hitEntityCollision) {
      state.entityCollisionTurnCooldown = Math.max(0.05, config.collisionTurnCooldownSec ?? 0.25);
    } else {
      state.wallTurnCooldown = 0.18;
    }
    return {
      vx: 0,
      vy: 0,
      preserveVerticalVelocity: false,
      turned: true,
      facingDirX: 0,
    };
  }

  // Butées symétriques [-range, +range] ou aller simple [0, +range]
  if (state.direction === 1 && offset >= maxOffset) {
    state.direction = -1;
    state.timer = pauseDuration;
    return {
      vx: 0,
      vy: 0,
      preserveVerticalVelocity: axis === 'horizontal',
      turned: true,
      facingDirX: 0,
    };
  }
  if (state.direction === -1 && offset <= minOffset) {
    state.direction = 1;
    state.timer = pauseDuration;
    return {
      vx: 0,
      vy: 0,
      preserveVerticalVelocity: axis === 'horizontal',
      turned: true,
      facingDirX: 0,
    };
  }

  const vx = axis === 'horizontal' ? state.direction * speed : 0;
  const vy = axis === 'vertical' ? state.direction * speed : 0;
  return {
    vx,
    vy,
    preserveVerticalVelocity: axis === 'horizontal',
    turned: false,
    facingDirX: axis === 'horizontal' ? state.direction : 0,
  };
}

export function detectLedgeAheadFromSolids(params: {
  bounds: WorldColliderBounds;
  dirX: 1 | -1;
  checkDepth?: number;
  solidRects: Array<{ x: number; y: number; width: number; height: number }>;
  sceneBounds?: Size;
  extraProbeFn?: (probeX: number, probeY: number) => boolean;
}): boolean {
  const { bounds, dirX, checkDepth = 28, solidRects, sceneBounds, extraProbeFn } = params;
  const footY = bounds.y + bounds.height;
  const leadX = dirX > 0 ? bounds.x + bounds.width + 6 : bounds.x - 6;
  const depth = Math.max(8, Math.min(96, checkDepth));

  // Vérifier d'abord que l'entité a bien un support sous elle (sinon elle est déjà en chute libre, ne pas inverser en plein saut)
  const underX = bounds.centerX;
  let hasUnderSupport = false;
  if (sceneBounds && footY >= sceneBounds.height - 6) {
    hasUnderSupport = true;
  }
  if (!hasUnderSupport) {
    for (const r of solidRects) {
      if (underX >= r.x - 4 && underX <= r.x + r.width + 4 && r.y >= footY - 8 && r.y <= footY + 12) {
        hasUnderSupport = true;
        break;
      }
    }
  }
  if (!hasUnderSupport && extraProbeFn) {
    if (extraProbeFn(underX, footY + 4) || extraProbeFn(underX, footY + 10)) {
      hasUnderSupport = true;
    }
  }
  if (!hasUnderSupport) {
    return false;
  }

  // Sondage devant le bord avant de l'entité
  if (sceneBounds && footY >= sceneBounds.height - 6) {
    if (leadX >= 2 && leadX <= sceneBounds.width - 2) {
      return false;
    }
    return true;
  }

  for (const r of solidRects) {
    if (leadX >= r.x - 2 && leadX <= r.x + r.width + 2 && r.y >= footY - 10 && r.y <= footY + depth) {
      return false; // Sol solide présent devant
    }
  }

  if (extraProbeFn) {
    const steps = 3;
    for (let i = 1; i <= steps; i++) {
      const py = footY + (depth * i) / steps;
      if (extraProbeFn(leadX, py)) {
        return false;
      }
    }
  }

  return true;
}
