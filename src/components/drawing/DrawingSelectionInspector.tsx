import { Copy, Trash2, Layers } from 'lucide-react';
import { DrawingLayer, VectorPath } from '../../types';

interface DrawingSelectionInspectorProps {
  selectedCount: number;
  primarySelectedPath: VectorPath | null;
  cornerRadius: number;
  layers: DrawingLayer[];
  activeLayerId: string;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onCornerRadiusChange: (val: number) => void;
  onMoveSelectedToLayer: (layerId: string) => void;
}

export function DrawingSelectionInspector({
  selectedCount,
  primarySelectedPath,
  cornerRadius,
  layers,
  activeLayerId,
  onDuplicateSelected,
  onDeleteSelected,
  onCornerRadiusChange,
  onMoveSelectedToLayer,
}: DrawingSelectionInspectorProps) {
  return (
    <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
          {selectedCount > 1
            ? `${selectedCount} formes sélectionnées`
            : '1 forme sélectionnée'}
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onDuplicateSelected}
            className="p-1 text-indigo-600 hover:bg-indigo-200/60 rounded-lg cursor-pointer transition-colors"
            title="Dupliquer la sélection"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onDeleteSelected}
            className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
            title="Supprimer la sélection"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {selectedCount === 1 && primarySelectedPath?.rect && (
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
            onChange={(e) => onCornerRadiusChange(Number(e.target.value))}
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
          onChange={(e) => onMoveSelectedToLayer(e.target.value)}
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
  );
}
