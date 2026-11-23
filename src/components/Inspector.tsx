import React, { useState, useMemo } from 'react';
import { useSceneStore, EMPTY_RECORD } from '../store/useSceneStore';
import { Entity, EntityPivot, EntityState, ParentOffset } from '../types';
import {
  Sparkles,
  Plus,
  Trash2,
  Tag,
  X,
  Paintbrush,
  Layers,
  Check,
  Link2,
  Unlink,
  Copy,
  FolderPlus,
  Folder,
  FolderOpen,
  ChevronDown,
  ChevronRight,
  Crosshair,
  RotateCcw,
  Eye,
  EyeOff,
  Power,
  Undo2,
} from 'lucide-react';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { OnionStateOption } from './DrawingCanvas';
import { BehaviorManager } from './BehaviorManager';
import { DEFAULT_PIVOT, resolveRawPivot, sanitizePivot } from '../utils/physics/pivotHelpers';
import { EditableNumericValue } from './shared/EditableNumericValue';
import { ParentOffsetFieldsEditor } from './shared/ParentOffsetFieldsEditor';

const INSPECTOR_PIVOT_PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Haut-Gauche', x: 0, y: 0 },
  { label: 'Haut', x: 0.5, y: 0 },
  { label: 'Haut-Droit', x: 1, y: 0 },
  { label: 'Gauche', x: 0, y: 0.5 },
  { label: 'Centre', x: 0.5, y: 0.5 },
  { label: 'Droite', x: 1, y: 0.5 },
  { label: 'Bas-Gauche', x: 0, y: 1 },
  { label: 'Bas', x: 0.5, y: 1 },
  { label: 'Bas-Droit', x: 1, y: 1 },
];

