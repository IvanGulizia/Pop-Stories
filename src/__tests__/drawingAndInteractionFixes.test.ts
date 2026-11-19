import { describe, it, expect } from 'vitest';
import { DynamicRule, Entity, VectorPath } from '../types';
import {
  createFrameHistoryEntry,
  FrameHistoryEntry,
  pushSnapshotToEntry,
  stepRedoEntry,
  stepUndoEntry,
  switchFrameHistoryInStore,
} from '../utils/drawingHistory';
import { computeMovementFlipX } from '../utils/physics/flipHelpers';
import {
  hasEntityClickRules,
  resolveEntityHoverCursorState,
  resolveEntityPressCursorState,
  resolveNativeHitboxCursorClass,
} from '../utils/cursorResolution';
import {
  clampSpawnRandomZone,
  computeRandomSpawnPosition,
} from '../utils/spawnHelpers';

function makePath(id: string): VectorPath {
  return {
    id,
    d: 'M 10 10 L 50 50',
    stroke: '#000000',
    strokeWidth: 4,
    fill: 'none',
    layerId: 'layer-1',
  };
}

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Entity ${id}`,
    type: 'custom',
    position: { x: 0, y: 0 },
    size: { width: 100, height: 100 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Idle',
        color: '#000000',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

describe('drawingHistory (Undo/Redo multi-frames)', () => {
  const baseLayers = [{ id: 'layer-1', name: 'Calque 1', visible: true, locked: false, opacity: 1 }];

  it('preserves independent undo/redo stacks across frame switches without losing strokes', () => {
    const store = new Map<string, FrameHistoryEntry>();

    // Frame 1 : tracé initial puis p1, p2
    let f1 = createFrameHistoryEntry([], baseLayers);
    f1 = pushSnapshotToEntry(f1, [makePath('f1-p1')], baseLayers);
    f1 = pushSnapshotToEntry(f1, [makePath('f1-p1'), makePath('f1-p2')], baseLayers);

    // Basculer sur Frame 2 : sauvegarde F1, crée F2
    let f2 = switchFrameHistoryInStore(store, 'frame-1', f1, 'frame-2', [makePath('f2-p1')], baseLayers);
    f2 = pushSnapshotToEntry(f2, [makePath('f2-p1'), makePath('f2-p2')], baseLayers);

    // Revenir sur Frame 1 : sauvegarde F2, restaure exactement la pile complète de F1
    const restoredF1 = switchFrameHistoryInStore(
      store,
      'frame-2',
      f2,
      'frame-1',
      [makePath('f1-p1'), makePath('f1-p2')],
      baseLayers
    );
    expect(restoredF1.stack).toHaveLength(3);
    expect(restoredF1.index).toBe(2);

    // Undo sur Frame 1 puis Redo sur Frame 1
    const undo1 = stepUndoEntry(restoredF1);
    expect(undo1).not.toBeNull();
    expect(undo1!.snapshot.paths.map((p) => p.id)).toEqual(['f1-p1']);

    const redo1 = stepRedoEntry(undo1!.nextEntry);
    expect(redo1).not.toBeNull();
    expect(redo1!.snapshot.paths.map((p) => p.id)).toEqual(['f1-p1', 'f1-p2']);

    // Vérifier que Frame 2 est intacte dans le store
    const backToF2 = switchFrameHistoryInStore(
      store,
      'frame-1',
      redo1!.nextEntry,
      'frame-2',
      [makePath('f2-p1'), makePath('f2-p2')],
      baseLayers
    );
    expect(backToF2.stack).toHaveLength(2);
    expect(backToF2.index).toBe(1);
    const undoF2 = stepUndoEntry(backToF2);
    expect(undoF2!.snapshot.paths.map((p) => p.id)).toEqual(['f2-p1']);
  });

  it('deep-clones snapshots so external mutations cannot corrupt history entries', () => {
    let entry = createFrameHistoryEntry([makePath('p1')], baseLayers);
    entry = pushSnapshotToEntry(entry, [makePath('p1'), makePath('p2')], baseLayers);
    const undone = stepUndoEntry(entry)!;
    undone.snapshot.paths[0].stroke = '#ff0000';
    expect(entry.stack[0].paths[0].stroke).toBe('#000000');
  });
});

describe('computeMovementFlipX (Character Controller Flip)', () => {
  it('flips according to active keyboard intent and ignores passive stop micro-rebounds', () => {
    const kb = { flipOnMove: true, flipInvert: false };

    // Déplacement droite actif -> flipX = false
    expect(computeMovementFlipX({ keyboard: kb, keyboardHorizIntent: 1, velocityX: 3.0 })).toBe(false);

    // Relâchement avec léger rebond physique négatif (-0.25 px/frame) -> ne doit PAS flipper à gauche
    expect(computeMovementFlipX({ keyboard: kb, keyboardHorizIntent: 0, velocityX: -0.25 })).toBeNull();
    expect(computeMovementFlipX({ keyboard: kb, keyboardHorizIntent: 0, velocityX: -2.0 })).toBeNull();

    // Appui gauche même pendant l'inertie droite -> flip immédiatement à gauche
    expect(computeMovementFlipX({ keyboard: kb, keyboardHorizIntent: -1, velocityX: 2.0 })).toBe(true);

    // Inversion flipInvert respectée
    expect(
      computeMovementFlipX({
        keyboard: { flipOnMove: true, flipInvert: true },
        keyboardHorizIntent: -1,
        velocityX: 0,
      })
    ).toBe(false);
  });

  it('prevents AI patrol/wandering flip during pause rebound and applies deadzone', () => {
    expect(
      computeMovementFlipX({
        keyboardHorizIntent: 0,
        otherFlipBehavior: { flipOnMove: true, isActivelyPaused: true },
        velocityX: -0.8,
      })
    ).toBeNull();

    expect(
      computeMovementFlipX({
        keyboardHorizIntent: 0,
        otherFlipBehavior: { flipOnMove: true, isActivelyPaused: false },
        velocityX: -0.2,
      })
    ).toBeNull();

    expect(
      computeMovementFlipX({
        keyboardHorizIntent: 0,
        otherFlipBehavior: { flipOnMove: true, isActivelyPaused: false },
        velocityX: -1.4,
      })
    ).toBe(true);
  });
});

describe('cursorResolution (No clickable cursor without click event)', () => {
  const hero = makeEntity({ id: 'hero-1', type: 'hero', tags: ['player'] });
  const rock = makeEntity({ id: 'rock-1', type: 'rock', tags: ['decor'] });

  const rules: DynamicRule[] = [
    {
      id: 'r-click-hero',
      name: 'Click Hero',
      enabled: true,
      trigger: { type: 'click', subjectMode: 'instance', subjectId: 'hero-1' },
      actions: [],
    },
    {
      id: 'r-disabled-rock',
      name: 'Disabled Rock',
      enabled: false,
      trigger: { type: 'click', subjectMode: 'type', subjectType: 'rock' },
      actions: [],
    },
    {
      id: 'r-hover-rock',
      name: 'Hover Rock',
      enabled: true,
      trigger: { type: 'hover', subjectMode: 'type', subjectType: 'rock' },
      actions: [],
    },
  ];

  it('detects click rules accurately and excludes disabled or non-click rules', () => {
    expect(hasEntityClickRules(hero, rules)).toBe(true);
    expect(hasEntityClickRules(rock, rules)).toBe(false);

    const tagClickRule: DynamicRule = {
      id: 'r-tag',
      name: 'Tag Click',
      enabled: true,
      trigger: { type: 'click', subjectMode: 'tag', subjectTag: '#Decor' },
      actions: [],
    };
    expect(hasEntityClickRules(rock, [tagClickRule])).toBe(true);
  });

  it('keeps idle cursor & cursor-default in Play mode when entity is neither draggable nor clickable', () => {
    expect(
      resolveEntityHoverCursorState({ appMode: 'play', canDrag: false, hasClickRules: false })
    ).toBe('idle');
    expect(
      resolveEntityPressCursorState({ appMode: 'play', canDrag: false, hasClickRules: false })
    ).toBe('idle');
    expect(
      resolveNativeHitboxCursorClass({
        hideNativeCursor: false,
        appMode: 'play',
        canDrag: false,
        hasClickRules: false,
      })
    ).toBe('cursor-default');
  });

  it('returns clickable cursor states only when click rules or drag exist', () => {
    expect(
      resolveEntityHoverCursorState({ appMode: 'play', canDrag: false, hasClickRules: true })
    ).toBe('hover_click');
    expect(
      resolveEntityPressCursorState({ appMode: 'play', canDrag: false, hasClickRules: true })
    ).toBe('click');
    expect(
      resolveEntityHoverCursorState({ appMode: 'play', canDrag: true, hasClickRules: true })
    ).toBe('hover_drag_click');
    expect(
      resolveNativeHitboxCursorClass({
        hideNativeCursor: false,
        appMode: 'play',
        canDrag: false,
        hasClickRules: true,
      })
    ).toBe('cursor-pointer');
  });
});

describe('spawnHelpers (Random Spawn Full Canvas vs Zone)', () => {
  const sceneBounds = { width: 800, height: 600 };

  it('clamps zone cleanly within scene bounds', () => {
    expect(
      clampSpawnRandomZone({ x: -20, y: 550, width: 300, height: 200 }, sceneBounds)
    ).toEqual({
      x: 0,
      y: 400,
      width: 300,
      height: 200,
    });
  });

  it('samples strictly inside the configured zone when zone >= spawnSize', () => {
    const zone = { x: 100, y: 120, width: 200, height: 150 };
    const spawnSize = { width: 40, height: 30 };

    const minPt = computeRandomSpawnPosition({
      sceneBounds,
      spawnSize,
      scope: 'zone',
      zone,
      rng: () => 0,
    });
    const maxPt = computeRandomSpawnPosition({
      sceneBounds,
      spawnSize,
      scope: 'zone',
      zone,
      rng: () => 0.999999,
    });

    expect(minPt).toEqual({ x: 100, y: 120 });
    expect(maxPt.x).toBeGreaterThanOrEqual(100);
    expect(maxPt.x + spawnSize.width).toBeLessThanOrEqual(300);
    expect(maxPt.y).toBeGreaterThanOrEqual(120);
    expect(maxPt.y + spawnSize.height).toBeLessThanOrEqual(270);
  });

  it('samples across full canvas by default when scope is canvas', () => {
    const pt0 = computeRandomSpawnPosition({
      sceneBounds,
      spawnSize: { width: 64, height: 64 },
      scope: 'canvas',
      rng: () => 0,
    });
    const pt1 = computeRandomSpawnPosition({
      sceneBounds,
      spawnSize: { width: 64, height: 64 },
      scope: 'canvas',
      rng: () => 0.9999,
    });

    expect(pt0).toEqual({ x: 20, y: 20 });
    expect(pt1.x).toBeGreaterThan(600);
    expect(pt1.y).toBeGreaterThan(400);
  });
});
