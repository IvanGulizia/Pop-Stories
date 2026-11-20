import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useSceneStore } from '../store/useSceneStore';
import { clearTriggerGateState, resetPlaySessionClock } from '../store/triggerGate';
import {
  applyCameraCommandToController,
  computeLayerParallaxTransform,
  createInitialCameraControllerState,
  isEntityVisibleInCameraViewport,
  resolveWorldBounds,
  screenToWorldPoint,
  stepCameraController,
  worldToScreenPoint,
} from '../utils/cameraSolver';
import {
  getPlayCameraRuntime,
  initPlayCameraRuntime,
  resetPlayCameraRuntime,
  stepPlayCameraRuntime,
} from '../utils/cameraRuntime';
import { Entity, SceneCameraConfig, SceneTransitionType } from '../types';

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
    },
  };
}

describe('Camera 2D Solver, Coordinates, Parallax & Culling', () => {
  it('resolves worldBounds in viewport vs custom mode', () => {
    expect(resolveWorldBounds({ width: 900, height: 550 })).toEqual({ width: 900, height: 550 });
    expect(
      resolveWorldBounds(
        { width: 900, height: 550 },
        {
          worldMode: 'custom',
          worldWidth: 2400,
          worldHeight: 1200,
          followMode: 'none',
          followAxis: 'both',
          followSmoothing: 0.14,
          deadzoneX: 0,
          deadzoneY: 0,
          offsetX: 0,
          offsetY: 0,
          clampToWorld: true,
          zoom: 1,
          initialX: 0,
          initialY: 0,
          showWorldBoundsInEdit: true,
        }
      )
    ).toEqual({ width: 2400, height: 1200 });
  });

  it('converts screenToWorldPoint and worldToScreenPoint symmetrically under zoom & pan', () => {
    const rect = { left: 120, top: 80 };
    const camera = { x: 250, y: 140, zoom: 1.5 };
    const worldPt = screenToWorldPoint(420, 380, rect, camera);
    expect(worldPt.x).toBeCloseTo(250 + (420 - 120) / 1.5, 4);
    expect(worldPt.y).toBeCloseTo(140 + (380 - 80) / 1.5, 4);

    const screenBack = worldToScreenPoint(worldPt.x, worldPt.y, rect, camera);
    expect(screenBack.x).toBeCloseTo(420, 4);
    expect(screenBack.y).toBeCloseTo(380, 4);
  });

  it('computes parallax transforms correctly for factor 0, 0.5 and 1', () => {
    expect(computeLayerParallaxTransform({ x: 300, y: 120, zoom: 1.5 }, 0)).toBe(
      'translate3d(0px, 0px, 0px)'
    );
    expect(computeLayerParallaxTransform({ x: 200, y: 100, zoom: 1.25 }, 0.5)).toBe(
      'scale(1.25) translate3d(-100px, -50px, 0px)'
    );
    expect(computeLayerParallaxTransform({ x: 200, y: 100, zoom: 2 }, 1)).toBe(
      'scale(2) translate3d(-200px, -100px, 0px)'
    );
  });

  it('culls entities strictly outside viewport+margin and preserves visible ones', () => {
    const nearEnt = makeTestEntity('near', 'hero', 450, 200);
    const farEnt = makeTestEntity('far', 'hero', 1900, 200);
    const cam = { x: 300, y: 0, zoom: 1 };
    const viewport = { width: 800, height: 500 };

    expect(isEntityVisibleInCameraViewport(nearEnt, cam, viewport, 280)).toBe(true);
    expect(isEntityVisibleInCameraViewport(farEnt, cam, viewport, 280)).toBe(false);
  });

  it('steps follow with deadzone/clamping, shake decay, zoom animation, move_to and reset', () => {
    const hero = makeTestEntity('hero-cam', 'hero', 1000, 450);
    const entities = { [hero.id]: hero };
    const viewport = { width: 800, height: 500 };
    const worldBounds = { width: 2000, height: 1000 };
    const config: SceneCameraConfig = {
      worldMode: 'custom',
      worldWidth: 2000,
      worldHeight: 1000,
      followMode: 'entity',
      followEntityId: hero.id,
      followAxis: 'both',
      followSmoothing: 0.5,
      deadzoneX: 120,
      deadzoneY: 80,
      offsetX: 0,
      offsetY: 0,
      clampToWorld: true,
      zoom: 1,
      initialX: 0,
      initialY: 0,
      showWorldBoundsInEdit: true,
    };

    const ctrl = createInitialCameraControllerState(config, viewport, entities);
    // Hero starts centered in camera: (1030 - 400, 480 - 250) = (630, 230)
    expect(ctrl.x).toBeCloseTo(630, 1);
    expect(ctrl.y).toBeCloseTo(230, 1);

    // Small movement inside deadzone (±60px) does not move camera
    hero.position.x = 1020;
    const rtInside = stepCameraController(ctrl, 0.016, entities, viewport, worldBounds, config);
    expect(rtInside.x).toBeCloseTo(630, 1);

    // Large movement outside deadzone shifts camera smoothly & clamps at maxX (1200)
    hero.position.x = 1900;
    for (let i = 0; i < 20; i++) {
      stepCameraController(ctrl, 0.016, entities, viewport, worldBounds, config);
    }
    expect(ctrl.x).toBeGreaterThan(700);
    expect(ctrl.x).toBeLessThanOrEqual(1200);

    // Screen Shake produces non-zero offset initially, then decays to 0
    applyCameraCommandToController(
      ctrl,
      { id: 'shk', type: 'camera_action', cameraCommand: 'shake', cameraShakeIntensity: 20, cameraShakeDuration: 0.2 },
      { entities },
      viewport,
      worldBounds,
      config
    );
    const rtShakeStart = stepCameraController(ctrl, 0.02, entities, viewport, worldBounds, config);
    expect(Math.abs(rtShakeStart.shakeX) + Math.abs(rtShakeStart.shakeY)).toBeGreaterThan(0);

    for (let i = 0; i < 15; i++) {
      stepCameraController(ctrl, 0.02, entities, viewport, worldBounds, config);
    }
    const rtShakeEnd = stepCameraController(ctrl, 0.02, entities, viewport, worldBounds, config);
    expect(rtShakeEnd.shakeX).toBe(0);
    expect(rtShakeEnd.shakeY).toBe(0);

    // Zoom animation interpolates cleanly
    applyCameraCommandToController(
      ctrl,
      { id: 'zm', type: 'camera_action', cameraCommand: 'zoom', cameraZoom: 2, cameraDuration: 0.2 },
      { entities },
      viewport,
      worldBounds,
      config
    );
    stepCameraController(ctrl, 0.1, entities, viewport, worldBounds, config);
    expect(ctrl.zoom).toBeGreaterThan(1.2);
    expect(ctrl.zoom).toBeLessThan(2);
    stepCameraController(ctrl, 0.15, entities, viewport, worldBounds, config);
    expect(ctrl.zoom).toBe(2);

    // Move_to world position then reset back to initial config
    applyCameraCommandToController(
      ctrl,
      { id: 'mv', type: 'camera_action', cameraCommand: 'move_to', cameraPosition: { x: 100, y: 50 }, cameraDuration: 0 },
      { entities },
      viewport,
      worldBounds,
      config
    );
    expect(ctrl.x).toBe(100);
    expect(ctrl.y).toBe(50);

    applyCameraCommandToController(
      ctrl,
      { id: 'rst', type: 'camera_action', cameraCommand: 'reset', cameraDuration: 0 },
      { entities },
      viewport,
      worldBounds,
      config
    );
    expect(ctrl.zoom).toBe(1);
  });
});

