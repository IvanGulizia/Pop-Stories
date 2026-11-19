import React from 'react';
import { ChevronLeft, X, Zap } from 'lucide-react';
import {
  CustomParticlePreset,
  CustomSound,
  Entity,
  RuleAction,
} from '../../types';
import { EntityOption, ParticleDrawingTarget, WizardData } from './ruleBookTypes';
import { WizardStep1Condition } from './WizardStep1Condition';
import { WizardStep2Objects } from './WizardStep2Objects';
import { WizardStep3Actions } from './WizardStep3Actions';
import { useSceneStore } from '../../store/useSceneStore';

interface RuleCreationWizardModalProps {
  activeWizard: WizardData;
  setActiveWizard: React.Dispatch<React.SetStateAction<WizardData | null>>;
  entities: Record<string, Entity>;
  entityList: Entity[];
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  deleteCustomParticle: (id: string) => void;
  setIsSoundModalOpen: (open: boolean) => void;
  setParticleDrawingTarget: React.Dispatch<React.SetStateAction<ParticleDrawingTarget | null>>;
  setParticleEditorContext: React.Dispatch<React.SetStateAction<'wizard' | 'modal' | null>>;
  getEntityObj: (type?: string) => Entity | undefined;
  completeWizardWithAction: (action?: Omit<RuleAction, 'id'>) => void;
}

