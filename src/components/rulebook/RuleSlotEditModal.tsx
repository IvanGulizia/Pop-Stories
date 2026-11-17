import React from 'react';
import {
  DynamicRule,
  RuleAction,
  Entity,
  CustomSound,
  CustomParticlePreset,
} from '../../types';
import {
  ActiveModal,
  ActionModalSubStep,
  EntityOption,
  ParticleDrawingTarget,
} from './ruleBookTypes';
import { RuleSubjectTargetModal } from './RuleSubjectTargetModal';
import { RuleEventModal } from './RuleEventModal';
import { RuleActionModal } from './RuleActionModal';

interface RuleSlotEditModalProps {
  activeModal: NonNullable<ActiveModal>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  rules: DynamicRule[];
  updateRule: (id: string, updates: Partial<DynamicRule>) => void;
  entities: Record<string, Entity>;
  entityList: Entity[];
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  deleteCustomParticle: (id: string) => void;
  setIsSoundModalOpen: (open: boolean) => void;
  setParticleDrawingTarget: (target: ParticleDrawingTarget) => void;
  setParticleEditorContext: (ctx: 'wizard' | 'modal' | null) => void;
  getEntityObj: (type?: string) => Entity | undefined;
  openRuleSubjectModal: (rule: DynamicRule, subStep?: 'choose_object' | 'choose_state') => void;
  openRuleTargetModal: (rule: DynamicRule, subStep?: 'choose_object' | 'choose_state') => void;
  openRuleEventModal: (
    rule: DynamicRule,
    subStep?: 'main' | 'key_picker' | 'config_event_params'
  ) => void;
  openRuleActionModal: (
    rule: DynamicRule,
    act: RuleAction,
    actIdx: number,
    overrideSubStep?: ActionModalSubStep
  ) => void;
}

