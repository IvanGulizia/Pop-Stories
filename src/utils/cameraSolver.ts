import {
  CameraFollowMode,
  CameraRuntimeState,
  Entity,
  Position,
  RuleAction,
  SceneAspectRatio,
  SceneCameraConfig,
  Size,
} from '../types';

export const DEFAULT_SCENE_CAMERA_CONFIG: SceneCameraConfig = {
  worldMode: 'viewport',
  worldWidth: 1600,
  worldHeight: 900,
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
  playAspectRatio: 'inherit',
};

export interface SimpleCameraView {
  x: number;
  y: number;
  zoom: number;
}

export interface ActiveShakeImpulse {
  intensity: number;
  duration: number;
  elapsed: number;
  phaseOffset: number;
}

export interface CameraFollowTargetSpec {
  mode: CameraFollowMode;
  entityId?: string;
  entityType?: string;
  tag?: string;
}

export interface CameraControllerState {
  x: number;
  y: number;
  zoom: number;
  followOverride?: CameraFollowTargetSpec | null;
  moveAnim?: {
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
    elapsed: number;
    duration: number;
  } | null;
  zoomAnim?: {
    startZoom: number;
    targetZoom: number;
    elapsed: number;
    duration: number;
  } | null;
  shakes: ActiveShakeImpulse[];
}

export function clampCameraZoom(zoom: number | undefined): number {
  const z = Number.isFinite(zoom) ? (zoom as number) : 1;
  return Math.max(0.25, Math.min(3, Math.round(z * 1000) / 1000));
}

export function resolveEffectivePlayAspectRatio(
  editRatio: SceneAspectRatio,
  camera?: SceneCameraConfig
): SceneAspectRatio {
  if (!camera?.playAspectRatio || camera.playAspectRatio === 'inherit') {
    return editRatio;
  }
  return camera.playAspectRatio;
}

export function getAspectRatioNumeric(ratio: SceneAspectRatio): number | null {
  switch (ratio) {
    case '16:9':
      return 16 / 9;
    case '4:3':
      return 4 / 3;
    case '1:1':
      return 1;
    case '9:16':
      return 9 / 16;
    default:
      return null;
  }
}

export function fitAspectRatioSize(
  availWidth: number,
  availHeight: number,
  ratio: SceneAspectRatio
): Size {
  const safeW = Math.max(100, Math.floor(Number.isFinite(availWidth) ? availWidth : 800));
  const safeH = Math.max(100, Math.floor(Number.isFinite(availHeight) ? availHeight : 500));
  const targetRatio = getAspectRatioNumeric(ratio);
  if (!targetRatio) {
    return { width: safeW, height: safeH };
  }
  const currentRatio = safeW / safeH;
  if (currentRatio > targetRatio) {
    const height = safeH;
    const width = Math.max(100, Math.min(safeW, Math.round(height * targetRatio)));
    return { width, height };
  }
  const width = safeW;
  const height = Math.max(100, Math.min(safeH, Math.round(width / targetRatio)));
  return { width, height };
}

export function resolveWorldBounds(
  viewportBounds: Size,
  camera?: SceneCameraConfig,
  editViewportBounds?: Size
): Size {
  const vw = Math.max(100, Math.round(viewportBounds.width || 800));
  const vh = Math.max(100, Math.round(viewportBounds.height || 500));
  if (!camera || camera.worldMode !== 'custom') {
    const ew = Math.round(editViewportBounds?.width || 0);
    const eh = Math.round(editViewportBounds?.height || 0);
    return {
      width: Math.max(vw, ew),
      height: Math.max(vh, eh),
    };
  }
  const ww = Math.max(200, Math.round(camera.worldWidth || vw));
  const wh = Math.max(200, Math.round(camera.worldHeight || vh));
  return { width: ww, height: wh };
}

