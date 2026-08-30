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
  ChevronLeft,
  ChevronRight,
  Filter,
  Volume2,
} from 'lucide-react';
import { soundSynth } from '../utils/sound';

type ActiveModal =
  | {
      type: 'subject';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
    }
  | {
      type: 'target';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
    }
  | { type: 'event'; ruleId: string }
  | {
      type: 'action';
      ruleId: string;
      actionIndex?: number;
      actionId?: string;
      subStep?:
        | 'main'
        | 'choose_state'
        | 'choose_third_party_entity'
        | 'choose_third_party_state'
        | 'choose_third_party_destroy'
        | 'choose_toggle_entity'
        | 'choose_toggle_states'
        | 'choose_spawn_entity'
        | 'choose_spawn_location'
        | 'choose_sound';
      actionType?: ActionType;
      targetMode?: ActionTargetMode;
      selectedTargetType?: EntityType;
      pendingSpawnType?: EntityType;
      toggleStateA?: string;
      toggleStateB?: string;
      spawnOffset?: { x: number; y: number };
      spawnAbsoluteCoords?: { x: number; y: number };
    }
  | null;

interface WizardData {
  step: 1 | 2 | 3 | 4; // 1: Sujet, 2: Event, 3: Cible, 4: Action
  subjectSubStep?: 'choose_object' | 'choose_state';
  targetSubStep?: 'choose_object' | 'choose_state';
  actionSubStep?:
    | 'main'
    | 'state_picker'
    | 'third_party_entity_picker'
    | 'third_party_state_picker'
    | 'spawn_entity_picker'
    | 'spawn_location_picker'
    | 'sound_picker';
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
  pendingSpawnType?: EntityType;
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
  const settings = useSceneStore((state) => state.settings);

  const [filterType, setFilterType] = useState<'all' | 'collision' | 'click'>('all');
  const [filterObject, setFilterObject] = useState<string>('all');
  const [showFiltersManual, setShowFiltersManual] = useState(false);
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

  // Check if filters should be displayed
  const areFiltersVisible = settings?.showRuleFilters || showFiltersManual;

  // Start guided sequential wizard (Sujet > Event > Cible > Action)
  const startCreationWizard = () => {
    const defaultSub = availableEntityOptions[0]?.type || 'apple';
    const defaultTar = availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant';

    setActiveWizard({
      step: 1,
      subjectSubStep: 'choose_object',
      name: `Règle #${rules.length + 1}`,
      subjectType: defaultSub,
      subjectStateId: undefined,
      triggerType: 'collision',
      triggerPhase: 'enter',
      targetType: defaultTar,
      targetStateId: undefined,
      actionSubStep: 'main',
    });
  };

