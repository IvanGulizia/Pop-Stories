import { describe, it, expect } from 'vitest';
import { VectorPath } from '../types';
import {
  buildWiggledPathVariants,
  shouldIgnorePointerForStylusOnly,
} from '../utils/strokeWiggle';

describe('strokeWiggle (Boiling Lines)', () => {
  const samplePaths: VectorPath[] = [
    {
      id: 'p-free',
      d: 'M 10 20 Q 10 20, 30 40 L 60 70',
      stroke: '#000000',
      strokeWidth: 4,
      fill: 'none',
      type: 'freehand',
      points: [
        { x: 10, y: 20 },
        { x: 30, y: 40 },
        { x: 60, y: 70 },
      ],
    },
    {
      id: 'p-rect',
      d: 'M 40 40 h 80 v 50 h -80 Z',
      stroke: '#111111',
      strokeWidth: 3,
      fill: '#fde047',
      type: 'rectangle',
      rect: { x: 40, y: 40, width: 80, height: 50 },
    },
    {
      id: 'p-circle',
      d: 'M 70 100 a 30 30 0 1 0 60 0 a 30 30 0 1 0 -60 0 Z',
      stroke: '#000000',
      strokeWidth: 3,
      fill: 'none',
      type: 'circle',
      circle: { cx: 100, cy: 100, r: 30 },
    },
  ];

  it('produces deterministic variants equal to clamped frameCount', () => {
    const v1 = buildWiggledPathVariants(samplePaths, {
      amplitude: 2.5,
      frameCount: 4,
      detail: 'medium',
      affectFill: true,
    });
    const v2 = buildWiggledPathVariants(samplePaths, {
      amplitude: 2.5,
      frameCount: 4,
      detail: 'medium',
      affectFill: true,
    });

    expect(v1).toHaveLength(4);
    expect(v1).toEqual(v2);
    // Distinct variants between slot 0 and slot 1
    expect(v1[0][0].d).not.toEqual(v1[1][0].d);
    expect(v1[0][1].d).not.toEqual(v1[1][1].d);
    expect(v1[0][2].d).not.toEqual(v1[1][2].d);
  });

  it('keeps closed shapes closed (Z) and preserves styling attributes', () => {
    const variants = buildWiggledPathVariants(samplePaths, {
      amplitude: 3,
      frameCount: 3,
      detail: 'high',
      affectFill: true,
    });

    expect(variants[0][1].d.trim().endsWith('Z')).toBe(true);
    expect(variants[0][2].d.trim().endsWith('Z')).toBe(true);
    expect(variants[0][1].fill).toBe('#fde047');
    expect(variants[0][0].strokeWidth).toBe(4);
  });

  it('can skip fill-only paths when affectFill is false', () => {
    const fillOnly: VectorPath = {
      id: 'fill-only',
      d: 'M 20 20 L 80 20 L 80 80 Z',
      stroke: 'none',
      strokeWidth: 0,
      fill: '#ef4444',
      type: 'fill_bucket',
      points: [
        { x: 20, y: 20 },
        { x: 80, y: 20 },
        { x: 80, y: 80 },
      ],
    };

    const variants = buildWiggledPathVariants([fillOnly], {
      amplitude: 4,
      frameCount: 3,
      detail: 'medium',
      affectFill: false,
    });

    expect(variants[0][0].d).toBe(fillOnly.d);
    expect(variants[1][0].d).toBe(fillOnly.d);
  });

  it('returns original paths in a single variant when amplitude is 0', () => {
    const variants = buildWiggledPathVariants(samplePaths, {
      amplitude: 0,
      frameCount: 4,
      detail: 'medium',
      affectFill: true,
    });
    expect(variants).toHaveLength(1);
    expect(variants[0]).toEqual(samplePaths);
  });

  it('produces smoother, longer-wavelength waves on dense freehand strokes when segmentStep & smoothness increase', () => {
    // 60 points spaced by 1px each along X (typical Apple Pencil freehand stroke)
    const densePoints = Array.from({ length: 60 }, (_, i) => ({ x: 40 + i, y: 100 }));
    const densePath: VectorPath = {
      id: 'dense-freehand',
      d: `M 40 100 ${densePoints.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')}`,
      stroke: '#000000',
      strokeWidth: 4,
      fill: 'none',
      type: 'freehand',
      points: densePoints,
    };

    const choppy = buildWiggledPathVariants([densePath], {
      amplitude: 4,
      frameCount: 2,
      segmentStep: 4,
      smoothness: 0,
      displacementMode: 'xy',
    });
    const smooth = buildWiggledPathVariants([densePath], {
      amplitude: 4,
      frameCount: 2,
      segmentStep: 48,
      smoothness: 0.95,
      displacementMode: 'xy',
    });

    const extractYs = (d: string) => {
      const nums = (d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
      const ys: number[] = [];
      for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
      return ys;
    };
    const meanAbsDiff = (arr: number[]) => {
      let sum = 0;
      for (let i = 1; i < arr.length; i++) sum += Math.abs(arr[i] - arr[i - 1]);
      return sum / Math.max(1, arr.length - 1);
    };

    const choppyRoughness = meanAbsDiff(extractYs(choppy[0][0].d));
    const smoothRoughness = meanAbsDiff(extractYs(smooth[0][0].d));
    expect(smoothRoughness).toBeLessThan(choppyRoughness * 0.6);
  });

  it('supports normal and mixed displacement modes along horizontal strokes', () => {
    const horizPts = Array.from({ length: 20 }, (_, i) => ({ x: 20 + i * 5, y: 100 }));
    const horizPath: VectorPath = {
      id: 'horiz-normal',
      d: `M 20 100 ${horizPts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ')}`,
      stroke: '#000000',
      strokeWidth: 4,
      fill: 'none',
      type: 'freehand',
      points: horizPts,
    };

    const normalRes = buildWiggledPathVariants([horizPath], {
      amplitude: 5,
      frameCount: 2,
      segmentStep: 20,
      smoothness: 0.75,
      displacementMode: 'normal',
    });
    const mixedRes = buildWiggledPathVariants([horizPath], {
      amplitude: 5,
      frameCount: 2,
      segmentStep: 20,
      smoothness: 0.75,
      displacementMode: 'mixed',
    });

    // Normal mode on horizontal segment displaces strictly along Y (X stays close to evenly spaced original)
    const nums = (normalRes[0][0].d.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    const ys: number[] = [];
    for (let i = 1; i < nums.length; i += 2) ys.push(nums[i]);
    expect(ys.some((y) => Math.abs(y - 100) > 0.2)).toBe(true);
    expect(normalRes[0][0].d).not.toEqual(mixedRes[0][0].d);
  });
});

describe('shouldIgnorePointerForStylusOnly (iPad Apple Pencil palm rejection)', () => {
  it('allows all pointer types when stylus-only mode is off', () => {
    expect(shouldIgnorePointerForStylusOnly('touch', false)).toBe(false);
    expect(shouldIgnorePointerForStylusOnly('pen', false)).toBe(false);
    expect(shouldIgnorePointerForStylusOnly('mouse', false)).toBe(false);
  });

  it('ignores touch while keeping pen and mouse active when stylus-only mode is on', () => {
    expect(shouldIgnorePointerForStylusOnly('touch', true)).toBe(true);
    expect(shouldIgnorePointerForStylusOnly('pen', true)).toBe(false);
    expect(shouldIgnorePointerForStylusOnly('mouse', true)).toBe(false);
  });
});
