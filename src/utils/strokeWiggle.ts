import { StrokeWiggleBehaviorConfig, VectorPath, VectorPoint } from '../types';
import {
  generateCirclePerimeterPoints,
  pointsToPolylinePath,
  pointsToSmoothPath,
} from './vectorDrawing';

/**
 * Indique si un événement pointeur doit être ignoré lorsque le mode « Stylet seul (Apple Pencil) » est actif.
 * Les entrées `'pen'` et `'mouse'` restent toujours autorisées afin de ne jamais bloquer le bureau.
 */
export function shouldIgnorePointerForStylusOnly(
  pointerType: string | undefined,
  stylusOnly: boolean | undefined
): boolean {
  if (!stylusOnly) return false;
  return pointerType === 'touch';
}

function hashString32(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function deterministicNoise2D(seed: number, index: number): { dx: number; dy: number } {
  let a = (seed + Math.imul(index + 1, 374761393)) >>> 0;
  a = Math.imul(a ^ (a >>> 13), 1274126177) >>> 0;
  const rx = ((a ^ (a >>> 16)) >>> 0) / 4294967295;

  let b = (seed + Math.imul(index + 17, 668265263)) >>> 0;
  b = Math.imul(b ^ (b >>> 13), 1274126177) >>> 0;
  const ry = ((b ^ (b >>> 16)) >>> 0) / 4294967295;

  return {
    dx: rx * 2 - 1,
    dy: ry * 2 - 1,
  };
}

function subdividePolyline(points: VectorPoint[], maxSegmentLen: number, closed: boolean): VectorPoint[] {
  if (points.length < 2) return points;
  const out: VectorPoint[] = [];
  const count = closed ? points.length : points.length - 1;
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    out.push(a);
    const dist = Math.hypot(b.x - a.x, b.y - a.y);
    if (dist > maxSegmentLen) {
      const steps = Math.min(32, Math.ceil(dist / maxSegmentLen));
      for (let s = 1; s < steps; s++) {
        const t = s / steps;
        out.push({
          x: a.x + (b.x - a.x) * t,
          y: a.y + (b.y - a.y) * t,
        });
      }
    }
  }
  if (!closed) {
    out.push(points[points.length - 1]);
  }
  return out;
}

function computeCumulativeArcLengths(points: VectorPoint[], closed: boolean): { cumLen: number[]; totalLen: number } {
  const n = points.length;
  const cumLen = new Array<number>(n).fill(0);
  if (n < 2) return { cumLen, totalLen: 0 };
  let acc = 0;
  for (let i = 1; i < n; i++) {
    acc += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
    cumLen[i] = acc;
  }
  const totalLen = closed
    ? acc + Math.hypot(points[0].x - points[n - 1].x, points[0].y - points[n - 1].y)
    : acc;
  return { cumLen, totalLen };
}

function computeUnitNormal(points: VectorPoint[], idx: number, closed: boolean): { nx: number; ny: number } {
  const n = points.length;
  if (n < 2) return { nx: 0, ny: -1 };
  const prevIdx = idx === 0 ? (closed ? n - 1 : 0) : idx - 1;
  const nextIdx = idx === n - 1 ? (closed ? 0 : n - 1) : idx + 1;
  const tx = points[nextIdx].x - points[prevIdx].x;
  const ty = points[nextIdx].y - points[prevIdx].y;
  const len = Math.hypot(tx, ty);
  if (len < 1e-4) return { nx: 0, ny: -1 };
  return { nx: -ty / len, ny: tx / len };
}

