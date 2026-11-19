import React from 'react';
import { ArrowRight, ChevronRight } from 'lucide-react';
import { WizardData } from './ruleBookTypes';

interface WizardStep1ConditionProps {
  activeWizard: WizardData;
  setActiveWizard: React.Dispatch<React.SetStateAction<WizardData | null>>;
  isWizardGlobal: boolean;
  isWizardRelational: boolean;
}

export function WizardStep1Condition({
  activeWizard,
  setActiveWizard,
  isWizardGlobal,
  isWizardRelational,
}: WizardStep1ConditionProps) {
  if (activeWizard.actionSubStep === 'key_picker') {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-xs font-bold text-slate-600">
            Choisissez la touche du clavier qui déclenche cette règle :
          </div>
          <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'down' })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeWizard.triggerPhase !== 'up' && activeWizard.triggerPhase !== 'key_up'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              👇 Appui (Down)
            </button>
            <button
              type="button"
              onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'up' })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                activeWizard.triggerPhase === 'up' || activeWizard.triggerPhase === 'key_up'
                  ? 'bg-white text-purple-700 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              🖐️ Relâchement (Up)
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
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
            { key: 'any', label: 'N’importe quelle touche', icon: '🌟' },
          ].map((k) => (
            <button
              key={k.key}
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'keyboard',
                  keyName: k.key,
                  step: 3,
                  actionSubStep: 'main',
                });
              }}
              className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
            >
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                {k.icon}
              </div>
              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 text-center">
                {k.label}
              </div>
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (activeWizard.actionSubStep === 'config_event_params') {
    return (
      <div className="bg-slate-50/90 p-6 rounded-3xl border border-slate-200/90 space-y-6 max-w-xl mx-auto shadow-xs animate-in fade-in zoom-in-95">
        <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
          <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-black shadow-inner">
            ⚙️
          </div>
          <div>
            <h4 className="text-base font-black text-slate-900">
              Réglage des paramètres de la condition
            </h4>
            <p className="text-xs text-slate-500">
              Définissez la valeur exacte pour cette condition avant de continuer.
            </p>
          </div>
        </div>

        {/* 1. Minuteur / Timer */}
        {activeWizard.triggerType === 'timer' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Intervalle de temps (secondes) :</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={0.5}
                  step={0.5}
                  value={activeWizard.timerInterval || 2}
                  onChange={(e) => setActiveWizard({ ...activeWizard, timerInterval: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                  className="w-28 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                />
                <span className="text-xs text-slate-500 font-bold">secondes</span>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Fréquence de déclenchement :</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveWizard({ ...activeWizard, timerType: 'repeat' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activeWizard.timerType !== 'once' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  🔁 Répéter (Toutes les X sec)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWizard({ ...activeWizard, timerType: 'once' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activeWizard.timerType === 'once' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  1️⃣ Une seule fois (Après X sec)
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 2. Touche de Clavier */}
        {activeWizard.triggerType === 'keyboard' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Touche à détecter :</label>
              <select
                value={activeWizard.keyName || 'Space'}
                onChange={(e) => setActiveWizard({ ...activeWizard, keyName: e.target.value })}
                className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
              >
                <option value="Space">Touche Espace (Spacebar)</option>
                <option value="ArrowUp">↑ Flèche Haut</option>
                <option value="ArrowDown">↓ Flèche Bas</option>
                <option value="ArrowLeft">← Flèche Gauche</option>
                <option value="ArrowRight">→ Flèche Droite</option>
                <option value="Enter">Touche Entrée</option>
                <option value="z">Touche Z</option>
                <option value="q">Touche Q</option>
                <option value="a">Touche A</option>
                <option value="w">Touche W</option>
                <option value="s">Touche S</option>
                <option value="d">Touche D</option>
                <option value="any">N'importe quelle touche</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Phase de la touche (Key Down / Key Up) :</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'down' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activeWizard.triggerPhase !== 'up' && activeWizard.triggerPhase !== 'key_up'
                      ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  👇 Appui (Key Down)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'up' })}
                  className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    activeWizard.triggerPhase === 'up' || activeWizard.triggerPhase === 'key_up'
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
        {activeWizard.triggerType === 'proximity' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Rayon de proximité (pixels) :</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={10}
                  step={10}
                  value={activeWizard.proximityDistance || 80}
                  onChange={(e) => setActiveWizard({ ...activeWizard, proximityDistance: Math.max(10, parseInt(e.target.value) || 50) })}
                  className="w-32 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                />
                <span className="text-xs text-slate-500 font-bold">pixels</span>
              </div>
            </div>
          </div>
        )}

        {/* 4. Variable / Score */}
        {activeWizard.triggerType === 'variable' && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Comparaison :</label>
                <select
                  value={activeWizard.variableOperator || '>='}
                  onChange={(e) => setActiveWizard({ ...activeWizard, variableOperator: e.target.value as any })}
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
                  value={activeWizard.variableValue ?? 5}
                  onChange={(e) => setActiveWizard({ ...activeWizard, variableValue: parseInt(e.target.value) || 0 })}
                  className="w-full text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                />
              </div>
            </div>
          </div>
        )}

        {/* 5. Bord de Scène */}
        {activeWizard.triggerType === 'boundary' && (
          <div className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Bord de scène à contacter :</label>
              <select
                value={activeWizard.boundaryEdge || 'any'}
                onChange={(e) => setActiveWizard({ ...activeWizard, boundaryEdge: e.target.value as any })}
                className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
              >
                <option value="any">N'importe quel bord</option>
                <option value="top">Bord Haut</option>
                <option value="bottom">Bord Bas</option>
                <option value="left">Bord Gauche</option>
                <option value="right">Bord Droit</option>
              </select>
            </div>
          </div>
        )}

        {/* 6. Collision anti-boucle */}
        {activeWizard.triggerType === 'collision' && (
          <div className="space-y-3 bg-indigo-50/60 p-4 rounded-2xl border border-indigo-200/80">
            <label className="flex items-center justify-between gap-2 text-xs font-bold text-indigo-900">
              <span>Marge anti-rebond de sortie (px) :</span>
              <input
                type="number"
                min={0}
                max={60}
                step={2}
                value={activeWizard.collisionExitMargin ?? 10}
                onChange={(e) =>
                  setActiveWizard({
                    ...activeWizard,
                    collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                  })
                }
                className="w-20 px-2.5 py-1.5 text-center text-xs font-bold bg-white border border-indigo-200 rounded-xl outline-none"
              />
            </label>
            <button
              type="button"
              onClick={() =>
                setActiveWizard({
                  ...activeWizard,
                  collisionTriggerOnce: !activeWizard.collisionTriggerOnce,
                })
              }
              className={`w-full px-3 py-2 rounded-xl text-xs font-black border transition-all cursor-pointer ${
                activeWizard.collisionTriggerOnce
                  ? 'bg-emerald-600 text-white border-emerald-600'
                  : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/60'
              }`}
            >
              {activeWizard.collisionTriggerOnce ? '✓ 1 seule fois par paire' : '1× par paire (Optionnel)'}
            </button>
          </div>
        )}

        {/* 7. Option d'Auto-remise dédiée */}
        {['click', 'hover', 'keyboard', 'collision', 'proximity'].includes(activeWizard.triggerType) && (
          <div className="pt-2 border-t border-slate-200/80 space-y-2">
            <label className="text-xs font-bold text-slate-800 block flex items-center gap-1.5">
              <span>🔄 Option d'Auto-remise (Restaurer l'état initial au relâchement/sortie) :</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, autoRevert: true })}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  activeWizard.autoRevert
                    ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300/60 text-emerald-950 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs text-emerald-800">
                  <span>↩️ Activer l'Auto-remise</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                  Restaure l'état initial au relâchement (clic/touche) ou à la fin du survol/contact.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveWizard({ ...activeWizard, autoRevert: false })}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  !activeWizard.autoRevert
                    ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300/60 text-slate-900 shadow-2xs'
                    : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <div className="flex items-center gap-1.5 font-black text-xs text-slate-700">
                  <span>➡️ Pas d'Auto-remise</span>
                </div>
                <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                  Conserve le nouvel état définitivement après l'événement.
                </span>
              </button>
            </div>
          </div>
        )}

        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                step: isWizardGlobal ? 3 : 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                targetSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
          >
            <span>
              {isWizardGlobal
                ? "Continuer vers l'Action (Étape 3)"
                : isWizardRelational
                ? 'Continuer vers les Objets Sujet & Cible (Étape 2)'
                : "Continuer vers l'Objet Sujet (Étape 2)"}
            </span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* CASE 1 : COLLISIONS & CONTACTS (Nécessite Sujet & Cible) */}
      <div className="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-200/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-indigo-800 tracking-wider flex-wrap">
          <span>💥 Collisions &amp; Contacts entre Objets</span>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
            Sujet ↔ Cible
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'collision',
                triggerPhase: 'enter',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                targetSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              💥
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                Collision Entrée
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Premier contact quand le sujet touche la cible
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'collision',
                triggerPhase: 'exit',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                targetSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              💨
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                Collision Sortie
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Séparation dès que le sujet quitte la cible
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'collision',
                triggerPhase: 'stay',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                targetSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              ⏳
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                Contact Continu
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Maintenu tant que les deux objets se touchent
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'collision',
                triggerPhase: 'collision_release',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                targetSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              🎯
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                Lâché sur Cible
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Relâchement du sujet pendant la collision
              </div>
            </div>
          </button>
        </div>

        {/* Options anti-boucle Collision */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-200/70">
          <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900">
            <span>Marge anti-rebond sortie :</span>
            <input
              type="number"
              min={0}
              max={60}
              step={2}
              value={activeWizard.collisionExitMargin ?? 10}
              onChange={(e) =>
                setActiveWizard({
                  ...activeWizard,
                  collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                })
              }
              className="w-14 px-2 py-1 text-center text-xs font-bold bg-white border border-indigo-200 rounded-lg outline-none focus:border-indigo-500"
            />
            <span className="text-[10px] text-indigo-600 font-normal">px (évite les boucles si l'état change de taille)</span>
          </label>
          <button
            type="button"
            onClick={() =>
              setActiveWizard({
                ...activeWizard,
                collisionTriggerOnce: !activeWizard.collisionTriggerOnce,
              })
            }
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
              activeWizard.collisionTriggerOnce
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/60'
            }`}
          >
            {activeWizard.collisionTriggerOnce ? '✓ 1 seule fois par paire' : '1× par paire (Optionnel)'}
          </button>
        </div>
      </div>

      {/* CASE 2 : CLICS & POINTEUR */}
      <div className="bg-purple-50/50 p-4 rounded-3xl border border-purple-200/80 space-y-3">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-purple-800 tracking-wider">
          <span>👆 Clics &amp; Pointeur Souris / Tactile</span>
          <span className="text-[10px] font-bold text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full">
            1 Objet (Sujet)
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'click',
                triggerPhase: 'click',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              👆
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                Clic Complet
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Action exécutée lors d'un clic complet sur l'objet
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'click',
                triggerPhase: 'down',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              👇
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                Appui Clic (Mouse Down)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Dès la pression du bouton du pointeur
              </div>
            </div>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'click',
                triggerPhase: 'up',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
              🖐️
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                Relâchement Clic (Mouse Up)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Au relâchement du bouton du pointeur
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* CASE 3 & 4 : SURVOL & GLISSER-DÉPOSER */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-200/80 space-y-3">
          <div className="text-xs font-black uppercase text-amber-800 tracking-wider">
            👀 Survol Souris (Hover)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'hover',
                  triggerPhase: 'hover_enter',
                  step: 2,
                  objectPhase: 'subject',
                  subjectSubStep: 'choose_object',
                  actionSubStep: 'main',
                });
              }}
              className="p-3.5 bg-white hover:bg-amber-100/60 border-2 border-amber-100 hover:border-amber-500 rounded-2xl flex flex-col justify-between gap-1.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                👀
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-amber-800">
                  Survol Entrée
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Mouse Hover Enter
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'hover',
                  triggerPhase: 'hover_exit',
                  step: 2,
                  objectPhase: 'subject',
                  subjectSubStep: 'choose_object',
                  actionSubStep: 'main',
                });
              }}
              className="p-3.5 bg-white hover:bg-amber-100/60 border-2 border-amber-100 hover:border-amber-500 rounded-2xl flex flex-col justify-between gap-1.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
            >
              <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                🏃
              </div>
              <div>
                <div className="text-xs font-black text-slate-900 group-hover:text-amber-800">
                  Survol Sortie
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Mouse Hover Exit
                </div>
              </div>
            </button>
          </div>
        </div>

        <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-200/80 space-y-3">
          <div className="text-xs font-black uppercase text-emerald-800 tracking-wider">
            🫳 Glisser-Déposer libre
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'drag',
                triggerPhase: 'drag_release',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="w-full p-3.5 bg-white hover:bg-emerald-100/60 border-2 border-emerald-100 hover:border-emerald-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
              🫳
            </div>
            <div>
              <div className="text-xs font-black text-slate-900 group-hover:text-emerald-800">
                Relâcher dans le vide (Drop)
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Quand l'objet est déposé n'importe où sur le canvas
              </div>
            </div>
          </button>
        </div>
      </div>

      {/* CASE 5 & 6 : MINUTEURS & CLAVIER (Conditions Globales -> sautent directement à Étape 3 Action) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-cyan-50/50 p-4 rounded-3xl border border-cyan-200/80 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-black uppercase text-cyan-800 tracking-wider">
              ⏱️ Minuteurs &amp; Chronomètres
            </div>
            <span className="text-[10px] font-bold text-cyan-700 bg-cyan-100 px-2 py-0.5 rounded-full">
              Global ⚡
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'timer',
                  timerInterval: 3,
                  timerType: 'once',
                  step: 3,
                  actionSubStep: 'main',
                });
              }}
              className="p-3 bg-white hover:bg-cyan-100/60 border-2 border-cyan-100 hover:border-cyan-500 rounded-2xl text-left cursor-pointer transition-all shadow-xs group"
            >
              <div className="text-lg mb-1">⏱️</div>
              <div className="text-xs font-black text-slate-900 group-hover:text-cyan-800">
                Après 3s
              </div>
              <div className="text-[10px] text-slate-500">
                Timer unique
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'timer',
                  timerInterval: 2,
                  timerType: 'repeat',
                  step: 3,
                  actionSubStep: 'main',
                });
              }}
              className="p-3 bg-white hover:bg-cyan-100/60 border-2 border-cyan-100 hover:border-cyan-500 rounded-2xl text-left cursor-pointer transition-all shadow-xs group"
            >
              <div className="text-lg mb-1">🔄</div>
              <div className="text-xs font-black text-slate-900 group-hover:text-cyan-800">
                Toutes les 2s
              </div>
              <div className="text-[10px] text-slate-500">
                Récurrent
              </div>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveWizard({
                  ...activeWizard,
                  triggerType: 'timer',
                  timerInterval: activeWizard.timerInterval ?? 2,
                  timerType: activeWizard.timerType ?? 'repeat',
                  actionSubStep: 'config_event_params',
                });
              }}
              className="p-3 bg-white hover:bg-cyan-100/60 border-2 border-cyan-100 hover:border-cyan-500 rounded-2xl text-left cursor-pointer transition-all shadow-xs group"
            >
              <div className="text-lg mb-1">⚙️</div>
              <div className="text-xs font-black text-slate-900 group-hover:text-cyan-800">
                Personnaliser
              </div>
              <div className="text-[10px] text-slate-500">
                Durée exacte →
              </div>
            </button>
          </div>
        </div>

        <div className="bg-slate-100/80 p-4 rounded-3xl border border-slate-300 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-black uppercase text-slate-800 tracking-wider">
              ⌨️ Touches du Clavier
            </div>
            <span className="text-[10px] font-bold text-slate-700 bg-slate-200 px-2 py-0.5 rounded-full">
              Global ⚡
            </span>
          </div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'keyboard',
                actionSubStep: 'key_picker',
              });
            }}
            className="w-full p-4 bg-white hover:bg-slate-200/80 border-2 border-slate-300 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
          >
            <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
              ⌨️
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                Touche de Clavier
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Choisir la touche (Espace, Flèches, Z/Q/S/D, Entrée, etc.) →
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
          </button>
        </div>
      </div>

      {/* CASE 7, 8, 9, 10 : ÉTATS, PROXIMITÉ, BORDS & SCORE */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-violet-50/50 p-3.5 rounded-2xl border border-violet-200 space-y-2">
          <div className="text-xs font-black uppercase text-violet-800">🔄 Changement d'État</div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'state_change',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="w-full p-2.5 bg-white hover:bg-violet-100 border border-violet-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
          >
            <span className="text-xl">✨</span>
            <div>
              <div className="text-xs font-black text-slate-900">Nouveau statut</div>
              <div className="text-[9px] text-slate-500">L'objet passe à l'état X</div>
            </div>
          </button>
        </div>

        <div className="bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200 space-y-2">
          <div className="text-xs font-black uppercase text-sky-800">📏 Proximité</div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'proximity',
                proximityDistance: 80,
                actionSubStep: 'config_event_params',
              });
            }}
            className="w-full p-2.5 bg-white hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
          >
            <span className="text-xl">📏</span>
            <div>
              <div className="text-xs font-black text-slate-900">Approche Cible</div>
              <div className="text-[9px] text-slate-500">Définir le rayon en px →</div>
            </div>
          </button>
        </div>

        <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200 space-y-2">
          <div className="text-xs font-black uppercase text-rose-800">🖼️ Bords du Canvas</div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'boundary',
                boundaryEdge: 'any',
                actionSubStep: 'config_event_params',
              });
            }}
            className="w-full p-2.5 bg-white hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
          >
            <span className="text-xl">🖼️</span>
            <div>
              <div className="text-xs font-black text-slate-900">Touche le Cadre</div>
              <div className="text-[9px] text-slate-500">Définir le bord à contacter →</div>
            </div>
          </button>
        </div>

        <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
          <div className="text-xs font-black uppercase text-amber-800">📊 Score &amp; Variables</div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'variable',
                variableName: 'score',
                variableOperator: '>=',
                variableValue: 5,
                actionSubStep: 'config_event_params',
              });
            }}
            className="w-full p-2.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
          >
            <span className="text-xl">🏆</span>
            <div>
              <div className="text-xs font-black text-slate-900">Score &amp; Compteur</div>
              <div className="text-[9px] text-slate-500">Régler le seuil (Global) →</div>
            </div>
          </button>
        </div>

        <div className="bg-red-50/50 p-3.5 rounded-2xl border border-red-200 space-y-2 sm:col-span-2 lg:col-span-4">
          <div className="text-xs font-black uppercase text-red-800">⛓️‍💥 Rupture de Joint (Break Joint)</div>
          <button
            type="button"
            onClick={() => {
              setActiveWizard({
                ...activeWizard,
                triggerType: 'joint_break',
                triggerPhase: 'joint_break',
                step: 2,
                objectPhase: 'subject',
                subjectSubStep: 'choose_object',
                actionSubStep: 'main',
              });
            }}
            className="w-full p-2.5 bg-white hover:bg-red-100/70 border border-red-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
          >
            <span className="text-xl">⛓️‍💥</span>
            <div>
              <div className="text-xs font-black text-slate-900">Quand le joint casse (traction ou secousse)</div>
              <div className="text-[10px] text-slate-500">
                Ex: feuille arrachée d'une branche, membre détaché — choisissez l'enfant concerné
              </div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
