import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
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
  Undo2,
  Redo2,
  RotateCcw,
  SkipBack,
  Repeat,
  ArrowLeftRight,
  ArrowRightToLine,
  Layers,
  Tag,
  Sparkles,
} from 'lucide-react';
import {
  DrawingCanvas,
  OnionStateOption,
  ReferenceGuideOption,
  DrawingCanvasActionsHandle,
  DrawingCanvasHistoryState,
} from './DrawingCanvas';
import {
  VectorPath,
  ColliderType,
  ColliderBounds,
  DrawingLayer,
  AnimationFrame,
  AnimationLoopMode,
} from '../types';

interface FullScreenDrawingModalProps {
  mode?: 'edit' | 'create';
  title?: string;
  subtitle?: string;
  entityName?: string;
  onEntityNameChange?: (name: string) => void;
  entityTags?: string;
  onEntityTagsChange?: (tags: string) => void;
  showTagsInput?: boolean;
  saveButtonLabel?: string;
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
  mode = 'edit',
  title,
  subtitle = 'Dessinez votre forme vectorielle en plein écran',
  entityName = '',
  onEntityNameChange,
  entityTags = '',
  onEntityTagsChange,
  showTagsInput = false,
  saveButtonLabel,
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

  const canvasActionsRef = useRef<DrawingCanvasActionsHandle | null>(null);
  const [historyState, setHistoryState] = useState<DrawingCanvasHistoryState>({
    canUndo: false,
    canRedo: false,
    pathCount: initialPaths.length,
    onionEnabled: false,
    hasOnion: false,
  });
  const handleHistoryStateChange = useCallback((st: DrawingCanvasHistoryState) => {
    setHistoryState(st);
  }, []);

  const frameCardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const safeActiveIdx = Math.max(0, Math.min(activeFrameIndex, frames.length - 1));
  const activeFrame = frames[safeActiveIdx] || frames[0];

  // Auto-scroll la carte active dans la timeline Easy
  useEffect(() => {
    if (!enableFlipbook) return;
    const el = frameCardRefs.current[activeFrame?.id];
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
  }, [activeFrame?.id, enableFlipbook]);

