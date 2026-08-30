import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  TriggerType,
  TriggerPhase,
  ActionType,
  RuleAction,
  EntityType,
  DynamicRule,
  ActionTargetMode,
  SoundType,
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import {
  Plus,
  Trash2,
  Copy,
  Zap,
  ArrowRight,
  X,
  Sparkles,
  MousePointer,
  ChevronLeft,
  ChevronRight,
  Filter,
  Check,
  Volume2,
} from 'lucide-react';
import { soundSynth } from '../utils/sound';

type ActiveModal =
  | { type: 'subject'; ruleId: string; step: 1 | 2; selectedEntityType?: EntityType }
  | { type: 'target'; ruleId: string; step: 1 | 2; selectedEntityType?: EntityType }
  | { type: 'event'; ruleId: string }
  | {
      type: 'action';
      ruleId: string;
      actionIndex?: number;
      actionId?: string;
      step: 1 | 2 | 3;
      actionType?: ActionType;
      targetMode?: ActionTargetMode;
      selectedTargetType?: EntityType;
    }
  | null;

interface WizardData {
  step: 1 | 2 | 3 | 4 | 5; // 1: Sujet, 2: Event, 3: Cible, 4: Choix Action, 5: Détail Action
  name: string;
  subjectType: EntityType;
  subjectStateId?: string;
  triggerType: TriggerType;
  triggerPhase?: TriggerPhase;
  targetType: EntityType;
  targetStateId?: string;
  actionType?: ActionType;
  actionTargetMode?: ActionTargetMode;
  actionTargetType?: EntityType;
  actionTargetStateId?: string;
  actionSpawnEntityType?: EntityType;
  actionSpawnLocationMode?: 'at_subject' | 'at_target' | 'random' | 'absolute';
  actionSoundType?: SoundType;
}

