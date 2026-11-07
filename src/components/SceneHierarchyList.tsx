import { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import {
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  Copy,
  Trash2,
  Layers,
  Sparkles,
  GripVertical,
} from 'lucide-react';
import { EntityId } from '../types';

interface SceneHierarchyListProps {
  onOpenCreateModal?: () => void;
}

export function SceneHierarchyList({ onOpenCreateModal }: SceneHierarchyListProps) {
  const entities = useSceneStore((state) => state.entities);
  const entityOrder = useSceneStore((state) => state.entityOrder);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const bringForward = useSceneStore((state) => state.bringForward);
  const sendBackward = useSceneStore((state) => state.sendBackward);
  const bringToFront = useSceneStore((state) => state.bringToFront);
  const sendToBack = useSceneStore((state) => state.sendToBack);
  const duplicateEntity = useSceneStore((state) => state.duplicateEntity);
  const deleteEntity = useSceneStore((state) => state.deleteEntity);
  const reorderEntities = useSceneStore((state) => state.reorderEntities);

  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null);
  const [dragOverEntityId, setDragOverEntityId] = useState<string | null>(null);

  const order = entityOrder && entityOrder.length > 0 ? entityOrder : Object.keys(entities);
  const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
  const activeEntities = allKeys.map((id) => entities[id]).filter(Boolean);

  // We display the hierarchy with topmost entity at the top of the UI list
  const displayList = [...activeEntities].reverse();

  if (activeEntities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-slate-500 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <Layers className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-bold text-slate-700">Scène vide</p>
          <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
            Aucun objet n'est présent sur la scène. Glissez une entité depuis l'onglet <strong>Entités</strong> ou créez-en une nouvelle.
          </p>
        </div>
        {onOpenCreateModal && (
          <button
            type="button"
            onClick={onOpenCreateModal}
            className="mt-2 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            Créer un objet
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full space-y-2">
      <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500">
        <span className="flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-indigo-600" />
          Hiérarchie ({activeEntities.length})
        </span>
        <span className="text-[10px] font-normal text-slate-400">
          Haut = Premier plan
        </span>
      </div>

      <div className="space-y-1.5 flex-1 overflow-y-auto pr-0.5">
        {displayList.map((entity, index) => {
          const isSelected = selectedEntityId === entity.id;
          const isTop = index === 0;
          const isBottom = index === displayList.length - 1;
          const currentState = entity.states[entity.currentStateId];
          const isDragOver = dragOverEntityId === entity.id;

          return (
            <div
              key={entity.id}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData('text/plain', entity.id);
                e.dataTransfer.effectAllowed = 'move';
                setDraggedEntityId(entity.id);
              }}
              onDragEnd={() => {
                setDraggedEntityId(null);
                setDragOverEntityId(null);
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverEntityId !== entity.id) {
                  setDragOverEntityId(entity.id);
                }
              }}
              onDragLeave={() => {
                if (dragOverEntityId === entity.id) {
                  setDragOverEntityId(null);
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sourceId = e.dataTransfer.getData('text/plain') || draggedEntityId;
                if (sourceId && sourceId !== entity.id) {
                  reorderEntities(sourceId, entity.id);
                }
                setDraggedEntityId(null);
                setDragOverEntityId(null);
              }}
              onClick={() => selectEntity(entity.id)}
              className={`p-2.5 bg-white border rounded-2xl transition-all cursor-pointer flex flex-col gap-2 group ${
                isDragOver
                  ? 'border-indigo-600 ring-2 ring-indigo-400 bg-indigo-50/50 scale-[1.01]'
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
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-400 font-medium">
                        {currentState?.name || entity.currentStateId}
                      </span>
                      {entity.isDraggable && (
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

              {/* Barre de contrôle Z-Index (Premier plan, monter, descendre, arrière-plan) */}
              <div className="flex items-center justify-between pt-1 border-t border-slate-100/90 text-slate-500">
                <span className="text-[9px] text-slate-400 font-medium">
                  Plan #{displayList.length - index}
                </span>

                <div className="flex items-center gap-1 bg-slate-50 p-0.5 rounded-lg border border-slate-200/60">
                  <button
                    type="button"
                    disabled={isTop}
                    onClick={(e) => {
                      e.stopPropagation();
                      bringToFront(entity.id);
                    }}
                    className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
                    title="Mettre tout devant (Premier plan)"
                  >
                    <ChevronsUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isTop}
                    onClick={(e) => {
                      e.stopPropagation();
                      bringForward(entity.id);
                    }}
                    className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
                    title="Avancer d'un rang"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isBottom}
                    onClick={(e) => {
                      e.stopPropagation();
                      sendBackward(entity.id);
                    }}
                    className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
                    title="Reculer d'un rang"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={isBottom}
                    onClick={(e) => {
                      e.stopPropagation();
                      sendToBack(entity.id);
                    }}
                    className="p-1 hover:text-indigo-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 cursor-pointer"
                    title="Mettre tout derrière (Arrière-plan)"
                  >
                    <ChevronsDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
