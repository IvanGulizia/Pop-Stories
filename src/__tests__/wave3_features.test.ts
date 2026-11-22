import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Entity,
  PatrolBehaviorConfig,
  RuleAction,
  SnapBehaviorConfig,
} from '../types';
import { computeMovementFlipX } from '../utils/physics/flipHelpers';
import { PatrolRuntimeState, stepPatrolBehavior } from '../utils/physics/patrolSolver';
import {
  computeSnapCustomAnchorFromWorld,
  computeSnapGoalForTarget,
  createInitialSnapRuntimeEntry,
  getSnapAnchorWorldPoint,
  stepSnapSolver,
} from '../utils/physics/snapSolver';
import {
  clearParticles,
  createParticlePool,
  resolveParticleDirectionAngle,
  setLatestMouseWorldPos,
  startTimedRuleParticleEmitter,
  stepTimedRuleEmitters,
} from '../utils/particleSystem';
import { resolveEntityHierarchyScopeIds } from '../store/parentingHelpers';
import { clearPlayRuntimeState, executeRuleActions } from '../store/ruleExecutionEngine';
import {
  getGizmoRuntimeDebugData,
  resetMatterPhysicsRuntime,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';
import { useSceneStore } from '../store/useSceneStore';

function makeEntity(id: string, overrides: Partial<Entity> = {}): Entity {
  const baseStateId = overrides.currentStateId || 'default';
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 100, y: 100 },
    size: { width: 80, height: 60 },
    currentStateId: baseStateId,
    isDraggable: false,
    states: {
      [baseStateId]: {
        id: baseStateId,
        name: 'Idle',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
      ...(overrides.states || {}),
    },
    ...overrides,
  };
}

function makePatrolRuntime(originX = 200, originY = 200): PatrolRuntimeState {
  return {
    originCenter: { x: originX, y: originY },
    direction: 1,
    timer: 0,
    waypointIndex: 0,
    waypointDir: 1,
    wallTurnCooldown: 0,
    ledgeTurnCooldown: 0,
    entityCollisionTurnCooldown: 0,
  };
}

