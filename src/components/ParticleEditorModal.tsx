import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Sparkles,
  X,
  Check,
  Play,
  Pause,
  RotateCcw,
  Paintbrush,
  Pencil,
  MousePointerClick,
  Flame,
  RefreshCw,
  ArrowLeft,
  Undo2,
  Redo2,
} from 'lucide-react';
import {
  CustomParticlePreset,
  CustomParticleUsageMode,
  ParticleAnchorPreset,
  ParticleColorMode,
  ParticleDirectionMode,
  ParticleEffectConfig,
  ParticleEmissionShape,
  ParticleShape,
  Position,
  VectorPath,
} from '../types';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../store/useSceneStore';
import {
  createParticlePool,
  invalidateCustomParticleSprite,
  sampleParticleRange,
  syncCustomParticlePresets,
} from '../utils/particleSystem';
import {
  DrawingCanvas,
  DrawingCanvasActionsHandle,
  DrawingCanvasHistoryState,
} from './DrawingCanvas';
import { EditableNumericValue } from './shared/EditableNumericValue';
import {
  ParticlePresetLibrary,
  QuickParticlePresetItem,
} from './particles/ParticlePresetLibrary';
import { ParticleActionOriginSection } from './particles/ParticleActionOriginSection';

export interface ParticleEditorConfig extends ParticleEffectConfig {
  particleOriginMode?:
    | 'subject'
    | 'target'
    | 'entity'
    | 'type'
    | 'tag'
    | 'last_spawned'
    | 'event_point'
    | 'coordinates'
    | 'mouse';
  particleOriginEntityId?: string;
  particleOriginEntityType?: string;
  particleOriginTag?: string;
  particleCoords?: Position;
  particleAnchor?: ParticleAnchorPreset;
  particleOffsetX?: number;
  particleOffsetY?: number;
  particleMatchOriginRotation?: boolean;
  particleEmitDuration?: number;
  particleEmitRate?: number;
  particleBurstCount?: number;
  particleBurstInterval?: number;
}

interface ParticleEditorModalProps {
  isOpen: boolean;
  mode: 'emitter' | 'burst';
  allowTarget?: boolean;
  initialView?: 'studio' | 'draw_custom';
  initialEditingPreset?: CustomParticlePreset;
  initialConfig: Partial<ParticleEditorConfig>;
  onApply: (config: ParticleEditorConfig) => void;
  onClose: () => void;
}

const QUICK_PRESETS: QuickParticlePresetItem[] = [
  {
    id: 'fire',
    label: 'Feu & Braises',
    config: {
      shape: 'circle',
      colorMode: 'gradient_lifetime',
      color: '#facc15',
      color2: '#ef4444',
      rate: 26,
      count: 28,
      speed: 90,
      speedMax: 150,
      size: 6,
      sizeMax: 12,
      endSizeScale: 0.2,
      lifetime: 0.55,
      lifetimeMax: 0.95,
      gravity: -160,
      drag: 0.6,
      opacityStart: 1,
      opacityEnd: 0,
      spread: 40,
      angle: -90,
      emissionShape: 'circle',
      emissionRadius: 14,
    },
  },
  {
    id: 'explosion',
    label: 'Explosion',
    config: {
      shape: 'spark',
      colorMode: 'gradient_lifetime',
      color: '#fef08a',
      color2: '#ef4444',
      rate: 32,
      count: 35,
      countMax: 50,
      speed: 180,
      speedMax: 340,
      size: 6,
      sizeMax: 11,
      endSizeScale: 0.25,
      lifetime: 0.45,
      lifetimeMax: 0.8,
      gravity: 160,
      drag: 1.8,
      opacityStart: 1,
      opacityEnd: 0,
      spread: 360,
      angle: 0,
      emissionShape: 'point',
      initialBurstCount: 32,
      emitterDuration: 0.6,
      emitterLoop: false,
    },
  },
  {
    id: 'sparks',
    label: 'Étincelles',
    config: {
      shape: 'spark',
      colorMode: 'two_colors',
      color: '#38bdf8',
      color2: '#a855f7',
      rate: 22,
      count: 24,
      speed: 190,
      speedMax: 290,
      size: 5,
      sizeMax: 8,
      endSizeScale: 0.4,
      lifetime: 0.4,
      lifetimeMax: 0.7,
      gravity: 340,
      drag: 0.4,
      opacityStart: 1,
      opacityEnd: 0,
      spread: 110,
      angle: -90,
      emissionShape: 'point',
    },
  },
  {
    id: 'smoke',
    label: 'Fumée douce',
    config: {
      shape: 'circle',
      colorMode: 'gradient_lifetime',
      color: '#cbd5e1',
      color2: '#64748b',
      rate: 10,
      count: 16,
      speed: 35,
      speedMax: 75,
      size: 11,
      sizeMax: 18,
      endSizeScale: 1.8,
      lifetime: 1.2,
      lifetimeMax: 1.8,
      gravity: -40,
      drag: 1.2,
      opacityStart: 0.65,
      opacityEnd: 0,
      spread: 35,
      angle: -90,
      emissionShape: 'circle',
      emissionRadius: 16,
    },
  },
  {
    id: 'stars',
    label: 'Magie / Étoiles',
    config: {
      shape: 'star',
      colorMode: 'two_colors',
      color: '#facc15',
      color2: '#ec4899',
      rate: 16,
      count: 22,
      speed: 100,
      speedMax: 180,
      size: 7,
      sizeMax: 12,
      endSizeScale: 0.3,
      lifetime: 0.8,
      lifetimeMax: 1.3,
      gravity: 30,
      drag: 0.9,
      opacityStart: 1,
      opacityEnd: 0,
      spinSpeed: 180,
      spread: 360,
      angle: -90,
      emissionShape: 'circle',
      emissionRadius: 24,
    },
  },
  {
    id: 'confetti',
    label: 'Confettis',
    config: {
      shape: 'square',
      colorMode: 'two_colors',
      color: '#22c55e',
      color2: '#3b82f6',
      rate: 28,
      count: 42,
      speed: 170,
      speedMax: 290,
      size: 5,
      sizeMax: 9,
      endSizeScale: 0.9,
      lifetime: 1.1,
      lifetimeMax: 1.7,
      gravity: 260,
      drag: 1.4,
      opacityStart: 1,
      opacityEnd: 0.2,
      spinSpeed: 320,
      spread: 120,
      angle: -90,
      emissionShape: 'box',
      emissionWidth: 70,
      emissionHeight: 16,
    },
  },
];

interface RangeOrFixedRowProps {
  label: string;
  unit?: string;
  precision?: number;
  minVal: number;
  maxVal?: number;
  sliderMin: number;
  sliderMax: number;
  step: number;
  accent?: 'amber' | 'indigo';
  onChangeMin: (val: number) => void;
  onChangeMax: (val: number | undefined) => void;
  roundInt?: boolean;
}

