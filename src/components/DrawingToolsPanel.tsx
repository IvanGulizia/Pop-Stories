import { useState } from 'react';
import { useSceneStore, DEFAULT_PROJECT_PALETTE } from '../store/useSceneStore';
import { SceneLayer, SceneLayerGroup } from '../types';
import {
  Pencil,
  GitCommit,
  Square,
  Circle,
  PaintBucket,
  Eraser,
  Undo2,
  Trash2,
  Palette,
  RotateCcw,
  Shield,
  Tag,
  Plus,
  X,
} from 'lucide-react';

interface DrawingToolsPanelProps {
  onClose?: () => void;
  onUndo?: () => void;
  onClearLayer?: () => void;
}

export function DrawingToolsPanel({ onUndo, onClearLayer }: DrawingToolsPanelProps) {
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
  const updateLayer = useSceneStore((state) => state.updateLayer);

  const projectPalette = useSceneStore((state) => state.projectPalette || DEFAULT_PROJECT_PALETTE);
  const updateProjectPaletteColor = useSceneStore((state) => state.updateProjectPaletteColor);
  const resetProjectPalette = useSceneStore((state) => state.resetProjectPalette);

  const [newTagInput, setNewTagInput] = useState('');

  const [selectedStrokePaletteId, setSelectedStrokePaletteId] = useState<string | undefined>(() => {
    const match = projectPalette.find((p) => p.color.toLowerCase() === drawingStrokeColor.toLowerCase());
    return match?.id;
  });

  const [selectedFillPaletteId, setSelectedFillPaletteId] = useState<string | undefined>(() => {
    if (!drawingFillColor || drawingFillColor === 'none') return undefined;
    const match = projectPalette.find((p) => p.color.toLowerCase() === drawingFillColor.toLowerCase());
    return match?.id;
  });

  // Find active layer object & group
  let activeLayer: SceneLayer | null = null;
  let activeGroup: SceneLayerGroup | null = null;
  for (const group of layerGroups) {
    const found = group.layers.find((l) => l.id === selectedLayerId);
    if (found) {
      activeLayer = found;
      activeGroup = group;
      break;
    }
  }

  const isColliderLayer = !!(activeLayer && (activeLayer.role === 'collider' || activeGroup?.kind === 'collider'));

  const handleAddColliderTag = () => {
    if (!activeLayer) return;
    const clean = newTagInput.trim().replace(/^#/, '');
    if (!clean) return;
    const existing = activeLayer.colliderTags || [];
    if (!existing.includes(clean)) {
      updateLayer(activeLayer.id, { colliderTags: [...existing, clean] });
    }
    setNewTagInput('');
  };

  const handleRemoveColliderTag = (tagToRemove: string) => {
    if (!activeLayer) return;
    const existing = activeLayer.colliderTags || [];
    updateLayer(activeLayer.id, {
      colliderTags: existing.filter((t) => t !== tagToRemove),
    });
  };

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
      {/* Propriétés spécifiques aux Calques Colliders */}
      {isColliderLayer && activeLayer && (
        <div className="p-3 bg-orange-50/70 border border-orange-200/90 rounded-2xl space-y-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-orange-600" />
              Collider de Décor
            </span>
            <span className="text-[10px] font-semibold text-orange-700 bg-white px-2 py-0.5 rounded-full border border-orange-200 truncate max-w-[130px]">
              {activeLayer.name}
            </span>
          </div>

          {/* Tags intégrés */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
              <Tag className="w-3 h-3 text-orange-600" />
              Tags de détection (#sol, #mur, #lave...)
            </label>
            <div className="flex gap-1.5">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddColliderTag();
                  }
                }}
                placeholder="ex: sol"
                className="flex-1 min-w-0 px-2.5 py-1 text-xs rounded-lg border border-orange-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-300"
              />
              <button
                type="button"
                onClick={handleAddColliderTag}
                className="px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-xs font-bold cursor-pointer flex items-center"
                title="Ajouter ce tag"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
            {(activeLayer.colliderTags?.length || 0) > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
                {activeLayer.colliderTags!.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-orange-200 text-[10px] font-bold text-orange-800"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => handleRemoveColliderTag(tag)}
                      className="text-orange-400 hover:text-rose-600 cursor-pointer"
                    >
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Solide vs Trigger & Visibilité Play */}
          <div className="space-y-1.5 pt-1 border-t border-orange-200/60">
            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer">
              <span className="font-semibold text-[11px]">Capteur / Trigger uniquement (traversable)</span>
              <input
                type="checkbox"
                checked={!!activeLayer.colliderIsTrigger}
                onChange={(e) => updateLayer(activeLayer!.id, { colliderIsTrigger: e.target.checked })}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer">
              <span className="font-semibold text-[11px]">Visible en mode Play</span>
              <input
                type="checkbox"
                checked={activeLayer.showColliderInPlay !== false}
                onChange={(e) => updateLayer(activeLayer!.id, { showColliderInPlay: e.target.checked })}
                className="rounded border-orange-300 text-orange-600 focus:ring-orange-500 cursor-pointer"
              />
            </label>
          </div>

          {/* Friction & Rebond si obstacle solide */}
          {!activeLayer.colliderIsTrigger && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-200/60">
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-0.5">
                  <span>Adhérence</span>
                  <span>{Math.round((activeLayer.colliderFriction ?? 0.9) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeLayer.colliderFriction ?? 0.9}
                  onChange={(e) =>
                    updateLayer(activeLayer!.id, { colliderFriction: parseFloat(e.target.value) })
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-0.5">
                  <span>Rebond</span>
                  <span>{Math.round((activeLayer.colliderBounce ?? 0) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeLayer.colliderBounce ?? 0}
                  onChange={(e) =>
                    updateLayer(activeLayer!.id, { colliderBounce: parseFloat(e.target.value) })
                  }
                  className="w-full accent-orange-600 cursor-pointer"
                />
              </div>
            </div>
          )}
        </div>
      )}

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
            2. Couleur du trait (Palette Projet)
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={resetProjectPalette}
              title="Réinitialiser les 16 couleurs de la palette du projet"
              className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
            </button>
            <div
              className="w-5 h-5 rounded-lg border border-slate-300 shadow-2xs"
              style={{ backgroundColor: drawingStrokeColor }}
            />
          </div>
        </div>

        <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
          {projectPalette.map((palItem, idx) => {
            const isSelectedSlot =
              selectedStrokePaletteId === palItem.id ||
              (!selectedStrokePaletteId && drawingStrokeColor.toLowerCase() === palItem.color.toLowerCase());
            const validHex =
              palItem.color.startsWith('#') && palItem.color.length === 7
                ? palItem.color
                : palItem.color.length === 4
                ? `#${palItem.color[1]}${palItem.color[1]}${palItem.color[2]}${palItem.color[2]}${palItem.color[3]}${palItem.color[3]}`
                : '#6366f1';
            return (
              <label
                key={palItem.id}
                className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer shadow-2xs relative overflow-hidden flex items-center justify-center ${
                  isSelectedSlot
                    ? 'border-indigo-600 scale-115 ring-2 ring-indigo-300/50 z-10'
                    : 'border-white hover:scale-105'
                }`}
                style={{ backgroundColor: palItem.color }}
                title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color}) — Appuyez directement pour choisir/modifier la couleur`}
              >
                <input
                  type="color"
                  value={validHex}
                  onClick={() => {
                    setSelectedStrokePaletteId(palItem.id);
                    setDrawingStrokeColor(palItem.color);
                  }}
                  onChange={(e) => {
                    const nextHex = e.target.value;
                    setSelectedStrokePaletteId(palItem.id);
                    setDrawingStrokeColor(nextHex);
                    updateProjectPaletteColor(palItem.id, nextHex);
                  }}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
          <span className="text-[10px] font-bold text-indigo-700 truncate">
            {selectedStrokePaletteId
              ? `Modifier ${projectPalette.find((p) => p.id === selectedStrokePaletteId)?.name || 'ce slot'} (partagé)`
              : 'Couleur libre :'}
          </span>
          <input
            type="color"
            value={drawingStrokeColor.startsWith('#') ? drawingStrokeColor : '#6366f1'}
            onChange={(e) => {
              const nextHex = e.target.value;
              setDrawingStrokeColor(nextHex);
              if (selectedStrokePaletteId) {
                updateProjectPaletteColor(selectedStrokePaletteId, nextHex);
              }
            }}
            className="w-6 h-6 rounded-lg border border-slate-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
            title="Modifier cette couleur de la palette pour tout le projet"
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
              onClick={() => {
                setSelectedFillPaletteId(undefined);
                setDrawingFillColor('none');
              }}
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

        <div className="grid grid-cols-8 gap-1.5 p-2 bg-slate-50 rounded-2xl border border-slate-200">
          {projectPalette.map((palItem, idx) => {
            const isSelectedSlot =
              drawingFillColor !== 'none' &&
              (selectedFillPaletteId === palItem.id ||
                (!selectedFillPaletteId && drawingFillColor.toLowerCase() === palItem.color.toLowerCase()));
            const validHex =
              palItem.color.startsWith('#') && palItem.color.length === 7
                ? palItem.color
                : palItem.color.length === 4
                ? `#${palItem.color[1]}${palItem.color[1]}${palItem.color[2]}${palItem.color[2]}${palItem.color[3]}${palItem.color[3]}`
                : '#6366f1';
            return (
              <label
                key={palItem.id}
                className={`w-7 h-7 rounded-xl border-2 transition-transform cursor-pointer shadow-2xs relative overflow-hidden flex items-center justify-center ${
                  isSelectedSlot
                    ? 'border-indigo-600 scale-115 ring-2 ring-indigo-300/50 z-10'
                    : 'border-white hover:scale-105'
                }`}
                style={{ backgroundColor: palItem.color }}
                title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color}) — Appuyez directement pour choisir/modifier la couleur`}
              >
                <input
                  type="color"
                  value={validHex}
                  onClick={() => {
                    setSelectedFillPaletteId(palItem.id);
                    setDrawingFillColor(palItem.color);
                  }}
                  onChange={(e) => {
                    const nextHex = e.target.value;
                    setSelectedFillPaletteId(palItem.id);
                    setDrawingFillColor(nextHex);
                    updateProjectPaletteColor(palItem.id, nextHex);
                  }}
                  className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
                />
              </label>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 px-2 py-1.5 bg-indigo-50/50 rounded-xl border border-indigo-100">
          <span className="text-[10px] font-bold text-indigo-700 truncate">
            {selectedFillPaletteId && drawingFillColor !== 'none'
              ? `Modifier ${projectPalette.find((p) => p.id === selectedFillPaletteId)?.name || 'ce slot'} (partagé)`
              : 'Remplissage personnalisé :'}
          </span>
          <input
            type="color"
            value={drawingFillColor.startsWith('#') ? drawingFillColor : '#6366f1'}
            onChange={(e) => {
              const nextHex = e.target.value;
              setDrawingFillColor(nextHex);
              if (selectedFillPaletteId) {
                updateProjectPaletteColor(selectedFillPaletteId, nextHex);
              }
            }}
            className="w-6 h-6 rounded-lg border border-slate-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
            title="Modifier cette couleur de la palette pour tout le projet"
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
          {[2, 4, 8, 12, 20, 32].map((w) => (
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
