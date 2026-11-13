import { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import { SceneLayerManager } from './SceneLayerManager';
import {
  Copy,
  Trash2,
  Layers,
  Sparkles,
  GripVertical,
  Link2,
} from 'lucide-react';
import { EntityId, SceneLayer, SceneLayerGroup } from '../types';
import { isEntityDraggable } from '../utils/matterPhysicsEngine';

interface SceneHierarchyListProps {
  onOpenCreateModal?: () => void;
  onOpenDrawLayerModal?: (layer: SceneLayer, group: SceneLayerGroup) => void;
}

export function SceneHierarchyList({ onOpenCreateModal, onOpenDrawLayerModal }: SceneHierarchyListProps) {
  const entities = useSceneStore((state) => state.entities);
  const entityOrder = useSceneStore((state) => state.entityOrder);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const duplicateEntity = useSceneStore((state) => state.duplicateEntity);
  const deleteEntity = useSceneStore((state) => state.deleteEntity);
  const reorderEntities = useSceneStore((state) => state.reorderEntities);

  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);

  const order = entityOrder && entityOrder.length > 0 ? entityOrder : Object.keys(entities);
  const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
  const activeEntities = allKeys.map((id) => entities[id]).filter(Boolean);

  // We display the hierarchy with topmost entity at the top of the UI list
  const displayList = [...activeEntities].reverse();

  return (
    <div className="flex flex-col h-full space-y-4">
      {/* 1. GESTION DES CALQUES DE DÉCOR (BACKGROUND / FOREGROUND) */}
      {onOpenDrawLayerModal && (
        <div className="pb-3 border-b border-slate-200">
          <SceneLayerManager onOpenDrawLayerModal={onOpenDrawLayerModal} />
        </div>
      )}

      {/* 2. HIÉRARCHIE DES ENTITÉS DE JEU */}
      <div className="space-y-2 flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Objets de jeu ({activeEntities.length})
          </span>
          <span className="text-[10px] font-normal text-slate-400">
            Haut = Premier plan
          </span>
        </div>

        {activeEntities.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 px-4 text-center text-slate-500 space-y-2 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200">
            <p className="text-xs font-bold text-slate-700">Aucun objet sur la scène</p>
            <p className="text-[11px] text-slate-400">
              Glissez une entité depuis l'onglet <strong>Entités</strong>.
            </p>
            {onOpenCreateModal && (
              <button
                type="button"
                onClick={onOpenCreateModal}
                className="mt-1 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                Créer un objet
              </button>
            )}
          </div>
        ) : (

      <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
        {displayList.map((entity, index) => {
          const isSelected = selectedEntityId === entity.id;
          const currentState = entity.states[entity.currentStateId];
          const isTargeted = dragOverTarget?.id === entity.id;
          const showGapAbove = isTargeted && dragOverTarget.position === 'above';
          const showGapBelow = isTargeted && dragOverTarget.position === 'below';

          return (
            <div key={entity.id} className="relative">
              {/* Drop slot indicator ABOVE */}
              {showGapAbove && (
                <div className="absolute -top-1.5 left-1 right-1 h-1 bg-indigo-600 rounded-full shadow-md z-30 pointer-events-none animate-pulse flex items-center justify-center">
                  <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full -top-2.5 relative shadow-xs">
                    ↓ Placer ici
                  </span>
                </div>
              )}

              <div
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/entity-id', entity.id);
                  e.dataTransfer.setData('text/plain', entity.id);
                  e.dataTransfer.effectAllowed = 'move';
                  setDraggedEntityId(entity.id);
                }}
                onDragEnd={() => {
                  setDraggedEntityId(null);
                  setDragOverTarget(null);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  e.dataTransfer.dropEffect = 'move';
                  const rect = e.currentTarget.getBoundingClientRect();
                  const midY = rect.top + rect.height / 2;
                  const pos = e.clientY < midY ? 'above' : 'below';
                  if (dragOverTarget?.id !== entity.id || dragOverTarget.position !== pos) {
                    setDragOverTarget({ id: entity.id, position: pos });
                  }
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                    if (dragOverTarget?.id === entity.id) {
                      setDragOverTarget(null);
                    }
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  const sourceId = e.dataTransfer.getData('text/entity-id') || e.dataTransfer.getData('text/plain') || draggedEntityId;
                  if (sourceId && sourceId !== entity.id) {
                    reorderEntities(sourceId, entity.id, dragOverTarget?.position || 'above');
                  }
                  setDraggedEntityId(null);
                  setDragOverTarget(null);
                }}
                onClick={() => selectEntity(entity.id)}
                className={`p-2.5 bg-white border rounded-2xl transition-all cursor-pointer flex flex-col gap-2 group ${
                  entity.parentId && entities[entity.parentId] ? 'ml-3 border-l-4 border-l-indigo-400' : ''
                } ${
                  isTargeted && dragOverTarget?.position === 'above'
                    ? 'border-t-4 border-t-indigo-600 border-x-indigo-400 border-b-slate-200 bg-indigo-50/50 shadow-md scale-[1.01]'
                    : isTargeted && dragOverTarget?.position === 'below'
                    ? 'border-b-4 border-b-indigo-600 border-x-indigo-400 border-t-slate-200 bg-indigo-50/50 shadow-md scale-[1.01]'
                    : isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
                    : 'border-slate-200/90 hover:border-slate-300'
                }`}
              >
              {/* Entête d'item : poignée, miniature, nom, état */}
              <div className="flex items-center justify-between gap-2 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className="text-slate-300 group-hover:text-slate-600 transition-colors cursor-grab active:cursor-grabbing shrink-0 p-0.5 hover:bg-slate-100 rounded"
                    title="Glisser pour réorganiser dans la hiérarchie"
                  >
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center p-0.5 shrink-0 border border-slate-200/70 overflow-hidden">
                    <EntityMiniPreview entity={entity} type={entity.type} size={28} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate leading-snug">
                      {entity.name}
                    </p>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {currentState?.name || entity.currentStateId}
                      </span>
                      {entity.parentId && entities[entity.parentId] && (
                        <span
                          className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-bold rounded max-w-[110px] truncate"
                          title={`Attaché à ${entities[entity.parentId].name}`}
                        >
                          <Link2 className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{entities[entity.parentId].name}</span>
                        </span>
                      )}
                      {isEntityDraggable(entity, currentState).canDrag && (
                        <span className="text-[9px] px-1 py-0.2 bg-emerald-50 text-emerald-600 font-semibold rounded">
                          Drag
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions primaires : dupliquer et supprimer */}
                <div className="flex items-center gap-1 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      duplicateEntity(entity.id);
                    }}
                    className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                    title="Dupliquer l'objet"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteEntity(entity.id);
                    }}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                    title="Supprimer de la scène"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>

            {/* Drop slot indicator BELOW */}
            {showGapBelow && (
              <div className="absolute -bottom-1.5 left-1 right-1 h-1 bg-indigo-600 rounded-full shadow-md z-30 pointer-events-none animate-pulse flex items-center justify-center">
                <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full top-2.5 relative shadow-xs">
                  ↑ Placer ici
                </span>
              </div>
            )}
          </div>
          );
        })}
      </div>
    )}
  </div>
</div>
  );
}
