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
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import {
  Plus,
  Trash2,
  Zap,
  ArrowRight,
  X,
  Sparkles,
  MousePointer,
  ChevronLeft,
  Filter,
  Check,
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

export function RuleBook() {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const rules = useSceneStore((state) => state.rules);
  const addRule = useSceneStore((state) => state.addRule);
  const updateRule = useSceneStore((state) => state.updateRule);
  const deleteRule = useSceneStore((state) => state.deleteRule);
  const toggleRule = useSceneStore((state) => state.toggleRule);

  const [filterType, setFilterType] = useState<'all' | 'collision' | 'click'>('all');
  const [filterObject, setFilterObject] = useState<string>('all');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const entityList = Object.values(entities);

  // Helper to find representative entity from canvas or archetype library
  const getEntityObj = (type?: string) => {
    if (!type) return undefined;
    return entityList.find((e) => e.type === type) || customArchetypes[type];
  };

  // Available entity options (archetypes & custom drawn only - no unsolicited demo objects)
  const availableEntityOptions: { type: EntityType; label: string }[] = [];

  // 1. Add all from customArchetypes
  Object.entries(customArchetypes).forEach(([archetypeType, arch]) => {
    if (!availableEntityOptions.some((opt) => opt.type === archetypeType)) {
      availableEntityOptions.push({
        type: archetypeType,
        label: arch.name || archetypeType,
      });
    }
  });

  // 2. Include any custom created entities from the active canvas
  entityList.forEach((e) => {
    if (!availableEntityOptions.some((opt) => opt.type === e.type)) {
      availableEntityOptions.push({
        type: e.type,
        label: e.name || e.type,
      });
    }
  });

  // Helper to create a new blank interactive rule directly
  const handleCreateNewRule = () => {
    const newId = addRule({
      name: `Règle #${rules.length + 1}`,
      enabled: true,
      trigger: {
        type: 'collision',
        phase: 'enter',
        subjectMode: 'type',
        subjectType: availableEntityOptions[0]?.type || 'apple',
        targetMode: 'type',
        targetType: availableEntityOptions[1]?.type || 'plant',
      },
      actions: [
        {
          id: `act-${Date.now()}`,
          type: 'change_state',
          targetMode: 'target',
          targetType: availableEntityOptions[1]?.type || 'plant',
          targetStateId: 'fleur',
        },
      ],
    });

    setActiveModal({
      type: 'subject',
      ruleId: newId,
      step: 1,
      selectedEntityType: availableEntityOptions[0]?.type || 'apple',
    });
  };

  // Drag and drop handlers onto slots
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
        const updatedActions = targetRule.actions.map((act) => {
          if (act.id !== actionId) return act;
          if (data.kind === 'entity-state') {
            return {
              ...act,
              type: 'change_state' as ActionType,
              targetType: data.entityType,
              targetStateId: data.stateId,
            };
          }
          return act;
        });
        updateRule(ruleId, { actions: updatedActions });
      }
    } catch (err) {
      console.error('Error in handleDropOnSlot:', err);
    }
  };

  // Filter rules by trigger type and by object
  const filteredRules = rules.filter((r) => {
    if (filterType !== 'all' && r.trigger.type !== filterType) return false;
    if (filterObject !== 'all') {
      const matchSubject = r.trigger.subjectType === filterObject;
      const matchTarget = r.trigger.targetType === filterObject;
      const matchAction = r.actions.some((a) => a.targetType === filterObject);
      if (!matchSubject && !matchTarget && !matchAction) return false;
    }
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4 overflow-hidden">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200 shrink-0">
        {/* Left: Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Trigger Type Filter */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Toutes
            </button>
            <button
              type="button"
              onClick={() => setFilterType('collision')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'collision'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              💥 Collisions
            </button>
            <button
              type="button"
              onClick={() => setFilterType('click')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'click'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              👆 Clics
            </button>
          </div>

          {/* Object Filter */}
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
          onClick={handleCreateNewRule}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer active:scale-95 shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Nouvelle règle</span>
        </button>
      </div>

      {/* Rules List (Horizontal Storyboard Rows) */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredRules.length === 0 ? (
          <div
            onClick={handleCreateNewRule}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-3xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] group"
          >
            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-2xl group-hover:scale-110 transition-transform mb-3">
              ⚡
            </div>
            <div className="text-sm font-bold text-slate-700">Créer une règle interactive</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
              Cliquez pour ajouter une règle et touchez directement les cases pour configurer chaque étape.
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

                    {/* CASE 2: ÉVÉNEMENT (Standard size w-28 h-32) */}
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

                    {/* Quick + Action Card Button */}
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
                      className="w-14 h-32 border-2 border-dashed border-slate-300 hover:border-slate-400 hover:bg-slate-50 rounded-2xl flex flex-col items-center justify-center gap-1.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer shrink-0"
                      title="Ajouter une action à la séquence"
                    >
                      <Plus className="w-5 h-5" strokeWidth={2.5} />
                      <span className="text-[9px] font-bold uppercase">Action</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* --- GUIDED STEP-BY-STEP MODAL / OVERLAY --- */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-lg w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            {/* 1. SUBJECT / TARGET SELECTOR (STEP 1 & 2) */}
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
                  {/* Modal Header */}
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

                  {/* STEP 1: CHOOSE OBJECT ARCHETYPE */}
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

                  {/* STEP 2: CHOOSE SPECIFIC STATE OR ANY */}
                  {activeModal.step === 2 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        {/* Option 1: Any State */}
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

                        {/* Specific States */}
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

            {/* 3. GUIDED ACTION BUILDER (STEP 1, 2, 3) */}
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
                  {/* Modal Header */}
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

                  {/* STEP 1: CHOOSE ACTION TYPE */}
                  {activeModal.step === 1 && (
                    <div className="space-y-2.5">
                      <button
                        type="button"
                        onClick={() => {
                          if (isCollision) {
                            setActiveModal({
                              ...activeModal,
                              step: 2,
                              actionType: 'change_state',
                            });
                          } else {
                            // If Click: directly target the Subject
                            setActiveModal({
                              ...activeModal,
                              step: 3,
                              actionType: 'change_state',
                              targetMode: 'subject',
                              selectedTargetType: subjectType,
                            });
                          }
                        }}
                        className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          🔄
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Changer d'état</div>
                          <div className="text-xs text-slate-500">
                            Faire évoluer un objet vers une autre forme (ex: fleurie, croquée...)
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModal({
                            ...activeModal,
                            step: 2,
                            actionType: 'spawn_entity',
                          });
                        }}
                        className="w-full p-4 bg-slate-50 hover:bg-emerald-50 border border-slate-200 hover:border-emerald-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          ✨
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Créer une entité (Instancier)</div>
                          <div className="text-xs text-slate-500">
                            Faire apparaître un nouvel objet sur la scène (relatif au sujet, à la cible, etc.)
                          </div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModal({
                            ...activeModal,
                            step: 2,
                            actionType: 'delete_entity',
                          });
                        }}
                        className="w-full p-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          💥
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Faire disparaître / Détruire</div>
                          <div className="text-xs text-slate-500">Supprimer un objet de la scène</div>
                        </div>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveModal({
                            ...activeModal,
                            step: 3,
                            actionType: 'play_sound',
                          });
                        }}
                        className="w-full p-4 bg-slate-50 hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                      >
                        <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                          🔊
                        </div>
                        <div>
                          <div className="text-sm font-bold text-slate-900">Jouer un son</div>
                          <div className="text-xs text-slate-500">Déclencher un effet sonore musical</div>
                        </div>
                      </button>
                    </div>
                  )}

                  {/* STEP 2: CHOOSE TARGET OBJECT OR SPAWN OBJECT */}
                  {activeModal.step === 2 && (
                    <div className="space-y-3">
                      {actionType === 'spawn_entity' ? (
                        <div className="space-y-3">
                          <p className="text-xs font-medium text-slate-600">Choisissez quel objet faire apparaître :</p>
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
                                      step: 3,
                                      actionType: 'spawn_entity',
                                      selectedTargetType: opt.type,
                                    });
                                  }}
                                  className="p-3.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center gap-2 cursor-pointer transition-all shadow-2xs group"
                                >
                                  <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
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
                      ) : (
                        <div className="grid grid-cols-2 gap-3">
                          {/* Option: Subject */}
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
                                  step: 3,
                                  targetMode: 'subject',
                                  selectedTargetType: subjectType,
                                });
                              }
                            }}
                            className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                          >
                            <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                              <EntityMiniPreview entity={subjectEntity} type={subjectType} size={40} />
                            </div>
                            <div>
                              <div className="text-xs font-bold text-slate-900">Sujet (Déclencheur)</div>
                              <div className="text-[10px] text-slate-500 capitalize">{subjectType}</div>
                            </div>
                          </button>

                          {/* Option: Target (if collision) */}
                          {isCollision && (
                            <button
                              type="button"
                              onClick={() => {
                                if (actionType === 'delete_entity') {
                                  applyActionChange({
                                    type: 'delete_entity',
                                    targetMode: 'target',
                                    targetType: targetType,
                                  });
                                } else {
                                  setActiveModal({
                                    ...activeModal,
                                    step: 3,
                                    targetMode: 'target',
                                    selectedTargetType: targetType,
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                            >
                              <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                <EntityMiniPreview entity={targetEntity} type={targetType} size={40} />
                              </div>
                              <div>
                                <div className="text-xs font-bold text-slate-900">Cible (Touchée)</div>
                                <div className="text-[10px] text-slate-500 capitalize">{targetType}</div>
                              </div>
                            </button>
                          )}

                          {/* Option: Other entity archetype on delete */}
                          {actionType === 'delete_entity' &&
                            availableEntityOptions
                              .filter((opt) => opt.type !== subjectType && (!isCollision || opt.type !== targetType))
                              .map((opt) => {
                                const ent = getEntityObj(opt.type);
                                return (
                                  <button
                                    key={opt.type}
                                    type="button"
                                    onClick={() => {
                                      applyActionChange({
                                        type: 'delete_entity',
                                        targetMode: 'type',
                                        targetType: opt.type,
                                      });
                                    }}
                                    className="p-4 bg-slate-50 hover:bg-rose-50 border border-slate-200 hover:border-rose-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                                  >
                                    <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                      <EntityMiniPreview entity={ent} type={opt.type} size={40} />
                                    </div>
                                    <div>
                                      <div className="text-xs font-bold text-slate-900">{opt.label}</div>
                                      <div className="text-[10px] text-rose-600 font-semibold">Détruire cet objet</div>
                                    </div>
                                  </button>
                                );
                              })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 3: CHOOSE VALUE (STATE, SOUND, OR SPAWN LOCATION) */}
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
                                Position relative à l'objet qui déclenche l'événement
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
                                N'importe où sur l'espace visible du canevas
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
                                À la position centrale de l'espace de jeu
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