const RangeOrFixedRow: React.FC<RangeOrFixedRowProps> = ({
  label,
  unit = '',
  precision = 1,
  minVal,
  maxVal,
  sliderMin,
  sliderMax,
  step,
  accent = 'indigo',
  onChangeMin,
  onChangeMax,
  roundInt = false,
}) => {
  const isRange = maxVal !== undefined && Number.isFinite(maxVal);
  const accentClass = accent === 'amber' ? 'accent-amber-500' : 'accent-indigo-600';
  const badgeClass =
    accent === 'amber'
      ? 'font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]'
      : 'font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]';

  return (
    <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-slate-700">
        <span className="font-bold">{label}</span>
        <div className="flex items-center gap-1.5">
          <EditableNumericValue
            value={minVal}
            unit={isRange ? undefined : unit}
            precision={precision}
            onChange={(v) => onChangeMin(roundInt ? Math.round(v) : v)}
            className={badgeClass}
          />
          {isRange && (
            <>
              <span className="text-[10px] font-bold text-slate-400">à</span>
              <EditableNumericValue
                value={maxVal!}
                unit={unit}
                precision={precision}
                onChange={(v) => onChangeMax(roundInt ? Math.round(v) : v)}
                className={badgeClass}
              />
            </>
          )}
          <button
            type="button"
            onClick={() => {
              if (isRange) {
                onChangeMax(undefined);
              } else {
                const suggested = roundInt
                  ? Math.round(minVal + Math.max(2, minVal * 0.4))
                  : Number((minVal + Math.max(step * 2, Math.abs(minVal) * 0.4)).toFixed(precision));
                onChangeMax(suggested);
              }
            }}
            className={`px-1.5 py-0.5 rounded-lg text-[9px] font-extrabold border cursor-pointer transition-colors ${
              isRange
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-slate-500 border-slate-300 hover:border-indigo-400'
            }`}
            title={isRange ? 'Revenir à une valeur fixe' : 'Activer une plage aléatoire Min–Max'}
          >
            {isRange ? 'Min–Max' : 'Fixe'}
          </button>
        </div>
      </div>

      <input
        type="range"
        min={sliderMin}
        max={sliderMax}
        step={step}
        value={Math.max(sliderMin, Math.min(sliderMax, minVal))}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (Number.isFinite(v)) onChangeMin(roundInt ? Math.round(v) : v);
        }}
        className={`w-full ${accentClass} cursor-pointer h-1.5`}
      />

      {isRange && (
        <input
          type="range"
          min={sliderMin}
          max={sliderMax}
          step={step}
          value={Math.max(sliderMin, Math.min(sliderMax, maxVal!))}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (Number.isFinite(v)) onChangeMax(roundInt ? Math.round(v) : v);
          }}
          className={`w-full ${accentClass} cursor-pointer h-1.5 opacity-80`}
        />
      )}
    </div>
  );
};

