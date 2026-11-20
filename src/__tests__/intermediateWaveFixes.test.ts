import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSceneStore } from '../store/useSceneStore';
import { initialSceneLayerGroups } from '../store/storeDefaults';
import { clearTriggerGateState, resetPlaySessionClock } from '../store/triggerGate';
import {
  checkDirectionalCollisionSide,
  computeDirectionalCollisionSide,
  matchesCollisionSide,
  shouldIgnoreOneWayCollision,
} from '../store/collisionHelpers';
import {
  detectLedgeAheadFromSolids,
  PatrolRuntimeState,
  resolvePatrolWaypoints,
  stepPatrolBehavior,
} from '../utils/physics/patrolSolver';
import {
  computeRotateDragOutputs,
  createRotateDragGrabState,
  getRotateDragBounds,
  stepRotateDragPhysics,
  updateRotateDragPointerTarget,
} from '../utils/physics/rotateDragSolver';
import {
  initPlayCameraRuntime,
  resetPlayCameraRuntime,
  stepPlayCameraRuntime,
} from '../utils/cameraRuntime';
import {
  captureStageSnapshot,
  clearAllTransitionSnapshots,
  getTransitionSnapshot,
  releaseTransitionSnapshot,
} from '../utils/transitionSnapshotCache';
import {
  Entity,
  PatrolBehaviorConfig,
  RotateDragBehaviorConfig,
  SceneTransitionType,
} from '../types';

function makeTestEntity(id: string, type = 'hero', x = 100, y = 100, w = 60, h = 60): Entity {
  return {
    id,
    name: `Entity ${id}`,
    type,
    position: { x, y },
    size: { width: w, height: h },
    currentStateId: 'idle',
    isDraggable: false,
    states: {
      idle: { id: 'idle', name: 'Repos', color: '#3b82f6', scale: 1, rotation: 0 },
    },
  };
}

