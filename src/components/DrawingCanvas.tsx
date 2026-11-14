import React, { useRef, useState, useEffect } from 'react';
import {
  MousePointer,
  Pencil,
  Slash,
  GitCommit,
  Square,
  Circle,
  Lasso,
  PaintBucket,
  Eraser,
  Scissors,
  RotateCcw,
  Undo2,
  Redo2,
  Layers,
  Pipette,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
  Grid,
  Magnet,
  Sparkles,
  Shield,
  Shapes,
  Target,
  Crosshair,
  Download,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { VectorPath, VectorPoint, VectorRect, ColliderType, ColliderBounds, DrawingLayer } from '../types';
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
} from '../utils/vectorDrawing';

export { generateRoundedRectPath, pointsToSmoothPath, pointsToPolylinePath };

export interface OnionStateOption {
  id: string;
  name: string;
  vectorPaths?: VectorPath[];
}

export interface ReferenceGuideOption {
  id: string;
  name: string;
  paths?: Array<{ d: string; stroke?: string; fill?: string; strokeWidth?: number }>;
  hotspot?: { x: number; y: number };
  isCustom?: boolean;
}

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
  frameSyncKey?: string;
  actionsRef?: React.MutableRefObject<DrawingCanvasActionsHandle | null>;
  onHistoryStateChange?: (state: DrawingCanvasHistoryState) => void;
  hideTopHistoryButtons?: boolean;
}

export const FINE_CROSSHAIR_CURSOR =
  'url("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAATCAYAAAByUDbMAAAAN0lEQVR4nGNgIAD+IwFCagkCkCH84lqjho08w/4TAWCGEQJwmynFcMOo5rLBGwGjhg0Bw4hNRwArM0of2vmpUwAAAABJRU5ErkJggg==") 9 9, crosshair';

export type DrawTool =
  | 'select'
  | 'pencil'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'lasso_fill'
  | 'bucket'
  | 'eraser_stroke'
  | 'eraser_partial'
  | 'hotspot';

