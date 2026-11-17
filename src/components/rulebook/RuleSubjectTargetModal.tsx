import React from 'react';
import { DynamicRule, Entity, SelectionMode } from '../../types';
import { EntityMiniPreview } from '../EntityMiniPreview';
import { ChevronLeft, X, Check } from 'lucide-react';
import { ActiveModal, EntityOption } from './ruleBookTypes';

interface RuleSubjectTargetModalProps {
  activeModal: Extract<NonNullable<ActiveModal>, { type: 'subject' | 'target' }>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  rule: DynamicRule;
  updateRule: (id: string, updates: Partial<DynamicRule>) => void;
  availableEntityOptions: EntityOption[];
  entityList: Entity[];
  allProjectTags: string[];
  getEntityObj: (type?: string) => Entity | undefined;
}

export const RuleSubjectTargetModal: React.FC<RuleSubjectTargetModalProps> = ({
  activeModal,
  setActiveModal,
  rule,
  updateRule,
  availableEntityOptions,
  entityList,
  allProjectTags,
  getEntityObj,
}) => {
  const isSubject = activeModal.type === 'subject';
  const activeSelMode: SelectionMode =
    activeModal.selectionMode ||
    (isSubject ? rule.trigger.subjectMode : rule.trigger.targetMode) ||
    'type';
  const currentType = isSubject ? rule.trigger.subjectType : rule.trigger.targetType;
  const relevantType =
    activeModal.selectedEntityType || currentType || availableEntityOptions[0]?.type || 'apple';
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
                    subjectMode: activeSelMode,
                    subjectType: activeSelMode === 'type' ? relevantType : undefined,
                    subjectId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                    subjectTag: undefined,
                    subjectStateId: undefined,
                  },
                });
              } else {
                updateRule(rule.id, {
                  trigger: {
                    ...rule.trigger,
                    targetMode: activeSelMode,
                    targetType: activeSelMode === 'type' ? relevantType : undefined,
                    targetId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                    targetTag: undefined,
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
                      subjectMode: activeSelMode,
                      subjectType: activeSelMode === 'type' ? relevantType : undefined,
                      subjectId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                      subjectTag: undefined,
                      subjectStateId: st.id,
                    },
                  });
                } else {
                  updateRule(rule.id, {
                    trigger: {
                      ...rule.trigger,
                      targetMode: activeSelMode,
                      targetType: activeSelMode === 'type' ? relevantType : undefined,
                      targetId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                      targetTag: undefined,
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
        <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveModal({ ...activeModal, selectionMode: 'type' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSelMode === 'type'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🧩 Par Type
            </button>
            <button
              type="button"
              onClick={() => setActiveModal({ ...activeModal, selectionMode: 'tag' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSelMode === 'tag'
                  ? 'bg-white text-purple-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🏷️ Par #Tag
            </button>
            <button
              type="button"
              onClick={() => setActiveModal({ ...activeModal, selectionMode: 'instance' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSelMode === 'instance'
                  ? 'bg-white text-cyan-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              📍 Instance
            </button>
            <button
              type="button"
              onClick={() => setActiveModal({ ...activeModal, selectionMode: 'any' })}
              className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeSelMode === 'any'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🌐 Tous objets
            </button>
          </div>

          {activeSelMode === 'any' ? (
            <button
              type="button"
              onClick={() => {
                if (isSubject) {
                  updateRule(rule.id, {
                    trigger: {
                      ...rule.trigger,
                      subjectMode: 'any',
                      subjectType: undefined,
                      subjectId: undefined,
                      subjectTag: undefined,
                      subjectStateId: undefined,
                    },
                  });
                } else {
                  updateRule(rule.id, {
                    trigger: {
                      ...rule.trigger,
                      targetMode: 'any',
                      targetType: undefined,
                      targetId: undefined,
                      targetTag: undefined,
                      targetStateId: undefined,
                    },
                  });
                }
                setActiveModal(null);
              }}
              className="w-full p-5 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs text-left"
            >
              <div className="flex items-center gap-3.5">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0">
                  🌐
                </div>
                <div>
                  <div className="text-sm font-black text-emerald-950">
                    Tous les objets (N'importe quel objet)
                  </div>
                  <div className="text-xs text-emerald-700 mt-0.5">
                    Inclut tous les objets actuels et futurs sur le canvas.
                  </div>
                </div>
              </div>
              <Check className="w-5 h-5 text-emerald-700 shrink-0" />
            </button>
          ) : activeSelMode === 'tag' ? (
            <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
              <div className="text-xs font-bold text-purple-950">
                Cibler par #Tag (inclut les instances créées dynamiquement) :
              </div>
              {allProjectTags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {allProjectTags.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => {
                        if (isSubject) {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              subjectMode: 'tag',
                              subjectTag: tag,
                              subjectId: undefined,
                              subjectStateId: undefined,
                            },
                          });
                        } else {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              targetMode: 'tag',
                              targetTag: tag,
                              targetId: undefined,
                              targetStateId: undefined,
                            },
                          });
                        }
                        setActiveModal(null);
                      }}
                      className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                    >
                      #{tag}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={
                    activeModal.tagInput ??
                    (isSubject ? rule.trigger.subjectTag || '' : rule.trigger.targetTag || '')
                  }
                  onChange={(e) =>
                    setActiveModal({ ...activeModal, tagInput: e.target.value.replace(/^#/, '') })
                  }
                  placeholder="Ex: projectile, ennemi..."
                  className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                />
                <button
                  type="button"
                  onClick={() => {
                    const clean = (
                      activeModal.tagInput ??
                      (isSubject ? rule.trigger.subjectTag || '' : rule.trigger.targetTag || '')
                    )
                      .trim()
                      .replace(/^#/, '');
                    if (!clean) return;
                    if (isSubject) {
                      updateRule(rule.id, {
                        trigger: {
                          ...rule.trigger,
                          subjectMode: 'tag',
                          subjectTag: clean,
                          subjectId: undefined,
                          subjectStateId: undefined,
                        },
                      });
                    } else {
                      updateRule(rule.id, {
                        trigger: {
                          ...rule.trigger,
                          targetMode: 'tag',
                          targetTag: clean,
                          targetId: undefined,
                          targetStateId: undefined,
                        },
                      });
                    }
                    setActiveModal(null);
                  }}
                  className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  Appliquer
                </button>
              </div>
            </div>
          ) : activeSelMode === 'instance' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {entityList.map((inst) => {
                const statesCount = Object.keys(inst.states || {}).length;
                return (
                  <button
                    key={inst.id}
                    type="button"
                    onClick={() => {
                      if (statesCount > 1) {
                        setActiveModal({
                          ...activeModal,
                          subStep: 'choose_state',
                          selectionMode: 'instance',
                          selectedEntityId: inst.id,
                          selectedEntityType: inst.type,
                        });
                      } else {
                        if (isSubject) {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              subjectMode: 'instance',
                              subjectId: inst.id,
                              subjectType: inst.type,
                              subjectTag: undefined,
                              subjectStateId: undefined,
                            },
                          });
                        } else {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              targetMode: 'instance',
                              targetId: inst.id,
                              targetType: inst.type,
                              targetTag: undefined,
                              targetStateId: undefined,
                            },
                          });
                        }
                        setActiveModal(null);
                      }
                    }}
                    className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                      <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                    </div>
                    <div className="text-xs font-black text-slate-800 truncate w-full text-center">
                      {inst.name}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
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
                          selectionMode: 'type',
                          selectedEntityType: opt.type,
                        });
                      } else {
                        if (isSubject) {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              subjectMode: 'type',
                              subjectType: opt.type,
                              subjectId: undefined,
                              subjectTag: undefined,
                              subjectStateId: undefined,
                            },
                          });
                        } else {
                          updateRule(rule.id, {
                            trigger: {
                              ...rule.trigger,
                              targetMode: 'type',
                              targetType: opt.type,
                              targetId: undefined,
                              targetTag: undefined,
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
      )}
    </div>
  );
};
