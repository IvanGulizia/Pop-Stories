import { VectorPath, VectorPoint } from '../types';
import { pointsToSmoothPath } from '../components/DrawingCanvas';

/**
 * Standard Ramer-Douglas-Peucker polygon simplification algorithm.
 * Reduces raw pixel-stepped contour points into a clean, smooth vector curve.
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
      // Perpendicular distance from pt to line segment (start -> end)
      const t = Math.max(0, Math.min(1, ((pt.x - start.x) * lineDx + (pt.y - start.y) * lineDy) / lineLengthSq));
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
 * Extracts ordered perimeter points traversing clockwise around the connected mask.
 */
function traceMaskContour(
  mask: Uint8Array,
  width: number,
  height: number,
  startX: number,
  startY: number
): VectorPoint[] {
  // 8 neighborhood directions (Clockwise, starting East)
  const DIRS: [number, number][] = [
    [1, 0],   // 0: E
    [1, 1],   // 1: SE
    [0, 1],   // 2: S
    [-1, 1],  // 3: SW
    [-1, 0],  // 4: W
    [-1, -1], // 5: NW
    [0, -1],  // 6: N
    [1, -1],  // 7: NE
  ];

  const contour: VectorPoint[] = [];
  let currX = startX;
  let currY = startY;
  contour.push({ x: currX, y: currY });

  // Backtracking direction index (entering from West, index 4, so start checking from (dir + 5) % 8)
  let backtrackDir = 4;
  let iterations = 0;
  const maxIterations = width * height;

  while (iterations++ < maxIterations) {
    let nextX = currX;
    let nextY = currY;
    let nextDir = -1;

    // Search clockwise around the 8 neighbors
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

    // Isolated point or unable to proceed
    if (nextDir === -1) break;

    // Returned to start pixel
    if (nextX === startX && nextY === startY && contour.length > 2) {
      break;
    }

    contour.push({ x: nextX, y: nextY });
    currX = nextX;
    currY = nextY;
    // Backtracking direction for next search
    backtrackDir = (nextDir + 5) % 8;
  }

  return contour;
}

/**
 * Performs a 2D Visual Flood Fill on a 200x200 canvas.
 * Accurately detects any enclosed region formed by one or multiple intersecting strokes,
 * and generates a clean, standalone vector fill shape placed BEHIND the strokes,
 * without altering or closing the original line strokes!
 */
export function floodFillRegion(
  clickX: number,
  clickY: number,
  paths: VectorPath[],
  fillColor: string
): VectorPath | null {
  if (!fillColor || fillColor === 'none') return null;
  if (typeof document === 'undefined') return null;

  const width = 200;
  const height = 200;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  // Background white
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  // Render all existing vector paths as black barriers
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
      // ignore
    }
  });

  const imgData = ctx.getImageData(0, 0, width, height);
  const data = imgData.data;

  let startX = Math.round(Math.max(0, Math.min(width - 1, clickX)));
  let startY = Math.round(Math.max(0, Math.min(height - 1, clickY)));

  const isStrokePixel = (x: number, y: number) => {
    const idx = (y * width + x) * 4;
    return data[idx] < 140; // darker than 140 = stroke barrier
  };

  // If clicked directly on a stroke pixel, search adjacent radius for cavity
  if (isStrokePixel(startX, startY)) {
    let found = false;
    for (let r = 1; r <= 5; r++) {
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

  // Flood fill algorithm
  const visited = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);
  const queue = new Int32Array(width * height * 2);
  let queueHead = 0;
  let queueTail = 0;

  queue[queueTail++] = startX;
  queue[queueTail++] = startY;
  visited[startY * width + startX] = 1;
  mask[startY * width + startX] = 1;

  let minX = startX, maxX = startX, minY = startY, maxY = startY;
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

    // If flood fill reaches canvas edges, it is an open area, NOT an enclosed region!
    if (x <= 1 || x >= width - 2 || y <= 1 || y >= height - 2) {
      isBoundaryReached = true;
      break;
    }

    const neighbors: [number, number][] = [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ];

    for (let i = 0; i < 4; i++) {
      const nx = neighbors[i][0];
      const ny = neighbors[i][1];

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

  // Cancel if open to outside or cavity too tiny
  if (isBoundaryReached || filledCount < 12) {
    return null;
  }

  // Dilate mask slightly (1.5px) so the fill sits cleanly beneath the surrounding strokes
  // without leaving an unsightly 1px white seam gap
  const dilatedMask = new Uint8Array(width * height);
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const idx = y * width + x;
      if (mask[idx] === 1) {
        dilatedMask[idx] = 1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
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

  // Find the top-leftmost starting pixel of the filled mask
  let contourStartX = -1;
  let contourStartY = -1;

  for (let y = Math.max(0, minY - 1); y <= Math.min(height - 1, maxY + 1); y++) {
    for (let x = Math.max(0, minX - 1); x <= Math.min(width - 1, maxX + 1); x++) {
      if (dilatedMask[y * width + x] === 1) {
        contourStartX = x;
        contourStartY = y;
        break;
      }
    }
    if (contourStartX !== -1) break;
  }

  if (contourStartX === -1) return null;

  // Extract ordered perimeter contour points
  const rawContour = traceMaskContour(dilatedMask, width, height, contourStartX, contourStartY);
  if (rawContour.length < 3) return null;

  // Simplify contour points to smooth SVG vector curve (epsilon 0.9 preserves curves while cleaning raster steps)
  const simplified = simplifyPoints(rawContour, 0.9);
  if (simplified.length < 3) return null;

  // Convert to smooth closed SVG path
  const pathD = pointsToSmoothPath(simplified, true);

  return {
    id: `fill-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    d: pathD,
    stroke: 'none',
    strokeWidth: 0,
    fill: fillColor,
    type: 'freehand',
    points: simplified,
  };
}
