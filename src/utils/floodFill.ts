import { VectorPath, VectorPoint, VectorRect } from '../types';

/**
 * Standard Ray-Casting algorithm for point-in-polygon hit testing.
 */
function isPointInPoly(pt: VectorPoint, polygon: VectorPoint[]): boolean {
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;
    const intersect =
      yi > pt.y !== yj > pt.y &&
      pt.x < ((xj - xi) * (pt.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Tests if point is inside a rectangle.
 */
function isPointInRect(pt: VectorPoint, rect?: VectorRect): boolean {
  if (!rect) return false;
  const minX = Math.min(rect.x, rect.x + rect.width);
  const maxX = Math.max(rect.x, rect.x + rect.width);
  const minY = Math.min(rect.y, rect.y + rect.height);
  const maxY = Math.max(rect.y, rect.y + rect.height);
  return pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY;
}

/**
 * Standard Ramer-Douglas-Peucker polygon simplification algorithm.
 */
function simplifyPoints(points: VectorPoint[], epsilon: number): VectorPoint[] {
  if (points.length <= 2) return points;

  let maxDist = 0;
  let maxIndex = 0;
  const start = points[0];
  const end = points[points.length - 1];

  const lineDx = end.x - start.x;
  const lineDy = end.y - start.y;
  const lineLengthSq = lineDx * lineDx + lineDy * lineDy;

  for (let i = 1; i < points.length - 1; i++) {
    const pt = points[i];
    let dist = 0;

    if (lineLengthSq === 0) {
      dist = Math.hypot(pt.x - start.x, pt.y - start.y);
    } else {
      const t = Math.max(
        0,
        Math.min(1, ((pt.x - start.x) * lineDx + (pt.y - start.y) * lineDy) / lineLengthSq)
      );
      const projX = start.x + t * lineDx;
      const projY = start.y + t * lineDy;
      dist = Math.hypot(pt.x - projX, pt.y - projY);
    }

    if (dist > maxDist) {
      maxDist = dist;
      maxIndex = i;
    }
  }

  if (maxDist > epsilon) {
    const left = simplifyPoints(points.slice(0, maxIndex + 1), epsilon);
    const right = simplifyPoints(points.slice(maxIndex), epsilon);
    return [...left.slice(0, left.length - 1), ...right];
  } else {
    return [start, end];
  }
}

/**
 * Moore-Neighbor Boundary Tracing algorithm for 2D binary raster mask.
 */
function traceMaskContour(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number
): VectorPoint[] {
  const DIRS: [number, number][] = [
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
    [0, -1],
    [1, -1],
  ];

  const contour: VectorPoint[] = [];
  let currX = startX;
  let currY = startY;
  contour.push({ x: currX, y: currY });

  let backtrackDir = 4;
  let iterations = 0;
  const maxIterations = width * height;

  while (iterations++ < maxIterations) {
    let nextX = currX;
    let nextY = currY;
    let nextDir = -1;

    for (let i = 0; i < 8; i++) {
      const checkDir = (backtrackDir + i) % 8;
      const nx = currX + DIRS[checkDir][0];
      const ny = currY + DIRS[checkDir][1];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        if (mask[ny * width + nx] === 1) {
          nextX = nx;
          nextY = ny;
          nextDir = checkDir;
          break;
        }
      }
    }

    if (nextDir === -1) break;

    if (nextX === startX && nextY === startY && contour.length > 2) {
      break;
    }

    contour.push({ x: nextX, y: nextY });
    currX = nextX;
    currY = nextY;
    backtrackDir = (nextDir + 5) % 8;
  }

  return contour;
}

/**
 * Converts simplified points into a smooth SVG path that respects straight segments
 * (keeps straight borders straight, while naturally curving smooth corners).
 */
function pointsToAdaptivePath(pts: VectorPoint[]): string {
  if (pts.length < 2) return '';
  if (pts.length === 2) return `M ${pts[0].x} ${pts[0].y} L ${pts[1].x} ${pts[1].y} Z`;

  let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  const n = pts.length;

  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const p3 = pts[(i + 2) % n];

    // Determine angle between incoming and outgoing segments
    const v1x = p1.x - p0.x;
    const v1y = p1.y - p0.y;
    const v2x = p2.x - p1.x;
    const v2y = p2.y - p1.y;

    const len1 = Math.hypot(v1x, v1y);
    const len2 = Math.hypot(v2x, v2y);

    let isStraight = false;
    if (len1 > 0.1 && len2 > 0.1) {
      const dot = (v1x * v2x + v1y * v2y) / (len1 * len2);
      // If dot product is high, angle is near 180 degrees (straight line)
      if (dot > 0.96) {
        isStraight = true;
      }
    }

    if (isStraight) {
      d += ` L ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    } else {
      // Catmull-Rom to Cubic Bezier
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
  }

  d += ' Z';
  return d;
}

export type BucketFillResult =
  | { type: 'update_path'; pathId: string; updatedPath: VectorPath }
  | { type: 'new_path'; newPath: VectorPath };

export interface BucketFillBounds {
  width: number;
  height: number;
  originX?: number;
  originY?: number;
}

/**
 * Option B - Hybride Haute Fidélité:
 * 1. Détection directe sur forme fermée existante (100% vectoriel pur, sans aucun polygone créé).
 * 2. Détection haute fidélité pour les zones d'intersections de traits multiples,
 *    compatible espace 200×200 ET espace scène monde (calques).
 */
export function applyBucketFill(
  clickX: number,
  clickY: number,
  paths: VectorPath[],
  fillColor: string,
  targetLayerId?: string,
  bounds?: BucketFillBounds
): BucketFillResult | null {
  if (!fillColor || fillColor === 'none') return null;

  const clickPt: VectorPoint = { x: clickX, y: clickY };

  // =========================================================================
  // NIVEAU 1 : FORMES FERMÉES EXISTANTES (Rectangle, Cercle, Boucle Fermée)
  // =========================================================================
  for (let i = paths.length - 1; i >= 0; i--) {
    const p = paths[i];

    // Cas 1.1 : Rectangle vectoriel
    if (p.rect && isPointInRect(clickPt, p.rect)) {
      return {
        type: 'update_path',
        pathId: p.id,
        updatedPath: {
          ...p,
          fill: fillColor,
        },
      };
    }

    // Cas 1.1b : Cercle vectoriel
    if (p.circle && Math.hypot(clickPt.x - p.circle.cx, clickPt.y - p.circle.cy) <= p.circle.r) {
      return {
        type: 'update_path',
        pathId: p.id,
        updatedPath: {
          ...p,
          fill: fillColor,
        },
      };
    }

    // Cas 1.2 : Tracé avec points (polygone ou boucle fermée à main levée)
    if (p.points && p.points.length >= 3) {
      const first = p.points[0];
      const last = p.points[p.points.length - 1];
      const endpointsDistance = Math.hypot(first.x - last.x, first.y - last.y);
      const isLoop = p.d.trim().endsWith('Z') || endpointsDistance < 14;

      if (isLoop && isPointInPoly(clickPt, p.points)) {
        const closedD = p.d.trim().endsWith('Z') ? p.d : `${p.d} Z`;
        return {
          type: 'update_path',
          pathId: p.id,
          updatedPath: {
            ...p,
            fill: fillColor,
            d: closedD,
          },
        };
      }
    }
  }

  // =========================================================================
  // NIVEAU 2 : ZONES DÉLIMITÉES PAR INTERSECTION DE PLUSIEURS TRACÉS
  // =========================================================================
  if (typeof document === 'undefined') return null;

  const domainWidth = Math.max(100, bounds?.width ?? 200);
  const domainHeight = Math.max(100, bounds?.height ?? 200);
  const originX = bounds?.originX ?? 0;
  const originY = bounds?.originY ?? 0;

  // Pour 200×200 on garde SCALE=5 (1000×1000), pour les grandes scènes monde on plafonne à ~1000px max
  const maxDim = Math.max(domainWidth, domainHeight);
  const SCALE = maxDim <= 220 ? 5 : Math.min(2, Math.max(1, 950 / maxDim));
  const width = Math.max(100, Math.round(domainWidth * SCALE));
  const height = Math.max(100, Math.round(domainHeight * SCALE));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Fond blanc (territoire neutre)
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  ctx.scale(SCALE, SCALE);
  if (originX !== 0 || originY !== 0) {
    ctx.translate(-originX, -originY);
  }

  // Dessin des barrières avec épaisseur fidèle
  paths.forEach((p) => {
    try {
      const p2d = new Path2D(p.d);
      if (p.fill && p.fill !== 'none') {
        ctx.fillStyle = '#000000';
        ctx.fill(p2d);
      }
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = Math.max(3, p.strokeWidth || 4);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke(p2d);
    } catch {
      // Ignorer les tracés mal formés
    }
  });

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let startX = Math.round(Math.max(0, Math.min(width - 1, (clickX - originX) * SCALE)));
  let startY = Math.round(Math.max(0, Math.min(height - 1, (clickY - originY) * SCALE)));

  const isStrokePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return data[idx] < 150;
  };

  if (isStrokePixel(startX, startY)) {
    let found = false;
    for (let r = 1; r <= 15; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          const nx = startX + dx;
          const ny = startY + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            if (!isStrokePixel(nx, ny)) {
              startX = nx;
              startY = ny;
              found = true;
              break;
            }
          }
        }
        if (found) break;
      }
      if (found) break;
    }
    if (!found) return null;
  }

  const visited = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let queueHead = 0;
  let queueTail = 0;

  queue[queueTail++] = startX;
  queue[queueTail++] = startY;
  visited[startY * width + startX] = 1;
  mask[startY * width + startX] = 1;

  let minX = startX;
  let maxX = startX;
  let minY = startY;
  let maxY = startY;
  let filledCount = 0;
  let isBoundaryReached = false;

  while (queueHead < queueTail) {
    const x = queue[queueHead++];
    const y = queue[queueHead++];
    filledCount++;

    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;

    if (x <= 2 || x >= width - 3 || y <= 2 || y >= height - 3) {
      isBoundaryReached = true;
      break;
    }

    const nxList = [x + 1, x - 1, x, x];
    const nyList = [y, y, y + 1, y - 1];

    for (let i = 0; i < 4; i++) {
      const nx = nxList[i];
      const ny = nyList[i];

      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = ny * width + nx;
        if (!visited[idx]) {
          visited[idx] = 1;
          if (!isStrokePixel(nx, ny)) {
            mask[idx] = 1;
            queue[queueTail++] = nx;
            queue[queueTail++] = ny;
          }
        }
      }
    }
  }

  const minFilledPixels = Math.round(10 * SCALE * SCALE);
  if (isBoundaryReached || filledCount < minFilledPixels) {
    return null;
  }

  const dilatedMask = new Uint8Array(width * height);
  const DILATE_R = Math.max(2, Math.round(1.4 * SCALE));
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1) {
        dilatedMask[idx] = 1;
        for (let dy = -DILATE_R; dy <= DILATE_R; dy++) {
          for (let dx = -DILATE_R; dx <= DILATE_R; dx++) {
            if (dx * dx + dy * dy <= DILATE_R * DILATE_R) {
              const nx = x + dx;
              const ny = y + dy;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                dilatedMask[ny * width + nx] = 1;
              }
            }
          }
        }
      }
    }
  }

  let contourStartX = -1;
  let contourStartY = -1;

  for (let y = Math.max(0, minY - DILATE_R); y <= Math.min(height - 1, maxY + DILATE_R); y++) {
    for (let x = Math.max(0, minX - DILATE_R); x <= Math.min(width - 1, maxX + DILATE_R); x++) {
      if (dilatedMask[y * width + x] === 1) {
        contourStartX = x;
        contourStartY = y;
        break;
      }
    }
    if (contourStartX !== -1) break;
  }

  if (contourStartX === -1) return null;

  const rawContour = traceMaskContour(dilatedMask, width, height, contourStartX, contourStartY);
  if (rawContour.length < 4) return null;

  const svgContour = rawContour.map((p) => ({
    x: p.x / SCALE + originX,
    y: p.y / SCALE + originY,
  }));

  const rdpEpsilon = maxDim <= 220 ? 0.6 : 1.2;
  const simplified = simplifyPoints(svgContour, rdpEpsilon);
  if (simplified.length < 3) return null;

  const pathD = pointsToAdaptivePath(simplified);

  return {
    type: 'new_path',
    newPath: {
      id: `fill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      d: pathD,
      stroke: 'none',
      strokeWidth: 0,
      fill: fillColor,
      type: 'fill_bucket',
      points: simplified,
      layerId: targetLayerId,
    },
  };
}

/**
 * Fonction de compatibilité retournant directement un nouveau VectorPath si applicable.
 */
export function floodFillRegion(
  clickX: number,
  clickY: number,
  paths: VectorPath[],
  fillColor: string,
  targetLayerId?: string,
  bounds?: BucketFillBounds
): VectorPath | null {
  const res = applyBucketFill(clickX, clickY, paths, fillColor, targetLayerId, bounds);
  if (!res) return null;
  if (res.type === 'new_path') return res.newPath;
  return res.updatedPath;
}
