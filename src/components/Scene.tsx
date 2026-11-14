import { useState, useRef, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { Apple } from './Apple';
import { Plant } from './Plant';
import { CustomShape } from './CustomShape';
import { Sparkles, Paintbrush } from 'lucide-react';
import { ParticleCanvasOverlay } from './ParticleCanvasOverlay';
import {
  stepMatterPhysics,
  startKeyboardListening,
  stopKeyboardListening,
} from '../utils/matterPhysicsEngine';

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
          for (const g of layerGroups) {
            const found = g.layers.find((l) => l.id === selectedLayerId);
            if (found) {
              activeLayer = found;
              break;
            }
          }
          if (!activeLayer) return null;

          return (
            <DirectCanvasDrawingOverlay
              layer={activeLayer}
              onUpdatePaths={(paths) => setLayerVectorPaths(selectedLayerId, paths)}
            />
          );
        })()}
      </div>
    </div>
  );
}

// Composant d'interaction de dessin direct vectoriel sur le canvas de scène
function DirectCanvasDrawingOverlay({
  layer,
  onUpdatePaths,
}: {
  layer: any;
  onUpdatePaths: (paths: any[]) => void;
}) {
  const drawingTool = useSceneStore((state) => state.drawingTool);
  const strokeColor = useSceneStore((state) => state.drawingStrokeColor);
  const strokeColorId = useSceneStore((state) => state.drawingStrokeColorId);
  const fillColor = useSceneStore((state) => state.drawingFillColor);
  const fillColorId = useSceneStore((state) => state.drawingFillColorId);
  const strokeWidth = useSceneStore((state) => state.drawingStrokeWidth);

  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [currentPt, setCurrentPt] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const isLegacy200 = layer.coordinateSpace === 'legacy_200';

  const getSvgCoordinates = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    if (isLegacy200) {
      const x = Math.max(0, Math.min(200, ((e.clientX - rect.left) / rect.width) * 200));
      const y = Math.max(0, Math.min(200, ((e.clientY - rect.top) / rect.height) * 200));
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
    }
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 };
  };

  const pointsToPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return '';
    if (pts.length === 1) return `M ${pts[0].x} ${pts[0].y} L ${pts[0].x + 0.1} ${pts[0].y + 0.1}`;
    let d = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 1; i < pts.length; i++) {
      const xc = (pts[i].x + pts[i - 1].x) / 2;
      const yc = (pts[i].y + pts[i - 1].y) / 2;
      d += ` Q ${pts[i - 1].x} ${pts[i - 1].y}, ${xc} ${yc}`;
    }
    d += ` L ${pts[pts.length - 1].x} ${pts[pts.length - 1].y}`;
    return d;
  };

  const eraserRadius = isLegacy200
    ? Math.max(10, strokeWidth * 2)
    : Math.max(14, strokeWidth * 1.5);

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
    if (layer.locked) return;
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const pt = getSvgCoordinates(e);
    setIsDrawing(true);
    setStartPt(pt);
    setCurrentPt(pt);
    setPoints([pt]);

    if (drawingTool === 'eraser_stroke' || drawingTool === 'eraser_partial') {
      const existing = layer.vectorPaths || [];
      const updated = existing.filter((p: any) => {
        if (p.points && p.points.length > 0) {
          const hit = p.points.some((pPoint: any) => Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y) <= eraserRadius);
          return !hit;
        }
        return true;
      });
      onUpdatePaths(updated);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing || layer.locked) return;
    const pt = getSvgCoordinates(e);
    setCurrentPt(pt);

    if (drawingTool === 'pencil') {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        const minStep = isLegacy200 ? 0.8 : 2.5;
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= minStep) {
          return [...prev, pt];
        }
        return prev;
      });
    } else if (drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') {
      const existing = layer.vectorPaths || [];
      const updated = existing.filter((p: any) => {
        if (p.points && p.points.length > 0) {
          const hit = p.points.some((pPoint: any) => Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y) <= eraserRadius);
          return !hit;
        }
        return true;
      });
      if (updated.length !== existing.length) {
        onUpdatePaths(updated);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    setIsDrawing(false);

    try {
      (e.target as Element).releasePointerCapture?.(e.pointerId);
    } catch (_) {}

    if (layer.locked) {
      setPoints([]);
      setStartPt(null);
      setCurrentPt(null);
      return;
    }

    const pt = getSvgCoordinates(e);
    const existingPaths = layer.vectorPaths || [];
    let newPath: any = null;

    if (drawingTool === 'pencil' && points.length > 0) {
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: pointsToPath(points),
        stroke: strokeColor,
        strokeColorId,
        strokeWidth,
        fill: fillColor,
        fillColorId,
        points,
      };
    } else if (drawingTool === 'line' && startPt) {
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: `M ${startPt.x} ${startPt.y} L ${pt.x} ${pt.y}`,
        stroke: strokeColor,
        strokeColorId,
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
        newPath = {
          id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          d: `M ${rx} ${ry} h ${rw} v ${rh} h ${-rw} Z`,
          stroke: strokeColor,
          strokeColorId,
          strokeWidth,
          fill: fillColor,
          fillColorId,
          rect: { x: rx, y: ry, width: rw, height: rh },
          points: [{ x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh }],
        };
      }
    } else if (drawingTool === 'circle' && startPt) {
      const cx = (startPt.x + pt.x) / 2;
      const cy = (startPt.y + pt.y) / 2;
      const r = Math.max(3, Math.hypot(pt.x - startPt.x, pt.y - startPt.y) / 2);
      const perimeterPts = Array.from({ length: 16 }, (_, idx) => {
        const a = (idx / 16) * Math.PI * 2;
        return { x: Math.round((cx + Math.cos(a) * r) * 10) / 10, y: Math.round((cy + Math.sin(a) * r) * 10) / 10 };
      });
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
        stroke: strokeColor,
        strokeColorId,
        strokeWidth,
        fill: fillColor,
        fillColorId,
        circle: { cx, cy, r },
        points: perimeterPts,
      };
    }

    if (newPath) {
      onUpdatePaths([...existingPaths, newPath]);
    }

    setPoints([]);
    setStartPt(null);
    setCurrentPt(null);
  };

  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center" onClick={(e) => e.stopPropagation()}>
      {/* SVG Canvas Interactive Surface */}
      <svg
        ref={svgRef}
        {...(isLegacy200 ? { viewBox: '0 0 200 200', preserveAspectRatio: 'none' as const } : {})}
        className="w-full h-full atelier-fine-crosshair touch-none select-none overflow-visible"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
      >
        {/* Live Drawing Preview */}
        {isDrawing && drawingTool === 'pencil' && points.length > 0 && (
          <path
            d={pointsToPath(points)}
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill={fillColor}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}

        {isDrawing && drawingTool === 'line' && startPt && currentPt && (
          <line
            x1={startPt.x}
            y1={startPt.y}
            x2={currentPt.x}
            y2={currentPt.y}
            stroke={strokeColor}
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
            stroke={strokeColor}
            strokeWidth={strokeWidth}
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
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            fill={fillColor}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
      </svg>
    </div>
  );
}
