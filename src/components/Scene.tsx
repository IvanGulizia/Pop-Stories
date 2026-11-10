import { useState, useRef } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { Apple } from './Apple';
import { Plant } from './Plant';
import { CustomShape } from './CustomShape';
import { Sparkles, Paintbrush, PlayCircle } from 'lucide-react';

export const FINE_CROSSHAIR_CURSOR =
  'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'19\' height=\'19\' viewBox=\'0 0 19 19\'%3E%3Cpath d=\'M9.5 1v17M1 9.5h17\' stroke=\'%23ffffff\' stroke-width=\'2.5\' stroke-linecap=\'round\'/%3E%3Cpath d=\'M9.5 1v17M1 9.5h17\' stroke=\'%230f172a\' stroke-width=\'1.2\' stroke-linecap=\'round\'/%3E%3C/svg%3E") 9 9, crosshair';

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
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
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
  const foregroundGroups = layerGroups.filter((g) => g.kind === 'foreground');
  const otherGroups = layerGroups.filter((g) => g.kind === 'custom');

  const renderLayerSvg = (paths: any[], opacity: number = 1) => {
    if (!paths || paths.length === 0) return null;
    return (
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full pointer-events-none"
        style={{ opacity }}
        preserveAspectRatio="none"
      >
        {paths.map((p, idx) => (
          <path
            key={p.id || idx}
            d={p.d}
            stroke={p.stroke || '#6366f1'}
            strokeWidth={p.strokeWidth || 4}
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
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
            return (
              <div key={layer.id} className="absolute inset-0">
                {renderLayerSvg(layer.vectorPaths, layer.opacity)}
              </div>
            );
          })}
        </div>

        {/* Empty State Overlay when no entities and no archetypes exist */}
        {isCompletelyEmptyProject && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto bg-slate-50/50 backdrop-blur-2xs">
            <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-3xl shadow-sm mb-4 animate-in zoom-in-95 duration-200">
              🎨
            </div>
            <h3 className="text-xl font-bold text-slate-800 tracking-tight">
              Nouveau Projet Atelier Vivant
            </h3>
            <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-6 leading-relaxed">
              Le canvas et vos règles sont vides. Choisissez comment démarrer votre projet :
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
              {/* Option 1: Créer une Entité */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onOpenCreateModal) onOpenCreateModal();
                }}
                className="p-5 bg-white hover:bg-indigo-50/40 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                    <Paintbrush className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                    Nouveau
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

              {/* Option 2: Ouvrir la Scène Démo */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  restoreDefaultScene();
                }}
                className="p-5 bg-white hover:bg-emerald-50/40 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-[0.98]"
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                    <PlayCircle className="w-5 h-5" />
                  </div>
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                    Démo
                  </span>
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-950">
                    Ouvrir la scène d'exemple
                  </div>
                  <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                    Charge la scène interactive d'exemple (Plante magique, Pomme, règles Storyboard).
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

        {/* 3. CALQUES DE PREMIER-PLAN DESSINÉS (FOREGROUND & AUTRES: z-40) */}
        <div className="absolute inset-0 pointer-events-none z-40">
          {[...otherGroups, ...foregroundGroups].flatMap((g) => g.layers).map((layer) => {
            if (!layer.visible || !layer.vectorPaths || layer.vectorPaths.length === 0) return null;
            return (
              <div key={layer.id} className="absolute inset-0">
                {renderLayerSvg(layer.vectorPaths, layer.opacity)}
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
  const fillColor = useSceneStore((state) => state.drawingFillColor);
  const strokeWidth = useSceneStore((state) => state.drawingStrokeWidth);
  const selectLayer = useSceneStore((state) => state.selectLayer);

  const [isDrawing, setIsDrawing] = useState(false);
  const [points, setPoints] = useState<{ x: number; y: number }[]>([]);
  const [startPt, setStartPt] = useState<{ x: number; y: number } | null>(null);
  const [currentPt, setCurrentPt] = useState<{ x: number; y: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const getSvgCoordinates = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(200, ((e.clientX - rect.left) / rect.width) * 200));
    const y = Math.max(0, Math.min(200, ((e.clientY - rect.top) / rect.height) * 200));
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

  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    e.stopPropagation();
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
        // Erase any path near click point
        if (p.points && p.points.length > 0) {
          const hit = p.points.some((pPoint: any) => Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y) <= Math.max(10, strokeWidth * 2));
          return !hit;
        }
        return true;
      });
      onUpdatePaths(updated);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!isDrawing) return;
    const pt = getSvgCoordinates(e);
    setCurrentPt(pt);

    if (drawingTool === 'pencil') {
      setPoints((prev) => {
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(pt.x - last.x, pt.y - last.y) >= 0.8) {
          return [...prev, pt];
        }
        return prev;
      });
    } else if (drawingTool === 'eraser_partial' || drawingTool === 'eraser_stroke') {
      const existing = layer.vectorPaths || [];
      const updated = existing.filter((p: any) => {
        if (p.points && p.points.length > 0) {
          const hit = p.points.some((pPoint: any) => Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y) <= Math.max(10, strokeWidth * 2));
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

    const pt = getSvgCoordinates(e);
    const existingPaths = layer.vectorPaths || [];
    let newPath: any = null;

    if (drawingTool === 'pencil' && points.length > 0) {
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: pointsToPath(points),
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
        points,
      };
    } else if (drawingTool === 'line' && startPt) {
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: `M ${startPt.x} ${startPt.y} L ${pt.x} ${pt.y}`,
        stroke: strokeColor,
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
          strokeWidth,
          fill: fillColor,
          rect: { x: rx, y: ry, width: rw, height: rh },
          points: [{ x: rx, y: ry }, { x: rx + rw, y: ry }, { x: rx + rw, y: ry + rh }, { x: rx, y: ry + rh }],
        };
      }
    } else if (drawingTool === 'circle' && startPt) {
      const cx = (startPt.x + pt.x) / 2;
      const cy = (startPt.y + pt.y) / 2;
      const r = Math.max(3, Math.hypot(pt.x - startPt.x, pt.y - startPt.y) / 2);
      newPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d: `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0 Z`,
        stroke: strokeColor,
        strokeWidth,
        fill: fillColor,
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
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center">
      {/* Top Banner indicating active layer drawing mode */}
      <div className="absolute top-3 left-3 z-50 bg-slate-900/90 text-white text-xs font-bold px-3 py-1.5 rounded-2xl shadow-lg border border-slate-700 flex items-center gap-2 backdrop-blur-xs">
        <span className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-ping" />
        <span>Dessin Direct sur : <strong>{layer.name}</strong></span>
        <button
          type="button"
          onClick={() => selectLayer(null)}
          className="ml-2 px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] rounded-lg font-bold transition-all cursor-pointer"
        >
          Terminer
        </button>
      </div>

      {/* SVG Canvas Interactive Surface */}
      <svg
        ref={svgRef}
        viewBox="0 0 200 200"
        preserveAspectRatio="none"
        className="w-full h-full atelier-fine-crosshair touch-none select-none"
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
