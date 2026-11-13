import { ColliderType, Entity, EntityState, VectorPath } from '../types';

export interface EntityColliderGeometry {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  colliderType: ColliderType;
}

/**
 * Extracts coordinate bounds from SVG vector paths in 200x200 canvas space.
 */
export function extractPathsBounds(paths: VectorPath[]): { minX: number; maxX: number; minY: number; maxY: number; hasBounds: boolean } {
  let minX = 200;
  let maxX = 0;
  let minY = 200;
  let maxY = 0;
  let hasBounds = false;

  paths.forEach((p) => {
    const halfStroke = (p.strokeWidth || 2) / 2;
    if (p.rect) {
      hasBounds = true;
      const rx = p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x;
      const ry = p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y;
      minX = Math.min(minX, rx - halfStroke);
      maxX = Math.max(maxX, rx + Math.abs(p.rect.width) + halfStroke);
      minY = Math.min(minY, ry - halfStroke);
      maxY = Math.max(maxY, ry + Math.abs(p.rect.height) + halfStroke);
    } else if (p.points && p.points.length > 0) {
      hasBounds = true;
      p.points.forEach((pt) => {
        minX = Math.min(minX, pt.x - halfStroke);
        maxX = Math.max(maxX, pt.x + halfStroke);
        minY = Math.min(minY, pt.y - halfStroke);
        maxY = Math.max(maxY, pt.y + halfStroke);
      });
    } else if (p.d) {
      // Fallback: parse numbers from SVG path string
      const numbers = p.d.match(/-?\d+(?:\.\d+)?/g);
      if (numbers && numbers.length >= 2) {
        hasBounds = true;
        for (let i = 0; i < numbers.length; i += 2) {
          const px = parseFloat(numbers[i]);
          const py = i + 1 < numbers.length ? parseFloat(numbers[i + 1]) : px;
          if (!isNaN(px) && !isNaN(py)) {
            minX = Math.min(minX, px - halfStroke);
            maxX = Math.max(maxX, px + halfStroke);
            minY = Math.min(minY, py - halfStroke);
            maxY = Math.max(maxY, py + halfStroke);
          }
        }
      }
    }
  });

  return { minX, maxX, minY, maxY, hasBounds };
}

/**
 * Calculates the exact collider geometry in 200x200 canvas space.
 */
export function getEntityColliderBounds(
  entity: Entity,
  currentState?: EntityState,
  flipX: boolean = Boolean(entity.flipX)
): EntityColliderGeometry {
  const effectiveState = currentState || entity.states[entity.currentStateId];
  const colliderType: ColliderType =
    effectiveState?.colliderType || entity.colliderType || (entity.type === 'apple' ? 'circle' : 'box');

  const paths = effectiveState?.vectorPaths || entity.vectorPaths;

  let rawX = 0;
  let rawY = 0;
  let width = 160;
  let height = 160;

  if (paths && paths.length > 0) {
    const { minX, maxX, minY, maxY, hasBounds } = extractPathsBounds(paths);

    if (hasBounds && maxX > minX && maxY > minY) {
      // Ajustement serré au tracé pour éliminer tout offset ou flottement visuel
      rawX = Math.max(0, Math.round(minX));
      rawY = Math.max(0, Math.round(minY));
      width = Math.min(200, Math.max(8, Math.round(maxX - minX)));
      height = Math.min(200, Math.max(8, Math.round(maxY - minY)));
    } else {
      rawX = (200 - width) / 2;
      rawY = (200 - height) / 2;
    }
  } else {
    // Fallback procédural calibré sur les proportions de rendu réelles
    if (entity.type === 'apple') {
      width = 170; // 85% du conteneur
      height = 170;
    } else if (entity.type === 'plant') {
      width = 150;
      height = 170;
    }
    rawX = (200 - width) / 2;
    rawY = (200 - height) / 2;
  }

  // Miroir horizontal fidèle lorsque flipX est activé sur le visuel
  const x = flipX ? Math.max(0, Math.min(200 - width, 200 - (rawX + width))) : rawX;
  const y = rawY;
  const centerX = x + width / 2;
  const centerY = y + height / 2;
  const radius = Math.max(width, height) / 2;

  return {
    x,
    y,
    width,
    height,
    centerX,
    centerY,
    radius,
    colliderType,
  };
}

/**
 * Computes exact world-space collider bounds factoring in centered DOM transform scale and flipX.
 */
