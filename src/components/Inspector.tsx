import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  Sparkles,
  Plus,
  Trash2,
  Tag,
  X,
  Paintbrush,
  Hand,
  Layers,
  Copy,
} from 'lucide-react';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { OnionStateOption } from './DrawingCanvas';

export function Inspector() {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const entities = useSceneStore((state) => state.entities);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);
  const updateEntityState = useSceneStore((state) => state.updateEntityState);
  const updateStateProperties = useSceneStore((state) => state.updateStateProperties);
  const addStateToEntity = useSceneStore((state) => state.addStateToEntity);
  const removeStateFromEntity = useSceneStore((state) => state.removeStateFromEntity);
  const deleteEntity = useSceneStore((state) => state.deleteEntity);
  const addTagToEntity = useSceneStore((state) => state.addTagToEntity);
  const removeTagFromEntity = useSceneStore((state) => state.removeTagFromEntity);
  const showTagsSystem = useSceneStore((state) => state.settings.showTagsSystem);

  const [newTagInput, setNewTagInput] = useState('');
  const [showAddStateInput, setShowAddStateInput] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [editingStateDrawingId, setEditingStateDrawingId] = useState<string | null>(null);

  const selectedEntity = selectedEntityId ? entities[selectedEntityId] : null;

  if (!selectedEntity) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-2xs text-center flex flex-col items-center justify-center min-h-[300px]">
        <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-slate-400 mb-3 border border-slate-200">
          <Layers className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 tracking-tight">Aucun objet sélectionné</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-[220px]">
          Cliquez sur un élément de la scène pour modifier ses états, ses dessins et ses interactions.
        </p>
      </div>
    );
  }

  const handleQuickAddState = () => {
    addStateToEntity(selectedEntity.id, '');
  };

  const handleAddState = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStateName.trim()) {
      handleQuickAddState();
    } else {
      addStateToEntity(selectedEntity.id, newStateName.trim());
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
          initialPaths={JSON.parse(
            JSON.stringify(
              selectedEntity.states[editingStateDrawingId]?.vectorPaths ||
                (selectedEntity.currentStateId === editingStateDrawingId ? selectedEntity.vectorPaths : []) ||
                []
            )
          )}
          onSave={(paths) => {
            updateStateProperties(selectedEntity.id, editingStateDrawingId, {
              vectorPaths: paths,
            });
            if (selectedEntity.currentStateId === editingStateDrawingId) {
              updateEntityDetails(selectedEntity.id, { vectorPaths: paths });
            }
            setEditingStateDrawingId(null);
          }}
          onClose={() => setEditingStateDrawingId(null)}
        />
      )}

      {/* Header with Prominent Entity Name Editing */}
      <div className="border-b border-slate-100 pb-3 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            Paramètres de l'objet
          </span>
          <button
            onClick={() => deleteEntity(selectedEntity.id)}
            className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
            title="Supprimer cet objet de la scène"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl p-2 transition-all">
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

      {/* Interaction */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
          <Hand className="w-3.5 h-3.5 text-indigo-600" /> Comportement
        </label>
        
        <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-2xl border border-slate-200">
          <span className="text-xs font-bold text-slate-700">Déplaçable à la souris</span>
          <input
            type="checkbox"
            checked={selectedEntity.isDraggable}
            onChange={(e) => updateEntityDetails(selectedEntity.id, { isDraggable: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      </div>

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
                title="Glissez cet état directement sur une case de règle Storyboard"
              >
                {/* Bouton supprimer état (si plus d'un état) */}
                {canDelete && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeStateFromEntity(selectedEntity.id, st.id);
                    }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-opacity cursor-pointer"
                    title="Supprimer cet état"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}

                {/* Nom de l'état */}
                <div className="flex items-center gap-1.5">
                  <span className={`text-sm font-black tracking-tight ${isActive ? 'text-indigo-900' : 'text-slate-700'}`}>
                    État {st.name}
                  </span>
                  {isActive && (
                    <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" title="État actif sur la scène" />
                  )}
                </div>

                {/* Visual Thumbnail */}
                <div className="w-14 h-14 bg-white rounded-xl border border-slate-200 flex items-center justify-center p-1.5 relative overflow-hidden shadow-2xs">
                  {statePaths.length > 0 ? (
                    <svg viewBox="0 0 200 200" className="w-full h-full pointer-events-none">
                      {statePaths.map((p) => (
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
      </div>
    </div>
  );
}
