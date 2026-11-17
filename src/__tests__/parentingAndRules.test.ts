import { describe, it, expect } from 'vitest';
import { Entity } from '../types';
import {
  wouldCreateParentCycle,
  collectDescendantIds,
  computeRelativeParentOffset,
  computeChildWorldFromParent,
  resolveEntityReference,
} from '../store/parentingHelpers';
import {
  matchesEntityFilter,
  checkCollision,
  getCollisionContactPoint,
} from '../store/collisionHelpers';

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
        name: 'Normal',
        color: '#000000',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

describe('parentingHelpers', () => {
  it('detects direct and transitive parent cycles', () => {
    const a = makeEntity({ id: 'a' });
    const b = makeEntity({ id: 'b', parentId: 'a' });
    const c = makeEntity({ id: 'c', parentId: 'b' });
    const entities = { a, b, c };

    expect(wouldCreateParentCycle(entities, 'a', 'c')).toBe(true);
    expect(wouldCreateParentCycle(entities, 'a', 'b')).toBe(true);
    expect(wouldCreateParentCycle(entities, 'b', 'c')).toBe(true);
    expect(wouldCreateParentCycle(entities, 'c', 'a')).toBe(false);
  });

  it('collects all descendants breadth-first without infinite loops on cycles', () => {
    const a = makeEntity({ id: 'a' });
    const b = makeEntity({ id: 'b', parentId: 'a' });
    const c = makeEntity({ id: 'c', parentId: 'b' });
    const d = makeEntity({ id: 'd', parentId: 'a' });
    const unrelated = makeEntity({ id: 'u' });

    const descendants = collectDescendantIds({ a, b, c, d, unrelated }, 'a');
    expect(descendants).toEqual(['b', 'd', 'c']);
  });

  it('computes relative parent offset and reconstructs child world coordinates (including rotation & flipX)', () => {
    const parent = makeEntity({
      id: 'parent',
      position: { x: 100, y: 100 },
      size: { width: 100, height: 100 }, // center (150, 150)
      flipX: true,
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 90 },
      },
    });
    const child = makeEntity({
      id: 'child',
      position: { x: 125, y: 175 },
      size: { width: 50, height: 50 }, // center (150, 200) -> world delta (0, +50)
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 105 },
      },
    });

    const offset = computeRelativeParentOffset(child, parent);
    const attachedChild: Entity = { ...child, parentId: parent.id, parentOffset: offset };
    const world = computeChildWorldFromParent(attachedChild, parent);

    expect(world.position.x).toBeCloseTo(child.position.x, 1);
    expect(world.position.y).toBeCloseTo(child.position.y, 1);
    expect(world.rotation).toBeCloseTo(105, 1);
    expect(world.flipX).toBe(true);
  });

  it('resolves entity references across subject, target, instance, type, tag, and last_spawned', () => {
    const subj = makeEntity({ id: 'subj', type: 'hero', tags: ['player'] });
    const targ = makeEntity({ id: 'targ', type: 'coin', tags: ['pickup'] });
    const spawned = makeEntity({ id: 'sp-1', type: 'spark', tags: ['fx'] });
    const live = { subj, targ, 'sp-1': spawned };

    expect(resolveEntityReference('subject', undefined, undefined, undefined, subj, targ, live)?.id).toBe('subj');
    expect(resolveEntityReference('target', undefined, undefined, undefined, subj, targ, live)?.id).toBe('targ');
    expect(resolveEntityReference('last_spawned', undefined, undefined, undefined, subj, targ, live, 'sp-1')?.id).toBe('sp-1');
    expect(resolveEntityReference('instance', 'targ', undefined, undefined, subj, targ, live)?.id).toBe('targ');
    expect(resolveEntityReference('type', undefined, 'coin', undefined, subj, targ, live)?.id).toBe('targ');
    expect(resolveEntityReference('tag', undefined, undefined, '#FX', subj, targ, live)?.id).toBe('sp-1');
  });
});

describe('collisionHelpers', () => {
  it('matches entities by any, instance, type, or normalized #tag', () => {
    const ent = makeEntity({ id: 'e1', type: 'enemy', tags: ['danger', 'fire'] });

    expect(matchesEntityFilter(ent, 'any')).toBe(true);
    expect(matchesEntityFilter(ent, 'instance', 'e1')).toBe(true);
    expect(matchesEntityFilter(ent, 'instance', 'other')).toBe(false);
    expect(matchesEntityFilter(ent, 'type', undefined, 'enemy')).toBe(true);
    expect(matchesEntityFilter(ent, 'tag', undefined, undefined, '#Danger')).toBe(true);
    expect(matchesEntityFilter(ent, 'tag', undefined, undefined, 'ice')).toBe(false);
  });

  it('respects colliderMode disabled and detects box/circle overlaps accurately', () => {
    const boxA = makeEntity({ id: 'a', position: { x: 0, y: 0 }, size: { width: 100, height: 100 } });
    const boxB = makeEntity({ id: 'b', position: { x: 80, y: 20 }, size: { width: 100, height: 100 } });
    const boxFar = makeEntity({ id: 'c', position: { x: 250, y: 250 }, size: { width: 100, height: 100 } });
    const disabled = makeEntity({
      id: 'd',
      position: { x: 10, y: 10 },
      size: { width: 100, height: 100 },
      colliderMode: 'disabled',
    });

    expect(checkCollision(boxA, boxB, 0)).toBe(true);
    expect(checkCollision(boxA, boxFar, 3)).toBe(false);
    expect(checkCollision(boxA, disabled, 10)).toBe(false);

    const contact = getCollisionContactPoint(boxA, boxB);
    expect(contact.x).toBeGreaterThanOrEqual(80);
    expect(contact.x).toBeLessThanOrEqual(100);
  });

  it('handles circle vs circle collision and contact calculation', () => {
    const c1 = makeEntity({
      id: 'c1',
      position: { x: 0, y: 0 },
      size: { width: 100, height: 100 },
      states: {
        default: {
          id: 'default',
          name: 'C1',
          color: '#000',
          scale: 1,
          rotation: 0,
          colliderType: 'circle',
          colliderBounds: {
            mode: 'manual',
            shape: 'circle',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            centerX: 100,
            centerY: 100,
            radius: 100,
          },
        },
      },
    });
    const c2 = makeEntity({
      id: 'c2',
      position: { x: 90, y: 0 },
      size: { width: 100, height: 100 },
      states: {
        default: {
          id: 'default',
          name: 'C2',
          color: '#000',
          scale: 1,
          rotation: 0,
          colliderType: 'circle',
          colliderBounds: {
            mode: 'manual',
            shape: 'circle',
            x: 0,
            y: 0,
            width: 200,
            height: 200,
            centerX: 100,
            centerY: 100,
            radius: 100,
          },
        },
      },
    });

    expect(checkCollision(c1, c2, 0)).toBe(true);
    const contact = getCollisionContactPoint(c1, c2);
    expect(contact.x).toBeCloseTo(95, 1);
    expect(contact.y).toBeCloseTo(50, 1);
  });
});
