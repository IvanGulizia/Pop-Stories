import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  Entity,
  FollowBehaviorConfig,
  PatrolBehaviorConfig,
  WanderingBehaviorConfig,
} from '../types';
import {
  ArrivalTrackerState,
  evaluateTargetArrivalEdge,
  FollowJumpRuntimeState,
  resolveLocomotionAndPuppetState,
  stepFollowBehavior,
  stepWanderingBehavior,
  WanderingRuntimeState,
} from '../utils/physics/wanderingAndFollowSolver';
import { PatrolRuntimeState, stepPatrolBehavior } from '../utils/physics/patrolSolver';
import {
  resetMatterPhysicsRuntime,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';
import { useSceneStore } from '../store/useSceneStore';
import { clearTriggerGateState, resetPlaySessionClock } from '../store/triggerGate';
import { executeRuleActions } from '../store/ruleExecutionEngine';

function makeMultiStateEntity(
  id: string,
  stateIds: string[],
  overrides: Partial<Entity> = {}
): Entity {
  const states: Entity['states'] = {};
  stateIds.forEach((sid, idx) => {
    states[sid] = {
      id: sid,
      name: sid,
      color: idx === 0 ? '#3b82f6' : '#10b981',
      scale: 1,
      rotation: 0,
    };
  });
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 200, y: 200 },
    size: { width: 48, height: 48 },
    currentStateId: stateIds[0],
    isDraggable: false,
    states,
    ...overrides,
  };
}