export function computeEditPlayCameraPreviewSize(
  editViewportSize: Size,
  outerWorkspaceSize: Size | null | undefined,
  editRatio: SceneAspectRatio,
  camera?: SceneCameraConfig
): Size {
  const effRatio = resolveEffectivePlayAspectRatio(editRatio, camera);
  const safeEditW = Math.max(100, Math.round(editViewportSize.width || 800));
  const safeEditH = Math.max(100, Math.round(editViewportSize.height || 500));
  const refSize =
    outerWorkspaceSize && outerWorkspaceSize.width > 120 && outerWorkspaceSize.height > 120
      ? fitAspectRatioSize(outerWorkspaceSize.width, outerWorkspaceSize.height, effRatio)
      : effRatio === editRatio
      ? { width: safeEditW, height: safeEditH }
      : fitAspectRatioSize(safeEditW, safeEditH, effRatio);
  const safeZoom = clampCameraZoom(camera?.zoom ?? 1);
  return {
    width: Math.max(80, Math.round(refSize.width / safeZoom)),
    height: Math.max(80, Math.round(refSize.height / safeZoom)),
  };
}

export function getVisibleWorldRect(
  camera: SimpleCameraView,
  viewport: Size
): { x: number; y: number; width: number; height: number } {
  const safeZoom = clampCameraZoom(camera.zoom);
  return {
    x: camera.x || 0,
    y: camera.y || 0,
    width: Math.max(100, viewport.width || 800) / safeZoom,
    height: Math.max(100, viewport.height || 500) / safeZoom,
  };
}

export function screenToWorldPoint(
  clientX: number,
  clientY: number,
  containerRect: { left: number; top: number },
  camera: SimpleCameraView
): Position {
  const safeZoom = Math.max(0.1, camera.zoom || 1);
  return {
    x: (clientX - containerRect.left) / safeZoom + (camera.x || 0),
    y: (clientY - containerRect.top) / safeZoom + (camera.y || 0),
  };
}

export function worldToScreenPoint(
  worldX: number,
  worldY: number,
  containerRect: { left: number; top: number },
  camera: SimpleCameraView
): Position {
  const safeZoom = Math.max(0.1, camera.zoom || 1);
  return {
    x: containerRect.left + (worldX - (camera.x || 0)) * safeZoom,
    y: containerRect.top + (worldY - (camera.y || 0)) * safeZoom,
  };
}

export function computeLayerParallaxTransform(
  camera: SimpleCameraView,
  parallaxFactor: number = 1
): string {
  const p = Number.isFinite(parallaxFactor) ? parallaxFactor : 1;
  if (p === 0) {
    return 'translate3d(0px, 0px, 0px)';
  }
  const safeZoom = clampCameraZoom(camera.zoom);
  const tx = -(camera.x || 0) * p;
  const ty = -(camera.y || 0) * p;
  return `scale(${safeZoom}) translate3d(${tx}px, ${ty}px, 0px)`;
}

export function computeWorldTransformCss(camera: SimpleCameraView): string {
  const safeZoom = clampCameraZoom(camera.zoom);
  return `scale(${safeZoom}) translate3d(${-(camera.x || 0)}px, ${-(camera.y || 0)}px, 0px)`;
}

export function isEntityVisibleInCameraViewport(
  entity: Pick<Entity, 'position' | 'size'>,
  camera: SimpleCameraView,
  viewport: Size,
  margin: number = 280
): boolean {
  const safeZoom = clampCameraZoom(camera.zoom);
  const visW = Math.max(100, viewport.width || 800) / safeZoom;
  const visH = Math.max(100, viewport.height || 500) / safeZoom;
  const minX = (camera.x || 0) - margin;
  const minY = (camera.y || 0) - margin;
  const maxX = (camera.x || 0) + visW + margin;
  const maxY = (camera.y || 0) + visH + margin;

  const ex1 = entity.position.x;
  const ey1 = entity.position.y;
  const ex2 = ex1 + Math.max(1, entity.size.width);
  const ey2 = ey1 + Math.max(1, entity.size.height);

  return ex2 >= minX && ex1 <= maxX && ey2 >= minY && ey1 <= maxY;
}

