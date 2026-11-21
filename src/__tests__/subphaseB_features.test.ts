import { beforeEach, describe, expect, it } from 'vitest';
import { Entity, ParentOffset } from '../types';
import { stepSpring2D } from '../utils/physics/springJiggleSolver';
import { resolveEffectiveParentOffset, resolveEntityReference } from '../store/parentingHelpers';
import { resolveRawPivot } from '../utils/physics/pivotHelpers';
import { isEntityDraggable } from '../utils/physics/behaviorResolution';
import { checkCollision } from '../store/collisionHelpers';
import { executeRuleActions, clearPlayRuntimeState } from '../store/ruleExecutionEngine';
import {
  resetMatterPhysicsRuntime,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';
import { useSceneStore } from '../store/useSceneStore';

function makeEntity(overrides: Partial<Entity> & { id: string }): Entity {
  const { id, ...rest } = overrides;
  return {
    id,
    name: `Entity ${id}`,
    type: 'custom',
    position: { x: 100, y: 100 },
    size: { width: 80, height: 80 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Idle',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
    },
    ...rest,
  };
}

describe('Sous-phase B : Ressort 0px strict, overrides d’état, désactivation, impulsion & parentage configurable', () => {
  beforeEach(() => {
    clearPlayRuntimeState();
    resetMatterPhysicsRuntime();
    useSceneStore.setState({
      appMode: 'play',
      entities: {},
      entityOrder: [],
      customArchetypes: {},
      entityGroups: [],
      selectedEntityId: null,
      selectedLayerId: null,
      layerDrawingActions: null,
    });
  });

  it('stepSpring2D : maxDistance=0 + limitMaxDistance=true bride strictement à 0px vs limitMaxDistance=false reste libre', () => {
    const pinnedState = { x: 240, y: 180, vx: 350, vy: -220 };
    const pinned = stepSpring2D({
      state: pinnedState,
      targetX: 120,
      targetY: 90,
      stiffness: 180,
      damping: 12,
      gravity: 500,
      maxDistance: 0,
      limitMaxDistance: true,
      dt: 1 / 60,
    });

    expect(pinned.clampedByLeash).toBe(true);
    expect(pinned.x).toBe(120);
    expect(pinned.y).toBe(90);
    expect(pinned.vx).toBe(0);
    expect(pinned.vy).toBe(0);

    const freeState = { x: 120, y: 90, vx: 0, vy: 0 };
    for (let i = 0; i < 60; i++) {
      stepSpring2D({
        state: freeState,
        targetX: 120,
        targetY: 90,
        stiffness: 100,
        damping: 14,
        gravity: 400,
        maxDistance: 0,
        limitMaxDistance: false,
        dt: 1 / 60,
      });
    }
    expect(freeState.y).toBeGreaterThan(91);
  });

  it('resolveEffectiveParentOffset, resolveRawPivot & isEntityDraggable respectent parentOffsetOverride sans muter entity.parentOffset', () => {
    const baseOffset: ParentOffset = {
      x: 12,
      y: -8,
      rotationOffset: 0,
      inheritRotation: true,
      inheritFlip: true,
      attachmentMode: 'rigid',
    };

    const child = makeEntity({
      id: 'child-1',
      parentId: 'parent-1',
      pivot: { x: 0.5, y: 0.5 },
      parentOffset: { ...baseOffset },
      behaviors: [
        {
          id: 'drag-1',
          type: 'draggable',
          enabled: true,
          throwable: true,
          precisePhysicsGrab: true,
        },
      ],
      states: {
        default: {
          id: 'default',
          name: 'Rigide',
          color: '#3b82f6',
          scale: 1,
          rotation: 0,
        },
        loose: {
          id: 'loose',
          name: 'Articulé',
          color: '#f59e0b',
          scale: 1,
          rotation: 0,
          pivot: { x: 0.5, y: 0 },
          parentOffsetOverride: {
            attachmentMode: 'physics_joint',
            springGravity: 320,
            jointBreakable: true,
            jointBreakForce: 180,
          },
        },
      },
    });

    const effDefault = resolveEffectiveParentOffset(child, child.states.default);
    expect(effDefault?.attachmentMode).toBe('rigid');
    expect(effDefault?.x).toBe(12);
    expect(isEntityDraggable(child, child.states.default).hasDynamicPhysics).toBe(false);
    expect(resolveRawPivot(child, child.states.default)).toEqual({ x: 0.5, y: 0.5 });

    const effLoose = resolveEffectiveParentOffset(child, child.states.loose);
    expect(effLoose?.attachmentMode).toBe('physics_joint');
    expect(effLoose?.x).toBe(12);
    expect(effLoose?.y).toBe(-8);
    expect(effLoose?.jointBreakable).toBe(true);
    expect(effLoose?.jointBreakForce).toBe(180);

    // L'override par état active la dynamique de joint sans modifier entity.parentOffset de base
    const looseDrag = isEntityDraggable(child, child.states.loose);
    expect(looseDrag.hasDynamicPhysics).toBe(true);
    expect(looseDrag.precisePhysicsGrab).toBe(true);
    expect(resolveRawPivot(child, child.states.loose)).toEqual({ x: 0.5, y: 0 });
    expect(child.parentOffset?.attachmentMode).toBe('rigid');
    expect(child.parentOffset?.jointBreakable).toBeUndefined();
  });

  it('entité disabled=true exclue de la physique, des collisions et des actions classiques, mais réactivable via set_entity_enabled', () => {
    const active = makeEntity({
      id: 'hero',
      type: 'hero',
      position: { x: 100, y: 100 },
      size: { width: 80, height: 80 },
    });
    const disabledEnt = makeEntity({
      id: 'trap-1',
      type: 'trap',
      tags: ['piege'],
      disabled: true,
      position: { x: 110, y: 110 },
      size: { width: 80, height: 80 },
      states: {
        default: { id: 'default', name: 'Idle', color: '#000', scale: 1, rotation: 0 },
        armed: { id: 'armed', name: 'Armé', color: '#f00', scale: 1, rotation: 0 },
      },
      behaviors: [
        { id: 'phys-trap', type: 'physics', enabled: true, gravity: 600, mass: 1, bounce: 0, friction: 0.5 },
      ],
    });

    const entities: Record<string, Entity> = { hero: active, 'trap-1': disabledEnt };
    useSceneStore.setState({
      appMode: 'play',
      entities,
      entityOrder: ['hero', 'trap-1'],
    });

    // Exclue des collisions, du ciblage standard et du stepping physique
    expect(checkCollision(active, disabledEnt)).toBe(false);
    expect(resolveEntityReference('instance', 'trap-1', undefined, undefined, active, undefined, entities)).toBeUndefined();
    expect(
      resolveEntityReference('instance', 'trap-1', undefined, undefined, active, undefined, entities, null, true)?.id
    ).toBe('trap-1');

    const physStep = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds: { width: 800, height: 500 },
    });
    expect(physStep.updatedTransforms['trap-1']).toBeUndefined();

    const helpers = {
      subject: active,
      allEntities: entities,
      updateEntityState: (id: string, nextStateId: string) => {
        entities[id] = { ...entities[id], currentStateId: nextStateId };
        useSceneStore.setState({ entities: { ...entities } });
        stateChanged = true;
      },
      updateEntityDetails: (id: string, patch: Partial<Entity>) => {
        entities[id] = { ...entities[id], ...patch };
        useSceneStore.setState({ entities: { ...entities } });
      },
      deleteEntity: () => {},
      spawnEntity: () => '',
    };

    // Une action classique (change_state) ignore la cible disabled=true
    let stateChanged = false;
    executeRuleActions(
      [
        {
          id: 'act-ignore',
          type: 'change_state',
          targetMode: 'instance',
          targetId: 'trap-1',
          targetStateId: 'armed',
        },
      ],
      helpers
    );
    expect(stateChanged).toBe(false);

    // set_entity_enabled ('enable') réactive bien une entité déjà disabled=true
    executeRuleActions(
      [
        {
          id: 'act-enable',
          type: 'set_entity_enabled',
          targetMode: 'instance',
          targetId: 'trap-1',
          enabledActionMode: 'enable',
        },
      ],
      helpers
    );
    expect(entities['trap-1'].disabled).toBe(false);
    expect(checkCollision(active, entities['trap-1'])).toBe(true);

    // 'toggle' re-désactive puis ré-active
    executeRuleActions(
      [
        {
          id: 'act-toggle-off',
          type: 'set_entity_enabled',
          targetMode: 'tag',
          targetTag: 'piege',
          enabledActionMode: 'toggle',
        },
      ],
      helpers
    );
    expect(entities['trap-1'].disabled).toBe(true);

    executeRuleActions(
      [
        {
          id: 'act-disable',
          type: 'set_entity_enabled',
          targetMode: 'instance',
          targetId: 'trap-1',
          enabledActionMode: 'enable',
        },
        {
          id: 'act-disable-2',
          type: 'set_entity_enabled',
          targetMode: 'instance',
          targetId: 'trap-1',
          enabledActionMode: 'disable',
        },
      ],
      helpers
    );
    expect(entities['trap-1'].disabled).toBe(true);
  });

  it('apply_impulse applique add/set + vitesse angulaire tout en protégeant les entités isStatic=true', () => {
    const dynamicBox = makeEntity({
      id: 'crate-dyn',
      position: { x: 200, y: 200 },
      size: { width: 60, height: 60 },
      colliderType: 'box',
      behaviors: [
        { id: 'phys-dyn', type: 'physics', enabled: true, gravity: 0, mass: 1, bounce: 0, friction: 0 },
      ],
    });
    const staticWall = makeEntity({
      id: 'wall-static',
      position: { x: 400, y: 200 },
      size: { width: 60, height: 120 },
      colliderType: 'box',
      behaviors: [
        { id: 'phys-static', type: 'physics', enabled: true, isStatic: true, gravity: 0, mass: 1, bounce: 0, friction: 0 },
      ],
    });

    let entities: Record<string, Entity> = {
      'crate-dyn': dynamicBox,
      'wall-static': staticWall,
    };

    // Initialiser les corps Matter.js
    stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });

    const runImpulse = (act: Parameters<typeof executeRuleActions>[0][number], subject: Entity) => {
      executeRuleActions([act], {
        subject,
        allEntities: entities,
        updateEntityState: () => {},
        updateEntityDetails: () => {},
        deleteEntity: () => {},
        spawnEntity: () => '',
      });
    };

    // 1. Add impulsion vers la droite + rotation
    runImpulse(
      {
        id: 'imp-add-1',
        type: 'apply_impulse',
        targetMode: 'subject',
        impulseDirectionMode: 'cardinal',
        impulseCardinal: 'right',
        impulseStrength: 300,
        impulseApplyMode: 'add',
        impulseAngular: 180,
      },
      entities['crate-dyn']
    );

    // 2. Second add s'additionne
    runImpulse(
      {
        id: 'imp-add-2',
        type: 'apply_impulse',
        targetMode: 'subject',
        impulseDirectionMode: 'cardinal',
        impulseCardinal: 'right',
        impulseStrength: 300,
        impulseApplyMode: 'add',
        impulseAngular: 0,
      },
      entities['crate-dyn']
    );

    // 3. Tentative sur mur isStatic=true doit être ignorée
    runImpulse(
      {
        id: 'imp-static',
        type: 'apply_impulse',
        targetMode: 'subject',
        impulseDirectionMode: 'cardinal',
        impulseCardinal: 'left',
        impulseStrength: 500,
        impulseApplyMode: 'set',
        impulseAngular: 90,
      },
      entities['wall-static']
    );

    for (let i = 0; i < 6; i++) {
      const res = stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });
      for (const [id, patch] of Object.entries(res.updatedTransforms)) {
        const cur = entities[id];
        if (!cur) continue;
        entities[id] = {
          ...cur,
          position: patch.position ?? cur.position,
          states:
            patch.rotation !== undefined
              ? {
                  ...cur.states,
                  [cur.currentStateId]: { ...cur.states[cur.currentStateId], rotation: patch.rotation },
                }
              : cur.states,
        };
      }
    }

    // Add 300+300 px/s sur 6 ticks (~0.1s) => ~+60px en X et rotation non nulle
    const xAfterAdd = entities['crate-dyn'].position.x;
    expect(xAfterAdd).toBeGreaterThan(245);
    expect(Math.abs(entities['crate-dyn'].states.default.rotation)).toBeGreaterThan(5);
    // Le mur isStatic=true n'a pas bougé
    expect(entities['wall-static'].position).toEqual({ x: 400, y: 200 });
    expect(entities['wall-static'].states.default.rotation).toBe(0);

    // 4. Mode 'set' remplace la vitesse vers le haut (-Y)
    runImpulse(
      {
        id: 'imp-set-up',
        type: 'apply_impulse',
        targetMode: 'subject',
        impulseDirectionMode: 'angle',
        impulseAngle: -90,
        impulseStrength: 600,
        impulseApplyMode: 'set',
        impulseAngular: 0,
      },
      entities['crate-dyn']
    );

    for (let i = 0; i < 6; i++) {
      const res = stepMatterPhysics({ entities, deltaTime: 1 / 60, canvasBounds: { width: 800, height: 500 } });
      const patch = res.updatedTransforms['crate-dyn'];
      if (patch?.position) {
        entities['crate-dyn'] = { ...entities['crate-dyn'], position: patch.position };
      }
    }

    expect(entities['crate-dyn'].position.y).toBeLessThan(160);
    // 'set' a annulé la vitesse horizontale précédente
    expect(Math.abs(entities['crate-dyn'].position.x - xAfterAdd)).toBeLessThan(2);
  });

  it('attach_to_parent avec attachKeepCurrentOffset=true calcule l’offset relatif tout en préservant attachmentMode et options de joint', () => {
    const parent = makeEntity({
      id: 'parent-hand',
      position: { x: 100, y: 100 },
      size: { width: 100, height: 100 }, // centre (150, 150)
    });
    const child = makeEntity({
      id: 'child-lantern',
      position: { x: 170, y: 175 },
      size: { width: 60, height: 50 }, // centre (200, 200) -> delta (+50, +50)
    });

    useSceneStore.setState({
      appMode: 'play',
      entities: { [parent.id]: parent, [child.id]: child },
      entityOrder: [parent.id, child.id],
    });

    executeRuleActions(
      [
        {
          id: 'act-attach-joint',
          type: 'attach_to_parent',
          targetMode: 'subject',
          parentTargetMode: 'entity',
          parentEntityId: parent.id,
          attachKeepCurrentOffset: true,
          attachDisableCollisions: true,
          parentOffset: {
            x: 0,
            y: 0,
            attachmentMode: 'physics_joint',
            springStiffness: 240,
            springDamping: 10,
            jointBreakable: true,
            jointBreakForce: 220,
          },
        },
      ],
      {
        subject: child,
        allEntities: useSceneStore.getState().entities,
        updateEntityState: () => {},
        updateEntityDetails: () => {},
        deleteEntity: () => {},
        spawnEntity: () => '',
      }
    );

    const updatedChild = useSceneStore.getState().entities[child.id];
    expect(updatedChild.parentId).toBe(parent.id);
    expect(updatedChild.parentOffset?.attachmentMode).toBe('physics_joint');
    expect(updatedChild.parentOffset?.springStiffness).toBe(240);
    expect(updatedChild.parentOffset?.jointBreakable).toBe(true);
    expect(updatedChild.parentOffset?.jointBreakForce).toBe(220);
    expect(updatedChild.parentOffset?.disableCollisionsWhileAttached).toBe(true);
    expect(updatedChild.parentOffset?.x).toBeCloseTo(50, 1);
    expect(updatedChild.parentOffset?.y).toBeCloseTo(50, 1);
  });
});