describe('Grounded / Platformer Solvers (Wandering, Patrol Waypoints, Follow + AutoJump)', () => {
  it('handles wandering horizontal mode with gravity preservation, turnOnWall, and detectLedges', () => {
    const config: WanderingBehaviorConfig = {
      id: 'w-horiz',
      type: 'wandering',
      enabled: true,
      mode: 'horizontal',
      radius: 200,
      speed: 120,
      randomness: 50,
      changeInterval: 1.5,
      pauseDuration: 0.4,
      turnOnWall: true,
      detectLedges: true,
    };
    const state: WanderingRuntimeState = {
      origin: { x: 200, y: 200 },
      targetPoint: { x: 350, y: 200 },
      moveTimer: 1.2,
      pauseTimer: 0,
      currentAngle: 0,
    };

    // Moving normally: preserves vertical velocity (gravity)
    const normalStep = stepWanderingBehavior({
      state,
      currentCenter: { x: 200, y: 200 },
      currentVelocity: { x: 0, y: 3.5 },
      config,
      canvasBounds: { width: 800, height: 500 },
      dt: 0.016,
      randomFn: () => 0.5,
    });
    expect(normalStep.preserveVerticalVelocity).toBe(true);
    expect(normalStep.vy).toBe(3.5);
    expect(normalStep.vx).toBeGreaterThan(0);
    expect(normalStep.isMoving).toBe(true);

    // Hitting right wall reverses direction to left
    const wallStep = stepWanderingBehavior({
      state,
      currentCenter: { x: 240, y: 200 },
      currentVelocity: { x: 2, y: 1.2 },
      config,
      canvasBounds: { width: 800, height: 500 },
      dt: 0.016,
      wallHit: { left: false, right: true, up: false, down: false },
      randomFn: () => 0.5,
    });
    expect(wallStep.preserveVerticalVelocity).toBe(true);
    expect(wallStep.targetAngleRad).toBeUndefined();
    expect(state.targetPoint!.x).toBeLessThan(240);

    // Clear cooldown & test ledge detection ahead while moving left
    state.pauseTimer = 0;
    state.ledgeTurnCooldown = 0;
    state.targetPoint = { x: 100, y: 200 };
    const ledgeStep = stepWanderingBehavior({
      state,
      currentCenter: { x: 210, y: 200 },
      currentVelocity: { x: -2, y: 0 },
      config,
      canvasBounds: { width: 800, height: 500 },
      dt: 0.016,
      ledgeAhead: true,
      randomFn: () => 0.5,
    });
    expect(ledgeStep.isMoving).toBe(false);
    expect(state.targetPoint!.x).toBeGreaterThan(210);
  });

  it('handles patrol waypoints in grounded mode by preserving vertical velocity and detecting ledges', () => {
    const wpConfig: PatrolBehaviorConfig = {
      id: 'p-wp-g',
      type: 'patrol',
      enabled: true,
      axis: 'horizontal',
      patrolMode: 'waypoints',
      movementSpace: 'grounded',
      waypointLoopMode: 'ping_pong',
      range: 150,
      speed: 120,
      pauseDuration: 0.2,
      detectLedges: true,
      waypoints: [
        { id: 'w1', mode: 'position', x: 100, y: 400, pauseSec: 0 },
        { id: 'w2', mode: 'position', x: 350, y: 200, pauseSec: 0 }, // Y differs (aerial waypoint)
      ],
    };
    const wpState: PatrolRuntimeState = {
      originCenter: { x: 120, y: 300 },
      direction: 1,
      timer: 0,
      waypointIndex: 1,
      waypointDir: 1,
      wallTurnCooldown: 0,
      ledgeTurnCooldown: 0,
    };

    const stepRes = stepPatrolBehavior({
      state: wpState,
      currentCenter: { x: 120, y: 300 },
      config: wpConfig,
      entities: {},
      dt: 0.016,
    });
    expect(stepRes.preserveVerticalVelocity).toBe(true);
    expect(stepRes.vx).toBe(120);
    expect(stepRes.vy).toBe(0);

    // Ledge ahead triggers waypoint reversal
    const ledgeRes = stepPatrolBehavior({
      state: wpState,
      currentCenter: { x: 200, y: 300 },
      config: wpConfig,
      entities: {},
      dt: 0.016,
      ledgeAhead: true,
    });
    expect(ledgeRes.turned).toBe(true);
    expect(wpState.waypointIndex).toBe(0);
    expect(wpState.waypointDir).toBe(-1);
  });

  it('handles follow in grounded mode (constant_speed & spring) and triggers autoJump on height/wall', () => {
    const config: FollowBehaviorConfig = {
      id: 'f-ground',
      type: 'follow',
      enabled: true,
      targetType: 'entity',
      followMode: 'constant_speed',
      movementSpace: 'grounded',
      speed: 180,
      smoothing: 0.15,
      minDistance: 30,
      autoJump: true,
      jumpForce: 420,
      jumpCooldown: 0.7,
      jumpHeightThreshold: 36,
      jumpOnWall: true,
    };
    const jumpState: FollowJumpRuntimeState = { jumpCooldownTimer: 0 };

    // Target same level -> X pursuit, preserves gravity vy
    const flatStep = stepFollowBehavior({
      currentCenter: { x: 100, y: 300 },
      currentVelocity: { x: 0, y: 2.5 },
      targetCenter: { x: 300, y: 290 },
      config,
      jumpState,
      isGrounded: true,
      dt: 0.016,
    });
    expect(flatStep.preserveVerticalVelocity).toBe(true);
    expect(flatStep.vy).toBe(2.5);
    expect(flatStep.vx).toBeGreaterThan(0);
    expect(flatStep.triggeredJump).toBe(false);

    // Target higher than threshold -> triggers autoJump
    const highStep = stepFollowBehavior({
      currentCenter: { x: 100, y: 300 },
      currentVelocity: { x: 2, y: 0 },
      targetCenter: { x: 250, y: 220 }, // dy = -80 <= -36
      config,
      jumpState,
      isGrounded: true,
      dt: 0.016,
    });
    expect(highStep.triggeredJump).toBe(true);
    expect(highStep.preserveVerticalVelocity).toBe(false);
    expect(highStep.vy).toBeCloseTo(-420 / 60, 4);
    expect(jumpState.jumpCooldownTimer).toBeGreaterThan(0.5);

    // Cooldown prevents immediate double jump even when blocked by wall
    const blockedDuringCd = stepFollowBehavior({
      currentCenter: { x: 100, y: 300 },
      currentVelocity: { x: 0, y: 0 },
      targetCenter: { x: 250, y: 300 },
      config,
      jumpState,
      isGrounded: true,
      wallHit: { left: false, right: true, up: false, down: false },
      dt: 0.016,
    });
    expect(blockedDuringCd.triggeredJump).toBe(false);

    // After cooldown expires, wall ahead triggers jump + spring grounded mode works on X only
    jumpState.jumpCooldownTimer = 0;
    const springConfig: FollowBehaviorConfig = {
      ...config,
      followMode: 'spring',
      springStiffness: 140,
      springDamping: 12,
    };
    const wallJumpSpring = stepFollowBehavior({
      currentCenter: { x: 100, y: 300 },
      currentVelocity: { x: 0, y: 0 },
      targetCenter: { x: 250, y: 300 },
      config: springConfig,
      jumpState,
      isGrounded: true,
      wallHit: { left: false, right: true, up: false, down: false },
      dt: 0.016,
    });
    expect(wallJumpSpring.triggeredJump).toBe(true);
    expect(wallJumpSpring.nextSpringState).toBeDefined();
    expect(wallJumpSpring.vx).toBeGreaterThan(0);
  });
});

