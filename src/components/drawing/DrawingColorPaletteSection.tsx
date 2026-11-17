import { Pipette } from 'lucide-react';
import { ProjectPaletteColor } from '../../types';

interface DrawingColorPaletteSectionProps {
  projectPalette: ProjectPaletteColor[];
  strokeColor: string;
  selectedStrokePaletteId: string | null;
  fillColor: string;
  selectedFillPaletteId: string | null;
  strokeWidth: number;
  selectedCount: number;
  onResetProjectPalette: () => void;
  onModifyPaletteColor: (paletteId: string, newColor: string) => void;
  onSetStrokeColor: (color: string) => void;
  onSetSelectedStrokePaletteId: (id: string | null) => void;
  onSetFillColor: (color: string) => void;
  onSetSelectedFillPaletteId: (id: string | null) => void;
  onSetStrokeWidth: (width: number) => void;
  onUpdateSelectedProps: (
    partial: Partial<{
      stroke: string;
      strokeColorId?: string;
      strokeWidth: number;
      fill: string;
      fillColorId?: string;
    }>
  ) => void;
}

export function DrawingColorPaletteSection({
  projectPalette,
  strokeColor,
  selectedStrokePaletteId,
  fillColor,
  selectedFillPaletteId,
  strokeWidth,
  selectedCount,
  onResetProjectPalette,
  onModifyPaletteColor,
  onSetStrokeColor,
  onSetSelectedStrokePaletteId,
  onSetFillColor,
  onSetSelectedFillPaletteId,
  onSetStrokeWidth,
  onUpdateSelectedProps,
}: DrawingColorPaletteSectionProps) {
  return (
    <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500">
          Palette du Projet (16 couleurs)
        </span>
        <button
          type="button"
          onClick={onResetProjectPalette}
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
                onSetStrokeColor('none');
                onSetSelectedStrokePaletteId(null);
                if (selectedCount > 0) {
                  onUpdateSelectedProps({ stroke: 'none', strokeColorId: undefined });
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
                  onSetStrokeColor(c);
                  if (selectedStrokePaletteId) {
                    onModifyPaletteColor(selectedStrokePaletteId, c);
                  } else if (selectedCount > 0) {
                    onUpdateSelectedProps({ stroke: c });
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
                    onSetSelectedStrokePaletteId(palItem.id);
                    onSetStrokeColor(palItem.color);
                    if (selectedCount > 0) {
                      onUpdateSelectedProps({
                        stroke: palItem.color,
                        strokeColorId: palItem.id,
                      });
                    }
                  }}
                  onChange={(e) => {
                    const newHex = e.target.value;
                    onSetSelectedStrokePaletteId(palItem.id);
                    onSetStrokeColor(newHex);
                    onModifyPaletteColor(palItem.id, newHex);
                    if (selectedCount > 0) {
                      onUpdateSelectedProps({
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
                onSetFillColor('none');
                onSetSelectedFillPaletteId(null);
                if (selectedCount > 0) {
                  onUpdateSelectedProps({ fill: 'none', fillColorId: undefined });
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
                  onSetFillColor(c);
                  if (selectedFillPaletteId) {
                    onModifyPaletteColor(selectedFillPaletteId, c);
                  } else if (selectedCount > 0) {
                    onUpdateSelectedProps({ fill: c });
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
                    onSetSelectedFillPaletteId(palItem.id);
                    onSetFillColor(palItem.color);
                    if (selectedCount > 0) {
                      onUpdateSelectedProps({
                        fill: palItem.color,
                        fillColorId: palItem.id,
                      });
                    }
                  }}
                  onChange={(e) => {
                    const newHex = e.target.value;
                    onSetSelectedFillPaletteId(palItem.id);
                    onSetFillColor(newHex);
                    onModifyPaletteColor(palItem.id, newHex);
                    if (selectedCount > 0) {
                      onUpdateSelectedProps({
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
                onSetStrokeWidth(w);
                if (selectedCount > 0) onUpdateSelectedProps({ strokeWidth: w });
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
            onSetStrokeWidth(val);
            if (selectedCount > 0) onUpdateSelectedProps({ strokeWidth: val });
          }}
          className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
        />
      </div>
    </div>
  );
}