export function DrawingCanvas({
  onVectorChange,
  initialPaths = [],
  initialLayers = [],
  onLayersChange,
  initialColliderType = 'box',
  initialColliderBounds,
  initialStrokeColor = '#000000',
  initialFillColor = 'none',
  onionStates = [],
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
  availableReferenceGuides,
  frameSyncKey,
  actionsRef,
  onHistoryStateChange,
  hideTopHistoryButtons = false,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<VectorPath[]>(initialPaths);
  const historyRef = useRef<VectorPath[][]>([initialPaths]);
  const historyIndexRef = useRef<number>(0);
  const [historyVersion, setHistoryVersion] = useState<number>(0);
  const hasErasedInCurrentStrokeRef = useRef<boolean>(false);

  // --- SYSTÈME DE GESTION DE CALQUES DE DESSIN ---
  const [layers, setLayers] = useState<DrawingLayer[]>(() => {
    if (initialLayers && initialLayers.length > 0) return initialLayers;
    return [{ id: 'layer-1', name: 'Calque 1', visible: true, locked: false, opacity: 1 }];
  });
  const [activeLayerId, setActiveLayerId] = useState<string>(() => {
    return initialLayers?.[0]?.id || 'layer-1';
  });
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [editingLayerName, setEditingLayerName] = useState<string>('');

  const handleAddLayer = () => {
    const newLayer: DrawingLayer = {
      id: `layer-${Date.now().toString(36)}`,
      name: `Calque ${layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
    };
    const updated = [newLayer, ...layers];
    setLayers(updated);
    setActiveLayerId(newLayer.id);
    if (onLayersChange) onLayersChange(updated);
  };

  const handleToggleLayerVisibility = (layerId: string) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, visible: !l.visible } : l));
    setLayers(updated);
    if (onLayersChange) onLayersChange(updated);
  };

  const handleToggleLayerLock = (layerId: string) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, locked: !l.locked } : l));
    setLayers(updated);
    if (onLayersChange) onLayersChange(updated);
  };

  const handleMoveLayer = (layerId: string, direction: 'up' | 'down') => {
    const idx = layers.findIndex((l) => l.id === layerId);
    if (idx === -1) return;
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= layers.length) return;
    const copy = [...layers];
    const [item] = copy.splice(idx, 1);
    copy.splice(targetIdx, 0, item);
    setLayers(copy);
    if (onLayersChange) onLayersChange(copy);
  };

  const handleDeleteLayer = (layerId: string) => {
    if (layers.length <= 1) return;
    const remainingLayers = layers.filter((l) => l.id !== layerId);
    const remainingPaths = paths.filter(
      (p) => (p.layerId || layers[layers.length - 1]?.id || 'layer-1') !== layerId
    );
    setLayers(remainingLayers);
    if (activeLayerId === layerId) {
      setActiveLayerId(remainingLayers[0].id);
    }
    updatePathsWithHistory(remainingPaths);
    if (onLayersChange) onLayersChange(remainingLayers);
  };

  const handleRenameLayer = (layerId: string, newName: string) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, name: newName } : l));
    setLayers(updated);
    if (onLayersChange) onLayersChange(updated);
  };

  const handleLayerOpacityChange = (layerId: string, opacity: number) => {
    const updated = layers.map((l) => (l.id === layerId ? { ...l, opacity } : l));
    setLayers(updated);
    if (onLayersChange) onLayersChange(updated);
  };

  const handleMoveSelectedToLayer = (targetLayerId: string) => {
    if (selectedPathIds.length === 0) return;
    const updated = paths.map((p) =>
      selectedPathIds.includes(p.id) ? { ...p, layerId: targetLayerId } : p
    );
    updatePathsWithHistory(updated);
  };

  const pushHistoryState = (newPaths: VectorPath[]) => {
    const curIndex = historyIndexRef.current;
    const trimmed = historyRef.current.slice(0, curIndex + 1);
    trimmed.push(newPaths);
    if (trimmed.length > 60) trimmed.shift();
    historyRef.current = trimmed;
    historyIndexRef.current = trimmed.length - 1;
    setHistoryVersion((v) => v + 1);
  };

  const updatePathsWithHistory = (newPaths: VectorPath[]) => {
    setPaths(newPaths);
    pushHistoryState(newPaths);
    notifyChange(newPaths);
  };

  const handleUndo = () => {
    if (historyIndexRef.current <= 0) return;
    const newIndex = historyIndexRef.current - 1;
    historyIndexRef.current = newIndex;
    setHistoryVersion((v) => v + 1);
    const targetPaths = historyRef.current[newIndex] || [];
    setPaths(targetPaths);
    setSelectedPathIds((prev) => prev.filter((id) => targetPaths.some((p) => p.id === id)));
    notifyChange(targetPaths);
  };

  const handleRedo = () => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    const newIndex = historyIndexRef.current + 1;
    historyIndexRef.current = newIndex;
    setHistoryVersion((v) => v + 1);
    const targetPaths = historyRef.current[newIndex] || [];
    setPaths(targetPaths);
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
  const [manualCollider, setManualCollider] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
    centerX: number;
    centerY: number;
    radius: number;
  }>(() => {
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
  const [colliderDragAction, setColliderDragAction] = useState<
    | null
    | 'move_box'
    | 'resize_nw'
    | 'resize_ne'
    | 'resize_se'
    | 'resize_sw'
    | 'move_circle'
    | 'resize_circle_r'
  >(null);
  const colliderDragOriginRef = useRef<{
    mouse: VectorPoint;
    initial: { x: number; y: number; width: number; height: number; centerX: number; centerY: number; radius: number };
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
  const availableOnionStates = onionStates.filter((s) => s.vectorPaths && s.vectorPaths.length > 0);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(availableOnionStates.length > 0);
  const [selectedOnionStateId, setSelectedOnionStateId] = useState<string>(
    availableOnionStates[0]?.id || ''
  );
  const [onionOpacity, setOnionOpacity] = useState(0.35);

  const selectedIdsRef = useRef<string[]>(selectedPathIds);
  selectedIdsRef.current = selectedPathIds;
  const pathsRef = useRef<VectorPath[]>(paths);
  pathsRef.current = paths;

  // Exposer Annuler / Rétablir / Effacer / Pelure au header parent (Mode Dessin Unifié)
  useEffect(() => {
    if (actionsRef) {
      actionsRef.current = {
        undo: handleUndo,
        redo: handleRedo,
        clear: handleClear,
        toggleOnion: () => setOnionSkinEnabled((v) => !v),
      };
    }
  });

  useEffect(() => {
    if (onHistoryStateChange) {
      onHistoryStateChange({
        canUndo: historyIndexRef.current > 0,
        canRedo: historyIndexRef.current < historyRef.current.length - 1,
        pathCount: paths.length,
        onionEnabled: onionSkinEnabled,
        hasOnion: availableOnionStates.length > 0,
      });
    }
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
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIdsRef.current.length > 0) {
        e.preventDefault();
        const updated = pathsRef.current.filter((p) => !selectedIdsRef.current.includes(p.id));
        setSelectedPathIds([]);
        updatePathsWithHistory(updated);
      } else if (e.key === 'Escape') {
        setActivePolylinePoints([]);
        setSelectedPathIds([]);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const lastFrameSyncKeyRef = useRef<string | undefined>(frameSyncKey);
  useEffect(() => {
    if (frameSyncKey === undefined || frameSyncKey === lastFrameSyncKeyRef.current) return;
    lastFrameSyncKeyRef.current = frameSyncKey;
    setPaths(initialPaths);
    historyRef.current = [initialPaths];
    historyIndexRef.current = 0;
    setHistoryVersion((v) => v + 1);
    const nextLayers =
      initialLayers && initialLayers.length > 0
        ? initialLayers
        : [{ id: 'layer-1', name: 'Calque 1', visible: true, locked: false, opacity: 1 }];
    setLayers(nextLayers);
    setActiveLayerId(nextLayers[0]?.id || 'layer-1');
    setSelectedPathIds([]);
    setActivePolylinePoints([]);
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

    const updatedLocalPaths = paths.map((p) => {
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
    setPaths(updatedLocalPaths);
    notifyChange(updatedLocalPaths);
  };

  const notifyChange = (updatedPaths: VectorPath[]) => {
    if (!svgRef.current) {
      onVectorChange(updatedPaths);
      return;
    }
    const svgContent = svgRef.current.outerHTML;
    const encoded = encodeURIComponent(svgContent);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
    onVectorChange(updatedPaths, dataUrl);
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
    const { nextPaths, changed } = erasePathsAtPoint(paths, pt, radius, activeLayerId, fallbackLayerId);
    if (changed) {
      hasErasedInCurrentStrokeRef.current = true;
      setPaths(nextPaths);
      notifyChange(nextPaths);
    }
  };

  // Whole-stroke drag eraser execution (partagé)
  const applyStrokeEraser = (pt: VectorPoint, radius = 8) => {
    const { nextPaths, changed } = eraseWholeStrokesAtPoint(paths, pt, radius, activeLayerId, fallbackLayerId);
    if (changed) {
      hasErasedInCurrentStrokeRef.current = true;
      setSelectedPathIds((prev) => prev.filter((id) => nextPaths.some((p) => p.id === id)));
      setPaths(nextPaths);
      notifyChange(nextPaths);
    }
  };

  // --- MOUSE / POINTER / TOUCH HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const pt = getSVGCoordinates(e);

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
      const result = applyBucketFill(pt.x, pt.y, paths, activeColor, activeLayerId);
      if (result) {
        if (result.type === 'update_path') {
          const updated = paths.map((p) =>
            p.id === result.pathId ? { ...result.updatedPath, fillColorId: activeColorId } : p
          );
          updatePathsWithHistory(updated);
        } else if (result.type === 'new_path') {
          // Insérer le remplissage en arrière-plan sous les contours existants
          const updated = [{ ...result.newPath, fillColorId: activeColorId }, ...paths];
          updatePathsWithHistory(updated);
        }
      }
      return;
    }

    if (tool === 'eraser_partial') {
      setIsErasingPartial(true);
      applyPartialEraser(pt);
      return;
    }

    if (tool === 'eraser_stroke') {
      setIsErasingStroke(true);
      applyStrokeEraser(pt);
      return;
    }

    if (tool === 'pencil' || tool === 'lasso_fill') {
      setIsDrawing(true);
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

        const updated = paths.map((p) =>
          selectedPathIds.includes(p.id) ? translatePath(p, dx, dy) : p
        );
        setPaths(updated);
        setDragStartMouse(pt);
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
        const updated = paths.map((p) =>
          p.id === primarySelectedPath.id ? resizeShapeToRect(p, newRect) : p
        );
        setPaths(updated);
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

      setCurrentPoints((prev) => {
        const pts = [...prev];
        for (const newPt of ptsToAdd) {
          const last = pts[pts.length - 1];
          if (!last || Math.hypot(newPt.x - last.x, newPt.y - last.y) >= 0.7) {
            pts.push(newPt);
          }
        }
        return pts;
      });
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

    if (isDraggingHotspot) {
      setIsDraggingHotspot(false);
      if (onHotspotChange) onHotspotChange(hotspot);
    }

    if (isErasingPartial || isErasingStroke) {
      setIsErasingPartial(false);
      setIsErasingStroke(false);
      if (hasErasedInCurrentStrokeRef.current) {
        pushHistoryState(paths);
        hasErasedInCurrentStrokeRef.current = false;
      }
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
      pushHistoryState(paths);
      notifyChange(paths);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'pencil' && currentPoints.length > 0) {
      const d = pointsToSmoothPath(currentPoints, false);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor === 'none' ? '#000000' : strokeColor,
        strokeColorId: strokeColor === 'none' ? undefined : selectedStrokePaletteId || undefined,
        strokeWidth,
        fill: 'none',
        type: 'freehand',
        points: currentPoints,
        layerId: activeLayerId,
      };
      const updated = [...paths, newPath];
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
        updatePathsWithHistory([...paths, newPath]);
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
        const updated = [...paths, newPath];
        setSelectedPathIds([newPath.id]);
        updatePathsWithHistory(updated);
      }
    } else if (tool === 'lasso_fill' && currentPoints.length > 1) {
      const d = pointsToSmoothPath(currentPoints, true);
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
        points: currentPoints,
        layerId: activeLayerId,
      };
      const updated = [...paths, newPath];
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
      const updated = [...paths, newPath];
      setSelectedPathIds([newPath.id]);
      setTool('select');
      updatePathsWithHistory(updated);
    }

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
    const updated = [...paths, newPath];
    setActivePolylinePoints([]);
    setSelectedPathIds([newPath.id]);
    setTool('select');
    updatePathsWithHistory(updated);
  };

  const handleShapeClick = (p: VectorPath, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
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
        const result = applyBucketFill(clickX, clickY, paths, activeColor, activeLayerId);
        if (result) {
          if (result.type === 'update_path') {
            const updated = paths.map((item) =>
              item.id === result.pathId ? { ...result.updatedPath, fillColorId: activeColorId } : item
            );
            updatePathsWithHistory(updated);
          } else if (result.type === 'new_path') {
            const updated = [{ ...result.newPath, fillColorId: activeColorId }, ...paths];
            updatePathsWithHistory(updated);
          }
        } else {
          // Si on clique sur une forme et qu'aucune cavité séparée n'est trouvée, colorer directement la forme
          const closedD = p.d.trim().endsWith('Z') ? p.d : `${p.d} Z`;
          const updated = paths.map((item) =>
            item.id === p.id ? { ...item, fill: activeColor, fillColorId: activeColorId, d: closedD } : item
          );
          updatePathsWithHistory(updated);
        }
      }
      return;
    }
    if (tool === 'eraser_stroke') {
      const updated = paths.filter((item) => item.id !== p.id);
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
    const updated = paths.map((p) => {
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

    paths.forEach((p) => {
      if (!selectedPathIds.includes(p.id)) return;
      const newId = `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newSelectedIds.push(newId);
      duplicatedPaths.push({ ...translatePath(p, 10, 10), id: newId });
    });

    const updated = [...paths, ...duplicatedPaths];
    setSelectedPathIds(newSelectedIds);
    updatePathsWithHistory(updated);
  };

  const handleDeleteSelected = () => {
    if (selectedPathIds.length === 0) return;
    const updated = paths.filter((p) => !selectedPathIds.includes(p.id));
    setSelectedPathIds([]);
    updatePathsWithHistory(updated);
  };

  const handleClear = () => {
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
    const updated = [...paths, ...newPaths];
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
        <div className="w-full flex items-center justify-between px-3 py-1 mb-2 text-xs text-slate-500 font-medium select-none flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {currentEditingStateName && (
              <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                État en cours : <strong className="text-indigo-600 font-mono">{currentEditingStateName}</strong>
              </span>
            )}
            {tool === 'line' && (
              <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Ligne Droite (Glissez d'un point à l'autre)
              </span>
            )}
            {tool === 'circle' && (
              <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Cercle (Glissez pour tracer)
              </span>
            )}
            {tool === 'polyline' && activePolylinePoints.length > 0 && (
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] animate-pulse">
                Polyligne : {activePolylinePoints.length} pts (double-clic pour terminer)
              </span>
            )}
            {tool === 'lasso_fill' && (
              <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Lasso Plein (Fill)
              </span>
            )}
            {tool === 'bucket' && (
              <span className="bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Pot de Peinture : Cliquez sur une forme ou son intérieur
              </span>
            )}
            {tool === 'eraser_partial' && (
              <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Gomme Précise (Efface les bouts de traits)
              </span>
            )}
            {tool === 'eraser_stroke' && (
              <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Gomme Trait (Efface la forme entière)
              </span>
            )}
            {tool === 'select' && selectedPathIds.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                {selectedPathIds.length > 1
                  ? `${selectedPathIds.length} formes sélectionnées`
                  : '1 forme sélectionnée'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Annuler / Rétablir toujours accessibles en haut (masqués uniquement si déjà portés par la barre haute de la modale) */}
            {!hideTopHistoryButtons && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={historyIndexRef.current <= 0}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Annuler (Cmd/Ctrl+Z)"
                >
                  <Undo2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Annuler</span>
                </button>
                <button
                  type="button"
                  onClick={handleRedo}
                  disabled={historyIndexRef.current >= historyRef.current.length - 1}
                  className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                  title="Rétablir (Cmd/Ctrl+Shift+Z)"
                >
                  <Redo2 className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Rétablir</span>
                </button>
              </div>
            )}

            {/* Guide & Hotspot Quick Toggles */}
            {(activeReferenceGuide || isCursorMode) && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                {activeReferenceGuide && (
                  <button
                    type="button"
                    onClick={() => setGuideOpacity(guideOpacity > 0 ? 0 : 0.45)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      guideOpacity > 0
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title="Afficher/Masquer le dessin repère (calque modèle)"
                  >
                    <Target className="w-3 h-3" />
                    <span>Modèle {guideOpacity > 0 ? 'On' : 'Off'}</span>
                  </button>
                )}

                {isCursorMode && (
                  <button
                    type="button"
                    onClick={() => setShowHotspot(!showHotspot)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      showHotspot
                        ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title="Afficher/Masquer le point d'impact réel du curseur"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Impact ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})</span>
                  </button>
                )}
              </div>
            )}

            {/* Grille & Magnétisme Toggles */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  showGrid
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Afficher/Masquer la grille de repère"
              >
                <Grid className="w-3 h-3" />
                <span>Grille {showGrid ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  snapToGrid
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Activer/Désactiver l'aimant Snap to Grid"
              >
                <Magnet className="w-3 h-3" />
                <span>Snap {snapToGrid ? 'On' : 'Off'}</span>
              </button>
            </div>

            {tool === 'polyline' && activePolylinePoints.length >= 2 && (
              <button
                type="button"
                onClick={() => finishPolyline(false)}
                className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" /> Valider
              </button>
            )}
            <span className="bg-white text-slate-600 font-bold px-2.5 py-0.5 rounded-full font-mono border border-slate-200 shadow-2xs text-[11px]">
              {paths.length} {paths.length > 1 ? 'formes' : 'forme'}
            </span>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="flex-1 w-full flex items-center justify-center relative">
          <svg
            ref={svgRef}
            viewBox="0 0 200 200"
            className={`w-full h-full max-w-[500px] max-h-[500px] aspect-square bg-white rounded-3xl touch-none select-none border border-slate-300 shadow-md ${
              tool === 'eraser_stroke' || tool === 'eraser_partial'
                ? 'cursor-none'
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
              handlePointerUp();
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
            {showColliderPreview && (() => {
              const isInheritedShared = isSharedColliderEntity && !isReferenceStateForSharedCollider && !overrideCollider;
              const isManualEditable = colliderMode === 'manual' && !isInheritedShared;
              const startColliderDrag = (
                action: NonNullable<typeof colliderDragAction>,
                e: React.PointerEvent<SVGElement>
              ) => {
                e.stopPropagation();
                try {
                  (e.target as Element).setPointerCapture?.(e.pointerId);
                } catch (_) {}
                setColliderDragAction(action);
                colliderDragOriginRef.current = {
                  mouse: getSVGCoordinates(e),
                  initial: { ...manualCollider },
                };
              };

              if (colliderMode === 'manual' && !isInheritedShared) {
                if (colliderType === 'circle') {
                  const cx = manualCollider.centerX;
                  const cy = manualCollider.centerY;
                  const r = manualCollider.radius;
                  return (
                    <g className="select-none">
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill={isColliderBodyDraggable ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.05)'}
                        stroke="#10b981"
                        strokeWidth="1.8"
                        strokeDasharray="4 3"
                        className={isColliderBodyDraggable ? 'cursor-move' : undefined}
                        style={{ pointerEvents: isColliderBodyDraggable ? 'auto' : 'none' }}
                        onPointerDown={(e) => isColliderBodyDraggable && startColliderDrag('move_circle', e)}
                      />
                      {/* Anneau de bordure cliquable pour déplacer le cercle à tout moment */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        fill="none"
                        stroke="transparent"
                        strokeWidth="8"
                        className="cursor-move"
                        style={{ pointerEvents: 'stroke' }}
                        onPointerDown={(e) => startColliderDrag('move_circle', e)}
                      />
                      {/* Poignée centrale de déplacement */}
                      <circle
                        cx={cx}
                        cy={cy}
                        r="4.5"
                        fill="#10b981"
                        stroke="#ffffff"
                        strokeWidth="1.5"
                        className="cursor-move"
                        style={{ pointerEvents: isManualEditable ? 'auto' : 'none' }}
                        onPointerDown={(e) => startColliderDrag('move_circle', e)}
                      />
                      {/* Poignée droite de rayon */}
                      <circle
                        cx={Math.min(196, cx + r)}
                        cy={cy}
                        r="5"
                        fill="#ffffff"
                        stroke="#059669"
                        strokeWidth="2"
                        className="cursor-ew-resize"
                        style={{ pointerEvents: 'auto' }}
                        onPointerDown={(e) => startColliderDrag('resize_circle_r', e)}
                      />
                    </g>
                  );
                }

                // Manuel Rectangle (Box)
                const bx = manualCollider.x;
                const by = manualCollider.y;
                const bw = manualCollider.width;
                const bh = manualCollider.height;
                return (
                  <g className="select-none">
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={bh}
                      fill={isColliderBodyDraggable ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.05)'}
                      stroke="#10b981"
                      strokeWidth="1.8"
                      strokeDasharray="4 3"
                      rx="3"
                      className={isColliderBodyDraggable ? 'cursor-move' : undefined}
                      style={{ pointerEvents: isColliderBodyDraggable ? 'auto' : 'none' }}
                      onPointerDown={(e) => isColliderBodyDraggable && startColliderDrag('move_box', e)}
                    />
                    {/* Contour transparent saisissable pour déplacer le rectangle */}
                    <rect
                      x={bx}
                      y={by}
                      width={bw}
                      height={bh}
                      fill="none"
                      stroke="transparent"
                      strokeWidth="8"
                      className="cursor-move"
                      style={{ pointerEvents: 'stroke' }}
                      onPointerDown={(e) => startColliderDrag('move_box', e)}
                    />
                    {/* 4 Poignées d'angle pour redimensionner */}
                    <rect
                      x={bx - 4}
                      y={by - 4}
                      width="8"
                      height="8"
                      rx="2"
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(e) => startColliderDrag('resize_nw', e)}
                    />
                    <rect
                      x={bx + bw - 4}
                      y={by - 4}
                      width="8"
                      height="8"
                      rx="2"
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(e) => startColliderDrag('resize_ne', e)}
                    />
                    <rect
                      x={bx + bw - 4}
                      y={by + bh - 4}
                      width="8"
                      height="8"
                      rx="2"
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(e) => startColliderDrag('resize_se', e)}
                    />
                    <rect
                      x={bx - 4}
                      y={by + bh - 4}
                      width="8"
                      height="8"
                      rx="2"
                      fill="#ffffff"
                      stroke="#059669"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      style={{ pointerEvents: 'auto' }}
                      onPointerDown={(e) => startColliderDrag('resize_sw', e)}
                    />
                  </g>
                );
              }

              return (
                <g className={`pointer-events-none select-none ${isInheritedShared ? 'opacity-45' : 'opacity-80'}`}>
                  {colliderType === 'circle' && (
                    <circle
                      cx={overallBounds.x + overallBounds.width / 2}
                      cy={overallBounds.y + overallBounds.height / 2}
                      r={Math.max(overallBounds.width, overallBounds.height) / 2}
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                    />
                  )}
                  {colliderType === 'box' && (
                    <rect
                      x={overallBounds.x}
                      y={overallBounds.y}
                      width={overallBounds.width}
                      height={overallBounds.height}
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="4 3"
                      rx="4"
                    />
                  )}
                  {colliderType === 'polygon' && (
                    <rect
                      x={overallBounds.x}
                      y={overallBounds.y}
                      width={overallBounds.width}
                      height={overallBounds.height}
                      fill="rgba(16, 185, 129, 0.05)"
                      stroke="#10b981"
                      strokeWidth="1.5"
                      strokeDasharray="3 3"
                    />
                  )}
                </g>
              );
            })()}

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
                    const isSelected = selectedPathIds.includes(p.id);
                    const isSelectMode = tool === 'select' && !layer.locked;
                    const isEraserStroke = tool === 'eraser_stroke' && !layer.locked;
                    return (
                      <path
                        key={p.id}
                        d={p.d}
                        stroke={isSelected ? '#6366f1' : p.stroke}
                        strokeWidth={isSelected ? p.strokeWidth + 1 : p.strokeWidth}
                        fill={p.fill || 'none'}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{
                          pointerEvents: isSelectMode || isEraserStroke ? 'auto' : 'none',
                        }}
                        className={`transition-all ${
                          isEraserStroke
                            ? 'hover:stroke-rose-500 hover:opacity-40 cursor-pointer'
                            : isSelectMode
                            ? isSelected
                              ? 'cursor-move filter drop-shadow-xs'
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

            {/* Figma-Style Multi-Bounding Box & Transformation Handles */}
            {tool === 'select' && selectedBounds && selectedPathIds.length > 0 && (
              <g className="select-none">
                <rect
                  x={selectedBounds.x}
                  y={selectedBounds.y}
                  width={selectedBounds.width}
                  height={selectedBounds.height}
                  fill="rgba(99,102,241,0.04)"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    try {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    } catch (_) {}
                    setIsDraggingShape(true);
                    setDragStartMouse(getSVGCoordinates(e));
                  }}
                />

                {/* Show corner resize handles if single rect or circle is selected */}
                {selectedPathIds.length === 1 && (primarySelectedPath?.rect || primarySelectedPath?.circle) && (
                  <>
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('nw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('ne');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('se');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
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
          </svg>
        </div>
      </div>

      {/* Barre d'outils vectorielle latérale (Outils, Colliders, Inspecteur, Palette Stroke & Fill) */}
      <div className="w-full lg:w-84 bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-3xl flex flex-col justify-between gap-3 shrink-0 shadow-2xs overflow-y-auto max-h-full">
        <div className="space-y-3.5">
          {/* Choix d'outil unifié (10 outils) */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Outils de dessin
            </span>
            <div className="grid grid-cols-5 gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
              {/* Pointeur / Sélection */}
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'select'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Sélection, déplacement & redimensionnement"
              >
                <MousePointer className="w-3.5 h-3.5" />
                <span className="text-[9px]">Sélect</span>
              </button>

              {/* Crayon libre */}
              <button
                type="button"
                onClick={() => {
                  setTool('pencil');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'pencil'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Crayon / Dessin libre"
              >
                <Pencil className="w-3.5 h-3.5" />
                <span className="text-[9px]">Crayon</span>
              </button>

              {/* Ligne droite */}
              <button
                type="button"
                onClick={() => {
                  setTool('line');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'line'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Ligne droite (2 points)"
              >
                <Slash className="w-3.5 h-3.5" />
                <span className="text-[9px]">Ligne</span>
              </button>

              {/* Polyligne */}
              <button
                type="button"
                onClick={() => {
                  setTool('polyline');
                  setSelectedPathIds([]);
                  setActivePolylinePoints([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'polyline'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Polyligne (cliquez point par point)"
              >
                <GitCommit className="w-3.5 h-3.5" />
                <span className="text-[9px]">Poly</span>
              </button>

              {/* Rectangle arrondi */}
              <button
                type="button"
                onClick={() => {
                  setTool('rectangle');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'rectangle'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Rectangle (arrondi réglable)"
              >
                <Square className="w-3.5 h-3.5" />
                <span className="text-[9px]">Rect</span>
              </button>

              {/* Cercle */}
              <button
                type="button"
                onClick={() => {
                  setTool('circle');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'circle'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Cercle"
              >
                <Circle className="w-3.5 h-3.5" />
                <span className="text-[9px]">Cercle</span>
              </button>

              {/* Lasso Fill */}
              <button
                type="button"
                onClick={() => {
                  setTool('lasso_fill');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'lasso_fill'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Lasso / Pinceau plein (Remplissage fermé)"
              >
                <Lasso className="w-3.5 h-3.5" />
                <span className="text-[9px]">Lasso</span>
              </button>

              {/* Pot de peinture */}
              <button
                type="button"
                onClick={() => {
                  setTool('bucket');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'bucket'
                    ? 'bg-teal-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pot de peinture (Remplir une forme ou zone fermée)"
              >
                <PaintBucket className="w-3.5 h-3.5" />
                <span className="text-[9px]">Pot</span>
              </button>

              {/* Gomme Précise */}
              <button
                type="button"
                onClick={() => {
                  setTool('eraser_partial');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'eraser_partial'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme Précise (Efface les bouts de traits)"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span className="text-[9px]">Gomme</span>
              </button>

              {/* Gomme Trait entier */}
              <button
                type="button"
                onClick={() => {
                  setTool('eraser_stroke');
                  setSelectedPathIds([]);
                }}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'eraser_stroke'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme Trait (Efface la forme entière)"
              >
                <Scissors className="w-3.5 h-3.5" />
                <span className="text-[9px]">Objet</span>
              </button>

              {/* Point d'Impact Hotspot (Curseur) */}
              {(isCursorMode || referenceGuide || initialHotspot) && (
                <button
                  type="button"
                  onClick={() => {
                    setTool('hotspot');
                    setSelectedPathIds([]);
                  }}
                  className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                    tool === 'hotspot'
                      ? 'bg-rose-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Définir le point d'impact réel du curseur (Hotspot)"
                >
                  <Crosshair className="w-3.5 h-3.5 text-rose-500" />
                  <span className="text-[9px]">Impact</span>
                </button>
              )}
            </div>
          </div>

          {/* Section Calques de dessin */}
          <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span className="text-xs font-bold text-slate-800">Calques</span>
                <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded-full border border-indigo-200">
                  {layers.length}
                </span>
              </div>
              <button
                type="button"
                onClick={handleAddLayer}
                className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
                title="Ajouter un nouveau calque au premier plan"
              >
                <Plus className="w-3 h-3" /> Nouveau
              </button>
            </div>

            {/* Liste des calques ordonnée de haut en bas */}
            <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
              {layers.map((layer, index) => {
                const isActive = layer.id === activeLayerId;
                const layerPathCount = paths.filter(
                  (p) => (p.layerId || layers[layers.length - 1]?.id || 'layer-1') === layer.id
                ).length;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setActiveLayerId(layer.id)}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                      isActive
                        ? 'bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-400/40 text-indigo-950 font-semibold'
                        : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {/* Pastille calque actif */}
                      <div
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          isActive ? 'bg-indigo-600' : 'bg-slate-300'
                        }`}
                      />

                      {/* Nom du calque */}
                      {editingLayerId === layer.id ? (
                        <input
                          type="text"
                          value={editingLayerName}
                          onChange={(e) => setEditingLayerName(e.target.value)}
                          onBlur={() => {
                            if (editingLayerName.trim()) {
                              handleRenameLayer(layer.id, editingLayerName.trim());
                            }
                            setEditingLayerId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              if (editingLayerName.trim()) {
                                handleRenameLayer(layer.id, editingLayerName.trim());
                              }
                              setEditingLayerId(null);
                            } else if (e.key === 'Escape') {
                              setEditingLayerId(null);
                            }
                          }}
                          autoFocus
                          className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-indigo-400 rounded-md outline-none w-24"
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <span
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            setEditingLayerId(layer.id);
                            setEditingLayerName(layer.name);
                          }}
                          className="text-[11px] truncate flex-1 select-none"
                          title="Double-cliquer pour renommer"
                        >
                          {layer.name}
                          <span className="text-[9px] text-slate-400 font-normal ml-1">
                            ({layerPathCount})
                          </span>
                        </span>
                      )}
                    </div>

                    {/* Actions sur le calque */}
                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      {/* Visibilité (Œil) */}
                      <button
                        type="button"
                        onClick={() => handleToggleLayerVisibility(layer.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          layer.visible
                            ? 'text-slate-600 hover:text-indigo-600 hover:bg-white'
                            : 'text-slate-400 bg-slate-200/60'
                        }`}
                        title={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                      >
                        {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      </button>

                      {/* Verrouillage (Cadenas) */}
                      <button
                        type="button"
                        onClick={() => handleToggleLayerLock(layer.id)}
                        className={`p-1 rounded-md transition-colors cursor-pointer ${
                          layer.locked
                            ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                            : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                        }`}
                        title={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
                      >
                        {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </button>

                      {/* Monter */}
                      <button
                        type="button"
                        disabled={index === 0}
                        onClick={() => handleMoveLayer(layer.id, 'up')}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-20 rounded-md transition-colors cursor-pointer"
                        title="Monter le calque (Premier plan)"
                      >
                        <ChevronUp className="w-3 h-3" />
                      </button>

                      {/* Descendre */}
                      <button
                        type="button"
                        disabled={index === layers.length - 1}
                        onClick={() => handleMoveLayer(layer.id, 'down')}
                        className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-20 rounded-md transition-colors cursor-pointer"
                        title="Descendre le calque (Arrière plan)"
                      >
                        <ChevronDown className="w-3 h-3" />
                      </button>

                      {/* Supprimer */}
                      {layers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteLayer(layer.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                          title="Supprimer le calque"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Curseur d'opacité du calque actif */}
            {activeLayer && (
              <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
                <span className="shrink-0 font-medium">Opacité :</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={activeLayer.opacity ?? 1}
                  onChange={(e) => handleLayerOpacityChange(activeLayer.id, parseFloat(e.target.value))}
                  className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
                />
                <span className="w-8 text-right font-mono font-bold text-slate-700">
                  {Math.round((activeLayer.opacity ?? 1) * 100)}%
                </span>
              </div>
            )}
          </div>

          {/* Section Définition des Colliders (Automatique ou Manuel + Partage / Surcharge) */}
          <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" /> Collider
              </span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowColliderPreview(!showColliderPreview)}
                  className={`p-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
                    showColliderPreview
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-400 border-slate-200'
                  }`}
                  title={showColliderPreview ? 'Masquer la zone collider' : 'Afficher la zone collider'}
                >
                  {showColliderPreview ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>
                <button
                  type="button"
                  onClick={handleAutoDetectCollider}
                  className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                  title="Calculer/détecter automatiquement d'après le dessin"
                >
                  <Sparkles className="w-3 h-3 text-emerald-600" /> Auto-dessin
                </button>
              </div>
            </div>

            {/* Statut Partagé / Surcharge d'état */}
            {isSharedColliderEntity && (
              <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
                {isReferenceStateForSharedCollider ? (
                  <div className="text-[10px] font-bold text-indigo-800 leading-snug">
                    🔗 État de référence du collider partagé : toute modification ici s'applique aux états qui n'ont pas de surcharge.
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] font-bold text-indigo-900 leading-tight">
                      {overrideCollider
                        ? '✏️ Surcharge active pour cet état'
                        : '🔗 Hérite du collider partagé'}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleOverrideCollider(!overrideCollider)}
                      className={`px-2 py-0.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all shrink-0 ${
                        overrideCollider
                          ? 'bg-indigo-600 text-white border-indigo-700'
                          : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                      }`}
                    >
                      {overrideCollider ? 'Surchargé ✓' : 'Surcharger'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Sélecteur Mode Auto vs Manuel (masqué uniquement si héritage strict sans surcharge) */}
            {!(isSharedColliderEntity && !isReferenceStateForSharedCollider && !overrideCollider) && (
              <>
                <div className="grid grid-cols-2 p-0.5 bg-slate-100 rounded-xl gap-1">
                  <button
                    type="button"
                    onClick={() => handleSwitchColliderMode('auto')}
                    className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      colliderMode === 'auto'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Automatique
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchColliderMode('manual')}
                    className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                      colliderMode === 'manual'
                        ? 'bg-white text-emerald-700 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Manuel (Sur mesure)
                  </button>
                </div>

                {/* Forme du Collider */}
                <div className={`grid ${colliderMode === 'manual' ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
                  <button
                    type="button"
                    onClick={() => handleColliderTypeSelect('box')}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      colliderType === 'box'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Collider Rectangle"
                  >
                    <Square className="w-3 h-3" /> Rectangle
                  </button>
                  <button
                    type="button"
                    onClick={() => handleColliderTypeSelect('circle')}
                    className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                      colliderType === 'circle'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Collider Cercle"
                  >
                    <Circle className="w-3 h-3" /> Cercle
                  </button>
                  {colliderMode === 'auto' && (
                    <button
                      type="button"
                      onClick={() => handleColliderTypeSelect('polygon')}
                      className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                        colliderType === 'polygon'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                          : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                      }`}
                      title="Collider Polyligne / Polygone"
                    >
                      <Shapes className="w-3 h-3" /> Polyligne
                    </button>
                  )}
                </div>

                {/* Réglages précis en mode Manuel */}
                {colliderMode === 'manual' && (
                  <div className="p-2 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2">
                    <div className="flex items-center justify-between gap-1.5">
                      <button
                        type="button"
                        onClick={() => setIsColliderBodyDraggable(!isColliderBodyDraggable)}
                        className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                          isColliderBodyDraggable
                            ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                            : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                        title="Permet de saisir l'intérieur de la forme verte pour la déplacer (désactivez pour dessiner dedans)"
                      >
                        {isColliderBodyDraggable ? '✋ Déplacement actif' : '✋ Déplacer la zone'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleInitManualFromDrawing()}
                        className="py-1 px-2 rounded-lg text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                        title="Recaler sur les bords exacts du dessin"
                      >
                        Caler
                      </button>
                    </div>

                    {colliderType === 'circle' ? (
                      <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Centre X</span>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={Math.round(manualCollider.centerX)}
                            onChange={(e) => {
                              const cx = Math.max(0, Math.min(200, Number(e.target.value) || 0));
                              const next = { ...manualCollider, centerX: cx, x: cx - manualCollider.radius };
                              setManualCollider(next);
                              emitColliderUpdate('circle', 'manual', next);
                            }}
                            className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Centre Y</span>
                          <input
                            type="number"
                            min={0}
                            max={200}
                            value={Math.round(manualCollider.centerY)}
                            onChange={(e) => {
                              const cy = Math.max(0, Math.min(200, Number(e.target.value) || 0));
                              const next = { ...manualCollider, centerY: cy, y: cy - manualCollider.radius };
                              setManualCollider(next);
                              emitColliderUpdate('circle', 'manual', next);
                            }}
                            className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Rayon</span>
                          <input
                            type="number"
                            min={6}
                            max={130}
                            value={Math.round(manualCollider.radius)}
                            onChange={(e) => {
                              const r = Math.max(6, Math.min(130, Number(e.target.value) || 10));
                              const next = {
                                ...manualCollider,
                                radius: r,
                                width: r * 2,
                                height: r * 2,
                                x: manualCollider.centerX - r,
                                y: manualCollider.centerY - r,
                              };
                              setManualCollider(next);
                              emitColliderUpdate('circle', 'manual', next);
                            }}
                            className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                      </div>
                    ) : (
                      <div className="grid grid-cols-4 gap-1 text-[10px]">
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">X</span>
                          <input
                            type="number"
                            min={0}
                            max={190}
                            value={Math.round(manualCollider.x)}
                            onChange={(e) => {
                              const nx = Math.max(0, Math.min(190, Number(e.target.value) || 0));
                              const next = { ...manualCollider, x: nx, centerX: nx + manualCollider.width / 2 };
                              setManualCollider(next);
                              emitColliderUpdate('box', 'manual', next);
                            }}
                            className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Y</span>
                          <input
                            type="number"
                            min={0}
                            max={190}
                            value={Math.round(manualCollider.y)}
                            onChange={(e) => {
                              const ny = Math.max(0, Math.min(190, Number(e.target.value) || 0));
                              const next = { ...manualCollider, y: ny, centerY: ny + manualCollider.height / 2 };
                              setManualCollider(next);
                              emitColliderUpdate('box', 'manual', next);
                            }}
                            className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Larg.</span>
                          <input
                            type="number"
                            min={10}
                            max={200}
                            value={Math.round(manualCollider.width)}
                            onChange={(e) => {
                              const nw = Math.max(10, Math.min(200, Number(e.target.value) || 10));
                              const next = { ...manualCollider, width: nw, centerX: manualCollider.x + nw / 2 };
                              setManualCollider(next);
                              emitColliderUpdate('box', 'manual', next);
                            }}
                            className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                        <label className="space-y-0.5">
                          <span className="font-bold text-slate-500 block">Haut.</span>
                          <input
                            type="number"
                            min={10}
                            max={200}
                            value={Math.round(manualCollider.height)}
                            onChange={(e) => {
                              const nh = Math.max(10, Math.min(200, Number(e.target.value) || 10));
                              const next = { ...manualCollider, height: nh, centerY: manualCollider.y + nh / 2 };
                              setManualCollider(next);
                              emitColliderUpdate('box', 'manual', next);
                            }}
                            className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                          />
                        </label>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Inspecteur des formes sélectionnées */}
          {tool === 'select' && selectedPathIds.length > 0 && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  {selectedPathIds.length > 1
                    ? `${selectedPathIds.length} formes sélectionnées`
                    : '1 forme sélectionnée'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="p-1 text-indigo-600 hover:bg-indigo-200/60 rounded-lg cursor-pointer transition-colors"
                    title="Dupliquer la sélection"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                    title="Supprimer la sélection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedPathIds.length === 1 && primarySelectedPath?.rect && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-indigo-950">
                    <span>Arrondi des angles (0 = rectangle, 50 = rond)</span>
                    <span className="font-mono text-indigo-700">{cornerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={cornerRadius}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCornerRadius(val);
                      updateSelectedShapeProperties({ cornerRadius: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200 rounded-lg"
                  />
                </div>
              )}
              {/* Déplacer vers un calque */}
              <div className="flex items-center justify-between text-xs pt-1.5 border-t border-indigo-200/70">
                <span className="text-[11px] font-bold text-indigo-900 flex items-center gap-1">
                  <Layers className="w-3 h-3 text-indigo-600" /> Calque :
                </span>
                <select
                  value={primarySelectedPath?.layerId || activeLayerId}
                  onChange={(e) => handleMoveSelectedToLayer(e.target.value)}
                  className="text-[11px] font-bold bg-white border border-indigo-200 rounded-lg px-2 py-0.5 text-indigo-950 focus:outline-none cursor-pointer"
                >
                  {layers.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Double Sélecteur Couleur Simultané : Contour & Remplissage + Épaisseur rapide */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
                Palette du Projet (16 couleurs)
              </span>
              <button
                type="button"
                onClick={resetProjectPalette}
                className="text-[9px] font-bold text-slate-400 hover:text-indigo-600 cursor-pointer transition-colors"
                title="Réinitialiser les 16 couleurs par défaut de la palette du projet"
              >
                Réinitialiser
              </button>
            </div>

            {/* 1. CONTOUR (STROKE) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3.5 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                    style={{
                      backgroundColor: strokeColor === 'none' ? 'transparent' : strokeColor,
                      backgroundImage:
                        strokeColor === 'none'
                          ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)'
                          : undefined,
                      backgroundSize: strokeColor === 'none' ? '6px 6px' : undefined,
                      backgroundPosition: strokeColor === 'none' ? '0 0, 3px 3px' : undefined,
                    }}
                  />
                  <span className="text-[11px] font-bold text-slate-700">Contour</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setStrokeColor('none');
                      setSelectedStrokePaletteId(null);
                      if (selectedPathIds.length > 0) {
                        updateSelectedShapeProperties({ stroke: 'none', strokeColorId: undefined });
                      }
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${
                      strokeColor === 'none'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Sans trait
                  </button>
                  <label
                    className="w-5 h-5 rounded-md border border-slate-300 cursor-pointer relative overflow-hidden flex items-center justify-center shrink-0"
                    style={{ backgroundColor: strokeColor !== 'none' ? strokeColor : '#000000' }}
                    title="Personnaliser la couleur de contour"
                  >
                    <input
                      type="color"
                      value={strokeColor.startsWith('#') && strokeColor.length === 7 ? strokeColor : '#000000'}
                      onChange={(e) => {
                        const c = e.target.value;
                        setStrokeColor(c);
                        if (selectedStrokePaletteId) {
                          handleModifyPaletteColor(selectedStrokePaletteId, c);
                        } else if (selectedPathIds.length > 0) {
                          updateSelectedShapeProperties({ stroke: c });
                        }
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                    <Pipette className="w-2.5 h-2.5 text-white drop-shadow" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-8 gap-1">
                {projectPalette.map((palItem, idx) => {
                  const isSelected =
                    selectedStrokePaletteId === palItem.id ||
                    (!selectedStrokePaletteId &&
                      strokeColor !== 'none' &&
                      strokeColor.toLowerCase() === palItem.color.toLowerCase());
                  const validHex =
                    palItem.color.startsWith('#') && palItem.color.length === 7
                      ? palItem.color
                      : palItem.color.length === 4
                      ? `#${palItem.color[1]}${palItem.color[1]}${palItem.color[2]}${palItem.color[2]}${palItem.color[3]}${palItem.color[3]}`
                      : '#000000';
                  return (
                    <label
                      key={`stroke-${palItem.id}`}
                      className={`w-6 h-6 rounded-lg border transition-all cursor-pointer relative overflow-hidden flex items-center justify-center ${
                        isSelected
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm border-white'
                          : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: palItem.color }}
                      title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color})`}
                    >
                      <input
                        type="color"
                        value={validHex}
                        onClick={() => {
                          setSelectedStrokePaletteId(palItem.id);
                          setStrokeColor(palItem.color);
                          if (selectedPathIds.length > 0) {
                            updateSelectedShapeProperties({
                              stroke: palItem.color,
                              strokeColorId: palItem.id,
                            });
                          }
                        }}
                        onChange={(e) => {
                          const newHex = e.target.value;
                          setSelectedStrokePaletteId(palItem.id);
                          setStrokeColor(newHex);
                          handleModifyPaletteColor(palItem.id, newHex);
                          if (selectedPathIds.length > 0) {
                            updateSelectedShapeProperties({
                              stroke: newHex,
                              strokeColorId: palItem.id,
                            });
                          }
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 2. REMPLISSAGE (FILL) */}
            <div className="space-y-1.5 pt-2 border-t border-slate-100">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div
                    className="w-3.5 h-3.5 rounded-md border border-slate-300 shadow-2xs"
                    style={{
                      backgroundColor: fillColor === 'none' ? 'transparent' : fillColor,
                      backgroundImage:
                        fillColor === 'none'
                          ? 'linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%), linear-gradient(45deg, #e2e8f0 25%, transparent 25%, transparent 75%, #e2e8f0 75%)'
                          : undefined,
                      backgroundSize: fillColor === 'none' ? '6px 6px' : undefined,
                      backgroundPosition: fillColor === 'none' ? '0 0, 3px 3px' : undefined,
                    }}
                  />
                  <span className="text-[11px] font-bold text-slate-700">Remplissage</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setFillColor('none');
                      setSelectedFillPaletteId(null);
                      if (selectedPathIds.length > 0) {
                        updateSelectedShapeProperties({ fill: 'none', fillColorId: undefined });
                      }
                    }}
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${
                      fillColor === 'none'
                        ? 'bg-rose-50 text-rose-700 border-rose-300'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Transparent
                  </button>
                  <label
                    className="w-5 h-5 rounded-md border border-slate-300 cursor-pointer relative overflow-hidden flex items-center justify-center shrink-0"
                    style={{ backgroundColor: fillColor !== 'none' ? fillColor : '#ffffff' }}
                    title="Personnaliser la couleur de remplissage"
                  >
                    <input
                      type="color"
                      value={fillColor.startsWith('#') && fillColor.length === 7 ? fillColor : '#ffffff'}
                      onChange={(e) => {
                        const c = e.target.value;
                        setFillColor(c);
                        if (selectedFillPaletteId) {
                          handleModifyPaletteColor(selectedFillPaletteId, c);
                        } else if (selectedPathIds.length > 0) {
                          updateSelectedShapeProperties({ fill: c });
                        }
                      }}
                      className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                    />
                    <Pipette className="w-2.5 h-2.5 text-slate-700" />
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-8 gap-1">
                {projectPalette.map((palItem, idx) => {
                  const isSelected =
                    fillColor !== 'none' &&
                    (selectedFillPaletteId === palItem.id ||
                      (!selectedFillPaletteId &&
                        fillColor.toLowerCase() === palItem.color.toLowerCase()));
                  const validHex =
                    palItem.color.startsWith('#') && palItem.color.length === 7
                      ? palItem.color
                      : palItem.color.length === 4
                      ? `#${palItem.color[1]}${palItem.color[1]}${palItem.color[2]}${palItem.color[2]}${palItem.color[3]}${palItem.color[3]}`
                      : '#ffffff';
                  return (
                    <label
                      key={`fill-${palItem.id}`}
                      className={`w-6 h-6 rounded-lg border transition-all cursor-pointer relative overflow-hidden flex items-center justify-center ${
                        isSelected
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm border-white'
                          : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: palItem.color }}
                      title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color})`}
                    >
                      <input
                        type="color"
                        value={validHex}
                        onClick={() => {
                          setSelectedFillPaletteId(palItem.id);
                          setFillColor(palItem.color);
                          if (selectedPathIds.length > 0) {
                            updateSelectedShapeProperties({
                              fill: palItem.color,
                              fillColorId: palItem.id,
                            });
                          }
                        }}
                        onChange={(e) => {
                          const newHex = e.target.value;
                          setSelectedFillPaletteId(palItem.id);
                          setFillColor(newHex);
                          handleModifyPaletteColor(palItem.id, newHex);
                          if (selectedPathIds.length > 0) {
                            updateSelectedShapeProperties({
                              fill: newHex,
                              fillColorId: palItem.id,
                            });
                          }
                        }}
                        className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                      />
                    </label>
                  );
                })}
              </div>
            </div>

            {/* 3. ÉPAISSEUR DU TRAIT (Tailles rapides + Slider fin) */}
            <div className="pt-2 border-t border-slate-100 space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Épaisseur du trait</span>
                <span className="font-mono text-indigo-600">{strokeWidth}px</span>
              </div>
              <div className="grid grid-cols-6 gap-1">
                {[2, 4, 8, 12, 20, 32].map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => {
                      setStrokeWidth(w);
                      if (selectedPathIds.length > 0) updateSelectedShapeProperties({ strokeWidth: w });
                    }}
                    className={`py-1 text-[10px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                      strokeWidth === w
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="2"
                max="32"
                value={strokeWidth}
                onChange={(e) => {
                  const val = Number(e.target.value);
                  setStrokeWidth(val);
                  if (selectedPathIds.length > 0) updateSelectedShapeProperties({ strokeWidth: val });
                }}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
              />
            </div>
          </div>

          {/* Module Modèle Repère & Point de Contact Curseur (Hotspot) */}
          {(activeReferenceGuide || isCursorMode) && (
            <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 truncate max-w-[160px]">
                  <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {activeReferenceGuide ? `Repère : ${activeReferenceGuide.name}` : "Point d'impact"}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {activeReferenceGuide && (
                    <button
                      type="button"
                      onClick={() => setGuideOpacity(guideOpacity > 0 ? 0 : 0.45)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        guideOpacity > 0
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {guideOpacity > 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      Guide
                    </button>
                  )}
                  {isCursorMode && (
                    <button
                      type="button"
                      onClick={() => setShowHotspot(!showHotspot)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        showHotspot
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      Impact
                    </button>
                  )}
                </div>
              </div>

              {/* Sélecteur de repère si plusieurs sont disponibles */}
              {availableReferenceGuides && availableReferenceGuides.length > 1 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-900 block">
                    Choisir le repère de calque :
                  </label>
                  <select
                    value={selectedGuideId}
                    onChange={(e) => {
                      setSelectedGuideId(e.target.value);
                      if (guideOpacity === 0) setGuideOpacity(0.45);
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                  >
                    {availableReferenceGuides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.isCustom ? `🎨 ${g.name}` : `⚡ ${g.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeReferenceGuide && guideOpacity > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-indigo-200/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                    <span>Opacité du dessin repère</span>
                    <span className="font-mono">{Math.round(guideOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.9"
                    step="0.05"
                    value={guideOpacity}
                    onChange={(e) => setGuideOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200/70 rounded-lg"
                  />
                  {activeReferenceGuide.paths && activeReferenceGuide.paths.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyGuideToCanvas}
                      className="w-full py-1.5 px-2 bg-white hover:bg-indigo-100/80 text-indigo-700 text-[11px] font-bold rounded-xl border border-indigo-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
                      title="Copie le tracé du repère directement sur votre canevas pour le retoucher ou le colorer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Copier le tracé du repère dans le dessin
                    </button>
                  )}
                </div>
              )}

              {isCursorMode && showHotspot && (
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <Crosshair className="w-3.5 h-3.5 text-rose-600" />
                    Point : ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetHotspot}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Module Pelure d'Oignon (Onion Skinning) */}
          {availableOnionStates.length > 0 && (
            <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Pelure d'oignon
                </span>
                <button
                  type="button"
                  onClick={() => setOnionSkinEnabled(!onionSkinEnabled)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    onionSkinEnabled
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {onionSkinEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {onionSkinEnabled ? 'On' : 'Off'}
                </button>
              </div>

              {onionSkinEnabled && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100 animate-in fade-in duration-150">
                  <select
                    value={selectedOnionStateId}
                    onChange={(e) => setSelectedOnionStateId(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    {availableOnionStates.map((st) => (
                      <option key={st.id} value={st.id}>
                        Repère : "{st.name}"
                      </option>
                    ))}
                  </select>

                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={onionOpacity}
                    onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-100 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions : Annuler, Rétablir & Effacer */}
        <div className="flex items-center gap-1.5 pt-2 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={historyIndexRef.current <= 0}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Annuler (Ctrl+Z)"
          >
            <Undo2 className="w-3.5 h-3.5" /> Annuler
          </button>
          <button
            type="button"
            onClick={handleRedo}
            disabled={historyIndexRef.current >= historyRef.current.length - 1}
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