describe('Option A Locomotion <-> InteractivePuppet State Coordination & Visual StateBindings', () => {
  beforeEach(() => {
    resetMatterPhysicsRuntime();
  });

  afterEach(() => {
    resetMatterPhysicsRuntime();
  });

  it('respects priority, never clobbers external states, and honors allowInterruptLocomotion', () => {
    const valid = new Set(['idle', 'walk', 'turn', 'hover', 'hurt', 'carry']);

    // External state (e.g. 'carry' or 'hurt') is NEVER overwritten by locomotion or puppet
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'carry',
        validStateIds: valid,
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'hover',
          isActiveInteraction: true,
          allowInterruptLocomotion: true,
        },
        patrol: {
          boundIds: new Set(['idle', 'walk', 'turn']),
          desiredStateId: 'walk',
        },
      })
    ).toBeUndefined();

    // Active puppet interaction interrupts locomotion when allowInterruptLocomotion is true
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'walk',
        validStateIds: valid,
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'hover',
          isActiveInteraction: true,
          allowInterruptLocomotion: true,
        },
        patrol: {
          boundIds: new Set(['idle', 'walk', 'turn']),
          desiredStateId: 'walk',
        },
      })
    ).toBe('hover');

    // When allowInterruptLocomotion is false, active puppet does NOT interrupt patrol walk
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'walk',
        validStateIds: valid,
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'hover',
          isActiveInteraction: true,
          allowInterruptLocomotion: false,
        },
        patrol: {
          boundIds: new Set(['idle', 'walk', 'turn']),
          desiredStateId: 'walk',
        },
      })
    ).toBeUndefined();

    // Idle rest on puppet yields back to locomotion when interaction stops
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'hover',
        validStateIds: valid,
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'idle',
          isActiveInteraction: false,
          allowInterruptLocomotion: true,
        },
        patrol: {
          boundIds: new Set(['idle', 'walk', 'turn']),
          desiredStateId: 'walk',
        },
      })
    ).toBe('walk');

    // Locomotion priority: Keyboard > Flee(scared) > Follow > Patrol > Wandering > Flee(calm)
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'idle',
        validStateIds: new Set(['idle', 'kb_walk', 'flee_run', 'follow_run', 'patrol_walk', 'wander_walk']),
        flee: { boundIds: new Set(['idle', 'flee_run']), desiredStateId: 'flee_run', isScared: true },
        follow: { boundIds: new Set(['idle', 'follow_run']), desiredStateId: 'follow_run' },
        patrol: { boundIds: new Set(['idle', 'patrol_walk']), desiredStateId: 'patrol_walk' },
        wandering: { boundIds: new Set(['idle', 'wander_walk']), desiredStateId: 'wander_walk' },
      })
    ).toBe('flee_run');

    // Calm flee yields to active follow/patrol/wandering
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'idle',
        validStateIds: new Set(['idle', 'flee_run', 'patrol_walk']),
        flee: { boundIds: new Set(['idle', 'flee_run']), desiredStateId: 'idle', isScared: false },
        patrol: { boundIds: new Set(['idle', 'patrol_walk']), desiredStateId: 'patrol_walk' },
      })
    ).toBe('patrol_walk');

    // Snap actif prime sur Marionnette active et Locomotions, mais jamais sur un état externe
    const snapValid = new Set(['idle', 'walk', 'hover', 'snapped', 'pulling', 'unsnapped', 'carry']);
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'hover',
        validStateIds: snapValid,
        snap: { boundIds: new Set(['snapped', 'pulling', 'unsnapped']), desiredStateId: 'snapped', isActive: true },
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'hover',
          isActiveInteraction: true,
          allowInterruptLocomotion: true,
        },
        wandering: { boundIds: new Set(['idle', 'walk']), desiredStateId: 'walk' },
      })
    ).toBe('snapped');

    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'carry',
        validStateIds: snapValid,
        snap: { boundIds: new Set(['snapped', 'pulling', 'unsnapped']), desiredStateId: 'snapped', isActive: true },
      })
    ).toBeUndefined();

    // Au détachement (snap.isActive = false), un état Snap restitue proprement à Marionnette ou Locomotion
    expect(
      resolveLocomotionAndPuppetState({
        currentStateId: 'snapped',
        validStateIds: snapValid,
        snap: { boundIds: new Set(['snapped', 'pulling', 'unsnapped']), desiredStateId: undefined, isActive: false },
        puppet: {
          boundIds: new Set(['idle', 'hover']),
          desiredStateId: 'idle',
          isActiveInteraction: false,
          allowInterruptLocomotion: true,
        },
        wandering: { boundIds: new Set(['idle', 'walk']), desiredStateId: 'walk' },
      })
    ).toBe('walk');
  });

  it('drives patrol turnStateId, wandering stateBindings, and puppet hover override in stepMatterPhysics', () => {
    const patroller = makeMultiStateEntity('pat-1', ['p_idle', 'p_walk', 'p_turn', 'p_hover', 'p_external'], {
      position: { x: 380, y: 450 },
      size: { width: 40, height: 40 },
      behaviors: [
        {
          id: 'b-pat',
          type: 'patrol',
          enabled: true,
          axis: 'horizontal',
          patrolMode: 'symmetric',
          range: 10,
          speed: 200,
          pauseDuration: 0.3,
          stateBindings: {
            idleStateId: 'p_idle',
            moveStateId: 'p_walk',
            turnStateId: 'p_turn',
            turnDuration: 0.2,
          },
        },
        {
          id: 'b-pup',
          type: 'interactive_puppet',
          enabled: true,
          allowInterruptLocomotion: true,
          stateBindings: {
            idleStateId: 'p_idle',
            hoverStateId: 'p_hover',
          },
        },
      ],
    });

    const entities: Record<string, Entity> = { [patroller.id]: patroller };

    // Step 1: starts moving -> p_walk
    const res1 = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    expect(res1.stateChanges?.[patroller.id]).toBe('p_walk');
    entities[patroller.id] = {
      ...entities[patroller.id],
      currentStateId: res1.stateChanges![patroller.id],
      position: res1.updatedTransforms[patroller.id]?.position || entities[patroller.id].position,
    };

    // Step until it hits +10 range -> p_turn
    let sawTurn = false;
    for (let i = 0; i < 15; i++) {
      const r = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (r.updatedTransforms[patroller.id]?.position) {
        entities[patroller.id] = {
          ...entities[patroller.id],
          position: r.updatedTransforms[patroller.id].position!,
        };
      }
      if (r.stateChanges?.[patroller.id]) {
        entities[patroller.id] = {
          ...entities[patroller.id],
          currentStateId: r.stateChanges[patroller.id],
        };
        if (r.stateChanges[patroller.id] === 'p_turn') {
          sawTurn = true;
          break;
        }
      }
    }
    expect(sawTurn).toBe(true);

    // Hovering puppet via mousePos over entity center overrides locomotion state to p_hover
    const hoverTargetPos = {
      x: entities[patroller.id].position.x + entities[patroller.id].size.width / 2,
      y: entities[patroller.id].position.y + entities[patroller.id].size.height / 2,
    };
    const hoverRes = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
      mousePos: hoverTargetPos,
    });
    expect(hoverRes.stateChanges?.[patroller.id]).toBe('p_hover');
    entities[patroller.id] = { ...entities[patroller.id], currentStateId: 'p_external' };
    // External state 'p_external' must remain untouched even while hovering
    const extRes = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
      mousePos: hoverTargetPos,
    });
    expect(extRes.stateChanges?.[patroller.id]).toBeUndefined();
  });

  it('activates follow fallStateId according to minFallHeight', () => {
    const follower = makeMultiStateEntity('fl-fall', ['idle', 'walk', 'jump', 'fall'], {
      position: { x: 100, y: 100 },
      size: { width: 40, height: 40 },
      behaviors: [
        {
          id: 'phys',
          type: 'physics',
          enabled: true,
          gravity: 1200,
          bounce: 0.1,
          friction: 0.5,
          mass: 1,
          freezeRotation: true,
        },
        {
          id: 'fl',
          type: 'follow',
          enabled: true,
          targetType: 'entity',
          targetEntityId: 'target-dot',
          movementSpace: 'grounded',
          speed: 100,
          smoothing: 0.15,
          minDistance: 20,
          stateBindings: {
            idleStateId: 'idle',
            moveStateId: 'walk',
            jumpStateId: 'jump',
            fallStateId: 'fall',
            minFallHeight: 15,
          },
        },
      ],
    });
    const target = makeMultiStateEntity('target-dot', ['idle'], {
      position: { x: 400, y: 420 },
      size: { width: 20, height: 20 },
    });

    const entities: Record<string, Entity> = { [follower.id]: follower, [target.id]: target };
    let sawFall = false;
    for (let i = 0; i < 30; i++) {
      const res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (res.updatedTransforms[follower.id]?.position) {
        entities[follower.id] = {
          ...entities[follower.id],
          position: res.updatedTransforms[follower.id].position!,
        };
      }
      if (res.stateChanges?.[follower.id] === 'fall') {
        sawFall = true;
        break;
      }
    }
    expect(sawFall).toBe(true);
  });
});

