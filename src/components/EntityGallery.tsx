import React, { useState, useRef, useEffect } from 'react';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import {
  Plus,
  GripVertical,
  Trash2,
  Sparkles,
  Bookmark,
  Download,
  Upload,
  ArrowUpRight,
  FolderHeart,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  MapPin,
  X,
  Copy,
} from 'lucide-react';
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
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const localEntityCollection = useSceneStore((state) => state.localEntityCollection || EMPTY_RECORD);
  const duplicateCustomArchetype = useSceneStore((state) => state.duplicateCustomArchetype);
  const deleteCustomArchetype = useSceneStore((state) => state.deleteCustomArchetype);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);

  const saveToLocalCollection = useSceneStore((state) => state.saveToLocalCollection);
  const removeFromLocalCollection = useSceneStore((state) => state.removeFromLocalCollection);
  const instantiateFromCollection = useSceneStore((state) => state.instantiateFromCollection);
  const exportCollectionJSON = useSceneStore((state) => state.exportCollectionJSON);
  const importCollectionJSON = useSceneStore((state) => state.importCollectionJSON);

  const entityGroups = useSceneStore((state) => state.entityGroups || EMPTY_LIST);
  const addEntityGroup = useSceneStore((state) => state.addEntityGroup);
  const updateEntityGroup = useSceneStore((state) => state.updateEntityGroup);
  const deleteEntityGroup = useSceneStore((state) => state.deleteEntityGroup);
  const assignEntityTypeToGroup = useSceneStore((state) => state.assignEntityTypeToGroup);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const pendingCatalogSpawnType = useSceneStore((state) => state.pendingCatalogSpawnType);
  const setPendingCatalogSpawnType = useSceneStore((state) => state.setPendingCatalogSpawnType);

  const [renamingType, setRenamingType] = useState<string | null>(null);
  const [tempName, setTempName] = useState<string>('');
  const [notificationMsg, setNotificationMsg] = useState<string | null>(null);
  const [showNewGroupInput, setShowNewGroupInput] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [renamingGroupId, setRenamingGroupId] = useState<string | null>(null);
  const [tempGroupName, setTempGroupName] = useState('');
  const [draggingCatalogType, setDraggingCatalogType] = useState<string | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | 'root' | null>(null);
  const [pointerDragItem, setPointerDragItem] = useState<{
    type: EntityType;
    name: string;
    clientX: number;
    clientY: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const entityList = Object.values(entities);

  // Drag tactile / stylet depuis la poignée de la galerie vers le canvas de scène (contourne l'absence de Drag&Drop HTML5 sur iPadOS)
  useEffect(() => {
    if (!pointerDragItem) return;
    const handleMove = (ev: PointerEvent) => {
      setPointerDragItem((prev) =>
        prev ? { ...prev, clientX: ev.clientX, clientY: ev.clientY } : null
      );
    };
    const handleUp = (ev: PointerEvent) => {
      const container = document.getElementById('scene-canvas-container');
      if (container) {
        const rect = container.getBoundingClientRect();
        if (
          ev.clientX >= rect.left &&
          ev.clientX <= rect.right &&
          ev.clientY >= rect.top &&
          ev.clientY <= rect.bottom
        ) {
          const dropX = Math.max(20, Math.min(rect.width - 80, ev.clientX - rect.left - 40));
          const dropY = Math.max(20, Math.min(rect.height - 80, ev.clientY - rect.top - 40));
          spawnEntity({
            type: pointerDragItem.type,
            position: { x: Math.round(dropX), y: Math.round(dropY) },
          });
        }
      }
      setPointerDragItem(null);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [pointerDragItem?.type, spawnEntity]);

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
    e.dataTransfer.effectAllowed = 'copyMove';
    setDraggingCatalogType(item.type);
  };

  const handleDragEnd = () => {
    setDraggingCatalogType(null);
    setDragOverGroupId(null);
  };

  const extractDroppedArchetypeType = (e: React.DragEvent): string | null => {
    try {
      const raw = e.dataTransfer.getData('application/json');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.kind === 'entity-archetype' && parsed?.entityType) {
          return parsed.entityType;
        }
      }
    } catch {
      // fallback to local React state
    }
    return draggingCatalogType;
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
        (() => {
          const catalogByType = new Map<string, ArchetypeItem>(catalog.map((c) => [c.type, c]));
          const groupedTypes = new Set<string>();
          entityGroups.forEach((g) => {
            g.entityTypes.forEach((t) => {
              if (catalogByType.has(t)) groupedTypes.add(t);
            });
          });
          const ungroupedItems = catalog.filter((item) => !groupedTypes.has(item.type));
          const isDraggingGroupedItem = Boolean(draggingCatalogType && groupedTypes.has(draggingCatalogType));

          const handleCreateGroup = (e: React.FormEvent) => {
            e.preventDefault();
            const trimmed = newGroupName.trim();
            if (trimmed) {
              addEntityGroup(trimmed);
            }
            setNewGroupName('');
            setShowNewGroupInput(false);
          };

          const renderCatalogCard = (item: ArchetypeItem) => {
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
                onDragEnd={handleDragEnd}
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
                title="Cliquez pour inspecter • Double-cliquez pour renommer • Glissez sur la scène ou dans un groupe"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div
                    onPointerDown={(e) => {
                      if (isRenaming) return;
                      e.stopPropagation();
                      try {
                        (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
                      } catch (_) {}
                      setPointerDragItem({
                        type: item.type,
                        name: item.name,
                        clientX: e.clientX,
                        clientY: e.clientY,
                      });
                    }}
                    className="p-1 -ml-1 text-slate-300 group-hover:text-slate-500 transition-colors cursor-grab active:cursor-grabbing shrink-0 touch-none"
                    title="Glisser sur la scène (compatible souris, doigt & stylet)"
                  >
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
                  {/* Bouton Placer (Tap-to-place iPad/tactile ou clic précis sur scène) */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setPendingCatalogSpawnType(
                        pendingCatalogSpawnType === item.type ? null : item.type
                      );
                    }}
                    className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                      pendingCatalogSpawnType === item.type
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    }`}
                    title="Placer sur la scène (toucher la scène pour déposer une instance)"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                  </button>

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
                      const createdType = duplicateCustomArchetype(item.type);
                      if (createdType) {
                        notify('Nouvelle entité indépendante créée !');
                      }
                    }}
                    className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Dupliquer pour créer une nouvelle entité indépendante (sans lien)"
                  >
                    <Copy className="w-3.5 h-3.5" />
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
          };

          return (
            <div className="flex-1 flex flex-col min-h-0 space-y-2">
              <div className="flex items-center justify-between gap-2 px-1 shrink-0">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Objets ({catalog.length})
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowNewGroupInput((v) => !v)}
                    className="text-[11px] font-bold text-slate-600 hover:text-indigo-700 bg-slate-100 hover:bg-indigo-50 border border-slate-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                    title="Créer un groupe pour organiser les entités"
                  >
                    <FolderPlus className="w-3 h-3" /> Groupe
                  </button>
                </div>
              </div>

              {showNewGroupInput && (
                <form onSubmit={handleCreateGroup} className="flex gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200 shrink-0">
                  <input
                    type="text"
                    placeholder="Nom du groupe (ex: Décors, Ennemis)..."
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    className="flex-1 text-xs font-bold border border-slate-300 bg-white text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="bg-indigo-600 text-white text-xs px-2.5 py-1.5 rounded-xl font-bold hover:bg-indigo-700 cursor-pointer"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowNewGroupInput(false);
                      setNewGroupName('');
                    }}
                    className="text-xs text-slate-500 px-1.5 py-1.5 hover:bg-slate-200 rounded-xl cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </form>
              )}

              <div className="space-y-2 overflow-y-auto flex-1 pr-1">
                {catalog.length === 0 && entityGroups.length === 0 ? (
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
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Groupes d'entités */}
                    {entityGroups.map((group) => {
                      const groupItems = group.entityTypes
                        .map((t) => catalogByType.get(t))
                        .filter((item): item is ArchetypeItem => Boolean(item));
                      const isCollapsed = Boolean(group.isCollapsed);
                      const isDropTarget = dragOverGroupId === group.id;

                      return (
                        <div
                          key={group.id}
                          onDragOver={(e) => {
                            if (!draggingCatalogType) return;
                            e.preventDefault();
                            e.dataTransfer.dropEffect = 'move';
                            if (dragOverGroupId !== group.id) setDragOverGroupId(group.id);
                          }}
                          onDragLeave={(e) => {
                            if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverGroupId === group.id) {
                              setDragOverGroupId(null);
                            }
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            const entityType = extractDroppedArchetypeType(e);
                            if (entityType) {
                              assignEntityTypeToGroup(entityType, group.id);
                            }
                            setDraggingCatalogType(null);
                            setDragOverGroupId(null);
                          }}
                          className={`rounded-2xl border transition-all ${
                            isDropTarget
                              ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300/60'
                              : 'bg-slate-50/80 border-slate-200'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-1.5 px-2.5 py-2">
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              <button
                                type="button"
                                onClick={() => updateEntityGroup(group.id, { isCollapsed: !isCollapsed })}
                                className="p-0.5 text-slate-500 hover:text-indigo-700 rounded cursor-pointer shrink-0"
                                title={isCollapsed ? 'Déplier le groupe' : 'Replier le groupe'}
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="w-3.5 h-3.5" />
                                ) : (
                                  <ChevronDown className="w-3.5 h-3.5" />
                                )}
                              </button>
                              {isCollapsed ? (
                                <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                              ) : (
                                <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                              )}
                              {renamingGroupId === group.id ? (
                                <input
                                  type="text"
                                  value={tempGroupName}
                                  onChange={(e) => setTempGroupName(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (tempGroupName.trim()) {
                                        updateEntityGroup(group.id, { name: tempGroupName.trim() });
                                      }
                                      setRenamingGroupId(null);
                                    } else if (e.key === 'Escape') {
                                      setRenamingGroupId(null);
                                    }
                                  }}
                                  onBlur={() => {
                                    if (tempGroupName.trim()) {
                                      updateEntityGroup(group.id, { name: tempGroupName.trim() });
                                    }
                                    setRenamingGroupId(null);
                                  }}
                                  autoFocus
                                  onFocus={(e) => e.target.select()}
                                  className="text-xs font-bold bg-white text-slate-800 border border-indigo-300 rounded px-1.5 py-0.5 flex-1 min-w-0 outline-none"
                                />
                              ) : (
                                <span
                                  onDoubleClick={() => {
                                    setRenamingGroupId(group.id);
                                    setTempGroupName(group.name);
                                  }}
                                  className="text-xs font-bold text-slate-700 truncate cursor-text hover:text-indigo-600"
                                  title="Double-cliquez pour renommer le groupe"
                                >
                                  {group.name}
                                </span>
                              )}
                              <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 rounded-full shrink-0">
                                {groupItems.length}
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => deleteEntityGroup(group.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer shrink-0"
                              title="Supprimer le groupe (les entités restent dans le projet)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {!isCollapsed && (
                            <div className="px-2 pb-2 space-y-2">
                              {groupItems.length === 0 ? (
                                <div className="text-[11px] text-slate-400 italic text-center py-2.5 border border-dashed border-slate-200 rounded-xl bg-white/60">
                                  Glissez une entité ici
                                </div>
                              ) : (
                                groupItems.map((item) => renderCatalogCard(item))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Zone de dépôt pour retirer une entité de son groupe */}
                    {isDraggingGroupedItem && (
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.dataTransfer.dropEffect = 'move';
                          if (dragOverGroupId !== 'root') setDragOverGroupId('root');
                        }}
                        onDragLeave={() => {
                          if (dragOverGroupId === 'root') setDragOverGroupId(null);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const entityType = extractDroppedArchetypeType(e);
                          if (entityType) {
                            assignEntityTypeToGroup(entityType, null);
                          }
                          setDraggingCatalogType(null);
                          setDragOverGroupId(null);
                        }}
                        className={`text-[11px] font-bold text-center py-2 px-3 rounded-xl border-2 border-dashed transition-all ${
                          dragOverGroupId === 'root'
                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                            : 'border-slate-300 bg-slate-50 text-slate-500'
                        }`}
                      >
                        Déposer ici (Hors groupe)
                      </div>
                    )}

                    {/* Entités hors groupe */}
                    {ungroupedItems.map((item) => renderCatalogCard(item))}
                  </>
                )}
              </div>
            </div>
          );
        })()
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

      {pointerDragItem && (
        <div
          className="fixed z-50 pointer-events-none px-3 py-1.5 rounded-xl bg-slate-900/90 text-white text-xs font-bold shadow-xl border border-indigo-400/50 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap"
          style={{ left: pointerDragItem.clientX, top: pointerDragItem.clientY }}
        >
          + {pointerDragItem.name}
        </div>
      )}
    </div>
  );
}
