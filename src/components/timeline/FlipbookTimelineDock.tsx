import React from 'react';
import {
  Play,
  Pause,
  Plus,
  Copy,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Film,
  SkipBack,
  Repeat,
  ArrowLeftRight,
  ArrowRightToLine,
  Layers,
} from 'lucide-react';
import { AnimationFrame, AnimationLoopMode } from '../../types';
import { renderFrameThumbnailSvg } from './FlipbookPreviewModal';

interface FlipbookTimelineDockProps {
  frames: AnimationFrame[];
  safeActiveIdx: number;
  frameRate: number;
  animationLoop: AnimationLoopMode;
  isPlayingPreview: boolean;
  hasOnion: boolean;
  onionEnabled: boolean;
  frameCardRefs: React.MutableRefObject<Record<string, HTMLDivElement | null>>;
  onSelectFrame: (idx: number) => void;
  onTogglePlayPreview: () => void;
  onFrameRateChange: (fps: number) => void;
  onAnimationLoopChange: (loop: AnimationLoopMode) => void;
  onToggleOnion: () => void;
  onDuplicateFrame: (idx: number) => void;
  onAddEmptyFrame: () => void;
  onMoveFrame: (idx: number, dir: -1 | 1) => void;
  onDeleteFrame: (idx: number) => void;
}

export function FlipbookTimelineDock({
  frames,
  safeActiveIdx,
  frameRate,
  animationLoop,
  isPlayingPreview,
  hasOnion,
  onionEnabled,
  frameCardRefs,
  onSelectFrame,
  onTogglePlayPreview,
  onFrameRateChange,
  onAnimationLoopChange,
  onToggleOnion,
  onDuplicateFrame,
  onAddEmptyFrame,
  onMoveFrame,
  onDeleteFrame,
}: FlipbookTimelineDockProps) {
  return (
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
              onClick={() => onSelectFrame(0)}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer transition-all"
              title="Aller à la première frame"
            >
              <SkipBack className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={safeActiveIdx === 0}
              onClick={() => onSelectFrame(Math.max(0, safeActiveIdx - 1))}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-30 cursor-pointer transition-all"
              title="Frame précédente (Alt+←)"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              disabled={frames.length <= 1}
              onClick={onTogglePlayPreview}
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
              onClick={() => onSelectFrame(Math.min(frames.length - 1, safeActiveIdx + 1))}
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
                onClick={() => onFrameRateChange(preset)}
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
              onChange={(e) =>
                onFrameRateChange(Math.max(1, Math.min(24, parseInt(e.target.value, 10) || 8)))
              }
              className="w-9 text-xs font-mono font-bold text-slate-800 bg-white border border-slate-200 rounded-md text-center outline-none ml-0.5"
              title="Images par seconde (1 à 24)"
            />
          </div>

          {/* Mode Boucle */}
          <div className="flex items-center gap-0.5 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => onAnimationLoopChange('loop')}
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
              onClick={() => onAnimationLoopChange('ping_pong')}
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
              onClick={() => onAnimationLoopChange('once')}
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
          {hasOnion && (
            <button
              type="button"
              onClick={onToggleOnion}
              className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border flex items-center gap-1 cursor-pointer transition-all ${
                onionEnabled
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
              onClick={() => onDuplicateFrame(safeActiveIdx)}
              className="px-2.5 py-1 rounded-xl border border-violet-300 bg-violet-50 hover:bg-violet-100 text-violet-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Dupliquer la frame active (idéal pour animer la suite avec pelure)"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>Dupliquer</span>
            </button>
            <button
              type="button"
              onClick={onAddEmptyFrame}
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
              onClick={() => onSelectFrame(idx)}
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
                      onMoveFrame(idx, -1);
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
                      onMoveFrame(idx, 1);
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
                    onDuplicateFrame(idx);
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
                      onDeleteFrame(idx);
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
          onClick={onAddEmptyFrame}
          className="shrink-0 w-14 h-16 rounded-2xl border-2 border-dashed border-slate-300 hover:border-violet-400 bg-slate-50/70 hover:bg-violet-50/60 text-slate-500 hover:text-violet-700 flex flex-col items-center justify-center gap-0.5 cursor-pointer transition-all"
          title="Ajouter une frame vide à la suite"
        >
          <Plus className="w-4 h-4" />
          <span className="text-[9px] font-bold">Frame</span>
        </button>
      </div>
    </div>
  );
}
