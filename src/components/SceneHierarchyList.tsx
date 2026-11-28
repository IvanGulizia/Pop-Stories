import React, { useState } from 'react';
import { EMPTY_LIST, useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import { SceneLayerManager } from './SceneLayerManager';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Eye,
  EyeOff,
  GripVertical,
  Link2,
  MoreVertical,
  Pencil,
  Power,
  Sparkles,
  Square,
  Trash2,
  Unlink,
} from 'lucide-react';
import { Entity, SceneLayer, SceneLayerGroup } from '../types';
import { isEntityDraggable } from '../utils/matterPhysicsEngine';
import { useContextMenuTrigger } from '../hooks/useContextMenuTrigger';
import { FloatingContextMenu, FloatingContextMenuItem } from './shared/FloatingContextMenu';
import { getBehaviorTitle } from './behaviors/behaviorMetadata';

interface SceneHierarchyListProps {
  onOpenCreateModal?: () => void;
  onOpenDrawLayerModal?: (layer: SceneLayer, group: SceneLayerGroup) => void;
}

type DropPosition = 'above' | 'inside' | 'below';

interface HierarchyEntityRowProps {
  entity: Entity;
  entities: Record<string, Entity>;
  childrenMap: Record<string, Entity[]>;
  selectedEntityId: string | null;
  selectedEntityIds: string[];
  collapsedParentIds: Record<string, boolean>;
  renamingEntityId: string | null;
  tempEntityName: string;
  draggedEntityId: string | null;
  dragOverTarget: { id: string; position: DropPosition } | null;
  isDescendant: (candidateId: string, ancestorId: string) => boolean;
  onSelect: (id: string, options?: { toggle?: boolean }) => void;
  onToggleCollapse: (id: string) => void;
  onStartRename: (entity: Entity) => void;
  onChangeTempName: (name: string) => void;
  onCommitRename: (id: string, cleanName: string) => void;
  onCancelRename: () => void;
  onSetDraggedEntityId: (id: string | null) => void;
  onSetDragOverTarget: (target: { id: string; position: DropPosition } | null) => void;
  onSetDragOverRootZone: (active: boolean) => void;
  onDropReorder: (sourceId: string, targetId: string, pos: DropPosition) => void;
  onToggleDisabled: (id: string, nextDisabled: boolean) => void;
  onToggleVisible: (id: string, nextVisible: boolean) => void;
  onDetach: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onOpenContextMenu: (entity: Entity, coords: { x: number; y: number }) => void;
}

