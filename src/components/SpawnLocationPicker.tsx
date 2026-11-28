import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { Entity, Size, SpawnLocationMode, SpawnRandomZone, SpawnReferenceMode } from '../types';
import {
  useSceneStore,
  EMPTY_RECORD,
  EMPTY_LIST,
  DEFAULT_SCENE_BOUNDS,
} from '../store/useSceneStore';
import { clampSpawnRandomZone, getDefaultSpawnRandomZone } from '../utils/spawnHelpers';
import { EntityMiniPreview } from './EntityMiniPreview';
import { EditableNumericValue } from './shared/EditableNumericValue';
import { formatRoleLabel } from './rulebook/ruleBookTypes';
import {
  MapPin,
  Target,
  Crosshair,
  Sparkles,
  Shuffle,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Check,
  Maximize2,
  Sliders,
  Scale,
  Tag,
  Magnet,
  Rocket,
  MousePointerClick,
  Globe,
  SquareDashedMousePointer,
} from 'lucide-react';

export interface SpawnConfigData {
  spawnLocationMode: SpawnLocationMode;
  spawnInitialStateId?: string;
  spawnOffset?: { x: number; y: number };
  spawnAbsoluteCoords?: { x: number; y: number };
  spawnPosition?: { x: number; y: number };
  spawnRandomScope?: 'canvas' | 'zone';
  spawnRandomZone?: SpawnRandomZone;
  spawnSizeMode?: 'default' | 'match_target' | 'match_subject' | 'match_reference' | 'custom';
  spawnScaleMultiplier?: number;
  spawnCustomSize?: Size;
  spawnTags?: string[];
  spawnReferenceMode?: SpawnReferenceMode;
  spawnReferenceEntityId?: string;
  spawnReferenceEntityType?: string;
  spawnReferenceTag?: string;
  spawnImpulseSpeed?: number;
  spawnImpulseAngle?: number;
}

interface SpawnLocationPickerProps {
  isCollision: boolean;
  subjectEntity?: Entity;
  targetEntity?: Entity;
  spawnEntity?: Entity;
  initialMode?: SpawnLocationMode;
  initialStateId?: string;
  initialOffset?: { x: number; y: number };
  initialAbsoluteCoords?: { x: number; y: number };
  initialRandomScope?: 'canvas' | 'zone';
  initialRandomZone?: SpawnRandomZone;
  initialSizeMode?: 'default' | 'match_target' | 'match_subject' | 'match_reference' | 'custom';
  initialScaleMultiplier?: number;
  initialCustomSize?: Size;
  initialTags?: string[];
  initialReferenceMode?: SpawnReferenceMode;
  initialReferenceEntityId?: string;
  initialReferenceEntityType?: string;
  initialReferenceTag?: string;
  initialImpulseSpeed?: number;
  initialImpulseAngle?: number;
  onConfirm: (data: SpawnConfigData) => void;
  onCancel?: () => void;
}

function normalizeDeg(deg: number): number {
  let a = ((deg + 180) % 360 + 360) % 360 - 180;
  if (a === -180) a = 180;
  return Math.round(a);
}

