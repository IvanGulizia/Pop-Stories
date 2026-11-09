import React, { useState, useRef } from 'react';
import { Entity, Size, SpawnLocationMode } from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
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
} from 'lucide-react';

export interface SpawnConfigData {
  spawnLocationMode: SpawnLocationMode;
  spawnOffset?: { x: number; y: number };
  spawnAbsoluteCoords?: { x: number; y: number };
  spawnPosition?: { x: number; y: number };
  spawnSizeMode?: 'default' | 'match_target' | 'match_subject' | 'custom';
  spawnScaleMultiplier?: number;
  spawnCustomSize?: Size;
}

interface SpawnLocationPickerProps {
  isCollision: boolean;
  subjectEntity?: Entity;
  targetEntity?: Entity;
  spawnEntity?: Entity;
  initialMode?: SpawnLocationMode;
  initialOffset?: { x: number; y: number };
  initialAbsoluteCoords?: { x: number; y: number };
  initialSizeMode?: 'default' | 'match_target' | 'match_subject' | 'custom';
  initialScaleMultiplier?: number;
  initialCustomSize?: Size;
  onConfirm: (data: SpawnConfigData) => void;
  onCancel?: () => void;
}

export function SpawnLocationPicker({
  isCollision,
  subjectEntity,
  targetEntity,
  spawnEntity,
  initialMode = isCollision ? 'at_target' : 'at_subject',
  initialOffset = { x: 50, y: 0 },
  initialAbsoluteCoords = { x: 300, y: 200 },
  initialSizeMode = 'default',
  initialScaleMultiplier = 1,
  initialCustomSize,
  onConfirm,
  onCancel,
}: SpawnLocationPickerProps) {
  const [activeTab, setActiveTab] = useState<'location' | 'size'>('location');
  const [mode, setMode] = useState<SpawnLocationMode>(initialMode);
  const [offset, setOffset] = useState<{ x: number; y: number }>(initialOffset);
  const [absoluteCoords, setAbsoluteCoords] = useState<{ x: number; y: number }>(initialAbsoluteCoords);

  // Sizing states
  const [sizeMode, setSizeMode] = useState<'default' | 'match_target' | 'match_subject' | 'custom'>(initialSizeMode);
  const [scaleMultiplier, setScaleMultiplier] = useState<number>(initialScaleMultiplier);
  const [customSize, setCustomSize] = useState<Size>(
    initialCustomSize || spawnEntity?.size || { width: 256, height: 256 }
  );

  const canvasRef = useRef<HTMLDivElement>(null);
  const relativeBoxRef = useRef<HTMLDivElement>(null);

  // Compute calculated spawn size
  const defaultSpawnWidth = spawnEntity?.size.width || 256;
  const defaultSpawnHeight = spawnEntity?.size.height || 256;

  let calculatedSpawnWidth = defaultSpawnWidth;
  let calculatedSpawnHeight = defaultSpawnHeight;

  if (sizeMode === 'match_target' && targetEntity) {
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

  // Handle absolute canvas click/drag
  const handleAbsoluteCanvasClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Scale to a standard 800x500 virtual scene space
    const sceneX = Math.round(Math.max(10, Math.min(800, (clickX / rect.width) * 800)));
    const sceneY = Math.round(Math.max(10, Math.min(500, (clickY / rect.height) * 500)));

    setAbsoluteCoords({ x: sceneX, y: sceneY });
  };

  // Handle relative offset box click/drag
  const handleRelativeBoxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!relativeBoxRef.current) return;
    const rect = relativeBoxRef.current.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    const scaleFactor = 1.2;
    const dx = Math.round((clickX - centerX) * scaleFactor);
    const dy = Math.round((clickY - centerY) * scaleFactor);

    setOffset({ x: dx, y: dy });
  };

  const handleApply = () => {
    onConfirm({
      spawnLocationMode: mode,
      spawnOffset: mode.startsWith('offset') ? offset : undefined,
      spawnAbsoluteCoords: mode === 'absolute' ? absoluteCoords : undefined,
      spawnPosition: mode === 'absolute' ? absoluteCoords : undefined,
      spawnSizeMode: sizeMode,
      spawnScaleMultiplier: scaleMultiplier,
      spawnCustomSize: sizeMode === 'custom' ? customSize : undefined,
    });
  };

  return (
    <div className="space-y-4 flex flex-col h-full overflow-y-auto pr-1">
      {/* Top Tabs: Emplacement vs Taille */}
      <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-2xl border border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('location')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'location'
              ? 'bg-white text-amber-700 shadow-xs border border-amber-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <MapPin className="w-3.5 h-3.5" />
          <span>1. Emplacement ({mode.startsWith('offset') ? 'Décalé' : mode === 'absolute' ? 'Fixe' : mode === 'random' ? 'Aléatoire' : 'Direct'})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('size')}
          className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            activeTab === 'size'
              ? 'bg-white text-indigo-700 shadow-xs border border-indigo-200/60'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Maximize2 className="w-3.5 h-3.5" />
          <span>
            2. Taille ({calculatedSpawnWidth}x{calculatedSpawnHeight}px)
          </span>
        </button>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LOCATION PICKER */}
      {/* ========================================================================= */}
      {activeTab === 'location' && (
        <div className="space-y-4">
          {/* Category selector pills */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {isCollision && (
              <button
                type="button"
                onClick={() => setMode('at_target')}
                className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                  mode === 'at_target'
                    ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <Target className="w-4 h-4 shrink-0" />
                <span>Sur la Cible</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setMode('at_subject')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                mode === 'at_subject'
                  ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <MapPin className="w-4 h-4 shrink-0" />
              <span>Sur le Sujet</span>
            </button>

            <button
              type="button"
              onClick={() => setMode(isCollision ? 'offset_target' : 'offset_subject')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                mode.startsWith('offset')
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
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                mode === 'absolute'
                  ? 'bg-emerald-600 text-white border-emerald-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>Point Fixe (Canvas)</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('random')}
              className={`p-2.5 rounded-2xl border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-all ${
                mode === 'random'
                  ? 'bg-purple-600 text-white border-purple-700 shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
              }`}
            >
              <Shuffle className="w-4 h-4 shrink-0" />
              <span>Aléatoire</span>
            </button>
          </div>

          {/* 1. AT TARGET / AT SUBJECT */}
          {(mode === 'at_target' || mode === 'at_subject') && (
            <div className="p-6 bg-amber-50/60 border-2 border-amber-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-amber-300 flex items-center justify-center shadow-xs">
                <EntityMiniPreview
                  entity={mode === 'at_target' ? targetEntity : subjectEntity}
                  type={mode === 'at_target' ? targetEntity?.type : subjectEntity?.type}
                  size={52}
                />
              </div>
              <div>
                <h4 className="text-sm font-black text-amber-950">
                  Apparition directe et centrée sur {mode === 'at_target' ? 'la cible touchée' : 'le sujet actif'}
                </h4>
                <p className="text-xs text-amber-700/80 mt-1 max-w-sm">
                  Le point d'ancrage s'adapte pour que le centre du nouvel objet ({calculatedSpawnWidth}x{calculatedSpawnHeight}px) corresponde exactement au centre de l'émetteur.
                </p>
              </div>
            </div>
          )}

          {/* 2. RELATIVE OFFSET (Interactive box with marker + inputs) */}
          {mode.startsWith('offset') && (
            <div className="space-y-3">
              {/* Anchor Switcher: Sujet vs Cible */}
              <div className="flex items-center justify-between gap-2 flex-wrap bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5 ml-1">
                  <Crosshair className="w-4 h-4 text-indigo-600" />
                  Ancre de référence :
                </span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setMode('offset_subject')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      mode === 'offset_subject'
                        ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    👤 Sujet ({subjectEntity?.name || 'Sujet'})
                  </button>
                  {isCollision && targetEntity && (
                    <button
                      type="button"
                      onClick={() => setMode('offset_target')}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        mode === 'offset_target'
                          ? 'bg-amber-600 text-white border-amber-700 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      🎯 Cible ({targetEntity?.name || 'Cible'})
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-600">
                  Cliquez ou glissez pour orienter la direction d'apparition :
                </span>
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                  ΔX: {offset.x > 0 ? `+${offset.x}` : offset.x}px | ΔY: {offset.y > 0 ? `+${offset.y}` : offset.y}px
                </span>
              </div>

              {/* Interactive relative plane with WHITE background & clear superposition preview */}
              <div
                ref={relativeBoxRef}
                onClick={handleRelativeBoxClick}
                className="relative w-full h-64 sm:h-72 bg-white rounded-3xl border-2 border-slate-300 overflow-hidden cursor-crosshair select-none flex items-center justify-center shadow-inner"
                style={{
                  backgroundImage: 'radial-gradient(circle, #cbd5e1 1.5px, transparent 1.5px)',
                  backgroundSize: '20px 20px',
                }}
              >
                {/* Center axes */}
                <div className="absolute inset-x-0 top-1/2 h-px bg-slate-300 border-dashed" />
                <div className="absolute inset-y-0 left-1/2 w-px bg-slate-300 border-dashed" />

                {/* Center Reference Entity (Anchor: Sujet ou Cible) */}
                <div className="relative z-10 flex flex-col items-center pointer-events-none">
                  <div className="w-20 h-20 rounded-2xl bg-slate-50 border-2 border-slate-300 flex items-center justify-center p-1.5 shadow-md">
                    <EntityMiniPreview
                      entity={mode === 'offset_target' ? targetEntity : subjectEntity}
                      type={mode === 'offset_target' ? targetEntity?.type : subjectEntity?.type}
                      size={60}
                    />
                  </div>
                  <span className="text-[10px] font-black text-slate-700 bg-white/90 border border-slate-200 px-2 py-0.5 rounded-full shadow-2xs mt-1">
                    Ancre : {mode === 'offset_target' ? 'Cible' : 'Sujet'}
                  </span>
                </div>

                {/* Distance line connecting center to spawn */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  <line
                    x1="50%"
                    y1="50%"
                    x2={`calc(50% + ${adjustedOffsetX / 1.2}px)`}
                    y2={`calc(50% + ${adjustedOffsetY / 1.2}px)`}
                    stroke="#6366f1"
                    strokeWidth="2.5"
                    strokeDasharray="5 5"
                  />
                </svg>

                {/* Target Spawn Marker Pin with transparent superposition preview */}
                <div
                  className="absolute z-20 pointer-events-none transition-all duration-75 flex flex-col items-center -translate-x-1/2 -translate-y-1/2"
                  style={{
                    left: `calc(50% + ${adjustedOffsetX / 1.2}px)`,
                    top: `calc(50% + ${adjustedOffsetY / 1.2}px)`,
                  }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="w-20 h-20 rounded-2xl bg-indigo-500/20 border-2 border-indigo-600 backdrop-blur-2xs opacity-75 shadow-lg flex items-center justify-center p-1 overflow-hidden">
                      <EntityMiniPreview entity={spawnEntity} type={spawnEntity?.type} size={56} />
                    </div>
                  </div>
                  <span className="text-[10px] font-black text-indigo-950 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-full shadow-xs mt-1 whitespace-nowrap">
                    Objet Créé ({adjustedOffsetX}, {adjustedOffsetY}) • {calculatedSpawnWidth}x{calculatedSpawnHeight}px
                  </span>
                </div>
              </div>

              {/* Quick preset buttons */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Raccourcis :</span>
                {[
                  { label: 'Au-dessus', icon: ArrowUp, x: 0, y: -60 },
                  { label: 'En-dessous', icon: ArrowDown, x: 0, y: 60 },
                  { label: 'À droite (Devant)', icon: ArrowRight, x: 60, y: 0 },
                  { label: 'À gauche (Derrière)', icon: ArrowLeft, x: -60, y: 0 },
                  { label: 'Au centre (0, 0)', icon: Target, x: 0, y: 0 },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    type="button"
                    onClick={() => setOffset({ x: preset.x, y: preset.y })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all flex items-center gap-1 cursor-pointer"
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
                    Décalage Horizontal de base (ΔX px) :
                  </label>
                  <input
                    type="number"
                    value={offset.x}
                    onChange={(e) => setOffset({ ...offset, x: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">
                    Décalage Vertical de base (ΔY px) :
                  </label>
                  <input
                    type="number"
                    value={offset.y}
                    onChange={(e) => setOffset({ ...offset, y: parseInt(e.target.value) || 0 })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. ABSOLUTE CANVAS POSITION */}
          {mode === 'absolute' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Crosshair className="w-4 h-4 text-emerald-600" />
                  Cliquez sur la scène pour poser le point d'ancrage fixe :
                </span>
                <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-lg border border-emerald-200">
                  X: {absoluteCoords.x}px | Y: {absoluteCoords.y}px
                </span>
              </div>

              <div
                ref={canvasRef}
                onClick={handleAbsoluteCanvasClick}
                className="relative w-full h-48 bg-slate-900 rounded-2xl border-2 border-emerald-400 overflow-hidden cursor-crosshair select-none shadow-inner"
                style={{
                  backgroundImage: 'radial-gradient(circle, #334155 1.5px, transparent 1.5px)',
                  backgroundSize: '20px 20px',
                }}
              >
                <div
                  className="absolute top-0 bottom-0 w-px bg-emerald-500/30 pointer-events-none"
                  style={{ left: `${(absoluteCoords.x / 800) * 100}%` }}
                />
                <div
                  className="absolute left-0 right-0 h-px bg-emerald-500/30 pointer-events-none"
                  style={{ top: `${(absoluteCoords.y / 500) * 100}%` }}
                />

                <div
                  className="absolute pointer-events-none -translate-x-1/2 -translate-y-1/2 flex flex-col items-center transition-all duration-75"
                  style={{
                    left: `${(absoluteCoords.x / 800) * 100}%`,
                    top: `${(absoluteCoords.y / 500) * 100}%`,
                  }}
                >
                  <div className="w-8 h-8 rounded-full bg-emerald-500/40 border-2 border-emerald-400 animate-ping absolute" />
                  <div className="w-7 h-7 rounded-full bg-emerald-500 border-2 border-white shadow-xl flex items-center justify-center text-white text-xs font-bold">
                    📍
                  </div>
                  <span className="text-[10px] font-black text-emerald-300 bg-slate-950/90 px-1.5 py-0.5 rounded shadow-xs mt-0.5 whitespace-nowrap">
                    X: {absoluteCoords.x}, Y: {absoluteCoords.y}
                  </span>
                </div>
              </div>

              {/* Quick presets */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-bold text-slate-400 mr-1">Position rapide :</span>
                {[
                  { label: 'Centre Scène', x: 400, y: 250 },
                  { label: 'Haut-Gauche', x: 80, y: 80 },
                  { label: 'Haut-Droite', x: 720, y: 80 },
                  { label: 'Bas-Centre', x: 400, y: 440 },
                ].map((p) => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => setAbsoluteCoords({ x: p.x, y: p.y })}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-600 transition-all cursor-pointer"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 4. RANDOM LOCATION */}
          {mode === 'random' && (
            <div className="p-6 bg-purple-50/60 border-2 border-purple-200 rounded-3xl flex flex-col items-center justify-center gap-3 text-center">
              <div className="w-16 h-16 rounded-2xl bg-white border border-purple-300 flex items-center justify-center text-3xl shadow-xs">
                🎲
              </div>
              <div>
                <h4 className="text-sm font-black text-purple-950">Position Aléatoire</h4>
                <p className="text-xs text-purple-700/80 mt-1 max-w-sm">
                  L'entité apparaîtra à des coordonnées aléatoires différentes sur le plateau à chaque déclenchement.
                </p>
              </div>
            </div>
          )}
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
            {/* Mode 1: Taille normale / par défaut */}
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
              <div className="text-[10px] text-slate-500">
                {defaultSpawnWidth}x{defaultSpawnHeight}px (standard)
              </div>
            </button>

            {/* Mode 2: Relative à la cible (si cible disponible) */}
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
                <div className="text-xs font-bold text-slate-900">🎯 Relative Cible</div>
                <div className="text-[10px] text-slate-500">
                  Basée sur {targetEntity.name} ({targetEntity.size.width}x{targetEntity.size.height}px)
                </div>
              </button>
            )}

            {/* Mode 3: Relative au sujet */}
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
                <div className="text-xs font-bold text-slate-900">👤 Relative Sujet</div>
                <div className="text-[10px] text-slate-500">
                  Basée sur {subjectEntity.name} ({subjectEntity.size.width}x{subjectEntity.size.height}px)
                </div>
              </button>
            )}

            {/* Mode 4: Taille manuelle définie */}
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

          {/* Multiplier / Factor settings for relative or default modes */}
          {sizeMode !== 'custom' && (
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-indigo-600" />
                  Multiplicateur d'échelle :
                </span>
                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-lg border border-indigo-200">
                  {scaleMultiplier}x (Résultat : {calculatedSpawnWidth}x{calculatedSpawnHeight}px)
                </span>
              </div>

              {/* Multiplier Quick Pills */}
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

          {/* Custom Size Numeric Inputs */}
          {sizeMode === 'custom' && (
            <div className="p-4 bg-purple-50/50 rounded-2xl border border-purple-200 space-y-3">
              <div className="text-xs font-bold text-purple-950">Dimensions exactes (pixels) :</div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Largeur (px) :</label>
                  <input
                    type="number"
                    min={16}
                    max={600}
                    value={customSize.width}
                    onChange={(e) =>
                      setCustomSize({
                        ...customSize,
                        width: Math.max(16, parseInt(e.target.value) || 16),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Hauteur (px) :</label>
                  <input
                    type="number"
                    min={16}
                    max={600}
                    value={customSize.height}
                    onChange={(e) =>
                      setCustomSize({
                        ...customSize,
                        height: Math.max(16, parseInt(e.target.value) || 16),
                      })
                    }
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl focus:border-purple-500 focus:outline-none"
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
                  entity={sizeMode === 'match_target' ? targetEntity : subjectEntity}
                  type={sizeMode === 'match_target' ? targetEntity?.type : subjectEntity?.type}
                  size={42}
                />
              </div>
            </div>

            <div className="text-slate-500 text-lg font-bold">➔</div>

            <div className="text-center">
              <div className="text-[10px] font-bold text-emerald-400 mb-1">
                Objet Créé ({calculatedSpawnWidth}x{calculatedSpawnHeight}px)
              </div>
              <div className="w-20 h-20 bg-slate-800 rounded-xl border-2 border-emerald-400 flex items-center justify-center p-1 shadow-lg">
                <EntityMiniPreview
                  entity={spawnEntity}
                  type={spawnEntity?.type}
                  size={Math.min(68, Math.max(28, Math.round(44 * (calculatedSpawnWidth / defaultSpawnWidth))))}
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm & Cancel Actions */}
      <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-slate-100">
        <div className="text-[11px] text-slate-500">
          Taille : <strong className="text-slate-800">{calculatedSpawnWidth}x{calculatedSpawnHeight}px</strong>
        </div>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
            >
              Annuler
            </button>
          )}
          <button
            type="button"
            onClick={handleApply}
            className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Valider la création</span>
          </button>
        </div>
      </div>
    </div>
  );
}

