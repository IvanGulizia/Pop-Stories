import { useState, useRef, useEffect, useCallback } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { VectorPath } from '../types';
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
} from 'lucide-react';
import { ParticleCanvasOverlay } from './ParticleCanvasOverlay';
import {
  stepMatterPhysics,
  startKeyboardListening,
  stopKeyboardListening,
} from '../utils/matterPhysicsEngine';
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
} from '../utils/vectorDrawing';

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
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const settings = useSceneStore((state) => state.settings);
  const appMode = useSceneStore((state) => state.appMode);
  const gameScore = useSceneStore((state) => state.gameScore);

  const hasEntitiesOnCanvas = Object.keys(entities).length > 0;
  const hasArchetypesInCatalog = Object.keys(customArchetypes).length > 0;
  const isCompletelyEmptyProject = !hasEntitiesOnCanvas && !hasArchetypesInCatalog;

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
        const dropX = Math.max(20, Math.min(rect.width - 80, e.clientX - rect.left - 40));
        const dropY = Math.max(20, Math.min(rect.height - 80, e.clientY - rect.top - 40));

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

  const isPlayMode = appMode === 'play';
  const isCustomCursorActive = isPlayMode && settings.useCustomCursors !== false;
  const ratio = settings.aspectRatio || 'free';
  const batchUpdateEntityTransforms = useSceneStore((state) => state.batchUpdateEntityTransforms);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const mousePosRef = useRef<{ x: number; y: number } | null>(null);
  const setSceneBounds = useSceneStore((state) => state.setSceneBounds);

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

  // Boucle de simulation physique Matter.js & contrôles joueur en mode Play (60 FPS)
  useEffect(() => {
    if (!isPlayMode) {
      stopKeyboardListening();
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
        const currentEntities = stateSnapshot.entities;
        const activeColliderLayers = (stateSnapshot.layerGroups || []).flatMap((g) =>
          g.layers.filter(
            (l) =>
              (l.role === 'collider' || g.kind === 'collider') &&
              l.visible &&
              (l.vectorPaths?.length || 0) > 0
          )
        );
        const result = stepMatterPhysics({
          entities: currentEntities,
          deltaTime,
          canvasBounds: { width: liveW, height: liveH },
          mousePos: mousePosRef.current,
          colliderLayers: activeColliderLayers,
        });

        if (Object.keys(result.updatedTransforms).length > 0) {
          batchUpdateEntityTransforms(result.updatedTransforms);
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

  const layerGroups = useSceneStore((state) => state.layerGroups || []);

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

  return (
    <div
      className="relative w-full h-full min-h-0 bg-slate-100/70 overflow-hidden select-none flex flex-col items-center justify-start p-3 sm:p-4"
      onClick={() => selectEntity(null)}
    >
      {isCustomCursorActive && (
        <style>{`
          #scene-canvas-container, #scene-canvas-container * {
            cursor: none !important;
          }
        `}</style>
      )}

      {/* CADRE DE SCÈNE AVEC RESPECT DU FORMAT / RATIO */}
      <div
        id="scene-canvas-container"
        ref={canvasContainerRef}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onPointerMove={(e) => {
          if (canvasContainerRef.current) {
            const rect = canvasContainerRef.current.getBoundingClientRect();
            mousePosRef.current = {
              x: e.clientX - rect.left,
              y: e.clientY - rect.top,
            };
          }
        }}
        onPointerLeave={() => {
          mousePosRef.current = null;
        }}
        className={`relative bg-white overflow-hidden select-none flex flex-col rounded-2xl shadow-md border border-slate-300/80 transition-all duration-300 ${
          !isPlayMode && !isCustomCursorActive ? 'atelier-fine-crosshair' : ''
        }`}
        style={{
          ...getAspectRatioStyle(),
        }}
      >
        {/* Canvas Grid Background */}
        {settings.showGrid && settings.gridStyle !== 'clean' && (
          <div
            className="absolute inset-0 pointer-events-none transition-opacity duration-300 z-0"
            style={getGridStyle()}
          />
        )}


        {/* 1. ARRIÈRE-PLANS DESSINÉS (BACKGROUND LAYERS) */}
        <div className="absolute inset-0 pointer-events-none z-1">
          {backgroundGroups.flatMap((g) => g.layers).map((layer) => {
            if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
            const isCollider = layer.role === 'collider';
            if (isCollider && isPlayMode && layer.showColliderInPlay === false) return null;
            return (
              <div key={layer.id} className="absolute inset-0">
                {renderLayerSvg(layer, isCollider)}
              </div>
            );
          })}
        </div>

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

        {/* Empty State Overlay when no entities and no archetypes exist */}
        {isCompletelyEmptyProject && (
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

        {/* 2. RENDU DES ENTITÉS SELON entityOrder (z-index layering: 10 à 30) */}
        {(() => {
          const order = entityOrder && entityOrder.length > 0 ? entityOrder : Object.keys(entities);
          const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
          return allKeys
            .map((id) => entities[id])
            .filter(Boolean)
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

        {/* 2.5. SYSTÈME DE PARTICULES 2D LÉGER (Canvas Overlay 60 FPS, Mode Play) */}
        <ParticleCanvasOverlay active={isPlayMode} />

        {/* 3. CALQUES DE PREMIER-PLAN DESSINÉS (FOREGROUND & AUTRES: z-40) */}
        <div className="absolute inset-0 pointer-events-none z-40">
          {[...otherGroups, ...foregroundGroups].flatMap((g) => g.layers).map((layer) => {
            if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
            const isCollider = layer.role === 'collider';
            if (isCollider && isPlayMode && layer.showColliderInPlay === false) return null;
            return (
              <div key={layer.id} className="absolute inset-0">
                {renderLayerSvg(layer, isCollider)}
              </div>
            );
          })}
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
              onUpdatePaths={(paths, skipHistory) =>
                setLayerVectorPaths(selectedLayerId, paths, skipHistory)
              }
            />
          );
        })()}
      </div>
    </div>
  );
}

// Composant unifié d'interaction de dessin direct vectoriel sur le canvas de scène
function DirectCanvasDrawingOverlay({
  layer,
  isColliderLayer,
  onUpdatePaths,
}: {
  layer: any;
  isColliderLayer: boolean;
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
    const paths: VectorPath[] = layer.vectorPaths || [];
    latestPathsRef.current = paths;
    setSelectedIds((prev) => prev.filter((id) => paths.some((p) => p.id === id)));
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
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
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
        setDragMode('move');
        dragStartPtRef.current = rawPt;
        dragStartPathsRef.current = existingPaths;
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

    // 3. Pot de peinture hybride (Niveau 1 + Niveau 2 raster sur scène)
    if (drawingTool === 'bucket') {
      if (fillColor === 'none') return;
      const rect = svgRef.current?.getBoundingClientRect();
      const bounds = isLegacy200
        ? { width: 200, height: 200 }
        : {
            width: Math.max(200, Math.round(rect?.width || 800)),
            height: Math.max(200, Math.round(rect?.height || 500)),
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
          dx = Math.round(dx / gridStep) * gridStep;
          dy = Math.round(dy / gridStep) * gridStep;
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
      const rawPt = getSvgCoordinates(e, false);
      const nativeEvt = e.nativeEvent as PointerEvent;
      const coalesced =
        typeof nativeEvt.getCoalescedEvents === 'function'
          ? nativeEvt.getCoalescedEvents()
          : null;

      setPoints((prev) => {
        let next = prev;
        const minStep = isLegacy200 ? 0.7 : 2;
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
      ? 'cursor-crosshair'
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

      {/* SVG Canvas Interactive Surface */}
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
                  stroke="#6366f1"
                  strokeOpacity="0.18"
                  strokeWidth={isLegacy200 ? 0.35 : 0.75}
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
  );
}
