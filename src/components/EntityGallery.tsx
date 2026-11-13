import React, { useState, useRef } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import { Plus, GripVertical, Trash2, Sparkles, PlayCircle, Bookmark, Download, Upload, ArrowUpRight, FolderHeart } from 'lucide-react';
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
  const [activeTab, setActiveTab] = useState<'project' | 'collection'>('project');

  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const localEntityCollection = useSceneStore((state) => state.localEntityCollection || {});
  const deleteCustomArchetype = useSceneStore((state) => state.deleteCustomArchetype);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);

  const saveToLocalCollection = useSceneStore((state) => state.saveToLocalCollection);
  const removeFromLocalCollection = useSceneStore((state) => state.removeFromLocalCollection);
  const instantiateFromCollection = useSceneStore((state) => state.instantiateFromCollection);
  const exportCollectionJSON = useSceneStore((state) => state.exportCollectionJSON);
  const importCollectionJSON = useSceneStore((state) => state.importCollectionJSON);

  const [renamingType, setRenamingType] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const entityList = Object.values(entities);

  const notify = (msg: string) => {
    setNotificationMsg(msg);
    setTimeout(() => setNotificationMsg(null), 3000);
  };

  // Build project catalog items
  const catalog: ArchetypeItem[] = [];

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

  const collectionItems = Object.values(localEntityCollection);

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

  const handleExportCollection = () => {
    const data = exportCollectionJSON();
    const str = JSON.stringify(data, null, 2);
    const blob = new Blob([str], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `collection-entites-atelier-vivant-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Collection exportée sous forme de fichier JSON !');
  };

  const handleImportCollection = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        const res = importCollectionJSON(json);
        notify(res.message);
      } catch {
        notify('Fichier JSON invalide.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full space-y-3.5 text-slate-800">
      {notificationMsg && (
        <div className="bg-indigo-600 text-white text-xs font-bold px-3 py-2 rounded-xl shadow-md transition-all flex items-center justify-between animate-fade-in shrink-0">
          <span>{notificationMsg}</span>
        </div>
      )}

      {/* 1. CREATION CARD AT THE VERY TOP */}
      <button
        type="button"
        onClick={onOpenCreateModal}
        className="w-full p-3 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl shadow-xs transition-all flex items-center justify-between gap-3 cursor-pointer border border-slate-700/50 group shrink-0"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
            <Plus className="w-4 h-4 text-white" strokeWidth={2.5} />
          </div>
          <div className="text-left">
            <div className="text-xs font-bold tracking-wide">Dessiner une Entité</div>
            <div className="text-[10px] text-slate-300 font-normal">Atelier vectoriel multi-états</div>
          </div>
        </div>
        <Sparkles className="w-4 h-4 text-indigo-400" />
      </button>

      {/* 2. TABS: PROJET vs COLLECTION PERMANENTE */}
      <div className="flex items-center p-1 bg-slate-200/80 rounded-2xl shrink-0">
        <button
          type="button"
          onClick={() => setActiveTab('project')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'project'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📦 Projet</span>
          <span className="text-[10px] bg-slate-100 px-1.5 py-0.2 rounded-full font-extrabold text-slate-700">
            {catalog.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('collection')}
          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
            activeTab === 'collection'
              ? 'bg-white text-slate-900 shadow-2xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <span>📚 Collection Local</span>
          <span className="text-[10px] bg-purple-100 px-1.5 py-0.2 rounded-full font-extrabold text-purple-800">
            {collectionItems.length}
          </span>
        </button>
      </div>

      {/* 3. TAB CONTENT */}
      {activeTab === 'project' ? (
        /* --- TAB 1: PROJET CATALOGUE --- */
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          <div className="flex items-center justify-between px-1 shrink-0">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Objets du Projet ({catalog.length})
            </span>
            <span className="text-[10px] text-slate-400">Glisser sur la scène</span>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {catalog.length === 0 ? (
              <div className="p-4 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-center space-y-3">
                <div className="text-2xl">✨</div>
                <div>
                  <p className="text-xs font-bold text-slate-700">Scène vide</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Aucun objet sur la scène. Vous pouvez en importer depuis votre Collection Locale ci-dessus !
                  </p>
                </div>
                <div className="flex flex-col gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setActiveTab('collection')}
                    className="w-full py-1.5 text-[11px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FolderHeart className="w-3.5 h-3.5" /> Ouvrir Ma Collection Local
                  </button>
                  <button
                    type="button"
                    onClick={restoreDefaultScene}
                    className="w-full py-1.5 text-[11px] font-medium text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <PlayCircle className="w-3.5 h-3.5 text-emerald-600" /> Charger scène exemple
                  </button>
                </div>
              </div>
            ) : (
              catalog.map((item) => {
                const instanceOnScene = entityList.find((e) => e.type === item.type);
                const representativeEntity =
                  instanceOnScene ||
                  item.archetypeData ||
                  customArchetypes[item.type];

                const isSelected = Boolean(
                  (instanceOnScene && selectedEntityId === instanceOnScene.id) ||
                    (!instanceOnScene &&
                      (selectedEntityId === item.type ||
                        (representativeEntity && selectedEntityId === representativeEntity.id)))
                );
                const isRenaming = renamingType === item.type;
                const isSavedInCollection = !!localEntityCollection[item.type];

                return (
                  <div
                    key={item.type}
                    draggable={!isRenaming}
                    onDragStart={(e) => handleDragStart(e, item)}
                    onClick={() => {
                      const instance = entityList.find((e) => e.type === item.type);
                      if (instance) selectEntity(instance.id);
                      else selectEntity(item.type);
                    }}
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

                    <div className="flex items-center gap-1 shrink-0">
                      {/* Bouton pour sauvegarder dans la Collection Locale permanente */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const res = saveToLocalCollection(item.type);
                          notify(res.message);
                        }}
                        className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                          isSavedInCollection
                            ? 'text-purple-600 bg-purple-50 hover:bg-purple-100'
                            : 'text-slate-400 hover:text-purple-600 hover:bg-purple-50'
                        }`}
                        title={
                          isSavedInCollection
                            ? 'Mettre à jour dans Ma Collection Local'
                            : 'Enregistrer dans Ma Collection Local (pour réutiliser dans tous vos projets)'
                        }
                      >
                        <Bookmark className="w-3.5 h-3.5" fill={isSavedInCollection ? 'currentColor' : 'none'} />
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteCustomArchetype(item.type);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Supprimer ce modèle de la scène"
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
      ) : (
        /* --- TAB 2: PERMANENT LOCAL COLLECTION --- */
        <div className="flex-1 flex flex-col min-h-0 space-y-2">
          {/* Controls Bar: Import/Export JSON */}
          <div className="flex items-center justify-between gap-1.5 px-1 shrink-0">
            <span className="text-[11px] font-bold text-purple-800 uppercase tracking-wider">
              Collection ({collectionItems.length})
            </span>
            <div className="flex items-center gap-1.5">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImportCollection}
                accept=".json"
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="px-2 py-1 text-[10px] font-bold text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg border border-purple-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Importer des entités depuis un fichier JSON"
              >
                <Upload className="w-3 h-3" />
                <span>Importer</span>
              </button>
              <button
                type="button"
                onClick={handleExportCollection}
                className="px-2 py-1 text-[10px] font-bold text-slate-700 bg-white hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors flex items-center gap-1 cursor-pointer"
                title="Exporter votre collection au format JSON"
              >
                <Download className="w-3 h-3" />
                <span>Exporter</span>
              </button>
            </div>
          </div>

          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {collectionItems.length === 0 ? (
              <div className="p-4 bg-purple-50/50 rounded-2xl border border-dashed border-purple-200 text-center space-y-2.5">
                <div className="text-2xl">📚</div>
                <div>
                  <p className="text-xs font-bold text-purple-950">Collection Locale Vide</p>
                  <p className="text-[11px] text-purple-700 mt-0.5 leading-tight">
                    Enregistrez vos entités dessinées (dessins, états, noms) pour pouvoir les invoquer instantanément dans n'importe quel projet !
                  </p>
                </div>
                <p className="text-[10px] text-slate-500 font-medium">
                  Allez dans l'onglet <strong>Projet</strong> et cliquez sur l'icône marque-page 🔖 pour enregistrer une entité.
                </p>
              </div>
            ) : (
              collectionItems.map((ent) => {
                const statesCount = Object.keys(ent.states || {}).length || 1;
                return (
                  <div
                    key={ent.type}
                    className="p-3 bg-white hover:bg-purple-50/40 border border-slate-200 rounded-2xl flex items-center justify-between shadow-2xs gap-2.5 transition-all group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center p-1 overflow-hidden shrink-0 border border-purple-200/80">
                        <EntityMiniPreview entity={ent} type={ent.type} size={32} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{ent.name}</p>
                        <p className="text-[10px] text-purple-700 font-medium">
                          {statesCount} {statesCount > 1 ? 'états' : 'état'} • Presets enregistrés
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {/* Invoquer sur la scène active */}
                      <button
                        type="button"
                        onClick={() => {
                          const id = instantiateFromCollection(ent.type);
                          if (id) {
                            notify(`"${ent.name}" invoquée sur la scène active !`);
                          }
                        }}
                        className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 text-white font-bold text-[11px] rounded-xl shadow-2xs transition-all flex items-center gap-1 cursor-pointer active:scale-95"
                        title="Ajouter une instance de cette entité dans la scène du projet actuel"
                      >
                        <ArrowUpRight className="w-3.5 h-3.5" />
                        <span>Invoquer</span>
                      </button>

                      {/* Supprimer de la collection local */}
                      <button
                        type="button"
                        onClick={() => {
                          removeFromLocalCollection(ent.type);
                          notify(`"${ent.name}" retirée de la Collection.`);
                        }}
                        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Retirer de la collection local"
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
      )}
    </div>
  );
}
