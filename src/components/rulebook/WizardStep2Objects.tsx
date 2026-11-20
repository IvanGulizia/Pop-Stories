import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Entity } from '../../types';
import { EntityMiniPreview } from '../EntityMiniPreview';
import { EntityOption, WizardData } from './ruleBookTypes';

interface WizardStep2ObjectsProps {
  activeWizard: WizardData;
  setActiveWizard: React.Dispatch<React.SetStateAction<WizardData | null>>;
  isWizardGlobal: boolean;
  isWizardRelational: boolean;
  wizardObjectPhase: 'subject' | 'target';
  entities: Record<string, Entity>;
  entityList: Entity[];
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  getEntityObj: (type?: string) => Entity | undefined;
}

export function WizardStep2Objects({
  activeWizard,
  setActiveWizard,
  isWizardGlobal,
  isWizardRelational,
  wizardObjectPhase,
  entities,
  entityList,
  availableEntityOptions,
  allProjectTags,
  getEntityObj,
}: WizardStep2ObjectsProps) {
  if (isWizardGlobal) {
    return (
      <div className="p-8 bg-indigo-50/60 border-2 border-indigo-200 rounded-3xl text-center space-y-4 max-w-lg mx-auto">
        <div className="w-16 h-16 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-3xl mx-auto">
          ⚡
        </div>
        <div>
          <div className="text-sm font-black text-indigo-950">
            Condition Globale — Aucun objet déclencheur requis
          </div>
          <p className="text-xs text-indigo-700 mt-1">
            Les conditions Minuteur, Clavier et Score s'exécutent globalement sans cibler un objet de départ.
          </p>
        </div>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActiveWizard({ ...activeWizard, step: 1, actionSubStep: 'main' })}
            className="px-4 py-2 bg-white border border-indigo-200 text-indigo-700 text-xs font-bold rounded-xl hover:bg-indigo-50 cursor-pointer"
          >
            ← Changer de condition
          </button>
          <button
            type="button"
            onClick={() => setActiveWizard({ ...activeWizard, step: 3, actionSubStep: 'main' })}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl cursor-pointer shadow-xs"
          >
            Passer à l'Action →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Onglets Sujet / Cible lorsque la condition est relationnelle (Collision / Proximité) */}
      {isWizardRelational && (
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            type="button"
            onClick={() =>
              setActiveWizard({
                ...activeWizard,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
              })
            }
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              wizardObjectPhase === 'subject'
                ? 'bg-white text-indigo-700 shadow-xs ring-1 ring-indigo-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>
              {activeWizard.triggerType === 'target_arrived'
                ? '1️⃣ Objet qui arrive (Sujet)'
                : '1️⃣ Objet Sujet (qui touche / approche)'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
              {activeWizard.subjectMode === 'any'
                ? 'Tous'
                : activeWizard.subjectMode === 'tag'
                ? `#${activeWizard.subjectTag || 'tag'}`
                : activeWizard.subjectMode === 'instance'
                ? entities[activeWizard.subjectId || '']?.name || 'Instance'
                : getEntityObj(activeWizard.subjectType)?.name || activeWizard.subjectType || 'À choisir'}
            </span>
          </button>
          <button
            type="button"
            onClick={() =>
              setActiveWizard({
                ...activeWizard,
                objectPhase: 'target',
                targetSubStep: 'choose_object',
              })
            }
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer ${
              wizardObjectPhase === 'target'
                ? 'bg-white text-emerald-700 shadow-xs ring-1 ring-emerald-200'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>
              {activeWizard.triggerType === 'target_arrived'
                ? '2️⃣ Cible atteinte (Optionnel)'
                : '2️⃣ Objet Cible (touché / approché)'}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700">
              {activeWizard.targetMode === 'any'
                ? 'Tous'
                : activeWizard.targetMode === 'tag'
                ? `#${activeWizard.targetTag || 'tag'}`
                : activeWizard.targetMode === 'instance'
                ? entities[activeWizard.targetId || '']?.name || 'Instance'
                : getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType || 'À choisir'}
            </span>
          </button>
        </div>
      )}

      {/* PHASE A : CHOIX DU SUJET */}
      {(!isWizardRelational || wizardObjectPhase === 'subject') ? (
        activeWizard.subjectSubStep === 'choose_state' ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-600">
              Choisissez si la règle requiert un état précis pour le Sujet {getEntityObj(activeWizard.subjectType)?.name || activeWizard.subjectType} :
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveWizard({
                    ...activeWizard,
                    subjectStateId: undefined,
                    subjectSubStep: 'choose_object',
                    ...(isWizardRelational
                      ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                      : { step: 3, actionSubStep: 'main' }),
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

              {Object.values(getEntityObj(activeWizard.subjectType)?.states || {}).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setActiveWizard({
                      ...activeWizard,
                      subjectStateId: st.id,
                      subjectSubStep: 'choose_object',
                      ...(isWizardRelational
                        ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                        : { step: 3, actionSubStep: 'main' }),
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
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'type' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  (activeWizard.subjectMode || 'type') === 'type'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧩 Par Type
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'tag' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.subjectMode === 'tag'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏷️ Par #Tag
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'instance' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.subjectMode === 'instance'
                    ? 'bg-white text-cyan-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📍 Instance
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'any' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.subjectMode === 'any'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🌐 Tous objets
              </button>
            </div>

            {activeWizard.subjectMode === 'any' ? (
              <button
                type="button"
                onClick={() =>
                  setActiveWizard({
                    ...activeWizard,
                    subjectMode: 'any',
                    subjectType: undefined,
                    subjectId: undefined,
                    subjectTag: undefined,
                    subjectStateId: undefined,
                    ...(isWizardRelational
                      ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                      : { step: 3, actionSubStep: 'main' }),
                  })
                }
                className="w-full p-6 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                    🌐
                  </div>
                  <div>
                    <div className="text-sm font-black text-emerald-950">
                      Tous les objets de la scène
                    </div>
                    <div className="text-xs text-emerald-700 mt-1">
                      La règle s'appliquera à n'importe quelle entité (présente ou créée en cours de partie).
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
              </button>
            ) : activeWizard.subjectMode === 'tag' ? (
              <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
                <div className="text-xs font-bold text-purple-950">
                  Cibler toutes les entités (existantes ou créées en jeu) portant un #Tag :
                </div>
                {allProjectTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allProjectTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            subjectMode: 'tag',
                            subjectTag: tag,
                            subjectStateId: undefined,
                            ...(isWizardRelational
                              ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                              : { step: 3, actionSubStep: 'main' }),
                          })
                        }
                        className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                      >
                        #{tag} →
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeWizard.subjectTag || ''}
                    onChange={(e) =>
                      setActiveWizard({ ...activeWizard, subjectTag: e.target.value.replace(/^#/, '') })
                    }
                    placeholder="Ou saisir un tag (ex: ennemi, piece...)"
                    className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                  />
                  <button
                    type="button"
                    disabled={!activeWizard.subjectTag?.trim()}
                    onClick={() => {
                      if (!activeWizard.subjectTag?.trim()) return;
                      setActiveWizard({
                        ...activeWizard,
                        subjectMode: 'tag',
                        subjectTag: activeWizard.subjectTag.trim().replace(/^#/, ''),
                        subjectStateId: undefined,
                        ...(isWizardRelational
                          ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                          : { step: 3, actionSubStep: 'main' }),
                      });
                    }}
                    className="px-4 py-2 bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Valider →
                  </button>
                </div>
              </div>
            ) : activeWizard.subjectMode === 'instance' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {entityList.length === 0 ? (
                  <div className="col-span-full text-center text-xs text-slate-500 py-6">
                    Aucune entité posée sur la scène.
                  </div>
                ) : (
                  entityList.map((inst) => {
                    const statesCount = Object.keys(inst.states || {}).length;
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          if (statesCount > 1) {
                            setActiveWizard({
                              ...activeWizard,
                              subjectMode: 'instance',
                              subjectId: inst.id,
                              subjectType: inst.type,
                              subjectSubStep: 'choose_state',
                            });
                          } else {
                            setActiveWizard({
                              ...activeWizard,
                              subjectMode: 'instance',
                              subjectId: inst.id,
                              subjectType: inst.type,
                              subjectStateId: undefined,
                              ...(isWizardRelational
                                ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                                : { step: 3, actionSubStep: 'main' }),
                            });
                          }
                        }}
                        className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                          <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                        </div>
                        <div className="text-center w-full">
                          <div className="text-xs font-black text-slate-800 truncate">{inst.name}</div>
                          <div className="text-[10px] text-slate-400">
                            ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
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
                            subjectMode: 'type',
                            subjectType: opt.type,
                            subjectSubStep: 'choose_state',
                          });
                        } else {
                          setActiveWizard({
                            ...activeWizard,
                            subjectMode: 'type',
                            subjectType: opt.type,
                            subjectStateId: undefined,
                            ...(isWizardRelational
                              ? { objectPhase: 'target', targetSubStep: 'choose_object' }
                              : { step: 3, actionSubStep: 'main' }),
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
        )
      ) : (
        /* PHASE B : CHOIX DE LA CIBLE (Uniquement si Collision ou Proximité) */
        activeWizard.targetSubStep === 'choose_state' ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-600">
              Choisissez si la règle requiert un état précis pour la Cible {getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType} :
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setActiveWizard({
                    ...activeWizard,
                    targetStateId: undefined,
                    targetSubStep: 'choose_object',
                    step: 3,
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

              {Object.values(getEntityObj(activeWizard.targetType)?.states || {}).map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => {
                    setActiveWizard({
                      ...activeWizard,
                      targetStateId: st.id,
                      targetSubStep: 'choose_object',
                      step: 3,
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
          <div className="space-y-4">
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'type' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  (activeWizard.targetMode || 'type') === 'type'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🧩 Par Type
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'tag' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.targetMode === 'tag'
                    ? 'bg-white text-purple-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🏷️ Par #Tag
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'instance' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.targetMode === 'instance'
                    ? 'bg-white text-cyan-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                📍 Instance
              </button>
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'any' })}
                className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeWizard.targetMode === 'any'
                    ? 'bg-white text-emerald-700 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                🌐 Tous objets
              </button>
            </div>

            {activeWizard.targetMode === 'any' ? (
              <button
                type="button"
                onClick={() =>
                  setActiveWizard({
                    ...activeWizard,
                    targetMode: 'any',
                    targetType: undefined,
                    targetId: undefined,
                    targetTag: undefined,
                    targetStateId: undefined,
                    step: 3,
                    actionSubStep: 'main',
                  })
                }
                className="w-full p-6 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs group text-left"
              >
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                    🌐
                  </div>
                  <div>
                    <div className="text-sm font-black text-emerald-950">
                      N'importe quel autre objet (Tous les objets)
                    </div>
                    <div className="text-xs text-emerald-700 mt-1">
                      Déclencher la collision ou proximité avec tout autre objet sur le canvas (y compris ceux créés en jeu).
                    </div>
                  </div>
                </div>
                <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
              </button>
            ) : activeWizard.targetMode === 'tag' ? (
              <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
                <div className="text-xs font-bold text-purple-950">
                  Déclencher lorsque le Sujet touche n'importe quel objet portant ce #Tag (ex: projectiles, ennemis créés en jeu) :
                </div>
                {allProjectTags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {allProjectTags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            targetMode: 'tag',
                            targetTag: tag,
                            targetStateId: undefined,
                            step: 3,
                            actionSubStep: 'main',
                          })
                        }
                        className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                      >
                        #{tag} →
                      </button>
                    ))}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={activeWizard.targetTag || ''}
                    onChange={(e) =>
                      setActiveWizard({ ...activeWizard, targetTag: e.target.value.replace(/^#/, '') })
                    }
                    placeholder="Ou saisir un tag cible (ex: projectile, mur...)"
                    className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                  />
                  <button
                    type="button"
                    disabled={!activeWizard.targetTag?.trim()}
                    onClick={() => {
                      if (!activeWizard.targetTag?.trim()) return;
                      setActiveWizard({
                        ...activeWizard,
                        targetMode: 'tag',
                        targetTag: activeWizard.targetTag.trim().replace(/^#/, ''),
                        targetStateId: undefined,
                        step: 3,
                        actionSubStep: 'main',
                      });
                    }}
                    className="px-4 py-2 bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                  >
                    Valider →
                  </button>
                </div>
              </div>
            ) : activeWizard.targetMode === 'instance' ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                {entityList.length === 0 ? (
                  <div className="col-span-full text-center text-xs text-slate-500 py-6">
                    Aucune entité posée sur la scène.
                  </div>
                ) : (
                  entityList.map((inst) => {
                    const statesCount = Object.keys(inst.states || {}).length;
                    return (
                      <button
                        key={inst.id}
                        type="button"
                        onClick={() => {
                          if (statesCount > 1) {
                            setActiveWizard({
                              ...activeWizard,
                              targetMode: 'instance',
                              targetId: inst.id,
                              targetType: inst.type,
                              targetSubStep: 'choose_state',
                            });
                          } else {
                            setActiveWizard({
                              ...activeWizard,
                              targetMode: 'instance',
                              targetId: inst.id,
                              targetType: inst.type,
                              targetStateId: undefined,
                              step: 3,
                              actionSubStep: 'main',
                            });
                          }
                        }}
                        className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                          <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                        </div>
                        <div className="text-center w-full">
                          <div className="text-xs font-black text-slate-800 truncate">{inst.name}</div>
                          <div className="text-[10px] text-slate-400">
                            ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
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
                            targetMode: 'type',
                            targetType: opt.type,
                            targetSubStep: 'choose_state',
                          });
                        } else {
                          setActiveWizard({
                            ...activeWizard,
                            targetMode: 'type',
                            targetType: opt.type,
                            targetStateId: undefined,
                            step: 3,
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
        )
      )}
    </div>
  );
}
