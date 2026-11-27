import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Entity, SnapBehaviorConfig } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { DEFAULT_SCENE_CAMERA_CONFIG, resolveEffectivePlayAspectRatio } from '../utils/cameraSolver';
import {
  SnapRuntimeEntry,
  computeDraggedSnapMagneticOffset,
  createInitialSnapRuntimeEntry,
  stepSnapSolver,
} from '../utils/physics/snapSolver';
import {
  isActiveBidirectionalDragTarget,
  resetMatterPhysicsRuntime,
  resolvePlayEntityDraggable,
  setActiveDragPosition,
  stepMatterPhysics,
} from '../utils/matterPhysicsEngine';

function makeEntity(id: string, overrides: Partial<Entity> = {}): Entity {
  const baseStateId = overrides.currentStateId || 'state-default';
  return {
    id,
    name: `Entity ${id}`,
    type: overrides.type || 'custom',
    position: { x: 100, y: 100 },
    size: { width: 40, height: 40 },
    currentStateId: baseStateId,
    isDraggable: true,
    states: {
      [baseStateId]: {
        id: baseStateId,
        name: 'Normal',
        color: '#3b82f6',
        scale: 1,
        rotation: 0,
      },
      ...(overrides.states || {}),
    },
    ...overrides,
  };
}

