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
    if (p.rect) {
      hasBounds = true;
      const rx = p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x;
      const ry = p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y;
      minX = Math.min(minX, rx);
      maxX = Math.max(maxX, rx + Math.abs(p.rect.width));
      minY = Math.min(minY, ry);
      maxY = Math.max(maxY, ry + Math.abs(p.rect.height));
    } else if (p.points && p.points.length > 0) {
      hasBounds = true;
      p.points.forEach((pt) => {
        minX = Math.min(minX, pt.x);
        maxX = Math.max(maxX, pt.x);
        minY = Math.min(minY, pt.y);
        maxY = Math.max(maxY, pt.y);
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
            minX = Math.min(minX, px);
            maxX = Math.max(maxX, px);
            minY = Math.min(minY, py);
            maxY = Math.max(maxY, py);
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
export function getEntityColliderBounds(entity: Entity, currentState?: EntityState): EntityColliderGeometry {
  const effectiveState = currentState || entity.states[entity.currentStateId];
  const colliderType: ColliderType =
    effectiveState?.colliderType || entity.colliderType || (entity.type === 'apple' ? 'circle' : 'box');

  const paths = effectiveState?.vectorPaths || entity.vectorPaths;

  if (paths && paths.length > 0) {
    const { minX, maxX, minY, maxY, hasBounds } = extractPathsBounds(paths);

    if (hasBounds && maxX > minX && maxY > minY) {
      const padding = 4; // Exact padding used in DrawingCanvas
      const x = Math.max(0, minX - padding);
      const y = Math.max(0, minY - padding);
      const width = Math.min(200, maxX - minX + padding * 2);
      const height = Math.min(200, maxY - minY + padding * 2);
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
  }

  // Fallback for icons or default procedural entities (centered 100x100 zone in 200x200 canvas)
  const fallbackSize = 100;
  const x = (200 - fallbackSize) / 2;
  const y = (200 - fallbackSize) / 2;
  const width = fallbackSize;
  const height = fallbackSize;
  const centerX = 100;
  const centerY = 100;
  const radius = fallbackSize / 2;

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

  const geometry = getEntityColliderBounds(entity, currentState);

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
