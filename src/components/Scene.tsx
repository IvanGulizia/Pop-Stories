import { useState, useRef, useEffect, useCallback } from 'react';
import { MotionConfig } from 'motion/react';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../store/useSceneStore';
import { RotateDragBehaviorConfig, SliderBehaviorConfig, VectorPath } from '../types';
import { Apple } from './Apple';
import { Plant } from './Plant';
import { CustomShape } from './CustomShape';
import {
  Sparkles,
  Paintbrush,
  Undo2,
  Redo2,
  Trash2,
  Grid,
  Magnet,
  Check,
  Copy,
  Shield,
  Layers,
  X,
  Lock,
  Crosshair,
} from 'lucide-react';
import { ParticleCanvasOverlay } from './ParticleCanvasOverlay';
import { SceneGizmoOverlay } from './SceneGizmoOverlay';
import {
  clampCameraZoom,
  computeLayerParallaxTransform,
  computeWorldTransformCss,
  DEFAULT_SCENE_CAMERA_CONFIG,
  resolveWorldBounds,
  screenToWorldPoint,
} from '../utils/cameraSolver';
import {
  consumePlayCameraFollowChange,
  getActiveCameraView,
  getPlayVisibleViewportRect,
  stepPlayCameraRuntime,
} from '../utils/cameraRuntime';
import { getTransitionSnapshot } from '../utils/transitionSnapshotCache';
import {
  stepMatterPhysics,
  startKeyboardListening,
  stopKeyboardListening,
  getEffectiveBehaviors,
  getGizmoRuntimeDebugData,
} from '../utils/matterPhysicsEngine';
import { getSliderTrackGeometry } from '../utils/physics/sliderSolver';
import { getRotateDragBounds } from '../utils/physics/rotateDragSolver';
import { getPivotWorldPosition, resolveEffectivePivot } from '../utils/physics/pivotHelpers';
import { applyBucketFill } from '../utils/floodFill';
import {
  generateRoundedRectPath,
  generateCirclePath,
  generateCirclePerimeterPoints,
  generateLinePath,
  pointsToSmoothPath,
  pointsToPolylinePath,
  getPathBounds,
  getSelectionBoundingBox,
  isPointNearPath,
  translatePath,
  resizeShapeToRect,
  erasePathsAtPoint,
  eraseWholeStrokesAtPoint,
  findPathStrokeAtPoint,
} from '../utils/vectorDrawing';
import { getChildAttachmentPinWorld } from '../store/parentingHelpers';

export const FINE_CROSSHAIR_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAYAAAByUDbMAAAAN0lEQVR4nGNgIAD+IwFCagkCkCH84lqjho08w/4TAWCGEQJwmynFcMOo5rLBGwGjhg0Bw4hNRwArM0of2vmpUwAAAABJRU5ErkJggg==") 9 9, crosshair';

interface SceneProps {
  onOpenCreateModal?: () => void;
}

