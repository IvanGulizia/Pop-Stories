import { beforeEach, describe, expect, it } from 'vitest';
import { DynamicRule, Entity, PhysicsBehaviorConfig, SnapBehaviorConfig } from '../types';
import {
  computeMixedBehaviorKeys,
  findCommonBehaviorTypes,
  mergeBehaviorPartialPatch,
  remapPastedBehaviorForEntity,
  remapStateIdForEntity,
} from '../utils/behaviorClipboardHelpers';
import {
  doesRuleMatchEntityAndTrigger,
  findMatchingRulesForBehaviorEvent,
} from '../utils/ruleLinkHelpers';
import { useSceneStore } from '../store/useSceneStore';
import {
  formatRoleLabel,
  resolveRuleEntityHint,
  resolveTriggerSubjectHint,
  resolveTriggerTargetHint,
  resolveWizardSubjectHint,
  resolveWizardTargetHint,
} from '../components/rulebook/ruleBookTypes';

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Objet ${id}`,
    type: `type_${id}`,
    position: { x: 100, y: 100 },
    size: { width: 80, height: 80 },
    currentStateId: 'state_1',
    isDraggable: false,
    states: {
      state_1: {
        id: 'state_1',
        name: 'Normal',
        color: '#6366f1',
        scale: 1,
        rotation: 0,
      },
    },
    behaviors: [],
    ...rest,
  };
}

describe('workflowUxFeatures — clipboard, rule links, multi-selection & z-order', () => {
  beforeEach(() => {
    useSceneStore.setState({
      entities: {},
      entityOrder: [],
      selectedEntityId: null,
      selectedEntityIds: [],
      copiedBehavior: null,
      pendingRuleBookIntent: null,
      activeMainView: 'canvas',
      rules: [],
    });
  });

  it('remapStateIdForEntity resolves exact ID, then state name, then undefined', () => {
    const target = makeEntity({
      id: 'target',
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#000', scale: 1, rotation: 0 },
        state_99: { id: 'state_99', name: 'Aimanté', color: '#0ff', scale: 1, rotation: 0 },
      },
    });

    const sourceStates = {
      state_1: { id: 'state_1', name: 'Normal', color: '#000', scale: 1, rotation: 0 },
      state_other: { id: 'state_other', name: 'Aimanté', color: '#0ff', scale: 1, rotation: 0 },
      state_missing: { id: 'state_missing', name: 'Inconnu', color: '#f00', scale: 1, rotation: 0 },
    };

    expect(remapStateIdForEntity('state_1', sourceStates, target)).toBe('state_1');
    expect(remapStateIdForEntity('state_other', sourceStates, target)).toBe('state_99');
    expect(remapStateIdForEntity('state_missing', sourceStates, target)).toBeUndefined();
  });

  it('remapPastedBehaviorForEntity preserves target behavior id and remaps state references', () => {
    const sourceSnap: SnapBehaviorConfig = {
      id: 'beh_src_snap',
      type: 'snap',
      enabled: true,
      snapRole: 'magnet_object',
      targetType: 'any',
      snapTrigger: 'on_release',
      snapRadius: 90,
      snapMode: 'instant',
      snapAlignment: 'center',
      attachBehavior: 'position_only',
      snappedStateId: 'st_src_snap',
      unsnappedStateId: 'st_src_break',
    };
    const target = makeEntity({
      id: 'ent_b',
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#000', scale: 1, rotation: 0 },
        state_2: { id: 'state_2', name: 'Collé', color: '#0f0', scale: 1, rotation: 0 },
      },
    });

    const pasted = remapPastedBehaviorForEntity(
      {
        behavior: sourceSnap,
        sourceEntityId: 'ent_a',
        sourceEntityName: 'Source A',
        sourceStates: {
          st_src_snap: { id: 'st_src_snap', name: 'Collé', color: '#0f0', scale: 1, rotation: 0 },
          st_src_break: { id: 'st_src_break', name: 'Disparu', color: '#f00', scale: 1, rotation: 0 },
        },
      },
      target,
      'beh_target_keep'
    ) as SnapBehaviorConfig;

    expect(pasted.id).toBe('beh_target_keep');
    expect(pasted.snapRadius).toBe(90);
    expect(pasted.snappedStateId).toBe('state_2');
    expect(pasted.unsnappedStateId).toBeUndefined();
  });

  it('findCommonBehaviorTypes and computeMixedBehaviorKeys detect shared components & differing values', () => {
    const e1 = makeEntity({
      id: 'e1',
      behaviors: [
        {
          id: 'p1',
          type: 'physics',
          enabled: true,
          gravity: 1,
          bounce: 0.4,
          mass: 1,
          friction: 0.2,
          isStatic: false,
        } as PhysicsBehaviorConfig,
        { id: 'd1', type: 'draggable', enabled: true, throwable: true },
      ],
    });
    const e2 = makeEntity({
      id: 'e2',
      behaviors: [
        {
          id: 'p2',
          type: 'physics',
          enabled: true,
          gravity: 2.5,
          bounce: 0.4,
          mass: 1,
          friction: 0.2,
          isStatic: false,
        } as PhysicsBehaviorConfig,
      ],
    });

    expect(findCommonBehaviorTypes([e1, e2])).toEqual(['physics']);
    const mixed = computeMixedBehaviorKeys([e1, e2], 'physics');
    expect(mixed.has('gravity')).toBe(true);
    expect(mixed.has('bounce')).toBe(false);
    expect(mixed.has('friction')).toBe(false);
  });

  it('mergeBehaviorPartialPatch updates only patched keys while preserving other existing keys', () => {
    const existing: PhysicsBehaviorConfig = {
      id: 'p_keep',
      type: 'physics',
      enabled: true,
      gravity: 2.2,
      bounce: 0.8,
      mass: 2,
      friction: 0.3,
      isStatic: false,
    };
    const merged = mergeBehaviorPartialPatch(existing, { bounce: 0.1, id: 'should_ignore' });
    expect(merged.id).toBe('p_keep');
    expect(merged.bounce).toBe(0.1);
    expect(merged.gravity).toBe(2.2);
  });

  it('findMatchingRulesForBehaviorEvent matches rules by entity id, entity type, and tags', () => {
    const hero = makeEntity({
      id: 'hero_1',
      type: 'hero_type',
      tags: ['joueur', 'vivant'],
    });

    const ruleById: DynamicRule = {
      id: 'r1',
      name: 'Règle par ID',
      enabled: true,
      trigger: { type: 'snap', subjectMode: 'instance', subjectId: 'hero_1', phase: 'enter' },
      actions: [],
    };
    const ruleByType: DynamicRule = {
      id: 'r2',
      name: 'Règle par type',
      enabled: true,
      trigger: { type: 'snap', subjectMode: 'type', subjectType: 'hero_type', phase: 'exit' },
      actions: [],
    };
    const ruleByTag: DynamicRule = {
      id: 'r3',
      name: 'Règle par tag',
      enabled: true,
      trigger: { type: 'collision', subjectMode: 'tag', subjectTag: 'joueur', phase: 'enter' },
      actions: [],
    };
    const unrelatedRule: DynamicRule = {
      id: 'r4',
      name: 'Autre entité',
      enabled: true,
      trigger: { type: 'snap', subjectMode: 'instance', subjectId: 'other_ent', phase: 'enter' },
      actions: [],
    };

    const snapMatches = findMatchingRulesForBehaviorEvent(
      [ruleById, ruleByType, ruleByTag, unrelatedRule],
      hero,
      'snap'
    );
    expect(snapMatches.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(doesRuleMatchEntityAndTrigger(ruleByTag, hero, 'collision', 'enter')).toBe(true);
    expect(doesRuleMatchEntityAndTrigger(ruleById, hero, 'snap', 'exit')).toBe(false);
  });

  it('store copy/paste/reset behavior preserves target ID and resets defaults', () => {
    const e1 = makeEntity({
      id: 'e1',
      behaviors: [
        {
          id: 'p1',
          type: 'physics',
          enabled: true,
          gravity: 3.4,
          bounce: 0.9,
          mass: 2,
          friction: 0.1,
          isStatic: false,
        } as PhysicsBehaviorConfig,
      ],
    });
    const e2 = makeEntity({
      id: 'e2',
      behaviors: [
        {
          id: 'p2',
          type: 'physics',
          enabled: true,
          gravity: 1,
          bounce: 0.2,
          mass: 1,
          friction: 0.5,
          isStatic: false,
        } as PhysicsBehaviorConfig,
      ],
    });
    useSceneStore.setState({ entities: { e1, e2 }, entityOrder: ['e1', 'e2'] });

    const store = useSceneStore.getState();
    expect(store.copyEntityBehavior('e1', 'p1')).toBe(true);
    expect(store.pasteBehaviorToEntity('e2', 'p2')).toBe(true);

    const updatedE2 = useSceneStore.getState().entities.e2.behaviors?.[0] as PhysicsBehaviorConfig;
    expect(updatedE2.id).toBe('p2');
    expect(updatedE2.gravity).toBe(3.4);
    expect(updatedE2.bounce).toBe(0.9);

    store.resetEntityBehavior('e2', 'p2');
    const resetE2 = useSceneStore.getState().entities.e2.behaviors?.[0] as PhysicsBehaviorConfig;
    expect(resetE2.id).toBe('p2');
    expect(resetE2.gravity).toBe(400);
    expect(resetE2.bounce).toBe(0.4);
  });

  it('store batchUpdateEntityBehaviorPartial applies partial patch without overwriting untouched fields', () => {
    const e1 = makeEntity({
      id: 'e1',
      behaviors: [
        {
          id: 'p1',
          type: 'physics',
          enabled: true,
          gravity: 1,
          bounce: 0.5,
          mass: 1,
          friction: 0.2,
          isStatic: false,
        } as PhysicsBehaviorConfig,
      ],
    });
    const e2 = makeEntity({
      id: 'e2',
      behaviors: [
        {
          id: 'p2',
          type: 'physics',
          enabled: true,
          gravity: 2.5,
          bounce: 0.1,
          mass: 1,
          friction: 0.2,
          isStatic: false,
        } as PhysicsBehaviorConfig,
      ],
    });
    useSceneStore.setState({ entities: { e1, e2 }, entityOrder: ['e1', 'e2'] });

    useSceneStore.getState().batchUpdateEntityBehaviorPartial(['e1', 'e2'], 'physics', {
      bounce: 0.75,
    });

    const b1 = useSceneStore.getState().entities.e1.behaviors?.[0] as PhysicsBehaviorConfig;
    const b2 = useSceneStore.getState().entities.e2.behaviors?.[0] as PhysicsBehaviorConfig;
    expect(b1.bounce).toBe(0.75);
    expect(b2.bounce).toBe(0.75);
    expect(b1.gravity).toBe(1);
    expect(b2.gravity).toBe(2.5);
  });

  it('store batchTranslateEntities deduplicates parent/child ancestors cleanly', () => {
    const parent = makeEntity({
      id: 'parent',
      position: { x: 100, y: 100 },
    });
    const child = makeEntity({
      id: 'child',
      parentId: 'parent',
      position: { x: 140, y: 160 },
    });
    const sibling = makeEntity({
      id: 'sibling',
      position: { x: 300, y: 200 },
    });
    useSceneStore.setState({
      entities: { parent, child, sibling },
      entityOrder: ['parent', 'child', 'sibling'],
    });

    useSceneStore.getState().batchTranslateEntities(['parent', 'child', 'sibling'], {
      dx: 25,
      dy: -10,
    });

    const next = useSceneStore.getState().entities;
    expect(next.parent.position).toEqual({ x: 125, y: 90 });
    expect(next.child.position).toEqual({ x: 165, y: 150 });
    expect(next.sibling.position).toEqual({ x: 325, y: 190 });
  });

  it('store selectEntity toggle, batchDuplicateEntities, batchDeleteEntities, reorderEntityZStep & openRuleBookFromBehavior work', () => {
    const a = makeEntity({ id: 'a' });
    const b = makeEntity({ id: 'b' });
    const c = makeEntity({ id: 'c' });
    useSceneStore.setState({
      entities: { a, b, c },
      entityOrder: ['a', 'b', 'c'],
    });

    const store = useSceneStore.getState();
    store.selectEntity('a');
    store.selectEntity('b', { toggle: true });
    expect(useSceneStore.getState().selectedEntityIds).toEqual(['a', 'b']);
    expect(useSceneStore.getState().selectedEntityId).toBe('b');

    // Toggle 'a' off -> 'b' remains primary
    store.selectEntity('a', { toggle: true });
    expect(useSceneStore.getState().selectedEntityIds).toEqual(['b']);
    expect(useSceneStore.getState().selectedEntityId).toBe('b');

    // Z-order steps
    store.reorderEntityZStep('a', 'up');
    expect(useSceneStore.getState().entityOrder).toEqual(['b', 'a', 'c']);
    store.reorderEntityZStep('b', 'front');
    expect(useSceneStore.getState().entityOrder).toEqual(['a', 'c', 'b']);
    store.reorderEntityZStep('b', 'back');
    expect(useSceneStore.getState().entityOrder).toEqual(['b', 'a', 'c']);

    // Duplicate & delete batch
    const clones = store.batchDuplicateEntities(['a', 'c']);
    expect(clones).toHaveLength(2);
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(5);
    store.batchDeleteEntities(clones);
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(3);

    // Open RuleBook shortcut
    store.openRuleBookFromBehavior({
      mode: 'create',
      entityId: 'a',
      entityType: 'type_a',
      entityName: 'Objet a',
      triggerType: 'snap',
      triggerPhase: 'enter',
      label: 'Au snap',
    });
    const afterShortcut = useSceneStore.getState();
    expect(afterShortcut.activeMainView).toBe('rules');
    expect(afterShortcut.pendingRuleBookIntent?.entityId).toBe('a');
    expect(afterShortcut.pendingRuleBookIntent?.mode).toBe('create');
    store.clearPendingRuleBookIntent();
    expect(useSceneStore.getState().pendingRuleBookIntent).toBeNull();
  });

  it('formatRoleLabel formats contextual role labels without duplicating identical hints', () => {
    expect(formatRoleLabel('Sujet', 'Tête')).toBe('Sujet (Tête)');
    expect(formatRoleLabel('Cible', '#mur')).toBe('Cible (#mur)');
    expect(formatRoleLabel('Sujet', undefined)).toBe('Sujet');
    expect(formatRoleLabel('Sujet', '   ')).toBe('Sujet');
    expect(formatRoleLabel('Sujet', 'sujet')).toBe('Sujet');
  });

  it('resolveRuleEntityHint, trigger hints, and wizard hints resolve instance, type, tag, and any modes', () => {
    const head = makeEntity({ id: 'head_1', name: 'Tête', type: 'custom_head' });
    const body = makeEntity({ id: 'body_1', name: 'Corps', type: 'custom_body' });
    const ctx = {
      entities: { head_1: head, body_1: body },
      customArchetypes: {
        custom_coin: makeEntity({ id: 'arch_coin', name: 'Pièce Or', type: 'custom_coin' }),
      },
      availableEntityOptions: [{ type: 'custom_wall', label: 'Mur brique' }],
    };

    expect(resolveRuleEntityHint({ mode: 'any', ...ctx })).toBe('Tout objet');
    expect(resolveRuleEntityHint({ mode: 'tag', tag: '#ennemi', ...ctx })).toBe('#ennemi');
    expect(resolveRuleEntityHint({ mode: 'tag', tag: '', ...ctx })).toBe('#tag');
    expect(resolveRuleEntityHint({ mode: 'instance', entityId: 'body_1', ...ctx })).toBe('Corps');
    expect(resolveRuleEntityHint({ mode: 'type', entityType: 'custom_coin', ...ctx })).toBe('Pièce Or');
    expect(resolveRuleEntityHint({ mode: 'type', entityType: 'custom_wall', ...ctx })).toBe('Mur brique');

    expect(
      resolveTriggerSubjectHint({ subjectMode: 'type', subjectType: 'custom_head' }, ctx)
    ).toBe('Tête');
    expect(
      resolveTriggerTargetHint({ type: 'collision', targetMode: 'tag', targetTag: 'mur' }, ctx)
    ).toBe('#mur');
    expect(resolveTriggerTargetHint({ type: 'snap' }, ctx)).toBe('Tout objet');

    expect(
      resolveWizardSubjectHint({ subjectMode: 'instance', subjectId: 'head_1', subjectType: 'custom_head' }, ctx)
    ).toBe('Tête');
    expect(
      resolveWizardTargetHint({ triggerType: 'target_arrived', targetType: '' }, ctx)
    ).toBe('Tout objet');
    expect(
      resolveWizardTargetHint(
        { triggerType: 'collision', targetMode: 'type', targetType: 'custom_body' },
        ctx
      )
    ).toBe('Corps');
  });
});
