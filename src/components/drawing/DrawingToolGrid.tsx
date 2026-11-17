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
  Crosshair,
} from 'lucide-react';

export type DrawingCanvasToolId =
  | 'select'
  | 'pencil'
  | 'line'
  | 'polyline'
  | 'rectangle'
  | 'circle'
  | 'lasso_fill'
  | 'bucket'
  | 'eraser_stroke'
  | 'eraser_partial'
  | 'hotspot';

interface DrawingToolGridProps {
  tool: DrawingCanvasToolId;
  showHotspotTool: boolean;
  onSelectTool: (tool: DrawingCanvasToolId) => void;
}

export function DrawingToolGrid({
  tool,
  showHotspotTool,
  onSelectTool,
}: DrawingToolGridProps) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
        Outils de dessin
      </span>
      <div className="grid grid-cols-5 gap-1 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
        {/* Pointeur / Sélection */}
        <button
          type="button"
          onClick={() => onSelectTool('select')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'select'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Sélection, déplacement & redimensionnement"
        >
          <MousePointer className="w-3.5 h-3.5" />
          <span className="text-[9px]">Sélect</span>
        </button>

        {/* Crayon libre */}
        <button
          type="button"
          onClick={() => onSelectTool('pencil')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'pencil'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Crayon / Dessin libre"
        >
          <Pencil className="w-3.5 h-3.5" />
          <span className="text-[9px]">Crayon</span>
        </button>

        {/* Ligne droite */}
        <button
          type="button"
          onClick={() => onSelectTool('line')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'line'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Ligne droite (2 points)"
        >
          <Slash className="w-3.5 h-3.5" />
          <span className="text-[9px]">Ligne</span>
        </button>

        {/* Polyligne */}
        <button
          type="button"
          onClick={() => onSelectTool('polyline')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'polyline'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Polyligne (cliquez point par point)"
        >
          <GitCommit className="w-3.5 h-3.5" />
          <span className="text-[9px]">Poly</span>
        </button>

        {/* Rectangle arrondi */}
        <button
          type="button"
          onClick={() => onSelectTool('rectangle')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'rectangle'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Rectangle (arrondi réglable)"
        >
          <Square className="w-3.5 h-3.5" />
          <span className="text-[9px]">Rect</span>
        </button>

        {/* Cercle */}
        <button
          type="button"
          onClick={() => onSelectTool('circle')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'circle'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Cercle"
        >
          <Circle className="w-3.5 h-3.5" />
          <span className="text-[9px]">Cercle</span>
        </button>

        {/* Lasso Fill */}
        <button
          type="button"
          onClick={() => onSelectTool('lasso_fill')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'lasso_fill'
              ? 'bg-indigo-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Lasso / Pinceau plein (Remplissage fermé)"
        >
          <Lasso className="w-3.5 h-3.5" />
          <span className="text-[9px]">Lasso</span>
        </button>

        {/* Pot de peinture */}
        <button
          type="button"
          onClick={() => onSelectTool('bucket')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'bucket'
              ? 'bg-teal-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Pot de peinture (Remplir une forme ou zone fermée)"
        >
          <PaintBucket className="w-3.5 h-3.5" />
          <span className="text-[9px]">Pot</span>
        </button>

        {/* Gomme Précise */}
        <button
          type="button"
          onClick={() => onSelectTool('eraser_partial')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'eraser_partial'
              ? 'bg-rose-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Gomme Précise (Efface les bouts de traits)"
        >
          <Eraser className="w-3.5 h-3.5" />
          <span className="text-[9px]">Gomme</span>
        </button>

        {/* Gomme Trait entier */}
        <button
          type="button"
          onClick={() => onSelectTool('eraser_stroke')}
          className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
            tool === 'eraser_stroke'
              ? 'bg-rose-600 text-white font-bold shadow-2xs'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
          title="Gomme Trait (Efface la forme entière)"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span className="text-[9px]">Objet</span>
        </button>

        {/* Point d'Impact Hotspot (Curseur) */}
        {showHotspotTool && (
          <button
            type="button"
            onClick={() => onSelectTool('hotspot')}
            className={`p-1.5 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
              tool === 'hotspot'
                ? 'bg-rose-600 text-white font-bold shadow-2xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Définir le point d'impact réel du curseur (Hotspot)"
          >
            <Crosshair className="w-3.5 h-3.5 text-rose-500" />
            <span className="text-[9px]">Impact</span>
          </button>
        )}
      </div>
    </div>
  );
}
