import React from 'react';
import { CheckCircle2, Layers, Paintbrush, Plus, ShieldCheck } from 'lucide-react';
import {
  BehaviorOverride,
  CustomParticlePreset,
  Entity,
  EntityBehavior,
  EntityState,
} from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export interface BehaviorControlsBaseProps {
  behavior: EntityBehavior;
  override?: BehaviorOverride;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  customParticles: CustomParticlePreset[];
  onOpenParticleDrawer: (editingPreset?: CustomParticlePreset) => void;
  onOpenParticleEditor: () => void;
  onDeleteCustomParticle: (presetId: string) => void;
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}

export function FlipControls({
  flipOnMove,
  flipInvert,
  update,
}: {
  flipOnMove?: boolean;
  flipInvert?: boolean;
  update: (partial: any) => void;
}) {
  return (
    <>
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Flip horizontal (Sens du déplacement)</div>
          <div className="text-[10px] text-slate-400">Retourne l'objet horizontalement vers l'avant</div>
        </div>
        <input
          type="checkbox"
          checked={flipOnMove === true}
          onChange={(e) => update({ flipOnMove: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
        />
      </div>
      {flipOnMove === true && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Sens du dessin d'origine</span>
          <select
            value={flipInvert ? 'left' : 'right'}
            onChange={(e) => update({ flipInvert: e.target.value === 'left' })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            <option value="right">Regarde vers la droite (Défaut)</option>
            <option value="left">Regarde vers la gauche (Inversé)</option>
          </select>
        </div>
      )}
    </>
  );
}

export function InertiaControls({
  acceleration,
  damping,
  defaultDamping = 0,
  update,
}: {
  acceleration?: number;
  damping?: number;
  defaultDamping?: number;
  update: (partial: any) => void;
}) {
  const accelVal = acceleration ?? 1;
  const dampVal = damping ?? defaultDamping;
  return (
    <>
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Accélération (Réactivité)</span>
            <span className="text-[10px] text-slate-400 block">
              {accelVal >= 0.95 ? 'Démarrage instantané' : accelVal <= 0.2 ? 'Montée lente et lourde' : 'Accélération progressive'}
            </span>
          </div>
          <EditableNumericValue
            value={Math.round(accelVal * 1000) / 10}
            unit="%"
            precision={1}
            onChange={(v) => update({ acceleration: v / 100 })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={Math.max(0.05, Math.min(1, accelVal))}
          onChange={(e) => update({ acceleration: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Inertie / Glisse (Damping)</span>
            <span className="text-[10px] text-slate-400 block">
              {dampVal <= 0.05 ? 'Arrêt sec immédiat' : dampVal >= 0.9 ? 'Longue glisse (effet patinoire / espace)' : 'Décélération amortie'}
            </span>
          </div>
          <EditableNumericValue
            value={Math.round(dampVal * 1000) / 10}
            unit="%"
            precision={1}
            onChange={(v) => update({ damping: v / 100 })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
          />
        </div>
        <input
          type="range"
          min="0"
          max="0.98"
          step="0.02"
          value={Math.max(0, Math.min(0.98, dampVal))}
          onChange={(e) => update({ damping: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>
    </>
  );
}

export function PhysicsGroundedHelperCard({
  hasPhysics,
  hasFrozenRotation,
  onActivate,
}: {
  hasPhysics?: boolean;
  hasFrozenRotation?: boolean;
  onActivate?: () => void;
}) {
  if (!onActivate) return null;

  if (hasPhysics && hasFrozenRotation) {
    return (
      <div className="p-2 bg-emerald-50/70 rounded-xl border border-emerald-200 flex items-center gap-2 text-[11px] font-bold text-emerald-800">
        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
        <span>Physique au sol prête (Gravité active + Rotation figée)</span>
      </div>
    );
  }

  return (
    <div className="p-2 bg-amber-50/80 rounded-xl border border-amber-200 space-y-1.5">
      <div className="text-[10px] text-amber-900 leading-snug">
        {!hasPhysics
          ? 'Ce mode fonctionne idéalement avec la gravité et le composant Physique (rotation figée pour ne pas basculer).'
          : 'La physique est active, mais « Rotation figée » est conseillée pour éviter que l’entité ne roule sur les pentes.'}
      </div>
      <button
        type="button"
        onClick={onActivate}
        className="w-full py-1.5 px-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs transition-colors"
      >
        <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
        <span>Activer Physique au sol (Gravité + Rotation figée)</span>
      </button>
    </div>
  );
}

export interface LocomotionStateSlot {
  key: string;
  label: string;
  hint?: string;
  suggestedName: string;
  value?: string;
}

export function LocomotionStateBindingsCard({
  slots,
  stateList,
  folderName = 'Locomotion',
  onChangeSlot,
  onQuickCreateState,
  onEditStateDrawing,
  turnDuration,
  onChangeTurnDuration,
  minFallHeight,
  onChangeMinFallHeight,
}: {
  slots: LocomotionStateSlot[];
  stateList: EntityState[];
  folderName?: string;
  onChangeSlot: (key: string, stateId?: string) => void;
  onQuickCreateState?: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
  turnDuration?: number;
  onChangeTurnDuration?: (val: number) => void;
  minFallHeight?: number;
  onChangeMinFallHeight?: (val: number) => void;
}) {
  const hasFallSlot = slots.some((s) => s.key === 'fallStateId' && Boolean(s.value));
  const hasTurnSlot = slots.some((s) => s.key === 'turnStateId' && Boolean(s.value));

  return (
    <div className="p-2.5 bg-violet-50/60 rounded-xl border border-violet-200/80 space-y-2">
      <div>
        <div className="font-bold text-violet-950 text-xs flex items-center gap-1.5">
          <Layers className="w-3.5 h-3.5 text-violet-600" />
          <span>États visuels automatiques (Garde-fou actif)</span>
        </div>
        <div className="text-[10px] text-violet-800/80 leading-snug mt-0.5">
          Bascule automatiquement selon le mouvement. Ne remplace jamais les états externes (Blessé, Mort, Événement…).
        </div>
      </div>

      <div className="space-y-1.5">
        {slots.map((slot) => (
          <div
            key={slot.key}
            className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-violet-100"
          >
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-bold text-slate-700 truncate">{slot.label}</div>
              {slot.hint && <div className="text-[9px] text-slate-400 truncate">{slot.hint}</div>}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={slot.value || ''}
                onChange={(e) => onChangeSlot(slot.key, e.target.value || undefined)}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[135px]"
              >
                <option value="">-- Non défini --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              {onQuickCreateState && (
                <button
                  type="button"
                  onClick={() => {
                    const createdId = onQuickCreateState(slot.suggestedName, folderName);
                    if (createdId) onChangeSlot(slot.key, createdId);
                  }}
                  className="p-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg cursor-pointer"
                  title={`Créer et lier l'état « ${slot.suggestedName} »`}
                >
                  <Plus className="w-3 h-3" />
                </button>
              )}
              {slot.value && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(slot.value!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}

        {hasTurnSlot && onChangeTurnDuration && (
          <div className="bg-white p-1.5 rounded-lg border border-violet-100 flex items-center gap-2">
            <span className="text-[10px] font-bold text-slate-600 shrink-0">Durée demi-tour :</span>
            <input
              type="range"
              min="0.05"
              max="0.6"
              step="0.05"
              value={Math.max(0.05, Math.min(0.6, turnDuration ?? 0.15))}
              onChange={(e) => onChangeTurnDuration(parseFloat(e.target.value))}
              className="flex-1 accent-violet-600"
            />
            <EditableNumericValue
              value={turnDuration ?? 0.15}
              unit="s"
              precision={2}
              onChange={(v) => onChangeTurnDuration(v)}
              className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-1.5 py-0.5 rounded shrink-0 cursor-text tabular-nums"
            />
          </div>
        )}

        {hasFallSlot && onChangeMinFallHeight && (
          <div className="bg-white p-1.5 rounded-lg border border-violet-100 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-600">Hauteur min. avant Chute (Fall)</span>
              <EditableNumericValue
                value={minFallHeight ?? 20}
                unit="px"
                precision={1}
                onChange={(v) => onChangeMinFallHeight(v)}
                className="text-[10px] font-mono font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 px-1.5 py-0.5 rounded cursor-text tabular-nums"
              />
            </div>
            <input
              type="range"
              min="0"
              max="160"
              step="2"
              value={Math.max(0, Math.min(160, minFallHeight ?? 20))}
              onChange={(e) => onChangeMinFallHeight(parseInt(e.target.value, 10) || 0)}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        )}
      </div>
    </div>
  );
}
