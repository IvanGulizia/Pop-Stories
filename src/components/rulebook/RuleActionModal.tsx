import React from 'react';
import {
  DynamicRule,
  RuleAction,
  Entity,
  CustomSound,
  CustomParticlePreset,
  ParticleShape,
  CustomParticleUsageMode,
} from '../../types';
import { EntityMiniPreview } from '../EntityMiniPreview';
import { SpawnLocationPicker } from '../SpawnLocationPicker';
import { invalidateCustomParticleSprite } from '../../utils/particleSystem';
import { soundSynth } from '../../utils/sound';
import {
  ChevronLeft,
  X,
  Check,
  Mic,
  Paintbrush,
  Pencil,
  Sliders,
} from 'lucide-react';
import {
  ActiveModal,
  EntityOption,
  ParticleDrawingTarget,
  SCENE_TRANSITION_OPTIONS,
} from './ruleBookTypes';
import { CameraActionEditor } from './CameraActionEditor';
import { useSceneStore, EMPTY_RECORD, EMPTY_LIST } from '../../store/useSceneStore';

interface RuleActionModalProps {
  activeModal: Extract<NonNullable<ActiveModal>, { type: 'action' }>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  rule: DynamicRule;
  updateRule: (id: string, updates: Partial<DynamicRule>) => void;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  deleteCustomParticle: (id: string) => void;
  setIsSoundModalOpen: (open: boolean) => void;
  setParticleDrawingTarget: (target: ParticleDrawingTarget) => void;
  setParticleEditorContext: (ctx: 'wizard' | 'modal' | null) => void;
  getEntityObj: (type?: string) => Entity | undefined;
}

