import React, { useState } from 'react';
import {
  Activity,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardPaste,
  Copy,
  Layers,
  MoreVertical,
  Plus,
  Power,
  RotateCcw,
  Sparkles,
  Trash2,
  Undo2,
} from 'lucide-react';
import {
  AutoDestroyBehaviorConfig,
  BehaviorOverride,
  BehaviorType,
  BoundaryBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  CustomParticlePreset,
  DraggableBehaviorConfig,
  DrivenAnimationBehaviorConfig,
  Entity,
  EntityBehavior,
  EntityState,
  FleeBehaviorConfig,
  FollowBehaviorConfig,
  HealthBehaviorConfig,
  InteractivePuppetBehaviorConfig,
  JiggleBehaviorConfig,
  KeyboardControlBehaviorConfig,
  LookAtBehaviorConfig,
  MoveToBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  PatrolBehaviorConfig,
  PhysicsBehaviorConfig,
  RotateDragBehaviorConfig,
  SliderBehaviorConfig,
  SnapBehaviorConfig,
  StrokeWiggleBehaviorConfig,
  WanderingBehaviorConfig,
} from '../types';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../store/useSceneStore';
import { ParticleEditorModal } from './ParticleEditorModal';
import { InteractivePuppetControls } from './InteractivePuppetControls';
import { invalidateCustomParticleSprite } from '../utils/particleSystem';
import { resolveEffectiveParentOffset } from '../store/parentingHelpers';
import {
  createDefaultBehaviorConfig,
  getBehaviorIcon,
  getBehaviorTitle,
} from './behaviors/behaviorMetadata';
import { HitboxColliderCard } from './behaviors/HitboxColliderCard';
import { AddBehaviorModal } from './behaviors/AddBehaviorModal';
import {
  AutoDestroyBehaviorControls,
  BoundaryBehaviorControls,
  ConstantVelocityBehaviorControls,
  DraggableBehaviorControls,
  KeyboardControlBehaviorControls,
  PhysicsBehaviorControls,
} from './behaviors/PhysicsAndCoreBehaviorControls';
import {
  FleeBehaviorControls,
  FollowBehaviorControls,
  MoveToBehaviorControls,
  PatrolBehaviorControls,
  WanderingBehaviorControls,
} from './behaviors/MovementAndAIBehaviorControls';
import { JiggleBehaviorControls } from './behaviors/JiggleBehaviorControls';
import { SliderBehaviorControls } from './behaviors/SliderBehaviorControls';
import { RotateDragBehaviorControls } from './behaviors/RotateDragBehaviorControls';
import { SnapBehaviorControls } from './behaviors/SnapBehaviorControls';
import { DrivenAnimationBehaviorControls } from './behaviors/DrivenAnimationBehaviorControls';
import {
  HealthBehaviorControls,
  LookAtBehaviorControls,
  ParticleEmitterBehaviorControls,
  StrokeWiggleBehaviorControls,
} from './behaviors/VisualAndSurvivalBehaviorControls';
import { useContextMenuTrigger } from '../hooks/useContextMenuTrigger';
import { FloatingContextMenu, FloatingContextMenuItem } from './shared/FloatingContextMenu';
import { CopiedBehaviorPayload } from '../utils/behaviorClipboardHelpers';

interface BehaviorManagerProps {
  entity: Entity;
  selectedStateId?: string;
  onEditStateDrawing?: (stateId: string) => void;
}

interface BehaviorCardRowProps {
  entityId: string;
  behavior: EntityBehavior;
  cardKey: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  hasOverride: boolean;
  targetStateName?: string;
  isEffectiveEnabled: boolean;
  copiedBehavior: CopiedBehaviorPayload | null;
  justCopied: boolean;
  justPasted: boolean;
  onCopy: () => void;
  onPasteValues: () => void;
  onToggleEnabled: (checked: boolean) => void;
  onDelete: () => void;
  onOpenContextMenu: (coords: { x: number; y: number }) => void;
  children?: React.ReactNode;
}

