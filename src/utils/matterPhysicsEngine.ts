import Matter from 'matter-js';
import {
  Entity,
  EntityBehavior,
  EntityState,
  Position,
  PhysicsBehaviorConfig,
  DraggableBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  LookAtBehaviorConfig,
  FollowBehaviorConfig,
  MoveToBehaviorConfig,
  PatrolBehaviorConfig,
  WanderingBehaviorConfig,
  FleeBehaviorConfig,
  KeyboardControlBehaviorConfig,
  BoundaryBehaviorConfig,
  AutoDestroyBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  SceneLayer,
} from '../types';
import { getEntityColliderBounds, resolveColliderState } from './collider';
import { emitParticlesBurst } from './particleSystem';

const { Engine, World, Bodies, Body } = Matter;

/**
 * Résout les comportements effectifs d'une entité pour son état actuel
 * en fusionnant la configuration de base avec les surcharges de l'état.
 */
export function getEffectiveBehaviors(
  entity: Entity,
  currentState?: EntityState
): EntityBehavior[] {
  const baseBehaviors = entity.behaviors || [];
  const overrides = currentState?.behaviorOverrides || {};

  return baseBehaviors
    .map((b) => {
      const override = overrides[b.id];
      if (!override) {
        return b.enabled ? b : null;
      }
      if (override.enabled === false) {
        return null;
      }
      return {
        ...b,
        ...override,
        enabled: override.enabled ?? b.enabled,
      } as EntityBehavior;
    })
    .filter((b): b is EntityBehavior => b !== null && b.enabled !== false);
}

/**
 * Détermine si une entité est déplaçable à la souris et si l'inertie de lancer est activée.
 * L'inertie de lancer (throwable) n'est active que si l'entité dispose d'une physique dynamique (pas statique).
 */
export function isEntityDraggable(entity: Entity, currentState?: EntityState): {
  canDrag: boolean;
  throwable: boolean;
  maxThrowSpeed: number;
  hasDynamicPhysics: boolean;
} {
  const effective = getEffectiveBehaviors(entity, currentState);
  const dragBehavior = effective.find((b) => b.type === 'draggable') as DraggableBehaviorConfig | undefined;
  const physics = effective.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;

  // Une entité n'a de physique dynamique que si le composant 'physics' est présent et n'est pas statique
  const hasDynamicPhysics = !!physics && physics.isStatic !== true;

  if (dragBehavior) {
    return {
      canDrag: dragBehavior.enabled !== false,
      throwable: (dragBehavior.throwable !== false) && hasDynamicPhysics,
      maxThrowSpeed: dragBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
    };
  }

  // Par défaut en mode Play, les entités ne sont PAS draggables sans le composant 'draggable' actif
  return {
    canDrag: false,
    throwable: false,
    maxThrowSpeed: 1500,
    hasDynamicPhysics,
  };
}

// État mémoire de la simulation Matter.js
let engine: Matter.Engine | null = null;
const bodyMap = new Map<string, Matter.Body>();
const colliderOffsets = new Map<string, { relCenterX: number; relCenterY: number }>();
const bodySignatures = new Map<string, string>();
const colliderLayerBodyMap = new Map<string, Matter.Body[]>();
const colliderLayerSignatures = new Map<string, string>();
const boundaryBodies: Matter.Body[] = [];
const patrolStates = new Map<string, { direction: 1 | -1; timer: number; initialPos: Position }>();
interface WanderingRuntimeState {
  origin: Position;
  targetPoint: Position | null;
  moveTimer: number;
  pauseTimer: number;
  currentAngle: number;
}
const wanderingStates = new Map<string, WanderingRuntimeState>();
const activeKeys = new Set<string>();
let listenersAttached = false;

function handleKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.add(e.key.toLowerCase());
  activeKeys.add(e.code);
}

function handleKeyUp(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.delete(e.key.toLowerCase());
  activeKeys.delete(e.code);
}

export function startKeyboardListening() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  listenersAttached = true;
}

export function stopKeyboardListening() {
  if (!listenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  activeKeys.clear();
  listenersAttached = false;
}

const activePhysicsCollisionPairs = new Set<string>();
const activePhysicsCollisionContacts = new Map<string, Position>();
const groundedEntityIds = new Set<string>();
const jumpTrackers = new Map<string, { jumpsUsed: number; wasJumpPressed: boolean }>();
const rebuildingBodyIds = new Set<string>();
const activeDragPositions: Record<string, Position> = {};
const autoDestroyTimers = new Map<string, number>();
const particleEmitterAccumulators = new Map<string, number>();
const hierarchyGroupIds = new Map<string, number>();
let nextNegativeGroupId = -100;

function getRootAncestorId(entityId: string, entities: Record<string, Entity>): string {
  let curr = entities[entityId];
  const visited = new Set<string>();
  while (curr && curr.parentId && entities[curr.parentId] && !visited.has(curr.id)) {
    visited.add(curr.id);
    curr = entities[curr.parentId];
  }
  return curr ? curr.id : entityId;
}

function getHierarchyCollisionGroup(entity: Entity, entities: Record<string, Entity>): number {
  const hasChildren = Object.values(entities).some((e) => e.parentId === entity.id);
  const hasParent = !!(entity.parentId && entities[entity.parentId]);
  if (!hasParent && !hasChildren) return 0;

  const rootId = getRootAncestorId(entity.id, entities);
  let group = hierarchyGroupIds.get(rootId);
  if (!group) {
    group = nextNegativeGroupId--;
    hierarchyGroupIds.set(rootId, group);
  }
  return group;
}

function sortEntitiesTopologically(entities: Record<string, Entity>): Entity[] {
  const list = Object.values(entities);
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const result: Entity[] = [];

  const visit = (ent: Entity) => {
    if (visited.has(ent.id)) return;
    if (visiting.has(ent.id)) return; // cycle guard
    visiting.add(ent.id);
    if (ent.parentId && entities[ent.parentId]) {
      visit(entities[ent.parentId]);
    }
    visiting.delete(ent.id);
    visited.add(ent.id);
    result.push(ent);
  };

  for (const ent of list) {
    visit(ent);
  }
  return result;
}

export function getActivePhysicsCollisionPairs(): Set<string> {
  return activePhysicsCollisionPairs;
}

export function getPhysicsCollisionContact(idA: string, idB: string): Position | undefined {
  return activePhysicsCollisionContacts.get(`${idA}:::${idB}`);
}

/**
 * Calcule le point le plus proche entre un point P et un segment [A, B], ainsi que la distance.
 */
function closestPointOnSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): { x: number; y: number; dist: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq <= 0.0001) {
    return { x: ax, y: ay, dist: Math.hypot(px - ax, py - ay) };
  }
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { x: cx, y: cy, dist: Math.hypot(px - cx, py - cy) };
}

/**
 * Vérifie si une entité entre en contact avec un calque Collider de décor (via Matter.js ou géométrie exacte des segments).
 */
