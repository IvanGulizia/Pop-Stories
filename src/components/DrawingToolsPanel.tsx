import { useState } from 'react';
import { useSceneStore, DEFAULT_PROJECT_PALETTE } from '../store/useSceneStore';
import { SceneLayer, SceneLayerGroup, UnifiedDrawTool } from '../types';
import {
  MousePointer,
  Pencil,
  Slash,
  GitCommit,
  Square,
  Circle,
  Lasso,
  PaintBucket,
  Eraser,
  Scissors,
  Undo2,
  Redo2,
  Trash2,
  Palette,
  RotateCcw,
  Shield,
  Tag,
  Plus,
  X,
  Grid,
  Magnet,
} from 'lucide-react';

interface DrawingToolsPanelProps {
  onClose?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onClearLayer?: () => void;
}

export function DrawingToolsPanel({
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  onClearLayer,
}: DrawingToolsPanelProps) {
  const selectedLayerId = useSceneStore((state) => state.selectedLayerId);
  const layerGroups = useSceneStore((state) => state.layerGroups || []);
  const drawingTool = useSceneStore((state) => state.drawingTool);
  const drawingStrokeColor = useSceneStore((state) => state.drawingStrokeColor);
  const drawingFillColor = useSceneStore((state) => state.drawingFillColor);
  const drawingStrokeWidth = useSceneStore((state) => state.drawingStrokeWidth);
  const drawingShowGrid = useSceneStore((state) => state.drawingShowGrid);
  const drawingSnapToGrid = useSceneStore((state) => state.drawingSnapToGrid);
  const setDrawingTool = useSceneStore((state) => state.setDrawingTool);
  const setDrawingStrokeColor = useSceneStore((state) => state.setDrawingStrokeColor);
  const setDrawingFillColor = useSceneStore((state) => state.setDrawingFillColor);
  const setDrawingStrokeWidth = useSceneStore((state) => state.setDrawingStrokeWidth);
  const setDrawingShowGrid = useSceneStore((state) => state.setDrawingShowGrid);
  const setDrawingSnapToGrid = useSceneStore((state) => state.setDrawingSnapToGrid);
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

  const tools: Array<{
    id: UnifiedDrawTool;
    shortLabel: string;
    title: string;
    icon: typeof Pencil;
    activeClass?: string;
  }> = [
    { id: 'select', shortLabel: 'Sélect', title: 'Sélection, déplacement & redimensionnement', icon: MousePointer },
    { id: 'pencil', shortLabel: 'Crayon', title: 'Crayon / Dessin libre', icon: Pencil },
    { id: 'line', shortLabel: 'Ligne', title: 'Ligne droite (2 points)', icon: Slash },
    { id: 'polyline', shortLabel: 'Poly', title: 'Polyligne (cliquez point par point)', icon: GitCommit },
    { id: 'rectangle', shortLabel: 'Rect', title: 'Rectangle', icon: Square },
    { id: 'circle', shortLabel: 'Cercle', title: 'Cercle', icon: Circle },
    { id: 'lasso_fill', shortLabel: 'Lasso', title: 'Lasso / Pinceau plein (Remplissage fermé)', icon: Lasso },
    { id: 'bucket', shortLabel: 'Pot', title: 'Pot de peinture (Remplir une forme ou zone fermée)', icon: PaintBucket, activeClass: 'bg-teal-600 text-white shadow-2xs' },
    { id: 'eraser_partial', shortLabel: 'Gomme', title: 'Gomme Précise (Efface les bouts de traits)', icon: Eraser, activeClass: 'bg-rose-600 text-white shadow-2xs' },
    { id: 'eraser_stroke', shortLabel: 'Objet', title: 'Gomme Trait (Efface la forme entière)', icon: Scissors, activeClass: 'bg-rose-600 text-white shadow-2xs' },
  ];

  return (
    <div id="drawing-tools-panel" className="space-y-3.5 flex flex-col h-full text-slate-800 select-none">
      {/* Barre rapide en haut : Annuler / Rétablir / Vider */}
      {(onUndo || onRedo || onClearLayer) && (
        <div className="grid grid-cols-3 gap-1.5">
          {onUndo && (
            <button
              type="button"
              onClick={onUndo}
              disabled={canUndo === false}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-200 active:scale-95"
              title="Annuler le dernier tracé (Cmd/Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span>Annuler</span>
            </button>
          )}
          {onRedo && (
            <button
              type="button"
              onClick={onRedo}
              disabled={canRedo === false}
              className="py-1.5 px-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 text-slate-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-slate-200 active:scale-95"
              title="Rétablir le tracé annulé (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span>Rétablir</span>
            </button>
          )}
          {onClearLayer && (
            <button
              type="button"
              onClick={onClearLayer}
              className="py-1.5 px-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer border border-rose-200 active:scale-95"
              title="Effacer tous les tracés de ce calque"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Vider</span>
            </button>
          )}
        </div>
      )}

      {/* Outils de Dessin Vectoriel Unifiés (10 outils) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">
            1. Outils de Dessin
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setDrawingShowGrid(!drawingShowGrid)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                drawingShowGrid
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
              title="Afficher/Masquer la grille de repère"
            >
              <Grid className="w-3 h-3" />
              <span>Grille</span>
            </button>
            <button
              type="button"
              onClick={() => setDrawingSnapToGrid(!drawingSnapToGrid)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold flex items-center gap-1 border cursor-pointer transition-all ${
                drawingSnapToGrid
                  ? 'bg-indigo-100 text-indigo-700 border-indigo-200'
                  : 'bg-white text-slate-500 border-slate-200 hover:text-slate-800'
              }`}
              title="Activer/Désactiver le magnétisme sur la grille"
            >
              <Magnet className="w-3 h-3" />
              <span>Snap</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-5 gap-1 bg-slate-50 p-1.5 rounded-2xl border border-slate-200">
          {tools.map((t) => {
            const Icon = t.icon;
            const isActive = drawingTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setDrawingTool(t.id)}
                title={t.title}
                className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  isActive
                    ? t.activeClass || 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                <Icon className="w-3.5 h-3.5 shrink-0" />
                <span className="text-[9px] font-semibold truncate max-w-full">{t.shortLabel}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Opacité du calque actif (arrière-plan, premier-plan, collider) */}
      {activeLayer && (
        <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-2xl space-y-1">
          <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
            <span className="truncate">Opacité ({activeLayer.name})</span>
            <span className="font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
              {Math.round((activeLayer.opacity ?? 1) * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={activeLayer.opacity ?? 1}
            onChange={(e) =>
              updateLayer(activeLayer!.id, { opacity: parseFloat(e.target.value) })
            }
            className="w-full accent-indigo-600 cursor-pointer h-1.5"
          />
        </div>
      )}

      {/* Propriétés spécifiques aux Calques Colliders */}
      {isColliderLayer && activeLayer && (
        <div className="p-3 bg-orange-50/70 border border-orange-200/90 rounded-2xl space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-extrabold text-orange-800 uppercase tracking-wider flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-orange-600" />
              Collider de Décor
            </span>
            <span className="text-[10px] font-semibold text-orange-700 bg-white px-2 py-0.5 rounded-full border border-orange-200 truncate max-w-[120px]">
              {activeLayer.name}
            </span>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-bold text-slate-600 flex items-center gap-1">
              <Tag className="w-3 h-3 text-orange-600" />
              Tags (#sol, #mur, #lave...)
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

          {!activeLayer.colliderIsTrigger && (
            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-orange-200/60">
              <div>
                <div className="flex justify-between text-[10px] font-semibold text-slate-600 mb-0.5">
                  <span>Adhérence</span>
                  <span>{Math.round((activeLayer.colliderFriction ?? 0.8) * 100)}%</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={activeLayer.colliderFriction ?? 0.8}
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

      {/* Palette Projet 16 Couleurs Simultanée : Contour + Remplissage */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
            <Palette className="w-3.5 h-3.5 text-indigo-600" />
            2. Couleurs (Palette Projet)
          </span>
          <button
            type="button"
            onClick={resetProjectPalette}
            title="Réinitialiser les 16 couleurs de la palette du projet"
            className="text-[10px] font-semibold text-slate-400 hover:text-indigo-600 flex items-center gap-0.5 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Contour */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-md border border-slate-300 shadow-2xs"
                style={{
                  backgroundColor: drawingStrokeColor === 'none' ? 'transparent' : drawingStrokeColor,
                }}
              />
              <span className="text-[11px] font-bold text-slate-700">Contour</span>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setSelectedStrokePaletteId(undefined);
                  setDrawingStrokeColor('none');
                }}
                className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                  drawingStrokeColor === 'none'
                    ? 'bg-rose-100 text-rose-700 border-rose-200 font-black'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Sans trait
              </button>
              <input
                type="color"
                value={drawingStrokeColor.startsWith('#') ? drawingStrokeColor : '#000000'}
                onChange={(e) => {
                  const nextHex = e.target.value;
                  setDrawingStrokeColor(nextHex);
                  if (selectedStrokePaletteId) {
                    updateProjectPaletteColor(selectedStrokePaletteId, nextHex);
                  }
                }}
                className="w-5 h-5 rounded-md border border-slate-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
                title="Modifier cette couleur"
              />
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1">
            {projectPalette.map((palItem, idx) => {
              const isSelectedSlot =
                drawingStrokeColor !== 'none' &&
                (selectedStrokePaletteId === palItem.id ||
                  (!selectedStrokePaletteId && drawingStrokeColor.toLowerCase() === palItem.color.toLowerCase()));
              const validHex =
                palItem.color.startsWith('#') && palItem.color.length === 7
                  ? palItem.color
                  : palItem.color.length === 4
                  ? `#${palItem.color[1]}${palItem.color[1]}${palItem.color[2]}${palItem.color[2]}${palItem.color[3]}${palItem.color[3]}`
                  : '#6366f1';
              return (
                <label
                  key={palItem.id}
                  className={`w-6 h-6 rounded-lg border-2 transition-transform cursor-pointer shadow-2xs relative overflow-hidden flex items-center justify-center ${
                    isSelectedSlot
                      ? 'border-indigo-600 scale-110 ring-2 ring-indigo-300/50 z-10'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: palItem.color }}
                  title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color})`}
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
        </div>

        {/* Remplissage */}
        <div className="space-y-1.5 pt-2 border-t border-slate-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-md border border-slate-300 shadow-2xs"
                style={{
                  backgroundColor: drawingFillColor === 'none' ? 'transparent' : drawingFillColor,
                }}
              />
              <span className="text-[11px] font-bold text-slate-700">Remplissage</span>
            </div>
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
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-100'
                }`}
              >
                Transparent
              </button>
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
                className="w-5 h-5 rounded-md border border-slate-300 p-0 cursor-pointer overflow-hidden shadow-2xs shrink-0"
                title="Modifier cette couleur"
              />
            </div>
          </div>

          <div className="grid grid-cols-8 gap-1">
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
                  className={`w-6 h-6 rounded-lg border-2 transition-transform cursor-pointer shadow-2xs relative overflow-hidden flex items-center justify-center ${
                    isSelectedSlot
                      ? 'border-indigo-600 scale-110 ring-2 ring-indigo-300/50 z-10'
                      : 'border-white hover:scale-105'
                  }`}
                  style={{ backgroundColor: palItem.color }}
                  title={`${palItem.name || `Couleur #${idx + 1}`} (${palItem.color})`}
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
        </div>
      </div>

      {/* Épaisseur du Trait (Tailles rapides + Slider fin) */}
      <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">
            3. Épaisseur ({drawingStrokeWidth}px)
          </label>
        </div>

        <div className="grid grid-cols-6 gap-1">
          {[2, 4, 8, 12, 20, 32].map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setDrawingStrokeWidth(w)}
              className={`py-1 text-[11px] font-mono font-bold rounded-lg border transition-all cursor-pointer ${
                drawingStrokeWidth === w
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {w}
            </button>
          ))}
        </div>

        <input
          type="range"
          min={2}
          max={32}
          value={drawingStrokeWidth}
          onChange={(e) => setDrawingStrokeWidth(Number(e.target.value))}
          className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
        />
      </div>
    </div>
  );
}
