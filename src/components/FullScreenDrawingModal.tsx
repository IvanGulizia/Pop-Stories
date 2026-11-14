import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Paintbrush,
  X,
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Film,
} from 'lucide-react';
import { DrawingCanvas, OnionStateOption, ReferenceGuideOption } from './DrawingCanvas';
import {
  VectorPath,
  ColliderType,
  ColliderBounds,
  DrawingLayer,
  AnimationFrame,
  AnimationLoopMode,
} from '../types';

interface FullScreenDrawingModalProps {
  title?: string;
  subtitle?: string;
  initialPaths?: VectorPath[];
  initialLayers?: DrawingLayer[];
  initialFrames?: AnimationFrame[];
  initialFrameRate?: number;
  initialAnimationLoop?: AnimationLoopMode;
  enableFlipbook?: boolean;
  initialColliderType?: ColliderType;
  initialColliderBounds?: ColliderBounds;
  isSharedColliderEntity?: boolean;
  isReferenceStateForSharedCollider?: boolean;
  initialOverrideCollider?: boolean;
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
  referenceGuide?: ReferenceGuideOption;
  availableReferenceGuides?: ReferenceGuideOption[];
  initialHotspot?: { x: number; y: number };
  isCursorMode?: boolean;
  onSave: (
    paths: VectorPath[],
    dataUrl?: string,
    colliderType?: ColliderType,
    stateName?: string,
    hotspot?: { x: number; y: number },
    layers?: DrawingLayer[],
    colliderBounds?: ColliderBounds,
    overrideCollider?: boolean,
    animationData?: {
      frames?: AnimationFrame[];
      frameRate?: number;
      animationLoop?: AnimationLoopMode;
    }
  ) => void;
  onClose: () => void;
}