describe('Canvas libre par défaut, magnétisme drag, état en traction & repère Snap', () => {
  beforeEach(() => {
    resetMatterPhysicsRuntime();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    resetMatterPhysicsRuntime();
    useSceneStore.getState().clearProject();
  });

  it('définit le ratio de scène par défaut sur free (Libre) et le propage au mode Play inherit', () => {
    const settings = useSceneStore.getState().settings;
    expect(settings.aspectRatio).toBe('free');
    expect(resolveEffectivePlayAspectRatio(settings.aspectRatio, DEFAULT_SCENE_CAMERA_CONFIG)).toBe('free');
  });

  it('calcule une attraction magnétique ressentie pendant le drag (objet & réceptacle) avec cooldown et maxCapacity', () => {
    const snapCfg: SnapBehaviorConfig = {
      id: 'snap-mag',
      type: 'snap',
      enabled: true,
      snapRole: 'magnet_object',
      targetType: 'entity',
      targetEntityId: 'target',
      snapTrigger: 'on_release',
      snapRadius: 40,
      snapMode: 'instant',
      snapAlignment: 'center',
      attachBehavior: 'position_only',
      magnetEnabled: true,
      magnetRadius: 120,
      magnetForce: 260,
    };

    const piece = makeEntity('piece', {
      position: { x: 20, y: 100 },
      behaviors: [snapCfg],
    });
    const target = makeEntity('target', {
      position: { x: 200, y: 100 },
    });

    const allEntities = { piece, target };

    // Hors rayon magnétique (distance 180 > 120) -> aucun décalage
    expect(
      computeDraggedSnapMagneticOffset({
        entity: piece,
        rawPos: { x: 20, y: 100 },
        allEntities,
      })
    ).toEqual({ x: 0, y: 0 });

    // Dans le rayon magnétique (distance 60 <= 120) -> tiré vers target (x positif)
    const offsetInside = computeDraggedSnapMagneticOffset({
      entity: piece,
      rawPos: { x: 140, y: 100 },
      allEntities,
    });
    expect(offsetInside.x).toBeGreaterThan(0);
    expect(offsetInside.x).toBeLessThan(60);
    expect(offsetInside.y).toBe(0);

    // Déjà snappé ou en cooldown -> pas d'attraction parasite
    const snappedMap = new Map<string, SnapRuntimeEntry>([
      [
        'piece',
        {
          ...createInitialSnapRuntimeEntry(),
          isSnapped: true,
          snappedTargetId: 'target',
        },
      ],
    ]);
    expect(
      computeDraggedSnapMagneticOffset({
        entity: piece,
        rawPos: { x: 140, y: 100 },
        allEntities,
        snapRuntimeStates: snappedMap,
      })
    ).toEqual({ x: 0, y: 0 });

    const cooldownMap = new Map<string, SnapRuntimeEntry>([
      [
        'piece',
        {
          ...createInitialSnapRuntimeEntry(),
          cooldownRemaining: 0.25,
        },
      ],
    ]);
    expect(
      computeDraggedSnapMagneticOffset({
        entity: piece,
        rawPos: { x: 140, y: 100 },
        allEntities,
        snapRuntimeStates: cooldownMap,
      })
    ).toEqual({ x: 0, y: 0 });

    // Réceptacle avec maxCapacity = 1
    const recCfg: SnapBehaviorConfig = {
      id: 'snap-rec',
      type: 'snap',
      enabled: true,
      snapRole: 'receptacle',
      targetType: 'any',
      maxCapacity: 1,
      snapTrigger: 'on_release',
      snapRadius: 40,
      snapMode: 'instant',
      snapAlignment: 'center',
      attachBehavior: 'position_only',
      magnetEnabled: true,
      magnetRadius: 120,
      magnetForce: 260,
    };
    const freePiece = makeEntity('free-piece', { position: { x: 140, y: 100 } });
    const otherPiece = makeEntity('other-piece', { position: { x: 200, y: 100 } });
    const receptacle = makeEntity('receptacle', {
      position: { x: 200, y: 100 },
      behaviors: [recCfg],
    });

    const recPullFree = computeDraggedSnapMagneticOffset({
      entity: freePiece,
      rawPos: { x: 140, y: 100 },
      allEntities: { 'free-piece': freePiece, 'other-piece': otherPiece, receptacle },
    });
    expect(recPullFree.x).toBeGreaterThan(0);

    const occupiedMap = new Map<string, SnapRuntimeEntry>([
      [
        'other-piece',
        {
          ...createInitialSnapRuntimeEntry(),
          isSnapped: true,
          snappedTargetId: 'receptacle',
        },
      ],
    ]);
    expect(
      computeDraggedSnapMagneticOffset({
        entity: freePiece,
        rawPos: { x: 140, y: 100 },
        allEntities: { 'free-piece': freePiece, 'other-piece': otherPiece, receptacle },
        snapRuntimeStates: occupiedMap,
      })
    ).toEqual({ x: 0, y: 0 });
  });

  it('gère l’état pullingStateId avec hystérésis et restauration à la relâche ou passage à unsnappedStateId sur arrachement', () => {
    const piece = makeEntity('piece', {
      position: { x: 200, y: 200 },
      currentStateId: 'state-snapped',
      states: {
        'state-default': { id: 'state-default', name: 'Normal', color: '#3b82f6', scale: 1, rotation: 0 },
        'state-snapped': { id: 'state-snapped', name: 'Attaché', color: '#22c55e', scale: 1, rotation: 0 },
        'state-pull': { id: 'state-pull', name: 'Traction', color: '#f59e0b', scale: 1, rotation: 0 },
        'state-free': { id: 'state-free', name: 'Libre', color: '#94a3b8', scale: 1, rotation: 0 },
      },
    });
    const socket = makeEntity('socket', { position: { x: 200, y: 200 } });

    const config: SnapBehaviorConfig = {
      id: 'snap-pull',
      type: 'snap',
      enabled: true,
      targetType: 'entity',
      targetEntityId: 'socket',
      snapTrigger: 'on_release',
      snapRadius: 40,
      snapMode: 'instant',
      snapAlignment: 'center',
      attachBehavior: 'parent_rigid',
      allowPullUnsnap: true,
      unsnapDistance: 70,
      reSnapCooldownSec: 0.4,
      snappedStateId: 'state-snapped',
      pullingStateId: 'state-pull',
      unsnappedStateId: 'state-free',
    };

    const snappedRt: SnapRuntimeEntry = {
      isSnapped: true,
      snappedTargetId: 'socket',
      attachBehavior: 'parent_rigid',
      cooldownRemaining: 0,
      snappedAtPos: { x: 200, y: 200 },
      isPulling: false,
    };

    // 1. Traction légère > 6px mais < unsnapDistance -> entre en pullingStateId
    const pullingStep = stepSnapSolver({
      entity: piece,
      config,
      runtime: snappedRt,
      allEntities: { piece, socket },
      dt: 0.016,
      isDragging: true,
      justReleased: false,
      dragPos: { x: 225, y: 200 },
    });
    expect(pullingStep.nextRuntime.isSnapped).toBe(true);
    expect(pullingStep.nextRuntime.isPulling).toBe(true);
    expect(pullingStep.stateChange).toBe('state-pull');

    // 2. Relâche sans arrachement -> restaure snappedStateId
    const pieceWhilePulling = { ...piece, currentStateId: 'state-pull' };
    const releasedNoBreak = stepSnapSolver({
      entity: pieceWhilePulling,
      config,
      runtime: pullingStep.nextRuntime,
      allEntities: { piece: pieceWhilePulling, socket },
      dt: 0.016,
      isDragging: false,
      justReleased: true,
    });
    expect(releasedNoBreak.nextRuntime.isSnapped).toBe(true);
    expect(releasedNoBreak.nextRuntime.isPulling).toBe(false);
    expect(releasedNoBreak.stateChange).toBe('state-snapped');

    // 3. Nouvelle traction puis arrachement > unsnapDistance -> passe à unsnappedStateId
    const pullingAgain = stepSnapSolver({
      entity: piece,
      config,
      runtime: releasedNoBreak.nextRuntime,
      allEntities: { piece, socket },
      dt: 0.016,
      isDragging: true,
      justReleased: false,
      dragPos: { x: 220, y: 200 },
    });
    const brokenStep = stepSnapSolver({
      entity: pieceWhilePulling,
      config,
      runtime: pullingAgain.nextRuntime,
      allEntities: { piece: pieceWhilePulling, socket },
      dt: 0.016,
      isDragging: true,
      justReleased: false,
      dragPos: { x: 300, y: 200 },
    });
    expect(brokenStep.nextRuntime.isSnapped).toBe(false);
    expect(brokenStep.nextRuntime.isPulling).toBe(false);
    expect(brokenStep.stateChange).toBe('state-free');
  });

  it('propage pullingStateId d’un réceptacle dans stepMatterPhysics quand un objet capturé est tiré', () => {
    const recSnap: SnapBehaviorConfig = {
      id: 'rec-snap',
      type: 'snap',
      enabled: true,
      snapRole: 'receptacle',
      targetType: 'entity',
      targetEntityId: 'apple',
      snapTrigger: 'always_when_near',
      snapRadius: 60,
      snapMode: 'instant',
      snapAlignment: 'center',
      attachBehavior: 'position_only',
      allowPullUnsnap: true,
      unsnapDistance: 90,
      snappedStateId: 'rec-snapped',
      pullingStateId: 'rec-pulling',
      unsnappedStateId: 'rec-free',
    };
    const receptacle = makeEntity('stem', {
      position: { x: 200, y: 200 },
      currentStateId: 'rec-default',
      states: {
        'rec-default': { id: 'rec-default', name: 'Normal', color: '#64748b', scale: 1, rotation: 0 },
        'rec-snapped': { id: 'rec-snapped', name: 'Tenue', color: '#22c55e', scale: 1, rotation: 0 },
        'rec-pulling': { id: 'rec-pulling', name: 'Tirée', color: '#f59e0b', scale: 1, rotation: 0 },
        'rec-free': { id: 'rec-free', name: 'Libre', color: '#94a3b8', scale: 1, rotation: 0 },
      },
      behaviors: [recSnap],
    });
    const apple = makeEntity('apple', {
      position: { x: 205, y: 200 },
    });

    // Tick 1 : capture l'objet -> réceptacle passe à rec-snapped
    const t1 = stepMatterPhysics({
      entities: { stem: receptacle, apple },
      canvasBounds: { width: 800, height: 500 },
      deltaTime: 0.016,
    });
    expect(t1.stateChanges?.stem).toBe('rec-snapped');

    // Tick 2 : on tire l'objet de 30px (< unsnapDistance 90) -> réceptacle passe à rec-pulling
    const stemSnapped = { ...receptacle, currentStateId: 'rec-snapped' };
    setActiveDragPosition('apple', { x: 230, y: 200 });
    const t2 = stepMatterPhysics({
      entities: { stem: stemSnapped, apple },
      canvasBounds: { width: 800, height: 500 },
      deltaTime: 0.016,
    });
    expect(t2.stateChanges?.stem).toBe('rec-pulling');

    // Tick 3 : on relâche sans casser -> réceptacle revient à rec-snapped
    setActiveDragPosition('apple', null);
    const stemPulling = { ...receptacle, currentStateId: 'rec-pulling' };
    const t3 = stepMatterPhysics({
      entities: { stem: stemPulling, apple },
      canvasBounds: { width: 800, height: 500 },
      deltaTime: 0.016,
    });
    expect(t3.stateChanges?.stem).toBe('rec-snapped');
  });

  it('enregistre un repère custom Snap directement sur le canvas pour composant et RuleBook', () => {
    const ent = makeEntity('snap-ent', {
      position: { x: 100, y: 100 },
      size: { width: 100, height: 100 },
      behaviors: [
        {
          id: 'snap-beh-1',
          type: 'snap',
          enabled: true,
          targetType: 'any',
          snapTrigger: 'on_release',
          snapRadius: 48,
          snapMode: 'instant',
          snapAlignment: 'center',
          attachBehavior: 'position_only',
        },
      ],
    });

    useSceneStore.setState({
      entities: { [ent.id]: ent },
      entityOrder: [ent.id],
    });

    // 1. Mode Composant : met à jour customSourceAnchor + passe en anchor_offset/custom_canvas
    useSceneStore.getState().startSnapPinCanvasPick({
      entityId: ent.id,
      behaviorId: 'snap-beh-1',
      pinRole: 'source',
      referenceEntityId: ent.id,
    });
    useSceneStore.getState().completeSnapPinCanvasPick(150, 110); // norm (0.5, 0.1)
    const updatedBeh = useSceneStore
      .getState()
      .entities[ent.id].behaviors?.find((b) => b.id === 'snap-beh-1') as SnapBehaviorConfig;
    expect(updatedBeh.snapAlignment).toBe('anchor_offset');
    expect(updatedBeh.sourceAnchor).toBe('custom_canvas');
    expect(updatedBeh.customSourceAnchor).toEqual({ x: 0.5, y: 0.1 });
    expect(useSceneStore.getState().snapPinCanvasPick).toBeNull();

    // 2. Mode RuleBook (requestId) : alimente snapPinCanvasPickResult sans toucher aux behaviors
    useSceneStore.getState().startSnapPinCanvasPick({
      pinRole: 'target',
      referenceEntityId: ent.id,
      requestId: 'req-rule-1',
    });
    useSceneStore.getState().completeSnapPinCanvasPick(180, 120); // norm (0.8, 0.2)
    const res = useSceneStore.getState().snapPinCanvasPickResult;
    expect(res).toMatchObject({
      requestId: 'req-rule-1',
      pinRole: 'target',
      anchor: { x: 0.8, y: 0.2 },
    });
    useSceneStore.getState().clearSnapPinCanvasPickResult();
    expect(useSceneStore.getState().snapPinCanvasPickResult).toBeNull();
  });

  it('assure la cohabitation sans collision entre Objet aimanté (+ Wandering + Marionnette) et Réceptacle quel que soit l’ordre', () => {
    const runScenario = (hookFirst: boolean) => {
      resetMatterPhysicsRuntime();

      const dogStates = {
        'dog-idle': { id: 'dog-idle', name: 'Repos', color: '#64748b', scale: 1, rotation: 0 },
        'dog-walk': { id: 'dog-walk', name: 'Balade', color: '#3b82f6', scale: 1, rotation: 0 },
        'dog-drag': { id: 'dog-drag', name: 'Porté', color: '#a855f7', scale: 1, rotation: 0 },
        'dog-release': { id: 'dog-release', name: 'Relâché', color: '#c084fc', scale: 1, rotation: 0 },
        'dog-snapped': { id: 'dog-snapped', name: 'Accroché', color: '#22c55e', scale: 1, rotation: 0 },
        'dog-pull': { id: 'dog-pull', name: 'Traction', color: '#f59e0b', scale: 1, rotation: 0 },
        'dog-free': { id: 'dog-free', name: 'Détaché', color: '#94a3b8', scale: 1, rotation: 0 },
      };
      const hookStates = {
        'hook-idle': { id: 'hook-idle', name: 'Vide', color: '#64748b', scale: 1, rotation: 0 },
        'hook-snapped': { id: 'hook-snapped', name: 'Occupé', color: '#22c55e', scale: 1, rotation: 0 },
        'hook-pull': { id: 'hook-pull', name: 'Tendu', color: '#f59e0b', scale: 1, rotation: 0 },
        'hook-free': { id: 'hook-free', name: 'Libéré', color: '#94a3b8', scale: 1, rotation: 0 },
      };

      const dog = makeEntity('dog', {
        position: { x: 205, y: 200 },
        currentStateId: 'dog-idle',
        states: dogStates,
        behaviors: [
          {
            id: 'dog-wander',
            type: 'wandering',
            enabled: true,
            mode: 'free_2d',
            radius: 150,
            speed: 140,
            randomness: 50,
            changeInterval: 1.5,
            pauseDuration: 0,
            stateBindings: {
              idleStateId: 'dog-idle',
              moveStateId: 'dog-walk',
            },
          },
          {
            id: 'dog-puppet',
            type: 'interactive_puppet',
            enabled: true,
            allowInterruptLocomotion: true,
            dragReleaseDuration: 0.2,
            stateBindings: {
              idleStateId: 'dog-idle',
              dragStateId: 'dog-drag',
              dragReleaseStateId: 'dog-release',
            },
          },
          {
            id: 'dog-snap',
            type: 'snap',
            enabled: true,
            snapRole: 'magnet_object',
            targetType: 'entity',
            targetEntityId: 'hook',
            snapTrigger: 'on_release',
            snapRadius: 50,
            snapMode: 'instant',
            snapAlignment: 'center',
            attachBehavior: 'position_only',
            allowPullUnsnap: true,
            unsnapDistance: 85,
            reSnapCooldownSec: 0.5,
            snappedStateId: 'dog-snapped',
            pullingStateId: 'dog-pull',
            unsnappedStateId: 'dog-free',
          },
        ],
      });

      const hook = makeEntity('hook', {
        position: { x: 200, y: 200 },
        currentStateId: 'hook-idle',
        states: hookStates,
        behaviors: [
          {
            id: 'hook-snap',
            type: 'snap',
            enabled: true,
            snapRole: 'receptacle',
            targetType: 'any',
            maxCapacity: 1,
            snapTrigger: 'always_when_near',
            snapRadius: 50,
            snapMode: 'instant',
            snapAlignment: 'center',
            attachBehavior: 'position_only',
            allowPullUnsnap: true,
            unsnapDistance: 85,
            snappedStateId: 'hook-snapped',
            pullingStateId: 'hook-pull',
            unsnappedStateId: 'hook-free',
          },
        ],
      });

      const buildEntities = (d: Entity, h: Entity): Record<string, Entity> =>
        hookFirst ? { hook: h, dog: d } : { dog: d, hook: h };

      const applyTick = (d: Entity, h: Entity) => {
        const res = stepMatterPhysics({
          entities: buildEntities(d, h),
          canvasBounds: { width: 800, height: 500 },
          deltaTime: 1 / 60,
        });
        const nextDog: Entity = {
          ...d,
          ...(res.updatedTransforms.dog?.position ? { position: res.updatedTransforms.dog.position } : {}),
          ...(res.stateChanges?.dog ? { currentStateId: res.stateChanges.dog } : {}),
        };
        const nextHook: Entity = {
          ...h,
          ...(res.updatedTransforms.hook?.position ? { position: res.updatedTransforms.hook.position } : {}),
          ...(res.stateChanges?.hook ? { currentStateId: res.stateChanges.hook } : {}),
        };
        return { res, nextDog, nextHook };
      };

      // 1. Pendant le drag près du crochet : Marionnette passe en dog-drag, Wandering est en pause,
      // et le réceptacle (even though always_when_near) n'écrase PAS l'objet aimanté configuré en on_release !
      setActiveDragPosition('dog', { x: 205, y: 200 });
      const dragTick = applyTick(dog, hook);
      expect(dragTick.nextDog.currentStateId).toBe('dog-drag');
      expect(dragTick.nextHook.currentStateId).toBe('hook-idle');

      // 2. Relâche du drag : dog (on_release) déclenche son snap -> dog-snapped ET hook-snapped !
      // Même si dragReleaseDuration est actif sur Marionnette, Snap prime.
      setActiveDragPosition('dog', null);
      let curDog = dragTick.nextDog;
      let curHook = dragTick.nextHook;
      const relTick = applyTick(curDog, curHook);
      curDog = relTick.nextDog;
      curHook = relTick.nextHook;
      expect(curDog.currentStateId).toBe('dog-snapped');
      // Si hookFirst est true, hook observe au tick suivant dès que dog s'est snappé après lui
      const stabilizeTick = applyTick(curDog, curHook);
      curDog = stabilizeTick.nextDog;
      curHook = stabilizeTick.nextHook;
      expect(curDog.currentStateId).toBe('dog-snapped');
      expect(curHook.currentStateId).toBe('hook-snapped');

      // Wandering doit rester en pause tant que dog est snappé (sa position reste verrouillée sur hook)
      const posBeforeWait = { ...curDog.position };
      for (let i = 0; i < 6; i++) {
        const t = applyTick(curDog, curHook);
        curDog = t.nextDog;
        curHook = t.nextHook;
      }
      expect(curDog.currentStateId).toBe('dog-snapped');
      expect(curHook.currentStateId).toBe('hook-snapped');
      expect(curDog.position.x).toBeCloseTo(posBeforeWait.x, 1);
      expect(curDog.position.y).toBeCloseTo(posBeforeWait.y, 1);

      // 3. Traction légère (< unsnapDistance 85) -> dog-pull ET hook-pull
      setActiveDragPosition('dog', { x: 230, y: 200 });
      const pullTick1 = applyTick(curDog, curHook);
      curDog = pullTick1.nextDog;
      curHook = pullTick1.nextHook;
      const pullTick2 = applyTick(curDog, curHook);
      curDog = pullTick2.nextDog;
      curHook = pullTick2.nextHook;
      expect(curDog.currentStateId).toBe('dog-pull');
      expect(curHook.currentStateId).toBe('hook-pull');

      // 4. Arrachement (> unsnapDistance 85) -> dog-free / hook-free puis Wandering reprend
      setActiveDragPosition('dog', { x: 320, y: 200 });
      const breakTick1 = applyTick(curDog, curHook);
      curDog = breakTick1.nextDog;
      curHook = breakTick1.nextHook;
      expect(curDog.currentStateId).toBe('dog-free');
      const breakTick2 = applyTick(curDog, curHook);
      curDog = breakTick2.nextDog;
      curHook = breakTick2.nextHook;
      expect(curHook.currentStateId).toBe('hook-free');

      // Relâche loin du crochet -> Wandering reprend la marche (dog-walk)
      setActiveDragPosition('dog', null);
      let resumedWalk = false;
      for (let i = 0; i < 10; i++) {
        const t = applyTick(curDog, curHook);
        curDog = t.nextDog;
        curHook = t.nextHook;
        if (curDog.currentStateId === 'dog-walk') {
          resumedWalk = true;
          break;
        }
      }
      expect(resumedWalk).toBe(true);
    };

    runScenario(true);
    runScenario(false);
  });

  it('empêche un Objet aimanté de se snapper sur un Réceptacle déjà à maxCapacity', () => {
    const hook = makeEntity('hook', {
      position: { x: 200, y: 200 },
      behaviors: [
        {
          id: 'hook-rec',
          type: 'snap',
          enabled: true,
          snapRole: 'receptacle',
          targetType: 'any',
          maxCapacity: 1,
          snapTrigger: 'always_when_near',
          snapRadius: 60,
          snapMode: 'instant',
          snapAlignment: 'center',
          attachBehavior: 'position_only',
        },
      ],
    });

    const dog1 = makeEntity('dog1', {
      position: { x: 202, y: 200 },
      behaviors: [
        {
          id: 'dog1-snap',
          type: 'snap',
          enabled: true,
          snapRole: 'magnet_object',
          targetType: 'entity',
          targetEntityId: 'hook',
          snapTrigger: 'always_when_near',
          snapRadius: 60,
          snapMode: 'instant',
          snapAlignment: 'center',
          attachBehavior: 'position_only',
        },
      ],
    });

    const dog2 = makeEntity('dog2', {
      position: { x: 204, y: 200 },
      behaviors: [
        {
          id: 'dog2-snap',
          type: 'snap',
          enabled: true,
          snapRole: 'magnet_object',
          targetType: 'entity',
          targetEntityId: 'hook',
          snapTrigger: 'always_when_near',
          snapRadius: 60,
          snapMode: 'instant',
          snapAlignment: 'center',
          attachBehavior: 'position_only',
        },
      ],
    });

    const res1 = stepMatterPhysics({
      entities: { dog1, hook, dog2 },
      canvasBounds: { width: 800, height: 500 },
      deltaTime: 1 / 60,
    });

    // dog1 occupe la seule place disponible sur hook -> dog2 ne doit pas pouvoir s'y snapper
    const enteredIds = (res1.snapEvents || []).filter((e) => e.phase === 'enter').map((e) => e.subjectId);
    expect(enteredIds).toEqual(['dog1']);
  });

  it('gère bidirectional_joint sans parentage (pré-attaché, entraînement mutuel libre, et arrachement si cible figée)', () => {
    resetMatterPhysicsRuntime();

    const makeBody = (id: string, x: number, y: number, isStatic: boolean) =>
      makeEntity(id, {
        position: { x, y },
        behaviors: [
          {
            id: `${id}-phys`,
            type: 'physics',
            enabled: true,
            isStatic,
            gravity: 0,
            mass: 1,
            bounce: 0,
            friction: 0.2,
          },
        ],
      });

    const headInit = makeEntity('head', {
      position: { x: 260, y: 200 },
      currentStateId: 'st-free',
      states: {
        'st-free': { id: 'st-free', name: 'Libre', color: '#64748b', scale: 1, rotation: 0 },
        'st-attached': { id: 'st-attached', name: 'Attaché', color: '#22c55e', scale: 1, rotation: 0 },
        'st-pull': { id: 'st-pull', name: 'Traction', color: '#f59e0b', scale: 1, rotation: 0 },
        'st-broken': { id: 'st-broken', name: 'Détaché', color: '#ef4444', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'head-phys',
          type: 'physics',
          enabled: true,
          isStatic: false,
          gravity: 0,
          mass: 1,
          bounce: 0,
          friction: 0.2,
        },
        {
          id: 'head-snap',
          type: 'snap',
          enabled: true,
          snapRole: 'magnet_object',
          targetType: 'entity',
          targetEntityId: 'body',
          snapTrigger: 'on_release',
          snapRadius: 48,
          snapMode: 'instant',
          snapAlignment: 'center',
          attachBehavior: 'bidirectional_joint',
          startAttachedAtInit: true,
          springStiffness: 0.85,
          springDamping: 0.25,
          allowPullUnsnap: true,
          unsnapDistance: 75,
          snappedStateId: 'st-attached',
          pullingStateId: 'st-pull',
          unsnappedStateId: 'st-broken',
        },
      ],
    });

    // Cas A : Le corps est dynamique/libre -> tirer la tête entraîne le corps sans parentId !
    let curHead = headInit;
    let curBody = makeBody('body', 200, 200, false);

    const stepEntities = () => {
      const res = stepMatterPhysics({
        entities: { head: curHead, body: curBody },
        canvasBounds: { width: 800, height: 600 },
        deltaTime: 1 / 60,
      });
      if (res.updatedTransforms.head?.position) {
        curHead = { ...curHead, position: res.updatedTransforms.head.position };
      }
      if (res.updatedTransforms.body?.position) {
        curBody = { ...curBody, position: res.updatedTransforms.body.position };
      }
      if (res.stateChanges?.head) {
        curHead = { ...curHead, currentStateId: res.stateChanges.head };
      }
      return res;
    };

    const t1 = stepEntities();
    // startAttachedAtInit doit aligner et passer à st-attached SANS aucune parentMutation
    expect(t1.snapParentMutations || []).toEqual([]);
    expect(curHead.parentId).toBeUndefined();
    expect(curHead.currentStateId).toBe('st-attached');
    expect(curHead.position.x).toBeCloseTo(200, 1);

    // On déplace la tête progressivement à droite -> le corps libre doit suivre !
    for (let i = 1; i <= 12; i++) {
      setActiveDragPosition('head', { x: 200 + i * 5, y: 200 });
      stepEntities();
    }
    setActiveDragPosition('head', null);
    expect(curBody.position.x).toBeGreaterThan(225);
    expect(curHead.currentStateId).not.toBe('st-broken');

    // Inversement : on déplace le corps -> la tête libre doit suivre !
    const headBeforeBodyDrag = curHead.position.x;
    for (let i = 1; i <= 12; i++) {
      setActiveDragPosition('body', { x: curBody.position.x + 5, y: 200 });
      stepEntities();
    }
    setActiveDragPosition('body', null);
    expect(curHead.position.x).toBeGreaterThan(headBeforeBodyDrag + 15);

    // Cas B : Le corps devient figé (isStatic: true) -> tirer la tête au-delà de unsnapDistance (75px) la détache !
    curBody = makeBody('body', curBody.position.x, curBody.position.y, true);
    setActiveDragPosition('head', { x: curBody.position.x + 110, y: 200 });
    const tBreak = stepEntities();
    setActiveDragPosition('head', null);
    expect(tBreak.snapEvents?.some((e) => e.phase === 'exit' && e.subjectId === 'head')).toBe(true);
    expect(curHead.currentStateId).toBe('st-broken');
    expect(curHead.parentId).toBeUndefined();
  });

  it('empêche l’explosion de colliders qui se chevauchent, autorise le drag cible sans physique, et propage le balancement marionnette', () => {
    resetMatterPhysicsRuntime();

    const makePart = (id: string, x: number, y: number, opts?: { withPhysics?: boolean; isHead?: boolean }) =>
      makeEntity(id, {
        position: { x, y },
        size: { width: 120, height: 120 },
        states: {
          default: { id: 'default', name: 'Normal', color: '#64748b', scale: 1, rotation: 0 },
        },
        behaviors: [
          ...(opts?.withPhysics
            ? [
                {
                  id: `${id}-phys`,
                  type: 'physics' as const,
                  enabled: true,
                  isStatic: false,
                  gravity: 0,
                  mass: 1,
                  bounce: 0.4,
                  friction: 0.4,
                },
              ]
            : []),
          ...(opts?.isHead
            ? [
                {
                  id: 'head-puppet',
                  type: 'interactive_puppet' as const,
                  enabled: true,
                  precisePhysicsGrab: false,
                  swingMode: 'both' as const,
                  pendulumMaxAngle: 35,
                },
                {
                  id: 'head-snap',
                  type: 'snap' as const,
                  enabled: true,
                  snapRole: 'magnet_object' as const,
                  targetType: 'entity' as const,
                  targetEntityId: 'body',
                  snapTrigger: 'on_release' as const,
                  snapRadius: 48,
                  snapMode: 'instant' as const,
                  snapAlignment: 'anchor_offset' as const,
                  sourceAnchor: 'bottom' as const,
                  targetAnchor: 'top' as const,
                  offsetX: 0,
                  offsetY: 30, // chevauchement volontaire de 30px entre tête et corps
                  attachBehavior: 'bidirectional_joint' as const,
                  startAttachedAtInit: true,
                  springStiffness: 0.75,
                  springDamping: 0.25,
                  allowPullUnsnap: true,
                  unsnapDistance: 80,
                },
              ]
            : []),
        ],
      });

    // Test 1 : Deux corps avec physique active et colliders qui se chevauchent de 30px ne doivent PAS exploser
    let headDyn = makePart('head', 200, 120, { withPhysics: true, isHead: true });
    let bodyDyn = makePart('body', 200, 210, { withPhysics: true });

    for (let i = 0; i < 20; i++) {
      const res = stepMatterPhysics({
        entities: { head: headDyn, body: bodyDyn },
        canvasBounds: { width: 800, height: 600 },
        deltaTime: 1 / 60,
      });
      if (res.updatedTransforms.head?.position) headDyn = { ...headDyn, position: res.updatedTransforms.head.position };
      if (res.updatedTransforms.body?.position) bodyDyn = { ...bodyDyn, position: res.updatedTransforms.body.position };
    }
    expect(Math.abs(headDyn.position.x - bodyDyn.position.x)).toBeLessThan(3);
    expect(Math.abs((headDyn.position.y + 120) - (bodyDyn.position.y + 30))).toBeLessThan(6);

    // Le corps sans composant Draggable/Puppet devient draggable en Play quand lié par bidirectional_joint
    const entitiesMap = { head: headDyn, body: bodyDyn };
    const isBiTarget = isActiveBidirectionalDragTarget('body', entitiesMap);
    expect(isBiTarget).toBe(true);
    expect(resolvePlayEntityDraggable(bodyDyn, bodyDyn.states.default, isBiTarget).canDrag).toBe(true);

    // Test 2 : Corps SANS physique (physics disabled) suit le déplacement ET le balancement (runtimeTilt) de la tête
    resetMatterPhysicsRuntime();
    let headNoPhys = makePart('head', 200, 120, { withPhysics: false, isHead: true });
    let bodyNoPhys = makePart('body', 200, 210, { withPhysics: false });

    const stepNoPhys = () => {
      const res = stepMatterPhysics({
        entities: { head: headNoPhys, body: bodyNoPhys },
        canvasBounds: { width: 800, height: 600 },
        deltaTime: 1 / 60,
      });
      if (res.updatedTransforms.head) {
        const p = res.updatedTransforms.head;
        headNoPhys = {
          ...headNoPhys,
          ...(p.position ? { position: p.position } : {}),
          ...(p.runtimeTilt !== undefined ? { runtimeTilt: p.runtimeTilt } : {}),
        };
      }
      if (res.updatedTransforms.body) {
        const p = res.updatedTransforms.body;
        bodyNoPhys = {
          ...bodyNoPhys,
          ...(p.position ? { position: p.position } : {}),
          ...(p.rotation !== undefined
            ? { states: { ...bodyNoPhys.states, default: { ...bodyNoPhys.states.default, rotation: p.rotation } } }
            : {}),
        };
      }
    };

    stepNoPhys();
    // Tirer rapidement la tête vers la droite génère du balancement (runtimeTilt) -> le corps sans physique doit suivre X et tourner
    for (let i = 1; i <= 15; i++) {
      setActiveDragPosition('head', { x: 200 + i * 10, y: 120 });
      stepNoPhys();
    }
    setActiveDragPosition('head', null);
    expect(bodyNoPhys.position.x).toBeGreaterThan(290);
    expect(Math.abs(bodyNoPhys.states.default.rotation || 0)).toBeGreaterThan(3);
  });
});