describe('Target Arrival Edge Hysteresis & Dog/Ball Fetch Integration', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-21T10:00:00Z'));
    resetMatterPhysicsRuntime();
    clearTriggerGateState();
    resetPlaySessionClock();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    resetMatterPhysicsRuntime();
    useSceneStore.getState().setAppMode('edit');
    vi.useRealTimers();
  });

  it('triggers target_arrived only on rising edge with hysteresis exitMargin', () => {
    const tracker: ArrivalTrackerState = { wasWithinArrival: false };

    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 80, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(false);
    // Enter <= 40 -> true once
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 35, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(true);
    // Still inside -> false
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 38, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(false);
    // Small jitter between 40 and 54 (exitMargin=14) stays latched -> false
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 48, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(false);
    // Re-enter from 48 -> still false because hysteresis did not reset
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 35, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(false);
    // Exit > 54 resets tracker -> next entry fires again
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 65, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(false);
    expect(
      evaluateTargetArrivalEdge({ tracker, distance: 32, arrivalThreshold: 40, exitMargin: 14, hasValidTarget: true })
    ).toBe(true);
  });

  it('simulates Dog fetching Ball via target_arrived, attaching with keepOffset & disableCollisions, returning to Master, and detaching with throw impulse', () => {
    const dog = makeMultiStateEntity('dog', ['fetch_ball', 'return_master', 'happy'], {
      type: 'dog',
      position: { x: 100, y: 400 },
      size: { width: 60, height: 50 },
      behaviors: [
        {
          id: 'fl-dog',
          type: 'follow',
          enabled: true,
          targetType: 'entity',
          targetEntityId: 'ball',
          speed: 300,
          smoothing: 0.2,
          minDistance: 25,
        },
      ],
    });
    const ball = makeMultiStateEntity('ball', ['loose'], {
      type: 'ball',
      position: { x: 145, y: 410 },
      size: { width: 24, height: 24 },
      behaviors: [{ id: 'phys-ball', type: 'physics', enabled: true, gravity: 980, bounce: 0.4, friction: 0.3, mass: 1 }],
    });
    const master = makeMultiStateEntity('master', ['stand'], {
      type: 'master',
      position: { x: 150, y: 400 },
      size: { width: 50, height: 80 },
    });

    useSceneStore.setState({
      entities: { dog, ball, master },
      entityOrder: ['master', 'dog', 'ball'],
      initialGameVariables: { score: 0, fetched: 0, returned: 0 },
    });

    // Rule 1: Dog arrives at Ball -> attach Ball to Dog (keep offset + disable collisions) & switch Dog to return_master
    useSceneStore.getState().addRule({
      name: 'Dog picks up ball',
      enabled: true,
      trigger: {
        type: 'target_arrived',
        subjectMode: 'instance',
        subjectId: 'dog',
        subjectStateId: 'fetch_ball',
        targetMode: 'instance',
        targetId: 'ball',
      },
      actions: [
        {
          id: 'a-attach',
          type: 'attach_to_parent',
          targetMode: 'target',
          parentTargetMode: 'subject',
          attachKeepCurrentOffset: true,
          attachDisableCollisions: true,
        },
        {
          id: 'a-state-ret',
          type: 'change_state',
          targetMode: 'subject',
          targetStateId: 'return_master',
        },
        {
          id: 'a-var-f',
          type: 'set_variable',
          variableName: 'fetched',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    // Rule 2: Dog arrives at Master -> detach Ball with gentle forward-upward toss impulse
    useSceneStore.getState().addRule({
      name: 'Dog drops ball at master',
      enabled: true,
      trigger: {
        type: 'target_arrived',
        subjectMode: 'instance',
        subjectId: 'dog',
        subjectStateId: 'return_master',
        targetMode: 'instance',
        targetId: 'master',
      },
      actions: [
        {
          id: 'a-detach',
          type: 'detach_parent',
          targetMode: 'instance',
          targetId: 'ball',
          detachImpulseSpeed: 280,
          detachImpulseAngle: -45,
        },
        {
          id: 'a-state-happy',
          type: 'change_state',
          targetMode: 'subject',
          targetStateId: 'happy',
        },
        {
          id: 'a-var-r',
          type: 'set_variable',
          variableName: 'returned',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');

    // Tick physics so follow emits arrivedTargetEvents at Ball
    const tickRes = stepMatterPhysics({
      entities: useSceneStore.getState().entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    expect(tickRes.arrivedTargetEvents?.some((ev) => ev.subjectId === 'dog' && ev.targetEntityId === 'ball')).toBe(
      true
    );

    const evBall = tickRes.arrivedTargetEvents!.find((ev) => ev.subjectId === 'dog' && ev.targetEntityId === 'ball')!;
    useSceneStore.getState().triggerTargetArrivedEvent(evBall.subjectId, evBall.targetEntityId, evBall.eventPosition);

    const afterPickup = useSceneStore.getState();
    expect(afterPickup.gameVariables.fetched).toBe(1);
    expect(afterPickup.entities.dog.currentStateId).toBe('return_master');
    expect(afterPickup.entities.ball.parentId).toBe('dog');
    expect(afterPickup.entities.ball.parentOffset?.disableCollisionsWhileAttached).toBe(true);
    // Offset preserved instead of snapping to (0,0)
    expect(Math.hypot(afterPickup.entities.ball.parentOffset!.x, afterPickup.entities.ball.parentOffset!.y)).toBeGreaterThan(
      5
    );

    // Next: Dog arrives at Master (after state cooldown 250ms) -> Ball detaches with impulse queued
    vi.advanceTimersByTime(300);
    useSceneStore.getState().triggerTargetArrivedEvent('dog', 'master', { x: 160, y: 410 });

    const afterDrop = useSceneStore.getState();
    expect(afterDrop.gameVariables.returned).toBe(1);
    expect(afterDrop.entities.dog.currentStateId).toBe('happy');
    expect(afterDrop.entities.ball.parentId).toBeUndefined();

    const startBallPos = { ...afterDrop.entities.ball.position };
    let simEntities = { ...afterDrop.entities };
    for (let i = 0; i < 4; i++) {
      const sRes = stepMatterPhysics({
        entities: simEntities,
        deltaTime: 1 / 60,
        canvasBounds: { width: 800, height: 500 },
      });
      if (sRes.updatedTransforms.ball?.position) {
        simEntities = {
          ...simEntities,
          ball: { ...simEntities.ball, position: sRes.updatedTransforms.ball.position },
        };
      }
    }
    expect(simEntities.ball.position.x).toBeGreaterThan(startBallPos.x + 8);
    expect(simEntities.ball.position.y).toBeLessThan(startBallPos.y - 5);
  });

  it('supports executeRuleActions attachKeepCurrentOffset directly', () => {
    const parent = makeMultiStateEntity('p', ['idle'], { position: { x: 100, y: 100 }, size: { width: 100, height: 100 } });
    const child = makeMultiStateEntity('c', ['idle'], { position: { x: 200, y: 140 }, size: { width: 40, height: 40 } });
    const allEntities = { p: parent, c: child };
    const setEntityParentSpy = vi.fn();
    useSceneStore.setState({ entities: allEntities, entityOrder: ['p', 'c'] });
    const origSetParent = useSceneStore.getState().setEntityParent;
    useSceneStore.setState({ setEntityParent: setEntityParentSpy });

    executeRuleActions(
      [
        {
          id: 'act-att',
          type: 'attach_to_parent',
          targetMode: 'subject',
          parentTargetMode: 'target',
          attachKeepCurrentOffset: true,
          attachDisableCollisions: true,
        },
      ],
      {
        subject: child,
        target: parent,
        allEntities,
        updateEntityState: () => {},
        updateEntityDetails: () => {},
        deleteEntity: () => {},
        spawnEntity: () => undefined,
      }
    );

    expect(setEntityParentSpy).toHaveBeenCalledTimes(1);
    const [, calledParentId, calledOffset] = setEntityParentSpy.mock.calls[0];
    expect(calledParentId).toBe('p');
    expect(calledOffset.disableCollisionsWhileAttached).toBe(true);
    expect(calledOffset.x).toBeCloseTo(70, 1); // child center 220 - parent center 150
    expect(calledOffset.y).toBeCloseTo(10, 1); // child center 160 - parent center 150

    useSceneStore.setState({ setEntityParent: origSetParent });
  });
});