export function RuleCreationWizardModal({
  activeWizard,
  setActiveWizard,
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
  completeWizardWithAction,
}: RuleCreationWizardModalProps) {
  const isWizardGlobal = ['timer', 'keyboard', 'variable'].includes(activeWizard.triggerType);
  const isWizardRelational = activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity';
  const wizardObjectPhase = activeWizard.objectPhase || 'subject';
  const hasWizardParams = ['timer', 'keyboard', 'proximity', 'boundary', 'variable', 'collision'].includes(activeWizard.triggerType);

  const isPickingSpawnOnCanvas = useSceneStore((s) => Boolean(s.spawnCanvasPick));

  return (
    <div
      data-modal-open={isPickingSpawnOnCanvas ? undefined : 'true'}
      className={`fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${
        isPickingSpawnOnCanvas ? 'hidden' : ''
      }`}
    >
      <div
        className={`bg-white rounded-3xl border border-slate-200 p-6 w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden ${
          activeWizard.step === 3 && isWizardRelational ? 'max-w-5xl' : 'max-w-4xl'
        }`}
      >
        {/* Header with Back Button */}
        <div className="border-b border-slate-100 pb-3 shrink-0 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {(activeWizard.step > 1 || (activeWizard.step === 1 && activeWizard.actionSubStep && activeWizard.actionSubStep !== 'main')) && (
              <button
                type="button"
                onClick={() => {
                  if (activeWizard.step === 3) {
                    if (activeWizard.actionSubStep === 'toggle_states_picker') {
                      setActiveWizard({ ...activeWizard, actionSubStep: 'toggle_entity_picker' });
                    } else if (activeWizard.actionSubStep === 'spawn_location_picker') {
                      const spEnt = getEntityObj(activeWizard.pendingSpawnType);
                      const hasMultiStates = Object.keys(spEnt?.states || {}).length > 1;
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: hasMultiStates ? 'spawn_state_picker' : 'spawn_entity_picker',
                      });
                    } else if (activeWizard.actionSubStep === 'spawn_state_picker') {
                      setActiveWizard({ ...activeWizard, actionSubStep: 'spawn_entity_picker' });
                    } else if (activeWizard.actionSubStep === 'third_party_state_picker') {
                      setActiveWizard({ ...activeWizard, actionSubStep: 'third_party_entity_picker' });
                    } else if (activeWizard.actionSubStep && activeWizard.actionSubStep !== 'main') {
                      setActiveWizard({ ...activeWizard, actionSubStep: 'main' });
                    } else if (isWizardGlobal) {
                      setActiveWizard({
                        ...activeWizard,
                        step: 1,
                        actionSubStep: 'main',
                      });
                    } else {
                      setActiveWizard({
                        ...activeWizard,
                        step: 2,
                        objectPhase: isWizardRelational ? 'target' : 'subject',
                        subjectSubStep: 'choose_object',
                        targetSubStep: 'choose_object',
                        actionSubStep: 'main',
                      });
                    }
                  } else if (activeWizard.step === 2) {
                    if (wizardObjectPhase === 'target') {
                      if (activeWizard.targetSubStep === 'choose_state') {
                        setActiveWizard({ ...activeWizard, targetSubStep: 'choose_object' });
                      } else {
                        setActiveWizard({
                          ...activeWizard,
                          objectPhase: 'subject',
                          subjectSubStep: 'choose_object',
                        });
                      }
                    } else if (activeWizard.subjectSubStep === 'choose_state') {
                      setActiveWizard({ ...activeWizard, subjectSubStep: 'choose_object' });
                    } else {
                      setActiveWizard({
                        ...activeWizard,
                        step: 1,
                        actionSubStep: 'main',
                      });
                    }
                  } else {
                    setActiveWizard({ ...activeWizard, actionSubStep: 'main' });
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
                    (activeWizard.actionSubStep === 'key_picker'
                      ? 'Étape 1 : Quelle touche du clavier ?'
                      : activeWizard.actionSubStep === 'config_event_params'
                      ? 'Étape 1 : Paramètres de la condition'
                      : 'Étape 1 : Quand la règle se déclenche-t-elle ? (Condition)')}
                  {activeWizard.step === 2 &&
                    (isWizardGlobal
                      ? 'Étape 2 : Portée globale'
                      : wizardObjectPhase === 'target'
                      ? activeWizard.targetSubStep === 'choose_state'
                        ? `Étape 2 : État requis de la Cible (${getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType})`
                        : 'Étape 2 : Quel objet Cible est touché / approché ?'
                      : activeWizard.subjectSubStep === 'choose_state'
                      ? `Étape 2 : État requis du Sujet (${getEntityObj(activeWizard.subjectType)?.name || activeWizard.subjectType})`
                      : 'Étape 2 : Quel objet Sujet est concerné ?')}
                  {activeWizard.step === 3 && 'Étape 3 : Que doit-il se passer ? (Action)'}
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Cliquez sur une carte pour avancer ou utilisez la barre d'étapes ci-dessous pour naviguer en 1 clic.
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

        {/* Clickable 3-Step Progress Bar */}
        <div className="space-y-2 shrink-0">
          <div className="grid grid-cols-3 gap-2">
            {([
              { num: 1 as const, label: '1. Condition' },
              {
                num: 2 as const,
                label: isWizardGlobal
                  ? '2. Objets (Global ⚡)'
                  : isWizardRelational
                  ? '2. Objets (Sujet ↔ Cible)'
                  : '2. Objet (Sujet)',
                disabled: isWizardGlobal,
              },
              { num: 3 as const, label: '3. Action' },
            ]).map((st) => {
              const isActive = st.num === activeWizard.step;
              const isDone = activeWizard.step > st.num && !st.disabled;
              return (
                <button
                  key={st.num}
                  type="button"
                  disabled={st.disabled}
                  onClick={() => {
                    if (st.num === 1) {
                      setActiveWizard({ ...activeWizard, step: 1, actionSubStep: 'main' });
                    } else if (st.num === 2 && !isWizardGlobal) {
                      setActiveWizard({
                        ...activeWizard,
                        step: 2,
                        objectPhase: 'subject',
                        subjectSubStep: 'choose_object',
                        targetSubStep: 'choose_object',
                        actionSubStep: 'main',
                      });
                    } else if (st.num === 3) {
                      setActiveWizard({ ...activeWizard, step: 3, actionSubStep: 'main' });
                    }
                  }}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold text-center border transition-all ${
                    st.disabled
                      ? 'bg-slate-100/80 text-slate-400 border-slate-200/70 line-through cursor-not-allowed opacity-70'
                      : isActive
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm cursor-pointer'
                      : isDone
                      ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border-emerald-200 cursor-pointer'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200 cursor-pointer'
                  }`}
                >
                  {st.label}
                </button>
              );
            })}
          </div>

          {/* Sub-step 1-click Breadcrumb */}
          <div className="flex items-center gap-1.5 flex-wrap text-[11px] bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setActiveWizard({ ...activeWizard, step: 1, actionSubStep: 'main' })}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                activeWizard.step === 1 && activeWizard.actionSubStep === 'main'
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-white hover:text-indigo-700'
              }`}
            >
              ⚡ Type de condition
            </button>
            {hasWizardParams && (
              <button
                type="button"
                onClick={() =>
                  setActiveWizard({
                    ...activeWizard,
                    step: 1,
                    actionSubStep: activeWizard.triggerType === 'keyboard' ? 'key_picker' : 'config_event_params',
                  })
                }
                className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                  activeWizard.step === 1 &&
                  (activeWizard.actionSubStep === 'config_event_params' || activeWizard.actionSubStep === 'key_picker')
                    ? 'bg-amber-500 text-white'
                    : 'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200/80'
                }`}
              >
                {activeWizard.triggerType === 'keyboard' ? '⌨️ Touche & phase' : '⚙️ Paramètres'}
              </button>
            )}
            {!isWizardGlobal && (
              <>
                <span className="text-slate-300">›</span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveWizard({
                      ...activeWizard,
                      step: 2,
                      objectPhase: 'subject',
                      subjectSubStep: 'choose_object',
                      actionSubStep: 'main',
                    })
                  }
                  className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    activeWizard.step === 2 && wizardObjectPhase === 'subject' && activeWizard.subjectSubStep !== 'choose_state'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-indigo-700'
                  }`}
                >
                  📦 Sujet
                </button>
                {(activeWizard.subjectMode === 'type' || activeWizard.subjectMode === 'instance') &&
                  Object.keys(getEntityObj(activeWizard.subjectType)?.states || {}).length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveWizard({
                          ...activeWizard,
                          step: 2,
                          objectPhase: 'subject',
                          subjectSubStep: 'choose_state',
                          actionSubStep: 'main',
                        })
                      }
                      className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeWizard.step === 2 && wizardObjectPhase === 'subject' && activeWizard.subjectSubStep === 'choose_state'
                          ? 'bg-indigo-600 text-white'
                          : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100'
                      }`}
                    >
                      🎭 État Sujet
                    </button>
                  )}
              </>
            )}
            {isWizardRelational && (
              <>
                <span className="text-slate-300">›</span>
                <button
                  type="button"
                  onClick={() =>
                    setActiveWizard({
                      ...activeWizard,
                      step: 2,
                      objectPhase: 'target',
                      targetSubStep: 'choose_object',
                      actionSubStep: 'main',
                    })
                  }
                  className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                    activeWizard.step === 2 && wizardObjectPhase === 'target' && activeWizard.targetSubStep !== 'choose_state'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-emerald-700'
                  }`}
                >
                  🎯 Cible
                </button>
                {(activeWizard.targetMode === 'type' || activeWizard.targetMode === 'instance') &&
                  Object.keys(getEntityObj(activeWizard.targetType)?.states || {}).length > 1 && (
                    <button
                      type="button"
                      onClick={() =>
                        setActiveWizard({
                          ...activeWizard,
                          step: 2,
                          objectPhase: 'target',
                          targetSubStep: 'choose_state',
                          actionSubStep: 'main',
                        })
                      }
                      className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                        activeWizard.step === 2 && wizardObjectPhase === 'target' && activeWizard.targetSubStep === 'choose_state'
                          ? 'bg-emerald-600 text-white'
                          : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100'
                      }`}
                    >
                      🎭 État Cible
                    </button>
                  )}
              </>
            )}
            <span className="text-slate-300">›</span>
            <button
              type="button"
              onClick={() => setActiveWizard({ ...activeWizard, step: 3, actionSubStep: 'main' })}
              className={`px-2 py-0.5 rounded-lg font-bold transition-colors cursor-pointer ${
                activeWizard.step === 3
                  ? 'bg-indigo-600 text-white'
                  : 'text-slate-600 hover:bg-white hover:text-indigo-700'
              }`}
            >
              🎬 Actions
            </button>
          </div>
        </div>

        {/* --- BODY (Large Cards Grid) --- */}
        <div className="overflow-y-auto flex-1 pr-1 py-1">
          {activeWizard.step === 1 && (
            <WizardStep1Condition
              activeWizard={activeWizard}
              setActiveWizard={setActiveWizard}
              isWizardGlobal={isWizardGlobal}
              isWizardRelational={isWizardRelational}
            />
          )}

          {activeWizard.step === 2 && (
            <WizardStep2Objects
              activeWizard={activeWizard}
              setActiveWizard={setActiveWizard}
              isWizardGlobal={isWizardGlobal}
              isWizardRelational={isWizardRelational}
              wizardObjectPhase={wizardObjectPhase}
              entities={entities}
              entityList={entityList}
              availableEntityOptions={availableEntityOptions}
              allProjectTags={allProjectTags}
              getEntityObj={getEntityObj}
            />
          )}

          {activeWizard.step === 3 && (
            <WizardStep3Actions
              activeWizard={activeWizard}
              setActiveWizard={setActiveWizard}
              isWizardGlobal={isWizardGlobal}
              isWizardRelational={isWizardRelational}
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
              completeWizardWithAction={completeWizardWithAction}
            />
          )}
        </div>
      </div>
    </div>
  );
}
