import React from 'react';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import {
  SliderBehaviorConfig,
  SliderDragMode,
  SliderGeometryMode,
  SliderReturnMode,
  SliderStepMode,
} from '../../types';

export function SliderBehaviorControls({
  b,
  update,
}: {
  b: SliderBehaviorConfig;
  update: (partial: Partial<SliderBehaviorConfig>) => void;
}) {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();

  const geometryMode: SliderGeometryMode = b.geometryMode || 'line_1d';
  const dragMode: SliderDragMode = b.dragMode || 'physics_spring';
  const stepMode: SliderStepMode = b.stepMode || 'magnetic';
  const returnMode: SliderReturnMode = b.returnMode || 'none';
  const stepsX = Math.max(0, Math.round(b.stepsX ?? 0));
  const stepsY = Math.max(0, Math.round(b.stepsY ?? 0));
  const hasSteps = stepsX >= 2 || (geometryMode === 'rect_2d' && stepsY >= 2);
  const defaultMin = geometryMode === 'line_1d' ? 0 : -1;
  const defaultMax = geometryMode === 'line_1d' ? 100 : 1;

  return (
    <div className="space-y-1.5">
      <div className="px-2 py-1.5 rounded-xl bg-sky-50 border border-sky-200 text-[10px] text-sky-900 leading-snug">
        Glissière contrainte prioritaire sur <strong>Déplaçable</strong> : l'objet suit le rail ou la zone définie et écrit sa position dans vos Variables.
      </div>

      {/* A. Mode Géométrique */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">A. Espace de déplacement</span>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'line_1d', label: 'Rail 1D' },
            { id: 'rect_2d', label: 'Boîte 2D' },
            { id: 'circle_2d', label: 'Disque 2D' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ geometryMode: opt.id })}
              className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                geometryMode === opt.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {geometryMode === 'line_1d' && (
          <div className="space-y-2 pt-1">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
                <span className="font-semibold">Longueur du rail</span>
                <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded text-[11px]">
                  {b.length ?? 220}px
                </span>
              </div>
              <input
                type="range"
                min="40"
                max="800"
                step="10"
                value={b.length ?? 220}
                onChange={(e) => update({ length: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
                <span className="font-semibold">Orientation</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update({ angle: 0 })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      (b.angle ?? 0) === 0
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    0° Horiz.
                  </button>
                  <button
                    type="button"
                    onClick={() => update({ angle: 90 })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      (b.angle ?? 0) === 90
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    90° Vert.
                  </button>
                  <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded text-[11px]">
                    {b.angle ?? 0}°
                  </span>
                </div>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                step="5"
                value={b.angle ?? 0}
                onChange={(e) => update({ angle: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>
        )}

        {geometryMode === 'rect_2d' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
                <span className="font-semibold">Largeur</span>
                <span className="font-mono font-bold text-sky-700 text-[11px]">{b.width ?? 180}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="600"
                step="10"
                value={b.width ?? 180}
                onChange={(e) => update({ width: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
            <div>
              <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
                <span className="font-semibold">Hauteur</span>
                <span className="font-mono font-bold text-sky-700 text-[11px]">{b.height ?? 180}px</span>
              </div>
              <input
                type="range"
                min="40"
                max="600"
                step="10"
                value={b.height ?? 180}
                onChange={(e) => update({ height: parseInt(e.target.value, 10) })}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>
        )}

        {geometryMode === 'circle_2d' && (
          <div className="pt-1">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
              <span className="font-semibold">Rayon de la zone</span>
              <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.radius ?? 90}px
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="350"
              step="5"
              value={b.radius ?? 90}
              onChange={(e) => update({ radius: parseInt(e.target.value, 10) })}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>
        )}
      </div>

      {/* B. Drag Physique vs Direct */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">B. Comportement de saisie</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'physics_spring', label: 'Ressort physique' },
            { id: 'direct', label: 'Direct (au pixel)' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ dragMode: opt.id })}
              className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                dragMode === opt.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {dragMode === 'physics_spring' && (
          <div className="space-y-1.5 pt-0.5">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Raideur</span>
                  <span className="font-mono font-bold text-sky-700">{b.dragStiffness ?? 220}</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="600"
                  step="10"
                  value={b.dragStiffness ?? 220}
                  onChange={(e) => update({ dragStiffness: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Amortissement</span>
                  <span className="font-mono font-bold text-sky-700">{b.dragDamping ?? 16}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="40"
                  step="1"
                  value={b.dragDamping ?? 16}
                  onChange={(e) => update({ dragDamping: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-[11px] text-slate-600">
                <span>Rebond sur les butées</span>
                <span className="font-mono font-bold text-sky-700">
                  {Math.round((b.boundaryBounce ?? 0.35) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.95"
                step="0.05"
                value={b.boundaryBounce ?? 0.35}
                onChange={(e) => update({ boundaryBounce: parseFloat(e.target.value) })}
                className="w-full accent-sky-600 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* C. Crantage (Steps) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex justify-between items-center">
          <span className="font-bold text-slate-700 text-xs">C. Crantage (Notches)</span>
          <span className="font-mono font-bold text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded text-[11px]">
            {stepsX < 2 ? 'Continu' : `${stepsX} crans`}
          </span>
        </div>

        <input
          type="range"
          min="0"
          max="24"
          step="1"
          value={stepsX}
          onChange={(e) => {
            const val = parseInt(e.target.value, 10);
            update({ stepsX: val === 1 ? 2 : val });
          }}
          className="w-full accent-sky-600 cursor-pointer"
        />

        {geometryMode === 'rect_2d' && (
          <div>
            <div className="flex justify-between text-[11px] text-slate-600">
              <span>Crans sur Y</span>
              <span className="font-mono font-bold text-sky-700">
                {stepsY < 2 ? 'Continu' : `${stepsY} crans`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="24"
              step="1"
              value={stepsY}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                update({ stepsY: val === 1 ? 2 : val });
              }}
              className="w-full accent-sky-600 cursor-pointer"
            />
          </div>
        )}

        {hasSteps && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
              {([
                { id: 'magnetic', label: 'Magnétique (Aimant)' },
                { id: 'strict', label: 'Strict (Direct)' },
              ] as const).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => update({ stepMode: opt.id })}
                  className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    stepMode === opt.id
                      ? 'bg-sky-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {stepMode === 'magnetic' && (
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Force d'aimantation</span>
                  <span className="font-mono font-bold text-sky-700">{b.magneticStrength ?? 140}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="400"
                  step="10"
                  value={b.magneticStrength ?? 140}
                  onChange={(e) => update({ magneticStrength: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* D. Retour de force / Élastique */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">D. Retour au relâchement</span>
        <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'none', label: 'Reste en place' },
            { id: 'spring_return', label: 'Élastique (Rappel)' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ returnMode: opt.id })}
              className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                returnMode === opt.id
                  ? 'bg-sky-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {returnMode === 'spring_return' && (
          <div className="space-y-1.5 pt-0.5">
            {geometryMode === 'line_1d' && (
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Point de repos sur rail</span>
                  <span className="font-mono font-bold text-sky-700">
                    {Math.round((b.returnPosition ?? 0.5) * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={b.returnPosition ?? 0.5}
                  onChange={(e) => update({ returnPosition: parseFloat(e.target.value) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Raideur rappel</span>
                  <span className="font-mono font-bold text-sky-700">{b.returnStiffness ?? 140}</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="450"
                  step="10"
                  value={b.returnStiffness ?? 140}
                  onChange={(e) => update({ returnStiffness: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
              <div>
                <div className="flex justify-between text-[11px] text-slate-600">
                  <span>Amortissement</span>
                  <span className="font-mono font-bold text-sky-700">{b.returnDamping ?? 12}</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="35"
                  step="1"
                  value={b.returnDamping ?? 12}
                  onChange={(e) => update({ returnDamping: parseInt(e.target.value, 10) })}
                  className="w-full accent-sky-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* E. Variables de sortie */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <span className="font-bold text-slate-700 text-xs block">E. Variables de sortie (Règles)</span>
        <datalist id="slider-vars-list">
          {variableNames.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
              {geometryMode === 'line_1d' ? 'Variable Valeur' : 'Variable X'}
            </label>
            <input
              type="text"
              list="slider-vars-list"
              placeholder="ex: slider_x"
              value={b.outputVariableX || ''}
              onChange={(e) => update({ outputVariableX: e.target.value.trim() || undefined })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>

          {geometryMode !== 'line_1d' && (
            <div>
              <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
                Variable Y
              </label>
              <input
                type="text"
                list="slider-vars-list"
                placeholder="ex: slider_y"
                value={b.outputVariableY || ''}
                onChange={(e) => update({ outputVariableY: e.target.value.trim() || undefined })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
          )}

          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">
              Variable Cran (#)
            </label>
            <input
              type="text"
              list="slider-vars-list"
              placeholder="ex: cran_actuel"
              value={b.outputStepVariable || ''}
              onChange={(e) => update({ outputStepVariable: e.target.value.trim() || undefined })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 pt-0.5">
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Sortie Min</label>
            <input
              type="number"
              value={b.outputMin ?? defaultMin}
              onChange={(e) => update({ outputMin: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-0.5">Sortie Max</label>
            <input
              type="number"
              value={b.outputMax ?? defaultMax}
              onChange={(e) => update({ outputMax: parseFloat(e.target.value) || 0 })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
            />
          </div>
        </div>
      </div>

      {/* Affichage rail en Play */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Afficher la glissière en Mode Play</div>
          <div className="text-[10px] text-slate-400">Trace discrètement le rail / la zone sous la poignée</div>
        </div>
        <input
          type="checkbox"
          checked={b.showTrackInPlay !== false}
          onChange={(e) => update({ showTrackInPlay: e.target.checked })}
          className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
        />
      </div>
    </div>
  );
}
