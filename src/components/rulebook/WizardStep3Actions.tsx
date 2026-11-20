import React from 'react';
import {
  Check,
  ChevronRight,
  Mic,
  Paintbrush,
  Pencil,
  Sliders,
  X,
} from 'lucide-react';
import {
  CustomParticlePreset,
  CustomParticleUsageMode,
  CustomSound,
  Entity,
  ParticleShape,
  RuleAction,
  SceneTransitionType,
} from '../../types';
import { EntityMiniPreview } from '../EntityMiniPreview';
import { SpawnLocationPicker } from '../SpawnLocationPicker';
import { invalidateCustomParticleSprite } from '../../utils/particleSystem';
import { soundSynth } from '../../utils/sound';
import { EntityOption, ParticleDrawingTarget, WizardData } from './ruleBookTypes';
import { useSceneStore, EMPTY_RECORD, EMPTY_LIST } from '../../store/useSceneStore';

interface WizardStep3ActionsProps {
  activeWizard: WizardData;
  setActiveWizard: React.Dispatch<React.SetStateAction<WizardData | null>>;
  isWizardGlobal: boolean;
  isWizardRelational: boolean;
  entities: Record<string, Entity>;
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

export function WizardStep3Actions({
  activeWizard,
  setActiveWizard,
  isWizardGlobal,
  isWizardRelational,
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
  completeWizardWithAction,
}: WizardStep3ActionsProps) {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const scenes = useSceneStore((s) => s.scenes || EMPTY_LIST);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();
  return (
    <div>
      {/* Mode Principal Étape 3 */}
      {activeWizard.actionSubStep === 'main' && (() => {
        const wizardSubjectEntity = getEntityObj(activeWizard.subjectType);
        const wizardSubjectOpt = availableEntityOptions.find((o) => o.type === activeWizard.subjectType);
        const wizardSubjectName = wizardSubjectEntity?.name || wizardSubjectOpt?.label || activeWizard.subjectType;

        const wizardTargetEntity = getEntityObj(activeWizard.targetType);
        const wizardTargetOpt = availableEntityOptions.find((o) => o.type === activeWizard.targetType);
        const wizardTargetName = wizardTargetEntity?.name || wizardTargetOpt?.label || activeWizard.targetType;
        const isCollision = isWizardRelational;

        return (
          <div className="space-y-4">
            {/* Option Auto-remise (Restauration Automatique) */}
            <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 shadow-2xs">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">↩️</span>
                <div>
                  <div className="text-xs font-black text-emerald-950">
                    Restauration Automatique (Auto-remise)
                  </div>
                  <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                    Rétablit automatiquement l'état initial lors de la fin de l'événement (relâchement du clic, sortie de survol, etc.)
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, autoRevert: !activeWizard.autoRevert })}
                className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer border shrink-0 ${
                  activeWizard.autoRevert
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                    : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                }`}
              >
                {activeWizard.autoRevert ? '✓ Restauration Active' : 'Désactivée'}
              </button>
            </div>

            <div className={`grid grid-cols-1 ${isCollision ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'} gap-4 items-start`}>
              {!isWizardGlobal ? (
                <>
                  {/* SECTION 1 : SUJET */}
                  <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                    {/* En-tête Sujet avec miniature et nom de l'entité */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                      <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                        <EntityMiniPreview
                          entity={wizardSubjectEntity}
                          type={activeWizard.subjectType}
                          stateId={activeWizard.subjectStateId}
                          size={36}
                        />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                            Sujet (Qui agit)
                          </span>
                        </div>
                        <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={wizardSubjectName}>
                          {wizardSubjectName}
                        </div>
                      </div>
                    </div>

                    {/* Actions sur le Sujet */}
                    <div className="space-y-2.5 flex-1">
                      {/* 1. Changer l'état du Sujet */}
                      <button
                        type="button"
                        onClick={() => {
                          const statesList = wizardSubjectEntity ? Object.values(wizardSubjectEntity.states) : [];
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
                            Transformer « {wizardSubjectName} »
                          </div>
                        </div>
                      </button>

                      {/* 2. Basculer l'état (Toggle ⇄ / Cycle) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            actionSubStep: 'toggle_entity_picker',
                          });
                        }}
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
                            Alterner A ⇄ B sur « {wizardSubjectName} »
                          </div>
                        </div>
                      </button>

                      {/* 3. Déplacer le Sujet de X px */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            actionSubStep: 'move_entity_picker',
                            actionTargetMode: 'subject',
                            moveDistance: activeWizard.moveDistance ?? 40,
                            moveDirectionMode: activeWizard.moveDirectionMode || 'cardinal',
                            moveCardinal: activeWizard.moveCardinal || 'right',
                            moveAngle: activeWizard.moveAngle ?? 0,
                            moveApplyMode: activeWizard.moveApplyMode || 'instant',
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
                          completeWizardWithAction({
                            type: 'delete_entity',
                            targetMode: 'subject',
                            targetType: activeWizard.subjectType,
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
                            Faire disparaître « {wizardSubjectName} »
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                /* SECTION 1 (Globale) : ACTIONS SUR UN OBJET AU CHOIX */
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 border border-indigo-200 flex items-center justify-center text-xl shrink-0">
                      ⚡
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                        Condition Globale
                      </span>
                      <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                        Agir sur un objet de la scène
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2.5 flex-1">
                    <button
                      type="button"
                      onClick={() => setActiveWizard({ ...activeWizard, actionSubStep: 'third_party_entity_picker' })}
                      className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                        🔄
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                          Changer l'état d'un objet
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Choisir l'objet à transformer →
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveWizard({ ...activeWizard, actionSubStep: 'toggle_entity_picker' })}
                      className="w-full p-3.5 bg-white hover:bg-violet-50/70 border-2 border-slate-200 hover:border-violet-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0">
                        🔀
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-violet-700 truncate">
                          Basculer l'état (Toggle ⇄)
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Alterner A ⇄ B sur un objet →
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        setActiveWizard({
                          ...activeWizard,
                          actionSubStep: 'move_entity_picker',
                          actionTargetMode: 'type',
                          actionTargetType: activeWizard.actionTargetType || availableEntityOptions[0]?.type,
                          moveDistance: activeWizard.moveDistance ?? 40,
                          moveDirectionMode: activeWizard.moveDirectionMode || 'cardinal',
                          moveCardinal: activeWizard.moveCardinal || 'right',
                          moveAngle: activeWizard.moveAngle ?? 0,
                          moveApplyMode: activeWizard.moveApplyMode || 'instant',
                        })
                      }
                      className="w-full p-3.5 bg-white hover:bg-sky-50/70 border-2 border-slate-200 hover:border-sky-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0">
                        🏃
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-sky-700 truncate">
                          Déplacer un objet de X px
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Décaler ou propulser une entité →
                        </div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setActiveWizard({ ...activeWizard, actionSubStep: 'third_party_destroy_picker' })}
                      className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                    >
                      <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0">
                        💥
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                          Détruire un objet
                        </div>
                        <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                          Choisir l'objet à supprimer →
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* SECTION 2 : CIBLE (Si Collision) */}
              {isCollision && (
                <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                  {/* En-tête Cible avec miniature et nom de l'entité */}
                  <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                    <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                      <EntityMiniPreview
                        entity={wizardTargetEntity}
                        type={activeWizard.targetType}
                        stateId={activeWizard.targetStateId}
                        size={36}
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                          Cible (Touchée)
                        </span>
                      </div>
                      <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={wizardTargetName}>
                        {wizardTargetName}
                      </div>
                    </div>
                  </div>

                  {/* Actions sur la Cible */}
                  <div className="space-y-2.5 flex-1">
                    {/* 1. Changer l'état de la Cible */}
                    <button
                      type="button"
                      onClick={() => {
                        const statesList = wizardTargetEntity ? Object.values(wizardTargetEntity.states) : [];
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
                          Transformer « {wizardTargetName} »
                        </div>
                      </div>
                    </button>

                    {/* 2. Déplacer la Cible de X px */}
                    <button
                      type="button"
                      onClick={() => {
                        setActiveWizard({
                          ...activeWizard,
                          actionSubStep: 'move_entity_picker',
                          actionTargetMode: 'target',
                          moveDistance: activeWizard.moveDistance ?? 40,
                          moveDirectionMode: activeWizard.moveDirectionMode || 'cardinal',
                          moveCardinal: activeWizard.moveCardinal || 'right',
                          moveAngle: activeWizard.moveAngle ?? 0,
                          moveApplyMode: activeWizard.moveApplyMode || 'instant',
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
                          Pousser ou décaler « {wizardTargetName} »
                        </div>
                      </div>
                    </button>

                    {/* 3. Détruire la Cible */}
                    <button
                      type="button"
                      onClick={() => {
                        completeWizardWithAction({
                          type: 'delete_entity',
                          targetMode: 'target',
                          targetType: activeWizard.targetType,
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
                          Faire disparaître « {wizardTargetName} »
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
                        Monde &amp; Effets
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                      Apparitions, sons &amp; tiers
                    </div>
                  </div>
                </div>

                {/* Actions Monde & Effets */}
                <div className="space-y-2.5 flex-1">
                  {/* 1. Créer un nouvel Objet (Spawn) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'spawn_entity_picker',
                      });
                    }}
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

                  {/* 2. Jouer un effet sonore */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'sound_picker',
                      });
                    }}
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
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'delay_duration_picker',
                        delayDuration: activeWizard.delayDuration || 1,
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

                  {/* 3. Changer un Autre Objet (Tierce) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'third_party_entity_picker',
                      });
                    }}
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

                  {/* 4. Détruire un Autre Objet (Tierce) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'third_party_destroy_picker',
                      });
                    }}
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

                  {/* 4.5. Ajouter au Score (+1) */}
                  <button
                    type="button"
                    onClick={() => {
                      completeWizardWithAction({
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

                  {/* 4.6. Modifier une Variable */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'variable_action_picker',
                        variableName: activeWizard.variableName || 'score',
                        variableOperation: activeWizard.variableOperation || 'set',
                        variableValue: activeWizard.variableValue ?? 1,
                      });
                    }}
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

                  {/* 4.7. Changer de Scène */}
                  <button
                    type="button"
                    onClick={() => {
                      const defaultTarget =
                        scenes.find((s) => s.id !== activeSceneId)?.id || scenes[0]?.id || 'scene-1';
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'scene_action_picker',
                        targetSceneId: activeWizard.targetSceneId || defaultTarget,
                        sceneTransition: activeWizard.sceneTransition || 'fade',
                        sceneTransitionDuration: activeWizard.sceneTransitionDuration ?? 0.45,
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

                  {/* 5. Émettre des Particules */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'particle_picker',
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
                      });
                    }}
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

                  {/* 6. Attacher à un Parent (Parenting) */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'attach_parent_picker',
                        parentChildMode: 'subject',
                        parentTargetMode: isCollision ? 'target' : 'entity',
                        parentEntityId: Object.keys(entities)[0] || '',
                        parentOffset: { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true },
                      });
                    }}
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

                  {/* 7. Détacher du Parent */}
                  <button
                    type="button"
                    onClick={() => {
                      setActiveWizard({
                        ...activeWizard,
                        actionSubStep: 'detach_parent_picker',
                        actionTargetMode: 'subject',
                      });
                    }}
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
        );
      })()}

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

      {/* Sous-étape : Choix de l'objet pour Détruire un Objet Tierce */}
      {activeWizard.actionSubStep === 'third_party_destroy_picker' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-600">
            Choisissez quel objet (ou groupe d'instances dynamiques) détruire :
          </div>

          {/* Pistes C & A : Dernier objet créé ou Tag dynamique */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80">
            <button
              type="button"
              onClick={() => {
                completeWizardWithAction({
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
                <div className="text-[10px] text-slate-500">Cible la dernière instance apparue en jeu</div>
              </div>
            </button>

            <div className="p-2.5 bg-white border border-indigo-200 rounded-2xl flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-black text-slate-800">🏷️ Par Tag (#tag)</div>
                <input
                  type="text"
                  value={activeWizard.actionTargetTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetTag: e.target.value.replace(/^#/, '') })}
                  placeholder="ex: projectile, piece..."
                  className="w-full mt-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                />
              </div>
              <button
                type="button"
                disabled={!activeWizard.actionTargetTag?.trim()}
                onClick={() => {
                  if (!activeWizard.actionTargetTag?.trim()) return;
                  completeWizardWithAction({
                    type: 'delete_entity',
                    targetMode: 'tag',
                    targetTag: activeWizard.actionTargetTag.trim().replace(/^#/, ''),
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
                    completeWizardWithAction({
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
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Sous-étape : Choix de l'objet pour Toggle / Cycle */}
      {activeWizard.actionSubStep === 'toggle_entity_picker' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-600">
            Sur quel objet basculer l'état (Toggle / Cycle) ?
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
                      setActiveWizard({
                        ...activeWizard,
                        actionTargetType: opt.type,
                        actionSubStep: 'toggle_states_picker',
                      });
                    } else {
                      completeWizardWithAction({
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

      {/* Sous-étape : Choix des états pour Toggle / Cycle */}
      {activeWizard.actionSubStep === 'toggle_states_picker' && (() => {
        const relevantType = activeWizard.actionTargetType || availableEntityOptions[0]?.type || 'apple';
        const ent = getEntityObj(relevantType);
        const states = ent ? Object.values(ent.states) : [];
        const stateA = activeWizard.toggleStateA || states[0]?.id || '';
        const stateB = activeWizard.toggleStateB || (states[1]?.id || states[0]?.id || '');
        const targetState = activeWizard.toggleTargetStateId || (states[1]?.id || states[0]?.id || '');

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
                          setActiveWizard({ ...activeWizard, toggleStateA: e.target.value })
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
                          setActiveWizard({ ...activeWizard, toggleStateB: e.target.value })
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
                      completeWizardWithAction({
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
                    Valider la bascule ({ent?.states[stateA]?.name || 'A'} ⇄ {ent?.states[stateB]?.name || 'B'})
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
                        setActiveWizard({ ...activeWizard, toggleTargetStateId: e.target.value })
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
                      completeWizardWithAction({
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
                  completeWizardWithAction({
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

      {/* Sous-étape : Choix de l'objet à faire apparaître (Spawn) */}
      {activeWizard.actionSubStep === 'spawn_entity_picker' && (
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-600">
            Cliquez sur l'objet à faire apparaître :
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
                      setActiveWizard({
                        ...activeWizard,
                        pendingSpawnType: opt.type,
                        actionSubStep: 'spawn_state_picker',
                      });
                    } else {
                      setActiveWizard({
                        ...activeWizard,
                        pendingSpawnType: opt.type,
                        actionSpawnInitialStateId: undefined,
                        actionSubStep: 'spawn_location_picker',
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
      )}

      {/* Sous-étape : Choix de l'état initial pour l'objet créé (Spawn State Picker) */}
      {activeWizard.actionSubStep === 'spawn_state_picker' && (() => {
        const spawnType = activeWizard.pendingSpawnType || availableEntityOptions[0]?.type || 'apple';
        const ent = getEntityObj(spawnType);
        const states = ent ? Object.values(ent.states) : [];

        return (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-600">
              Choisissez l'état dans lequel « {ent?.name || spawnType} » va apparaître :
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {states.map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setActiveWizard({
                      ...activeWizard,
                      actionSpawnInitialStateId: st.id,
                      actionSubStep: 'spawn_location_picker',
                    });
                  }}
                  className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                >
                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                    <EntityMiniPreview entity={ent} type={spawnType} stateId={st.id} size={52} />
                  </div>
                  <div className="text-xs font-black text-slate-800 group-hover:text-amber-700">
                    État {st.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Sous-étape : Choix de l'emplacement de spawn avec SpawnLocationPicker */}
      {activeWizard.actionSubStep === 'spawn_location_picker' && (
        <div className="space-y-3">
          <div className="text-xs font-bold text-slate-600">
            Où faire apparaître {getEntityObj(activeWizard.pendingSpawnType)?.name || activeWizard.pendingSpawnType} ?
          </div>
          <SpawnLocationPicker
            isCollision={isWizardRelational}
            subjectEntity={getEntityObj(activeWizard.subjectType)}
            targetEntity={getEntityObj(activeWizard.targetType)}
            spawnEntity={getEntityObj(activeWizard.pendingSpawnType)}
            initialMode={isWizardRelational ? 'at_target' : 'at_subject'}
            initialStateId={activeWizard.actionSpawnInitialStateId}
            onConfirm={(data) => {
              completeWizardWithAction({
                type: 'spawn_entity',
                spawnEntityType: activeWizard.pendingSpawnType,
                spawnInitialStateId: data.spawnInitialStateId || activeWizard.actionSpawnInitialStateId,
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
              setActiveWizard({ ...activeWizard, actionSubStep: 'spawn_entity_picker' });
            }}
          />
        </div>
      )}

      {/* Sous-étape : Choix du son */}
      {activeWizard.actionSubStep === 'sound_picker' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="text-xs font-bold text-slate-600">
              Cliquez sur l'effet sonore à jouer :
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
                      completeWizardWithAction({
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
            Sons Prédéfinis
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

      {/* Étape dédiée : Configuration de la durée du Délai (Attendre / Pause) */}
      {activeWizard.actionSubStep === 'delay_duration_picker' && (
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
                const isSelected = (activeWizard.delayDuration || 1) === p.sec;
                return (
                  <button
                    key={p.sec}
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, delayDuration: p.sec })}
                    className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105 font-black'
                        : 'bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-700 font-bold'
                    }`}
                  >
                    <div className="text-xs">{p.label}</div>
                    <div className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>{p.sub}</div>
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
                  value={activeWizard.delayDuration ?? 1}
                  onChange={(e) => {
                    const val = Math.max(0.1, Math.min(60, parseFloat(e.target.value) || 0.1));
                    setActiveWizard({ ...activeWizard, delayDuration: Math.round(val * 10) / 10 });
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
              value={activeWizard.delayDuration ?? 1}
              onChange={(e) => {
                const val = parseFloat(e.target.value) || 1;
                setActiveWizard({ ...activeWizard, delayDuration: Math.round(val * 10) / 10 });
              }}
              className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
            />
          </div>

          <button
            type="button"
            onClick={() => {
              completeWizardWithAction({
                type: 'delay',
                delayDuration: activeWizard.delayDuration ?? 1,
              });
            }}
            className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider ce délai ({activeWizard.delayDuration ?? 1}s)</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Émettre des Particules */}
      {activeWizard.actionSubStep === 'particle_picker' && (
        <div className="space-y-4 max-w-xl mx-auto py-2">
          <div className="flex flex-wrap gap-2">
            {[
              { label: '🔥 Étincelles', count: 16, color: '#f59e0b', color2: '#ef4444', shape: 'spark' as ParticleShape, speed: 220, gravity: 280, spread: 140 },
              { label: '💥 Explosion', count: 28, color: '#ef4444', color2: '#fbbf24', shape: 'circle' as ParticleShape, speed: 260, gravity: 180, spread: 360 },
              { label: '✨ Magie', count: 20, color: '#8b5cf6', color2: '#ec4899', shape: 'star' as ParticleShape, speed: 140, gravity: -60, spread: 360 },
              { label: '🎉 Confettis', count: 32, color: '#10b981', color2: '#3b82f6', shape: 'square' as ParticleShape, speed: 210, gravity: 240, spread: 180 },
            ].map((preset) => (
              <button
                key={preset.label}
                type="button"
                onClick={() =>
                  setActiveWizard({
                    ...activeWizard,
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
                value={activeWizard.particleOriginMode || 'subject'}
                onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="subject">Sujet</option>
                {(activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity') && (
                  <option value="target">Cible touchée</option>
                )}
                <option value="event_point">💥 Point exact (Collision / Clic)</option>
                <option value="entity">Entité de la scène</option>
                <option value="type">Par Type d'objet</option>
                <option value="tag">Par #Tag</option>
                <option value="last_spawned">Dernier objet créé</option>
              </select>
            </div>

            {activeWizard.particleOriginMode === 'entity' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Entité source</span>
                <select
                  value={activeWizard.particleOriginEntityId || Object.keys(entities)[0] || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginEntityId: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {Object.values(entities).map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeWizard.particleOriginMode === 'type' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Type source</span>
                <select
                  value={activeWizard.particleOriginEntityType || availableEntityOptions[0]?.type || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginEntityType: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {activeWizard.particleOriginMode === 'tag' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Tag source (#tag)</span>
                <input
                  type="text"
                  list="wizard-particle-tags"
                  value={activeWizard.particleOriginTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginTag: e.target.value.replace(/^#/, '') })}
                  placeholder="ex: joueur, ennemi..."
                  className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                />
                <datalist id="wizard-particle-tags">
                  {allProjectTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            )}

            <button
              type="button"
              onClick={() => setParticleEditorContext('wizard')}
              className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>Ouvrir l'Éditeur &amp; Testeur Visuel</span>
            </button>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Forme</span>
              <select
                value={activeWizard.particleShape || 'circle'}
                onChange={(e) => {
                  const nextShape = e.target.value as ParticleShape;
                  const existing =
                    activeWizard.customParticleIds && activeWizard.customParticleIds.length > 0
                      ? activeWizard.customParticleIds
                      : activeWizard.customParticleId
                      ? [activeWizard.customParticleId]
                      : [];
                  const nextIds =
                    nextShape === 'custom' && existing.length === 0 && customParticles.length > 0
                      ? [customParticles[0].id]
                      : existing;
                  setActiveWizard({
                    ...activeWizard,
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

            {activeWizard.particleShape === 'custom' && (() => {
              const wizSelectedIds: string[] =
                activeWizard.customParticleIds && activeWizard.customParticleIds.length > 0
                  ? activeWizard.customParticleIds
                  : activeWizard.customParticleId
                  ? [activeWizard.customParticleId]
                  : [];
              const toggleWizPreset = (pid: string) => {
                const nextIds = wizSelectedIds.includes(pid)
                  ? wizSelectedIds.filter((id) => id !== pid)
                  : [...wizSelectedIds, pid];
                setActiveWizard({
                  ...activeWizard,
                  customParticleIds: nextIds,
                  customParticleId: nextIds[0],
                });
              };
              return (
                <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold text-amber-950">
                      Particules ({wizSelectedIds.length} sél.) :
                    </span>
                    <button
                      type="button"
                      onClick={() => setParticleDrawingTarget({ context: 'wizard' })}
                      className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Paintbrush className="w-3 h-3" />
                      <span>+ Dessiner une particule</span>
                    </button>
                  </div>
                  {customParticles.length === 0 ? (
                    <div className="text-[11px] text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200 text-center">
                      Aucune particule dessinée. Cliquez sur <strong>+ Dessiner une particule</strong>.
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 gap-1.5">
                      {customParticles.map((preset) => {
                        const selIdx = wizSelectedIds.indexOf(preset.id);
                        const isSel = selIdx !== -1;
                        return (
                          <div
                            key={preset.id}
                            onClick={() => toggleWizPreset(preset.id)}
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
                                  setParticleDrawingTarget({ context: 'wizard', editingPreset: preset });
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
                                    const nextIds = wizSelectedIds.filter((id) => id !== preset.id);
                                    setActiveWizard({
                                      ...activeWizard,
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
                  {wizSelectedIds.length > 1 && (
                    <div className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-slate-700">Utilisation :</span>
                      <select
                        value={activeWizard.customParticleMode || 'random'}
                        onChange={(e) =>
                          setActiveWizard({
                            ...activeWizard,
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
                    <span className="text-[11px] font-bold text-slate-700">Teinter avec les couleurs d'émission</span>
                    <input
                      type="checkbox"
                      checked={activeWizard.useParticleTint === true}
                      onChange={(e) => setActiveWizard({ ...activeWizard, useParticleTint: e.target.checked })}
                      className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                    />
                  </div>
                </div>
              );
            })()}

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Nombre ({activeWizard.particleCount ?? 20})</span>
              <input
                type="range"
                min="4"
                max="50"
                step="2"
                value={activeWizard.particleCount ?? 20}
                onChange={(e) => setActiveWizard({ ...activeWizard, particleCount: parseInt(e.target.value, 10) })}
                className="w-40 accent-amber-500"
              />
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Couleurs (Mix)</span>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={activeWizard.particleColor || '#f59e0b'}
                  onChange={(e) => setActiveWizard({ ...activeWizard, particleColor: e.target.value })}
                  className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                />
                <input
                  type="color"
                  value={activeWizard.particleColor2 || '#ef4444'}
                  onChange={(e) => setActiveWizard({ ...activeWizard, particleColor2: e.target.value })}
                  className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Taille ({activeWizard.particleSize ?? 6} px)</span>
              <input
                type="range"
                min="2"
                max="24"
                step="1"
                value={activeWizard.particleSize ?? 6}
                onChange={(e) => setActiveWizard({ ...activeWizard, particleSize: parseFloat(e.target.value) })}
                className="w-40 accent-indigo-600"
              />
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Vitesse ({activeWizard.particleSpeed ?? 180} px/s)</span>
              <input
                type="range"
                min="40"
                max="450"
                step="10"
                value={activeWizard.particleSpeed ?? 180}
                onChange={(e) => setActiveWizard({ ...activeWizard, particleSpeed: parseFloat(e.target.value) })}
                className="w-40 accent-indigo-600"
              />
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Gravité ({activeWizard.particleGravity ?? 220})</span>
              <input
                type="range"
                min="-200"
                max="500"
                step="20"
                value={activeWizard.particleGravity ?? 220}
                onChange={(e) => setActiveWizard({ ...activeWizard, particleGravity: parseFloat(e.target.value) })}
                className="w-40 accent-indigo-600"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              const pOriginMode = activeWizard.particleOriginMode || 'subject';
              const selectedIds =
                activeWizard.customParticleIds && activeWizard.customParticleIds.length > 0
                  ? activeWizard.customParticleIds
                  : activeWizard.customParticleId
                  ? [activeWizard.customParticleId]
                  : undefined;
              completeWizardWithAction({
                type: 'emit_particles',
                particleOriginMode: pOriginMode,
                particleOriginEntityId:
                  pOriginMode === 'entity'
                    ? activeWizard.particleOriginEntityId || Object.keys(entities)[0]
                    : undefined,
                particleOriginEntityType:
                  pOriginMode === 'type'
                    ? activeWizard.particleOriginEntityType || availableEntityOptions[0]?.type
                    : undefined,
                particleOriginTag:
                  pOriginMode === 'tag'
                    ? (activeWizard.particleOriginTag || '').trim().replace(/^#/, '')
                    : undefined,
                particleCount: activeWizard.particleCount ?? 20,
                particleColor: activeWizard.particleColor ?? '#f59e0b',
                particleColor2: activeWizard.particleColor2 ?? '#ef4444',
                particleShape: activeWizard.particleShape ?? 'circle',
                customParticleId:
                  activeWizard.particleShape === 'custom' ? selectedIds?.[0] : undefined,
                customParticleIds:
                  activeWizard.particleShape === 'custom' ? selectedIds : undefined,
                customParticleMode:
                  activeWizard.particleShape === 'custom' ? (activeWizard.customParticleMode || 'random') : undefined,
                useParticleTint:
                  activeWizard.particleShape === 'custom' ? Boolean(activeWizard.useParticleTint) : undefined,
                particleSpeed: activeWizard.particleSpeed ?? 180,
                particleSize: activeWizard.particleSize ?? 6,
                particleLifetime: activeWizard.particleLifetime ?? 0.7,
                particleGravity: activeWizard.particleGravity ?? 220,
                particleSpread: activeWizard.particleSpread ?? 360,
                particleAngle: activeWizard.particleAngle ?? -90,
              });
            }}
            className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider l'effet de particules</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Attacher à un Parent */}
      {activeWizard.actionSubStep === 'attach_parent_picker' && (
        <div className="space-y-4 max-w-xl mx-auto py-2">
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Objet enfant à attacher</span>
              <select
                value={activeWizard.parentChildMode || 'subject'}
                onChange={(e) => setActiveWizard({ ...activeWizard, parentChildMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="subject">Sujet</option>
                {isWizardRelational && <option value="target">Cible touchée</option>}
                <option value="last_spawned">Dernier objet créé</option>
                <option value="tag">Par Tag (#tag)</option>
              </select>
            </div>

            {activeWizard.parentChildMode === 'tag' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Tag enfant</span>
                <input
                  type="text"
                  value={activeWizard.parentChildTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, parentChildTag: e.target.value.replace(/^#/, '') })}
                  placeholder="ex: arme"
                  className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
            )}

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Objet parent (Porteur)</span>
              <select
                value={activeWizard.parentTargetMode || (isWizardRelational ? 'target' : 'entity')}
                onChange={(e) => setActiveWizard({ ...activeWizard, parentTargetMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="subject">Sujet</option>
                {isWizardRelational && <option value="target">Cible touchée</option>}
                <option value="entity">Entité de la scène</option>
                <option value="type">Par Type</option>
                <option value="tag">Par Tag (#tag)</option>
                <option value="last_spawned">Dernier objet créé</option>
              </select>
            </div>

            {activeWizard.parentTargetMode === 'entity' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Choisir parent</span>
                <select
                  value={activeWizard.parentEntityId || Object.keys(entities)[0] || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityId: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {Object.values(entities).map((ent) => (
                    <option key={ent.id} value={ent.id}>{ent.name}</option>
                  ))}
                </select>
              </div>
            )}

            {activeWizard.parentTargetMode === 'type' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Type parent</span>
                <select
                  value={activeWizard.parentEntityType || availableEntityOptions[0]?.type || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityType: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}

            {activeWizard.parentTargetMode === 'tag' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Tag parent</span>
                <input
                  type="text"
                  value={activeWizard.parentEntityTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityTag: e.target.value.replace(/^#/, '') })}
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
                  value={activeWizard.parentOffset?.x ?? 0}
                  onChange={(e) =>
                    setActiveWizard({
                      ...activeWizard,
                      parentOffset: {
                        x: parseFloat(e.target.value) || 0,
                        y: activeWizard.parentOffset?.y ?? 0,
                        inheritRotation: activeWizard.parentOffset?.inheritRotation ?? true,
                        inheritFlip: activeWizard.parentOffset?.inheritFlip ?? true,
                      },
                    })
                  }
                  className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                />
                <input
                  type="number"
                  value={activeWizard.parentOffset?.y ?? 0}
                  onChange={(e) =>
                    setActiveWizard({
                      ...activeWizard,
                      parentOffset: {
                        x: activeWizard.parentOffset?.x ?? 0,
                        y: parseFloat(e.target.value) || 0,
                        inheritRotation: activeWizard.parentOffset?.inheritRotation ?? true,
                        inheritFlip: activeWizard.parentOffset?.inheritFlip ?? true,
                      },
                    })
                  }
                  className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">Hériter rotation &amp; Flip du parent</span>
              <input
                type="checkbox"
                checked={activeWizard.parentOffset?.inheritRotation !== false}
                onChange={(e) =>
                  setActiveWizard({
                    ...activeWizard,
                    parentOffset: {
                      x: activeWizard.parentOffset?.x ?? 0,
                      y: activeWizard.parentOffset?.y ?? 0,
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
              completeWizardWithAction({
                type: 'attach_to_parent',
                targetMode: activeWizard.parentChildMode || 'subject',
                targetTag: activeWizard.parentChildMode === 'tag' ? activeWizard.parentChildTag : undefined,
                parentTargetMode: activeWizard.parentTargetMode || 'entity',
                parentEntityId: activeWizard.parentTargetMode === 'entity' ? activeWizard.parentEntityId || Object.keys(entities)[0] : undefined,
                parentEntityType: activeWizard.parentTargetMode === 'type' ? activeWizard.parentEntityType || availableEntityOptions[0]?.type : undefined,
                parentEntityTag: activeWizard.parentTargetMode === 'tag' ? activeWizard.parentEntityTag : undefined,
                parentOffset: activeWizard.parentOffset,
              });
            }}
            className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider l'attachement</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Détacher du Parent */}
      {activeWizard.actionSubStep === 'detach_parent_picker' && (
        <div className="space-y-4 max-w-xl mx-auto py-2">
          <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Objet à détacher</span>
              <select
                value={activeWizard.actionTargetMode || 'subject'}
                onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="subject">Sujet</option>
                {isWizardRelational && <option value="target">Cible touchée</option>}
                <option value="last_spawned">Dernier objet créé</option>
                <option value="tag">Par Tag (#tag)</option>
                <option value="type">Par Type</option>
              </select>
            </div>

            {activeWizard.actionTargetMode === 'tag' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Tag à détacher</span>
                <input
                  type="text"
                  value={activeWizard.actionTargetTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetTag: e.target.value.replace(/^#/, '') })}
                  placeholder="ex: arme"
                  className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
            )}

            {activeWizard.actionTargetMode === 'type' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Type à détacher</span>
                <select
                  value={activeWizard.actionTargetType || availableEntityOptions[0]?.type || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetType: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              completeWizardWithAction({
                type: 'detach_parent',
                targetMode: activeWizard.actionTargetMode || 'subject',
                targetTag: activeWizard.actionTargetMode === 'tag' ? activeWizard.actionTargetTag : undefined,
                targetType: activeWizard.actionTargetMode === 'type' ? activeWizard.actionTargetType || availableEntityOptions[0]?.type : undefined,
              });
            }}
            className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider le détachement</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Déplacer de X px dans une direction */}
      {activeWizard.actionSubStep === 'move_entity_picker' && (
        <div className="space-y-4 max-w-xl mx-auto py-2">
          <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Entité à déplacer</span>
              <select
                value={activeWizard.actionTargetMode || (isWizardGlobal ? 'type' : 'subject')}
                onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                {!isWizardGlobal && <option value="subject">Sujet</option>}
                {isWizardRelational && <option value="target">Cible touchée</option>}
                <option value="last_spawned">Dernier objet créé</option>
                <option value="tag">Par Tag (#tag)</option>
                <option value="type">Par Type</option>
              </select>
            </div>

            {activeWizard.actionTargetMode === 'tag' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Tag à déplacer</span>
                <input
                  type="text"
                  value={activeWizard.actionTargetTag || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetTag: e.target.value.replace(/^#/, '') })}
                  placeholder="ex: joueur"
                  className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                />
              </div>
            )}

            {activeWizard.actionTargetMode === 'type' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Type à déplacer</span>
                <select
                  value={activeWizard.actionTargetType || availableEntityOptions[0]?.type || ''}
                  onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetType: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>{opt.label}</option>
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
                  value={activeWizard.moveDistance ?? 40}
                  onChange={(e) => setActiveWizard({ ...activeWizard, moveDistance: parseFloat(e.target.value) || 0 })}
                  className="w-32 accent-sky-600"
                />
                <input
                  type="number"
                  value={activeWizard.moveDistance ?? 40}
                  onChange={(e) => setActiveWizard({ ...activeWizard, moveDistance: parseFloat(e.target.value) || 0 })}
                  className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                />
              </div>
            </div>

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Direction</span>
              <select
                value={activeWizard.moveDirectionMode || 'cardinal'}
                onChange={(e) => setActiveWizard({ ...activeWizard, moveDirectionMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                <option value="cardinal">Direction cardinale (H / B / G / D)</option>
                <option value="angle">Angle libre (degrés °)</option>
                <option value="facing">Direction du regard / rotation</option>
                <option value="toward_target">Vers une entité / cible</option>
                <option value="away_target">S'éloigner d'une entité / cible</option>
              </select>
            </div>

            {(activeWizard.moveDirectionMode || 'cardinal') === 'cardinal' && (
              <div className="grid grid-cols-4 gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
                {([
                  { id: 'left', label: '← Gauche' },
                  { id: 'right', label: '→ Droite' },
                  { id: 'up', label: '↑ Haut' },
                  { id: 'down', label: '↓ Bas' },
                ] as const).map((dir) => (
                  <button
                    key={dir.id}
                    type="button"
                    onClick={() => setActiveWizard({ ...activeWizard, moveCardinal: dir.id })}
                    className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                      (activeWizard.moveCardinal || 'right') === dir.id
                        ? 'bg-sky-600 text-white border-sky-700 shadow-2xs'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {dir.label}
                  </button>
                ))}
              </div>
            )}

            {activeWizard.moveDirectionMode === 'angle' && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-xs">Angle ({activeWizard.moveAngle ?? 0}°)</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="5"
                    value={activeWizard.moveAngle ?? 0}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveAngle: parseFloat(e.target.value) || 0 })}
                    className="w-32 accent-sky-600"
                  />
                  <input
                    type="number"
                    value={activeWizard.moveAngle ?? 0}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveAngle: parseFloat(e.target.value) || 0 })}
                    className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                  />
                </div>
              </div>
            )}

            {(activeWizard.moveDirectionMode === 'toward_target' || activeWizard.moveDirectionMode === 'away_target') && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-700 text-xs">Entité de référence</span>
                  <select
                    value={activeWizard.moveTargetMode || (isWizardRelational ? 'target' : 'entity')}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveTargetMode: e.target.value as any })}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {!isWizardGlobal && <option value="subject">Sujet</option>}
                    {isWizardRelational && <option value="target">Cible touchée</option>}
                    <option value="last_spawned">Dernier objet créé</option>
                    <option value="mouse">Souris (curseur)</option>
                    <option value="entity">Instance précise</option>
                    <option value="type">Par Type</option>
                    <option value="tag">Par Tag (#tag)</option>
                  </select>
                </div>
                {activeWizard.moveTargetMode === 'entity' && (
                  <select
                    value={activeWizard.moveTargetEntityId || Object.keys(entities)[0] || ''}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveTargetEntityId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {Object.values(entities).map((ent) => (
                      <option key={ent.id} value={ent.id}>{ent.name}</option>
                    ))}
                  </select>
                )}
                {activeWizard.moveTargetMode === 'type' && (
                  <select
                    value={activeWizard.moveTargetEntityType || availableEntityOptions[0]?.type || ''}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveTargetEntityType: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {availableEntityOptions.map((opt) => (
                      <option key={opt.type} value={opt.type}>{opt.label}</option>
                    ))}
                  </select>
                )}
                {activeWizard.moveTargetMode === 'tag' && (
                  <input
                    type="text"
                    value={activeWizard.moveTargetTag || ''}
                    onChange={(e) => setActiveWizard({ ...activeWizard, moveTargetTag: e.target.value.replace(/^#/, '') })}
                    placeholder="ex: joueur"
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  />
                )}
              </div>
            )}

            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Mode de déplacement</span>
              <select
                value={activeWizard.moveApplyMode || 'instant'}
                onChange={(e) => setActiveWizard({ ...activeWizard, moveApplyMode: e.target.value as any })}
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
              const targetMode = activeWizard.actionTargetMode || 'subject';
              completeWizardWithAction({
                type: 'move_entity',
                targetMode,
                targetType:
                  targetMode === 'type'
                    ? activeWizard.actionTargetType || availableEntityOptions[0]?.type
                    : targetMode === 'target'
                    ? activeWizard.targetType
                    : activeWizard.subjectType,
                targetTag: targetMode === 'tag' ? activeWizard.actionTargetTag : undefined,
                moveDistance: activeWizard.moveDistance ?? 40,
                moveDirectionMode: activeWizard.moveDirectionMode || 'cardinal',
                moveCardinal: activeWizard.moveCardinal || 'right',
                moveAngle: activeWizard.moveAngle ?? 0,
                moveApplyMode: activeWizard.moveApplyMode || 'instant',
                moveTargetMode: activeWizard.moveTargetMode,
                moveTargetEntityId: activeWizard.moveTargetEntityId,
                moveTargetEntityType: activeWizard.moveTargetEntityType,
                moveTargetTag: activeWizard.moveTargetTag,
              });
            }}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider le déplacement</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Modifier une Variable */}
      {activeWizard.actionSubStep === 'variable_action_picker' && (
        <div className="space-y-4 max-w-lg mx-auto py-2">
          <div className="text-center space-y-1">
            <div className="w-12 h-12 bg-sky-100 text-sky-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
              📊
            </div>
            <h4 className="text-sm font-black text-slate-800">Modifier une Variable</h4>
            <p className="text-xs text-slate-500">
              Changez la valeur d'une variable de jeu (ou du score) lorsque cette règle se déclenche.
            </p>
          </div>

          <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Nom de la variable :</label>
              <input
                type="text"
                list="wizard-action-vars"
                value={activeWizard.variableName ?? 'score'}
                onChange={(e) => setActiveWizard({ ...activeWizard, variableName: e.target.value })}
                placeholder="ex: score, vies, slider_x..."
                className="w-full px-3 py-2 text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-sky-400"
              />
              <datalist id="wizard-action-vars">
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
                    onClick={() => setActiveWizard({ ...activeWizard, variableOperation: op.id })}
                    className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      (activeWizard.variableOperation || 'set') === op.id
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
                value={activeWizard.variableValue ?? 1}
                onChange={(e) => {
                  const parsed = parseFloat(e.target.value);
                  setActiveWizard({
                    ...activeWizard,
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
              completeWizardWithAction({
                type: 'set_variable',
                variableName: (activeWizard.variableName || 'score').trim() || 'score',
                variableOperation: activeWizard.variableOperation || 'set',
                variableValue: activeWizard.variableValue ?? 1,
              });
            }}
            className="w-full py-3 bg-sky-600 hover:bg-sky-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider l'action Variable</span>
          </button>
        </div>
      )}

      {/* Sous-étape Wizard : Changer de Scène */}
      {activeWizard.actionSubStep === 'scene_action_picker' && (
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
                value={activeWizard.targetSceneId || scenes[0]?.id || 'scene-1'}
                onChange={(e) => setActiveWizard({ ...activeWizard, targetSceneId: e.target.value })}
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
                {([
                  { id: 'fade', label: '🌑 Fondu' },
                  { id: 'slide_left', label: '⬅️ Glissé Gauche' },
                  { id: 'slide_right', label: '➡️ Glissé Droit' },
                  { id: 'iris', label: '🎯 Iris' },
                  { id: 'none', label: '⚡ Instantané' },
                ] as const).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() =>
                      setActiveWizard({ ...activeWizard, sceneTransition: t.id as SceneTransitionType })
                    }
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                      (activeWizard.sceneTransition || 'fade') === t.id
                        ? 'bg-violet-600 text-white border-violet-700 shadow-2xs'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-violet-50'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {(activeWizard.sceneTransition || 'fade') !== 'none' && (
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-bold text-slate-700">Durée de transition :</label>
                  <span className="text-xs font-mono font-black text-violet-700">
                    {(activeWizard.sceneTransitionDuration ?? 0.45).toFixed(2)}s
                  </span>
                </div>
                <input
                  type="range"
                  min={0.1}
                  max={2}
                  step={0.05}
                  value={activeWizard.sceneTransitionDuration ?? 0.45}
                  onChange={(e) =>
                    setActiveWizard({
                      ...activeWizard,
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
                activeWizard.targetSceneId ||
                scenes.find((s) => s.id !== activeSceneId)?.id ||
                scenes[0]?.id ||
                'scene-1';
              completeWizardWithAction({
                type: 'change_scene',
                targetSceneId: resolvedSceneId,
                sceneTransition: activeWizard.sceneTransition || 'fade',
                sceneTransitionDuration:
                  activeWizard.sceneTransition === 'none'
                    ? 0
                    : activeWizard.sceneTransitionDuration ?? 0.45,
              });
            }}
            className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
          >
            <Check className="w-4 h-4" />
            <span>Valider le changement de scène</span>
          </button>
        </div>
      )}
    </div>
  );
}