export const RuleSlotEditModal: React.FC<RuleSlotEditModalProps> = ({
  activeModal,
  setActiveModal,
  rules,
  updateRule,
  entities,
  entityList,
  availableEntityOptions,
  allProjectTags,
  customSounds,
  customParticles,
  deleteCustomParticle,
  setIsSoundModalOpen,
  setParticleDrawingTarget,
  setParticleEditorContext,
  getEntityObj,
  openRuleSubjectModal,
  openRuleTargetModal,
  openRuleEventModal,
  openRuleActionModal,
}) => {
  const modalRule = rules.find((r) => r.id === activeModal.ruleId);
  const isModalGlobal = modalRule
    ? ['timer', 'keyboard', 'variable'].includes(modalRule.trigger.type)
    : false;
  const isModalRelational = modalRule
    ? modalRule.trigger.type === 'collision' || modalRule.trigger.type === 'proximity'
    : false;
  const hasModalParams = modalRule
    ? ['timer', 'keyboard', 'proximity', 'boundary', 'variable', 'collision'].includes(
        modalRule.trigger.type
      )
    : false;
  const modalSubjectType = modalRule?.trigger.subjectType || availableEntityOptions[0]?.type;
  const modalTargetType =
    modalRule?.trigger.targetType ||
    availableEntityOptions[1]?.type ||
    availableEntityOptions[0]?.type;
  const modalSubjectHasStates = modalRule
    ? (!modalRule.trigger.subjectMode ||
        modalRule.trigger.subjectMode === 'type' ||
        modalRule.trigger.subjectMode === 'instance') &&
      Object.keys(getEntityObj(modalSubjectType)?.states || {}).length > 1
    : false;
  const modalTargetHasStates = modalRule
    ? (!modalRule.trigger.targetMode ||
        modalRule.trigger.targetMode === 'type' ||
        modalRule.trigger.targetMode === 'instance') &&
      Object.keys(getEntityObj(modalTargetType)?.states || {}).length > 1
    : false;

  return (
    <div
      data-modal-open="true"
      className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
    >
      <div
        className={`bg-white rounded-3xl border border-slate-200 p-6 w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-hidden ${
          activeModal.type === 'action' ? 'max-w-5xl' : 'max-w-2xl'
        }`}
      >
        {/* Barre de navigation rapide 1-clic entre toutes les étapes & sous-étapes de la règle */}
        {modalRule && (
          <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 px-3 py-2 rounded-2xl border border-slate-200/90 text-[11px] shrink-0">
            <button
              type="button"
              onClick={() => openRuleEventModal(modalRule, 'main')}
              className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeModal.type === 'event' &&
                (!activeModal.subStep || activeModal.subStep === 'main')
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'text-slate-700 hover:bg-white hover:text-indigo-700'
              }`}
            >
              1. Condition
            </button>

            {hasModalParams && (
              <button
                type="button"
                onClick={() =>
                  openRuleEventModal(
                    modalRule,
                    modalRule.trigger.type === 'keyboard' ? 'key_picker' : 'config_event_params'
                  )
                }
                className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                  activeModal.type === 'event' &&
                  (activeModal.subStep === 'config_event_params' ||
                    activeModal.subStep === 'key_picker')
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80'
                }`}
              >
                {modalRule.trigger.type === 'keyboard' ? '⌨️ Touche' : '⚙️ Paramètres'}
              </button>
            )}

            {!isModalGlobal && (
              <>
                <span className="text-slate-300">›</span>
                <button
                  type="button"
                  onClick={() => openRuleSubjectModal(modalRule, 'choose_object')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeModal.type === 'subject' && activeModal.subStep !== 'choose_state'
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white hover:text-indigo-700'
                  }`}
                >
                  2. Sujet
                </button>
                {modalSubjectHasStates && (
                  <button
                    type="button"
                    onClick={() => openRuleSubjectModal(modalRule, 'choose_state')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeModal.type === 'subject' && activeModal.subStep === 'choose_state'
                        ? 'bg-indigo-600 text-white shadow-2xs'
                        : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                    }`}
                  >
                    🎭 État Sujet
                  </button>
                )}
              </>
            )}

            {isModalRelational && (
              <>
                <span className="text-slate-300">›</span>
                <button
                  type="button"
                  onClick={() => openRuleTargetModal(modalRule, 'choose_object')}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    activeModal.type === 'target' && activeModal.subStep !== 'choose_state'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-700 hover:bg-white hover:text-emerald-700'
                  }`}
                >
                  🎯 Cible
                </button>
                {modalTargetHasStates && (
                  <button
                    type="button"
                    onClick={() => openRuleTargetModal(modalRule, 'choose_state')}
                    className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                      activeModal.type === 'target' && activeModal.subStep === 'choose_state'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                    }`}
                  >
                    🎭 État Cible
                  </button>
                )}
              </>
            )}

            <span className="text-slate-300">›</span>
            {modalRule.actions.map((act, idx) => {
              const isEditingThisAct =
                activeModal.type === 'action' && activeModal.actionIndex === idx;
              return (
                <button
                  key={act.id}
                  type="button"
                  onClick={() => openRuleActionModal(modalRule, act, idx)}
                  className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                    isEditingThisAct
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-700 bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-700'
                  }`}
                >
                  🎬 Action {modalRule.actions.length > 1 ? idx + 1 : ''}
                </button>
              );
            })}
            <button
              type="button"
              onClick={() =>
                setActiveModal({
                  type: 'action',
                  ruleId: modalRule.id,
                  actionIndex: undefined,
                  actionType: 'change_state',
                  targetMode: isModalRelational ? 'target' : 'subject',
                  subStep: 'main',
                })
              }
              className={`px-2 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                activeModal.type === 'action' && activeModal.actionIndex === undefined
                  ? 'bg-indigo-600 text-white shadow-2xs'
                  : 'text-indigo-600 bg-indigo-50/70 hover:bg-indigo-100 border border-indigo-200/70'
              }`}
            >
              + Action
            </button>
          </div>
        )}

        {/* 1. SUJET / CIBLE MODAL */}
        {(activeModal.type === 'subject' || activeModal.type === 'target') && modalRule && (
          <RuleSubjectTargetModal
            activeModal={activeModal}
            setActiveModal={setActiveModal}
            rule={modalRule}
            updateRule={updateRule}
            availableEntityOptions={availableEntityOptions}
            entityList={entityList}
            allProjectTags={allProjectTags}
            getEntityObj={getEntityObj}
          />
        )}

        {/* 2. ÉVÉNEMENT MODAL */}
        {activeModal.type === 'event' && modalRule && (
          <RuleEventModal
            activeModal={activeModal}
            setActiveModal={setActiveModal}
            rule={modalRule}
            updateRule={updateRule}
            availableEntityOptions={availableEntityOptions}
          />
        )}

        {/* 3. ACTION DIRECT MODAL */}
        {activeModal.type === 'action' && modalRule && (
          <RuleActionModal
            activeModal={activeModal}
            setActiveModal={setActiveModal}
            rule={modalRule}
            updateRule={updateRule}
            entities={entities}
            availableEntityOptions={availableEntityOptions}
            allProjectTags={allProjectTags}
            customSounds={customSounds}
            customParticles={customParticles}
            deleteCustomParticle={deleteCustomParticle}
            setIsSoundModalOpen={setIsSoundModalOpen}
            setParticleDrawingTarget={setParticleDrawingTarget}
            setParticleEditorContext={setParticleEditorContext}
            getEntityObj={getEntityObj}
          />
        )}
      </div>
    </div>
  );
};