export function resolveCameraFollowTarget(
  entities: Record<string, Entity>,
  spec?: CameraFollowTargetSpec
): Entity | null {
  if (!spec || spec.mode === 'none') return null;
  const list = Object.values(entities);
  if (spec.mode === 'entity' && spec.entityId) {
    const ent = entities[spec.entityId];
    return ent && !ent.disabled ? ent : null;
  }
  if (spec.mode === 'type' && spec.entityType) {
    return list.find((e) => e.type === spec.entityType && e.visible !== false && !e.disabled) || null;
  }
  if (spec.mode === 'tag' && spec.tag) {
    const clean = spec.tag.trim().replace(/^#/, '').toLowerCase();
    if (!clean) return null;
    return (
      list.find(
        (e) =>
          e.visible !== false &&
          !e.disabled &&
          (e.tags || []).some((t) => t.trim().replace(/^#/, '').toLowerCase() === clean)
      ) || null
    );
  }
  return null;
}

export function getActiveCameraFollowTarget(
  entities: Record<string, Entity>,
  config?: SceneCameraConfig,
  followOverride?: CameraFollowTargetSpec | null
): Entity | null {
  const activeSpec: CameraFollowTargetSpec = followOverride || {
    mode: config?.followMode || 'none',
    entityId: config?.followEntityId,
    entityType: config?.followEntityType,
    tag: config?.followTag,
  };
  return resolveCameraFollowTarget(entities, activeSpec);
}

export function clampCameraPosition(
  x: number,
  y: number,
  zoom: number,
  viewport: Size,
  worldBounds: Size,
  clampToWorld: boolean = true
): Position {
  if (!clampToWorld) {
    return { x, y };
  }
  const safeZoom = clampCameraZoom(zoom);
  const visW = Math.max(100, viewport.width || 800) / safeZoom;
  const visH = Math.max(100, viewport.height || 500) / safeZoom;
  const maxX = Math.max(0, worldBounds.width - visW);
  const maxY = Math.max(0, worldBounds.height - visH);
  return {
    x: Math.max(0, Math.min(maxX, x)),
    y: Math.max(0, Math.min(maxY, y)),
  };
}

export function createInitialCameraControllerState(
  config?: SceneCameraConfig,
  viewport: Size = { width: 800, height: 500 },
  entities?: Record<string, Entity>
): CameraControllerState {
  const zoom = clampCameraZoom(config?.zoom ?? 1);
  const worldBounds = resolveWorldBounds(viewport, config);
  let startX = config?.initialX ?? 0;
  let startY = config?.initialY ?? 0;

  if (entities && config?.followMode && config.followMode !== 'none') {
    const target = resolveCameraFollowTarget(entities, {
      mode: config.followMode,
      entityId: config.followEntityId,
      entityType: config.followEntityType,
      tag: config.followTag,
    });
    if (target) {
      const visW = Math.max(100, viewport.width || 800) / zoom;
      const visH = Math.max(100, viewport.height || 500) / zoom;
      const axis = config.followAxis || 'both';
      const cx = target.position.x + target.size.width / 2 + (config.offsetX || 0);
      const cy = target.position.y + target.size.height / 2 + (config.offsetY || 0);
      if (axis !== 'vertical') startX = cx - visW / 2;
      if (axis !== 'horizontal') startY = cy - visH / 2;
    }
  }

  const clamped = clampCameraPosition(
    startX,
    startY,
    zoom,
    viewport,
    worldBounds,
    config?.clampToWorld !== false
  );

  return {
    x: clamped.x,
    y: clamped.y,
    zoom,
    followOverride: null,
    moveAnim: null,
    zoomAnim: null,
    shakes: [],
  };
}

export function stepCameraController(
  state: CameraControllerState,
  dt: number,
  entities: Record<string, Entity>,
  viewport: Size,
  worldBounds: Size,
  config?: SceneCameraConfig
): CameraRuntimeState {
  const safeDt = Math.max(0, Math.min(0.1, dt));
  const clampEnabled = config?.clampToWorld !== false;

  // 1. Zoom animation
  if (state.zoomAnim) {
    state.zoomAnim.elapsed += safeDt;
    const t =
      state.zoomAnim.duration <= 0.001
        ? 1
        : Math.min(1, state.zoomAnim.elapsed / state.zoomAnim.duration);
    const eased = 1 - Math.pow(1 - t, 3);
    state.zoom = clampCameraZoom(
      state.zoomAnim.startZoom + (state.zoomAnim.targetZoom - state.zoomAnim.startZoom) * eased
    );
    if (t >= 1) {
      state.zoomAnim = null;
    }
  }

  const visW = Math.max(100, viewport.width || 800) / Math.max(0.25, state.zoom);
  const visH = Math.max(100, viewport.height || 500) / Math.max(0.25, state.zoom);

  // 2. Programmatic move_to animation OR Follow target
  if (state.moveAnim) {
    state.moveAnim.elapsed += safeDt;
    const t =
      state.moveAnim.duration <= 0.001
        ? 1
        : Math.min(1, state.moveAnim.elapsed / state.moveAnim.duration);
    const eased = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
    state.x = state.moveAnim.startX + (state.moveAnim.targetX - state.moveAnim.startX) * eased;
    state.y = state.moveAnim.startY + (state.moveAnim.targetY - state.moveAnim.startY) * eased;
    if (t >= 1) {
      state.moveAnim = null;
    }
  } else {
    const activeFollowSpec: CameraFollowTargetSpec = state.followOverride || {
      mode: config?.followMode || 'none',
      entityId: config?.followEntityId,
      entityType: config?.followEntityType,
      tag: config?.followTag,
    };
    const target = resolveCameraFollowTarget(entities, activeFollowSpec);
    if (target) {
      const axis = config?.followAxis || 'both';
      const smoothing = Math.max(0.02, Math.min(1, config?.followSmoothing ?? 0.14));
      const deadX = Math.max(0, config?.deadzoneX ?? 0);
      const deadY = Math.max(0, config?.deadzoneY ?? 0);
      const offsetX = config?.offsetX ?? 0;
      const offsetY = config?.offsetY ?? 0;

      const targetCx = target.position.x + target.size.width / 2 + offsetX;
      const targetCy = target.position.y + target.size.height / 2 + offsetY;
      const camCx = state.x + visW / 2;
      const camCy = state.y + visH / 2;

      let goalX = state.x;
      let goalY = state.y;

      if (axis !== 'vertical') {
        const dx = targetCx - camCx;
        if (Math.abs(dx) > deadX / 2) {
          const adjustedCx = targetCx - Math.sign(dx) * (deadX / 2);
          goalX = adjustedCx - visW / 2;
        }
      }
      if (axis !== 'horizontal') {
        const dy = targetCy - camCy;
        if (Math.abs(dy) > deadY / 2) {
          const adjustedCy = targetCy - Math.sign(dy) * (deadY / 2);
          goalY = adjustedCy - visH / 2;
        }
      }

      const alpha =
        smoothing >= 0.99
          ? 1
          : 1 - Math.pow(1 - smoothing, Math.max(0.01, safeDt * 60));
      state.x += (goalX - state.x) * alpha;
      state.y += (goalY - state.y) * alpha;
    }
  }

  const clamped = clampCameraPosition(
    state.x,
    state.y,
    state.zoom,
    viewport,
    worldBounds,
    clampEnabled
  );
  state.x = clamped.x;
  state.y = clamped.y;

  // 3. Screen Shake composition
  let shakeX = 0;
  let shakeY = 0;
  let shakeRotation = 0;
  if (state.shakes.length > 0) {
    const remaining: ActiveShakeImpulse[] = [];
    for (const s of state.shakes) {
      s.elapsed += safeDt;
      if (s.elapsed < s.duration) {
        const progress = s.elapsed / Math.max(0.01, s.duration);
        const decay = (1 - progress) * (1 - progress);
        const amp = s.intensity * decay;
        const t = s.elapsed * 55 + s.phaseOffset;
        shakeX += Math.sin(t * 1.13) * amp;
        shakeY += Math.cos(t * 1.47 + 1.2) * amp;
        shakeRotation += Math.sin(t * 0.91 + 0.5) * Math.min(2.5, amp * 0.08);
        remaining.push(s);
      }
    }
    state.shakes = remaining;
  }

  return {
    x: Math.round(state.x * 100) / 100,
    y: Math.round(state.y * 100) / 100,
    zoom: state.zoom,
    shakeX: Math.round(shakeX * 100) / 100,
    shakeY: Math.round(shakeY * 100) / 100,
    shakeRotation: Math.round(shakeRotation * 1000) / 1000,
  };
}

export function applyCameraCommandToController(
  state: CameraControllerState,
  action: RuleAction,
  context: {
    subject?: Entity;
    target?: Entity;
    entities?: Record<string, Entity>;
    lastSpawnedId?: string | null;
  },
  viewport: Size,
  worldBounds: Size,
  config?: SceneCameraConfig
): void {
  const cmd = action.cameraCommand || 'shake';

  if (cmd === 'shake') {
    const intensity = Math.max(1, Math.min(80, action.cameraShakeIntensity ?? 12));
    const duration = Math.max(0.05, Math.min(5, action.cameraShakeDuration ?? 0.35));
    state.shakes.push({
      intensity,
      duration,
      elapsed: 0,
      phaseOffset: Math.random() * 100,
    });
    return;
  }

  if (cmd === 'zoom') {
    const targetZoom = clampCameraZoom(action.cameraZoom ?? 1.25);
    const duration = Math.max(0, Math.min(10, action.cameraDuration ?? 0.45));
    if (duration <= 0.02) {
      state.zoom = targetZoom;
      state.zoomAnim = null;
    } else {
      state.zoomAnim = {
        startZoom: state.zoom,
        targetZoom,
        elapsed: 0,
        duration,
      };
    }
    return;
  }

  if (cmd === 'follow') {
    state.moveAnim = null;
    const mode = action.cameraFollowMode || 'entity';
    if (mode === 'none') {
      state.followOverride = { mode: 'none' };
      return;
    }
    const targetMode = action.cameraTargetMode || 'subject';
    let resolvedId = action.cameraTargetId;
    if (targetMode === 'subject' && context.subject) {
      resolvedId = context.subject.id;
    } else if (targetMode === 'target' && context.target) {
      resolvedId = context.target.id;
    } else if (targetMode === 'last_spawned' && context.lastSpawnedId) {
      resolvedId = context.lastSpawnedId;
    }

    if (mode === 'type') {
      state.followOverride = { mode: 'type', entityType: action.cameraTargetType };
    } else if (mode === 'tag') {
      state.followOverride = { mode: 'tag', tag: action.cameraTargetTag };
    } else if (resolvedId) {
      state.followOverride = { mode: 'entity', entityId: resolvedId };
    }
    return;
  }

  if (cmd === 'move_to') {
    const visW = Math.max(100, viewport.width || 800) / Math.max(0.25, state.zoom);
    const visH = Math.max(100, viewport.height || 500) / Math.max(0.25, state.zoom);
    let rawTargetX = action.cameraPosition?.x ?? state.x;
    let rawTargetY = action.cameraPosition?.y ?? state.y;

    if (!action.cameraPosition && action.cameraTargetMode) {
      let ent: Entity | undefined;
      if (action.cameraTargetMode === 'subject') ent = context.subject;
      else if (action.cameraTargetMode === 'target') ent = context.target;
      else if (action.cameraTargetMode === 'entity' && action.cameraTargetId) {
        ent = context.entities?.[action.cameraTargetId];
      } else if (action.cameraTargetMode === 'last_spawned' && context.lastSpawnedId) {
        ent = context.entities?.[context.lastSpawnedId];
      }
      if (ent) {
        rawTargetX = ent.position.x + ent.size.width / 2 - visW / 2;
        rawTargetY = ent.position.y + ent.size.height / 2 - visH / 2;
      }
    }

    const clamped = clampCameraPosition(
      rawTargetX,
      rawTargetY,
      state.zoom,
      viewport,
      worldBounds,
      config?.clampToWorld !== false
    );
    const duration = Math.max(0, Math.min(10, action.cameraDuration ?? 0.5));
    state.followOverride = { mode: 'none' };
    if (duration <= 0.02) {
      state.x = clamped.x;
      state.y = clamped.y;
      state.moveAnim = null;
    } else {
      state.moveAnim = {
        startX: state.x,
        startY: state.y,
        targetX: clamped.x,
        targetY: clamped.y,
        elapsed: 0,
        duration,
      };
    }
    return;
  }

  if (cmd === 'reset') {
    const initial = createInitialCameraControllerState(config, viewport, context.entities);
    const duration = Math.max(0, Math.min(10, action.cameraDuration ?? 0.4));
    state.followOverride = null;
    if (duration <= 0.02) {
      state.x = initial.x;
      state.y = initial.y;
      state.zoom = initial.zoom;
      state.moveAnim = null;
      state.zoomAnim = null;
    } else {
      state.moveAnim = {
        startX: state.x,
        startY: state.y,
        targetX: initial.x,
        targetY: initial.y,
        elapsed: 0,
        duration,
      };
      state.zoomAnim = {
        startZoom: state.zoom,
        targetZoom: initial.zoom,
        elapsed: 0,
        duration,
      };
    }
  }
}
