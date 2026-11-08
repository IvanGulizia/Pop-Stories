import { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { SceneLayer, SceneLayerGroup } from '../types';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Paintbrush,
  Plus,
  Trash2,
  Folder,
  FolderPlus,
  Sparkles,
  MoveHorizontal,
} from 'lucide-react';

interface SceneLayerManagerProps {
  onOpenDrawLayerModal: (layer: SceneLayer, group: SceneLayerGroup) => void;
}

export function SceneLayerManager({ onOpenDrawLayerModal }: SceneLayerManagerProps) {
  const layerGroups = useSceneStore((state) => state.layerGroups);
  const selectedLayerId = useSceneStore((state) => state.selectedLayerId);
  const addLayerGroup = useSceneStore((state) => state.addLayerGroup);
  const deleteLayerGroup = useSceneStore((state) => state.deleteLayerGroup);
  const toggleLayerGroupCollapse = useSceneStore((state) => state.toggleLayerGroupCollapse);
  const addLayerToGroup = useSceneStore((state) => state.addLayerToGroup);
  const deleteLayer = useSceneStore((state) => state.deleteLayer);
  const updateLayer = useSceneStore((state) => state.updateLayer);
  const selectLayer = useSceneStore((state) => state.selectLayer);

  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');

  const handleCreateGroup = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newGroupName.trim()) return;
    addLayerGroup(newGroupName.trim());
    setNewGroupName('');
    setIsCreatingGroup(false);
  };

  return (
    <div className="space-y-3">
      {/* En-tête des calques de décor */}
      <div className="flex items-center justify-between px-1">
        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          Décors & Calques de Scène
        </span>
        <button
          type="button"
          onClick={() => setIsCreatingGroup(!isCreatingGroup)}
          className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
          title="Nouveau groupe de calques (ex: Milieu, Ciel, Sol...)"
        >
          <FolderPlus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Formulaire ajout nouveau groupe */}
      {isCreatingGroup && (
        <form onSubmit={handleCreateGroup} className="flex gap-1.5 p-2 bg-indigo-50/60 rounded-xl border border-indigo-100">
          <input
            type="text"
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="Nom du groupe (ex: Décor Lointain)"
            autoFocus
            className="flex-1 px-2.5 py-1 text-xs rounded-lg border border-indigo-200 bg-white focus:outline-none"
          />
          <button
            type="submit"
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold cursor-pointer"
          >
            Créer
          </button>
        </form>
      )}

      {/* Groupes de calques */}
      <div className="space-y-2">
        {layerGroups.map((group) => {
          const isBackground = group.kind === 'background';
          const isForeground = group.kind === 'foreground';
          const isCollapsed = !!group.isCollapsed;

          return (
            <div
              key={group.id}
              className={`rounded-2xl border transition-all overflow-hidden ${
                isBackground
                  ? 'bg-sky-50/40 border-sky-200/80'
                  : isForeground
                  ? 'bg-amber-50/40 border-amber-200/80'
                  : 'bg-slate-50/70 border-slate-200'
              }`}
            >
              {/* En-tête du groupe */}
              <div className="p-2 sm:p-2.5 flex items-center justify-between gap-2 bg-white/70">
                <div className="flex items-center gap-1.5 min-w-0">
                  <button
                    type="button"
                    onClick={() => toggleLayerGroupCollapse(group.id)}
                    className="p-0.5 text-slate-500 hover:text-slate-800 rounded cursor-pointer shrink-0"
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>

                  <Folder className={`w-3.5 h-3.5 shrink-0 ${
                    isBackground ? 'text-sky-600' : isForeground ? 'text-amber-600' : 'text-slate-500'
                  }`} />

                  <span className="text-xs font-bold text-slate-800 truncate">
                    {group.name}
                  </span>

                  <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.2 rounded-full">
                    {group.layers.length}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => addLayerToGroup(group.id)}
                    className="p-1 text-slate-600 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors cursor-pointer flex items-center gap-0.5 text-[10px] font-bold"
                    title="Ajouter un calque dans ce groupe"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Calque</span>
                  </button>

                  {!isBackground && !isForeground && (
                    <button
                      type="button"
                      onClick={() => deleteLayerGroup(group.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md cursor-pointer"
                      title="Supprimer ce groupe"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Liste des calques du groupe */}
              {!isCollapsed && (
                <div className="p-2 space-y-1.5 border-t border-slate-100">
                  {group.layers.length === 0 ? (
                    <div className="py-2 text-center text-[11px] text-slate-400 italic">
                      Aucun calque. Cliquez sur "+ Calque" pour dessiner un décor.
                    </div>
                  ) : (
                    group.layers.map((layer) => {
                      const isSelected = selectedLayerId === layer.id;
                      const pathsCount = layer.vectorPaths?.length || 0;

                      return (
                        <div
                          key={layer.id}
                          onClick={() => selectLayer(layer.id)}
                          className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-300 ring-2 ring-indigo-500/20'
                              : 'bg-white hover:bg-slate-50 border-slate-200/80'
                          }`}
                        >
                          {/* Info calque */}
                          <div className="min-w-0 flex items-center gap-2">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateLayer(layer.id, { visible: !layer.visible });
                              }}
                              className="text-slate-400 hover:text-slate-700 cursor-pointer p-0.5"
                              title={layer.visible ? 'Masquer ce calque' : 'Afficher ce calque'}
                            >
                              {layer.visible ? <Eye className="w-3.5 h-3.5 text-slate-700" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                            </button>

                            <div className="min-w-0">
                              <p className="text-xs font-bold text-slate-800 truncate leading-snug">
                                {layer.name}
                              </p>
                              <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                <span>{pathsCount} {pathsCount > 1 ? 'formes' : 'forme'}</span>
                                {layer.parallaxFactor !== undefined && layer.parallaxFactor !== 1 && (
                                  <span className="text-[9px] font-semibold text-sky-600 bg-sky-50 px-1 rounded flex items-center gap-0.5">
                                    <MoveHorizontal className="w-2.5 h-2.5" />
                                    {layer.parallaxFactor === 0 ? 'Fixe' : `${layer.parallaxFactor}x`}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Bouton Dessiner sur ce calque */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                selectLayer(layer.id);
                                onOpenDrawLayerModal(layer, group);
                              }}
                              className="px-2 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs active:scale-95"
                              title="Ouvrir l'atelier de dessin vectoriel pour ce calque"
                            >
                              <Paintbrush className="w-3 h-3" />
                              <span>Dessiner</span>
                            </button>

                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteLayer(layer.id);
                              }}
                              className="p-1 text-slate-300 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                              title="Supprimer ce calque"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