  // Raccourcis navigation rapide entre frames (Alt+Flèche gauche/droite)
  useEffect(() => {
    if (!enableFlipbook) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if (e.altKey && e.key === 'ArrowLeft') {
        e.preventDefault();
        setIsPlayingPreview(false);
        setActiveFrameIndex((i) => Math.max(0, i - 1));
      } else if (e.altKey && e.key === 'ArrowRight') {
        e.preventDefault();
        setIsPlayingPreview(false);
        setActiveFrameIndex((i) => Math.min(frames.length - 1, i + 1));
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableFlipbook, frames.length]);

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

  const handleDuplicateFrame = (sourceIdx = safeActiveIdx) => {
    setIsPlayingPreview(false);
    const sourceFrame = frames[sourceIdx] || activeFrame;
    const cloned: AnimationFrame = {
      id: makeFrameId(),
      vectorPaths: JSON.parse(JSON.stringify(sourceFrame?.vectorPaths || [])),
      drawingLayers: sourceFrame?.drawingLayers
        ? JSON.parse(JSON.stringify(sourceFrame.drawingLayers))
        : undefined,
    };
    const insertAt = sourceIdx + 1;
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
  const isCreateMode = mode === 'create';
  const resolvedSaveLabel = saveButtonLabel || (isCreateMode ? 'Ajouter à la scène' : 'Enregistrer le dessin');

  return createPortal(
    <div
      data-modal-open="true"
      className="fixed inset-0 z-[10050] bg-[#f8fafc] flex flex-col overflow-hidden select-none"
      style={{ isolation: 'isolate' }}
    >
      <div className="bg-[#f8fafc] w-full h-full flex flex-col overflow-hidden">
        {/* Top Studio Bar Unifiée */}
        <div className="flex items-center justify-between px-4 sm:px-6 py-2.5 border-b border-slate-200 bg-white shrink-0 gap-3 flex-wrap">
          {/* Gauche : Titre / Nom Entité ou État */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-2xl shrink-0">
              <Paintbrush className="w-5 h-5" />
            </div>

            {isCreateMode ? (
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="font-bold text-slate-800 text-sm tracking-tight shrink-0 hidden md:inline">
                  Atelier de Dessin
                </span>
                <span className="text-slate-300 hidden md:inline">|</span>
                <div className="flex-1 max-w-xs">
                  <input
                    type="text"
                    value={entityName}
                    onChange={(e) => onEntityNameChange?.(e.target.value)}
                    placeholder="Nom de l'objet (ex: Personnage, Étoile...)"
                    className="w-full bg-slate-50 border border-slate-300 focus:bg-white focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-2xs"
                  />
                </div>
                {showTagsInput && (
                  <div className="hidden sm:flex items-center gap-1 max-w-[180px]">
                    <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <input
                      type="text"
                      value={entityTags}
                      onChange={(e) => onEntityTagsChange?.(e.target.value)}
                      placeholder="Tags (ex: #joueur)"
                      className="w-full bg-slate-50 border border-slate-200 focus:bg-white rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                    />
                  </div>
                )}
                {enableFlipbook && frames.length > 1 && (
                  <span className="text-[11px] font-bold text-violet-700 bg-violet-100 border border-violet-200 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                    <Film className="w-3 h-3" />
                    F{safeActiveIdx + 1}/{frames.length}
                  </span>
                )}
              </div>
            ) : (
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
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
                {subtitle && <p className="text-[11px] text-slate-500 mt-0.5 truncate">{subtitle}</p>}
              </div>
            )}
          </div>

          {/* Centre : Annuler / Rétablir / Tout effacer toujours visibles en haut */}
          <div className="flex items-center gap-1.5 bg-slate-100/80 p-1 rounded-xl border border-slate-200 shrink-0">
            <button
              type="button"
              onClick={() => canvasActionsRef.current?.undo()}
              disabled={!historyState.canUndo}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Annuler le dernier tracé (Cmd/Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              type="button"
              onClick={() => canvasActionsRef.current?.redo()}
              disabled={!historyState.canRedo}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs"
              title="Rétablir le tracé annulé (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rétablir</span>
            </button>
            <button
              type="button"
              onClick={() => canvasActionsRef.current?.clear()}
              disabled={historyState.pathCount === 0}
              className="px-2.5 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
              title="Vider la frame active"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden md:inline">Vider</span>
            </button>
          </div>

          {/* Droite : Valider / Fermer */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Fermer
            </button>
            <button
              type="button"
              onClick={handleSaveClick}
              className="px-4 sm:px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              {isCreateMode ? <Sparkles className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              <span>{resolvedSaveLabel}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              title="Fermer sans enregistrer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full-screen Canvas Body */}
        <div className="flex-1 p-3 sm:p-4 overflow-hidden bg-slate-100/60 flex items-center justify-center relative min-h-0">
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
            currentEditingStateName={isCreateMode ? (entityName || 'Nouvel objet') : stateName}
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
            actionsRef={canvasActionsRef}
            onHistoryStateChange={handleHistoryStateChange}
            hideTopHistoryButtons={true}
          />

          {/* Aperçu Animé Live du Flipbook en cours de lecture */}
          {isPlayingPreview && frames.length > 1 && (
            <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-6">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 flex flex-col items-center gap-3.5 w-full max-w-sm">
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Film className="w-4 h-4 text-violet-600" />
                    Aperçu Easy ({frameRate} FPS)
                  </span>
                  <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-lg border border-violet-200">
                    F{previewFrameIndex + 1} / {frames.length}
                  </span>
                </div>

                <div className="w-60 h-60 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center p-3">
                  {renderFrameThumbnailSvg(previewFrame)}
                </div>

                {/* Mini barre de progression lecture */}
                <div className="flex items-center gap-1 w-full px-1">
                  {frames.map((fr, i) => (
                    <div
                      key={fr.id}
                      className={`h-1.5 flex-1 rounded-full transition-colors ${
                        i === previewFrameIndex ? 'bg-violet-600' : 'bg-slate-200'
                      }`}
                    />
                  ))}
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

        {/* Timeline Easy Ergonomique (Frame par Frame) */}
        {enableFlipbook && (
          <div className="border-t border-slate-200 bg-white px-4 py-2.5 shrink-0 flex flex-col gap-2 shadow-[0_-4px_16px_rgba(15,23,42,0.04)]">
            {/* Barre supérieure de transport & cadence */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              {/* Gauche : Badge Mode Easy + Navigation Frame */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-violet-50 border border-violet-200 text-violet-800 text-[11px] font-extrabold">
                  <Film className="w-3.5 h-3.5 text-violet-600" />
                  <span>Timeline Easy</span>
                  <span className="text-violet-400 font-normal hidden sm:inline">• Frame par Frame</span>
                </div>

                <span className="text-[11px] font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                  F{safeActiveIdx + 1} / {frames.length}
                </span>

                {/* Boutons Transport Précédent / Play / Suivant */}
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    disabled={safeActiveIdx === 0}
                    onClick={() => {
                      setIsPlayingPreview(false);
                      setActiveFrameIndex(0);
                    }}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer transition-all"
                    title="Aller à la première frame"
                  >
                    <SkipBack className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={safeActiveIdx === 0}
                    onClick={() => {
                      setIsPlayingPreview(false);
                      setActiveFrameIndex((i) => Math.max(0, i - 1));
                    }}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer transition-all"
                    title="Frame précédente (Alt+←)"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={frames.length <= 1}
                    onClick={() => setIsPlayingPreview((p) => !p)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                      isPlayingPreview
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-violet-600 hover:bg-violet-700 text-white shadow-2xs'
                    }`}
                    title="Lire / Mettre en pause l'aperçu de l'animation"
                  >
                    {isPlayingPreview ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{isPlayingPreview ? 'Pause' : 'Lire'}</span>
                  </button>
                  <button
                    type="button"
                    disabled={safeActiveIdx >= frames.length - 1}
                    onClick={() => {
                      setIsPlayingPreview(false);
                      setActiveFrameIndex((i) => Math.min(frames.length - 1, i + 1));
                    }}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer transition-all"
                    title="Frame suivante (Alt+→)"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Centre / Droite : Cadence FPS + Mode Boucle + Pelure rapide + Actions Frame */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* FPS Presets + Input */}
                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl px-2 py-0.5">
                  <span className="text-[10px] font-extrabold text-slate-500 mr-0.5">FPS</span>
                  {[4, 8, 12, 24].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFrameRate(preset)}
                      className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold transition-colors cursor-pointer ${
                        frameRate === preset
                          ? 'bg-violet-600 text-white'
                          : 'text-slate-500 hover:bg-slate-200/70'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={24}
                    value={frameRate}
                    onChange={(e) => setFrameRate(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 8)))}
                    className="w-9 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-md text-center outline-none ml-0.5"
                    title="Images par seconde (1 à 24)"
                  />
                </div>

                {/* Mode Boucle */}
                <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
                  <button
                    type="button"
                    onClick={() => setAnimationLoop('loop')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      animationLoop === 'loop'
                        ? 'bg-white text-violet-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Lire en boucle infinie"
                  >
                    <Repeat className="w-3 h-3" />
                    <span className="hidden md:inline">Boucle</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationLoop('ping_pong')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      animationLoop === 'ping_pong'
                        ? 'bg-white text-violet-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Lire en aller-retour (Ping-Pong)"
                  >
                    <ArrowLeftRight className="w-3 h-3" />
                    <span className="hidden md:inline">Aller-retour</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnimationLoop('once')}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-all ${
                      animationLoop === 'once'
                        ? 'bg-white text-violet-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Lire une seule fois"
                  >
                    <ArrowRightToLine className="w-3 h-3" />
                    <span className="hidden md:inline">1×</span>
                  </button>
                </div>

                {/* Toggle rapide Pelure d'oignon */}
                {historyState.hasOnion && (
                  <button
                    type="button"
                    onClick={() => canvasActionsRef.current?.toggleOnion()}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                      historyState.onionEnabled
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Afficher / Masquer la pelure d'oignon (repère F-1)"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Pelure</span>
                  </button>
                )}

                {/* Actions d'ajout de frame accessibles en permanence */}
                <div className="flex items-center gap-1 pl-1 border-l border-slate-200">
                  <button
                    type="button"
                    onClick={() => handleDuplicateFrame(safeActiveIdx)}
                    className="px-2.5 py-1 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Dupliquer la frame active (idéal pour animer la suite avec pelure)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Dupliquer</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleAddEmptyFrame}
                    className="px-2.5 py-1 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                    title="Insérer une nouvelle frame vide après la frame active"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Vide</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Pellicule / Filmstrip des Frames */}
            <div className="flex items-center gap-2 overflow-x-auto py-1 px-0.5">
              {frames.map((fr, idx) => {
                const isActive = idx === safeActiveIdx;
                return (
                  <div
                    key={fr.id}
                    ref={(el) => {
                      frameCardRefs.current[fr.id] = el;
                    }}
                    onClick={() => {
                      setIsPlayingPreview(false);
                      setActiveFrameIndex(idx);
                    }}
                    className={`relative group shrink-0 w-16 h-16 rounded-2xl border-2 flex items-center justify-center p-1.5 cursor-pointer transition-all ${
                      isActive
                        ? 'border-violet-600 bg-violet-50/70 shadow-sm ring-2 ring-violet-500/20 scale-[1.02]'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                    title={`Frame ${idx + 1} (${fr.vectorPaths?.length || 0} tracés)`}
                  >
                    {renderFrameThumbnailSvg(fr)}
                    <span
                      className={`absolute bottom-1 left-1 text-[9px] font-mono font-black px-1.5 py-0.2 rounded-md ${
                        isActive ? 'bg-violet-600 text-white' : 'bg-slate-200/90 text-slate-700'
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
                          className="w-4.5 h-4.5 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-xs cursor-pointer hover:bg-slate-100"
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
                          className="w-4.5 h-4.5 rounded-full bg-white border border-slate-300 text-slate-700 flex items-center justify-center shadow-xs cursor-pointer hover:bg-slate-100"
                          title="Déplacer après"
                        >
                          <ChevronRight className="w-2.5 h-2.5" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDuplicateFrame(idx);
                        }}
                        className="w-4.5 h-4.5 rounded-full bg-violet-600 text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-violet-700"
                        title="Dupliquer cette frame"
                      >
                        <Copy className="w-2.5 h-2.5" />
                      </button>
                      {frames.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteFrame(idx);
                          }}
                          className="w-4.5 h-4.5 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer hover:bg-rose-700"
                          title="Supprimer cette frame"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Raccourci inline fin de pellicule */}
              <button
                type="button"
                onClick={handleAddEmptyFrame}
                className="shrink-0 w-14 h-16 rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-400 bg-slate-50/70 hover:bg-violet-50/60 text-slate-500 hover:text-violet-700 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all"
                title="Ajouter une frame vide à la suite"
              >
                <Plus className="w-4 h-4" />
                <span className="text-[9px] font-bold">Frame</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
