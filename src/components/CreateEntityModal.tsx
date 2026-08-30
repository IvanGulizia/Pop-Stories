import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { X, Sparkles, Tag, Paintbrush } from 'lucide-react';
import { DrawingCanvas } from './DrawingCanvas';
import { VectorPath } from '../types';

interface CreateEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateEntityModal({ isOpen, onClose }: CreateEntityModalProps) {
  const addCustomEntity = useSceneStore((state) => state.addCustomEntity);
  const showTagsSystem = useSceneStore((state) => state.settings.showTagsSystem);

  const [name, setName] = useState('Mon Dessin');
  const [drawingDataUrl, setDrawingDataUrl] = useState<string | undefined>(undefined);
  const [vectorPaths, setVectorPaths] = useState<VectorPath[]>([]);
  const [color] = useState('transparent');
  const [tagInput, setTagInput] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = name.trim() || 'Mon Dessin';
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]/gi, '_') || 'dessin';
    const uniqueType = `custom_${slug}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    const tags = tagInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter((t) => t.length > 0);

    addCustomEntity({
      name: cleanName,
      type: uniqueType,
      icon: '🎨',
      drawingDataUrl,
      vectorPaths,
      color,
      tags: tags.length > 0 ? tags : [slug, 'custom'],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full h-full flex flex-col overflow-hidden max-w-6xl mx-auto">
        
        {/* Top Header with Compact Inline Name Input */}
        <div className="flex items-center justify-between px-6 py-3.5 border-b border-slate-200 bg-slate-50 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className="p-2 bg-indigo-100 text-indigo-700 rounded-xl shrink-0">
              <Paintbrush className="w-5 h-5" />
            </div>
            <span className="font-bold text-slate-800 text-sm tracking-tight shrink-0">
              Atelier de Dessin
            </span>
            <span className="text-slate-300">|</span>
            <div className="flex-1 max-w-xs">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nom de l'objet (ex: Personnage, Étoile...)"
                className="w-full bg-white border border-slate-300 focus:border-indigo-500 rounded-xl px-3 py-1.5 text-xs text-slate-800 font-semibold focus:ring-2 focus:ring-indigo-100 outline-none transition-all shadow-2xs"
                required
              />
            </div>
            {showTagsSystem && (
              <div className="hidden sm:flex items-center gap-1 max-w-[200px]">
                <Tag className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="Tags (ex: #joueur)"
                  className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-700 outline-none"
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200/70 rounded-xl transition-colors cursor-pointer"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              className="px-4 py-1.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-3.5 h-3.5" /> Ajouter à la scène
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-4 overflow-hidden justify-between">
          {/* Full Screen Drawing Canvas */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100/60 p-3 rounded-2xl border border-slate-200/80">
            <DrawingCanvas
              onVectorChange={(paths, dataUrl) => {
                setVectorPaths(paths);
                setDrawingDataUrl(dataUrl);
              }}
              initialStrokeColor="#6366f1"
            />
          </div>
        </form>

      </div>
    </div>
  );
}