describe('Patrol 2.0 Solver', () => {
  it('enforces symmetric [-range, +range] and one_way_return [0, +range] bounds accurately', () => {
    const symConfig: PatrolBehaviorConfig = {
      id: 'pat-sym',
      type: 'patrol',
      enabled: true,
      axis: 'horizontal',
      patrolMode: 'symmetric',
      range: 100,
      speed: 120,
      pauseDuration: 0.25,
      pauseAtEnds: 0.25,
    };
    const symState: PatrolRuntimeState = {
      originCenter: { x: 300, y: 200 },
      direction: 1,
      timer: 0,
      waypointIndex: 0,
      waypointDir: 1,
      wallTurnCooldown: 0,
      ledgeTurnCooldown: 0,
    };

    // Hits +100 right bound -> reverses to -1
    const hitRight = stepPatrolBehavior({
      state: symState,
      currentCenter: { x: 400, y: 200 },
      config: symConfig,
      entities: {},
      dt: 0.016,
    });
    expect(hitRight.turned).toBe(true);
    expect(symState.direction).toBe(-1);

    // Wait out pause
    symState.timer = 0;

    // Passes origin (300) without turning early in symmetric mode
    const atOrigin = stepPatrolBehavior({
      state: symState,
      currentCenter: { x: 300, y: 200 },
      config: symConfig,
      entities: {},
      dt: 0.016,
    });
    expect(atOrigin.turned).toBe(false);
    expect(atOrigin.vx).toBe(-120);

    // Hits -100 left bound -> reverses to +1
    const hitLeft = stepPatrolBehavior({
      state: symState,
      currentCenter: { x: 200, y: 200 },
      config: symConfig,
      entities: {},
      dt: 0.016,
    });
    expect(hitLeft.turned).toBe(true);
    expect(symState.direction).toBe(1);

    // One-way return mode clamps left edge at origin (0 offset)
    const oneWayConfig: PatrolBehaviorConfig = {
      ...symConfig,
      patrolMode: 'one_way_return',
    };
    const oneWayState: PatrolRuntimeState = {
      ...symState,
      direction: -1,
      timer: 0,
    };
    const backAtOrigin = stepPatrolBehavior({
      state: oneWayState,
      currentCenter: { x: 300, y: 200 },
      config: oneWayConfig,
      entities: {},
      dt: 0.016,
    });
    expect(backAtOrigin.turned).toBe(true);
    expect(oneWayState.direction).toBe(1);
  });

  it('resolves position & entity waypoints and advances ping_pong vs loop paths', () => {
    const marker = makeTestEntity('wp-marker', 'marker', 500, 300, 40, 40);
    const entities = { [marker.id]: marker };

    const wpConfig: PatrolBehaviorConfig = {
      id: 'pat-wp',
      type: 'patrol',
      enabled: true,
      axis: 'horizontal',
      patrolMode: 'waypoints',
      waypointLoopMode: 'ping_pong',
      range: 200,
      speed: 200,
      pauseDuration: 0,
      pauseAtEnds: 0,
      waypoints: [
        { id: 'w1', mode: 'position', x: 100, y: 100, pauseSec: 0 },
        { id: 'w2', mode: 'position', x: 300, y: 100, pauseSec: 0 },
        { id: 'w3', mode: 'entity', entityId: marker.id, x: 0, y: 0, pauseSec: 0 },
      ],
    };

    const resolved = resolvePatrolWaypoints({ x: 0, y: 0 }, wpConfig, entities);
    expect(resolved).toHaveLength(3);
    expect(resolved[2]).toEqual({ x: 520, y: 320, pauseSec: 0 });

    const wpState: PatrolRuntimeState = {
      originCenter: { x: 100, y: 100 },
      direction: 1,
      timer: 0,
      waypointIndex: 0,
      waypointDir: 1,
      wallTurnCooldown: 0,
      ledgeTurnCooldown: 0,
    };

    // Arrive at wp 0 -> advances to 1
    stepPatrolBehavior({ state: wpState, currentCenter: { x: 100, y: 100 }, config: wpConfig, entities, dt: 0.016 });
    expect(wpState.waypointIndex).toBe(1);
    // Arrive at wp 1 -> advances to 2
    stepPatrolBehavior({ state: wpState, currentCenter: { x: 300, y: 100 }, config: wpConfig, entities, dt: 0.016 });
    expect(wpState.waypointIndex).toBe(2);
    // Arrive at wp 2 -> ping_pong reverses back to 1
    stepPatrolBehavior({ state: wpState, currentCenter: { x: 520, y: 320 }, config: wpConfig, entities, dt: 0.016 });
    expect(wpState.waypointIndex).toBe(1);
    expect(wpState.waypointDir).toBe(-1);

    // Loop mode wraps from 2 back to 0
    const loopConfig: PatrolBehaviorConfig = { ...wpConfig, waypointLoopMode: 'loop' };
    wpState.waypointIndex = 2;
    wpState.timer = 0;
    stepPatrolBehavior({ state: wpState, currentCenter: { x: 520, y: 320 }, config: loopConfig, entities, dt: 0.016 });
    expect(wpState.waypointIndex).toBe(0);
  });

  it('turns on wall impact and detects platform ledges only when grounded', () => {
    const config: PatrolBehaviorConfig = {
      id: 'pat-wall-ledge',
      type: 'patrol',
      enabled: true,
      axis: 'horizontal',
      patrolMode: 'symmetric',
      range: 300,
      speed: 100,
      turnOnWall: true,
      detectLedges: true,
      pauseDuration: 0.2,
      pauseAtEnds: 0.2,
    };
    const state: PatrolRuntimeState = {
      originCenter: { x: 200, y: 200 },
      direction: 1,
      timer: 0,
      waypointIndex: 0,
      waypointDir: 1,
      wallTurnCooldown: 0,
      ledgeTurnCooldown: 0,
    };

    const wallTurn = stepPatrolBehavior({
      state,
      currentCenter: { x: 230, y: 200 },
      config,
      entities: {},
      dt: 0.016,
      wallHit: { left: false, right: true, up: false, down: false },
    });
    expect(wallTurn.turned).toBe(true);
    expect(state.direction).toBe(-1);

    // Ledge detector checks solidRects ahead
    const solidFloor = [{ x: 100, y: 240, width: 200, height: 24 }];
    // Entity standing near right edge (x: 264..304, centerX=284, footY=240): leadX=310 is past floor right=300 -> ledge!
    expect(
      detectLedgeAheadFromSolids({
        bounds: { x: 264, y: 200, width: 40, height: 40, centerX: 284, centerY: 220, colliderType: 'box', radius: 20 },
        dirX: 1,
        checkDepth: 28,
        solidRects: solidFloor,
      })
    ).toBe(true);

    // Moving left toward center of platform -> solid floor ahead -> false
    expect(
      detectLedgeAheadFromSolids({
        bounds: { x: 256, y: 200, width: 40, height: 40, centerX: 276, centerY: 220, colliderType: 'box', radius: 20 },
        dirX: -1,
        checkDepth: 28,
        solidRects: solidFloor,
      })
    ).toBe(false);

    // Mid-air entity (y=120, footY=160) has no under-support -> never falsely flagged as ledge
    expect(
      detectLedgeAheadFromSolids({
        bounds: { x: 256, y: 120, width: 40, height: 40, centerX: 276, centerY: 140, colliderType: 'box', radius: 20 },
        dirX: 1,
        checkDepth: 28,
        solidRects: solidFloor,
      })
    ).toBe(false);
  });
});