export function RuleBook() {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const rules = useSceneStore((state) => state.rules);
  const addRule = useSceneStore((state) => state.addRule);
  const updateRule = useSceneStore((state) => state.updateRule);
  const deleteRule = useSceneStore((state) => state.deleteRule);
  const toggleRule = useSceneStore((state) => state.toggleRule);
  const duplicateRule = useSceneStore((state) => state.duplicateRule);

  const [filterType, setFilterType] = useState<'all' | 'collision' | 'click'>('all');
  const [filterObject, setFilterObject] = useState<string>('all');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeWizard, setActiveWizard] = useState<WizardData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const entityList = Object.values(entities);

  // Helper to find representative entity from canvas or archetype library
  const getEntityObj = (type?: string) => {
    if (!type) return undefined;
    return entityList.find((e) => e.type === type) || customArchetypes[type];
  };

  // Available entity options (archetypes & custom drawn only)
  const availableEntityOptions: { type: EntityType; label: string }[] = [];

  Object.entries(customArchetypes).forEach(([archetypeType, arch]) => {
    if (!availableEntityOptions.some((opt) => opt.type === archetypeType)) {
      availableEntityOptions.push({
        type: archetypeType,
        label: arch.name || archetypeType,
      });
    }
  });

  entityList.forEach((e) => {
    if (!availableEntityOptions.some((opt) => opt.type === e.type)) {
      availableEntityOptions.push({
        type: e.type,
        label: e.name || e.type,
      });
    }
  });

  // Start guided sequential wizard (Sujet > Event > Cible > Action)
  const startCreationWizard = () => {
    const defaultSub = availableEntityOptions[0]?.type || 'apple';
    const defaultTar = availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant';

    setActiveWizard({
      step: 1,
      name: `Règle #${rules.length + 1}`,
      subjectType: defaultSub,
      subjectStateId: undefined,
      triggerType: 'collision',
      triggerPhase: 'enter',
      targetType: defaultTar,
      targetStateId: undefined,
    });
  };

  const handleFinishWizard = (withAction = false) => {
    if (!activeWizard) return;

    const isCollision = activeWizard.triggerType === 'collision';
    const actions: RuleAction[] = [];

    if (withAction && activeWizard.actionType) {
      actions.push({
        id: `act-${Date.now()}`,
        type: activeWizard.actionType,
        targetMode: activeWizard.actionTargetMode || (isCollision ? 'target' : 'subject'),
        targetType: activeWizard.actionTargetType || (activeWizard.actionTargetMode === 'subject' ? activeWizard.subjectType : activeWizard.targetType),
        targetStateId: activeWizard.actionTargetStateId,
        spawnEntityType: activeWizard.actionSpawnEntityType,
        spawnLocationMode: activeWizard.actionSpawnLocationMode,
        soundType: activeWizard.actionSoundType,
      });
    }

    addRule({
      name: activeWizard.name,
      enabled: true,
      trigger: {
        type: activeWizard.triggerType,
        phase: activeWizard.triggerPhase,
        subjectMode: 'type',
        subjectType: activeWizard.subjectType,
        subjectStateId: activeWizard.subjectStateId,
        targetMode: isCollision ? 'type' : undefined,
        targetType: isCollision ? activeWizard.targetType : undefined,
        targetStateId: isCollision ? activeWizard.targetStateId : undefined,
      },
      actions,
    });

    setActiveWizard(null);
  };

  // Drag and drop handlers onto storyboard slots
  const handleDropOnSlot = (
    e: React.DragEvent,
    ruleId: string,
    slotType: 'subject' | 'target' | 'action',
    actionId?: string
  ) => {
    e.preventDefault();
    setDragOverSlot(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      const targetRule = rules.find((r) => r.id === ruleId);
      if (!targetRule) return;

      if (slotType === 'subject') {
        if (data.kind === 'entity-archetype') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              subjectType: data.entityType,
              subjectStateId: undefined,
            },
          });
        } else if (data.kind === 'entity-state') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              subjectType: data.entityType,
              subjectStateId: data.stateId,
            },
          });
        }
      } else if (slotType === 'target') {
        if (data.kind === 'entity-archetype') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              targetType: data.entityType,
              targetStateId: undefined,
            },
          });
        } else if (data.kind === 'entity-state') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              targetType: data.entityType,
              targetStateId: data.stateId,
            },
          });
        }
      } else if (slotType === 'action' && actionId) {
        if (data.kind === 'entity-state') {
          const updatedActions = targetRule.actions.map((act) =>
            act.id === actionId
              ? {
                  ...act,
                  type: 'change_state' as ActionType,
                  targetType: data.entityType,
                  targetStateId: data.stateId,
                }
              : act
          );
          updateRule(ruleId, { actions: updatedActions });
        }
      }
    } catch {
      // ignore drop errors
    }
  };

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    if (filterType !== 'all') {
      if (filterType === 'collision' && rule.trigger.type !== 'collision') return false;
      if (filterType === 'click' && rule.trigger.type !== 'click' && rule.trigger.type !== 'drag') return false;
    }
    if (filterObject !== 'all') {
      const matchSubject = rule.trigger.subjectType === filterObject;
      const matchTarget = rule.trigger.targetType === filterObject;
      const matchAction = rule.actions.some(
        (a) => a.targetType === filterObject || a.spawnEntityType === filterObject
      );
      if (!matchSubject && !matchTarget && !matchAction) return false;
    }
    return true;
  });

  return (
    <div className="bg-slate-50/80 rounded-3xl border border-slate-200 p-4 sm:p-5 flex flex-col h-full overflow-hidden text-slate-800 space-y-4">
      {/* Top Filter Bar */}
      <div className="flex items-center justify-between gap-2 flex-wrap border-b border-slate-200/80 pb-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Toutes ({rules.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterType('collision')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'collision'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Collisions
            </button>
            <button
              type="button"
              onClick={() => setFilterType('click')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'click'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Clics & Drag
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={filterObject}
              onChange={(e) => setFilterObject(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent pr-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="all">Tous les objets</option>
              {availableEntityOptions.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  Objet : {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Right: New Rule Button */}
        <button
          type="button"
          onClick={startCreationWizard}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Nouvelle règle</span>
        </button>
      </div>

      {/* Rules List (Storyboard Rows) */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredRules.length === 0 ? (
          <div
            onClick={startCreationWizard}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-3xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-2xl group-hover:scale-110 transition-transform mb-3">
              ⚡
            </div>
            <div className="text-sm font-bold text-slate-700">Créer une règle pas-à-pas</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
              Assistant guidé continu : Sujet → Événement → Cible → Action.
            </p>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isCollision = rule.trigger.type === 'collision';

            // Find subject display info
            const subjectType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
            const subjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
            const subjectEntity = getEntityObj(subjectType);
            const subjectStateName = rule.trigger.subjectStateId
              ? subjectEntity?.states[rule.trigger.subjectStateId]?.name || rule.trigger.subjectStateId
              : 'Tous les états';

            // Find target display info
            const targetType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';
            const targetOpt = availableEntityOptions.find((o) => o.type === targetType);
            const targetEntity = getEntityObj(targetType);
            const targetStateName = rule.trigger.targetStateId
              ? targetEntity?.states[rule.trigger.targetStateId]?.name || rule.trigger.targetStateId
              : 'Tous les états';

            // Event badge info
            let eventName = 'Contact';
            let eventIcon = '💥';
            let eventSub = 'Collision';
            if (rule.trigger.type === 'click') {
              eventName = 'Clic';
              eventIcon = '👆';
              eventSub = 'Sur l’objet';
              if (rule.trigger.phase === 'mouse_down') {
                eventName = 'Appui';
                eventIcon = '✋';
                eventSub = 'Enfoncé';
              } else if (rule.trigger.phase === 'mouse_up') {
                eventName = 'Relâcher';
                eventIcon = '👋';
                eventSub = 'Relâché';
              }
            } else if (rule.trigger.type === 'drag' || rule.trigger.phase === 'drag_release') {
              eventName = 'Relâcher';
              eventIcon = '🫳';
              eventSub = 'On Release';
            } else if (rule.trigger.type === 'collision') {
              if (rule.trigger.phase === 'collision_release') {
                eventName = 'Relâcher sur cible';
                eventIcon = '🎯';
                eventSub = 'On Release';
              } else if (rule.trigger.phase === 'release') {
                eventName = 'Séparation';
                eventIcon = '💨';
                eventSub = 'Fin contact';
              } else if (rule.trigger.phase === 'stay') {
                eventName = 'Pendant';
                eventIcon = '⏳';
                eventSub = 'Continu';
              }
            }

            const subjectSlotKey = `${rule.id}-subject`;
            const targetSlotKey = `${rule.id}-target`;

            return (
              <div
                key={rule.id}
                className={`p-4 rounded-3xl border transition-all shadow-2xs ${
                  rule.enabled
                    ? 'bg-white border-slate-200/90 hover:border-slate-300'
                    : 'bg-slate-50/70 border-slate-200/50 opacity-60'
                }`}
              >
                {/* Rule Header Bar */}
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={rule.name}
                    onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                    className="text-xs font-bold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none transition-colors max-w-xs"
                    placeholder="Nom de la règle..."
                  />

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Désactivée'}
                    </button>

                    {/* Dupliquer la règle */}
                    <button
                      type="button"
                      onClick={() => duplicateRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Dupliquer cette règle"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {/* Supprimer la règle */}
                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer la règle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Horizontal Storyboard Flow */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
                  {/* --- 1. DÉCLENCHEUR SECTION --- */}
                  <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                    {/* CASE 1: SUJET */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'subject',
                          ruleId: rule.id,
                          step: 1,
                          selectedEntityType: subjectType,
                        })
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverSlot(subjectSlotKey);
                      }}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(e) => handleDropOnSlot(e, rule.id, 'subject')}
                      className={`w-28 h-32 bg-white border rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                        dragOverSlot === subjectSlotKey
                          ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title="Cliquer pour configurer l'objet ou glisser un élément ici"
                    >
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                        Sujet
                      </div>

                      <EntityMiniPreview
                        entity={subjectEntity}
                        type={subjectType}
                        stateId={rule.trigger.subjectStateId}
                        size={44}
                      />

                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {subjectOpt?.label || subjectType}
                        </div>
                        <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium truncate mt-0.5">
                          {subjectStateName}
                        </div>
                      </div>
                    </button>

                    {/* CASE 2: ÉVÉNEMENT */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'event',
                          ruleId: rule.id,
                        })
                      }
                      className="w-28 h-32 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group"
                      title="Cliquer pour changer le type d'événement"
                    >
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                        Événement
                      </span>
                      <div className="w-10 h-10 rounded-2xl bg-white/10 flex items-center justify-center text-xl shadow-inner group-hover:scale-105 transition-transform">
                        {eventIcon}
                      </div>
                      <div className="w-full">
                        <div className="text-xs font-black uppercase tracking-tight text-amber-300 truncate">
                          {eventName}
                        </div>
                        <div className="text-[9px] text-slate-400 truncate mt-0.5">
                          {eventSub}
                        </div>
                      </div>
                    </button>

                    {/* CASE 3: CIBLE (Seulement si Collision) */}
                    {isCollision && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            type: 'target',
                            ruleId: rule.id,
                            step: 1,
                            selectedEntityType: targetType,
                          })
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlot(targetSlotKey);
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => handleDropOnSlot(e, rule.id, 'target')}
                        className={`w-28 h-32 bg-white border rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                          dragOverSlot === targetSlotKey
                            ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        title="Cliquer pour configurer la cible touchée ou glisser un élément ici"
                      >
                        <div className="text-[9px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                          Cible touchée
                        </div>

                        <EntityMiniPreview
                          entity={targetEntity}
                          type={targetType}
                          stateId={rule.trigger.targetStateId}
                          size={44}
                        />

                        <div className="w-full">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {targetOpt?.label || targetType}
                          </div>
                          <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium truncate mt-0.5">
                            {targetStateName}
                          </div>
                        </div>
                      </button>
                    )}
                  </div>

                  {/* Connecteur Arrow */}
                  <div className="text-slate-400 flex items-center justify-center shrink-0">
                    <ArrowRight className="w-5 h-5 text-indigo-500" strokeWidth={2.5} />
                  </div>

                  {/* --- 2. ACTIONS SÉQUENCE --- */}
                  <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                    {rule.actions.map((act, actIdx) => {
                      const actTargetMode = act.targetMode || 'target';
                      const actTargetType =
                        actTargetMode === 'subject'
                          ? subjectType
                          : actTargetMode === 'target'
                          ? targetType
                          : act.targetType || targetType;

                      const actEntity = getEntityObj(actTargetType);
                      const actStateObj = actEntity && act.targetStateId ? actEntity.states[act.targetStateId] : null;

                      let actionBadge = 'Action';
                      let actionDetail = 'Exécuter';

                      if (act.type === 'change_state') {
                        actionBadge = "Changer d'état";
                        actionDetail = actStateObj?.name ? `Devient ${actStateObj.name}` : `État ${act.targetStateId || '...'}`;
                      } else if (act.type === 'delete_entity') {
                        actionBadge = 'Détruire';
                        actionDetail = 'Faire disparaître';
                      } else if (act.type === 'spawn_entity') {
                        actionBadge = 'Créer Entité';
                        const locLabel =
                          act.spawnLocationMode === 'at_subject'
                            ? 'Sur Sujet'
                            : act.spawnLocationMode === 'at_target'
                            ? 'Sur Cible'
                            : act.spawnLocationMode === 'random'
                            ? 'Aléatoire'
                            : 'Centre';
                        actionDetail = `+ ${act.spawnEntityType || 'Objet'} (${locLabel})`;
                      } else if (act.type === 'play_sound') {
                        actionBadge = 'Jouer Son';
                        actionDetail = act.soundType ? `Son ${act.soundType}` : 'Effet sonore';
                      }

                      const actionSlotKey = `${rule.id}-act-${act.id}`;

                      return (
                        <div key={act.id} className="relative group">
                          {/* Remove Action Button */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const updatedActions = rule.actions.filter((_, idx) => idx !== actIdx);
                              updateRule(rule.id, { actions: updatedActions });
                            }}
                            className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                            title="Supprimer cette action"
                          >
                            <X className="w-3 h-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              setActiveModal({
                                type: 'action',
                                ruleId: rule.id,
                                actionIndex: actIdx,
                                actionId: act.id,
                                step: 1,
                                actionType: act.type,
                                targetMode: act.targetMode || 'target',
                              })
                            }
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverSlot(actionSlotKey);
                            }}
                            onDragLeave={() => setDragOverSlot(null)}
                            onDrop={(e) => handleDropOnSlot(e, rule.id, 'action', act.id)}
                            className={`w-28 h-32 bg-white border rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                              dragOverSlot === actionSlotKey
                                ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                                : 'border-slate-200 hover:border-slate-400'
                            }`}
                            title="Cliquer pour modifier cette action ou glisser un état ici"
                          >
                            <div className="text-[9px] font-bold text-indigo-600 uppercase tracking-wider">
                              {actionBadge}
                            </div>

                            {act.type === 'delete_entity' ? (
                              <div className="w-11 h-11 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-xl shadow-2xs">
                                💥
                              </div>
                            ) : act.type === 'play_sound' ? (
                              <div className="w-11 h-11 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-xl shadow-2xs">
                                🔊
                              </div>
                            ) : act.type === 'spawn_entity' ? (
                              <div className="relative">
                                <EntityMiniPreview
                                  entity={getEntityObj(act.spawnEntityType || 'custom')}
                                  type={act.spawnEntityType || 'custom'}
                                  size={44}
                                />
                                <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs text-[10px]">
                                  ✨
                                </div>
                              </div>
                            ) : (
                              <EntityMiniPreview
                                entity={actEntity}
                                type={actTargetType}
                                stateId={act.targetStateId}
                                size={44}
                              />
                            )}

                            <div className="w-full">
                              <div className="text-[11px] font-bold text-slate-800 truncate">
                                {act.type === 'spawn_entity'
                                  ? `Créer ${act.spawnEntityType || 'Objet'}`
                                  : act.targetMode === 'subject'
                                  ? `Sujet (${subjectOpt?.label || 'Objet'})`
                                  : act.targetMode === 'target'
                                  ? `Cible (${targetOpt?.label || 'Objet'})`
                                  : act.targetType || 'Objet'}
                              </div>
                              <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium truncate mt-0.5">
                                {actionDetail}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}

                    {/* + Action Slot Button */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'action',
                          ruleId: rule.id,
                          actionIndex: undefined,
                          step: 1,
                          actionType: 'change_state',
                          targetMode: isCollision ? 'target' : 'subject',
                        })
                      }
                      className="w-20 h-32 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                      title="Ajouter une action à la règle"
                    >
                      <Plus className="w-5 h-5" strokeWidth={2.5} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">+ Action</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- SEQUENTIAL CREATION WIZARD (Sujet > Event > Cible > Action) --- */}
      {activeWizard && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* Wizard Stepper Header */}
            <div className="border-b border-slate-100 pb-3 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-amber-500" />
                    <span>Créer une nouvelle règle</span>
                  </h3>
                  <p className="text-xs text-slate-500">
                    {activeWizard.step === 1 && 'Étape 1 sur 4 : Qui agit ? (Objet Sujet)'}
                    {activeWizard.step === 2 && 'Étape 2 sur 4 : Quel événement déclencheur ?'}
                    {activeWizard.step === 3 && 'Étape 3 sur 4 : Avec quel objet cible ?'}
                    {activeWizard.step === 4 && 'Étape 4 sur 4 : Quelle action exécuter ?'}
                    {activeWizard.step === 5 && 'Configuration de l’action choisie'}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveWizard(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Progress Steps Indicators */}
              <div className="grid grid-cols-4 gap-2 pt-1">
                {[
                  { num: 1, label: '1. Sujet' },
                  { num: 2, label: '2. Événement' },
                  { num: 3, label: '3. Cible' },
                  { num: 4, label: '4. Action' },
                ].map((st) => {
                  const isActive =
                    st.num === activeWizard.step || (activeWizard.step === 5 && st.num === 4);
                  const isDone = activeWizard.step > st.num;
                  return (
                    <div
                      key={st.num}
                      className={`py-1.5 px-2 rounded-xl text-[11px] font-bold text-center border transition-all ${
                        isActive
                          ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                          : isDone
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-slate-100 text-slate-400 border-slate-200'
                      }`}
                    >
                      {st.label}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* --- STEP 1: SUJET --- */}
            {activeWizard.step === 1 && (
              <div className="space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-700">Nom de la règle</label>
                  <input
                    type="text"
                    value={activeWizard.name}
                    onChange={(e) => setActiveWizard({ ...activeWizard, name: e.target.value })}
                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400"
                    placeholder="Nom de la règle..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Choisissez l'objet Sujet</label>
                  <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
                    {availableEntityOptions.map((opt) => {
                      const ent = getEntityObj(opt.type);
                      const isSelected = activeWizard.subjectType === opt.type;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() =>
                            setActiveWizard({
                              ...activeWizard,
                              subjectType: opt.type,
                              subjectStateId: undefined,
                            })
                          }
                          className={`p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                            <EntityMiniPreview entity={ent} type={opt.type} size={36} />
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate w-full text-center">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* State selector for subject */}
                {(() => {
                  const ent = getEntityObj(activeWizard.subjectType);
                  if (!ent || Object.keys(ent.states).length <= 1) return null;
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700">État requis du sujet (Optionnel)</label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, subjectStateId: undefined })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            activeWizard.subjectStateId === undefined
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          Tous les états
                        </button>
                        {Object.values(ent.states).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveWizard({ ...activeWizard, subjectStateId: st.id })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              activeWizard.subjectStateId === st.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            État {st.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Footer buttons */}
                <div className="flex justify-end pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, step: 2 })}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Étape suivante (Événement)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 2: ÉVÉNEMENT --- */}
            {activeWizard.step === 2 && (
              <div className="space-y-4">
                <div className="space-y-2.5 max-h-[55vh] overflow-y-auto pr-1">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'collision',
                        triggerPhase: 'enter',
                        step: 3,
                      })
                    }
                    className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      💥
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Collision : Premier Contact (On Enter)</div>
                      <div className="text-xs text-slate-500">Dès que le sujet touche une cible spécifique</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'collision',
                        triggerPhase: 'collision_release',
                        step: 3,
                      })
                    }
                    className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      🎯
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Collision : Au Relâchement (On Release)</div>
                      <div className="text-xs text-slate-500">Quand l'utilisateur glisse le sujet et le lâche sur la cible</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'click',
                        triggerPhase: 'click',
                        step: 4,
                      })
                    }
                    className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      👆
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Clic Direct sur l'Objet</div>
                      <div className="text-xs text-slate-500">Quand le joueur clique ou tape sur le sujet</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'drag',
                        triggerPhase: 'drag_release',
                        step: 4,
                      })
                    }
                    className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                  >
                    <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                      🫳
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">Glisser-Relâcher Libre (Drop)</div>
                      <div className="text-xs text-slate-500">Quand l'objet est relâché n'importe où</div>
                    </div>
                  </button>
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, step: 1 })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédent
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 3: CIBLE (Collision) --- */}
            {activeWizard.step === 3 && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-700">Choisissez la Cible touchée</label>
                  <div className="grid grid-cols-3 gap-3 max-h-48 overflow-y-auto pr-1">
                    {availableEntityOptions.map((opt) => {
                      const ent = getEntityObj(opt.type);
                      const isSelected = activeWizard.targetType === opt.type;
                      return (
                        <button
                          key={opt.type}
                          type="button"
                          onClick={() =>
                            setActiveWizard({
                              ...activeWizard,
                              targetType: opt.type,
                              targetStateId: undefined,
                            })
                          }
                          className={`p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                              : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                            <EntityMiniPreview entity={ent} type={opt.type} size={36} />
                          </div>
                          <span className="text-xs font-bold text-slate-800 truncate w-full text-center">
                            {opt.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* State selector for target */}
                {(() => {
                  const ent = getEntityObj(activeWizard.targetType);
                  if (!ent || Object.keys(ent.states).length <= 1) return null;
                  return (
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <label className="text-xs font-bold text-slate-700">État requis de la cible (Optionnel)</label>
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, targetStateId: undefined })}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                            activeWizard.targetStateId === undefined
                              ? 'bg-indigo-600 text-white border-indigo-600'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          Tous les états
                        </button>
                        {Object.values(ent.states).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => setActiveWizard({ ...activeWizard, targetStateId: st.id })}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                              activeWizard.targetStateId === st.id
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            État {st.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                <div className="flex justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, step: 2 })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédent
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, step: 4 })}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <span>Étape suivante (Action)</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 4: CHOIX DU TYPE D'ACTION (OU SANS ACTION) --- */}
            {activeWizard.step === 4 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Option 1: Changer d'état */}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        actionType: 'change_state',
                        step: 5,
                      })
                    }
                    className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center text-center gap-2 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                      🔄
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Changer d'état</div>
                      <div className="text-[10px] text-slate-500">Transformer l'objet ou sa cible</div>
                    </div>
                  </button>

                  {/* Option 2: Créer une entité (Spawn) */}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        actionType: 'spawn_entity',
                        actionSpawnEntityType: availableEntityOptions[0]?.type || 'apple',
                        actionSpawnLocationMode: 'at_target',
                        step: 5,
                      })
                    }
                    className="p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center text-center gap-2 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                      ✨
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Créer un objet</div>
                      <div className="text-[10px] text-slate-500">Faire apparaître une entité</div>
                    </div>
                  </button>

                  {/* Option 3: Détruire (Delete) */}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        actionType: 'delete_entity',
                        step: 5,
                      })
                    }
                    className="p-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-2xl flex flex-col items-center text-center gap-2 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                      💥
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Détruire un objet</div>
                      <div className="text-[10px] text-slate-500">Faire disparaître l'objet</div>
                    </div>
                  </button>

                  {/* Option 4: Jouer un son */}
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        actionType: 'play_sound',
                        actionSoundType: 'magic',
                        step: 5,
                      })
                    }
                    className="p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl flex flex-col items-center text-center gap-2 cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                      🔊
                    </div>
                    <div>
                      <div className="text-xs font-bold text-slate-900">Jouer un son</div>
                      <div className="text-[10px] text-slate-500">Déclencher un effet audio</div>
                    </div>
                  </button>
                </div>

                {/* Option "Sans action pour l'instant" */}
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveWizard({
                        ...activeWizard,
                        step: activeWizard.triggerType === 'collision' ? 3 : 2,
                      })
                    }
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédent
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinishWizard(false)}
                    className="px-4 py-2 text-indigo-600 hover:bg-indigo-50 border border-indigo-200 font-bold text-xs rounded-xl flex items-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Créer sans action (+ Action plus tard)</span>
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 5: CONFIGURATION DE L'ACTION CHOISIE --- */}
            {activeWizard.step === 5 && (
              <div className="space-y-4">
                {/* 1. Change state configuration */}
                {activeWizard.actionType === 'change_state' && (() => {
                  const isCollision = activeWizard.triggerType === 'collision';
                  const chosenTargetMode = activeWizard.actionTargetMode || (isCollision ? 'target' : 'subject');
                  const relevantType = chosenTargetMode === 'subject' ? activeWizard.subjectType : activeWizard.targetType;
                  const relevantEntity = getEntityObj(relevantType);

                  return (
                    <div className="space-y-3">
                      {isCollision && (
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveWizard({
                                ...activeWizard,
                                actionTargetMode: 'target',
                                actionTargetStateId: undefined,
                              })
                            }
                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              chosenTargetMode === 'target'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            Modifier la Cible
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveWizard({
                                ...activeWizard,
                                actionTargetMode: 'subject',
                                actionTargetStateId: undefined,
                              })
                            }
                            className={`flex-1 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              chosenTargetMode === 'subject'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-slate-100 text-slate-600 border-slate-200'
                            }`}
                          >
                            Modifier le Sujet
                          </button>
                        </div>
                      )}

                      <label className="text-xs font-bold text-slate-700 block">Choisissez l'état cible :</label>
                      <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-1">
                        {relevantEntity &&
                          Object.values(relevantEntity.states).map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() =>
                                setActiveWizard({
                                  ...activeWizard,
                                  actionTargetStateId: st.id,
                                })
                              }
                              className={`p-3 rounded-2xl border flex flex-col items-center gap-2 cursor-pointer transition-all ${
                                activeWizard.actionTargetStateId === st.id
                                  ? 'bg-indigo-50 border-indigo-500 ring-2 ring-indigo-200 shadow-xs'
                                  : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                              }`}
                            >
                              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                <EntityMiniPreview entity={relevantEntity} type={relevantType} stateId={st.id} size={36} />
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate w-full text-center">
                                Devenir "{st.name}"
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  );
                })()}

                {/* 2. Spawn entity configuration */}
                {activeWizard.actionType === 'spawn_entity' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Objet à créer :</label>
                    <div className="grid grid-cols-3 gap-2 max-h-36 overflow-y-auto pr-1">
                      {availableEntityOptions.map((opt) => {
                        const ent = getEntityObj(opt.type);
                        const isSelected = activeWizard.actionSpawnEntityType === opt.type;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() =>
                              setActiveWizard({
                                ...activeWizard,
                                actionSpawnEntityType: opt.type,
                              })
                            }
                            className={`p-2.5 rounded-2xl border flex flex-col items-center gap-1.5 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-200 shadow-xs'
                                : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                              <EntityMiniPreview entity={ent} type={opt.type} size={28} />
                            </div>
                            <span className="text-[11px] font-bold text-slate-800 truncate w-full text-center">
                              {opt.label}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <label className="text-xs font-bold text-slate-700 block pt-1">Où le faire apparaître :</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionSpawnLocationMode: 'at_subject',
                          })
                        }
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          activeWizard.actionSpawnLocationMode === 'at_subject'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        📍 Sur le Sujet
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionSpawnLocationMode: 'at_target',
                          })
                        }
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          activeWizard.actionSpawnLocationMode === 'at_target'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        🎯 Sur la Cible
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionSpawnLocationMode: 'random',
                          })
                        }
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          activeWizard.actionSpawnLocationMode === 'random'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        🎲 Aléatoire
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionSpawnLocationMode: 'absolute',
                          })
                        }
                        className={`p-2.5 rounded-xl border text-xs font-bold text-left transition-all cursor-pointer ${
                          activeWizard.actionSpawnLocationMode === 'absolute'
                            ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-2 ring-emerald-200'
                            : 'bg-slate-50 border-slate-200 text-slate-700'
                        }`}
                      >
                        🎯 Centre de l'écran
                      </button>
                    </div>
                  </div>
                )}

                {/* 3. Delete configuration */}
                {activeWizard.actionType === 'delete_entity' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Quel objet détruire ?</label>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionTargetMode: 'subject',
                          })
                        }
                        className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          activeWizard.actionTargetMode === 'subject'
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Détruire le Sujet</div>
                        <div className="text-[10px] text-rose-600">L'objet qui déclenche</div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            actionTargetMode: 'target',
                          })
                        }
                        className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                          activeWizard.actionTargetMode === 'target' || !activeWizard.actionTargetMode
                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-200'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">Détruire la Cible</div>
                        <div className="text-[10px] text-rose-600">L'objet touché</div>
                      </button>
                    </div>
                  </div>
                )}

                {/* 4. Play sound configuration */}
                {activeWizard.actionType === 'play_sound' && (
                  <div className="space-y-3">
                    <label className="text-xs font-bold text-slate-700 block">Effet sonore :</label>
                    <div className="grid grid-cols-3 gap-2.5">
                      {[
                        { id: 'magic', label: '✨ Magie' },
                        { id: 'pop', label: '🎈 Pop' },
                        { id: 'bell', label: '🔔 Cloche' },
                        { id: 'bounce', label: '🏀 Rebond' },
                        { id: 'laser', label: '⚡ Laser' },
                        { id: 'win', label: '🏆 Victoire' },
                      ].map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => {
                            soundSynth.play(s.id as any);
                            setActiveWizard({
                              ...activeWizard,
                              actionSoundType: s.id as any,
                            });
                          }}
                          className={`p-3 rounded-2xl border flex flex-col items-center justify-center gap-1 cursor-pointer transition-all shadow-2xs group ${
                            activeWizard.actionSoundType === s.id
                              ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                              : 'bg-slate-50 border-slate-200 hover:bg-amber-50/50'
                          }`}
                        >
                          <span className="text-xl group-hover:scale-110 transition-transform">
                            {s.label.split(' ')[0]}
                          </span>
                          <span className="text-xs font-bold text-slate-800">{s.label.split(' ')[1]}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, step: 4 })}
                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 font-bold text-xs rounded-xl flex items-center gap-1 cursor-pointer"
                  >
                    <ChevronLeft className="w-4 h-4" /> Précédent
                  </button>

                  <button
                    type="button"
                    onClick={() => handleFinishWizard(true)}
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
                  >
                    <Check className="w-4 h-4" />
                    <span>Créer la règle</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- DIRECT SLOT EDIT MODAL (Subject, Target, Event, Action) --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* 1. SUBJECT / TARGET SELECTOR */}
            {(activeModal.type === 'subject' || activeModal.type === 'target') && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isSubject = activeModal.type === 'subject';
              const currentType =
                activeModal.selectedEntityType ||
                (isSubject ? rule.trigger.subjectType : rule.trigger.targetType) ||
                availableEntityOptions[0]?.type ||
                'apple';
              const targetEntity = getEntityObj(currentType);

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      {activeModal.step === 2 && (
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, step: 1 })}
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer mr-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {isSubject ? 'Sélectionner le Sujet' : 'Sélectionner la Cible'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {activeModal.step === 1
                            ? 'Étape 1 sur 2 : Choisissez l’objet'
                            : 'Étape 2 sur 2 : Choisissez l’état requis'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {activeModal.step === 1 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-3 gap-3">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                setActiveModal({
                                  ...activeModal,
                                  step: 2,
                                  selectedEntityType: opt.type,
                                });
                              }}
                              className="p-3.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center gap-2 cursor-pointer transition-all shadow-2xs group"
                            >
                              <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-105 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={40} />
                              </div>
                              <span className="text-xs font-bold text-slate-800 truncate w-full text-center">
                                {opt.label}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {activeModal.step === 2 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (isSubject) {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  subjectType: currentType,
                                  subjectStateId: undefined,
                                },
                              });
                            } else {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  targetType: currentType,
                                  targetStateId: undefined,
                                },
                              });
                            }
                            setActiveModal(null);
                          }}
                          className="p-4 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                        >
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                            <EntityMiniPreview entity={targetEntity} type={currentType} size={36} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-800">Tous les états</div>
                            <div className="text-[10px] text-slate-400">Toujours actif</div>
                          </div>
                        </button>

                        {targetEntity &&
                          Object.values(targetEntity.states).map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                if (isSubject) {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      subjectType: currentType,
                                      subjectStateId: st.id,
                                    },
                                  });
                                } else {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      targetType: currentType,
                                      targetStateId: st.id,
                                    },
                                  });
                                }
                                setActiveModal(null);
                              }}
                              className="p-3.5 bg-slate-50 hover:bg-indigo-50/70 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                            >
                              <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                <EntityMiniPreview
                                  entity={targetEntity}
                                  type={currentType}
                                  stateId={st.id}
                                  size={36}
                                />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-800">État {st.name}</div>
                                <div className="text-[10px] text-indigo-600 font-semibold">Exiger cet état</div>
                              </div>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. EVENT SELECTOR */}
            {activeModal.type === 'event' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">Type d'Événement</h3>
                      <p className="text-xs text-slate-500">Quand cette règle doit-elle se déclencher ?</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5 max-h-[60vh] overflow-y-auto pr-1">
                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'collision',
                            phase: 'enter',
                            targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        💥
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Collision : Premier Contact (On Enter)</div>
                        <div className="text-xs text-slate-500">Quand l'objet touche une autre entité (Symétrique)</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'collision',
                            phase: 'collision_release',
                            targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        🎯
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Collision : Au Relâchement (On Release)</div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur relâche le sujet sur la cible touchée</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'collision',
                            phase: 'stay',
                            targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        ⏳
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Collision : Contact Continu (Stay)</div>
                        <div className="text-xs text-slate-500">Tant que les deux entités restent en contact</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'collision',
                            phase: 'release',
                            targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        💨
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Collision : Séparation / Sortie (Exit)</div>
                        <div className="text-xs text-slate-500">Quand l'objet cesse de toucher la cible</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'drag',
                            phase: 'drag_release',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        🫳
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Glisser : Au Relâchement Libre (Drop)</div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur relâche l'objet n'importe où</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'click',
                            phase: 'click',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-3.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        👆
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Clic Souris / Pointeur</div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur clique sur le sujet</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3. DIRECT ACTION MODAL */}
            {activeModal.type === 'action' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isCollision = rule.trigger.type === 'collision';
              const actionType = activeModal.actionType || 'change_state';
              const targetMode = activeModal.targetMode || (isCollision ? 'target' : 'subject');

              const subjectType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
              const targetType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';
              const chosenType = activeModal.selectedTargetType || (targetMode === 'subject' ? subjectType : targetType);

              const subjectEntity = getEntityObj(subjectType);
              const targetEntity = getEntityObj(targetType);
              const relevantEntity = getEntityObj(chosenType);
              const subjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
              const targetOpt = availableEntityOptions.find((o) => o.type === targetType);

              const applyActionChange = (finalActionData: Partial<RuleAction>) => {
                if (activeModal.actionIndex !== undefined) {
                  const updatedActions = [...rule.actions];
                  updatedActions[activeModal.actionIndex] = {
                    ...updatedActions[activeModal.actionIndex],
                    ...finalActionData,
                  };
                  updateRule(rule.id, { actions: updatedActions });
                } else {
                  const newAct: RuleAction = {
                    id: `act-${Date.now()}`,
                    type: actionType,
                    targetMode,
                    targetType: chosenType,
                    ...finalActionData,
                  };
                  updateRule(rule.id, { actions: [...rule.actions, newAct] });
                }
                setActiveModal(null);
              };

              return (
                <div className="space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      {activeModal.step > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveModal({
                              ...activeModal,
                              step: (activeModal.step - 1) as any,
                            })
                          }
                          className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer mr-1"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <div>
                        <h3 className="text-base font-bold text-slate-900">
                          {activeModal.actionIndex !== undefined ? "Modifier l'Action" : 'Nouvelle Action'}
                        </h3>
                        <p className="text-xs text-slate-500">
                          {activeModal.step === 1 && 'Étape 1 : Choisissez le type de réaction'}
                          {activeModal.step === 2 && 'Étape 2 : Choisissez l’objet concerné'}
                          {activeModal.step === 3 && 'Étape 3 : Choisissez le nouvel état ou l’effet'}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {activeModal.step === 1 && (
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            ...activeModal,
                            actionType: 'change_state',
                            step: isCollision ? 2 : 3,
                          })
                        }
                        className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                          🔄
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Changer d'état</div>
                          <div className="text-[10px] text-slate-500">Modifier l'apparence</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            ...activeModal,
                            actionType: 'spawn_entity',
                            step: 2,
                          })
                        }
                        className="p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                          ✨
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Créer un objet</div>
                          <div className="text-[10px] text-slate-500">Faire apparaître une entité</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            ...activeModal,
                            actionType: 'delete_entity',
                            step: isCollision ? 2 : 3,
                          })
                        }
                        className="p-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                          💥
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Détruire</div>
                          <div className="text-[10px] text-slate-500">Faire disparaître un objet</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            ...activeModal,
                            actionType: 'play_sound',
                            step: 3,
                          })
                        }
                        className="p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                      >
                        <div className="w-12 h-12 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl group-hover:scale-105 transition-transform">
                          🔊
                        </div>
                        <div>
                          <div className="text-xs font-bold text-slate-900">Jouer un son</div>
                          <div className="text-[10px] text-slate-500">Effet audio / Synthèse</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {activeModal.step === 2 && (
                    <div className="space-y-3">
                      {actionType === 'spawn_entity' ? (
                        <div className="grid grid-cols-3 gap-3">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  setActiveModal({
                                    ...activeModal,
                                    selectedTargetType: opt.type,
                                    step: 3,
                                  });
                                }}
                                className="p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                              >
                                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={40} />
                                </div>
                                <span className="text-xs font-bold text-slate-800 truncate w-full text-center">
                                  {opt.label}
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {isCollision && (
                            <button
                              type="button"
                              onClick={() => {
                                if (actionType === 'delete_entity') {
                                  applyActionChange({
                                    type: 'delete_entity',
                                    targetMode: 'target',
                                    targetType,
                                  });
                                } else {
                                  setActiveModal({
                                    ...activeModal,
                                    targetMode: 'target',
                                    selectedTargetType: targetType,
                                    step: 3,
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                            >
                              <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                <EntityMiniPreview entity={targetEntity} type={targetType} size={40} />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">La Cible touchée</div>
                                <div className="text-[10px] text-indigo-600 font-semibold">{targetOpt?.label}</div>
                              </div>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              if (actionType === 'delete_entity') {
                                applyActionChange({
                                  type: 'delete_entity',
                                  targetMode: 'subject',
                                  targetType: subjectType,
                                });
                              } else {
                                setActiveModal({
                                  ...activeModal,
                                  targetMode: 'subject',
                                  selectedTargetType: subjectType,
                                  step: 3,
                                });
                              }
                            }}
                            className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                          >
                            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                              <EntityMiniPreview entity={subjectEntity} type={subjectType} size={40} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">Le Sujet</div>
                              <div className="text-[10px] text-indigo-600 font-semibold">{subjectOpt?.label}</div>
                            </div>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {activeModal.step === 3 && (
                    <div className="space-y-3">
                      {actionType === 'spawn_entity' && (
                        <div className="space-y-2.5">
                          <p className="text-xs font-medium text-slate-600">Où faire apparaître l'objet ?</p>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => {
                                applyActionChange({
                                  type: 'spawn_entity',
                                  spawnEntityType: chosenType,
                                  spawnLocationMode: 'at_subject',
                                });
                              }}
                              className="p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-start gap-1 cursor-pointer transition-all text-left group shadow-2xs"
                            >
                              <div className="text-xs font-bold text-slate-900">📍 Sur le Sujet</div>
                              <div className="text-[10px] text-slate-500">
                                Position relative à l'objet qui déclenche
                              </div>
                            </button>

                            {isCollision && (
                              <button
                                type="button"
                                onClick={() => {
                                  applyActionChange({
                                    type: 'spawn_entity',
                                    spawnEntityType: chosenType,
                                    spawnLocationMode: 'at_target',
                                  });
                                }}
                                className="p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-start gap-1 cursor-pointer transition-all text-left group shadow-2xs"
                              >
                                <div className="text-xs font-bold text-slate-900">🎯 Sur la Cible</div>
                                <div className="text-[10px] text-slate-500">
                                  À l'emplacement précis de la cible touchée
                                </div>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                applyActionChange({
                                  type: 'spawn_entity',
                                  spawnEntityType: chosenType,
                                  spawnLocationMode: 'random',
                                });
                              }}
                              className="p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-start gap-1 cursor-pointer transition-all text-left group shadow-2xs"
                            >
                              <div className="text-xs font-bold text-slate-900">🎲 Aléatoire</div>
                              <div className="text-[10px] text-slate-500">
                                N'importe où sur l'espace visible
                              </div>
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                applyActionChange({
                                  type: 'spawn_entity',
                                  spawnEntityType: chosenType,
                                  spawnLocationMode: 'absolute',
                                });
                              }}
                              className="p-3.5 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-start gap-1 cursor-pointer transition-all text-left group shadow-2xs"
                            >
                              <div className="text-xs font-bold text-slate-900">🎯 Centre de l'écran</div>
                              <div className="text-[10px] text-slate-500">
                                À la position centrale du canevas
                              </div>
                            </button>
                          </div>
                        </div>
                      )}

                      {actionType === 'change_state' && (
                        <div className="grid grid-cols-2 gap-3">
                          {relevantEntity &&
                            Object.values(relevantEntity.states).map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  applyActionChange({
                                    type: 'change_state',
                                    targetMode,
                                    targetType: chosenType,
                                    targetStateId: st.id,
                                  });
                                }}
                                className="p-3.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                              >
                                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                  <EntityMiniPreview
                                    entity={relevantEntity}
                                    type={chosenType}
                                    stateId={st.id}
                                    size={40}
                                  />
                                </div>
                                <div>
                                  <div className="text-xs font-bold text-slate-800">État {st.name}</div>
                                  <div className="text-[10px] text-emerald-600 font-semibold">Devenir cet état</div>
                                </div>
                              </button>
                            ))}
                        </div>
                      )}

                      {actionType === 'play_sound' && (
                        <div className="grid grid-cols-3 gap-2.5">
                          {[
                            { id: 'magic', label: '✨ Magie' },
                            { id: 'pop', label: '🎈 Pop' },
                            { id: 'bell', label: '🔔 Cloche' },
                            { id: 'bounce', label: '🏀 Rebond' },
                            { id: 'laser', label: '⚡ Laser' },
                            { id: 'win', label: '🏆 Victoire' },
                          ].map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                soundSynth.play(s.id as any);
                                applyActionChange({
                                  type: 'play_sound',
                                  soundType: s.id as any,
                                });
                              }}
                              className="p-3 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-all shadow-2xs group"
                            >
                              <span className="text-xl group-hover:scale-110 transition-transform">
                                {s.label.split(' ')[0]}
                              </span>
                              <span className="text-xs font-bold text-slate-800">{s.label.split(' ')[1]}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