export function ParticleEditorModal({
  isOpen,
  mode,
  allowTarget = false,
  initialView = 'studio',
  initialEditingPreset,
  initialConfig,
  onApply,
  onClose,
}: ParticleEditorModalProps) {
  const customParticles = useSceneStore((state) => state.customParticles || EMPTY_LIST);
  const entities = useSceneStore((state) => state.entities || EMPTY_RECORD);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const addCustomParticle = useSceneStore((state) => state.addCustomParticle);
  const updateCustomParticle = useSceneStore((state) => state.updateCustomParticle);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);

  const entityList = Object.values(entities);
  const typeOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    entityList.forEach((e) => map.set(e.type, e.name));
    Object.values(customArchetypes).forEach((a) => {
      if (!map.has(a.type)) map.set(a.type, a.name);
    });
    return Array.from(map.entries()).map(([type, label]) => ({ type, label }));
  }, [entityList, customArchetypes]);
  const allTags = React.useMemo(() => {
    const s = new Set<string>();
    entityList.forEach((e) => e.tags?.forEach((t) => s.add(t)));
    return Array.from(s);
  }, [entityList]);
  const availableEntityOptions = React.useMemo(
    () => typeOptions.map((o) => ({ type: o.type, label: o.label })),
    [typeOptions]
  );

  const [config, setConfig] = useState<ParticleEditorConfig>(() => {
    const initialIds =
      initialConfig.customParticleIds && initialConfig.customParticleIds.length > 0
        ? initialConfig.customParticleIds
        : initialConfig.customParticleId
        ? [initialConfig.customParticleId]
        : [];
    const c1 = initialConfig.color || '#f59e0b';
    const c2 = initialConfig.color2 || c1;
    const inferredColorMode: ParticleColorMode =
      initialConfig.colorMode || (initialConfig.color2 && initialConfig.color2 !== c1 ? 'two_colors' : 'single');

    return {
      shape: initialConfig.shape || 'circle',
      customParticleId: initialConfig.customParticleId || initialIds[0],
      customParticleIds: initialIds,
      customParticleMode: initialConfig.customParticleMode || 'random',
      useParticleTint: Boolean(initialConfig.useParticleTint),
      color: c1,
      color2: c2,
      colorMode: inferredColorMode,
      rate: initialConfig.rate ?? 16,
      rateMax: initialConfig.rateMax,
      count: initialConfig.count ?? 22,
      countMax: initialConfig.countMax,
      speed: initialConfig.speed ?? 160,
      speedMax: initialConfig.speedMax,
      size: initialConfig.size ?? 7,
      sizeMax: initialConfig.sizeMax,
      endSizeScale: initialConfig.endSizeScale ?? 0.35,
      lifetime: initialConfig.lifetime ?? 0.8,
      lifetimeMax: initialConfig.lifetimeMax,
      gravity: initialConfig.gravity ?? 180,
      drag: initialConfig.drag ?? 0,
      opacityStart: initialConfig.opacityStart ?? 1,
      opacityEnd: initialConfig.opacityEnd ?? 0,
      spinSpeed: initialConfig.spinSpeed,
      spread: initialConfig.spread ?? (mode === 'burst' ? 360 : 60),
      angle: initialConfig.angle ?? -90,
      directionMode: initialConfig.directionMode || 'angle',
      directionTargetMode: initialConfig.directionTargetMode,
      directionTargetEntityId: initialConfig.directionTargetEntityId,
      directionTargetEntityType: initialConfig.directionTargetEntityType,
      directionTargetTag: initialConfig.directionTargetTag,
      offsetX: initialConfig.offsetX ?? 0,
      offsetY: initialConfig.offsetY ?? 0,
      anchor: initialConfig.anchor || 'center',
      followRotation: initialConfig.followRotation !== false,
      emissionShape: initialConfig.emissionShape || 'point',
      emissionRadius: initialConfig.emissionRadius ?? 28,
      emissionWidth: initialConfig.emissionWidth ?? 60,
      emissionHeight: initialConfig.emissionHeight ?? 30,
      emitterDuration: initialConfig.emitterDuration ?? 0,
      emitterLoop: initialConfig.emitterLoop !== false,
      initialBurstCount: initialConfig.initialBurstCount ?? 0,
      burstInterval: initialConfig.burstInterval ?? 0,
      burstCount: initialConfig.burstCount ?? 12,
      // Champs spécifiques aux événements (emit_particles)
      particleOriginMode: initialConfig.particleOriginMode || 'subject',
      particleOriginEntityId: initialConfig.particleOriginEntityId,
      particleOriginEntityType: initialConfig.particleOriginEntityType,
      particleOriginTag: initialConfig.particleOriginTag,
      particleCoords: initialConfig.particleCoords,
      particleAnchor: initialConfig.particleAnchor || 'center',
      particleOffsetX: initialConfig.particleOffsetX ?? 0,
      particleOffsetY: initialConfig.particleOffsetY ?? 0,
      particleMatchOriginRotation: initialConfig.particleMatchOriginRotation !== false,
      particleEmitDuration: initialConfig.particleEmitDuration ?? 0,
      particleEmitRate: initialConfig.particleEmitRate ?? 20,
      particleBurstInterval: initialConfig.particleBurstInterval ?? 0,
      particleBurstCount: initialConfig.particleBurstCount,
    };
  });

  const [isAutoEmitting, setIsAutoEmitting] = useState(true);
  const [backdropTheme, setBackdropTheme] = useState<'dark' | 'light' | 'grid'>('dark');
  const [drawerTarget, setDrawerTarget] = useState<{
    editingPreset?: CustomParticlePreset;
    sessionKey: string;
  } | null>(() =>
    initialView === 'draw_custom'
      ? {
          editingPreset: initialEditingPreset,
          sessionKey: `draw_${initialEditingPreset?.id || 'new'}_${Date.now()}`,
        }
      : null
  );
  const [drawingPaths, setDrawingPaths] = useState<VectorPath[]>(() =>
    initialView === 'draw_custom' && initialEditingPreset?.vectorPaths
      ? JSON.parse(JSON.stringify(initialEditingPreset.vectorPaths))
      : []
  );
  const [drawingName, setDrawingName] = useState<string>(() =>
    initialView === 'draw_custom'
      ? initialEditingPreset?.name || `Particule ${customParticles.length + 1}`
      : ''
  );
  const canvasActionsRef = useRef<DrawingCanvasActionsHandle | null>(null);
  const [drawingHistoryState, setDrawingHistoryState] = useState<DrawingCanvasHistoryState>({
    canUndo: false,
    canRedo: false,
    pathCount: initialEditingPreset?.vectorPaths?.length || 0,
    onionEnabled: false,
    hasOnion: false,
  });
  const handleDrawingHistoryChange = useCallback((st: DrawingCanvasHistoryState) => {
    setDrawingHistoryState(st);
  }, []);
  const handleDrawingVectorChange = useCallback((paths: VectorPath[]) => {
    setDrawingPaths(paths);
  }, []);
  const openInlineDrawer = (editingPreset?: CustomParticlePreset) => {
    const clonedPaths: VectorPath[] = editingPreset?.vectorPaths
      ? JSON.parse(JSON.stringify(editingPreset.vectorPaths))
      : [];
    setDrawingPaths(clonedPaths);
    setDrawingName(editingPreset?.name || `Particule ${customParticles.length + 1}`);
    setDrawingHistoryState({
      canUndo: false,
      canRedo: false,
      pathCount: clonedPaths.length,
      onionEnabled: false,
      hasOnion: false,
    });
    setDrawerTarget({
      editingPreset,
      sessionKey: `draw_${editingPreset?.id || 'new'}_${Date.now()}`,
    });
  };
  const [cycleRestartSignal, setCycleRestartSignal] = useState(0);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef(createParticlePool(340));
  const configRef = useRef(config);
  const isAutoRef = useRef(isAutoEmitting);
  const isPointerDownRef = useRef(false);
  const backdropPointerDownRef = useRef(false);
  const simStateRef = useRef({
    emitAcc: 0,
    elapsedSec: 0,
    initialBurstDone: false,
    burstTimer: 0,
    burstLoopTimer: 0.6,
  });

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isAutoRef.current = isAutoEmitting;
  }, [isAutoEmitting]);

  useEffect(() => {
    syncCustomParticlePresets(customParticles);
  }, [customParticles]);

  useEffect(() => {
    simStateRef.current = {
      emitAcc: 0,
      elapsedSec: 0,
      initialBurstDone: false,
      burstTimer: 0,
      burstLoopTimer: 0.6,
    };
  }, [cycleRestartSignal]);

  // Boucle de simulation Canvas 2D isolée à l'éditeur
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    let lastTime = performance.now();

    const STAGE_W = 480;
    const STAGE_H = 340;
    const ORIGIN_X = STAGE_W / 2;
    const ORIGIN_Y = STAGE_H * 0.56;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const cfg = configRef.current;
      const pool = poolRef.current;
      const sim = simStateRef.current;

      if (isAutoRef.current) {
        if (mode === 'emitter') {
          const dur = cfg.emitterDuration ?? 0;
          let activeWindow = true;
          if (dur > 0 && sim.elapsedSec >= dur) {
            if (cfg.emitterLoop) {
              sim.elapsedSec = sim.elapsedSec % dur;
              sim.initialBurstDone = false;
              sim.burstTimer = 0;
            } else {
              activeWindow = false;
            }
          }

          if (activeWindow) {
            let whole = 0;
            if (!sim.initialBurstDone && (cfg.initialBurstCount ?? 0) > 0) {
              whole += Math.max(1, Math.round(cfg.initialBurstCount!));
              sim.initialBurstDone = true;
            }
            if ((cfg.burstInterval ?? 0) > 0 && (cfg.burstCount ?? 0) > 0) {
              sim.burstTimer += dt;
              if (sim.burstTimer >= cfg.burstInterval!) {
                sim.burstTimer -= cfg.burstInterval!;
                whole += Math.max(1, Math.round(cfg.burstCount!));
              }
            }
            const effRate =
              cfg.rateMax !== undefined && Number.isFinite(cfg.rateMax)
                ? Math.max(0, sampleParticleRange(cfg.rate ?? 16, cfg.rateMax, 1, 1))
                : Math.max(0, cfg.rate ?? 16);
            sim.emitAcc += effRate * dt;
            const cont = Math.floor(sim.emitAcc);
            if (cont > 0) {
              sim.emitAcc -= cont;
              whole += cont;
            }
            sim.elapsedSec += dt;

            if (whole > 0) {
              pool.emitBurst({
                x: ORIGIN_X,
                y: ORIGIN_Y,
                count: Math.min(80, whole),
                color: cfg.color,
                color2: cfg.color2,
                colorMode: cfg.colorMode,
                shape: cfg.shape,
                customParticleId: cfg.customParticleId,
                customParticleIds: cfg.customParticleIds,
                customParticleMode: cfg.customParticleMode,
                useTint: cfg.useParticleTint,
                speed: cfg.speed,
                speedMax: cfg.speedMax,
                size: cfg.size,
                sizeMax: cfg.sizeMax,
                endSizeScale: cfg.endSizeScale,
                lifetime: cfg.lifetime,
                lifetimeMax: cfg.lifetimeMax,
                gravity: cfg.gravity,
                drag: cfg.drag,
                opacityStart: cfg.opacityStart,
                opacityEnd: cfg.opacityEnd,
                spinSpeed: cfg.spinSpeed,
                spread: cfg.spread,
                angle: cfg.angle,
                emissionShape: cfg.emissionShape,
                emissionRadius: cfg.emissionRadius,
                emissionWidth: cfg.emissionWidth,
                emissionHeight: cfg.emissionHeight,
              });
            }
          }
        } else if ((cfg.particleEmitDuration ?? 0) > 0) {
          const dur = cfg.particleEmitDuration ?? 0;
          const pauseGap = 0.65;
          if (sim.elapsedSec >= dur + pauseGap) {
            sim.elapsedSec = 0;
            sim.initialBurstDone = false;
            sim.burstTimer = 0;
            sim.emitAcc = 0;
          }
          if (sim.elapsedSec < dur) {
            let whole = 0;
            if (!sim.initialBurstDone && (cfg.count ?? 0) > 0) {
              whole += Math.max(1, Math.round(cfg.count ?? 20));
              sim.initialBurstDone = true;
            }
            if ((cfg.particleBurstInterval ?? 0) > 0 && (cfg.particleBurstCount ?? cfg.count ?? 12) > 0) {
              sim.burstTimer += dt;
              if (sim.burstTimer >= cfg.particleBurstInterval!) {
                sim.burstTimer -= cfg.particleBurstInterval!;
                whole += Math.max(1, Math.round(cfg.particleBurstCount ?? cfg.count ?? 12));
              }
            }
            const effRate = Math.max(0, cfg.particleEmitRate ?? 20);
            sim.emitAcc += effRate * dt;
            const cont = Math.floor(sim.emitAcc);
            if (cont > 0) {
              sim.emitAcc -= cont;
              whole += cont;
            }
            if (whole > 0) {
              pool.emitBurst({
                x: ORIGIN_X,
                y: ORIGIN_Y,
                count: Math.min(80, whole),
                color: cfg.color,
                color2: cfg.color2,
                colorMode: cfg.colorMode,
                shape: cfg.shape,
                customParticleId: cfg.customParticleId,
                customParticleIds: cfg.customParticleIds,
                customParticleMode: cfg.customParticleMode,
                useTint: cfg.useParticleTint,
                speed: cfg.speed,
                speedMax: cfg.speedMax,
                size: cfg.size,
                sizeMax: cfg.sizeMax,
                endSizeScale: cfg.endSizeScale,
                lifetime: cfg.lifetime,
                lifetimeMax: cfg.lifetimeMax,
                gravity: cfg.gravity,
                drag: cfg.drag,
                opacityStart: cfg.opacityStart,
                opacityEnd: cfg.opacityEnd,
                spinSpeed: cfg.spinSpeed,
                spread: cfg.spread,
                angle: cfg.angle,
                emissionShape: cfg.emissionShape,
                emissionRadius: cfg.emissionRadius,
                emissionWidth: cfg.emissionWidth,
                emissionHeight: cfg.emissionHeight,
              });
            }
          }
          sim.elapsedSec += dt;
        } else {
          sim.burstLoopTimer += dt;
          const maxL = cfg.lifetimeMax ?? cfg.lifetime;
          const interval = Math.max(0.7, Math.min(2.6, maxL + 0.35));
          if (sim.burstLoopTimer >= interval) {
            sim.burstLoopTimer = 0;
            pool.emitBurst({
              x: ORIGIN_X,
              y: ORIGIN_Y,
              count: cfg.count ?? 22,
              countMax: cfg.countMax,
              color: cfg.color,
              color2: cfg.color2,
              colorMode: cfg.colorMode,
              shape: cfg.shape,
              customParticleId: cfg.customParticleId,
              customParticleIds: cfg.customParticleIds,
              customParticleMode: cfg.customParticleMode,
              useTint: cfg.useParticleTint,
              speed: cfg.speed,
              speedMax: cfg.speedMax,
              size: cfg.size,
              sizeMax: cfg.sizeMax,
              endSizeScale: cfg.endSizeScale,
              lifetime: cfg.lifetime,
              lifetimeMax: cfg.lifetimeMax,
              gravity: cfg.gravity,
              drag: cfg.drag,
              opacityStart: cfg.opacityStart,
              opacityEnd: cfg.opacityEnd,
              spinSpeed: cfg.spinSpeed,
              spread: cfg.spread,
              angle: cfg.angle,
              emissionShape: cfg.emissionShape,
              emissionRadius: cfg.emissionRadius,
              emissionWidth: cfg.emissionWidth,
              emissionHeight: cfg.emissionHeight,
            });
          }
        }
      }

      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          pool.stepAndRender(ctx, STAGE_W, STAGE_H, dt);
        }
      }

      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      poolRef.current.clear();
    };
  }, [isOpen, mode]);

  if (!isOpen) return null;

  const triggerManualBurst = (x: number = 240, y: number = 340 * 0.56) => {
    const cfg = configRef.current;
    poolRef.current.emitBurst({
      x,
      y,
      count: mode === 'burst' ? cfg.count ?? 22 : Math.max(8, Math.round((cfg.rate ?? 16) * 0.8)),
      countMax: mode === 'burst' ? cfg.countMax : undefined,
      color: cfg.color,
      color2: cfg.color2,
      colorMode: cfg.colorMode,
      shape: cfg.shape,
      customParticleId: cfg.customParticleId,
      customParticleIds: cfg.customParticleIds,
      customParticleMode: cfg.customParticleMode,
      useTint: cfg.useParticleTint,
      speed: cfg.speed,
      speedMax: cfg.speedMax,
      size: cfg.size,
      sizeMax: cfg.sizeMax,
      endSizeScale: cfg.endSizeScale,
      lifetime: cfg.lifetime,
      lifetimeMax: cfg.lifetimeMax,
      gravity: cfg.gravity,
      drag: cfg.drag,
      opacityStart: cfg.opacityStart,
      opacityEnd: cfg.opacityEnd,
      spinSpeed: cfg.spinSpeed,
      spread: cfg.spread,
      angle: cfg.angle,
      emissionShape: cfg.emissionShape,
      emissionRadius: cfg.emissionRadius,
      emissionWidth: cfg.emissionWidth,
      emissionHeight: cfg.emissionHeight,
    });
  };

  const getStageCoords = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * 480,
      y: ((e.clientY - rect.top) / rect.height) * 340,
    };
  };

  const update = (partial: Partial<ParticleEditorConfig>) => {
    setConfig((prev) => ({ ...prev, ...partial }));
  };

  const originX = 240;
  const originY = 340 * 0.56;
  const angleRad = (config.angle * Math.PI) / 180;
  const halfSpreadRad = ((config.spread * 0.5) * Math.PI) / 180;
  const rayLen = 48;
  const coneLeftX = originX + Math.cos(angleRad - halfSpreadRad) * rayLen;
  const coneLeftY = originY + Math.sin(angleRad - halfSpreadRad) * rayLen;
  const coneRightX = originX + Math.cos(angleRad + halfSpreadRad) * rayLen;
  const coneRightY = originY + Math.sin(angleRad + halfSpreadRad) * rayLen;
  const centerRayX = originX + Math.cos(angleRad) * (rayLen + 10);
  const centerRayY = originY + Math.sin(angleRad) * (rayLen + 10);

  const pureEffectConfig: ParticleEffectConfig = {
    shape: config.shape,
    customParticleId: config.customParticleId,
    customParticleIds: config.customParticleIds,
    customParticleMode: config.customParticleMode,
    useParticleTint: config.useParticleTint,
    color: config.color,
    color2: config.color2,
    colorMode: config.colorMode,
    rate: config.rate,
    rateMax: config.rateMax,
    count: config.count,
    countMax: config.countMax,
    speed: config.speed,
    speedMax: config.speedMax,
    size: config.size,
    sizeMax: config.sizeMax,
    endSizeScale: config.endSizeScale,
    lifetime: config.lifetime,
    lifetimeMax: config.lifetimeMax,
    gravity: config.gravity,
    drag: config.drag,
    opacityStart: config.opacityStart,
    opacityEnd: config.opacityEnd,
    spinSpeed: config.spinSpeed,
    spread: config.spread,
    angle: config.angle,
    directionMode: config.directionMode,
    directionTargetMode: config.directionTargetMode,
    directionTargetEntityId: config.directionTargetEntityId,
    directionTargetEntityType: config.directionTargetEntityType,
    directionTargetTag: config.directionTargetTag,
    offsetX: config.offsetX,
    offsetY: config.offsetY,
    anchor: config.anchor,
    followRotation: config.followRotation,
    emissionShape: config.emissionShape,
    emissionRadius: config.emissionRadius,
    emissionWidth: config.emissionWidth,
    emissionHeight: config.emissionHeight,
    emitterDuration: config.emitterDuration,
    emitterLoop: config.emitterLoop,
    initialBurstCount: config.initialBurstCount,
    burstInterval: config.burstInterval,
    burstCount: config.burstCount,
  };

  const handleSaveInlineDrawing = () => {
    if (!drawerTarget) return;
    const finalName = drawingName.trim() || `Particule ${customParticles.length + 1}`;
    let targetPresetId = drawerTarget.editingPreset?.id;
    if (targetPresetId) {
      updateCustomParticle(targetPresetId, {
        name: finalName,
        vectorPaths: drawingPaths,
      });
      invalidateCustomParticleSprite(targetPresetId);
    } else {
      targetPresetId = addCustomParticle({
        name: finalName,
        vectorPaths: drawingPaths,
        useTint: false,
      });
    }
    const existingIds =
      config.customParticleIds && config.customParticleIds.length > 0
        ? config.customParticleIds
        : config.customParticleId
        ? [config.customParticleId]
        : [];
    const nextIds = existingIds.includes(targetPresetId)
      ? existingIds
      : [...existingIds, targetPresetId];
    update({
      shape: 'custom',
      customParticleId: nextIds[0] || targetPresetId,
      customParticleIds: nextIds,
    });
    setDrawerTarget(null);
  };

  return createPortal(
    <div
      data-modal-open="true"
      className="fixed inset-0 z-[10000] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
      style={{ isolation: 'isolate' }}
      onPointerDown={(e) => {
        backdropPointerDownRef.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && backdropPointerDownRef.current && !drawerTarget) {
          onClose();
        }
        backdropPointerDownRef.current = false;
      }}
    >
      <div
        className={`bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 duration-150 ${
          drawerTarget ? 'h-[90vh]' : 'max-h-[92vh]'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header unifié (Studio ou Vue Dessin Particule) */}
        {drawerTarget ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => setDrawerTarget(null)}
                className="px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Studio</span>
              </button>
              <div className="w-8 h-8 rounded-xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center shrink-0">
                <Paintbrush className="w-4 h-4" />
              </div>
              <input
                type="text"
                value={drawingName}
                onChange={(e) => setDrawingName(e.target.value)}
                placeholder="Nom de la particule..."
                className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs sm:text-sm font-extrabold text-slate-800 w-44 sm:w-60 focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => canvasActionsRef.current?.undo()}
                disabled={!drawingHistoryState.canUndo}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                title="Annuler le trait (Ctrl+Z)"
              >
                <Undo2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Annuler</span>
              </button>
              <button
                type="button"
                onClick={() => canvasActionsRef.current?.redo()}
                disabled={!drawingHistoryState.canRedo}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                title="Rétablir"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => canvasActionsRef.current?.clear()}
                disabled={drawingHistoryState.pathCount === 0}
                className="px-2 py-1.5 rounded-lg text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 cursor-pointer"
                title="Tout effacer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDrawerTarget(null)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
              >
                Retour
              </button>
              <button
                type="button"
                onClick={handleSaveInlineDrawing}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Enregistrer la particule</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                  Studio Particules &amp; Collection
                </h2>
                <p className="text-[11px] text-slate-500">
                  {mode === 'emitter'
                    ? 'Émetteur continu : plages Min–Max, formes, salves, durée, ancre et collection inter-projets'
                    : 'Événement particules : source, ancrage, salves temporisées, plages aléatoires et collection'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => onApply(config)}
                className="px-4 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-black rounded-xl shadow-sm flex items-center gap-1.5 cursor-pointer active:scale-95"
              >
                <Check className="w-4 h-4" />
                <span>Appliquer</span>
              </button>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Body: either inline DrawingCanvas or Studio Stage + Controls */}
        {drawerTarget ? (
          <div className="flex-1 p-3 sm:p-4 overflow-hidden bg-slate-100/60 flex items-center justify-center relative min-h-0">
            <DrawingCanvas
              frameSyncKey={drawerTarget.sessionKey}
              initialPaths={drawingPaths}
              initialStrokeColor="#000000"
              currentEditingStateName={drawingName || 'Particule'}
              onVectorChange={handleDrawingVectorChange}
              enablePivotEditing={false}
              actionsRef={canvasActionsRef}
              onHistoryStateChange={handleDrawingHistoryChange}
              hideTopHistoryButtons={true}
            />
          </div>
        ) : (
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* LEFT: Live Interactive Stage + Preset Library */}
          <div className="lg:col-span-6 p-4 bg-slate-100/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col gap-3 overflow-y-auto">
            {/* Toolbar above canvas */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setIsAutoEmitting((v) => !v)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer border transition-all ${
                    isAutoEmitting
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {isAutoEmitting ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                  <span>{isAutoEmitting ? 'Auto actif' : 'Auto en pause'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => triggerManualBurst()}
                  className="px-2.5 py-1.5 rounded-xl text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white flex items-center gap-1 cursor-pointer shadow-2xs"
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>Salve test</span>
                </button>

                {(mode === 'emitter' || (config.particleEmitDuration ?? 0) > 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      poolRef.current.clear();
                      setCycleRestartSignal((s) => s + 1);
                    }}
                    className="px-2 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer"
                    title="Redémarrer le cycle d'émission depuis t = 0"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Cycle</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => poolRef.current.clear()}
                  className="p-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 cursor-pointer"
                  title="Vider les particules actives"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Backdrop switcher */}
              <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 text-[10px] font-bold">
                {[
                  { id: 'dark', label: 'Nuit' },
                  { id: 'grid', label: 'Grille' },
                  { id: 'light', label: 'Clair' },
                ].map((bg) => (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => setBackdropTheme(bg.id as any)}
                    className={`px-2 py-0.5 rounded-lg cursor-pointer transition-colors ${
                      backdropTheme === bg.id
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {bg.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Canvas Stage */}
            <div
              className={`relative w-full aspect-[480/340] rounded-2xl border overflow-hidden shadow-inner shrink-0 ${
                backdropTheme === 'dark'
                  ? 'bg-slate-900 border-slate-800'
                  : backdropTheme === 'grid'
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-white border-slate-300'
              }`}
              style={
                backdropTheme === 'grid'
                  ? {
                      backgroundImage:
                        'radial-gradient(rgba(148,163,184,0.35) 1px, transparent 1px)',
                      backgroundSize: '18px 18px',
                    }
                  : undefined
              }
            >
              {/* Cone, Angle & Emission Zone SVG indicator */}
              <svg
                viewBox="0 0 480 340"
                className="absolute inset-0 w-full h-full pointer-events-none opacity-55"
              >
                {config.emissionShape === 'circle' && (
                  <circle
                    cx={originX}
                    cy={originY}
                    r={Math.max(4, config.emissionRadius ?? 28)}
                    fill="rgba(245, 158, 11, 0.08)"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                )}
                {config.emissionShape === 'box' && (
                  <rect
                    x={originX - Math.max(4, config.emissionWidth ?? 60) / 2}
                    y={originY - Math.max(4, config.emissionHeight ?? 30) / 2}
                    width={Math.max(4, config.emissionWidth ?? 60)}
                    height={Math.max(4, config.emissionHeight ?? 30)}
                    fill="rgba(245, 158, 11, 0.08)"
                    stroke="#f59e0b"
                    strokeWidth="1.2"
                    strokeDasharray="4 3"
                  />
                )}
                {config.spread < 350 && (
                  <>
                    <line
                      x1={originX}
                      y1={originY}
                      x2={coneLeftX}
                      y2={coneLeftY}
                      stroke={backdropTheme === 'light' ? '#6366f1' : '#94a3b8'}
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                    <line
                      x1={originX}
                      y1={originY}
                      x2={coneRightX}
                      y2={coneRightY}
                      stroke={backdropTheme === 'light' ? '#6366f1' : '#94a3b8'}
                      strokeWidth="1.2"
                      strokeDasharray="4 3"
                    />
                  </>
                )}
                <line
                  x1={originX}
                  y1={originY}
                  x2={centerRayX}
                  y2={centerRayY}
                  stroke="#f59e0b"
                  strokeWidth="1.5"
                />
                <circle cx={originX} cy={originY} r="4" fill="#f59e0b" opacity="0.8" />
              </svg>

              <canvas
                ref={canvasRef}
                width={480}
                height={340}
                onPointerDown={(e) => {
                  isPointerDownRef.current = true;
                  const pt = getStageCoords(e);
                  triggerManualBurst(pt.x, pt.y);
                }}
                onPointerMove={(e) => {
                  if (!isPointerDownRef.current) return;
                  const pt = getStageCoords(e);
                  poolRef.current.emitBurst({
                    x: pt.x,
                    y: pt.y,
                    count: 3,
                    color: config.color,
                    color2: config.color2,
                    colorMode: config.colorMode,
                    shape: config.shape,
                    customParticleId: config.customParticleId,
                    customParticleIds: config.customParticleIds,
                    customParticleMode: config.customParticleMode,
                    useTint: config.useParticleTint,
                    speed: config.speed,
                    speedMax: config.speedMax,
                    size: config.size,
                    sizeMax: config.sizeMax,
                    endSizeScale: config.endSizeScale,
                    lifetime: config.lifetime,
                    lifetimeMax: config.lifetimeMax,
                    gravity: config.gravity,
                    drag: config.drag,
                    opacityStart: config.opacityStart,
                    opacityEnd: config.opacityEnd,
                    spinSpeed: config.spinSpeed,
                    spread: config.spread,
                    angle: config.angle,
                    emissionShape: config.emissionShape,
                    emissionRadius: config.emissionRadius,
                    emissionWidth: config.emissionWidth,
                    emissionHeight: config.emissionHeight,
                  });
                }}
                onPointerUp={() => {
                  isPointerDownRef.current = false;
                }}
                onPointerLeave={() => {
                  isPointerDownRef.current = false;
                }}
                className="relative z-10 w-full h-full cursor-crosshair block"
              />

              <div
                className={`absolute bottom-2.5 left-3 z-20 pointer-events-none flex items-center gap-1.5 text-[10px] font-semibold px-2 py-1 rounded-lg ${
                  backdropTheme === 'light'
                    ? 'bg-slate-900/10 text-slate-700'
                    : 'bg-white/10 text-slate-200'
                }`}
              >
                <MousePointerClick className="w-3 h-3" />
                <span>Cliquez ou glissez pour tester à l'emplacement du curseur</span>
              </div>
            </div>

            {/* Présets & Collection Projet / Inter-projets */}
            <ParticlePresetLibrary
              mode={mode}
              currentConfig={pureEffectConfig}
              quickPresets={QUICK_PRESETS}
              onApplyConfig={(patch) => {
                update(patch);
                setCycleRestartSignal((s) => s + 1);
              }}
            />
          </div>

          {/* RIGHT: All Controls */}
          <div className="lg:col-span-6 p-4 overflow-y-auto space-y-2.5 bg-white">
            {/* Forme & Zone d'émission */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Forme des particules</span>
                <select
                  value={config.shape}
                  onChange={(e) => {
                    const nextShape = e.target.value as ParticleShape;
                    if (
                      nextShape === 'custom' &&
                      (!config.customParticleIds || config.customParticleIds.length === 0) &&
                      customParticles.length > 0
                    ) {
                      update({
                        shape: nextShape,
                        customParticleId: customParticles[0].id,
                        customParticleIds: [customParticles[0].id],
                      });
                    } else {
                      update({ shape: nextShape });
                    }
                  }}
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-800"
                >
                  <option value="circle">Rond (Bulle / Fumée)</option>
                  <option value="square">Carré (Confetti / Pixel)</option>
                  <option value="spark">Étincelle (Trait)</option>
                  <option value="star">Étoile</option>
                  <option value="custom">Particule dessinée ✨</option>
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                <span className="font-bold text-slate-700 text-xs">Zone d'apparition</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                  {[
                    { id: 'point', label: 'Point' },
                    { id: 'circle', label: 'Disque' },
                    { id: 'box', label: 'Rectangle' },
                  ].map((sh) => (
                    <button
                      key={sh.id}
                      type="button"
                      onClick={() => update({ emissionShape: sh.id as ParticleEmissionShape })}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                        (config.emissionShape || 'point') === sh.id
                          ? 'bg-white text-amber-800 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {sh.label}
                    </button>
                  ))}
                </div>
              </div>

              {config.emissionShape === 'circle' && (
                <div className="flex items-center justify-between gap-2 text-xs pt-1">
                  <span className="text-slate-600 font-semibold">Rayon du disque</span>
                  <EditableNumericValue
                    value={config.emissionRadius ?? 28}
                    unit="px"
                    precision={0}
                    onChange={(v) => update({ emissionRadius: v })}
                    className="font-mono font-bold text-amber-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg"
                  />
                </div>
              )}

              {config.emissionShape === 'box' && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="text-slate-600 font-semibold">Largeur</span>
                    <EditableNumericValue
                      value={config.emissionWidth ?? 60}
                      unit="px"
                      precision={0}
                      onChange={(v) => update({ emissionWidth: v })}
                      className="font-mono font-bold text-amber-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1 text-xs">
                    <span className="text-slate-600 font-semibold">Hauteur</span>
                    <EditableNumericValue
                      value={config.emissionHeight ?? 30}
                      unit="px"
                      precision={0}
                      onChange={(v) => update({ emissionHeight: v })}
                      className="font-mono font-bold text-amber-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Particules vectorielles personnalisées */}
            {config.shape === 'custom' && (
              <div className="p-2.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[11px] font-bold text-amber-950 block">Particules dessinées :</span>
                    <span className="text-[10px] text-amber-700/80">Cliquez pour sélectionner une ou plusieurs formes</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => openInlineDrawer(undefined)}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs shrink-0"
                  >
                    <Paintbrush className="w-3 h-3" />
                    <span>+ Dessiner</span>
                  </button>
                </div>

                {customParticles.length === 0 ? (
                  <div className="text-[11px] text-amber-800 bg-white/80 rounded-xl p-2 border border-amber-200 text-center">
                    Aucune particule dessinée. Cliquez sur <strong>+ Dessiner</strong>.
                  </div>
                ) : (
                  <div className="grid grid-cols-4 gap-1.5">
                    {customParticles.map((preset) => {
                      const selectedIds =
                        config.customParticleIds && config.customParticleIds.length > 0
                          ? config.customParticleIds
                          : config.customParticleId
                          ? [config.customParticleId]
                          : [];
                      const selIdx = selectedIds.indexOf(preset.id);
                      const isSel = selIdx >= 0;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => {
                            const nextIds = isSel
                              ? selectedIds.filter((id) => id !== preset.id)
                              : [...selectedIds, preset.id];
                            update({
                              customParticleIds: nextIds,
                              customParticleId: nextIds[0],
                            });
                          }}
                          className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            isSel
                              ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:border-amber-300'
                          }`}
                        >
                          {isSel && (
                            <span className="absolute -top-1.5 -left-1.5 min-w-4 h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-black flex items-center justify-center shadow-xs">
                              {selectedIds.length > 1 ? selIdx + 1 : '✓'}
                            </span>
                          )}
                          <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                            <svg viewBox="0 0 100 100" className="w-7 h-7">
                              {preset.vectorPaths.map((p) => (
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
                            </svg>
                          </div>
                          <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                            {preset.name}
                          </span>
                          <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center gap-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openInlineDrawer(preset);
                              }}
                              className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                              title="Modifier"
                            >
                              <Pencil className="w-2.5 h-2.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomParticle(preset.id);
                                invalidateCustomParticleSprite(preset.id);
                                const remaining = selectedIds.filter((id) => id !== preset.id);
                                update({
                                  customParticleIds: remaining,
                                  customParticleId: remaining[0],
                                });
                              }}
                              className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                              title="Supprimer"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {((config.customParticleIds?.length || 0) > 1) && (
                  <div className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-slate-700">Utilisation multiple</span>
                    <select
                      value={config.customParticleMode || 'random'}
                      onChange={(e) => update({ customParticleMode: e.target.value as CustomParticleUsageMode })}
                      className="bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 text-[11px] font-bold text-amber-900 cursor-pointer"
                    >
                      <option value="random">Aléatoire (variantes)</option>
                      <option value="sequence">Séquence (1 → 2 → 3)</option>
                      <option value="lifetime_anim">Animation sur durée de vie</option>
                    </select>
                  </div>
                )}

                <label className="flex items-center justify-between pt-1 border-t border-amber-200/70 cursor-pointer">
                  <span className="text-[11px] font-bold text-slate-700">
                    Teinter avec les couleurs d'émission
                  </span>
                  <input
                    type="checkbox"
                    checked={Boolean(config.useParticleTint)}
                    onChange={(e) => update({ useParticleTint: e.target.checked })}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            )}

            {/* Mode Couleur & Nuancier */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-700">Couleur</span>
                <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-0.5 rounded-lg text-[10px] font-bold">
                  {[
                    { id: 'single', label: '1 Couleur' },
                    { id: 'two_colors', label: 'Mix 2' },
                    { id: 'gradient_lifetime', label: 'Dégradé vie' },
                  ].map((cm) => (
                    <button
                      key={cm.id}
                      type="button"
                      onClick={() => update({ colorMode: cm.id as ParticleColorMode })}
                      className={`px-2 py-0.5 rounded-md cursor-pointer transition-all ${
                        (config.colorMode || 'single') === cm.id
                          ? 'bg-white text-indigo-700 shadow-2xs'
                          : 'text-slate-600'
                      }`}
                    >
                      {cm.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={`grid ${config.colorMode === 'single' ? 'grid-cols-1' : 'grid-cols-2'} gap-2`}>
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">
                    {config.colorMode === 'gradient_lifetime'
                      ? 'Début'
                      : config.colorMode === 'single'
                      ? 'Couleur unique'
                      : 'Couleur 1'}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-mono text-slate-500">{config.color}</span>
                    <input
                      type="color"
                      value={config.color}
                      onChange={(e) => update({ color: e.target.value })}
                      className="w-7 h-6 rounded border border-slate-300 cursor-pointer"
                    />
                  </div>
                </div>
                {config.colorMode !== 'single' && (
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-[11px] font-bold text-slate-700">
                      {config.colorMode === 'gradient_lifetime' ? 'Fin de vie' : 'Couleur 2'}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-mono text-slate-500">{config.color2}</span>
                      <input
                        type="color"
                        value={config.color2}
                        onChange={(e) => update({ color2: e.target.value })}
                        className="w-7 h-6 rounded border border-slate-300 cursor-pointer"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Débit / Quantité avec support Min-Max */}
            {mode === 'emitter' ? (
              <RangeOrFixedRow
                label="Débit d'émission"
                unit="part/s"
                precision={0}
                roundInt
                accent="amber"
                minVal={config.rate ?? 16}
                maxVal={config.rateMax}
                sliderMin={0}
                sliderMax={60}
                step={1}
                onChangeMin={(v) => update({ rate: v })}
                onChangeMax={(v) => update({ rateMax: v })}
              />
            ) : (
              <RangeOrFixedRow
                label="Nombre par salve"
                unit="part."
                precision={0}
                roundInt
                accent="amber"
                minVal={config.count ?? 22}
                maxVal={config.countMax}
                sliderMin={1}
                sliderMax={100}
                step={1}
                onChangeMin={(v) => update({ count: v })}
                onChangeMax={(v) => update({ countMax: v })}
              />
            )}

            {/* Vitesse & Taille (Min-Max) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RangeOrFixedRow
                label="Vitesse"
                unit="px/s"
                precision={0}
                minVal={config.speed}
                maxVal={config.speedMax}
                sliderMin={0}
                sliderMax={600}
                step={10}
                onChangeMin={(v) => update({ speed: v })}
                onChangeMax={(v) => update({ speedMax: v })}
              />
              <RangeOrFixedRow
                label="Taille départ"
                unit="px"
                precision={1}
                minVal={config.size}
                maxVal={config.sizeMax}
                sliderMin={1}
                sliderMax={40}
                step={1}
                onChangeMin={(v) => update({ size: v })}
                onChangeMax={(v) => update({ sizeMax: v })}
              />
            </div>

            {/* Durée de vie & Gravité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <RangeOrFixedRow
                label="Durée de vie"
                unit="s"
                precision={2}
                minVal={config.lifetime}
                maxVal={config.lifetimeMax}
                sliderMin={0.1}
                sliderMax={5.0}
                step={0.05}
                onChangeMin={(v) => update({ lifetime: v })}
                onChangeMax={(v) => update({ lifetimeMax: v })}
              />

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span className="font-bold">Gravité</span>
                  <EditableNumericValue
                    value={config.gravity}
                    unit="px/s²"
                    precision={0}
                    onChange={(v) => update({ gravity: v })}
                    className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
                  />
                </div>
                <input
                  type="range"
                  min={-400}
                  max={800}
                  step={20}
                  value={Math.max(-400, Math.min(800, config.gravity))}
                  onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* Taille fin de vie & Frottement (Drag) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span className="font-bold">Taille fin de vie</span>
                  <EditableNumericValue
                    value={config.endSizeScale ?? 0.35}
                    unit="×"
                    precision={2}
                    onChange={(v) => update({ endSizeScale: v })}
                    className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={2.5}
                  step={0.05}
                  value={Math.max(0, Math.min(2.5, config.endSizeScale ?? 0.35))}
                  onChange={(e) => update({ endSizeScale: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-700">
                  <span className="font-bold">Frottement air (Drag)</span>
                  <EditableNumericValue
                    value={config.drag ?? 0}
                    precision={2}
                    onChange={(v) => update({ drag: v })}
                    className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={6}
                  step={0.1}
                  value={Math.max(0, Math.min(6, config.drag ?? 0))}
                  onChange={(e) => update({ drag: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* Opacité début -> fin & Rotation */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-600">Opacité début</span>
                  <EditableNumericValue
                    value={config.opacityStart ?? 1}
                    precision={2}
                    onChange={(v) => update({ opacityStart: v })}
                    className="font-mono font-bold text-indigo-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-600">Opacité fin</span>
                  <EditableNumericValue
                    value={config.opacityEnd ?? 0}
                    precision={2}
                    onChange={(v) => update({ opacityEnd: v })}
                    className="font-mono font-bold text-indigo-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-center"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-600">Rotation (°/s)</span>
                  <EditableNumericValue
                    value={config.spinSpeed ?? 0}
                    unit="°/s"
                    precision={0}
                    onChange={(v) => update({ spinSpeed: v })}
                    className="font-mono font-bold text-indigo-700 bg-white border border-slate-200 px-2 py-0.5 rounded-lg text-center"
                  />
                </div>
              </div>
            </div>

            {/* Direction & Dispersion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1.5">
                <div className="flex justify-between items-center text-xs text-slate-700 gap-1">
                  <span className="font-bold">Direction</span>
                  <select
                    value={config.directionMode || 'angle'}
                    onChange={(e) => {
                      const nextMode = e.target.value as ParticleDirectionMode;
                      const patch: Partial<ParticleEditorConfig> = { directionMode: nextMode };
                      if (
                        (nextMode === 'toward_target' || nextMode === 'away_target') &&
                        !config.directionTargetMode
                      ) {
                        patch.directionTargetMode = mode === 'burst' ? 'target' : 'entity';
                        patch.directionTargetEntityId =
                          config.directionTargetEntityId || entityList[0]?.id || '';
                      }
                      update(patch);
                    }}
                    className="bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 text-[11px] font-semibold text-slate-800 max-w-[135px]"
                  >
                    <option value="angle">Angle fixe (°)</option>
                    <option value="facing">Sens de l&apos;entité</option>
                    <option value="mouse">Vers la souris</option>
                    <option value="toward_target">Vers une cible</option>
                    <option value="away_target">Opposé à cible</option>
                  </select>
                </div>

                {(config.directionMode || 'angle') === 'angle' ? (
                  <>
                    <div className="flex justify-end">
                      <EditableNumericValue
                        value={config.angle}
                        unit="°"
                        precision={0}
                        onChange={(v) => update({ angle: v })}
                        className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
                      />
                    </div>
                    <input
                      type="range"
                      min={-180}
                      max={180}
                      step={5}
                      value={Math.max(-180, Math.min(180, config.angle))}
                      onChange={(e) => update({ angle: parseFloat(e.target.value) })}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5"
                    />
                  </>
                ) : (config.directionMode === 'toward_target' || config.directionMode === 'away_target') ? (
                  <div className="space-y-1 text-[11px] pt-0.5">
                    <select
                      value={config.directionTargetMode || 'entity'}
                      onChange={(e) => update({ directionTargetMode: e.target.value as any })}
                      className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 font-medium text-slate-800"
                    >
                      {mode === 'burst' && <option value="subject">Sujet de la règle</option>}
                      {mode === 'burst' && <option value="target">Cible touchée</option>}
                      <option value="entity">Entité de la scène</option>
                      <option value="type">Par Type</option>
                      <option value="tag">Par #Tag</option>
                      {mode === 'burst' && <option value="last_spawned">Dernier objet créé</option>}
                      <option value="mouse">Curseur souris</option>
                    </select>
                    {(config.directionTargetMode || 'entity') === 'entity' && (
                      <select
                        value={config.directionTargetEntityId || entityList[0]?.id || ''}
                        onChange={(e) => update({ directionTargetEntityId: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 font-medium text-slate-800"
                      >
                        {entityList.map((ent) => (
                          <option key={ent.id} value={ent.id}>
                            {ent.name}
                          </option>
                        ))}
                      </select>
                    )}
                    {config.directionTargetMode === 'type' && (
                      <select
                        value={config.directionTargetEntityType || typeOptions[0]?.type || ''}
                        onChange={(e) => update({ directionTargetEntityType: e.target.value })}
                        className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 font-medium text-slate-800"
                      >
                        {typeOptions.map((opt) => (
                          <option key={opt.type} value={opt.type}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}
                    {config.directionTargetMode === 'tag' && (
                      <>
                        <input
                          type="text"
                          list="particle-editor-dir-tags"
                          value={config.directionTargetTag || ''}
                          onChange={(e) =>
                            update({ directionTargetTag: e.target.value.replace(/^#/, '') })
                          }
                          placeholder="#tag"
                          className="w-full bg-white border border-slate-300 rounded-lg px-1.5 py-0.5 font-medium text-slate-800"
                        />
                        <datalist id="particle-editor-dir-tags">
                          {allTags.map((t) => (
                            <option key={t} value={t} />
                          ))}
                        </datalist>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="text-[10px] text-slate-500 italic pt-1">
                    {config.directionMode === 'facing'
                      ? 'Suit la rotation / flipX de l’émetteur en jeu.'
                      : 'Vise dynamiquement le curseur en jeu.'}
                  </div>
                )}
              </div>

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Dispersion (Cône)</span>
                  <EditableNumericValue
                    value={config.spread}
                    unit="°"
                    precision={0}
                    onChange={(v) => update({ spread: v })}
                    className="font-mono font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
                  />
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={Math.max(0, Math.min(360, config.spread))}
                  onChange={(e) => update({ spread: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer h-1.5"
                />
              </div>
            </div>

            {/* Émetteur continu : Durée, Boucle, Salves, Ancrage & Décalage */}
            {mode === 'emitter' && (
              <div className="p-2.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2">
                <span className="text-[11px] font-extrabold text-amber-950 block">
                  Cycle, Salves &amp; Point d'ancrage
                </span>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                    <span className="font-bold text-slate-700 text-[11px]">Durée (0 = ∞)</span>
                    <EditableNumericValue
                      value={config.emitterDuration ?? 0}
                      unit="s"
                      precision={1}
                      onChange={(v) => update({ emitterDuration: v })}
                      className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]"
                    />
                  </div>
                  <label className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1 cursor-pointer">
                    <span className="font-bold text-slate-700 text-[11px]">Boucler cycle</span>
                    <input
                      type="checkbox"
                      checked={config.emitterLoop !== false}
                      onChange={(e) => update({ emitterLoop: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-1.5 text-xs">
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-500">Salve départ</span>
                    <EditableNumericValue
                      value={config.initialBurstCount ?? 0}
                      precision={0}
                      onChange={(v) => update({ initialBurstCount: Math.round(v) })}
                      className="font-mono font-bold text-amber-700 text-[11px]"
                    />
                  </div>
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-500">Salve tous les</span>
                    <EditableNumericValue
                      value={config.burstInterval ?? 0}
                      unit="s"
                      precision={2}
                      onChange={(v) => update({ burstInterval: v })}
                      className="font-mono font-bold text-amber-700 text-[11px]"
                    />
                  </div>
                  <div className="p-1.5 bg-white rounded-xl border border-slate-200 flex flex-col gap-0.5">
                    <span className="text-[9px] font-bold text-slate-500">Nb / salve</span>
                    <EditableNumericValue
                      value={config.burstCount ?? 12}
                      precision={0}
                      onChange={(v) => update({ burstCount: Math.round(v) })}
                      className="font-mono font-bold text-amber-700 text-[11px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-slate-700">Ancre</span>
                    <select
                      value={config.anchor || 'center'}
                      onChange={(e) => update({ anchor: e.target.value as ParticleAnchorPreset })}
                      className="bg-slate-50 border border-slate-300 rounded-lg px-1.5 py-0.5 text-[11px] font-bold text-slate-800"
                    >
                      <option value="center">Centre</option>
                      <option value="top">Haut</option>
                      <option value="bottom">Bas</option>
                      <option value="left">Gauche</option>
                      <option value="right">Droite</option>
                      <option value="pivot">Pivot</option>
                    </select>
                  </div>
                  <label className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1 cursor-pointer">
                    <span className="text-[11px] font-bold text-slate-700">Suivre rot./flip</span>
                    <input
                      type="checkbox"
                      checked={config.followRotation !== false}
                      onChange={(e) => update({ followRotation: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </label>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Décalage ΔX</span>
                    <EditableNumericValue
                      value={config.offsetX ?? 0}
                      unit="px"
                      precision={0}
                      onChange={(v) => update({ offsetX: v })}
                      className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
                    />
                  </div>
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700">Décalage ΔY</span>
                    <EditableNumericValue
                      value={config.offsetY ?? 0}
                      unit="px"
                      precision={0}
                      onChange={(v) => update({ offsetY: v })}
                      className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
                    />
                  </div>
                </div>
              </div>
            )}
            {/* Événement (mode burst) : Source, Ancrage & Émission temporisée */}
            {mode === 'burst' && (
              <div className="p-2.5 bg-amber-50/50 rounded-2xl border border-amber-200/80 space-y-2">
                <span className="text-[11px] font-extrabold text-amber-950 block">
                  Source, Ancrage &amp; Émission temporisée
                </span>

                <ParticleActionOriginSection
                  draft={config}
                  allowTarget={allowTarget}
                  entities={entities}
                  availableEntityOptions={availableEntityOptions}
                  allProjectTags={allTags}
                  datalistId="particle-studio-origin-tags"
                  hideSavedCollection={true}
                  onPatch={(patch) => update(patch as Partial<ParticleEditorConfig>)}
                />

                <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <span className="font-bold text-slate-700 text-xs block">
                        Durée d&apos;émission (0 = salve unique)
                      </span>
                      <span className="text-[10px] text-slate-400">
                        &gt; 0s : jet continu et/ou plusieurs salves temporisées
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <EditableNumericValue
                        value={config.particleEmitDuration ?? 0}
                        unit="s"
                        precision={1}
                        onChange={(v) => update({ particleEmitDuration: Math.max(0, v) })}
                        className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg text-xs"
                      />
                    </div>
                  </div>

                  {(config.particleEmitDuration ?? 0) > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
                      <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Débit (part/s)</span>
                        <EditableNumericValue
                          value={config.particleEmitRate ?? 20}
                          precision={0}
                          onChange={(v) => update({ particleEmitRate: Math.max(0, v) })}
                          className="font-mono font-bold text-amber-800 text-[11px]"
                        />
                      </div>
                      <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Salve tous les</span>
                        <EditableNumericValue
                          value={config.particleBurstInterval ?? 0}
                          unit="s"
                          precision={2}
                          onChange={(v) => update({ particleBurstInterval: Math.max(0, v) })}
                          className="font-mono font-bold text-amber-800 text-[11px]"
                        />
                      </div>
                      <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
                        <span className="text-[10px] font-bold text-slate-600">Nb / salve</span>
                        <EditableNumericValue
                          value={config.particleBurstCount ?? (config.count ?? 12)}
                          precision={0}
                          onChange={(v) => update({ particleBurstCount: Math.max(0, Math.round(v)) })}
                          className="font-mono font-bold text-amber-800 text-[11px]"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
        )}
      </div>
    </div>,
    document.body
  );
}
