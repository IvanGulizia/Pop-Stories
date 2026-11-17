import React from 'react';
import {
  BehaviorOverride,
  CustomParticlePreset,
  Entity,
  EntityBehavior,
  EntityState,
} from '../../types';

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
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {Math.round(accelVal * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0.05"
          max="1"
          step="0.05"
          value={accelVal}
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
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {Math.round(dampVal * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="0.98"
          step="0.02"
          value={dampVal}
          onChange={(e) => update({ damping: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>
    </>
  );
}