function perturbPointsAlongArc(
  points: VectorPoint[],
  seed: number,
  amplitude: number,
  options: {
    roundDigits?: number;
    verticalScale?: number;
    endpointStability?: number;
    isClosed?: boolean;
    wavelength?: number;
    smoothness?: number;
    displacementMode?: 'xy' | 'normal' | 'mixed';
  } = {}
): VectorPoint[] {
  const {
    roundDigits = 1,
    verticalScale = 1,
    endpointStability = 0,
    isClosed = false,
    wavelength = 20,
    smoothness = 0.75,
    displacementMode = 'xy',
  } = options;
  const factor = Math.pow(10, roundDigits);
  const n = points.length;
  if (n === 0) return points;

  const { cumLen, totalLen } = computeCumulativeArcLengths(points, isClosed);
  const safeWavelength = Math.max(4, Math.min(80, wavelength));
  const clampedSmooth = Math.max(0, Math.min(1, smoothness));
  const taperWindow = Math.max(1, totalLen * 0.25);

  const closedNodeCount = isClosed
    ? Math.max(3, Math.round(totalLen / safeWavelength))
    : 0;

  return points.map((pt, idx) => {
    let dx: number;
    let dy: number;

    if (totalLen < 0.5) {
      const raw = deterministicNoise2D(seed, idx);
      dx = raw.dx;
      dy = raw.dy;
    } else {
      const u = isClosed
        ? (cumLen[idx] / totalLen) * closedNodeCount
        : cumLen[idx] / safeWavelength;
      const baseIdx = Math.floor(u);
      const frac = u - baseIdx;
      const cosFrac = 0.5 * (1 - Math.cos(Math.PI * frac));
      const blend = frac * (1 - clampedSmooth) + cosFrac * clampedSmooth;

      const k0 = isClosed
        ? ((baseIdx % closedNodeCount) + closedNodeCount) % closedNodeCount
        : baseIdx;
      const k1 = isClosed ? (k0 + 1) % closedNodeCount : baseIdx + 1;

      const n0 = deterministicNoise2D(seed, k0);
      const n1 = deterministicNoise2D(seed, k1);
      dx = n0.dx + (n1.dx - n0.dx) * blend;
      dy = n0.dy + (n1.dy - n0.dy) * blend;
    }

    let weight = 1;
    if (!isClosed && endpointStability > 0 && n > 1 && totalLen > 0) {
      const edgeLen = Math.min(cumLen[idx], totalLen - cumLen[idx]);
      const factorNearEdge = Math.max(0, 1 - edgeLen / taperWindow);
      weight = Math.max(0, 1 - endpointStability * factorNearEdge);
    }

    let offX = dx * amplitude * weight;
    let offY = dy * amplitude * verticalScale * weight;

    if (displacementMode !== 'xy') {
      const { nx, ny } = computeUnitNormal(points, idx, isClosed);
      const normalScalar = dx * amplitude * weight;
      const nOffX = nx * normalScalar;
      const nOffY = ny * normalScalar * verticalScale;
      if (displacementMode === 'normal') {
        offX = nOffX;
        offY = nOffY;
      } else {
        // 'mixed' : 70 % perpendiculaire au trait + 30 % X/Y libre
        offX = nOffX * 0.7 + offX * 0.3;
        offY = nOffY * 0.7 + offY * 0.3;
      }
    }

    return {
      x: Math.round((pt.x + offX) * factor) / factor,
      y: Math.round((pt.y + offY) * factor) / factor,
    };
  });
}

function buildFallbackWiggledD(
  d: string,
  seed: number,
  amplitude: number,
  verticalScale = 1
): string {
  let coordIndex = 0;
  return d.replace(/(-?\d+(?:\.\d+)?)\s*([,\s])\s*(-?\d+(?:\.\d+)?)/g, (_m, xStr, sep, yStr) => {
    const x = parseFloat(xStr);
    const y = parseFloat(yStr);
    if (Number.isNaN(x) || Number.isNaN(y)) return `${xStr}${sep}${yStr}`;
    const { dx, dy } = deterministicNoise2D(seed, coordIndex++);
    const nx = Math.round((x + dx * amplitude) * 10) / 10;
    const ny = Math.round((y + dy * amplitude * verticalScale) * 10) / 10;
    return `${nx}${sep}${ny}`;
  });
}

export function getSegmentStepForDetail(detail?: 'low' | 'medium' | 'high', segmentStepOverride?: number): number {
  if (typeof segmentStepOverride === 'number' && Number.isFinite(segmentStepOverride) && segmentStepOverride > 0) {
    return Math.max(4, Math.min(80, segmentStepOverride));
  }
  switch (detail) {
    case 'low':
      return 38;
    case 'high':
      return 10;
    case 'medium':
    default:
      return 20;
  }
}

