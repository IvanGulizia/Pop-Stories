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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim() || 'Mon Dessin';
    const cleanType = cleanName.toLowerCase().replace(/[^a-z0-9]/gi, '_');
    const tags = tagInput
      .split(/[\s,]+/)
      .map((t) => t.replace(/^#/, '').trim())
      .filter((t) => t.length > 0);

    addCustomEntity({
      name: cleanName,
      type: cleanType,
      icon: '🎨',
      drawingDataUrl,
      vectorPaths,
      color,
      tags: tags.length > 0 ? tags : [cleanType],
    });

    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex flex-col p-3 sm:p-6 overflow-hidden animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full h-full flex flex-col overflow-hidden max-w-6xl mx-auto">
        
        {/* Top Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-indigo-100 text-indigo-700 rounded-2xl">
              <Paintbrush className="w-6 h-6" />
            </div>
            <div>
              <h2 className="font-bold text-slate-800 text-lg tracking-tight">Atelier de Dessin Vectoriel</h2>
              <p className="text-xs text-slate-500">Créer un nouvel objet personnalisé pour votre scène</p>
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
              onClick={handleSubmit}
              className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
            >
              <Sparkles className="w-4 h-4" /> Ajouter à la scène
            </button>
          </div>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col p-6 overflow-hidden justify-between space-y-4">
          
          {/* Inputs Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 shrink-0">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Nom de l'objet
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ex: Personnage, Étoile, Monstre..."
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white font-medium"
                required
              />
            </div>

            {showTagsSystem && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1 flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5 text-slate-400" /> Tags (mots-clés pour les règles)
                </label>
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  placeholder="ex: joueur, obstacle, nourriture"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-sm text-slate-800 focus:ring-2 focus:ring-indigo-500 outline-none bg-white"
                />
              </div>
            )}
          </div>

          {/* Full Screen Drawing Canvas */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden bg-slate-100/60 p-4 rounded-2xl border border-slate-200/80">
            <DrawingCanvas
              onVectorChange={(paths, dataUrl) => {
                setVectorPaths(paths);
                setDrawingDataUrl(dataUrl);
              }}
              initialColor="#6366f1"
            />
          </div>

        </form>

      </div>
    </div>
  );
}