function BehaviorCardRow({
  behavior,
  isExpanded,
  onToggleExpand,
  hasOverride,
  targetStateName,
  isEffectiveEnabled,
  copiedBehavior,
  justCopied,
  justPasted,
  onCopy,
  onPasteValues,
  onToggleEnabled,
  onDelete,
  onOpenContextMenu,
  children,
}: BehaviorCardRowProps) {
  const canPasteSameType = Boolean(copiedBehavior && copiedBehavior.behavior.type === behavior.type);

  const { bind: headerContextBind, consumeLongPressClick } = useContextMenuTrigger(
    (coords) => onOpenContextMenu(coords),
    { ignoreInteractiveChildren: true }
  );

  return (
    <div
      className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
        hasOverride
          ? 'border-amber-300 ring-2 ring-amber-100/80'
          : 'border-slate-200 hover:border-slate-300'
      }`}
    >
      {/* Carte En-tête */}
      <div
        {...headerContextBind}
        onClick={(e) => {
          if (consumeLongPressClick(e)) return;
          onToggleExpand();
        }}
        className="p-2.5 flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
            {getBehaviorIcon(behavior.type)}
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
              <span>{getBehaviorTitle(behavior.type)}</span>
            </div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
              {hasOverride ? (
                <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Override {targetStateName}
                </span>
              ) : (
                <span className="text-slate-400">Partagé</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {/* Copier les valeurs du composant */}
          <button
            type="button"
            onClick={onCopy}
            className={`p-1 rounded-lg cursor-pointer transition-colors ${
              justCopied
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'
            }`}
            title={
              hasOverride
                ? `Copier les réglages (${targetStateName})`
                : 'Copier les réglages de ce composant'
            }
          >
            {justCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </button>

          {/* Coller les valeurs si le presse-papier contient le même type */}
          {canPasteSameType && (
            <button
              type="button"
              onClick={onPasteValues}
              className={`p-1 rounded-lg cursor-pointer transition-colors ${
                justPasted
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200'
              }`}
              title={`Coller les valeurs copiées depuis ${copiedBehavior?.sourceEntityName}`}
            >
              {justPasted ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <ClipboardPaste className="w-3.5 h-3.5" />
              )}
            </button>
          )}

          {/* Toggle activation on/off */}
          <label className="relative inline-flex items-center cursor-pointer mx-0.5">
            <input
              type="checkbox"
              checked={isEffectiveEnabled}
              onChange={(e) => onToggleEnabled(e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
          </label>

          {/* Menu contextuel (⋯) accessible souris & tablette */}
          <button
            type="button"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              onOpenContextMenu({ x: rect.right - 200, y: rect.bottom + 6 });
            }}
            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            title="Actions du composant (Copier, Coller, Réinitialiser, Supprimer)"
          >
            <MoreVertical className="w-3.5 h-3.5" />
          </button>

          {/* Supprimer le composant de l'entité */}
          <button
            type="button"
            onClick={onDelete}
            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
            title="Supprimer ce composant"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {children}
    </div>
  );
}

export function BehaviorManager({ entity, selectedStateId, onEditStateDrawing }: BehaviorManagerProps) {
  const updateEntityBehaviors = useSceneStore((state) => state.updateEntityBehaviors);
  const updateStateBehaviorOverride = useSceneStore((state) => state.updateStateBehaviorOverride);
  const removeStateBehaviorOverride = useSceneStore((state) => state.removeStateBehaviorOverride);
  const addStateToEntity = useSceneStore((state) => state.addStateToEntity);
  const addStateFolder = useSceneStore((state) => state.addStateFolder);
  const updateEntityDetails = useSceneStore((state) => state.updateEntityDetails);
  const updateStateProperties = useSceneStore((state) => state.updateStateProperties);
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const rules = useSceneStore((state) => state.rules || EMPTY_LIST);
  const layerGroups = useSceneStore((state) => state.layerGroups || EMPTY_LIST);
  const customParticles = useSceneStore((state) => state.customParticles || EMPTY_LIST);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);
  const expandedBehaviorCards = useSceneStore((state) => state.expandedBehaviorCards || EMPTY_RECORD);
  const setBehaviorCardExpanded = useSceneStore((state) => state.setBehaviorCardExpanded);
  const copiedBehavior = useSceneStore((state) => state.copiedBehavior);
  const copyEntityBehavior = useSceneStore((state) => state.copyEntityBehavior);
  const pasteBehaviorToEntity = useSceneStore((state) => state.pasteBehaviorToEntity);
  const resetEntityBehavior = useSceneStore((state) => state.resetEntityBehavior);

  const baseBehaviors = entity.behaviors || [];
  const stateList = Object.values(entity.states);

  const [activeStateId, setActiveStateId] = useState<string>(
    selectedStateId || entity.currentStateId
  );
  const hasAnyStoredCardForEntity = React.useMemo(
    () => Object.keys(expandedBehaviorCards).some((k) => k.startsWith(`${entity.id}:`)),
    [expandedBehaviorCards, entity.id]
  );
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [feedbackBadge, setFeedbackBadge] = useState<{
    behaviorId: string;
    kind: 'copied' | 'pasted';
  } | null>(null);
  const [behaviorContextMenu, setBehaviorContextMenu] = useState<{
    x: number;
    y: number;
    behavior: EntityBehavior;
    hasOverride: boolean;
    isEffectiveEnabled: boolean;
  } | null>(null);
  const [particleEditorState, setParticleEditorState] = useState<{
    behaviorId: string;
    isOverridden: boolean;
    initialView?: 'studio' | 'draw_custom';
    editingPreset?: CustomParticlePreset;
  } | null>(null);

  const triggerFeedback = (behaviorId: string, kind: 'copied' | 'pasted') => {
    setFeedbackBadge({ behaviorId, kind });
    window.setTimeout(() => {
      setFeedbackBadge((cur) =>
        cur && cur.behaviorId === behaviorId && cur.kind === kind ? null : cur
      );
    }, 1400);
  };

  // Sync with selectedStateId if it changes from parent Inspector
  React.useEffect(() => {
    if (selectedStateId && entity.states[selectedStateId]) {
      setActiveStateId(selectedStateId);
    }
  }, [selectedStateId, entity.states]);

  const targetState = entity.states[activeStateId] || stateList[0];
  const targetEntityOptions = Object.values(entities).filter((e) => e.id !== entity.id);

  // Options dynamiques de Types et de Tags pour les comportements autonomes (Piste D)
  const entityTypeOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    Object.values(entities).forEach((e) => {
      if (!map.has(e.type)) {
        map.set(e.type, e.name.replace(/\s+\d+$/, ''));
      }
    });
    Object.values(customArchetypes || {}).forEach((arch) => {
      if (!map.has(arch.type)) {
        map.set(arch.type, arch.name);
      }
    });
    return Array.from(map.entries()).map(([type, label]) => ({ type, label }));
  }, [entities, customArchetypes]);

  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(entities).forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    (rules || []).forEach((r) => {
      if (r.trigger?.subjectTag) tagSet.add(r.trigger.subjectTag);
      if (r.trigger?.targetTag) tagSet.add(r.trigger.targetTag);
      r.actions.forEach((a) => {
        if (a.targetTag) tagSet.add(a.targetTag);
        a.spawnTags?.forEach((t) => tagSet.add(t));
      });
    });
    (layerGroups || []).forEach((g) => {
      (g.layers || []).forEach((l) => {
        l.colliderTags?.forEach((t) => tagSet.add(t));
      });
    });
    return Array.from(tagSet);
  }, [entities, rules, layerGroups]);

  const handleQuickCreateState = (suggestedName: string, folderName?: string) => {
    const cleanBase = suggestedName.trim() || 'État';
    const existingNames = new Set(stateList.map((s) => s.name.trim().toLowerCase()));
    let candidate = cleanBase;
    let idx = 2;
    while (existingNames.has(candidate.toLowerCase())) {
      candidate = `${cleanBase} ${idx}`;
      idx += 1;
    }
    const folderId = folderName ? addStateFolder(entity.id, folderName) : undefined;
    return addStateToEntity(entity.id, candidate, folderId);
  };

  const handleAddBehavior = (type: BehaviorType) => {
    const newBehavior = createDefaultBehaviorConfig(type, entity);
    const updated = [...baseBehaviors, newBehavior];
    updateEntityBehaviors(entity.id, updated);
    setBehaviorCardExpanded(`${entity.id}:${newBehavior.id}`, true);
    setIsAddModalOpen(false);
  };

  const handleDeleteBehavior = (behaviorId: string) => {
    const updated = baseBehaviors.filter((b) => b.id !== behaviorId);
    updateEntityBehaviors(entity.id, updated);
  };

  const handleUpdateBaseBehavior = (behaviorId: string, partial: Partial<EntityBehavior>) => {
    const updated = baseBehaviors.map((b) => {
      if (b.id === behaviorId) {
        return { ...b, ...partial } as EntityBehavior;
      }
      return b;
    });
    updateEntityBehaviors(entity.id, updated);
  };

  const handleToggleOverride = (behavior: EntityBehavior) => {
    if (!targetState) return;
    const currentOverride = targetState.behaviorOverrides?.[behavior.id];
    if (currentOverride) {
      removeStateBehaviorOverride(entity.id, targetState.id, behavior.id);
    } else {
      updateStateBehaviorOverride(entity.id, targetState.id, behavior.id, {
        ...JSON.parse(JSON.stringify(behavior)),
      });
    }
  };

  const handleUpdateOverride = (behaviorId: string, partial: BehaviorOverride) => {
    if (!targetState) return;
    updateStateBehaviorOverride(entity.id, targetState.id, behaviorId, partial);
  };

  const physicsBehavior = baseBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
  const hasGroundedPhysics = Boolean(
    physicsBehavior && physicsBehavior.enabled !== false && !physicsBehavior.isStatic
  );
  const hasFrozenRotation = Boolean(physicsBehavior?.freezeRotation);
  const effParentOffset = entity.parentId
    ? resolveEffectiveParentOffset(entity, targetState)
    : undefined;
  const hasPhysicsJointParent = Boolean(
    entity.parentId && effParentOffset?.attachmentMode === 'physics_joint'
  );

  const handleActivateGroundedPhysics = () => {
    if (physicsBehavior) {
      const updated = baseBehaviors.map((b) =>
        b.id === physicsBehavior.id
          ? ({
              ...b,
              enabled: true,
              isStatic: false,
              isTrigger: false,
              freezeRotation: true,
            } as PhysicsBehaviorConfig)
          : b
      );
      updateEntityBehaviors(entity.id, updated);
    } else {
      const newPhys = {
        ...createDefaultBehaviorConfig('physics', entity),
        enabled: true,
        isStatic: false,
        isTrigger: false,
        freezeRotation: true,
      } as PhysicsBehaviorConfig;
      updateEntityBehaviors(entity.id, [...baseBehaviors, newPhys]);
    }
  };

  const buildBehaviorMenuItems = (): FloatingContextMenuItem[] => {
    if (!behaviorContextMenu) return [];
    const { behavior, hasOverride, isEffectiveEnabled } = behaviorContextMenu;
    const canPasteSameType = Boolean(
      copiedBehavior && copiedBehavior.behavior.type === behavior.type
    );
    return [
      {
        id: 'copy',
        label: hasOverride ? `Copier (${targetState?.name})` : 'Copier ce composant',
        icon: <Copy className="w-3.5 h-3.5 text-indigo-600" />,
        onSelect: () => {
          if (copyEntityBehavior(entity.id, behavior.id, hasOverride ? targetState?.id : undefined)) {
            triggerFeedback(behavior.id, 'copied');
          }
        },
      },
      {
        id: 'paste_values',
        label: canPasteSameType
          ? `Coller valeurs (${copiedBehavior?.sourceEntityName})`
          : 'Coller valeurs (type différent)',
        icon: <ClipboardPaste className="w-3.5 h-3.5 text-indigo-600" />,
        disabled: !canPasteSameType,
        onSelect: () => {
          if (
            pasteBehaviorToEntity(
              entity.id,
              behavior.id,
              hasOverride ? targetState?.id : undefined
            )
          ) {
            triggerFeedback(behavior.id, 'pasted');
          }
        },
      },
      ...(copiedBehavior
        ? [
            {
              id: 'paste_new',
              label: `Ajouter copie de « ${getBehaviorTitle(copiedBehavior.behavior.type)} »`,
              icon: <Plus className="w-3.5 h-3.5 text-emerald-600" />,
              onSelect: () => {
                pasteBehaviorToEntity(entity.id);
              },
            } as FloatingContextMenuItem,
          ]
        : []),
      {
        id: 'toggle',
        label: isEffectiveEnabled ? 'Désactiver le composant' : 'Activer le composant',
        icon: <Power className="w-3.5 h-3.5 text-slate-600" />,
        dividerBefore: true,
        onSelect: () => {
          if (hasOverride) {
            handleUpdateOverride(behavior.id, { enabled: !isEffectiveEnabled });
          } else {
            handleUpdateBaseBehavior(behavior.id, { enabled: !isEffectiveEnabled });
          }
        },
      },
      {
        id: 'reset',
        label: 'Réinitialiser par défaut',
        icon: <RotateCcw className="w-3.5 h-3.5 text-amber-600" />,
        onSelect: () => resetEntityBehavior(entity.id, behavior.id),
      },
      {
        id: 'delete',
        label: 'Supprimer le composant',
        icon: <Trash2 className="w-3.5 h-3.5" />,
        danger: true,
        dividerBefore: true,
        onSelect: () => handleDeleteBehavior(behavior.id),
      },
    ];
  };

  return (
    <div className="space-y-3">
      {/* En-tête de section */}
      <div className="flex items-center justify-between gap-1.5 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Composants & Physique</span>
        </div>

        <div className="flex items-center gap-1.5">
          {copiedBehavior && (
            <button
              type="button"
              onClick={() => pasteBehaviorToEntity(entity.id)}
              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 flex items-center gap-1 px-2 py-1 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 cursor-pointer shadow-2xs transition-all active:scale-95 max-w-[145px]"
              title={`Coller « ${getBehaviorTitle(copiedBehavior.behavior.type)} » copié depuis ${copiedBehavior.sourceEntityName} comme nouveau composant`}
            >
              <ClipboardPaste className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">
                Coller {getBehaviorTitle(copiedBehavior.behavior.type)}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer shadow-2xs transition-all active:scale-95"
            title="Ajouter un composant à cet objet"
          >
            <Plus className="w-3.5 h-3.5" /> Ajouter
          </button>
        </div>
      </div>

      {/* Sélecteur d'état inspecté si plusieurs états existent */}
      {stateList.length > 1 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 shrink-0">
            État inspecté :
          </span>
          {stateList.map((st) => {
            const isTarget = st.id === activeStateId;
            const overrideCount = st.behaviorOverrides ? Object.keys(st.behaviorOverrides).length : 0;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStateId(st.id)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  isTarget
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{st.name}</span>
                {overrideCount > 0 && (
                  <span className={`text-[9px] px-1 rounded-full ${isTarget ? 'bg-indigo-400 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    {overrideCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste des Composants attachés (+ carte Hitbox & Collider par défaut) */}
      <div className="space-y-2">
        {baseBehaviors.map((behavior, behIdx) => {
          const cardKey = `${entity.id}:${behavior.id}`;
          const isExpanded =
            expandedBehaviorCards[cardKey] ?? (!hasAnyStoredCardForEntity && behIdx === 0);
          const overrides = targetState?.behaviorOverrides || {};
          const override = overrides[behavior.id];
          const hasOverride = Boolean(override);

          const isEffectiveEnabled =
            hasOverride && override?.enabled !== undefined ? override.enabled : behavior.enabled;

          return (
            <BehaviorCardRow
              key={behavior.id}
              entityId={entity.id}
              behavior={behavior}
              cardKey={cardKey}
              isExpanded={isExpanded}
              onToggleExpand={() => setBehaviorCardExpanded(cardKey, !isExpanded)}
              hasOverride={hasOverride}
              targetStateName={targetState?.name}
              isEffectiveEnabled={isEffectiveEnabled}
              copiedBehavior={copiedBehavior}
              justCopied={
                feedbackBadge?.behaviorId === behavior.id && feedbackBadge.kind === 'copied'
              }
              justPasted={
                feedbackBadge?.behaviorId === behavior.id && feedbackBadge.kind === 'pasted'
              }
              onCopy={() => {
                if (
                  copyEntityBehavior(
                    entity.id,
                    behavior.id,
                    hasOverride ? targetState?.id : undefined
                  )
                ) {
                  triggerFeedback(behavior.id, 'copied');
                }
              }}
              onPasteValues={() => {
                if (
                  pasteBehaviorToEntity(
                    entity.id,
                    behavior.id,
                    hasOverride ? targetState?.id : undefined
                  )
                ) {
                  triggerFeedback(behavior.id, 'pasted');
                }
              }}
              onToggleEnabled={(checked) => {
                if (hasOverride) {
                  handleUpdateOverride(behavior.id, { enabled: checked });
                } else {
                  handleUpdateBaseBehavior(behavior.id, { enabled: checked });
                }
              }}
              onDelete={() => handleDeleteBehavior(behavior.id)}
              onOpenContextMenu={(coords) =>
                setBehaviorContextMenu({
                  ...coords,
                  behavior,
                  hasOverride,
                  isEffectiveEnabled,
                })
              }
            >
              {/* Tiroir de Réglages du Composant */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                  {/* Ligne dédiée : Mention et action d'Override */}
                  <div
                    className={`p-2 rounded-xl flex items-center justify-between text-xs border ${
                      hasOverride
                        ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                        : 'bg-slate-100/80 border-slate-200 text-slate-600'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      {hasOverride ? (
                        <>
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          <span className="truncate">
                            <strong className="text-amber-950 font-bold">Override actif</strong> pour l'état{' '}
                            <strong className="text-amber-800 underline decoration-amber-400">
                              {targetState?.name}
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

                    {stateList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleToggleOverride(behavior)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-2 ${
                          hasOverride
                            ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-300 shadow-2xs'
                            : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-300 shadow-2xs'
                        }`}
                        title={
                          hasOverride
                            ? `Annuler l'override pour l'état ${targetState?.name} (revenir au composant partagé)`
                            : `Créer un override spécifique pour l'état ${targetState?.name}`
                        }
                      >
                        {hasOverride ? (
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

                  {/* Formulaire des attributs empilés ligne par ligne */}
                  {renderBehaviorControls({
                    entityId: entity.id,
                    stateId: hasOverride ? targetState?.id : undefined,
                    behavior,
                    override,
                    isOverridden: hasOverride,
                    onUpdateBase: (partial) => handleUpdateBaseBehavior(behavior.id, partial),
                    onUpdateOverride: (partial) => handleUpdateOverride(behavior.id, partial),
                    targetEntityOptions,
                    entityTypeOptions,
                    availableTags,
                    stateList,
                    customParticles,
                    onOpenParticleDrawer: (editingPreset) =>
                      setParticleEditorState({
                        behaviorId: behavior.id,
                        isOverridden: hasOverride,
                        initialView: 'draw_custom',
                        editingPreset,
                      }),
                    onOpenParticleEditor: (initialView) =>
                      setParticleEditorState({
                        behaviorId: behavior.id,
                        isOverridden: hasOverride,
                        initialView,
                      }),
                    onDeleteCustomParticle: (presetId) => {
                      deleteCustomParticle(presetId);
                      invalidateCustomParticleSprite(presetId);
                    },
                    onQuickCreateState: handleQuickCreateState,
                    onEditStateDrawing,
                    hasGroundedPhysics,
                    hasFrozenRotation,
                    hasPhysicsJointParent,
                    onActivateGroundedPhysics: handleActivateGroundedPhysics,
                  })}
                </div>
              )}
            </BehaviorCardRow>
          );
        })}

        {/* Carte par défaut : Hitbox & Collider (toujours présente dans Composants & Physique) */}
        <HitboxColliderCard
          entity={entity}
          entities={entities}
          targetState={targetState}
          stateList={stateList}
          activeStateId={activeStateId}
          isExpanded={Boolean(expandedBehaviorCards[`${entity.id}:__hitbox__`])}
          onToggleExpand={() =>
            setBehaviorCardExpanded(
              `${entity.id}:__hitbox__`,
              !Boolean(expandedBehaviorCards[`${entity.id}:__hitbox__`])
            )
          }
          updateEntityDetails={updateEntityDetails}
          updateStateProperties={updateStateProperties}
          onEditStateDrawing={onEditStateDrawing}
        />
      </div>

      {behaviorContextMenu && (
        <FloatingContextMenu
          x={behaviorContextMenu.x}
          y={behaviorContextMenu.y}
          title={getBehaviorTitle(behaviorContextMenu.behavior.type)}
          subtitle={entity.name}
          items={buildBehaviorMenuItems()}
          onClose={() => setBehaviorContextMenu(null)}
        />
      )}

      {/* Modal / Sélecteur d'Ajout de Composant */}
      <AddBehaviorModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAddBehavior={handleAddBehavior}
      />

      {/* Éditeur & Studio unifié de particules */}
      {particleEditorState && (() => {
        const base = baseBehaviors.find((bh) => bh.id === particleEditorState.behaviorId);
        if (!base || base.type !== 'particle_emitter') return null;
        const ov = particleEditorState.isOverridden
          ? targetState?.behaviorOverrides?.[base.id]
          : undefined;
        const effective = { ...base, ...(ov || {}) } as ParticleEmitterBehaviorConfig;
        return (
          <ParticleEditorModal
            isOpen={true}
            mode="emitter"
            initialView={particleEditorState.initialView}
            initialEditingPreset={particleEditorState.editingPreset}
            initialConfig={{
              shape: effective.shape || 'circle',
              customParticleId: effective.customParticleId,
              customParticleIds: effective.customParticleIds,
              customParticleMode: effective.customParticleMode,
              useParticleTint: effective.useParticleTint,
              color: effective.color || '#f59e0b',
              color2: effective.color2 || effective.color || '#ef4444',
              colorMode: effective.colorMode,
              rate: effective.rate ?? 14,
              rateMax: effective.rateMax,
              speed: effective.speed ?? 140,
              speedMax: effective.speedMax,
              size: effective.size ?? 6,
              sizeMax: effective.sizeMax,
              endSizeScale: effective.endSizeScale,
              lifetime: effective.lifetime ?? 0.8,
              lifetimeMax: effective.lifetimeMax,
              gravity: effective.gravity ?? 160,
              drag: effective.drag,
              opacityStart: effective.opacityStart,
              opacityEnd: effective.opacityEnd,
              spinSpeed: effective.spinSpeed,
              spread: effective.spread ?? 60,
              angle: effective.angle ?? -90,
              directionMode: effective.directionMode,
              directionTargetMode: effective.directionTargetMode,
              directionTargetEntityId: effective.directionTargetEntityId,
              directionTargetEntityType: effective.directionTargetEntityType,
              directionTargetTag: effective.directionTargetTag,
              offsetX: effective.offsetX ?? 0,
              offsetY: effective.offsetY ?? 0,
              anchor: effective.anchor,
              followRotation: effective.followRotation,
              emissionShape: effective.emissionShape,
              emissionRadius: effective.emissionRadius,
              emissionWidth: effective.emissionWidth,
              emissionHeight: effective.emissionHeight,
              emitterDuration: effective.emitterDuration,
              emitterLoop: effective.emitterLoop,
              initialBurstCount: effective.initialBurstCount,
              burstInterval: effective.burstInterval,
              burstCount: effective.burstCount,
            }}
            onApply={(cfg) => {
              const patch: Partial<ParticleEmitterBehaviorConfig> = {
                shape: cfg.shape,
                customParticleId: cfg.shape === 'custom' ? (cfg.customParticleIds?.[0] || cfg.customParticleId) : undefined,
                customParticleIds: cfg.shape === 'custom' ? cfg.customParticleIds : undefined,
                customParticleMode: cfg.shape === 'custom' ? cfg.customParticleMode : undefined,
                useParticleTint: cfg.shape === 'custom' ? Boolean(cfg.useParticleTint) : undefined,
                color: cfg.color,
                color2: cfg.color2,
                colorMode: cfg.colorMode,
                rate: cfg.rate ?? 14,
                rateMax: cfg.rateMax,
                speed: cfg.speed,
                speedMax: cfg.speedMax,
                size: cfg.size,
                sizeMax: cfg.sizeMax,
                endSizeScale: cfg.endSizeScale,
                lifetime: cfg.lifetime,
                lifetimeMax: cfg.lifetimeMax,
                gravity: cfg.gravity,
                drag: cfg.drag,
                opacityStart: cfg.opacityStart,
                opacityEnd: cfg.opacityEnd,
                spinSpeed: cfg.spinSpeed,
                spread: cfg.spread,
                angle: cfg.angle,
                directionMode: cfg.directionMode,
                directionTargetMode: cfg.directionTargetMode,
                directionTargetEntityId: cfg.directionTargetEntityId,
                directionTargetEntityType: cfg.directionTargetEntityType,
                directionTargetTag: cfg.directionTargetTag,
                offsetX: cfg.offsetX ?? 0,
                offsetY: cfg.offsetY ?? 0,
                anchor: cfg.anchor,
                followRotation: cfg.followRotation,
                emissionShape: cfg.emissionShape,
                emissionRadius: cfg.emissionRadius,
                emissionWidth: cfg.emissionWidth,
                emissionHeight: cfg.emissionHeight,
                emitterDuration: cfg.emitterDuration,
                emitterLoop: cfg.emitterLoop,
                initialBurstCount: cfg.initialBurstCount,
                burstInterval: cfg.burstInterval,
                burstCount: cfg.burstCount,
              };
              if (particleEditorState.isOverridden) {
                handleUpdateOverride(particleEditorState.behaviorId, patch);
              } else {
                handleUpdateBaseBehavior(particleEditorState.behaviorId, patch);
              }
              setParticleEditorState(null);
            }}
            onClose={() => setParticleEditorState(null)}
          />
        );
      })()}
    </div>
  );
}

export function renderBehaviorControls({
  entityId,
  stateId,
  behavior,
  override,
  isOverridden,
  onUpdateBase,
  onUpdateOverride,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  customParticles,
  onOpenParticleDrawer,
  onOpenParticleEditor,
  onDeleteCustomParticle,
  onQuickCreateState,
  onEditStateDrawing,
  hasGroundedPhysics,
  hasFrozenRotation,
  hasPhysicsJointParent,
  onActivateGroundedPhysics,
}: {
  entityId?: string;
  stateId?: string;
  behavior: EntityBehavior;
  override?: BehaviorOverride;
  isOverridden: boolean;
  onUpdateBase: (partial: Partial<EntityBehavior>) => void;
  onUpdateOverride: (partial: BehaviorOverride) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  customParticles: CustomParticlePreset[];
  onOpenParticleDrawer: (editingPreset?: CustomParticlePreset) => void;
  onOpenParticleEditor: (initialView?: 'studio' | 'draw_custom') => void;
  onDeleteCustomParticle: (presetId: string) => void;
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
  hasGroundedPhysics: boolean;
  hasFrozenRotation: boolean;
  hasPhysicsJointParent: boolean;
  onActivateGroundedPhysics: () => void;
}) {
  const update = (partial: any) => {
    if (isOverridden) {
      onUpdateOverride(partial);
    } else {
      onUpdateBase(partial);
    }
  };

  switch (behavior.type) {
    case 'draggable':
      return <DraggableBehaviorControls b={{ ...behavior, ...(override || {}) } as DraggableBehaviorConfig} update={update} />;
    case 'interactive_puppet':
      return (
        <InteractivePuppetControls
          behavior={{ ...behavior, ...(override || {}) } as InteractivePuppetBehaviorConfig}
          update={update}
          entityId={entityId}
          stateList={stateList}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'physics':
      return (
        <PhysicsBehaviorControls
          b={{ ...behavior, ...(override || {}) } as PhysicsBehaviorConfig}
          update={update}
          entityId={entityId}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'auto_destroy':
      return <AutoDestroyBehaviorControls b={{ ...behavior, ...(override || {}) } as AutoDestroyBehaviorConfig} update={update} />;
    case 'constant_velocity':
      return <ConstantVelocityBehaviorControls b={{ ...behavior, ...(override || {}) } as ConstantVelocityBehaviorConfig} update={update} />;
    case 'keyboard_control':
      return (
        <KeyboardControlBehaviorControls
          b={{ ...behavior, ...(override || {}) } as KeyboardControlBehaviorConfig}
          update={update}
          entityId={entityId}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'patrol':
      return (
        <PatrolBehaviorControls
          b={{ ...behavior, ...(override || {}) } as PatrolBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
          hasPhysics={hasGroundedPhysics}
          hasFrozenRotation={hasFrozenRotation}
          onActivateGroundedPhysics={onActivateGroundedPhysics}
        />
      );
    case 'wandering':
      return (
        <WanderingBehaviorControls
          b={{ ...behavior, ...(override || {}) } as WanderingBehaviorConfig}
          update={update}
          entityId={entityId}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
          hasPhysics={hasGroundedPhysics}
          hasFrozenRotation={hasFrozenRotation}
          onActivateGroundedPhysics={onActivateGroundedPhysics}
        />
      );
    case 'move_to':
      return (
        <MoveToBehaviorControls
          b={{ ...behavior, ...(override || {}) } as MoveToBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
        />
      );
    case 'look_at':
      return (
        <LookAtBehaviorControls
          b={{ ...behavior, ...(override || {}) } as LookAtBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
        />
      );
    case 'follow':
      return (
        <FollowBehaviorControls
          b={{ ...behavior, ...(override || {}) } as FollowBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
          hasPhysics={hasGroundedPhysics}
          hasFrozenRotation={hasFrozenRotation}
          onActivateGroundedPhysics={onActivateGroundedPhysics}
        />
      );
    case 'flee':
      return (
        <FleeBehaviorControls
          b={{ ...behavior, ...(override || {}) } as FleeBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'boundary_behavior':
      return (
        <BoundaryBehaviorControls
          b={{ ...behavior, ...(override || {}) } as BoundaryBehaviorConfig}
          update={update}
          entityId={entityId}
        />
      );
    case 'particle_emitter':
      return (
        <ParticleEmitterBehaviorControls
          b={{ ...behavior, ...(override || {}) } as ParticleEmitterBehaviorConfig}
          update={update}
          customParticles={customParticles}
          onOpenParticleDrawer={onOpenParticleDrawer}
          onOpenParticleEditor={onOpenParticleEditor}
          onDeleteCustomParticle={onDeleteCustomParticle}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
        />
      );
    case 'health':
      return (
        <HealthBehaviorControls
          b={{ ...behavior, ...(override || {}) } as HealthBehaviorConfig}
          update={update}
          entityId={entityId}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'jiggle':
      return (
        <JiggleBehaviorControls
          b={{ ...behavior, ...(override || {}) } as JiggleBehaviorConfig}
          update={update}
          hasPhysicsJointParent={hasPhysicsJointParent}
        />
      );
    case 'stroke_wiggle':
      return (
        <StrokeWiggleBehaviorControls
          b={{ ...behavior, ...(override || {}) } as StrokeWiggleBehaviorConfig}
          update={update}
          entityId={entityId}
        />
      );
    case 'slider':
      return <SliderBehaviorControls b={{ ...behavior, ...(override || {}) } as SliderBehaviorConfig} update={update} />;
    case 'rotate_drag':
      return <RotateDragBehaviorControls b={{ ...behavior, ...(override || {}) } as RotateDragBehaviorConfig} update={update} />;
    case 'snap':
      return (
        <SnapBehaviorControls
          b={{ ...behavior, ...(override || {}) } as SnapBehaviorConfig}
          update={update}
          entityId={entityId}
          behaviorId={behavior.id}
          stateId={stateId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
    case 'driven_animation':
      return (
        <DrivenAnimationBehaviorControls
          b={{ ...behavior, ...(override || {}) } as DrivenAnimationBehaviorConfig}
          update={update}
          entityId={entityId}
          targetEntityOptions={targetEntityOptions}
          entityTypeOptions={entityTypeOptions}
          availableTags={availableTags}
          stateList={stateList}
          onQuickCreateState={onQuickCreateState}
          onEditStateDrawing={onEditStateDrawing}
        />
      );
  }
}
