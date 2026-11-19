import React, { useRef, useState, useEffect, useMemo } from 'react';
import { RotateCcw, Undo2, Redo2 } from 'lucide-react';
import { VectorPath, VectorPoint, VectorRect, ColliderType, ColliderBounds, DrawingLayer, EntityPivot } from '../types';
import { applyBucketFill } from '../utils/floodFill';
import { computeAutoColliderBoundsFromPaths } from '../utils/collider';
import { useSceneStore, DEFAULT_PROJECT_PALETTE } from '../store/useSceneStore';
import {
  generateRoundedRectPath,
  generateCirclePath,
  generateCirclePerimeterPoints,
  generateLinePath,
  pointsToSmoothPath,
  pointsToPolylinePath,
  getPathBounds as sharedGetPathBounds,
  getSelectionBoundingBox,
  translatePath,
  resizeShapeToRect,
  erasePathsAtPoint,
  eraseWholeStrokesAtPoint,
  findPathStrokeAtPoint,
} from '../utils/vectorDrawing';
import {
  FrameHistoryEntry,
  cloneDrawingLayers,
  cloneVectorPaths,
  createFrameHistoryEntry,
  pushSnapshotToEntry,
  stepRedoEntry,
  stepUndoEntry,
  switchFrameHistoryInStore,
} from '../utils/drawingHistory';
import { DrawingCanvasTopBar } from './drawing/DrawingCanvasTopBar';
import {
  DrawingCanvasColliderOverlay,
  ColliderDragAction,
  ManualColliderRect,
} from './drawing/DrawingCanvasColliderOverlay';
import { DrawingCanvasPivotOverlay } from './drawing/DrawingCanvasPivotOverlay';
import { DrawingPivotSection } from './drawing/DrawingPivotSection';
import { DrawingToolGrid, DrawingCanvasToolId } from './drawing/DrawingToolGrid';
import { DrawingLayersSection } from './drawing/DrawingLayersSection';
import { DrawingColliderSection } from './drawing/DrawingColliderSection';
import { DrawingSelectionInspector } from './drawing/DrawingSelectionInspector';
import { DrawingColorPaletteSection } from './drawing/DrawingColorPaletteSection';
import {
  DrawingGuidesAndOnionSection,
  OnionStateOptionItem,
  ReferenceGuideOptionItem,
} from './drawing/DrawingGuidesAndOnionSection';

export { generateRoundedRectPath, pointsToSmoothPath, pointsToPolylinePath };

export type OnionStateOption = OnionStateOptionItem;
export type ReferenceGuideOption = ReferenceGuideOptionItem;

export interface DrawingCanvasActionsHandle {
  undo: () => void;
  redo: () => void;
  clear: () => void;
  toggleOnion: () => void;
}

export interface DrawingCanvasHistoryState {
  canUndo: boolean;
  canRedo: boolean;
  pathCount: number;
  onionEnabled: boolean;
  hasOnion: boolean;
}

interface DrawingCanvasProps {
  onVectorChange: (paths: VectorPath[], svgDataUrl?: string) => void;
  initialPaths?: VectorPath[];
  initialLayers?: DrawingLayer[];
  onLayersChange?: (layers: DrawingLayer[]) => void;
  initialColliderType?: ColliderType;
  initialColliderBounds?: ColliderBounds;
  initialStrokeColor?: string;
  initialFillColor?: string;
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
  onColliderChange?: (colliderType: ColliderType, colliderBounds?: ColliderBounds) => void;
  isSharedColliderEntity?: boolean;
  isReferenceStateForSharedCollider?: boolean;
  initialOverrideCollider?: boolean;
  onOverrideColliderChange?: (override: boolean) => void;
  referenceGuide?: ReferenceGuideOption;
  availableReferenceGuides?: ReferenceGuideOption[];
  initialHotspot?: { x: number; y: number };
  onHotspotChange?: (pos: { x: number; y: number }) => void;
  isCursorMode?: boolean;
  initialPivot?: EntityPivot;
  onPivotChange?: (pivot: EntityPivot, isStateOverride?: boolean) => void;
  enablePivotEditing?: boolean;
  isStatePivotContext?: boolean;
  initialHasStatePivotOverride?: boolean;
  baseEntityPivot?: EntityPivot;
  frameSyncKey?: string;
  actionsRef?: React.MutableRefObject<DrawingCanvasActionsHandle | null>;
  onHistoryStateChange?: (state: DrawingCanvasHistoryState) => void;
  hideTopHistoryButtons?: boolean;
}

export const FINE_CROSSHAIR_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAYAAAByUDbMAAAAN0lEQVR4nGNgIAD+IwFCagkCkCH84lqjho08w/4TAWCGEQJwmynFcMOo5rLBGwGjhg0Bw4hNRwArM0of2vmpUwAAAABJRU5ErkJggg==") 9 9, crosshair';

export type DrawTool = DrawingCanvasToolId;

const EMPTY_PATHS: VectorPath[] = [];
const EMPTY_LAYERS: DrawingLayer[] = [];
const EMPTY_ONION_STATES: OnionStateOption[] = [];

