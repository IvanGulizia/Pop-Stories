import { VectorPath, VectorPoint, VectorRect } from '../types';

/**
 * Génère un chemin SVG standard pour un rectangle (éventuellement aux coins arrondis).
 */
export function generateRoundedRectPath(rect: VectorRect): string {
  const { x, y, width, height } = rect;
  const maxR = Math.min(Math.abs(width), Math.abs(height)) / 2;
  const r = Math.min(maxR, Math.max(0, rect.cornerRadius || 0));

  const rx = width < 0 ? x + width : x;
  const ry = height < 0 ? y + height : y;
  const rw = Math.abs(width);
  const rh = Math.abs(height);

  if (r <= 0) {
    return `M ${rx} ${ry} h ${rw} v ${rh} h ${-rw} Z`;
  }

  return (
    `M ${rx + r} ${ry} ` +
    `h ${rw - 2 * r} ` +
    `a ${r} ${r} 0 0 1 ${r} ${r} ` +
    `v ${rh - 2 * r} ` +
    `a ${r} ${r} 0 0 1 ${-r} ${r} ` +
    `h ${-(rw - 2 * r)} ` +
    `a ${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `v ${-(rh - 2 * r)} ` +
    `a ${r} ${r} 0 0 1 ${r} ${-r} Z`
  );
}

/**
 * Génère un chemin SVG fermé pour un cercle.
 */
export function generateCirclePath(cx: number, cy: number, r: number): string {
  const safeR = Math.max(1, r);
  return `M ${cx - safeR} ${cy} a ${safeR} ${safeR} 0 1 0 ${safeR * 2} 0 a ${safeR} ${safeR} 0 1 0 ${-safeR * 2} 0 Z`;
}

/**
 * Génère des points périmétriques pour un cercle (utile pour les colliders et hit-testing).
 */
export function generateCirclePerimeterPoints(
  cx: number,
  cy: number,
  r: number,
  segments = 24
): VectorPoint[] {
  const safeR = Math.max(1, r);
  return Array.from({ length: segments }, (_, idx) => {
    const a = (idx / segments) * Math.PI * 2;
    return {
      x: Math.round((cx + Math.cos(a) * safeR) * 10) / 10,
      y: Math.round((cy + Math.sin(a) * safeR) * 10) / 10,
    };
  });
}

/**
 * Génère un chemin SVG pour un segment droit.
 */
export function generateLinePath(a: VectorPoint, b: VectorPoint): string {
  return `M ${a.x} ${a.y} L ${b.x} ${b.y}`;
}

/**
 * Convertit un tableau de points en courbe lissée quadratique.
 */
export function pointsToSmoothPath(points: VectorPoint[], isClosed = false): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    path += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${xc} ${yc}`;
  }
  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  if (isClosed) {
    path += ' Z';
  }
  return path;
}

/**
 * Convertit un tableau de points en segments droits (polyligne).
 */
export function pointsToPolylinePath(points: VectorPoint[], isClosed = false): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  if (isClosed) {
    path += ' Z';
  }
  return path;
}

/**
 * Test point-dans-polygone (Ray Casting).
 */
export function isPointInPolygon(point: VectorPoint, vs: VectorPoint[]): boolean {
  if (vs.length < 3) return false;
  const x = point.x;
  const y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x;
    const yi = vs[i].y;
    const xj = vs[j].x;
    const yj = vs[j].y;
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi || 1e-6) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Distance minimale d'un point P à un segment [A, B].
 */
export function distToSegment(p: VectorPoint, a: VectorPoint, b: VectorPoint): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(p.x - a.x, p.y - a.y);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

/**
 * Calcule la boîte englobante d'un tracé vectoriel.
 */
export function getPathBounds(
  p: VectorPath,
  fallbackSize = 200
): { x: number; y: number; width: number; height: number } {
  if (p.rect) {
    const rx = p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x;
    const ry = p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y;
    return {
      x: rx,
      y: ry,
      width: Math.max(4, Math.abs(p.rect.width)),
      height: Math.max(4, Math.abs(p.rect.height)),
    };
  }
  if (p.circle) {
    const { cx, cy, r } = p.circle;
    return {
      x: cx - r,
      y: cy - r,
      width: Math.max(4, r * 2),
      height: Math.max(4, r * 2),
    };
  }
  if (p.points && p.points.length > 0) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const pt of p.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  }
  // Fallback : extraction numérique basique depuis `d`
  const nums = p.d.match(/-?\d+(\.\d+)?/g)?.map(Number);
  if (nums && nums.length >= 2) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i + 1 < nums.length; i += 2) {
      const x = nums[i];
      const y = nums[i + 1];
      if (!Number.isNaN(x) && !Number.isNaN(y)) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
    if (minX !== Infinity) {
      return {
        x: minX,
        y: minY,
        width: Math.max(8, maxX - minX),
        height: Math.max(8, maxY - minY),
      };
    }
  }
  return { x: 0, y: 0, width: fallbackSize, height: fallbackSize };
}

