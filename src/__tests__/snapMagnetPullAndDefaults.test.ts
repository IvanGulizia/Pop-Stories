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
  resetMatterPhysicsRuntime,
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
});
