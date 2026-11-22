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
  entities?: Record<string, Entity>,
  editBounds?: Size
): CameraRuntimeState {
  controllerState = createInitialCameraControllerState(config, viewport, entities);
  if (editBounds) {
    const worldBounds = resolveWorldBounds(viewport, config, editBounds);
    controllerState = createInitialCameraControllerState(
      config ? { ...config, worldMode: config.worldMode || 'viewport' } : undefined,
      viewport,
      entities
    );
    const clamped = {
      x: Math.max(0, Math.min(Math.max(0, worldBounds.width - viewport.width / Math.max(0.25, controllerState.zoom)), controllerState.x)),
      y: Math.max(0, Math.min(Math.max(0, worldBounds.height - viewport.height / Math.max(0.25, controllerState.zoom)), controllerState.y)),
    };
    if (config?.clampToWorld !== false) {
      controllerState.x = clamped.x;
      controllerState.y = clamped.y;
    }
  }
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
  config?: SceneCameraConfig,
  editBounds?: Size
): CameraRuntimeState {
  const worldBounds = resolveWorldBounds(viewport, config, editBounds);
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
  config?: SceneCameraConfig,
  editBounds?: Size
): void {
  const worldBounds = resolveWorldBounds(viewport, config, editBounds);
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