/**
 * Calcule la boîte englobante globale d'une sélection de tracés.
 */
export function getSelectionBoundingBox(
  paths: VectorPath[],
  selectedIds: string[]
): { x: number; y: number; width: number; height: number } | null {
  if (selectedIds.length === 0) return null;
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let count = 0;
  for (const p of paths) {
    if (!selectedIds.includes(p.id)) continue;
    const b = getPathBounds(p);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
    count++;
  }
  if (count === 0 || minX === Infinity) return null;
  return {
    x: minX,
    y: minY,
    width: Math.max(8, maxX - minX),
    height: Math.max(8, maxY - minY),
  };
}

/**
 * Hit-test précis d'un tracé vectoriel à une position donnée.
 */
export function isPointNearPath(p: VectorPath, pt: VectorPoint, radius: number): boolean {
  const strokePad = Math.max(radius, (p.strokeWidth || 4) / 2 + radius * 0.5);

  if (p.rect) {
    const b = getPathBounds(p);
    const hasFill = p.fill && p.fill !== 'none';
    if (hasFill) {
      return (
        pt.x >= b.x - strokePad &&
        pt.x <= b.x + b.width + strokePad &&
        pt.y >= b.y - strokePad &&
        pt.y <= b.y + b.height + strokePad
      );
    }
    const corners: VectorPoint[] = [
      { x: b.x, y: b.y },
      { x: b.x + b.width, y: b.y },
      { x: b.x + b.width, y: b.y + b.height },
      { x: b.x, y: b.y + b.height },
    ];
    for (let i = 0; i < 4; i++) {
      if (distToSegment(pt, corners[i], corners[(i + 1) % 4]) <= strokePad) return true;
    }
    return false;
  }

  if (p.circle) {
    const d = Math.hypot(pt.x - p.circle.cx, pt.y - p.circle.cy);
    const hasFill = p.fill && p.fill !== 'none';
    if (hasFill) return d <= p.circle.r + strokePad;
    return Math.abs(d - p.circle.r) <= strokePad;
  }

  if (p.points && p.points.length > 0) {
    if (p.fill && p.fill !== 'none' && p.points.length >= 3 && isPointInPolygon(pt, p.points)) {
      return true;
    }
    if (p.points.length === 1) {
      return Math.hypot(p.points[0].x - pt.x, p.points[0].y - pt.y) <= strokePad;
    }
    for (let i = 0; i < p.points.length - 1; i++) {
      if (distToSegment(pt, p.points[i], p.points[i + 1]) <= strokePad) return true;
    }
    if (p.d.trim().endsWith('Z') && p.points.length >= 3) {
      if (distToSegment(pt, p.points[p.points.length - 1], p.points[0]) <= strokePad) {
        return true;
      }
    }
    return false;
  }

  const b = getPathBounds(p);
  return (
    pt.x >= b.x - strokePad &&
    pt.x <= b.x + b.width + strokePad &&
    pt.y >= b.y - strokePad &&
    pt.y <= b.y + b.height + strokePad
  );
}

/**
 * Translate un tracé vectoriel de (dx, dy).
 */
export function translatePath(p: VectorPath, dx: number, dy: number): VectorPath {
  if (p.rect) {
    const newRect = { ...p.rect, x: p.rect.x + dx, y: p.rect.y + dy };
    return {
      ...p,
      rect: newRect,
      d: generateRoundedRectPath(newRect),
      points: p.points ? p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })) : p.points,
    };
  }
  if (p.circle) {
    const cx = p.circle.cx + dx;
    const cy = p.circle.cy + dy;
    const r = p.circle.r;
    return {
      ...p,
      circle: { cx, cy, r },
      d: generateCirclePath(cx, cy, r),
      points: generateCirclePerimeterPoints(cx, cy, r),
    };
  }
  if (p.points && p.points.length > 0) {
    const newPoints = p.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy }));
    const isClosed = p.d.trim().endsWith('Z');
    const newD =
      p.type === 'straight' && newPoints.length >= 2
        ? generateLinePath(newPoints[0], newPoints[newPoints.length - 1])
        : p.type === 'polyline'
        ? pointsToPolylinePath(newPoints, isClosed)
        : pointsToSmoothPath(newPoints, isClosed);
    return {
      ...p,
      points: newPoints,
      d: newD,
    };
  }
  return p;
}

/**
 * Redimensionne un rectangle ou cercle à l'intérieur d'un nouveau VectorRect.
 */
