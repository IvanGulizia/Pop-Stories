import React from 'react';
import { Clapperboard, Paintbrush, Plus } from 'lucide-react';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import {
  DrivenAnimationBehaviorConfig,
  DrivenAnimationCurve,
  DrivenAnimationEndBehavior,
  DrivenAnimationProgressionMode,
  DrivenAnimationSourceType,
  Entity,
  EntityState,
} from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';

const SOURCE_OPTIONS: { id: DrivenAnimationSourceType; label: string; desc: string }[] = [
  { id: 'proximity', label: 'Proximité', desc: 'Distance entre cet objet et une cible ou la souris' },
  { id: 'variable', label: 'Variable', desc: 'Piloté par une Variable de jeu (Slider, Cadran, Score...)' },
  { id: 'collision_step', label: 'Passage (Cran)', desc: 'Avance d’une étape à chaque contact / entrée dans un collider' },
  { id: 'collision_hold', label: 'Contact continu', desc: 'Progresse tant que le collider touche la cible (ex: usure)' },
  { id: 'speed', label: 'Vitesse', desc: 'Proportionnel à la vitesse de déplacement actuelle (px/s)' },
  { id: 'health', label: 'Santé (PV)', desc: 'Évolue en fonction des points de vie restants' },
];

export function DrivenAnimationBehaviorControls({
  b,
  update,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: DrivenAnimationBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();

  const sourceType = b.sourceType || 'proximity';
  const progressionMode: DrivenAnimationProgressionMode = b.progressionMode || 'reversible';
  const endBehavior: DrivenAnimationEndBehavior = b.endBehavior || 'clamp';
  const curve: DrivenAnimationCurve = b.curve || 'linear';
  const needsTarget =
    sourceType === 'proximity' || sourceType === 'collision_step' || sourceType === 'collision_hold';

  return (
    <div className="space-y-2">
      {/* Encart explicatif style Kitty */}
      <div className="p-2 rounded-xl bg-violet-50/70 border border-violet-200/80 flex items-start gap-2 text-[10px] text-violet-900">
        <Clapperboard className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Animation Pilotée :</span> remplace le défilement temporel du Flipbook par une source dynamique (réversible ou irréversible/cliquet).
        </div>
      </div>

      {/* 1. Source de pilotage */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <span className="font-bold text-slate-700 text-xs block">1. Source qui pilote l’animation</span>
        <div className="grid grid-cols-2 gap-1">
          {SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => {
                const patch: Partial<DrivenAnimationBehaviorConfig> = { sourceType: opt.id };
                if (opt.id === 'collision_step' && !b.progressionMode) {
                  patch.progressionMode = 'irreversible';
                }
                update(patch);
              }}
              title={opt.desc}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-bold border text-left transition-colors cursor-pointer ${
                sourceType === opt.id
                  ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-500">
          {SOURCE_OPTIONS.find((o) => o.id === sourceType)?.desc}
        </p>

        {/* Sélection de cible pour Proximité / Collisions */}
        {needsTarget && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700">Cible observée</span>
              <select
                value={b.targetType || (sourceType === 'proximity' ? 'mouse' : 'any')}
                onChange={(e) => update({ targetType: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[180px]"
              >
                {sourceType === 'proximity' && <option value="mouse">Curseur / Souris</option>}
                {(sourceType === 'collision_step' || sourceType === 'collision_hold' || sourceType === 'proximity') && (
                  <option value="any">N’importe quel objet</option>
                )}
                <option value="entity">Entité précise</option>
                <option value={sourceType === 'proximity' ? 'nearest_type' : 'type'}>Type d’objet</option>
                <option value={sourceType === 'proximity' ? 'nearest_tag' : 'tag'}>Tag (#tag)</option>
              </select>
            </div>

            {b.targetType === 'entity' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Entité cible</span>
                <select
                  value={b.targetEntityId || ''}
                  onChange={(e) => update({ targetEntityId: e.target.value || undefined })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[175px]"
                >
                  <option value="">-- Choisir --</option>
                  {targetEntityOptions.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(b.targetType === 'type' || b.targetType === 'nearest_type') && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Type cible</span>
                <select
                  value={b.targetEntityType || ''}
                  onChange={(e) => update({ targetEntityType: e.target.value || undefined })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[175px]"
                >
                  <option value="">-- Choisir --</option>
                  {entityTypeOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(b.targetType === 'tag' || b.targetType === 'nearest_tag') && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Tag cible</span>
                <input
                  type="text"
                  list={`tags-driven-${b.id}`}
                  placeholder="ex: presse, joueur..."
                  value={b.targetTag || ''}
                  onChange={(e) => update({ targetTag: e.target.value.replace(/^#/, '') })}
                  className="w-36 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                />
                <datalist id={`tags-driven-${b.id}`}>
                  {availableTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        )}

        {/* Paramètres spécifiques selon la source */}
        {sourceType === 'proximity' && (
          <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2">
            <div>
              <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                <span className="font-semibold">Distance 0%</span>
                <EditableNumericValue
                  value={b.proximityDistanceStart ?? 260}
                  unit="px"
                  precision={0}
                  onChange={(v) => update({ proximityDistanceStart: v })}
                  className="font-mono font-bold text-violet-700 bg-violet-50 px-1 rounded"
                />
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="10"
                value={Math.max(0, Math.min(800, b.proximityDistanceStart ?? 260))}
                onChange={(e) => update({ proximityDistanceStart: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
                <span className="font-semibold">Distance 100%</span>
                <EditableNumericValue
                  value={b.proximityDistanceEnd ?? 50}
                  unit="px"
                  precision={0}
                  onChange={(v) => update({ proximityDistanceEnd: v })}
                  className="font-mono font-bold text-violet-700 bg-violet-50 px-1 rounded"
                />
              </div>
              <input
                type="range"
                min="0"
                max="800"
                step="10"
                value={Math.max(0, Math.min(800, b.proximityDistanceEnd ?? 50))}
                onChange={(e) => update({ proximityDistanceEnd: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
          </div>
        )}

        {sourceType === 'variable' && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Nom de variable</span>
              <input
                type="text"
                list={`vars-driven-in-${b.id}`}
                placeholder="ex: slider_x, score..."
                value={b.variableName || ''}
                onChange={(e) => update({ variableName: e.target.value })}
                className="w-36 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-medium text-slate-800"
              />
              <datalist id={`vars-driven-in-${b.id}`}>
                {variableNames.map((vn) => (
                  <option key={vn} value={vn} />
                ))}
              </datalist>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500">Val. 0%</span>
                <EditableNumericValue
                  value={b.variableMin ?? 0}
                  precision={1}
                  onChange={(v) => update({ variableMin: v })}
                  className="font-mono font-bold text-xs text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                <span className="text-[10px] font-semibold text-slate-500">Val. 100%</span>
                <EditableNumericValue
                  value={b.variableMax ?? 100}
                  precision={1}
                  onChange={(v) => update({ variableMax: v })}
                  className="font-mono font-bold text-xs text-violet-700"
                />
              </div>
            </div>
          </div>
        )}

        {sourceType === 'collision_step' && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Avancée par passage</span>
              <select
                value={b.collisionStepMode || 'one_frame'}
                onChange={(e) => update({ collisionStepMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
              >
                <option value="one_frame">+1 Frame par passage</option>
                <option value="custom_percent">Pourcentage personnalisé (%)</option>
              </select>
            </div>
            {b.collisionStepMode === 'custom_percent' && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-600">Pas par passage</span>
                <EditableNumericValue
                  value={b.collisionStepPercent ?? 25}
                  unit="%"
                  precision={0}
                  onChange={(v) => update({ collisionStepPercent: v })}
                  className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-xs"
                />
              </div>
            )}
            <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
              <span>Exiger de sortir avant de recompter</span>
              <input
                type="checkbox"
                checked={b.collisionRequireExit !== false}
                onChange={(e) => update({ collisionRequireExit: e.target.checked })}
                className="accent-violet-600"
              />
            </label>
            <div className="flex items-center justify-between text-[11px] text-slate-700">
              <span>Délai anti-rebond</span>
              <EditableNumericValue
                value={b.collisionCooldownSec ?? 0.25}
                unit="s"
                precision={2}
                onChange={(v) => update({ collisionCooldownSec: v })}
                className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-[11px]"
              />
            </div>
            <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
              <span>Ignorer zones capteurs (Trigger)</span>
              <input
                type="checkbox"
                checked={b.collisionIgnoreSensors === true}
                onChange={(e) => update({ collisionIgnoreSensors: e.target.checked })}
                className="accent-violet-600"
              />
            </label>
          </div>
        )}

        {sourceType === 'collision_hold' && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-700">
              <span className="font-semibold">Vitesse pendant le contact</span>
              <EditableNumericValue
                value={b.collisionHoldRatePerSec ?? 50}
                unit="%/s"
                precision={0}
                onChange={(v) => update({ collisionHoldRatePerSec: v })}
                className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-xs"
              />
            </div>
            <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
              <span>Ignorer zones capteurs (Trigger)</span>
              <input
                type="checkbox"
                checked={b.collisionIgnoreSensors === true}
                onChange={(e) => update({ collisionIgnoreSensors: e.target.checked })}
                className="accent-violet-600"
              />
            </label>
          </div>
        )}

        {sourceType === 'speed' && (
          <div className="pt-1.5 border-t border-slate-100 grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500">Min</span>
              <EditableNumericValue
                value={b.speedMin ?? 0}
                unit="px/s"
                precision={0}
                onChange={(v) => update({ speedMin: v })}
                className="font-mono font-bold text-xs text-violet-700"
              />
            </div>
            <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
              <span className="text-[10px] font-semibold text-slate-500">Max</span>
              <EditableNumericValue
                value={b.speedMax ?? 300}
                unit="px/s"
                precision={0}
                onChange={(v) => update({ speedMax: v })}
                className="font-mono font-bold text-xs text-violet-700"
              />
            </div>
          </div>
        )}

        {sourceType === 'health' && (
          <div className="pt-1.5 border-t border-slate-100">
            <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
              <span>Inverser (100% PV = 0% anim / 0 PV = 100%)</span>
              <input
                type="checkbox"
                checked={b.invertHealth !== false}
                onChange={(e) => update({ invertHealth: e.target.checked })}
                className="accent-violet-600"
              />
            </label>
          </div>
        )}
      </div>

      {/* 2. Loi de progression : Réversible vs Irréversible */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <span className="font-bold text-slate-700 text-xs block">2. Mémoire & Courbe</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => update({ progressionMode: 'reversible' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              progressionMode === 'reversible'
                ? 'bg-violet-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Réversible (Live)
          </button>
          <button
            type="button"
            onClick={() => update({ progressionMode: 'irreversible' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              progressionMode === 'irreversible'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Irréversible (Cliquet)
          </button>
        </div>
        <p className="text-[10px] text-slate-500">
          {progressionMode === 'irreversible'
            ? 'Destructif : l’animation conserve le maximum atteint (ex: orange pressée).'
            : 'Réversible : suit l’entrée en direct et revient en arrière si elle redescend.'}
        </p>

        {progressionMode === 'reversible' &&
          sourceType !== 'collision_step' &&
          sourceType !== 'collision_hold' && (
            <div>
              <div className="flex justify-between text-[11px] text-slate-700 mb-0.5">
                <span className="font-semibold">Lissage (Inertie)</span>
                <EditableNumericValue
                  value={b.smoothing ?? 0}
                  precision={2}
                  onChange={(v) => update({ smoothing: Math.max(0, Math.min(0.95, v)) })}
                  className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 rounded text-[10px]"
                />
              </div>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.05"
                value={Math.max(0, Math.min(0.95, b.smoothing ?? 0))}
                onChange={(e) => update({ smoothing: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
          )}

        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">Courbe</span>
            <select
              value={curve}
              onChange={(e) => update({ curve: e.target.value as DrivenAnimationCurve })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
            >
              <option value="linear">Linéaire</option>
              <option value="ease_in">Ease-In (Doux début)</option>
              <option value="ease_out">Ease-Out (Doux fin)</option>
              <option value="ease_in_out">Ease-In-Out</option>
            </select>
          </div>
          <div>
            <span className="text-[10px] font-semibold text-slate-500 block mb-0.5">À la fin</span>
            <select
              value={endBehavior}
              onChange={(e) => update({ endBehavior: e.target.value as DrivenAnimationEndBehavior })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
            >
              <option value="clamp">Bloquer (Clamp)</option>
              <option value="loop">Boucler (Loop)</option>
              <option value="ping_pong">Aller-Retour (Ping-Pong)</option>
            </select>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 pt-1 text-[11px] text-slate-700">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(b.invertOutput)}
              onChange={(e) => update({ invertOutput: e.target.checked })}
              className="accent-violet-600"
            />
            <span>Inverser sens</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(b.resetOnStateChange)}
              onChange={(e) => update({ resetOnStateChange: e.target.checked })}
              className="accent-violet-600"
            />
            <span>Reset si changement d’état</span>
          </label>
        </div>
      </div>

      {/* 3. Cibles animées : Frames Flipbook & Transformations visuelles */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <span className="font-bold text-slate-700 text-xs block">3. Cible animée</span>
        <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
          <span className="font-semibold">Piloter les Frames du Flipbook</span>
          <input
            type="checkbox"
            checked={b.driveFlipbook !== false}
            onChange={(e) => update({ driveFlipbook: e.target.checked })}
            className="accent-violet-600"
          />
        </label>

        <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer pt-1 border-t border-slate-100">
          <span className="font-semibold">Moduler Scale / Rotation / Opacité</span>
          <input
            type="checkbox"
            checked={Boolean(b.driveVisualTransform)}
            onChange={(e) => update({ driveVisualTransform: e.target.checked })}
            className="accent-violet-600"
          />
        </label>

        {b.driveVisualTransform && (
          <div className="space-y-1.5 pt-1 bg-slate-50 p-2 rounded-lg border border-slate-200">
            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Scale 0%</span>
                <EditableNumericValue
                  value={b.scaleStart ?? 1}
                  precision={2}
                  onChange={(v) => update({ scaleStart: v })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Scale 100%</span>
                <EditableNumericValue
                  value={b.scaleEnd ?? 1}
                  precision={2}
                  onChange={(v) => update({ scaleEnd: v })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rot. 0%</span>
                <EditableNumericValue
                  value={b.rotationStart ?? 0}
                  unit="°"
                  precision={0}
                  onChange={(v) => update({ rotationStart: v })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Rot. 100%</span>
                <EditableNumericValue
                  value={b.rotationEnd ?? 0}
                  unit="°"
                  precision={0}
                  onChange={(v) => update({ rotationEnd: v })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Opacité 0%</span>
                <EditableNumericValue
                  value={b.opacityStart ?? 1}
                  precision={2}
                  onChange={(v) => update({ opacityStart: Math.max(0, Math.min(1, v)) })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-600">Opacité 100%</span>
                <EditableNumericValue
                  value={b.opacityEnd ?? 1}
                  precision={2}
                  onChange={(v) => update({ opacityEnd: Math.max(0, Math.min(1, v)) })}
                  className="font-mono font-bold text-violet-700"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Sorties & Fin à 100% */}
      <div className="p-2.5 bg-violet-50/50 rounded-xl border border-violet-200/80 space-y-1.5">
        <span className="text-[11px] font-bold text-violet-950 block">4. Sorties & Actions à 100% (optionnel)</span>

        <div className="bg-white p-1.5 rounded-lg border border-violet-100 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-semibold text-slate-700">Écrire variable</span>
            <input
              type="text"
              list={`vars-driven-out-${b.id}`}
              placeholder="ex: anim_pct"
              value={b.outputVariableName || ''}
              onChange={(e) => update({ outputVariableName: e.target.value })}
              className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-800"
            />
            <datalist id={`vars-driven-out-${b.id}`}>
              {variableNames.map((vn) => (
                <option key={vn} value={vn} />
              ))}
            </datalist>
          </div>
          {Boolean((b.outputVariableName || '').trim()) && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-slate-500">Format exporté</span>
              <select
                value={b.outputVariableMode || 'percent'}
                onChange={(e) => update({ outputVariableMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 text-[10px] font-medium text-slate-800"
              >
                <option value="percent">Pourcentage (0..100)</option>
                <option value="normalized">Normalisé (0..1)</option>
                <option value="frame_number">N° de Frame (1..N)</option>
              </select>
            </div>
          )}
        </div>

        <div className="bg-white p-1.5 rounded-lg border border-violet-100 flex items-center justify-between gap-2">
          <span className="text-[11px] font-semibold text-slate-700">Variable N° Frame</span>
          <input
            type="text"
            list={`vars-driven-frame-${b.id}`}
            placeholder="ex: orange_frame"
            value={b.outputFrameVariableName || ''}
            onChange={(e) => update({ outputFrameVariableName: e.target.value })}
            className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-0.5 text-[11px] font-mono text-slate-800"
          />
          <datalist id={`vars-driven-frame-${b.id}`}>
            {variableNames.map((vn) => (
              <option key={vn} value={vn} />
            ))}
          </datalist>
        </div>

        <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-violet-100">
          <span className="text-[11px] font-bold text-slate-700 truncate">État à 100%</span>
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={b.triggerStateOnCompleteId || ''}
              onChange={(e) => update({ triggerStateOnCompleteId: e.target.value || undefined })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[125px]"
            >
              <option value="">-- Aucun --</option>
              {stateList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => {
                const createdId = onQuickCreateState('Complété', 'Animation');
                if (createdId) update({ triggerStateOnCompleteId: createdId });
              }}
              className="p-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg cursor-pointer"
              title="Créer et lier un état « Complété »"
            >
              <Plus className="w-3 h-3" />
            </button>
            {b.triggerStateOnCompleteId && onEditStateDrawing && (
              <button
                type="button"
                onClick={() => onEditStateDrawing(b.triggerStateOnCompleteId!)}
                className="p-1 bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-lg cursor-pointer"
                title="Dessiner cet état"
              >
                <Paintbrush className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        <label className="flex items-center justify-between bg-white p-1.5 rounded-lg border border-violet-100 text-[11px] text-slate-700 cursor-pointer">
          <span>Détruire l’objet quand il atteint 100%</span>
          <input
            type="checkbox"
            checked={Boolean(b.destroyOnComplete)}
            onChange={(e) => update({ destroyOnComplete: e.target.checked })}
            className="accent-rose-600"
          />
        </label>
      </div>
    </div>
  );
}
