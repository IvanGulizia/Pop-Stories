import React from 'react';
import { Layers, Paintbrush, Pin, Plus, RotateCcw, Shield, Sliders } from 'lucide-react';
import {
  AutoDestroyBehaviorConfig,
  BoundaryBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  DraggableBehaviorConfig,
  EntityState,
  KeyboardControlBehaviorConfig,
  PhysicsBehaviorConfig,
} from '../../types';
import { FlipControls, InertiaControls } from './BehaviorSharedControls';
import { GrabPhysicsControls } from './GrabPhysicsControls';
import { EditableNumericValue } from '../shared/EditableNumericValue';
import { BehaviorSubSection } from './BehaviorSubSection';
import { BehaviorRuleShortcutButton } from './BehaviorRuleShortcutButton';

export function DraggableBehaviorControls({
  b,
  update,
}: {
  b: DraggableBehaviorConfig;
  update: (partial: any) => void;
}) {
  return <GrabPhysicsControls config={b} update={update} accent="indigo" />;
}

export function PhysicsBehaviorControls({
  b,
  update,
  entityId,
  stateList = [],
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: PhysicsBehaviorConfig;
  update: (partial: any) => void;
  entityId?: string;
  stateList?: EntityState[];
  onQuickCreateState?: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* 1. Corps & Collider */}
      <BehaviorSubSection
        title="Corps & Collider"
        subtitle={b.isTrigger ? 'Zone capteur (Trigger)' : b.isStatic ? 'Obstacle fixe' : 'Corps dynamique'}
        icon={<Shield className="w-3.5 h-3.5 text-emerald-600" />}
        summaryBadge={b.isTrigger ? 'Trigger' : b.isStatic ? 'Fixe' : 'Dynamique'}
        persistKey={entityId ? `${entityId}:${b.id}:physics_body` : undefined}
        defaultOpen={true}
        headerActions={
          <BehaviorRuleShortcutButton
            entityId={entityId}
            triggerType="collision"
            triggerPhase="enter"
            label="Collision"
          />
        }
      >
        {/* Ligne 1: Collider Solide vs Trigger */}
        <div className="p-2 bg-slate-50/70 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs">Collider Solide</div>
            <div className="text-[10px] text-slate-400">
              {b.isTrigger ? 'Zone fantôme / Capteur (traverse sans bloquer)' : 'Corps solide (bloque et repousse)'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={b.isTrigger !== true}
            onChange={(e) => update({ isTrigger: !e.target.checked })}
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            title="Décocher pour en faire un Trigger (capteur sans collision physique)"
          />
        </div>

        {/* Ligne 2: Obstacle Fixe */}
        <div className="p-2 bg-slate-50/70 rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs">Obstacle Fixe (Inamovible)</div>
            <div className="text-[10px] text-slate-400">
              {b.isStatic ? 'Immobile / Solide fixe (Masse infinie)' : 'Corps physique mobile (Dynamique)'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={b.isStatic === true}
            onChange={(e) =>
              update({
                isStatic: e.target.checked,
                ...(e.target.checked ? { worldPinEnabled: false } : {}),
              })
            }
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            title="Cocher pour un mur, un sol ou une plateforme infranchissable"
          />
        </div>

        {/* Ligne 2.5: Plateforme traversable par le bas (One-Way) */}
        {b.isStatic && !b.isTrigger && (
          <div className="p-2 bg-emerald-50/50 rounded-xl border border-emerald-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-emerald-900 text-xs">Plateforme traversable (One-Way)</div>
              <div className="text-[10px] text-emerald-700/80">
                {b.oneWayPlatform
                  ? 'On peut sauter à travers par le bas et atterrir dessus par le haut'
                  : 'Solide sur les 4 côtés (mur / sol plein)'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={b.oneWayPlatform === true}
              onChange={(e) => update({ oneWayPlatform: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
            />
          </div>
        )}
      </BehaviorSubSection>

      {/* 2. Gravité & Matériau */}
      <BehaviorSubSection
        title="Gravité & Matériau"
        subtitle="Gravité, rebond, friction et masse"
        icon={<Sliders className="w-3.5 h-3.5 text-indigo-600" />}
        summaryBadge={
          b.isStatic
            ? `Rebond ${Math.round((b.bounce ?? 0.4) * 100)}%`
            : `g=${b.gravity ?? 400}`
        }
        persistKey={entityId ? `${entityId}:${b.id}:physics_material` : undefined}
        defaultOpen={true}
      >

      {/* Ligne 3: Gravité verticale (seulement si non statique) */}
      {!b.isStatic && (
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Gravité verticale</span>
            <EditableNumericValue
              value={b.gravity ?? 400}
              unit="px/s²"
              precision={1}
              onChange={(v) => update({ gravity: v })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="-2000"
            max="2000"
            step="50"
            value={Math.max(-2000, Math.min(2000, b.gravity ?? 400))}
            onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      )}

      {/* Ligne 4: Rebond sur les autres objets */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Rebond (Restitution)</span>
            <span className="text-[10px] text-slate-400 block">Élasticité du choc avec les autres objets</span>
          </div>
          <EditableNumericValue
            value={Math.round((b.bounce ?? 0.4) * 1000) / 10}
            unit="%"
            precision={1}
            onChange={(v) => update({ bounce: v / 100 })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="0"
          max="1.2"
          step="0.05"
          value={Math.max(0, Math.min(1.2, b.bounce ?? 0.4))}
          onChange={(e) => update({ bounce: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 5: Friction / Adhérence au contact */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Adhérence surface (Friction)</span>
            <span className="text-[10px] text-slate-400 block">
              0 = Glace (glisse) • 0.6+ = Accroche &amp; fait rouler les balles
            </span>
          </div>
          <EditableNumericValue
            value={Math.round((b.friction ?? 0.6) * 1000) / 10}
            unit="%"
            precision={1}
            onChange={(v) => update({ friction: v / 100 })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={Math.max(0, Math.min(1, b.friction ?? 0.6))}
          onChange={(e) => update({ friction: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 5.5: Résistance de l'air (Friction Air) */}
      {!b.isStatic && (
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <div>
              <span className="font-bold">Résistance de l'air (Freinage)</span>
              <span className="text-[10px] text-slate-400 block">
                0 = Vide spatial (aucun freinage) • 0.05+ = Freinage fort
              </span>
            </div>
            <EditableNumericValue
              value={b.frictionAir ?? 0.015}
              precision={4}
              onChange={(v) => update({ frictionAir: v })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="0"
            max="0.25"
            step="0.005"
            value={Math.max(0, Math.min(0.25, b.frictionAir ?? 0.015))}
            onChange={(e) => update({ frictionAir: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      )}

      {/* Ligne 6: Masse du corps */}
      {!b.isStatic && (
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <div>
              <span className="font-bold">Masse</span>
              <span className="text-[10px] text-slate-400 block">Influence la résistance aux chocs</span>
            </div>
            <EditableNumericValue
              value={b.mass ?? 1}
              unit="kg"
              precision={2}
              onChange={(v) => update({ mass: v })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="0.1"
            max="50"
            step="0.1"
            value={Math.max(0.1, Math.min(50, b.mass ?? 1))}
            onChange={(e) => update({ mass: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      )}

      {/* Ligne 7: Figer la rotation (Freeze Rotation) */}
      {!b.isStatic && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
              <span>Figer la rotation (Freeze Rotation)</span>
            </div>
            <div className="text-[10px] text-slate-400">
              {b.freezeRotation ? 'Rotation bloquée (l\'objet reste droit sans basculer)' : 'Rotation libre sous l\'effet des chocs'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={b.freezeRotation === true}
            onChange={(e) => update({ freezeRotation: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            title="Empêche l'objet de pivoter lors des collisions physiques"
          />
        </div>
      )}

      </BehaviorSubSection>

      {/* Ligne 8: Épingle au monde (World Pin avec résistance & rupture) */}
      {!b.isStatic && (
        <BehaviorSubSection
          title="Épingle au monde (World Pin)"
          subtitle="Maintien élastique & rupture à la traction"
          icon={<Pin className="w-3.5 h-3.5 text-amber-600" />}
          summaryBadge={
            b.worldPinEnabled
              ? b.worldPinBreakable !== false
                ? `Cassable ${b.worldPinBreakDistance ?? 60}px`
                : 'Fixe'
              : 'Inactive'
          }
          persistKey={entityId ? `${entityId}:${b.id}:physics_pin` : undefined}
          defaultOpen={Boolean(b.worldPinEnabled)}
          tone="amber"
          headerActions={
            b.worldPinEnabled && b.worldPinBreakable !== false ? (
              <BehaviorRuleShortcutButton
                entityId={entityId}
                triggerType="joint_break"
                triggerPhase="joint_break"
                label="Rupture Épingle"
              />
            ) : undefined
          }
        >
          <div className="flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-amber-950 text-xs">
                Activer l'épingle au monde
              </div>
              <div className="text-[10px] text-amber-800/75 leading-snug">
                Maintient l'objet à son ancre avec une résistance élastique ; utilisable en override d'état pour fixer puis décoller au drag.
              </div>
            </div>
            <input
              type="checkbox"
              checked={b.worldPinEnabled === true}
              onChange={(e) =>
                update({
                  worldPinEnabled: e.target.checked,
                  ...(e.target.checked
                    ? {
                        isStatic: false,
                        worldPinStiffness: b.worldPinStiffness ?? 0.25,
                        worldPinDamping: b.worldPinDamping ?? 0.15,
                        worldPinBreakable: b.worldPinBreakable !== false,
                        worldPinBreakDistance: b.worldPinBreakDistance ?? 60,
                      }
                    : {}),
                })
              }
              className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
            />
          </div>

          {b.worldPinEnabled && (
            <div className="space-y-1.5 pt-1.5 border-t border-amber-200/70">
              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <div>
                    <span className="font-bold">Raideur du maintien</span>
                    <span className="text-[10px] text-slate-400 block">
                      Force de rappel vers le point d'ancrage
                    </span>
                  </div>
                  <EditableNumericValue
                    value={Math.round((b.worldPinStiffness ?? 0.25) * 100)}
                    unit="%"
                    precision={0}
                    onChange={(v) => update({ worldPinStiffness: v / 100 })}
                    className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="0.05"
                  max="0.95"
                  step="0.05"
                  value={Math.max(0.05, Math.min(0.95, b.worldPinStiffness ?? 0.25))}
                  onChange={(e) => update({ worldPinStiffness: parseFloat(e.target.value) })}
                  className="w-full accent-amber-600"
                />
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200">
                <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                  <div>
                    <span className="font-bold">Amortissement</span>
                    <span className="text-[10px] text-slate-400 block">
                      Calme les oscillations autour de l'épingle
                    </span>
                  </div>
                  <EditableNumericValue
                    value={Math.round((b.worldPinDamping ?? 0.15) * 100)}
                    unit="%"
                    precision={0}
                    onChange={(v) => update({ worldPinDamping: v / 100 })}
                    className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="0.6"
                  step="0.02"
                  value={Math.max(0.02, Math.min(0.6, b.worldPinDamping ?? 0.15))}
                  onChange={(e) => update({ worldPinDamping: parseFloat(e.target.value) })}
                  className="w-full accent-amber-600"
                />
              </div>

              <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-700 text-xs">Cassable à la traction</div>
                  <div className="text-[10px] text-slate-400">
                    Libère l'objet et émet un événement « Rupture de Joint » si on tire assez fort
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={b.worldPinBreakable !== false}
                  onChange={(e) => update({ worldPinBreakable: e.target.checked })}
                  className="w-4 h-4 accent-amber-600 rounded cursor-pointer shrink-0"
                />
              </div>

              {b.worldPinBreakable !== false && (
                <>
                  <div className="p-2 bg-white rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                      <div>
                        <span className="font-bold">Distance d'arrachement</span>
                        <span className="text-[10px] text-slate-400 block">
                          Étirement avant que l'épingle ne cède
                        </span>
                      </div>
                      <EditableNumericValue
                        value={b.worldPinBreakDistance ?? 60}
                        unit="px"
                        precision={0}
                        onChange={(v) => update({ worldPinBreakDistance: v })}
                        className="font-mono font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
                      />
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="250"
                      step="5"
                      value={Math.max(15, Math.min(250, b.worldPinBreakDistance ?? 60))}
                      onChange={(e) => update({ worldPinBreakDistance: parseFloat(e.target.value) })}
                      className="w-full accent-rose-600"
                    />
                  </div>

                  {stateList.length > 0 && (
                    <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2 overflow-hidden">
                      <div className="space-y-1">
                        <span className="font-bold text-slate-700 text-xs block truncate">
                          État en traction (résistance)
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <select
                            value={b.worldPinPullingStateId || ''}
                            onChange={(e) =>
                              update({ worldPinPullingStateId: e.target.value || undefined })
                            }
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="">Aucun changement</option>
                            {stateList.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                          {b.worldPinPullingStateId && onEditStateDrawing && (
                            <button
                              type="button"
                              onClick={() => onEditStateDrawing(b.worldPinPullingStateId!)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer shrink-0"
                              title="Dessiner / modifier cet état"
                            >
                              <Paintbrush className="w-3 h-3" />
                            </button>
                          )}
                          {onQuickCreateState && (
                            <button
                              type="button"
                              onClick={() => {
                                const createdId = onQuickCreateState('Résistance', 'Physique');
                                update({ worldPinPullingStateId: createdId });
                              }}
                              className="p-1 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 cursor-pointer shrink-0"
                              title="Créer rapidement un état « Résistance »"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-1 pt-1.5 border-t border-slate-100">
                        <span className="font-bold text-slate-700 text-xs block truncate">
                          État après arrachement
                        </span>
                        <div className="flex items-center gap-1 min-w-0">
                          <select
                            value={b.worldPinBrokenStateId || ''}
                            onChange={(e) =>
                              update({ worldPinBrokenStateId: e.target.value || undefined })
                            }
                            className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="">Aucun changement</option>
                            {stateList.map((st) => (
                              <option key={st.id} value={st.id}>
                                {st.name}
                              </option>
                            ))}
                          </select>
                          {b.worldPinBrokenStateId && onEditStateDrawing && (
                            <button
                              type="button"
                              onClick={() => onEditStateDrawing(b.worldPinBrokenStateId!)}
                              className="p-1 text-indigo-600 hover:bg-indigo-50 rounded-lg border border-indigo-200 cursor-pointer shrink-0"
                              title="Dessiner / modifier cet état"
                            >
                              <Paintbrush className="w-3 h-3" />
                            </button>
                          )}
                          {onQuickCreateState && (
                            <button
                              type="button"
                              onClick={() => {
                                const createdId = onQuickCreateState('Arraché', 'Physique');
                                update({ worldPinBrokenStateId: createdId });
                              }}
                              className="p-1 text-amber-700 hover:bg-amber-50 rounded-lg border border-amber-200 cursor-pointer shrink-0"
                              title="Créer rapidement un état « Arraché »"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="text-[10px] text-slate-400 leading-snug">
                        Astuce : réglez Gravité = 0 px/s² pour qu'un objet épinglé reste parfaitement droit sans pendre avant d'être arraché.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </BehaviorSubSection>
      )}
    </div>
  );
}

export function AutoDestroyBehaviorControls({
  b,
  update,
}: {
  b: AutoDestroyBehaviorConfig;
  update: (partial: any) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Durée de vie avant autodestruction */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Durée de vie (Délai)</span>
            <span className="text-[10px] text-slate-400 block">Délai avant suppression automatique</span>
          </div>
          <EditableNumericValue
            value={b.delay ?? 3}
            unit="s"
            precision={2}
            onChange={(v) => update({ delay: v })}
            className="font-mono font-bold text-orange-600 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="0.2"
          max="20"
          step="0.2"
          value={Math.max(0.2, Math.min(20, b.delay ?? 3))}
          onChange={(e) => update({ delay: parseFloat(e.target.value) })}
          className="w-full accent-orange-600"
        />
      </div>
    </div>
  );
}

export function ConstantVelocityBehaviorControls({
  b,
  update,
}: {
  b: ConstantVelocityBehaviorConfig;
  update: (partial: any) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Vitesse X */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-700 text-xs block">Vitesse horizontale X</span>
          <span className="text-[10px] text-slate-400">Négatif = gauche, Positif = droite</span>
        </div>
        <EditableNumericValue
          value={b.vx}
          unit="px/s"
          precision={2}
          onChange={(v) => update({ vx: v })}
          className="bg-slate-50 hover:bg-indigo-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-slate-800 cursor-text tabular-nums"
        />
      </div>

      {/* Ligne 2: Vitesse Y */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-700 text-xs block">Vitesse verticale Y</span>
          <span className="text-[10px] text-slate-400">Négatif = haut, Positif = bas</span>
        </div>
        <EditableNumericValue
          value={b.vy}
          unit="px/s"
          precision={2}
          onChange={(v) => update({ vy: v })}
          className="bg-slate-50 hover:bg-indigo-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-slate-800 cursor-text tabular-nums"
        />
      </div>

      {/* Ligne 3: Rotation continue */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Rotation continue</span>
          <EditableNumericValue
            value={b.angularVelocity || 0}
            unit="°/s"
            precision={1}
            onChange={(v) => update({ angularVelocity: v })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="-360"
          max="360"
          step="10"
          value={Math.max(-360, Math.min(360, b.angularVelocity || 0))}
          onChange={(e) => update({ angularVelocity: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}

export function KeyboardControlBehaviorControls({
  b,
  update,
  entityId,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: KeyboardControlBehaviorConfig;
  update: (partial: any) => void;
  entityId?: string;
  stateList: EntityState[];
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  const linkedKbdStates = [
    b.stateBindings?.idleStateId,
    b.stateBindings?.moveStateId,
    b.mode === 'platformer' ? b.stateBindings?.jumpStateId : undefined,
    b.mode === 'platformer' ? b.stateBindings?.fallStateId : undefined,
    b.mode === 'platformer' ? b.stateBindings?.landStateId : undefined,
  ].filter(Boolean).length;

  return (
    <div className="space-y-1.5">
      {/* 1. Contrôles & Axes */}
      <BehaviorSubSection
        title="Contrôles & Axes"
        subtitle="Mode, touches et directions"
        icon={<Sliders className="w-3.5 h-3.5 text-indigo-600" />}
        summaryBadge={b.mode === 'platformer' ? 'Plateforme' : '8 directions'}
        persistKey={entityId ? `${entityId}:${b.id}:kbd_controls` : undefined}
        defaultOpen={true}
      >
      {/* Ligne 1: Mode de jeu */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Mode de jeu</span>
        <select
          value={b.mode}
          onChange={(e) => update({ mode: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="top_down">Vue de dessus (8 directions)</option>
          <option value="platformer">Plateforme (Gauche/Droite + Saut)</option>
        </select>
      </div>

      {/* Ligne 2: Type de touches */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Touches actives</span>
        <select
          value={b.layout}
          onChange={(e) => update({ layout: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="both">Flèches & ZQSD / WASD</option>
          <option value="arrows">Flèches uniquement</option>
          <option value="wasd">Touches ZQSD / WASD</option>
        </select>
      </div>

      {/* Ligne 3: Restriction Axe Horizontal */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Mouvement horizontal (Gauche / Droite)</div>
          <div className="text-[10px] text-slate-400">Autorise le déplacement sur l'axe X</div>
        </div>
        <input
          type="checkbox"
          checked={b.allowHorizontal !== false}
          onChange={(e) => update({ allowHorizontal: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
        />
      </div>

      {/* Ligne 4: Restriction Axe Vertical (si mode Vue de dessus) */}
      {b.mode === 'top_down' && (
        <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
          <div>
            <div className="font-bold text-slate-700 text-xs">Mouvement vertical (Haut / Bas)</div>
            <div className="text-[10px] text-slate-400">Autorise le déplacement sur l'axe Y</div>
          </div>
          <input
            type="checkbox"
            checked={b.allowVertical !== false}
            onChange={(e) => update({ allowVertical: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      )}

      {/* Ligne 5: Autoriser le saut (si mode Plateforme) */}
      {b.mode === 'platformer' && (
        <>
          <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-700 text-xs">Autoriser le saut</div>
              <div className="text-[10px] text-slate-400">Active l'impulsion verticale (Haut / Espace)</div>
            </div>
            <input
              type="checkbox"
              checked={b.allowJump !== false}
              onChange={(e) => update({ allowJump: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {b.allowJump !== false && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-bold">Nombre de sauts max</span>
                <EditableNumericValue
                  value={b.maxJumps ?? 1}
                  displayText={`${b.maxJumps ?? 1} ${(b.maxJumps ?? 1) > 1 ? 'sauts' : 'saut'}`}
                  precision={0}
                  onChange={(v) => update({ maxJumps: Math.round(v) })}
                  className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="1"
                max="10"
                step="1"
                value={Math.max(1, Math.min(10, b.maxJumps ?? 1))}
                onChange={(e) => update({ maxJumps: parseInt(e.target.value, 10) || 1 })}
                className="w-full accent-indigo-600 h-1.5"
              />
              <div className="text-[10px] text-slate-400 mt-0.5">
                1 = saut simple (au sol), 2 = double saut, etc.
              </div>
            </div>
          )}
        </>
      )}

      </BehaviorSubSection>

      {/* 2. Vitesse, Saut & Inertie */}
      <BehaviorSubSection
        title="Vitesse, Saut & Inertie"
        subtitle="Course, saut, accélération et flip"
        icon={<RotateCcw className="w-3.5 h-3.5 text-indigo-600" />}
        summaryBadge={`${b.speed} px/s`}
        persistKey={entityId ? `${entityId}:${b.id}:kbd_motion` : undefined}
        defaultOpen={true}
      >
      {/* Ligne 6: Vitesse de déplacement */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Vitesse de course</span>
          <EditableNumericValue
            value={b.speed}
            unit="px/s"
            precision={1}
            onChange={(v) => update({ speed: v })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="50"
          max="500"
          step="10"
          value={Math.max(50, Math.min(500, b.speed))}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 7: Force de saut (si mode plateforme et saut autorisé) */}
      {b.mode === 'platformer' && b.allowJump !== false && (
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Impulsion de saut</span>
            <EditableNumericValue
              value={b.jumpForce ?? 450}
              unit="px/s"
              precision={1}
              onChange={(v) => update({ jumpForce: v })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="200"
            max="800"
            step="25"
            value={Math.max(200, Math.min(800, b.jumpForce ?? 450))}
            onChange={(e) => update({ jumpForce: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      )}

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0.8} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
      </BehaviorSubSection>

      {/* Ligne 8: Liaisons automatiques d'états visuels + Garde-fou */}
      <BehaviorSubSection
        title="États visuels automatiques"
        subtitle="Garde-fou actif"
        icon={<Layers className="w-3.5 h-3.5 text-indigo-600" />}
        summaryBadge={`${linkedKbdStates} liés`}
        persistKey={entityId ? `${entityId}:${b.id}:kbd_states` : undefined}
        defaultOpen={true}
        tone="blue"
      >
        <div className="text-[10px] text-indigo-700/80 leading-snug">
          Change d'état automatiquement selon le mouvement. Ne remplace jamais les autres états (ex : Blessé, Attaque).
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
            <span className="text-[11px] font-bold text-slate-700">Repos (Idle)</span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={b.stateBindings?.idleStateId || ''}
                onChange={(e) =>
                  update({
                    stateBindings: {
                      ...(b.stateBindings || {}),
                      idleStateId: e.target.value || undefined,
                    },
                  })
                }
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
              >
                <option value="">-- Non défini --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const createdId = onQuickCreateState('Idle', 'Contrôleur');
                  if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), idleStateId: createdId } });
                }}
                className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
                title="Créer et lier l'état « Idle »"
              >
                <Plus className="w-3 h-3" />
              </button>
              {b.stateBindings?.idleStateId && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(b.stateBindings!.idleStateId!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
            <span className="text-[11px] font-bold text-slate-700">Marche / Mouvement</span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={b.stateBindings?.moveStateId || ''}
                onChange={(e) =>
                  update({
                    stateBindings: {
                      ...(b.stateBindings || {}),
                      moveStateId: e.target.value || undefined,
                    },
                  })
                }
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
              >
                <option value="">-- Non défini --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const createdId = onQuickCreateState('Walk', 'Contrôleur');
                  if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), moveStateId: createdId } });
                }}
                className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
                title="Créer et lier l'état « Walk »"
              >
                <Plus className="w-3 h-3" />
              </button>
              {b.stateBindings?.moveStateId && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(b.stateBindings!.moveStateId!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>

          {b.mode === 'platformer' && (
            <>
              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-bold text-slate-700">Saut (Montée)</span>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={b.stateBindings?.jumpStateId || ''}
                    onChange={(e) =>
                      update({
                        stateBindings: {
                          ...(b.stateBindings || {}),
                          jumpStateId: e.target.value || undefined,
                        },
                      })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
                  >
                    <option value="">-- Non défini --</option>
                    {stateList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const createdId = onQuickCreateState('Jump', 'Contrôleur');
                      if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), jumpStateId: createdId } });
                    }}
                    className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
                    title="Créer et lier l'état « Jump »"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {b.stateBindings?.jumpStateId && onEditStateDrawing && (
                    <button
                      type="button"
                      onClick={() => onEditStateDrawing(b.stateBindings!.jumpStateId!)}
                      className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                      title="Dessiner cet état"
                    >
                      <Paintbrush className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-bold text-slate-700">Chute (Descente)</span>
                <div className="flex items-center gap-1 shrink-0">
                  <select
                    value={b.stateBindings?.fallStateId || ''}
                    onChange={(e) =>
                      update({
                        stateBindings: {
                          ...(b.stateBindings || {}),
                          fallStateId: e.target.value || undefined,
                        },
                      })
                    }
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
                  >
                    <option value="">-- Non défini --</option>
                    {stateList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      const createdId = onQuickCreateState('Fall', 'Contrôleur');
                      if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), fallStateId: createdId } });
                    }}
                    className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
                    title="Créer et lier l'état « Fall »"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                  {b.stateBindings?.fallStateId && onEditStateDrawing && (
                    <button
                      type="button"
                      onClick={() => onEditStateDrawing(b.stateBindings!.fallStateId!)}
                      className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                      title="Dessiner cet état"
                    >
                      <Paintbrush className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white p-1.5 rounded-lg border border-indigo-100 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Atterrissage (Land)</span>
                  <div className="flex items-center gap-1 shrink-0">
                    <select
                      value={b.stateBindings?.landStateId || ''}
                      onChange={(e) =>
                        update({
                          stateBindings: {
                            ...(b.stateBindings || {}),
                            landStateId: e.target.value || undefined,
                          },
                        })
                      }
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
                    >
                      <option value="">-- Non défini --</option>
                      {stateList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => {
                        const createdId = onQuickCreateState('Land', 'Contrôleur');
                        if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), landStateId: createdId } });
                      }}
                      className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer"
                      title="Créer et lier l'état « Land »"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    {b.stateBindings?.landStateId && onEditStateDrawing && (
                      <button
                        type="button"
                        onClick={() => onEditStateDrawing(b.stateBindings!.landStateId!)}
                        className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                        title="Dessiner cet état"
                      >
                        <Paintbrush className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                {b.stateBindings?.landStateId && (
                  <div className="flex items-center gap-2 pt-1 border-t border-indigo-50">
                    <span className="text-[10px] font-semibold text-slate-500 shrink-0">Durée :</span>
                    <input
                      type="range"
                      min="0.05"
                      max="0.6"
                      step="0.05"
                      value={Math.max(0.05, Math.min(0.6, b.stateBindings?.landDuration ?? 0.15))}
                      onChange={(e) =>
                        update({
                          stateBindings: {
                            ...(b.stateBindings || {}),
                            landDuration: parseFloat(e.target.value),
                          },
                        })
                      }
                      className="flex-1 accent-indigo-600"
                    />
                    <EditableNumericValue
                      value={b.stateBindings?.landDuration ?? 0.15}
                      unit="s"
                      precision={2}
                      onChange={(v) =>
                        update({
                          stateBindings: {
                            ...(b.stateBindings || {}),
                            landDuration: v,
                          },
                        })
                      }
                      className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded shrink-0 cursor-text tabular-nums"
                    />
                  </div>
                )}
              </div>

              {/* Hauteur minimale de chute avant Chute / Atterrissage */}
              <div className="bg-white p-1.5 rounded-lg border border-indigo-100 space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-slate-700">Hauteur min. chute (Fall / Land)</span>
                  <EditableNumericValue
                    value={b.stateBindings?.minFallHeight ?? 20}
                    unit="px"
                    precision={1}
                    onChange={(v) =>
                      update({
                        stateBindings: {
                          ...(b.stateBindings || {}),
                          minFallHeight: v,
                        },
                      })
                    }
                    className="text-[10px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="2"
                  value={Math.max(0, Math.min(160, b.stateBindings?.minFallHeight ?? 20))}
                  onChange={(e) =>
                    update({
                      stateBindings: {
                        ...(b.stateBindings || {}),
                        minFallHeight: parseInt(e.target.value, 10) || 0,
                      },
                    })
                  }
                  className="w-full accent-indigo-600 h-1.5"
                />
                <div className="text-[9px] text-slate-400 leading-tight">
                  Évite l'état Chute/Atterrissage sur de petits dénivelés ou calques irréguliers.
                </div>
              </div>
            </>
          )}
        </div>
      </BehaviorSubSection>
    </div>
  );
}

export function BoundaryBehaviorControls({
  b,
  update,
  entityId,
}: {
  b: BoundaryBehaviorConfig;
  update: (partial: any) => void;
  entityId?: string;
}) {
  const boundarySpace = b.boundarySpace || 'world';
  return (
    <div className="space-y-1.5">
      <BehaviorSubSection
        title="Limites & Bords"
        subtitle={boundarySpace === 'viewport' ? 'Cadre visible' : 'Bords du monde'}
        icon={<Shield className="w-3.5 h-3.5 text-teal-600" />}
        summaryBadge={
          b.mode === 'bounce' ? 'Rebond' : b.mode === 'wrap' ? 'Wrap' : 'Clamp'
        }
        persistKey={entityId ? `${entityId}:${b.id}:boundary` : undefined}
        defaultOpen={true}
        headerActions={
          <BehaviorRuleShortcutButton
            entityId={entityId}
            triggerType="boundary"
            triggerPhase="boundary_hit"
            label="Bord atteint"
          />
        }
      >
      {/* Ligne 0: Référentiel Monde vs Cadre visible */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <span className="font-bold text-slate-700 text-xs block">Limites de référence</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => update({ boundarySpace: 'world' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              boundarySpace === 'world'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            🌍 Bords du Monde
          </button>
          <button
            type="button"
            onClick={() => update({ boundarySpace: 'viewport' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              boundarySpace === 'viewport'
                ? 'bg-teal-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            🖼️ Cadre Visible (Écran)
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          {boundarySpace === 'viewport'
            ? 'Suit les bords visibles de la caméra en direct (idéal pour garder un objet à l’écran).'
            : 'Utilise les dimensions totales du niveau (Monde configuré sur la caméra).'}
        </p>
      </div>

      {/* Ligne 1: Comportement aux bords */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Comportement aux bords</span>
        <select
          value={b.mode}
          onChange={(e) => update({ mode: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="bounce">Rebond élastique</option>
          <option value="wrap">Téléportation continue (Wrap)</option>
          <option value="clamp">Butée infranchissable (Clamp)</option>
        </select>
      </div>

      {/* Ligne 2: Élasticité du rebond aux bords */}
      {b.mode === 'bounce' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <div>
              <span className="font-bold">Rebond sur les bords</span>
              <span className="text-[10px] text-slate-400 block">
                Élasticité contre {boundarySpace === 'viewport' ? 'le cadre visible' : 'les limites du monde'}
              </span>
            </div>
            <EditableNumericValue
              value={Math.round((b.bounciness ?? 0.8) * 1000) / 10}
              unit="%"
              precision={1}
              onChange={(v) => update({ bounciness: v / 100 })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={Math.max(0, Math.min(1, b.bounciness ?? 0.8))}
            onChange={(e) => update({ bounciness: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      )}
      </BehaviorSubSection>
    </div>
  );
}
