import { useState } from 'react';
import { Check, Paintbrush, X } from 'lucide-react';
import { DrawingCanvas, OnionStateOption } from './DrawingCanvas';
import { VectorPath } from '../types';

interface FullScreenDrawingModalProps {
  title: string;
  subtitle?: string;
  initialPaths?: VectorPath[];
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
  onSave: (paths: VectorPath[], dataUrl?: string) => void;
  onClose: () => void;
}

export function FullScreenDrawingModal({
  title,
  subtitle = 'Dessinez votre forme vectorielle en plein écran',
  initialPaths = [],
  onionStates = [],
  currentEditingStateName,
  onSave,
  onClose,
}: FullScreenDrawingModalProps) {
  const [currentPaths, setCurrentPaths] = useState<VectorPath[]>(initialPaths);
  const [currentDataUrl, setCurrentDataUrl] = useState<string | undefined>(undefined);

  const handleVectorChange = (paths: VectorPath[], dataUrl?: string) => {
    setCurrentPaths(paths);
    if (dataUrl) setCurrentDataUrl(dataUrl);
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full h-full flex flex-col overflow-hidden max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Paintbrush className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg tracking-tight">{title}</h2>
              {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
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
              onClick={() => onSave(currentPaths, currentDataUrl)}
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
            onionStates={onionStates}
            currentEditingStateName={currentEditingStateName}
            onVectorChange={handleVectorChange}
          />
        </div>
      </div>
    </div>
  );
}
