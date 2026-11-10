import React from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  Pencil,
  GitCommit,
  Square,
  Circle,
  PaintBucket,
  Eraser,
  Undo2,
  Trash2,
  Check,
  Layers,
  Palette,
} from 'lucide-react';

const COLOR_PALETTE = [
  '#000000', '#ffffff', '#64748b', '#ef4444', '#f97316', '#f59e0b',
  '#10b981', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899',
];

interface DrawingToolsPanelProps {
  onClose?: () => void;
  onUndo?: () => void;
  onClearLayer?: () => void;
}

export function DrawingToolsPanel({ onClose, onUndo, onClearLayer }: DrawingToolsPanelProps) {
  const selectedLayerId = useSceneStore((state) => state.selectedLayerId);
  const layerGroups = useSceneStore((state) => state.layerGroups || []);
  const drawingTool = useSceneStore((state) => state.drawingTool);
  const drawingStrokeColor = useSceneStore((state) => state.drawingStrokeColor);
  const drawingFillColor = useSceneStore((state) => state.drawingFillColor);
  const drawingStrokeWidth = useSceneStore((state) => state.drawingStrokeWidth);
  const setDrawingTool = useSceneStore((state) => state.setDrawingTool);
  const setDrawingStrokeColor = useSceneStore((state) => state.setDrawingStrokeColor);
  const setDrawingFillColor = useSceneStore((state) => state.setDrawingFillColor);
  const setDrawingStrokeWidth = useSceneStore((state) => state.setDrawingStrokeWidth);
  const selectLayer = useSceneStore((state) => state.selectLayer);

  // Find active layer object
  let activeLayerName = 'Calque Sélectionné';
  let activeLayerKind = 'background';
  for (const group of layerGroups) {
    const found = group.layers.find((l) => l.id === selectedLayerId);
    if (found) {
      activeLayerName = found.name;
      activeLayerKind = group.kind;
      break;
    }
  }

  const tools = [
    { id: 'pencil', label: 'Crayon (Libre)', icon: Pencil },
    { id: 'line', label: 'Ligne Droite', icon: GitCommit },
    { id: 'rectangle', label: 'Rectangle', icon: Square },
    { id: 'circle', label: 'Cercle', icon: Circle },
    { id: 'bucket', label: 'Remplir (Pot)', icon: PaintBucket },
    { id: 'eraser_partial', label: 'Gomme Précise', icon: Eraser },
    { id: 'eraser_stroke', label: 'Gomme Trait', icon: Trash2 },
  ];

  return (
    <div className="space-y-4 flex flex-col h-full text-slate-800 select-none">
      {/* Active Layer Header Badge */}
      <div className="p-3 bg-indigo-50/70 border border-indigo-200/80 rounded-2xl flex items-center justify-between gap-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
            <Layers className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[10px] font-extrabold uppercase text-indigo-700 tracking-wider">
              {activeLayerKind === 'background' ? 'Dessin Arrière-Plan' : 'Dessin Premier-Plan'}
            </div>
            <div className="text-xs font-black text-slate-900 truncate" title={activeLayerName}>
              {activeLayerName}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            selectLayer(null);
            if (onClose) onClose();
          }}
          className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-[11px] font-bold shadow-2xs cursor-pointer transition-all shrink-0 flex items-center gap-1"
          title="Fermer le mode dessin et revenir à l'inspecteur d'objets"
        >
          <Check className="w-3.5 h-3.5 text-emerald-600" />
          <span>Fermer</span>
        </button>
      </div>

      {/* Direct Canvas Drawing Banner Notice */}
      <div className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80 leading-snug">
        ✏️ <strong>Dessin Direct :</strong> Cliquez et dessinez directement sur le canvas principal au centre.
      </div>

      {/* Outils de Dessin Vectoriel */}
      <div className="space-y-2">
        <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider block">
          1. Outils de Dessin
        </label>
        <div className="grid grid-cols-2 gap-2">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = drawingTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDrawingTool(t.id as any)}
                className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white border-indigo-700 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{t.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Couleur de Contour / Trait (Stroke) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            2. Couleur du trait
          </label>
          <div
            className="w-5 h-5 rounded-lg border border-slate-300 shadow-2xs"
            style={{ backgroundColor: drawingStrokeColor }}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDrawingStrokeColor(c)}
              className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer shadow-2xs ${
                drawingStrokeColor === c
                  ? 'border-indigo-600 scale-115 ring-2 ring-indigo-300/50'
                  : 'border-white hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={drawingStrokeColor.startsWith('#') ? drawingStrokeColor : '#6366f1'}
            onChange={(e) => setDrawingStrokeColor(e.target.value)}
            className="w-7 h-7 rounded-xl border-0 p-0 cursor-pointer overflow-hidden shadow-2xs"
            title="Sélecteur de couleur personnalisé"
          />
        </div>
      </div>

      {/* Couleur de Remplissage (Fill) */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            3. Couleur de Remplissage
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDrawingFillColor('none')}
              className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                drawingFillColor === 'none'
                  ? 'bg-rose-100 text-rose-700 border-rose-200 font-black'
                  : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
              }`}
            >
              Transparent
            </button>
            {drawingFillColor !== 'none' && (
              <div
                className="w-5 h-5 rounded-lg border border-slate-300 shadow-2xs"
                style={{ backgroundColor: drawingFillColor }}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
          {COLOR_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setDrawingFillColor(c)}
              className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer shadow-2xs ${
                drawingFillColor === c
                  ? 'border-indigo-600 scale-115 ring-2 ring-indigo-300/50'
                  : 'border-white hover:scale-105'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
          <input
            type="color"
            value={drawingFillColor.startsWith('#') ? drawingFillColor : '#6366f1'}
            onChange={(e) => setDrawingFillColor(e.target.value)}
            className="w-7 h-7 rounded-xl border-0 p-0 cursor-pointer overflow-hidden shadow-2xs"
            title="Sélecteur de couleur personnalisé"
          />
        </div>
      </div>

      {/* Épaisseur du Trait */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            4. Épaisseur du trait ({drawingStrokeWidth}px)
          </label>
        </div>

        <div className="flex items-center gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
          {[2, 4, 6, 8, 12, 16].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDrawingStrokeWidth(w)}
              className={`flex-1 py-1 text-xs font-mono font-bold rounded-xl border transition-all cursor-pointer ${
                drawingStrokeWidth === w
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {w}
            </button>
          ))}
        </div>
      </div>

      {/* Actions complémentaires : Undo / Clear Layer / Quitter */}
      <div className="pt-2 border-t border-slate-200 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-slate-200"
            >
              <Undo2 className="w-4 h-4" />
              <span>Annuler (Undo)</span>
            </button>
          )}

          {onClearLayer && (
            <button
              type="button"
              onClick={onClearLayer}
              className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border border-rose-200"
            >
              <Trash2 className="w-4 h-4" />
              <span>Vider le calque</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
