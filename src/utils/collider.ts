import { ColliderType, Entity, EntityState } from '../types';

/**
 * Verifies if a screen click or pointer event (clientX, clientY) falls strictly
 * within the collider shape defined in the drawing workshop / entity definition.
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

  // Local coordinates relative to entity bounding box container
  const localX = clientX - rect.left;
  const localY = clientY - rect.top;

  // If completely outside the container
  if (localX < 0 || localX > rect.width || localY < 0 || localY > rect.height) {
    return false;
  }

  const effectiveState = currentState || entity.states[entity.currentStateId];
  const colliderType: ColliderType =
    effectiveState?.colliderType || entity.colliderType || (entity.type === 'apple' ? 'circle' : 'box');

  const scale = effectiveState?.scale ?? 1;
  const paths = effectiveState?.vectorPaths || entity.vectorPaths;

  // If custom drawing vector paths exist, compute bounds from the actual paths
  if (paths && paths.length > 0) {
    let minX = 200, maxX = 0, minY = 200, maxY = 0;
    let hasValidBounds = false;

    paths.forEach((p) => {
      if (p.rect) {
        hasValidBounds = true;
        const rx = p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x;
        const ry = p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y;
        minX = Math.min(minX, rx);
        maxX = Math.max(maxX, rx + Math.abs(p.rect.width));
        minY = Math.min(minY, ry);
        maxY = Math.max(maxY, ry + Math.abs(p.rect.height));
      } else if (p.points && p.points.length > 0) {
        hasValidBounds = true;
        p.points.forEach((pt) => {
          minX = Math.min(minX, pt.x);
          maxX = Math.max(maxX, pt.x);
          minY = Math.min(minY, pt.y);
          maxY = Math.max(maxY, pt.y);
        });
      }
    });

    if (hasValidBounds && maxX > minX && maxY > minY) {
      // Scale from 200x200 canvas coordinates to actual DOM rendered pixel size
      const scaleX = rect.width / 200;
      const scaleY = rect.height / 200;

      const pathW = (maxX - minX) * scaleX;
      const pathH = (maxY - minY) * scaleY;
      const pathLeft = minX * scaleX;
      const pathTop = minY * scaleY;

      const margin = 6; // small tolerance margin for comfortable touch / cursor precision

      if (colliderType === 'circle') {
        const cx = pathLeft + pathW / 2;
        const cy = pathTop + pathH / 2;
        const radius = Math.max(pathW, pathH) / 2 + margin;
        const dx = localX - cx;
        const dy = localY - cy;
        return dx * dx + dy * dy <= radius * radius;
      }

      // Box / Polygon bounding area
      return (
        localX >= pathLeft - margin &&
        localX <= pathLeft + pathW + margin &&
        localY >= pathTop - margin &&
        localY <= pathTop + pathH + margin
      );
    }
  }

  // Fallback for procedural entities (Apple, Plant, or default shapes without paths)
  if (colliderType === 'circle' || entity.type === 'apple') {
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    const radius = (Math.min(rect.width, rect.height) / 2) * Math.max(0.2, scale) + 4;

    const dx = localX - centerX;
    const dy = localY - centerY;
    return dx * dx + dy * dy <= radius * radius;
  }

  if (colliderType === 'box') {
    const boxW = rect.width * Math.min(1, scale);
    const boxH = rect.height * Math.min(1, scale);
    const minX = (rect.width - boxW) / 2;
    const maxX = minX + boxW;
    const minY = (rect.height - boxH) / 2;
    const maxY = minY + boxH;

    return localX >= minX && localX <= maxX && localY >= minY && localY <= maxY;
  }

  return true;
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
