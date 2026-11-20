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