export function DrawingCanvas({
  onVectorChange,
  initialPaths = EMPTY_PATHS,
  initialLayers = EMPTY_LAYERS,
  onLayersChange,
  initialColliderType = 'box',
  initialColliderBounds,
  initialStrokeColor = '#000000',
  initialFillColor = 'none',
  onionStates = EMPTY_ONION_STATES,
  currentEditingStateName,
  onColliderChange,
  isSharedColliderEntity = false,
  isReferenceStateForSharedCollider = false,
  initialOverrideCollider = false,
  onOverrideColliderChange,
  referenceGuide,
  initialHotspot,
  onHotspotChange,
  isCursorMode = false,
  initialPivot,
  onPivotChange,
  enablePivotEditing = true,
  isStatePivotContext = false,
  initialHasStatePivotOverride = false,
  baseEntityPivot,
  availableReferenceGuides,
  frameSyncKey,
  actionsRef,
  onHistoryStateChange,
  hideTopHistoryButtons = false,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const initialLayersResolved = useMemo<DrawingLayer[]>(
    () =>
      initialLayers && initialLayers.length > 0
        ? cloneDrawingLayers(initialLayers)
        : [{ id: 'layer-1', name: 'Calque 1', visible: true, locked: false, opacity: 1 }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );
  const [paths, setPaths] = useState<VectorPath[]>(() => cloneVectorPaths(initialPaths));
  const pathsRef = useRef<VectorPath[]>(paths);
  const [layers, setLayers] = useState<DrawingLayer[]>(initialLayersResolved);
  const layersRef = useRef<DrawingLayer[]>(layers);

  const initialFrameKey = frameSyncKey || '__default__';
  const historyEntryRef = useRef<FrameHistoryEntry>(
    createFrameHistoryEntry(initialPaths, initialLayersResolved)
  );
  const frameHistoriesRef = useRef<Map<string, FrameHistoryEntry>>(
    new Map([[initialFrameKey, historyEntryRef.current]])
  );
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const hasErasedInCurrentStrokeRef = useRef<boolean>(false);
  const hasMutatedDuringDragRef = useRef<boolean>(false);
  const lastFrameSyncKeyRef = useRef<string | undefined>(initialFrameKey);

  const onVectorChangeRef = useRef(onVectorChange);
  onVectorChangeRef.current = onVectorChange;
  const onLayersChangeRef = useRef(onLayersChange);
  onLayersChangeRef.current = onLayersChange;

  const commitPaths = (nextPaths: VectorPath[]) => {
    pathsRef.current = nextPaths;
    setPaths(nextPaths);
  };

  const commitLayers = (nextLayers: DrawingLayer[]) => {
    layersRef.current = nextLayers;
    setLayers(nextLayers);
  };

  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    return initialLayersResolved[0]?.id || 'layer-1';
  });
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState<string>('');

  const handleAddLayer = () => {
    const newLayer: DrawingLayer = {
      id: `layer-${Date.now().toString(36)}`,
      name: `Calque ${layersRef.current.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
    };
    const updated = [newLayer, ...layersRef.current];
    commitLayers(updated);
    setActiveLayerId(newLayer.id);
    if (onLayersChangeRef.current) onLayersChangeRef.current(updated);
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    const updated = layersRef.current.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l));
    commitLayers(updated);
    if (onLayersChangeRef.current) onLayersChangeRef.current(updated);
  };

  const handleToggleLayerLock = (layerId: string) => {
    const updated = layersRef.current.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l));
    commitLayers(updated);
    if (onLayersChangeRef.current) onLayersChangeRef.current(updated);
  };

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    const idx = layersRef.current.findIndex((l) => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= layersRef.current.length) return;
    const copy = [...layersRef.current];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    commitLayers(copy);
    if (onLayersChangeRef.current) onLayersChangeRef.current(copy);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layersRef.current.length <= 1) return;
    const remainingLayers = layersRef.current.filter((l) => l.id !== layerId);
    const fallbackId = layersRef.current[layersRef.current.length - 1]?.id || 'layer-1';
    const remainingPaths = pathsRef.current.filter(
      (p) => (p.layerId || fallbackId) !== layerId
    );
    commitLayers(remainingLayers);
    if (activeLayerId === layerId) {
      setActiveLayerId(remainingLayers[0].id);
    }
    updatePathsWithHistory(remainingPaths, remainingLayers);
    if (onLayersChangeRef.current) onLayersChangeRef.current(remainingLayers);
  };

  const handleRenameLayer = (layerId: string, newName: string) => {
    const updated = layersRef.current.map((l) => (l.id === layerId ? { ...l, name: newName } : l));
    commitLayers(updated);
    if (onLayersChangeRef.current) onLayersChangeRef.current(updated);
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    const updated = layersRef.current.map((l) => (l.id === layerId ? { ...l, opacity } : l));
    commitLayers(updated);
    if (onLayersChangeRef.current) onLayersChangeRef.current(updated);
  };

  const handleMoveSelectedToLayer = (targetLayerId: string) => {
    if (selectedPathIds.length === 0) return;
    const updated = pathsRef.current.map((p) =>
      selectedPathIds.includes(p.id) ? { ...p, layerId: targetLayerId } : p
    );
    updatePathsWithHistory(updated);
  };

  const pushHistoryState = (newPaths: VectorPath[], nextLayers: DrawingLayer[] = layersRef.current) => {
    const nextEntry = pushSnapshotToEntry(historyEntryRef.current, newPaths, nextLayers, 60);
    historyEntryRef.current = nextEntry;
    const activeKey = lastFrameSyncKeyRef.current || '__default__';
    frameHistoriesRef.current.set(activeKey, nextEntry);
    setHistoryVersion((v) => v + 1);
  };

  const updatePathsWithHistory = (
    newPaths: VectorPath[],
    nextLayers: DrawingLayer[] = layersRef.current
  ) => {
    commitPaths(newPaths);
    pushHistoryState(newPaths, nextLayers);
    notifyChange(newPaths);
  };

  const handleUndo = () => {
    const res = stepUndoEntry(historyEntryRef.current);
    if (!res) return;
    historyEntryRef.current = res.nextEntry;
    const activeKey = lastFrameSyncKeyRef.current || '__default__';
    frameHistoriesRef.current.set(activeKey, res.nextEntry);
    setHistoryVersion((v) => v + 1);

    const targetPaths = res.snapshot.paths;
    const targetLayers = res.snapshot.layers;
    if (targetLayers.length > 0 && JSON.stringify(targetLayers) !== JSON.stringify(layersRef.current)) {
      commitLayers(targetLayers);
      if (!targetLayers.some((l) => l.id === activeLayerId)) {
        setActiveLayerId(targetLayers[0].id);
      }
      if (onLayersChangeRef.current) onLayersChangeRef.current(targetLayers);
    }
    commitPaths(targetPaths);
    setSelectedPathIds((prev) => prev.filter((id) => targetPaths.some((p) => p.id === id)));
    notifyChange(targetPaths);
  };

  const handleRedo = () => {
    const res = stepRedoEntry(historyEntryRef.current);
    if (!res) return;
    historyEntryRef.current = res.nextEntry;
    const activeKey = lastFrameSyncKeyRef.current || '__default__';
    frameHistoriesRef.current.set(activeKey, res.nextEntry);
    setHistoryVersion((v) => v + 1);

    const targetPaths = res.snapshot.paths;
    const targetLayers = res.snapshot.layers;
    if (targetLayers.length > 0 && JSON.stringify(targetLayers) !== JSON.stringify(layersRef.current)) {
      commitLayers(targetLayers);
      if (!targetLayers.some((l) => l.id === activeLayerId)) {
        setActiveLayerId(targetLayers[0].id);
      }
      if (onLayersChangeRef.current) onLayersChangeRef.current(targetLayers);
    }
    commitPaths(targetPaths);
    setSelectedPathIds((prev) => prev.filter((id) => targetPaths.some((p) => p.id === id)));
    notifyChange(targetPaths);
  };
  const projectPalette = useSceneStore((state) => state.projectPalette || DEFAULT_PROJECT_PALETTE);
  const updateProjectPaletteColor = useSceneStore((state) => state.updateProjectPaletteColor);
  const resetProjectPalette = useSceneStore((state) => state.resetProjectPalette);

  const [strokeColor, setStrokeColor] = useState(initialStrokeColor);
  const [selectedStrokePaletteId, setSelectedStrokePaletteId] = useState<string | null>(() => {
    const found = (useSceneStore.getState().projectPalette || DEFAULT_PROJECT_PALETTE).find(
      (p) => p.color.toLowerCase() === initialStrokeColor.toLowerCase()
    );
    return found ? found.id : 'pal-1';
  });
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [fillColor, setFillColor] = useState<string>(initialFillColor);
  const [selectedFillPaletteId, setSelectedFillPaletteId] = useState<string | null>(() => {
    if (initialFillColor === 'none') return null;
    const found = (useSceneStore.getState().projectPalette || DEFAULT_PROJECT_PALETTE).find(
      (p) => p.color.toLowerCase() === initialFillColor.toLowerCase()
    );
    return found ? found.id : null;
  });
  const [cornerRadius, setCornerRadius] = useState<number>(0);
  const [tool, setTool] = useState<DrawTool>('pencil');
  const [colliderType, setColliderType] = useState<ColliderType>(
    initialColliderBounds?.shape || initialColliderType
  );
  const [colliderMode, setColliderMode] = useState<'auto' | 'manual'>(
    initialColliderBounds?.mode === 'manual' ? 'manual' : 'auto'
  );
  const [overrideCollider, setOverrideCollider] = useState<boolean>(initialOverrideCollider);
  const [manualCollider, setManualCollider] = useState<ManualColliderRect>(() => {
    const autoInit = computeAutoColliderBoundsFromPaths(
      initialPaths,
      initialColliderBounds?.shape || initialColliderType
    );
    const x = initialColliderBounds?.x ?? autoInit.x ?? 20;
    const y = initialColliderBounds?.y ?? autoInit.y ?? 20;
    const width = initialColliderBounds?.width ?? autoInit.width ?? 160;
    const height = initialColliderBounds?.height ?? autoInit.height ?? 160;
    const centerX = initialColliderBounds?.centerX ?? x + width / 2;
    const centerY = initialColliderBounds?.centerY ?? y + height / 2;
    const radius = initialColliderBounds?.radius ?? Math.max(width, height) / 2;
    return { x, y, width, height, centerX, centerY, radius };
  });
  const [isColliderBodyDraggable, setIsColliderBodyDraggable] = useState(false);
  const [isColliderLocked, setIsColliderLocked] = useState(false);
  const [colliderDragAction, setColliderDragAction] = useState<ColliderDragAction>(null);
  const colliderDragOriginRef = useRef<{
    mouse: VectorPoint;
    initial: ManualColliderRect;
  } | null>(null);
  const [showColliderPreview, setShowColliderPreview] = useState(true);

  // Reference Guide & Hotspot state (Repère de dessin & point d'impact)
  const [selectedGuideId, setSelectedGuideId] = useState<string>(
    referenceGuide?.id || availableReferenceGuides?.[0]?.id || ''
  );
  const activeReferenceGuide =
    availableReferenceGuides?.find((g) => g.id === selectedGuideId) || referenceGuide;

  const [guideOpacity, setGuideOpacity] = useState<number>(
    activeReferenceGuide ? 0.45 : 0
  );
  const [hotspot, setHotspot] = useState<VectorPoint>(
    initialHotspot || activeReferenceGuide?.hotspot || { x: 75, y: 25 }
  );
  // Hotspot est strictement réservé au mode curseur
  const [showHotspot, setShowHotspot] = useState<boolean>(isCursorMode);
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);

  // Pivot WYSIWYG (centre de rotation & d'attachement normalisé 0..1)
  const [hasStatePivotOverride, setHasStatePivotOverride] = useState<boolean>(
    initialHasStatePivotOverride
  );
  const [pivot, setPivot] = useState<EntityPivot>(
    initialPivot || baseEntityPivot || { x: 0.5, y: 0.5 }
  );
  const [showPivotPreview, setShowPivotPreview] = useState<boolean>(false);
  const [isPivotLocked, setIsPivotLocked] = useState<boolean>(false);
  const [isPivotPlacementActive, setIsPivotPlacementActive] = useState(false);
  const [isDraggingPivot, setIsDraggingPivot] = useState(false);

  const emitPivotChange = (nextPivot: EntityPivot, nextOverride = hasStatePivotOverride) => {
    setPivot(nextPivot);
    if (onPivotChange) {
      onPivotChange(nextPivot, nextOverride);
    }
  };

  // Multi-Selection & Transform state
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<VectorRect | null>(null);

  // Interaction dragging states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasingPartial, setIsErasingPartial] = useState(false);
  const [isErasingStroke, setIsErasingStroke] = useState(false);
  const [cursorPos, setCursorPos] = useState<VectorPoint | null>(null);
  const [currentPoints, setCurrentPoints] = useState<VectorPoint[]>([]);
  const currentPointsRef = useRef<VectorPoint[]>([]);
  const [startPoint, setStartPoint] = useState<VectorPoint | null>(null);
  const [currentPoint, setCurrentPoint] = useState<VectorPoint | null>(null);
  const [currentRect, setCurrentRect] = useState<VectorRect | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<VectorPoint | null>(null);
  const [activeHandle, setActiveHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);

  // Active polyline in progress
  const [activePolylinePoints, setActivePolylinePoints] = useState<VectorPoint[]>([]);

  // Grille & Magnétisme (Snap to grid)
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSnapSize] = useState(10);

  // Onion skinning state
  const availableOnionStates = useMemo(
    () => onionStates.filter((s) => s.vectorPaths && s.vectorPaths.length > 0),
    [onionStates]
  );
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(availableOnionStates.length > 0);
  const [selectedOnionStateId, setSelectedOnionStateId] = useState<string>(
    availableOnionStates[0]?.id || ''
  );
  const [onionOpacity, setOnionOpacity] = useState(0.35);

  const selectedIdsRef = useRef<string[]>(selectedPathIds);
  selectedIdsRef.current = selectedPathIds;
  pathsRef.current = paths;
  layersRef.current = layers;
  const lastReportedHistoryRef = useRef<DrawingCanvasHistoryState | null>(null);

  const handleUndoRef = useRef(handleUndo);
  handleUndoRef.current = handleUndo;
  const handleRedoRef = useRef(handleRedo);
  handleRedoRef.current = handleRedo;
  const updatePathsWithHistoryRef = useRef(updatePathsWithHistory);
  updatePathsWithHistoryRef.current = updatePathsWithHistory;

  // Exposer Annuler / Rétablir / Effacer / Pelure au header parent (Mode Dessin Unifié)
  useEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        undo: () => handleUndoRef.current(),
        redo: () => handleRedoRef.current(),
        clear: handleClear,
        toggleOnion: () => setOnionSkinEnabled((v) => !v),
      };
    }
  });

  useEffect(() => {
    if (!onHistoryStateChange) return;
    const entry = historyEntryRef.current;
    const nextState: DrawingCanvasHistoryState = {
      canUndo: entry.index > 0,
      canRedo: entry.index < entry.stack.length - 1,
      pathCount: paths.length,
      onionEnabled: onionSkinEnabled,
      hasOnion: availableOnionStates.length > 0,
    };
    const prev = lastReportedHistoryRef.current;
    if (
      prev &&
      prev.canUndo === nextState.canUndo &&
      prev.canRedo === nextState.canRedo &&
      prev.pathCount === nextState.pathCount &&
      prev.onionEnabled === nextState.onionEnabled &&
      prev.hasOnion === nextState.hasOnion
    ) {
      return;
    }
    lastReportedHistoryRef.current = nextState;
    onHistoryStateChange(nextState);
  }, [paths.length, historyVersion, onionSkinEnabled, availableOnionStates.length, onHistoryStateChange]);

  // Raccourcis clavier (Cmd/Ctrl+Z, Shift+Z / Y, Suppr sélection, Échap polyligne)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedoRef.current();
        } else {
          e.preventDefault();
          handleUndoRef.current();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedoRef.current();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        const updated = pathsRef.current.filter((p) => !selectedIdsRef.current.includes(p.id));
        setSelectedPathIds([]);
        updatePathsWithHistoryRef.current(updated);
      } else if (e.key === 'Escape') {
        setActivePolylinePoints([]);
        setSelectedPathIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const nextKey = frameSyncKey || '__default__';
    if (frameSyncKey === undefined || nextKey === lastFrameSyncKeyRef.current) return;
    const prevKey = lastFrameSyncKeyRef.current;
    lastFrameSyncKeyRef.current = nextKey;

    const nextLayers =
      initialLayers && initialLayers.length > 0
        ? cloneDrawingLayers(initialLayers)
        : [{ id: 'layer-1', name: 'Calque 1', visible: true, locked: false, opacity: 1 }];

    const switchedEntry = switchFrameHistoryInStore(
      frameHistoriesRef.current,
      prevKey,
      historyEntryRef.current,
      nextKey,
      initialPaths,
      nextLayers
    );
    historyEntryRef.current = switchedEntry;
    const activeSnap = switchedEntry.stack[switchedEntry.index];
    const resolvedPaths = cloneVectorPaths(activeSnap?.paths ?? initialPaths);
    const resolvedLayers =
      activeSnap?.layers && activeSnap.layers.length > 0
        ? cloneDrawingLayers(activeSnap.layers)
        : nextLayers;

    commitPaths(resolvedPaths);
    commitLayers(resolvedLayers);
    setActiveLayerId(resolvedLayers[0]?.id || 'layer-1');
    setSelectedPathIds([]);
    setActivePolylinePoints([]);
    setIsDrawing(false);
    setIsErasingPartial(false);
    setIsErasingStroke(false);
    setIsDraggingShape(false);
    setActiveHandle(null);
    hasErasedInCurrentStrokeRef.current = false;
    hasMutatedDuringDragRef.current = false;
    currentPointsRef.current = [];
    setCurrentPoints([]);
    setHistoryVersion((v) => v + 1);

    const prevOnion = onionStates.find(
      (s) => s.id === '__prev_frame__' && s.vectorPaths && s.vectorPaths.length > 0
    );
    if (prevOnion) {
      setSelectedOnionStateId('__prev_frame__');
      setOnionSkinEnabled(true);
    }
  }, [frameSyncKey]);

  useEffect(() => {
    if (availableOnionStates.length === 0) {
      if (selectedOnionStateId !== '') setSelectedOnionStateId('');
      return;
    }
    if (!availableOnionStates.some((s) => s.id === selectedOnionStateId)) {
      setSelectedOnionStateId(availableOnionStates[0].id);
    }
  }, [availableOnionStates, selectedOnionStateId]);

  const activeOnionReference = availableOnionStates.find((s) => s.id === selectedOnionStateId);
  const selectedPaths = paths.filter((p) => selectedPathIds.includes(p.id));
  const primarySelectedPath = selectedPaths[0] || null;
  const activeLayer = layers.find((l) => l.id === activeLayerId) || layers[0];

  // Sync properties when selecting shapes
  useEffect(() => {
    if (primarySelectedPath) {
      setStrokeColor(primarySelectedPath.stroke);
      setStrokeWidth(primarySelectedPath.strokeWidth);
      setFillColor(primarySelectedPath.fill || 'none');
      if (primarySelectedPath.strokeColorId) {
        setSelectedStrokePaletteId(primarySelectedPath.strokeColorId);
      } else {
        const matchedStroke = projectPalette.find(
          (p) => p.color.toLowerCase() === primarySelectedPath.stroke.toLowerCase()
        );
        setSelectedStrokePaletteId(matchedStroke ? matchedStroke.id : null);
      }
      if (primarySelectedPath.fillColorId) {
        setSelectedFillPaletteId(primarySelectedPath.fillColorId);
      } else if (primarySelectedPath.fill && primarySelectedPath.fill !== 'none') {
        const matchedFill = projectPalette.find(
          (p) => p.color.toLowerCase() === primarySelectedPath.fill.toLowerCase()
        );
        setSelectedFillPaletteId(matchedFill ? matchedFill.id : null);
      } else {
        setSelectedFillPaletteId(null);
      }
      if (primarySelectedPath.rect) {
        setCornerRadius(primarySelectedPath.rect.cornerRadius || 0);
      }
    }
  }, [selectedPathIds]);

  // Helper pour modifier durablement une couleur de la palette du projet et répercuter sur le dessin actif
  const handleModifyPaletteColor = (paletteId: string, newColor: string) => {
    const oldHex = projectPalette.find((c) => c.id === paletteId)?.color?.toLowerCase();
    updateProjectPaletteColor(paletteId, newColor);

    const updatedLocalPaths = pathsRef.current.map((p) => {
      let nextStroke = p.stroke;
      let nextStrokeId = p.strokeColorId;
      let nextFill = p.fill;
      let nextFillId = p.fillColorId;
      let changed = false;

      if (p.strokeColorId === paletteId || (!p.strokeColorId && oldHex && p.stroke?.toLowerCase() === oldHex)) {
        nextStroke = newColor;
        nextStrokeId = paletteId;
        changed = true;
      }
      if (p.fillColorId === paletteId || (!p.fillColorId && oldHex && p.fill?.toLowerCase() === oldHex)) {
        nextFill = newColor;
        nextFillId = paletteId;
        changed = true;
      }
      return changed
        ? { ...p, stroke: nextStroke, strokeColorId: nextStrokeId, fill: nextFill, fillColorId: nextFillId }
        : p;
    });
    commitPaths(updatedLocalPaths);
    notifyChange(updatedLocalPaths);
  };

  const notifyChange = (updatedPaths: VectorPath[]) => {
    if (!svgRef.current) {
      onVectorChangeRef.current(updatedPaths);
      return;
    }
    const svgContent = svgRef.current.outerHTML;
    const encoded = encodeURIComponent(svgContent);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
    onVectorChangeRef.current(updatedPaths, dataUrl);
  };

  const buildColliderBoundsPayload = (
    shape: ColliderType,
    mode: 'auto' | 'manual',
    manual = manualCollider
  ): ColliderBounds => {
    if (mode === 'auto') {
      return { mode: 'auto', shape };
    }
    return {
      mode: 'manual',
      shape: shape === 'polygon' ? 'box' : shape,
      x: Math.round(manual.x * 10) / 10,
      y: Math.round(manual.y * 10) / 10,
      width: Math.max(8, Math.round(manual.width * 10) / 10),
      height: Math.max(8, Math.round(manual.height * 10) / 10),
      centerX: Math.round(manual.centerX * 10) / 10,
      centerY: Math.round(manual.centerY * 10) / 10,
      radius: Math.max(4, Math.round(manual.radius * 10) / 10),
    };
  };

  const emitColliderUpdate = (
    nextShape: ColliderType,
    nextMode: 'auto' | 'manual',
    nextManual = manualCollider
  ) => {
    if (onColliderChange) {
      onColliderChange(nextShape, buildColliderBoundsPayload(nextShape, nextMode, nextManual));
    }
  };

  const handleColliderTypeSelect = (type: ColliderType) => {
    const resolvedType = colliderMode === 'manual' && type === 'polygon' ? 'box' : type;
    setColliderType(resolvedType);
    emitColliderUpdate(resolvedType, colliderMode, manualCollider);
  };

  const handleInitManualFromDrawing = (targetShape?: ColliderType) => {
    const shapeToUse = (targetShape || (colliderType === 'polygon' ? 'box' : colliderType)) as ColliderType;
    const autoBounds = computeAutoColliderBoundsFromPaths(paths, shapeToUse);
    const nextManual = {
      x: autoBounds.x ?? 20,
      y: autoBounds.y ?? 20,
      width: autoBounds.width ?? 160,
      height: autoBounds.height ?? 160,
      centerX: autoBounds.centerX ?? 100,
      centerY: autoBounds.centerY ?? 100,
      radius: autoBounds.radius ?? 80,
    };
    setColliderMode('manual');
    setColliderType(shapeToUse);
    setManualCollider(nextManual);
    setShowColliderPreview(true);
    emitColliderUpdate(shapeToUse, 'manual', nextManual);
  };

  const handleSwitchColliderMode = (mode: 'auto' | 'manual') => {
    if (mode === 'manual') {
      const nextShape: ColliderType = colliderType === 'circle' ? 'circle' : 'box';
      setColliderMode('manual');
      setColliderType(nextShape);
      setShowColliderPreview(true);
      setIsColliderBodyDraggable(true);
      emitColliderUpdate(nextShape, 'manual', manualCollider);
    } else {
      setColliderMode('auto');
      setIsColliderBodyDraggable(false);
      emitColliderUpdate(colliderType, 'auto', manualCollider);
    }
  };

  const handleToggleOverrideCollider = (nextOverride: boolean) => {
    setOverrideCollider(nextOverride);
    if (onOverrideColliderChange) {
      onOverrideColliderChange(nextOverride);
    }
  };

  // Auto-detect collider from current paths bounds
  const handleAutoDetectCollider = () => {
    if (paths.length === 0) {
      handleColliderTypeSelect('box');
      return;
    }

    let minX = 200, maxX = 0, minY = 200, maxY = 0;
    let hasPolyline = false;

    paths.forEach((p) => {
      if (p.type === 'polyline') hasPolyline = true;
      const b = getPathBounds(p);
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    });

    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    const ratio = w / h;

    if (colliderMode === 'manual') {
      const detectedShape: ColliderType = ratio >= 0.8 && ratio <= 1.25 ? 'circle' : 'box';
      handleInitManualFromDrawing(detectedShape);
      return;
    }

    if (hasPolyline) {
      handleColliderTypeSelect('polygon');
    } else if (ratio >= 0.8 && ratio <= 1.25) {
      handleColliderTypeSelect('circle');
    } else {
      handleColliderTypeSelect('box');
    }
  };

  const getSVGCoordinates = (
    e: React.PointerEvent<any> | React.MouseEvent<any> | React.TouchEvent<any> | PointerEvent | MouseEvent
  ): VectorPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && (e as any).touches) {
      if ((e as any).touches.length === 0) return { x: 0, y: 0 };
      clientX = (e as any).touches[0].clientX;
      clientY = (e as any).touches[0].clientY;
    } else {
      clientX = (e as any).clientX ?? 0;
      clientY = (e as any).clientY ?? 0;
    }

    const scaleX = 200 / rect.width;
    const scaleY = 200 / rect.height;

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (snapToGrid) {
      x = Math.round(x / gridSnapSize) * gridSnapSize;
      y = Math.round(y / gridSnapSize) * gridSnapSize;
    } else {
      // 1-decimal place precision preserves ultra-smooth Apple Pencil / touch curves without stair-stepping
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
    }

    x = Math.max(0, Math.min(200, x));
    y = Math.max(0, Math.min(200, y));

    return { x, y };
  };

  // Compute bounding box for a path (partagé)
  const getPathBounds = (p: VectorPath) => sharedGetPathBounds(p, 200);

  // Overall drawing bounds for collider overlay
  const getDrawingOverallBounds = () => {
    if (paths.length === 0) return { x: 40, y: 40, width: 120, height: 120 };
    let minX = 200, maxX = 0, minY = 200, maxY = 0;
    paths.forEach((p) => {
      const b = getPathBounds(p);
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    });
    return {
      x: Math.max(4, minX - 4),
      y: Math.max(4, minY - 4),
      width: Math.min(192, Math.max(16, maxX - minX + 8)),
      height: Math.min(192, Math.max(16, maxY - minY + 8)),
    };
  };

  const fallbackLayerId = layers[layers.length - 1]?.id || 'layer-1';

  // Partial eraser execution (partagé)
  const applyPartialEraser = (pt: VectorPoint, radius = Math.max(8, strokeWidth * 1.5)) => {
    const { nextPaths, changed } = erasePathsAtPoint(
      pathsRef.current,
      pt,
      radius,
      activeLayerId,
      fallbackLayerId
    );
    if (changed) {
      hasErasedInCurrentStrokeRef.current = true;
      commitPaths(nextPaths);
      notifyChange(nextPaths);
    }
  };

  // Whole-stroke drag eraser execution (partagé)
  const applyStrokeEraser = (pt: VectorPoint, radius = 8) => {
    const { nextPaths, changed } = eraseWholeStrokesAtPoint(
      pathsRef.current,
      pt,
      radius,
      activeLayerId,
      fallbackLayerId
    );
    if (changed) {
      hasErasedInCurrentStrokeRef.current = true;
      setSelectedPathIds((prev) => prev.filter((id) => nextPaths.some((p) => p.id === id)));
      commitPaths(nextPaths);
      notifyChange(nextPaths);
    }
  };

  // --- MOUSE / POINTER / TOUCH HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const pt = getSVGCoordinates(e);

    if (isPivotPlacementActive && !isPivotLocked && enablePivotEditing && !isCursorMode) {
      const nextPivot = {
        x: Math.round((pt.x / 200) * 100) / 100,
        y: Math.round((pt.y / 200) * 100) / 100,
      };
      const nextOverride = isStatePivotContext ? true : hasStatePivotOverride;
      if (isStatePivotContext && !hasStatePivotOverride) {
        setHasStatePivotOverride(true);
      }
      emitPivotChange(nextPivot, nextOverride);
      setIsDraggingPivot(true);
      setIsPivotPlacementActive(false);
      return;
    }

    // Si le calque actif est verrouillé, empêcher le dessin et l'effacement
    const currentActiveLayer = layers.find((l) => l.id === activeLayerId) || layers[0];
    if (
      currentActiveLayer?.locked &&
      tool !== 'select' &&
      tool !== 'hotspot'
    ) {
      return;
    }

    if (tool === 'eraser_partial' || tool === 'eraser_stroke') {
      setCursorPos(pt);
    }

    if (tool === 'select') {
      if (!e.shiftKey) {
        setSelectedPathIds([]);
      }
      setIsMarqueeSelecting(true);
      setStartPoint(pt);
      setMarqueeRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'hotspot') {
      setHotspot(pt);
      if (onHotspotChange) onHotspotChange(pt);
      return;
    }

    if (tool === 'bucket') {
      // Si l'utilisateur clique directement sur le contour/bordure d'un tracé ou d'une forme visible et déverrouillée,
      // recolorer le contour avec la couleur de contour active (ou de remplissage en secours)
      const currentPaths = pathsRef.current;
      const orderedVisibleUnlockedPaths = [...layersRef.current]
        .reverse()
        .filter((l) => l.visible && !l.locked)
        .flatMap((l) =>
          currentPaths.filter((p) => (p.layerId || fallbackLayerId) === l.id)
        );
      const hitStrokePath = findPathStrokeAtPoint(pt, orderedVisibleUnlockedPaths, 3.5);
      if (hitStrokePath) {
        const nextStroke =
          strokeColor !== 'none'
            ? strokeColor
            : fillColor !== 'none'
            ? fillColor
            : '#000000';
        const nextStrokeId =
          strokeColor !== 'none'
            ? selectedStrokePaletteId || undefined
            : fillColor !== 'none'
            ? selectedFillPaletteId || undefined
            : 'pal-1';
        const updated = currentPaths.map((p) =>
          p.id === hitStrokePath.id
            ? { ...p, stroke: nextStroke, strokeColorId: nextStrokeId }
            : p
        );
        updatePathsWithHistory(updated);
        return;
      }

      const activeColor =
        fillColor !== 'none'
          ? fillColor
          : strokeColor !== 'none'
          ? strokeColor
          : '#000000';
      const activeColorId =
        fillColor !== 'none'
          ? selectedFillPaletteId || undefined
          : strokeColor !== 'none'
          ? selectedStrokePaletteId || undefined
          : 'pal-1';
      const result = applyBucketFill(pt.x, pt.y, currentPaths, activeColor, activeLayerId);
      if (result) {
        if (result.type === 'update_path') {
          const updated = currentPaths.map((p) =>
            p.id === result.pathId ? { ...result.updatedPath, fillColorId: activeColorId } : p
          );
          updatePathsWithHistory(updated);
        } else if (result.type === 'new_path') {
          // Insérer le remplissage en arrière-plan sous les contours existants
          const updated = [{ ...result.newPath, fillColorId: activeColorId }, ...currentPaths];
          updatePathsWithHistory(updated);
        }
      }
      return;
    }

    if (tool === 'eraser_partial') {
      hasErasedInCurrentStrokeRef.current = false;
      setIsErasingPartial(true);
      applyPartialEraser(pt);
      return;
    }

    if (tool === 'eraser_stroke') {
      hasErasedInCurrentStrokeRef.current = false;
      setIsErasingStroke(true);
      applyStrokeEraser(pt);
      return;
    }

    if (tool === 'pencil' || tool === 'lasso_fill') {
      setIsDrawing(true);
      currentPointsRef.current = [pt];
      setCurrentPoints([pt]);
      return;
    }

    if (tool === 'line' || tool === 'circle') {
      setIsDrawing(true);
      setStartPoint(pt);
      setCurrentPoint(pt);
      return;
    }

    if (tool === 'rectangle') {
      setIsDrawing(true);
      setStartPoint(pt);
      setCurrentRect({ x: pt.x, y: pt.y, width: 0, height: 0, cornerRadius });
      return;
    }

    if (tool === 'polyline') {
      if (activePolylinePoints.length > 0) {
        const first = activePolylinePoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 8 && activePolylinePoints.length >= 3) {
          finishPolyline(true);
          return;
        }
      }
      setActivePolylinePoints((prev) => [...prev, pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getSVGCoordinates(e);

    if (colliderDragAction && colliderDragOriginRef.current) {
      const { mouse, initial } = colliderDragOriginRef.current;
      const dx = pt.x - mouse.x;
      const dy = pt.y - mouse.y;
      const next = { ...manualCollider };

      if (colliderDragAction === 'move_box') {
        next.x = Math.max(0, Math.min(200 - initial.width, initial.x + dx));
        next.y = Math.max(0, Math.min(200 - initial.height, initial.y + dy));
        next.centerX = next.x + next.width / 2;
        next.centerY = next.y + next.height / 2;
      } else if (colliderDragAction === 'resize_se') {
        next.width = Math.max(10, Math.min(200 - initial.x, initial.width + dx));
        next.height = Math.max(10, Math.min(200 - initial.y, initial.height + dy));
        next.centerX = next.x + next.width / 2;
        next.centerY = next.y + next.height / 2;
      } else if (colliderDragAction === 'resize_nw') {
        const right = initial.x + initial.width;
        const bottom = initial.y + initial.height;
        next.x = Math.max(0, Math.min(right - 10, initial.x + dx));
        next.y = Math.max(0, Math.min(bottom - 10, initial.y + dy));
        next.width = right - next.x;
        next.height = bottom - next.y;
        next.centerX = next.x + next.width / 2;
        next.centerY = next.y + next.height / 2;
      } else if (colliderDragAction === 'resize_ne') {
        const bottom = initial.y + initial.height;
        next.width = Math.max(10, Math.min(200 - initial.x, initial.width + dx));
        next.y = Math.max(0, Math.min(bottom - 10, initial.y + dy));
        next.height = bottom - next.y;
        next.centerX = next.x + next.width / 2;
        next.centerY = next.y + next.height / 2;
      } else if (colliderDragAction === 'resize_sw') {
        const right = initial.x + initial.width;
        next.x = Math.max(0, Math.min(right - 10, initial.x + dx));
        next.width = right - next.x;
        next.height = Math.max(10, Math.min(200 - initial.y, initial.height + dy));
        next.centerX = next.x + next.width / 2;
        next.centerY = next.y + next.height / 2;
      } else if (colliderDragAction === 'move_circle') {
        next.centerX = Math.max(8, Math.min(192, initial.centerX + dx));
        next.centerY = Math.max(8, Math.min(192, initial.centerY + dy));
        next.x = next.centerX - next.radius;
        next.y = next.centerY - next.radius;
      } else if (colliderDragAction === 'resize_circle_r') {
        const dist = Math.hypot(pt.x - initial.centerX, pt.y - initial.centerY);
        next.radius = Math.max(6, Math.min(130, dist));
        next.width = next.radius * 2;
        next.height = next.radius * 2;
        next.x = next.centerX - next.radius;
        next.y = next.centerY - next.radius;
      }

      setManualCollider(next);
      return;
    }

    // Mettre à jour cursorPos UNIQUEMENT pour la gomme pour supprimer tout re-render à 120Hz
    if (tool === 'eraser_partial' || tool === 'eraser_stroke') {
      setCursorPos(pt);
    }

    if (isDraggingPivot) {
      const nextPivot = {
        x: Math.round((pt.x / 200) * 100) / 100,
        y: Math.round((pt.y / 200) * 100) / 100,
      };
      const nextOverride = isStatePivotContext ? true : hasStatePivotOverride;
      if (isStatePivotContext && !hasStatePivotOverride) {
        setHasStatePivotOverride(true);
      }
      emitPivotChange(nextPivot, nextOverride);
      return;
    }

    if (isDraggingHotspot) {
      setHotspot(pt);
      if (onHotspotChange) onHotspotChange(pt);
      return;
    }

    if (isErasingPartial && tool === 'eraser_partial') {
      applyPartialEraser(pt);
      return;
    }

    if (isErasingStroke && tool === 'eraser_stroke') {
      applyStrokeEraser(pt);
      return;
    }

    // Select Tool: Marquee drag or multi-shape translation
    if (tool === 'select') {
      if (isMarqueeSelecting && startPoint) {
        const mx = Math.min(startPoint.x, pt.x);
        const my = Math.min(startPoint.y, pt.y);
        const mw = Math.abs(pt.x - startPoint.x);
        const mh = Math.abs(pt.y - startPoint.y);
        setMarqueeRect({ x: mx, y: my, width: mw, height: mh });

        const hitIds: string[] = [];
        paths.forEach((p) => {
          const b = getPathBounds(p);
          if (
            b.x < mx + mw &&
            b.x + b.width > mx &&
            b.y < my + mh &&
            b.y + b.height > my
          ) {
            hitIds.push(p.id);
          }
        });
        setSelectedPathIds((prev) => {
          if (e.shiftKey) {
            return Array.from(new Set([...prev, ...hitIds]));
          }
          return hitIds;
        });
        return;
      }

      if (isDraggingShape && dragStartMouse && selectedPathIds.length > 0) {
        const dx = pt.x - dragStartMouse.x;
        const dy = pt.y - dragStartMouse.y;
        if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
          hasMutatedDuringDragRef.current = true;
          const updated = pathsRef.current.map((p) =>
            selectedPathIds.includes(p.id) ? translatePath(p, dx, dy) : p
          );
          commitPaths(updated);
          setDragStartMouse(pt);
        }
        return;
      }

      // Handle corner resizing when 1 rect or circle is selected
      if (activeHandle && primarySelectedPath && (primarySelectedPath.rect || primarySelectedPath.circle) && selectedPathIds.length === 1) {
        const b = primarySelectedPath.rect
          ? primarySelectedPath.rect
          : getPathBounds(primarySelectedPath);
        let newX = b.x;
        let newY = b.y;
        let newW = b.width;
        let newH = b.height;

        if (activeHandle === 'se') {
          newW = pt.x - b.x;
          newH = pt.y - b.y;
        } else if (activeHandle === 'sw') {
          newW = b.x + b.width - pt.x;
          newX = pt.x;
          newH = pt.y - b.y;
        } else if (activeHandle === 'ne') {
          newW = pt.x - b.x;
          newH = b.y + b.height - pt.y;
          newY = pt.y;
        } else if (activeHandle === 'nw') {
          newW = b.x + b.width - pt.x;
          newX = pt.x;
          newH = b.y + b.height - pt.y;
          newY = pt.y;
        }

        const newRect: VectorRect = {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          cornerRadius: primarySelectedPath.rect?.cornerRadius,
        };
        hasMutatedDuringDragRef.current = true;
        const updated = pathsRef.current.map((p) =>
          p.id === primarySelectedPath.id ? resizeShapeToRect(p, newRect) : p
        );
        commitPaths(updated);
        return;
      }
    }

    if (!isDrawing) return;

    if (tool === 'pencil' || tool === 'lasso_fill') {
      const nativeEvt = e.nativeEvent as any;
      const coalesced =
        typeof nativeEvt?.getCoalescedEvents === 'function'
          ? nativeEvt.getCoalescedEvents()
          : [nativeEvt];

      const ptsToAdd: VectorPoint[] = [];
      for (const subEvt of coalesced) {
        ptsToAdd.push(getSVGCoordinates(subEvt));
      }

      const pts = [...currentPointsRef.current];
      let added = false;
      for (const newPt of ptsToAdd) {
        const last = pts[pts.length - 1];
        if (!last || Math.hypot(newPt.x - last.x, newPt.y - last.y) >= 0.7) {
          pts.push(newPt);
          added = true;
        }
      }
      if (added) {
        currentPointsRef.current = pts;
        setCurrentPoints(pts);
      }
    } else if (tool === 'line' || tool === 'circle') {
      setCurrentPoint(pt);
    } else if (tool === 'rectangle' && startPoint) {
      const width = pt.x - startPoint.x;
      const height = pt.y - startPoint.y;
      setCurrentRect({
        x: startPoint.x,
        y: startPoint.y,
        width,
        height,
        cornerRadius,
      });
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) {
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }

    if (colliderDragAction) {
      setColliderDragAction(null);
      colliderDragOriginRef.current = null;
      emitColliderUpdate(colliderType, 'manual', manualCollider);
      return;
    }

    if (isDraggingPivot) {
      setIsDraggingPivot(false);
      return;
    }

    if (isDraggingHotspot) {
      setIsDraggingHotspot(false);
      if (onHotspotChange) onHotspotChange(hotspot);
    }

    if (isErasingPartial || isErasingStroke) {
      setIsErasingPartial(false);
      setIsErasingStroke(false);
      if (hasErasedInCurrentStrokeRef.current) {
        pushHistoryState(pathsRef.current);
        notifyChange(pathsRef.current);
        hasErasedInCurrentStrokeRef.current = false;
      }
      return;
    }

    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      setMarqueeRect(null);
      setStartPoint(null);
      return;
    }

    if (isDraggingShape || activeHandle) {
      setIsDraggingShape(false);
      setActiveHandle(null);
      setDragStartMouse(null);
      if (hasMutatedDuringDragRef.current) {
        hasMutatedDuringDragRef.current = false;
        pushHistoryState(pathsRef.current);
        notifyChange(pathsRef.current);
      }
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    const activeStrokePoints = currentPointsRef.current.length > 0 ? currentPointsRef.current : currentPoints;
    const basePaths = pathsRef.current;

    if (tool === 'pencil' && activeStrokePoints.length > 0) {
      const d = pointsToSmoothPath(activeStrokePoints, false);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor === 'none' ? '#000000' : strokeColor,
        strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
        strokeWidth,
        fill: 'none',
        type: 'freehand',
        points: activeStrokePoints,
        layerId: activeLayerId,
      };
      const updated = [...basePaths, newPath];
      updatePathsWithHistory(updated);
    } else if (tool === 'line' && startPoint && currentPoint) {
      if (Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) >= 1.5) {
        const newPath: VectorPath = {
          id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          d: generateLinePath(startPoint, currentPoint),
          stroke: strokeColor === 'none' ? '#000000' : strokeColor,
          strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
          strokeWidth,
          fill: 'none',
          type: 'straight',
          points: [startPoint, currentPoint],
          layerId: activeLayerId,
        };
        updatePathsWithHistory([...basePaths, newPath]);
      }
    } else if (tool === 'circle' && startPoint && currentPoint) {
      const cx = (startPoint.x + currentPoint.x) / 2;
      const cy = (startPoint.y + currentPoint.y) / 2;
      const r = Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) / 2;
      if (r >= 2) {
        const newPath: VectorPath = {
          id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          d: generateCirclePath(cx, cy, r),
          stroke: strokeColor,
          strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
          strokeWidth: strokeColor === 'none' ? 0 : strokeWidth,
          fill: fillColor === 'none' ? 'none' : fillColor,
          fillColorId: fillColor === 'none' ? undefined : selectedFillPaletteId || undefined,
          type: 'circle',
          circle: { cx, cy, r },
          points: generateCirclePerimeterPoints(cx, cy, r),
          layerId: activeLayerId,
        };
        const updated = [...basePaths, newPath];
        setSelectedPathIds([newPath.id]);
        updatePathsWithHistory(updated);
      }
    } else if (tool === 'lasso_fill' && activeStrokePoints.length > 1) {
      const d = pointsToSmoothPath(activeStrokePoints, true);
      const effectiveFill = fillColor !== 'none' ? fillColor : strokeColor;
      const effectiveFillId = fillColor !== 'none' ? selectedFillPaletteId : selectedStrokePaletteId;
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor,
        strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
        strokeWidth: strokeColor === 'none' ? 0 : strokeWidth,
        fill: effectiveFill,
        fillColorId: effectiveFillId || undefined,
        type: 'freehand',
        points: activeStrokePoints,
        layerId: activeLayerId,
      };
      const updated = [...basePaths, newPath];
      updatePathsWithHistory(updated);
    } else if (tool === 'rectangle' && currentRect && Math.abs(currentRect.width) > 4) {
      const d = generateRoundedRectPath(currentRect);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor,
        strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
        strokeWidth: strokeColor === 'none' ? 0 : strokeWidth,
        fill: fillColor === 'none' ? 'none' : fillColor,
        fillColorId: fillColor === 'none' ? undefined : selectedFillPaletteId || undefined,
        type: 'rectangle',
        rect: currentRect,
        layerId: activeLayerId,
      };
      const updated = [...basePaths, newPath];
      setSelectedPathIds([newPath.id]);
      setTool('select');
      updatePathsWithHistory(updated);
    }

    currentPointsRef.current = [];
    setCurrentPoints([]);
    setCurrentRect(null);
    setStartPoint(null);
    setCurrentPoint(null);
  };

  const finishPolyline = (closed = false) => {
    if (activePolylinePoints.length < 2) {
      setActivePolylinePoints([]);
      return;
    }
    const d = pointsToPolylinePath(activePolylinePoints, closed);
    const newPath: VectorPath = {
      id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      d,
      stroke: strokeColor === 'none' ? '#6366f1' : strokeColor,
      strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
      strokeWidth,
      fill: closed && fillColor !== 'none' ? fillColor : 'none',
      fillColorId: closed && fillColor !== 'none' ? selectedFillPaletteId || undefined : undefined,
      type: 'polyline',
      points: activePolylinePoints,
      layerId: activeLayerId,
    };
    const updated = [...pathsRef.current, newPath];
    setActivePolylinePoints([]);
    setSelectedPathIds([newPath.id]);
    setTool('select');
    updatePathsWithHistory(updated);
  };

  const handleShapeClick = (p: VectorPath, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    const currentPaths = pathsRef.current;
    if (tool === 'bucket') {
      const activeColor =
        fillColor !== 'none'
          ? fillColor
          : strokeColor !== 'none'
          ? strokeColor
          : '#000000';
      const activeColorId =
        fillColor !== 'none'
          ? selectedFillPaletteId || undefined
          : strokeColor !== 'none'
          ? selectedStrokePaletteId || undefined
          : 'pal-1';
      const svgEl = svgRef.current;
      if (svgEl) {
        const rect = svgEl.getBoundingClientRect();
        const clickX = ((e.clientX - rect.left) / rect.width) * 200;
        const clickY = ((e.clientY - rect.top) / rect.height) * 200;
        const result = applyBucketFill(clickX, clickY, currentPaths, activeColor, activeLayerId);
        if (result) {
          if (result.type === 'update_path') {
            const updated = currentPaths.map((item) =>
              item.id === result.pathId ? { ...result.updatedPath, fillColorId: activeColorId } : item
            );
            updatePathsWithHistory(updated);
          } else if (result.type === 'new_path') {
            const updated = [{ ...result.newPath, fillColorId: activeColorId }, ...currentPaths];
            updatePathsWithHistory(updated);
          }
        } else {
          // Si on clique sur une forme et qu'aucune cavité séparée n'est trouvée, colorer directement la forme
          const closedD = p.d.trim().endsWith('Z') ? p.d : `${p.d} Z`;
          const updated = currentPaths.map((item) =>
            item.id === p.id ? { ...item, fill: activeColor, fillColorId: activeColorId, d: closedD } : item
          );
          updatePathsWithHistory(updated);
        }
      }
      return;
    }
    if (tool === 'eraser_stroke') {
      const updated = currentPaths.filter((item) => item.id !== p.id);
      setSelectedPathIds((prev) => prev.filter((id) => id !== p.id));
      updatePathsWithHistory(updated);
      return;
    }
    if (tool === 'select') {
      if (e.shiftKey) {
        setSelectedPathIds((prev) =>
          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
        );
      } else {
        if (!selectedPathIds.includes(p.id)) {
          setSelectedPathIds([p.id]);
        }
      }
    }
  };

  const updateSelectedShapeProperties = (
    partial: Partial<{
      stroke: string;
      strokeColorId?: string;
      strokeWidth: number;
      fill: string;
      fillColorId?: string;
      cornerRadius: number;
    }>
  ) => {
    if (selectedPathIds.length === 0) return;
    const updated = pathsRef.current.map((p) => {
      if (!selectedPathIds.includes(p.id)) return p;
      let newRect = p.rect;
      let newD = p.d;

      if (partial.cornerRadius !== undefined && p.rect) {
        newRect = { ...p.rect, cornerRadius: partial.cornerRadius };
        newD = generateRoundedRectPath(newRect);
      }

      return {
        ...p,
        stroke: partial.stroke !== undefined ? partial.stroke : p.stroke,
        strokeColorId: partial.stroke !== undefined ? partial.strokeColorId : p.strokeColorId,
        strokeWidth: partial.strokeWidth !== undefined ? partial.strokeWidth : p.strokeWidth,
        fill: partial.fill !== undefined ? partial.fill : p.fill,
        fillColorId: partial.fill !== undefined ? partial.fillColorId : p.fillColorId,
        rect: newRect,
        d: newD,
      };
    });

    updatePathsWithHistory(updated);
  };

  const handleDuplicateSelected = () => {
    if (selectedPathIds.length === 0) return;
    const newSelectedIds: string[] = [];
    const duplicatedPaths: VectorPath[] = [];

    pathsRef.current.forEach((p) => {
      if (!selectedPathIds.includes(p.id)) return;
      const newId = `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newSelectedIds.push(newId);
      duplicatedPaths.push({ ...translatePath(p, 10, 10), id: newId });
    });

    const updated = [...pathsRef.current, ...duplicatedPaths];
    setSelectedPathIds(newSelectedIds);
    updatePathsWithHistory(updated);
  };

  const handleDeleteSelected = () => {
    if (selectedPathIds.length === 0) return;
    const updated = pathsRef.current.filter((p) => !selectedPathIds.includes(p.id));
    setSelectedPathIds([]);
    updatePathsWithHistory(updated);
  };

  const handleClear = () => {
    currentPointsRef.current = [];
    setCurrentPoints([]);
    setActivePolylinePoints([]);
    setSelectedPathIds([]);
    updatePathsWithHistory([]);
  };

  const handleCopyGuideToCanvas = () => {
    if (!activeReferenceGuide?.paths || activeReferenceGuide.paths.length === 0) return;
    const isCustom = activeReferenceGuide.isCustom;
    const newPaths: VectorPath[] = activeReferenceGuide.paths.map((p, idx) => ({
      id: `guide-imported-${Date.now()}-${idx}`,
      type: (p as VectorPath).type || 'freehand',
      d: p.d,
      transform: isCustom ? undefined : 'scale(8.333333333333334)',
      stroke: strokeColor === 'none' ? (p.stroke || '#0f172a') : strokeColor,
      strokeWidth: p.strokeWidth || (isCustom ? 4 : 1.8),
      fill: p.fill && p.fill !== 'none' ? (fillColor === 'none' ? p.fill : fillColor) : 'none',
      rect: (p as VectorPath).rect,
      points: (p as VectorPath).points,
    }));
    const updated = [...pathsRef.current, ...newPaths];
    updatePathsWithHistory(updated);
  };

  const handleResetHotspot = () => {
    const defaultPos = activeReferenceGuide?.hotspot || { x: 75, y: 25 };
    setHotspot(defaultPos);
    if (onHotspotChange) onHotspotChange(defaultPos);
  };

  const selectedBounds = getSelectionBoundingBox(paths, selectedPathIds);
  const overallBounds = getDrawingOverallBounds();

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full items-stretch overflow-hidden">
      {/* Zone de dessin Vectorielle SVG principale */}
      <div className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-center relative shadow-inner min-h-[360px] overflow-hidden">
        {/* Top Info Bar */}
        <DrawingCanvasTopBar
          currentEditingStateName={currentEditingStateName}
          tool={tool}
          activePolylineCount={activePolylinePoints.length}
          selectedCount={selectedPathIds.length}
          hideTopHistoryButtons={hideTopHistoryButtons}
          canUndo={historyEntryRef.current.index > 0}
          canRedo={historyEntryRef.current.index < historyEntryRef.current.stack.length - 1}
          onUndo={handleUndo}
          onRedo={handleRedo}
          hasReferenceGuide={Boolean(activeReferenceGuide)}
          guideOpacity={guideOpacity}
          onToggleGuide={() => setGuideOpacity(guideOpacity > 0 ? 0 : 0.45)}
          isCursorMode={isCursorMode}
          showHotspot={showHotspot}
          hotspot={hotspot}
          onToggleHotspot={() => setShowHotspot(!showHotspot)}
          showGrid={showGrid}
          onToggleGrid={() => setShowGrid(!showGrid)}
          snapToGrid={snapToGrid}
          onToggleSnapToGrid={() => setSnapToGrid(!snapToGrid)}
          onFinishPolyline={() => finishPolyline(false)}
          pathCount={paths.length}
        />

        {/* SVG Drawing Canvas */}
        <div className="flex-1 w-full flex items-center justify-center relative">
          <svg
            ref={svgRef}
            viewBox="0 0 200 200"
            className={`w-full h-full max-w-[500px] max-h-[500px] aspect-square bg-white rounded-3xl touch-none select-none border border-slate-300 shadow-md ${
              tool === 'eraser_stroke' || tool === 'eraser_partial'
                ? 'atelier-cursor-hidden'
                : tool === 'bucket'
                ? 'cursor-cell'
                : tool === 'select'
                ? 'cursor-default'
                : 'atelier-fine-crosshair'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
              if (
                isDrawing ||
                isErasingPartial ||
                isErasingStroke ||
                isDraggingShape ||
                Boolean(activeHandle) ||
                isMarqueeSelecting
              ) {
                handlePointerUp();
              }
              if (cursorPos) setCursorPos(null);
            }}
            onDoubleClick={() => {
              if (tool === 'polyline') {
                finishPolyline(false);
              }
            }}
          >
            {/* Grille de repère */}
            <defs>
              <pattern id="grid-dots-light" width={gridSnapSize * 2} height={gridSnapSize * 2} patternUnits="userSpaceOnUse">
                <circle cx={gridSnapSize} cy={gridSnapSize} r="1" fill="rgba(100,116,139,0.25)" />
                <path d={`M ${gridSnapSize * 2} 0 L 0 0 0 ${gridSnapSize * 2}`} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" />
              </pattern>
            </defs>
            {showGrid && <rect width="200" height="200" fill="url(#grid-dots-light)" />}

            {/* Calque Modèle de Référence (Dessin repère Hugeicons / Guide d'un autre état de curseur) */}
            {activeReferenceGuide && activeReferenceGuide.paths && guideOpacity > 0 && (
              <g
                className="pointer-events-none select-none"
                opacity={guideOpacity}
                transform={activeReferenceGuide.isCustom ? undefined : 'scale(8.333333333333334)'}
              >
                {/* White outline backdrop for maximum contrast against any canvas background */}
                <g
                  stroke="#ffffff"
                  strokeWidth={activeReferenceGuide.isCustom ? 5 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.95"
                >
                  {activeReferenceGuide.paths.map((p, idx) => (
                    <path
                      key={`guide-bg-${idx}`}
                      d={p.d}
                      fill={p.fill && p.fill !== 'none' ? '#ffffff' : 'none'}
                    />
                  ))}
                </g>
                {/* Main guide strokes in distinctive indigo/cobalt */}
                <g stroke="#4f46e5" fill="none">
                  {activeReferenceGuide.paths.map((p, idx) => (
                    <path
                      key={`guide-fg-${idx}`}
                      d={p.d}
                      stroke="#4f46e5"
                      fill={p.fill && p.fill !== 'none' ? 'rgba(99, 102, 241, 0.25)' : 'none'}
                      strokeWidth={p.strokeWidth || (activeReferenceGuide.isCustom ? 3.5 : 1.8)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={activeReferenceGuide.isCustom ? '4 2' : undefined}
                    />
                  ))}
                </g>
              </g>
            )}

            {/* Calque Pelure d'Oignon (Onion Skinning) */}
            {onionSkinEnabled && activeOnionReference?.vectorPaths && activeOnionReference.vectorPaths.length > 0 && (
              <g opacity={onionOpacity} className="pointer-events-none select-none">
                {activeOnionReference.vectorPaths.map((p, idx) => (
                  <path
                    key={`onion-${p.id || idx}`}
                    d={p.d}
                    stroke="#64748b"
                    strokeWidth={p.strokeWidth || 4}
                    strokeDasharray="4 2"
                    fill={p.fill && p.fill !== 'none' ? '#94a3b8' : 'none'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}

            {/* Aperçu du Collider actif (Auto ou Manuel interactif) */}
            <DrawingCanvasColliderOverlay
              showColliderPreview={showColliderPreview}
              isSharedColliderEntity={isSharedColliderEntity}
              isReferenceStateForSharedCollider={isReferenceStateForSharedCollider}
              overrideCollider={overrideCollider}
              colliderMode={colliderMode}
              colliderType={colliderType}
              manualCollider={manualCollider}
              isColliderBodyDraggable={isColliderBodyDraggable}
              isLocked={isColliderLocked}
              overallBounds={overallBounds}
              onStartColliderDrag={(action, e) => {
                if (isColliderLocked) return;
                e.stopPropagation();
                try {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                } catch (_) {}
                setColliderDragAction(action);
                colliderDragOriginRef.current = {
                  mouse: getSVGCoordinates(e),
                  initial: { ...manualCollider },
                };
              }}
            />

            {/* Tracés existants groupés par calques (rendus de bas en haut) */}
            {[...layers].reverse().map((layer) => {
              if (!layer.visible) return null;
              const layerPaths = paths.filter(
                (p) => (p.layerId || layers[layers.length - 1]?.id || 'layer-1') === layer.id
              );
              return (
                <g
                  key={layer.id}
                  id={`canvas-layer-${layer.id}`}
                  opacity={layer.opacity ?? 1}
                  style={{ pointerEvents: layer.locked ? 'none' : 'auto' }}
                >
                  {layerPaths.map((p) => {
                    const isSelectMode = tool === 'select' && !layer.locked;
                    const isEraserStroke = tool === 'eraser_stroke' && !layer.locked;
                    return (
                      <path
                        key={p.id}
                        d={p.d}
                        stroke={p.stroke}
                        strokeWidth={p.strokeWidth}
                        fill={p.fill || 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          pointerEvents: isSelectMode || isEraserStroke ? 'auto' : 'none',
                        }}
                        className={`transition-opacity ${
                          isEraserStroke
                            ? 'hover:stroke-rose-500 hover:opacity-40'
                            : isSelectMode
                            ? selectedPathIds.includes(p.id)
                              ? 'cursor-move'
                              : 'hover:opacity-90 cursor-pointer'
                            : ''
                        }`}
                        onClick={(e) => !layer.locked && handleShapeClick(p, e)}
                        onPointerDown={(e) => {
                          if (layer.locked) return;
                          if (tool === 'select') {
                            e.stopPropagation();
                            try {
                              (e.target as Element).setPointerCapture?.(e.pointerId);
                            } catch (_) {}
                            if (e.shiftKey) {
                              setSelectedPathIds((prev) =>
                                prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                              );
                            } else {
                              if (!selectedPathIds.includes(p.id)) {
                                setSelectedPathIds([p.id]);
                              }
                            }
                            hasMutatedDuringDragRef.current = false;
                            setIsDraggingShape(true);
                            setDragStartMouse(getSVGCoordinates(e));
                          }
                        }}
                      />
                    );
                  })}
                </g>
              );
            })}

            {/* Tracé Freehand / Pencil en cours */}
            {isDrawing && tool === 'pencil' && currentPoints.length > 0 && (
              <path
                d={pointsToSmoothPath(currentPoints)}
                stroke={strokeColor === 'none' ? '#000000' : strokeColor}
                strokeWidth={strokeWidth}
                fill={fillColor === 'none' ? 'none' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Ligne Droite en cours */}
            {isDrawing && tool === 'line' && startPoint && currentPoint && (
              <line
                x1={startPoint.x}
                y1={startPoint.y}
                x2={currentPoint.x}
                y2={currentPoint.y}
                stroke={strokeColor === 'none' ? '#000000' : strokeColor}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Cercle en cours */}
            {isDrawing && tool === 'circle' && startPoint && currentPoint && (
              <circle
                cx={(startPoint.x + currentPoint.x) / 2}
                cy={(startPoint.y + currentPoint.y) / 2}
                r={Math.hypot(currentPoint.x - startPoint.x, currentPoint.y - startPoint.y) / 2}
                stroke={strokeColor === 'none' ? 'none' : strokeColor}
                strokeWidth={strokeColor === 'none' ? 0 : strokeWidth}
                fill={fillColor === 'none' ? 'rgba(99,102,241,0.1)' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Tracé Lasso Plein en cours */}
            {isDrawing && tool === 'lasso_fill' && currentPoints.length > 1 && (
              <path
                d={pointsToSmoothPath(currentPoints, true)}
                stroke={strokeColor === 'none' ? '#000000' : strokeColor}
                strokeWidth={strokeColor === 'none' ? 0 : strokeWidth}
                fill={fillColor !== 'none' ? fillColor : strokeColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              />
            )}

            {/* Rectangle en cours */}
            {isDrawing && tool === 'rectangle' && currentRect && (
              <path
                d={generateRoundedRectPath(currentRect)}
                stroke={strokeColor === 'none' ? 'none' : strokeColor}
                strokeWidth={strokeColor === 'none' ? 0 : strokeWidth}
                fill={fillColor === 'none' ? 'rgba(99,102,241,0.1)' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Polyligne en cours */}
            {tool === 'polyline' && activePolylinePoints.length > 0 && (
              <g>
                <path
                  d={pointsToPolylinePath(activePolylinePoints, false)}
                  stroke={strokeColor === 'none' ? '#000000' : strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
                {activePolylinePoints.map((pt, idx) => (
                  <circle
                    key={`poly-node-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === 0 ? 5 : 3.5}
                    fill={idx === 0 ? '#10b981' : '#6366f1'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="cursor-pointer"
                  />
                ))}
              </g>
            )}

            {/* Curseur Gomme circulaire */}
            {(tool === 'eraser_partial' || tool === 'eraser_stroke') && cursorPos && (
              <g className="pointer-events-none">
                <circle
                  cx={cursorPos.x}
                  cy={cursorPos.y}
                  r={tool === 'eraser_partial' ? Math.max(6, strokeWidth * 1.5) : 8}
                  fill="rgba(244, 63, 94, 0.2)"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Marquee Selection Rectangle */}
            {isMarqueeSelecting && marqueeRect && (
              <rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill="rgba(99, 102, 241, 0.08)"
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                className="pointer-events-none select-none"
              />
            )}

            {/* Cadre de sélection discret (ne recouvre jamais la couleur ni l'épaisseur réelle du trait) */}
            {tool === 'select' && selectedBounds && selectedPathIds.length > 0 && (
              <g className="select-none">
                {selectedPathIds.length > 1 &&
                  paths
                    .filter((p) => selectedPathIds.includes(p.id))
                    .map((p) => {
                      const b = sharedGetPathBounds(p);
                      return (
                        <rect
                          key={`sel-sub-${p.id}`}
                          x={b.x - 1.5}
                          y={b.y - 1.5}
                          width={b.width + 3}
                          height={b.height + 3}
                          fill="none"
                          stroke="rgba(99,102,241,0.35)"
                          strokeWidth="0.65"
                          strokeDasharray="2.5 2.5"
                          className="pointer-events-none"
                        />
                      );
                    })}
                <rect
                  x={selectedBounds.x - 2}
                  y={selectedBounds.y - 2}
                  width={selectedBounds.width + 4}
                  height={selectedBounds.height + 4}
                  fill="transparent"
                  stroke="rgba(99,102,241,0.65)"
                  strokeWidth="0.9"
                  strokeDasharray="3 2.5"
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    try {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    } catch (_) {}
                    hasMutatedDuringDragRef.current = false;
                    setIsDraggingShape(true);
                    setDragStartMouse(getSVGCoordinates(e));
                  }}
                />

                {/* Show compact corner resize handles if single rect or circle is selected */}
                {selectedPathIds.length === 1 && (primarySelectedPath?.rect || primarySelectedPath?.circle) && (
                  <>
                    <rect
                      x={selectedBounds.x - 5}
                      y={selectedBounds.y - 5}
                      width="6"
                      height="6"
                      rx="1"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="1.25"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('nw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 1}
                      y={selectedBounds.y - 5}
                      width="6"
                      height="6"
                      rx="1"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="1.25"
                      className="cursor-nesw-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('ne');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 1}
                      y={selectedBounds.y + selectedBounds.height - 1}
                      width="6"
                      height="6"
                      rx="1"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="1.25"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('se');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x - 5}
                      y={selectedBounds.y + selectedBounds.height - 1}
                      width="6"
                      height="6"
                      rx="1"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="1.25"
                      className="cursor-nesw-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('sw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                  </>
                )}
              </g>
            )}

            {/* Repère de position réelle du curseur (Point d'impact Hotspot) */}
            {showHotspot && (
              <g
                className="cursor-move select-none"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingHotspot(true);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setIsDraggingHotspot(true);
                }}
              >
                {/* Target radar halo */}
                <circle
                  cx={hotspot.x}
                  cy={hotspot.y}
                  r="15"
                  fill="rgba(239, 68, 68, 0.15)"
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                {/* Crosshairs */}
                <line x1={hotspot.x - 20} y1={hotspot.y} x2={hotspot.x + 20} y2={hotspot.y} stroke="#ef4444" strokeWidth="1.2" />
                <line x1={hotspot.x} y1={hotspot.y - 20} x2={hotspot.x} y2={hotspot.y + 20} stroke="#ef4444" strokeWidth="1.2" />
                {/* Bullseye center */}
                <circle cx={hotspot.x} cy={hotspot.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx={hotspot.x} cy={hotspot.y} r="1.5" fill="#ffffff" />
                {/* Coordinate badge */}
                <g transform={`translate(${hotspot.x + 8}, ${hotspot.y - 18})`}>
                  <rect x="0" y="0" width="76" height="15" rx="3" fill="#0f172a" opacity="0.88" />
                  <text x="38" y="11" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">
                    Impact: ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})
                  </text>
                </g>
              </g>
            )}
            {/* Repère visuel interactif du Pivot (Centre de rotation & d'attachement) */}
            {enablePivotEditing && !isCursorMode && (
              <DrawingCanvasPivotOverlay
                showPivotPreview={showPivotPreview}
                pivot={pivot}
                isPlacementActive={isPivotPlacementActive}
                isDraggingPivot={isDraggingPivot}
                isLocked={isPivotLocked}
                onStartPivotDrag={(e) => {
                  if (isPivotLocked) return;
                  try {
                    (e.target as Element).setPointerCapture?.(e.pointerId);
                  } catch (_) {}
                  setShowPivotPreview(true);
                  setIsDraggingPivot(true);
                }}
              />
            )}
          </svg>
        </div>
      </div>

      {/* Barre d'outils vectorielle latérale (Outils, Colliders, Inspecteur, Palette Stroke & Fill) */}
      <div className="w-full lg:w-84 bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-3xl flex flex-col justify-between gap-3 shrink-0 shadow-2xs overflow-y-auto max-h-full">
        <div className="space-y-3.5">
          <DrawingToolGrid
            tool={tool}
            showHotspotTool={Boolean(isCursorMode || referenceGuide || initialHotspot)}
            onSelectTool={(nextTool) => {
              setTool(nextTool);
              if (nextTool !== 'select') {
                setSelectedPathIds([]);
              }
              if (nextTool === 'polyline') {
                setActivePolylinePoints([]);
              }
            }}
          />

          <DrawingLayersSection
            layers={layers}
            activeLayerId={activeLayerId}
            activeLayer={activeLayer}
            paths={paths}
            editingLayerId={editingLayerId}
            editingLayerName={editingLayerName}
            onSetEditingLayerId={setEditingLayerId}
            onSetEditingLayerName={setEditingLayerName}
            onSelectActiveLayer={setActiveLayerId}
            onAddLayer={handleAddLayer}
            onRenameLayer={handleRenameLayer}
            onToggleVisibility={handleToggleLayerVisibility}
            onToggleLock={handleToggleLayerLock}
            onMoveLayer={handleMoveLayer}
            onDeleteLayer={handleDeleteLayer}
            onOpacityChange={handleLayerOpacityChange}
          />

          {tool === 'select' && selectedPathIds.length > 0 && (
            <DrawingSelectionInspector
              selectedCount={selectedPathIds.length}
              primarySelectedPath={primarySelectedPath}
              cornerRadius={cornerRadius}
              layers={layers}
              activeLayerId={activeLayerId}
              onDuplicateSelected={handleDuplicateSelected}
              onDeleteSelected={handleDeleteSelected}
              onCornerRadiusChange={(val) => {
                setCornerRadius(val);
                updateSelectedShapeProperties({ cornerRadius: val });
              }}
              onMoveSelectedToLayer={handleMoveSelectedToLayer}
            />
          )}

          <DrawingColorPaletteSection
            projectPalette={projectPalette}
            strokeColor={strokeColor}
            selectedStrokePaletteId={selectedStrokePaletteId}
            fillColor={fillColor}
            selectedFillPaletteId={selectedFillPaletteId}
            strokeWidth={strokeWidth}
            selectedCount={selectedPathIds.length}
            onResetProjectPalette={resetProjectPalette}
            onModifyPaletteColor={handleModifyPaletteColor}
            onSetStrokeColor={setStrokeColor}
            onSetSelectedStrokePaletteId={setSelectedStrokePaletteId}
            onSetFillColor={setFillColor}
            onSetSelectedFillPaletteId={setSelectedFillPaletteId}
            onSetStrokeWidth={setStrokeWidth}
            onUpdateSelectedProps={updateSelectedShapeProperties}
          />

          <DrawingColliderSection
            showColliderPreview={showColliderPreview}
            onToggleShowColliderPreview={() => setShowColliderPreview(!showColliderPreview)}
            onAutoDetectCollider={handleAutoDetectCollider}
            isSharedColliderEntity={isSharedColliderEntity}
            isReferenceStateForSharedCollider={isReferenceStateForSharedCollider}
            overrideCollider={overrideCollider}
            onToggleOverrideCollider={handleToggleOverrideCollider}
            colliderMode={colliderMode}
            onSwitchColliderMode={handleSwitchColliderMode}
            colliderType={colliderType}
            onSelectColliderType={handleColliderTypeSelect}
            isColliderBodyDraggable={isColliderBodyDraggable}
            onToggleColliderBodyDraggable={() => setIsColliderBodyDraggable(!isColliderBodyDraggable)}
            isColliderLocked={isColliderLocked}
            onToggleColliderLocked={() => {
              setIsColliderLocked((prev) => {
                const next = !prev;
                if (next) setColliderDragAction(null);
                return next;
              });
            }}
            onInitManualFromDrawing={() => handleInitManualFromDrawing()}
            manualCollider={manualCollider}
            onUpdateManualCollider={(shape, next) => {
              if (isColliderLocked) return;
              setManualCollider(next);
              emitColliderUpdate(shape, 'manual', next);
            }}
          />

          {enablePivotEditing && !isCursorMode && (
            <DrawingPivotSection
              pivot={pivot}
              showPivotPreview={showPivotPreview}
              onToggleShowPivotPreview={() => setShowPivotPreview(!showPivotPreview)}
              isPivotLocked={isPivotLocked}
              onTogglePivotLocked={() => {
                setIsPivotLocked((prev) => {
                  const next = !prev;
                  if (next) {
                    setIsPivotPlacementActive(false);
                    setIsDraggingPivot(false);
                  }
                  return next;
                });
              }}
              isPlacementActive={isPivotPlacementActive}
              onTogglePlacementActive={() => {
                if (isPivotLocked) return;
                setShowPivotPreview(true);
                setIsPivotPlacementActive((v) => !v);
              }}
              onChangePivot={(next) => {
                if (isPivotLocked) return;
                setShowPivotPreview(true);
                const nextOverride = isStatePivotContext ? true : hasStatePivotOverride;
                if (isStatePivotContext && !hasStatePivotOverride) {
                  setHasStatePivotOverride(true);
                }
                emitPivotChange(next, nextOverride);
              }}
              onResetPivot={() => {
                if (isPivotLocked) return;
                const next = { x: 0.5, y: 0.5 };
                const nextOverride = isStatePivotContext ? true : hasStatePivotOverride;
                if (isStatePivotContext && !hasStatePivotOverride) {
                  setHasStatePivotOverride(true);
                }
                emitPivotChange(next, nextOverride);
              }}
              isStateContext={isStatePivotContext}
              hasStateOverride={hasStatePivotOverride}
              baseEntityPivot={baseEntityPivot}
              onToggleStateOverride={(nextOvr) => {
                setHasStatePivotOverride(nextOvr);
                const targetPivot = nextOvr
                  ? pivot
                  : baseEntityPivot || { x: 0.5, y: 0.5 };
                emitPivotChange(targetPivot, nextOvr);
              }}
            />
          )}

          <DrawingGuidesAndOnionSection
            activeReferenceGuide={activeReferenceGuide}
            availableReferenceGuides={availableReferenceGuides}
            selectedGuideId={selectedGuideId}
            onSelectGuideId={setSelectedGuideId}
            guideOpacity={guideOpacity}
            onGuideOpacityChange={setGuideOpacity}
            onCopyGuideToCanvas={handleCopyGuideToCanvas}
            isCursorMode={isCursorMode}
            showHotspot={showHotspot}
            onToggleHotspot={() => setShowHotspot(!showHotspot)}
            hotspot={hotspot}
            onResetHotspot={handleResetHotspot}
            availableOnionStates={availableOnionStates}
            onionSkinEnabled={onionSkinEnabled}
            onToggleOnionSkin={() => setOnionSkinEnabled(!onionSkinEnabled)}
            selectedOnionStateId={selectedOnionStateId}
            onSelectOnionStateId={setSelectedOnionStateId}
            onionOpacity={onionOpacity}
            onOnionOpacityChange={setOnionOpacity}
          />
        </div>

        {/* Actions : Annuler, Rétablir & Effacer */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyEntryRef.current.index <= 0}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" /> Annuler
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyEntryRef.current.index >= historyEntryRef.current.stack.length - 1}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Rétablir (Ctrl+Y)"
          >
            <Redo2 className="w-3.5 h-3.5" /> Rétablir
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={paths.length === 0}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Effacer tout"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Effacer
          </button>
        </div>
      </div>
    </div>
  );
}