export function checkEntityAgainstColliderLayer(
  entityBounds: { x: number; y: number; width: number; height: number; centerX: number; centerY: number; radius: number; colliderType: string },
  entityId: string,
  layer: SceneLayer,
  canvasBounds: { width: number; height: number },
  tolerancePx: number = 3
): { colliding: boolean; contactPoint?: Position } {
  const layerBodyLabel = `layercol::${layer.id}`;
  if (
    activePhysicsCollisionPairs.has(`${entityId}:::${layerBodyLabel}`) ||
    activePhysicsCollisionPairs.has(`${layerBodyLabel}:::${entityId}`)
  ) {
    return {
      colliding: true,
      contactPoint:
        activePhysicsCollisionContacts.get(`${entityId}:::${layerBodyLabel}`) ||
        activePhysicsCollisionContacts.get(`${layerBodyLabel}:::${entityId}`),
    };
  }

  const paths = layer.vectorPaths || [];
  if (paths.length === 0) return { colliding: false };

  const isLegacy200 = layer.coordinateSpace === 'legacy_200';
  const sx = isLegacy200 ? Math.max(100, canvasBounds.width) / 200 : 1;
  const sy = isLegacy200 ? Math.max(100, canvasBounds.height) / 200 : 1;
  const tol = tolerancePx;

  const entIsCircle = entityBounds.colliderType === 'circle';
  const entHalfW = entityBounds.width / 2;
  const entHalfH = entityBounds.height / 2;
  // Rayon effectif approximatif pour les tests segment/cercle rapides et fidèles à la boîte
  const boxReach = entIsCircle ? entityBounds.radius : Math.max(entHalfW, entHalfH);

  for (const p of paths) {
    const halfStroke = Math.max(2, ((p.strokeWidth || 6) * ((sx + sy) / 2)) / 2);

    if (p.rect && Math.abs(p.rect.width) > 1 && Math.abs(p.rect.height) > 1) {
      const rw = Math.abs(p.rect.width) * sx;
      const rh = Math.abs(p.rect.height) * sy;
      const rx = (p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x) * sx;
      const ry = (p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y) * sy;

      const closestX = Math.max(rx - halfStroke, Math.min(entityBounds.centerX, rx + rw + halfStroke));
      const closestY = Math.max(ry - halfStroke, Math.min(entityBounds.centerY, ry + rh + halfStroke));

      if (entIsCircle) {
        const d = Math.hypot(entityBounds.centerX - closestX, entityBounds.centerY - closestY);
        if (d <= entityBounds.radius + tol) {
          return { colliding: true, contactPoint: { x: Math.round(closestX), y: Math.round(closestY) } };
        }
      } else if (
        entityBounds.x <= rx + rw + halfStroke + tol &&
        entityBounds.x + entityBounds.width + tol >= rx - halfStroke &&
        entityBounds.y <= ry + rh + halfStroke + tol &&
        entityBounds.y + entityBounds.height + tol >= ry - halfStroke
      ) {
        return { colliding: true, contactPoint: { x: Math.round(closestX), y: Math.round(closestY) } };
      }
      continue;
    }

    if ((p as any).circle && (p as any).circle.r > 1) {
      const c = (p as any).circle;
      const cx = c.cx * sx;
      const cy = c.cy * sy;
      const cr = c.r * Math.max(sx, sy) + halfStroke;
      if (entIsCircle) {
        const d = Math.hypot(entityBounds.centerX - cx, entityBounds.centerY - cy);
        if (d <= entityBounds.radius + cr + tol) {
          const t = d > 0 ? cr / d : 0.5;
          return {
            colliding: true,
            contactPoint: { x: Math.round(cx + (entityBounds.centerX - cx) * t), y: Math.round(cy + (entityBounds.centerY - cy) * t) },
          };
        }
      } else {
        const closestX = Math.max(entityBounds.x, Math.min(cx, entityBounds.x + entityBounds.width));
        const closestY = Math.max(entityBounds.y, Math.min(cy, entityBounds.y + entityBounds.height));
        if (Math.hypot(cx - closestX, cy - closestY) <= cr + tol) {
          return { colliding: true, contactPoint: { x: Math.round(closestX), y: Math.round(closestY) } };
        }
      }
      continue;
    }

    const pts = (p.points || []).map((pt) => ({ x: pt.x * sx, y: pt.y * sy }));
    if (pts.length === 0) continue;

    if (pts.length === 1) {
      const pt = pts[0];
      if (entIsCircle) {
        if (Math.hypot(entityBounds.centerX - pt.x, entityBounds.centerY - pt.y) <= entityBounds.radius + halfStroke + tol) {
          return { colliding: true, contactPoint: { x: Math.round(pt.x), y: Math.round(pt.y) } };
        }
      } else {
        const closestX = Math.max(entityBounds.x, Math.min(pt.x, entityBounds.x + entityBounds.width));
        const closestY = Math.max(entityBounds.y, Math.min(pt.y, entityBounds.y + entityBounds.height));
        if (Math.hypot(pt.x - closestX, pt.y - closestY) <= halfStroke + tol) {
          return { colliding: true, contactPoint: { x: Math.round(closestX), y: Math.round(closestY) } };
        }
      }
      continue;
    }

    const step = Math.max(1, Math.floor(pts.length / 48));
    for (let i = 0; i < pts.length - 1; i += step) {
      const a = pts[i];
      const b = pts[Math.min(pts.length - 1, i + step)];
      // Broadphase rapide sur le segment
      const segMinX = Math.min(a.x, b.x) - halfStroke - tol;
      const segMaxX = Math.max(a.x, b.x) + halfStroke + tol;
      const segMinY = Math.min(a.y, b.y) - halfStroke - tol;
      const segMaxY = Math.max(a.y, b.y) + halfStroke + tol;
      if (
        entityBounds.x + entityBounds.width < segMinX ||
        entityBounds.x > segMaxX ||
        entityBounds.y + entityBounds.height < segMinY ||
        entityBounds.y > segMaxY
      ) {
        continue;
      }

      const hit = closestPointOnSegment(entityBounds.centerX, entityBounds.centerY, a.x, a.y, b.x, b.y);
      if (entIsCircle) {
        if (hit.dist <= entityBounds.radius + halfStroke + tol) {
          return { colliding: true, contactPoint: { x: Math.round(hit.x), y: Math.round(hit.y) } };
        }
      } else {
        // Test précis entre la boîte AABB de l'entité et la capsule du segment
        const closestInBoxX = Math.max(entityBounds.x, Math.min(hit.x, entityBounds.x + entityBounds.width));
        const closestInBoxY = Math.max(entityBounds.y, Math.min(hit.y, entityBounds.y + entityBounds.height));
        const dBox = closestPointOnSegment(closestInBoxX, closestInBoxY, a.x, a.y, b.x, b.y);
        if (dBox.dist <= halfStroke + tol || (hit.dist <= boxReach + halfStroke + tol &&
            hit.x >= entityBounds.x - halfStroke - tol &&
            hit.x <= entityBounds.x + entityBounds.width + halfStroke + tol &&
            hit.y >= entityBounds.y - halfStroke - tol &&
            hit.y <= entityBounds.y + entityBounds.height + halfStroke + tol)) {
          return { colliding: true, contactPoint: { x: Math.round(dBox.x), y: Math.round(dBox.y) } };
        }
      }
    }
  }

  return { colliding: false };
}

export function resetMatterPhysicsRuntime() {
  if (engine) {
    World.clear(engine.world, false);
    Engine.clear(engine);
    engine = null;
  }
  bodyMap.clear();
  colliderOffsets.clear();
  bodySignatures.clear();
  colliderLayerBodyMap.clear();
  colliderLayerSignatures.clear();
  boundaryBodies.length = 0;
  patrolStates.clear();
  wanderingStates.clear();
  activeKeys.clear();
  activePhysicsCollisionPairs.clear();
  activePhysicsCollisionContacts.clear();
  groundedEntityIds.clear();
  jumpTrackers.clear();
  rebuildingBodyIds.clear();
  Object.keys(activeDragPositions).forEach((k) => delete activeDragPositions[k]);
  autoDestroyTimers.clear();
  particleEmitterAccumulators.clear();
  hierarchyGroupIds.clear();
  nextNegativeGroupId = -100;
}

/**
 * Déplace une entité pendant le mode Play (translation directe exacte ou impulsion physique)
 * tout en maintenant le corps Matter.js parfaitement synchronisé.
 */
export function applyEntityMoveAction(
  entityId: string,
  dx: number,
  dy: number,
  mode: 'instant' | 'impulse' = 'instant'
): boolean {
  const body = bodyMap.get(entityId);
  if (!body) return false;

  Matter.Sleeping.set(body, false);
  if (mode === 'impulse' && !body.isStatic) {
    // Impulsion proportionnelle à la distance (dx/dy px convertis en vitesse initiale px/frame)
    const scale = 3.5 / 60;
    const maxStepSpeed = 25;
    const vx = Math.max(-maxStepSpeed, Math.min(maxStepSpeed, body.velocity.x + dx * scale));
    const vy = Math.max(-maxStepSpeed, Math.min(maxStepSpeed, body.velocity.y + dy * scale));
    Body.setVelocity(body, { x: vx, y: vy });
    return true;
  }

  Body.translate(body, { x: dx, y: dy });
  return false;
}

/**
 * Injecte instantanément une vitesse physique dans un corps Matter.js (ex: lancer à la souris)
 * vx et vy sont fournis en px/s et convertis rigoureusement en unités de pas Matter.js (~60Hz).
 */
export function setEntityRuntimeVelocity(entityId: string, vx: number, vy: number) {
  const body = bodyMap.get(entityId);
  if (body) {
    // Si l'objet est statique (pas de physique dynamique), refuser toute impulsion
    if (body.isStatic) return;

    Matter.Sleeping.set(body, false);

    // Conversion px/s -> px/frame Matter.js (~60Hz)
    const matterVx = vx / 60;
    const matterVy = vy / 60;

    // Plafond de sécurité absolu (max 25 px/frame = 1500 px/s)
    const maxSpeedPerTick = 25;
    const speed = Math.hypot(matterVx, matterVy);
    let finalVx = matterVx;
    let finalVy = matterVy;
    if (speed > maxSpeedPerTick) {
      finalVx = (matterVx / speed) * maxSpeedPerTick;
      finalVy = (matterVy / speed) * maxSpeedPerTick;
    }

    Body.setVelocity(body, { x: finalVx, y: finalVy });
  }
}

export function setActiveDragPosition(entityId: string, position: Position | null) {
  if (position && !Number.isNaN(position.x) && !Number.isNaN(position.y)) {
    activeDragPositions[entityId] = { x: position.x, y: position.y };
  } else {
    delete activeDragPositions[entityId];
  }
}

export function getActiveDragPositions(): Record<string, Position> {
  return activeDragPositions;
}

/**
 * Synchronise la position d'un corps pendant un drag manuel à la souris
 * en tenant compte du décalage exact du collider calculé depuis le mode dessin.
 */
export function syncEntityDragPosition(
  entityId: string,
  left: number,
  top: number,
  width?: number,
  height?: number
) {
  setActiveDragPosition(entityId, { x: left, y: top });
  const body = bodyMap.get(entityId);
  if (body) {
    const offset = colliderOffsets.get(entityId) || {
      relCenterX: (width ?? 100) / 2,
      relCenterY: (height ?? 100) / 2,
    };
    const cx = left + offset.relCenterX;
    const cy = top + offset.relCenterY;
    Matter.Sleeping.set(body, false);
    Body.setPosition(body, { x: cx, y: cy });
    Body.setVelocity(body, { x: 0, y: 0 });
  }
}

export interface PhysicsTickResult {
  updatedTransforms: Record<string, { position: Position; rotation?: number; flipX?: boolean }>;
  entitiesToDestroy?: string[];
}

/**
 * Calcule la différence angulaire la plus courte en radians dans [-PI, +PI],
 * sans bogue de modulo négatif ni saut autour de ±180°.
 */
function shortestAngleDiffRad(fromRad: number, toRad: number): number {
  const twoPi = Math.PI * 2;
  return ((((toRad - fromRad) % twoPi) + twoPi + Math.PI) % twoPi) - Math.PI;
}

/**
 * Décimation légère d'une polyligne pour produire des capsules de collision fluides et performantes.
 */
function decimatePolyline(points: Position[], minDist: number): Position[] {
  if (points.length <= 2) return points;
  const result: Position[] = [points[0]];
  let last = points[0];
  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    if (Math.hypot(pt.x - last.x, pt.y - last.y) >= minDist) {
      result.push(pt);
      last = pt;
    }
  }
  const finalPt = points[points.length - 1];
  if (Math.hypot(finalPt.x - last.x, finalPt.y - last.y) >= 1) {
    result.push(finalPt);
  }
  return result;
}