export function getEntityWorldColliderBounds(
  entity: Entity,
  currentState?: EntityState
): {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
  colliderType: ColliderType;
  scaleX: number;
  scaleY: number;
} {
  const effectiveState = currentState || entity.states[entity.currentStateId];
  const s = effectiveState?.scale ?? 1;
  const geom = getEntityColliderBounds(entity, effectiveState, Boolean(entity.flipX));
  const scaleX = (entity.size.width * s) / 200;
  const scaleY = (entity.size.height * s) / 200;

  // CSS transform: scale(s) avec transform-origin: center décale le coin haut-gauche de W*(1-s)/2
  const originOffsetX = (entity.size.width * (1 - s)) / 2;
  const originOffsetY = (entity.size.height * (1 - s)) / 2;

  return {
    x: entity.position.x + originOffsetX + geom.x * scaleX,
    y: entity.position.y + originOffsetY + geom.y * scaleY,
    width: geom.width * scaleX,
    height: geom.height * scaleY,
    centerX: entity.position.x + originOffsetX + geom.centerX * scaleX,
    centerY: entity.position.y + originOffsetY + geom.centerY * scaleY,
    radius: geom.radius * Math.max(scaleX, scaleY),
    colliderType: geom.colliderType,
    scaleX,
    scaleY,
  };
}

/**
 * Verifies if a screen click or pointer event (clientX, clientY) falls strictly
 * within the green collider shape defined in the drawing workshop / entity definition.
 */
export function isPointInsideEntityCollider(
  clientX: number,
  clientY: number,
  element: HTMLElement | null,
  entity: Entity,
  currentState?: EntityState
): boolean {
  if (!element) return true;

  const rect = element.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return true;

  // Local coordinates relative to entity bounding box container [0, rect.width] x [0, rect.height]
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  // If completely outside the container
  if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
    return false;
  }

  const geometry = getEntityColliderBounds(entity, currentState, Boolean(entity.flipX));

  // Scale from 200x200 canvas coordinate space to actual DOM rendered pixel dimensions
  const scaleX = rect.width / 200;
  const scaleY = rect.height / 200;

  // Tolerance margin (3px) for smooth cursor interaction
  const margin = 3;

  if (geometry.colliderType === 'circle') {
    const cx = geometry.centerX * scaleX;
    const cy = geometry.centerY * scaleY;
    const r = geometry.radius * Math.max(scaleX, scaleY) + margin;
    const dx = localX - cx;
    const dy = localY - cy;
    return dx * dx + dy * dy <= r * r;
  }

  // Box / Polygon bounding collider
  const x0 = geometry.x * scaleX - margin;
  const y0 = geometry.y * scaleY - margin;
  const w = geometry.width * scaleX + margin * 2;
  const h = geometry.height * scaleY + margin * 2;

  return localX >= x0 && localX <= x0 + w && localY >= y0 && localY <= y0 + h;
}

/**
 * Returns CSS clip-path for rendering clean visual and event boundaries.
 */
export function getColliderClipPath(colliderType?: ColliderType): string | undefined {
  if (colliderType === 'circle') {
    return 'circle(50% at 50% 50%)';
  }
  if (colliderType === 'box') {
    return 'inset(0% round 16px)';
  }
  return undefined;
}

/**
 * Computes exact CSS clip-path percentage string matching the green collider bounds.
 * Allows clicks outside the collider to pass through to underlying elements natively.
 */
export function getEntityColliderClipPath(entity: Entity, currentState?: EntityState): string {
  const geom = getEntityColliderBounds(entity, currentState, Boolean(entity.flipX));
  if (geom.colliderType === 'circle') {
    const cxPct = ((geom.centerX / 200) * 100).toFixed(2);
    const cyPct = ((geom.centerY / 200) * 100).toFixed(2);
    const rPct = ((geom.radius / 200) * 100).toFixed(2);
    return `circle(${rPct}% at ${cxPct}% ${cyPct}%)`;
  }

  const topPct = Math.max(0, (geom.y / 200) * 100).toFixed(2);
  const rightPct = Math.max(0, ((200 - (geom.x + geom.width)) / 200) * 100).toFixed(2);
  const bottomPct = Math.max(0, ((200 - (geom.y + geom.height)) / 200) * 100).toFixed(2);
  const leftPct = Math.max(0, (geom.x / 200) * 100).toFixed(2);

  return `inset(${topPct}% ${rightPct}% ${bottomPct}% ${leftPct}% round 12px)`;
}
