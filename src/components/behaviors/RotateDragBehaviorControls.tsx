import React from 'react';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import {
  RotateDragBehaviorConfig,
  RotateDragBehaviorMode,
  RotateDragGestureMode,
  RotateDragReturnMode,
  RotateDragStepMode,
} from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export function RotateDragBehaviorControls({
  b,
  update,
}: {
  b: RotateDragBehaviorConfig;
  update: (partial: Partial<RotateDragBehaviorConfig>) => void;
}) {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();

  const gestureMode: RotateDragGestureMode = b.gestureMode || 'circular';
  const dragMode: RotateDragBehaviorMode = b.dragMode || 'physics_spring';
  const limitRange = Boolean(b.limitRange);
  const minAngle = b.minAngle ?? -135;
  const maxAngle = b.maxAngle ?? 135;
  const steps = Math.max(0, Math.round(b.steps ?? 0));
  const stepAngleDeg = Math.max(1, b.stepAngleDeg ?? 30);
  const stepMode: RotateDragStepMode = b.stepMode || 'magnetic';
  const returnMode: RotateDragReturnMode = b.returnMode || 'none';
  const hasSteps = steps >= 2;

  return (
    <div className="space-y-1.5">
      <div className="px-2 py-1.5 rounded-xl bg-amber-50 border border-amber-200 text-[10px] text-amber-950 leading-snug">
        Rotation interactive au drag autour du pivot de l'objet (cadran, volant, potentiomètre) avec physique, crans et sortie Variable.
      </div>

      {/* A. Type de geste */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">A. Geste souris / tactile</span>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'circular', label: 'Circulaire ↻' },
            { id: 'linear_x', label: 'Glisser ↔' },
            { id: 'linear_y', label: 'Glisser ↕' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ gestureMode: opt.id })}
              className={`py-1 px-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                gestureMode === opt.id
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {(gestureMode === 'linear_x' || gestureMode === 'linear_y') && (
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
              <span className="font-semibold">Sensibilité (degrés / px)</span>
              <EditableNumericValue
                value={b.sensitivity ?? 0.85}
                unit="°/px"
                precision={2}
                onChange={(v) => update({ sensitivity: v })}
                className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
              />
            </div>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={Math.max(0.1, Math.min(3, b.sensitivity ?? 0.85))}
              onChange={(e) => update({ sensitivity: parseFloat(e.target.value) })}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* B. Mode de drag & inertie */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">B. Sensation de rotation</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => update({ dragMode: 'physics_spring' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              dragMode === 'physics_spring'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Ressort &amp; Inertie
          </button>
          <button
            type="button"
            onClick={() => update({ dragMode: 'direct' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              dragMode === 'direct'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Suivi direct
          </button>
        </div>

        {dragMode === 'physics_spring' && (
          <div className="space-y-1.5 pt-1">
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span>Raideur du suivi</span>
                <EditableNumericValue
                  value={b.dragStiffness ?? 240}
                  precision={1}
                  onChange={(v) => update({ dragStiffness: v })}
                  className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="40"
                max="600"
                step="10"
                value={Math.max(40, Math.min(600, b.dragStiffness ?? 240))}
                onChange={(e) => update({ dragStiffness: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span>Amortissement (drag)</span>
                <EditableNumericValue
                  value={b.dragDamping ?? 16}
                  precision={1}
                  onChange={(v) => update({ dragDamping: v })}
                  className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="2"
                max="50"
                step="1"
                value={Math.max(2, Math.min(50, b.dragDamping ?? 16))}
                onChange={(e) => update({ dragDamping: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span>Frein d'inertie (au relâchement)</span>
                <EditableNumericValue
                  value={b.inertiaDamping ?? 4}
                  precision={2}
                  onChange={(v) => update({ inertiaDamping: v })}
                  className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="0"
                max="20"
                step="0.5"
                value={Math.max(0, Math.min(20, b.inertiaDamping ?? 4))}
                onChange={(e) => update({ inertiaDamping: parseFloat(e.target.value) })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* C. Butées min / max en degrés */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs">C. Butées min / max (°)</div>
            <div className="text-[10px] text-slate-400">
              {limitRange ? `Amplitude limitée (${minAngle}° à +${maxAngle}°)` : 'Rotation libre infinie (multi-tours)'}
            </div>
          </div>
          <input
            type="checkbox"
            checked={limitRange}
            onChange={(e) => update({ limitRange: e.target.checked })}
            className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
          />
        </div>

        {limitRange && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-slate-600">Min</span>
                <EditableNumericValue
                  value={minAngle}
                  unit="°"
                  precision={1}
                  onChange={(v) => update({ minAngle: v })}
                  className="text-xs font-mono font-bold text-slate-800 hover:bg-amber-50 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <div className="flex items-center justify-between bg-slate-50 border border-slate-300 rounded-lg px-2 py-1">
                <span className="text-[10px] font-bold text-slate-600">Max</span>
                <EditableNumericValue
                  value={maxAngle}
                  unit="°"
                  precision={1}
                  onChange={(v) => update({ maxAngle: v })}
                  className="text-xs font-mono font-bold text-slate-800 hover:bg-amber-50 px-1 rounded cursor-text tabular-nums"
                />
              </div>
            </div>

            {dragMode === 'physics_spring' && (
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700">
                  <span>Rebond aux butées</span>
                  <EditableNumericValue
                    value={Math.round((b.boundaryBounce ?? 0.3) * 1000) / 10}
                    unit="%"
                    precision={1}
                    onChange={(v) => update({ boundaryBounce: v / 100 })}
                    className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={Math.max(0, Math.min(1, b.boundaryBounce ?? 0.3))}
                  onChange={(e) => update({ boundaryBounce: parseFloat(e.target.value) })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* D. Crantage (Steps) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">D. Crantage (Positions aimantées)</span>
        {limitRange ? (
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
              <span className="font-semibold">Nombre de crans (0 = continu)</span>
              <EditableNumericValue
                value={steps}
                displayText={steps <= 1 ? 'Continu' : `${steps} crans`}
                precision={0}
                onChange={(v) => {
                  const r = Math.max(0, Math.round(v));
                  update({ steps: r === 1 ? 2 : r });
                }}
                className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
              />
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={Math.max(0, Math.min(24, steps))}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                update({ steps: v === 1 ? 2 : v });
              }}
              className="w-full accent-amber-600 cursor-pointer"
            />
          </div>
        ) : (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">Activer crans par pas d'angle</span>
              <input
                type="checkbox"
                checked={hasSteps}
                onChange={(e) => update({ steps: e.target.checked ? 12 : 0 })}
                className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
              />
            </div>
            {hasSteps && (
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700">
                  <span>Pas entre crans (°)</span>
                  <EditableNumericValue
                    value={stepAngleDeg}
                    unit="°"
                    precision={1}
                    onChange={(v) => update({ stepAngleDeg: v })}
                    className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="5"
                  max="90"
                  step="5"
                  value={Math.max(5, Math.min(90, stepAngleDeg))}
                  onChange={(e) => update({ stepAngleDeg: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}

        {hasSteps && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => update({ stepMode: 'magnetic' })}
                className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  stepMode === 'magnetic'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                Magnétique (souple)
              </button>
              <button
                type="button"
                onClick={() => update({ stepMode: 'strict' })}
                className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  stepMode === 'strict'
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                Strict (instantané)
              </button>
            </div>
            {stepMode === 'magnetic' && (
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700">
                  <span>Force d'aimantation</span>
                  <EditableNumericValue
                    value={b.magneticStrength ?? 140}
                    precision={1}
                    onChange={(v) => update({ magneticStrength: v })}
                    className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="30"
                  max="360"
                  step="10"
                  value={Math.max(30, Math.min(360, b.magneticStrength ?? 140))}
                  onChange={(e) => update({ magneticStrength: parseInt(e.target.value, 10) })}
                  className="w-full accent-amber-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* E. Retour élastique au repos */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">E. Retour au relâchement</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => update({ returnMode: 'none' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              returnMode === 'none'
                ? 'bg-slate-800 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Reste en place
          </button>
          <button
            type="button"
            onClick={() => update({ returnMode: 'spring_return' })}
            className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
              returnMode === 'spring_return'
                ? 'bg-amber-600 text-white shadow-2xs'
                : 'text-slate-600 hover:bg-white/70'
            }`}
          >
            Ressort élastique
          </button>
        </div>

        {returnMode === 'spring_return' && (
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-700">Angle de repos (°)</span>
              <EditableNumericValue
                value={b.restAngle ?? 0}
                unit="°"
                precision={1}
                onChange={(v) => update({ restAngle: v })}
                className="bg-slate-50 hover:bg-amber-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 cursor-text tabular-nums"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span>Raideur du retour</span>
                <EditableNumericValue
                  value={b.returnStiffness ?? 140}
                  precision={1}
                  onChange={(v) => update({ returnStiffness: v })}
                  className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="20"
                max="400"
                step="10"
                value={Math.max(20, Math.min(400, b.returnStiffness ?? 140))}
                onChange={(e) => update({ returnStiffness: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span>Amortissement du retour</span>
                <EditableNumericValue
                  value={b.returnDamping ?? 12}
                  precision={1}
                  onChange={(v) => update({ returnDamping: v })}
                  className="font-mono font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 px-1 rounded cursor-text tabular-nums"
                />
              </div>
              <input
                type="range"
                min="1"
                max="40"
                step="1"
                value={Math.max(1, Math.min(40, b.returnDamping ?? 12))}
                onChange={(e) => update({ returnDamping: parseInt(e.target.value, 10) })}
                className="w-full accent-amber-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* F. Sorties Variables & Affichage */}
      <div className="p-2 bg-amber-50/40 rounded-xl border border-amber-200 space-y-2">
        <span className="font-bold text-amber-950 text-xs block">F. Sortie vers Variables</span>
        <datalist id="rotate-drag-vars-list">
          {variableNames.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Variable Angle (°)</label>
            <input
              type="text"
              list="rotate-drag-vars-list"
              placeholder="ex: angle_volant"
              value={b.outputAngleVariable || ''}
              onChange={(e) => update({ outputAngleVariable: e.target.value.trim() || undefined })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Variable Valeur</label>
            <input
              type="text"
              list="rotate-drag-vars-list"
              placeholder="ex: volume"
              value={b.outputNormalizedVariable || ''}
              onChange={(e) => update({ outputNormalizedVariable: e.target.value.trim() || undefined })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[10px] font-bold text-slate-600">Min</span>
            <EditableNumericValue
              value={b.outputMin ?? 0}
              precision={3}
              onChange={(v) => update({ outputMin: v })}
              className="text-xs font-mono font-bold text-slate-800 hover:bg-amber-50 px-1 rounded cursor-text tabular-nums"
            />
          </div>
          <div className="flex items-center justify-between bg-white border border-slate-300 rounded-lg px-2 py-1">
            <span className="text-[10px] font-bold text-slate-600">Max</span>
            <EditableNumericValue
              value={b.outputMax ?? 100}
              precision={3}
              onChange={(v) => update({ outputMax: v })}
              className="text-xs font-mono font-bold text-slate-800 hover:bg-amber-50 px-1 rounded cursor-text tabular-nums"
            />
          </div>
        </div>

        {hasSteps && (
          <div>
            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Variable Cran (0..N-1)</label>
            <input
              type="text"
              list="rotate-drag-vars-list"
              placeholder="ex: mode_cadran"
              value={b.outputStepVariable || ''}
              onChange={(e) => update({ outputStepVariable: e.target.value.trim() || undefined })}
              className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
        )}
      </div>

      {/* Afficher cadran en Play */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Afficher le cadran en mode Play</div>
          <div className="text-[10px] text-slate-400">Arc des butées et repères crantés autour de l'objet</div>
        </div>
        <input
          type="checkbox"
          checked={b.showDialInPlay !== false}
          onChange={(e) => update({ showDialInPlay: e.target.checked })}
          className="w-4 h-4 accent-amber-600 rounded cursor-pointer"
        />
      </div>
    </div>
  );
}
