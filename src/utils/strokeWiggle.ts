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
    dx: (rx * 2 - 1),
    dy: (ry * 2 - 1),
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
      const steps = Math.min(24, Math.ceil(dist / maxSegmentLen));
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

function perturbPoints(
  points: VectorPoint[],
  seed: number,
  amplitude: number,
  options: {
    roundDigits?: number;
    verticalScale?: number;
    endpointStability?: number;
    isClosed?: boolean;
  } = {}
): VectorPoint[] {
  const { roundDigits = 1, verticalScale = 1, endpointStability = 0, isClosed = false } = options;
  const factor = Math.pow(10, roundDigits);
  const n = points.length;
  const taperWindow = Math.max(1, (n - 1) * 0.25);
  return points.map((pt, idx) => {
    const { dx, dy } = deterministicNoise2D(seed, idx);
    let weight = 1;
    if (!isClosed && endpointStability > 0 && n > 1) {
      const edgeDist = Math.min(idx, n - 1 - idx);
      const factorNearEdge = Math.max(0, 1 - edgeDist / taperWindow);
      weight = Math.max(0, 1 - endpointStability * factorNearEdge);
    }
    return {
      x: Math.round((pt.x + dx * amplitude * weight) * factor) / factor,
      y: Math.round((pt.y + dy * amplitude * verticalScale * weight) * factor) / factor,
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

function getSegmentStepForDetail(detail?: 'low' | 'medium' | 'high', segmentStepOverride?: number): number {
  if (typeof segmentStepOverride === 'number' && Number.isFinite(segmentStepOverride) && segmentStepOverride > 0) {
    return Math.max(6, Math.min(48, segmentStepOverride));
  }
  switch (detail) {
    case 'low':
      return 34;
    case 'high':
      return 12;
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
    const dense = subdividePolyline(corners, segStep, true);
    const perturbed = perturbPoints(dense, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed: true,
    });
    return {
      ...path,
      d: pointsToPolylinePath(perturbed, true),
    };
  }

  if (path.circle) {
    const { cx, cy, r } = path.circle;
    const segments = options.segmentStep
      ? Math.max(12, Math.min(48, Math.round((2 * Math.PI * Math.max(4, r)) / segStep)))
      : detail === 'high'
      ? 32
      : detail === 'low'
      ? 16
      : 24;
    const basePts = generateCirclePerimeterPoints(cx, cy, r, segments);
    const perturbed = perturbPoints(basePts, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed: true,
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
    const dense =
      path.points.length <= 2 ||
      path.type === 'straight' ||
      path.type === 'polyline' ||
      typeof options.segmentStep === 'number'
        ? subdividePolyline(path.points, segStep, isClosed)
        : path.points;
    const perturbed = perturbPoints(dense, seed, amplitude, {
      verticalScale: options.verticalScale,
      endpointStability: options.endpointStability,
      isClosed,
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
    'amplitude' | 'frameCount' | 'detail' | 'affectFill' | 'segmentStep' | 'verticalScale' | 'endpointStability' | 'seed'
  >
): VectorPath[][] {
  if (!paths || paths.length === 0) return [];
  const amplitude = Math.max(0, Math.min(15, config.amplitude ?? 2.2));
  const frameCount = Math.max(2, Math.min(6, Math.round(config.frameCount || 4)));
  const detail = config.detail || 'medium';
  const affectFill = config.affectFill !== false;
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
          verticalScale,
          endpointStability,
          userSeed,
        })
      )
    );
  }
  return variants;
}
