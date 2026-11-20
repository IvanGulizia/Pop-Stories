import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSceneStore } from '../store/useSceneStore';
import {
  clearTriggerGateState,
  resetPlaySessionClock,
} from '../store/triggerGate';
import { Entity } from '../types';

function makeTestEntity(id: string, type = 'hero', x = 100, y = 100): Entity {
  return {
    id,
    name: `Entity ${id}`,
    type,
    position: { x, y },
    size: { width: 60, height: 60 },
    currentStateId: 'idle',
    isDraggable: false,
    states: {
      idle: { id: 'idle', name: 'Repos', color: '#3b82f6', scale: 1, rotation: 0 },
      active: { id: 'active', name: 'Actif', color: '#10b981', scale: 1, rotation: 0 },
    },
  };
}

describe('Universal Trigger Limits, Cooldowns, Start Delays & State Change', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    useSceneStore.getState().setAppMode('edit');
    vi.useRealTimers();
  });

  it('enforces triggerMaxCount (1x once and Nx) across events and resets on Stop/Reset', () => {
    const store = useSceneStore.getState();
    const hero = makeTestEntity('hero-1', 'hero');
    useSceneStore.setState({
      entities: { [hero.id]: hero },
      entityOrder: [hero.id],
      initialGameVariables: { score: 0, coins: 0 },
    });

    store.addRule({
      name: 'Click once rule',
      enabled: true,
      trigger: {
        type: 'click',
        subjectMode: 'instance',
        subjectId: hero.id,
        triggerMaxCount: 1,
      },
      actions: [
        {
          id: 'act-1',
          type: 'set_variable',
          variableName: 'coins',
          variableOperation: 'add',
          variableValue: 5,
        },
      ],
    });

    store.addRule({
      name: 'Key 3x rule',
      enabled: true,
      trigger: {
        type: 'keyboard',
        phase: 'down',
        keyName: 'Space',
        triggerMaxCount: 3,
      },
      actions: [
        {
          id: 'act-2',
          type: 'add_score',
          scoreAmount: 2,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');

    // Click 3 times -> coins should only add once (+5)
    useSceneStore.getState().triggerPointerEvent(hero.id, 'click');
    useSceneStore.getState().triggerPointerEvent(hero.id, 'click');
    useSceneStore.getState().triggerPointerEvent(hero.id, 'click');
    expect(useSceneStore.getState().gameVariables.coins).toBe(5);

    // Press Space 5 times -> score should only add 3 * 2 = 6
    for (let i = 0; i < 5; i++) {
      vi.advanceTimersByTime(60);
      useSceneStore.getState().triggerKeyEvent('Space', 'down');
    }
    expect(useSceneStore.getState().gameScore).toBe(6);

    // Stop and restart Play -> counters reset cleanly
    useSceneStore.getState().setAppMode('edit');
    useSceneStore.getState().setAppMode('play');

    useSceneStore.getState().triggerPointerEvent(hero.id, 'click');
    expect(useSceneStore.getState().gameVariables.coins).toBe(5);
    useSceneStore.getState().triggerKeyEvent('Space', 'down');
    expect(useSceneStore.getState().gameScore).toBe(2);
  });

  it('enforces triggerStartDelaySec and triggerCooldownSec accurately', () => {
    const store = useSceneStore.getState();
    const btn = makeTestEntity('btn-1', 'button');
    useSceneStore.setState({
      entities: { [btn.id]: btn },
      entityOrder: [btn.id],
      initialGameVariables: { score: 0, hits: 0 },
    });

    store.addRule({
      name: 'Delayed + Cooldown click',
      enabled: true,
      trigger: {
        type: 'click',
        subjectMode: 'instance',
        subjectId: btn.id,
        triggerStartDelaySec: 2,
        triggerCooldownSec: 1.5,
      },
      actions: [
        {
          id: 'act-hit',
          type: 'set_variable',
          variableName: 'hits',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');

    // Before 2s start delay -> blocked
    vi.advanceTimersByTime(1000);
    useSceneStore.getState().triggerPointerEvent(btn.id, 'click');
    expect(useSceneStore.getState().gameVariables.hits).toBe(0);

    // After 2s start delay -> fires #1
    vi.advanceTimersByTime(1100);
    useSceneStore.getState().triggerPointerEvent(btn.id, 'click');
    expect(useSceneStore.getState().gameVariables.hits).toBe(1);

    // 500ms later (< 1.5s cooldown) -> blocked
    vi.advanceTimersByTime(500);
    useSceneStore.getState().triggerPointerEvent(btn.id, 'click');
    expect(useSceneStore.getState().gameVariables.hits).toBe(1);

    // 1.1s later (total 1.6s > 1.5s cooldown) -> fires #2
    vi.advanceTimersByTime(1100);
    useSceneStore.getState().triggerPointerEvent(btn.id, 'click');
    expect(useSceneStore.getState().gameVariables.hits).toBe(2);
  });

  it('supports triggerRequireReset (rising edge) on variable thresholds and boundary', () => {
    const store = useSceneStore.getState();
    const runner = makeTestEntity('runner-1', 'runner', 100, 100);
    useSceneStore.setState({
      entities: { [runner.id]: runner },
      entityOrder: [runner.id],
      initialGameVariables: { score: 0, energy: 0, bonus: 0, edgeHits: 0 },
    });

    store.addRule({
      name: 'Energy threshold rising edge',
      enabled: true,
      trigger: {
        type: 'variable',
        variableName: 'energy',
        variableTriggerMode: 'threshold',
        variableOperator: '>=',
        variableValue: 10,
        triggerRequireReset: true,
      },
      actions: [
        {
          id: 'act-b',
          type: 'set_variable',
          variableName: 'bonus',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    store.addRule({
      name: 'Left boundary rising edge',
      enabled: true,
      trigger: {
        type: 'boundary',
        subjectMode: 'instance',
        subjectId: runner.id,
        boundaryEdge: 'left',
        triggerRequireReset: true,
      },
      actions: [
        {
          id: 'act-edge',
          type: 'set_variable',
          variableName: 'edgeHits',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');

    // Variable crosses 10 -> fires once (bonus = 1)
    useSceneStore.getState().setGameVariable('energy', 10);
    expect(useSceneStore.getState().gameVariables.bonus).toBe(1);

    // Variable stays >= 10 (15) -> does NOT re-fire
    useSceneStore.getState().setGameVariable('energy', 15);
    expect(useSceneStore.getState().gameVariables.bonus).toBe(1);

    // Variable drops below 10 (rearms) -> then crosses >= 10 again -> bonus = 2
    useSceneStore.getState().setGameVariable('energy', 4);
    useSceneStore.getState().setGameVariable('energy', 12);
    expect(useSceneStore.getState().gameVariables.bonus).toBe(2);

    // Boundary left: move to x=-5 (collider wb.x=1 <= 2) -> fires once, evaluate again at x=-4 (wb.x=2) -> blocked, move away x=50 then back x=-5 -> fires 2nd time
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: -5, y: 100 } });
    expect(useSceneStore.getState().gameVariables.edgeHits).toBe(1);
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: -4, y: 100 } });
    expect(useSceneStore.getState().gameVariables.edgeHits).toBe(1);
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: 50, y: 100 } });
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: -5, y: 100 } });
    expect(useSceneStore.getState().gameVariables.edgeHits).toBe(2);
  });

  it('fires state_change triggers in Play mode when entity state transitions', () => {
    const store = useSceneStore.getState();
    const door = makeTestEntity('door-1', 'door');
    useSceneStore.setState({
      entities: { [door.id]: door },
      entityOrder: [door.id],
      initialGameVariables: { score: 0, opened: 0 },
    });

    store.addRule({
      name: 'On door state change',
      enabled: true,
      trigger: {
        type: 'state_change',
        subjectMode: 'instance',
        subjectId: door.id,
        subjectStateId: 'active',
        triggerMaxCount: 1,
      },
      actions: [
        {
          id: 'act-open',
          type: 'set_variable',
          variableName: 'opened',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');
    useSceneStore.getState().updateEntityState(door.id, 'active');
    expect(useSceneStore.getState().gameVariables.opened).toBe(1);

    // Changing back to idle and active again respects triggerMaxCount: 1
    useSceneStore.getState().updateEntityState(door.id, 'idle');
    useSceneStore.getState().updateEntityState(door.id, 'active');
    expect(useSceneStore.getState().gameVariables.opened).toBe(1);
  });
});

describe('Multi-Scènes, Transitions & Persistance', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T10:00:00Z'));
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    useSceneStore.getState().setAppMode('edit');
    vi.useRealTimers();
  });

  it('creates, renames, duplicates, switches, and deletes scenes while isolating per-scene content', () => {
    const e1 = makeTestEntity('ent-s1', 'hero', 40, 40);
    useSceneStore.setState({
      entities: { [e1.id]: e1 },
      entityOrder: [e1.id],
    });

    const scene2Id = useSceneStore.getState().createScene('Niveau 2');
    expect(useSceneStore.getState().activeSceneId).toBe(scene2Id);
    expect(Object.keys(useSceneStore.getState().entities)).toHaveLength(0);

    useSceneStore.getState().setSceneBackgroundColor('#1e293b');
    const e2 = makeTestEntity('ent-s2', 'coin', 200, 180);
    useSceneStore.setState({
      entities: { [e2.id]: e2 },
      entityOrder: [e2.id],
    });

    useSceneStore.getState().renameScene(scene2Id, 'Donjon');
    expect(useSceneStore.getState().scenes.find((s) => s.id === scene2Id)?.name).toBe('Donjon');

    const dupId = useSceneStore.getState().duplicateScene(scene2Id);
    expect(useSceneStore.getState().activeSceneId).toBe(dupId);
    expect(useSceneStore.getState().backgroundColor).toBe('#1e293b');
    expect(Object.keys(useSceneStore.getState().entities)).toEqual(['ent-s2']);

    // Switch back to scene-1 -> verifies isolation
    useSceneStore.getState().switchScene('scene-1');
    expect(useSceneStore.getState().activeSceneId).toBe('scene-1');
    expect(useSceneStore.getState().backgroundColor).toBe('#ffffff');
    expect(Object.keys(useSceneStore.getState().entities)).toEqual(['ent-s1']);

    // Delete duplicated scene
    useSceneStore.getState().deleteScene(dupId);
    expect(useSceneStore.getState().scenes).toHaveLength(2);
  });

  it('executes change_scene in Play mode, animates transitions, preserves gameVariables, and restores starting scene on Stop', () => {
    const hero1 = makeTestEntity('hero-s1', 'hero', 50, 50);
    useSceneStore.setState({
      entities: { [hero1.id]: hero1 },
      entityOrder: [hero1.id],
      initialGameVariables: { score: 10, keys: 0 },
    });

    const scene2Id = useSceneStore.getState().createScene('Salle Secrète');
    useSceneStore.getState().setSceneBackgroundColor('#0f172a');
    const chest = makeTestEntity('chest-s2', 'chest', 300, 200);
    useSceneStore.setState({
      entities: { [chest.id]: chest },
      entityOrder: [chest.id],
    });

    // Add once-only click rule in Scene 2
    useSceneStore.getState().addRule({
      name: 'Open chest once',
      enabled: true,
      trigger: {
        type: 'click',
        subjectMode: 'instance',
        subjectId: chest.id,
        triggerMaxCount: 1,
      },
      actions: [
        {
          id: 'act-chest',
          type: 'set_variable',
          variableName: 'keys',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    // Switch back to Scene 1 and add transition rule to Scene 2
    useSceneStore.getState().switchScene('scene-1');
    useSceneStore.getState().addRule({
      name: 'Portal to Scene 2',
      enabled: true,
      trigger: {
        type: 'click',
        subjectMode: 'instance',
        subjectId: hero1.id,
      },
      actions: [
        {
          id: 'act-score',
          type: 'add_score',
          scoreAmount: 5,
        },
        {
          id: 'act-scene',
          type: 'change_scene',
          targetSceneId: scene2Id,
          sceneTransition: 'fade',
          sceneTransitionDuration: 0.4,
        },
      ],
    });

    // Start Play from Scene 1
    useSceneStore.getState().setAppMode('play');
    expect(useSceneStore.getState().activeSceneId).toBe('scene-1');

    // Trigger portal click
    useSceneStore.getState().triggerPointerEvent(hero1.id, 'click');
    expect(useSceneStore.getState().gameScore).toBe(15);
    expect(useSceneStore.getState().activeSceneTransition?.phase).toBe('out');
    expect(useSceneStore.getState().activeSceneId).toBe('scene-1');

    // Halfway through 0.4s -> swaps to Scene 2 and enters 'in' phase
    vi.advanceTimersByTime(210);
    expect(useSceneStore.getState().activeSceneId).toBe(scene2Id);
    expect(useSceneStore.getState().backgroundColor).toBe('#0f172a');
    expect(useSceneStore.getState().activeSceneTransition?.phase).toBe('in');
    // gameVariables & gameScore are preserved across scenes
    expect(useSceneStore.getState().gameScore).toBe(15);
    expect(useSceneStore.getState().gameVariables.score).toBe(15);

    // Finish curtain fade-in
    vi.advanceTimersByTime(220);
    expect(useSceneStore.getState().activeSceneTransition).toBeNull();

    // Interact with chest in Scene 2 (1x limit works)
    useSceneStore.getState().triggerPointerEvent(chest.id, 'click');
    useSceneStore.getState().triggerPointerEvent(chest.id, 'click');
    expect(useSceneStore.getState().gameVariables.keys).toBe(1);

    // Edit/add a rule during Play to verify Phase 10.19 rule persistence
    useSceneStore.getState().addRule({
      name: 'Play-added rule',
      enabled: true,
      trigger: { type: 'click', subjectMode: 'any' },
      actions: [],
    });

    // Stop Play -> restores starting Scene 1 & resets variables, while keeping Play-edited rule in Scene 2
    useSceneStore.getState().setAppMode('edit');
    expect(useSceneStore.getState().activeSceneId).toBe('scene-1');
    expect(useSceneStore.getState().gameScore).toBe(10);
    expect(useSceneStore.getState().gameVariables.keys).toBe(0);
    const savedScene2 = useSceneStore.getState().scenes.find((s) => s.id === scene2Id);
    expect(savedScene2?.rules.some((r) => r.name === 'Play-added rule')).toBe(true);
  });

  it('exports multi-scene JSON and imports both multi-scene and legacy single-scene payloads', () => {
    const hero = makeTestEntity('hero-exp', 'hero', 20, 20);
    useSceneStore.setState({
      entities: { [hero.id]: hero },
      entityOrder: [hero.id],
    });
    const s2 = useSceneStore.getState().createScene('Scene Deux');
    useSceneStore.getState().setSceneBackgroundColor('#fef08a');

    const exported = useSceneStore.getState().exportProject();
    expect(exported.scenes).toHaveLength(2);
    expect(exported.activeSceneId).toBe(s2);

    useSceneStore.getState().clearProject();
    const resMulti = useSceneStore.getState().importProject(exported);
    expect(resMulti.success).toBe(true);
    expect(useSceneStore.getState().scenes).toHaveLength(2);
    expect(useSceneStore.getState().activeSceneId).toBe(s2);
    expect(useSceneStore.getState().backgroundColor).toBe('#fef08a');

    // Legacy single-scene payload import
    const resLegacy = useSceneStore.getState().importProject({
      version: '1.0',
      exportedAt: Date.now(),
      entities: { [hero.id]: hero },
      customArchetypes: {},
      rules: [],
      folders: [],
      customSounds: [],
      layerGroups: [],
      settings: useSceneStore.getState().settings,
    });
    expect(resLegacy.success).toBe(true);
    expect(useSceneStore.getState().scenes).toHaveLength(1);
    expect(useSceneStore.getState().activeSceneId).toBe('scene-1');
    expect(Object.keys(useSceneStore.getState().entities)).toEqual(['hero-exp']);
  });
});
