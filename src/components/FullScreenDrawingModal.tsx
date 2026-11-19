import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  Paintbrush,
  X,
  Film,
  Undo2,
  Redo2,
  RotateCcw,
  Tag,
  Sparkles,
} from 'lucide-react';
import { FlipbookPreviewModal } from './timeline/FlipbookPreviewModal';
import { FlipbookTimelineDock } from './timeline/FlipbookTimelineDock';
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
  EntityPivot,
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
  initialPivot?: EntityPivot;
  enablePivotEditing?: boolean;
  isStatePivotContext?: boolean;
  initialHasStatePivotOverride?: boolean;
  baseEntityPivot?: EntityPivot;
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
    },
    pivotData?: {
      pivot: EntityPivot;
      isStateOverride?: boolean;
    }
  ) => void;
  onClose: () => void;
}

function makeFrameId() {
  return `frame_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

const EMPTY_PATHS: VectorPath[] = [];
const EMPTY_LAYERS: DrawingLayer[] = [];
const EMPTY_ONION_STATES: OnionStateOption[] = [];

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
  initialPaths = EMPTY_PATHS,
  initialLayers = EMPTY_LAYERS,
  initialFrames,
  initialFrameRate = 8,
  initialAnimationLoop = 'loop',
  enableFlipbook = true,
  initialColliderType = 'box',
  initialColliderBounds,
  isSharedColliderEntity = false,
  isReferenceStateForSharedCollider = false,
  initialOverrideCollider = false,
  onionStates = EMPTY_ONION_STATES,
  currentEditingStateName,
  referenceGuide,
  availableReferenceGuides,
  initialHotspot,
  isCursorMode = false,
  initialPivot,
  enablePivotEditing = true,
  isStatePivotContext = false,
  initialHasStatePivotOverride = false,
  baseEntityPivot,
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
  const [currentPivot, setCurrentPivot] = useState<EntityPivot>(
    initialPivot || baseEntityPivot || { x: 0.5, y: 0.5 }
  );
  const [currentHasStatePivotOverride, setCurrentHasStatePivotOverride] = useState<boolean>(
    initialHasStatePivotOverride
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
  const framesRef = useRef<AnimationFrame[]>(frames);
  framesRef.current = frames;
  const activeFrameIdRef = useRef<string>(activeFrame?.id || 'frame_1');
  activeFrameIdRef.current = activeFrame?.id || 'frame_1';

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

  const handleVectorChange = useCallback((paths: VectorPath[], dataUrl?: string) => {
    const targetFrameId = activeFrameIdRef.current;
    setFrames((prev) =>
      prev.map((f) => (f.id === targetFrameId ? { ...f, vectorPaths: paths } : f))
    );
    if (dataUrl && framesRef.current[0]?.id === targetFrameId) {
      setCurrentDataUrl(dataUrl);
    }
  }, []);

  const handleLayersChange = useCallback((layers: DrawingLayer[]) => {
    const targetFrameId = activeFrameIdRef.current;
    setFrames((prev) =>
      prev.map((f) => (f.id === targetFrameId ? { ...f, drawingLayers: layers } : f))
    );
  }, []);

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
        : undefined,
      enablePivotEditing && !isCursorMode
        ? {
            pivot: currentPivot,
            isStateOverride: isStatePivotContext ? currentHasStatePivotOverride : undefined,
          }
        : undefined
    );
  };

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
            initialPivot={currentPivot}
            enablePivotEditing={enablePivotEditing}
            isStatePivotContext={isStatePivotContext}
            initialHasStatePivotOverride={currentHasStatePivotOverride}
            baseEntityPivot={baseEntityPivot}
            onPivotChange={(p, isOvr) => {
              setCurrentPivot(p);
              if (isOvr !== undefined) setCurrentHasStatePivotOverride(isOvr);
            }}
            actionsRef={canvasActionsRef}
            onHistoryStateChange={handleHistoryStateChange}
            hideTopHistoryButtons={true}
          />

          {/* Aperçu Animé Live du Flipbook en cours de lecture */}
          {isPlayingPreview && frames.length > 1 && (
            <FlipbookPreviewModal
              frames={frames}
              previewFrameIndex={previewFrameIndex}
              frameRate={frameRate}
              onStopPreview={() => setIsPlayingPreview(false)}
            />
          )}
        </div>

        {/* Timeline Easy Ergonomique (Frame par Frame) */}
        {enableFlipbook && (
          <FlipbookTimelineDock
            frames={frames}
            safeActiveIdx={safeActiveIdx}
            frameRate={frameRate}
            animationLoop={animationLoop}
            isPlayingPreview={isPlayingPreview}
            hasOnion={historyState.hasOnion}
            onionEnabled={historyState.onionEnabled}
            frameCardRefs={frameCardRefs}
            onSelectFrame={(idx) => {
              setIsPlayingPreview(false);
              setActiveFrameIndex(idx);
            }}
            onTogglePlayPreview={() => setIsPlayingPreview((p) => !p)}
            onFrameRateChange={setFrameRate}
            onAnimationLoopChange={setAnimationLoop}
            onToggleOnion={() => canvasActionsRef.current?.toggleOnion()}
            onDuplicateFrame={handleDuplicateFrame}
            onAddEmptyFrame={handleAddEmptyFrame}
            onMoveFrame={handleMoveFrame}
            onDeleteFrame={handleDeleteFrame}
          />
        )}
      </div>
    </div>,
    document.body
  );
}
