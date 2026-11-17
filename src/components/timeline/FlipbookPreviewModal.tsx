import { Film, Pause } from 'lucide-react';
import { AnimationFrame } from '../../types';

export function renderFrameThumbnailSvg(frame: AnimationFrame) {
  const paths = frame.vectorPaths || [];
  const layers = frame.drawingLayers;
  if (paths.length === 0) {
    return (
      <span className="text-[9px] text-slate-300 italic select-none">Vide</span>
    );
  }
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full pointer-events-none">
      {!layers || layers.length === 0 ? (
        paths.map((p) => (
          <path
            key={p.id}
            d={p.d}
            stroke={p.stroke}
            strokeWidth={p.strokeWidth}
            fill={p.fill || 'none'}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))
      ) : (
        (() => {
          const fallbackLayerId = layers[layers.length - 1]?.id || 'layer-1';
          const layerIds = new Set(layers.map((l) => l.id));
          return [...layers].reverse().map((layer) => {
            if (!layer.visible) return null;
            const layerPaths = paths.filter((p) => {
              const resolvedId = p.layerId && layerIds.has(p.layerId) ? p.layerId : fallbackLayerId;
              return resolvedId === layer.id;
            });
            return (
              <g key={layer.id} opacity={layer.opacity ?? 1}>
                {layerPaths.map((p) => (
                  <path
                    key={p.id}
                    d={p.d}
                    stroke={p.stroke}
                    strokeWidth={p.strokeWidth}
                    fill={p.fill || 'none'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            );
          });
        })()
      )}
    </svg>
  );
}

interface FlipbookPreviewModalProps {
  frames: AnimationFrame[];
  previewFrameIndex: number;
  frameRate: number;
  onStopPreview: () => void;
}

export function FlipbookPreviewModal({
  frames,
  previewFrameIndex,
  frameRate,
  onStopPreview,
}: FlipbookPreviewModalProps) {
  const previewFrame = frames[previewFrameIndex] || frames[0];
  if (!previewFrame) return null;

  return (
    <div className="absolute inset-0 z-40 bg-slate-900/40 backdrop-blur-2xs flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-5 flex flex-col items-center gap-3.5 w-full max-w-sm">
        <div className="flex items-center justify-between w-full">
          <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
            <Film className="w-4 h-4 text-violet-600" />
            Aperçu Easy ({frameRate} FPS)
          </span>
          <span className="text-[11px] font-mono font-bold text-violet-700 bg-violet-50 px-2.5 py-0.5 rounded-lg border border-violet-200">
            F{previewFrameIndex + 1} / {frames.length}
          </span>
        </div>

        <div className="w-60 h-60 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-center p-3">
          {renderFrameThumbnailSvg(previewFrame)}
        </div>

        {/* Mini barre de progression lecture */}
        <div className="flex items-center gap-1 w-full px-1">
          {frames.map((fr, i) => (
            <div
              key={fr.id}
              className={`h-1.5 flex-1 rounded-full transition-colors ${
                i === previewFrameIndex ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={onStopPreview}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 cursor-pointer"
        >
          <Pause className="w-3.5 h-3.5" /> Revenir au dessin
        </button>
      </div>
    </div>
  );
}
