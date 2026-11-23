import React from 'react';
import {
  Activity,
  ArrowRight,
  Clapperboard,
  Clock,
  Compass,
  Gamepad2,
  Hand,
  Heart,
  Magnet,
  Move,
  Plus,
  Repeat,
  RotateCw,
  Shield,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import { BehaviorType } from '../../types';

interface AddBehaviorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddBehavior: (type: BehaviorType) => void;
}

export function AddBehaviorModal({ isOpen, onClose, onAddBehavior }: AddBehaviorModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <Plus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Ajouter un composant</h3>
              <p className="text-[11px] text-slate-500">Comportements et physique pour cet objet</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Catégorie 1: Manipulation à la Souris */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Manipulation à la Souris
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('draggable')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Hand className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Déplaçable à la souris (Drag & Throw)</div>
                <div className="text-[11px] text-slate-500">Permet d'attraper l'objet et de le projeter avec élan et inertie.</div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('interactive_puppet')}
              className="w-full p-2.5 rounded-2xl border border-violet-200 bg-violet-50/20 hover:border-violet-400 hover:bg-violet-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <span>Marionnette Interactive (Drag avancé)</span>
                  <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    Preset
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  Paliers d'approche, survol, saisie, balancement pendulaire, survol de cibles & chute/atterrissage.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('slider')}
              className="w-full p-2.5 rounded-2xl border border-sky-200 bg-sky-50/20 hover:border-sky-400 hover:bg-sky-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <SlidersHorizontal className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Slider &amp; Glissière Contrainte (Rail / Joystick)</div>
                <div className="text-[11px] text-slate-500">
                  Rail 1D, zone 2D ou joystick élastique avec crans magnétiques et sortie vers Variables.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('rotate_drag')}
              className="w-full p-2.5 rounded-2xl border border-amber-200 bg-amber-50/20 hover:border-amber-400 hover:bg-amber-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <RotateCw className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Cadran Rotatif au Drag (Volant / Potentiomètre)</div>
                <div className="text-[11px] text-slate-500">
                  Rotation circulaire ou linéaire autour du pivot avec inertie, butées, crans et retour élastique.
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('snap')}
              className="w-full p-2.5 rounded-2xl border border-cyan-200 bg-cyan-50/20 hover:border-cyan-400 hover:bg-cyan-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Magnet className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Aimant &amp; Snap (Collage / Emboîtement)</div>
                <div className="text-[11px] text-slate-500">
                  Attire et aligne l'objet sur une cible à portée (au relâcher ou dès l'approche) avec détachement souple.
                </div>
              </div>
            </button>
          </div>

          {/* Catégorie 2: Bords de scène */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Bords (Monde &amp; Cadre Caméra)
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('boundary_behavior')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Shield className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Gestion des Bords (Monde / Cadre)</div>
                <div className="text-[11px] text-slate-500">Rebond élastique, téléportation (Wrap) ou butée sur le Monde ou le Cadre visible.</div>
              </div>
            </button>
          </div>

          {/* Catégorie 3: Contrôles Joueur */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Contrôles Joueur
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('keyboard_control')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Gamepad2 className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Contrôles Clavier (Flèches / ZQSD)</div>
                <div className="text-[11px] text-slate-500">Pilotage direct en vue de dessus ou mode plateforme avec saut.</div>
              </div>
            </button>
          </div>

          {/* Catégorie 4: Physique & Vitesse */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Physique & Vitesse
            </span>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => onAddBehavior('physics')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Gravité & Chute (RigidBody 2D)</div>
                  <div className="text-[11px] text-slate-500">Masse, rebond élastique, obstacle fixe ou capteur trigger.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('constant_velocity')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <ArrowRight className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Vitesse Continue (Projectile & Rotation)</div>
                  <div className="text-[11px] text-slate-500">Propulsion vectorielle et rotation angulaire constante.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('jiggle')}
                className="w-full p-2.5 rounded-2xl border border-fuchsia-200 bg-fuchsia-50/20 hover:border-fuchsia-400 hover:bg-fuchsia-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Waves className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Jiggle & Ressort Rotatif (Élastique)</div>
                  <div className="text-[11px] text-slate-500">
                    Oscillation angulaire autour du pivot, pesanteur locale et déformation squash & stretch.
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Catégorie 5: Déplacements autonomes */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Déplacements Autonomes & Visée
            </span>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => onAddBehavior('patrol')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Repeat className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Patrouille (Va-et-vient)</div>
                  <div className="text-[11px] text-slate-500">Mouvement oscillatoire horizontal ou vertical avec pause.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('wandering')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Shuffle className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Balade Aléatoire (Wandering)</div>
                  <div className="text-[11px] text-slate-500">Déplacement autonome et organique dans une zone paramétrable.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('move_to')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Move className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Aller vers (Move To)</div>
                  <div className="text-[11px] text-slate-500">Ralliement automatique d'une coordonnée ou d'une autre entité.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('look_at')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Compass className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Orientation (Look At)</div>
                  <div className="text-[11px] text-slate-500">Visée continue vers la souris ou une entité cible.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('follow')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Move className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Suivre (Follow)</div>
                  <div className="text-[11px] text-slate-500">Poursuite continue avec distance minimale de sécurité.</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => onAddBehavior('flee')}
                className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
              >
                <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                  <Wind className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-bold text-slate-800 text-xs">Fuir (Flee)</div>
                  <div className="text-[11px] text-slate-500">S'éloigne automatiquement de la souris, d'une entité ou d'un tag.</div>
                </div>
              </button>
            </div>
          </div>

          {/* Catégorie 6: Effets Visuels & Particules */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Effets Visuels & Particules
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('driven_animation')}
              className="w-full p-2.5 rounded-2xl border border-violet-200 bg-violet-50/20 hover:border-violet-400 hover:bg-violet-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Clapperboard className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Animation Pilotée (Variable / Proximité / Contact)</div>
                <div className="text-[11px] text-slate-500">
                  Pilote les frames Flipbook ou l’échelle selon une variable, proximité ou passage collider (réversible ou irréversible).
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('stroke_wiggle')}
              className="w-full p-2.5 rounded-2xl border border-cyan-200 bg-cyan-50/20 hover:border-cyan-400 hover:bg-cyan-50/60 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Waves className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Wiggle des Traits (Ligne Vivante)</div>
                <div className="text-[11px] text-slate-500">
                  Fait vibrer les contours façon dessin animé traditionnel (variants pré-calculés à faible coût).
                </div>
              </div>
            </button>

            <button
              type="button"
              onClick={() => onAddBehavior('particle_emitter')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Émetteur de Particules</div>
                <div className="text-[11px] text-slate-500">Flux léger de particules (étincelles, fumée, traînée) en Canvas 2D.</div>
              </div>
            </button>
          </div>

          {/* Catégorie 7: Cycle de Vie & Nettoyage */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Cycle de Vie & Nettoyage
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('auto_destroy')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Autodestruction (Lifespan)</div>
                <div className="text-[11px] text-slate-500">Détruit automatiquement l'entité après un délai défini (en secondes).</div>
              </div>
            </button>
          </div>

          {/* Catégorie 8: Jeu & Survie (Modulaire) */}
          <div className="space-y-1.5">
            <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
              Jeu & Survie
            </span>
            <button
              type="button"
              onClick={() => onAddBehavior('health')}
              className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <Heart className="w-4 h-4" />
              </div>
              <div>
                <div className="font-bold text-slate-800 text-xs">Santé & Dégâts (PV / Invincibilité)</div>
                <div className="text-[11px] text-slate-500">Cœurs/PV, contact par #tag (ex: #danger), clignotement, recul et état Blessé coopératif.</div>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