/**
 * Construit les corps statiques Matter.js précis correspondant aux tracés d'un calque Collider.
 */
function buildColliderLayerBodies(
  layer: SceneLayer,
  canvasBounds: { width: number; height: number }
): Matter.Body[] {
  const bodies: Matter.Body[] = [];
  const label = `layercol::${layer.id}`;
  const isSensor = Boolean(layer.colliderIsTrigger);
  const friction = Math.max(0, Math.min(1, layer.colliderFriction ?? 0.8));
  const frictionStatic = Math.max(0.1, friction * 1.2);
  const restitution = Math.max(0, Math.min(1, layer.colliderBounce ?? 0.0));
  const isLegacy200 = layer.coordinateSpace === 'legacy_200';
  const sx = isLegacy200 ? Math.max(100, canvasBounds.width) / 200 : 1;
  const sy = isLegacy200 ? Math.max(100, canvasBounds.height) / 200 : 1;

  for (const p of layer.vectorPaths || []) {
    const thickness = Math.max(4, (p.strokeWidth || 6) * ((sx + sy) / 2));

    if (p.rect && Math.abs(p.rect.width) > 1 && Math.abs(p.rect.height) > 1) {
      const rw = Math.abs(p.rect.width) * sx;
      const rh = Math.abs(p.rect.height) * sy;
      const rx = (p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x) * sx;
      const ry = (p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y) * sy;
      bodies.push(
        Bodies.rectangle(rx + rw / 2, ry + rh / 2, Math.max(4, rw), Math.max(4, rh), {
          isStatic: true,
          isSensor,
          friction,
          frictionStatic,
          restitution,
          label,
        })
      );
      continue;
    }

    if ((p as any).circle && (p as any).circle.r > 1) {
      const c = (p as any).circle;
      bodies.push(
        Bodies.circle(c.cx * sx, c.cy * sy, Math.max(3, c.r * Math.max(sx, sy)), {
          isStatic: true,
          isSensor,
          friction,
          frictionStatic,
          restitution,
          label,
        })
      );
      continue;
    }

    let pts = (p.points || []).map((pt) => ({ x: pt.x * sx, y: pt.y * sy }));
    if (pts.length === 0 && p.d) {
      const nums = p.d.match(/-?\d+(?:\.\d+)?/g);
      if (nums && nums.length >= 2) {
        for (let i = 0; i + 1 < nums.length; i += 2) {
          pts.push({ x: parseFloat(nums[i]) * sx, y: parseFloat(nums[i + 1]) * sy });
        }
      }
    }

    if (pts.length === 0) continue;

    if (pts.length === 1) {
      bodies.push(
        Bodies.circle(pts[0].x, pts[0].y, thickness / 2, {
          isStatic: true,
          isSensor,
          friction,
          frictionStatic,
          restitution,
          label,
        })
      );
      continue;
    }

    const simplified = decimatePolyline(pts, Math.max(8, thickness * 0.7));
    const parts: Matter.Body[] = [];
    for (let i = 0; i < simplified.length - 1; i++) {
      const a = simplified[i];
      const b = simplified[i + 1];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const len = Math.hypot(dx, dy);
      if (len < 0.5) continue;
      const angle = Math.atan2(dy, dx);
      const segW = len + thickness * 0.8;
      const chamferR = Math.max(1, Math.min(thickness * 0.45, segW * 0.42));
      const part = Bodies.rectangle(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        segW,
        thickness,
        {
          angle,
          label,
          friction,
          frictionStatic,
          restitution,
          chamfer: { radius: chamferR },
        }
      );
      parts.push(part);
    }

    if (parts.length === 1) {
      parts[0].isStatic = true;
      parts[0].isSensor = isSensor;
      parts[0].friction = friction;
      parts[0].frictionStatic = frictionStatic;
      parts[0].restitution = restitution;
      Body.setStatic(parts[0], true);
      bodies.push(parts[0]);
    } else if (parts.length > 1) {
      const compound = Body.create({
        parts,
        isStatic: true,
        isSensor,
        friction,
        frictionStatic,
        restitution,
        label,
      });
      Body.setStatic(compound, true);
      bodies.push(compound);
    }
  }

  return bodies;
}

/**
 * Initialise le monde physique Matter.js avec les entités et bordures de scène
 * en calibrant les corps rigides rigoureusement sur les colliders verts du mode dessin.
 */