function makeFrameId() {
  return `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function renderFrameThumbnailSvg(frame: AnimationFrame) {
  const paths = frame.vectorPaths || [];
  const layers = frame.drawingLayers;
  if (paths.length === 0) {
    return (
      <span className="text-[9px] text-slate-300 italic select-none">Vide</span>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full pointer-events-none">
      {!layers || layers.length === 0 ? (
        paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill || 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      ) : (
        (() => {
          const fallbackLayerId = layers[layers.length - 1]?.id || 'layer-1';
          const layerIds = new Set(layers.map((l) => l.id));
          return [...layers].reverse().map((layer) => {
            if (!layer.visible) return null;
            const layerPaths = paths.filter((p) => {
              const resolvedId = p.layerId && layerIds.has(p.layerId) ? p.layerId : fallbackLayerId;
              return resolvedId === layer.id;
            });
            return (
              <g key={layer.id} opacity={layer.opacity ?? 1}>
                {layerPaths.map((p) => (
                  <path
                    key={p.id}
                    d={p.d}
                    stroke={p.stroke}
                    strokeWidth={p.strokeWidth}
                    fill={p.fill || 'none'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          });
        })()
      )}
    </svg>
  );
}

export function FullScreenDrawingModal({
  title,
  subtitle = 'Dessinez votre forme vectorielle en plein écran',
  initialPaths = [],
  initialLayers = [],
  initialFrames,
  initialFrameRate = 8,
  initialAnimationLoop = 'loop',
  enableFlipbook = true,
  initialColliderType = 'box',
  initialColliderBounds,
  isSharedColliderEntity = false,
  isReferenceStateForSharedCollider = false,
  initialOverrideCollider = false,
  onionStates = [],
  currentEditingStateName,
  referenceGuide,
  availableReferenceGuides,
  initialHotspot,
  isCursorMode = false,
  onSave,
  onClose,
}: FullScreenDrawingModalProps) {
  const [frames, setFrames] = useState<AnimationFrame[]>(() => {
    if (initialFrames && initialFrames.length > 0) {
      return JSON.parse(JSON.stringify(initialFrames));
    }
    return [
      {
        id: 'frame_1',
        vectorPaths: JSON.parse(JSON.stringify(initialPaths || [])),
        drawingLayers: initialLayers ? JSON.parse(JSON.stringify(initialLayers)) : undefined,
      },
    ];
  });
  const [activeFrameIndex, setActiveFrameIndex] = useState<number>(0);
  const [frameRate, setFrameRate] = useState<number>(Math.max(1, Math.min(24, initialFrameRate || 8)));
  const [animationLoop, setAnimationLoop] = useState<AnimationLoopMode>(initialAnimationLoop || 'loop');
  const [isPlayingPreview, setIsPlayingPreview] = useState<boolean>(false);
  const [previewFrameIndex, setPreviewFrameIndex] = useState<number>(0);

  const [currentDataUrl, setCurrentDataUrl] = useState<string | undefined>(undefined);
  const [currentColliderType, setCurrentColliderType] = useState<ColliderType>(
    initialColliderBounds?.shape || initialColliderType
  );
  const [currentColliderBounds, setCurrentColliderBounds] = useState<ColliderBounds | undefined>(
    initialColliderBounds
  );
  const [currentOverrideCollider, setCurrentOverrideCollider] = useState<boolean>(
    initialOverrideCollider
  );
  const [currentHotspot, setCurrentHotspot] = useState<{ x: number; y: number }>(
    initialHotspot || referenceGuide?.hotspot || { x: 75, y: 25 }
  );
  const [stateName, setStateName] = useState<string>(currentEditingStateName || 'Normal');
  const [isEditingName, setIsEditingName] = useState(false);

  const safeActiveIdx = Math.max(0, Math.min(activeFrameIndex, frames.length - 1));
  const activeFrame = frames[safeActiveIdx] || frames[0];

  // Lecture aperçu du Flipbook en direct
  useEffect(() => {
    if (!isPlayingPreview || frames.length <= 1) return;
    let idx = safeActiveIdx;
    let dir: 1 | -1 = 1;
    setPreviewFrameIndex(idx);

    const intervalMs = Math.max(35, Math.round(1000 / Math.max(1, frameRate)));
    const timer = window.setInterval(() => {
      if (animationLoop === 'ping_pong') {
        let next = idx + dir;
        if (next >= frames.length) {
          dir = -1;
          next = Math.max(0, frames.length - 2);
        } else if (next < 0) {
          dir = 1;
          next = Math.min(frames.length - 1, 1);
        }
        idx = next;
        setPreviewFrameIndex(idx);
      } else if (animationLoop === 'once') {
        if (idx + 1 >= frames.length) {
          setIsPlayingPreview(false);
          return;
        }
        idx = idx + 1;
        setPreviewFrameIndex(idx);
      } else {
        idx = (idx + 1) % frames.length;
        setPreviewFrameIndex(idx);
      }
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [isPlayingPreview, frames.length, frameRate, animationLoop, safeActiveIdx]);

  const handleVectorChange = (paths: VectorPath[], dataUrl?: string) => {
    setFrames((prev) =>
      prev.map((f, idx) => (idx === safeActiveIdx ? { ...f, vectorPaths: paths } : f))
    );
    if (dataUrl && safeActiveIdx === 0) {
      setCurrentDataUrl(dataUrl);
    }
  };

  const handleLayersChange = (layers: DrawingLayer[]) => {
    setFrames((prev) =>
      prev.map((f, idx) => (idx === safeActiveIdx ? { ...f, drawingLayers: layers } : f))
    );
  };

  // Pelure d'oignon automatique de la frame précédente combinée avec les autres états
  const combinedOnionStates = useMemo<OnionStateOption[]>(() => {
    if (!enableFlipbook || safeActiveIdx === 0) return onionStates;
    const prevFrame = frames[safeActiveIdx - 1];
    if (!prevFrame || !prevFrame.vectorPaths || prevFrame.vectorPaths.length === 0) {
      return onionStates;
    }
    return [
      {
        id: '__prev_frame__',
        name: `Frame #${safeActiveIdx} (précédente)`,
        vectorPaths: prevFrame.vectorPaths,
      },
      ...onionStates,
    ];
  }, [enableFlipbook, safeActiveIdx, frames, onionStates]);

  const handleAddEmptyFrame = () => {
    setIsPlayingPreview(false);
    const baseLayers = activeFrame?.drawingLayers
      ? JSON.parse(JSON.stringify(activeFrame.drawingLayers))
      : undefined;
    const newFrame: AnimationFrame = {
      id: makeFrameId(),
      vectorPaths: [],
      drawingLayers: baseLayers,
    };
    const insertAt = safeActiveIdx + 1;
    setFrames((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, newFrame);
      return next;
    });
    setActiveFrameIndex(insertAt);
  };

  const handleDuplicateFrame = () => {
    setIsPlayingPreview(false);
    const cloned: AnimationFrame = {
      id: makeFrameId(),
      vectorPaths: JSON.parse(JSON.stringify(activeFrame?.vectorPaths || [])),
      drawingLayers: activeFrame?.drawingLayers
        ? JSON.parse(JSON.stringify(activeFrame.drawingLayers))
        : undefined,
    };
    const insertAt = safeActiveIdx + 1;
    setFrames((prev) => {
      const next = [...prev];
      next.splice(insertAt, 0, cloned);
      return next;
    });
    setActiveFrameIndex(insertAt);
  };

  const handleDeleteFrame = (idxToDelete: number) => {
    if (frames.length <= 1) return;
    setIsPlayingPreview(false);
    setFrames((prev) => prev.filter((_, i) => i !== idxToDelete));
    if (safeActiveIdx >= frames.length - 1) {
      setActiveFrameIndex(Math.max(0, frames.length - 2));
    } else if (idxToDelete < safeActiveIdx) {
      setActiveFrameIndex(Math.max(0, safeActiveIdx - 1));
    }
  };

  const handleMoveFrame = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= frames.length) return;
    setIsPlayingPreview(false);
    setFrames((prev) => {
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return copy;
    });
    setActiveFrameIndex(target);
  };

  const handleSaveClick = () => {
    const primaryFrame = frames[0] || activeFrame;
    const primaryPaths = primaryFrame?.vectorPaths || [];
    const primaryLayers = primaryFrame?.drawingLayers;
    onSave(
      primaryPaths,
      currentDataUrl,
      currentColliderType,
      stateName.trim() || undefined,
      currentHotspot,
      primaryLayers,
      currentColliderBounds,
      currentOverrideCollider,
      enableFlipbook
        ? {
            frames: frames.length > 1 ? frames : undefined,
            frameRate,
            animationLoop,
          }
        : undefined
    );
  };

  const previewFrame = frames[previewFrameIndex] || activeFrame;

  return createPortal(
    <div
      data-modal-open="true"
      className="fixed inset-0 z-[10050] bg-[#f8fafc] flex flex-col overflow-hidden select-none"
      style={{ isolation: 'isolate' }}
    >
      <div className="bg-[#f8fafc] w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Paintbrush className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">
                  {title || 'Atelier de Dessin •'}
                </span>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-700">État :</span>
                    <input
                      type="text"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false);
                      }}
                      autoFocus
                      className="px-2 py-0.5 text-sm font-bold text-slate-900 bg-white border border-indigo-500 rounded-lg shadow-2xs outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900 text-sm font-bold transition-all cursor-pointer group"
                    title="Cliquer pour renommer cet état"
                  >
                    <span>État : {stateName}</span>
                    <span className="text-[10px] text-indigo-500 opacity-60 group-hover:opacity-100 underline decoration-dotted">
                      (renommer)
                    </span>
                  </button>
                )}
                {enableFlipbook && frames.length > 1 && (
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                    <Film className="w-3 h-3" />
                    Frame {safeActiveIdx + 1}/{frames.length}
                  </span>
                )}
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" /> Enregistrer le dessin
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full-screen Canvas Body */}
        <div className="flex-1 p-3 sm:p-4 overflow-hidden bg-slate-100/60 flex items-center justify-center relative">
          <DrawingCanvas
            frameSyncKey={activeFrame.id}
            initialPaths={activeFrame.vectorPaths}
            initialLayers={activeFrame.drawingLayers}
            onLayersChange={handleLayersChange}
            initialColliderType={initialColliderType}
            initialColliderBounds={initialColliderBounds}
            isSharedColliderEntity={isSharedColliderEntity}
            isReferenceStateForSharedCollider={isReferenceStateForSharedCollider}
            initialOverrideCollider={initialOverrideCollider}
            onOverrideColliderChange={(ovr) => setCurrentOverrideCollider(ovr)}
            initialStrokeColor="#000000"
            onionStates={combinedOnionStates}
            currentEditingStateName={currentEditingStateName}
            onVectorChange={handleVectorChange}
            onColliderChange={(type, bounds) => {
              setCurrentColliderType(type);
              setCurrentColliderBounds(bounds);
            }}
            referenceGuide={referenceGuide}
            availableReferenceGuides={availableReferenceGuides}
            initialHotspot={currentHotspot}
            onHotspotChange={(pos) => setCurrentHotspot(pos)}
            isCursorMode={isCursorMode}
          />

          {/* Aperçu Animé Live du Flipbook en cours de lecture */}
          {isPlayingPreview && frames.length > 1 && (
            <div className="absolute inset-0 z-40 bg-slate-900/35 backdrop-blur-2xs flex items-center justify-center p-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 flex flex-col items-center gap-3 w-full max-w-sm">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-violet-600" />
                    Aperçu Flipbook ({frameRate} FPS)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-200">
                    F{previewFrameIndex + 1} / {frames.length}
                  </span>
                </div>

                <div className="w-56 h-56 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center p-3">
                  {renderFrameThumbnailSvg(previewFrame)}
                </div>

                <button
                  type="button"
                  onClick={() => setIsPlayingPreview(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
                >
                  <Pause className="w-3.5 h-3.5" /> Revenir au dessin
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Mini-Timeline Flipbook (par État) */}
        {enableFlipbook && (
          <div className="border-t border-slate-200 bg-white px-4 py-2 shrink-0 flex items-center gap-3 overflow-x-auto">
            {/* Contrôles Lecture & Cadence */}
            <div className="flex items-center gap-2 shrink-0 pr-3 border-r border-slate-200">
              <div className="flex items-center gap-1 text-[11px] font-bold text-slate-600">
                <Film className="w-3.5 h-3.5 text-violet-600" />
                <span className="hidden md:inline">Flipbook</span>
              </div>

              <button
                type="button"
                disabled={frames.length <= 1}
                onClick={() => setIsPlayingPreview((p) => !p)}
                className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  isPlayingPreview
                    ? 'bg-rose-600 text-white shadow-xs'
                    : 'bg-violet-600 hover:bg-violet-700 text-white shadow-2xs'
                }`}
                title="Lire / Mettre en pause l'aperçu de l'animation"
              >
                {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                <span>{isPlayingPreview ? 'Pause' : 'Aperçu'}</span>
              </button>

              <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1">
                <span className="text-[10px] font-bold text-slate-500">FPS</span>
                <input
                  type="number"
                  min={1}
                  max={24}
                  value={frameRate}
                  onChange={(e) => setFrameRate(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 8)))}
                  className="w-10 text-xs font-mono font-bold text-slate-800 bg-transparent text-center outline-none"
                />
              </div>

              <select
                value={animationLoop}
                onChange={(e) => setAnimationLoop(e.target.value as AnimationLoopMode)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 text-[11px] font-bold text-slate-700 outline-none cursor-pointer"
                title="Mode de lecture de l'animation"
              >
                <option value="loop">Boucle</option>
                <option value="ping_pong">Aller-retour</option>
                <option value="once">Une fois</option>
              </select>
            </div>

            {/* Liste des Frames */}
            <div className="flex items-center gap-2 flex-1 overflow-x-auto py-0.5">
              {frames.map((fr, idx) => {
                const isActive = idx === safeActiveIdx;
                return (
                  <div
                    key={fr.id}
                    onClick={() => {
                      setIsPlayingPreview(false);
                      setActiveFrameIndex(idx);
                    }}
                    className={`relative group shrink-0 w-14 h-14 rounded-xl border-2 flex items-center justify-center p-1 cursor-pointer transition-all ${
                      isActive
                        ? 'border-violet-600 bg-violet-50/60 shadow-xs ring-2 ring-violet-500/20'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300'
                    }`}
                    title={`Frame ${idx + 1}`}
                  >
                    {renderFrameThumbnailSvg(fr)}
                    <span
                      className={`absolute bottom-0.5 left-1 text-[9px] font-mono font-black px-1 rounded ${
                        isActive ? 'bg-violet-600 text-white' : 'bg-slate-200/80 text-slate-600'
                      }`}
                    >
                      F{idx + 1}
                    </span>

                    {/* Actions rapides sur la frame au survol */}
                    <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center gap-0.5 z-10">
                      {idx > 0 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveFrame(idx, -1);
                          }}
                          className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-2xs cursor-pointer hover:bg-slate-100"
                          title="Déplacer avant"
                        >
                          <ChevronLeft className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {idx < frames.length - 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveFrame(idx, 1);
                          }}
                          className="w-4 h-4 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-2xs cursor-pointer hover:bg-slate-100"
                          title="Déplacer après"
                        >
                          <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                      {frames.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFrame(idx);
                          }}
                          className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-2xs cursor-pointer hover:bg-rose-700"
                          title="Supprimer cette frame"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Boutons Ajouter / Dupliquer Frame */}
              <div className="flex items-center gap-1.5 shrink-0 pl-1">
                <button
                  type="button"
                  onClick={handleDuplicateFrame}
                  className="h-14 px-2.5 rounded-xl border border-dashed border-violet-300 bg-violet-50/50 hover:bg-violet-100 text-violet-700 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
                  title="Dupliquer la frame active (pratique pour dessiner la suite avec pelure d'oignon)"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>Dupliquer</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddEmptyFrame}
                  className="h-14 px-2.5 rounded-xl border border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-colors"
                  title="Ajouter une nouvelle frame vide"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>+ Vide</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