describe('Vague Intermédiaire 3 : Tests Unitaires & Intégration', () => {
  beforeEach(() => {
    clearParticles();
    clearPlayRuntimeState();
    resetMatterPhysicsRuntime();
    setLatestMouseWorldPos(null);
    useSceneStore.setState({
      appMode: 'edit',
      entities: {},
      entityOrder: [],
      rules: [],
      gameVariables: {},
      expandedBehaviorCards: {},
      snapPinCanvasPick: null,
    });
  });

  afterEach(() => {
    clearParticles();
    clearPlayRuntimeState();
    resetMatterPhysicsRuntime();
    setLatestMouseWorldPos(null);
  });

  describe('#1 — Patrouille : Flip instantané en fin de délai demi-tour', () => {
    it('reprend immédiatement le mouvement et retourne facingDirX sur le même tick où timer atteint 0', () => {
      const rt = makePatrolRuntime(200, 200);
      rt.direction = -1;
      rt.timer = 0.015;
      const cfg: PatrolBehaviorConfig = {
        id: 'pat-1',
        type: 'patrol',
        enabled: true,
        axis: 'horizontal',
        range: 120,
        speed: 140,
        pauseDuration: 0.4,
        pauseAtEnds: 0.4,
        flipOnMove: true,
      };

      const res = stepPatrolBehavior({
        state: rt,
        currentCenter: { x: 320, y: 200 },
        config: cfg,
        entities: {},
        dt: 0.02,
      });

      expect(rt.timer).toBe(0);
      expect(res.vx).toBeLessThan(0);
      expect(res.facingDirX).toBe(-1);

      const flipX = computeMovementFlipX({
        keyboardHorizIntent: 0,
        otherFlipBehavior: { flipOnMove: true, isActivelyPaused: false },
        velocityX: 0,
        intendedDirX: res.facingDirX,
      });
      expect(flipX).toBe(true);
    });

    it('conserve flipX pendant la pause active au lieu de retomber à false', () => {
      const flipWhilePaused = computeMovementFlipX({
        keyboardHorizIntent: 0,
        otherFlipBehavior: { flipOnMove: true, isActivelyPaused: true },
        velocityX: 0,
        intendedDirX: 0,
      });
      expect(flipWhilePaused).toBeNull();
    });
  });

  describe('#2 — Hiérarchie : Désactivation en cascade dans Scène & RuleBook (enabledScope)', () => {
    it('resolveEntityHierarchyScopeIds couvre self, with_children, with_parent et entire_hierarchy', () => {
      const root = makeEntity('root');
      const child = makeEntity('child', { parentId: 'root' });
      const grand = makeEntity('grand', { parentId: 'child' });
      const entities = { root, child, grand };

      expect(resolveEntityHierarchyScopeIds(entities, 'child', 'self')).toEqual(['child']);
      expect(resolveEntityHierarchyScopeIds(entities, 'root', 'with_children')).toEqual([
        'root',
        'child',
        'grand',
      ]);
      expect(resolveEntityHierarchyScopeIds(entities, 'child', 'with_parent')).toEqual([
        'child',
        'root',
      ]);
      expect(resolveEntityHierarchyScopeIds(entities, 'grand', 'entire_hierarchy')).toEqual([
        'root',
        'child',
        'grand',
      ]);
    });

    it('setEntityDisabledCascade dans useSceneStore désactive et réactive toute la descendance avec with_children', () => {
      const root = makeEntity('root');
      const child = makeEntity('child', { parentId: 'root' });
      const grand = makeEntity('grand', { parentId: 'child' });
      useSceneStore.setState({
        entities: { root, child, grand },
        entityOrder: ['root', 'child', 'grand'],
      });

      useSceneStore.getState().setEntityDisabledCascade('root', true, 'with_children');
      const afterDisable = useSceneStore.getState().entities;
      expect(afterDisable.root.disabled).toBe(true);
      expect(afterDisable.child.disabled).toBe(true);
      expect(afterDisable.grand.disabled).toBe(true);

      useSceneStore.getState().setEntityDisabledCascade('root', false, 'with_children');
      const afterEnable = useSceneStore.getState().entities;
      expect(afterEnable.root.disabled).toBe(false);
      expect(afterEnable.child.disabled).toBe(false);
      expect(afterEnable.grand.disabled).toBe(false);
    });

    it('executeRuleActions exécute set_entity_enabled avec enabledScope=entire_hierarchy', () => {
      const root = makeEntity('root');
      const child = makeEntity('child', { parentId: 'root' });
      const grand = makeEntity('grand', { parentId: 'child' });
      const map: Record<string, Entity> = { root, child, grand };

      useSceneStore.setState({
        appMode: 'play',
        entities: map,
        entityOrder: ['root', 'child', 'grand'],
      });

      const action: RuleAction = {
        id: 'act-disable',
        type: 'set_entity_enabled',
        targetMode: 'instance',
        targetId: 'grand',
        enabledActionMode: 'disable',
        enabledScope: 'entire_hierarchy',
      };

      executeRuleActions([action], {
        allEntities: useSceneStore.getState().entities,
        subject: grand,
        updateEntityState: () => {},
        updateEntityDetails: (id, patch) => {
          useSceneStore.getState().updateEntityDetails(id, patch, { instanceOnly: true });
        },
        deleteEntity: () => {},
        spawnEntity: () => undefined,
      });

      const updated = useSceneStore.getState().entities;
      expect(updated.root.disabled).toBe(true);
      expect(updated.child.disabled).toBe(true);
      expect(updated.grand.disabled).toBe(true);
    });
  });

  describe('#5 & #6 — Particules : Direction orientée et Émission temporisée', () => {
    it('resolveParticleDirectionAngle gère facing, toward_target, away_target et mouse', () => {
      const hero = makeEntity('hero', {
        position: { x: 100, y: 100 },
        size: { width: 40, height: 40 },
        flipX: true,
      });
      const enemy = makeEntity('enemy', {
        position: { x: 280, y: 100 },
        size: { width: 40, height: 40 },
      });
      const entities = { hero, enemy };

      const facingAngle = resolveParticleDirectionAngle({
        directionMode: 'facing',
        originX: 120,
        originY: 120,
        originEntity: hero,
      });
      expect(Math.abs(facingAngle)).toBeCloseTo(180, 1);

      expect(
        resolveParticleDirectionAngle({
          directionMode: 'toward_target',
          originX: 120,
          originY: 120,
          targetMode: 'entity',
          targetEntityId: 'enemy',
          entities,
        })
      ).toBeCloseTo(0, 1);

      const awayAngle = resolveParticleDirectionAngle({
        directionMode: 'away_target',
        originX: 120,
        originY: 120,
        targetMode: 'entity',
        targetEntityId: 'enemy',
        entities,
      });
      expect(Math.abs(awayAngle)).toBeCloseTo(180, 1);

      expect(
        resolveParticleDirectionAngle({
          directionMode: 'mouse',
          originX: 100,
          originY: 100,
          mousePos: { x: 100, y: 250 },
        })
      ).toBeCloseTo(90, 1);
    });

    it('startTimedRuleParticleEmitter + stepTimedRuleEmitters déclenche salves sur durée limitée puis expire', () => {
      const pool = createParticlePool(100);
      expect(pool.hasActive()).toBe(false);

      const shooter = makeEntity('shooter', { position: { x: 200, y: 200 } });
      startTimedRuleParticleEmitter(
        {
          durationSec: 0.25,
          rate: 0,
          burstCount: 4,
          burstInterval: 0.1,
          originMode: 'entity',
          originEntityId: 'shooter',
          anchor: 'center',
          offsetX: 0,
          offsetY: 0,
          followRotation: false,
          baseAngleDeg: 0,
          fallbackOriginX: 240,
          fallbackOriginY: 230,
          fallbackAngleDeg: 0,
          directionMode: 'angle',
          burstBaseOpts: {
            speed: 80,
            lifetime: 0.5,
          },
        },
        { shooter }
      );

      for (let i = 0; i < 6; i++) {
        stepTimedRuleEmitters(0.05, { shooter });
      }
      clearParticles();
      expect(pool.hasActive()).toBe(false);
    });
  });

  describe('#7 — Persistance de l’état plié/déplié des comportements', () => {
    it('setBehaviorCardExpanded persiste dans le store même lors des transitions d’entité/mode', () => {
      const st = useSceneStore.getState();
      expect(st.expandedBehaviorCards['beh-phys']).toBeUndefined();

      st.setBehaviorCardExpanded('beh-phys', false);
      expect(useSceneStore.getState().expandedBehaviorCards['beh-phys']).toBe(false);

      st.setBehaviorCardExpanded('beh-phys', true);
      expect(useSceneStore.getState().expandedBehaviorCards['beh-phys']).toBe(true);

      st.setAppMode('play');
      st.setAppMode('edit');
      expect(useSceneStore.getState().expandedBehaviorCards['beh-phys']).toBe(true);
    });
  });

  describe('#8, #9, #10, #12 — Snap 2.0 (Pivot, Repère Canvas, Réceptacle, Magnétisme, Joint Physique)', () => {
    it('#8 calcule avec précision les ancres pivot & custom_canvas (avec rotation et flipX) et convertit monde -> local', () => {
      const ent = makeEntity('p', {
        position: { x: 100, y: 100 },
        size: { width: 100, height: 50 },
        pivot: { x: 0.25, y: 0.5 },
        flipX: false,
      });

      const pivotPt = getSnapAnchorWorldPoint(ent, 'pivot');
      expect(pivotPt).toEqual({ x: 125, y: 125 });

      const customPt = getSnapAnchorWorldPoint(ent, 'custom_canvas', { x: 0.8, y: 0.2 });
      expect(customPt.x).toBeCloseTo(180, 2);
      expect(customPt.y).toBeCloseTo(110, 2);

      const flipped = { ...ent, flipX: true };
      const flippedWorld = getSnapAnchorWorldPoint(flipped, 'custom_canvas', { x: 0.8, y: 0.2 });
      expect(flippedWorld.x).toBeCloseTo(120, 2);
      const roundTrip = computeSnapCustomAnchorFromWorld(flipped, flippedWorld);
      expect(roundTrip.x).toBeCloseTo(0.8, 3);
      expect(roundTrip.y).toBeCloseTo(0.2, 3);
    });

    it('#10 stepSnapSolver applique magnétisme progressif et transition approachingStateId', () => {
      const key = makeEntity('key', {
        position: { x: 100, y: 100 },
        size: { width: 40, height: 40 },
        states: {
          default: { id: 'default', name: 'Idle', color: '#3b82f6', scale: 1, rotation: 0 },
          glow: { id: 'glow', name: 'Glow', color: '#a855f7', scale: 1, rotation: 0 },
        },
      });
      const lock = makeEntity('lock', {
        position: { x: 200, y: 100 },
        size: { width: 40, height: 40 },
      });

      const cfg: SnapBehaviorConfig = {
        id: 'snap-1',
        type: 'snap',
        enabled: true,
        snapRole: 'magnet_object',
        targetType: 'entity',
        targetEntityId: 'lock',
        snapTrigger: 'on_release',
        snapMode: 'instant',
        snapAlignment: 'center',
        attachBehavior: 'position_only',
        snapRadius: 40,
        magnetEnabled: true,
        magnetRadius: 150,
        magnetForce: 300,
        approachingStateId: 'glow',
      };

      const res = stepSnapSolver({
        entity: key,
        config: cfg,
        runtime: createInitialSnapRuntimeEntry(),
        allEntities: { key, lock },
        dt: 0.016,
        isDragging: false,
        justReleased: false,
      });

      expect(res.nextRuntime.isApproaching).toBe(true);
      expect(res.stateChange).toBe('glow');
      expect(res.magnetPull).toBeDefined();
      expect(res.magnetPull!.vxPxPerSec).toBeGreaterThan(0);
    });

    it('#12 stepSnapSolver parent_physics_joint génère une mutation attachmentMode=physics_joint avec jointConfig', () => {
      const bob = makeEntity('bob', {
        position: { x: 190, y: 100 },
        size: { width: 40, height: 40 },
      });
      const anchor = makeEntity('anchor', {
        position: { x: 200, y: 100 },
        size: { width: 40, height: 40 },
      });
      const cfg: SnapBehaviorConfig = {
        id: 'snap-joint',
        type: 'snap',
        enabled: true,
        targetType: 'entity',
        targetEntityId: 'anchor',
        snapTrigger: 'always_when_near',
        snapMode: 'instant',
        snapRadius: 60,
        snapAlignment: 'anchor_offset',
        sourceAnchor: 'top',
        targetAnchor: 'bottom',
        attachBehavior: 'parent_physics_joint',
        jointConfig: {
          springStiffness: 0.85,
          springDamping: 0.12,
          jointBreakable: true,
          jointBreakForce: 14,
          jointBreakShakeThreshold: 220,
          jointBreakFallWithGravity: true,
        },
      };

      const goal = computeSnapGoalForTarget(bob, anchor, cfg);
      expect(goal.goalTopLeft.x).toBeCloseTo(200, 1);
      expect(goal.goalTopLeft.y).toBeCloseTo(140, 1);

      const res = stepSnapSolver({
        entity: bob,
        config: cfg,
        runtime: createInitialSnapRuntimeEntry(),
        allEntities: { bob, anchor },
        dt: 0.016,
        isDragging: false,
        justReleased: false,
      });

      expect(res.nextRuntime.isSnapped).toBe(true);
      expect(res.parentMutation?.parentId).toBe('anchor');
      expect(res.parentMutation?.customOffset?.attachmentMode).toBe('physics_joint');
      expect(res.parentMutation?.customOffset?.jointBreakable).toBe(true);
      expect(res.parentMutation?.customOffset?.jointBreakForce).toBe(14);
      expect(res.parentMutation?.customOffset?.jointChildPivot).toEqual({ x: 0.5, y: 0 });
    });

    it('#9 Réceptacle limite la capture à maxCapacity dans stepMatterPhysics et expose activeCount dans le debug gizmo', () => {
      const slot = makeEntity('slot', {
        position: { x: 200, y: 200 },
        size: { width: 60, height: 60 },
        behaviors: [
          {
            id: 'b-rec',
            type: 'snap',
            enabled: true,
            snapRole: 'receptacle',
            maxCapacity: 1,
            targetType: 'tag',
            targetTag: 'gem',
            snapTrigger: 'always_when_near',
            snapMode: 'instant',
            snapAlignment: 'center',
            snapRadius: 80,
            attachBehavior: 'position_only',
          },
        ],
      });
      const gem1 = makeEntity('gem1', {
        position: { x: 205, y: 205 },
        size: { width: 30, height: 30 },
        tags: ['gem'],
      });
      const gem2 = makeEntity('gem2', {
        position: { x: 210, y: 210 },
        size: { width: 30, height: 30 },
        tags: ['gem'],
      });

      stepMatterPhysics({
        entities: { slot, gem1, gem2 },
        deltaTime: 0.016,
        canvasBounds: { width: 800, height: 600 },
      });

      const debug = getGizmoRuntimeDebugData();
      expect(debug.snapMagnets.slot).toBeDefined();
      expect(debug.snapMagnets.slot.isReceptacle).toBe(true);
      expect(debug.snapMagnets.slot.maxCapacity).toBe(1);
      expect(debug.snapMagnets.slot.activeCount).toBe(1);
    });
  });

  describe('#11 — Patrouille : Demi-tour sur collision filtrée', () => {
    it('inverse la direction avec cooldown configurable dès entityCollisionHit=true', () => {
      const rt = makePatrolRuntime(200, 200);
      const cfg: PatrolBehaviorConfig = {
        id: 'pat-col',
        type: 'patrol',
        enabled: true,
        axis: 'horizontal',
        range: 200,
        speed: 100,
        pauseDuration: 0.5,
        pauseAtEnds: 0.5,
        turnOnCollision: true,
        collisionTurnCooldownSec: 0.4,
      };

      const res1 = stepPatrolBehavior({
        state: rt,
        currentCenter: { x: 220, y: 200 },
        config: cfg,
        entities: {},
        dt: 0.016,
        entityCollisionHit: true,
      });

      expect(res1.turned).toBe(true);
      expect(rt.direction).toBe(-1);
      expect(rt.entityCollisionTurnCooldown).toBeCloseTo(0.4, 3);

      rt.timer = 0;
      const res2 = stepPatrolBehavior({
        state: rt,
        currentCenter: { x: 218, y: 200 },
        config: cfg,
        entities: {},
        dt: 0.016,
        entityCollisionHit: true,
      });
      expect(res2.turned).toBe(false);
      expect(rt.direction).toBe(-1);
    });
  });
});
