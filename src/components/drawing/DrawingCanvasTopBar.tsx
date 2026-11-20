import {
  Undo2,
  Redo2,
  Target,
  Crosshair,
  Grid,
  Magnet,
  Check,
  PenTool,
} from 'lucide-react';
import { VectorPoint } from '../../types';

interface DrawingCanvasTopBarProps {
  currentEditingStateName?: string;
  tool: string;
  activePolylineCount: number;
  selectedCount: number;
  hideTopHistoryButtons: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  hasReferenceGuide: boolean;
  guideOpacity: number;
  onToggleGuide: () => void;
  isCursorMode: boolean;
  showHotspot: boolean;
  hotspot: VectorPoint;
  onToggleHotspot: () => void;
  showGrid: boolean;
  onToggleGrid: () => void;
  snapToGrid: boolean;
  onToggleSnapToGrid: () => void;
  stylusOnlyDrawing?: boolean;
  onToggleStylusOnly?: () => void;
  onFinishPolyline: () => void;
  pathCount: number;
}

export function DrawingCanvasTopBar({
  currentEditingStateName,
  tool,
  activePolylineCount,
  selectedCount,
  hideTopHistoryButtons,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  hasReferenceGuide,
  guideOpacity,
  onToggleGuide,
  isCursorMode,
  showHotspot,
  hotspot,
  onToggleHotspot,
  showGrid,
  onToggleGrid,
  snapToGrid,
  onToggleSnapToGrid,
  stylusOnlyDrawing = false,
  onToggleStylusOnly,
  onFinishPolyline,
  pathCount,
}: DrawingCanvasTopBarProps) {
  return (
    <div className="w-full flex items-center justify-between px-3 py-1 mb-2 text-xs text-slate-500 font-medium select-none flex-wrap gap-2">
      <div className="flex items-center gap-2">
        {currentEditingStateName && (
          <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
            État en cours : <strong className="text-indigo-600 font-mono">{currentEditingStateName}</strong>
          </span>
        )}
        {tool === 'line' && (
          <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Ligne Droite (Glissez d'un point à l'autre)
          </span>
        )}
        {tool === 'circle' && (
          <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Cercle (Glissez pour tracer)
          </span>
        )}
        {tool === 'polyline' && activePolylineCount > 0 && (
          <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] animate-pulse">
            Polyligne : {activePolylineCount} pts (double-clic pour terminer)
          </span>
        )}
        {tool === 'lasso_fill' && (
          <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Lasso Plein (Fill)
          </span>
        )}
        {tool === 'bucket' && (
          <span className="bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Pot de Peinture : Cliquez sur une forme ou son intérieur
          </span>
        )}
        {tool === 'eraser_partial' && (
          <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Gomme Précise (Efface les bouts de traits)
          </span>
        )}
        {tool === 'eraser_stroke' && (
          <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            Gomme Trait (Efface la forme entière)
          </span>
        )}
        {tool === 'select' && selectedCount > 0 && (
          <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
            {selectedCount > 1
              ? `${selectedCount} formes sélectionnées`
              : '1 forme sélectionnée'}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Annuler / Rétablir toujours accessibles en haut (masqués uniquement si déjà portés par la barre haute de la modale) */}
        {!hideTopHistoryButtons && (
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={onUndo}
              disabled={!canUndo}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              title="Annuler (Cmd/Ctrl+Z)"
            >
              <Undo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Annuler</span>
            </button>
            <button
              type="button"
              onClick={onRedo}
              disabled={!canRedo}
              className="px-2 py-1 rounded-lg text-[11px] font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-35 disabled:cursor-not-allowed flex items-center gap-1 transition-all cursor-pointer active:scale-95"
              title="Rétablir (Cmd/Ctrl+Shift+Z)"
            >
              <Redo2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Rétablir</span>
            </button>
          </div>
        )}

        {/* Guide & Hotspot Quick Toggles */}
        {(hasReferenceGuide || isCursorMode) && (
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
            {hasReferenceGuide && (
              <button
                type="button"
                onClick={onToggleGuide}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  guideOpacity > 0
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Afficher/Masquer le dessin repère (calque modèle)"
              >
                <Target className="w-3 h-3" />
                <span>Modèle {guideOpacity > 0 ? 'On' : 'Off'}</span>
              </button>
            )}

            {isCursorMode && (
              <button
                type="button"
                onClick={onToggleHotspot}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  showHotspot
                    ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Afficher/Masquer le point d'impact réel du curseur"
              >
                <Crosshair className="w-3 h-3" />
                <span>Impact ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})</span>
              </button>
            )}
          </div>
        )}

        {/* Grille & Magnétisme Toggles */}
        <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
          <button
            type="button"
            onClick={onToggleGrid}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              showGrid
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Afficher/Masquer la grille de repère"
          >
            <Grid className="w-3 h-3" />
            <span>Grille {showGrid ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            onClick={onToggleSnapToGrid}
            className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
              snapToGrid
                ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
            }`}
            title="Activer/Désactiver l'aimant Snap to Grid"
          >
            <Magnet className="w-3 h-3" />
            <span>Snap {snapToGrid ? 'On' : 'Off'}</span>
          </button>

          {onToggleStylusOnly && (
            <button
              type="button"
              onClick={onToggleStylusOnly}
              className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                stylusOnlyDrawing
                  ? 'bg-purple-100 text-purple-800 border border-purple-200 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
              }`}
              title="Mode iPad / Apple Pencil : ignore les tracés au doigt (rejet paume) tout en laissant stylet et souris actifs"
            >
              <PenTool className="w-3 h-3" />
              <span className="hidden sm:inline">Stylet seul</span>
            </button>
          )}
        </div>

        {tool === 'polyline' && activePolylineCount >= 2 && (
          <button
            type="button"
            onClick={onFinishPolyline}
            className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
          >
            <Check className="w-3 h-3" /> Valider
          </button>
        )}
        <span className="bg-white text-slate-600 font-bold px-2.5 py-0.5 rounded-full font-mono border border-slate-200 shadow-2xs text-[11px]">
          {pathCount} {pathCount > 1 ? 'formes' : 'forme'}
        </span>
      </div>
    </div>
  );
}
