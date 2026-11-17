import React from 'react';
import { Crosshair, RotateCcw } from 'lucide-react';
import { EntityPivot, JiggleBehaviorConfig } from '../../types';
import { DEFAULT_PIVOT, sanitizePivot } from '../../utils/physics/pivotHelpers';

const PIVOT_PRESETS: { label: string; x: number; y: number }[] = [
  { label: 'Haut-Gauche', x: 0, y: 0 },
  { label: 'Haut', x: 0.5, y: 0 },
  { label: 'Haut-Droit', x: 1, y: 0 },
  { label: 'Gauche', x: 0, y: 0.5 },
  { label: 'Centre', x: 0.5, y: 0.5 },
  { label: 'Droite', x: 1, y: 0.5 },
  { label: 'Bas-Gauche', x: 0, y: 1 },
  { label: 'Bas', x: 0.5, y: 1 },
  { label: 'Bas-Droit', x: 1, y: 1 },
];

export function JiggleBehaviorControls({
  b,
  update,
}: {
  b: JiggleBehaviorConfig;
  update: (partial: any) => void;
}) {
  const stiffness = b.stiffness ?? 180;
  const damping = b.damping ?? 9;
  const inertia = b.inertia ?? 1.0;
  const maxAngle = b.maxAngle ?? 35;
  const gravityPull = b.gravityPull ?? 40;
  const restAngleOffset = b.restAngleOffset ?? 0;
  const initialAngleOffset = b.initialAngleOffset ?? 0;
  const squashIntensity = b.squashIntensity ?? 0.25;
  const collideWithWorld = b.collideWithWorld !== false;
  const useCustomPivot = Boolean(b.useCustomPivot);
  const pivotOverride: EntityPivot = sanitizePivot(b.pivotOverride || DEFAULT_PIVOT);

  return (
    <div className="space-y-1.5">
      {/* Raideur angulaire */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Raideur du ressort (Stiffness)</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {Math.round(stiffness)}
          </span>
        </div>
        <input
          type="range"
          min="20"
          max="500"
          step="10"
          value={stiffness}
          onChange={(e) => update({ stiffness: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Amortissement */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Amortissement (Damping)</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {damping.toFixed(1)}
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="30"
          step="0.5"
          value={damping}
          onChange={(e) => update({ damping: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Inertie / Réactivité à l'accélération */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Inertie au mouvement</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {inertia.toFixed(2)}×
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="3"
          step="0.1"
          value={inertia}
          onChange={(e) => update({ inertia: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Débattement maximum ±° */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Amplitude max (± angle)</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            ±{Math.round(maxAngle)}°
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="150"
          step="1"
          value={maxAngle}
          onChange={(e) => update({ maxAngle: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Gravité sur le centre de masse & Angle de repos */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Pesanteur locale (Gravity Pull)</span>
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
              {Math.round(gravityPull)}
            </span>
          </div>
          <input
            type="range"
            min="-150"
            max="300"
            step="5"
            value={gravityPull}
            onChange={(e) => update({ gravityPull: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>

        <div className="pt-1 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Angle de repos</span>
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
              {Math.round(restAngleOffset)}°
            </span>
          </div>
          <input
            type="range"
            min="-90"
            max="90"
            step="1"
            value={restAngleOffset}
            onChange={(e) => update({ restAngleOffset: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>

        <div className="pt-1 border-t border-slate-100">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Angle de départ (hors repos)</span>
            <span className="font-mono font-bold text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded text-[11px]">
              {Math.round(initialAngleOffset)}°
            </span>
          </div>
          <input
            type="range"
            min="-120"
            max="120"
            step="1"
            value={initialAngleOffset}
            onChange={(e) => update({ initialAngleOffset: parseFloat(e.target.value) })}
            className="w-full accent-fuchsia-600"
          />
          <div className="text-[10px] text-slate-400 mt-0.5">
            Décalage initial au lancement Play avant de rebondir vers l&apos;angle de repos
          </div>
        </div>
      </div>

      {/* Squash & Stretch MudBun */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Déformation élastique (Squash)</span>
          <span className="font-mono font-bold text-fuchsia-600 bg-fuchsia-50 px-1.5 py-0.5 rounded text-[11px]">
            {Math.round(squashIntensity * 100)}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="1.5"
          step="0.05"
          value={squashIntensity}
          onChange={(e) => update({ squashIntensity: parseFloat(e.target.value) })}
          className="w-full accent-fuchsia-600"
        />
      </div>

      {/* Réagir aux impacts / collisions */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-700 text-xs">Rebondir sur les impacts</div>
          <div className="text-[10px] text-slate-400">
            Ajoute une impulsion de jiggle lors des chocs contre murs, sols et objets
          </div>
        </div>
        <input
          type="checkbox"
          checked={collideWithWorld}
          onChange={(e) => update({ collideWithWorld: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
        />
      </div>

      {/* Surcharge de pivot dédiée au Jiggle */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <Crosshair className="w-3.5 h-3.5 text-fuchsia-600 shrink-0" />
            <div>
              <div className="font-bold text-slate-700 text-xs">Pivot spécifique au Jiggle</div>
              <div className="text-[10px] text-slate-400">
                Sinon utilise le pivot de l'état ou de l'objet
              </div>
            </div>
          </div>
          <input
            type="checkbox"
            checked={useCustomPivot}
            onChange={(e) =>
              update({
                useCustomPivot: e.target.checked,
                pivotOverride: b.pivotOverride || { ...DEFAULT_PIVOT },
              })
            }
            className="w-4 h-4 accent-fuchsia-600 rounded cursor-pointer shrink-0"
          />
        </div>

        {useCustomPivot && (
          <div className="pt-2 border-t border-slate-100 flex items-center gap-3">
            {/* Grille 3x3 des 9 ancres rapides */}
            <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-lg border border-slate-200 shrink-0">
              {PIVOT_PRESETS.map((preset) => {
                const isSelected =
                  Math.abs(pivotOverride.x - preset.x) < 0.01 &&
                  Math.abs(pivotOverride.y - preset.y) < 0.01;
                return (
                  <button
                    key={preset.label}
                    type="button"
                    title={preset.label}
                    onClick={() => update({ pivotOverride: { x: preset.x, y: preset.y } })}
                    className={`w-4 h-4 rounded-sm flex items-center justify-center cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-fuchsia-600 text-white shadow-2xs scale-105'
                        : 'bg-white hover:bg-fuchsia-100 text-slate-400'
                    }`}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  </button>
                );
              })}
            </div>

            {/* Coordonnées X% / Y% + Reset */}
            <div className="flex-1 grid grid-cols-2 gap-1.5 items-center">
              <label className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
                <span className="font-bold text-slate-500">X</span>
                <input
                  type="number"
                  min={-50}
                  max={150}
                  step={5}
                  value={Math.round(pivotOverride.x * 100)}
                  onChange={(e) =>
                    update({
                      pivotOverride: sanitizePivot({
                        ...pivotOverride,
                        x: (parseFloat(e.target.value) || 0) / 100,
                      }),
                    })
                  }
                  className="w-11 bg-transparent font-mono font-bold text-right text-slate-800 outline-none"
                />
                <span className="text-slate-400">%</span>
              </label>

              <label className="flex items-center justify-between gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-[11px]">
                <span className="font-bold text-slate-500">Y</span>
                <input
                  type="number"
                  min={-50}
                  max={150}
                  step={5}
                  value={Math.round(pivotOverride.y * 100)}
                  onChange={(e) =>
                    update({
                      pivotOverride: sanitizePivot({
                        ...pivotOverride,
                        y: (parseFloat(e.target.value) || 0) / 100,
                      }),
                    })
                  }
                  className="w-11 bg-transparent font-mono font-bold text-right text-slate-800 outline-none"
                />
                <span className="text-slate-400">%</span>
              </label>

              <button
                type="button"
                onClick={() => update({ pivotOverride: { ...DEFAULT_PIVOT } })}
                className="col-span-2 text-[10px] font-semibold text-slate-500 hover:text-fuchsia-700 flex items-center justify-center gap-1 py-0.5 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Réinitialiser (50%, 50%)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
