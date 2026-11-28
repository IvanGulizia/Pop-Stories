import React from 'react';
import { Clapperboard, Layers, Paintbrush, Plus, Sliders, Sparkles } from 'lucide-react';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import {
  DrivenAnimationBehaviorConfig,
  DrivenAnimationColliderSide,
  DrivenAnimationCurve,
  DrivenAnimationEndBehavior,
  DrivenAnimationProgressionMode,
  DrivenAnimationSourceType,
  DrivenAnimationTraverseAxis,
  Entity,
  EntityState,
} from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';
import { BehaviorSubSection } from './BehaviorSubSection';
import { BehaviorRuleShortcutButton } from './BehaviorRuleShortcutButton';

const SOURCE_OPTIONS: {
  id: DrivenAnimationSourceType;
  label: string;
  group: 'space' | 'physics' | 'values';
  quick?: boolean;
  desc: string;
}[] = [
  { id: 'proximity', label: 'Proximité', group: 'space', quick: true, desc: 'Distance entre cet objet (ou un de ses côtés) et une cible ou la souris' },
  { id: 'collision_step', label: 'Passage (Cran)', group: 'space', quick: true, desc: 'Avance d’une étape à chaque contact / entrée dans un collider' },
  { id: 'collision_traverse', label: 'Traversée', group: 'space', quick: true, desc: 'Progression spatiale 0→100% en traversant le collider cible (ex: coupe en 1 passage)' },
  { id: 'collision_travel', label: 'Glissement (Distance)', group: 'space', desc: 'Avance selon la distance parcourue en px pendant le contact (frottement / râpe)' },
  { id: 'collision_hold', label: 'Contact continu', group: 'space', desc: 'Progresse dans le temps tant que le collider touche la cible (ex: usure)' },
  { id: 'pull_tension', label: 'Traction', group: 'physics', quick: true, desc: 'Tension d’étirement avant rupture (Épingle au monde, Joint, Snap ou Drag)' },
  { id: 'puppet_shake', label: 'Secousse', group: 'physics', desc: 'Intensité de secousse / agitation de la Marionnette' },
  { id: 'speed', label: 'Vitesse', group: 'physics', quick: true, desc: 'Proportionnel à la vitesse de déplacement actuelle (px/s)' },
  { id: 'rotation_angle', label: 'Angle (Rotation)', group: 'values', desc: 'Angle courant de l’objet ou d’un cadran (en degrés)' },
  { id: 'slider_value', label: 'Glissière / Cadran', group: 'values', desc: 'Valeur directe (0..100%) d’un composant Slider ou Cadran sans passer par une variable' },
  { id: 'variable', label: 'Variable', group: 'values', quick: true, desc: 'Piloté par une Variable de jeu (Score, Compteur, Événement...)' },
  { id: 'health', label: 'Santé (PV)', group: 'values', desc: 'Évolue en fonction des points de vie restants' },
];

const QUICK_SOURCE_OPTIONS = SOURCE_OPTIONS.filter((o) => o.quick);

