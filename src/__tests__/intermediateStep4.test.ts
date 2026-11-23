import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Entity, PhysicsBehaviorConfig } from '../types';
import {
  getGizmoRuntimeDebugData,
  hasActiveWorldPin,
  resetMatterPhysicsRuntime,
  startPhysicsGrab,
  stepMatterPhysics,
  updatePhysicsGrabTarget,
  endPhysicsGrab,
} from '../utils/matterPhysicsEngine';
import { resolveEffectiveParentOffset } from '../store/parentingHelpers';
import { useSceneStore } from '../store/useSceneStore';

function makeEntity(id: string, overrides: Partial<Entity> = {}): Entity {
  const baseStateId = overrides.currentStateId || 'default';
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 200, y: 200 },
    size: { width: 80, height: 80 },
    currentStateId: baseStateId,
    isDraggable: true,
    states: {
      [baseStateId]: {
        id: baseStateId,
        name: 'Collée',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
      ...(overrides.states || {}),
    },
    ...overrides,
  };
}

describe('Étape Intermédiaire 4 — Ergonomie, Overrides & World Pin (Piste B)', () => {
  beforeEach(() => {
    resetMatterPhysicsRuntime();
    useSceneStore.getState().restoreDefaultScene();
  });

  afterEach(() => {
    resetMatterPhysicsRuntime();
  });

  it('#4 : clearProject() désélectionne le calque actif pour désactiver le mode dessin sur calque', () => {
    const store = useSceneStore.getState();
    store.selectLayer('layer-bg-1');
    expect(useSceneStore.getState().selectedLayerId).toBe('layer-bg-1');

    store.clearProject();
    expect(useSceneStore.getState().selectedLayerId).toBeNull();
    expect(useSceneStore.getState().selectedEntityId).toBeNull();
  });

  it('#2 : resolveEffectiveParentOffset fusionne un override complet sans altérer le parentOffset de base', () => {
    const child = makeEntity('child', {
      parentId: 'parent',
      parentOffset: {
        x: 10,
        y: 20,
        rotationOffset: 0,
        inheritRotation: true,
        inheritFlip: true,
        attachmentMode: 'rigid',
      },
      currentStateId: 'pinned',
      states: {
        default: {
          id: 'default',
          name: 'Normal',
          color: '#3b82f6',
          scale: 1,
          rotation: 0,
        },
        pinned: {
          id: 'pinned',
          name: 'Épinglé',
          color: '#f59e0b',
          scale: 1,
          rotation: 0,
          parentOffsetOverride: {
            x: 35,
            y: -15,
            attachmentMode: 'physics_joint',
            jointBreakable: true,
          },
        },
      },
    });

    const effDefault = resolveEffectiveParentOffset(child, child.states.default);
    expect(effDefault?.x).toBe(10);
    expect(effDefault?.attachmentMode).toBe('rigid');

    const effPinned = resolveEffectiveParentOffset(child, child.states.pinned);
    expect(effPinned?.x).toBe(35);
    expect(effPinned?.y).toBe(-15);
    expect(effPinned?.attachmentMode).toBe('physics_joint');
    expect(effPinned?.jointBreakable).toBe(true);
    expect(child.parentOffset?.attachmentMode).toBe('rigid');
  });

  it('#5 Piste B : Épingle au monde (worldPin) résiste au drag, s’arrache au-delà du seuil, déclenche joint_break + changement d’état et ré-épingle au retour', () => {
    const basePhysics: PhysicsBehaviorConfig = {
      id: 'phys-head',
      type: 'physics',
      enabled: true,
      isStatic: false,
      isTrigger: false,
      gravity: 0,
      bounce: 0.2,
      friction: 0.4,
      frictionAir: 0.05,
      mass: 1,
      worldPinEnabled: false,
    };

    const head = makeEntity('head', {
      position: { x: 200, y: 200 },
      size: { width: 80, height: 80 },
      currentStateId: 'collee',
      states: {
        collee: {
          id: 'collee',
          name: 'Collée',
          color: '#f59e0b',
          scale: 1,
          rotation: 0,
          behaviorOverrides: {
            'phys-head': {
              worldPinEnabled: true,
              worldPinStiffness: 0.35,
              worldPinDamping: 0.2,
              worldPinBreakable: true,
              worldPinBreakDistance: 55,
              worldPinBrokenStateId: 'libre',
            },
          },
        },
        libre: {
          id: 'libre',
          name: 'Libre',
          color: '#10b981',
          scale: 1,
          rotation: 0,
        },
      },
      behaviors: [basePhysics],
    });

    const entities: Record<string, Entity> = { head };
    const canvasBounds = { width: 800, height: 600 };

    // 1. Initialisation du monde physique : l'épingle au monde doit être active
    let res = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds,
    });
    expect(hasActiveWorldPin('head')).toBe(true);
    expect(getGizmoRuntimeDebugData().worldPins.head).toBeDefined();
    expect(res.brokenJointEvents).toBeUndefined();

    // 2. Traction douce (< seuil 55 px) : résiste sans casser
    const grabStart = startPhysicsGrab('head', 240, 240);
    expect(grabStart).toBe(true);
    updatePhysicsGrabTarget('head', 265, 240);

    for (let i = 0; i < 10; i++) {
      res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds,
      });
      if (res.updatedTransforms.head?.position) {
        head.position = res.updatedTransforms.head.position;
      }
      expect(res.brokenJointEvents).toBeUndefined();
    }
    expect(hasActiveWorldPin('head')).toBe(true);
    // La position reste retenue près de x=200 malgré le drag vers +25 px
    expect(head.position.x).toBeLessThan(230);

    // 3. Traction forte au-delà du seuil : arrachement + événement joint_break + passage en état 'libre'
    updatePhysicsGrabTarget('head', 380, 240);
    let breakEvent: NonNullable<typeof res.brokenJointEvents>[number] | undefined;
    let nextStateAfterBreak: string | undefined;

    for (let i = 0; i < 20; i++) {
      res = stepMatterPhysics({
        entities,
        deltaTime: 1 / 60,
        canvasBounds,
      });
      if (res.updatedTransforms.head?.position) {
        head.position = res.updatedTransforms.head.position;
      }
      if (res.brokenJointEvents?.length) {
        breakEvent = res.brokenJointEvents[0];
      }
      if (res.stateChanges?.head) {
        nextStateAfterBreak = res.stateChanges.head;
        head.currentStateId = nextStateAfterBreak;
        break;
      }
    }

    expect(breakEvent).toBeDefined();
    expect(breakEvent?.isWorldPin).toBe(true);
    expect(breakEvent?.childId).toBe('head');
    expect(nextStateAfterBreak).toBe('libre');
    expect(hasActiveWorldPin('head')).toBe(false);

    endPhysicsGrab('head', false);

    // 4. Vérifier qu'en état 'libre' l'objet reste sans épingle
    res = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds,
    });
    expect(hasActiveWorldPin('head')).toBe(false);

    // 5. Revenir à l'état 'collee' : l'épingle au monde doit se réactiver proprement
    head.currentStateId = 'collee';
    res = stepMatterPhysics({
      entities,
      deltaTime: 1 / 60,
      canvasBounds,
    });
    expect(hasActiveWorldPin('head')).toBe(true);
    expect(getGizmoRuntimeDebugData().worldPins.head).toBeDefined();
  });
});