function ensurePhysicsWorld(
  canvasBounds: { width: number; height: number },
  entities: Record<string, Entity>,
  colliderLayers: SceneLayer[] = []
) {
  if (!engine) {
    engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: false,
    });

    const getBodyLabel = (b: Matter.Body) => b.parent?.label || b.label;

    const recordContactFromPair = (pair: Matter.Pair) => {
      const idA = getBodyLabel(pair.bodyA);
      const idB = getBodyLabel(pair.bodyB);
      if (!idA || !idB) return;

      activePhysicsCollisionPairs.add(`${idA}:::${idB}`);
      activePhysicsCollisionPairs.add(`${idB}:::${idA}`);

      const contacts = (pair as any).activeContacts || (pair as any).contacts || [];
      let contactX = (pair.bodyA.position.x + pair.bodyB.position.x) / 2;
      let contactY = (pair.bodyA.position.y + pair.bodyB.position.y) / 2;
      if (contacts.length > 0) {
        let sx = 0;
        let sy = 0;
        let count = 0;
        for (const c of contacts) {
          const v = c?.vertex || c;
          if (v && typeof v.x === 'number' && typeof v.y === 'number') {
            sx += v.x;
            sy += v.y;
            count++;
          }
        }
        if (count > 0) {
          contactX = sx / count;
          contactY = sy / count;
        }
      }
      const pt = { x: Math.round(contactX * 10) / 10, y: Math.round(contactY * 10) / 10 };
      activePhysicsCollisionContacts.set(`${idA}:::${idB}`, pt);
      activePhysicsCollisionContacts.set(`${idB}:::${idA}`, pt);

      // Détection précise du contact au sol (surfaces solides sous l'entité, jamais les capteurs ni les murs verticaux)
      const bodyA = pair.bodyA;
      const bodyB = pair.bodyB;
      if (!bodyA.isSensor && !bodyB.isSensor) {
        if (idB === 'boundary_ground') {
          groundedEntityIds.add(idA);
        } else if (idA === 'boundary_ground') {
          groundedEntityIds.add(idB);
        } else {
          const normalY = Math.abs((pair as any).collision?.normal?.y ?? 0);
          if (normalY > 0.45) {
            if (!idA.startsWith('boundary_') && !idA.startsWith('layercol::') && contactY >= bodyA.position.y - 2) {
              groundedEntityIds.add(idA);
            }
            if (!idB.startsWith('boundary_') && !idB.startsWith('layercol::') && contactY >= bodyB.position.y - 2) {
              groundedEntityIds.add(idB);
            }
          }
        }
      }
    };

    // Écouteur de collisions pour capture temps-réel et rebond calibré
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const idA = getBodyLabel(pair.bodyA);
        const idB = getBodyLabel(pair.bodyB);
        recordContactFromPair(pair);

        // Calibrage du rebond selon la surface heurtée
        const isWallA = idA.startsWith('boundary_');
        const isWallB = idB.startsWith('boundary_');
        if (isWallA || isWallB) {
          const entityBody = isWallA ? pair.bodyB : pair.bodyA;
          pair.restitution = entityBody.restitution || 0.0;
        } else {
          pair.restitution = Math.max(pair.bodyA.restitution || 0, pair.bodyB.restitution || 0);
        }
      });
    });

    Matter.Events.on(engine, 'collisionActive', (event) => {
      event.pairs.forEach((pair) => {
        recordContactFromPair(pair);
      });
    });

    Matter.Events.on(engine, 'collisionEnd', (event) => {
      event.pairs.forEach((pair) => {
        const idA = getBodyLabel(pair.bodyA);
        const idB = getBodyLabel(pair.bodyB);
        if (idA && idB) {
          if (rebuildingBodyIds.has(idA) || rebuildingBodyIds.has(idB)) {
            return;
          }
          // Ignorer le collisionEnd d'un ancien corps détruit/reconstruit lors d'un changement d'état
          const currentBodyA = bodyMap.get(idA);
          const currentBodyB = bodyMap.get(idB);
          const isStaleBodyA = !idA.startsWith('boundary_') && !idA.startsWith('layercol::') && currentBodyA && currentBodyA !== pair.bodyA;
          const isStaleBodyB = !idB.startsWith('boundary_') && !idB.startsWith('layercol::') && currentBodyB && currentBodyB !== pair.bodyB;
          if (isStaleBodyA || isStaleBodyB) {
            return;
          }
          activePhysicsCollisionPairs.delete(`${idA}:::${idB}`);
          activePhysicsCollisionPairs.delete(`${idB}:::${idA}`);
          activePhysicsCollisionContacts.delete(`${idA}:::${idB}`);
          activePhysicsCollisionContacts.delete(`${idB}:::${idA}`);
        }
      });
    });
  }

  // Création / mise à jour des bordures solides de scène
  // wallThickness placé strictement à l'extérieur des coordonnées [0, w] et [0, h]
  const wallThickness = 100;
  const w = Math.max(100, canvasBounds.width);
  const h = Math.max(100, canvasBounds.height);

  if (boundaryBodies.length === 0) {
    const span = Math.max(10000, w * 4, h * 4);
    // Murs avec restitution neutre 0.0 : le rebond est déterminé par la variable rebond de l'entité
    const ground = Bodies.rectangle(w / 2, h + wallThickness / 2, span, wallThickness, {
      isStatic: true,
      label: 'boundary_ground',
      restitution: 0.0,
      friction: 0.1,
    });
    const ceiling = Bodies.rectangle(w / 2, -wallThickness / 2, span, wallThickness, {
      isStatic: true,
      label: 'boundary_ceiling',
      restitution: 0.0,
      friction: 0.1,
    });
    const leftWall = Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, span, {
      isStatic: true,
      label: 'boundary_left',
      restitution: 0.0,
      friction: 0.1,
    });
    const rightWall = Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, span, {
      isStatic: true,
      label: 'boundary_right',
      restitution: 0.0,
      friction: 0.1,
    });

    boundaryBodies.push(ground, ceiling, leftWall, rightWall);
    World.add(engine.world, boundaryBodies);
  } else {
    // Repositionner les murs si la taille du canvas a changé
    Body.setPosition(boundaryBodies[0], { x: w / 2, y: h + wallThickness / 2 });
    Body.setPosition(boundaryBodies[1], { x: w / 2, y: -wallThickness / 2 });
    Body.setPosition(boundaryBodies[2], { x: -wallThickness / 2, y: h / 2 });
    Body.setPosition(boundaryBodies[3], { x: w + wallThickness / 2, y: h / 2 });
  }

  // Synchronisation des corps d'entités dans Matter.World
  const entityList = Object.values(entities);
  const currentEntityIds = new Set(entityList.map((e) => e.id));

  // Retirer les corps des entités détruites
  for (const [id, body] of bodyMap.entries()) {
    if (!currentEntityIds.has(id)) {
      World.remove(engine.world, body);
      bodyMap.delete(id);
      colliderOffsets.delete(id);
      bodySignatures.delete(id);
      patrolStates.delete(id);
      wanderingStates.delete(id);
    }
  }

  // Créer ou mettre à jour les corps existants
  for (const entity of entityList) {
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);

    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;
    const hasMovement = effectiveBehaviors.some((b) =>
      ['keyboard_control', 'constant_velocity', 'patrol', 'wandering', 'move_to', 'follow', 'flee'].includes(b.type)
    );
    const isAttachedChild = !!(entity.parentId && entities[entity.parentId]);

    // RÈGLE D'OR : Sans composant physics explicite, l'objet n'a PAS de physique dynamique.
    // - Si enfant attaché à un parent : suivi cinématique pur (pas de chute autonome sous gravité).
    // - S'il n'a ni physics ni mouvement : isStatic = true (obstacle inamovible, zéro gravité).
    // - S'il n'a pas physics mais a un comportement de mouvement (ex: patrouille, clavier) : isStatic = false, mais gravité annulée.
    // - S'il a le composant physics : isStatic = physics.isStatic === true.
    let isStatic = true;
    if (isAttachedChild) {
      isStatic = true;
    } else if (physics) {
      isStatic = physics.isStatic === true;
    } else if (hasMovement) {
      isStatic = false;
    }

    const isSensor = physics ? (physics.isTrigger === true) : true;
    const collisionGroup = getHierarchyCollisionGroup(entity, entities);

    // Calcul précis du collider issu du mode dessin (supporte sharedCollider entre états)
    const colliderState = resolveColliderState(entity, currentState);
    const geom = getEntityColliderBounds(entity, currentState, Boolean(entity.flipX));
    const scale = colliderState?.scale ?? 1;
    const scaleX = (entity.size.width * scale) / 200;
    const scaleY = (entity.size.height * scale) / 200;
    const originOffsetX = (entity.size.width * (1 - scale)) / 2;
    const originOffsetY = (entity.size.height * (1 - scale)) / 2;

    const relCenterX = originOffsetX + geom.centerX * scaleX;
    const relCenterY = originOffsetY + geom.centerY * scaleY;
    const worldCenterX = entity.position.x + relCenterX;
    const worldCenterY = entity.position.y + relCenterY;
    const colliderType = geom.colliderType;

    const colliderWidth = Math.max(12, Math.round(geom.width * scaleX));
    const colliderHeight = Math.max(12, Math.round(geom.height * scaleY));
    const colliderRadius = Math.max(6, Math.round(geom.radius * Math.max(scaleX, scaleY)));

    const freezeRotation = physics?.freezeRotation === true;
    const signature = `${colliderType}_${colliderWidth}_${colliderHeight}_${colliderRadius}_${isStatic}_${isSensor}_${freezeRotation}`;
    let body = bodyMap.get(entity.id);

    // Si le corps n'existe pas ou si la forme du collider a été modifiée dans le mode dessin, le recréer
    if (!body || bodySignatures.get(entity.id) !== signature) {
      const prevVel = body ? { x: body.velocity.x, y: body.velocity.y } : null;
      if (body) {
        rebuildingBodyIds.add(entity.id);
        World.remove(engine.world, body);
        rebuildingBodyIds.delete(entity.id);
        bodyMap.delete(entity.id);
      }

      const restitution = physics?.bounce ?? boundary?.bounciness ?? 0.0;
      const friction = Math.max(0, Math.min(1, physics?.friction ?? 0.6));
      const frictionStatic = Math.max(0, Math.min(2, physics?.frictionStatic ?? Math.max(0.2, friction * 1.1)));
      const frictionAir = Math.max(0, Math.min(0.25, physics?.frictionAir ?? 0.015));

      const bodyOptions: Matter.IBodyDefinition = {
        label: entity.id,
        isStatic,
        isSensor,
        restitution,
        friction,
        frictionStatic,
        frictionAir,
        mass: Math.max(0.1, physics?.mass || 1),
        inertia: freezeRotation ? Infinity : undefined,
        collisionFilter: { group: collisionGroup },
      };

      if (colliderType === 'circle') {
        body = Bodies.circle(worldCenterX, worldCenterY, colliderRadius, bodyOptions);
      } else {
        body = Bodies.rectangle(worldCenterX, worldCenterY, colliderWidth, colliderHeight, bodyOptions);
      }

      if (freezeRotation) {
        Body.setInertia(body, Infinity);
        Body.setAngle(body, 0);
        Body.setAngularVelocity(body, 0);
      } else if (currentState?.rotation) {
        Body.setAngle(body, (currentState.rotation * Math.PI) / 180);
      }

      if (prevVel && !isStatic) {
        Body.setVelocity(body, prevVel);
      }

      bodyMap.set(entity.id, body);
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      bodySignatures.set(entity.id, signature);
      World.add(engine.world, body);
    } else {
      const prevOffset = colliderOffsets.get(entity.id);
      if (
        prevOffset &&
        (Math.abs(relCenterX - prevOffset.relCenterX) > 0.5 ||
          Math.abs(relCenterY - prevOffset.relCenterY) > 0.5)
      ) {
        Body.setPosition(body, {
          x: body.position.x + (relCenterX - prevOffset.relCenterX),
          y: body.position.y + (relCenterY - prevOffset.relCenterY),
        });
      }
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      body.isSensor = physics ? (physics.isTrigger === true) : true;
      body.collisionFilter.group = collisionGroup;
      if (physics) {
        const nextFriction = Math.max(0, Math.min(1, physics.friction ?? 0.6));
        body.restitution = physics.bounce ?? 0.0;
        body.friction = nextFriction;
        body.frictionStatic = Math.max(0, Math.min(2, physics.frictionStatic ?? Math.max(0.2, nextFriction * 1.1)));
        body.frictionAir = Math.max(0, Math.min(0.25, physics.frictionAir ?? 0.015));
        const targetMass = Math.max(0.1, physics.mass || 1);
        if (!isStatic && Math.abs(body.mass - targetMass) > 0.05) {
          Body.setMass(body, targetMass);
        }
        if (physics.freezeRotation) {
          Body.setInertia(body, Infinity);
          Body.setAngle(body, 0);
          Body.setAngularVelocity(body, 0);
        }
      }
    }
  }

  // Synchronisation des calques Colliders de décor dans Matter.World
  const activeLayerIds = new Set(colliderLayers.map((l) => l.id));
  for (const [layerId, bodies] of colliderLayerBodyMap.entries()) {
    if (!activeLayerIds.has(layerId)) {
      bodies.forEach((b) => World.remove(engine!.world, b));
      colliderLayerBodyMap.delete(layerId);
      colliderLayerSignatures.delete(layerId);
    }
  }

  for (const layer of colliderLayers) {
    const sig = JSON.stringify({
      isTrig: Boolean(layer.colliderIsTrigger),
      fric: layer.colliderFriction ?? 0.9,
      bnc: layer.colliderBounce ?? 0,
      cs: layer.coordinateSpace || 'world',
      wh: layer.coordinateSpace === 'legacy_200' ? `${Math.round(w)}x${Math.round(h)}` : 'world',
      paths: (layer.vectorPaths || []).map((p) => `${p.id}:${p.d}:${p.strokeWidth}:${p.points?.length || 0}`),
    });

    if (colliderLayerSignatures.get(layer.id) !== sig) {
      const prevBodies = colliderLayerBodyMap.get(layer.id);
      if (prevBodies) {
        prevBodies.forEach((b) => World.remove(engine!.world, b));
      }
      const nextBodies = buildColliderLayerBodies(layer, canvasBounds);
      if (nextBodies.length > 0) {
        World.add(engine!.world, nextBodies);
      }
      colliderLayerBodyMap.set(layer.id, nextBodies);
      colliderLayerSignatures.set(layer.id, sig);
    }
  }
}

/**
 * Interpolation fluide de vitesse (Accélération + Inertie/Damping) compatible à 100% avec les comportements existants.
 */