export function Scene({ onOpenCreateModal }: SceneProps) {
  const entities = useSceneStore((state) => state.entities);
  const entityOrder = useSceneStore((state) => state.entityOrder);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectedLayerId = useSceneStore((state) => state.selectedLayerId);
  const setLayerVectorPaths = useSceneStore((state) => state.setLayerVectorPaths);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const settings = useSceneStore((state) => state.settings);
  const appMode = useSceneStore((state) => state.appMode);
  const gameScore = useSceneStore((state) => state.gameScore);
  const backgroundColor = useSceneStore((state) => state.backgroundColor || '#ffffff');
  const cameraConfig = useSceneStore((state) => state.camera || DEFAULT_SCENE_CAMERA_CONFIG);
  const editorCamera = useSceneStore((state) => state.editorCamera);
  const setEditorCamera = useSceneStore((state) => state.setEditorCamera);
  const isPanToolActive = useSceneStore((state) => state.editorPanToolActive);
  const sceneBounds = useSceneStore((state) => state.sceneBounds);
  const activeSceneTransition = useSceneStore((state) => state.activeSceneTransition);
  const [transitionEngaged, setTransitionEngaged] = useState(false);

  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isPanning, setIsPanning] = useState(false);

  useEffect(() => {
    if (!activeSceneTransition) {
      setTransitionEngaged(false);
      return;
    }
    setTransitionEngaged(false);
    const raf = window.requestAnimationFrame(() => {
      setTransitionEngaged(true);
    });
    return () => window.cancelAnimationFrame(raf);
  }, [activeSceneTransition?.id, activeSceneTransition?.phase]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      if (useSceneStore.getState().appMode === 'play') return;
      setIsSpacePressed(true);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setIsSpacePressed(false);
    };
    const onBlur = () => setIsSpacePressed(false);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  const hasEntitiesOnCanvas = Object.keys(entities).length > 0;
  const hasArchetypesInCatalog = Object.keys(customArchetypes).length > 0;
  const isCompletelyEmptyProject = !hasEntitiesOnCanvas && !hasArchetypesInCatalog;

  const worldBounds = resolveWorldBounds(sceneBounds, cameraConfig);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.kind === 'entity-archetype' && data.entityType) {
        const rect = e.currentTarget.getBoundingClientRect();
        const cam = getActiveCameraView(useSceneStore.getState().appMode, editorCamera);
        const worldPt = screenToWorldPoint(e.clientX, e.clientY, rect, cam);
        const dropX = Math.max(0, Math.min(worldBounds.width - 60, Math.round(worldPt.x - 40)));
        const dropY = Math.max(0, Math.min(worldBounds.height - 60, Math.round(worldPt.y - 40)));

        spawnEntity({
          type: data.entityType,
          position: { x: dropX, y: dropY },
        });
      }
    } catch (err) {
      console.error('Error handling drop on scene:', err);
    }
  };

  // Background pattern calculations
  const getGridStyle = () => {
    if (!settings.showGrid || settings.gridStyle === 'clean') return {};
    if (settings.gridStyle === 'lines') {
      return {
        backgroundImage: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 0.15,
      };
    }
    // 'dots'
    return {
      backgroundImage: 'radial-gradient(#334155 1.5px, transparent 1.5px)',
      backgroundSize: '24px 24px',
      opacity: 0.08,
    };
  };

  const spawnCanvasPick = useSceneStore((state) => state.spawnCanvasPick);
  const updateSpawnCanvasPickSnap = useSceneStore((state) => state.updateSpawnCanvasPickSnap);
  const completeSpawnCanvasPick = useSceneStore((state) => state.completeSpawnCanvasPick);
  const cancelSpawnCanvasPick = useSceneStore((state) => state.cancelSpawnCanvasPick);
  const jointCanvasPick = useSceneStore((state) => state.jointCanvasPick);
  const completeJointCanvasPick = useSceneStore((state) => state.completeJointCanvasPick);
  const cancelJointCanvasPick = useSceneStore((state) => state.cancelJointCanvasPick);
  const moveJointAttachmentPin = useSceneStore((state) => state.moveJointAttachmentPin);
  const pendingCatalogSpawnType = useSceneStore((state) => state.pendingCatalogSpawnType);
  const setPendingCatalogSpawnType = useSceneStore((state) => state.setPendingCatalogSpawnType);

  const isPlayMode = appMode === 'play';
  const isCustomCursorActive =
    isPlayMode && settings.useCustomCursors !== false && !spawnCanvasPick && !jointCanvasPick;
  const ratio = settings.aspectRatio || 'free';
  const batchUpdateEntityTransforms = useSceneStore((state) => state.batchUpdateEntityTransforms);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const shakeWrapperRef = useRef<HTMLDivElement>(null);
  const worldLayerRef = useRef<HTMLDivElement>(null);
  const parallaxLayerRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const parallaxFactorsRef = useRef<Record<string, number>>({});
  const mouseScreenPosRef = useRef<{ x: number; y: number } | null>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const [pickHoverPt, setPickHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [zoneDragStart, setZoneDragStart] = useState<{ x: number; y: number } | null>(null);
  const [zoneDragCurrent, setZoneDragCurrent] = useState<{ x: number; y: number } | null>(null);
  const [jointPickHoverPt, setJointPickHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [isDraggingJointPin, setIsDraggingJointPin] = useState(false);
  const setSceneBounds = useSceneStore((state) => state.setSceneBounds);

  const worldTransformPagePoint = useCallback((pt: { x: number; y: number }) => {
    const snap = useSceneStore.getState();
    const cam = getActiveCameraView(snap.appMode, snap.editorCamera);
    const z = Math.max(0.1, cam.zoom || 1);
    return { x: pt.x / z, y: pt.y / z };
  }, []);

  useEffect(() => {
    if (!spawnCanvasPick) {
      setPickHoverPt(null);
      setZoneDragStart(null);
      setZoneDragCurrent(null);
    }
  }, [spawnCanvasPick]);

  useEffect(() => {
    if (!jointCanvasPick) {
      setJointPickHoverPt(null);
    }
  }, [jointCanvasPick]);

  // Synchronisation dynamique des dimensions réelles du canvas vers le store (Boundary & Spawn aléatoire)
  useEffect(() => {
    const el = canvasContainerRef.current;
    if (!el) return;
    const updateBounds = () => {
      const w = el.clientWidth || Math.round(el.getBoundingClientRect().width);
      const h = el.clientHeight || Math.round(el.getBoundingClientRect().height);
      if (w > 0 && h > 0) {
        setSceneBounds({ width: w, height: h });
      }
    };
    updateBounds();
    const ro = new ResizeObserver(updateBounds);
    ro.observe(el);
    window.addEventListener('resize', updateBounds);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', updateBounds);
    };
  }, [setSceneBounds, ratio]);

  // Focus automatique du canvas au passage en mode Play (contrôles clavier immédiats sans clic requis)
  useEffect(() => {
    if (!isPlayMode) return;
    const raf = window.requestAnimationFrame(() => {
      const active = document.activeElement as HTMLElement | null;
      if (active && active !== canvasContainerRef.current && typeof active.blur === 'function') {
        active.blur();
      }
      canvasContainerRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [isPlayMode]);

  // Boucle de simulation physique Matter.js & Caméra 2D en mode Play (60 FPS)
  useEffect(() => {
    if (!isPlayMode) {
      stopKeyboardListening();
      if (shakeWrapperRef.current) {
        shakeWrapperRef.current.style.transform = 'none';
      }
      return;
    }

    startKeyboardListening();
    let animId: number;
    let lastTime = performance.now();

    const tick = (currentTime: number) => {
      const deltaTime = (currentTime - lastTime) / 1000;
      lastTime = currentTime;

      if (canvasContainerRef.current) {
        const el = canvasContainerRef.current;
        const rect = el.getBoundingClientRect();
        const liveW = el.clientWidth || rect.width;
        const liveH = el.clientHeight || rect.height;

        // Garder sceneBounds strictement à jour à chaque frame même pendant un redimensionnement
        const prevBounds = useSceneStore.getState().sceneBounds;
        if (Math.round(liveW) !== prevBounds.width || Math.round(liveH) !== prevBounds.height) {
          setSceneBounds({ width: liveW, height: liveH });
        }

        const stateSnapshot = useSceneStore.getState();
        const viewportSize = { width: liveW, height: liveH };
        const liveWorldBounds = resolveWorldBounds(viewportSize, stateSnapshot.camera);

        // Convertir la position curseur écran en coordonnées monde selon la caméra Play courante
        if (mouseScreenPosRef.current) {
          const camNow = getActiveCameraView('play', stateSnapshot.editorCamera);
          const safeZ = Math.max(0.1, camNow.zoom || 1);
          mousePosRef.current = {
            x: mouseScreenPosRef.current.x / safeZ + camNow.x,
            y: mouseScreenPosRef.current.y / safeZ + camNow.y,
          };
        }

        const currentEntities = stateSnapshot.entities;
        const activeColliderLayers = (stateSnapshot.layerGroups || []).flatMap((g) =>
          g.layers.filter(
            (l) =>
              (l.role === 'collider' || g.kind === 'collider') &&
              l.visible &&
              (l.vectorPaths?.length || 0) > 0
          )
        );
        const liveViewportRect = getPlayVisibleViewportRect(viewportSize);
        const result = stepMatterPhysics({
          entities: currentEntities,
          deltaTime,
          canvasBounds: liveWorldBounds,
          viewportRect: liveViewportRect,
          mousePos: mousePosRef.current,
          colliderLayers: activeColliderLayers,
        });

        if (Object.keys(result.updatedTransforms).length > 0) {
          batchUpdateEntityTransforms(result.updatedTransforms);
        }

        if (result.variableUpdates) {
          useSceneStore.getState().batchSetGameVariables(result.variableUpdates);
        }

        if (result.stateChanges) {
          const updateEntityState = useSceneStore.getState().updateEntityState;
          Object.entries(result.stateChanges).forEach(([entId, nextStateId]) => {
            updateEntityState(entId, nextStateId);
          });
        }

        // Suppression automatique des entités expirées (Composant Auto-Destroy / Santé à 0 PV)
        if (result.entitiesToDestroy && result.entitiesToDestroy.length > 0) {
          const deleteEntity = useSceneStore.getState().deleteEntity;
          result.entitiesToDestroy.forEach((id) => deleteEntity(id));
        }

        // Action de scène automatique sur Santé = 0 PV (recharger ou changer de scène)
        if (result.healthDeathSceneAction) {
          const act = result.healthDeathSceneAction;
          const store = useSceneStore.getState();
          if (act.action === 'restart_scene') {
            store.restartSceneInPlay(act.transition || 'fade', act.duration ?? 0.45);
          } else if (act.action === 'change_scene' && act.targetSceneId) {
            store.changeSceneInPlay(
              act.targetSceneId,
              act.transition || 'fade',
              act.duration ?? 0.45
            );
          }
        }

        // Rupture dynamique des joints cassables (détachement runtime Play + déclenchement événement joint_break)
        if (result.brokenJointEvents && result.brokenJointEvents.length > 0) {
          const { detachEntity, triggerJointBreak } = useSceneStore.getState();
          result.brokenJointEvents.forEach((ev) => {
            detachEntity(ev.childId);
            triggerJointBreak(ev.childId, ev.parentId, ev.breakPoint);
          });
        }

        // Événements "Arrivé sur cible" (Suivre / Déplacer vers)
        if (result.arrivedTargetEvents && result.arrivedTargetEvents.length > 0) {
          const { triggerTargetArrivedEvent } = useSceneStore.getState();
          result.arrivedTargetEvents.forEach((ev) => {
            triggerTargetArrivedEvent(ev.subjectId, ev.targetEntityId, ev.eventPosition);
          });
        }

        // Mise à jour caméra 60 FPS sans re-render React (transforms DOM directs)
        const latestState = useSceneStore.getState();
        const rtCam = stepPlayCameraRuntime(
          deltaTime,
          latestState.entities,
          viewportSize,
          latestState.camera
        );

        const followedTargetId = consumePlayCameraFollowChange();
        if (followedTargetId) {
          useSceneStore.getState().triggerCameraFollowEvent(followedTargetId);
        }

        if (shakeWrapperRef.current) {
          const hasShake =
            Math.abs(rtCam.shakeX) > 0.05 ||
            Math.abs(rtCam.shakeY) > 0.05 ||
            Math.abs(rtCam.shakeRotation) > 0.01;
          shakeWrapperRef.current.style.transform = hasShake
            ? `translate3d(${rtCam.shakeX}px, ${rtCam.shakeY}px, 0px) rotate(${rtCam.shakeRotation}deg)`
            : 'none';
        }
        if (worldLayerRef.current) {
          worldLayerRef.current.style.transform = computeWorldTransformCss(rtCam);
        }
        Object.entries(parallaxLayerRefs.current).forEach(([layerId, layerEl]) => {
          if (!layerEl) return;
          const factor = parallaxFactorsRef.current[layerId] ?? 1;
          layerEl.style.transform = computeLayerParallaxTransform(rtCam, factor);
        });

        // Évaluation systématique des règles de collision et capteurs à 60 FPS
        useSceneStore.getState().evaluateRules();
      }

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(animId);
      stopKeyboardListening();
    };
  }, [isPlayMode, batchUpdateEntityTransforms, setSceneBounds]);

  // Calcul des styles d'aspect ratio pour ancrage en haut & centré horizontalement
  const getAspectRatioStyle = (): React.CSSProperties => {
    switch (ratio) {
      case '16:9':
        return {
          aspectRatio: '16 / 9',
          width: '100%',
          maxWidth: '100%',
          maxHeight: '100%',
          minHeight: '260px',
        };
      case '4:3':
        return {
          aspectRatio: '4 / 3',
          height: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          minHeight: '260px',
        };
      case '1:1':
        return {
          aspectRatio: '1 / 1',
          height: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          minHeight: '260px',
        };
      case '9:16':
        return {
          aspectRatio: '9 / 16',
          height: '100%',
          maxHeight: '100%',
          maxWidth: '100%',
          minHeight: '260px',
        };
      default:
        return {
          width: '100%',
          height: '100%',
        };
    }
  };

  const layerGroups = useSceneStore((state) => state.layerGroups || EMPTY_LIST);

  const backgroundGroups = layerGroups.filter((g) => g.kind === 'background');
  const colliderGroups = layerGroups.filter((g) => g.kind === 'collider');
  const foregroundGroups = layerGroups.filter((g) => g.kind === 'foreground');
  const otherGroups = layerGroups.filter((g) => g.kind === 'custom');

  const renderLayerSvg = (layer: any, isCollider = false) => {
    const paths = layer.vectorPaths;
    if (!paths || paths.length === 0) return null;
    const isLegacy200 = layer.coordinateSpace === 'legacy_200';
    return (
      <svg
        {...(isLegacy200 ? { viewBox: '0 0 200 200', preserveAspectRatio: 'none' as const } : {})}
        className="w-full h-full pointer-events-none overflow-visible"
        style={{ opacity: layer.opacity }}
      >
        {paths.map((p: any, idx: number) => (
          <path
            key={p.id || idx}
            d={p.d}
            stroke={p.stroke || (isCollider ? '#f97316' : '#6366f1')}
            strokeWidth={p.strokeWidth || 4}
            strokeDasharray={isCollider && !isPlayMode ? '6 4' : undefined}
            fill={p.fill && p.fill !== 'none' ? p.fill : 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
            transform={p.transform}
          />
        ))}
      </svg>
    );
  };

  const computeSpawnPickPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasContainerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const cam = getActiveCameraView(useSceneStore.getState().appMode, editorCamera);
      const worldPt = screenToWorldPoint(clientX, clientY, rect, cam);
      const rawX = Math.max(0, Math.min(worldBounds.width, worldPt.x));
      const rawY = Math.max(0, Math.min(worldBounds.height, worldPt.y));
      if (spawnCanvasPick?.snapToGrid && spawnCanvasPick.gridStep > 0) {
        const step = spawnCanvasPick.gridStep;
        return {
          x: Math.round(Math.max(0, Math.min(worldBounds.width, Math.round(rawX / step) * step))),
          y: Math.round(Math.max(0, Math.min(worldBounds.height, Math.round(rawY / step) * step))),
        };
      }
      return {
        x: Math.round(rawX),
        y: Math.round(rawY),
      };
    },
    [spawnCanvasPick, editorCamera, worldBounds.width, worldBounds.height]
  );

  const computeCanvasPoint = useCallback(
    (clientX: number, clientY: number) => {
      const el = canvasContainerRef.current;
      if (!el) return { x: 0, y: 0 };
      const rect = el.getBoundingClientRect();
      const cam = getActiveCameraView(useSceneStore.getState().appMode, editorCamera);
      const worldPt = screenToWorldPoint(clientX, clientY, rect, cam);
      return {
        x: Math.round(Math.max(0, Math.min(worldBounds.width, worldPt.x))),
        y: Math.round(Math.max(0, Math.min(worldBounds.height, worldPt.y))),
      };
    },
    [editorCamera, worldBounds.width, worldBounds.height]
  );

  const activeCameraView = getActiveCameraView(appMode, editorCamera);

  const handleContainerWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (isPlayMode) return;
    if (e.ctrlKey || e.metaKey || isPanToolActive || isSpacePressed) {
      e.preventDefault();
      const el = canvasContainerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cur = useSceneStore.getState().editorCamera;
      const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const nextZoom = clampCameraZoom(cur.zoom * factor);
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const worldUnderX = screenX / cur.zoom + cur.x;
      const worldUnderY = screenY / cur.zoom + cur.y;
      setEditorCamera({
        zoom: nextZoom,
        x: Math.round((worldUnderX - screenX / nextZoom) * 10) / 10,
        y: Math.round((worldUnderY - screenY / nextZoom) * 10) / 10,
      });
    }
  };

  const handleContainerPanPointerDownCapture = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isPlayMode) return;
    const isMiddleClick = e.button === 1;
    const isPanClick = (isPanToolActive || isSpacePressed) && e.button === 0;
    if (!isMiddleClick && !isPanClick) return;
    if ((e.target as HTMLElement | null)?.closest('[data-camera-hud="true"]')) return;

    e.stopPropagation();
    e.preventDefault();
    setIsPanning(true);
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const startCam = { ...useSceneStore.getState().editorCamera };

    const handleMove = (mv: PointerEvent) => {
      const dx = (mv.clientX - startClientX) / Math.max(0.1, startCam.zoom);
      const dy = (mv.clientY - startClientY) / Math.max(0.1, startCam.zoom);
      setEditorCamera({
        x: Math.round((startCam.x - dx) * 10) / 10,
        y: Math.round((startCam.y - dy) * 10) / 10,
      });
    };

    const handleUp = () => {
      setIsPanning(false);
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };

    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
  };

  return (
    <div
      className="relative w-full h-full min-h-0 bg-slate-100/70 overflow-hidden select-none flex flex-col items-center justify-start p-3 sm:p-4"
      onClick={() => selectEntity(null)}
    >
      {/* CADRE DE SCÈNE AVEC RESPECT DU FORMAT / RATIO */}
      <div
        id="scene-canvas-container"
        ref={canvasContainerRef}
        tabIndex={0}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onWheel={handleContainerWheel}
        onPointerDownCapture={handleContainerPanPointerDownCapture}
        onPointerMove={(e) => {
          if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            const sx = e.clientX - rect.left;
            const sy = e.clientY - rect.top;
            mouseScreenPosRef.current = { x: sx, y: sy };
            const cam = getActiveCameraView(useSceneStore.getState().appMode, editorCamera);
            const z = Math.max(0.1, cam.zoom || 1);
            mousePosRef.current = {
              x: sx / z + cam.x,
              y: sy / z + cam.y,
            };
          }
        }}
        onPointerLeave={() => {
          mouseScreenPosRef.current = null;
          mousePosRef.current = null;
        }}
        className={`relative overflow-hidden select-none outline-none flex flex-col rounded-2xl shadow-md border border-slate-300/80 transition-all duration-300 ${
          isCustomCursorActive
            ? 'atelier-cursor-hidden'
            : isPanning
            ? 'cursor-grabbing'
            : !isPlayMode && (isPanToolActive || isSpacePressed)
            ? 'cursor-grab'
            : !isPlayMode
            ? 'atelier-fine-crosshair'
            : ''
        }`}
        style={{
          backgroundColor,
          ...getAspectRatioStyle(),
        }}
      >
        {/* ENVELOPPE DE CAPTURE STAGE (Transitions Push + Scène active) */}
        <div
          id="scene-stage-capture"
          className="absolute inset-0 overflow-hidden"
          style={(() => {
            if (activeSceneTransition && activeSceneTransition.type.startsWith('push_')) {
              const totalMs = Math.max(80, Math.round((activeSceneTransition.duration || 0.45) * 1000));
              const tType = activeSceneTransition.type;
              let startTransform = 'translate3d(0, 0, 0)';
              if (tType === 'push_left') startTransform = 'translate3d(100%, 0, 0)';
              else if (tType === 'push_right') startTransform = 'translate3d(-100%, 0, 0)';
              else if (tType === 'push_up') startTransform = 'translate3d(0, 100%, 0)';
              else if (tType === 'push_down') startTransform = 'translate3d(0, -100%, 0)';
              return {
                backgroundColor,
                transform: transitionEngaged ? 'translate3d(0, 0, 0)' : startTransform,
                transition: transitionEngaged ? `transform ${totalMs}ms ease-in-out` : 'none',
              };
            }
            return { backgroundColor };
          })()}
        >
        {/* ENVELOPPE SCREEN SHAKE & VUE CAMÉRA */}
        <div
          ref={shakeWrapperRef}
          className="absolute inset-0 pointer-events-auto"
          style={{
            transform: isPlayMode ? undefined : 'none',
            transformOrigin: 'center center',
          }}
        >
          {/* 1. ARRIÈRE-PLANS DESSINÉS (BACKGROUND LAYERS + PARALLAXE) */}
          <div className="absolute inset-0 pointer-events-none z-1">
            {backgroundGroups.flatMap((g) => g.layers).map((layer) => {
              if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
              const isCollider = layer.role === 'collider';
              if (isCollider && isPlayMode && layer.showColliderInPlay === false) return null;
              const pFactor = isCollider ? 1 : (layer.parallaxFactor ?? 1);
              parallaxFactorsRef.current[layer.id] = pFactor;
              const isLegacyOrFixed = layer.coordinateSpace === 'legacy_200' || pFactor === 0;
              return (
                <div
                  key={layer.id}
                  ref={(el) => {
                    if (el) parallaxLayerRefs.current[layer.id] = el;
                    else delete parallaxLayerRefs.current[layer.id];
                  }}
                  className={isLegacyOrFixed ? 'absolute inset-0' : 'absolute left-0 top-0'}
                  style={{
                    ...(isLegacyOrFixed
                      ? {}
                      : { width: worldBounds.width, height: worldBounds.height }),
                    transformOrigin: '0 0',
                    transform: computeLayerParallaxTransform(activeCameraView, pFactor),
                  }}
                >
                  {renderLayerSvg(layer, isCollider)}
                </div>
              );
            })}
          </div>

          {/* 1.5 - 2 - 3.5. MONDE 2D TRANSFORMÉ PAR LA CAMÉRA (Zoom / Pan / Follow) */}
          <div
            id="scene-world-layer"
            ref={worldLayerRef}
            className="absolute left-0 top-0 pointer-events-none z-[5]"
            style={{
              width: worldBounds.width,
              height: worldBounds.height,
              transformOrigin: '0 0',
              transform: computeWorldTransformCss(activeCameraView),
            }}
          >
            {/* Grille de fond étendue au monde */}
            {settings.showGrid && settings.gridStyle !== 'clean' && (
              <div
                className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
                style={getGridStyle()}
              />
            )}

            {/* Repères Monde Étendu & Cadre Caméra initial en mode Édition */}
            {!isPlayMode &&
              cameraConfig.worldMode === 'custom' &&
              cameraConfig.showWorldBoundsInEdit !== false && (
                <>
                  <div
                    className="absolute inset-0 pointer-events-none z-[1] border-2 border-dashed border-sky-400/60 rounded-sm"
                    style={{
                      boxShadow: 'inset 0 0 0 1px rgba(14,165,233,0.12)',
                    }}
                  >
                    <span className="absolute top-1.5 left-2 px-1.5 py-0.5 rounded bg-sky-600/85 text-white text-[9px] font-mono font-bold">
                      Monde {worldBounds.width}×{worldBounds.height}px
                    </span>
                  </div>
                  <div
                    className="absolute pointer-events-none z-[2] border-2 border-dashed border-emerald-500/75 bg-emerald-500/[0.03]"
                    style={{
                      left: cameraConfig.initialX ?? 0,
                      top: cameraConfig.initialY ?? 0,
                      width: Math.max(80, Math.round(sceneBounds.width / Math.max(0.25, cameraConfig.zoom ?? 1))),
                      height: Math.max(80, Math.round(sceneBounds.height / Math.max(0.25, cameraConfig.zoom ?? 1))),
                    }}
                  >
                    <span className="absolute -top-4 left-0 px-1.5 py-0.2 rounded bg-emerald-600/90 text-white text-[9px] font-mono font-bold whitespace-nowrap">
                      📷 Vue Play ({Math.round((cameraConfig.zoom ?? 1) * 100)}%)
                    </span>
                  </div>
                </>
              )}

            {/* 1.5. CALQUES COLLIDERS DE DÉCOR (MURS / SOLS / CAPTEURS: z-5) */}
            <div className="absolute inset-0 pointer-events-none z-5">
              {colliderGroups.flatMap((g) => g.layers).map((layer) => {
                if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
                if (isPlayMode && layer.showColliderInPlay === false) return null;
                return (
                  <div key={layer.id} className="absolute inset-0">
                    {renderLayerSvg(layer, true)}
                  </div>
                );
              })}
            </div>

            {/* 1.8. RAILS & ZONES DE GLISSIÈRE SLIDERS EN MODE PLAY (z-6, hors debug gizmo) */}
            {isPlayMode && (() => {
              const rtSliderTracks = getGizmoRuntimeDebugData().sliderTracks;
              const sliderEntities = Object.values(entities).filter((ent) => {
                if (!ent || ent.visible === false || ent.parentId) return false;
                const st = ent.states[ent.currentStateId];
                const sb = getEffectiveBehaviors(ent, st).find(
                  (b): b is SliderBehaviorConfig => b.type === 'slider' && b.enabled !== false
                );
                return Boolean(sb && sb.showTrackInPlay !== false);
              });
              if (sliderEntities.length === 0) return null;
              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-6 overflow-visible">
                  {sliderEntities.map((ent) => {
                    const st = ent.states[ent.currentStateId];
                    const sb = getEffectiveBehaviors(ent, st).find(
                      (b): b is SliderBehaviorConfig => b.type === 'slider' && b.enabled !== false
                    )!;
                    const geom =
                      rtSliderTracks[ent.id]?.geom ||
                      getSliderTrackGeometry(
                        ent.position.x + ent.size.width / 2,
                        ent.position.y + ent.size.height / 2,
                        sb
                      );
                    const stepsX = Math.max(0, Math.round(sb.stepsX ?? 0));
                    const stepsY = Math.max(0, Math.round(sb.stepsY ?? 0));

                    if (geom.geometryMode === 'line_1d') {
                      const nx = -geom.uy;
                      const ny = geom.ux;
                      return (
                        <g key={`play-slider-${ent.id}`}>
                          <line
                            x1={geom.startPt.x}
                            y1={geom.startPt.y}
                            x2={geom.endPt.x}
                            y2={geom.endPt.y}
                            stroke="rgba(148,163,184,0.35)"
                            strokeWidth={10}
                            strokeLinecap="round"
                          />
                          <line
                            x1={geom.startPt.x}
                            y1={geom.startPt.y}
                            x2={geom.endPt.x}
                            y2={geom.endPt.y}
                            stroke="rgba(100,116,139,0.55)"
                            strokeWidth={2}
                            strokeLinecap="round"
                          />
                          {stepsX >= 2 &&
                            Array.from({ length: stepsX }).map((_, idx) => {
                              const t = idx / (stepsX - 1);
                              const lx = (t - 0.5) * 2 * geom.halfLen;
                              const px = geom.originCx + geom.ux * lx;
                              const py = geom.originCy + geom.uy * lx;
                              return (
                                <line
                                  key={idx}
                                  x1={px - nx * 5}
                                  y1={py - ny * 5}
                                  x2={px + nx * 5}
                                  y2={py + ny * 5}
                                  stroke="rgba(71,85,105,0.65)"
                                  strokeWidth={1.75}
                                  strokeLinecap="round"
                                />
                              );
                            })}
                          {sb.returnMode === 'spring_return' && (
                            <circle
                              cx={geom.returnWorldPt.x}
                              cy={geom.returnWorldPt.y}
                              r={3.5}
                              fill="rgba(14,165,233,0.75)"
                            />
                          )}
                        </g>
                      );
                    }

                    if (geom.geometryMode === 'rect_2d') {
                      return (
                        <g key={`play-slider-${ent.id}`}>
                          <rect
                            x={geom.originCx - geom.halfW}
                            y={geom.originCy - geom.halfH}
                            width={geom.halfW * 2}
                            height={geom.halfH * 2}
                            rx={12}
                            fill="rgba(148,163,184,0.10)"
                            stroke="rgba(148,163,184,0.55)"
                            strokeWidth={2}
                          />
                          {stepsX >= 2 && stepsY >= 2 &&
                            Array.from({ length: stepsX }).flatMap((_, ix) =>
                              Array.from({ length: stepsY }).map((__, iy) => {
                                const px = geom.originCx + ((ix / (stepsX - 1)) - 0.5) * 2 * geom.halfW;
                                const py = geom.originCy + ((iy / (stepsY - 1)) - 0.5) * 2 * geom.halfH;
                                return (
                                  <circle
                                    key={`${ix}-${iy}`}
                                    cx={px}
                                    cy={py}
                                    r={2}
                                    fill="rgba(100,116,139,0.5)"
                                  />
                                );
                              })
                            )}
                          {sb.returnMode === 'spring_return' && (
                            <circle cx={geom.originCx} cy={geom.originCy} r={3.5} fill="rgba(14,165,233,0.75)" />
                          )}
                        </g>
                      );
                    }

                    return (
                      <g key={`play-slider-${ent.id}`}>
                        <circle
                          cx={geom.originCx}
                          cy={geom.originCy}
                          r={geom.radius}
                          fill="rgba(148,163,184,0.10)"
                          stroke="rgba(148,163,184,0.55)"
                          strokeWidth={2}
                        />
                        <circle cx={geom.originCx} cy={geom.originCy} r={3} fill="rgba(100,116,139,0.55)" />
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {/* 1.8b. CADRANS DE ROTATION AU DRAG EN MODE PLAY (z-6) */}
            {isPlayMode && (() => {
              const rtRotateTracks = getGizmoRuntimeDebugData().rotateDragTracks;
              const rotateEntities = Object.values(entities).filter((ent) => {
                if (!ent || ent.visible === false || ent.parentId) return false;
                const st = ent.states[ent.currentStateId];
                const rb = getEffectiveBehaviors(ent, st).find(
                  (b): b is RotateDragBehaviorConfig => b.type === 'rotate_drag' && b.enabled !== false
                );
                return Boolean(rb && rb.showDialInPlay !== false);
              });
              if (rotateEntities.length === 0) return null;
              return (
                <svg className="absolute inset-0 w-full h-full pointer-events-none z-6 overflow-visible">
                  {rotateEntities.map((ent) => {
                    const st = ent.states[ent.currentStateId];
                    const rb = getEffectiveBehaviors(ent, st).find(
                      (b): b is RotateDragBehaviorConfig => b.type === 'rotate_drag' && b.enabled !== false
                    )!;
                    const rt = rtRotateTracks[ent.id];
                    const effPivot = resolveEffectivePivot(ent, st);
                    const pivotWorld =
                      rt?.pivotWorld || getPivotWorldPosition(ent.position, ent.size, effPivot);
                    const radius =
                      rt?.radius || Math.max(28, Math.round(Math.max(ent.size.width, ent.size.height) * 0.56));
                    const { limitRange, minAngle, maxAngle } = getRotateDragBounds(rb);
                    const baseAngleDeg = rt?.baseAngleDeg ?? (st?.rotation ?? 0);
                    const startA = ((minAngle + baseAngleDeg - 90) * Math.PI) / 180;
                    const endA = ((maxAngle + baseAngleDeg - 90) * Math.PI) / 180;
                    const restAngle = rb.restAngle ?? 0;
                    const restRad = ((restAngle + baseAngleDeg - 90) * Math.PI) / 180;
                    const steps = Math.max(0, Math.round(rb.steps ?? 0));
                    const stepTicks = steps >= 2
                      ? Array.from({ length: steps }).map((_, idx) => {
                          const t = limitRange ? idx / (steps - 1) : idx / steps;
                          const deg = limitRange
                            ? minAngle + t * (maxAngle - minAngle)
                            : t * 360;
                          const rad = ((deg + baseAngleDeg - 90) * Math.PI) / 180;
                          return {
                            x1: pivotWorld.x + Math.cos(rad) * (radius - 5),
                            y1: pivotWorld.y + Math.sin(rad) * (radius - 5),
                            x2: pivotWorld.x + Math.cos(rad) * (radius + 5),
                            y2: pivotWorld.y + Math.sin(rad) * (radius + 5),
                          };
                        })
                      : [];
                    const spanDeg = Math.abs(maxAngle - minAngle);
                    const largeArc = spanDeg > 180 ? 1 : 0;
                    const arcD =
                      limitRange && spanDeg < 359
                        ? `M ${pivotWorld.x + Math.cos(startA) * radius} ${pivotWorld.y + Math.sin(startA) * radius} A ${radius} ${radius} 0 ${largeArc} 1 ${pivotWorld.x + Math.cos(endA) * radius} ${pivotWorld.y + Math.sin(endA) * radius}`
                        : null;
                    return (
                      <g key={`play-rot-${ent.id}`}>
                        {arcD ? (
                          <path
                            d={arcD}
                            fill="none"
                            stroke="rgba(148,163,184,0.45)"
                            strokeWidth={6}
                            strokeLinecap="round"
                          />
                        ) : (
                          <circle
                            cx={pivotWorld.x}
                            cy={pivotWorld.y}
                            r={radius}
                            fill="none"
                            stroke="rgba(148,163,184,0.35)"
                            strokeWidth={4}
                            strokeDasharray="6 4"
                          />
                        )}
                        {stepTicks.map((tk, idx) => (
                          <line
                            key={idx}
                            x1={tk.x1}
                            y1={tk.y1}
                            x2={tk.x2}
                            y2={tk.y2}
                            stroke="rgba(71,85,105,0.6)"
                            strokeWidth={1.75}
                            strokeLinecap="round"
                          />
                        ))}
                        {rb.returnMode === 'spring_return' && (
                          <circle
                            cx={pivotWorld.x + Math.cos(restRad) * radius}
                            cy={pivotWorld.y + Math.sin(restRad) * radius}
                            r={4}
                            fill="rgba(14,165,233,0.8)"
                          />
                        )}
                      </g>
                    );
                  })}
                </svg>
              );
            })()}

            {/* 2. RENDU DES ENTITÉS SELON entityOrder (z-index layering: 10 à 30) */}
            <MotionConfig transformPagePoint={worldTransformPagePoint}>
              {(() => {
                const order = entityOrder && entityOrder.length > 0 ? entityOrder : Object.keys(entities);
                const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
                return allKeys
                  .map((id) => entities[id])
                  .filter((entity): entity is NonNullable<typeof entity> => Boolean(entity) && entity.visible !== false)
                  .map((entity, index) => {
                    const isSelected = selectedEntityId === entity.id;
                    const zIndexStyle = { zIndex: isSelected && appMode !== 'play' ? 35 : 10 + index };
                    if (entity.type === 'plant') {
                      return <Plant key={entity.id} entity={entity} style={zIndexStyle} />;
                    }
                    if (entity.type === 'apple') {
                      return <Apple key={entity.id} entity={entity} style={zIndexStyle} />;
                    }
                    return <CustomShape key={entity.id} entity={entity} style={zIndexStyle} />;
                  });
              })()}
            </MotionConfig>

            {/* 3.5. CALQUE UNIFIÉ DE GIZMOS & DEBUG VISUEL (z-45) */}
            <SceneGizmoOverlay mousePosRef={mousePosRef} />

            {/* 7. POIGNÉE INTERACTIVE DE GLISSER DU POINT D'ATTACHE JOINT SUR LE CANVAS (MODE ÉDITION) */}
            {!isPlayMode && !spawnCanvasPick && !jointCanvasPick && !selectedLayerId && selectedEntityId && (() => {
              const selChild = entities[selectedEntityId];
              if (!selChild || !selChild.parentId) return null;
              const selParent = entities[selChild.parentId];
              if (!selParent || selChild.visible === false) return null;
              const pinWorld = getChildAttachmentPinWorld(selChild, selParent);

              return (
                <div
                  role="button"
                  tabIndex={-1}
                  aria-label="Déplacer le point d'attache"
                  title="Glisser pour déplacer le point d'attache sur la scène (sans bouger les objets)"
                  onClick={(e) => e.stopPropagation()}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    useSceneStore.getState().pushSceneHistory();
                    setIsDraggingJointPin(true);
                    const startTarget = e.currentTarget;
                    try {
                      startTarget.setPointerCapture(e.pointerId);
                    } catch {
                      // Ignore if unsupported
                    }

                    const handleMove = (ev: PointerEvent) => {
                      const pt = computeCanvasPoint(ev.clientX, ev.clientY);
                      moveJointAttachmentPin(selChild.id, pt.x, pt.y, true);
                    };

                    const handleUp = (ev: PointerEvent) => {
                      setIsDraggingJointPin(false);
                      try {
                        startTarget.releasePointerCapture(ev.pointerId);
                      } catch {
                        // Ignore
                      }
                      window.removeEventListener('pointermove', handleMove);
                      window.removeEventListener('pointerup', handleUp);
                      window.removeEventListener('pointercancel', handleUp);
                    };

                    window.addEventListener('pointermove', handleMove);
                    window.addEventListener('pointerup', handleUp);
                    window.addEventListener('pointercancel', handleUp);
                  }}
                  style={{
                    left: `${pinWorld.x}px`,
                    top: `${pinWorld.y}px`,
                    touchAction: 'none',
                  }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 z-[48] w-7 h-7 flex items-center justify-center pointer-events-auto ${
                    isDraggingJointPin ? 'cursor-grabbing scale-110' : 'cursor-grab hover:scale-110'
                  } transition-transform`}
                >
                  <span className="w-4 h-4 rounded-full bg-sky-500/90 border-2 border-white shadow-md flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                </div>
              );
            })()}
          </div>

          {/* Empty State Overlay when no entities and no archetypes exist */}
          {isCompletelyEmptyProject && !spawnCanvasPick && (
            <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto bg-slate-50/60 backdrop-blur-2xs">
              <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-3xl shadow-sm mb-4 animate-in zoom-in-95 duration-200">
                🎨
              </div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">
                Nouveau Projet Atelier Vivant
              </h3>
              <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-6 leading-relaxed">
                Votre scène est prête. Créez votre première entité pour commencer à dessiner et animer votre univers :
              </p>

              <div className="max-w-sm w-full">
                {/* Option Principale: Créer une Entité */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onOpenCreateModal) onOpenCreateModal();
                  }}
                  className="w-full p-5 bg-white hover:bg-indigo-50/40 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-[0.98]"
                >
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                      <Paintbrush className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                      Démarrer
                    </span>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                      Créer une entité
                      <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                    </div>
                    <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                      Ouvre l'atelier de dessin vectoriel pour concevoir votre premier objet et ses états.
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* 2.5. SYSTÈME DE PARTICULES 2D LÉGER (Canvas Overlay 60 FPS, Mode Play) */}
          <ParticleCanvasOverlay active={isPlayMode} />

          {/* 3. CALQUES DE PREMIER-PLAN DESSINÉS (FOREGROUND & AUTRES + PARALLAXE: z-40) */}
          <div className="absolute inset-0 pointer-events-none z-40">
            {[...otherGroups, ...foregroundGroups].flatMap((g) => g.layers).map((layer) => {
              if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
              const isCollider = layer.role === 'collider';
              if (isCollider && isPlayMode && layer.showColliderInPlay === false) return null;
              const pFactor = isCollider ? 1 : (layer.parallaxFactor ?? 1);
              parallaxFactorsRef.current[layer.id] = pFactor;
              const isLegacyOrFixed = layer.coordinateSpace === 'legacy_200' || pFactor === 0;
              return (
                <div
                  key={layer.id}
                  ref={(el) => {
                    if (el) parallaxLayerRefs.current[layer.id] = el;
                    else delete parallaxLayerRefs.current[layer.id];
                  }}
                  className={isLegacyOrFixed ? 'absolute inset-0' : 'absolute left-0 top-0'}
                  style={{
                    ...(isLegacyOrFixed
                      ? {}
                      : { width: worldBounds.width, height: worldBounds.height }),
                    transformOrigin: '0 0',
                    transform: computeLayerParallaxTransform(activeCameraView, pFactor),
                  }}
                >
                  {renderLayerSvg(layer, isCollider)}
                </div>
              );
            })}
          </div>
        </div>
        </div>

        {/* 4. OVERLAY DE DESSIN EN DIRECT SUR SCÈNE (QUAND UN CALQUE DÉCOR EST SÉLECTIONNÉ) */}
        {selectedLayerId && !isPlayMode && (() => {
          let activeLayer: any = null;
          let activeGroupKind: string = 'background';
          for (const g of layerGroups) {
            const found = g.layers.find((l) => l.id === selectedLayerId);
            if (found) {
              activeLayer = found;
              activeGroupKind = g.kind;
              break;
            }
          }
          if (!activeLayer) return null;

          return (
            <DirectCanvasDrawingOverlay
              layer={activeLayer}
              isColliderLayer={activeLayer.role === 'collider' || activeGroupKind === 'collider'}
              editorCamera={editorCamera}
              worldBounds={worldBounds}
              onUpdatePaths={(paths, skipHistory) =>
                setLayerVectorPaths(selectedLayerId, paths, skipHistory)
              }
            />
          );
        })()}

        {/* 4.5. OVERLAY PLACEMENT TACTILE DEPUIS LA GALERIE (iPad / Tablette / Souris) */}
        {pendingCatalogSpawnType && !isPlayMode && !spawnCanvasPick && !jointCanvasPick && (() => {
          const catalogLabel =
            customArchetypes[pendingCatalogSpawnType]?.name ||
            Object.values(entities).find((e) => e.type === pendingCatalogSpawnType)?.name ||
            pendingCatalogSpawnType;
          return (
            <div
              className="absolute inset-0 z-50 cursor-crosshair touch-none"
              onPointerDown={(e) => {
                e.stopPropagation();
                const pt = computeCanvasPoint(e.clientX, e.clientY);
                const dropX = Math.max(0, pt.x - 40);
                const dropY = Math.max(0, pt.y - 40);
                spawnEntity({
                  type: pendingCatalogSpawnType,
                  position: { x: dropX, y: dropY },
                });
                setPendingCatalogSpawnType(null);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3 py-1.5 bg-slate-900/95 text-white border border-emerald-500/60 rounded-2xl shadow-xl cursor-default"
              >
                <span className="text-xs font-bold text-emerald-300 whitespace-nowrap">
                  Touchez la scène pour placer « {catalogLabel} »
                </span>
                <button
                  type="button"
                  onClick={() => setPendingCatalogSpawnType(null)}
                  className="px-2 py-0.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
                >
                  Annuler
                </button>
              </div>
            </div>
          );
        })()}

        {/* 5. OVERLAY INTERACTIF DE VISÉE SPAWN SUR SCÈNE (Règle -> Placer sur la scène / Tracer zone) */}
        {spawnCanvasPick && !isPlayMode && (() => {
          const isZonePick = spawnCanvasPick.mode === 'random_zone';
          const draftZone =
            isZonePick && zoneDragStart && zoneDragCurrent
              ? {
                  x: Math.min(zoneDragStart.x, zoneDragCurrent.x),
                  y: Math.min(zoneDragStart.y, zoneDragCurrent.y),
                  width: Math.abs(zoneDragCurrent.x - zoneDragStart.x),
                  height: Math.abs(zoneDragCurrent.y - zoneDragStart.y),
                }
              : null;

          return (
            <div
              className="absolute inset-0 z-50 atelier-fine-crosshair"
              onPointerMove={(e) => {
                const pt = computeSpawnPickPoint(e.clientX, e.clientY);
                setPickHoverPt(pt);
                if (isZonePick && zoneDragStart) {
                  setZoneDragCurrent(pt);
                }
              }}
              onPointerLeave={() => {
                setPickHoverPt(null);
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pt = computeSpawnPickPoint(e.clientX, e.clientY);
                if (isZonePick) {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setZoneDragStart(pt);
                  setZoneDragCurrent(pt);
                } else {
                  completeSpawnCanvasPick(pt.x, pt.y);
                }
              }}
              onPointerUp={(e) => {
                if (!isZonePick || !zoneDragStart) return;
                e.stopPropagation();
                e.currentTarget.releasePointerCapture?.(e.pointerId);
                const endPt = computeSpawnPickPoint(e.clientX, e.clientY);
                const maxW = Math.max(40, worldBounds.width);
                const maxH = Math.max(40, worldBounds.height);

                const rawW = Math.abs(endPt.x - zoneDragStart.x);
                const rawH = Math.abs(endPt.y - zoneDragStart.y);
                let finalZone: { x: number; y: number; width: number; height: number };

                if (rawW < 16 && rawH < 16) {
                  const defW = Math.min(maxW, spawnCanvasPick.initialZone?.width || 180);
                  const defH = Math.min(maxH, spawnCanvasPick.initialZone?.height || 130);
                  finalZone = {
                    x: Math.max(0, Math.min(maxW - defW, Math.round(endPt.x - defW / 2))),
                    y: Math.max(0, Math.min(maxH - defH, Math.round(endPt.y - defH / 2))),
                    width: defW,
                    height: defH,
                  };
                } else {
                  const zx = Math.max(0, Math.min(zoneDragStart.x, endPt.x));
                  const zy = Math.max(0, Math.min(zoneDragStart.y, endPt.y));
                  const zw = Math.max(20, Math.min(maxW - zx, rawW));
                  const zh = Math.max(20, Math.min(maxH - zy, rawH));
                  finalZone = { x: zx, y: zy, width: zw, height: zh };
                }

                setZoneDragStart(null);
                setZoneDragCurrent(null);
                completeSpawnCanvasPick(finalZone.x, finalZone.y, finalZone);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="absolute left-0 top-0 pointer-events-none"
                style={{
                  width: worldBounds.width,
                  height: worldBounds.height,
                  transformOrigin: '0 0',
                  transform: computeWorldTransformCss(editorCamera),
                }}
              >
                {/* Grille active uniquement si Snap Grille activé */}
                {spawnCanvasPick.snapToGrid && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <defs>
                      <pattern
                        id="spawn-pick-grid"
                        width={spawnCanvasPick.gridStep || 16}
                        height={spawnCanvasPick.gridStep || 16}
                        patternUnits="userSpaceOnUse"
                      >
                        <path
                          d={`M ${spawnCanvasPick.gridStep || 16} 0 L 0 0 0 ${spawnCanvasPick.gridStep || 16}`}
                          fill="none"
                          stroke={isZonePick ? '#9333ea' : '#10b981'}
                          strokeOpacity="0.25"
                          strokeWidth="1"
                        />
                      </pattern>
                    </defs>
                    <rect x="0" y="0" width="100%" height="100%" fill="url(#spawn-pick-grid)" />
                  </svg>
                )}

                {/* Visée vectorielle & boîte d'aperçu */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  {isZonePick && spawnCanvasPick.initialZone && !draftZone && (
                    <rect
                      x={spawnCanvasPick.initialZone.x}
                      y={spawnCanvasPick.initialZone.y}
                      width={spawnCanvasPick.initialZone.width}
                      height={spawnCanvasPick.initialZone.height}
                      rx={8}
                      fill="rgba(147, 51, 234, 0.08)"
                      stroke="#9333ea"
                      strokeOpacity={0.55}
                      strokeWidth={1.5}
                      strokeDasharray="6 4"
                    />
                  )}

                  {isZonePick && draftZone && (
                    <rect
                      x={draftZone.x}
                      y={draftZone.y}
                      width={Math.max(4, draftZone.width)}
                      height={Math.max(4, draftZone.height)}
                      rx={8}
                      fill="rgba(147, 51, 234, 0.16)"
                      stroke="#9333ea"
                      strokeWidth={2.25}
                      strokeDasharray="6 4"
                    />
                  )}

                  {spawnCanvasPick.mode === 'offset' && spawnCanvasPick.refCenter && (
                    <>
                      <circle
                        cx={spawnCanvasPick.refCenter.x}
                        cy={spawnCanvasPick.refCenter.y}
                        r={5}
                        fill="#6366f1"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                      {pickHoverPt && (
                        <line
                          x1={spawnCanvasPick.refCenter.x}
                          y1={spawnCanvasPick.refCenter.y}
                          x2={pickHoverPt.x}
                          y2={pickHoverPt.y}
                          stroke="#6366f1"
                          strokeWidth={2}
                          strokeDasharray="6 4"
                        />
                      )}
                    </>
                  )}

                  {pickHoverPt && (
                    <>
                      <line
                        x1={pickHoverPt.x}
                        y1={0}
                        x2={pickHoverPt.x}
                        y2={worldBounds.height}
                        stroke={isZonePick ? '#9333ea' : '#10b981'}
                        strokeOpacity={0.45}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={0}
                        y1={pickHoverPt.y}
                        x2={worldBounds.width}
                        y2={pickHoverPt.y}
                        stroke={isZonePick ? '#9333ea' : '#10b981'}
                        strokeOpacity={0.45}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      {!isZonePick && spawnCanvasPick.spawnSize && (
                        <rect
                          x={pickHoverPt.x - spawnCanvasPick.spawnSize.width / 2}
                          y={pickHoverPt.y - spawnCanvasPick.spawnSize.height / 2}
                          width={spawnCanvasPick.spawnSize.width}
                          height={spawnCanvasPick.spawnSize.height}
                          rx={8}
                          fill="rgba(16, 185, 129, 0.12)"
                          stroke="#10b981"
                          strokeWidth={1.75}
                          strokeDasharray="5 3"
                        />
                      )}
                      <circle
                        cx={pickHoverPt.x}
                        cy={pickHoverPt.y}
                        r={5}
                        fill={isZonePick ? '#9333ea' : '#10b981'}
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    </>
                  )}
                </svg>
              </div>

              {/* Barre flottante de contrôle en haut du canvas */}
              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-[96%] flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 bg-slate-900/95 text-white border border-slate-700 rounded-2xl shadow-xl cursor-default"
              >
                <span
                  className={`flex items-center gap-1.5 text-xs font-bold whitespace-nowrap ${
                    isZonePick ? 'text-purple-300' : 'text-emerald-300'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  {isZonePick
                    ? "Glissez sur la scène pour tracer la zone aléatoire"
                    : 'Cliquez sur la scène pour placer le spawn'}
                </span>

                <div className="w-px h-4 bg-slate-700" />

                <span className="text-[11px] font-mono tabular-nums font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg whitespace-nowrap">
                  {isZonePick
                    ? draftZone
                      ? `X: ${draftZone.x} · Y: ${draftZone.y} · ${draftZone.width}×${draftZone.height}px`
                      : pickHoverPt
                      ? `Curseur : ${pickHoverPt.x}, ${pickHoverPt.y} (glisser pour tracer)`
                      : 'Glissez un rectangle sur la scène…'
                    : pickHoverPt
                    ? spawnCanvasPick.mode === 'offset' && spawnCanvasPick.refCenter
                      ? `ΔX: ${pickHoverPt.x - spawnCanvasPick.refCenter.x} · ΔY: ${pickHoverPt.y - spawnCanvasPick.refCenter.y} (${pickHoverPt.x}, ${pickHoverPt.y})`
                      : `X: ${pickHoverPt.x} · Y: ${pickHoverPt.y}`
                    : 'Survolez la scène…'}
                </span>

                <button
                  type="button"
                  onClick={() => updateSpawnCanvasPickSnap(!spawnCanvasPick.snapToGrid)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    spawnCanvasPick.snapToGrid
                      ? isZonePick
                        ? 'bg-purple-600 text-white'
                        : 'bg-emerald-500 text-white'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title="Activer / désactiver l'aimantation sur grille"
                >
                  <Magnet className="w-3.5 h-3.5" />
                  <span>Snap : {spawnCanvasPick.snapToGrid ? 'ON' : 'OFF'}</span>
                </button>

                {spawnCanvasPick.snapToGrid && (
                  <div className="flex items-center gap-1 bg-slate-800 p-0.5 rounded-lg">
                    {[16, 24].map((step) => (
                      <button
                        key={step}
                        type="button"
                        onClick={() => updateSpawnCanvasPickSnap(true, step)}
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold cursor-pointer ${
                          spawnCanvasPick.gridStep === step
                            ? isZonePick
                              ? 'bg-purple-600 text-white'
                              : 'bg-emerald-500 text-white'
                            : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        {step}px
                      </button>
                    ))}
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => cancelSpawnCanvasPick()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Annuler (Échap)</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* 6. OVERLAY INTERACTIF DE PLACEMENT DU POINT D'ATTACHE JOINT SUR SCÈNE (7-2) */}
        {jointCanvasPick && !isPlayMode && (() => {
          const pickChild = entities[jointCanvasPick.childId];
          const pickParent = entities[jointCanvasPick.parentId];
          if (!pickChild || !pickParent) return null;
          const pCenter = {
            x: pickParent.position.x + pickParent.size.width / 2,
            y: pickParent.position.y + pickParent.size.height / 2,
          };
          const cCenter = {
            x: pickChild.position.x + pickChild.size.width / 2,
            y: pickChild.position.y + pickChild.size.height / 2,
          };

          return (
            <div
              className="absolute inset-0 z-50 atelier-fine-crosshair"
              onPointerMove={(e) => {
                setJointPickHoverPt(computeCanvasPoint(e.clientX, e.clientY));
              }}
              onPointerLeave={() => setJointPickHoverPt(null)}
              onPointerDown={(e) => {
                e.stopPropagation();
                const pt = computeCanvasPoint(e.clientX, e.clientY);
                completeJointCanvasPick(pt.x, pt.y);
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                className="absolute left-0 top-0 pointer-events-none"
                style={{
                  width: worldBounds.width,
                  height: worldBounds.height,
                  transformOrigin: '0 0',
                  transform: computeWorldTransformCss(editorCamera),
                }}
              >
                <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                  <circle cx={pCenter.x} cy={pCenter.y} r={4.5} fill="#6366f1" stroke="#ffffff" strokeWidth={1.75} />
                  <circle cx={cCenter.x} cy={cCenter.y} r={4.5} fill="#0ea5e9" stroke="#ffffff" strokeWidth={1.75} />
                  {jointPickHoverPt && (
                    <>
                      <line
                        x1={pCenter.x}
                        y1={pCenter.y}
                        x2={jointPickHoverPt.x}
                        y2={jointPickHoverPt.y}
                        stroke="#6366f1"
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                      />
                      <line
                        x1={cCenter.x}
                        y1={cCenter.y}
                        x2={jointPickHoverPt.x}
                        y2={jointPickHoverPt.y}
                        stroke="#0ea5e9"
                        strokeWidth={1.75}
                        strokeDasharray="5 4"
                      />
                      <line
                        x1={jointPickHoverPt.x}
                        y1={0}
                        x2={jointPickHoverPt.x}
                        y2={worldBounds.height}
                        stroke="#0ea5e9"
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      <line
                        x1={0}
                        y1={jointPickHoverPt.y}
                        x2={worldBounds.width}
                        y2={jointPickHoverPt.y}
                        stroke="#0ea5e9"
                        strokeOpacity={0.35}
                        strokeWidth={1}
                        strokeDasharray="4 4"
                      />
                      <circle
                        cx={jointPickHoverPt.x}
                        cy={jointPickHoverPt.y}
                        r={10}
                        fill="rgba(14, 165, 233, 0.16)"
                        stroke="#0ea5e9"
                        strokeWidth={1.75}
                      />
                      <circle
                        cx={jointPickHoverPt.x}
                        cy={jointPickHoverPt.y}
                        r={4}
                        fill="#0ea5e9"
                        stroke="#ffffff"
                        strokeWidth={2}
                      />
                    </>
                  )}
                </svg>
              </div>

              <div
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
                className="absolute top-3 left-1/2 -translate-x-1/2 z-50 max-w-[96%] flex flex-wrap items-center justify-center gap-2 px-3 py-1.5 bg-slate-900/95 text-white border border-slate-700 rounded-2xl shadow-xl cursor-default"
              >
                <span className="flex items-center gap-1.5 text-xs font-bold text-sky-300 whitespace-nowrap">
                  <Crosshair className="w-3.5 h-3.5" />
                  Cliquez sur la scène pour fixer le point d'attache ({pickParent.name} → {pickChild.name})
                </span>
                <div className="w-px h-4 bg-slate-700" />
                <span className="text-[11px] font-mono tabular-nums font-bold text-slate-200 bg-slate-800 px-2 py-0.5 rounded-lg whitespace-nowrap">
                  {jointPickHoverPt
                    ? `X: ${jointPickHoverPt.x} · Y: ${jointPickHoverPt.y}`
                    : 'Survolez la scène…'}
                </span>
                <button
                  type="button"
                  onClick={() => cancelJointCanvasPick()}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-rose-600 text-slate-200 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                  <span>Annuler (Échap)</span>
                </button>
              </div>
            </div>
          );
        })()}

        {/* 8. RIDEAU & SNAPSHOT PUSH DE TRANSITION INTER-SCÈNES (Mode Play) */}
        {activeSceneTransition && activeSceneTransition.type !== 'none' && (() => {
          const { type, phase, duration, outgoingSnapshotKey } = activeSceneTransition;
          const ms = Math.max(50, Math.round((duration || 0.45) * 500));

          if (type.startsWith('push_')) {
            const totalMs = Math.max(80, Math.round((duration || 0.45) * 1000));
            let endTransform = 'translate3d(0, 0, 0)';
            if (type === 'push_left') endTransform = 'translate3d(-100%, 0, 0)';
            else if (type === 'push_right') endTransform = 'translate3d(100%, 0, 0)';
            else if (type === 'push_up') endTransform = 'translate3d(0, -100%, 0)';
            else if (type === 'push_down') endTransform = 'translate3d(0, 100%, 0)';
            return (
              <OutgoingPushSnapshotOverlay
                snapshotKey={outgoingSnapshotKey}
                transform={transitionEngaged ? endTransform : 'translate3d(0, 0, 0)'}
                transition={transitionEngaged ? `transform ${totalMs}ms ease-in-out` : 'none'}
              />
            );
          }

          if (type === 'iris' || type === 'iris_white') {
            const openHole = phase === 'out' ? !transitionEngaged : transitionEngaged;
            const holeSize = openHole ? 2400 : 0;
            const irisColor = type === 'iris_white' ? '#ffffff' : '#0f172a';
            return (
              <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
                <div
                  style={{
                    position: 'absolute',
                    left: '50%',
                    top: '50%',
                    width: `${holeSize}px`,
                    height: `${holeSize}px`,
                    transform: 'translate(-50%, -50%)',
                    borderRadius: '9999px',
                    boxShadow: `0 0 0 2400px ${irisColor}`,
                    transition: `width ${ms}ms ease-in-out, height ${ms}ms ease-in-out`,
                  }}
                />
              </div>
            );
          }

          if (type === 'slide_left' || type === 'slide_right') {
            let xPercent = '0%';
            if (type === 'slide_left') {
              xPercent = phase === 'out'
                ? (transitionEngaged ? '0%' : '100%')
                : (transitionEngaged ? '-100%' : '0%');
            } else {
              xPercent = phase === 'out'
                ? (transitionEngaged ? '0%' : '-100%')
                : (transitionEngaged ? '100%' : '0%');
            }
            return (
              <div
                className="absolute inset-0 z-[60] pointer-events-none bg-slate-950"
                style={{
                  transform: `translateX(${xPercent})`,
                  transition: `transform ${ms}ms ease-in-out`,
                }}
              />
            );
          }

          if (type === 'slide_up' || type === 'slide_down') {
            let yPercent = '0%';
            if (type === 'slide_up') {
              yPercent = phase === 'out'
                ? (transitionEngaged ? '0%' : '100%')
                : (transitionEngaged ? '-100%' : '0%');
            } else {
              yPercent = phase === 'out'
                ? (transitionEngaged ? '0%' : '-100%')
                : (transitionEngaged ? '100%' : '0%');
            }
            return (
              <div
                className="absolute inset-0 z-[60] pointer-events-none bg-slate-950"
                style={{
                  transform: `translateY(${yPercent})`,
                  transition: `transform ${ms}ms ease-in-out`,
                }}
              />
            );
          }

          if (type === 'wipe_left') {
            const clip =
              phase === 'out'
                ? transitionEngaged
                  ? 'inset(0% 0% 0% 0%)'
                  : 'inset(0% 0% 0% 100%)'
                : transitionEngaged
                ? 'inset(0% 100% 0% 0%)'
                : 'inset(0% 0% 0% 0%)';
            return (
              <div
                className="absolute inset-0 z-[60] pointer-events-none bg-slate-950"
                style={{
                  clipPath: clip,
                  transition: `clip-path ${ms}ms ease-in-out`,
                }}
              />
            );
          }

          if (type === 'curtain') {
            const closed = phase === 'out' ? transitionEngaged : !transitionEngaged;
            const shutterWidth = closed ? '50%' : '0%';
            return (
              <div className="absolute inset-0 z-[60] pointer-events-none overflow-hidden">
                <div
                  className="absolute top-0 bottom-0 left-0 bg-slate-950"
                  style={{
                    width: shutterWidth,
                    transition: `width ${ms}ms ease-in-out`,
                  }}
                />
                <div
                  className="absolute top-0 bottom-0 right-0 bg-slate-950"
                  style={{
                    width: shutterWidth,
                    transition: `width ${ms}ms ease-in-out`,
                  }}
                />
              </div>
            );
          }

          if (type === 'zoom_fade') {
            const active = phase === 'out' ? transitionEngaged : !transitionEngaged;
            return (
              <div
                className="absolute inset-0 z-[60] pointer-events-none bg-slate-950"
                style={{
                  opacity: active ? 1 : 0,
                  transform: active ? 'scale(1)' : 'scale(1.15)',
                  transition: `opacity ${ms}ms ease-in-out, transform ${ms}ms ease-in-out`,
                }}
              />
            );
          }

          // 'fade' | 'fade_white'
          const opacity = phase === 'out'
            ? (transitionEngaged ? 1 : 0)
            : (transitionEngaged ? 0 : 1);
          const fadeBg = type === 'fade_white' ? 'bg-white' : 'bg-slate-950';
          return (
            <div
              className={`absolute inset-0 z-[60] pointer-events-none ${fadeBg}`}
              style={{
                opacity,
                transition: `opacity ${ms}ms ease-in-out`,
              }}
            />
          );
        })()}
      </div>
    </div>
  );
}

function OutgoingPushSnapshotOverlay({
  snapshotKey,
  transform,
  transition,
}: {
  snapshotKey?: string;
  transform: string;
  transition: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    host.innerHTML = '';
    if (!snapshotKey) return;
    const snap = getTransitionSnapshot(snapshotKey);
    if (snap) {
      host.style.backgroundColor = snap.backgroundColor;
      snap.node.style.transform = 'none';
      snap.node.style.transition = 'none';
      host.appendChild(snap.node);
    }
  }, [snapshotKey]);

  return (
    <div
      ref={hostRef}
      className="absolute inset-0 z-[58] pointer-events-none overflow-hidden"
      style={{ transform, transition }}
    />
  );
}

// Composant unifié d'interaction de dessin direct vectoriel sur le canvas de scène
function DirectCanvasDrawingOverlay({
  layer,
  isColliderLayer,
  editorCamera,
  worldBounds,
  onUpdatePaths,
}: {
  layer: any;
  isColliderLayer: boolean;
  editorCamera: { x: number; y: number; zoom: number };
  worldBounds: { width: number; height: number };
  onUpdatePaths: (paths: VectorPath[], skipHistory?: boolean) => void;
}) {
  const drawingTool = useSceneStore((state) => state.drawingTool);
  const strokeColor = useSceneStore((state) => state.drawingStrokeColor);
  const strokeColorId = useSceneStore((state) => state.drawingStrokeColorId);
  const fillColor = useSceneStore((state) => state.drawingFillColor);
  const fillColorId = useSceneStore((state) => state.drawingFillColorId);
  const strokeWidth = useSceneStore((state) => state.drawingStrokeWidth);
  const drawingShowGrid = useSceneStore((state) => state.drawingShowGrid);
  const setDrawingShowGrid = useSceneStore((state) => state.setDrawingShowGrid);
  const drawingSnapToGrid = useSceneStore((state) => state.drawingSnapToGrid);
  const setDrawingSnapToGrid = useSceneStore((state) => state.setDrawingSnapToGrid);
  const undoScene = useSceneStore((state) => state.undoScene);
  const redoScene = useSceneStore((state) => state.redoScene);
  const canUndo = useSceneStore((state) => state.sceneUndoStack.length > 0);
  const canRedo = useSceneStore((state) => state.sceneRedoStack.length > 0);
  const selectLayer = useSceneStore((state) => state.selectLayer);

  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [currentPt, setCurrentPt] = useState<{ x: number; y: number } | null>(null);
  const [hoverPt, setHoverPt] = useState<{ x: number; y: number } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [marqueeStart, setMarqueeStart] = useState<{ x: number; y: number } | null>(null);
  const [marqueeCurrent, setMarqueeCurrent] = useState<{ x: number; y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'none' | 'move' | 'resize' | 'marquee'>('none');
  const [resizeHandle, setResizeHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);

  const svgRef = useRef<SVGSVGElement>(null);
  const latestPathsRef = useRef<VectorPath[]>(layer.vectorPaths || []);
  const dragStartPtRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartPathsRef = useRef<VectorPath[]>([]);
  const dragStartBoxRef = useRef<{ x: number; y: number; width: number; height: number } | null>(null);
  const hasPushedDragHistoryRef = useRef(false);

  const isLegacy200 = layer.coordinateSpace === 'legacy_200';
  const gridStep = isLegacy200 ? 10 : 20;
  const hitTolerance = isLegacy200 ? 6 : 10;
  const closePolyThreshold = isLegacy200 ? 8 : 14;
  const handleSize = isLegacy200 ? 5.5 : 9;
  const eraserRadius = isLegacy200
    ? Math.max(8, strokeWidth * 1.4)
    : Math.max(12, strokeWidth * 1.4);

  useEffect(() => {
    const paths: VectorPath[] = layer.vectorPaths || EMPTY_LIST;
    latestPathsRef.current = paths;
    setSelectedIds((prev) => {
      if (prev.length === 0) return prev;
      const next = prev.filter((id) => paths.some((p) => p.id === id));
      return next.length === prev.length ? prev : next;
    });
  }, [layer.vectorPaths]);

  // Nettoyer une polyligne en cours si on change d'outil ou de calque
  useEffect(() => {
    setPolyPoints([]);
    setIsDrawing(false);
    setPoints([]);
    setStartPt(null);
    setCurrentPt(null);
    setDragMode('none');
    setResizeHandle(null);
    setMarqueeStart(null);
    setMarqueeCurrent(null);
  }, [drawingTool, layer.id]);

  const snapPt = useCallback(
    (pt: { x: number; y: number }, allowSnap = true) => {
      if (!drawingSnapToGrid || !allowSnap) return pt;
      return {
        x: Math.round(pt.x / gridStep) * gridStep,
        y: Math.round(pt.y / gridStep) * gridStep,
      };
    },
    [drawingSnapToGrid, gridStep]
  );

  const effectiveParallaxFactor = isColliderLayer ? 1 : (layer.parallaxFactor ?? 1);
  const layerZoomFactor =
    effectiveParallaxFactor === 0 ? 1 : Math.max(0.1, editorCamera?.zoom || 1);
  const isLegacyOrFixed = isLegacy200 || effectiveParallaxFactor === 0;
  const layerTransformCss = isColliderLayer
    ? computeWorldTransformCss(editorCamera)
    : computeLayerParallaxTransform(editorCamera, effectiveParallaxFactor);

  const getSvgCoordinates = (
    e: React.PointerEvent<SVGSVGElement> | React.MouseEvent<SVGSVGElement>,
    allowSnap = false
  ) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    let raw: { x: number; y: number };
    if (isLegacy200) {
      const x = Math.max(0, Math.min(200, ((e.clientX - rect.left) / rect.width) * 200));
      const y = Math.max(0, Math.min(200, ((e.clientY - rect.top) / rect.height) * 200));
      raw = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    } else {
      const x = (e.clientX - rect.left) / layerZoomFactor;
      const y = (e.clientY - rect.top) / layerZoomFactor;
      raw = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }
    return snapPt(raw, allowSnap);
  };

  const makePathId = () => `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

  const finishPolyline = useCallback(
    (close = false) => {
      if (polyPoints.length < 2) {
        setPolyPoints([]);
        return;
      }
      const d = pointsToPolylinePath(polyPoints, close);
      const effectiveStroke =
        strokeColor === 'none' && (!close || fillColor === 'none') ? '#000000' : strokeColor;
      const newPath: VectorPath = {
        id: makePathId(),
        d,
        stroke: effectiveStroke,
        strokeColorId: effectiveStroke === strokeColor ? strokeColorId : undefined,
        strokeWidth: effectiveStroke === 'none' ? 0 : strokeWidth,
        fill: close ? fillColor : 'none',
        fillColorId: close ? fillColorId : undefined,
        points: close ? [...polyPoints, polyPoints[0]] : [...polyPoints],
      };
      const nextPaths = [...latestPathsRef.current, newPath];
      latestPathsRef.current = nextPaths;
      onUpdatePaths(nextPaths);
      setPolyPoints([]);
    },
    [polyPoints, strokeColor, strokeColorId, strokeWidth, fillColor, fillColorId, onUpdatePaths]
  );

  const deleteSelectedPaths = useCallback(() => {
    if (selectedIds.length === 0 || layer.locked) return;
    const nextPaths = latestPathsRef.current.filter((p) => !selectedIds.includes(p.id));
    latestPathsRef.current = nextPaths;
    onUpdatePaths(nextPaths);
    setSelectedIds([]);
  }, [selectedIds, layer.locked, onUpdatePaths]);

  const duplicateSelectedPaths = useCallback(() => {
    if (selectedIds.length === 0 || layer.locked) return;
    const offset = isLegacy200 ? 8 : 16;
    const clones: VectorPath[] = [];
    const newIds: string[] = [];
    for (const p of latestPathsRef.current) {
      if (selectedIds.includes(p.id)) {
        const cloned = translatePath(p, offset, offset);
        const id = makePathId();
        cloned.id = id;
        clones.push(cloned);
        newIds.push(id);
      }
    }
    if (clones.length > 0) {
      const nextPaths = [...latestPathsRef.current, ...clones];
      latestPathsRef.current = nextPaths;
      onUpdatePaths(nextPaths);
      setSelectedIds(newIds);
    }
  }, [selectedIds, layer.locked, isLegacy200, onUpdatePaths]);

  // Raccourcis clavier locaux du calque (Suppr, Cmd/Ctrl+D, Entrée pour finir polyligne)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable) return;
      const mod = e.metaKey || e.ctrlKey;

      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0 && !layer.locked) {
        e.preventDefault();
        deleteSelectedPaths();
        return;
      }
      if (mod && e.key.toLowerCase() === 'd' && selectedIds.length > 0 && !layer.locked) {
        e.preventDefault();
        duplicateSelectedPaths();
        return;
      }
      if (e.key === 'Enter' && drawingTool === 'polyline' && polyPoints.length >= 2) {
        e.preventDefault();
        finishPolyline(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedIds, layer.locked, drawingTool, polyPoints, deleteSelectedPaths, duplicateSelectedPaths, finishPolyline]);

  const existingPaths: VectorPath[] = layer.vectorPaths || [];
  const selectedPaths = existingPaths.filter((p) => selectedIds.includes(p.id));
  const selectionBox = getSelectionBoundingBox(existingPaths, selectedIds);
  const singleResizableShape =
    selectedPaths.length === 1 && (selectedPaths[0].rect || selectedPaths[0].circle)
      ? selectedPaths[0]
      : null;

  const detectResizeHandle = (
    pt: { x: number; y: number }
  ): 'nw' | 'ne' | 'se' | 'sw' | null => {
    if (!selectionBox || !singleResizableShape) return null;
    const handles: { id: 'nw' | 'ne' | 'se' | 'sw'; x: number; y: number }[] = [
      { id: 'nw', x: selectionBox.x, y: selectionBox.y },
      { id: 'ne', x: selectionBox.x + selectionBox.width, y: selectionBox.y },
      { id: 'se', x: selectionBox.x + selectionBox.width, y: selectionBox.y + selectionBox.height },
      { id: 'sw', x: selectionBox.x, y: selectionBox.y + selectionBox.height },
    ];
    for (const h of handles) {
      if (Math.hypot(pt.x - h.x, pt.y - h.y) <= handleSize * 1.4) {
        return h.id;
      }
    }
    return null;
  };

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    if (layer.locked) return;

    const allowSnap =
      drawingTool === 'pencil' ||
      drawingTool === 'lasso_fill' ||
      drawingTool === 'line' ||
      drawingTool === 'polyline' ||
      drawingTool === 'rectangle' ||
      drawingTool === 'circle';
    const pt = getSvgCoordinates(e, allowSnap);
    setHoverPt(pt);

    // 1. Outil Sélection (Marquee / Déplacement / Resize)
    if (drawingTool === 'select') {
      const rawPt = getSvgCoordinates(e, false);
      try {
        (e.target as Element).setPointerCapture?.(e.pointerId);
      } catch (_) {}

      const hitHandle = detectResizeHandle(rawPt);
      if (hitHandle && selectionBox && singleResizableShape) {
        setDragMode('resize');
        setResizeHandle(hitHandle);
        dragStartPtRef.current = rawPt;
        dragStartPathsRef.current = existingPaths;
        dragStartBoxRef.current = { ...selectionBox };
        hasPushedDragHistoryRef.current = false;
        return;
      }

      // Chercher un tracé sous le pointeur (du dessus vers le dessous)
      let hitPath: VectorPath | null = null;
      for (let i = existingPaths.length - 1; i >= 0; i--) {
        if (isPointNearPath(existingPaths[i], rawPt, hitTolerance)) {
          hitPath = existingPaths[i];
          break;
        }
      }

      if (hitPath) {
        let nextSelected = selectedIds;
        if (e.shiftKey) {
          nextSelected = selectedIds.includes(hitPath.id)
            ? selectedIds.filter((id) => id !== hitPath!.id)
            : [...selectedIds, hitPath.id];
          setSelectedIds(nextSelected);
        } else if (!selectedIds.includes(hitPath.id)) {
          nextSelected = [hitPath.id];
          setSelectedIds(nextSelected);
        }
        const nextBox = getSelectionBoundingBox(existingPaths, nextSelected);
        setDragMode('move');
        dragStartPtRef.current = rawPt;
        dragStartPathsRef.current = existingPaths;
        dragStartBoxRef.current = nextBox ? { ...nextBox } : null;
        hasPushedDragHistoryRef.current = false;
        return;
      }

      if (!e.shiftKey) {
        setSelectedIds([]);
      }
      setDragMode('marquee');
      setMarqueeStart(rawPt);
      setMarqueeCurrent(rawPt);
      return;
    }

    // 2. Outil Polyligne (point par point)
    if (drawingTool === 'polyline') {
      if (
        polyPoints.length >= 3 &&
        Math.hypot(pt.x - polyPoints[0].x, pt.y - polyPoints[0].y) <= closePolyThreshold
      ) {
        finishPolyline(true);
        return;
      }
      const last = polyPoints[polyPoints.length - 1];
      if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) > 0.5) {
        setPolyPoints((prev) => [...prev, pt]);
      }
      return;
    }

    // 3. Pot de peinture hybride (bordure prioritaire + Niveau 1/2 raster sur scène)
    if (drawingTool === 'bucket') {
      const strokeHit = findPathStrokeAtPoint(pt, existingPaths, isLegacy200 ? 4 : 6);
      if (strokeHit) {
        const nextStroke = strokeColor === 'none' ? fillColor : strokeColor;
        const nextStrokeId = strokeColor === 'none' ? fillColorId : strokeColorId;
        if (nextStroke && nextStroke !== 'none') {
          const nextPaths = existingPaths.map((p) =>
            p.id === strokeHit.id
              ? {
                  ...p,
                  stroke: nextStroke,
                  strokeColorId: nextStrokeId,
                  strokeWidth: p.strokeWidth > 0 ? p.strokeWidth : strokeWidth,
                }
              : p
          );
          latestPathsRef.current = nextPaths;
          onUpdatePaths(nextPaths);
          return;
        }
      }

      if (fillColor === 'none') return;
      const svgEl = svgRef.current;
      const bounds = isLegacy200
        ? { width: 200, height: 200 }
        : {
            width: Math.max(200, Math.round(svgEl?.clientWidth || worldBounds.width || 800)),
            height: Math.max(200, Math.round(svgEl?.clientHeight || worldBounds.height || 500)),
          };
      const result = applyBucketFill(
        pt.x,
        pt.y,
        existingPaths,
        fillColor,
        undefined,
        bounds
      );
      if (result) {
        const nextPaths =
          result.type === 'update_path'
            ? existingPaths.map((p) =>
                p.id === result.pathId
                  ? { ...result.updatedPath, fillColorId }
                  : p
              )
            : [...existingPaths, { ...result.newPath, fillColorId }];
        latestPathsRef.current = nextPaths;
        onUpdatePaths(nextPaths);
      }
      return;
    }

    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    // 4. Gomme partielle & Gomme trait entier
    if (drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') {
      setIsDrawing(true);
      hasPushedDragHistoryRef.current = false;
      const res =
        drawingTool === 'eraser_partial'
          ? erasePathsAtPoint(existingPaths, pt, eraserRadius)
          : eraseWholeStrokesAtPoint(existingPaths, pt, eraserRadius);
      if (res.changed) {
        useSceneStore.getState().pushSceneHistory();
        hasPushedDragHistoryRef.current = true;
        latestPathsRef.current = res.nextPaths;
        onUpdatePaths(res.nextPaths, true);
      }
      return;
    }

    // 5. Tracé continu (Crayon, Ligne, Rectangle, Cercle, Lasso)
    setIsDrawing(true);
    setStartPt(pt);
    setCurrentPt(pt);
    setPoints([pt]);
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const allowSnap =
      drawingTool === 'pencil' ||
      drawingTool === 'lasso_fill' ||
      drawingTool === 'line' ||
      drawingTool === 'polyline' ||
      drawingTool === 'rectangle' ||
      drawingTool === 'circle';
    const pt = getSvgCoordinates(e, allowSnap);
    setHoverPt(pt);

    if (layer.locked) return;

    // Sélection : Move / Resize / Marquee
    if (drawingTool === 'select' && dragMode !== 'none') {
      const rawPt = getSvgCoordinates(e, false);
      if (dragMode === 'marquee') {
        setMarqueeCurrent(rawPt);
        return;
      }
      if (dragMode === 'move' && dragStartPtRef.current) {
        let dx = rawPt.x - dragStartPtRef.current.x;
        let dy = rawPt.y - dragStartPtRef.current.y;
        if (drawingSnapToGrid) {
          if (dragStartBoxRef.current) {
            const targetX = Math.round((dragStartBoxRef.current.x + dx) / gridStep) * gridStep;
            const targetY = Math.round((dragStartBoxRef.current.y + dy) / gridStep) * gridStep;
            dx = targetX - dragStartBoxRef.current.x;
            dy = targetY - dragStartBoxRef.current.y;
          } else {
            dx = Math.round(dx / gridStep) * gridStep;
            dy = Math.round(dy / gridStep) * gridStep;
          }
        }
        if (Math.abs(dx) < 0.2 && Math.abs(dy) < 0.2) return;
        if (!hasPushedDragHistoryRef.current) {
          useSceneStore.getState().pushSceneHistory();
          hasPushedDragHistoryRef.current = true;
        }
        const nextPaths = dragStartPathsRef.current.map((p) =>
          selectedIds.includes(p.id) ? translatePath(p, dx, dy) : p
        );
        latestPathsRef.current = nextPaths;
        onUpdatePaths(nextPaths, true);
        return;
      }
      if (
        dragMode === 'resize' &&
        resizeHandle &&
        dragStartBoxRef.current &&
        singleResizableShape
      ) {
        const snappedTarget = snapPt(rawPt, drawingSnapToGrid);
        const orig = dragStartBoxRef.current;
        let left = orig.x;
        let top = orig.y;
        let right = orig.x + orig.width;
        let bottom = orig.y + orig.height;
        const minSize = isLegacy200 ? 4 : 8;

        if (resizeHandle.includes('w')) left = Math.min(snappedTarget.x, right - minSize);
        if (resizeHandle.includes('e')) right = Math.max(snappedTarget.x, left + minSize);
        if (resizeHandle.includes('n')) top = Math.min(snappedTarget.y, bottom - minSize);
        if (resizeHandle.includes('s')) bottom = Math.max(snappedTarget.y, top + minSize);

        const newRect = {
          x: left,
          y: top,
          width: Math.max(minSize, right - left),
          height: Math.max(minSize, bottom - top),
        };
        if (!hasPushedDragHistoryRef.current) {
          useSceneStore.getState().pushSceneHistory();
          hasPushedDragHistoryRef.current = true;
        }
        const nextPaths = dragStartPathsRef.current.map((p) =>
          p.id === singleResizableShape.id ? resizeShapeToRect(p, newRect) : p
        );
        latestPathsRef.current = nextPaths;
        onUpdatePaths(nextPaths, true);
        return;
      }
      return;
    }

    if (!isDrawing) return;
    setCurrentPt(pt);

    if (drawingTool === 'pencil' || drawingTool === 'lasso_fill') {
      const rawPt = getSvgCoordinates(e, drawingSnapToGrid);
      const nativeEvt = e.nativeEvent as PointerEvent;
      const coalesced =
        !drawingSnapToGrid && typeof nativeEvt.getCoalescedEvents === 'function'
          ? nativeEvt.getCoalescedEvents()
          : null;

      setPoints((prev) => {
        let next = prev;
        const minStep = drawingSnapToGrid ? 0.5 : isLegacy200 ? 0.7 : 2;
        if (coalesced && coalesced.length > 0 && svgRef.current) {
          const rect = svgRef.current.getBoundingClientRect();
          for (const ce of coalesced) {
            const cPt = isLegacy200
              ? {
                  x: Math.max(0, Math.min(200, ((ce.clientX - rect.left) / rect.width) * 200)),
                  y: Math.max(0, Math.min(200, ((ce.clientY - rect.top) / rect.height) * 200)),
                }
              : {
                  x: Math.round((ce.clientX - rect.left) * 10) / 10,
                  y: Math.round((ce.clientY - rect.top) * 10) / 10,
                };
            const last = next[next.length - 1];
            if (!last || Math.hypot(cPt.x - last.x, cPt.y - last.y) >= minStep) {
              next = next === prev ? [...prev, cPt] : [...next, cPt];
            }
          }
          return next;
        }
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(rawPt.x - last.x, rawPt.y - last.y) >= minStep) {
          return [...prev, rawPt];
        }
        return prev;
      });
    } else if (drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') {
      const current = latestPathsRef.current;
      const res =
        drawingTool === 'eraser_partial'
          ? erasePathsAtPoint(current, pt, eraserRadius)
          : eraseWholeStrokesAtPoint(current, pt, eraserRadius);
      if (res.changed) {
        if (!hasPushedDragHistoryRef.current) {
          useSceneStore.getState().pushSceneHistory();
          hasPushedDragHistoryRef.current = true;
        }
        latestPathsRef.current = res.nextPaths;
        onUpdatePaths(res.nextPaths, true);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    if (drawingTool === 'select' && dragMode !== 'none') {
      if (dragMode === 'marquee' && marqueeStart && marqueeCurrent) {
        const mx = Math.min(marqueeStart.x, marqueeCurrent.x);
        const my = Math.min(marqueeStart.y, marqueeCurrent.y);
        const mw = Math.abs(marqueeCurrent.x - marqueeStart.x);
        const mh = Math.abs(marqueeCurrent.y - marqueeStart.y);
        if (mw > 3 || mh > 3) {
          const hits = existingPaths
            .filter((p) => {
              const b = getPathBounds(p);
              return !(
                b.x + b.width < mx ||
                b.x > mx + mw ||
                b.y + b.height < my ||
                b.y > my + mh
              );
            })
            .map((p) => p.id);
          setSelectedIds((prev) =>
            e.shiftKey ? Array.from(new Set([...prev, ...hits])) : hits
          );
        }
      }
      setDragMode('none');
      setResizeHandle(null);
      setMarqueeStart(null);
      setMarqueeCurrent(null);
      dragStartPtRef.current = null;
      dragStartBoxRef.current = null;
      hasPushedDragHistoryRef.current = false;
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (layer.locked) {
      setPoints([]);
      setStartPt(null);
      setCurrentPt(null);
      return;
    }

    if (drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') {
      hasPushedDragHistoryRef.current = false;
      return;
    }

    const allowSnap =
      drawingTool === 'pencil' ||
      drawingTool === 'lasso_fill' ||
      drawingTool === 'line' ||
      drawingTool === 'rectangle' ||
      drawingTool === 'circle';
    const pt = getSvgCoordinates(e, allowSnap);
    let newPath: VectorPath | null = null;

    if (drawingTool === 'pencil' && points.length > 0) {
      const effectiveStroke = strokeColor === 'none' ? '#000000' : strokeColor;
      newPath = {
        id: makePathId(),
        d: pointsToSmoothPath(points, false),
        stroke: effectiveStroke,
        strokeColorId: effectiveStroke === strokeColor ? strokeColorId : undefined,
        strokeWidth,
        fill: 'none',
        points,
      };
    } else if (drawingTool === 'lasso_fill' && points.length >= 2) {
      const effectiveFill =
        fillColor === 'none'
          ? strokeColor === 'none'
            ? '#000000'
            : strokeColor
          : fillColor;
      const effectiveFillId = fillColor === 'none' ? strokeColorId : fillColorId;
      newPath = {
        id: makePathId(),
        d: pointsToSmoothPath(points, true),
        stroke: 'none',
        strokeWidth: 0,
        fill: effectiveFill,
        fillColorId: effectiveFillId,
        points: [...points, points[0]],
      };
    } else if (drawingTool === 'line' && startPt) {
      const effectiveStroke = strokeColor === 'none' ? '#000000' : strokeColor;
      newPath = {
        id: makePathId(),
        d: generateLinePath(startPt, pt),
        stroke: effectiveStroke,
        strokeColorId: effectiveStroke === strokeColor ? strokeColorId : undefined,
        strokeWidth,
        fill: 'none',
        points: [startPt, pt],
      };
    } else if (drawingTool === 'rectangle' && startPt) {
      const rx = Math.min(startPt.x, pt.x);
      const ry = Math.min(startPt.y, pt.y);
      const rw = Math.abs(pt.x - startPt.x);
      const rh = Math.abs(pt.y - startPt.y);
      if (rw > 2 && rh > 2) {
        const effectiveStroke =
          strokeColor === 'none' && fillColor === 'none' ? '#000000' : strokeColor;
        const rectObj = { x: rx, y: ry, width: rw, height: rh };
        newPath = {
          id: makePathId(),
          d: generateRoundedRectPath(rectObj),
          stroke: effectiveStroke,
          strokeColorId: effectiveStroke === strokeColor ? strokeColorId : undefined,
          strokeWidth: effectiveStroke === 'none' ? 0 : strokeWidth,
          fill: fillColor,
          fillColorId,
          rect: rectObj,
          points: [
            { x: rx, y: ry },
            { x: rx + rw, y: ry },
            { x: rx + rw, y: ry + rh },
            { x: rx, y: ry + rh },
          ],
        };
      }
    } else if (drawingTool === 'circle' && startPt) {
      const cx = (startPt.x + pt.x) / 2;
      const cy = (startPt.y + pt.y) / 2;
      const r = Math.hypot(pt.x - startPt.x, pt.y - startPt.y) / 2;
      if (r > 2) {
        const effectiveStroke =
          strokeColor === 'none' && fillColor === 'none' ? '#000000' : strokeColor;
        newPath = {
          id: makePathId(),
          d: generateCirclePath(cx, cy, r),
          stroke: effectiveStroke,
          strokeColorId: effectiveStroke === strokeColor ? strokeColorId : undefined,
          strokeWidth: effectiveStroke === 'none' ? 0 : strokeWidth,
          fill: fillColor,
          fillColorId,
          circle: { cx, cy, r },
          points: generateCirclePerimeterPoints(cx, cy, r),
        };
      }
    }

    if (newPath) {
      const nextPaths = [...latestPathsRef.current, newPath];
      latestPathsRef.current = nextPaths;
      onUpdatePaths(nextPaths);
    }

    setPoints([]);
    setStartPt(null);
    setCurrentPt(null);
  };

  const handleDoubleClick = (e: React.MouseEvent<SVGSVGElement>) => {
    e.stopPropagation();
    if (drawingTool === 'polyline' && polyPoints.length >= 2) {
      finishPolyline(false);
    }
  };

  const effectivePreviewStroke =
    strokeColor === 'none' && fillColor === 'none' ? '#000000' : strokeColor;
  const cursorClass =
    drawingTool === 'select'
      ? 'cursor-default'
      : drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke'
      ? 'atelier-cursor-hidden'
      : 'atelier-fine-crosshair';

  return (
    <div
      className="absolute inset-0 z-50 flex flex-col items-center justify-center"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Barre flottante unifiée du calque en haut du canvas */}
      <div
        data-layer-drawing-keep="true"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-2.5 left-1/2 -translate-x-1/2 z-50 max-w-[96%] flex flex-wrap items-center justify-center gap-1.5 px-2.5 py-1.5 bg-white/95 backdrop-blur-md border border-slate-200/90 rounded-2xl shadow-lg"
      >
        {/* Badge calque */}
        <div
          className={`flex items-center gap-1.5 px-2 py-1 rounded-xl text-[11px] font-bold ${
            isColliderLayer
              ? 'bg-orange-50 text-orange-700 border border-orange-200/80'
              : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
          }`}
        >
          {isColliderLayer ? (
            <Shield className="w-3.5 h-3.5 shrink-0" />
          ) : (
            <Layers className="w-3.5 h-3.5 shrink-0" />
          )}
          <span className="truncate max-w-[110px]">{layer.name}</span>
          {layer.locked && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded-md">
              <Lock className="w-2.5 h-2.5" />
              Verrouillé
            </span>
          )}
        </div>

        <div className="w-px h-5 bg-slate-200" />

        {/* Annuler / Rétablir / Vider */}
        <button
          type="button"
          onClick={() => undoScene()}
          disabled={!canUndo}
          title="Annuler (Cmd/Ctrl+Z)"
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Undo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Annuler</span>
        </button>

        <button
          type="button"
          onClick={() => redoScene()}
          disabled={!canRedo}
          title="Rétablir (Cmd/Ctrl+Shift+Z)"
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Redo2 className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Rétablir</span>
        </button>

        <button
          type="button"
          onClick={() => {
            if (layer.locked) return;
            latestPathsRef.current = [];
            onUpdatePaths([]);
            setSelectedIds([]);
            setPolyPoints([]);
          }}
          disabled={layer.locked || existingPaths.length === 0}
          title="Vider ce calque"
          className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 disabled:opacity-35 disabled:cursor-not-allowed cursor-pointer transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Vider</span>
        </button>

        <div className="w-px h-5 bg-slate-200" />

        {/* Grille & Snap */}
        <button
          type="button"
          onClick={() => setDrawingShowGrid(!drawingShowGrid)}
          title="Afficher la grille de dessin"
          className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
            drawingShowGrid
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          <Grid className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Grille</span>
        </button>

        <button
          type="button"
          onClick={() => setDrawingSnapToGrid(!drawingSnapToGrid)}
          title="Magnétisme sur la grille"
          className={`flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold cursor-pointer transition-colors ${
            drawingSnapToGrid
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
          }`}
        >
          <Magnet className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Snap</span>
        </button>

        {/* Actions contextuelles Polyligne */}
        {drawingTool === 'polyline' && polyPoints.length > 0 && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            {polyPoints.length >= 2 && (
              <button
                type="button"
                onClick={() => finishPolyline(false)}
                className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                title="Valider la polyligne ouverte (Entrée)"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Valider</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setPolyPoints([])}
              className="p-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 cursor-pointer"
              title="Annuler le tracé en cours"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Actions contextuelles Sélection */}
        {drawingTool === 'select' && selectedIds.length > 0 && !layer.locked && (
          <>
            <div className="w-px h-5 bg-slate-200" />
            <button
              type="button"
              onClick={duplicateSelectedPaths}
              title="Dupliquer la sélection (Cmd/Ctrl+D)"
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={deleteSelectedPaths}
              title="Supprimer la sélection (Suppr)"
              className="flex items-center gap-1 px-2 py-1 rounded-xl text-[11px] font-semibold bg-rose-50 hover:bg-rose-100 text-rose-700 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>({selectedIds.length})</span>
            </button>
          </>
        )}

        <div className="w-px h-5 bg-slate-200" />

        {/* Terminer */}
        <button
          type="button"
          onClick={() => selectLayer(null)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer transition-colors"
          title="Terminer le dessin sur ce calque (Échap)"
        >
          <Check className="w-3.5 h-3.5" />
          <span>Terminer</span>
        </button>
      </div>

      {/* SVG Canvas Interactive Surface (adapté caméra & parallaxe) */}
      <div
        className={isLegacyOrFixed ? 'absolute inset-0 overflow-visible' : 'absolute left-0 top-0 overflow-visible'}
        style={{
          ...(isLegacyOrFixed ? {} : { width: worldBounds.width, height: worldBounds.height }),
          transformOrigin: '0 0',
          transform: layerTransformCss,
        }}
      >
        <svg
          ref={svgRef}
          {...(isLegacy200 ? { viewBox: '0 0 200 200', preserveAspectRatio: 'none' as const } : {})}
          className={`w-full h-full touch-none select-none overflow-visible ${cursorClass}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={() => setHoverPt(null)}
          onDoubleClick={handleDoubleClick}
        >
        {/* Grille de dessin optionnelle */}
        {drawingShowGrid && (
          <>
            <defs>
              <pattern
                id={`layer-draw-grid-${layer.id}`}
                width={gridStep}
                height={gridStep}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                  fill="none"
                  stroke="#4f46e5"
                  strokeOpacity="0.28"
                  strokeWidth={isLegacy200 ? 0.45 : 0.9}
                />
                <rect
                  x="0"
                  y="0"
                  width={isLegacy200 ? 0.9 : 1.8}
                  height={isLegacy200 ? 0.9 : 1.8}
                  fill="#4f46e5"
                  fillOpacity="0.45"
                />
              </pattern>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill={`url(#layer-draw-grid-${layer.id})`}
              className="pointer-events-none"
            />
          </>
        )}

        {/* Live Drawing Previews */}
        {isDrawing && drawingTool === 'pencil' && points.length > 0 && (
          <path
            d={pointsToSmoothPath(points, false)}
            stroke={strokeColor === 'none' ? '#000000' : strokeColor}
            strokeWidth={strokeWidth}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {isDrawing && drawingTool === 'lasso_fill' && points.length > 1 && (
          <path
            d={pointsToSmoothPath(points, true)}
            stroke="none"
            fill={
              fillColor === 'none'
                ? strokeColor === 'none'
                  ? '#000000'
                  : strokeColor
                : fillColor
            }
            fillOpacity={0.75}
          />
        )}

        {isDrawing && drawingTool === 'line' && startPt && currentPt && (
          <line
            x1={startPt.x}
            y1={startPt.y}
            x2={currentPt.x}
            y2={currentPt.y}
            stroke={strokeColor === 'none' ? '#000000' : strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {isDrawing && drawingTool === 'rectangle' && startPt && currentPt && (
          <rect
            x={Math.min(startPt.x, currentPt.x)}
            y={Math.min(startPt.y, currentPt.y)}
            width={Math.abs(currentPt.x - startPt.x)}
            height={Math.abs(currentPt.y - startPt.y)}
            stroke={effectivePreviewStroke}
            strokeWidth={effectivePreviewStroke === 'none' ? 0 : strokeWidth}
            fill={fillColor}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {isDrawing && drawingTool === 'circle' && startPt && currentPt && (
          <circle
            cx={(startPt.x + currentPt.x) / 2}
            cy={(startPt.y + currentPt.y) / 2}
            r={Math.hypot(currentPt.x - startPt.x, currentPt.y - startPt.y) / 2}
            stroke={effectivePreviewStroke}
            strokeWidth={effectivePreviewStroke === 'none' ? 0 : strokeWidth}
            fill={fillColor}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {/* Aperçu Polyligne en cours */}
        {drawingTool === 'polyline' && polyPoints.length > 0 && (
          <g className="pointer-events-none">
            <path
              d={pointsToPolylinePath(hoverPt ? [...polyPoints, hoverPt] : polyPoints, false)}
              stroke={effectivePreviewStroke}
              strokeWidth={effectivePreviewStroke === 'none' ? 2 : strokeWidth}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {polyPoints.map((pt, i) => {
              const isFirst = i === 0 && polyPoints.length >= 3;
              return (
                <circle
                  key={i}
                  cx={pt.x}
                  cy={pt.y}
                  r={isFirst ? (isLegacy200 ? 3.2 : 6) : isLegacy200 ? 1.8 : 3.5}
                  fill={isFirst ? '#10b981' : '#ffffff'}
                  stroke={isFirst ? '#047857' : '#4f46e5'}
                  strokeWidth={isLegacy200 ? 0.8 : 1.5}
                />
              );
            })}
          </g>
        )}

        {/* Marquee de sélection */}
        {dragMode === 'marquee' && marqueeStart && marqueeCurrent && (
          <rect
            x={Math.min(marqueeStart.x, marqueeCurrent.x)}
            y={Math.min(marqueeStart.y, marqueeCurrent.y)}
            width={Math.abs(marqueeCurrent.x - marqueeStart.x)}
            height={Math.abs(marqueeCurrent.y - marqueeStart.y)}
            fill="#6366f1"
            fillOpacity={0.12}
            stroke="#4f46e5"
            strokeWidth={isLegacy200 ? 0.8 : 1.5}
            strokeDasharray={isLegacy200 ? '3 2' : '5 3'}
            className="pointer-events-none"
          />
        )}

        {/* Cadre englobant et poignées de redimensionnement de la sélection */}
        {drawingTool === 'select' && selectionBox && (
          <g className="pointer-events-none">
            <rect
              x={selectionBox.x - (isLegacy200 ? 2 : 4)}
              y={selectionBox.y - (isLegacy200 ? 2 : 4)}
              width={selectionBox.width + (isLegacy200 ? 4 : 8)}
              height={selectionBox.height + (isLegacy200 ? 4 : 8)}
              fill="none"
              stroke="#4f46e5"
              strokeWidth={isLegacy200 ? 0.8 : 1.5}
              strokeDasharray={isLegacy200 ? '3 2' : '5 3'}
            />
            {singleResizableShape &&
              [
                { x: selectionBox.x, y: selectionBox.y },
                { x: selectionBox.x + selectionBox.width, y: selectionBox.y },
                { x: selectionBox.x + selectionBox.width, y: selectionBox.y + selectionBox.height },
                { x: selectionBox.x, y: selectionBox.y + selectionBox.height },
              ].map((corner, idx) => (
                <rect
                  key={idx}
                  x={corner.x - handleSize / 2}
                  y={corner.y - handleSize / 2}
                  width={handleSize}
                  height={handleSize}
                  rx={isLegacy200 ? 1 : 2}
                  fill="#ffffff"
                  stroke="#4f46e5"
                  strokeWidth={isLegacy200 ? 0.8 : 1.5}
                />
              ))}
          </g>
        )}

        {/* Repère visuel d'aimantation Snap to Grid */}
        {drawingSnapToGrid &&
          hoverPt &&
          !['select', 'eraser_partial', 'eraser_stroke', 'bucket'].includes(drawingTool) && (
            <g className="pointer-events-none">
              <circle
                cx={hoverPt.x}
                cy={hoverPt.y}
                r={isLegacy200 ? 2.4 : 4.5}
                fill="rgba(79,70,229,0.16)"
                stroke="#4f46e5"
                strokeWidth={isLegacy200 ? 0.6 : 1.2}
              />
              <circle
                cx={hoverPt.x}
                cy={hoverPt.y}
                r={isLegacy200 ? 0.9 : 1.8}
                fill="#4f46e5"
              />
            </g>
          )}

        {/* Curseur visuel de gomme */}
        {(drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') && hoverPt && (
          <circle
            cx={hoverPt.x}
            cy={hoverPt.y}
            r={eraserRadius}
            fill={drawingTool === 'eraser_stroke' ? 'rgba(244,63,94,0.12)' : 'rgba(99,102,241,0.1)'}
            stroke={drawingTool === 'eraser_stroke' ? '#e11d48' : '#4f46e5'}
            strokeWidth={isLegacy200 ? 0.7 : 1.5}
            strokeDasharray={isLegacy200 ? '2 1.5' : '4 3'}
            className="pointer-events-none"
          />
        )}
        </svg>
      </div>
    </div>
  );
}
