import Matter from 'matter-js';
import { Position, SceneLayer } from '../../types';

const { Bodies, Body } = Matter;

export interface ColliderLayerEntityBounds {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  colliderType: string;
}

/**
 * Calcule le point le plus proche entre un point P et un segment [A, B], ainsi que la distance.
 */
export function closestPointOnSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): { x: number; y: number; dist: number } {
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
 * Décimation légère d'une polyligne pour produire des capsules de collision fluides et performantes.
 */
export function decimatePolyline(points: Position[], minDist: number): Position[] {
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
 * Vérifie si une entité entre en contact avec un calque Collider de décor (via Matter.js ou géométrie exacte des segments).
 */
export function checkEntityAgainstColliderLayerGeometry(
  entityBounds: ColliderLayerEntityBounds,
  entityId: string,
  layer: SceneLayer,
  canvasBounds: { width: number; height: number },
  tolerancePx: number = 3,
  activePhysicsCollisionPairs?: Set<string>,
  activePhysicsCollisionContacts?: Map<string, Position>
): { colliding: boolean; contactPoint?: Position } {
  const layerBodyLabel = `layercol::${layer.id}`;
  if (
    activePhysicsCollisionPairs &&
    (activePhysicsCollisionPairs.has(`${entityId}:::${layerBodyLabel}`) ||
      activePhysicsCollisionPairs.has(`${layerBodyLabel}:::${entityId}`))
  ) {
    return {
      colliding: true,
      contactPoint:
        activePhysicsCollisionContacts?.get(`${entityId}:::${layerBodyLabel}`) ||
        activePhysicsCollisionContacts?.get(`${layerBodyLabel}:::${entityId}`),
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
            contactPoint: {
              x: Math.round(cx + (entityBounds.centerX - cx) * t),
              y: Math.round(cy + (entityBounds.centerY - cy) * t),
            },
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
        if (
          dBox.dist <= halfStroke + tol ||
          (hit.dist <= boxReach + halfStroke + tol &&
            hit.x >= entityBounds.x - halfStroke - tol &&
            hit.x <= entityBounds.x + entityBounds.width + halfStroke + tol &&
            hit.y >= entityBounds.y - halfStroke - tol &&
            hit.y <= entityBounds.y + entityBounds.height + halfStroke + tol)
        ) {
          return { colliding: true, contactPoint: { x: Math.round(dBox.x), y: Math.round(dBox.y) } };
        }
      }
    }
  }

  return { colliding: false };
}

/**
 * Construit les corps statiques Matter.js précis correspondant aux tracés d'un calque Collider.
 */
export function buildColliderLayerBodies(
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

    const pts = (p.points || []).map((pt) => ({ x: pt.x * sx, y: pt.y * sy }));
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
