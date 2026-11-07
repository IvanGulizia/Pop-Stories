import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import { Plus, GripVertical, Trash2, Sparkles, PlayCircle } from 'lucide-react';
import { EntityType, Entity } from '../types';

interface EntityGalleryProps {
  onOpenCreateModal: () => void;
}

interface ArchetypeItem {
  type: EntityType;
  name: string;
  defaultStateId?: string;
  statesCount: number;
  isCustom?: boolean;
  archetypeData?: Entity;
}

export function EntityGallery({ onOpenCreateModal }: EntityGalleryProps) {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const deleteCustomArchetype = useSceneStore((state) => state.deleteCustomArchetype);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);

  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);

  const [renamingType, setRenamingType] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');

  const entityList = Object.values(entities);

  // Build complete catalog of available objects
  const catalog: ArchetypeItem[] = [];

  // Add all custom and standard archetypes from store
  Object.entries(customArchetypes).forEach(([archetypeType, arch]) => {
    if (!catalog.some((item) => item.type === archetypeType)) {
      const isBase = archetypeType === 'plant' || archetypeType === 'apple' || archetypeType === 'custom';
      catalog.push({
        type: archetypeType,
        name: arch.name || (archetypeType === 'plant' ? 'Plante' : archetypeType === 'apple' ? 'Pomme' : 'Étoile'),
        statesCount: Object.keys(arch.states || {}).length || 1,
        isCustom: !isBase,
        archetypeData: arch,
      });
    }
  });

  // Include any entities from the active canvas that might have distinct types
  entityList.forEach((e) => {
    if (!catalog.some((item) => item.type === e.type)) {
      catalog.push({
        type: e.type,
        name: e.name || e.type,
        statesCount: Object.keys(e.states || {}).length || 1,
        isCustom: true,
        archetypeData: e,
      });
    }
  });

  const handleDragStart = (e: React.DragEvent, item: ArchetypeItem) => {
    const dragData = {
      kind: 'entity-archetype',
      entityType: item.type,
      name: item.name,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.setData('text/plain', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleItemClick = (item: ArchetypeItem) => {
    // Si une instance existe déjà sur la scène, la sélectionner
    const instance = entityList.find((e) => e.type === item.type);
    if (instance) {
      selectEntity(instance.id);
    } else {
      // Sélectionner l'archétype directement pour ouvrir son inspecteur sans le poser sur la scène
      selectEntity(item.type);
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 text-slate-800">
      {/* 1. CREATION CARD AT THE VERY TOP */}
      <button
        type="button"
        onClick={onOpenCreateModal}
        className="w-full p-3.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl shadow-xs transition-all flex flex-col items-center justify-center gap-2 cursor-pointer border border-slate-700/50 group"
      >
        <div className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <div className="text-xs font-bold tracking-wide">Créer une Entité</div>
          <div className="text-[10px] text-slate-300 font-normal">Dessiner un objet vectoriel</div>
        </div>
      </button>

      {/* 2. CATALOGUE D'OBJETS DISPONIBLES */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Catalogue d'Objets ({catalog.length})
          </span>
          <span className="text-[10px] text-slate-400">Glisser sur la scène</span>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {catalog.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
              <div className="text-2xl">✨</div>
              <div>
                <p className="text-xs font-bold text-slate-700">Catalogue vide</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Aucun objet dans votre projet.
                </p>
              </div>
              <div className="flex flex-col gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={onOpenCreateModal}
                  className="w-full py-1.5 text-[11px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Dessiner un objet
                </button>
                <button
                  type="button"
                  onClick={restoreDefaultScene}
                  className="w-full py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> Scène d'exemple
                </button>
              </div>
            </div>
          ) : (
            catalog.map((item) => {
              const representativeEntity =
                entityList.find((e) => e.type === item.type) ||
                item.archetypeData ||
                customArchetypes[item.type];

              const isSelected = representativeEntity && selectedEntityId === representativeEntity.id;

              const isRenaming = renamingType === item.type;

              return (
                <div
                  key={item.type}
                  draggable={!isRenaming}
                  onDragStart={(e) => handleDragStart(e, item)}
                  onClick={() => handleItemClick(item)}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingType(item.type);
                    setTempName(item.name);
                  }}
                  className={`p-3 bg-white hover:bg-slate-50 border rounded-2xl flex items-center justify-between shadow-2xs gap-2.5 transition-all cursor-pointer group ${
                    isSelected
                      ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/30'
                      : 'border-slate-200/90 hover:border-slate-300'
                  }`}
                  title="Cliquez pour inspecter • Double-cliquez pour renommer • Glissez sur la scène"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="text-slate-300 group-hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-1 overflow-hidden shrink-0 border border-slate-200/70">
                      <EntityMiniPreview entity={representativeEntity} type={item.type} size={32} />
                    </div>
                    <div className="min-w-0 flex-1">
                      {isRenaming ? (
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              if (tempName.trim()) {
                                updateEntityDetails(item.type, { name: tempName.trim() });
                              }
                              setRenamingType(null);
                            } else if (e.key === 'Escape') {
                              setRenamingType(null);
                            }
                          }}
                          onBlur={() => {
                            if (tempName.trim()) {
                              updateEntityDetails(item.type, { name: tempName.trim() });
                            }
                            setRenamingType(null);
                          }}
                          autoFocus
                          onClick={(e) => e.stopPropagation()}
                          className="text-xs font-bold text-slate-800 bg-white border border-indigo-400 rounded-lg px-2 py-0.5 outline-none w-full shadow-2xs ring-1 ring-indigo-500/30"
                        />
                      ) : (
                        <>
                          <p className="text-xs font-bold text-slate-800 truncate" title="Double-cliquez pour renommer">{item.name}</p>
                          <p className="text-[10px] text-slate-400 font-medium">
                            {item.statesCount} {item.statesCount > 1 ? 'états' : 'état'}
                          </p>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteCustomArchetype(item.type);
                      }}
                      className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer ce modèle et toutes ses instances sur la scène"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