  // Quick 1-click finalize wizard with an action
  const completeWizardWithAction = (actionData?: Partial<RuleAction>) => {
    if (!activeWizard) return;

    const isCollision = activeWizard.triggerType === 'collision';
    const actions: RuleAction[] = [];

    if (actionData && actionData.type) {
      actions.push({
        id: `act-${Date.now()}`,
        type: actionData.type,
        targetMode: actionData.targetMode || (isCollision ? 'target' : 'subject'),
        targetType: actionData.targetType || (actionData.targetMode === 'subject' ? activeWizard.subjectType : activeWizard.targetType),
        targetStateId: actionData.targetStateId,
        spawnEntityType: actionData.spawnEntityType,
        spawnLocationMode: actionData.spawnLocationMode || (isCollision ? 'at_target' : 'at_subject'),
        spawnSizeMode: actionData.spawnSizeMode || 'default',
        spawnCustomSize: actionData.spawnCustomSize,
        soundType: actionData.soundType,
      });
    }

    addRule({
      name: activeWizard.name,
      enabled: true,
      trigger: {
        type: activeWizard.triggerType,
        phase: activeWizard.triggerPhase || 'enter',
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
    if (!areFiltersVisible) return true;

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
      {/* Top Bar with Filter and New Rule */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200/80 pb-3 shrink-0">
        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-800 tracking-tight">
              Livre de Règles
            </span>
            <span className="text-xs font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
              {rules.length}
            </span>
          </div>

          {/* Bouton discret pour basculer les filtres si masqués par défaut */}
          {!settings?.showRuleFilters && (
            <button
              type="button"
              onClick={() => setShowFiltersManual(!showFiltersManual)}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showFiltersManual
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Afficher/masquer les filtres du livre de règles"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtres</span>
            </button>
          )}

          {/* Barre de filtres (Visible seulement si activée dans les settings ou dépliée manuellement) */}
          {areFiltersVisible && (
            <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-150">
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
                  Clics & Relâché
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
          )}
        </div>

        {/* Right: New Rule Button */}
        <button
          type="button"
          onClick={startCreationWizard}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Nouvelle règle</span>
        </button>
      </div>

      {/* Rules List (Storyboard Rows with Large Visual Cards) */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredRules.length === 0 ? (
          <div
            onClick={startCreationWizard}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-3xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] group"
          >
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-3xl group-hover:scale-110 transition-transform mb-3">
              ⚡
            </div>
            <div className="text-sm font-bold text-slate-800">Créer une règle en quelques clics rapides</div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              Grandes cartes illustrées : Sujet → Événement → Cible → Action.
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
                eventSub = 'Collision on Release';
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

                {/* Horizontal Storyboard Flow with Large Cards */}
                <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1">
                  {/* --- 1. DÉCLENCHEUR SECTION --- */}
                  <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                    {/* CASE 1: SUJET (Large Card) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'subject',
                          ruleId: rule.id,
                          subStep: 'choose_object',
                        })
                      }
                      onDragOver={(e) => {
                        e.preventDefault();
                        setDragOverSlot(subjectSlotKey);
                      }}
                      onDragLeave={() => setDragOverSlot(null)}
                      onDrop={(e) => handleDropOnSlot(e, rule.id, 'subject')}
                      className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                        dragOverSlot === subjectSlotKey
                          ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                          : 'border-slate-200 hover:border-slate-400'
                      }`}
                      title="Cliquer pour changer l'objet ou son état requis"
                    >
                      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                        Sujet
                      </div>

                      <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                        <EntityMiniPreview
                          entity={subjectEntity}
                          type={subjectType}
                          stateId={rule.trigger.subjectStateId}
                          size={48}
                        />
                      </div>

                      <div className="w-full">
                        <div className="text-xs font-bold text-slate-800 truncate">
                          {subjectOpt?.label || subjectType}
                        </div>
                        <div
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveModal({
                              type: 'subject',
                              ruleId: rule.id,
                              subStep: 'choose_state',
                              selectedEntityType: subjectType,
                            });
                          }}
                          className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer"
                          title="Cliquer pour changer l'état requis"
                        >
                          {subjectStateName}
                        </div>
                      </div>
                    </button>

                    {/* CASE 2: ÉVÉNEMENT (Large Card) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          type: 'event',
                          ruleId: rule.id,
                        })
                      }
                      className="w-32 h-36 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group"
                      title="Cliquer pour changer le type d'événement"
                    >
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                        Événement
                      </span>
                      <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
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
                            subStep: 'choose_object',
                          })
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlot(targetSlotKey);
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => handleDropOnSlot(e, rule.id, 'target')}
                        className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                          dragOverSlot === targetSlotKey
                            ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        title="Cliquer pour changer la cible ou son état requis"
                      >
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                          Cible touchée
                        </div>

                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                          <EntityMiniPreview
                            entity={targetEntity}
                            type={targetType}
                            stateId={rule.trigger.targetStateId}
                            size={48}
                          />
                        </div>

                        <div className="w-full">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {targetOpt?.label || targetType}
                          </div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModal({
                                type: 'target',
                                ruleId: rule.id,
                                subStep: 'choose_state',
                                selectedEntityType: targetType,
                              });
                            }}
                            className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer"
                            title="Cliquer pour changer l'état requis de la cible"
                          >
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
                        const targetLabel =
                          act.targetMode === 'subject'
                            ? 'Sujet'
                            : act.targetMode === 'target'
                            ? 'Cible'
                            : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                        actionDetail = `${targetLabel} → ${actStateObj?.name || 'État ' + (act.targetStateId || '...')}`;
                      } else if (act.type === 'delete_entity') {
                        actionBadge = 'Détruire';
                        const targetLabel =
                          act.targetMode === 'subject'
                            ? 'Sujet'
                            : act.targetMode === 'target'
                            ? 'Cible'
                            : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                        actionDetail = `Supprimer ${targetLabel}`;
                      } else if (act.type === 'spawn_entity') {
                        actionBadge = 'Créer Entité';
                        const locLabel =
                          act.spawnLocationMode === 'at_target'
                            ? 'Sur Cible'
                            : act.spawnLocationMode === 'at_subject'
                            ? 'Sur Sujet'
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
                                actionType: act.type,
                                targetMode: act.targetMode || 'target',
                                subStep: 'main',
                              })
                            }
                            onDragOver={(e) => {
                              e.preventDefault();
                              setDragOverSlot(actionSlotKey);
                            }}
                            onDragLeave={() => setDragOverSlot(null)}
                            onDrop={(e) => handleDropOnSlot(e, rule.id, 'action', act.id)}
                            className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                              dragOverSlot === actionSlotKey
                                ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                                : 'border-slate-200 hover:border-slate-400'
                            }`}
                            title="Cliquer pour modifier cette action"
                          >
                            <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                              {actionBadge}
                            </div>

                            {act.type === 'delete_entity' ? (
                              <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                💥
                              </div>
                            ) : act.type === 'play_sound' ? (
                              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                🔊
                              </div>
                            ) : act.type === 'spawn_entity' ? (
                              <div className="relative w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
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
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                                <EntityMiniPreview
                                  entity={actEntity}
                                  type={actTargetType}
                                  stateId={act.targetStateId}
                                  size={44}
                                />
                              </div>
                            )}

                            <div className="w-full">
                              <div className="text-[11px] font-bold text-slate-800 truncate">
                                {act.type === 'spawn_entity'
                                  ? `Créer ${act.spawnEntityType || 'Objet'}`
                                  : act.targetMode === 'subject'
                                  ? `Sujet (${subjectOpt?.label || 'Objet'})`
                                  : act.targetMode === 'target'
                                  ? `Cible (${targetOpt?.label || 'Objet'})`
                                  : actEntity?.name || act.targetType || 'Autre Objet'}
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
                          actionType: 'change_state',
                          targetMode: isCollision ? 'target' : 'subject',
                          subStep: 'main',
                        })
                      }
                      className="w-24 h-36 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                      title="Ajouter une action à la règle"
                    >
                      <Plus className="w-6 h-6" strokeWidth={2.5} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">+ Action</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ========================================================================= */}
      {/* 🪄 1-CLICK SEQUENTIAL CREATION WIZARD (Grandes Cartes, 1 Clic par Étape) */}
      {/* ========================================================================= */}
      {activeWizard && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-3xl w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header with Stepper */}
            <div className="border-b border-slate-100 pb-3 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeWizard.step > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeWizard.actionSubStep && activeWizard.actionSubStep !== 'main') {
                        setActiveWizard({ ...activeWizard, actionSubStep: 'main' });
                      } else if (activeWizard.step === 3 && activeWizard.targetSubStep === 'choose_state') {
                        setActiveWizard({ ...activeWizard, targetSubStep: 'choose_object' });
                      } else if (activeWizard.step === 1 && activeWizard.subjectSubStep === 'choose_state') {
                        setActiveWizard({ ...activeWizard, subjectSubStep: 'choose_object' });
                      } else {
                        const prevStep =
                          activeWizard.step === 4 && activeWizard.triggerType !== 'collision' ? 2 : activeWizard.step - 1;
                        setActiveWizard({
                          ...activeWizard,
                          step: prevStep as any,
                          actionSubStep: 'main',
                          subjectSubStep: 'choose_object',
                          targetSubStep: 'choose_object',
                        });
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                    title="Revenir à l'étape précédente"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span>
                      {activeWizard.step === 1 &&
                        (activeWizard.subjectSubStep === 'choose_state'
                          ? `Étape 1 : Quel état pour ${getEntityObj(activeWizard.subjectType)?.name || activeWizard.subjectType} ?`
                          : 'Étape 1 : Qui agit ? (Objet Sujet)')}
                      {activeWizard.step === 2 && 'Étape 2 : Quel événement déclencheur ?'}
                      {activeWizard.step === 3 &&
                        (activeWizard.targetSubStep === 'choose_state'
                          ? `Étape 3 : Quel état requis pour la cible ${getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType} ?`
                          : 'Étape 3 : Avec quel objet cible ?')}
                      {activeWizard.step === 4 && 'Étape 4 : Que doit-il se passer ? (Action)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliquez sur une grande carte pour passer instantanément à l'étape suivante.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveWizard(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Badges */}
            <div className="grid grid-cols-4 gap-2 shrink-0">
              {[
                { num: 1, label: '1. Sujet' },
                { num: 2, label: '2. Événement' },
                { num: 3, label: '3. Cible' },
                { num: 4, label: '4. Action' },
              ].map((st) => {
                const isActive = st.num === activeWizard.step;
                const isDone = activeWizard.step > st.num;
                return (
                  <div
                    key={st.num}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold text-center border transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {st.label}
                  </div>
                );
              })}
            </div>

            {/* --- BODY (Large Cards Grid) --- */}
            <div className="overflow-y-auto flex-1 pr-1 py-1">
              {/* ÉTAPE 1 : SUJET (Grandes Cartes) */}
              {activeWizard.step === 1 && (
                <div>
                  {activeWizard.subjectSubStep === 'choose_state' ? (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez si la règle requiert un état précis ou s'applique à tous les états :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* Option : Tous les états */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              subjectStateId: undefined,
                              subjectSubStep: 'choose_object',
                              step: 2,
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div className="text-center w-full">
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                              Tous les états
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">N'importe quelle apparence</div>
                          </div>
                        </button>

                        {/* Options : États spécifiques */}
                        {Object.values(getEntityObj(activeWizard.subjectType)?.states || {}).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setActiveWizard({
                                ...activeWizard,
                                subjectStateId: st.id,
                                subjectSubStep: 'choose_object',
                                step: 2,
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview
                                entity={getEntityObj(activeWizard.subjectType)}
                                type={activeWizard.subjectType}
                                stateId={st.id}
                                size={52}
                              />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                État {st.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Seulement dans cet état</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {availableEntityOptions.map((opt) => {
                        const ent = getEntityObj(opt.type);
                        const statesCount = Object.keys(ent?.states || {}).length;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              if (statesCount > 1) {
                                setActiveWizard({
                                  ...activeWizard,
                                  subjectType: opt.type,
                                  subjectSubStep: 'choose_state',
                                });
                              } else {
                                setActiveWizard({
                                  ...activeWizard,
                                  subjectType: opt.type,
                                  subjectStateId: undefined,
                                  step: 2,
                                });
                              }
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                          >
                            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview entity={ent} type={opt.type} size={64} />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                {opt.label}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {statesCount > 1 ? `${statesCount} états disponibles →` : 'Choisir comme Sujet →'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 2 : ÉVÉNEMENT (Grandes Cartes) */}
              {activeWizard.step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Collision Contact */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'collision',
                        triggerPhase: 'enter',
                        step: 3,
                        targetSubStep: 'choose_object',
                      });
                    }}
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      💥
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Collision (Contact Immédiat)
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Dès que le sujet touche une cible spécifique
                      </div>
                    </div>
                  </button>

                  {/* Collision Au Relâchement */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'collision',
                        triggerPhase: 'collision_release',
                        step: 3,
                        targetSubStep: 'choose_object',
                      });
                    }}
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      🎯
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Au Relâchement sur Cible
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le joueur glisse et lâche le sujet sur la cible
                      </div>
                    </div>
                  </button>

                  {/* Clic Direct */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'click',
                        triggerPhase: 'click',
                        step: 4,
                        actionSubStep: 'main',
                      });
                    }}
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      👆
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Clic Souris / Pointeur
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le joueur clique directement sur le sujet
                      </div>
                    </div>
                  </button>

                  {/* Glisser Relâcher Libre (Drop) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        triggerType: 'drag',
                        triggerPhase: 'drag_release',
                        step: 4,
                        actionSubStep: 'main',
                      });
                    }}
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      🫳
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Relâcher dans le vide (Drop)
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le sujet est relâché n'importe où
                      </div>
                    </div>
                  </button>
                </div>
              )}

              {/* ÉTAPE 3 : CIBLE (Collision - Grandes Cartes) */}
              {activeWizard.step === 3 && (
                <div>
                  {activeWizard.targetSubStep === 'choose_state' ? (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez si la règle requiert un état précis pour la cible {getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType} :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* Option : Tous les états */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              targetStateId: undefined,
                              targetSubStep: 'choose_object',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div className="text-center w-full">
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                              Tous les états
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Toute apparence de la cible</div>
                          </div>
                        </button>

                        {/* Options : États spécifiques de la cible */}
                        {Object.values(getEntityObj(activeWizard.targetType)?.states || {}).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setActiveWizard({
                                ...activeWizard,
                                targetStateId: st.id,
                                targetSubStep: 'choose_object',
                                step: 4,
                                actionSubStep: 'main',
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview
                                entity={getEntityObj(activeWizard.targetType)}
                                type={activeWizard.targetType}
                                stateId={st.id}
                                size={52}
                              />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                État {st.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Seulement si la cible est dans cet état</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      {availableEntityOptions.map((opt) => {
                        const ent = getEntityObj(opt.type);
                        const statesCount = Object.keys(ent?.states || {}).length;
                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              if (statesCount > 1) {
                                setActiveWizard({
                                  ...activeWizard,
                                  targetType: opt.type,
                                  targetSubStep: 'choose_state',
                                });
                              } else {
                                setActiveWizard({
                                  ...activeWizard,
                                  targetType: opt.type,
                                  targetStateId: undefined,
                                  step: 4,
                                  actionSubStep: 'main',
                                });
                              }
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                          >
                            <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview entity={ent} type={opt.type} size={64} />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                {opt.label}
                              </div>
                              <div className="text-[11px] text-slate-400 mt-0.5">
                                {statesCount > 1 ? `${statesCount} états disponibles →` : 'Choisir comme Cible →'}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 4 : ACTION (Grandes Cartes, 1 Clic pour Finaliser) */}
              {activeWizard.step === 4 && (
                <div>
                  {/* Mode Principal Étape 4 */}
                  {activeWizard.actionSubStep === 'main' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* 1. Changer d'état de la Cible (si collision) */}
                        {activeWizard.triggerType === 'collision' && (
                          <button
                            type="button"
                            onClick={() => {
                              const tarEnt = getEntityObj(activeWizard.targetType);
                              const statesList = tarEnt ? Object.values(tarEnt.states) : [];
                              if (statesList.length > 1) {
                                setActiveWizard({
                                  ...activeWizard,
                                  actionTargetMode: 'target',
                                  actionTargetType: activeWizard.targetType,
                                  actionSubStep: 'state_picker',
                                });
                              } else {
                                completeWizardWithAction({
                                  type: 'change_state',
                                  targetMode: 'target',
                                  targetType: activeWizard.targetType,
                                });
                              }
                            }}
                            className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🔄
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700">
                                Changer l'état de la Cible
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Transformer l'objet touché
                              </div>
                            </div>
                          </button>
                        )}

                        {/* 2. Changer d'état du Sujet */}
                        <button
                          type="button"
                          onClick={() => {
                            const subEnt = getEntityObj(activeWizard.subjectType);
                            const statesList = subEnt ? Object.values(subEnt.states) : [];
                            if (statesList.length > 1) {
                              setActiveWizard({
                                ...activeWizard,
                                actionTargetMode: 'subject',
                                actionTargetType: activeWizard.subjectType,
                                actionSubStep: 'state_picker',
                              });
                            } else {
                              completeWizardWithAction({
                                type: 'change_state',
                                targetMode: 'subject',
                                targetType: activeWizard.subjectType,
                              });
                            }
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🔄
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700">
                              Changer l'état du Sujet
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Transformer l'objet qui agit
                            </div>
                          </div>
                        </button>

                        {/* 3. Changer d'état d'un Autre Objet (Entité Tierce) */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              actionSubStep: 'third_party_entity_picker',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🪄
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700">
                              Changer un Autre Objet (Tierce)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Modifier l'état d'un objet C à distance
                            </div>
                          </div>
                        </button>

                        {/* 4. Détruire la Cible (si collision) */}
                        {activeWizard.triggerType === 'collision' && (
                          <button
                            type="button"
                            onClick={() => {
                              completeWizardWithAction({
                                type: 'delete_entity',
                                targetMode: 'target',
                                targetType: activeWizard.targetType,
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              💥
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                                Détruire la Cible
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Faire disparaître l'objet touché
                              </div>
                            </div>
                          </button>
                        )}

                        {/* 5. Détruire le Sujet */}
                        <button
                          type="button"
                          onClick={() => {
                            completeWizardWithAction({
                              type: 'delete_entity',
                              targetMode: 'subject',
                              targetType: activeWizard.subjectType,
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            💥
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                              Détruire le Sujet
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Faire disparaître l'objet qui agit
                            </div>
                          </div>
                        </button>

                        {/* 6. Créer un Objet (Spawn) */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              actionSubStep: 'spawn_entity_picker',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                              Créer un nouvel Objet (Spawn)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Faire apparaître à un endroit précis
                            </div>
                          </div>
                        </button>

                        {/* 7. Jouer un son */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              actionSubStep: 'sound_picker',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🔊
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-purple-700">
                              Jouer un effet sonore
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Victoire, Magie, Pop, Rebond...
                            </div>
                          </div>
                        </button>
                      </div>

                      {/* Créer sans action immédiate */}
                      <div className="flex justify-end pt-3 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => completeWizardWithAction(undefined)}
                          className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <span>Terminer sans action (+ Action plus tard)</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'état (Sujet ou Cible) */}
                  {activeWizard.actionSubStep === 'state_picker' && (() => {
                    const targetEntType = activeWizard.actionTargetType || activeWizard.subjectType;
                    const ent = getEntityObj(targetEntType);
                    const states = ent ? Object.values(ent.states) : [];

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur le nouvel état à appliquer à {ent?.name || targetEntType} :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'change_state',
                                  targetMode: activeWizard.actionTargetMode || 'target',
                                  targetType: targetEntType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={targetEntType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'Entité Tierce */}
                  {activeWizard.actionSubStep === 'third_party_entity_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez quel autre objet vous souhaitez modifier :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                const statesList = ent ? Object.values(ent.states) : [];
                                if (statesList.length > 1) {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionTargetMode: 'type',
                                    actionTargetType: opt.type,
                                    actionSubStep: 'third_party_state_picker',
                                  });
                                } else {
                                  completeWizardWithAction({
                                    type: 'change_state',
                                    targetMode: 'type',
                                    targetType: opt.type,
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700 truncate w-full text-center">
                                {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'état pour l'Entité Tierce */}
                  {activeWizard.actionSubStep === 'third_party_state_picker' && (() => {
                    const targetEntType = activeWizard.actionTargetType || availableEntityOptions[0]?.type || 'plant';
                    const ent = getEntityObj(targetEntType);
                    const states = ent ? Object.values(ent.states) : [];

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Quel état appliquer à {ent?.name || targetEntType} ?
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'change_state',
                                  targetMode: 'type',
                                  targetType: targetEntType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={targetEntType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'objet à faire apparaître (Spawn) */}
                  {activeWizard.actionSubStep === 'spawn_entity_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Cliquez sur l'objet à faire apparaître :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                setActiveWizard({
                                  ...activeWizard,
                                  pendingSpawnType: opt.type,
                                  actionSubStep: 'spawn_location_picker',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                + {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'emplacement de spawn */}
                  {activeWizard.actionSubStep === 'spawn_location_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Où faire apparaître {getEntityObj(activeWizard.pendingSpawnType)?.name || activeWizard.pendingSpawnType} ?
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Sur la Cible (si collision) */}
                        {activeWizard.triggerType === 'collision' && (
                          <button
                            type="button"
                            onClick={() => {
                              completeWizardWithAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeWizard.pendingSpawnType,
                                spawnLocationMode: 'at_target',
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🎯
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                Sur la Cible (à l'impact)
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Emplacement précis de l'objet touché
                              </div>
                            </div>
                          </button>
                        )}

                        {/* Sur le Sujet */}
                        <button
                          type="button"
                          onClick={() => {
                            completeWizardWithAction({
                              type: 'spawn_entity',
                              spawnEntityType: activeWizard.pendingSpawnType,
                              spawnLocationMode: 'at_subject',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            📍
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                              Sur le Sujet
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Emplacement de l'objet qui agit
                            </div>
                          </div>
                        </button>

                        {/* Position Aléatoire */}
                        <button
                          type="button"
                          onClick={() => {
                            completeWizardWithAction({
                              type: 'spawn_entity',
                              spawnEntityType: activeWizard.pendingSpawnType,
                              spawnLocationMode: 'random',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🎲
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                              Position Aléatoire
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              N'importe où sur la scène
                            </div>
                          </div>
                        </button>

                        {/* Au Centre de la scène */}
                        <button
                          type="button"
                          onClick={() => {
                            completeWizardWithAction({
                              type: 'spawn_entity',
                              spawnEntityType: activeWizard.pendingSpawnType,
                              spawnLocationMode: 'absolute',
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            📌
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                              Au Centre de la scène
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              Position centrale fixe
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix du son */}
                  {activeWizard.actionSubStep === 'sound_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Cliquez sur l'effet sonore à jouer :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {[
                          { id: 'win', label: '🏆 Victoire' },
                          { id: 'magic', label: '✨ Magie' },
                          { id: 'pop', label: '🎈 Pop' },
                          { id: 'bounce', label: '🏀 Rebond' },
                          { id: 'bell', label: '🔔 Cloche' },
                          { id: 'laser', label: '⚡ Laser' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              soundSynth.play(s.id as any);
                              completeWizardWithAction({
                                type: 'play_sound',
                                soundType: s.id as any,
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <span className="text-3xl group-hover:scale-125 transition-transform">
                              {s.label.split(' ')[0]}
                            </span>
                            <span className="text-xs font-black text-slate-800 group-hover:text-purple-700">
                              {s.label.split(' ')[1]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 MODALS FOR DIRECT SLOT EDITING (Grande taille, 1 clic) */}
      {/* ========================================================================= */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-2xl w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-hidden">
            {/* 1. SUJET / CIBLE MODAL */}
            {(activeModal.type === 'subject' || activeModal.type === 'target') && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isSubject = activeModal.type === 'subject';
              const currentType = isSubject ? rule.trigger.subjectType : rule.trigger.targetType;
              const relevantType = activeModal.selectedEntityType || currentType || availableEntityOptions[0]?.type || 'apple';
              const ent = getEntityObj(relevantType);
              const states = ent ? Object.values(ent.states) : [];

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {activeModal.subStep === 'choose_state' && (
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_object' })}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="text-base font-black text-slate-900">
                        {activeModal.subStep === 'choose_state'
                          ? `Choisir l'état de ${ent?.name || relevantType}`
                          : isSubject
                          ? "Changer l'Objet Sujet"
                          : "Changer l'Objet Cible"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {activeModal.subStep === 'choose_state' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 overflow-y-auto pr-1 flex-1 py-1">
                      {/* Option Tous les états */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isSubject) {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                subjectType: relevantType,
                                subjectStateId: undefined,
                              },
                            });
                          } else {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                targetType: relevantType,
                                targetStateId: undefined,
                              },
                            });
                          }
                          setActiveModal(null);
                        }}
                        className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          ✨
                        </div>
                        <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                          Tous les états
                        </div>
                        <div className="text-[10px] text-slate-400">N'importe quel état</div>
                      </button>

                      {/* États spécifiques */}
                      {states.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            if (isSubject) {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  subjectType: relevantType,
                                  subjectStateId: st.id,
                                },
                              });
                            } else {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  targetType: relevantType,
                                  targetStateId: st.id,
                                },
                              });
                            }
                            setActiveModal(null);
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                            <EntityMiniPreview entity={ent} type={relevantType} stateId={st.id} size={44} />
                          </div>
                          <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate w-full text-center">
                            État {st.name}
                          </div>
                          <div className="text-[10px] text-slate-400">État requis</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 overflow-y-auto pr-1 flex-1 py-1">
                      {availableEntityOptions.map((opt) => {
                        const entObj = getEntityObj(opt.type);
                        const statesCount = Object.keys(entObj?.states || {}).length;

                        return (
                          <button
                            key={opt.type}
                            type="button"
                            onClick={() => {
                              if (statesCount > 1) {
                                setActiveModal({
                                  ...activeModal,
                                  subStep: 'choose_state',
                                  selectedEntityType: opt.type,
                                });
                              } else {
                                if (isSubject) {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      subjectType: opt.type,
                                      subjectStateId: undefined,
                                    },
                                  });
                                } else {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      targetType: opt.type,
                                      targetStateId: undefined,
                                    },
                                  });
                                }
                                setActiveModal(null);
                              }
                            }}
                            className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview entity={entObj} type={opt.type} size={52} />
                            </div>
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate w-full text-center">
                              {opt.label}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {statesCount > 1 ? `${statesCount} états →` : 'Sélectionner'}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. ÉVÉNEMENT MODAL */}
            {activeModal.type === 'event' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <h3 className="text-base font-black text-slate-900">Type d'Événement</h3>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-1">
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        💥
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Collision (Premier Contact)
                        </div>
                        <div className="text-xs text-slate-500">Quand le sujet touche une cible</div>
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        🎯
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Collision au Relâchement
                        </div>
                        <div className="text-xs text-slate-500">Quand le sujet est lâché sur la cible touchée</div>
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        👆
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Clic Direct sur le Sujet
                        </div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur clique sur l'objet</div>
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        🫳
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Relâcher dans le vide (Drop)
                        </div>
                        <div className="text-xs text-slate-500">Quand l'objet est relâché n'importe où</div>
                      </div>
                    </button>
                  </div>
                </div>
              );
            })()}

            {/* 3. ACTION DIRECT MODAL */}
            {activeModal.type === 'action' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isCollision = rule.trigger.type === 'collision';
              const subjectType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
              const targetType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';

              const applyAction = (actionData: Partial<RuleAction>) => {
                if (activeModal.actionIndex !== undefined) {
                  const updatedActions = [...rule.actions];
                  updatedActions[activeModal.actionIndex] = {
                    ...updatedActions[activeModal.actionIndex],
                    ...actionData,
                  };
                  updateRule(rule.id, { actions: updatedActions });
                } else {
                  const newAct: RuleAction = {
                    id: `act-${Date.now()}`,
                    type: actionData.type || 'change_state',
                    targetMode: actionData.targetMode || (isCollision ? 'target' : 'subject'),
                    targetType: actionData.targetType || (actionData.targetMode === 'subject' ? subjectType : targetType),
                    ...actionData,
                  };
                  updateRule(rule.id, { actions: [...rule.actions, newAct] });
                }
                setActiveModal(null);
              };

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {activeModal.subStep && activeModal.subStep !== 'main' && (
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'main' })}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="text-base font-black text-slate-900">
                        {activeModal.actionIndex !== undefined ? "Modifier l'Action" : 'Nouvelle Action'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-y-auto pr-1 flex-1 py-1">
                    {(!activeModal.subStep || activeModal.subStep === 'main') && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                        {/* Changer état Cible */}
                        {isCollision && (
                          <button
                            type="button"
                            onClick={() => {
                              const ent = getEntityObj(targetType);
                              if (ent && Object.values(ent.states).length > 1) {
                                setActiveModal({
                                  ...activeModal,
                                  subStep: 'choose_state',
                                  targetMode: 'target',
                                  selectedTargetType: targetType,
                                });
                              } else {
                                applyAction({
                                  type: 'change_state',
                                  targetMode: 'target',
                                  targetType,
                                });
                              }
                            }}
                            className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🔄
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700">
                                Changer l'état de la Cible
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Modifier l'apparence</div>
                            </div>
                          </button>
                        )}

                        {/* Changer état Sujet */}
                        <button
                          type="button"
                          onClick={() => {
                            const ent = getEntityObj(subjectType);
                            if (ent && Object.values(ent.states).length > 1) {
                              setActiveModal({
                                ...activeModal,
                                subStep: 'choose_state',
                                targetMode: 'subject',
                                selectedTargetType: subjectType,
                              });
                            } else {
                              applyAction({
                                type: 'change_state',
                                targetMode: 'subject',
                                targetType: subjectType,
                              });
                            }
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🔄
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700">
                              Changer l'état du Sujet
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Modifier l'apparence</div>
                          </div>
                        </button>

                        {/* Changer état d'un Autre Objet (Entité Tierce) */}
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_third_party_entity' })}
                          className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🪄
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700">
                              Changer un Autre Objet (Tierce)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Modifier une entité C à distance</div>
                          </div>
                        </button>

                        {/* Basculer entre états (Toggle) */}
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_toggle_entity' })}
                          className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🔀
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                              Basculer l'état (Toggle ⇄)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Alterner A ⇄ B ou cycler</div>
                          </div>
                        </button>

                        {/* Détruire Cible */}
                        {isCollision && (
                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'delete_entity',
                                targetMode: 'target',
                                targetType,
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              💥
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                                Détruire la Cible
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">Faire disparaître</div>
                            </div>
                          </button>
                        )}

                        {/* Détruire Sujet */}
                        <button
                          type="button"
                          onClick={() => {
                            applyAction({
                              type: 'delete_entity',
                              targetMode: 'subject',
                              targetType: subjectType,
                            });
                          }}
                          className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            💥
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                              Détruire le Sujet
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Faire disparaître</div>
                          </div>
                        </button>

                        {/* Détruire Autre Objet (Tierce) */}
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_third_party_destroy' })}
                          className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            💣
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-rose-700">
                              Détruire un Autre Objet (Tierce)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Supprimer une entité C à distance</div>
                          </div>
                        </button>

                        {/* Créer un Objet */}
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' })}
                          className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                              Créer un Objet (Spawn)
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Faire apparaître</div>
                          </div>
                        </button>

                        {/* Jouer un son */}
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_sound' })}
                          className="p-4 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                            🔊
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-purple-700">
                              Jouer un son
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">Effet audio</div>
                          </div>
                        </button>
                      </div>
                    )}

                    {/* Choix d'état direct */}
                    {activeModal.subStep === 'choose_state' && (() => {
                      const relevantType = activeModal.selectedTargetType || targetType;
                      const ent = getEntityObj(relevantType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'change_state',
                                  targetMode: activeModal.targetMode || 'target',
                                  targetType: relevantType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={relevantType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Choix d'entité tierce */}
                    {activeModal.subStep === 'choose_third_party_entity' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur l'autre objet dont vous souhaitez changer l'état :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesList = ent ? Object.values(ent.states) : [];

                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesList.length > 1) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_third_party_state',
                                      selectedTargetType: opt.type,
                                    });
                                  } else {
                                    applyAction({
                                      type: 'change_state',
                                      targetMode: 'type',
                                      targetType: opt.type,
                                    });
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix d'état pour entité tierce */}
                    {activeModal.subStep === 'choose_third_party_state' && (() => {
                      const thirdType = activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'plant';
                      const ent = getEntityObj(thirdType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Quel état appliquer à {ent?.name || thirdType} ?
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                            {states.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'change_state',
                                    targetMode: 'type',
                                    targetType: thirdType,
                                    targetStateId: st.id,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={thirdType} stateId={st.id} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700">
                                  État {st.name}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'entité tierce à détruire */}
                    {activeModal.subStep === 'choose_third_party_destroy' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur l'objet à détruire / faire disparaître de la scène :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'delete_entity',
                                    targetMode: 'type',
                                    targetType: opt.type,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-rose-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-rose-500 font-bold">Détruire</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix d'objet pour Toggle */}
                    {activeModal.subStep === 'choose_toggle_entity' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Sur quel objet basculer l'état (Toggle) ?
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesList = ent ? Object.values(ent.states) : [];
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesList.length >= 2) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_toggle_states',
                                      selectedTargetType: opt.type,
                                    });
                                  } else {
                                    applyAction({
                                      type: 'toggle_state',
                                      targetMode: 'type',
                                      targetType: opt.type,
                                    });
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-violet-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {statesList.length} états disponibles
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix des états pour Toggle */}
                    {activeModal.subStep === 'choose_toggle_states' && (() => {
                      const relevantType = activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'apple';
                      const ent = getEntityObj(relevantType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Comment faire basculer {ent?.name || relevantType} ?
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Option 1: Cycler tous les états */}
                            <button
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'toggle_state',
                                  targetMode: 'type',
                                  targetType: relevantType,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                🔄
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                  Cycler entre tous les états
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Passe au suivant à chaque événement
                                </div>
                              </div>
                            </button>

                            {/* Option 2: Basculer spécifiquement entre État 1 et État 2 */}
                            {states.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'toggle_state',
                                    targetMode: 'type',
                                    targetType: relevantType,
                                    toggleStateA: states[0].id,
                                    toggleStateB: states[1].id,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                  ⇄
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                    Basculer : {states[0].name} ⇄ {states[1].name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Aller-retour binaire entre 2 états
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'objet à spawner */}
                    {activeModal.subStep === 'choose_spawn_entity' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                setActiveModal({
                                  ...activeModal,
                                  pendingSpawnType: opt.type,
                                  subStep: 'choose_spawn_location',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                + {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Choix de l'emplacement de spawn */}
                    {activeModal.subStep === 'choose_spawn_location' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Où faire apparaître {getEntityObj(activeModal.pendingSpawnType)?.name || activeModal.pendingSpawnType} ?
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {isCollision && (
                            <button
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'spawn_entity',
                                  spawnEntityType: activeModal.pendingSpawnType,
                                  spawnLocationMode: 'at_target',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                🎯
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                  Sur la Cible (à l'impact)
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Emplacement précis de l'objet touché
                                </div>
                              </div>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeModal.pendingSpawnType,
                                spawnLocationMode: 'at_subject',
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              📍
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                Sur le Sujet
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Emplacement de l'objet qui agit
                              </div>
                            </div>
                          </button>

                          {/* Relative / Offset au sujet (ex: sortie d'arme) */}
                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeModal.pendingSpawnType,
                                spawnLocationMode: 'offset_subject',
                                spawnOffset: { x: 50, y: 0 },
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🏹
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                Relatif au Sujet (Sortie d'arme)
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Décalé par rapport au sujet (+50px X)
                              </div>
                            </div>
                          </button>

                          {/* Position Aléatoire */}
                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeModal.pendingSpawnType,
                                spawnLocationMode: 'random',
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🎲
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                Position Aléatoire
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                N'importe où sur la scène
                              </div>
                            </div>
                          </button>

                          {/* Coordonnées Précises sur la Scène */}
                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeModal.pendingSpawnType,
                                spawnLocationMode: 'absolute',
                                spawnAbsoluteCoords: { x: 300, y: 200 },
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              📌
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-amber-700">
                                Coordonnées Précises Canvas
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Point exact (X: 300, Y: 200)
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Choix du son */}
                    {activeModal.subStep === 'choose_sound' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {[
                          { id: 'win', label: '🏆 Victoire' },
                          { id: 'magic', label: '✨ Magie' },
                          { id: 'pop', label: '🎈 Pop' },
                          { id: 'bounce', label: '🏀 Rebond' },
                          { id: 'bell', label: '🔔 Cloche' },
                          { id: 'laser', label: '⚡ Laser' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              soundSynth.play(s.id as any);
                              applyAction({
                                type: 'play_sound',
                                soundType: s.id as any,
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <span className="text-3xl group-hover:scale-125 transition-transform">
                              {s.label.split(' ')[0]}
                            </span>
                            <span className="text-xs font-black text-slate-800 group-hover:text-purple-700">
                              {s.label.split(' ')[1]}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