function wiggleSinglePath(
  path: VectorPath,
  variantIndex: number,
  amplitude: number,
  detail: 'low' | 'medium' | 'high',
  affectFill: boolean,
  options: {
    segmentStep?: number;
    smoothness: number;
    displacementMode: 'xy' | 'normal' | 'mixed';
    verticalScale: number;
    endpointStability: number;
    userSeed: number;
  }
): VectorPath {
  if (!affectFill && path.fill && path.fill !== 'none' && (!path.stroke || path.stroke === 'none')) {
    return path;
  }

  const seed = hashString32(`${path.id || 'path'}:${options.userSeed}:${variantIndex}`);
  const segStep = getSegmentStepForDetail(detail, options.segmentStep);
  // Résolution géométrique découplée de la longueur d'onde afin que les grandes ondes restent courbes sans perdre de points
  const renderStep = Math.max(6, Math.min(16, segStep * 0.5));

  if (path.rect) {
    const { x, y, width, height } = path.rect;
    const rx = width < 0 ? x + width : x;
    const ry = height < 0 ? y + height : y;
    const rw = Math.abs(width);
    const rh = Math.abs(height);
    const corners: VectorPoint[] = [
      { x: rx, y: ry },
      { x: rx + rw, y: ry },
      { x: rx + rw, y: ry + rh },
      { x: rx, y: ry + rh },
    ];
    const dense = subdividePolyline(corners, renderStep, true);
    const perturbed = perturbPointsAlongArc(dense, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed: true,
      wavelength: segStep,
      smoothness: options.smoothness,
      displacementMode: options.displacementMode,
    });
    return {
      ...path,
      d: pointsToPolylinePath(perturbed, true),
    };
  }

  if (path.circle) {
    const { cx, cy, r } = path.circle;
    const circumference = 2 * Math.PI * Math.max(4, r);
    const segments = Math.max(18, Math.min(64, Math.round(circumference / renderStep)));
    const basePts = generateCirclePerimeterPoints(cx, cy, r, segments);
    const perturbed = perturbPointsAlongArc(basePts, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed: true,
      wavelength: segStep,
      smoothness: options.smoothness,
      displacementMode: options.displacementMode,
    });
    return {
      ...path,
      d: pointsToSmoothPath(perturbed, true),
    };
  }

  if (path.points && path.points.length > 0) {
    const isClosed = Boolean(
      path.type === 'fill_bucket' ||
        (path.fill && path.fill !== 'none') ||
        /\bZ\s*$/i.test(path.d)
    );
    const dense = subdividePolyline(path.points, renderStep, isClosed);
    const perturbed = perturbPointsAlongArc(dense, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed,
      wavelength: segStep,
      smoothness: options.smoothness,
      displacementMode: options.displacementMode,
    });
    const nextD =
      path.type === 'polyline' || path.type === 'straight'
        ? pointsToPolylinePath(perturbed, isClosed)
        : pointsToSmoothPath(perturbed, isClosed);
    return {
      ...path,
      d: nextD,
    };
  }

  return {
    ...path,
    d: buildFallbackWiggledD(path.d, seed, amplitude, options.verticalScale),
  };
}

/**
 * Pré-calcule N variantes vectorielles déterministes pour obtenir un effet « Boiling Lines »
 * fluide à 4–12 Hz sans recalcul géométrique à chaque frame d'animation.
 */
export function buildWiggledPathVariants(
  paths: VectorPath[],
  config: Pick<
    StrokeWiggleBehaviorConfig,
    | 'amplitude'
    | 'frameCount'
    | 'detail'
    | 'affectFill'
    | 'segmentStep'
    | 'smoothness'
    | 'displacementMode'
    | 'verticalScale'
    | 'endpointStability'
    | 'seed'
  >
): VectorPath[][] {
  if (!paths || paths.length === 0) return [];
  const amplitude = Math.max(0, Math.min(15, config.amplitude ?? 2.2));
  const frameCount = Math.max(2, Math.min(6, Math.round(config.frameCount || 4)));
  const detail = config.detail || 'medium';
  const affectFill = config.affectFill !== false;
  const smoothness = Math.max(0, Math.min(1, config.smoothness ?? 0.75));
  const displacementMode = config.displacementMode || 'xy';
  const verticalScale = Math.max(0, Math.min(2, config.verticalScale ?? 1));
  const endpointStability = Math.max(0, Math.min(1, config.endpointStability ?? 0));
  const userSeed = Math.round(config.seed ?? 0);

  if (amplitude <= 0.01) {
    return [paths];
  }

  const variants: VectorPath[][] = [];
  for (let v = 0; v < frameCount; v++) {
    variants.push(
      paths.map((p) =>
        wiggleSinglePath(p, v, amplitude, detail, affectFill, {
          segmentStep: config.segmentStep,
          smoothness,
          displacementMode,
          verticalScale,
          endpointStability,
          userSeed,
        })
      )
    );
  }
  return variants;
}
