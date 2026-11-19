import React from 'react';
import { DynamicRule, RuleTrigger } from '../../types';
import { ChevronLeft, ChevronRight, X, Check } from 'lucide-react';
import { ActiveModal, EntityOption } from './ruleBookTypes';

interface RuleEventModalProps {
  activeModal: Extract<NonNullable<ActiveModal>, { type: 'event' }>;
  setActiveModal: React.Dispatch<React.SetStateAction<ActiveModal>>;
  rule: DynamicRule;
  updateRule: (id: string, updates: Partial<DynamicRule>) => void;
  availableEntityOptions: EntityOption[];
}

export const RuleEventModal: React.FC<RuleEventModalProps> = ({
  activeModal,
  setActiveModal,
  rule,
  updateRule,
  availableEntityOptions,
}) => {
  const modalTriggerType = activeModal.triggerType || rule.trigger.type;
  const modalSubStep = activeModal.subStep || 'main';
  const modalTriggerPhase = activeModal.triggerPhase ?? rule.trigger.phase;
  const modalAutoRevert = activeModal.autoRevert ?? rule.trigger.autoRevert ?? false;

  const applyEventTrigger = (patch: Partial<RuleTrigger>, closeAfter = true) => {
    const nextType = patch.type ?? modalTriggerType;
    const needsTarget = nextType === 'collision' || nextType === 'proximity';
    updateRule(rule.id, {
      trigger: {
        ...rule.trigger,
        ...patch,
        ...(needsTarget && !rule.trigger.targetType && !patch.targetType
          ? { targetType: availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant' }
          : {}),
      },
    });
    if (closeAfter) {
      setActiveModal(null);
    }
  };

  return (
    <div className="space-y-4 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
        <div className="flex items-center gap-2">
          {modalSubStep !== 'main' && (
            <button
              type="button"
              onClick={() => setActiveModal({ ...activeModal, subStep: 'main' })}
              className="p-1.5 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
              title="Retour à la liste des événements"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
          )}
          <h3 className="text-base font-black text-slate-900">
            {modalSubStep === 'key_picker'
              ? 'Choisir la touche de Clavier'
              : modalSubStep === 'config_event_params'
              ? "Paramètres de l'Événement"
              : "Type d'Événement"}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {modalSubStep === 'main' && (
            <button
              type="button"
              onClick={() =>
                setActiveModal({
                  ...activeModal,
                  subStep: 'config_event_params',
                  triggerType: rule.trigger.type,
                })
              }
              className="px-2.5 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200 rounded-xl text-[11px] font-bold cursor-pointer transition-colors"
              title="Régler les paramètres détaillés et l'auto-remise"
            >
              ⚙️ Paramètres &amp; Auto-remise
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveModal(null)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
        {modalSubStep === 'key_picker' ? (
          <div className="space-y-4">
            <div className="text-xs font-bold text-slate-600">
              Choisissez la touche du clavier qui déclenche cette règle :
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { key: 'Space', label: "Barre d'Espace", icon: '🚀' },
                { key: 'ArrowUp', label: 'Flèche Haut ⬆️', icon: '⬆️' },
                { key: 'ArrowDown', label: 'Flèche Bas ⬇️', icon: '⬇️' },
                { key: 'ArrowLeft', label: 'Flèche Gauche ⬅️', icon: '⬅️' },
                { key: 'ArrowRight', label: 'Flèche Droite ➡️', icon: '➡️' },
                { key: 'Enter', label: 'Touche Entrée ↩️', icon: '↩️' },
                { key: 'z', label: 'Touche Z (Avancer)', icon: '⌨️' },
                { key: 'q', label: 'Touche Q (Gauche)', icon: '⌨️' },
                { key: 's', label: 'Touche S (Reculer)', icon: '⌨️' },
                { key: 'd', label: 'Touche D (Droite)', icon: '⌨️' },
                { key: 'a', label: 'Touche A', icon: '⌨️' },
                { key: 'w', label: 'Touche W', icon: '⌨️' },
                { key: 'any', label: 'N’importe quelle touche', icon: '🌟' },
              ].map((k) => {
                const isSelected =
                  (activeModal.keyName || rule.trigger.keyName) === k.key && modalTriggerType === 'keyboard';
                return (
                  <button
                    key={k.key}
                    type="button"
                    onClick={() => {
                      setActiveModal({
                        ...activeModal,
                        triggerType: 'keyboard',
                        keyName: k.key,
                        triggerPhase:
                          modalTriggerPhase === 'up' || modalTriggerPhase === 'key_up' ? 'up' : 'down',
                        subStep: 'config_event_params',
                      });
                    }}
                    className={`p-3.5 border-2 rounded-2xl flex items-center gap-3 cursor-pointer transition-all shadow-2xs group text-left ${
                      isSelected
                        ? 'bg-indigo-50 border-indigo-500'
                        : 'bg-slate-50 hover:bg-indigo-50 border-slate-200 hover:border-indigo-500'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                      {k.icon}
                    </div>
                    <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                      {k.label}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : modalSubStep === 'config_event_params' ? (
          <div className="bg-slate-50/90 p-5 rounded-3xl border border-slate-200/90 space-y-5 max-w-xl mx-auto shadow-xs">
            {/* 1. Minuteur / Timer */}
            {modalTriggerType === 'timer' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Intervalle de temps (secondes) :
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={0.5}
                      step={0.5}
                      value={activeModal.timerInterval ?? 2}
                      onChange={(e) =>
                        setActiveModal({
                          ...activeModal,
                          timerInterval: Math.max(0.5, parseFloat(e.target.value) || 1),
                        })
                      }
                      className="w-28 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                    />
                    <span className="text-xs text-slate-500 font-bold">secondes</span>
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Fréquence de déclenchement :
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, timerType: 'repeat' })}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        activeModal.timerType !== 'once'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      🔁 Répéter (Toutes les X sec)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, timerType: 'once' })}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        activeModal.timerType === 'once'
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      1️⃣ Une seule fois (Après X sec)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 2. Touche de Clavier */}
            {modalTriggerType === 'keyboard' && (
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">Touche à détecter :</label>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, subStep: 'key_picker' })}
                      className="text-[11px] font-bold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Vue grille de touches →
                    </button>
                  </div>
                  <select
                    value={activeModal.keyName || 'Space'}
                    onChange={(e) => setActiveModal({ ...activeModal, keyName: e.target.value })}
                    className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                  >
                    <option value="Space">Touche Espace (Spacebar)</option>
                    <option value="ArrowUp">↑ Flèche Haut</option>
                    <option value="ArrowDown">↓ Flèche Bas</option>
                    <option value="ArrowLeft">← Flèche Gauche</option>
                    <option value="ArrowRight">→ Flèche Droite</option>
                    <option value="Enter">Touche Entrée</option>
                    <option value="a">Touche A</option>
                    <option value="w">Touche W</option>
                    <option value="s">Touche S</option>
                    <option value="d">Touche D</option>
                    <option value="z">Touche Z</option>
                    <option value="q">Touche Q</option>
                    <option value="any">N'importe quelle touche</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phase de la touche (Key Down / Key Up) :
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, triggerPhase: 'down' })}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        modalTriggerPhase !== 'up' && modalTriggerPhase !== 'key_up'
                          ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      👇 Appui (Key Down)
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveModal({ ...activeModal, triggerPhase: 'up' })}
                      className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        modalTriggerPhase === 'up' || modalTriggerPhase === 'key_up'
                          ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                          : 'bg-white border-slate-200 text-slate-600'
                      }`}
                    >
                      🖐️ Relâchement (Key Up)
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* 3. Proximité */}
            {modalTriggerType === 'proximity' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Rayon de proximité (pixels) :
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      type="number"
                      min={10}
                      step={10}
                      value={activeModal.proximityDistance || 80}
                      onChange={(e) =>
                        setActiveModal({
                          ...activeModal,
                          proximityDistance: Math.max(10, parseInt(e.target.value, 10) || 50),
                        })
                      }
                      className="w-32 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                    />
                    <span className="text-xs text-slate-500 font-bold">pixels</span>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Variable / Score */}
            {modalTriggerType === 'variable' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Comparaison :</label>
                  <select
                    value={activeModal.variableOperator || '>='}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, variableOperator: e.target.value as any })
                    }
                    className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                  >
                    <option value=">=">Supérieur ou Égal (&gt;=)</option>
                    <option value="==">Exactement Égal (==)</option>
                    <option value="<=">Inférieur ou Égal (&lt;=)</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Valeur du Score :</label>
                  <input
                    type="number"
                    value={activeModal.variableValue ?? 5}
                    onChange={(e) =>
                      setActiveModal({ ...activeModal, variableValue: parseInt(e.target.value, 10) || 0 })
                    }
                    className="w-full text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                  />
                </div>
              </div>
            )}

            {/* 5. Bord de Scène */}
            {modalTriggerType === 'boundary' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Bord de scène à contacter :
                </label>
                <select
                  value={activeModal.boundaryEdge || 'any'}
                  onChange={(e) => setActiveModal({ ...activeModal, boundaryEdge: e.target.value as any })}
                  className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                >
                  <option value="any">N'importe quel bord</option>
                  <option value="top">Bord Haut</option>
                  <option value="bottom">Bord Bas</option>
                  <option value="left">Bord Gauche</option>
                  <option value="right">Bord Droit</option>
                </select>
              </div>
            )}

            {/* 6. Option d'Auto-remise */}
            {['click', 'hover', 'keyboard', 'collision', 'proximity'].includes(modalTriggerType) && (
              <div className="pt-2 border-t border-slate-200/80 space-y-2">
                <label className="text-xs font-bold text-slate-800 block">
                  🔄 Option d'Auto-remise (Restaurer l'état initial au relâchement/sortie) :
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveModal({ ...activeModal, autoRevert: true })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      modalAutoRevert
                        ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300/60 text-emerald-950 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-black text-xs text-emerald-800">↩️ Activer l'Auto-remise</div>
                    <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                      Restaure l'état initial au relâchement (clic/touche) ou fin de contact.
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveModal({ ...activeModal, autoRevert: false })}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                      !modalAutoRevert
                        ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300/60 text-slate-900 shadow-2xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                    }`}
                  >
                    <div className="font-black text-xs text-slate-700">➡️ Pas d'Auto-remise</div>
                    <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                      Conserve le nouvel état définitivement après l'événement.
                    </span>
                  </button>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                applyEventTrigger({
                  type: modalTriggerType,
                  phase: modalTriggerPhase,
                  timerInterval: activeModal.timerInterval,
                  timerType: activeModal.timerType,
                  keyName: activeModal.keyName,
                  proximityDistance: activeModal.proximityDistance,
                  boundaryEdge: activeModal.boundaryEdge,
                  variableName: activeModal.variableName || 'score',
                  variableOperator: activeModal.variableOperator || '>=',
                  variableValue: activeModal.variableValue ?? 5,
                  autoRevert: modalAutoRevert,
                });
              }}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
            >
              <Check className="w-4 h-4" />
              <span>Appliquer cet événement</span>
            </button>
          </div>
        ) : (
          <>
            {/* CASE 1 : COLLISIONS */}
            <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200/80 space-y-2">
              <div className="flex items-center justify-between">
                <div className="text-xs font-black uppercase text-indigo-800 tracking-wider">
                  💥 Collisions &amp; Contacts entre Objets
                </div>
                <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                  Avec Cible
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'collision', phase: 'enter' })}
                  className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    💥
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                      Collision Entrée
                    </div>
                    <div className="text-[10px] text-slate-500">Premier contact</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'collision', phase: 'exit' })}
                  className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    💨
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                      Collision Sortie
                    </div>
                    <div className="text-[10px] text-slate-500">Fin de contact</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'collision', phase: 'stay' })}
                  className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    ⏳
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                      Contact Continu
                    </div>
                    <div className="text-[10px] text-slate-500">Pendant le contact</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'collision', phase: 'collision_release' })}
                  className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    🎯
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                      Lâché sur Cible
                    </div>
                    <div className="text-[10px] text-slate-500">Relâché au-dessus</div>
                  </div>
                </button>
              </div>

              {/* Options avancées anti-boucle & stabilité collision */}
              <div className="mt-2 pt-2.5 border-t border-indigo-200/70 flex flex-wrap items-center justify-between gap-2.5">
                <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900">
                  <span>Marge séparation (anti-boucle) :</span>
                  <input
                    type="number"
                    min={0}
                    max={60}
                    step={2}
                    value={rule.trigger.collisionExitMargin ?? 10}
                    onChange={(e) =>
                      updateRule(rule.id, {
                        trigger: {
                          ...rule.trigger,
                          collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                        },
                      })
                    }
                    className="w-14 px-2 py-1 text-center text-xs font-bold bg-white border border-indigo-200 rounded-lg outline-none focus:border-indigo-500"
                  />
                  <span className="text-[10px] font-normal text-indigo-700">px</span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    updateRule(rule.id, {
                      trigger: {
                        ...rule.trigger,
                        collisionTriggerOnce: !rule.trigger.collisionTriggerOnce,
                      },
                    })
                  }
                  className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                    rule.trigger.collisionTriggerOnce
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                      : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/60'
                  }`}
                >
                  {rule.trigger.collisionTriggerOnce
                    ? '✓ Déclencher 1 seule fois par paire'
                    : '1× seule fois par paire'}
                </button>
              </div>
            </div>

            {/* CASE 2 : CLICS */}
            <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200/80 space-y-2">
              <div className="text-xs font-black uppercase text-purple-800 tracking-wider">
                👆 Clics &amp; Pointeur
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'click', phase: 'click' })}
                  className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    👆
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                      Clic Complet
                    </div>
                    <div className="text-[10px] text-slate-500">Click classique</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'click', phase: 'down' })}
                  className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    👇
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                      Appui (Down)
                    </div>
                    <div className="text-[10px] text-slate-500">Pression bouton</div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'click', phase: 'up' })}
                  className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                    🖐️
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                      Relâché (Up)
                    </div>
                    <div className="text-[10px] text-slate-500">Relâchement bouton</div>
                  </div>
                </button>
              </div>
            </div>

            {/* CASE 3 & 4 : SURVOL & GLISSER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SURVOL SOURIS */}
              <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                <div className="text-xs font-black uppercase text-amber-800 tracking-wider">
                  👀 Survol Souris (Hover)
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => applyEventTrigger({ type: 'hover', phase: 'hover_enter' })}
                    className="p-2.5 bg-white hover:bg-amber-100/60 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                      👀
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Entrée</div>
                      <div className="text-[9px] text-slate-500">Hover Enter</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => applyEventTrigger({ type: 'hover', phase: 'hover_exit' })}
                    className="p-2.5 bg-white hover:bg-amber-100/60 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                  >
                    <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                      🏃
                    </div>
                    <div>
                      <div className="text-xs font-black text-slate-900">Sortie</div>
                      <div className="text-[9px] text-slate-500">Hover Exit</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* GLISSER-DÉPOSER */}
              <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
                <div className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                  🫳 Glisser-Déposer libre
                </div>
                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'drag', phase: 'drag_release' })}
                  className="w-full p-2.5 bg-white hover:bg-emerald-100/60 border border-emerald-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0">
                    🫳
                  </div>
                  <div>
                    <div className="text-xs font-black text-slate-900">Relâcher libre (Drop)</div>
                    <div className="text-[10px] text-slate-500">Lâcher n'importe où sur le canvas</div>
                  </div>
                </button>
              </div>
            </div>

            {/* CASE 5 & 6 : MINUTEURS & CLAVIER */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* MINUTEURS */}
              <div className="bg-cyan-50/50 p-3.5 rounded-2xl border border-cyan-200/80 space-y-2">
                <div className="text-xs font-black uppercase text-cyan-800 tracking-wider">
                  ⏱️ Minuteurs &amp; Chronomètres
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setActiveModal({
                        ...activeModal,
                        triggerType: 'timer',
                        timerInterval: activeModal.timerInterval ?? 3,
                        timerType: 'once',
                        subStep: 'config_event_params',
                      })
                    }
                    className="p-2.5 bg-white hover:bg-cyan-100/60 border border-cyan-200 rounded-xl text-left cursor-pointer transition-all shadow-2xs"
                  >
                    <div className="text-sm mb-0.5">⏱️</div>
                    <div className="text-xs font-black text-slate-900">Après X sec</div>
                    <div className="text-[9px] text-slate-500">Timer unique →</div>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveModal({
                        ...activeModal,
                        triggerType: 'timer',
                        timerInterval: activeModal.timerInterval ?? 2,
                        timerType: 'repeat',
                        subStep: 'config_event_params',
                      })
                    }
                    className="p-2.5 bg-white hover:bg-cyan-100/60 border border-cyan-200 rounded-xl text-left cursor-pointer transition-all shadow-2xs"
                  >
                    <div className="text-sm mb-0.5">🔄</div>
                    <div className="text-xs font-black text-slate-900">Toutes les X sec</div>
                    <div className="text-[9px] text-slate-500">Timer récurrent →</div>
                  </button>
                </div>
              </div>

              {/* CLAVIER */}
              <div className="bg-slate-100/80 p-3.5 rounded-2xl border border-slate-300 space-y-2">
                <div className="text-xs font-black uppercase text-slate-800 tracking-wider">
                  ⌨️ Touches du Clavier
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveModal({
                      ...activeModal,
                      triggerType: 'keyboard',
                      subStep: 'key_picker',
                    })
                  }
                  className="w-full p-2.5 bg-white hover:bg-indigo-50 border border-slate-300 hover:border-indigo-500 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                >
                  <div className="w-9 h-9 rounded-lg bg-slate-200 text-slate-800 flex items-center justify-center text-xl shrink-0">
                    ⌨️
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                      Touche de Clavier
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Espace, Flèches, Z/Q/S/D, Entrée... →
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                </button>
              </div>
            </div>

            {/* CASE 7, 8, 9, 10 : ÉTAT, PROXIMITÉ, BORDS, SCORE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="bg-violet-50/50 p-3 rounded-2xl border border-violet-200 space-y-1.5">
                <div className="text-[11px] font-black uppercase text-violet-800">🔄 Changement d'État</div>
                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'state_change' })}
                  className="w-full p-2 bg-white hover:bg-violet-100 border border-violet-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs"
                >
                  <span className="text-lg">✨</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Nouveau statut</div>
                    <div className="text-[9px] text-slate-500">Passe à l'état X</div>
                  </div>
                </button>
              </div>

              <div className="bg-sky-50/50 p-3 rounded-2xl border border-sky-200 space-y-1.5">
                <div className="text-[11px] font-black uppercase text-sky-800">📏 Proximité</div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveModal({
                      ...activeModal,
                      triggerType: 'proximity',
                      proximityDistance: activeModal.proximityDistance ?? 80,
                      subStep: 'config_event_params',
                    })
                  }
                  className="w-full p-2 bg-white hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs"
                >
                  <span className="text-lg">📏</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Approche Cible</div>
                    <div className="text-[9px] text-slate-500">Rayon en px →</div>
                  </div>
                </button>
              </div>

              <div className="bg-rose-50/50 p-3 rounded-2xl border border-rose-200 space-y-1.5">
                <div className="text-[11px] font-black uppercase text-rose-800">🖼️ Bords du Canvas</div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveModal({
                      ...activeModal,
                      triggerType: 'boundary',
                      boundaryEdge: activeModal.boundaryEdge ?? 'any',
                      subStep: 'config_event_params',
                    })
                  }
                  className="w-full p-2 bg-white hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs"
                >
                  <span className="text-lg">🖼️</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Touche le Cadre</div>
                    <div className="text-[9px] text-slate-500">Choisir le bord →</div>
                  </div>
                </button>
              </div>

              <div className="bg-amber-50/50 p-3 rounded-2xl border border-amber-200 space-y-1.5">
                <div className="text-[11px] font-black uppercase text-amber-800">📊 Score &amp; Variables</div>
                <button
                  type="button"
                  onClick={() =>
                    setActiveModal({
                      ...activeModal,
                      triggerType: 'variable',
                      variableName: activeModal.variableName ?? 'score',
                      variableOperator: activeModal.variableOperator ?? '>=',
                      variableValue: activeModal.variableValue ?? 5,
                      subStep: 'config_event_params',
                    })
                  }
                  className="w-full p-2 bg-white hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs"
                >
                  <span className="text-lg">🏆</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Score / Compteur</div>
                    <div className="text-[9px] text-slate-500">Seuil valeur →</div>
                  </div>
                </button>
              </div>

              <div className="bg-red-50/50 p-3 rounded-2xl border border-red-200 space-y-1.5 sm:col-span-2 lg:col-span-4">
                <div className="text-[11px] font-black uppercase text-red-800">⛓️‍💥 Rupture de Joint</div>
                <button
                  type="button"
                  onClick={() => applyEventTrigger({ type: 'joint_break', phase: 'joint_break' })}
                  className="w-full p-2 bg-white hover:bg-red-100/70 border border-red-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs"
                >
                  <span className="text-lg">⛓️‍💥</span>
                  <div>
                    <div className="text-xs font-black text-slate-900">Quand le joint casse</div>
                    <div className="text-[9px] text-slate-500">Traction excessive ou secousses (Break Joint)</div>
                  </div>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
