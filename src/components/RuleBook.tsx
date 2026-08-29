import { useState, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  TriggerType,
  TriggerPhase,
  ActionType,
  RuleAction,
  EntityType,
  DynamicRule,
  Entity,
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import {
  Plus,
  Trash2,
  Zap,
  ArrowRight,
  X,
  Volume2,
  Sparkles,
  MousePointer,
  ChevronRight,
  ChevronLeft,
  Check,
  Flame,
} from 'lucide-react';
import { soundSynth } from '../utils/sound';

type ActiveModal =
  | { type: 'subject'; ruleId: string; step: 1 | 2; selectedEntityType?: EntityType }
  | { type: 'target'; ruleId: string; step: 1 | 2; selectedEntityType?: EntityType }
  | { type: 'event'; ruleId: string }
  | {
      type: 'action';
      ruleId: string;
      actionIndex?: number; // undefined if adding a new action
      actionId?: string;
      step: 1 | 2 | 3;
      actionType?: ActionType;
      targetMode?: 'subject' | 'target';
    }
  | null;

export function RuleBook() {
  const entities = useSceneStore((state) => state.entities);
  const rules = useSceneStore((state) => state.rules);
  const addRule = useSceneStore((state) => state.addRule);
  const updateRule = useSceneStore((state) => state.updateRule);
  const deleteRule = useSceneStore((state) => state.deleteRule);
  const toggleRule = useSceneStore((state) => state.toggleRule);

  const [filterType, setFilterType] = useState<'all' | 'collision' | 'click'>('all');
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  const entityList = Object.values(entities);

  // Available entity options (archetypes & custom)
  const availableEntityOptions: { type: EntityType; label: string; icon?: string }[] = [
    { type: 'apple', label: 'Pomme' },
    { type: 'plant', label: 'Plante' },
    { type: 'custom', label: 'Étoile' },
  ];

  // Include any user-drawn custom types
  entityList.forEach((e) => {
    if (
      e.type !== 'apple' &&
      e.type !== 'plant' &&
      e.type !== 'custom' &&
      !availableEntityOptions.some((opt) => opt.type === e.type)
    ) {
      availableEntityOptions.push({
        type: e.type,
        label: e.name,
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
        subjectType: 'apple',
        targetMode: 'type',
        targetType: 'plant',
      },
      actions: [
        {
          id: `act-${Date.now()}`,
          type: 'change_state',
          targetMode: 'target',
          targetType: 'plant',
          targetStateId: 'fleur',
        },
      ],
    });

    // Automatically open step 1 for the newly created rule's subject
    setActiveModal({
      type: 'subject',
      ruleId: newId,
      step: 1,
      selectedEntityType: 'apple',
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
        const actionIdx = targetRule.actions.findIndex((a) => a.id === actionId);
        if (actionIdx !== -1) {
          const updatedActions = [...targetRule.actions];
          if (data.kind === 'entity-state') {
            updatedActions[actionIdx] = {
              ...updatedActions[actionIdx],
              type: 'change_state',
              targetStateId: data.stateId,
            };
            updateRule(ruleId, { actions: updatedActions });
          }
        }
      }
    } catch (err) {
      console.error('Error on slot drop:', err);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (filterType === 'collision') return r.trigger.type === 'collision';
    if (filterType === 'click') return r.trigger.type === 'click';
    return true;
  });

  return (
    <div className="flex flex-col h-full space-y-4 text-slate-800 relative">
      {/* Top Header & Filter Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/80 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/90 text-xs font-bold">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Toutes ({rules.length})
            </button>
            <button
              onClick={() => setFilterType('collision')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'collision'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              💥 Collisions
            </button>
            <button
              onClick={() => setFilterType('click')}
              className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                filterType === 'click'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              👆 Clics
            </button>
          </div>
        </div>

        <button
          onClick={handleCreateNewRule}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-xs transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
        >
          <Plus className="w-4 h-4" /> Nouvelle Règle
        </button>
      </div>

      {/* Rules List - Direct Card Manipulator without internal scrolling issues */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredRules.length === 0 ? (
          <div
            onClick={handleCreateNewRule}
            className="p-8 text-center bg-slate-50 hover:bg-slate-100/80 rounded-3xl border-2 border-dashed border-slate-200 hover:border-slate-400 text-slate-400 space-y-3 cursor-pointer transition-all group"
          >
            <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 mx-auto flex items-center justify-center text-slate-400 group-hover:text-slate-900 group-hover:scale-110 transition-all shadow-xs">
              <Plus className="w-6 h-6" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-700">Créer une règle interactive</div>
              <p className="text-xs text-slate-400 max-w-xs mx-auto mt-0.5">
                Cliquez pour ajouter une règle et touchez directement les cases pour configurer chaque étape.
              </p>
            </div>
          </div>
        ) : (
          filteredRules.map((rule) => {
            const isCollision = rule.trigger.type === 'collision';

            // Find subject display info
            const subjectType = rule.trigger.subjectType || 'apple';
            const subjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
            const subjectEntity = entityList.find((e) => e.type === subjectType);
            const subjectStateName = rule.trigger.subjectStateId
              ? subjectEntity?.states[rule.trigger.subjectStateId]?.name || rule.trigger.subjectStateId
              : 'Tous les états';

            // Find target display info
            const targetType = rule.trigger.targetType || 'plant';
            const targetOpt = availableEntityOptions.find((o) => o.type === targetType);
            const targetEntity = entityList.find((e) => e.type === targetType);
            const targetStateName = rule.trigger.targetStateId
              ? targetEntity?.states[rule.trigger.targetStateId]?.name || rule.trigger.targetStateId
              : 'Tous les états';

            // Event badge info
            let eventName = 'Contact';
            let eventIcon = '💥';
            if (rule.trigger.type === 'click') {
              eventName = 'Clic';
              eventIcon = '👆';
              if (rule.trigger.phase === 'mouse_down') {
                eventName = 'Appui';
                eventIcon = '✋';
              } else if (rule.trigger.phase === 'mouse_up') {
                eventName = 'Relâcher';
                eventIcon = '👋';
              }
            } else if (rule.trigger.type === 'collision') {
              if (rule.trigger.phase === 'release') {
                eventName = 'Séparation';
                eventIcon = '💨';
              } else if (rule.trigger.phase === 'stay') {
                eventName = 'Pendant';
                eventIcon = '⏳';
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
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Désactivée'}
                    </button>

                    <button
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
                      className="w-14 h-32 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-2 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group"
                      title="Cliquer pour changer le type d'événement"
                    >
                      <span className="text-[8px] font-bold text-slate-400 uppercase">Événement</span>
                      <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-base">
                        {eventIcon}
                      </div>
                      <div className="text-[10px] font-black uppercase tracking-tight text-amber-300 truncate w-full">
                        {eventName}
                      </div>
                    </button>

                    {/* CASE 3: CIBLE (Si Collision) */}
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

                  {/* Storyboard Direction Arrow */}
                  <div className="text-slate-400 shrink-0">
                    <ArrowRight className="w-5 h-5" strokeWidth={2.5} />
                  </div>

                  {/* --- 2. SÉQUENCE D'ACTIONS --- */}
                  <div className="flex items-center gap-2.5 shrink-0">
                    {rule.actions.map((act, actIdx) => {
                      let actTargetEntity = targetEntity;
                      let actTargetLabel = targetOpt?.label || 'Cible';
                      let actTargetType = targetType;

                      if (act.targetMode === 'subject') {
                        actTargetEntity = subjectEntity;
                        actTargetLabel = subjectOpt?.label || 'Sujet';
                        actTargetType = subjectType;
                      }

                      let actionTypeName = "Changer d'état";
                      if (act.type === 'delete_entity') actionTypeName = 'Détruire';
                      else if (act.type === 'play_sound') actionTypeName = 'Jouer un son';

                      let actionDetail = act.targetStateId || 'Fleur';
                      if (act.type === 'delete_entity') actionDetail = 'Disparaît';
                      else if (act.type === 'play_sound') actionDetail = `Son: ${act.soundType || 'magic'}`;

                      const actionSlotKey = `${rule.id}-act-${act.id}`;

                      return (
                        <div
                          key={act.id}
                          className="relative"
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot(actionSlotKey);
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => handleDropOnSlot(e, rule.id, 'action', act.id)}
                        >
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
                                targetMode: act.targetMode === 'subject' ? 'subject' : 'target',
                              })
                            }
                            className={`w-28 h-32 bg-white border rounded-2xl p-2.5 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group relative ${
                              dragOverSlot === actionSlotKey
                                ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                                : 'border-slate-200 hover:border-slate-400'
                            }`}
                          >
                            {/* Delete Action Button */}
                            {rule.actions.length > 1 && (
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  updateRule(rule.id, {
                                    actions: rule.actions.filter((a) => a.id !== act.id),
                                  });
                                }}
                                className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-100 hover:bg-rose-200 text-rose-600 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Supprimer cette action"
                              >
                                <X className="w-3 h-3" />
                              </div>
                            )}

                            <div className="text-[9px] font-bold text-slate-500 uppercase tracking-wider truncate w-full">
                              {actionTypeName}
                            </div>

                            {act.type === 'play_sound' ? (
                              <div className="w-11 h-11 rounded-2xl bg-amber-50 text-amber-600 border border-amber-200 flex items-center justify-center text-xl shadow-2xs">
                                🔊
                              </div>
                            ) : act.type === 'delete_entity' ? (
                              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 border border-rose-200 flex items-center justify-center text-xl shadow-2xs">
                                💥
                              </div>
                            ) : (
                              <EntityMiniPreview
                                entity={actTargetEntity}
                                type={actTargetType}
                                stateId={act.targetStateId}
                                size={44}
                              />
                            )}

                            <div className="w-full">
                              <div className="text-[11px] font-bold text-slate-800 truncate">
                                {act.targetMode === 'subject'
                                  ? `Sujet (${subjectOpt?.label || 'Objet'})`
                                  : `Cible (${targetOpt?.label || 'Objet'})`}
                              </div>
                              <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium truncate mt-0.5">
                                {actionDetail}
                              </div>
                            </div>
                          </button>
                        </div>
                      );
                    })}

                    {/* Quick + Action Card Button at the End */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'action',
                          ruleId: rule.id,
                          actionIndex: undefined,
                          step: 1,
                          actionType: 'change_state',
                          targetMode: 'target',
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
              const currentType = activeModal.selectedEntityType || (isSubject ? rule.trigger.subjectType : rule.trigger.targetType) || 'apple';
              const targetEntity = entityList.find((e) => e.type === currentType);

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
                          {activeModal.step === 1 ? 'Étape 1 sur 2 : Choisissez l’objet' : 'Étape 2 sur 2 : Choisissez l’état requis'}
                        </p>
                      </div>
                    </div>
                    <button
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
                          const ent = entityList.find((e) => e.type === opt.type);
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
                          <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shadow-2xs">
                            ⭐
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
                                <EntityMiniPreview entity={targetEntity} type={currentType} stateId={st.id} size={36} />
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
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={() => {
                        updateRule(rule.id, {
                          trigger: {
                            ...rule.trigger,
                            type: 'collision',
                            phase: 'enter',
                            targetType: rule.trigger.targetType || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        💥
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Contact / Collision</div>
                        <div className="text-xs text-slate-500">Quand l'objet entre en contact avec une cible</div>
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        👆
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Clic Souris / Pointeur</div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur clique sur l'objet</div>
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
                            targetType: rule.trigger.targetType || 'plant',
                          },
                        });
                        setActiveModal(null);
                      }}
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex items-center gap-3.5 text-left cursor-pointer transition-all group"
                    >
                      <div className="w-12 h-12 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                        💨
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-900">Fin de Contact / Séparation</div>
                        <div className="text-xs text-slate-500">Quand l'objet cesse de toucher la cible</div>
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

              const actionType = activeModal.actionType || 'change_state';
              const targetMode = activeModal.targetMode || 'target';

              const subjectType = rule.trigger.subjectType || 'apple';
              const targetType = rule.trigger.targetType || 'plant';
              const relevantType = targetMode === 'subject' ? subjectType : targetType;
              const relevantEntity = entityList.find((e) => e.type === relevantType);

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
                    targetType: relevantType,
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
                          {activeModal.step === 2 && 'Étape 2 : Sur quel objet appliquer la réaction ?'}
                          {activeModal.step === 3 && 'Étape 3 : Choisissez le nouvel état ou le son'}
                        </p>
                      </div>
                    </div>
                    <button
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
                          setActiveModal({
                            ...activeModal,
                            step: 2,
                            actionType: 'change_state',
                          });
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
                          <div className="text-xs text-slate-500">Supprimer l'objet de la scène</div>
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

                  {/* STEP 2: CHOOSE TARGET (SUBJECT OR TARGET) */}
                  {activeModal.step === 2 && (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            if (actionType === 'delete_entity') {
                              applyActionChange({
                                type: 'delete_entity',
                                targetMode: 'subject',
                              });
                            } else {
                              setActiveModal({
                                ...activeModal,
                                step: 3,
                                targetMode: 'subject',
                              });
                            }
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                        >
                          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                            <EntityMiniPreview type={subjectType} size={40} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Sujet Déclencheur</div>
                            <div className="text-[10px] text-slate-500 capitalize">{subjectType}</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            if (actionType === 'delete_entity') {
                              applyActionChange({
                                type: 'delete_entity',
                                targetMode: 'target',
                              });
                            } else {
                              setActiveModal({
                                ...activeModal,
                                step: 3,
                                targetMode: 'target',
                              });
                            }
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                        >
                          <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                            <EntityMiniPreview type={targetType} size={40} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-900">Cible Touchée</div>
                            <div className="text-[10px] text-slate-500 capitalize">{targetType}</div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* STEP 3: CHOOSE VALUE (STATE OR SOUND) */}
                  {activeModal.step === 3 && (
                    <div className="space-y-3">
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
                                    targetType: relevantType,
                                    targetStateId: st.id,
                                  });
                                }}
                                className="p-3.5 bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 hover:border-emerald-300 rounded-2xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all text-center group shadow-2xs"
                              >
                                <div className="w-14 h-14 rounded-xl bg-white border border-slate-200 flex items-center justify-center p-1 shadow-2xs">
                                  <EntityMiniPreview entity={relevantEntity} type={relevantType} stateId={st.id} size={40} />
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
