import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { Entity, EntityState } from '../types';
import {
  Sparkles,
  Plus,
  Trash2,
  Tag,
  X,
  Paintbrush,
  Hand,
  Layers,
  Edit3,
  Check,
  Link2,
  Unlink,
  Copy,
} from 'lucide-react';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { OnionStateOption } from './DrawingCanvas';
import { BehaviorManager } from './BehaviorManager';

export function Inspector() {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const entities = useSceneStore((state) => state.entities);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);
  const updateEntityState = useSceneStore((state) => state.updateEntityState);
  const updateStateProperties = useSceneStore((state) => state.updateStateProperties);
  const addStateToEntity = useSceneStore((state) => state.addStateToEntity);
  const duplicateStateInEntity = useSceneStore((state) => state.duplicateStateInEntity);
  const removeStateFromEntity = useSceneStore((state) => state.removeStateFromEntity);
  const deleteEntity = useSceneStore((state) => state.deleteEntity);
  const addTagToEntity = useSceneStore((state) => state.addTagToEntity);
  const removeTagFromEntity = useSceneStore((state) => state.removeTagFromEntity);
  const setEntityParent = useSceneStore((state) => state.setEntityParent);
  const updateEntityParentOffset = useSceneStore((state) => state.updateEntityParentOffset);
  const detachEntity = useSceneStore((state) => state.detachEntity);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const showTagsSystem = useSceneStore((state) => state.settings.showTagsSystem);

  const [newTagInput, setNewTagInput] = useState('');
  const [showAddStateInput, setShowAddStateInput] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [editingStateDrawingId, setEditingStateDrawingId] = useState<string | null>(null);
  const [renamingStateId, setRenamingStateId] = useState<string | null>(null);
  const [tempStateName, setTempStateName] = useState('');

  const selectedEntity: Entity | null = selectedEntityId
    ? entities[selectedEntityId] ||
      customArchetypes[selectedEntityId] ||
      Object.values(entities).find((e) => e.type === selectedEntityId) ||
      Object.values(customArchetypes).find((a) => a.type === selectedEntityId) ||
      null
    : null;

  if (!selectedEntity) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <Layers className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Aucun objet sélectionné</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Cliquez sur un objet dans le catalogue ou sur la scène pour modifier ses états, ses dessins et ses interactions.
        </p>
      </div>
    );
  }

  const handleQuickAddState = () => {
    const newId = addStateToEntity(selectedEntity.id, '');
    if (newId) {
      updateEntityState(selectedEntity.id, newId);
      setEditingStateDrawingId(newId);
    }
  };

  const handleAddState = (e: React.FormEvent) => {
    e.preventDefault();
    const nameToUse = newStateName.trim();
    const newId = addStateToEntity(selectedEntity.id, nameToUse);
    if (newId) {
      updateEntityState(selectedEntity.id, newId);
      setEditingStateDrawingId(newId);
    }
    setNewStateName('');
    setShowAddStateInput(false);
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    addTagToEntity(selectedEntity.id, newTagInput.trim());
    setNewTagInput('');
  };

  // Prepare onion states for the full screen drawing modal
  const onionStates: OnionStateOption[] = editingStateDrawingId
    ? Object.values(selectedEntity.states)
        .filter((s) => s.id !== editingStateDrawingId)
        .map((s) => ({
          id: s.id,
          name: s.name,
          vectorPaths: s.vectorPaths || (s.id === selectedEntity.currentStateId ? selectedEntity.vectorPaths : []),
        }))
    : [];

  const editingState = editingStateDrawingId ? selectedEntity.states[editingStateDrawingId] : null;

  return (
    <div className="bg-white rounded-3xl border border-slate-200 p-4 shadow-2xs space-y-5 text-slate-800">
      {/* Modal d'édition de dessin par état en plein écran */}
      {editingStateDrawingId && (
        <FullScreenDrawingModal
          title={`Dessiner l'état "${editingState?.name || editingStateDrawingId}"`}
          subtitle={`Objet : ${selectedEntity.name}`}
          currentEditingStateName={editingState?.name || editingStateDrawingId}
          onionStates={onionStates}
          initialColliderType={editingState?.colliderType || selectedEntity.colliderType || 'box'}
          initialPaths={JSON.parse(
            JSON.stringify(
              selectedEntity.states[editingStateDrawingId]?.vectorPaths ||
                (selectedEntity.currentStateId === editingStateDrawingId ? selectedEntity.vectorPaths : []) ||
                []
            )
          )}
          initialLayers={
            selectedEntity.states[editingStateDrawingId]?.drawingLayers ||
            (selectedEntity.currentStateId === editingStateDrawingId ? selectedEntity.drawingLayers : undefined)
          }
          onSave={(paths, _dataUrl, colliderType, stateName, _hotspot, layers) => {
            updateStateProperties(selectedEntity.id, editingStateDrawingId, {
              vectorPaths: paths,
              drawingLayers: layers,
              colliderType: colliderType || 'box',
              ...(stateName ? { name: stateName } : {}),
            });
            if (selectedEntity.currentStateId === editingStateDrawingId) {
              updateEntityDetails(selectedEntity.id, {
                vectorPaths: paths,
                drawingLayers: layers,
                colliderType: colliderType || 'box',
              });
            }
            setEditingStateDrawingId(null);
          }}
          onClose={() => setEditingStateDrawingId(null)}
        />
      )}

      {/* Header with Prominent Entity Name Editing */}
      <div className="border-b border-slate-100 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              Paramètres de l'objet
            </span>
            {!entities[selectedEntity.id] && (
              <span
                className="text-[9px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-md"
                title="Aucune instance sur la scène : les réglages et comportements s'appliqueront automatiquement à chaque apparition (Spawn ou glisser-déposer)."
              >
                Modèle (hors scène)
              </span>
            )}
          </div>
          {Boolean(entities[selectedEntity.id]) && (
            <button
              onClick={() => deleteEntity(selectedEntity.id)}
              className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
              title="Supprimer cet objet de la scène"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        <div
          className="flex items-center gap-2 bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl p-2 transition-all"
        >
          <div className="w-9 h-9 rounded-xl bg-white border border-slate-200/80 flex items-center justify-center text-lg shrink-0 shadow-2xs">
            {selectedEntity.type === 'plant' ? '🌱' : selectedEntity.type === 'apple' ? '🍎' : '🎨'}
          </div>
          <div className="flex-1 min-w-0">
            <label className="text-[9px] font-bold text-slate-400 uppercase block tracking-wider">
              Nom de l'objet
            </label>
            <input
              type="text"
              value={selectedEntity.name}
              onChange={(e) => updateEntityDetails(selectedEntity.id, { name: e.target.value })}
              className="font-bold text-slate-800 bg-transparent text-sm w-full outline-none"
              placeholder="Nommer cet objet..."
            />
          </div>
        </div>
      </div>

      {/* Tags */}
      {showTagsSystem && (
        <div className="space-y-2">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-purple-600" /> Tags / Catégorisation
          </label>
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
            {(selectedEntity.tags || []).map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 text-[11px] font-bold px-2.5 py-1 rounded-lg border border-purple-200"
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTagFromEntity(selectedEntity.id, tag)}
                  className="hover:text-rose-600 cursor-pointer"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
            <form onSubmit={handleAddTag} className="inline-flex items-center">
              <input
                type="text"
                placeholder="+ tag..."
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                className="text-[11px] font-semibold w-16 bg-white text-slate-800 border border-slate-300 rounded px-2 py-0.5 focus:outline-none focus:w-24 transition-all"
              />
            </form>
          </div>
        </div>
      )}

      {/* Parenting & Attachement (uniquement pour les instances sur la scène) */}
      {Boolean(entities[selectedEntity.id]) && (() => {
        const excludedIds = new Set<string>([selectedEntity.id]);
        const stack = [selectedEntity.id];
        while (stack.length > 0) {
          const cur = stack.pop()!;
          Object.values(entities).forEach((candidate) => {
            if (candidate.parentId === cur && !excludedIds.has(candidate.id)) {
              excludedIds.add(candidate.id);
              stack.push(candidate.id);
            }
          });
        }
        const parentCandidates = Object.values(entities).filter((e) => !excludedIds.has(e.id));
        const activeParent = selectedEntity.parentId ? entities[selectedEntity.parentId] : undefined;
        const offset = selectedEntity.parentOffset || {
          x: 0,
          y: 0,
          rotationOffset: 0,
          inheritRotation: true,
          inheritFlip: true,
        };

        return (
          <div className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Link2 className="w-3.5 h-3.5 text-indigo-600" /> Parenting & Attachement
              </label>
              {activeParent && (
                <button
                  type="button"
                  onClick={() => detachEntity(selectedEntity.id)}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                >
                  <Unlink className="w-3 h-3" /> Détacher
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              {/* Ligne 1 : Objet Parent */}
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Objet parent</span>
                <select
                  value={selectedEntity.parentId || ''}
                  onChange={(e) => setEntityParent(selectedEntity.id, e.target.value || null)}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[170px]"
                >
                  <option value="">Aucun (Indépendant)</option>
                  {parentCandidates.map((cand) => (
                    <option key={cand.id} value={cand.id}>
                      {cand.name}
                    </option>
                  ))}
                </select>
              </div>

              {activeParent && (
                <>
                  {/* Ligne 2 : Décalage X */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Décalage relatif X</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={Math.round(offset.x)}
                        onChange={(e) =>
                          updateEntityParentOffset(selectedEntity.id, {
                            x: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
                      />
                      <span className="text-slate-400 text-xs">px</span>
                    </div>
                  </div>

                  {/* Ligne 3 : Décalage Y */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Décalage relatif Y</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={Math.round(offset.y)}
                        onChange={(e) =>
                          updateEntityParentOffset(selectedEntity.id, {
                            y: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
                      />
                      <span className="text-slate-400 text-xs">px</span>
                    </div>
                  </div>

                  {/* Ligne 4 : Angle relatif */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Angle relatif</span>
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        value={Math.round(offset.rotationOffset ?? 0)}
                        onChange={(e) =>
                          updateEntityParentOffset(selectedEntity.id, {
                            rotationOffset: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
                      />
                      <span className="text-slate-400 text-xs">°</span>
                    </div>
                  </div>

                  {/* Ligne 5 : Hériter de la rotation */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-700 text-xs">Suivre la rotation du parent</div>
                      <div className="text-[10px] text-slate-400">Orbite et pivote avec « {activeParent.name} »</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={offset.inheritRotation !== false}
                      onChange={(e) =>
                        updateEntityParentOffset(selectedEntity.id, {
                          inheritRotation: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>

                  {/* Ligne 6 : Hériter du Flip horizontal */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-700 text-xs">Suivre le Flip horizontal</div>
                      <div className="text-[10px] text-slate-400">Inverse le côté et le dessin quand le parent se retourne</div>
                    </div>
                    <input
                      type="checkbox"
                      checked={offset.inheritFlip !== false}
                      onChange={(e) =>
                        updateEntityParentOffset(selectedEntity.id, {
                          inheritFlip: e.target.checked,
                        })
                      }
                      className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                    />
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

      {/* Moteur Physique Arcade 2D & Composants modulaires */}
      <BehaviorManager entity={selectedEntity} selectedStateId={selectedEntity.currentStateId} />

      {/* Liste des États (A, B, C...) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" /> États ({Object.keys(selectedEntity.states).length})
          </label>
          
          <div className="flex items-center gap-1">
            <button
              onClick={handleQuickAddState}
              className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer shadow-2xs transition-all active:scale-95"
              title="Ajouter un nouvel état (canvas vide)"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvel état
            </button>
          </div>
        </div>

        {/* Formulaire personnalisé de renommage / ajout si souhaité */}
        {showAddStateInput && (
          <form onSubmit={handleAddState} className="flex gap-2 bg-slate-50 p-2 rounded-2xl border border-slate-200">
            <input
              type="text"
              placeholder="Nom de l'état (ex: C)..."
              value={newStateName}
              onChange={(e) => setNewStateName(e.target.value)}
              className="flex-1 text-xs font-bold border border-slate-300 bg-white text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              autoFocus
            />
            <button
              type="submit"
              className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold hover:bg-indigo-700 cursor-pointer"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setShowAddStateInput(false)}
              className="text-xs text-slate-500 px-2 py-1.5 hover:bg-slate-200 rounded-xl cursor-pointer"
            >
              X
            </button>
          </form>
        )}

        {/* Cartes d'États A, B, C */}
        <div className="grid grid-cols-2 gap-2.5">
          {Object.values(selectedEntity.states).map((st) => {
            const isActive = selectedEntity.currentStateId === st.id;
            const statePaths = st.vectorPaths || (st.id === selectedEntity.currentStateId ? selectedEntity.vectorPaths : []) || [];
            const canDelete = Object.keys(selectedEntity.states).length > 1;

            const handleStateDragStart = (e: React.DragEvent) => {
              const dragData = {
                kind: 'entity-state',
                entityId: selectedEntity.id,
                entityType: selectedEntity.type,
                stateId: st.id,
                stateName: st.name,
              };
              e.dataTransfer.setData('application/json', JSON.stringify(dragData));
              e.dataTransfer.setData('text/plain', `${selectedEntity.type}:${st.id}`);
              e.dataTransfer.effectAllowed = 'copy';
            };

            return (
              <div
                key={st.id}
                draggable
                onDragStart={handleStateDragStart}
                onClick={() => updateEntityState(selectedEntity.id, st.id)}
                className={`p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing flex flex-col items-center justify-between gap-2 relative group ${
                  isActive
                    ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                    : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
                }`}
                title="Cliquer pour activer cet état • Glissez sur une case de règle"
              >
                {/* Boutons Dupliquer & Supprimer état */}
                <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      const newId = duplicateStateInEntity(selectedEntity.id, st.id);
                      if (newId) updateEntityState(selectedEntity.id, newId);
                    }}
                    className="text-slate-400 hover:text-indigo-600 p-1 rounded-md hover:bg-indigo-50 cursor-pointer"
                    title="Dupliquer cet état (avec son dessin et ses overrides)"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  {canDelete && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeStateFromEntity(selectedEntity.id, st.id);
                      }}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 cursor-pointer"
                      title="Supprimer cet état"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Nom de l'état (avec possibilité de renommage) */}
                {renamingStateId === st.id ? (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 w-full"
                  >
                    <input
                      type="text"
                      value={tempStateName}
                      onChange={(e) => setTempStateName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (tempStateName.trim()) {
                            updateStateProperties(selectedEntity.id, st.id, { name: tempStateName.trim() });
                          }
                          setRenamingStateId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingStateId(null);
                        }
                      }}
                      autoFocus
                      onFocus={(e) => e.target.select()}
                      className="text-xs font-bold bg-white text-slate-800 border border-indigo-300 rounded-lg px-1.5 py-0.5 w-full outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (tempStateName.trim()) {
                          updateStateProperties(selectedEntity.id, st.id, { name: tempStateName.trim() });
                        }
                        setRenamingStateId(null);
                      }}
                      className="p-1 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 cursor-pointer shrink-0"
                      title="Valider le nom"
                    >
                      <Check className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingStateId(null)}
                      className="p-1 text-slate-400 hover:bg-slate-200 rounded-md cursor-pointer shrink-0"
                      title="Annuler"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      setRenamingStateId(st.id);
                      setTempStateName(st.name);
                    }}
                    className="flex items-center gap-1 max-w-full cursor-text hover:text-indigo-600 group/name select-text"
                    title="Double-cliquez pour renommer cet état"
                  >
                    <span
                      className={`text-xs font-black tracking-tight truncate ${
                        isActive ? 'text-indigo-900' : 'text-slate-700'
                      } group-hover/name:text-indigo-600 underline decoration-dotted decoration-slate-300 underline-offset-2`}
                    >
                      État {st.name}
                    </span>
                    {isActive && (
                      <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse shrink-0 ml-0.5" title="État actif sur la scène" />
                    )}
                  </div>
                )}

                {/* Visual Thumbnail */}
                <div
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setEditingStateDrawingId(st.id);
                  }}
                  className="w-14 h-14 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-1.5 relative overflow-hidden shadow-2xs hover:border-indigo-400 cursor-pointer"
                  title="Double-cliquez sur le dessin pour modifier"
                >
                  {statePaths.length > 0 ? (
                    <svg viewBox="0 0 200 200" className="w-full h-full pointer-events-none">
                      {(() => {
                        const stLayers = st.drawingLayers || (st.id === selectedEntity.currentStateId ? selectedEntity.drawingLayers : undefined);
                        if (!stLayers || stLayers.length === 0) {
                          return statePaths.map((p) => (
                            <path
                              key={p.id}
                              d={p.d}
                              stroke={p.stroke}
                              strokeWidth={p.strokeWidth}
                              fill={p.fill || 'none'}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          ));
                        }
                        const fallbackLayerId = stLayers[stLayers.length - 1]?.id || 'layer-1';
                        const layerIds = new Set(stLayers.map((l) => l.id));
                        return [...stLayers].reverse().map((layer) => {
                          if (!layer.visible) return null;
                          const layerPaths = statePaths.filter((p) => {
                            const resolvedId = p.layerId && layerIds.has(p.layerId) ? p.layerId : fallbackLayerId;
                            return resolvedId === layer.id;
                          });
                          return (
                            <g key={layer.id} opacity={layer.opacity ?? 1}>
                              {layerPaths.map((p) => (
                                <path
                                  key={p.id}
                                  d={p.d}
                                  stroke={p.stroke}
                                  strokeWidth={p.strokeWidth}
                                  fill={p.fill || 'none'}
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                />
                              ))}
                            </g>
                          );
                        });
                      })()}
                    </svg>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-medium italic">
                      Vide
                    </span>
                  )}
                </div>

                {/* Bouton Dessiner cet état */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingStateDrawingId(st.id);
                  }}
                  className="w-full py-1 px-2 text-[11px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100/70 border border-indigo-200 rounded-xl flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  title="Modifier le dessin de cet état"
                >
                  <Paintbrush className="w-3 h-3 text-indigo-600" /> Dessiner
                </button>
              </div>
            );
          })}
        </div>

        {/* Option Collider unifié entre les états (évite les boucles Enter/Exit si les dessins ont des tailles différentes) */}
        {Object.keys(selectedEntity.states).length > 1 && (
          <div className="p-2.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-slate-700 text-xs">
                  Collider commun entre les états
                </div>
                <div className="text-[10px] text-slate-400 leading-snug">
                  Conserve la même hitbox même quand l'état change de dessin (évite les boucles Enter/Exit).
                </div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(selectedEntity.sharedCollider)}
                onChange={(e) =>
                  updateEntityDetails(selectedEntity.id, {
                    sharedCollider: e.target.checked,
                    colliderReferenceStateId:
                      selectedEntity.colliderReferenceStateId ||
                      Object.keys(selectedEntity.states)[0] ||
                      selectedEntity.currentStateId,
                  })
                }
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
            </div>

            {selectedEntity.sharedCollider && (
              <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-200/70">
                <span className="text-[11px] font-semibold text-slate-600">
                  État de référence :
                </span>
                <select
                  value={
                    selectedEntity.colliderReferenceStateId ||
                    Object.keys(selectedEntity.states)[0] ||
                    selectedEntity.currentStateId
                  }
                  onChange={(e) =>
                    updateEntityDetails(selectedEntity.id, {
                      colliderReferenceStateId: e.target.value,
                    })
                  }
                  className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 max-w-[140px]"
                >
                  {Object.values(selectedEntity.states).map((st) => (
                    <option key={st.id} value={st.id}>
                      État {st.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