function HierarchyEntityRow({
  entity,
  entities,
  childrenMap,
  selectedEntityId,
  selectedEntityIds,
  collapsedParentIds,
  renamingEntityId,
  tempEntityName,
  draggedEntityId,
  dragOverTarget,
  isDescendant,
  onSelect,
  onToggleCollapse,
  onStartRename,
  onChangeTempName,
  onCommitRename,
  onCancelRename,
  onSetDraggedEntityId,
  onSetDragOverTarget,
  onSetDragOverRootZone,
  onDropReorder,
  onToggleDisabled,
  onToggleVisible,
  onDetach,
  onDuplicate,
  onDelete,
  onOpenContextMenu,
}: HierarchyEntityRowProps) {
  const isPrimarySelected = selectedEntityId === entity.id;
  const isSelected = isPrimarySelected || selectedEntityIds.includes(entity.id);
  const isMultiActive = selectedEntityIds.length > 1;
  const currentState = entity.states[entity.currentStateId];
  const children = childrenMap[entity.id] || [];
  const hasChildren = children.length > 0;
  const isCollapsed = Boolean(collapsedParentIds[entity.id]);

  const isTargeted = dragOverTarget?.id === entity.id;
  const showGapAbove = isTargeted && dragOverTarget.position === 'above';
  const showInside = isTargeted && dragOverTarget.position === 'inside';
  const showGapBelow = isTargeted && dragOverTarget.position === 'below';
  const hasValidParent = Boolean(entity.parentId && entities[entity.parentId]);
  const isVisible = entity.visible !== false;
  const isDisabled = Boolean(entity.disabled);

  const { bind: rowContextBind, consumeLongPressClick } = useContextMenuTrigger(
    (coords) => onOpenContextMenu(entity, coords),
    { ignoreInteractiveChildren: true }
  );

  return (
    <div className="space-y-1.5">
      <div className="relative">
        {/* Drop slot indicator ABOVE */}
        {showGapAbove && (
          <div className="absolute -top-1.5 left-1 right-1 h-1 bg-indigo-600 rounded-full shadow-md z-30 pointer-events-none animate-pulse flex items-center justify-center">
            <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full -top-2.5 relative shadow-xs">
              ↓ Placer au-dessus
            </span>
          </div>
        )}

        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData('text/entity-id', entity.id);
            e.dataTransfer.setData('text/plain', entity.id);
            e.dataTransfer.effectAllowed = 'move';
            onSetDraggedEntityId(entity.id);
          }}
          onDragEnd={() => {
            onSetDraggedEntityId(null);
            onSetDragOverTarget(null);
            onSetDragOverRootZone(false);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            e.dataTransfer.dropEffect = 'move';
            const rect = e.currentTarget.getBoundingClientRect();
            const relY = rect.height > 0 ? (e.clientY - rect.top) / rect.height : 0.5;
            const canNest =
              Boolean(draggedEntityId) &&
              draggedEntityId !== entity.id &&
              !isDescendant(entity.id, draggedEntityId!);

            let pos: DropPosition;
            if (relY < 0.25) {
              pos = 'above';
            } else if (relY > 0.75) {
              pos = 'below';
            } else if (canNest) {
              pos = 'inside';
            } else {
              pos = relY < 0.5 ? 'above' : 'below';
            }

            if (dragOverTarget?.id !== entity.id || dragOverTarget.position !== pos) {
              onSetDragOverTarget({ id: entity.id, position: pos });
            }
          }}
          onDragLeave={(e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) {
              if (dragOverTarget?.id === entity.id) {
                onSetDragOverTarget(null);
              }
            }
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const sourceId =
              e.dataTransfer.getData('text/entity-id') ||
              e.dataTransfer.getData('text/plain') ||
              draggedEntityId;
            const dropPos = dragOverTarget?.id === entity.id ? dragOverTarget.position : 'above';

            if (sourceId && sourceId !== entity.id) {
              onDropReorder(sourceId, entity.id, dropPos);
            }
            onSetDraggedEntityId(null);
            onSetDragOverTarget(null);
            onSetDragOverRootZone(false);
          }}
          {...rowContextBind}
          onClick={(e) => {
            if (consumeLongPressClick(e)) return;
            if (e.shiftKey || e.metaKey || e.ctrlKey) {
              onSelect(entity.id, { toggle: true });
            } else {
              onSelect(entity.id);
            }
          }}
          className={`p-2.5 bg-white border rounded-2xl transition-all cursor-pointer flex flex-col gap-1.5 group ${
            isDisabled ? 'opacity-50 bg-slate-100/70' : !isVisible ? 'opacity-65 bg-slate-50/70' : ''
          } ${
            showInside
              ? 'border-indigo-600 ring-2 ring-indigo-500/40 bg-indigo-50/80 shadow-md scale-[1.01]'
              : showGapAbove
              ? 'border-t-4 border-t-indigo-600 border-x-indigo-400 border-b-slate-200 bg-indigo-50/40 shadow-md'
              : showGapBelow
              ? 'border-b-4 border-b-indigo-600 border-x-indigo-400 border-t-slate-200 bg-indigo-50/40 shadow-md'
              : isSelected
              ? isMultiActive && !isPrimarySelected
                ? 'border-indigo-400 ring-2 ring-indigo-400/20 bg-indigo-50/15 shadow-xs'
                : 'border-indigo-500 ring-2 ring-indigo-500/20 bg-indigo-50/20 shadow-xs'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          {/* Entête d'item : chevron si parent, poignée, miniature, nom, état */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            <div className="flex items-center gap-1.5 min-w-0">
              {hasChildren && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleCollapse(entity.id);
                  }}
                  className="p-0.5 text-slate-500 hover:text-indigo-700 hover:bg-indigo-50 rounded transition-colors cursor-pointer shrink-0"
                  title={isCollapsed ? 'Afficher les enfants' : 'Masquer les enfants'}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5" />
                  )}
                </button>
              )}
              <div
                className="text-slate-300 group-hover:text-slate-600 transition-colors cursor-grab active:cursor-grabbing shrink-0 p-0.5 hover:bg-slate-100 rounded"
                title="Glisser au-dessus/dessous pour l'ordre, ou au centre d'un objet pour l'attacher"
              >
                <GripVertical className="w-3.5 h-3.5" />
              </div>
              <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center p-0.5 shrink-0 border border-slate-200/70 overflow-hidden">
                <EntityMiniPreview entity={entity} type={entity.type} size={28} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {renamingEntityId === entity.id ? (
                    <input
                      type="text"
                      value={tempEntityName}
                      onChange={(e) => onChangeTempName(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          const clean = tempEntityName.trim();
                          if (clean) {
                            onCommitRename(entity.id, clean);
                          } else {
                            onCancelRename();
                          }
                        } else if (e.key === 'Escape') {
                          onCancelRename();
                        }
                      }}
                      onBlur={() => {
                        const clean = tempEntityName.trim();
                        if (clean) {
                          onCommitRename(entity.id, clean);
                        } else {
                          onCancelRename();
                        }
                      }}
                      onFocus={(e) => e.target.select()}
                      autoFocus
                      className="text-xs font-bold text-slate-800 bg-white border border-indigo-400 rounded-md px-1.5 py-0.5 outline-none w-full min-w-[70px] shadow-2xs ring-1 ring-indigo-500/30"
                    />
                  ) : (
                    <p
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        onStartRename(entity);
                      }}
                      title="Double-cliquez pour renommer cette instance (Shift+clic pour sélection multiple)"
                      className="text-xs font-bold text-slate-800 truncate leading-snug cursor-text"
                    >
                      {entity.name}
                    </p>
                  )}
                  {isMultiActive && isPrimarySelected && (
                    <span className="text-[8px] font-black px-1 py-0.2 bg-indigo-600 text-white rounded shrink-0">
                      1er
                    </span>
                  )}
                  {hasChildren && (
                    <span
                      className="text-[9px] font-extrabold px-1.5 py-0.2 bg-indigo-100 text-indigo-700 rounded-full shrink-0"
                      title={`${children.length} objet${children.length > 1 ? 's' : ''} attaché${children.length > 1 ? 's' : ''}`}
                    >
                      {children.length}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] text-slate-400 font-medium">
                    {currentState?.name || entity.currentStateId}
                  </span>
                  {hasValidParent && entity.parentId && (
                    <span
                      className="inline-flex items-center gap-0.5 text-[9px] px-1.5 py-0.2 bg-indigo-50 text-indigo-700 border border-indigo-200/70 font-bold rounded max-w-[110px] truncate"
                      title={`Attaché à ${entities[entity.parentId].name}`}
                    >
                      <Link2 className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{entities[entity.parentId].name}</span>
                    </span>
                  )}
                  {isDisabled && (
                    <span
                      className="text-[9px] px-1 py-0.2 bg-rose-100 text-rose-700 border border-rose-200 font-black rounded"
                      title="Objet désactivé (ignoré en mode Play)"
                    >
                      OFF
                    </span>
                  )}
                  {isEntityDraggable(entity, currentState).canDrag && !isDisabled && (
                    <span className="text-[9px] px-1 py-0.2 bg-emerald-50 text-emerald-600 font-semibold rounded">
                      Drag
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Actions primaires + menu contextuel */}
            <div
              className={`flex items-center gap-0.5 shrink-0 transition-opacity ${
                !isVisible || isDisabled || isSelected ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onStartRename(entity);
                }}
                className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                title="Renommer cette instance sur la scène"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleDisabled(entity.id, !isDisabled);
                }}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  isDisabled
                    ? 'text-rose-700 bg-rose-100 hover:bg-rose-200/80'
                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                }`}
                title={
                  isDisabled
                    ? 'Activer l’objet et ses enfants (logique, physique, rendu)'
                    : 'Désactiver l’objet et ses enfants (aucune logique, physique ou rendu en jeu)'
                }
              >
                <Power className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleVisible(entity.id, !isVisible);
                }}
                className={`p-1 rounded-lg transition-colors cursor-pointer ${
                  !isVisible
                    ? 'text-amber-700 bg-amber-100/80 hover:bg-amber-200/70'
                    : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
                }`}
                title={isVisible ? 'Masquer visuellement l’objet sur la scène' : 'Afficher visuellement l’objet sur la scène'}
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
              {hasValidParent && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDetach(entity.id);
                  }}
                  className="p-1 text-indigo-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                  title="Détacher du parent"
                >
                  <Unlink className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onDuplicate(entity.id);
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
                  const rect = e.currentTarget.getBoundingClientRect();
                  onOpenContextMenu(entity, { x: rect.right - 200, y: rect.bottom + 6 });
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                title="Plus d'actions (Ordre Z, Sélection multiple, Coller composant, Supprimer...)"
              >
                <MoreVertical className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {showInside && (
            <div className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 border border-indigo-300 rounded-lg px-2 py-0.5 text-center">
              ↳ Attacher dans « {entity.name} »
            </div>
          )}
        </div>

        {/* Drop slot indicator BELOW */}
        {showGapBelow && (
          <div className="absolute -bottom-1.5 left-1 right-1 h-1 bg-indigo-600 rounded-full shadow-md z-30 pointer-events-none animate-pulse flex items-center justify-center">
            <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full top-2.5 relative shadow-xs">
              ↑ Placer en-dessous
            </span>
          </div>
        )}
      </div>

      {/* Enfants imbriqués */}
      {hasChildren && !isCollapsed && (
        <div className="ml-3.5 pl-2.5 border-l-2 border-indigo-200/80 space-y-1.5">
          {children.map((child) => (
            <HierarchyEntityRow
              key={child.id}
              entity={child}
              entities={entities}
              childrenMap={childrenMap}
              selectedEntityId={selectedEntityId}
              selectedEntityIds={selectedEntityIds}
              collapsedParentIds={collapsedParentIds}
              renamingEntityId={renamingEntityId}
              tempEntityName={tempEntityName}
              draggedEntityId={draggedEntityId}
              dragOverTarget={dragOverTarget}
              isDescendant={isDescendant}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
              onStartRename={onStartRename}
              onChangeTempName={onChangeTempName}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onSetDraggedEntityId={onSetDraggedEntityId}
              onSetDragOverTarget={onSetDragOverTarget}
              onSetDragOverRootZone={onSetDragOverRootZone}
              onDropReorder={onDropReorder}
              onToggleDisabled={onToggleDisabled}
              onToggleVisible={onToggleVisible}
              onDetach={onDetach}
              onDuplicate={onDuplicate}
              onDelete={onDelete}
              onOpenContextMenu={onOpenContextMenu}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function SceneHierarchyList({ onOpenCreateModal, onOpenDrawLayerModal }: SceneHierarchyListProps) {
  const entities = useSceneStore((state) => state.entities);
  const entityOrder = useSceneStore((state) => state.entityOrder);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectedEntityIds = useSceneStore((state) => state.selectedEntityIds || EMPTY_LIST);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const duplicateEntity = useSceneStore((state) => state.duplicateEntity);
  const deleteEntity = useSceneStore((state) => state.deleteEntity);
  const batchDuplicateEntities = useSceneStore((state) => state.batchDuplicateEntities);
  const batchDeleteEntities = useSceneStore((state) => state.batchDeleteEntities);
  const batchUpdateEntityDetails = useSceneStore((state) => state.batchUpdateEntityDetails);
  const reorderEntities = useSceneStore((state) => state.reorderEntities);
  const reorderEntityZStep = useSceneStore((state) => state.reorderEntityZStep);
  const setEntityParent = useSceneStore((state) => state.setEntityParent);
  const detachEntity = useSceneStore((state) => state.detachEntity);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);
  const setEntityDisabledCascade = useSceneStore((state) => state.setEntityDisabledCascade);
  const copiedBehavior = useSceneStore((state) => state.copiedBehavior);
  const pasteBehaviorToEntity = useSceneStore((state) => state.pasteBehaviorToEntity);

  const [draggedEntityId, setDraggedEntityId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ id: string; position: DropPosition } | null>(null);
  const [dragOverRootZone, setDragOverRootZone] = useState(false);
  const [collapsedParentIds, setCollapsedParentIds] = useState<Record<string, boolean>>({});
  const [renamingEntityId, setRenamingEntityId] = useState<string | null>(null);
  const [tempEntityName, setTempEntityName] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    entity: Entity;
  } | null>(null);

  const order = entityOrder && entityOrder.length > 0 ? entityOrder : Object.keys(entities);
  const allKeys = Array.from(new Set([...order, ...Object.keys(entities)]));
  const activeEntities = allKeys.map((id) => entities[id]).filter(Boolean);

  // We display the hierarchy with topmost entity at the top of the UI list
  const displayList = [...activeEntities].reverse();

  // Group into tree preserving z-order within siblings
  const childrenMap: Record<string, Entity[]> = {};
  const roots: Entity[] = [];

  displayList.forEach((ent) => {
    if (ent.parentId && entities[ent.parentId] && ent.parentId !== ent.id) {
      if (!childrenMap[ent.parentId]) childrenMap[ent.parentId] = [];
      childrenMap[ent.parentId].push(ent);
    } else {
      roots.push(ent);
    }
  });

  const isDescendant = (candidateId: string, ancestorId: string): boolean => {
    const visited = new Set<string>();
    let current = entities[candidateId]?.parentId;
    while (current && !visited.has(current)) {
      if (current === ancestorId) return true;
      visited.add(current);
      current = entities[current]?.parentId;
    }
    return false;
  };

  const draggedEntity = draggedEntityId ? entities[draggedEntityId] : undefined;
  const canDropToRoot = Boolean(draggedEntity?.parentId && entities[draggedEntity.parentId]);

  const toggleCollapse = (id: string) => {
    setCollapsedParentIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const handleDropReorder = (sourceId: string, targetId: string, dropPos: DropPosition) => {
    if (dropPos === 'inside' && !isDescendant(targetId, sourceId)) {
      setEntityParent(sourceId, targetId);
      setCollapsedParentIds((prev) => ({ ...prev, [targetId]: false }));
    } else {
      reorderEntities(sourceId, targetId, dropPos === 'below' ? 'below' : 'above');
    }
  };

  const buildMenuItems = (): FloatingContextMenuItem[] => {
    if (!contextMenu) return [];
    const target = entities[contextMenu.entity.id] || contextMenu.entity;
    const isVisible = target.visible !== false;
    const isDisabled = Boolean(target.disabled);
    const hasValidParent = Boolean(target.parentId && entities[target.parentId]);
    const isTargetInMulti = selectedEntityIds.length > 1 && selectedEntityIds.includes(target.id);
    const isTargetSelected = selectedEntityIds.includes(target.id) || selectedEntityId === target.id;
    const items: FloatingContextMenuItem[] = [];

    if (isTargetInMulti) {
      const selectedObjects = selectedEntityIds.map((id) => entities[id]).filter(Boolean);
      const allHidden = selectedObjects.every((e) => e.visible === false);
      items.push(
        {
          id: 'batch-dup',
          label: `Dupliquer la sélection (${selectedEntityIds.length})`,
          icon: <Copy className="w-3.5 h-3.5 text-indigo-600" />,
          onSelect: () => batchDuplicateEntities(selectedEntityIds),
        },
        {
          id: 'batch-vis',
          label: allHidden
            ? `Tout afficher (${selectedEntityIds.length})`
            : `Tout masquer (${selectedEntityIds.length})`,
          icon: allHidden ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />,
          onSelect: () => batchUpdateEntityDetails(selectedEntityIds, { visible: allHidden }),
        },
        {
          id: 'batch-del',
          label: `Supprimer la sélection (${selectedEntityIds.length})`,
          icon: <Trash2 className="w-3.5 h-3.5" />,
          danger: true,
          dividerAfter: true,
          onSelect: () => batchDeleteEntities(selectedEntityIds),
        }
      );
    }

    items.push(
      {
        id: 'toggle-select',
        label: isTargetSelected ? 'Retirer de la sélection' : 'Ajouter à la sélection',
        icon: isTargetSelected ? (
          <CheckSquare className="w-3.5 h-3.5 text-indigo-600" />
        ) : (
          <Square className="w-3.5 h-3.5 text-slate-500" />
        ),
        onSelect: () => selectEntity(target.id, { toggle: true }),
      },
      {
        id: 'rename',
        label: 'Renommer',
        icon: <Pencil className="w-3.5 h-3.5 text-slate-600" />,
        onSelect: () => {
          setRenamingEntityId(target.id);
          setTempEntityName(target.name);
        },
      },
      {
        id: 'duplicate',
        label: 'Dupliquer',
        icon: <Copy className="w-3.5 h-3.5 text-indigo-600" />,
        shortcut: '⌘D',
        onSelect: () => duplicateEntity(target.id),
      }
    );

    if (copiedBehavior) {
      items.push({
        id: 'paste-behavior',
        label: `Coller « ${getBehaviorTitle(copiedBehavior.behavior.type)} »`,
        icon: <ClipboardPaste className="w-3.5 h-3.5 text-emerald-600" />,
        onSelect: () => pasteBehaviorToEntity(target.id),
      });
    }

    items.push(
      {
        id: 'z-up',
        label: "Monter d'un cran",
        icon: <ArrowUp className="w-3.5 h-3.5 text-slate-600" />,
        dividerBefore: true,
        onSelect: () => reorderEntityZStep(target.id, 'up'),
      },
      {
        id: 'z-down',
        label: "Descendre d'un cran",
        icon: <ArrowDown className="w-3.5 h-3.5 text-slate-600" />,
        onSelect: () => reorderEntityZStep(target.id, 'down'),
      },
      {
        id: 'z-front',
        label: 'Mettre tout devant',
        icon: <ArrowUpToLine className="w-3.5 h-3.5 text-slate-600" />,
        onSelect: () => reorderEntityZStep(target.id, 'front'),
      },
      {
        id: 'z-back',
        label: 'Mettre tout derrière',
        icon: <ArrowDownToLine className="w-3.5 h-3.5 text-slate-600" />,
        dividerAfter: true,
        onSelect: () => reorderEntityZStep(target.id, 'back'),
      },
      {
        id: 'toggle-visible',
        label: isVisible ? 'Masquer sur la scène' : 'Afficher sur la scène',
        icon: isVisible ? (
          <EyeOff className="w-3.5 h-3.5 text-amber-600" />
        ) : (
          <Eye className="w-3.5 h-3.5 text-emerald-600" />
        ),
        onSelect: () => updateEntityDetails(target.id, { visible: !isVisible }),
      },
      {
        id: 'toggle-disabled',
        label: isDisabled ? 'Activer (mode Play)' : 'Désactiver (mode Play)',
        icon: <Power className={`w-3.5 h-3.5 ${isDisabled ? 'text-emerald-600' : 'text-rose-500'}`} />,
        onSelect: () => setEntityDisabledCascade(target.id, !isDisabled, 'with_children'),
      }
    );

    if (hasValidParent) {
      items.push({
        id: 'detach',
        label: 'Détacher du parent',
        icon: <Unlink className="w-3.5 h-3.5 text-indigo-600" />,
        onSelect: () => detachEntity(target.id),
      });
    }

    items.push({
      id: 'delete',
      label: 'Supprimer',
      icon: <Trash2 className="w-3.5 h-3.5" />,
      danger: true,
      dividerBefore: true,
      onSelect: () => deleteEntity(target.id),
    });

    return items;
  };

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
        <div className="flex items-center justify-between px-1 text-[11px] font-bold text-slate-500 gap-2">
          <span className="flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
            Objets de jeu ({activeEntities.length})
          </span>
          {selectedEntityIds.length > 1 ? (
            <button
              type="button"
              onClick={() => selectEntity(selectedEntityId)}
              className="text-[10px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded-lg hover:bg-indigo-100 cursor-pointer"
              title="Revenir à une sélection simple"
            >
              {selectedEntityIds.length} sél. ×
            </button>
          ) : (
            <span className="text-[10px] font-normal text-slate-400">
              Shift+clic = multi · Clic droit / appui long
            </span>
          )}
        </div>

        {/* Zone de dépôt racine pour détacher un enfant par drag-and-drop */}
        {canDropToRoot && (
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (!dragOverRootZone) setDragOverRootZone(true);
            }}
            onDragLeave={() => setDragOverRootZone(false)}
            onDrop={(e) => {
              e.preventDefault();
              const sourceId =
                e.dataTransfer.getData('text/entity-id') ||
                e.dataTransfer.getData('text/plain') ||
                draggedEntityId;
              if (sourceId) {
                detachEntity(sourceId);
              }
              setDraggedEntityId(null);
              setDragOverTarget(null);
              setDragOverRootZone(false);
            }}
            className={`text-[11px] font-bold text-center py-2 px-3 rounded-xl border-2 border-dashed transition-all shrink-0 ${
              dragOverRootZone
                ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                : 'border-slate-300 bg-slate-50 text-slate-500'
            }`}
          >
            Déposer ici pour détacher (Racine)
          </div>
        )}

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
            {roots.map((entity) => (
              <HierarchyEntityRow
                key={entity.id}
                entity={entity}
                entities={entities}
                childrenMap={childrenMap}
                selectedEntityId={selectedEntityId}
                selectedEntityIds={selectedEntityIds}
                collapsedParentIds={collapsedParentIds}
                renamingEntityId={renamingEntityId}
                tempEntityName={tempEntityName}
                draggedEntityId={draggedEntityId}
                dragOverTarget={dragOverTarget}
                isDescendant={isDescendant}
                onSelect={(id, opts) => selectEntity(id, opts)}
                onToggleCollapse={toggleCollapse}
                onStartRename={(ent) => {
                  setRenamingEntityId(ent.id);
                  setTempEntityName(ent.name);
                }}
                onChangeTempName={setTempEntityName}
                onCommitRename={(id, clean) => {
                  updateEntityDetails(id, { name: clean }, { instanceOnly: true });
                  setRenamingEntityId(null);
                }}
                onCancelRename={() => setRenamingEntityId(null)}
                onSetDraggedEntityId={setDraggedEntityId}
                onSetDragOverTarget={setDragOverTarget}
                onSetDragOverRootZone={setDragOverRootZone}
                onDropReorder={handleDropReorder}
                onToggleDisabled={(id, next) => setEntityDisabledCascade(id, next, 'with_children')}
                onToggleVisible={(id, next) => updateEntityDetails(id, { visible: next })}
                onDetach={detachEntity}
                onDuplicate={duplicateEntity}
                onDelete={deleteEntity}
                onOpenContextMenu={(ent, coords) => setContextMenu({ entity: ent, ...coords })}
              />
            ))}
          </div>
        )}
      </div>

      {contextMenu && (
        <FloatingContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          title={contextMenu.entity.name}
          subtitle={
            selectedEntityIds.length > 1 && selectedEntityIds.includes(contextMenu.entity.id)
              ? `${selectedEntityIds.length} objets sélectionnés`
              : contextMenu.entity.states[contextMenu.entity.currentStateId]?.name
          }
          items={buildMenuItems()}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  );
}