describe('Rotate Drag Solver', () => {
  it('handles unwrapped circular multi-turn angles and linear_x/linear_y gestures', () => {
    const config: RotateDragBehaviorConfig = {
      id: 'rd-1',
      type: 'rotate_drag',
      enabled: true,
      gestureMode: 'circular',
      dragMode: 'direct',
      limitRange: false,
      sensitivity: 1,
    };
    const pivot = { x: 200, y: 200 };
    const state = createRotateDragGrabState({
      currentAngleDeg: 0,
      baseAngleDeg: 0,
      pivotWorld: pivot,
      pointerWorld: { x: 260, y: 200 }, // 0°
      config,
    });

    // Sweep clockwise across +180° seam -> accumulates > 180° continuously without wrap glitch
    updateRotateDragPointerTarget(state, { x: 200, y: 260 }, pivot, config); // +90°
    updateRotateDragPointerTarget(state, { x: 140, y: 200 }, pivot, config); // +180°
    updateRotateDragPointerTarget(state, { x: 200, y: 140 }, pivot, config); // +270°
    expect(state.targetAngleDeg).toBeCloseTo(270, 1);

    // Linear X gesture
    const linXConfig: RotateDragBehaviorConfig = { ...config, gestureMode: 'linear_x', sensitivity: 0.5 };
    const linState = createRotateDragGrabState({
      currentAngleDeg: 10,
      baseAngleDeg: 0,
      pivotWorld: pivot,
      pointerWorld: { x: 200, y: 200 },
      config: linXConfig,
    });
    updateRotateDragPointerTarget(linState, { x: 280, y: 200 }, pivot, linXConfig);
    expect(linState.targetAngleDeg).toBeCloseTo(50, 1);

    // Linear Y gesture (dragging up increases angle)
    const linYConfig: RotateDragBehaviorConfig = { ...config, gestureMode: 'linear_y', sensitivity: 1 };
    updateRotateDragPointerTarget(linState, { x: 200, y: 160 }, pivot, linYConfig);
    expect(linState.targetAngleDeg).toBeCloseTo(50, 1);
  });

  it('supports min/max angle bounds, strict/magnetic steps, spring_return, and variable outputs', () => {
    const config: RotateDragBehaviorConfig = {
      id: 'rd-bounds',
      type: 'rotate_drag',
      enabled: true,
      gestureMode: 'linear_x',
      dragMode: 'direct',
      limitRange: true,
      minAngle: -90,
      maxAngle: 90,
      steps: 5, // -90, -45, 0, +45, +90
      stepMode: 'strict',
      returnMode: 'spring_return',
      restAngle: 0,
      outputAngleVariable: 'dial_deg',
      outputNormalizedVariable: 'dial_val',
      outputStepVariable: 'dial_step',
      outputMin: 0,
      outputMax: 100,
    };

    expect(getRotateDragBounds(config)).toEqual({ limitRange: true, minAngle: -90, maxAngle: 90 });

    const state = createRotateDragGrabState({
      currentAngleDeg: 0,
      baseAngleDeg: 0,
      pivotWorld: { x: 100, y: 100 },
      pointerWorld: { x: 100, y: 100 },
      config,
    });

    // Target 140° clamps to maxAngle 90° and strict-snaps to step index 4 (100 mapped)
    state.targetAngleDeg = 140;
    const stepRes = stepRotateDragPhysics({ state, config, dt: 0.016 });
    expect(stepRes.angleDeg).toBe(90);
    expect(stepRes.outputs.stepIndex).toBe(4);
    expect(stepRes.outputs.mappedValue).toBe(100);
    expect(stepRes.outputs.updates).toEqual({
      dial_deg: 90,
      dial_val: 100,
      dial_step: 4,
    });

    // Release -> spring_return pulls angle back toward 0 in magnetic mode
    const magConfig: RotateDragBehaviorConfig = { ...config, stepMode: 'magnetic', steps: 0 };
    state.isGrabbed = false;
    for (let i = 0; i < 40; i++) {
      stepRotateDragPhysics({ state, config: magConfig, dt: 0.02 });
    }
    expect(Math.abs(state.angleDeg)).toBeLessThan(15);

    const outMid = computeRotateDragOutputs(0, config);
    expect(outMid.normalized).toBe(0.5);
    expect(outMid.mappedValue).toBe(50);
    expect(outMid.stepIndex).toBe(2);
  });
});

