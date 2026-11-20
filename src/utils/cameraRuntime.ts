import { AppMode, CameraRuntimeState, Entity, RuleAction, SceneCameraConfig, Size } from '../types';
import {
  applyCameraCommandToController,
  CameraControllerState,
  createInitialCameraControllerState,
  resolveWorldBounds,
  SimpleCameraView,
  stepCameraController,
} from './cameraSolver';

let controllerState: CameraControllerState = createInitialCameraControllerState();
let latestPlayCamera: CameraRuntimeState = {
  x: 0,
  y: 0,
  zoom: 1,
  shakeX: 0,
  shakeY: 0,
  shakeRotation: 0,
};

export function initPlayCameraRuntime(
  config?: SceneCameraConfig,
  viewport: Size = { width: 800, height: 500 },
  entities?: Record<string, Entity>
): CameraRuntimeState {
  controllerState = createInitialCameraControllerState(config, viewport, entities);
  latestPlayCamera = {
    x: controllerState.x,
    y: controllerState.y,
    zoom: controllerState.zoom,
    shakeX: 0,
    shakeY: 0,
    shakeRotation: 0,
  };
  return latestPlayCamera;
}

export function resetPlayCameraRuntime(): void {
  controllerState = createInitialCameraControllerState();
  latestPlayCamera = {
    x: 0,
    y: 0,
    zoom: 1,
    shakeX: 0,
    shakeY: 0,
    shakeRotation: 0,
  };
}

export function stepPlayCameraRuntime(
  dt: number,
  entities: Record<string, Entity>,
  viewport: Size,
  config?: SceneCameraConfig
): CameraRuntimeState {
  const worldBounds = resolveWorldBounds(viewport, config);
  latestPlayCamera = stepCameraController(
    controllerState,
    dt,
    entities,
    viewport,
    worldBounds,
    config
  );
  return latestPlayCamera;
}

export function dispatchPlayCameraAction(
  action: RuleAction,
  context: {
    subject?: Entity;
    target?: Entity;
    entities?: Record<string, Entity>;
    lastSpawnedId?: string | null;
  },
  viewport: Size,
  config?: SceneCameraConfig
): void {
  const worldBounds = resolveWorldBounds(viewport, config);
  applyCameraCommandToController(controllerState, action, context, viewport, worldBounds, config);
}

export function getPlayCameraRuntime(): CameraRuntimeState {
  return latestPlayCamera;
}

export function getActiveCameraView(
  appMode: AppMode,
  editorCamera?: SimpleCameraView
): SimpleCameraView {
  if (appMode === 'play') {
    return {
      x: latestPlayCamera.x,
      y: latestPlayCamera.y,
      zoom: latestPlayCamera.zoom,
    };
  }
  return {
    x: editorCamera?.x ?? 0,
    y: editorCamera?.y ?? 0,
    zoom: editorCamera?.zoom ?? 1,
  };
}