function approachAxisVelocity(
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
 * Exécute un pas de simulation Matter.js et applique les comportements
 */
export function stepMatterPhysics(params: {
  entities: Record<string, Entity>;
  deltaTime: number; // en secondes
  canvasBounds: { width: number; height: number };
  mousePos?: { x: number; y: number } | null;
  colliderLayers?: SceneLayer[];
}): PhysicsTickResult {
  const { entities, deltaTime, canvasBounds, mousePos, colliderLayers = [] } = params;
  const dt = Math.min(deltaTime, 0.05);

  ensurePhysicsWorld(canvasBounds, entities, colliderLayers);
  if (!engine) return { updatedTransforms: {} };

  const updatedTransforms: Record<string, { position: Position; rotation?: number; flipX?: boolean }> = {};
  const flipUpdates = new Map<string, boolean>();
  const entitiesToDestroy: string[] = [];
  const entityList = Object.values(entities);

  for (const entity of entityList) {
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
    const body = bodyMap.get(entity.id);

    // Vérifier l'autodestruction temporisée même sans corps physique dynamique
    const autoDestroy = effectiveBehaviors.find((b) => b.type === 'auto_destroy') as AutoDestroyBehaviorConfig | undefined;
    if (autoDestroy && autoDestroy.enabled !== false) {
      const delay = Math.max(0.1, autoDestroy.delay ?? 3);
      const elapsed = (autoDestroyTimers.get(entity.id) || 0) + dt;
      autoDestroyTimers.set(entity.id, elapsed);
      if (elapsed >= delay) {
        entitiesToDestroy.push(entity.id);
      }
    }

    // Si l'entité est attachée à un parent, sa position/rotation sera calculée cinématiquement après Engine.update
    if (entity.parentId && entities[entity.parentId]) {
      continue;
    }

    // Si l'entité est actuellement déplacée manuellement à la souris, figer son corps sur le curseur
    const activeDragPos = activeDragPositions[entity.id];
    if (activeDragPos && body) {
      const dragOffset = colliderOffsets.get(entity.id) || {
        relCenterX: entity.size.width / 2,
        relCenterY: entity.size.height / 2,
      };
      Body.setPosition(body, {
        x: activeDragPos.x + dragOffset.relCenterX,
        y: activeDragPos.y + dragOffset.relCenterY,
      });
      Body.setVelocity(body, { x: 0, y: 0 });
      continue;
    }

    if (!body || effectiveBehaviors.length === 0) continue;

    // Récupérer les comportements configurés
    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const constVel = effectiveBehaviors.find((b) => b.type === 'constant_velocity') as ConstantVelocityBehaviorConfig | undefined;
    const keyboard = effectiveBehaviors.find((b) => b.type === 'keyboard_control') as KeyboardControlBehaviorConfig | undefined;
    const patrol = effectiveBehaviors.find((b) => b.type === 'patrol') as PatrolBehaviorConfig | undefined;
    const wandering = effectiveBehaviors.find((b) => b.type === 'wandering') as WanderingBehaviorConfig | undefined;
    const moveTo = effectiveBehaviors.find((b) => b.type === 'move_to') as MoveToBehaviorConfig | undefined;
    const follow = effectiveBehaviors.find((b) => b.type === 'follow') as FollowBehaviorConfig | undefined;
    const flee = effectiveBehaviors.find((b) => b.type === 'flee') as FleeBehaviorConfig | undefined;
    const lookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;

    // Figer la rotation si freezeRotation est activé (Rigidbody 2D Freeze Rotation)
    if (physics?.freezeRotation) {
      Body.setAngle(body, 0);
      Body.setAngularVelocity(body, 0);
    }

    // 0. Annulation de la gravité pour les entités sans composant 'physics' mais avec mouvement actif
    if (!physics && !body.isStatic) {
      Body.applyForce(body, body.position, {
        x: 0,
        y: -0.001 * body.mass * (engine.world.gravity.y || 1),
      });
      // S'il n'y a pas d'action verticale commandée, amortir vy résiduel
      if (!keyboard && !constVel?.vy && !patrol && !wandering && !moveTo && !follow && !flee) {
        Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * 0.8 });
      }
    }

    // 1. Gravité personnalisée exacte (400 = gravité standard 1x ; 0 = apesanteur exacte)
    if (physics && !physics.isStatic) {
      const customG = physics.gravity ?? 400;
      const gravityRatio = customG / 400;
      if (Math.abs(gravityRatio - 1) > 0.001) {
        Body.applyForce(body, body.position, {
          x: 0,
          y: (gravityRatio - 1) * 0.001 * (engine.world.gravity.y || 1) * body.mass,
        });
      }
    }

    // 2. Vitesse continue (convertie de px/s vers px/frame avec accélération & damping)
    if (constVel) {
      const targetVx = constVel.vx !== undefined && constVel.vx !== 0 ? constVel.vx / 60 : null;
      const targetVy = constVel.vy !== undefined && constVel.vy !== 0 ? constVel.vy / 60 : null;
      const nextVx = approachAxisVelocity(body.velocity.x, targetVx, constVel.acceleration, constVel.damping);
      const nextVy = approachAxisVelocity(body.velocity.y, targetVy, constVel.acceleration, constVel.damping);
      if (targetVx !== null || targetVy !== null || constVel.damping !== undefined) {
        Body.setVelocity(body, { x: nextVx, y: nextVy });
      }
      if (constVel.angularVelocity) {
        Body.setAngularVelocity(body, ((constVel.angularVelocity / 60) * Math.PI) / 180);
      }
    }

    // 3. Contrôles Joueur (Clavier)
    if (keyboard) {
      const layout = keyboard.layout || 'both';
      const allowArrows = layout === 'arrows' || layout === 'both';
      const allowWasd = layout === 'wasd' || layout === 'both';
      const allowHorizontal = keyboard.allowHorizontal !== false;
      const allowVertical = keyboard.allowVertical !== false;
      const allowJump = keyboard.allowJump !== false;

      const left =
        allowHorizontal &&
        ((allowArrows && activeKeys.has('arrowleft')) ||
          (allowWasd && (activeKeys.has('a') || activeKeys.has('q') || activeKeys.has('keya'))));
      const right =
        allowHorizontal &&
        ((allowArrows && activeKeys.has('arrowright')) ||
          (allowWasd && (activeKeys.has('d') || activeKeys.has('keyd'))));
      const upVertical =
        allowVertical &&
        ((allowArrows && activeKeys.has('arrowup')) ||
          (allowWasd && (activeKeys.has('w') || activeKeys.has('z') || activeKeys.has('keyw'))) ||
          activeKeys.has(' ') ||
          activeKeys.has('space'));
      const upJump =
        allowJump &&
        ((allowArrows && activeKeys.has('arrowup')) ||
          (allowWasd && (activeKeys.has('w') || activeKeys.has('z') || activeKeys.has('keyw'))) ||
          activeKeys.has(' ') ||
          activeKeys.has('space'));
      const down =
        allowVertical &&
        ((allowArrows && activeKeys.has('arrowdown')) ||
          (allowWasd && (activeKeys.has('s') || activeKeys.has('keys'))));

      const speed = (keyboard.speed ?? 180) / 60; // conversion px/s -> px/frame
      const accel = keyboard.acceleration;
      const damp = keyboard.damping;

      if (keyboard.mode === 'top_down') {
        let mx = 0;
        let my = 0;
        if (left) mx -= 1;
        if (right) mx += 1;
        if (upVertical) my -= 1;
        if (down) my += 1;

        if (mx !== 0 && my !== 0) {
          mx *= 0.7071;
          my *= 0.7071;
        }

        const nextVx = allowHorizontal
          ? approachAxisVelocity(body.velocity.x, mx !== 0 ? mx * speed : null, accel, damp, !physics ? 0.8 : undefined)
          : body.velocity.x;
        const nextVy = allowVertical
          ? approachAxisVelocity(body.velocity.y, my !== 0 ? my * speed : null, accel, damp, !physics ? 0.8 : undefined)
          : body.velocity.y;
        Body.setVelocity(body, { x: nextVx, y: nextVy });
      } else {
        // Mode Plateforme
        let vx = body.velocity.x;
        if (allowHorizontal) {
          const targetVx = left ? -speed : right ? speed : null;
          vx = approachAxisVelocity(body.velocity.x, targetVx, accel, damp, !physics ? 0.8 : undefined);
        }

        // Détection précise du sol + limitation du nombre de sauts (maxJumps, défaut 1)
        const tracker = jumpTrackers.get(entity.id) || { jumpsUsed: 0, wasJumpPressed: false };
        const isBottomFloor = !body.isSensor && body.bounds.max.y >= canvasBounds.height - 3;
        const isGrounded = (groundedEntityIds.has(entity.id) || isBottomFloor) && body.velocity.y >= -0.6;
        if (isGrounded) {
          tracker.jumpsUsed = 0;
        }

        const maxJumps = Math.max(1, keyboard.maxJumps ?? 1);
        const jumpJustPressed = upJump && !tracker.wasJumpPressed;
        let vy = body.velocity.y;
        if (allowJump && jumpJustPressed && tracker.jumpsUsed < maxJumps) {
          vy = -((keyboard.jumpForce ?? 450) / 60);
          tracker.jumpsUsed += 1;
          groundedEntityIds.delete(entity.id);
        }
        tracker.wasJumpPressed = upJump;
        jumpTrackers.set(entity.id, tracker);

        Body.setVelocity(body, { x: vx, y: vy });
      }
    }

    // 4. Patrouille
    if (patrol) {
      let patrolState = patrolStates.get(entity.id);
      if (!patrolState) {
        patrolState = { direction: 1, timer: 0, initialPos: { ...entity.position } };
        patrolStates.set(entity.id, patrolState);
      }

      if (patrolState.timer > 0) {
        patrolState.timer -= dt;
        const dampStop = patrol.damping ?? 0;
        Body.setVelocity(
          body,
          patrol.axis === 'horizontal'
            ? { x: body.velocity.x * dampStop, y: body.velocity.y }
            : { x: body.velocity.x, y: body.velocity.y * dampStop }
        );
      } else {
        const origin = patrolState.initialPos;
        const range = patrol.range ?? 120;
        const speed = (patrol.speed ?? 100) / 60; // px/s -> px/frame
        const pause = patrol.pauseDuration ?? 0.5;
        const accel = patrol.acceleration;
        const damp = patrol.damping ?? 0;

        if (patrol.axis === 'horizontal') {
          const nextVx = approachAxisVelocity(body.velocity.x, patrolState.direction * speed, accel, damp, 0);
          Body.setVelocity(body, { x: nextVx, y: body.velocity.y });
          const currentOffset = body.position.x - (origin.x + entity.size.width / 2);
          if (Math.abs(currentOffset) >= range) {
            patrolState.direction = currentOffset > 0 ? -1 : 1;
            patrolState.timer = pause;
            Body.setVelocity(body, { x: body.velocity.x * damp, y: body.velocity.y });
          }
        } else {
          const nextVy = approachAxisVelocity(body.velocity.y, patrolState.direction * speed, accel, damp, 0);
          Body.setVelocity(body, { x: body.velocity.x, y: nextVy });
          const currentOffset = body.position.y - (origin.y + entity.size.height / 2);
          if (Math.abs(currentOffset) >= range) {
            patrolState.direction = currentOffset > 0 ? -1 : 1;
            patrolState.timer = pause;
            Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * damp });
          }
        }
      }
    }

    // 4b. Errance / Balade aléatoire (Wandering)
    if (wandering) {
      let wState = wanderingStates.get(entity.id);
      if (!wState) {
        wState = {
          origin: { x: body.position.x, y: body.position.y },
          targetPoint: null,
          moveTimer: 0,
          pauseTimer: 0,
          currentAngle: Math.random() * Math.PI * 2,
        };
        wanderingStates.set(entity.id, wState);
      }

      const mode = wandering.mode || 'free_2d';
      const radius = Math.max(20, wandering.radius ?? 160);
      const speedPxFrame = (wandering.speed ?? 90) / 60;
      const randomnessFactor = Math.max(0, Math.min(100, wandering.randomness ?? 65)) / 100;
      const interval = Math.max(0.2, wandering.changeInterval ?? 1.5);
      const maxPause = Math.max(0, wandering.pauseDuration ?? 0.8);

      const pickNextWanderTarget = () => {
        const durationJitter = 1 - randomnessFactor * 0.4 + Math.random() * (randomnessFactor * 0.9);
        wState!.moveTimer = Math.max(0.2, interval * durationJitter);

        if (mode === 'horizontal') {
          const offsetX = body.position.x - wState!.origin.x;
          let dir: number;
          if (Math.abs(offsetX) > radius * 0.85) {
            dir = offsetX > 0 ? -1 : 1;
          } else if (Math.random() < 0.25 + randomnessFactor * 0.65) {
            dir = Math.random() < 0.5 ? -1 : 1;
          } else {
            dir = Math.cos(wState!.currentAngle) >= 0 ? 1 : -1;
          }
          const stepDist = radius * (0.3 + Math.random() * 0.7);
          const rawTargetX = body.position.x + dir * stepDist;
          const minBoundX = Math.max(20, wState!.origin.x - radius);
          const maxBoundX = Math.min(Math.max(40, canvasBounds.width - 20), wState!.origin.x + radius);
          const clampedX = Math.max(minBoundX, Math.min(maxBoundX, rawTargetX));
          wState!.targetPoint = { x: clampedX, y: body.position.y };
          wState!.currentAngle = clampedX >= body.position.x ? 0 : Math.PI;
          return;
        }

        // Mode 2D libre dans une zone circulaire autour de origin
        const dxOrigin = body.position.x - wState!.origin.x;
        const dyOrigin = body.position.y - wState!.origin.y;
        const distFromOrigin = Math.hypot(dxOrigin, dyOrigin);

        let nextAngle: number;
        if (distFromOrigin > radius * 0.85) {
          // Renvoyer doucement vers l'intérieur de la zone
          const toCenterAngle = Math.atan2(-dyOrigin, -dxOrigin);
          nextAngle = toCenterAngle + (Math.random() - 0.5) * (Math.PI * 0.6);
        } else {
          // À faible aléatoire : cap fluide; à fort aléatoire : virages vifs jusqu'à 360°
          const maxTurn = 0.35 + randomnessFactor * (Math.PI - 0.35);
          nextAngle = wState!.currentAngle + (Math.random() * 2 - 1) * maxTurn;
        }

        const stepDist = radius * (0.35 + Math.random() * 0.65);
        let tx = body.position.x + Math.cos(nextAngle) * stepDist;
        let ty = body.position.y + Math.sin(nextAngle) * stepDist;

        // Contraindre le point cible à l'intérieur du cercle de zone
        const ox = tx - wState!.origin.x;
        const oy = ty - wState!.origin.y;
        const od = Math.hypot(ox, oy);
        if (od > radius) {
          tx = wState!.origin.x + (ox / od) * radius;
          ty = wState!.origin.y + (oy / od) * radius;
        }

        // Garder dans les marges du canvas visible
        tx = Math.max(24, Math.min(Math.max(48, canvasBounds.width - 24), tx));
        ty = Math.max(24, Math.min(Math.max(48, canvasBounds.height - 24), ty));

        wState!.targetPoint = { x: tx, y: ty };
        wState!.currentAngle = Math.atan2(ty - body.position.y, tx - body.position.x);
      };

      const wAccel = wandering.acceleration;
      const wDamp = wandering.damping ?? 0.78;

      if (wState.pauseTimer > 0) {
        wState.pauseTimer -= dt;
        if (mode === 'horizontal') {
          Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y });
        } else {
          Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y * wDamp });
        }
        if (wState.pauseTimer <= 0) {
          pickNextWanderTarget();
        }
      } else {
        if (!wState.targetPoint || wState.moveTimer <= 0) {
          pickNextWanderTarget();
        }

        wState.moveTimer -= dt;
        const target = wState.targetPoint!;
        const dx = target.x - body.position.x;
        const dy = target.y - body.position.y;

        if (mode === 'horizontal') {
          const dist = Math.abs(dx);
          if (dist > 6 && wState.moveTimer > 0) {
            const nextVx = approachAxisVelocity(body.velocity.x, Math.sign(dx) * speedPxFrame, wAccel, wDamp, wDamp);
            Body.setVelocity(body, { x: nextVx, y: body.velocity.y });
          } else if (maxPause > 0 && Math.random() < 0.7) {
            wState.pauseTimer = maxPause * (0.25 + Math.random() * 0.75);
            Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y });
          } else {
            pickNextWanderTarget();
          }
        } else {
          const dist = Math.hypot(dx, dy);
          if (dist > 6 && wState.moveTimer > 0) {
            const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speedPxFrame, wAccel, wDamp, wDamp);
            const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speedPxFrame, wAccel, wDamp, wDamp);
            Body.setVelocity(body, {
              x: nextVx,
              y: nextVy,
            });
            if (wandering.orientToMovement && !physics?.freezeRotation) {
              const targetAngle = Math.atan2(dy, dx);
              const diff = shortestAngleDiffRad(body.angle, targetAngle);
              Body.setAngle(body, body.angle + diff * 0.18);
            }
          } else if (maxPause > 0 && Math.random() < 0.7) {
            wState.pauseTimer = maxPause * (0.25 + Math.random() * 0.75);
            Body.setVelocity(body, { x: body.velocity.x * wDamp, y: body.velocity.y * wDamp });
          } else {
            pickNextWanderTarget();
          }
        }
      }
    } else if (wanderingStates.has(entity.id)) {
      wanderingStates.delete(entity.id);
    }

    // Helper pour rechercher dynamiquement l'instance la plus proche par Type ou par Tag (Piste D)
    const findNearestTarget = (
      mode: 'nearest_type' | 'nearest_tag',
      targetType?: string,
      targetTag?: string
    ): Entity | undefined => {
      const cleanTag = targetTag ? targetTag.toLowerCase().trim().replace(/^#/, '') : '';
      let nearest: Entity | undefined;
      let minDistSq = Infinity;

      for (const candidate of Object.values(entities)) {
        if (candidate.id === entity.id) continue; // Ne pas se cibler soi-même
        if (mode === 'nearest_type') {
          if (!targetType || candidate.type !== targetType) continue;
        } else if (mode === 'nearest_tag') {
          if (!cleanTag || !candidate.tags?.includes(cleanTag)) continue;
        }

        const candOffset = colliderOffsets.get(candidate.id) || {
          relCenterX: candidate.size.width / 2,
          relCenterY: candidate.size.height / 2,
        };
        const candCenterX = candidate.position.x + candOffset.relCenterX;
        const candCenterY = candidate.position.y + candOffset.relCenterY;
        const dx = candCenterX - body.position.x;
        const dy = candCenterY - body.position.y;
        const distSq = dx * dx + dy * dy;

        if (distSq < minDistSq) {
          minDistSq = distSq;
          nearest = candidate;
        }
      }
      return nearest;
    };

    // 5. Move To
    if (moveTo) {
      let targetX = entity.position.x;
      let targetY = entity.position.y;
      let hasValidTarget = false;

      if (moveTo.targetType === 'position' && moveTo.targetPosition) {
        targetX = moveTo.targetPosition.x;
        targetY = moveTo.targetPosition.y;
        hasValidTarget = true;
      } else if (moveTo.targetType === 'entity' && moveTo.targetEntityId) {
        const targetEntity = entities[moveTo.targetEntityId];
        if (targetEntity) {
          targetX = targetEntity.position.x;
          targetY = targetEntity.position.y;
          hasValidTarget = true;
        }
      } else if (moveTo.targetType === 'nearest_type' || moveTo.targetType === 'nearest_tag') {
        const nearestEntity = findNearestTarget(
          moveTo.targetType,
          moveTo.targetEntityType,
          moveTo.targetTag
        );
        if (nearestEntity) {
          targetX = nearestEntity.position.x;
          targetY = nearestEntity.position.y;
          hasValidTarget = true;
        }
      }

      if (hasValidTarget) {
        const offset = colliderOffsets.get(entity.id) || { relCenterX: entity.size.width / 2, relCenterY: entity.size.height / 2 };
        const currentEntityX = body.position.x - offset.relCenterX;
        const currentEntityY = body.position.y - offset.relCenterY;
        const dx = targetX - currentEntityX;
        const dy = targetY - currentEntityY;
        const dist = Math.hypot(dx, dy);
        const dampStop = moveTo.damping ?? 0;

        if (dist > 4) {
          const speed = (moveTo.speed ?? 120) / 60; // px/s -> px/frame
          const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speed, moveTo.acceleration, dampStop, 0);
          const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speed, moveTo.acceleration, dampStop, 0);
          Body.setVelocity(body, { x: nextVx, y: nextVy });
        } else {
          Body.setVelocity(body, { x: body.velocity.x * dampStop, y: body.velocity.y * dampStop });
        }
      }
    }

    // 6. Follow
    if (follow) {
      let targetX = body.position.x;
      let targetY = body.position.y;
      let hasValidTarget = false;

      if (follow.targetType === 'mouse' && mousePos) {
        targetX = mousePos.x;
        targetY = mousePos.y;
        hasValidTarget = true;
      } else if (follow.targetType === 'entity' && follow.targetEntityId) {
        const targetEntity = entities[follow.targetEntityId];
        if (targetEntity) {
          const targetOffset = colliderOffsets.get(targetEntity.id) || { relCenterX: targetEntity.size.width / 2, relCenterY: targetEntity.size.height / 2 };
          targetX = targetEntity.position.x + targetOffset.relCenterX;
          targetY = targetEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      } else if (follow.targetType === 'nearest_type' || follow.targetType === 'nearest_tag') {
        const nearestEntity = findNearestTarget(
          follow.targetType,
          follow.targetEntityType,
          follow.targetTag
        );
        if (nearestEntity) {
          const targetOffset = colliderOffsets.get(nearestEntity.id) || { relCenterX: nearestEntity.size.width / 2, relCenterY: nearestEntity.size.height / 2 };
          targetX = nearestEntity.position.x + targetOffset.relCenterX;
          targetY = nearestEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      }

      if (hasValidTarget) {
        const dx = targetX - body.position.x;
        const dy = targetY - body.position.y;
        const dist = Math.hypot(dx, dy);
        const minDistance = follow.minDistance ?? 40;
        const followAccel = follow.acceleration ?? (follow.smoothing !== undefined ? Math.max(0.04, Math.min(1, follow.smoothing)) : undefined);
        const followDamp = follow.damping ?? 0.8;

        if (dist > minDistance) {
          const speed = (follow.speed ?? 150) / 60; // px/s -> px/frame
          const nextVx = approachAxisVelocity(body.velocity.x, (dx / dist) * speed, followAccel, followDamp, 0.8);
          const nextVy = approachAxisVelocity(body.velocity.y, (dy / dist) * speed, followAccel, followDamp, 0.8);
          Body.setVelocity(body, { x: nextVx, y: nextVy });
        } else {
          Body.setVelocity(body, { x: body.velocity.x * followDamp, y: body.velocity.y * followDamp });
        }
      }
    }

    // 6b. Flee (Fuir une menace)
    if (flee) {
      let threatX = body.position.x;
      let threatY = body.position.y;
      let hasThreat = false;

      if (flee.targetType === 'mouse' && mousePos) {
        threatX = mousePos.x;
        threatY = mousePos.y;
        hasThreat = true;
      } else if (flee.targetType === 'entity' && flee.targetEntityId) {
        const threatEntity = entities[flee.targetEntityId];
        if (threatEntity) {
          const tOffset = colliderOffsets.get(threatEntity.id) || { relCenterX: threatEntity.size.width / 2, relCenterY: threatEntity.size.height / 2 };
          threatX = threatEntity.position.x + tOffset.relCenterX;
          threatY = threatEntity.position.y + tOffset.relCenterY;
          hasThreat = true;
        }
      } else if (flee.targetType === 'nearest_type' || flee.targetType === 'nearest_tag') {
        const nearestThreat = findNearestTarget(
          flee.targetType,
          flee.targetEntityType,
          flee.targetTag
        );
        if (nearestThreat) {
          const tOffset = colliderOffsets.get(nearestThreat.id) || { relCenterX: nearestThreat.size.width / 2, relCenterY: nearestThreat.size.height / 2 };
          threatX = nearestThreat.position.x + tOffset.relCenterX;
          threatY = nearestThreat.position.y + tOffset.relCenterY;
          hasThreat = true;
        }
      }

      const fleeAccel = flee.acceleration ?? 0.35;
      const fleeDamp = flee.damping ?? 0.85;
      const axisMode = flee.axisMode || 'free_2d';

      if (hasThreat) {
        const dx = body.position.x - threatX;
        const dy = body.position.y - threatY;
        const dist = Math.hypot(dx, dy);
        const radius = flee.fleeRadius ?? 220;
        const shouldFlee = radius <= 0 || dist < radius;

        if (shouldFlee) {
          const speed = (flee.speed ?? 160) / 60;
          if (axisMode === 'horizontal') {
            const dirX = Math.abs(dx) < 1 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(dx);
            const nextVx = approachAxisVelocity(body.velocity.x, dirX * speed, fleeAccel, fleeDamp, 0.85);
            Body.setVelocity(body, { x: nextVx, y: body.velocity.y });
          } else {
            const safeDist = Math.max(0.001, dist);
            const dirX = dist < 1 ? Math.cos(Math.random() * Math.PI * 2) : dx / safeDist;
            const dirY = dist < 1 ? Math.sin(Math.random() * Math.PI * 2) : dy / safeDist;
            const nextVx = approachAxisVelocity(body.velocity.x, dirX * speed, fleeAccel, fleeDamp, 0.85);
            const nextVy = approachAxisVelocity(body.velocity.y, dirY * speed, fleeAccel, fleeDamp, 0.85);
            Body.setVelocity(body, { x: nextVx, y: nextVy });
          }
        } else {
          Body.setVelocity(
            body,
            axisMode === 'horizontal'
              ? { x: body.velocity.x * fleeDamp, y: body.velocity.y }
              : { x: body.velocity.x * fleeDamp, y: body.velocity.y * fleeDamp }
          );
        }
      } else {
        Body.setVelocity(
          body,
          axisMode === 'horizontal'
            ? { x: body.velocity.x * fleeDamp, y: body.velocity.y }
            : { x: body.velocity.x * fleeDamp, y: body.velocity.y * fleeDamp }
        );
      }
    }

    // 7. Look At
    if (lookAt) {
      let targetX = body.position.x;
      let targetY = body.position.y;
      let hasValidTarget = false;

      if (lookAt.targetType === 'mouse' && mousePos) {
        targetX = mousePos.x;
        targetY = mousePos.y;
        hasValidTarget = true;
      } else if (lookAt.targetType === 'entity' && lookAt.targetEntityId) {
        const targetEntity = entities[lookAt.targetEntityId];
        if (targetEntity) {
          const targetOffset = colliderOffsets.get(targetEntity.id) || { relCenterX: targetEntity.size.width / 2, relCenterY: targetEntity.size.height / 2 };
          targetX = targetEntity.position.x + targetOffset.relCenterX;
          targetY = targetEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      } else if (lookAt.targetType === 'nearest_type' || lookAt.targetType === 'nearest_tag') {
        const nearestEntity = findNearestTarget(
          lookAt.targetType,
          lookAt.targetEntityType,
          lookAt.targetTag
        );
        if (nearestEntity) {
          const targetOffset = colliderOffsets.get(nearestEntity.id) || { relCenterX: nearestEntity.size.width / 2, relCenterY: nearestEntity.size.height / 2 };
          targetX = nearestEntity.position.x + targetOffset.relCenterX;
          targetY = nearestEntity.position.y + targetOffset.relCenterY;
          hasValidTarget = true;
        }
      }

      if (hasValidTarget) {
        const dx = targetX - body.position.x;
        const dy = targetY - body.position.y;
        const targetAngleRad = Math.atan2(dy, dx) + ((lookAt.rotationOffset || 0) * Math.PI) / 180;
        const diff = shortestAngleDiffRad(body.angle, targetAngleRad);

        const smoothSpeed = lookAt.smoothSpeed ?? 0;
        if (smoothSpeed > 0) {
          const maxStep = ((smoothSpeed * Math.PI) / 180) * dt;
          if (Math.abs(diff) <= maxStep) {
            Body.setAngle(body, body.angle + diff);
          } else {
            Body.setAngle(body, body.angle + Math.sign(diff) * maxStep);
          }
        } else {
          Body.setAngle(body, body.angle + diff);
        }
      }
    }

    // 7b. Flip horizontal automatique selon le sens du mouvement
    const flipBehavior = [keyboard, patrol, wandering, moveTo, follow, flee, constVel].find(
      (b) => b && (b as any).flipOnMove === true
    ) as { flipOnMove?: boolean; flipInvert?: boolean } | undefined;

    if (flipBehavior) {
      const vx = body.velocity.x;
      if (Math.abs(vx) > 0.12) {
        const movingLeft = vx < 0;
        const nextFlipX = flipBehavior.flipInvert ? !movingLeft : movingLeft;
        flipUpdates.set(entity.id, nextFlipX);
      }
    }

    // 8. Gestion des bords de scène spéciaux (Bounce pour sensors, Wrap, Clamp)
    if (boundary) {
      const mode = boundary.mode || 'bounce';
      const halfW = Math.max(4, (body.bounds.max.x - body.bounds.min.x) / 2);
      const halfH = Math.max(4, (body.bounds.max.y - body.bounds.min.y) / 2);
      if (mode === 'bounce' && body.isSensor) {
        const bounceRest = boundary.bounciness ?? 0.8;
        let vx = body.velocity.x;
        let vy = body.velocity.y;
        let nx = body.position.x;
        let ny = body.position.y;
        if (nx < halfW) {
          nx = halfW;
          vx = Math.abs(vx) * bounceRest;
        } else if (nx > canvasBounds.width - halfW) {
          nx = canvasBounds.width - halfW;
          vx = -Math.abs(vx) * bounceRest;
        }
        if (ny < halfH) {
          ny = halfH;
          vy = Math.abs(vy) * bounceRest;
        } else if (ny > canvasBounds.height - halfH) {
          ny = canvasBounds.height - halfH;
          vy = -Math.abs(vy) * bounceRest;
        }
        if (nx !== body.position.x || ny !== body.position.y) {
          Body.setPosition(body, { x: nx, y: ny });
          Body.setVelocity(body, { x: vx, y: vy });
        }
      } else if (mode === 'wrap') {
        let newX = body.position.x;
        let newY = body.position.y;

        if (body.position.x < -halfW) newX = canvasBounds.width + halfW;
        else if (body.position.x > canvasBounds.width + halfW) newX = -halfW;

        if (body.position.y < -halfH) newY = canvasBounds.height + halfH;
        else if (body.position.y > canvasBounds.height + halfH) newY = -halfH;

        if (newX !== body.position.x || newY !== body.position.y) {
          Body.setPosition(body, { x: newX, y: newY });
        }
      } else if (mode === 'clamp') {
        const minX = halfW;
        const maxX = Math.max(minX, canvasBounds.width - halfW);
        const minY = halfH;
        const maxY = Math.max(minY, canvasBounds.height - halfH);

        const clampedX = Math.max(minX, Math.min(maxX, body.position.x));
        const clampedY = Math.max(minY, Math.min(maxY, body.position.y));

        if (clampedX !== body.position.x || clampedY !== body.position.y) {
          Body.setPosition(body, { x: clampedX, y: clampedY });
        }
      }
    }

    // Plafond de vitesse terminale pour éviter toute dérive physique incontrôlée
    const maxVelocity = 30; // 30 px/frame = 1800 px/s
    const currentSpeed = Math.hypot(body.velocity.x, body.velocity.y);
    if (currentSpeed > maxVelocity) {
      Body.setVelocity(body, {
        x: (body.velocity.x / currentSpeed) * maxVelocity,
        y: (body.velocity.y / currentSpeed) * maxVelocity,
      });
    }
  }

  // Tique d'itération physique du moteur Matter.js avec sous-pas <= 16.666 ms (évite le warning delta > 16.667 ms)
  const totalMs = dt * 1000;
  const maxStepMs = 16.666;
  const subSteps = Math.max(1, Math.ceil(totalMs / maxStepMs));
  const stepMs = totalMs / subSteps;
  groundedEntityIds.clear();
  for (let s = 0; s < subSteps; s++) {
    Engine.update(engine, stepMs);
  }

  // Résolution des transformations dans l'ordre topologique (parents avant enfants)
  const orderedEntities = sortEntitiesTopologically(entities);
  const resolvedTransforms = new Map<string, { position: Position; rotation: number; flipX: boolean }>();

  for (const entity of orderedEntities) {
    const body = bodyMap.get(entity.id);
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const emitter = effectiveBehaviors.find((b) => b.type === 'particle_emitter') as ParticleEmitterBehaviorConfig | undefined;
    const isRotFrozen = physics?.freezeRotation === true;

    let newX = entity.position.x;
    let newY = entity.position.y;
    let newRot = currentState?.rotation || 0;
    let nextFlipX = flipUpdates.get(entity.id) ?? (entity.flipX ?? false);

    // Cas 1 : Entité enfant attachée à un parent (suivi cinématique exact)
    if (entity.parentId && entities[entity.parentId]) {
      const parent = entities[entity.parentId];
      const parentTransform = resolvedTransforms.get(parent.id) || {
        position: parent.position,
        rotation: parent.states[parent.currentStateId]?.rotation || 0,
        flipX: parent.flipX ?? false,
      };

      const offset = entity.parentOffset || { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true };
      const inheritRot = offset.inheritRotation !== false;
      const inheritFlip = offset.inheritFlip !== false;

      const parentCenterX = parentTransform.position.x + parent.size.width / 2;
      const parentCenterY = parentTransform.position.y + parent.size.height / 2;

      const localX = inheritFlip && parentTransform.flipX ? -offset.x : offset.x;
      const localY = offset.y;

      const parentRotRad = inheritRot ? (parentTransform.rotation * Math.PI) / 180 : 0;
      const cosA = Math.cos(parentRotRad);
      const sinA = Math.sin(parentRotRad);
      const rotatedX = localX * cosA - localY * sinA;
      const rotatedY = localX * sinA + localY * cosA;

      const childCenterX = parentCenterX + rotatedX;
      const childCenterY = parentCenterY + rotatedY;

      newX = Math.round((childCenterX - entity.size.width / 2) * 10) / 10;
      newY = Math.round((childCenterY - entity.size.height / 2) * 10) / 10;

      const rotOffset = (offset.rotationOffset || 0) * (inheritFlip && parentTransform.flipX ? -1 : 1);
      newRot = Math.round(((inheritRot ? parentTransform.rotation : 0) + rotOffset) * 10) / 10;
      nextFlipX = inheritFlip ? parentTransform.flipX : (entity.flipX ?? false);

      // Synchroniser le corps Matter.js du capteur/collider de l'enfant avec sa position monde réelle
      if (body) {
        const cOffset = colliderOffsets.get(entity.id) || {
          relCenterX: entity.size.width / 2,
          relCenterY: entity.size.height / 2,
        };
        Body.setPosition(body, {
          x: newX + cOffset.relCenterX,
          y: newY + cOffset.relCenterY,
        });
        Body.setAngle(body, (newRot * Math.PI) / 180);
      }

      const posChanged = Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05;
      const rotChanged = Math.abs(newRot - (currentState?.rotation || 0)) > 0.1;
      const flipChanged = (entity.flipX ?? false) !== nextFlipX;

      if (posChanged || rotChanged || flipChanged) {
        updatedTransforms[entity.id] = {
          position: { x: newX, y: newY },
          ...(rotChanged ? { rotation: newRot } : {}),
          ...(flipChanged ? { flipX: nextFlipX } : {}),
        };
      }
    } else if (body) {
      // Cas 2 : Entité indépendante (ou parent racine)
      const hasRotationBehavior = effectiveBehaviors.some(
        (b) =>
          b.type === 'look_at' ||
          (b.type === 'constant_velocity' && !!(b as ConstantVelocityBehaviorConfig).angularVelocity) ||
          (b.type === 'wandering' && !!(b as WanderingBehaviorConfig).orientToMovement)
      );

      const isActivelyDragged = Boolean(activeDragPositions[entity.id]);
      if (isActivelyDragged) {
        const dp = activeDragPositions[entity.id];
        newX = dp.x;
        newY = dp.y;
      } else if (!body.isStatic || hasRotationBehavior) {
        const offset = colliderOffsets.get(entity.id) || {
          relCenterX: entity.size.width / 2,
          relCenterY: entity.size.height / 2,
        };

        newX = Math.round((body.position.x - offset.relCenterX) * 10) / 10;
        newY = Math.round((body.position.y - offset.relCenterY) * 10) / 10;
        newRot = isRotFrozen ? 0 : Math.round(((body.angle * 180) / Math.PI) * 10) / 10;

        const posChanged = Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05;
        const rotChanged = !isRotFrozen && Math.abs(newRot - (currentState?.rotation || 0)) > 0.1;
        const flipChanged = flipUpdates.has(entity.id) && (entity.flipX ?? false) !== nextFlipX;

        if (posChanged || rotChanged || flipChanged) {
          updatedTransforms[entity.id] = {
            position: { x: newX, y: newY },
            ...(rotChanged ? { rotation: newRot } : isRotFrozen ? { rotation: 0 } : {}),
            ...(flipChanged ? { flipX: nextFlipX } : {}),
          };
        }
      }
    }

    resolvedTransforms.set(entity.id, {
      position: { x: newX, y: newY },
      rotation: newRot,
      flipX: nextFlipX,
    });

    // Cas 3 : Émetteur de particules continu léger
    if (emitter && emitter.enabled !== false) {
      const rate = Math.max(1, Math.min(40, emitter.rate ?? 12));
      const acc = (particleEmitterAccumulators.get(entity.id) || 0) + dt * rate;
      const toEmit = Math.floor(acc);
      particleEmitterAccumulators.set(entity.id, acc - toEmit);

      if (toEmit > 0) {
        const centerX = newX + entity.size.width / 2;
        const centerY = newY + entity.size.height / 2;
        const rawOx = nextFlipX ? -(emitter.offsetX ?? 0) : (emitter.offsetX ?? 0);
        const rawOy = emitter.offsetY ?? 0;
        const rad = (newRot * Math.PI) / 180;
        const emitX = centerX + rawOx * Math.cos(rad) - rawOy * Math.sin(rad);
        const emitY = centerY + rawOx * Math.sin(rad) + rawOy * Math.cos(rad);

        emitParticlesBurst({
          x: emitX,
          y: emitY,
          count: toEmit,
          color: emitter.color || '#f59e0b',
          color2: emitter.color2,
          shape: emitter.shape || 'circle',
          customParticleId: emitter.customParticleId,
          customParticleIds: emitter.customParticleIds,
          customParticleMode: emitter.customParticleMode,
          useTint: emitter.useParticleTint,
          speed: emitter.speed ?? 120,
          size: emitter.size ?? 6,
          lifetime: emitter.lifetime ?? 0.6,
          gravity: emitter.gravity ?? 150,
          spread: emitter.spread ?? 60,
          angle: (emitter.angle ?? -90) + newRot,
        });
      }
    }
  }

  return {
    updatedTransforms,
    ...(entitiesToDestroy.length > 0 ? { entitiesToDestroy } : {}),
  };
}