describe('Scene Camera Persistence, Extended World Boundary, Camera Actions & 12 Transitions', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-20T12:00:00Z'));
    clearTriggerGateState();
    resetPlaySessionClock();
    resetPlayCameraRuntime();
    useSceneStore.getState().clearProject();
  });

  afterEach(() => {
    useSceneStore.getState().setAppMode('edit');
    vi.useRealTimers();
  });

  it('isolates per-scene camera configs, duplicates scenes cleanly, and preserves camera & parallaxFactor on export/import', () => {
    useSceneStore.getState().updateSceneCamera({
      worldMode: 'custom',
      worldWidth: 2400,
      worldHeight: 1100,
      zoom: 1.4,
      followMode: 'type',
      followEntityType: 'hero',
    });

    // Set parallaxFactor on a layer in scene 1
    const groups = useSceneStore.getState().layerGroups;
    const targetLayer = groups.flatMap((g) => g.layers)[0];
    expect(targetLayer).toBeDefined();
    useSceneStore.getState().updateLayer(targetLayer.id, { parallaxFactor: 0.35 });

    const s2 = useSceneStore.getState().createScene('Niveau Panoramique');
    expect(useSceneStore.getState().camera.worldMode).toBe('viewport');
    expect(useSceneStore.getState().camera.zoom).toBe(1);

    useSceneStore.getState().switchScene('scene-1');
    expect(useSceneStore.getState().camera.worldWidth).toBe(2400);
    expect(useSceneStore.getState().camera.zoom).toBe(1.4);

    const dupId = useSceneStore.getState().duplicateScene('scene-1');
    expect(useSceneStore.getState().camera.worldWidth).toBe(2400);
    expect(useSceneStore.getState().camera.followEntityType).toBe('hero');

    const exported = useSceneStore.getState().exportProject();
    useSceneStore.getState().clearProject();
    const res = useSceneStore.getState().importProject(exported);
    expect(res.success).toBe(true);
    expect(useSceneStore.getState().activeSceneId).toBe(dupId);
    expect(useSceneStore.getState().camera.worldWidth).toBe(2400);

    useSceneStore.getState().switchScene('scene-1');
    const restoredLayer = useSceneStore
      .getState()
      .layerGroups.flatMap((g) => g.layers)
      .find((l) => l.id === targetLayer.id);
    expect(restoredLayer?.parallaxFactor).toBe(0.35);

    useSceneStore.getState().switchScene(s2);
    expect(useSceneStore.getState().camera.worldMode).toBe('viewport');
  });

  it('evaluates boundary rules against extended custom worldBounds instead of viewport size', () => {
    const runner = makeTestEntity('runner-w', 'runner', 780, 100);
    useSceneStore.setState({
      entities: { [runner.id]: runner },
      entityOrder: [runner.id],
      sceneBounds: { width: 800, height: 500 },
      initialGameVariables: { score: 0, edgeHit: 0 },
    });

    useSceneStore.getState().updateSceneCamera({
      worldMode: 'custom',
      worldWidth: 2000,
      worldHeight: 900,
    });

    useSceneStore.getState().addRule({
      name: 'World right edge rule',
      enabled: true,
      trigger: {
        type: 'boundary',
        subjectMode: 'instance',
        subjectId: runner.id,
        boundaryEdge: 'right',
      },
      actions: [
        {
          id: 'act-edge-hit',
          type: 'set_variable',
          variableName: 'edgeHit',
          variableOperation: 'add',
          variableValue: 1,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');

    // At x=780 (past viewport 800, inside world 2000) -> must NOT fire boundary
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: 780, y: 100 } });
    expect(useSceneStore.getState().gameVariables.edgeHit).toBe(0);

    // At x=1950 (1950 + 60 = 2010 >= 2000) -> fires boundary against extended world!
    useSceneStore.getState().evaluateRulesWithTemp({ [runner.id]: { x: 1950, y: 100 } });
    expect(useSceneStore.getState().gameVariables.edgeHit).toBe(1);
  });

  it('executes camera_action rules (shake & zoom) and drives Play camera runtime', () => {
    const btn = makeTestEntity('btn-cam', 'button', 120, 120);
    useSceneStore.setState({
      entities: { [btn.id]: btn },
      entityOrder: [btn.id],
      sceneBounds: { width: 800, height: 500 },
    });

    useSceneStore.getState().addRule({
      name: 'Trigger Shake & Zoom',
      enabled: true,
      trigger: {
        type: 'click',
        subjectMode: 'instance',
        subjectId: btn.id,
      },
      actions: [
        {
          id: 'act-cam-shake',
          type: 'camera_action',
          cameraCommand: 'shake',
          cameraShakeIntensity: 18,
          cameraShakeDuration: 0.3,
        },
        {
          id: 'act-cam-zoom',
          type: 'camera_action',
          cameraCommand: 'zoom',
          cameraZoom: 1.6,
          cameraDuration: 0,
        },
      ],
    });

    useSceneStore.getState().setAppMode('play');
    initPlayCameraRuntime(useSceneStore.getState().camera, { width: 800, height: 500 }, useSceneStore.getState().entities);

    useSceneStore.getState().triggerPointerEvent(btn.id, 'click');
    const rt = stepPlayCameraRuntime(
      0.016,
      useSceneStore.getState().entities,
      { width: 800, height: 500 },
      useSceneStore.getState().camera
    );

    expect(rt.zoom).toBe(1.6);
    expect(Math.abs(rt.shakeX) + Math.abs(rt.shakeY)).toBeGreaterThan(0);
    expect(getPlayCameraRuntime().zoom).toBe(1.6);
  });

  it('supports extended scene transitions including fade_white, curtain, wipe_left, slide_up, iris_white and zoom_fade', () => {
    const transitions: SceneTransitionType[] = [
      'fade_white',
      'slide_up',
      'slide_down',
      'iris_white',
      'wipe_left',
      'curtain',
      'zoom_fade',
    ];

    const s2 = useSceneStore.getState().createScene('Destination');
    useSceneStore.getState().switchScene('scene-1');
    useSceneStore.getState().setAppMode('play');

    for (const trans of transitions) {
      const target = useSceneStore.getState().activeSceneId === 'scene-1' ? s2 : 'scene-1';
      useSceneStore.getState().changeSceneInPlay(target, trans, 0.3);
      expect(useSceneStore.getState().activeSceneTransition?.type).toBe(trans);
      expect(useSceneStore.getState().activeSceneTransition?.phase).toBe('out');

      vi.advanceTimersByTime(160);
      expect(useSceneStore.getState().activeSceneId).toBe(target);
      expect(useSceneStore.getState().activeSceneTransition?.phase).toBe('in');

      vi.advanceTimersByTime(160);
      expect(useSceneStore.getState().activeSceneTransition).toBeNull();
    }
  });
});
