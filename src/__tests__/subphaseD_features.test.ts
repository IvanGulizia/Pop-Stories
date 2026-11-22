import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  DynamicRule,
  Entity,
  RuleAction,
  SceneCameraConfig,
  SnapBehaviorConfig,
} from '../types';
import {
  DEFAULT_SCENE_CAMERA_CONFIG,
  computeEditPlayCameraPreviewSize,
  fitAspectRatioSize,
  resolveEffectivePlayAspectRatio,
  resolveWorldBounds,
} from '../utils/cameraSolver';
import {
  computeSnapGoalForTarget,
  createInitialSnapRuntimeEntry,
  stepSnapSolver,
} from '../utils/physics/snapSolver';
import {
  resetMatterPhysicsRuntime,
  snapEntityToTargetRuntime,
  stepMatterPhysics,
  unsnapEntityRuntime,
} from '../utils/matterPhysicsEngine';
import { executeRuleActions } from '../store/ruleExecutionEngine';
import { clearTriggerGateState, resetPlaySessionClock } from '../store/triggerGate';
import { reorderRuleActionsInList, useSceneStore } from '../store/useSceneStore';

function makeEntity(
  id: string,
  overrides: Partial<Entity> = {}
): Entity {
  const baseStateId = overrides.currentStateId || 'state-default';
  const baseState = {
    id: baseStateId,
    name: 'Normal',
    color: '#3b82f6',
    scale: 1,
    rotation: 0,
  };
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 100, y: 100 },
    size: { width: 40, height: 40 },
    currentStateId: baseStateId,
    isDraggable: false,
    states: {
      [baseStateId]: baseState,
      ...(overrides.states || {}),
    },
    ...overrides,
  };
}

function makeCameraConfig(overrides: Partial<SceneCameraConfig> = {}): SceneCameraConfig {
  return {
    ...DEFAULT_SCENE_CAMERA_CONFIG,
    ...overrides,
  };
}