export function SpawnLocationPicker({
  isCollision,
  subjectEntity,
  targetEntity,
  spawnEntity,
  initialMode = isCollision ? 'at_target' : 'at_subject',
  initialStateId,
  initialOffset = { x: 50, y: 0 },
  initialAbsoluteCoords = { x: 300, y: 200 },
  initialRandomScope = 'canvas',
  initialRandomZone,
  initialSizeMode = 'default',
  initialScaleMultiplier = 1,
  initialCustomSize,
  initialTags,
  initialReferenceMode,
  initialReferenceEntityId,
  initialReferenceEntityType,
  initialReferenceTag,
  initialImpulseSpeed = 0,
  initialImpulseAngle = 0,
  onConfirm,
  onCancel,
}: SpawnLocationPickerProps) {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const sceneBounds = useSceneStore((state) => state.sceneBounds || DEFAULT_SCENE_BOUNDS);
  const layerGroups = useSceneStore((state) => state.layerGroups || EMPTY_LIST);
  const entityOrder = useSceneStore((state) => state.entityOrder || EMPTY_LIST);
  const spawnCanvasPickResult = useSceneStore((state) => state.spawnCanvasPickResult);
  const startSpawnCanvasPick = useSceneStore((state) => state.startSpawnCanvasPick);
  const clearSpawnCanvasPickResult = useSceneStore((state) => state.clearSpawnCanvasPickResult);

  const inferredRefMode: SpawnReferenceMode =
    initialReferenceMode ||
    (initialMode === 'at_target' || initialMode === 'offset_target'
      ? 'target'
      : initialMode === 'at_entity' || initialMode === 'offset_entity'
      ? initialReferenceEntityId
        ? 'entity'
        : initialReferenceTag
        ? 'tag'
        : initialReferenceEntityType
        ? 'type'
        : 'last_spawned'
      : isCollision && targetEntity
      ? 'target'
      : 'subject');

  const [activeTab, setActiveTab] = useState<'location' | 'size'>('location');
  const [mode, setMode] = useState<SpawnLocationMode>(initialMode);
  const [useEventPointAnchor, setUseEventPointAnchor] = useState<boolean>(
    initialMode === 'at_event_point' || initialMode === 'offset_event_point'
  );
  const [refMode, setRefMode] = useState<SpawnReferenceMode>(inferredRefMode);
  const [refEntityId, setRefEntityId] = useState<string>(
    initialReferenceEntityId || Object.keys(entities)[0] || ''
  );
  const [refEntityType, setRefEntityType] = useState<string>(
    initialReferenceEntityType ||
      Object.keys(customArchetypes)[0] ||
      Object.values(entities)[0]?.type ||
      ''
  );
  const [refTag, setRefTag] = useState<string>(initialReferenceTag || '');

  const spawnStatesList = useMemo(() => Object.values(spawnEntity?.states || {}), [spawnEntity]);

  const [selectedStateId, setSelectedStateId] = useState<string | undefined>(
    initialStateId || spawnEntity?.currentStateId || Object.keys(spawnEntity?.states || {})[0]
  );

  useEffect(() => {
    const availableIds = Object.keys(spawnEntity?.states || {});
    if (initialStateId && availableIds.includes(initialStateId)) {
      setSelectedStateId(initialStateId);
    } else if (!selectedStateId || !availableIds.includes(selectedStateId)) {
      setSelectedStateId(spawnEntity?.currentStateId || availableIds[0]);
    }
  }, [spawnEntity?.id, initialStateId]);

  const [offset, setOffset] = useState<{ x: number; y: number }>(initialOffset);
  const [absoluteCoords, setAbsoluteCoords] = useState<{ x: number; y: number }>(
    initialAbsoluteCoords
  );
  const [randomScope, setRandomScope] = useState<'canvas' | 'zone'>(initialRandomScope);
  const [randomZone, setRandomZone] = useState<SpawnRandomZone>(() =>
    initialRandomZone
      ? clampSpawnRandomZone(initialRandomZone, sceneBounds)
      : getDefaultSpawnRandomZone(sceneBounds)
  );
  const [isDraggingZone, setIsDraggingZone] = useState<boolean>(false);
  const zoneDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const zoneCanvasRef = useRef<HTMLDivElement>(null);

  // Snap grille explicitement désactivé par défaut
  const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
  const [gridStep, setGridStep] = useState<number>(16);
  const [isDraggingAbsolute, setIsDraggingAbsolute] = useState<boolean>(false);
  const [isDraggingRelative, setIsDraggingRelative] = useState<boolean>(false);
  const [isDraggingAngleDial, setIsDraggingAngleDial] = useState<boolean>(false);

  // Impulsion initiale au spawn
  const [impulseSpeed, setImpulseSpeed] = useState<number>(Math.max(0, initialImpulseSpeed || 0));
  const [impulseAngle, setImpulseAngle] = useState<number>(normalizeDeg(initialImpulseAngle || 0));

  // Sizing states
  const [sizeMode, setSizeMode] = useState<
    'default' | 'match_target' | 'match_subject' | 'match_reference' | 'custom'
  >(initialSizeMode);
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(initialScaleMultiplier);
  const [customSize, setCustomSize] = useState<Size>(
    initialCustomSize || spawnEntity?.size || { width: 256, height: 256 }
  );
  // Tags attribués à l'instance générée
  const [tagsInput, setTagsInput] = useState<string>(
    (initialTags || spawnEntity?.tags || []).join(', ')
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const relativeBoxRef = useRef<HTMLDivElement>(null);
  const angleDialRef = useRef<SVGSVGElement>(null);
  const pendingPickRef = useRef<{
    requestId: string;
    mode: 'absolute' | 'offset' | 'random_zone';
    refCenter?: { x: number; y: number };
  } | null>(null);

  const sceneEntitiesList = useMemo(() => Object.values(entities), [entities]);

  const orderedVisibleEntities = useMemo(() => {
    const order = entityOrder.length > 0 ? entityOrder : Object.keys(entities);
    const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
    return allKeys
      .map((id) => entities[id])
      .filter((e): e is Entity => Boolean(e) && e.visible !== false);
  }, [entities, entityOrder]);

  const entityTypeOptions = useMemo(() => {
    const map = new Map<string, string>();
    Object.values(entities).forEach((e) => {
      if (!map.has(e.type)) map.set(e.type, e.name.replace(/\s+\d+$/, ''));
    });
    Object.values(customArchetypes).forEach((a) => {
      if (!map.has(a.type)) map.set(a.type, a.name);
    });
    return Array.from(map.entries()).map(([type, label]) => ({ type, label }));
  }, [entities, customArchetypes]);

  // Effective resolved entity for visual preview
  const effectiveRefEntity: Entity | undefined = useMemo(() => {
    if (refMode === 'target') return targetEntity || subjectEntity;
    if (refMode === 'subject') return subjectEntity;
    if (refMode === 'entity') return entities[refEntityId] || subjectEntity;
    if (refMode === 'type') {
      return (
        Object.values(entities).find((e) => e.type === refEntityType) ||
        customArchetypes[refEntityType] ||
        subjectEntity
      );
    }
    if (refMode === 'tag') {
      const clean = refTag.trim().toLowerCase().replace(/^#/, '');
      if (clean) {
        return Object.values(entities).find((e) => e.tags?.includes(clean)) || subjectEntity;
      }
    }
    return subjectEntity;
  }, [refMode, refEntityId, refEntityType, refTag, entities, customArchetypes, subjectEntity, targetEntity]);

  const effectiveRefLabel = useMemo(() => {
    if (useEventPointAnchor) return 'Point exact (Collision / Clic)';
    if (refMode === 'target') return targetEntity?.name ? `Cible (${targetEntity.name})` : 'Cible touchée';
    if (refMode === 'subject') return subjectEntity?.name ? `Sujet (${subjectEntity.name})` : 'Sujet actif';
    if (refMode === 'entity') {
      const found = entities[refEntityId];
      return found ? found.name : 'Entité sélectionnée';
    }
    if (refMode === 'type') {
      const opt = entityTypeOptions.find((o) => o.type === refEntityType);
      return opt ? `Type : ${opt.label}` : 'Type choisi';
    }
    if (refMode === 'tag') return refTag ? `Tag #${refTag.replace(/^#/, '')}` : 'Par Tag';
    return 'Dernier objet créé';
  }, [
    useEventPointAnchor,
    refMode,
    refEntityId,
    refEntityType,
    refTag,
    entities,
    entityTypeOptions,
    subjectEntity,
    targetEntity,
  ]);

  const isDirectMode =
    mode === 'at_subject' || mode === 'at_target' || mode === 'at_entity' || mode === 'at_event_point';
  const isOffsetMode = mode.startsWith('offset');

  const boundsW = Math.max(200, Math.round(sceneBounds.width));
  const boundsH = Math.max(150, Math.round(sceneBounds.height));

  // Consommer le résultat d'un pick direct sur la scène
  useEffect(() => {
    const pending = pendingPickRef.current;
    if (!pending || !spawnCanvasPickResult || spawnCanvasPickResult.requestId !== pending.requestId) {
      return;
    }
    if (pending.mode === 'absolute') {
      setAbsoluteCoords({ x: spawnCanvasPickResult.x, y: spawnCanvasPickResult.y });
    } else if (pending.mode === 'offset') {
      const refC = pending.refCenter || { x: Math.round(boundsW / 2), y: Math.round(boundsH / 2) };
      setOffset({
        x: Math.round(spawnCanvasPickResult.x - refC.x),
        y: Math.round(spawnCanvasPickResult.y - refC.y),
      });
    } else if (pending.mode === 'random_zone' && spawnCanvasPickResult.zone) {
      setRandomScope('zone');
      setRandomZone(clampSpawnRandomZone(spawnCanvasPickResult.zone, { width: boundsW, height: boundsH }));
    }
    pendingPickRef.current = null;
    clearSpawnCanvasPickResult(spawnCanvasPickResult.requestId);
  }, [spawnCanvasPickResult, clearSpawnCanvasPickResult, boundsW, boundsH]);

  const syncModeWithReference = (
    nextKind: 'direct' | 'offset',
    nextRefMode: SpawnReferenceMode,
    nextEventPoint: boolean = useEventPointAnchor
  ) => {
    if (nextEventPoint) {
      setMode(nextKind === 'direct' ? 'at_event_point' : 'offset_event_point');
      return;
    }
    if (nextRefMode === 'subject') {
      setMode(nextKind === 'direct' ? 'at_subject' : 'offset_subject');
    } else if (nextRefMode === 'target') {
      setMode(nextKind === 'direct' ? 'at_target' : 'offset_target');
    } else {
      setMode(nextKind === 'direct' ? 'at_entity' : 'offset_entity');
    }
  };

  const handleSelectReferenceMode = (nextRef: SpawnReferenceMode) => {
    setUseEventPointAnchor(false);
    setRefMode(nextRef);
    syncModeWithReference(isOffsetMode ? 'offset' : 'direct', nextRef, false);
  };

  const handleSelectEventPointAnchor = () => {
    setUseEventPointAnchor(true);
    setMode(isOffsetMode ? 'offset_event_point' : 'at_event_point');
  };

  // Compute calculated spawn size
  const defaultSpawnWidth = spawnEntity?.size.width || 256;
  const defaultSpawnHeight = spawnEntity?.size.height || 256;

  let calculatedSpawnWidth = defaultSpawnWidth;
  let calculatedSpawnHeight = defaultSpawnHeight;

  if (sizeMode === 'match_reference' && effectiveRefEntity) {
    calculatedSpawnWidth = Math.round(effectiveRefEntity.size.width * scaleMultiplier);
    calculatedSpawnHeight = Math.round(effectiveRefEntity.size.height * scaleMultiplier);
  } else if (sizeMode === 'match_target' && targetEntity) {
    calculatedSpawnWidth = Math.round(targetEntity.size.width * scaleMultiplier);
    calculatedSpawnHeight = Math.round(targetEntity.size.height * scaleMultiplier);
  } else if (sizeMode === 'match_subject' && subjectEntity) {
    calculatedSpawnWidth = Math.round(subjectEntity.size.width * scaleMultiplier);
    calculatedSpawnHeight = Math.round(subjectEntity.size.height * scaleMultiplier);
  } else if (sizeMode === 'custom') {
    calculatedSpawnWidth = customSize.width;
    calculatedSpawnHeight = customSize.height;
  } else {
    calculatedSpawnWidth = Math.round(defaultSpawnWidth * scaleMultiplier);
    calculatedSpawnHeight = Math.round(defaultSpawnHeight * scaleMultiplier);
  }

  // Calculate adaptive offset distance expansion
  const extraDistance = Math.max(
    0,
    (Math.max(calculatedSpawnWidth, calculatedSpawnHeight) - Math.max(defaultSpawnWidth, defaultSpawnHeight)) / 2
  );
  const offsetLength = Math.hypot(offset.x, offset.y);
  const adjustedOffsetX =
    offsetLength > 0 ? Math.round(offset.x + (offset.x / offsetLength) * extraDistance) : offset.x;
  const adjustedOffsetY =
    offsetLength > 0 ? Math.round(offset.y + (offset.y / offsetLength) * extraDistance) : offset.y;

  const quantize = useCallback(
    (val: number) => (snapToGrid && gridStep > 0 ? Math.round(val / gridStep) * gridStep : Math.round(val)),
    [snapToGrid, gridStep]
  );

  // Absolute scene pointer update (click & drag)
  const updateAbsoluteFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      const rawX = ((clientX - rect.left) / rect.width) * boundsW;
      const rawY = ((clientY - rect.top) / rect.height) * boundsH;
      const sceneX = Math.max(0, Math.min(boundsW, quantize(rawX)));
      const sceneY = Math.max(0, Math.min(boundsH, quantize(rawY)));
      setAbsoluteCoords({ x: sceneX, y: sceneY });
    },
    [boundsW, boundsH, quantize]
  );

  // Relative offset pointer update (click & drag)
  const updateRelativeFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!relativeBoxRef.current) return;
      const rect = relativeBoxRef.current.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const scaleFactor = 1.25;
      const rawDx = (clientX - rect.left - centerX) * scaleFactor;
      const rawDy = (clientY - rect.top - centerY) * scaleFactor;
      setOffset({ x: quantize(rawDx), y: quantize(rawDy) });
    },
    [quantize]
  );

  // Angle compass dial pointer update
  const updateAngleFromClient = useCallback((clientX: number, clientY: number) => {
    if (!angleDialRef.current) return;
    const rect = angleDialRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const rad = Math.atan2(clientY - cy, clientX - cx);
    setImpulseAngle(normalizeDeg((rad * 180) / Math.PI));
  }, []);

  const getZoneScenePointFromClient = useCallback(
    (clientX: number, clientY: number) => {
      if (!zoneCanvasRef.current) return null;
      const rect = zoneCanvasRef.current.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return null;
      const rawX = ((clientX - rect.left) / rect.width) * boundsW;
      const rawY = ((clientY - rect.top) / rect.height) * boundsH;
      return {
        x: Math.max(0, Math.min(boundsW, quantize(rawX))),
        y: Math.max(0, Math.min(boundsH, quantize(rawY))),
      };
    },
    [boundsW, boundsH, quantize]
  );

  const handleLaunchScenePick = (pickMode: 'absolute' | 'offset' | 'random_zone') => {
    const requestId = `spawn_pick_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const refCenter =
      pickMode === 'offset' && effectiveRefEntity && !useEventPointAnchor
        ? {
            x: Math.round(effectiveRefEntity.position.x + effectiveRefEntity.size.width / 2),
            y: Math.round(effectiveRefEntity.position.y + effectiveRefEntity.size.height / 2),
          }
        : undefined;
    pendingPickRef.current = { requestId, mode: pickMode, refCenter };
    startSpawnCanvasPick({
      requestId,
      mode: pickMode,
      snapToGrid,
      gridStep,
      refCenter,
      spawnSize: { width: calculatedSpawnWidth, height: calculatedSpawnHeight },
      ...(pickMode === 'random_zone'
        ? { initialZone: clampSpawnRandomZone(randomZone, { width: boundsW, height: boundsH }) }
        : {}),
    });
  };

  const handleApply = () => {
    const parsedTags = tagsInput
      .split(',')
      .map((t) => t.toLowerCase().trim().replace(/^#/, ''))
      .filter(Boolean);

    const cleanRefTag = refTag.toLowerCase().trim().replace(/^#/, '');

    let finalMode = mode;
    if (isDirectMode) {
      finalMode = useEventPointAnchor
        ? 'at_event_point'
        : refMode === 'subject'
        ? 'at_subject'
        : refMode === 'target'
        ? 'at_target'
        : 'at_entity';
    } else if (isOffsetMode) {
      finalMode = useEventPointAnchor
        ? 'offset_event_point'
        : refMode === 'subject'
        ? 'offset_subject'
        : refMode === 'target'
        ? 'offset_target'
        : 'offset_entity';
    }

    const clampedZone = clampSpawnRandomZone(randomZone, { width: boundsW, height: boundsH });

    onConfirm({
      spawnLocationMode: finalMode,
      spawnInitialStateId: selectedStateId,
      spawnOffset: finalMode.startsWith('offset') ? offset : undefined,
      spawnAbsoluteCoords: finalMode === 'absolute' ? absoluteCoords : undefined,
      spawnPosition: finalMode === 'absolute' ? absoluteCoords : undefined,
      spawnRandomScope: finalMode === 'random' ? randomScope : undefined,
      spawnRandomZone: finalMode === 'random' && randomScope === 'zone' ? clampedZone : undefined,
      spawnSizeMode: sizeMode,
      spawnScaleMultiplier: scaleMultiplier,
      spawnCustomSize: sizeMode === 'custom' ? customSize : undefined,
      spawnTags: parsedTags.length > 0 ? parsedTags : undefined,
      spawnReferenceMode: !useEventPointAnchor && (isDirectMode || isOffsetMode) ? refMode : undefined,
      spawnReferenceEntityId:
        !useEventPointAnchor && (isDirectMode || isOffsetMode) && refMode === 'entity' ? refEntityId : undefined,
      spawnReferenceEntityType:
        !useEventPointAnchor && (isDirectMode || isOffsetMode) && refMode === 'type' ? refEntityType : undefined,
      spawnReferenceTag:
        !useEventPointAnchor && (isDirectMode || isOffsetMode) && refMode === 'tag' ? cleanRefTag : undefined,
      spawnImpulseSpeed: impulseSpeed > 0 ? Math.round(impulseSpeed) : undefined,
      spawnImpulseAngle: impulseSpeed > 0 ? normalizeDeg(impulseAngle) : undefined,
    });
  };

  const renderGridSnapToolbar = (extraRightAction?: React.ReactNode) => (
    <div className="flex items-center justify-between flex-wrap gap-2 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
      <div className="flex items-center gap-2 flex-wrap">
        <button
          type="button"
          onClick={() => setSnapToGrid((s) => !s)}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            snapToGrid
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
          title="Activer ou désactiver l'aimantation sur la grille (désactivée par défaut)"
        >
          <Magnet className="w-3.5 h-3.5" />
          <span>Snap Grille : {snapToGrid ? 'ON' : 'OFF'}</span>
        </button>

        {snapToGrid && (
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5">
            {[10, 16, 24].map((step) => (
              <button
                key={step}
                type="button"
                onClick={() => setGridStep(step)}
                className={`px-2 py-0.5 rounded-md text-[10px] font-mono tabular-nums font-bold cursor-pointer whitespace-nowrap ${
                  gridStep === step
                    ? 'bg-indigo-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {step}px
              </button>
            ))}
          </div>
        )}
      </div>

      {extraRightAction}
    </div>
  );

  const renderReferenceSelectorCard = () => (
    <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
          <Crosshair className="w-4 h-4 text-indigo-600" />
          Objet de référence (Ancre) :
        </span>
        <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
          {effectiveRefLabel}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <button
          type="button"
          onClick={() => handleSelectReferenceMode('subject')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            !useEventPointAnchor && refMode === 'subject'
              ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          👤 Sujet ({subjectEntity?.name || 'Sujet'})
        </button>

        {isCollision && targetEntity && (
          <button
            type="button"
            onClick={() => handleSelectReferenceMode('target')}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
              !useEventPointAnchor && refMode === 'target'
                ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
            }`}
          >
            🎯 Cible ({targetEntity.name})
          </button>
        )}

        <button
          type="button"
          onClick={handleSelectEventPointAnchor}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            useEventPointAnchor
              ? 'bg-rose-600 text-white border-rose-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-rose-50'
          }`}
        >
          💥 Point exact (Collision / Clic)
        </button>

        <button
          type="button"
          onClick={() => handleSelectReferenceMode('entity')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            !useEventPointAnchor && refMode === 'entity'
              ? 'bg-cyan-600 text-white border-cyan-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          📍 Entité de la scène
        </button>

        <button
          type="button"
          onClick={() => handleSelectReferenceMode('type')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            !useEventPointAnchor && refMode === 'type'
              ? 'bg-teal-600 text-white border-teal-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          🧩 Par Type
        </button>

        <button
          type="button"
          onClick={() => handleSelectReferenceMode('tag')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            !useEventPointAnchor && refMode === 'tag'
              ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          🏷️ Par Tag (#tag)
        </button>

        <button
          type="button"
          onClick={() => handleSelectReferenceMode('last_spawned')}
          className={`px-2.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer truncate ${
            !useEventPointAnchor && refMode === 'last_spawned'
              ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
              : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
          }`}
        >
          ✨ Dernier objet créé
        </button>
      </div>

      {useEventPointAnchor && (
        <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl px-2.5 py-1.5 font-medium">
          Place l'objet au point exact du contact (collision) ou du clic/relâchement souris. Si l'événement est sans coordonnée ponctuelle (ex : timer), utilise le centre du sujet/cible.
        </div>
      )}

      {!useEventPointAnchor && refMode === 'entity' && (
        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 shrink-0">Entité référence :</span>
          <select
            value={refEntityId}
            onChange={(e) => setRefEntityId(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-cyan-500"
          >
            {sceneEntitiesList.length === 0 && <option value="">Aucune entité sur la scène</option>}
            {sceneEntitiesList.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name} ({Math.round(ent.position.x)}, {Math.round(ent.position.y)})
              </option>
            ))}
          </select>
        </div>
      )}

      {!useEventPointAnchor && refMode === 'type' && (
        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 shrink-0">Type de référence :</span>
          <select
            value={refEntityType}
            onChange={(e) => setRefEntityType(e.target.value)}
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 outline-none focus:border-teal-500"
          >
            {entityTypeOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {!useEventPointAnchor && refMode === 'tag' && (
        <div className="flex items-center justify-between gap-2 bg-white p-2 rounded-xl border border-slate-200">
          <span className="text-[11px] font-bold text-slate-600 shrink-0 flex items-center gap-1">
            <Tag className="w-3.5 h-3.5 text-purple-600" /> Tag cible :
          </span>
          <input
            type="text"
            value={refTag}
            onChange={(e) => setRefTag(e.target.value.replace(/^#/, ''))}
            placeholder="Ex: boss, tourelle, spawner..."
            className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1 text-xs font-bold text-slate-800 outline-none focus:border-purple-500"
          />
        </div>
      )}

      {!useEventPointAnchor && refMode === 'last_spawned' && (
        <div className="text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-2.5 py-1.5 font-medium">
          Utilisera automatiquement la position du dernier objet créé durant cette règle (idéal pour des créations en chaîne).
        </div>
      )}
    </div>
  );

  // Coordonnées normalisées pour la flèche d'impulsion sur le curseur
  const impulseRad = (impulseAngle * Math.PI) / 180;
  const impulseArrowTipX = Math.cos(impulseRad) * 34;
  const impulseArrowTipY = Math.sin(impulseRad) * 34;

  // Couches décor visibles pour l'aperçu temps réel de la scène
  const visibleSceneLayers = useMemo(
    () =>
      layerGroups.flatMap((g) =>
        g.layers.filter((l) => l.visible && (l.vectorPaths?.length || 0) > 0)
      ),
    [layerGroups]
  );

  return (
    <div className="space-y-4 flex flex-col h-full overflow-y-auto pr-1">
      {/* Bandeau État initial à l'apparition (toujours visible si >1 état) */}
      {spawnStatesList.length > 1 && (
        <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-2 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-black text-amber-950 flex items-center gap-1.5">
              <span>🎭 État initial à l'apparition :</span>
            </span>
            <span className="text-[11px] font-bold text-amber-800 bg-white px-2 py-0.5 rounded-lg border border-amber-200">
              {spawnEntity?.states[selectedStateId || '']?.name || 'Normal'}
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            {spawnStatesList.map((st) => {
              const isSel = selectedStateId === st.id;
              return (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setSelectedStateId(st.id)}
                  className={`px-2.5 py-1.5 rounded-xl border text-xs font-bold flex items-center gap-2 shrink-0 transition-all cursor-pointer ${
                    isSel
                      ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:border-amber-400'
                  }`}
                >
                  <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center p-0.5 shrink-0">
                    <EntityMiniPreview
                      entity={spawnEntity}
                      type={spawnEntity?.type}
                      stateId={st.id}
                      size={20}
                    />
                  </div>
                  <span className="truncate max-w-[110px]">{st.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Top Tabs: Emplacement vs Taille */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('location')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'location'
              ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>
            1. Emplacement (
            {isOffsetMode ? 'Décalé' : mode === 'absolute' ? 'Fixe' : mode === 'random' ? 'Aléatoire' : 'Direct'})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('size')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer whitespace-nowrap ${
            activeTab === 'size'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span className="tabular-nums">
            2. Taille ({calculatedSpawnWidth}×{calculatedSpawnHeight}px)
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LOCATION PICKER + LAUNCH IMPULSE */}
      {/* ========================================================================= */}
      {activeTab === 'location' && (
        <div className="space-y-4">
          {/* Category selector pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => syncModeWithReference('direct', refMode)}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                isDirectMode
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Sur un Objet</span>
            </button>

            <button
              type="button"
              onClick={() => syncModeWithReference('offset', refMode)}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                isOffsetMode
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Crosshair className="w-4 h-4 shrink-0" />
              <span>Relatif / Décalé</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('absolute')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                mode === 'absolute'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Point Fixe (Scène)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('random')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all whitespace-nowrap ${
                mode === 'random'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Shuffle className="w-4 h-4 shrink-0" />
              <span>Aléatoire</span>
            </button>
          </div>

          {/* Reference Object Picker (for Direct & Relative modes) */}
          {(isDirectMode || isOffsetMode) && renderReferenceSelectorCard()}

          {/* 1. DIRECT (AT OBJECT) */}
          {isDirectMode && (
            <div className="p-5 bg-amber-50/60 border-2 border-amber-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-amber-300 flex items-center justify-center shadow-xs">
                <EntityMiniPreview
                  entity={effectiveRefEntity}
                  type={effectiveRefEntity?.type}
                  size={52}
                />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950">
                  Apparition directe et centrée sur « {effectiveRefLabel} »
                </h4>
                <p className="text-xs text-amber-700/80 mt-1 max-w-sm">
                  Le point d'ancrage s'adapte pour que le centre du nouvel objet ({calculatedSpawnWidth}×{calculatedSpawnHeight}px) corresponde exactement au centre de l'objet de référence choisi.
                </p>
              </div>
            </div>
          )}

          {/* 2. RELATIVE OFFSET (Interactive box + optional live scene pick + snap toggle) */}
          {isOffsetMode && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-600">
                  Cliquez ou glissez pour positionner le décalage :
                </span>
                <span className="text-xs font-mono tabular-nums font-bold text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-lg border border-indigo-200">
                  ΔX: {offset.x > 0 ? `+${offset.x}` : offset.x}px | ΔY: {offset.y > 0 ? `+${offset.y}` : offset.y}px
                </span>
              </div>

              {renderGridSnapToolbar(
                effectiveRefEntity && !useEventPointAnchor ? (
                  <button
                    type="button"
                    onClick={() => handleLaunchScenePick('offset')}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
                    title="Ouvrir le canvas de scène pour cliquer exactement où doit apparaître l'objet par rapport à l'ancre"
                  >
                    <MousePointerClick className="w-3.5 h-3.5" />
                    <span>Placer sur la scène</span>
                  </button>
                ) : null
              )}

              {/* Interactive relative plane */}
              <div
                ref={relativeBoxRef}
                onPointerDown={(e) => {
                  e.currentTarget.setPointerCapture?.(e.pointerId);
                  setIsDraggingRelative(true);
                  updateRelativeFromClient(e.clientX, e.clientY);
                }}
                onPointerMove={(e) => {
                  if (isDraggingRelative) updateRelativeFromClient(e.clientX, e.clientY);
                }}
                onPointerUp={(e) => {
                  setIsDraggingRelative(false);
                  e.currentTarget.releasePointerCapture?.(e.pointerId);
                }}
                className="relative w-full h-64 sm:h-72 bg-white rounded-3xl border-2 border-slate-300 overflow-hidden cursor-crosshair select-none flex items-center justify-center shadow-inner touch-none"
                style={
                  snapToGrid
                    ? {
                        backgroundImage: `linear-gradient(to right, rgba(99,102,241,0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(99,102,241,0.14) 1px, transparent 1px)`,
                        backgroundSize: `${Math.max(8, gridStep / 1.25)}px ${Math.max(8, gridStep / 1.25)}px`,
                        backgroundPosition: 'center center',
                      }
                    : undefined
                }
              >
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-200 border-t border-dashed border-slate-300 pointer-events-none" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-200 border-l border-dashed border-slate-300 pointer-events-none" />

                {/* Center Reference Entity or Event Point Crosshair */}
                <div className="relative z-10 flex flex-col items-center pointer-events-none">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-slate-300 flex items-center justify-center p-1.5 shadow-md">
                    {useEventPointAnchor ? (
                      <div className="text-3xl">💥</div>
                    ) : (
                      <EntityMiniPreview
                        entity={effectiveRefEntity}
                        type={effectiveRefEntity?.type}
                        size={60}
                      />
                    )}
                  </div>
                  <span className="text-[10px] font-black text-slate-700 bg-white/95 border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs mt-1 max-w-[190px] truncate">
                    Ancre : {effectiveRefLabel}
                  </span>
                </div>

                {/* Distance line */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1="50%"
                    y1="50%"
                    x2={`calc(50% + ${adjustedOffsetX / 1.25}px)`}
                    y2={`calc(50% + ${adjustedOffsetY / 1.25}px)`}
                    stroke="#6366f1"
                    strokeWidth="2"
                    strokeDasharray="5 5"
                  />
                </svg>

                {/* Target Spawn Marker */}
                <div
                  className="absolute z-20 pointer-events-none flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `calc(50% + ${adjustedOffsetX / 1.25}px)`,
                    top: `calc(50% + ${adjustedOffsetY / 1.25}px)`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-16 h-16 rounded-2xl bg-indigo-500/15 border-2 border-indigo-600 shadow-lg flex items-center justify-center p-1 overflow-hidden">
                      <EntityMiniPreview
                        entity={spawnEntity}
                        type={spawnEntity?.type}
                        stateId={selectedStateId}
                        size={48}
                      />
                    </div>
                    {impulseSpeed > 0 && (
                      <svg
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible pointer-events-none"
                        width="100"
                        height="100"
                        viewBox="-50 -50 100 100"
                      >
                        <defs>
                          <marker
                            id="offset-impulse-arrow"
                            markerWidth="6"
                            markerHeight="6"
                            refX="5"
                            refY="3"
                            orient="auto"
                          >
                            <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" />
                          </marker>
                        </defs>
                        <line
                          x1="0"
                          y1="0"
                          x2={impulseArrowTipX}
                          y2={impulseArrowTipY}
                          stroke="#f97316"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          markerEnd="url(#offset-impulse-arrow)"
                        />
                      </svg>
                    )}
                  </div>
                  <span className="text-[10px] font-mono tabular-nums font-black text-indigo-950 bg-indigo-100/95 border border-indigo-300 px-2 py-0.5 rounded-full shadow-xs mt-1 whitespace-nowrap">
                    ({adjustedOffsetX}, {adjustedOffsetY}) • {calculatedSpawnWidth}×{calculatedSpawnHeight}px
                  </span>
                </div>
              </div>

              {/* Quick preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Raccourcis :</span>
                {[
                  { label: 'Au-dessus', icon: ArrowUp, x: 0, y: -60 },
                  { label: 'En-dessous', icon: ArrowDown, x: 0, y: 60 },
                  { label: 'À droite', icon: ArrowRight, x: 60, y: 0 },
                  { label: 'À gauche', icon: ArrowLeft, x: -60, y: 0 },
                  { label: 'Centre (0, 0)', icon: Target, x: 0, y: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setOffset({ x: preset.x, y: preset.y })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  >
                    <preset.icon className="w-3 h-3" />
                    <span>{preset.label}</span>
                  </button>
                ))}
              </div>

              {/* Precise Numeric Inputs */}
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Décalage Horizontal (ΔX px) :
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={offset.x}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setOffset({ ...offset, x: v });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Décalage Vertical (ΔY px) :
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={offset.y}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setOffset({ ...offset, y: v });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. ABSOLUTE CANVAS POSITION — Proportional live scene context + "Placer sur la scène" */}
          {mode === 'absolute' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-emerald-600" />
                  Aperçu Scène ({boundsW}×{boundsH}px) :
                </span>
                <span className="text-xs font-mono tabular-nums font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-lg border border-emerald-200">
                  X: {absoluteCoords.x}px | Y: {absoluteCoords.y}px
                </span>
              </div>

              {renderGridSnapToolbar(
                <button
                  type="button"
                  onClick={() => handleLaunchScenePick('absolute')}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
                  title="Basculer temporairement sur la scène réelle pour cliquer l'emplacement exact du spawn"
                >
                  <MousePointerClick className="w-3.5 h-3.5" />
                  <span>Placer sur la scène</span>
                </button>
              )}

              {/* Proportional Miniature Scene Canvas */}
              <div className="w-full bg-slate-100 rounded-2xl p-2 border border-slate-200 flex items-center justify-center">
                <div
                  ref={canvasRef}
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setIsDraggingAbsolute(true);
                    updateAbsoluteFromClient(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (isDraggingAbsolute) updateAbsoluteFromClient(e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    setIsDraggingAbsolute(false);
                    e.currentTarget.releasePointerCapture?.(e.pointerId);
                  }}
                  className="relative w-full max-h-64 bg-white rounded-xl border-2 border-emerald-500/80 overflow-hidden cursor-crosshair select-none shadow-inner touch-none"
                  style={{
                    aspectRatio: `${boundsW} / ${boundsH}`,
                  }}
                >
                  {/* Grille active uniquement si Snap Grille ON */}
                  {snapToGrid && (
                    <svg
                      viewBox={`0 0 ${boundsW} ${boundsH}`}
                      preserveAspectRatio="none"
                      className="absolute inset-0 w-full h-full pointer-events-none z-0"
                    >
                      <defs>
                        <pattern
                          id="spawn-abs-snap-grid"
                          width={gridStep}
                          height={gridStep}
                          patternUnits="userSpaceOnUse"
                        >
                          <path
                            d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                            fill="none"
                            stroke="#10b981"
                            strokeOpacity="0.22"
                            strokeWidth="1"
                          />
                        </pattern>
                      </defs>
                      <rect x="0" y="0" width={boundsW} height={boundsH} fill="url(#spawn-abs-snap-grid)" />
                    </svg>
                  )}

                  {/* Calques de décor visibles de la scène */}
                  {visibleSceneLayers.map((layer) => {
                    const isLegacy200 = layer.coordinateSpace === 'legacy_200';
                    return (
                      <svg
                        key={layer.id}
                        viewBox={isLegacy200 ? '0 0 200 200' : `0 0 ${boundsW} ${boundsH}`}
                        preserveAspectRatio="none"
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        style={{ opacity: Math.min(0.65, layer.opacity ?? 1) }}
                      >
                        {layer.vectorPaths?.map((p, idx) => (
                          <path
                            key={p.id || idx}
                            d={p.d}
                            stroke={p.stroke || '#64748b'}
                            strokeWidth={p.strokeWidth || 4}
                            fill={p.fill && p.fill !== 'none' ? p.fill : 'none'}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            transform={p.transform}
                          />
                        ))}
                      </svg>
                    );
                  })}

                  {/* Entités visibles de la scène à leur position et échelle exactes */}
                  {orderedVisibleEntities.map((ent) => {
                    const leftPct = (ent.position.x / boundsW) * 100;
                    const topPct = (ent.position.y / boundsH) * 100;
                    const wPct = (ent.size.width / boundsW) * 100;
                    const hPct = (ent.size.height / boundsH) * 100;
                    return (
                      <div
                        key={ent.id}
                        className="absolute pointer-events-none border border-slate-300/80 bg-slate-100/40 rounded-md flex items-center justify-center overflow-hidden opacity-75"
                        style={{
                          left: `${leftPct}%`,
                          top: `${topPct}%`,
                          width: `${wPct}%`,
                          height: `${hPct}%`,
                        }}
                      >
                        <EntityMiniPreview entity={ent} type={ent.type} size={28} />
                      </div>
                    );
                  })}

                  {/* Lignes de visée crosshair */}
                  <div
                    className="absolute top-0 bottom-0 w-px bg-emerald-500/45 pointer-events-none"
                    style={{
                      left: `${Math.min(100, Math.max(0, (absoluteCoords.x / boundsW) * 100))}%`,
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 h-px bg-emerald-500/45 pointer-events-none"
                    style={{
                      top: `${Math.min(100, Math.max(0, (absoluteCoords.y / boundsH) * 100))}%`,
                    }}
                  />

                  {/* Boîte proportionnelle de l'objet spawné au centre ciblé */}
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-emerald-600 bg-emerald-500/15 rounded-lg flex items-center justify-center"
                    style={{
                      left: `${Math.min(100, Math.max(0, (absoluteCoords.x / boundsW) * 100))}%`,
                      top: `${Math.min(100, Math.max(0, (absoluteCoords.y / boundsH) * 100))}%`,
                      width: `${Math.max(4, (calculatedSpawnWidth / boundsW) * 100)}%`,
                      height: `${Math.max(6, (calculatedSpawnHeight / boundsH) * 100)}%`,
                    }}
                  >
                    <EntityMiniPreview
                      entity={spawnEntity}
                      type={spawnEntity?.type}
                      stateId={selectedStateId}
                      size={24}
                    />
                  </div>

                  {/* Marqueur central + flèche d'impulsion */}
                  <div
                    className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                    style={{
                      left: `${Math.min(100, Math.max(0, (absoluteCoords.x / boundsW) * 100))}%`,
                      top: `${Math.min(100, Math.max(0, (absoluteCoords.y / boundsH) * 100))}%`,
                    }}
                  >
                    {impulseSpeed > 0 && (
                      <svg
                        className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 overflow-visible pointer-events-none"
                        width="80"
                        height="80"
                        viewBox="-40 -40 80 80"
                      >
                        <defs>
                          <marker
                            id="abs-impulse-arrow"
                            markerWidth="6"
                            markerHeight="6"
                            refX="5"
                            refY="3"
                            orient="auto"
                          >
                            <path d="M0,0 L6,3 L0,6 Z" fill="#f97316" />
                          </marker>
                        </defs>
                        <line
                          x1="0"
                          y1="0"
                          x2={impulseArrowTipX * 0.85}
                          y2={impulseArrowTipY * 0.85}
                          stroke="#f97316"
                          strokeWidth="2.25"
                          strokeLinecap="round"
                          markerEnd="url(#abs-impulse-arrow)"
                        />
                      </svg>
                    )}
                    <div className="w-3.5 h-3.5 rounded-full bg-emerald-600 border-2 border-white shadow-md" />
                    <span className="text-[10px] font-mono tabular-nums font-bold text-white bg-slate-900/90 px-1.5 py-0.5 rounded shadow-xs mt-1 whitespace-nowrap">
                      {absoluteCoords.x}, {absoluteCoords.y}
                    </span>
                  </div>
                </div>
              </div>

              {/* Coordonnées X / Y exactes + Raccourcis */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Position X (px) :
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={absoluteCoords.x}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setAbsoluteCoords({ ...absoluteCoords, x: v });
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Position Y (px) :
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={absoluteCoords.y}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setAbsoluteCoords({ ...absoluteCoords, y: v });
                      }
                    }}
                    className="w-full px-3 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Repères :</span>
                {[
                  { label: 'Centre Scène', x: Math.round(boundsW / 2), y: Math.round(boundsH / 2) },
                  { label: 'Haut-Gauche', x: Math.round(boundsW * 0.1), y: Math.round(boundsH * 0.15) },
                  { label: 'Haut-Droite', x: Math.round(boundsW * 0.9), y: Math.round(boundsH * 0.15) },
                  { label: 'Bas-Centre', x: Math.round(boundsW / 2), y: Math.round(boundsH * 0.85) },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setAbsoluteCoords({ x: p.x, y: p.y })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all cursor-pointer whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. RANDOM LOCATION (Tout le canvas OU Dans une zone définie) */}
          {mode === 'random' && (
            <div className="space-y-3">
              {/* Choix de la portée aléatoire */}
              <div className="grid grid-cols-2 gap-2 bg-purple-50/70 p-1.5 rounded-2xl border border-purple-200">
                <button
                  type="button"
                  onClick={() => setRandomScope('canvas')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    randomScope === 'canvas'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-purple-100/60 border border-purple-100'
                  }`}
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span>Tout le canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRandomScope('zone')}
                  className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer whitespace-nowrap ${
                    randomScope === 'zone'
                      ? 'bg-purple-600 text-white shadow-xs'
                      : 'bg-white text-slate-700 hover:bg-purple-100/60 border border-purple-100'
                  }`}
                >
                  <SquareDashedMousePointer className="w-3.5 h-3.5 shrink-0" />
                  <span>Dans une zone</span>
                </button>
              </div>

              {randomScope === 'canvas' ? (
                <div className="p-5 bg-purple-50/60 border-2 border-purple-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-white border border-purple-300 flex items-center justify-center text-2xl shadow-xs">
                    🎲
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-purple-950">Aléatoire sur tout le canvas</h4>
                    <p className="text-xs text-purple-700/80 mt-1 max-w-sm">
                      L'entité apparaîtra à des coordonnées aléatoires sur l'ensemble du plateau ({boundsW}×{boundsH}px) à chaque déclenchement.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <SquareDashedMousePointer className="w-4 h-4 text-purple-600" />
                      Glissez pour tracer la zone ({boundsW}×{boundsH}px) :
                    </span>
                    <span className="text-xs font-mono tabular-nums font-bold text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-lg border border-purple-200">
                      X: {randomZone.x} · Y: {randomZone.y} · {randomZone.width}×{randomZone.height}px
                    </span>
                  </div>

                  {renderGridSnapToolbar(
                    <button
                      type="button"
                      onClick={() => handleLaunchScenePick('random_zone')}
                      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-[11px] font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-2xs cursor-pointer transition-colors whitespace-nowrap shrink-0"
                      title="Ouvrir la scène réelle pour tracer le rectangle de la zone aléatoire"
                    >
                      <MousePointerClick className="w-3.5 h-3.5" />
                      <span>Tracer sur la scène</span>
                    </button>
                  )}

                  {/* Miniature proportionnelle interactive de la scène avec zone tracée */}
                  <div className="w-full bg-slate-100 rounded-2xl p-2 border border-slate-200 flex items-center justify-center">
                    <div
                      ref={zoneCanvasRef}
                      onPointerDown={(e) => {
                        const pt = getZoneScenePointFromClient(e.clientX, e.clientY);
                        if (!pt) return;
                        e.currentTarget.setPointerCapture?.(e.pointerId);
                        zoneDragStartRef.current = pt;
                        setIsDraggingZone(true);
                      }}
                      onPointerMove={(e) => {
                        if (!isDraggingZone || !zoneDragStartRef.current) return;
                        const pt = getZoneScenePointFromClient(e.clientX, e.clientY);
                        if (!pt) return;
                        const s = zoneDragStartRef.current;
                        const zx = Math.min(s.x, pt.x);
                        const zy = Math.min(s.y, pt.y);
                        const zw = Math.max(20, Math.abs(pt.x - s.x));
                        const zh = Math.max(20, Math.abs(pt.y - s.y));
                        setRandomZone(clampSpawnRandomZone({ x: zx, y: zy, width: zw, height: zh }, { width: boundsW, height: boundsH }));
                      }}
                      onPointerUp={(e) => {
                        if (!isDraggingZone) return;
                        const start = zoneDragStartRef.current;
                        const end = getZoneScenePointFromClient(e.clientX, e.clientY);
                        setIsDraggingZone(false);
                        zoneDragStartRef.current = null;
                        e.currentTarget.releasePointerCapture?.(e.pointerId);
                        if (start && end && Math.hypot(end.x - start.x, end.y - start.y) < 8) {
                          // Simple clic : recentrer la zone actuelle sur le point cliqué
                          setRandomZone((prev) =>
                            clampSpawnRandomZone(
                              {
                                x: Math.round(end.x - prev.width / 2),
                                y: Math.round(end.y - prev.height / 2),
                                width: prev.width,
                                height: prev.height,
                              },
                              { width: boundsW, height: boundsH }
                            )
                          );
                        }
                      }}
                      className="relative w-full max-h-64 bg-white rounded-xl border-2 border-purple-500/80 overflow-hidden cursor-crosshair select-none shadow-inner touch-none"
                      style={{
                        aspectRatio: `${boundsW} / ${boundsH}`,
                      }}
                    >
                      {snapToGrid && (
                        <svg
                          viewBox={`0 0 ${boundsW} ${boundsH}`}
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none z-0"
                        >
                          <defs>
                            <pattern
                              id="spawn-zone-snap-grid"
                              width={gridStep}
                              height={gridStep}
                              patternUnits="userSpaceOnUse"
                            >
                              <path
                                d={`M ${gridStep} 0 L 0 0 0 ${gridStep}`}
                                fill="none"
                                stroke="#9333ea"
                                strokeOpacity="0.22"
                                strokeWidth="1"
                              />
                            </pattern>
                          </defs>
                          <rect x="0" y="0" width={boundsW} height={boundsH} fill="url(#spawn-zone-snap-grid)" />
                        </svg>
                      )}

                      {visibleSceneLayers.map((layer) => {
                        const isLegacy200 = layer.coordinateSpace === 'legacy_200';
                        return (
                          <svg
                            key={layer.id}
                            viewBox={isLegacy200 ? '0 0 200 200' : `0 0 ${boundsW} ${boundsH}`}
                            preserveAspectRatio="none"
                            className="absolute inset-0 w-full h-full pointer-events-none"
                            style={{ opacity: Math.min(0.65, layer.opacity ?? 1) }}
                          >
                            {layer.vectorPaths?.map((p, idx) => (
                              <path
                                key={p.id || idx}
                                d={p.d}
                                stroke={p.stroke || '#64748b'}
                                strokeWidth={p.strokeWidth || 4}
                                fill={p.fill && p.fill !== 'none' ? p.fill : 'none'}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                transform={p.transform}
                              />
                            ))}
                          </svg>
                        );
                      })}

                      {orderedVisibleEntities.map((ent) => (
                        <div
                          key={ent.id}
                          className="absolute pointer-events-none border border-slate-300/80 bg-slate-100/40 rounded-md flex items-center justify-center overflow-hidden opacity-75"
                          style={{
                            left: `${(ent.position.x / boundsW) * 100}%`,
                            top: `${(ent.position.y / boundsH) * 100}%`,
                            width: `${(ent.size.width / boundsW) * 100}%`,
                            height: `${(ent.size.height / boundsH) * 100}%`,
                          }}
                        >
                          <EntityMiniPreview entity={ent} type={ent.type} size={28} />
                        </div>
                      ))}

                      {/* Rectangle de zone aléatoire */}
                      <div
                        className="absolute pointer-events-none border-2 border-dashed border-purple-600 bg-purple-500/18 rounded-lg flex items-center justify-center"
                        style={{
                          left: `${(randomZone.x / boundsW) * 100}%`,
                          top: `${(randomZone.y / boundsH) * 100}%`,
                          width: `${(randomZone.width / boundsW) * 100}%`,
                          height: `${(randomZone.height / boundsH) * 100}%`,
                        }}
                      >
                        <span className="text-[10px] font-mono font-bold text-purple-950 bg-white/90 border border-purple-300 px-1.5 py-0.5 rounded shadow-2xs whitespace-nowrap">
                          🎲 Zone {randomZone.width}×{randomZone.height}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Coordonnées numériques X, Y, L, H */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">X (px)</label>
                      <input
                        type="number"
                        step="any"
                        value={randomZone.x}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            setRandomZone({ ...randomZone, x: v });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Y (px)</label>
                      <input
                        type="number"
                        step="any"
                        value={randomZone.y}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            setRandomZone({ ...randomZone, y: v });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Largeur (px)</label>
                      <input
                        type="number"
                        step="any"
                        value={randomZone.width}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            setRandomZone({ ...randomZone, width: v });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">Hauteur (px)</label>
                      <input
                        type="number"
                        step="any"
                        value={randomZone.height}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            setRandomZone({ ...randomZone, height: v });
                          }
                        }}
                        className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                      />
                    </div>
                  </div>

                  {/* Raccourcis rapides de zones */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-400 mr-1">Zones rapides :</span>
                    {[
                      { label: 'Moitié haute', zone: { x: 0, y: 0, width: boundsW, height: Math.round(boundsH * 0.5) } },
                      { label: 'Moitié basse', zone: { x: 0, y: Math.round(boundsH * 0.5), width: boundsW, height: Math.round(boundsH * 0.5) } },
                      { label: 'Moitié gauche', zone: { x: 0, y: 0, width: Math.round(boundsW * 0.5), height: boundsH } },
                      { label: 'Moitié droite', zone: { x: Math.round(boundsW * 0.5), y: 0, width: Math.round(boundsW * 0.5), height: boundsH } },
                      { label: 'Centre (50%)', zone: getDefaultSpawnRandomZone({ width: boundsW, height: boundsH }) },
                    ].map((preset) => (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() => setRandomZone(clampSpawnRandomZone(preset.zone, { width: boundsW, height: boundsH }))}
                        className="px-2.5 py-1 bg-slate-100 hover:bg-purple-50 hover:text-purple-700 hover:border-purple-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all cursor-pointer whitespace-nowrap"
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 5. IMPULSION INITIALE AU SPAWN (Vitesse + Direction) */}
          <div className="p-3.5 bg-orange-50/50 border border-orange-200/80 rounded-2xl space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs font-bold text-orange-950 flex items-center gap-1.5">
                <Rocket className="w-4 h-4 text-orange-600" />
                Impulsion initiale au spawn (Force & Direction) :
              </span>
              <span className="text-[11px] font-mono tabular-nums font-bold px-2 py-0.5 rounded-lg border bg-white text-orange-700 border-orange-200">
                {impulseSpeed > 0 ? `${Math.round(impulseSpeed)} px/s @ ${impulseAngle}°` : 'Aucune (0 px/s)'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4">
              {/* Contrôles Vitesse */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-bold text-slate-600">Force (px/s) :</label>
                  <div className="flex items-center gap-1">
                    {[0, 250, 500, 850].map((presetSpd) => (
                      <button
                        key={presetSpd}
                        type="button"
                        onClick={() => setImpulseSpeed(presetSpd)}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-mono tabular-nums font-bold border cursor-pointer transition-colors whitespace-nowrap ${
                          impulseSpeed === presetSpd
                            ? 'bg-orange-500 text-white border-orange-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-orange-50'
                        }`}
                      >
                        {presetSpd === 0 ? 'Off' : presetSpd}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={1500}
                    step={10}
                    value={Math.max(0, Math.min(1500, impulseSpeed))}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setImpulseSpeed(v);
                      }
                    }}
                    className="flex-1 accent-orange-500 cursor-pointer"
                  />
                  <input
                    type="number"
                    step="any"
                    value={impulseSpeed}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setImpulseSpeed(v);
                      }
                    }}
                    className="w-20 px-2 py-1 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Boussole Circulaire Interactive de Direction */}
              <div className={`flex items-center gap-3 transition-opacity ${impulseSpeed > 0 ? 'opacity-100' : 'opacity-45'}`}>
                <svg
                  ref={angleDialRef}
                  width="64"
                  height="64"
                  viewBox="-32 -32 64 64"
                  onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture?.(e.pointerId);
                    setIsDraggingAngleDial(true);
                    if (impulseSpeed === 0) setImpulseSpeed(400);
                    updateAngleFromClient(e.clientX, e.clientY);
                  }}
                  onPointerMove={(e) => {
                    if (isDraggingAngleDial) updateAngleFromClient(e.clientX, e.clientY);
                  }}
                  onPointerUp={(e) => {
                    setIsDraggingAngleDial(false);
                    e.currentTarget.releasePointerCapture?.(e.pointerId);
                  }}
                  className="shrink-0 cursor-crosshair select-none touch-none bg-white rounded-full border border-orange-300 shadow-2xs"
                >
                  <circle cx="0" cy="0" r="28" fill="none" stroke="#fed7aa" strokeWidth="1.5" />
                  <line x1="-24" y1="0" x2="24" y2="0" stroke="#f1f5f9" strokeWidth="1" />
                  <line x1="0" y1="-24" x2="0" y2="24" stroke="#f1f5f9" strokeWidth="1" />
                  <line
                    x1="0"
                    y1="0"
                    x2={Math.cos(impulseRad) * 22}
                    y2={Math.sin(impulseRad) * 22}
                    stroke="#ea580c"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  <circle
                    cx={Math.cos(impulseRad) * 22}
                    cy={Math.sin(impulseRad) * 22}
                    r="4"
                    fill="#ea580c"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                  <circle cx="0" cy="0" r="2.5" fill="#64748b" />
                </svg>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-bold text-slate-600">Angle :</span>
                    <input
                      type="number"
                      step="any"
                      value={impulseAngle}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          if (impulseSpeed === 0) setImpulseSpeed(400);
                          setImpulseAngle(v);
                        }
                      }}
                      className="w-16 px-2 py-1 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-lg focus:border-orange-500 focus:outline-none"
                    />
                    <span className="text-[11px] font-bold text-slate-500">°</span>
                  </div>
                  <div className="flex items-center gap-1 flex-wrap">
                    {[
                      { label: '↑', angle: -90 },
                      { label: '↗', angle: -45 },
                      { label: '→', angle: 0 },
                      { label: '↘', angle: 45 },
                      { label: '↓', angle: 90 },
                      { label: '←', angle: 180 },
                    ].map((dir) => (
                      <button
                        key={dir.angle}
                        type="button"
                        onClick={() => {
                          if (impulseSpeed === 0) setImpulseSpeed(400);
                          setImpulseAngle(dir.angle);
                        }}
                        className={`w-6 h-6 rounded-md text-[11px] font-bold border cursor-pointer transition-colors ${
                          impulseAngle === dir.angle && impulseSpeed > 0
                            ? 'bg-orange-500 text-white border-orange-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-orange-50'
                        }`}
                        title={`${dir.angle}°`}
                      >
                        {dir.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-slate-500">
              En mode Play, l'objet créé reçoit cette vitesse instantanément (suit sa gravité s'il possède un comportement Physique, sinon glisse en ligne droite).
            </p>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: SIZE & SCALE CONTROLS */}
      {/* ========================================================================= */}
      {activeTab === 'size' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-700 flex items-center gap-2">
            <Scale className="w-4 h-4 text-indigo-600" />
            <span>Mode de dimensionnement au spawn :</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            <button
              type="button"
              onClick={() => setSizeMode('default')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                sizeMode === 'default'
                  ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <div className="text-xs font-bold text-slate-900">📏 Taille Initiale</div>
              <div className="text-[10px] text-slate-500 tabular-nums">
                {defaultSpawnWidth}×{defaultSpawnHeight}px (standard)
              </div>
            </button>

            {isCollision && targetEntity && (
              <button
                type="button"
                onClick={() => setSizeMode('match_target')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  sizeMode === 'match_target'
                    ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">
                  🎯 {formatRoleLabel('Relative Cible', targetEntity.name)}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Basée sur {targetEntity.name} ({targetEntity.size.width}×{targetEntity.size.height}px)
                </div>
              </button>
            )}

            {subjectEntity && (
              <button
                type="button"
                onClick={() => setSizeMode('match_subject')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  sizeMode === 'match_subject'
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">
                  👤 {formatRoleLabel('Relative Sujet', subjectEntity.name)}
                </div>
                <div className="text-[10px] text-slate-500 tabular-nums">
                  Basée sur {subjectEntity.name} ({subjectEntity.size.width}×{subjectEntity.size.height}px)
                </div>
              </button>
            )}

            {(isDirectMode || isOffsetMode) && effectiveRefEntity && (
              <button
                type="button"
                onClick={() => setSizeMode('match_reference')}
                className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                  sizeMode === 'match_reference'
                    ? 'bg-cyan-50 border-cyan-500 ring-2 ring-cyan-200'
                    : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
                }`}
              >
                <div className="text-xs font-bold text-slate-900">📍 Relative Référence</div>
                <div className="text-[10px] text-slate-500 truncate">
                  Basée sur {effectiveRefLabel}
                </div>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSizeMode('custom')}
              className={`p-3 rounded-2xl border text-left cursor-pointer transition-all flex flex-col justify-between gap-1.5 ${
                sizeMode === 'custom'
                  ? 'bg-purple-50 border-purple-500 ring-2 ring-purple-200'
                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200'
              }`}
            >
              <div className="text-xs font-bold text-slate-900">✏️ Personnalisée</div>
              <div className="text-[10px] text-slate-500">Largeur & Hauteur en px</div>
            </button>
          </div>

          {sizeMode !== 'custom' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  Multiplicateur d'échelle :
                </span>
                <div className="flex items-center gap-1.5">
                  <EditableNumericValue
                    value={scaleMultiplier}
                    unit="x"
                    precision={2}
                    onChange={(v) => setScaleMultiplier(v)}
                    className="text-xs font-mono tabular-nums font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-text"
                  />
                  <span className="text-[11px] font-mono tabular-nums text-slate-500">
                    ({calculatedSpawnWidth}×{calculatedSpawnHeight}px)
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {[0.5, 0.75, 1, 1.25, 1.5, 2, 2.5].map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setScaleMultiplier(m)}
                    className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      scaleMultiplier === m
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {m}x
                  </button>
                ))}
              </div>
            </div>
          )}

          {sizeMode === 'custom' && (
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
              <div className="text-xs font-bold text-purple-950">Dimensions exactes (pixels) :</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Largeur (px) :</label>
                  <input
                    type="number"
                    step="any"
                    value={customSize.width}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setCustomSize({ ...customSize, width: v });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Hauteur (px) :</label>
                  <input
                    type="number"
                    step="any"
                    value={customSize.height}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        setCustomSize({ ...customSize, height: v });
                      }
                    }}
                    className="w-full px-3 py-2 text-xs font-mono tabular-nums font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Visual Preview Box */}
          <div className="p-4 bg-slate-900 rounded-2xl border border-slate-700 flex items-center justify-around">
            <div className="text-center">
              <div className="text-[10px] font-bold text-slate-400 mb-1">Objet Référence</div>
              <div className="w-14 h-14 bg-slate-800 rounded-xl border border-slate-600 flex items-center justify-center p-1">
                <EntityMiniPreview
                  entity={
                    sizeMode === 'match_reference'
                      ? effectiveRefEntity
                      : sizeMode === 'match_target'
                      ? targetEntity
                      : subjectEntity
                  }
                  type={
                    sizeMode === 'match_reference'
                      ? effectiveRefEntity?.type
                      : sizeMode === 'match_target'
                      ? targetEntity?.type
                      : subjectEntity?.type
                  }
                  size={42}
                />
              </div>
            </div>

            <div className="text-slate-500 text-lg font-bold">➔</div>

            <div className="text-center">
              <div className="text-[10px] font-bold text-emerald-400 mb-1 tabular-nums">
                Objet Créé ({calculatedSpawnWidth}×{calculatedSpawnHeight}px)
              </div>
              <div className="w-20 h-20 bg-slate-800 rounded-xl border-2 border-emerald-400 flex items-center justify-center p-1 shadow-lg">
                <EntityMiniPreview
                  entity={spawnEntity}
                  type={spawnEntity?.type}
                  stateId={selectedStateId}
                  size={Math.min(68, Math.max(28, Math.round(44 * (calculatedSpawnWidth / defaultSpawnWidth))))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Attribution de Tags optionnels à l'instance créée */}
      <div className="p-3 bg-indigo-50/50 border border-indigo-200/80 rounded-2xl space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <label className="text-xs font-bold text-indigo-950 flex items-center gap-1.5">
            <span>🏷️ Tags attribués à l'objet créé (Optionnel) :</span>
          </label>
          <div className="flex items-center gap-1 flex-wrap">
            {['projectile', 'piece', 'ennemi', 'cible'].map((presetTag) => (
              <button
                key={presetTag}
                type="button"
                onClick={() => {
                  const current = tagsInput
                    .split(',')
                    .map((t) => t.trim().replace(/^#/, ''))
                    .filter(Boolean);
                  if (!current.includes(presetTag)) {
                    setTagsInput([...current, presetTag].join(', '));
                  }
                }}
                className="px-2 py-0.5 text-[10px] font-bold bg-white hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
              >
                +#{presetTag}
              </button>
            ))}
          </div>
        </div>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Ex: projectile, ennemi (séparés par une virgule)"
          className="w-full px-3 py-1.5 text-xs font-medium bg-white border border-indigo-200 rounded-xl focus:border-indigo-500 outline-none text-slate-800"
        />
      </div>

      {/* Confirm & Cancel Actions */}
      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
        <div className="text-[11px] text-slate-500 tabular-nums">
          Taille : <strong className="text-slate-800">{calculatedSpawnWidth}×{calculatedSpawnHeight}px</strong>
          {impulseSpeed > 0 && (
            <span className="ml-2 text-orange-700 font-bold">
              · 🚀 {Math.round(impulseSpeed)}px/s @ {impulseAngle}°
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer whitespace-nowrap"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap"
          >
            <Check className="w-4 h-4" />
            <span>Valider la création</span>
          </button>
        </div>
      </div>
    </div>
  );
}