export function Inspector() {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const entities = useSceneStore((state) => state.entities);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);
  const setEntityDisabledCascade = useSceneStore((state) => state.setEntityDisabledCascade);
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
  const jointCanvasPick = useSceneStore((state) => state.jointCanvasPick);
  const startJointCanvasPick = useSceneStore((state) => state.startJointCanvasPick);
  const cancelJointCanvasPick = useSceneStore((state) => state.cancelJointCanvasPick);
  const addStateFolder = useSceneStore((state) => state.addStateFolder);
  const updateStateFolder = useSceneStore((state) => state.updateStateFolder);
  const deleteStateFolder = useSceneStore((state) => state.deleteStateFolder);
  const setStateFolder = useSceneStore((state) => state.setStateFolder);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const showTagsSystem = useSceneStore((state) => state.settings.showTagsSystem);

  const [newTagInput, setNewTagInput] = useState('');
  const [showAddStateInput, setShowAddStateInput] = useState(false);
  const [newStateName, setNewStateName] = useState('');
  const [editingStateDrawingId, setEditingStateDrawingId] = useState<string | null>(null);
  const [renamingStateId, setRenamingStateId] = useState<string | null>(null);
  const [tempStateName, setTempStateName] = useState('');
  const [showAddFolderInput, setShowAddFolderInput] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [tempFolderName, setTempFolderName] = useState('');
  const [draggingStateId, setDraggingStateId] = useState<string | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | 'root' | null>(null);
  const [isParentingCollapsed, setIsParentingCollapsed] = useState(false);
  const [isPivotCollapsed, setIsPivotCollapsed] = useState(true);

  const selectedEntity: Entity | null = selectedEntityId
    ? entities[selectedEntityId] ||
      customArchetypes[selectedEntityId] ||
      Object.values(entities).find((e) => e.type === selectedEntityId) ||
      Object.values(customArchetypes).find((a) => a.type === selectedEntityId) ||
      null
    : null;

  // Prepare onion states for the full screen drawing modal (must stay above early return)
  const onionStates: OnionStateOption[] = useMemo(() => {
    if (!editingStateDrawingId || !selectedEntity) return [];
    return Object.values(selectedEntity.states)
      .filter((s) => s.id !== editingStateDrawingId)
      .map((s) => ({
        id: s.id,
        name: s.name,
        vectorPaths: s.vectorPaths || (s.id === selectedEntity.currentStateId ? selectedEntity.vectorPaths : []),
      }));
  }, [editingStateDrawingId, selectedEntity]);

  if (!selectedEntity) {
    return (
      <div className="p-6 text-center flex flex-col items-center justify-center min-h-[300px]">
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

  const editingState = editingStateDrawingId ? selectedEntity.states[editingStateDrawingId] : null;

  return (
    <div className="space-y-5 text-slate-800">
      {/* Modal d'édition de dessin par état en plein écran */}
      {editingStateDrawingId && (() => {
        const refStateId =
          selectedEntity.colliderReferenceStateId ||
          Object.keys(selectedEntity.states)[0] ||
          selectedEntity.currentStateId;
        const isRefState = editingStateDrawingId === refStateId;
        return (
          <FullScreenDrawingModal
            title={`Dessiner l'état "${editingState?.name || editingStateDrawingId}"`}
            subtitle={`Objet : ${selectedEntity.name}`}
            currentEditingStateName={editingState?.name || editingStateDrawingId}
            onionStates={onionStates}
            initialColliderType={editingState?.colliderType || selectedEntity.colliderType || 'box'}
            initialColliderBounds={
              editingState?.colliderBounds ||
              (selectedEntity.currentStateId === editingStateDrawingId ? selectedEntity.colliderBounds : undefined)
            }
            isSharedColliderEntity={Boolean(selectedEntity.sharedCollider)}
            isReferenceStateForSharedCollider={isRefState}
            initialOverrideCollider={Boolean(editingState?.overrideCollider)}
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
            initialFrames={selectedEntity.states[editingStateDrawingId]?.frames}
            initialFrameRate={selectedEntity.states[editingStateDrawingId]?.frameRate}
            initialAnimationLoop={selectedEntity.states[editingStateDrawingId]?.animationLoop}
            initialPivot={editingState?.pivot || selectedEntity.pivot || DEFAULT_PIVOT}
            enablePivotEditing={true}
            isStatePivotContext={true}
            initialHasStatePivotOverride={Boolean(editingState?.pivot)}
            baseEntityPivot={selectedEntity.pivot || DEFAULT_PIVOT}
            onSave={(
              paths,
              _dataUrl,
              colliderType,
              stateName,
              _hotspot,
              layers,
              colliderBounds,
              overrideCollider,
              animationData,
              pivotData
            ) => {
              const sanitizedPivot = pivotData ? sanitizePivot(pivotData.pivot) : undefined;
              updateStateProperties(selectedEntity.id, editingStateDrawingId, {
                vectorPaths: paths,
                drawingLayers: layers,
                colliderType: colliderType || 'box',
                ...(colliderBounds !== undefined ? { colliderBounds } : {}),
                overrideCollider,
                ...(pivotData
                  ? { pivot: pivotData.isStateOverride ? sanitizedPivot : undefined }
                  : {}),
                ...(stateName ? { name: stateName } : {}),
                ...(animationData
                  ? {
                      frames: animationData.frames,
                      frameRate: animationData.frameRate,
                      animationLoop: animationData.animationLoop,
                    }
                  : {}),
              });
              if (pivotData && !pivotData.isStateOverride && sanitizedPivot) {
                updateEntityDetails(selectedEntity.id, { pivot: sanitizedPivot });
              }
              if (selectedEntity.currentStateId === editingStateDrawingId) {
                updateEntityDetails(selectedEntity.id, {
                  vectorPaths: paths,
                  drawingLayers: layers,
                  colliderType: colliderType || 'box',
                  ...(colliderBounds !== undefined ? { colliderBounds } : {}),
                });
              }
              setEditingStateDrawingId(null);
            }}
            onClose={() => setEditingStateDrawingId(null)}
          />
        );
      })()}

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
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() =>
                  setEntityDisabledCascade(
                    selectedEntity.id,
                    !selectedEntity.disabled,
                    'with_children'
                  )
                }
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  selectedEntity.disabled
                    ? 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={
                  selectedEntity.disabled
                    ? 'Activer cet objet et ses enfants (participe à nouveau au jeu)'
                    : 'Désactiver cet objet et ses enfants (inactif et invisible en mode Play)'
                }
              >
                <Power className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateEntityDetails(selectedEntity.id, {
                    visible: selectedEntity.visible === false,
                  })
                }
                className={`p-1.5 rounded-xl transition-colors cursor-pointer ${
                  selectedEntity.visible === false
                    ? 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title={
                  selectedEntity.visible === false
                    ? 'Afficher cet objet sur la scène'
                    : 'Masquer visuellement cet objet (reste actif en jeu)'
                }
              >
                {selectedEntity.visible === false ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              <button
                onClick={() => deleteEntity(selectedEntity.id)}
                className="text-slate-400 hover:text-rose-600 p-1.5 rounded-xl hover:bg-rose-50 transition-colors cursor-pointer"
                title="Supprimer cet objet de la scène"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <div
          className="flex items-center gap-2 bg-slate-50 hover:bg-white focus-within:bg-white border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-100 rounded-2xl px-3 py-2 transition-all"
        >
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

        {selectedEntity.disabled && (
          <div className="flex items-center justify-between gap-2 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl px-2.5 py-1.5 text-[11px] font-semibold">
            <span>Objet désactivé (ignoré en mode Play)</span>
            <button
              type="button"
              onClick={() =>
                setEntityDisabledCascade(selectedEntity.id, false, 'with_children')
              }
              className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-white hover:bg-rose-100 border border-rose-200 text-rose-700 cursor-pointer shrink-0"
            >
              Réactiver (+ enfants)
            </button>
          </div>
        )}
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

      {/* Pivot de rotation & d'attachement */}
      {(() => {
        const curState = selectedEntity.states[selectedEntity.currentStateId];
        const hasStateOverride = Boolean(curState?.pivot);
        const activePivot = resolveRawPivot(selectedEntity, curState);
        const applyPivot = (next: EntityPivot) => {
          const clean = sanitizePivot(next);
          if (hasStateOverride) {
            updateStateProperties(selectedEntity.id, selectedEntity.currentStateId, { pivot: clean });
          } else {
            updateEntityDetails(selectedEntity.id, { pivot: clean });
          }
        };

        return (
          <div className="space-y-2 bg-slate-50/70 p-3 rounded-2xl border border-slate-200">
            <div
              onClick={() => setIsPivotCollapsed((v) => !v)}
              className="flex items-center justify-between gap-2 cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 hover:text-slate-600 shrink-0">
                  {isPivotCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 truncate">
                  <Crosshair className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
                  <span>Point de Pivot</span>
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {hasStateOverride && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-fuchsia-100 text-fuchsia-700 border border-fuchsia-200">
                    État
                  </span>
                )}
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                  {Math.round(activePivot.x * 100)}%, {Math.round(activePivot.y * 100)}%
                </span>
              </div>
            </div>

            {!isPivotCollapsed && (
              <div className="space-y-2 pt-1">
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center gap-3">
                  <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
                    {INSPECTOR_PIVOT_PRESETS.map((preset) => {
                      const isSelected =
                        Math.abs(activePivot.x - preset.x) < 0.01 &&
                        Math.abs(activePivot.y - preset.y) < 0.01;
                      return (
                        <button
                          key={preset.label}
                          type="button"
                          title={preset.label}
                          onClick={() => applyPivot({ x: preset.x, y: preset.y })}
                          className={`w-4 h-4 rounded-sm flex items-center justify-center cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-fuchsia-600 text-white shadow-2xs scale-105'
                              : 'bg-white hover:bg-fuchsia-100 text-slate-400'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex-1 grid grid-cols-2 gap-1.5 items-center">
                    <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
                      <span className="font-bold text-slate-500">X</span>
                      <EditableNumericValue
                        value={Math.round(activePivot.x * 1000) / 10}
                        unit="%"
                        precision={1}
                        onChange={(v) =>
                          applyPivot({
                            ...activePivot,
                            x: v / 100,
                          })
                        }
                        className="font-mono font-bold text-slate-800 hover:text-fuchsia-700 hover:bg-fuchsia-50 px-1 rounded cursor-text tabular-nums"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
                      <span className="font-bold text-slate-500">Y</span>
                      <EditableNumericValue
                        value={Math.round(activePivot.y * 1000) / 10}
                        unit="%"
                        precision={1}
                        onChange={(v) =>
                          applyPivot({
                            ...activePivot,
                            y: v / 100,
                          })
                        }
                        className="font-mono font-bold text-slate-800 hover:text-fuchsia-700 hover:bg-fuchsia-50 px-1 rounded cursor-text tabular-nums"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => applyPivot({ ...DEFAULT_PIVOT })}
                      className="text-[10px] font-semibold text-slate-500 hover:text-fuchsia-700 flex items-center gap-1 py-0.5 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" /> Centre
                    </button>

                    <button
                      type="button"
                      onClick={() => setEditingStateDrawingId(selectedEntity.currentStateId)}
                      className="text-[10px] font-bold text-fuchsia-700 hover:text-fuchsia-800 bg-fuchsia-50 hover:bg-fuchsia-100 border border-fuchsia-200 rounded-md px-1.5 py-0.5 flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Paintbrush className="w-3 h-3" /> Atelier
                    </button>
                  </div>
                </div>

                {Object.keys(selectedEntity.states).length > 1 && (
                  <label className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 cursor-pointer">
                    <div>
                      <div className="font-bold text-slate-700 text-xs">
                        Pivot spécifique à l'état « {curState?.name || selectedEntity.currentStateId} »
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Sinon l'état hérite du pivot principal de l'objet
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={hasStateOverride}
                      onChange={(e) => {
                        if (e.target.checked) {
                          updateStateProperties(selectedEntity.id, selectedEntity.currentStateId, {
                            pivot: sanitizePivot(selectedEntity.pivot || DEFAULT_PIVOT),
                          });
                        } else {
                          updateStateProperties(selectedEntity.id, selectedEntity.currentStateId, {
                            pivot: undefined,
                          });
                        }
                      }}
                      className="w-4 h-4 accent-fuchsia-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                )}
              </div>
            )}
          </div>
        );
      })()}

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

        const curState = selectedEntity.states[selectedEntity.currentStateId];
        const stateCount = Object.keys(selectedEntity.states).length;
        const hasParentOverride = Boolean(activeParent && curState?.parentOffsetOverride);
        const effectiveOffset: ParentOffset = hasParentOverride
          ? {
              ...offset,
              ...(curState?.parentOffsetOverride || {}),
            }
          : offset;

        const updateEffectiveParentOffset = (patch: Partial<ParentOffset>) => {
          if (hasParentOverride && curState) {
            updateStateProperties(selectedEntity.id, curState.id, {
              parentOffsetOverride: {
                ...(curState.parentOffsetOverride || {}),
                ...patch,
              },
            });
          } else {
            updateEntityParentOffset(selectedEntity.id, patch);
          }
        };

        const handleToggleParentOverride = () => {
          if (!curState) return;
          if (hasParentOverride) {
            updateStateProperties(selectedEntity.id, curState.id, {
              parentOffsetOverride: undefined,
            });
          } else {
            updateStateProperties(selectedEntity.id, curState.id, {
              parentOffsetOverride: { ...JSON.parse(JSON.stringify(offset)) },
            });
          }
        };

        return (
          <div
            className={`space-y-2 p-3 rounded-2xl border transition-all ${
              hasParentOverride
                ? 'bg-amber-50/30 border-amber-300 ring-2 ring-amber-100/80'
                : 'bg-slate-50/70 border-slate-200'
            }`}
          >
            <div
              onClick={() => setIsParentingCollapsed((v) => !v)}
              className="flex items-center justify-between gap-2 cursor-pointer select-none"
            >
              <div className="flex items-center gap-1.5 min-w-0">
                <span className="text-slate-400 hover:text-slate-600 shrink-0">
                  {isParentingCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </span>
                <div className="min-w-0">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5 truncate">
                    <Link2 className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                    <span>Parenting & Attachement</span>
                  </span>
                  {activeParent && (
                    <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate pl-5">
                      {hasParentOverride ? (
                        <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                          <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Override {curState?.name}
                        </span>
                      ) : (
                        <span className="text-slate-400">Partagé</span>
                      )}
                    </div>
                  )}
                </div>
                {isParentingCollapsed && (
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 truncate max-w-[125px]">
                    {activeParent ? `→ ${activeParent.name}` : 'Indépendant'}
                  </span>
                )}
              </div>
              {activeParent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    detachEntity(selectedEntity.id);
                  }}
                  className="text-[10px] font-bold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 px-2 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shrink-0"
                >
                  <Unlink className="w-3 h-3" /> Détacher
                </button>
              )}
            </div>

            {!isParentingCollapsed && (
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
                  {/* Bannière d'Override identique aux Composants & Physique */}
                  {curState && (
                    <div
                      className={`p-2 rounded-xl flex items-center justify-between text-xs border ${
                        hasParentOverride
                          ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                          : 'bg-slate-100/80 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {hasParentOverride ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">
                              <strong className="text-amber-950 font-bold">Override actif</strong> pour l'état{' '}
                              <strong className="text-amber-800 underline decoration-amber-400">
                                {curState.name}
                              </strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate text-slate-600">Valeur partagée (tous les états)</span>
                          </>
                        )}
                      </div>

                      {stateCount > 1 && (
                        <button
                          type="button"
                          onClick={handleToggleParentOverride}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-2 ${
                            hasParentOverride
                              ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-300 shadow-2xs'
                              : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-300 shadow-2xs'
                          }`}
                          title={
                            hasParentOverride
                              ? `Annuler l'override pour l'état ${curState.name} (revenir au réglage partagé)`
                              : `Créer un override spécifique pour l'état ${curState.name}`
                          }
                        >
                          {hasParentOverride ? (
                            <>
                              <Undo2 className="w-3 h-3 text-amber-800" />
                              <span>Annuler l'override</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              <span>Créer un override</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Placement interactif du point d'attache sur le canvas (7-2) */}
                  <div className="p-2 bg-sky-50/50 rounded-xl border border-sky-200 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 text-xs">Point d'attache sur scène</span>
                      {effectiveOffset.jointChildPivot && (
                        <button
                          type="button"
                          onClick={() =>
                            updateEffectiveParentOffset({
                              jointChildPivot: undefined,
                            })
                          }
                          className="text-[10px] font-bold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 px-1.5 py-0.5 rounded-lg flex items-center gap-1 cursor-pointer transition-colors whitespace-nowrap shrink-0"
                          title="Réinitialiser le pivot d'attache enfant au pivot par défaut"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Réinitialiser</span>
                        </button>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (jointCanvasPick?.childId === selectedEntity.id) {
                          cancelJointCanvasPick();
                        } else {
                          startJointCanvasPick(selectedEntity.id);
                        }
                      }}
                      className={`w-full py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer whitespace-nowrap ${
                        jointCanvasPick?.childId === selectedEntity.id
                          ? 'bg-sky-600 text-white border-sky-700 shadow-xs'
                          : 'bg-white hover:bg-sky-100/70 text-sky-800 border-sky-300'
                      }`}
                    >
                      <Crosshair className="w-3.5 h-3.5 shrink-0" />
                      <span>
                        {jointCanvasPick?.childId === selectedEntity.id
                          ? 'Cliquez sur la scène… (Annuler)'
                          : "Placer le point d'attache sur la scène"}
                      </span>
                    </button>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Vous pouvez aussi glisser le pin cyan directement sur la scène.</span>
                      {effectiveOffset.jointChildPivot && (
                        <span className="font-mono tabular-nums font-bold text-sky-700 bg-white border border-sky-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0">
                          {effectiveOffset.jointChildPivot.x.toFixed(2)}, {effectiveOffset.jointChildPivot.y.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Ligne 2 : Décalage X */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Décalage relatif X</span>
                    <EditableNumericValue
                      value={effectiveOffset.x}
                      unit="px"
                      precision={1}
                      onChange={(v) => updateEffectiveParentOffset({ x: v })}
                      className="bg-slate-50 hover:bg-indigo-50 border border-slate-300 rounded-lg px-2 py-1 font-mono tabular-nums font-bold text-xs text-slate-800 cursor-text"
                    />
                  </div>

                  {/* Ligne 3 : Décalage Y */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Décalage relatif Y</span>
                    <EditableNumericValue
                      value={effectiveOffset.y}
                      unit="px"
                      precision={1}
                      onChange={(v) => updateEffectiveParentOffset({ y: v })}
                      className="bg-slate-50 hover:bg-indigo-50 border border-slate-300 rounded-lg px-2 py-1 font-mono tabular-nums font-bold text-xs text-slate-800 cursor-text"
                    />
                  </div>

                  {/* Ligne 4 : Angle relatif */}
                  <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Angle relatif</span>
                    <EditableNumericValue
                      value={effectiveOffset.rotationOffset ?? 0}
                      unit="°"
                      precision={1}
                      onChange={(v) => updateEffectiveParentOffset({ rotationOffset: v })}
                      className="bg-slate-50 hover:bg-indigo-50 border border-slate-300 rounded-lg px-2 py-1 font-mono tabular-nums font-bold text-xs text-slate-800 cursor-text"
                    />
                  </div>

                  {/* Paramètres du mode d'attache, ressort & joint (partagés ou override actif) */}
                  <ParentOffsetFieldsEditor
                    offset={effectiveOffset}
                    parentName={activeParent.name}
                    onChange={updateEffectiveParentOffset}
                  />
                </>
              )}
            </div>
            )}
          </div>
        );
      })()}

      {/* Moteur Physique Arcade 2D & Composants modulaires (inclut Hitbox & Collider) */}
      <BehaviorManager
        entity={selectedEntity}
        selectedStateId={selectedEntity.currentStateId}
        onEditStateDrawing={(sid) => setEditingStateDrawingId(sid)}
      />

      {/* Liste des États (A, B, C...) & Dossiers */}
      {(() => {
        const allStates = Object.values(selectedEntity.states);
        const folders = selectedEntity.stateFolders || [];
        const folderIds = new Set(folders.map((f) => f.id));
        const rootStates = allStates.filter((st) => !st.folderId || !folderIds.has(st.folderId));
        const draggedStateObj = draggingStateId ? selectedEntity.states[draggingStateId] : undefined;
        const canDropToRoot = Boolean(draggedStateObj?.folderId && folderIds.has(draggedStateObj.folderId));

        const extractDroppedStateId = (e: React.DragEvent): string | null => {
          try {
            const raw = e.dataTransfer.getData('application/json');
            if (raw) {
              const parsed = JSON.parse(raw);
              if (parsed?.kind === 'entity-state' && parsed?.entityType === selectedEntity.type && parsed?.stateId) {
                return parsed.stateId;
              }
            }
          } catch {
            // fallback to local React state
          }
          return draggingStateId;
        };

        const handleCreateFolder = (e: React.FormEvent) => {
          e.preventDefault();
          const trimmed = newFolderName.trim();
          if (trimmed) {
            addStateFolder(selectedEntity.id, trimmed);
          }
          setNewFolderName('');
          setShowAddFolderInput(false);
        };

        const renderStateCard = (st: EntityState) => {
          const isActive = selectedEntity.currentStateId === st.id;
          const statePaths = st.vectorPaths || (st.id === selectedEntity.currentStateId ? selectedEntity.vectorPaths : []) || [];
          const canDelete = allStates.length > 1;

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
            e.dataTransfer.effectAllowed = 'copyMove';
            setDraggingStateId(st.id);
          };

          const handleStateDragEnd = () => {
            setDraggingStateId(null);
            setDragOverFolderId(null);
          };

          return (
            <div
              key={st.id}
              draggable
              onDragStart={handleStateDragStart}
              onDragEnd={handleStateDragEnd}
              onClick={() => updateEntityState(selectedEntity.id, st.id)}
              className={`p-3 rounded-2xl border transition-all cursor-grab active:cursor-grabbing flex flex-col items-center justify-between gap-2 relative group ${
                isActive
                  ? 'bg-indigo-50/90 border-indigo-500 shadow-xs ring-2 ring-indigo-500/20'
                  : 'bg-slate-50/80 border-slate-200 hover:bg-slate-100 hover:border-slate-300'
              }`}
              title="Cliquer pour activer • Glisser sur une case de règle ou dans un dossier"
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
                    {st.name}
                  </span>
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
                {(st.frames?.length || 0) > 1 && (
                  <span
                    className="absolute bottom-0.5 right-0.5 bg-violet-600/90 text-white text-[9px] font-mono font-bold px-1 rounded shadow-2xs pointer-events-none"
                    title={`Animation Flipbook : ${st.frames?.length} frames (${st.frameRate || 8} FPS)`}
                  >
                    🎞️{st.frames?.length}
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
        };

        return (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" /> États ({allStates.length})
              </label>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowAddFolderInput((v) => !v)}
                  className="text-xs font-bold text-slate-600 hover:text-indigo-700 flex items-center gap-1 px-2 py-1 rounded-xl bg-slate-100 hover:bg-indigo-50 border border-slate-200 cursor-pointer shadow-2xs transition-all"
                  title="Créer un dossier pour ranger vos états"
                >
                  <FolderPlus className="w-3.5 h-3.5" /> Dossier
                </button>
                <button
                  type="button"
                  onClick={handleQuickAddState}
                  className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer shadow-2xs transition-all active:scale-95"
                  title="Ajouter un nouvel état (canvas vide)"
                >
                  <Plus className="w-3.5 h-3.5" /> Nouvel état
                </button>
              </div>
            </div>

            {/* Création de dossier */}
            {showAddFolderInput && (
              <form onSubmit={handleCreateFolder} className="flex gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200">
                <input
                  type="text"
                  placeholder="Nom du dossier (ex: Visage, Corps)..."
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  className="flex-1 text-xs font-bold border border-slate-300 bg-white text-slate-800 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-xl font-bold hover:bg-indigo-700 cursor-pointer"
                >
                  Créer
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowAddFolderInput(false);
                    setNewFolderName('');
                  }}
                  className="text-xs text-slate-500 px-2 py-1.5 hover:bg-slate-200 rounded-xl cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </form>
            )}

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

            {/* Dossiers d'états */}
            {folders.length > 0 && (
              <div className="space-y-2">
                {folders.map((folder) => {
                  const folderStates = allStates.filter((s) => s.folderId === folder.id);
                  const isCollapsed = Boolean(folder.isCollapsed);
                  const isDropTarget = dragOverFolderId === folder.id;
                  return (
                    <div
                      key={folder.id}
                      onDragOver={(e) => {
                        if (!draggingStateId) return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = 'move';
                        if (dragOverFolderId !== folder.id) setDragOverFolderId(folder.id);
                      }}
                      onDragLeave={(e) => {
                        if (!e.currentTarget.contains(e.relatedTarget as Node) && dragOverFolderId === folder.id) {
                          setDragOverFolderId(null);
                        }
                      }}
                      onDrop={(e) => {
                        e.preventDefault();
                        const stateId = extractDroppedStateId(e);
                        if (stateId) {
                          setStateFolder(selectedEntity.id, stateId, folder.id);
                        }
                        setDraggingStateId(null);
                        setDragOverFolderId(null);
                      }}
                      className={`rounded-2xl border transition-all ${
                        isDropTarget
                          ? 'bg-indigo-50/90 border-indigo-400 ring-2 ring-indigo-300/60'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1.5 px-2.5 py-2">
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <button
                            type="button"
                            onClick={() =>
                              updateStateFolder(selectedEntity.id, folder.id, { isCollapsed: !isCollapsed })
                            }
                            className="p-0.5 text-slate-500 hover:text-indigo-700 rounded cursor-pointer shrink-0"
                            title={isCollapsed ? 'Déplier le dossier' : 'Replier le dossier'}
                          >
                            {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                          {isCollapsed ? (
                            <Folder className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                          ) : (
                            <FolderOpen className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                          )}
                          {renamingFolderId === folder.id ? (
                            <input
                              type="text"
                              value={tempFolderName}
                              onChange={(e) => setTempFolderName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  e.preventDefault();
                                  if (tempFolderName.trim()) {
                                    updateStateFolder(selectedEntity.id, folder.id, { name: tempFolderName.trim() });
                                  }
                                  setRenamingFolderId(null);
                                } else if (e.key === 'Escape') {
                                  setRenamingFolderId(null);
                                }
                              }}
                              onBlur={() => {
                                if (tempFolderName.trim()) {
                                  updateStateFolder(selectedEntity.id, folder.id, { name: tempFolderName.trim() });
                                }
                                setRenamingFolderId(null);
                              }}
                              autoFocus
                              onFocus={(e) => e.target.select()}
                              className="text-xs font-bold bg-white text-slate-800 border border-indigo-300 rounded px-1.5 py-0.5 flex-1 min-w-0 outline-none"
                            />
                          ) : (
                            <span
                              onDoubleClick={() => {
                                setRenamingFolderId(folder.id);
                                setTempFolderName(folder.name);
                              }}
                              className="text-xs font-bold text-slate-700 truncate cursor-text hover:text-indigo-600"
                              title="Double-cliquez pour renommer le dossier"
                            >
                              {folder.name}
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-200 px-1.5 rounded-full shrink-0">
                            {folderStates.length}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => {
                              const newId = addStateToEntity(selectedEntity.id, '', folder.id);
                              if (newId) {
                                updateEntityState(selectedEntity.id, newId);
                                setEditingStateDrawingId(newId);
                              }
                            }}
                            className="p-1 text-indigo-600 hover:bg-indigo-100 rounded-lg cursor-pointer"
                            title={`Créer un état dans « ${folder.name} »`}
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteStateFolder(selectedEntity.id, folder.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                            title="Supprimer le dossier (les états restent conservés)"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {!isCollapsed && (
                        <div className="px-2.5 pb-2.5">
                          {folderStates.length === 0 ? (
                            <div className="text-[11px] text-slate-400 italic text-center py-3 border border-dashed border-slate-200 rounded-xl bg-white/60">
                              Glissez un état ici ou cliquez sur +
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 gap-2">
                              {folderStates.map((st) => renderStateCard(st))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Zone de dépôt pour sortir un état d'un dossier vers la racine */}
            {canDropToRoot && (
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = 'move';
                  if (dragOverFolderId !== 'root') setDragOverFolderId('root');
                }}
                onDragLeave={() => {
                  if (dragOverFolderId === 'root') setDragOverFolderId(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const stateId = extractDroppedStateId(e);
                  if (stateId) {
                    setStateFolder(selectedEntity.id, stateId, undefined);
                  }
                  setDraggingStateId(null);
                  setDragOverFolderId(null);
                }}
                className={`text-[11px] font-bold text-center py-2 px-3 rounded-xl border-2 border-dashed transition-all ${
                  dragOverFolderId === 'root'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                    : 'border-slate-300 bg-slate-50 text-slate-500'
                }`}
              >
                Déposer ici pour sortir du dossier (Racine)
              </div>
            )}

            {/* Cartes d'États à la racine (sans dossier) */}
            {rootStates.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {rootStates.map((st) => renderStateCard(st))}
              </div>
            )}
          </div>
        );
      })()}
    </div>
  );
}