describe('Sous-phase D (#9, #11, #16)', () => {
  beforeEach(() => {
    resetMatterPhysicsRuntime();
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.setState({
      entities: {},
      entityOrder: [],
      rules: [],
      gameVariables: {},
      appMode: 'edit',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    resetMatterPhysicsRuntime();
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.setState({
      entities: {},
      entityOrder: [],
      rules: [],
      gameVariables: {},
      appMode: 'edit',
    });
  });

  describe('#9 — Ratio Caméra dédié au Mode Play (sans bandes noires)', () => {
    it('resolves effective play aspect ratio from inherit vs explicit override', () => {
      expect(resolveEffectivePlayAspectRatio('16:9', undefined)).toBe('16:9');
      expect(
        resolveEffectivePlayAspectRatio('16:9', makeCameraConfig({ playAspectRatio: 'inherit' }))
      ).toBe('16:9');
      expect(
        resolveEffectivePlayAspectRatio('16:9', makeCameraConfig({ playAspectRatio: '9:16' }))
      ).toBe('9:16');
      expect(
        resolveEffectivePlayAspectRatio('free', makeCameraConfig({ playAspectRatio: '1:1' }))
      ).toBe('1:1');
    });

    it('fits viewport sizes cleanly for 16:9, 9:16, 1:1, and free without letterbox bloat', () => {
      expect(fitAspectRatioSize(1000, 1000, '16:9')).toEqual({ width: 1000, height: 563 });
      expect(fitAspectRatioSize(1000, 800, '9:16')).toEqual({ width: 450, height: 800 });
      expect(fitAspectRatioSize(900, 600, '1:1')).toEqual({ width: 600, height: 600 });
      expect(fitAspectRatioSize(920, 640, 'free')).toEqual({ width: 920, height: 640 });
    });

    it('resolves world bounds respecting editViewportBounds in viewport mode and custom world dimensions', () => {
      expect(
        resolveWorldBounds(
          { width: 450, height: 800 },
          makeCameraConfig({ worldMode: 'viewport' }),
          { width: 1200, height: 700 }
        )
      ).toEqual({ width: 1200, height: 800 });

      expect(
        resolveWorldBounds(
          { width: 800, height: 500 },
          makeCameraConfig({ worldMode: 'custom', worldWidth: 2400, worldHeight: 1400 }),
          { width: 1200, height: 700 }
        )
      ).toEqual({ width: 2400, height: 1400 });
    });

    it('computes edit-mode play camera preview frame using playAspectRatio, zoom, and outerWorkspaceSize', () => {
      const camPortraitZoom2 = makeCameraConfig({
        playAspectRatio: '9:16',
        zoom: 2,
      });

      const preview = computeEditPlayCameraPreviewSize(
        { width: 1280, height: 720 },
        { width: 1400, height: 800 },
        '16:9',
        camPortraitZoom2
      );
      // 9:16 fitted inside 1400x800 => 450x800, divided by zoom 2 => 225x400
      expect(preview).toEqual({ width: 225, height: 400 });

      const previewInherited = computeEditPlayCameraPreviewSize(
        { width: 1280, height: 720 },
        null,
        '16:9',
        makeCameraConfig({ playAspectRatio: 'inherit', zoom: 1 })
      );
      expect(previewInherited).toEqual({ width: 1280, height: 720 });
    });
  });

  describe('#11 — Drag & Drop des cartes d’actions dans le RuleBook', () => {
    it('reorders actions cleanly before and after target without mutating the source array', () => {
      const actions: RuleAction[] = [
        { id: 'a1', type: 'delay', delayDuration: 0.2 },
        { id: 'a2', type: 'change_state', targetStateId: 's2' },
        { id: 'a3', type: 'play_sound', soundType: 'bell' },
        { id: 'a4', type: 'delete_entity' },
      ];
      const snapshot = actions.map((a) => a.id);

      const movedBefore = reorderRuleActionsInList(actions, 'a3', 'a1', 'before');
      expect(movedBefore.map((a) => a.id)).toEqual(['a3', 'a1', 'a2', 'a4']);
      expect(actions.map((a) => a.id)).toEqual(snapshot);

      const movedAfter = reorderRuleActionsInList(actions, 'a1', 'a3', 'after');
      expect(movedAfter.map((a) => a.id)).toEqual(['a2', 'a3', 'a1', 'a4']);

      expect(reorderRuleActionsInList(actions, 'a2', 'a2', 'before')).toBe(actions);
      expect(reorderRuleActionsInList(actions, 'missing', 'a1', 'before')).toBe(actions);
    });

    it('updates the target rule actions via useSceneStore.reorderRuleActions while preserving sibling rules', () => {
      const rule1: DynamicRule = {
        id: 'rule-1',
        name: 'Combo',
        enabled: true,
        trigger: { type: 'click', subjectMode: 'any' },
        actions: [
          { id: 'act-1', type: 'delay', delayDuration: 0.1 },
          { id: 'act-2', type: 'set_variable', variableName: 'score', variableOperation: 'add', variableValue: 1 },
          { id: 'act-3', type: 'play_sound', soundType: 'magic' },
        ],
      };
      const rule2: DynamicRule = {
        id: 'rule-2',
        name: 'Other',
        enabled: true,
        trigger: { type: 'click', subjectMode: 'any' },
        actions: [
          { id: 'b1', type: 'delay', delayDuration: 0.5 },
          { id: 'b2', type: 'delete_entity' },
        ],
      };

      useSceneStore.setState({ rules: [rule1, rule2] });
      useSceneStore.getState().reorderRuleActions('rule-1', 'act-3', 'act-1', 'before');

      const updatedRules = useSceneStore.getState().rules;
      expect(updatedRules[0].actions.map((a) => a.id)).toEqual(['act-3', 'act-1', 'act-2']);
      expect(updatedRules[1].actions.map((a) => a.id)).toEqual(['b1', 'b2']);
    });
  });

  describe('#16 — Comportement Snap (Aimant) + Événement & Actions RuleBook', () => {
    it('computes snap goals for center, anchor_offset (with target rotation), and edge_closest alignments', () => {
      const subject = makeEntity('sub', {
        position: { x: 10, y: 10 },
        size: { width: 40, height: 40 },
      });
      const target = makeEntity('tar', {
        position: { x: 200, y: 100 },
        size: { width: 80, height: 60 },
        states: {
          'state-default': {
            id: 'state-default',
            name: 'Normal',
            color: '#10b981',
            scale: 1,
            rotation: 90,
          },
        },
      });

      const centerCfg: SnapBehaviorConfig = {
        id: 'snap-c',
        type: 'snap',
        enabled: true,
        targetType: 'any',
        snapTrigger: 'always_when_near',
        snapRadius: 80,
        snapMode: 'instant',
        snapAlignment: 'center',
        attachBehavior: 'position_only',
        offsetX: 10,
        offsetY: -5,
        matchTargetRotation: false,
      };
      const centerGoal = computeSnapGoalForTarget(subject, target, centerCfg);
      // Target center = (240, 130), + (10, -5) = (250, 125), top-left = (230, 105)
      expect(centerGoal.goalTopLeft).toEqual({ x: 230, y: 105 });
      expect(centerGoal.goalRotationDeg).toBeUndefined();

      const anchorCfg: SnapBehaviorConfig = {
        ...centerCfg,
        snapAlignment: 'anchor_offset',
        sourceAnchor: 'top',
        targetAnchor: 'bottom',
        offsetX: 0,
        offsetY: 0,
        matchTargetRotation: true,
        rotationOffset: 15,
      };
      const anchorGoal = computeSnapGoalForTarget(subject, target, anchorCfg);
      expect(anchorGoal.goalRotationDeg).toBe(105);
      expect(Number.isFinite(anchorGoal.goalTopLeft.x)).toBe(true);
      expect(Number.isFinite(anchorGoal.goalTopLeft.y)).toBe(true);

      const leftApproaching = makeEntity('sub-left', {
        position: { x: 140, y: 110 },
        size: { width: 40, height: 40 },
      });
      const unrotatedTarget = makeEntity('tar-flat', {
        position: { x: 200, y: 100 },
        size: { width: 80, height: 60 },
      });
      const edgeGoal = computeSnapGoalForTarget(leftApproaching, unrotatedTarget, {
        ...centerCfg,
        offsetX: 0,
        offsetY: 0,
        snapAlignment: 'edge_closest',
      });
      // Subject is to the left of target: subject right edge touches target left edge (x=200) -> topLeft.x = 160
      expect(edgeGoal.goalTopLeft).toEqual({ x: 160, y: 110 });
    });

    it('handles on_release preview, enter snap with parent_rigid + state change, pull-to-unsnap exit, and reSnapCooldownSec', () => {
      const entity = makeEntity('piece', {
        position: { x: 195, y: 195 },
        size: { width: 40, height: 40 },
        states: {
          'state-default': { id: 'state-default', name: 'Normal', color: '#3b82f6', scale: 1, rotation: 0 },
          'state-snapped': { id: 'state-snapped', name: 'Aimanté', color: '#22c55e', scale: 1, rotation: 0 },
          'state-free': { id: 'state-free', name: 'Libre', color: '#94a3b8', scale: 1, rotation: 0 },
        },
      });
      const socket = makeEntity('socket', {
        position: { x: 200, y: 200 },
        size: { width: 40, height: 40 },
      });
      const config: SnapBehaviorConfig = {
        id: 'snap-1',
        type: 'snap',
        enabled: true,
        targetType: 'entity',
        targetEntityId: 'socket',
        snapTrigger: 'on_release',
        snapRadius: 48,
        snapMode: 'instant',
        snapAlignment: 'center',
        attachBehavior: 'parent_rigid',
        allowPullUnsnap: true,
        unsnapDistance: 70,
        reSnapCooldownSec: 0.4,
        snappedStateId: 'state-snapped',
        unsnappedStateId: 'state-free',
      };

      const runtime0 = createInitialSnapRuntimeEntry();

      // 1. While dragging (not yet released) -> preview link only, not snapped yet
      const dragApproach = stepSnapSolver({
        entity,
        config,
        runtime: runtime0,
        allEntities: { piece: entity, socket },
        dt: 0.016,
        isDragging: true,
        justReleased: false,
        dragPos: { x: 195, y: 195 },
      });
      expect(dragApproach.nextRuntime.isSnapped).toBe(false);
      expect(dragApproach.snapEvent).toBeUndefined();
      expect(dragApproach.activeLink).toMatchObject({ snapped: false, targetId: 'socket' });

      // 2. On release -> snaps, emits enter event, sets parent_rigid mutation, changes state
      const released = stepSnapSolver({
        entity,
        config,
        runtime: dragApproach.nextRuntime,
        allEntities: { piece: entity, socket },
        dt: 0.016,
        isDragging: false,
        justReleased: true,
        dragPos: { x: 195, y: 195 },
      });
      expect(released.nextRuntime.isSnapped).toBe(true);
      expect(released.nextRuntime.snappedTargetId).toBe('socket');
      expect(released.nextPosition).toEqual({ x: 200, y: 200 });
      expect(released.snapEvent).toMatchObject({ phase: 'enter', targetEntityId: 'socket' });
      expect(released.parentMutation).toMatchObject({ childId: 'piece', parentId: 'socket' });
      expect(released.stateChange).toBe('state-snapped');

      // 3. Pulling beyond unsnapDistance -> emits exit event, clears parent, sets cooldown & unsnappedStateId
      const parentedPiece = { ...entity, position: { x: 200, y: 200 }, parentId: 'socket' };
      const pulledOut = stepSnapSolver({
        entity: parentedPiece,
        config,
        runtime: released.nextRuntime,
        allEntities: { piece: parentedPiece, socket },
        dt: 0.016,
        isDragging: true,
        justReleased: false,
        dragPos: { x: 320, y: 200 },
      });
      expect(pulledOut.nextRuntime.isSnapped).toBe(false);
      expect(pulledOut.nextRuntime.cooldownRemaining).toBeCloseTo(0.4, 2);
      expect(pulledOut.snapEvent).toMatchObject({ phase: 'exit', targetEntityId: 'socket' });
      expect(pulledOut.parentMutation).toEqual({ childId: 'piece', parentId: null });
      expect(pulledOut.stateChange).toBe('state-free');

      // 4. Immediately releasing near target while cooldown > 0 -> blocked from re-snapping
      const blockedReSnap = stepSnapSolver({
        entity: { ...entity, position: { x: 202, y: 202 } },
        config: { ...config, snapTrigger: 'always_when_near' },
        runtime: pulledOut.nextRuntime,
        allEntities: { piece: entity, socket },
        dt: 0.05,
        isDragging: false,
        justReleased: true,
      });
      expect(blockedReSnap.nextRuntime.isSnapped).toBe(false);
      expect(blockedReSnap.snapEvent).toBeUndefined();
    });

    it('integrates snap behavior in stepMatterPhysics and supports manual runtime snap/unsnap', () => {
      const snapCfg: SnapBehaviorConfig = {
        id: 'snap-always',
        type: 'snap',
        enabled: true,
        targetType: 'tag',
        targetTag: 'aimant',
        snapTrigger: 'always_when_near',
        snapRadius: 60,
        snapMode: 'instant',
        snapAlignment: 'center',
        attachBehavior: 'parent_rigid',
        reSnapCooldownSec: 0.5,
      };
      const piece = makeEntity('piece', {
        position: { x: 210, y: 205 },
        size: { width: 40, height: 40 },
        behaviors: [snapCfg],
      });
      const anchor = makeEntity('anchor', {
        position: { x: 200, y: 200 },
        size: { width: 40, height: 40 },
        tags: ['aimant'],
      });

      const tick = stepMatterPhysics({
        entities: { piece, anchor },
        canvasBounds: { width: 800, height: 500 },
        deltaTime: 0.016,
      });
      expect(tick.snapEvents).toHaveLength(1);
      expect(tick.snapEvents?.[0]).toMatchObject({
        subjectId: 'piece',
        targetEntityId: 'anchor',
        phase: 'enter',
      });
      expect(tick.snapParentMutations).toHaveLength(1);
      expect(tick.snapParentMutations?.[0]).toMatchObject({
        childId: 'piece',
        parentId: 'anchor',
      });

      const unsnapInfo = unsnapEntityRuntime('piece', 0.5);
      expect(unsnapInfo.wasSnapped).toBe(true);
      expect(unsnapInfo.previousTargetId).toBe('anchor');
      expect(unsnapInfo.wasParented).toBe(true);

      const forced = snapEntityToTargetRuntime({
        entity: piece,
        target: anchor,
        snapAlignment: 'center',
        offsetX: 12,
        offsetY: -8,
        attachBehavior: 'parent_spring',
      });
      expect(forced.goalTopLeft).toEqual({ x: 212, y: 192 });
      expect(forced.attachBehavior).toBe('parent_spring');
      expect(forced.parentOffset?.attachmentMode).toBe('spring');
    });

    it('triggers RuleBook snap enter/exit rules and executes snap_to & unsnap actions', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

      const hero = makeEntity('hero', {
        position: { x: 50, y: 50 },
        size: { width: 40, height: 40 },
        states: {
          'state-default': { id: 'state-default', name: 'Normal', color: '#3b82f6', scale: 1, rotation: 0 },
          'state-locked': { id: 'state-locked', name: 'Verrouillé', color: '#10b981', scale: 1, rotation: 0 },
        },
      });
      const pad = makeEntity('pad', {
        position: { x: 300, y: 200 },
        size: { width: 80, height: 40 },
        tags: ['socle'],
        states: {
          'state-default': { id: 'state-default', name: 'Socle', color: '#f59e0b', scale: 1, rotation: 30 },
        },
      });

      const enterRule: DynamicRule = {
        id: 'rule-snap-enter',
        name: 'On Snap Enter',
        enabled: true,
        trigger: {
          type: 'snap',
          phase: 'enter',
          subjectMode: 'instance',
          subjectId: 'hero',
          targetMode: 'tag',
          targetTag: 'socle',
        },
        actions: [
          {
            id: 'a-var-enter',
            type: 'set_variable',
            variableName: 'snapCount',
            variableOperation: 'add',
            variableValue: 1,
          },
          {
            id: 'a-state-enter',
            type: 'change_state',
            targetMode: 'subject',
            targetStateId: 'state-locked',
          },
        ],
      };

      const exitRule: DynamicRule = {
        id: 'rule-snap-exit',
        name: 'On Snap Exit',
        enabled: true,
        trigger: {
          type: 'snap',
          phase: 'exit',
          subjectMode: 'instance',
          subjectId: 'hero',
          targetMode: 'any',
        },
        actions: [
          {
            id: 'a-var-exit',
            type: 'set_variable',
            variableName: 'unsnapCount',
            variableOperation: 'add',
            variableValue: 1,
          },
        ],
      };

      useSceneStore.setState({
        appMode: 'play',
        entities: { hero, pad },
        entityOrder: ['hero', 'pad'],
        rules: [enterRule, exitRule],
        gameVariables: { snapCount: 0, unsnapCount: 0 },
      });

      useSceneStore.getState().triggerSnapEvent('hero', 'pad', 'enter', { x: 340, y: 220 });
      expect(useSceneStore.getState().gameVariables.snapCount).toBe(1);
      expect(useSceneStore.getState().entities.hero.currentStateId).toBe('state-locked');

      vi.advanceTimersByTime(300);
      useSceneStore.getState().triggerSnapEvent('hero', 'pad', 'exit', { x: 340, y: 220 });
      expect(useSceneStore.getState().gameVariables.unsnapCount).toBe(1);

      // Test snap_to & unsnap actions via executeRuleActions
      const store = useSceneStore.getState();
      executeRuleActions(
        [
          {
            id: 'act-snap-to',
            type: 'snap_to',
            targetMode: 'instance',
            targetId: 'hero',
            snapTargetMode: 'entity',
            snapTargetEntityId: 'pad',
            snapAlignment: 'center',
            snapOffsetX: 5,
            snapOffsetY: 10,
            snapMatchRotation: true,
            snapRotationOffset: 15,
            snapAttachBehavior: 'parent_rigid',
          },
        ],
        {
          subject: store.entities.hero,
          target: store.entities.pad,
          allEntities: store.entities,
          updateEntityState: store.updateEntityState,
          updateEntityDetails: store.updateEntityDetails,
          deleteEntity: store.deleteEntity,
          spawnEntity: store.spawnEntity,
        }
      );

      const afterSnapTo = useSceneStore.getState().entities.hero;
      expect(afterSnapTo.parentId).toBe('pad');
      expect(afterSnapTo.states[afterSnapTo.currentStateId].rotation).toBe(45);
      expect(Number.isFinite(afterSnapTo.position.x)).toBe(true);

      executeRuleActions(
        [
          {
            id: 'act-unsnap',
            type: 'unsnap',
            targetMode: 'instance',
            targetId: 'hero',
            unsnapCooldownSec: 0.6,
            unsnapImpulseSpeed: 180,
            unsnapImpulseAngle: -90,
          },
        ],
        {
          subject: useSceneStore.getState().entities.hero,
          target: useSceneStore.getState().entities.pad,
          allEntities: useSceneStore.getState().entities,
          updateEntityState: store.updateEntityState,
          updateEntityDetails: store.updateEntityDetails,
          deleteEntity: store.deleteEntity,
          spawnEntity: store.spawnEntity,
        }
      );

      const afterUnsnap = useSceneStore.getState().entities.hero;
      expect(afterUnsnap.parentId ?? null).toBeNull();
    });
  });
});