export function resizeShapeToRect(p: VectorPath, newRect: VectorRect): VectorPath {
  if (p.rect) {
    return {
      ...p,
      rect: newRect,
      d: generateRoundedRectPath(newRect),
    };
  }
  if (p.circle) {
    const rx = newRect.width < 0 ? newRect.x + newRect.width : newRect.x;
    const ry = newRect.height < 0 ? newRect.y + newRect.height : newRect.y;
    const rw = Math.abs(newRect.width);
    const rh = Math.abs(newRect.height);
    const r = Math.max(3, Math.min(rw, rh) / 2);
    const cx = rx + rw / 2;
    const cy = ry + rh / 2;
    return {
      ...p,
      circle: { cx, cy, r },
      d: generateCirclePath(cx, cy, r),
      points: generateCirclePerimeterPoints(cx, cy, r),
    };
  }
  return p;
}

/**
 * Sous-échantillonne les segments longs (ex: lignes droites à 2 points)
 * afin que la gomme précise puisse couper n'importe quelle portion d'un trait droit.
 */
function densifyPoints(points: VectorPoint[], step: number): VectorPoint[] {
  if (points.length < 2) return points;
  const out: VectorPoint[] = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const dist = Math.hypot(curr.x - prev.x, curr.y - prev.y);
    if (dist > step) {
      const steps = Math.min(120, Math.ceil(dist / step));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push({
          x: prev.x + (curr.x - prev.x) * t,
          y: prev.y + (curr.y - prev.y) * t,
        });
      }
    }
    out.push(curr);
  }
  return out;
}

/**
 * Gomme Précise (partielle) : coupe les segments de traits à l'intérieur du rayon donné,
 * et efface les formes géométriques touchées.
 */
export function erasePathsAtPoint(
  paths: VectorPath[],
  pt: VectorPoint,
  radius: number,
  targetLayerId?: string,
  fallbackLayerId?: string
): { nextPaths: VectorPath[]; changed: boolean } {
  let changed = false;
  const nextPaths: VectorPath[] = [];
  const stepSize = Math.max(2, Math.min(8, radius * 0.45));

  for (const p of paths) {
    if (targetLayerId) {
      const resolvedLayer = p.layerId || fallbackLayerId;
      if (resolvedLayer !== targetLayerId) {
        nextPaths.push(p);
        continue;
      }
    }

    if (p.rect || p.circle || p.type === 'fill_bucket') {
      if (isPointNearPath(p, pt, radius)) {
        changed = true;
        continue;
      }
      nextPaths.push(p);
      continue;
    }

    if (p.points && p.points.length > 0) {
      const sampled = p.type === 'straight' || p.type === 'polyline'
        ? densifyPoints(p.points, stepSize)
        : p.points;

      const remainingChunks: VectorPoint[][] = [];
      let currentChunk: VectorPoint[] = [];
      let pathChanged = false;

      for (const pPoint of sampled) {
        const dist = Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y);
        if (dist <= radius) {
          pathChanged = true;
          changed = true;
          if (currentChunk.length >= 2) {
            remainingChunks.push(currentChunk);
          }
          currentChunk = [];
        } else {
          currentChunk.push(pPoint);
        }
      }

      if (currentChunk.length >= 2) {
        remainingChunks.push(currentChunk);
      }

      if (!pathChanged) {
        nextPaths.push(p);
      } else if (remainingChunks.length > 0) {
        remainingChunks.forEach((chunk, cIdx) => {
          const isClosed = p.d.trim().endsWith('Z') && remainingChunks.length === 1;
          const newD =
            p.type === 'polyline' || p.type === 'straight'
              ? pointsToPolylinePath(chunk, isClosed)
              : pointsToSmoothPath(chunk, isClosed);
          nextPaths.push({
            ...p,
            id: `${p.id}-sub-${cIdx}-${Date.now().toString(36)}`,
            type: p.type === 'straight' ? 'polyline' : p.type,
            points: chunk,
            d: newD,
          });
        });
      }
    } else if (isPointNearPath(p, pt, radius)) {
      changed = true;
    } else {
      nextPaths.push(p);
    }
  }

  return { nextPaths, changed };
}

/**
 * Gomme Trait / Objet : supprime la forme entière touchée par le pointeur.
 */
export function eraseWholeStrokesAtPoint(
  paths: VectorPath[],
  pt: VectorPoint,
  radius: number,
  targetLayerId?: string,
  fallbackLayerId?: string
): { nextPaths: VectorPath[]; changed: boolean } {
  let changed = false;
  const nextPaths = paths.filter((p) => {
    if (targetLayerId) {
      const resolvedLayer = p.layerId || fallbackLayerId;
      if (resolvedLayer !== targetLayerId) return true;
    }
    if (isPointNearPath(p, pt, radius)) {
      changed = true;
      return false;
    }
    return true;
  });
  return { nextPaths, changed };
}