export function DrivenAnimationBehaviorControls({
  b,
  update,
  entityId,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: DrivenAnimationBehaviorConfig;
  update: (partial: any) => void;
  entityId?: string;
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
  const isCollisionSource =
    sourceType === 'collision_step' ||
    sourceType === 'collision_hold' ||
    sourceType === 'collision_traverse' ||
    sourceType === 'collision_travel';
  const needsTarget = sourceType === 'proximity' || isCollisionSource;
  const supportsColliderSide = sourceType === 'proximity' || isCollisionSource;
  const needsComponentSource =
    sourceType === 'pull_tension' ||
    sourceType === 'puppet_shake' ||
    sourceType === 'rotation_angle' ||
    sourceType === 'slider_value';

  const selectSource = (nextSource: DrivenAnimationSourceType) => {
    const patch: Partial<DrivenAnimationBehaviorConfig> = { sourceType: nextSource };
    if ((nextSource === 'collision_step' || nextSource === 'collision_traverse') && !b.progressionMode) {
      patch.progressionMode = 'irreversible';
    }
    update(patch);
  };

  const activeSourceLabel = SOURCE_OPTIONS.find((o) => o.id === sourceType)?.label || sourceType;

  return (
    <div className="space-y-2">
      {/* Encart explicatif style Kitty */}
      <div className="p-2 rounded-xl bg-violet-50/70 border border-violet-200/80 flex items-start gap-2 text-[10px] text-violet-900">
        <Clapperboard className="w-3.5 h-3.5 text-violet-600 shrink-0 mt-0.5" />
        <div>
          <span className="font-bold">Animation Pilotée :</span> remplace le défilement temporel du Flipbook par une source dynamique (réversible ou irréversible/cliquet).
        </div>
      </div>

      {/* 1. Source de pilotage (Raccourcis visibles + menu complet) */}
      <BehaviorSubSection
        title="1. Source qui pilote l’animation"
        subtitle={activeSourceLabel}
        summaryBadge={activeSourceLabel}
        persistKey={entityId ? `${entityId}:${b.id}:driven_source` : undefined}
        defaultOpen={true}
        headerActions={
          isCollisionSource ? (
            <BehaviorRuleShortcutButton
              entityId={entityId}
              triggerType="collision"
              triggerPhase="enter"
              label="Collision (Anim. Pilotée)"
            />
          ) : sourceType === 'variable' ? (
            <BehaviorRuleShortcutButton
              entityId={entityId}
              triggerType="variable"
              label="Variable (Anim. Pilotée)"
            />
          ) : undefined
        }
      >
        <div className="grid grid-cols-3 gap-1">
          {QUICK_SOURCE_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => selectSource(opt.id)}
              title={opt.desc}
              className={`px-1.5 py-1.5 rounded-lg text-[10px] font-bold border text-center truncate transition-colors cursor-pointer ${
                sourceType === opt.id
                  ? 'bg-violet-600 text-white border-violet-600 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold text-slate-500 shrink-0">Toutes les sources</span>
          <select
            value={sourceType}
            onChange={(e) => selectSource(e.target.value as DrivenAnimationSourceType)}
            className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
          >
            <optgroup label="Espace & Collisions">
              {SOURCE_OPTIONS.filter((o) => o.group === 'space').map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Physique & Interactions">
              {SOURCE_OPTIONS.filter((o) => o.group === 'physics').map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Valeurs & Composants">
              {SOURCE_OPTIONS.filter((o) => o.group === 'values').map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
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
                <option value="any">N’importe quel objet</option>
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

            {supportsColliderSide && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Côté du collider</span>
                <select
                  value={b.colliderSide || 'all'}
                  onChange={(e) => update({ colliderSide: e.target.value as DrivenAnimationColliderSide })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[175px]"
                >
                  <option value="all">Tous les côtés (Centre / Complet)</option>
                  <option value="top">Haut uniquement</option>
                  <option value="bottom">Bas uniquement</option>
                  <option value="left">Gauche uniquement</option>
                  <option value="right">Droite uniquement</option>
                </select>
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

        {sourceType === 'collision_traverse' && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Sens de traversée</span>
              <select
                value={b.traverseAxis || 'auto'}
                onChange={(e) => update({ traverseAxis: e.target.value as DrivenAnimationTraverseAxis })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[175px]"
              >
                <option value="auto">Automatique (bord d&apos;entrée)</option>
                <option value="left_to_right">Gauche → Droite</option>
                <option value="right_to_left">Droite → Gauche</option>
                <option value="top_to_bottom">Haut → Bas</option>
                <option value="bottom_to_top">Bas → Haut</option>
                <option value="center_inward">Bords → Centre (écrasement)</option>
              </select>
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

        {sourceType === 'collision_travel' && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-700">
              <span className="font-semibold">Distance pour 100%</span>
              <EditableNumericValue
                value={b.collisionTravelDistancePx ?? 120}
                unit="px"
                precision={0}
                onChange={(v) => update({ collisionTravelDistancePx: Math.max(4, v) })}
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

        {needsComponentSource && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Objet source</span>
              <select
                value={b.componentSourceTargetId || ''}
                onChange={(e) => update({ componentSourceTargetId: e.target.value || undefined })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[175px]"
              >
                <option value="">Cet objet (lui-même)</option>
                {targetEntityOptions.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name}
                  </option>
                ))}
              </select>
            </div>

            {sourceType === 'pull_tension' && (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold text-slate-600">Origine traction</span>
                  <select
                    value={b.pullTensionSource || 'auto'}
                    onChange={(e) => update({ pullTensionSource: e.target.value as any })}
                    className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[175px]"
                  >
                    <option value="auto">Automatique (tout détecter)</option>
                    <option value="world_pin">Épingle au monde (Physics)</option>
                    <option value="joint">Joint cassable (Parent)</option>
                    <option value="snap">Résistance Snap</option>
                    <option value="drag">Élastique saisie souris</option>
                  </select>
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-700">
                  <span className="font-semibold">Distance 100% (si drag)</span>
                  <EditableNumericValue
                    value={b.pullTensionMaxPx ?? 80}
                    unit="px"
                    precision={0}
                    onChange={(v) => update({ pullTensionMaxPx: Math.max(8, v) })}
                    className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-xs"
                  />
                </div>
              </>
            )}

            {sourceType === 'puppet_shake' && (
              <div className="flex items-center justify-between text-[11px] text-slate-700">
                <span className="font-semibold">Vitesse secousse 100%</span>
                <EditableNumericValue
                  value={b.shakeSpeedMax ?? 900}
                  unit="px/s"
                  precision={0}
                  onChange={(v) => update({ shakeSpeedMax: Math.max(40, v) })}
                  className="font-mono font-bold text-violet-700 bg-violet-50 px-1.5 py-0.5 rounded text-xs"
                />
              </div>
            )}

            {sourceType === 'rotation_angle' && (
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500">Angle 0%</span>
                  <EditableNumericValue
                    value={b.angleMin ?? -180}
                    unit="°"
                    precision={0}
                    onChange={(v) => update({ angleMin: v })}
                    className="font-mono font-bold text-xs text-violet-700"
                  />
                </div>
                <div className="flex items-center justify-between bg-slate-50 px-2 py-1 rounded-lg border border-slate-200">
                  <span className="text-[10px] font-semibold text-slate-500">Angle 100%</span>
                  <EditableNumericValue
                    value={b.angleMax ?? 180}
                    unit="°"
                    precision={0}
                    onChange={(v) => update({ angleMax: v })}
                    className="font-mono font-bold text-xs text-violet-700"
                  />
                </div>
              </div>
            )}

            {sourceType === 'slider_value' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-600">Axe de la glissière</span>
                <select
                  value={b.sliderAxis || 'x'}
                  onChange={(e) => update({ sliderAxis: e.target.value as any })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[175px]"
                >
                  <option value="x">Axe X / Rail 1D / Cadran</option>
                  <option value="y">Axe Y (Zone 2D)</option>
                  <option value="magnitude">Distance au point 0 (2D)</option>
                </select>
              </div>
            )}
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
      </BehaviorSubSection>

      {/* 2. Loi de progression : Réversible vs Irréversible */}
      <BehaviorSubSection
        title="2. Mémoire & Courbe"
        subtitle="Réversible, cliquet, lissage et boucle"
        icon={<Sliders className="w-3.5 h-3.5 text-violet-600" />}
        summaryBadge={progressionMode === 'irreversible' ? 'Cliquet' : 'Réversible'}
        persistKey={entityId ? `${entityId}:${b.id}:driven_curve` : undefined}
        defaultOpen={true}
      >
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
          sourceType !== 'collision_hold' &&
          sourceType !== 'collision_travel' && (
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
      </BehaviorSubSection>

      {/* 3. Cibles animées : Frames Flipbook & Transformations visuelles */}
      <BehaviorSubSection
        title="3. Cible animée"
        subtitle="Frames Flipbook, collider et transformations"
        icon={<Layers className="w-3.5 h-3.5 text-violet-600" />}
        summaryBadge={
          b.driveFlipbook !== false && b.driveVisualTransform
            ? 'Frames + Transform'
            : b.driveVisualTransform
            ? 'Transform'
            : 'Frames'
        }
        persistKey={entityId ? `${entityId}:${b.id}:driven_target` : undefined}
        defaultOpen={true}
      >
        <label className="flex items-center justify-between text-[11px] text-slate-700 cursor-pointer">
          <span className="font-semibold">Piloter les Frames du Flipbook</span>
          <input
            type="checkbox"
            checked={b.driveFlipbook !== false}
            onChange={(e) => update({ driveFlipbook: e.target.checked })}
            className="accent-violet-600"
          />
        </label>

        {b.driveFlipbook !== false && (
          <label className="flex items-center justify-between text-[11px] text-slate-600 cursor-pointer pl-2 border-l-2 border-violet-200">
            <span>Adapter le collider au dessin de chaque frame</span>
            <input
              type="checkbox"
              checked={Boolean(b.syncColliderToFrame)}
              onChange={(e) => update({ syncColliderToFrame: e.target.checked })}
              className="accent-violet-600"
            />
          </label>
        )}

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
      </BehaviorSubSection>

      {/* 4. Sorties & Fin à 100% */}
      <BehaviorSubSection
        title="4. Sorties & Actions à 100%"
        subtitle="Variables, état complété et destruction"
        icon={<Sparkles className="w-3.5 h-3.5 text-violet-600" />}
        summaryBadge={
          b.triggerStateOnCompleteId || b.outputVariableName || b.outputFrameVariableName || b.destroyOnComplete
            ? 'Actif'
            : undefined
        }
        persistKey={entityId ? `${entityId}:${b.id}:driven_outputs` : undefined}
        defaultOpen={Boolean(
          b.triggerStateOnCompleteId || b.outputVariableName || b.outputFrameVariableName || b.destroyOnComplete
        )}
        tone="violet"
      >

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
      </BehaviorSubSection>
    </div>
  );
}
