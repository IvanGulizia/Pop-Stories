import { Target, Eye, EyeOff, Crosshair, Download, Layers } from 'lucide-react';
import { VectorPath, VectorPoint } from '../../types';

export interface OnionStateOptionItem {
  id: string;
  name: string;
  vectorPaths?: VectorPath[];
}

export interface ReferenceGuideOptionItem {
  id: string;
  name: string;
  paths?: Array<{ d: string; stroke?: string; fill?: string; strokeWidth?: number }>;
  hotspot?: { x: number; y: number };
  isCustom?: boolean;
}

interface DrawingGuidesAndOnionSectionProps {
  activeReferenceGuide?: ReferenceGuideOptionItem;
  availableReferenceGuides?: ReferenceGuideOptionItem[];
  selectedGuideId: string;
  onSelectGuideId: (id: string) => void;
  guideOpacity: number;
  onGuideOpacityChange: (val: number) => void;
  onCopyGuideToCanvas: () => void;
  isCursorMode: boolean;
  showHotspot: boolean;
  onToggleHotspot: () => void;
  hotspot: VectorPoint;
  onResetHotspot: () => void;
  availableOnionStates: OnionStateOptionItem[];
  onionSkinEnabled: boolean;
  onToggleOnionSkin: () => void;
  selectedOnionStateId: string;
  onSelectOnionStateId: (id: string) => void;
  onionOpacity: number;
  onOnionOpacityChange: (val: number) => void;
}

export function DrawingGuidesAndOnionSection({
  activeReferenceGuide,
  availableReferenceGuides,
  selectedGuideId,
  onSelectGuideId,
  guideOpacity,
  onGuideOpacityChange,
  onCopyGuideToCanvas,
  isCursorMode,
  showHotspot,
  onToggleHotspot,
  hotspot,
  onResetHotspot,
  availableOnionStates,
  onionSkinEnabled,
  onToggleOnionSkin,
  selectedOnionStateId,
  onSelectOnionStateId,
  onionOpacity,
  onOnionOpacityChange,
}: DrawingGuidesAndOnionSectionProps) {
  return (
    <>
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
                  onClick={() => onGuideOpacityChange(guideOpacity > 0 ? 0 : 0.45)}
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
                  onClick={onToggleHotspot}
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
                  onSelectGuideId(e.target.value);
                  if (guideOpacity === 0) onGuideOpacityChange(0.45);
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
                onChange={(e) => onGuideOpacityChange(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200/70 rounded-lg"
              />
              {activeReferenceGuide.paths && activeReferenceGuide.paths.length > 0 && (
                <button
                  type="button"
                  onClick={onCopyGuideToCanvas}
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
                onClick={onResetHotspot}
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
              onClick={onToggleOnionSkin}
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
                onChange={(e) => onSelectOnionStateId(e.target.value)}
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
                onChange={(e) => onOnionOpacityChange(parseFloat(e.target.value))}
                className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-100 rounded-lg"
              />
            </div>
          )}
        </div>
      )}
    </>
  );
}
