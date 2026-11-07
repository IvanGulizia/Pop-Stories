import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Paintbrush, X } from 'lucide-react';
import { DrawingCanvas, OnionStateOption, ReferenceGuideOption } from './DrawingCanvas';
import { VectorPath, ColliderType } from '../types';

interface FullScreenDrawingModalProps {
  title?: string;
  subtitle?: string;
  initialPaths?: VectorPath[];
  initialColliderType?: ColliderType;
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
  referenceGuide?: ReferenceGuideOption;
  availableReferenceGuides?: ReferenceGuideOption[];
  initialHotspot?: { x: number; y: number };
  isCursorMode?: boolean;
  onSave: (
    paths: VectorPath[],
    dataUrl?: string,
    colliderType?: ColliderType,
    stateName?: string,
    hotspot?: { x: number; y: number }
  ) => void;
  onClose: () => void;
}

export function FullScreenDrawingModal({
  title,
  subtitle = 'Dessinez votre forme vectorielle en plein écran',
  initialPaths = [],
  initialColliderType = 'box',
  onionStates = [],
  currentEditingStateName,
  referenceGuide,
  availableReferenceGuides,
  initialHotspot,
  isCursorMode = false,
  onSave,
  onClose,
}: FullScreenDrawingModalProps) {
  const [currentPaths, setCurrentPaths] = useState<VectorPath[]>(initialPaths);
  const [currentDataUrl, setCurrentDataUrl] = useState<string | undefined>(undefined);
  const [currentColliderType, setCurrentColliderType] = useState<ColliderType>(initialColliderType);
  const [currentHotspot, setCurrentHotspot] = useState<{ x: number; y: number }>(
    initialHotspot || referenceGuide?.hotspot || { x: 75, y: 25 }
  );
  const [stateName, setStateName] = useState<string>(currentEditingStateName || 'Normal');
  const [isEditingName, setIsEditingName] = useState(false);

  const handleVectorChange = (paths: VectorPath[], dataUrl?: string) => {
    setCurrentPaths(paths);
    if (dataUrl) setCurrentDataUrl(dataUrl);
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] bg-[#f8fafc] flex flex-col overflow-hidden select-none"
      style={{ isolation: 'isolate' }}
    >
      <div className="bg-[#f8fafc] w-full h-full flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Paintbrush className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500">Atelier de Dessin •</span>
                {isEditingName ? (
                  <div className="flex items-center gap-1">
                    <span className="text-xs font-bold text-slate-700">État :</span>
                    <input
                      type="text"
                      value={stateName}
                      onChange={(e) => setStateName(e.target.value)}
                      onBlur={() => setIsEditingName(false)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === 'Escape') setIsEditingName(false);
                      }}
                      autoFocus
                      className="px-2 py-0.5 text-sm font-bold text-slate-900 bg-white border border-indigo-500 rounded-lg shadow-2xs outline-none"
                    />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsEditingName(true)}
                    className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-indigo-50 hover:bg-indigo-100/80 border border-indigo-200 text-indigo-900 text-sm font-bold transition-all cursor-pointer group"
                    title="Cliquer pour renommer cet état"
                  >
                    <span>État : {stateName}</span>
                    <span className="text-[10px] text-indigo-500 opacity-60 group-hover:opacity-100 underline decoration-dotted">
                      (renommer)
                    </span>
                  </button>
                )}
              </div>
              {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() =>
                onSave(
                  currentPaths,
                  currentDataUrl,
                  currentColliderType,
                  stateName.trim() || undefined,
                  currentHotspot
                )
              }
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" /> Enregistrer le dessin
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Full-screen Canvas Body */}
        <div className="flex-1 p-4 sm:p-6 overflow-hidden bg-slate-100/60 flex items-center justify-center">
          <DrawingCanvas
            initialPaths={initialPaths}
            initialColliderType={initialColliderType}
            onionStates={onionStates}
            currentEditingStateName={currentEditingStateName}
            onVectorChange={handleVectorChange}
            onColliderChange={(type) => setCurrentColliderType(type)}
            referenceGuide={referenceGuide}
            availableReferenceGuides={availableReferenceGuides}
            initialHotspot={currentHotspot}
            onHotspotChange={(pos) => setCurrentHotspot(pos)}
            isCursorMode={isCursorMode}
          />
        </div>
      </div>
    </div>,
    document.body
  );
}