describe('Directional Square Collisions & One-Way Platforms', () => {
  it('detects top/bottom/left/right sides symmetrically for subject vs target', () => {
    const mario = { x: 100, y: 65, width: 40, height: 40, centerX: 120, centerY: 85 };
    const goomba = { x: 98, y: 100, width: 44, height: 40, centerX: 120, centerY: 120 };

    // From Mario's perspective, Mario hits Goomba with Mario's bottom
    const sideOnMario = computeDirectionalCollisionSide(mario, goomba);
    expect(sideOnMario).toBe('bottom');
    expect(matchesCollisionSide(sideOnMario, 'bottom')).toBe(true);
    expect(matchesCollisionSide(sideOnMario, 'vertical')).toBe(true);
    expect(matchesCollisionSide(sideOnMario, 'horizontal')).toBe(false);

    // From Goomba's perspective, Goomba is hit on its top
    const sideOnGoomba = computeDirectionalCollisionSide(goomba, mario);
    expect(sideOnGoomba).toBe('top');

    // Entity helper check with subject vs target perspective
    const eMario = makeTestEntity('mario', 'player', 100, 65, 40, 40);
    const eGoomba = makeTestEntity('goomba', 'enemy', 98, 100, 44, 40);
    expect(
      checkDirectionalCollisionSide({
        subject: eMario,
        target: eGoomba,
        sideFilter: 'bottom',
        sideTarget: 'subject',
      })
    ).toBe(true);
    expect(
      checkDirectionalCollisionSide({
        subject: eMario,
        target: eGoomba,
        sideFilter: 'top',
        sideTarget: 'target',
      })
    ).toBe(true);
    // Lateral contact check
    const eWall = makeTestEntity('wall', 'wall', 138, 65, 40, 40);
    expect(
      checkDirectionalCollisionSide({
        subject: eMario,
        target: eWall,
        sideFilter: 'right',
        sideTarget: 'subject',
      })
    ).toBe(true);
  });

  it('ignores one-way platform collisions while rising or entering from below, solid from above', () => {
    const platformBounds = { x: 100, y: 200, width: 160, height: 20 };

    // Jumping upward through platform -> ignored
    expect(
      shouldIgnoreOneWayCollision({
        entityBounds: { x: 140, y: 195, width: 32, height: 40 },
        platformBounds,
        entityVy: -150,
      })
    ).toBe(true);

    // Inside platform from below (feet at 230 > 210) -> ignored
    expect(
      shouldIgnoreOneWayCollision({
        entityBounds: { x: 140, y: 190, width: 32, height: 40 },
        platformBounds,
        entityVy: 0,
      })
    ).toBe(true);

    // Falling onto top surface (feet at 204 <= 210, vy >= 0) -> solid!
    expect(
      shouldIgnoreOneWayCollision({
        entityBounds: { x: 140, y: 164, width: 32, height: 40 },
        platformBounds,
        entityVy: 80,
      })
    ).toBe(false);
  });
});

