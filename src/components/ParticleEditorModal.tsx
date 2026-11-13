import React, { useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { CustomParticlePreset, ParticleShape } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import {
  createParticlePool,
  invalidateCustomParticleSprite,
  syncCustomParticlePresets,
} from '../utils/particleSystem';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';

export interface ParticleEditorConfig {
  shape: ParticleShape;
  customParticleId?: string;
  useParticleTint?: boolean;
  color: string;
  color2: string;
  rate?: number;     // mode === 'emitter'
  count?: number;    // mode === 'burst'
  speed: number;
  size: number;
  lifetime: number;
  gravity: number;
  spread: number;
  angle: number;
  offsetX?: number;
  offsetY?: number;
}

interface ParticleEditorModalProps {
  isOpen: boolean;
  mode: 'emitter' | 'burst';
  initialConfig: Partial<ParticleEditorConfig>;
  onApply: (config: ParticleEditorConfig) => void;
  onClose: () => void;
}

interface QuickPresetItem {
  id: string;
  label: string;
  config: Partial<ParticleEditorConfig>;
}

const QUICK_PRESETS: QuickPresetItem[] = [
  {
    id: 'fire',
    label: 'Feu & Braises',
    config: {
      shape: 'circle',
      color: '#f97316',
      color2: '#facc15',
      rate: 26,
      count: 28,
      speed: 120,
      size: 9,
      lifetime: 0.75,
      gravity: -160,
      spread: 45,
      angle: -90,
    },
  },
  {
    id: 'explosion',
    label: 'Explosion',
    config: {
      shape: 'spark',
      color: '#ef4444',
      color2: '#fbbf24',
      rate: 32,
      count: 40,
      speed: 280,
      size: 8,
      lifetime: 0.65,
      gravity: 180,
      spread: 360,
      angle: 0,
    },
  },
  {
    id: 'sparks',
    label: 'Étincelles',
    config: {
      shape: 'spark',
      color: '#38bdf8',
      color2: '#a855f7',
      rate: 22,
      count: 24,
      speed: 240,
      size: 6,
      lifetime: 0.55,
      gravity: 340,
      spread: 110,
      angle: -90,
    },
  },
  {
    id: 'smoke',
    label: 'Fumée douce',
    config: {
      shape: 'circle',
      color: '#94a3b8',
      color2: '#e2e8f0',
      rate: 10,
      count: 16,
      speed: 55,
      size: 15,
      lifetime: 1.5,
      gravity: -45,
      spread: 35,
      angle: -90,
    },
  },
  {
    id: 'stars',
    label: 'Magie / Étoiles',
    config: {
      shape: 'star',
      color: '#facc15',
      color2: '#ec4899',
      rate: 16,
      count: 22,
      speed: 140,
      size: 9,
      lifetime: 1.0,
      gravity: 40,
      spread: 360,
      angle: -90,
    },
  },
  {
    id: 'confetti',
    label: 'Confettis',
    config: {
      shape: 'square',
      color: '#22c55e',
      color2: '#3b82f6',
      rate: 28,
      count: 42,
      speed: 230,
      size: 7,
      lifetime: 1.4,
      gravity: 260,
      spread: 120,
      angle: -90,
    },
  },
];

export function ParticleEditorModal({
  isOpen,
  mode,
  initialConfig,
  onApply,
  onClose,
}: ParticleEditorModalProps) {
  const customParticles = useSceneStore((state) => state.customParticles || []);
  const addCustomParticle = useSceneStore((state) => state.addCustomParticle);
  const updateCustomParticle = useSceneStore((state) => state.updateCustomParticle);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);

  const [config, setConfig] = useState<ParticleEditorConfig>(() => ({
    shape: initialConfig.shape || 'circle',
    customParticleId: initialConfig.customParticleId,
    useParticleTint: Boolean(initialConfig.useParticleTint),
    color: initialConfig.color || '#f59e0b',
    color2: initialConfig.color2 || initialConfig.color || '#ef4444',
    rate: initialConfig.rate ?? 16,
    count: initialConfig.count ?? 22,
    speed: initialConfig.speed ?? 160,
    size: initialConfig.size ?? 7,
    lifetime: initialConfig.lifetime ?? 0.8,
    gravity: initialConfig.gravity ?? 180,
    spread: initialConfig.spread ?? (mode === 'burst' ? 360 : 60),
    angle: initialConfig.angle ?? -90,
    offsetX: initialConfig.offsetX ?? 0,
    offsetY: initialConfig.offsetY ?? 0,
  }));

  const [isAutoEmitting, setIsAutoEmitting] = useState(true);
  const [backdropTheme, setBackdropTheme] = useState<'dark' | 'light' | 'grid'>('dark');
  const [drawerTarget, setDrawerTarget] = useState<{ editingPreset?: CustomParticlePreset } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const poolRef = useRef(createParticlePool(260));
  const configRef = useRef(config);
  const isAutoRef = useRef(isAutoEmitting);
  const isPointerDownRef = useRef(false);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  useEffect(() => {
    isAutoRef.current = isAutoEmitting;
  }, [isAutoEmitting]);

  useEffect(() => {
    syncCustomParticlePresets(customParticles);
  }, [customParticles]);

  // Boucle de simulation Canvas 2D isolée à l'éditeur
  useEffect(() => {
    if (!isOpen) return;
    let rafId = 0;
    let lastTime = performance.now();
    let emitAcc = 0;
    let burstTimer = 0.6; // lance une 1re salve rapidement à l'ouverture

    const STAGE_W = 480;
    const STAGE_H = 340;
    const ORIGIN_X = STAGE_W / 2;
    const ORIGIN_Y = STAGE_H * 0.56;

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const cfg = configRef.current;
      const pool = poolRef.current;

      if (isAutoRef.current) {
        if (mode === 'emitter') {
          const rate = Math.max(1, cfg.rate ?? 16);
          emitAcc += rate * dt;
          const whole = Math.floor(emitAcc);
          if (whole > 0) {
            emitAcc -= whole;
            pool.emitBurst({
              x: ORIGIN_X,
              y: ORIGIN_Y,
              count: Math.min(12, whole),
              color: cfg.color,
              color2: cfg.color2,
              shape: cfg.shape,
              customParticleId: cfg.customParticleId,
              useTint: cfg.useParticleTint,
              speed: cfg.speed,
              size: cfg.size,
              lifetime: cfg.lifetime,
              gravity: cfg.gravity,
              spread: cfg.spread,
              angle: cfg.angle,
            });
          }
        } else {
          burstTimer += dt;
          const interval = Math.max(0.7, Math.min(2.2, cfg.lifetime + 0.35));
          if (burstTimer >= interval) {
            burstTimer = 0;
            pool.emitBurst({
              x: ORIGIN_X,
              y: ORIGIN_Y,
              count: cfg.count ?? 22,
              color: cfg.color,
              color2: cfg.color2,
              shape: cfg.shape,
              customParticleId: cfg.customParticleId,
              useTint: cfg.useParticleTint,
              speed: cfg.speed,
              size: cfg.size,
              lifetime: cfg.lifetime,
              gravity: cfg.gravity,
              spread: cfg.spread,
              angle: cfg.angle,
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
      color: cfg.color,
      color2: cfg.color2,
      shape: cfg.shape,
      customParticleId: cfg.customParticleId,
      useTint: cfg.useParticleTint,
      speed: cfg.speed,
      size: cfg.size,
      lifetime: cfg.lifetime,
      gravity: cfg.gravity,
      spread: cfg.spread,
      angle: cfg.angle,
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

  // Calcul des lignes SVG d'aperçu du cône d'angle sur le stage
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

  return createPortal(
    <div
      className="fixed inset-0 z-[10000] bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 select-none"
      style={{ isolation: 'isolate' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-5xl w-full shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-100 border border-amber-200 text-amber-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-black text-slate-800 tracking-tight">
                Éditeur & Testeur de Particules
              </h2>
              <p className="text-[11px] text-slate-500">
                {mode === 'emitter'
                  ? 'Prévisualisez et ajustez le flux continu en temps réel'
                  : 'Testez les salves de particules (cliquez sur la scène de test pour émettre)'}
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

        {/* Body: Left Stage + Right Controls */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-0">
          {/* LEFT: Live Interactive Stage */}
          <div className="lg:col-span-6 p-4 bg-slate-100/70 border-b lg:border-b-0 lg:border-r border-slate-200 flex flex-col gap-3">
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
              className={`relative w-full aspect-[480/340] rounded-2xl border overflow-hidden shadow-inner ${
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
              {/* Cone & Angle visual indicator */}
              <svg
                viewBox="0 0 480 340"
                className="absolute inset-0 w-full h-full pointer-events-none opacity-45"
              >
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
                <circle cx={originX} cy={originY} r="4" fill="#f59e0b" opacity="0.7" />
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
                    shape: config.shape,
                    customParticleId: config.customParticleId,
                    useTint: config.useParticleTint,
                    speed: config.speed,
                    size: config.size,
                    lifetime: config.lifetime,
                    gravity: config.gravity,
                    spread: config.spread,
                    angle: config.angle,
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

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 block">
                Présets rapides
              </span>
              <div className="grid grid-cols-3 gap-1.5">
                {QUICK_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => update(preset.config)}
                    className="px-2.5 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-[11px] font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5 truncate"
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                      style={{
                        background: `linear-gradient(135deg, ${preset.config.color}, ${preset.config.color2})`,
                      }}
                    />
                    <span className="truncate">{preset.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: All Controls */}
          <div className="lg:col-span-6 p-4 overflow-y-auto space-y-2.5 bg-white">
            {/* Forme */}
            <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Forme des particules</span>
              <select
                value={config.shape}
                onChange={(e) => {
                  const nextShape = e.target.value as ParticleShape;
                  if (nextShape === 'custom' && !config.customParticleId && customParticles.length > 0) {
                    update({ shape: nextShape, customParticleId: customParticles[0].id });
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

            {/* Particule vectorielle personnalisée */}
            {config.shape === 'custom' && (
              <div className="p-2.5 bg-amber-50/70 rounded-2xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-amber-950">Particule vectorielle :</span>
                  <button
                    type="button"
                    onClick={() => setDrawerTarget({})}
                    className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
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
                      const isSel = config.customParticleId === preset.id;
                      return (
                        <div
                          key={preset.id}
                          onClick={() => update({ customParticleId: preset.id })}
                          className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                            isSel
                              ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                              : 'bg-white/80 border-slate-200 hover:border-amber-300'
                          }`}
                        >
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
                                setDrawerTarget({ editingPreset: preset });
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
                                if (isSel) update({ customParticleId: undefined });
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

            {/* Couleurs Mix */}
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Couleur 1</span>
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
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Couleur 2</span>
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
            </div>

            {/* Débit ou Quantité */}
            {mode === 'emitter' ? (
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Débit d'émission</span>
                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {config.rate ?? 16} part/s
                  </span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={60}
                  step={1}
                  value={config.rate ?? 16}
                  onChange={(e) => update({ rate: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            ) : (
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Nombre par salve</span>
                  <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                    {config.count ?? 22} part.
                  </span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={80}
                  step={1}
                  value={config.count ?? 22}
                  onChange={(e) => update({ count: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-500 cursor-pointer"
                />
              </div>
            )}

            {/* Vitesse & Taille */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Vitesse</span>
                  <span className="font-mono font-bold text-indigo-600">{config.speed} px/s</span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={600}
                  step={10}
                  value={config.speed}
                  onChange={(e) => update({ speed: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Taille</span>
                  <span className="font-mono font-bold text-indigo-600">{config.size} px</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={32}
                  step={1}
                  value={config.size}
                  onChange={(e) => update({ size: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Durée de vie & Gravité */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Durée de vie</span>
                  <span className="font-mono font-bold text-indigo-600">{config.lifetime.toFixed(1)} s</span>
                </div>
                <input
                  type="range"
                  min={0.15}
                  max={3.5}
                  step={0.05}
                  value={config.lifetime}
                  onChange={(e) => update({ lifetime: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Gravité</span>
                  <span className="font-mono font-bold text-indigo-600">{config.gravity} px/s²</span>
                </div>
                <input
                  type="range"
                  min={-400}
                  max={800}
                  step={20}
                  value={config.gravity}
                  onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {/* Angle & Dispersion */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Direction</span>
                  <span className="font-mono font-bold text-indigo-600">{config.angle}°</span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={5}
                  value={config.angle}
                  onChange={(e) => update({ angle: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>

              <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <span className="font-bold">Dispersion (Cône)</span>
                  <span className="font-mono font-bold text-indigo-600">{config.spread}°</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={360}
                  step={5}
                  value={config.spread}
                  onChange={(e) => update({ spread: parseFloat(e.target.value) })}
                  className="w-full accent-indigo-600 cursor-pointer"
                />
              </div>
            </div>

            {mode === 'emitter' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Décalage ΔX</span>
                  <input
                    type="number"
                    value={config.offsetX ?? 0}
                    onChange={(e) => update({ offsetX: parseFloat(e.target.value) || 0 })}
                    className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                </div>
                <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Décalage ΔY</span>
                  <input
                    type="number"
                    value={config.offsetY ?? 0}
                    onChange={(e) => update({ offsetY: parseFloat(e.target.value) || 0 })}
                    className="w-20 bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Atelier de dessin plein écran pour particule custom */}
      {drawerTarget && (
        <FullScreenDrawingModal
          title={
            drawerTarget.editingPreset
              ? `Modifier particule : ${drawerTarget.editingPreset.name}`
              : 'Dessiner une particule'
          }
          subtitle="Dessinez votre particule personnalisée"
          initialPaths={drawerTarget.editingPreset?.vectorPaths || []}
          currentEditingStateName={
            drawerTarget.editingPreset?.name || `Particule ${customParticles.length + 1}`
          }
          onSave={(paths, _dataUrl, _colliderType, customName) => {
            const finalName = (customName || '').trim() || `Particule ${customParticles.length + 1}`;
            let targetPresetId = drawerTarget.editingPreset?.id;
            if (targetPresetId) {
              updateCustomParticle(targetPresetId, {
                name: finalName,
                vectorPaths: paths,
              });
              invalidateCustomParticleSprite(targetPresetId);
            } else {
              targetPresetId = addCustomParticle({
                name: finalName,
                vectorPaths: paths,
                useTint: false,
              });
            }
            update({ shape: 'custom', customParticleId: targetPresetId });
            setDrawerTarget(null);
          }}
          onClose={() => setDrawerTarget(null)}
        />
      )}
    </div>,
    document.body
  );
}
