import { Crosshair, Eye, EyeOff, RotateCcw, MousePointerClick, Lock, Unlock } from 'lucide-react';
import { EntityPivot } from '../../types';

interface DrawingPivotSectionProps {
  pivot: EntityPivot;
  showPivotPreview: boolean;
  onToggleShowPivotPreview: () => void;
  isPivotLocked: boolean;
  onTogglePivotLocked: () => void;
  isPlacementActive: boolean;
  onTogglePlacementActive: () => void;
  onChangePivot: (next: EntityPivot) => void;
  onResetPivot: () => void;
  isStateContext?: boolean;
  hasStateOverride?: boolean;
  baseEntityPivot?: EntityPivot;
  onToggleStateOverride?: (nextOverride: boolean) => void;
}

const ANCHOR_PRESETS: Array<{ label: string; x: number; y: number }> = [
  { label: 'Haut-Gauche', x: 0, y: 0 },
  { label: 'Haut-Centre', x: 0.5, y: 0 },
  { label: 'Haut-Droite', x: 1, y: 0 },
  { label: 'Milieu-Gauche', x: 0, y: 0.5 },
  { label: 'Centre', x: 0.5, y: 0.5 },
  { label: 'Milieu-Droite', x: 1, y: 0.5 },
  { label: 'Bas-Gauche', x: 0, y: 1 },
  { label: 'Bas-Centre', x: 0.5, y: 1 },
  { label: 'Bas-Droite', x: 1, y: 1 },
];