describe('Store Wave Features: BoundarySpace, KeyCode, CameraFollow, Push Transitions, Clean Names & Collapsed Layers', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    clearTriggerGateState();
    resetPlaySessionClock();
    resetPlayCameraRuntime();
    clearAllTransitionSnapshots();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    useSceneStore.getState().setAppMode('edit');
    vi.useRealTimers();
  });

  it('evaluates boundarySpace viewport separately from extended world bounds', () => {
    const hero = makeTestEntity('hero-b', 'hero', 200, 150, 50, 50);
    useSceneStore.setState({
      entities: { [hero.id]: hero },
      entityOrder: [hero.id],
      sceneBounds: { width: 800, height: 500 },
      initialGameVariables: { score: 0, vpHit: 0, worldHit: 0 },
    });

    useSceneStore.getState().updateSceneCamera({
      worldMode: 'custom',
      worldWidth: 2000,
      worldHeight: 1000,
      initialX: 400, // Visible viewport spans x: [400, 1200]
      initialY: 0,
    });

    useSceneStore.getState().addRule({
      name: 'Viewport left edge rule',
      enabled: true,
      trigger: {
        type: 'boundary',
        boundarySpace: 'viewport',
        boundaryEdge: 'left',
        subjectMode: 'instance',
        subjectId: hero.id,
      },
      actions: [
        { id: 'a-vp', type: 'set_variable', variableName: 'vpHit', variableOperation: 'add', variableValue: 1 },
      ],
    });

    useSceneStore.getState().addRule({
      name: 'World left edge rule',
      enabled: true,
      trigger: {
        type: 'boundary',
        boundarySpace: 'world',
        boundaryEdge: 'left',
        subjectMode: 'instance',
        subjectId: hero.id,
      },
      actions: [
        { id: 'a-wd', type: 'set_variable', variableName: 'worldHit', variableOperation: 'add', variableValue: 1 },
      ],
    });

    useSceneStore.getState().setAppMode('play');
    initPlayCameraRuntime(useSceneStore.getState().camera, { width: 800, height: 500 }, useSceneStore.getState().entities);
    stepPlayCameraRuntime(0.016, useSceneStore.getState().entities, { width: 800, height: 500 }, useSceneStore.getState().camera);

    // At x=395: touches left edge of shifted viewport (x=400), NOT world left edge (x=0)
    useSceneStore.getState().evaluateRulesWithTemp({ [hero.id]: { x: 395, y: 150 } });
    expect(useSceneStore.getState().gameVariables.vpHit).toBe(1);
    expect(useSceneStore.getState().gameVariables.worldHit).toBe(0);

    // At x=-5: inset collider starts at wb.x=0, touching the left world edge
    useSceneStore.getState().evaluateRulesWithTemp({ [hero.id]: { x: -5, y: 150 } });
    expect(useSceneStore.getState().gameVariables.worldHit).toBe(1);
  });

  it('matches keyboard triggers using physical keyCode as well as keyName', () => {
    const hero = makeTestEntity('hero-kb', 'hero', 100, 100);
    useSceneStore.setState({
      entities: { [hero.id]: hero },
      entityOrder: [hero.id],
      initialGameVariables: { score: 0, fired: 0 },
    });

    useSceneStore.getState().addRule({
      name: 'AZERTY keyCode Digit1 rule',
      enabled: true,
      trigger: {
        type: 'keyboard',
        keyName: '&',
        keyCode: 'Digit1',
        phase: 'down',
        subjectMode: 'instance',
        subjectId: hero.id,
      },
      actions: [
        { id: 'a-kb', type: 'set_variable', variableName: 'fired', variableOperation: 'add', variableValue: 1 },
      ],
    });

    useSceneStore.getState().setAppMode('play');
    // User sends QWERTY '1' label with physical 'Digit1' keyCode -> matches via keyCode!
    useSceneStore.getState().triggerKeyEvent('1', 'down', 'Digit1');
    expect(useSceneStore.getState().gameVariables.fired).toBe(1);
  });

  it('fires subject-filtered camera_follow events via triggerCameraFollowEvent', () => {
    const boss = makeTestEntity('boss-1', 'boss', 500, 200);
    const npc = makeTestEntity('npc-1', 'npc', 200, 200);
    useSceneStore.setState({
      entities: { [boss.id]: boss, [npc.id]: npc },
      entityOrder: [boss.id, npc.id],
      initialGameVariables: { score: 0, camTriggerCount: 0 },
    });

    useSceneStore.getState().addRule({
      name: 'Camera follows boss',
      enabled: true,
      trigger: {
        type: 'camera_follow',
        subjectMode: 'instance',
        subjectId: boss.id,
      },
      actions: [
        { id: 'a-cf', type: 'set_variable', variableName: 'camTriggerCount', variableOperation: 'add', variableValue: 1 },
      ],
    });

    useSceneStore.getState().setAppMode('play');
    useSceneStore.getState().triggerCameraFollowEvent(npc.id);
    expect(useSceneStore.getState().gameVariables.camTriggerCount).toBe(0);

    useSceneStore.getState().triggerCameraFollowEvent(boss.id);
    expect(useSceneStore.getState().gameVariables.camTriggerCount).toBe(1);
  });

  it('executes push_left/right/up/down transitions and manages DOM snapshot cache cleanly', () => {
    const cloneEl = {
      removeAttribute: vi.fn(),
      style: { pointerEvents: '', transform: '', transition: '' },
      querySelectorAll: vi.fn(() => []),
    };
    const stageEl = {
      getBoundingClientRect: () => ({ width: 800, height: 500 }),
      cloneNode: () => cloneEl,
    };
    vi.stubGlobal('document', {
      getElementById: (id: string) => (id === 'scene-stage-capture' ? stageEl : null),
    });

    const s2 = useSceneStore.getState().createScene('Niveau Push');
    useSceneStore.getState().switchScene('scene-1');
    useSceneStore.getState().setAppMode('play');

    const pushTypes: SceneTransitionType[] = ['push_left', 'push_right', 'push_up', 'push_down'];
    for (const pType of pushTypes) {
      const target = useSceneStore.getState().activeSceneId === 'scene-1' ? s2 : 'scene-1';
      useSceneStore.getState().changeSceneInPlay(target, pType, 0.3);

      const trans = useSceneStore.getState().activeSceneTransition;
      expect(trans?.type).toBe(pType);
      expect(trans?.phase).toBe('in');
      expect(trans?.outgoingSnapshotKey).toBe(trans?.id);
      expect(useSceneStore.getState().activeSceneId).toBe(target);
      expect(getTransitionSnapshot(trans!.id)).toBeDefined();

      vi.advanceTimersByTime(320);
      expect(useSceneStore.getState().activeSceneTransition).toBeNull();
      expect(getTransitionSnapshot(trans!.id)).toBeUndefined();
    }

    // Direct helper verification
    expect(captureStageSnapshot('manual-snap', '#123456')).toBe(true);
    expect(getTransitionSnapshot('manual-snap')?.backgroundColor).toBe('#123456');
    releaseTransitionSnapshot('manual-snap');
    expect(getTransitionSnapshot('manual-snap')).toBeUndefined();
  });

  it('initializes layer groups collapsed by default and creates clean entity names without #N suffixes', () => {
    expect(initialSceneLayerGroups.every((g) => g.isCollapsed === true)).toBe(true);
    expect(initialSceneLayerGroups.map((g) => g.kind)).toEqual(['background', 'collider', 'foreground']);

    useSceneStore.getState().addEntity('apple');
    useSceneStore.getState().addEntity('apple');
    const apples = Object.values(useSceneStore.getState().entities).filter((e) => e.type === 'apple');
    for (const a of apples) {
      expect(a.name).not.toMatch(/#\d+/);
    }
  });
});