export const RuleActionModal: React.FC<RuleActionModalProps> = ({
  activeModal,
  setActiveModal,
  rule,
  updateRule,
  entities,
  availableEntityOptions,
  allProjectTags,
  customSounds,
  customParticles,
  deleteCustomParticle,
  setIsSoundModalOpen,
  setParticleDrawingTarget,
  setParticleEditorContext,
  getEntityObj,
}) => {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const scenes = useSceneStore((s) => s.scenes || EMPTY_LIST);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();
  const isCollision = rule.trigger.type === 'collision' || rule.trigger.type === 'proximity';
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
        targetType:
          actionData.targetType || (actionData.targetMode === 'subject' ? subjectType : targetType),
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
              onClick={() => {
                if (activeModal.subStep === 'choose_spawn_location') {
                  const spEnt = getEntityObj(activeModal.pendingSpawnType);
                  const hasMulti = Object.keys(spEnt?.states || {}).length > 1;
                  setActiveModal({
                    ...activeModal,
                    subStep: hasMulti ? 'choose_spawn_state' : 'choose_spawn_entity',
                  });
                } else if (activeModal.subStep === 'choose_spawn_state') {
                  setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' });
                } else {
                  setActiveModal({ ...activeModal, subStep: 'main' });
                }
              }}
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
        {(!activeModal.subStep || activeModal.subStep === 'main') &&
          (() => {
            const modalSubjectIsAny = rule.trigger.subjectMode === 'any';
            const modalSubjectIsTag = rule.trigger.subjectMode === 'tag';
            const modalSubjectEntity =
              modalSubjectIsAny || modalSubjectIsTag ? undefined : getEntityObj(subjectType);
            const modalSubjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
            const modalSubjectName = modalSubjectIsAny
              ? 'Tous les objets'
              : modalSubjectIsTag
              ? `#${rule.trigger.subjectTag || 'tag'}`
              : modalSubjectEntity?.name || modalSubjectOpt?.label || subjectType;

            const modalTargetIsAny = rule.trigger.targetMode === 'any';
            const modalTargetIsTag = rule.trigger.targetMode === 'tag';
            const modalTargetEntity =
              modalTargetIsAny || modalTargetIsTag ? undefined : getEntityObj(targetType);
            const modalTargetOpt = availableEntityOptions.find((o) => o.type === targetType);
            const modalTargetName = modalTargetIsAny
              ? 'Tous les objets'
              : modalTargetIsTag
              ? `#${rule.trigger.targetTag || 'tag'}`
              : modalTargetEntity?.name || modalTargetOpt?.label || targetType;

            return (
              <div
                className={`grid grid-cols-1 ${
                  isCollision ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'
                } gap-4 items-start`}
              >
                {/* SECTION 1 : SUJET */}
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                  {/* En-tête Sujet avec miniature et nom de l'entité */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center p-1 shadow-2xs shrink-0 text-lg">
                      {modalSubjectIsAny ? (
                        '🌐'
                      ) : modalSubjectIsTag ? (
                        '🏷️'
                      ) : (
                        <EntityMiniPreview
                          entity={modalSubjectEntity}
                          type={subjectType}
                          stateId={rule.trigger.subjectStateId}
                          size={36}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                          Sujet (Qui agit)
                        </span>
                      </div>
                      <div
                        className="text-sm font-black text-slate-800 truncate mt-0.5"
                        title={modalSubjectName}
                      >
                        {modalSubjectName}
                      </div>
                    </div>
                  </div>

                  {/* Actions sur le Sujet */}
                  <div className="space-y-2.5 flex-1">
                    {/* 1. Changer l'état du Sujet */}
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
                      className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🔄
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                          Changer l'état du Sujet
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Transformer « {modalSubjectName} »
                        </div>
                      </div>
                    </button>

                    {/* 2. Basculer entre états (Toggle) */}
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_toggle_entity' })}
                      className="w-full p-3.5 bg-white hover:bg-violet-50/70 border-2 border-slate-200 hover:border-violet-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🔀
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-violet-700 truncate">
                          Basculer l'état (Toggle ⇄ / Cycle)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Alterner A ⇄ B sur « {modalSubjectName} »
                        </div>
                      </div>
                    </button>

                    {/* 3. Déplacer le Sujet de X px */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_move_entity',
                          targetMode: 'subject',
                          moveDistance: activeModal.moveDistance ?? 40,
                          moveDirectionMode: activeModal.moveDirectionMode || 'cardinal',
                          moveCardinal: activeModal.moveCardinal || 'right',
                          moveAngle: activeModal.moveAngle ?? 0,
                          moveApplyMode: activeModal.moveApplyMode || 'instant',
                        });
                      }}
                      className="w-full p-3.5 bg-white hover:bg-sky-50/70 border-2 border-slate-200 hover:border-sky-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🏃
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-sky-700 truncate">
                          Déplacer de X px
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Décaler ou propulser dans une direction
                        </div>
                      </div>
                    </button>

                    {/* 4. Détruire le Sujet */}
                    <button
                      type="button"
                      onClick={() => {
                        applyAction({
                          type: 'delete_entity',
                          targetMode: 'subject',
                          targetType: subjectType,
                        });
                      }}
                      className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        💥
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                          Détruire le Sujet
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Faire disparaître « {modalSubjectName} »
                        </div>
                      </div>
                    </button>
                  </div>
                </div>

                {/* SECTION 2 : CIBLE (Si Collision) */}
                {isCollision && (
                  <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                    {/* En-tête Cible avec miniature et nom de l'entité */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                      <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-1 shadow-2xs shrink-0 text-lg">
                        {modalTargetIsAny ? (
                          '🌐'
                        ) : modalTargetIsTag ? (
                          '🏷️'
                        ) : (
                          <EntityMiniPreview
                            entity={modalTargetEntity}
                            type={targetType}
                            stateId={rule.trigger.targetStateId}
                            size={36}
                          />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                            Cible (Touchée)
                          </span>
                        </div>
                        <div
                          className="text-sm font-black text-slate-800 truncate mt-0.5"
                          title={modalTargetName}
                        >
                          {modalTargetName}
                        </div>
                      </div>
                    </div>

                    {/* Actions sur la Cible */}
                    <div className="space-y-2.5 flex-1">
                      {/* 1. Changer état Cible */}
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
                        className="w-full p-3.5 bg-white hover:bg-emerald-50/70 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                      >
                        <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                          🔄
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700 truncate">
                            Changer l'état de la Cible
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Transformer « {modalTargetName} »
                          </div>
                        </div>
                      </button>

                      {/* 2. Déplacer la Cible de X px */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveModal({
                            ...activeModal,
                            subStep: 'choose_move_entity',
                            targetMode: 'target',
                            moveDistance: activeModal.moveDistance ?? 40,
                            moveDirectionMode: activeModal.moveDirectionMode || 'cardinal',
                            moveCardinal: activeModal.moveCardinal || 'right',
                            moveAngle: activeModal.moveAngle ?? 0,
                            moveApplyMode: activeModal.moveApplyMode || 'instant',
                          });
                        }}
                        className="w-full p-3.5 bg-white hover:bg-sky-50/70 border-2 border-slate-200 hover:border-sky-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                      >
                        <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                          🏃
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 group-hover:text-sky-700 truncate">
                            Déplacer la Cible de X px
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Pousser ou décaler « {modalTargetName} »
                          </div>
                        </div>
                      </button>

                      {/* 3. Détruire Cible */}
                      <button
                        type="button"
                        onClick={() => {
                          applyAction({
                            type: 'delete_entity',
                            targetMode: 'target',
                            targetType,
                          });
                        }}
                        className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                      >
                        <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                          💥
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                            Détruire la Cible
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                            Faire disparaître « {modalTargetName} »
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                )}

                {/* SECTION 3 : MONDE & EFFETS */}
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                  {/* En-tête Monde & Effets */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-purple-50 border border-purple-200/80 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xl shrink-0 shadow-2xs">
                      🌐
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                          Monde & Effets
                        </span>
                      </div>
                      <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                        Apparitions, sons & tiers
                      </div>
                    </div>
                  </div>

                  {/* Actions Monde & Effets */}
                  <div className="space-y-2.5 flex-1">
                    {/* 1. Créer un Objet */}
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' })}
                      className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        ✨
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                          Créer un nouvel Objet (Spawn)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Faire apparaître sur la scène
                        </div>
                      </div>
                    </button>

                    {/* 2. Jouer un son */}
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_sound' })}
                      className="w-full p-3.5 bg-white hover:bg-purple-50/70 border-2 border-slate-200 hover:border-purple-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🔊
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-purple-700 truncate">
                          Jouer un effet sonore
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Effets audio ou voix micro
                        </div>
                      </div>
                    </button>

                    {/* 2.5. Attendre / Pause (Délai) */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_delay_duration',
                          delayDuration: activeModal.delayDuration || 1,
                        });
                      }}
                      className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        ⏱️
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                          Attendre / Pause (Délai)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Définir un délai en secondes avant l'action suivante
                        </div>
                      </div>
                    </button>

                    {/* 3. Changer état d'un Autre Objet (Entité Tierce) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({ ...activeModal, subStep: 'choose_third_party_entity' })
                      }
                      className="w-full p-3.5 bg-white hover:bg-cyan-50/70 border-2 border-slate-200 hover:border-cyan-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🪄
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700 truncate">
                          Changer un Autre Objet (Tierce)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Modifier une entité C à distance
                        </div>
                      </div>
                    </button>

                    {/* 4. Détruire Autre Objet (Tierce) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({ ...activeModal, subStep: 'choose_third_party_destroy' })
                      }
                      className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        💣
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                          Détruire un Autre Objet (Tierce)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Supprimer une entité C à distance
                        </div>
                      </div>
                    </button>

                    {/* 5. Ajouter au Score (+1) */}
                    <button
                      type="button"
                      onClick={() => {
                        applyAction({
                          type: 'add_score',
                          scoreAmount: 1,
                        });
                      }}
                      className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🏆
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                          Ajouter au Score (+1)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Incrémenter le score de jeu
                        </div>
                      </div>
                    </button>

                    {/* 5.5. Modifier une Variable */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_variable_action',
                          variableName: activeModal.variableName || 'score',
                          variableOperation: activeModal.variableOperation || 'set',
                          variableValue: activeModal.variableValue ?? 1,
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-sky-50/70 border-2 border-slate-200 hover:border-sky-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        📊
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-sky-700 truncate">
                          Modifier une Variable
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Définir, ajouter, soustraire ou multiplier
                        </div>
                      </div>
                    </button>

                    {/* 5.6. Changer de Scène */}
                    <button
                      type="button"
                      onClick={() => {
                        const defaultTarget =
                          scenes.find((s) => s.id !== activeSceneId)?.id || scenes[0]?.id || 'scene-1';
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_scene_action',
                          targetSceneId: activeModal.targetSceneId || defaultTarget,
                          sceneTransition: activeModal.sceneTransition || 'fade',
                          sceneTransitionDuration: activeModal.sceneTransitionDuration ?? 0.45,
                        });
                      }}
                      className="w-full p-3.5 bg-white hover:bg-violet-50/70 border-2 border-slate-200 hover:border-violet-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🎬
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-violet-700 truncate">
                          Changer de Scène
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Naviguer vers une autre scène (avec transition)
                        </div>
                      </div>
                    </button>

                    {/* 5.7. Caméra & Effets */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_camera_action',
                          cameraCommand: activeModal.cameraCommand || 'shake',
                          cameraShakeIntensity: activeModal.cameraShakeIntensity ?? 12,
                          cameraShakeDuration: activeModal.cameraShakeDuration ?? 0.35,
                          cameraZoom: activeModal.cameraZoom ?? 1.4,
                          cameraDuration: activeModal.cameraDuration ?? 0.45,
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-cyan-50/70 border-2 border-slate-200 hover:border-cyan-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🎥
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700 truncate">
                          Caméra &amp; Effets
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Screen shake, zoom, suivi cible ou déplacement
                        </div>
                      </div>
                    </button>

                    {/* 6. Émettre des Particules */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_particles',
                          particleOriginMode: isCollision ? 'target' : 'subject',
                          particleCount: 20,
                          particleColor: '#f59e0b',
                          particleColor2: '#ef4444',
                          particleShape: 'circle',
                          particleSpeed: 180,
                          particleSize: 6,
                          particleLifetime: 0.7,
                          particleGravity: 220,
                          particleSpread: 360,
                          particleAngle: -90,
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🎆
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                          Émettre des Particules
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Étincelles, explosion ou confettis légers
                        </div>
                      </div>
                    </button>

                    {/* 7. Attacher à un Parent (Parenting) */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_attach_parent',
                          parentChildMode: 'subject',
                          parentTargetMode: isCollision ? 'target' : 'entity',
                          parentEntityId: Object.keys(entities)[0] || '',
                          parentOffset: {
                            x: 0,
                            y: 0,
                            rotationOffset: 0,
                            inheritRotation: true,
                            inheritFlip: true,
                          },
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        🔗
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                          Attacher à un Parent
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Solidariser une entité (arme, accessoire)
                        </div>
                      </div>
                    </button>

                    {/* 8. Détacher du Parent */}
                    <button
                      type="button"
                      onClick={() =>
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_detach_parent',
                          targetMode: 'subject',
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                        ✂️
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                          Détacher du Parent
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Désolidariser en cours de partie
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              </div>
            );
          })()}

        {/* Choix d'état direct */}
        {activeModal.subStep === 'choose_state' &&
          (() => {
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
        {activeModal.subStep === 'choose_third_party_state' &&
          (() => {
            const thirdType =
              activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'plant';
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
              Cliquez sur l'objet (ou groupe d'instances dynamiques) à détruire :
            </div>

            {/* Pistes C & A : Dernier objet créé ou Tag dynamique */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80">
              <button
                type="button"
                onClick={() => {
                  applyAction({
                    type: 'delete_entity',
                    targetMode: 'last_spawned',
                  });
                }}
                className="p-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs"
              >
                <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                  ✨
                </div>
                <div>
                  <div className="text-xs font-black text-slate-800">Dernier objet créé</div>
                  <div className="text-[10px] text-slate-500">
                    Cible la dernière instance apparue en jeu
                  </div>
                </div>
              </button>

              <div className="p-2.5 bg-white border border-indigo-200 rounded-2xl flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-black text-slate-800">🏷️ Par Tag (#tag)</div>
                  <input
                    type="text"
                    value={activeModal.targetTag || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, targetTag: e.target.value.replace(/^#/, '') })
                    }
                    placeholder="ex: projectile, piece..."
                    className="w-full mt-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  disabled={!activeModal.targetTag?.trim()}
                  onClick={() => {
                    if (!activeModal.targetTag?.trim()) return;
                    applyAction({
                      type: 'delete_entity',
                      targetMode: 'tag',
                      targetTag: activeModal.targetTag.trim().replace(/^#/, ''),
                    });
                  }}
                  className="px-3 py-1.5 bg-rose-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                >
                  Détruire
                </button>
              </div>
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
        {activeModal.subStep === 'choose_toggle_states' &&
          (() => {
            const relevantType =
              activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'apple';
            const ent = getEntityObj(relevantType);
            const states = ent ? Object.values(ent.states) : [];

            const stateA = activeModal.toggleStateA || states[0]?.id || '';
            const stateB = activeModal.toggleStateB || states[1]?.id || states[0]?.id || '';
            const targetState =
              activeModal.toggleTargetStateId || states[1]?.id || states[0]?.id || '';

            return (
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-600">
                  Comment faire basculer {ent?.name || relevantType} ?
                </div>

                <div className="space-y-3">
                  {/* Option 1: Basculer spécifiquement entre 2 états précis */}
                  {states.length >= 2 && (
                    <div className="p-4 bg-white border-2 border-violet-200 rounded-3xl space-y-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                          ⇄
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            Basculer entre 2 états précis
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Passe alternativement de l'état A à l'état B à chaque déclenchement
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Premier état (A) :
                          </label>
                          <select
                            value={stateA}
                            onChange={(e) =>
                              setActiveModal({ ...activeModal, toggleStateA: e.target.value })
                            }
                            className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                          >
                            {states.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">
                            Deuxième état (B) :
                          </label>
                          <select
                            value={stateB}
                            onChange={(e) =>
                              setActiveModal({ ...activeModal, toggleStateB: e.target.value })
                            }
                            className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                          >
                            {states.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          applyAction({
                            type: 'toggle_state',
                            targetMode: 'type',
                            targetType: relevantType,
                            toggleMode: 'two_states',
                            toggleStateAId: stateA,
                            toggleStateBId: stateB,
                          });
                        }}
                        className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                      >
                        Valider la bascule ({ent?.states[stateA]?.name || 'A'} ⇄{' '}
                        {ent?.states[stateB]?.name || 'B'})
                      </button>
                    </div>
                  )}

                  {/* Option 2: Basculer entre l'état actuel et un autre état */}
                  {states.length >= 2 && (
                    <div className="p-4 bg-white border-2 border-indigo-200 rounded-3xl space-y-3 shadow-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          ⚡
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900">
                            Basculer entre l'état actuel et un état cible
                          </div>
                          <div className="text-[11px] text-slate-500">
                            Passe à l'état cible, puis revient à l'état précédent au clic suivant
                          </div>
                        </div>
                      </div>

                      <div>
                        <label className="text-[10px] font-bold text-slate-500 block mb-1">
                          État cible à activer/désactiver :
                        </label>
                        <select
                          value={targetState}
                          onChange={(e) =>
                            setActiveModal({ ...activeModal, toggleTargetStateId: e.target.value })
                          }
                          className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-indigo-500 cursor-pointer"
                        >
                          {states.map((st) => (
                            <option key={st.id} value={st.id}>
                              {st.name}
                            </option>
                          ))}
                        </select>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          applyAction({
                            type: 'toggle_state',
                            targetMode: 'type',
                            targetType: relevantType,
                            toggleMode: 'current_and_target',
                            toggleTargetStateId: targetState,
                          });
                        }}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                      >
                        Valider la bascule (Actuel ⇄ {ent?.states[targetState]?.name || 'Cible'})
                      </button>
                    </div>
                  )}

                  {/* Option 3: Cycler tous les états */}
                  <button
                    type="button"
                    onClick={() => {
                      applyAction({
                        type: 'toggle_state',
                        targetMode: 'type',
                        targetType: relevantType,
                        toggleMode: 'cycle_all',
                      });
                    }}
                    className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 rounded-3xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group active:scale-98"
                  >
                    <div className="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                      🔄
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-800">
                        Cycler séquentiellement entre tous les états ({states.length} états)
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Fait défiler les états 1 → 2 → 3... en boucle
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            );
          })()}

        {/* Choix d'objet à spawner */}
        {activeModal.subStep === 'choose_spawn_entity' &&
          (() => {
            const existingSpawnAct =
              activeModal.actionIndex !== undefined
                ? rule.actions[activeModal.actionIndex]
                : undefined;
            return (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-600">
                  Cliquez sur l'objet à faire apparaître :
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {availableEntityOptions.map((opt) => {
                    const ent = getEntityObj(opt.type);
                    const statesList = ent ? Object.values(ent.states) : [];
                    const preselectedStateId =
                      existingSpawnAct?.type === 'spawn_entity' &&
                      existingSpawnAct?.spawnEntityType === opt.type
                        ? existingSpawnAct.spawnInitialStateId
                        : undefined;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => {
                          if (statesList.length > 1) {
                            setActiveModal({
                              ...activeModal,
                              pendingSpawnType: opt.type,
                              pendingSpawnInitialStateId: preselectedStateId,
                              subStep: 'choose_spawn_state',
                            });
                          } else {
                            setActiveModal({
                              ...activeModal,
                              pendingSpawnType: opt.type,
                              pendingSpawnInitialStateId: undefined,
                              subStep: 'choose_spawn_location',
                            });
                          }
                        }}
                        className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                          <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                        </div>
                        <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                          + {opt.label}
                        </div>
                        {statesList.length > 1 && (
                          <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                            {statesList.length} états →
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Choix de l'état initial pour l'objet créé (Edit Modal) */}
        {activeModal.subStep === 'choose_spawn_state' &&
          (() => {
            const spawnType =
              activeModal.pendingSpawnType || availableEntityOptions[0]?.type || 'apple';
            const ent = getEntityObj(spawnType);
            const states = ent ? Object.values(ent.states) : [];

            return (
              <div className="space-y-4">
                <div className="text-xs font-bold text-slate-600">
                  Choisissez l'état initial dans lequel « {ent?.name || spawnType} » va apparaître :
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                  {states.map((st) => {
                    const isCurrentSel = activeModal.pendingSpawnInitialStateId === st.id;
                    return (
                      <button
                        key={st.id}
                        type="button"
                        onClick={() => {
                          setActiveModal({
                            ...activeModal,
                            pendingSpawnInitialStateId: st.id,
                            subStep: 'choose_spawn_location',
                          });
                        }}
                        className={`p-4 border-2 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95 ${
                          isCurrentSel
                            ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                            : 'bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-500'
                        }`}
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                          <EntityMiniPreview
                            entity={ent}
                            type={spawnType}
                            stateId={st.id}
                            size={52}
                          />
                        </div>
                        <div className="text-xs font-black text-slate-800 group-hover:text-amber-700">
                          État {st.name}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

        {/* Choix de l'emplacement de spawn avec SpawnLocationPicker */}
        {activeModal.subStep === 'choose_spawn_location' &&
          (() => {
            const existingSpawnAct =
              activeModal.actionIndex !== undefined
                ? rule.actions[activeModal.actionIndex]
                : undefined;
            const isEditingSameSpawn = existingSpawnAct?.type === 'spawn_entity';
            return (
              <div className="space-y-3">
                <div className="text-xs font-bold text-slate-600">
                  Où faire apparaître{' '}
                  {getEntityObj(activeModal.pendingSpawnType)?.name ||
                    activeModal.pendingSpawnType}{' '}
                  ?
                </div>
                <SpawnLocationPicker
                  isCollision={isCollision}
                  subjectEntity={getEntityObj(subjectType)}
                  targetEntity={getEntityObj(targetType)}
                  spawnEntity={getEntityObj(activeModal.pendingSpawnType)}
                  initialMode={
                    isEditingSameSpawn && existingSpawnAct?.spawnLocationMode
                      ? existingSpawnAct.spawnLocationMode
                      : isCollision
                      ? 'at_target'
                      : 'at_subject'
                  }
                  initialStateId={
                    activeModal.pendingSpawnInitialStateId ||
                    (isEditingSameSpawn ? existingSpawnAct?.spawnInitialStateId : undefined)
                  }
                  initialOffset={isEditingSameSpawn ? existingSpawnAct?.spawnOffset : undefined}
                  initialAbsoluteCoords={
                    isEditingSameSpawn ? existingSpawnAct?.spawnAbsoluteCoords : undefined
                  }
                  initialRandomScope={
                    isEditingSameSpawn ? existingSpawnAct?.spawnRandomScope : undefined
                  }
                  initialRandomZone={
                    isEditingSameSpawn ? existingSpawnAct?.spawnRandomZone : undefined
                  }
                  initialSizeMode={isEditingSameSpawn ? existingSpawnAct?.spawnSizeMode : undefined}
                  initialScaleMultiplier={
                    isEditingSameSpawn ? existingSpawnAct?.spawnScaleMultiplier : undefined
                  }
                  initialCustomSize={
                    isEditingSameSpawn ? existingSpawnAct?.spawnCustomSize : undefined
                  }
                  initialTags={isEditingSameSpawn ? existingSpawnAct?.spawnTags : undefined}
                  initialReferenceMode={
                    isEditingSameSpawn ? existingSpawnAct?.spawnReferenceMode : undefined
                  }
                  initialReferenceEntityId={
                    isEditingSameSpawn ? existingSpawnAct?.spawnReferenceEntityId : undefined
                  }
                  initialReferenceEntityType={
                    isEditingSameSpawn ? existingSpawnAct?.spawnReferenceEntityType : undefined
                  }
                  initialReferenceTag={
                    isEditingSameSpawn ? existingSpawnAct?.spawnReferenceTag : undefined
                  }
                  initialImpulseSpeed={
                    isEditingSameSpawn ? existingSpawnAct?.spawnImpulseSpeed : undefined
                  }
                  initialImpulseAngle={
                    isEditingSameSpawn ? existingSpawnAct?.spawnImpulseAngle : undefined
                  }
                  onConfirm={(data) => {
                    applyAction({
                      type: 'spawn_entity',
                      spawnEntityType: activeModal.pendingSpawnType,
                      spawnInitialStateId:
                        data.spawnInitialStateId || activeModal.pendingSpawnInitialStateId,
                      spawnLocationMode: data.spawnLocationMode,
                      spawnReferenceMode: data.spawnReferenceMode,
                      spawnReferenceEntityId: data.spawnReferenceEntityId,
                      spawnReferenceEntityType: data.spawnReferenceEntityType,
                      spawnReferenceTag: data.spawnReferenceTag,
                      spawnOffset: data.spawnOffset,
                      spawnPosition: data.spawnPosition,
                      spawnAbsoluteCoords: data.spawnAbsoluteCoords,
                      spawnRandomScope: data.spawnRandomScope,
                      spawnRandomZone: data.spawnRandomZone,
                      spawnSizeMode: data.spawnSizeMode,
                      spawnScaleMultiplier: data.spawnScaleMultiplier,
                      spawnCustomSize: data.spawnCustomSize,
                      spawnTags: data.spawnTags,
                      spawnImpulseSpeed: data.spawnImpulseSpeed,
                      spawnImpulseAngle: data.spawnImpulseAngle,
                    });
                  }}
                  onCancel={() => {
                    setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' });
                  }}
                />
              </div>
            );
          })()}

        {/* Choix du son */}
        {activeModal.subStep === 'choose_sound' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="text-xs font-bold text-slate-600">
                Choisissez un son ou enregistrez votre voix :
              </div>
              <button
                type="button"
                onClick={() => setIsSoundModalOpen(true)}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Mic className="w-3.5 h-3.5" />
                <span>+ Enregistrer micro / Importer</span>
              </button>
            </div>

            {/* Sons personnalisés (Micro & Upload) */}
            {customSounds.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                  Mes Sons ({customSounds.length})
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {customSounds.map((snd) => (
                    <button
                      key={snd.id}
                      type="button"
                      onClick={() => {
                        soundSynth.playCustom(snd.dataUrl);
                        applyAction({
                          type: 'play_sound',
                          customSoundId: snd.id,
                        });
                      }}
                      className="p-3 bg-purple-50/70 hover:bg-purple-100/90 border border-purple-200 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                    >
                      <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                        {snd.source === 'mic' ? '🎤' : '📁'}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">{snd.name}</div>
                        <div className="text-[10px] text-purple-700 font-medium">
                          {snd.duration ? `${snd.duration}s` : 'Audio'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
              Sons Synthétisés
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
          </div>
        )}

        {/* Étape dédiée : Configuration de la durée du Délai (Modal Action) */}
        {activeModal.subStep === 'choose_delay_duration' && (
          <div className="space-y-6 max-w-lg mx-auto py-2">
            <div className="text-center space-y-1">
              <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                ⏱️
              </div>
              <h4 className="text-sm font-black text-slate-800">
                Définir la durée de la pause (Délai)
              </h4>
              <p className="text-xs text-slate-500">
                L'exécution des actions qui suivent sera suspendue pendant ce temps.
              </p>
            </div>

            {/* Presets rapides */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                Durées suggérées :
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {[
                  { sec: 0.2, label: '0.2s', sub: 'Éclair' },
                  { sec: 0.5, label: '0.5s', sub: 'Rapide' },
                  { sec: 1.0, label: '1.0s', sub: 'Défaut' },
                  { sec: 2.0, label: '2.0s', sub: 'Pause' },
                  { sec: 3.0, label: '3.0s', sub: 'Moyen' },
                  { sec: 5.0, label: '5.0s', sub: 'Long' },
                ].map((p) => {
                  const isSelected = (activeModal.delayDuration || 1) === p.sec;
                  return (
                    <button
                      key={p.sec}
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, delayDuration: p.sec })}
                      className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105 font-black'
                          : 'bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-700 font-bold'
                      }`}
                    >
                      <div className="text-xs">{p.label}</div>
                      <div className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>
                        {p.sub}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slider et Champ numérique */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">Durée précise (secondes) :</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0.1"
                    max="60"
                    step="0.1"
                    value={activeModal.delayDuration ?? 1}
                    onChange={(e) => {
                      const val = Math.max(0.1, Math.min(60, parseFloat(e.target.value) || 0.1));
                      setActiveModal({ ...activeModal, delayDuration: Math.round(val * 10) / 10 });
                    }}
                    className="w-20 px-2 py-1 text-center font-mono font-black text-sm bg-white border border-amber-400 rounded-lg shadow-2xs outline-none focus:ring-2 focus:ring-amber-400"
                  />
                  <span className="text-xs font-black text-slate-600">sec</span>
                </div>
              </div>

              <input
                type="range"
                min="0.1"
                max="10.0"
                step="0.1"
                value={activeModal.delayDuration ?? 1}
                onChange={(e) => {
                  const val = parseFloat(e.target.value) || 1;
                  setActiveModal({ ...activeModal, delayDuration: Math.round(val * 10) / 10 });
                }}
                className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
              />
            </div>

            <button
              type="button"
              onClick={() => {
                applyAction({
                  type: 'delay',
                  delayDuration: activeModal.delayDuration ?? 1,
                });
              }}
              className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider ce délai ({activeModal.delayDuration ?? 1}s)</span>
            </button>
          </div>
        )}

        {/* Modal Action : Émettre des Particules */}
        {activeModal.subStep === 'choose_particles' && (
          <div className="space-y-4 max-w-xl mx-auto py-2">
            <div className="flex flex-wrap gap-2">
              {[
                {
                  label: '🔥 Étincelles',
                  count: 16,
                  color: '#f59e0b',
                  color2: '#ef4444',
                  shape: 'spark' as ParticleShape,
                  speed: 220,
                  gravity: 280,
                  spread: 140,
                },
                {
                  label: '💥 Explosion',
                  count: 28,
                  color: '#ef4444',
                  color2: '#fbbf24',
                  shape: 'circle' as ParticleShape,
                  speed: 260,
                  gravity: 180,
                  spread: 360,
                },
                {
                  label: '✨ Magie',
                  count: 20,
                  color: '#8b5cf6',
                  color2: '#ec4899',
                  shape: 'star' as ParticleShape,
                  speed: 140,
                  gravity: -60,
                  spread: 360,
                },
                {
                  label: '🎉 Confettis',
                  count: 32,
                  color: '#10b981',
                  color2: '#3b82f6',
                  shape: 'square' as ParticleShape,
                  speed: 210,
                  gravity: 240,
                  spread: 180,
                },
              ].map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() =>
                    setActiveModal({
                      ...activeModal,
                      particleCount: preset.count,
                      particleColor: preset.color,
                      particleColor2: preset.color2,
                      particleShape: preset.shape,
                      particleSpeed: preset.speed,
                      particleGravity: preset.gravity,
                      particleSpread: preset.spread,
                    })
                  }
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 cursor-pointer transition-colors"
                >
                  {preset.label}
                </button>
              ))}
            </div>

            <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Source d'émission</span>
                <select
                  value={activeModal.particleOriginMode || 'subject'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, particleOriginMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="subject">Sujet</option>
                  {(isCollision || rule.trigger.type === 'proximity') && (
                    <option value="target">Cible touchée</option>
                  )}
                  <option value="event_point">💥 Point exact (Collision / Clic)</option>
                  <option value="entity">Entité de la scène</option>
                  <option value="type">Par Type d'objet</option>
                  <option value="tag">Par #Tag</option>
                  <option value="last_spawned">Dernier objet créé</option>
                </select>
              </div>

              {activeModal.particleOriginMode === 'entity' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Entité source</span>
                  <select
                    value={activeModal.particleOriginEntityId || Object.keys(entities)[0] || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, particleOriginEntityId: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {Object.values(entities).map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModal.particleOriginMode === 'type' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Type source</span>
                  <select
                    value={
                      activeModal.particleOriginEntityType ||
                      availableEntityOptions[0]?.type ||
                      ''
                    }
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, particleOriginEntityType: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {availableEntityOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModal.particleOriginMode === 'tag' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Tag source (#tag)</span>
                  <input
                    type="text"
                    list="modal-particle-tags"
                    value={activeModal.particleOriginTag || ''}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        particleOriginTag: e.target.value.replace(/^#/, ''),
                      })
                    }
                    placeholder="ex: joueur, ennemi..."
                    className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                  <datalist id="modal-particle-tags">
                    {allProjectTags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              )}

              <button
                type="button"
                onClick={() => setParticleEditorContext('modal')}
                className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Ouvrir l'Éditeur &amp; Testeur Visuel</span>
              </button>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Forme</span>
                <select
                  value={activeModal.particleShape || 'circle'}
                  onChange={(e) => {
                    const nextShape = e.target.value as ParticleShape;
                    const existing =
                      activeModal.customParticleIds && activeModal.customParticleIds.length > 0
                        ? activeModal.customParticleIds
                        : activeModal.customParticleId
                        ? [activeModal.customParticleId]
                        : [];
                    const nextIds =
                      nextShape === 'custom' && existing.length === 0 && customParticles.length > 0
                        ? [customParticles[0].id]
                        : existing;
                    setActiveModal({
                      ...activeModal,
                      particleShape: nextShape,
                      customParticleId: nextIds[0],
                      customParticleIds: nextIds,
                    });
                  }}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="circle">Rond</option>
                  <option value="square">Carré</option>
                  <option value="spark">Étincelle</option>
                  <option value="star">Étoile</option>
                  <option value="custom">Particule dessinée ✨</option>
                </select>
              </div>

              {activeModal.particleShape === 'custom' &&
                (() => {
                  const modSelectedIds: string[] =
                    activeModal.customParticleIds && activeModal.customParticleIds.length > 0
                      ? activeModal.customParticleIds
                      : activeModal.customParticleId
                      ? [activeModal.customParticleId]
                      : [];
                  const toggleModPreset = (pid: string) => {
                    const nextIds = modSelectedIds.includes(pid)
                      ? modSelectedIds.filter((id) => id !== pid)
                      : [...modSelectedIds, pid];
                    setActiveModal({
                      ...activeModal,
                      customParticleIds: nextIds,
                      customParticleId: nextIds[0],
                    });
                  };
                  return (
                    <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-amber-950">
                          Particules ({modSelectedIds.length} sél.) :
                        </span>
                        <button
                          type="button"
                          onClick={() => setParticleDrawingTarget({ context: 'modal' })}
                          className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Paintbrush className="w-3 h-3" />
                          <span>+ Dessiner une particule</span>
                        </button>
                      </div>
                      {customParticles.length === 0 ? (
                        <div className="text-[11px] text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200 text-center">
                          Aucune particule dessinée. Cliquez sur{' '}
                          <strong>+ Dessiner une particule</strong>.
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 gap-1.5">
                          {customParticles.map((preset) => {
                            const selIdx = modSelectedIds.indexOf(preset.id);
                            const isSel = selIdx !== -1;
                            return (
                              <div
                                key={preset.id}
                                onClick={() => toggleModPreset(preset.id)}
                                className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                  isSel
                                    ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                                    : 'bg-white/80 border-slate-200 hover:border-amber-300'
                                }`}
                              >
                                {isSel && (
                                  <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black shadow-2xs">
                                    #{selIdx + 1}
                                  </span>
                                )}
                                <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                                  <svg viewBox="0 0 100 100" className="w-7 h-7">
                                    {preset.vectorPaths.map((p) => (
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
                                </div>
                                <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                                  {preset.name}
                                </span>
                                <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center gap-0.5">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setParticleDrawingTarget({
                                        context: 'modal',
                                        editingPreset: preset,
                                      });
                                    }}
                                    className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                    title="Modifier"
                                  >
                                    <Pencil className="w-2.5 h-2.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      deleteCustomParticle(preset.id);
                                      invalidateCustomParticleSprite(preset.id);
                                      if (isSel) {
                                        const nextIds = modSelectedIds.filter(
                                          (id) => id !== preset.id
                                        );
                                        setActiveModal({
                                          ...activeModal,
                                          customParticleIds: nextIds,
                                          customParticleId: nextIds[0],
                                        });
                                      }
                                    }}
                                    className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                    title="Supprimer"
                                  >
                                    <X className="w-2.5 h-2.5" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {modSelectedIds.length > 1 && (
                        <div className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-700">Utilisation :</span>
                          <select
                            value={activeModal.customParticleMode || 'random'}
                            onChange={(e) =>
                              setActiveModal({
                                ...activeModal,
                                customParticleMode: e.target.value as CustomParticleUsageMode,
                              })
                            }
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
                          >
                            <option value="random">Aléatoire</option>
                            <option value="sequence">Séquence (#1 → #2 → ...)</option>
                            <option value="lifetime_anim">Animation sur durée de vie</option>
                          </select>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1 border-t border-amber-200/70">
                        <span className="text-[11px] font-bold text-slate-700">
                          Teinter avec les couleurs d'émission
                        </span>
                        <input
                          type="checkbox"
                          checked={activeModal.useParticleTint === true}
                          onChange={(e) =>
                            setActiveModal({ ...activeModal, useParticleTint: e.target.checked })
                          }
                          className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                        />
                      </div>
                    </div>
                  );
                })()}

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">
                  Nombre ({activeModal.particleCount ?? 20})
                </span>
                <input
                  type="range"
                  min="4"
                  max="50"
                  step="2"
                  value={activeModal.particleCount ?? 20}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, particleCount: parseInt(e.target.value, 10) })
                  }
                  className="w-40 accent-amber-500"
                />
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Couleurs (Mix)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={activeModal.particleColor || '#f59e0b'}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, particleColor: e.target.value })
                    }
                    className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                  />
                  <input
                    type="color"
                    value={activeModal.particleColor2 || '#ef4444'}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, particleColor2: e.target.value })
                    }
                    className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                  />
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">
                  Taille ({activeModal.particleSize ?? 6} px)
                </span>
                <input
                  type="range"
                  min="2"
                  max="24"
                  step="1"
                  value={activeModal.particleSize ?? 6}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, particleSize: parseFloat(e.target.value) })
                  }
                  className="w-40 accent-indigo-600"
                />
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">
                  Vitesse ({activeModal.particleSpeed ?? 180} px/s)
                </span>
                <input
                  type="range"
                  min="40"
                  max="450"
                  step="10"
                  value={activeModal.particleSpeed ?? 180}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, particleSpeed: parseFloat(e.target.value) })
                  }
                  className="w-40 accent-indigo-600"
                />
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">
                  Gravité ({activeModal.particleGravity ?? 220})
                </span>
                <input
                  type="range"
                  min="-200"
                  max="500"
                  step="20"
                  value={activeModal.particleGravity ?? 220}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, particleGravity: parseFloat(e.target.value) })
                  }
                  className="w-40 accent-indigo-600"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const pOriginMode = activeModal.particleOriginMode || 'subject';
                const selectedIds =
                  activeModal.customParticleIds && activeModal.customParticleIds.length > 0
                    ? activeModal.customParticleIds
                    : activeModal.customParticleId
                    ? [activeModal.customParticleId]
                    : undefined;
                applyAction({
                  type: 'emit_particles',
                  particleOriginMode: pOriginMode,
                  particleOriginEntityId:
                    pOriginMode === 'entity'
                      ? activeModal.particleOriginEntityId || Object.keys(entities)[0]
                      : undefined,
                  particleOriginEntityType:
                    pOriginMode === 'type'
                      ? activeModal.particleOriginEntityType || availableEntityOptions[0]?.type
                      : undefined,
                  particleOriginTag:
                    pOriginMode === 'tag'
                      ? (activeModal.particleOriginTag || '').trim().replace(/^#/, '')
                      : undefined,
                  particleCount: activeModal.particleCount ?? 20,
                  particleColor: activeModal.particleColor ?? '#f59e0b',
                  particleColor2: activeModal.particleColor2 ?? '#ef4444',
                  particleShape: activeModal.particleShape ?? 'circle',
                  customParticleId:
                    activeModal.particleShape === 'custom' ? selectedIds?.[0] : undefined,
                  customParticleIds:
                    activeModal.particleShape === 'custom' ? selectedIds : undefined,
                  customParticleMode:
                    activeModal.particleShape === 'custom'
                      ? activeModal.customParticleMode || 'random'
                      : undefined,
                  useParticleTint:
                    activeModal.particleShape === 'custom'
                      ? Boolean(activeModal.useParticleTint)
                      : undefined,
                  particleSpeed: activeModal.particleSpeed ?? 180,
                  particleSize: activeModal.particleSize ?? 6,
                  particleLifetime: activeModal.particleLifetime ?? 0.7,
                  particleGravity: activeModal.particleGravity ?? 220,
                  particleSpread: activeModal.particleSpread ?? 360,
                  particleAngle: activeModal.particleAngle ?? -90,
                });
              }}
              className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider l'effet de particules</span>
            </button>
          </div>
        )}

        {/* Modal Action : Attacher à un Parent */}
        {activeModal.subStep === 'choose_attach_parent' && (
          <div className="space-y-4 max-w-xl mx-auto py-2">
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Objet enfant à attacher</span>
                <select
                  value={activeModal.parentChildMode || 'subject'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, parentChildMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="subject">Sujet</option>
                  {isCollision && <option value="target">Cible touchée</option>}
                  <option value="last_spawned">Dernier objet créé</option>
                  <option value="tag">Par Tag (#tag)</option>
                </select>
              </div>

              {activeModal.parentChildMode === 'tag' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Tag enfant</span>
                  <input
                    type="text"
                    value={activeModal.parentChildTag || ''}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        parentChildTag: e.target.value.replace(/^#/, ''),
                      })
                    }
                    placeholder="ex: arme"
                    className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                </div>
              )}

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Objet parent (Porteur)</span>
                <select
                  value={activeModal.parentTargetMode || (isCollision ? 'target' : 'entity')}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, parentTargetMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="subject">Sujet</option>
                  {isCollision && <option value="target">Cible touchée</option>}
                  <option value="entity">Entité de la scène</option>
                  <option value="type">Par Type</option>
                  <option value="tag">Par Tag (#tag)</option>
                  <option value="last_spawned">Dernier objet créé</option>
                </select>
              </div>

              {activeModal.parentTargetMode === 'entity' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Choisir parent</span>
                  <select
                    value={activeModal.parentEntityId || Object.keys(entities)[0] || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, parentEntityId: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {Object.values(entities).map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModal.parentTargetMode === 'type' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Type parent</span>
                  <select
                    value={activeModal.parentEntityType || availableEntityOptions[0]?.type || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, parentEntityType: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {availableEntityOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeModal.parentTargetMode === 'tag' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Tag parent</span>
                  <input
                    type="text"
                    value={activeModal.parentEntityTag || ''}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        parentEntityTag: e.target.value.replace(/^#/, ''),
                      })
                    }
                    placeholder="ex: joueur"
                    className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                </div>
              )}

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Décalage ΔX / ΔY (px)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={activeModal.parentOffset?.x ?? 0}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        parentOffset: {
                          x: parseFloat(e.target.value) || 0,
                          y: activeModal.parentOffset?.y ?? 0,
                          inheritRotation: activeModal.parentOffset?.inheritRotation ?? true,
                          inheritFlip: activeModal.parentOffset?.inheritFlip ?? true,
                        },
                      })
                    }
                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                  <input
                    type="number"
                    value={activeModal.parentOffset?.y ?? 0}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        parentOffset: {
                          x: activeModal.parentOffset?.x ?? 0,
                          y: parseFloat(e.target.value) || 0,
                          inheritRotation: activeModal.parentOffset?.inheritRotation ?? true,
                          inheritFlip: activeModal.parentOffset?.inheritFlip ?? true,
                        },
                      })
                    }
                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                <span className="font-bold text-slate-700 text-xs">
                  Hériter rotation & Flip du parent
                </span>
                <input
                  type="checkbox"
                  checked={activeModal.parentOffset?.inheritRotation !== false}
                  onChange={(e) =>
                    setActiveModal({
                      ...activeModal,
                      parentOffset: {
                        x: activeModal.parentOffset?.x ?? 0,
                        y: activeModal.parentOffset?.y ?? 0,
                        inheritRotation: e.target.checked,
                        inheritFlip: e.target.checked,
                      },
                    })
                  }
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                applyAction({
                  type: 'attach_to_parent',
                  targetMode: activeModal.parentChildMode || 'subject',
                  targetTag:
                    activeModal.parentChildMode === 'tag' ? activeModal.parentChildTag : undefined,
                  parentTargetMode: activeModal.parentTargetMode || 'entity',
                  parentEntityId:
                    activeModal.parentTargetMode === 'entity'
                      ? activeModal.parentEntityId || Object.keys(entities)[0]
                      : undefined,
                  parentEntityType:
                    activeModal.parentTargetMode === 'type'
                      ? activeModal.parentEntityType || availableEntityOptions[0]?.type
                      : undefined,
                  parentEntityTag:
                    activeModal.parentTargetMode === 'tag'
                      ? activeModal.parentEntityTag
                      : undefined,
                  parentOffset: activeModal.parentOffset,
                });
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider l'attachement</span>
            </button>
          </div>
        )}

        {/* Modal Action : Détacher du Parent */}
        {activeModal.subStep === 'choose_detach_parent' && (
          <div className="space-y-4 max-w-xl mx-auto py-2">
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Objet à détacher</span>
                <select
                  value={activeModal.targetMode || 'subject'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, targetMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="subject">Sujet</option>
                  {isCollision && <option value="target">Cible touchée</option>}
                  <option value="last_spawned">Dernier objet créé</option>
                  <option value="tag">Par Tag (#tag)</option>
                  <option value="type">Par Type</option>
                </select>
              </div>

              {activeModal.targetMode === 'tag' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Tag à détacher</span>
                  <input
                    type="text"
                    value={activeModal.targetTag || ''}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        targetTag: e.target.value.replace(/^#/, ''),
                      })
                    }
                    placeholder="ex: arme"
                    className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                </div>
              )}

              {activeModal.targetMode === 'type' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Type à détacher</span>
                  <select
                    value={activeModal.selectedTargetType || availableEntityOptions[0]?.type || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, selectedTargetType: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {availableEntityOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                applyAction({
                  type: 'detach_parent',
                  targetMode: activeModal.targetMode || 'subject',
                  targetTag: activeModal.targetMode === 'tag' ? activeModal.targetTag : undefined,
                  targetType:
                    activeModal.targetMode === 'type'
                      ? activeModal.selectedTargetType || availableEntityOptions[0]?.type
                      : undefined,
                });
              }}
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider le détachement</span>
            </button>
          </div>
        )}

        {/* Modal Action : Déplacer de X px dans une direction */}
        {activeModal.subStep === 'choose_move_entity' && (
          <div className="space-y-4 max-w-xl mx-auto py-2">
            <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Entité à déplacer</span>
                <select
                  value={activeModal.targetMode || 'subject'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, targetMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="subject">Sujet</option>
                  {isCollision && <option value="target">Cible touchée</option>}
                  <option value="last_spawned">Dernier objet créé</option>
                  <option value="tag">Par Tag (#tag)</option>
                  <option value="type">Par Type</option>
                </select>
              </div>

              {activeModal.targetMode === 'tag' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Tag à déplacer</span>
                  <input
                    type="text"
                    list="modal-move-tags"
                    value={activeModal.targetTag || ''}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        targetTag: e.target.value.replace(/^#/, ''),
                      })
                    }
                    placeholder="ex: joueur"
                    className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                  <datalist id="modal-move-tags">
                    {allProjectTags.map((t) => (
                      <option key={t} value={t} />
                    ))}
                  </datalist>
                </div>
              )}

              {activeModal.targetMode === 'type' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Type à déplacer</span>
                  <select
                    value={activeModal.selectedTargetType || availableEntityOptions[0]?.type || ''}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, selectedTargetType: e.target.value })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {availableEntityOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Distance (px)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="1"
                    max="500"
                    step="5"
                    value={activeModal.moveDistance ?? 40}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        moveDistance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-32 accent-sky-600"
                  />
                  <input
                    type="number"
                    value={activeModal.moveDistance ?? 40}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        moveDistance: parseFloat(e.target.value) || 0,
                      })
                    }
                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                </div>
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Direction</span>
                <select
                  value={activeModal.moveDirectionMode || 'cardinal'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, moveDirectionMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="cardinal">Direction cardinale (H / B / G / D)</option>
                  <option value="angle">Angle libre (degrés °)</option>
                  <option value="facing">Direction du regard / rotation</option>
                  <option value="toward_target">Vers une entité / cible</option>
                  <option value="away_target">S'éloigner d'une entité / cible</option>
                </select>
              </div>

              {(activeModal.moveDirectionMode || 'cardinal') === 'cardinal' && (
                <div className="grid grid-cols-4 gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
                  {(
                    [
                      { id: 'left', label: '← Gauche' },
                      { id: 'right', label: '→ Droite' },
                      { id: 'up', label: '↑ Haut' },
                      { id: 'down', label: '↓ Bas' },
                    ] as const
                  ).map((dir) => (
                    <button
                      key={dir.id}
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, moveCardinal: dir.id })}
                      className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                        (activeModal.moveCardinal || 'right') === dir.id
                          ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {dir.label}
                    </button>
                  ))}
                </div>
              )}

              {activeModal.moveDirectionMode === 'angle' && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">
                    Angle ({activeModal.moveAngle ?? 0}°)
                  </span>
                  <div className="flex items-center gap-2">
                    <input
                      type="range"
                      min="-180"
                      max="180"
                      step="5"
                      value={activeModal.moveAngle ?? 0}
                      onChange={(e) =>
                        setActiveModal({
                          ...activeModal,
                          moveAngle: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-32 accent-sky-600"
                    />
                    <input
                      type="number"
                      value={activeModal.moveAngle ?? 0}
                      onChange={(e) =>
                        setActiveModal({
                          ...activeModal,
                          moveAngle: parseFloat(e.target.value) || 0,
                        })
                      }
                      className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                    />
                  </div>
                </div>
              )}

              {(activeModal.moveDirectionMode === 'toward_target' ||
                activeModal.moveDirectionMode === 'away_target') && (
                <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-700 text-xs">Entité de référence</span>
                    <select
                      value={activeModal.moveTargetMode || (isCollision ? 'target' : 'entity')}
                      onChange={(e) =>
                        setActiveModal({ ...activeModal, moveTargetMode: e.target.value as any })
                      }
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    >
                      <option value="subject">Sujet</option>
                      {isCollision && <option value="target">Cible touchée</option>}
                      <option value="last_spawned">Dernier objet créé</option>
                      <option value="mouse">Souris (curseur)</option>
                      <option value="entity">Instance précise</option>
                      <option value="type">Par Type</option>
                      <option value="tag">Par Tag (#tag)</option>
                    </select>
                  </div>
                  {activeModal.moveTargetMode === 'entity' && (
                    <select
                      value={activeModal.moveTargetEntityId || Object.keys(entities)[0] || ''}
                      onChange={(e) =>
                        setActiveModal({ ...activeModal, moveTargetEntityId: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    >
                      {Object.values(entities).map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name}
                        </option>
                      ))}
                    </select>
                  )}
                  {activeModal.moveTargetMode === 'type' && (
                    <select
                      value={
                        activeModal.moveTargetEntityType || availableEntityOptions[0]?.type || ''
                      }
                      onChange={(e) =>
                        setActiveModal({ ...activeModal, moveTargetEntityType: e.target.value })
                      }
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    >
                      {availableEntityOptions.map((opt) => (
                        <option key={opt.type} value={opt.type}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                  {activeModal.moveTargetMode === 'tag' && (
                    <input
                      type="text"
                      value={activeModal.moveTargetTag || ''}
                      onChange={(e) =>
                        setActiveModal({
                          ...activeModal,
                          moveTargetTag: e.target.value.replace(/^#/, ''),
                        })
                      }
                      placeholder="ex: joueur"
                      className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                    />
                  )}
                </div>
              )}

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Mode de déplacement</span>
                <select
                  value={activeModal.moveApplyMode || 'instant'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, moveApplyMode: e.target.value as any })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  <option value="instant">Décalage direct (Teleport +X px)</option>
                  <option value="impulse">Impulsion physique (Force / Knockback)</option>
                </select>
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                const targetMode = activeModal.targetMode || 'subject';
                applyAction({
                  type: 'move_entity',
                  targetMode,
                  targetType:
                    targetMode === 'type'
                      ? activeModal.selectedTargetType || availableEntityOptions[0]?.type
                      : targetMode === 'target'
                      ? targetType
                      : subjectType,
                  targetTag: targetMode === 'tag' ? activeModal.targetTag : undefined,
                  moveDistance: activeModal.moveDistance ?? 40,
                  moveDirectionMode: activeModal.moveDirectionMode || 'cardinal',
                  moveCardinal: activeModal.moveCardinal || 'right',
                  moveAngle: activeModal.moveAngle ?? 0,
                  moveApplyMode: activeModal.moveApplyMode || 'instant',
                  moveTargetMode: activeModal.moveTargetMode,
                  moveTargetEntityId: activeModal.moveTargetEntityId,
                  moveTargetEntityType: activeModal.moveTargetEntityType,
                  moveTargetTag: activeModal.moveTargetTag,
                });
              }}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider le déplacement</span>
            </button>
          </div>
        )}

        {/* Modal Action : Modifier une Variable */}
        {activeModal.subStep === 'choose_variable_action' && (
          <div className="space-y-4 max-w-lg mx-auto py-2">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                📊
              </div>
              <h4 className="text-sm font-black text-slate-800">Modifier une Variable</h4>
              <p className="text-xs text-slate-500">
                Changez la valeur d'une variable de jeu (ou du score) lors du déclenchement.
              </p>
            </div>

            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Nom de la variable :</label>
                <input
                  type="text"
                  list="modal-action-vars"
                  value={activeModal.variableName ?? 'score'}
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, variableName: e.target.value })
                  }
                  placeholder="ex: score, vies, slider_x..."
                  className="w-full px-3 py-2 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-400"
                />
                <datalist id="modal-action-vars">
                  {variableNames.map((vn) => (
                    <option key={vn} value={vn} />
                  ))}
                </datalist>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Opération :</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {([
                    { id: 'set', label: '= Définir' },
                    { id: 'add', label: '+ Ajouter' },
                    { id: 'subtract', label: '− Retirer' },
                    { id: 'multiply', label: '× Multiplier' },
                  ] as const).map((op) => (
                    <button
                      key={op.id}
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, variableOperation: op.id })}
                      className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                        (activeModal.variableOperation || 'set') === op.id
                          ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-sky-50'
                      }`}
                    >
                      {op.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Valeur :</label>
                <input
                  type="number"
                  step="any"
                  value={activeModal.variableValue ?? 1}
                  onChange={(e) => {
                    const parsed = parseFloat(e.target.value);
                    setActiveModal({
                      ...activeModal,
                      variableValue: Number.isNaN(parsed) ? 0 : parsed,
                    });
                  }}
                  className="w-full px-3 py-2 text-center font-mono text-sm font-black bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-400"
                />
              </div>
            </div>

            <button
              type="button"
              onClick={() => {
                applyAction({
                  type: 'set_variable',
                  variableName: (activeModal.variableName || 'score').trim() || 'score',
                  variableOperation: activeModal.variableOperation || 'set',
                  variableValue: activeModal.variableValue ?? 1,
                });
              }}
              className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider l'action Variable</span>
            </button>
          </div>
        )}

        {/* Modal Action : Changer de Scène */}
        {activeModal.subStep === 'choose_scene_action' && (
          <div className="space-y-4 max-w-lg mx-auto py-2">
            <div className="text-center space-y-1">
              <div className="w-12 h-12 bg-violet-100 text-violet-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                🎬
              </div>
              <h4 className="text-sm font-black text-slate-800">Changer de Scène</h4>
              <p className="text-xs text-slate-500">
                Choisissez la scène cible et la transition visuelle. Les variables &amp; scores sont conservés.
              </p>
            </div>

            <div className="space-y-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Scène de destination :</label>
                <select
                  value={activeModal.targetSceneId || scenes[0]?.id || 'scene-1'}
                  onChange={(e) => setActiveModal({ ...activeModal, targetSceneId: e.target.value })}
                  className="w-full px-3 py-2.5 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl outline-none cursor-pointer focus:ring-2 focus:ring-violet-400"
                >
                  {scenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                      {sc.id === activeSceneId ? ' (Scène actuelle — redémarrer)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">Effet de transition :</label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {SCENE_TRANSITION_OPTIONS.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() =>
                        setActiveModal({ ...activeModal, sceneTransition: t.id })
                      }
                      className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer text-left truncate ${
                        (activeModal.sceneTransition || 'fade') === t.id
                          ? 'bg-violet-600 text-white border-violet-700 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-violet-50'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {(activeModal.sceneTransition || 'fade') !== 'none' && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Durée de transition :</label>
                    <span className="text-xs font-mono font-black text-violet-700">
                      {(activeModal.sceneTransitionDuration ?? 0.45).toFixed(2)}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={2}
                    step={0.05}
                    value={activeModal.sceneTransitionDuration ?? 0.45}
                    onChange={(e) =>
                      setActiveModal({
                        ...activeModal,
                        sceneTransitionDuration: parseFloat(e.target.value) || 0.45,
                      })
                    }
                    className="w-full accent-violet-600 cursor-pointer"
                  />
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => {
                const resolvedSceneId =
                  activeModal.targetSceneId ||
                  scenes.find((s) => s.id !== activeSceneId)?.id ||
                  scenes[0]?.id ||
                  'scene-1';
                applyAction({
                  type: 'change_scene',
                  targetSceneId: resolvedSceneId,
                  sceneTransition: activeModal.sceneTransition || 'fade',
                  sceneTransitionDuration:
                    activeModal.sceneTransition === 'none'
                      ? 0
                      : activeModal.sceneTransitionDuration ?? 0.45,
                });
              }}
              className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Valider le changement de scène</span>
            </button>
          </div>
        )}

        {/* Modal Action : Caméra & Effets */}
        {activeModal.subStep === 'choose_camera_action' && (
          <CameraActionEditor
            draft={activeModal}
            onPatch={(patch) => setActiveModal({ ...activeModal, ...patch })}
            onConfirm={(actionData) => applyAction(actionData)}
            isRelational={isCollision}
            isGlobal={['timer', 'keyboard', 'variable'].includes(rule.trigger.type)}
            entities={entities}
            availableEntityOptions={availableEntityOptions}
            allProjectTags={allProjectTags}
          />
        )}
      </div>
    </div>
  );
};
