import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ChevronUp,
  ChevronDown,
  Trash2,
} from 'lucide-react';
import { DrawingLayer, VectorPath } from '../../types';

interface DrawingLayersSectionProps {
  layers: DrawingLayer[];
  activeLayerId: string;
  activeLayer: DrawingLayer | undefined;
  paths: VectorPath[];
  editingLayerId: string | null;
  editingLayerName: string;
  onSetEditingLayerId: (id: string | null) => void;
  onSetEditingLayerName: (name: string) => void;
  onSelectActiveLayer: (id: string) => void;
  onAddLayer: () => void;
  onRenameLayer: (id: string, name: string) => void;
  onToggleVisibility: (id: string) => void;
  onToggleLock: (id: string) => void;
  onMoveLayer: (id: string, dir: 'up' | 'down') => void;
  onDeleteLayer: (id: string) => void;
  onOpacityChange: (id: string, opacity: number) => void;
}

export function DrawingLayersSection({
  layers,
  activeLayerId,
  activeLayer,
  paths,
  editingLayerId,
  editingLayerName,
  onSetEditingLayerId,
  onSetEditingLayerName,
  onSelectActiveLayer,
  onAddLayer,
  onRenameLayer,
  onToggleVisibility,
  onToggleLock,
  onMoveLayer,
  onDeleteLayer,
  onOpacityChange,
}: DrawingLayersSectionProps) {
  return (
    <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          <span className="text-xs font-bold text-slate-800">Calques</span>
          <span className="text-[10px] font-bold bg-indigo-50 text-indigo-600 px-1.5 py-0.2 rounded-full border border-indigo-200">
            {layers.length}
          </span>
        </div>
        <button
          type="button"
          onClick={onAddLayer}
          className="px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-[10px] rounded-lg border border-indigo-200 flex items-center gap-1 transition-all cursor-pointer shadow-2xs active:scale-95"
          title="Ajouter un nouveau calque au premier plan"
        >
          <Plus className="w-3 h-3" /> Nouveau
        </button>
      </div>

      {/* Liste des calques ordonnée de haut en bas */}
      <div className="space-y-1 max-h-36 overflow-y-auto pr-0.5">
        {layers.map((layer, index) => {
          const isActive = layer.id === activeLayerId;
          const layerPathCount = paths.filter(
            (p) => (p.layerId || layers[layers.length - 1]?.id || 'layer-1') === layer.id
          ).length;
          return (
            <div
              key={layer.id}
              onClick={() => onSelectActiveLayer(layer.id)}
              className={`flex items-center justify-between p-1.5 rounded-xl border text-xs transition-all cursor-pointer ${
                isActive
                  ? 'bg-indigo-50/90 border-indigo-300 ring-1 ring-indigo-400/40 text-indigo-950 font-semibold'
                  : 'bg-slate-50/80 hover:bg-slate-100 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                {/* Pastille calque actif */}
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    isActive ? 'bg-indigo-600' : 'bg-slate-300'
                  }`}
                />

                {/* Nom du calque */}
                {editingLayerId === layer.id ? (
                  <input
                    type="text"
                    value={editingLayerName}
                    onChange={(e) => onSetEditingLayerName(e.target.value)}
                    onBlur={() => {
                      if (editingLayerName.trim()) {
                        onRenameLayer(layer.id, editingLayerName.trim());
                      }
                      onSetEditingLayerId(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        if (editingLayerName.trim()) {
                          onRenameLayer(layer.id, editingLayerName.trim());
                        }
                        onSetEditingLayerId(null);
                      } else if (e.key === 'Escape') {
                        onSetEditingLayerId(null);
                      }
                    }}
                    autoFocus
                    className="px-1.5 py-0.5 text-[11px] font-bold bg-white border border-indigo-400 rounded-md outline-none w-24"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onSetEditingLayerId(layer.id);
                      onSetEditingLayerName(layer.name);
                    }}
                    className="text-[11px] truncate flex-1 select-none"
                    title="Double-cliquer pour renommer"
                  >
                    {layer.name}
                    <span className="text-[9px] text-slate-400 font-normal ml-1">
                      ({layerPathCount})
                    </span>
                  </span>
                )}
              </div>

              {/* Actions sur le calque */}
              <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                {/* Visibilité (Œil) */}
                <button
                  type="button"
                  onClick={() => onToggleVisibility(layer.id)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    layer.visible
                      ? 'text-slate-600 hover:text-indigo-600 hover:bg-white'
                      : 'text-slate-400 bg-slate-200/60'
                  }`}
                  title={layer.visible ? 'Masquer le calque' : 'Afficher le calque'}
                >
                  {layer.visible ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                </button>

                {/* Verrouillage (Cadenas) */}
                <button
                  type="button"
                  onClick={() => onToggleLock(layer.id)}
                  className={`p-1 rounded-md transition-colors cursor-pointer ${
                    layer.locked
                      ? 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                      : 'text-slate-400 hover:text-slate-700 hover:bg-white'
                  }`}
                  title={layer.locked ? 'Déverrouiller le calque' : 'Verrouiller le calque'}
                >
                  {layer.locked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>

                {/* Monter */}
                <button
                  type="button"
                  disabled={index === 0}
                  onClick={() => onMoveLayer(layer.id, 'up')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-20 rounded-md transition-colors cursor-pointer"
                  title="Monter le calque (Premier plan)"
                >
                  <ChevronUp className="w-3 h-3" />
                </button>

                {/* Descendre */}
                <button
                  type="button"
                  disabled={index === layers.length - 1}
                  onClick={() => onMoveLayer(layer.id, 'down')}
                  className="p-1 text-slate-400 hover:text-slate-700 hover:bg-white disabled:opacity-20 rounded-md transition-colors cursor-pointer"
                  title="Descendre le calque (Arrière plan)"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>

                {/* Supprimer */}
                {layers.length > 1 && (
                  <button
                    type="button"
                    onClick={() => onDeleteLayer(layer.id)}
                    className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                    title="Supprimer le calque"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Curseur d'opacité du calque actif */}
      {activeLayer && (
        <div className="flex items-center gap-2 pt-1 border-t border-slate-100 text-[10px] text-slate-500">
          <span className="shrink-0 font-medium">Opacité :</span>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={activeLayer.opacity ?? 1}
            onChange={(e) => onOpacityChange(activeLayer.id, parseFloat(e.target.value))}
            className="w-full accent-indigo-600 h-1 bg-slate-200 rounded-lg cursor-pointer"
          />
          <span className="w-8 text-right font-mono font-bold text-slate-700">
            {Math.round((activeLayer.opacity ?? 1) * 100)}%
          </span>
        </div>
      )}
    </div>
  );
}