export function DrawingPivotSection({
  pivot,
  showPivotPreview,
  onToggleShowPivotPreview,
  isPivotLocked,
  onTogglePivotLocked,
  isPlacementActive,
  onTogglePlacementActive,
  onChangePivot,
  onResetPivot,
  isStateContext = false,
  hasStateOverride = false,
  baseEntityPivot,
  onToggleStateOverride,
}: DrawingPivotSectionProps) {
  const pctX = Math.round(pivot.x * 100);
  const pctY = Math.round(pivot.y * 100);
  const inheritedOnly = isStateContext && !hasStateOverride;

  return (
    <div className="bg-white p-3 rounded-2xl border border-fuchsia-200/80 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Crosshair className="w-3.5 h-3.5 text-fuchsia-600" /> Pivot &amp; Centre de rotation
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onTogglePivotLocked}
            className={`p-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
              isPivotLocked
                ? 'bg-amber-100 text-amber-800 border-amber-300 shadow-2xs'
                : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
            }`}
            title={
              isPivotLocked
                ? 'Pivot verrouillé sur le canvas (cliquer pour déverrouiller)'
                : 'Verrouiller le déplacement du pivot sur le canvas'
            }
          >
            {isPivotLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={onToggleShowPivotPreview}
            className={`p-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
              showPivotPreview
                ? 'bg-fuchsia-50 text-fuchsia-700 border-fuchsia-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
            title={showPivotPreview ? 'Masquer le repère de pivot' : 'Afficher le repère de pivot'}
          >
            {showPivotPreview ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          <button
            type="button"
            disabled={isPivotLocked}
            onClick={onResetPivot}
            className="p-1 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 disabled:opacity-45 disabled:cursor-not-allowed text-slate-600 cursor-pointer transition-colors"
            title="Recentrer au milieu (50%, 50%)"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      </div>

      {isStateContext && onToggleStateOverride && (
        <div className="p-2 rounded-xl bg-fuchsia-50/70 border border-fuchsia-200/80 flex items-center justify-between gap-2">
          <div className="text-[10px] font-bold text-fuchsia-900 leading-tight">
            {hasStateOverride
              ? '✏️ Surcharge active pour cet état'
              : `🔗 Pivot objet (${Math.round((baseEntityPivot?.x ?? 0.5) * 100)}%, ${Math.round((baseEntityPivot?.y ?? 0.5) * 100)}%)`}
          </div>
          <button
            type="button"
            onClick={() => onToggleStateOverride(!hasStateOverride)}
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all shrink-0 ${
              hasStateOverride
                ? 'bg-fuchsia-600 text-white border-fuchsia-700'
                : 'bg-white text-fuchsia-700 border-fuchsia-300 hover:bg-fuchsia-100'
            }`}
          >
            {hasStateOverride ? 'Surchargé ✓' : 'Surcharger'}
          </button>
        </div>
      )}

      {!inheritedOnly && (
        <div className={`space-y-2 ${isPivotLocked ? 'opacity-65' : ''}`}>
          {isPivotLocked && (
            <div className="text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1 flex items-center gap-1">
              <Lock className="w-3 h-3 shrink-0" />
              <span>Pivot verrouillé — ne gêne pas le dessin</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Grille 3x3 des ancres rapides */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-xl border border-slate-200 shrink-0">
              {ANCHOR_PRESETS.map((preset) => {
                const isActive =
                  Math.abs(pivot.x - preset.x) < 0.02 && Math.abs(pivot.y - preset.y) < 0.02;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    disabled={isPivotLocked}
                    onClick={() => onChangePivot({ x: preset.x, y: preset.y })}
                    title={`${preset.label} (${preset.x * 100}%, ${preset.y * 100}%)`}
                    className={`w-5 h-5 rounded-md flex items-center justify-center transition-all cursor-pointer disabled:cursor-not-allowed ${
                      isActive
                        ? 'bg-fuchsia-600 text-white shadow-2xs scale-105'
                        : 'bg-white hover:bg-fuchsia-50 text-slate-400 border border-slate-200/70'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isActive ? 'bg-white' : 'bg-slate-400'
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            {/* Coordonnées X% / Y% + Bouton placer sur le canvas */}
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="grid grid-cols-2 gap-1.5 text-[10px]">
                <label className="space-y-0.5">
                  <span className="font-bold text-slate-500 block">X %</span>
                  <input
                    type="number"
                    min={-50}
                    max={150}
                    disabled={isPivotLocked}
                    value={pctX}
                    onChange={(e) => {
                      const v = Math.max(-50, Math.min(150, Number(e.target.value) || 0));
                      onChangePivot({ x: Math.round(v) / 100, y: pivot.y });
                    }}
                    className="w-full px-1.5 py-1 bg-white border border-fuchsia-200 rounded-md font-mono font-bold text-slate-800 disabled:bg-slate-50"
                  />
                </label>
                <label className="space-y-0.5">
                  <span className="font-bold text-slate-500 block">Y %</span>
                  <input
                    type="number"
                    min={-50}
                    max={150}
                    disabled={isPivotLocked}
                    value={pctY}
                    onChange={(e) => {
                      const v = Math.max(-50, Math.min(150, Number(e.target.value) || 0));
                      onChangePivot({ x: pivot.x, y: Math.round(v) / 100 });
                    }}
                    className="w-full px-1.5 py-1 bg-white border border-fuchsia-200 rounded-md font-mono font-bold text-slate-800 disabled:bg-slate-50"
                  />
                </label>
              </div>
              <button
                type="button"
                disabled={isPivotLocked}
                onClick={onTogglePlacementActive}
                className={`w-full py-1 px-2 rounded-lg text-[10px] font-bold border flex items-center justify-center gap-1 cursor-pointer disabled:cursor-not-allowed transition-all ${
                  isPlacementActive && !isPivotLocked
                    ? 'bg-fuchsia-600 text-white border-fuchsia-700 shadow-2xs'
                    : 'bg-fuchsia-50 text-fuchsia-800 border-fuchsia-200 hover:bg-fuchsia-100'
                }`}
                title="Cliquer directement sur le dessin pour placer le pivot (ou glisser le viseur rose)"
              >
                <MousePointerClick className="w-3 h-3" />
                {isPlacementActive && !isPivotLocked ? 'Cliquez sur le dessin...' : 'Placer au clic / glisser'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
