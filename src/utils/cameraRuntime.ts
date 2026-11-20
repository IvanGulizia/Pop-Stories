import { AppMode, CameraRuntimeState, Entity, RuleAction, SceneCameraConfig, Size } from '../types';
import {
  applyCameraCommandToController,
  CameraControllerState,
  createInitialCameraControllerState,
  getActiveCameraFollowTarget,
  getVisibleWorldRect,
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
let lastEmittedFollowTargetId: string | null = null;
let pendingFollowTargetId: string | null = null;

function syncFollowTargetChange(
  entities?: Record<string, Entity>,
  config?: SceneCameraConfig
): void {
  if (!entities) return;
  const target = getActiveCameraFollowTarget(entities, config, controllerState.followOverride);
  const nextId = target ? target.id : null;
  if (nextId !== lastEmittedFollowTargetId) {
    lastEmittedFollowTargetId = nextId;
    if (nextId) {
      pendingFollowTargetId = nextId;
    }
  }
}

export function initPlayCameraRuntime(
  config?: SceneCameraConfig,
  viewport: Size = { width: 800, height: 500 },
  entities?: Record<string, Entity>
): CameraRuntimeState {
  controllerState = createInitialCameraControllerState(config, viewport, entities);
  lastEmittedFollowTargetId = null;
  pendingFollowTargetId = null;
  syncFollowTargetChange(entities, config);
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
  lastEmittedFollowTargetId = null;
  pendingFollowTargetId = null;
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
  syncFollowTargetChange(entities, config);
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
  syncFollowTargetChange(context.entities, config);
}

export function consumePlayCameraFollowChange(): string | null {
  const id = pendingFollowTargetId;
  pendingFollowTargetId = null;
  return id;
}

export function getPlayCameraFollowTargetId(): string | null {
  return lastEmittedFollowTargetId;
}

export function getPlayVisibleViewportRect(viewport: Size): {
  x: number;
  y: number;
  width: number;
  height: number;
} {
  return getVisibleWorldRect(
    {
      x: latestPlayCamera.x,
      y: latestPlayCamera.y,
      zoom: latestPlayCamera.zoom,
    },
    viewport
  );
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
