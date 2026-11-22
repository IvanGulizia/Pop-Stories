import React from 'react';
import { ParentOffset } from '../../types';
import { EditableNumericValue } from './EditableNumericValue';

interface SnapJointConfigFieldsProps {
  config: Partial<ParentOffset>;
  onChange: (patch: Partial<ParentOffset>) => void;
}

export const SnapJointConfigFields: React.FC<SnapJointConfigFieldsProps> = ({
  config,
  onChange,
}) => {
  const rawMaxDist = config.springMaxDistance ?? 0;
  const isMaxDistLimited =
    config.springLimitMaxDistance === true ||
    (config.springLimitMaxDistance !== false && rawMaxDist > 0);
  const angularStiffness = config.jointAngularStiffness ?? 0;

  return (
    <div className="space-y-2 p-2.5 bg-sky-50/70 rounded-xl border border-sky-200">
      <div className="text-[11px] font-extrabold text-sky-950">
        Paramètres du Joint Physique
      </div>

      {/* Rigidité & Amortissement linéaire */}
      <div>
        <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
          <span className="font-bold">Rigidité du point d&apos;attache</span>
          <EditableNumericValue
            value={config.springStiffness ?? 160}
            precision={1}
            onChange={(v) => onChange({ springStiffness: v })}
            className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded cursor-text"
          />
        </div>
        <input
          type="range"
          min="20"
          max="500"
          step="10"
          value={Math.max(20, Math.min(500, config.springStiffness ?? 160))}
          onChange={(e) => onChange({ springStiffness: parseFloat(e.target.value) })}
          className="w-full accent-sky-600"
        />
      </div>

      <div>
        <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
          <span className="font-bold">Amortissement linéaire</span>
          <EditableNumericValue
            value={config.springDamping ?? 12}
            precision={2}
            onChange={(v) => onChange({ springDamping: v })}
            className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded cursor-text"
          />
        </div>
        <input
          type="range"
          min="1"
          max="40"
          step="0.5"
          value={Math.max(1, Math.min(40, config.springDamping ?? 12))}
          onChange={(e) => onChange({ springDamping: parseFloat(e.target.value) })}
          className="w-full accent-sky-600"
        />
      </div>

      {/* Distance max (Laisse) */}
      <div className="space-y-1">
        <div className="flex justify-between items-center text-[11px] text-slate-700 gap-2">
          <span className="font-bold">Distance max (Laisse)</span>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="inline-flex rounded-lg border border-sky-200 bg-white p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => onChange({ springLimitMaxDistance: false, springMaxDistance: 0 })}
                className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                  !isMaxDistLimited
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-sky-50'
                }`}
              >
                Libre
              </button>
              <button
                type="button"
                onClick={() =>
                  onChange({
                    springLimitMaxDistance: true,
                    springMaxDistance: isMaxDistLimited ? rawMaxDist : 0,
                  })
                }
                className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                  isMaxDistLimited
                    ? 'bg-sky-600 text-white'
                    : 'text-slate-600 hover:bg-sky-50'
                }`}
              >
                Limiter
              </button>
            </div>
            {isMaxDistLimited && (
              <EditableNumericValue
                value={rawMaxDist}
                unit="px"
                precision={1}
                onChange={(v) =>
                  onChange({
                    springLimitMaxDistance: true,
                    springMaxDistance: v,
                  })
                }
                className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded cursor-text"
              />
            )}
          </div>
        </div>
        {isMaxDistLimited && (
          <input
            type="range"
            min="0"
            max="350"
            step="5"
            value={Math.max(0, Math.min(350, rawMaxDist))}
            onChange={(e) =>
              onChange({
                springLimitMaxDistance: true,
                springMaxDistance: parseFloat(e.target.value),
              })
            }
            className="w-full accent-sky-600"
          />
        )}
      </div>

      {/* Pesanteur locale */}
      <div>
        <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
          <span className="font-bold">Pesanteur locale (pendule)</span>
          <EditableNumericValue
            value={config.springGravity ?? 400}
            unit="px/s²"
            precision={1}
            onChange={(v) => onChange({ springGravity: v })}
            className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded cursor-text"
          />
        </div>
        <input
          type="range"
          min="-200"
          max="800"
          step="20"
          value={Math.max(-200, Math.min(800, config.springGravity ?? 400))}
          onChange={(e) => onChange({ springGravity: parseFloat(e.target.value) })}
          className="w-full accent-sky-600"
        />
      </div>

      {/* Butées angulaires */}
      <div className="pt-1 border-t border-sky-200/70 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-sky-900 text-[11px]">Limites angulaires</span>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(config.jointEnableAngleLimits)}
              onChange={(e) =>
                onChange({
                  jointEnableAngleLimits: e.target.checked,
                  jointMinAngle: config.jointMinAngle ?? -75,
                  jointMaxAngle: config.jointMaxAngle ?? 75,
                  jointBrakeAngle: config.jointBrakeAngle ?? 20,
                  jointBrakeStrength: config.jointBrakeStrength ?? 75,
                })
              }
              className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
            />
            <span>Limiter l&apos;angle</span>
          </label>
        </div>

        {config.jointEnableAngleLimits && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-bold">Min</span>
                  <EditableNumericValue
                    value={config.jointMinAngle ?? -75}
                    unit="°"
                    precision={1}
                    onChange={(v) => onChange({ jointMinAngle: v })}
                    className="font-mono tabular-nums font-bold text-sky-700 px-1 rounded cursor-text"
                  />
                </div>
                <input
                  type="range"
                  min="-179"
                  max={Math.round(config.jointMaxAngle ?? 75)}
                  step="1"
                  value={Math.max(
                    -179,
                    Math.min(config.jointMinAngle ?? -75, config.jointMaxAngle ?? 75)
                  )}
                  onChange={(e) => onChange({ jointMinAngle: parseFloat(e.target.value) })}
                  className="w-full accent-sky-600"
                />
              </div>
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-bold">Max</span>
                  <EditableNumericValue
                    value={config.jointMaxAngle ?? 75}
                    unit="°"
                    precision={1}
                    onChange={(v) => onChange({ jointMaxAngle: v })}
                    className="font-mono tabular-nums font-bold text-sky-700 px-1 rounded cursor-text"
                  />
                </div>
                <input
                  type="range"
                  min={Math.round(config.jointMinAngle ?? -75)}
                  max="179"
                  step="1"
                  value={Math.min(
                    179,
                    Math.max(config.jointMaxAngle ?? 75, config.jointMinAngle ?? -75)
                  )}
                  onChange={(e) => onChange({ jointMaxAngle: parseFloat(e.target.value) })}
                  className="w-full accent-sky-600"
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                <span className="font-bold">Zone de freinage</span>
                <EditableNumericValue
                  value={config.jointBrakeAngle ?? 20}
                  displayText={
                    (config.jointBrakeAngle ?? 20) > 0
                      ? `${Math.round(config.jointBrakeAngle ?? 20)}°`
                      : 'Désactivé'
                  }
                  precision={1}
                  onChange={(v) => onChange({ jointBrakeAngle: v })}
                  className="font-mono tabular-nums font-bold text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min="0"
                max="90"
                step="1"
                value={Math.max(0, Math.min(90, config.jointBrakeAngle ?? 20))}
                onChange={(e) => onChange({ jointBrakeAngle: parseFloat(e.target.value) })}
                className="w-full accent-amber-500"
              />
            </div>

            {(config.jointBrakeAngle ?? 20) > 0 && (
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-bold">Force de freinage</span>
                  <EditableNumericValue
                    value={config.jointBrakeStrength ?? 75}
                    unit="%"
                    precision={1}
                    onChange={(v) => onChange({ jointBrakeStrength: v })}
                    className="font-mono tabular-nums font-bold text-amber-700 px-1 rounded cursor-text"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={Math.max(0, Math.min(100, config.jointBrakeStrength ?? 75))}
                  onChange={(e) => onChange({ jointBrakeStrength: parseFloat(e.target.value) })}
                  className="w-full accent-amber-500"
                />
              </div>
            )}
          </div>
        )}

        <div>
          <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
            <span className="font-bold">Ressort angulaire (Rappel)</span>
            <EditableNumericValue
              value={angularStiffness}
              displayText={angularStiffness > 0 ? `${Math.round(angularStiffness)}` : 'Libre'}
              precision={1}
              onChange={(v) => onChange({ jointAngularStiffness: v })}
              className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 px-1.5 py-0.5 rounded cursor-text"
            />
          </div>
          <input
            type="range"
            min="0"
            max="1200"
            step="10"
            value={Math.max(0, Math.min(1200, angularStiffness))}
            onChange={(e) => onChange({ jointAngularStiffness: parseFloat(e.target.value) })}
            className="w-full accent-sky-600"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
            <span className="font-bold">Amortissement angulaire</span>
            <EditableNumericValue
              value={config.jointAngularDamping ?? 3}
              precision={2}
              onChange={(v) => onChange({ jointAngularDamping: v })}
              className="font-mono tabular-nums font-bold text-sky-700 px-1 rounded cursor-text"
            />
          </div>
          <input
            type="range"
            min="0"
            max="25"
            step="0.5"
            value={Math.max(0, Math.min(25, config.jointAngularDamping ?? 3))}
            onChange={(e) => onChange({ jointAngularDamping: parseFloat(e.target.value) })}
            className="w-full accent-sky-600"
          />
        </div>
      </div>

      {/* Collisions monde */}
      <label className="pt-1 border-t border-sky-200/70 flex items-center justify-between gap-2 cursor-pointer">
        <div>
          <div className="font-bold text-slate-700 text-[11px]">
            Collisions avec murs, sols &amp; objets
          </div>
          <div className="text-[10px] text-slate-500">
            Réponse physique avec le décor (sans heurter la cible)
          </div>
        </div>
        <input
          type="checkbox"
          checked={config.collideWithWorld !== false}
          onChange={(e) => onChange({ collideWithWorld: e.target.checked })}
          className="w-4 h-4 accent-sky-600 rounded cursor-pointer shrink-0"
        />
      </label>

      {/* Rupture du Joint (Break Joint) */}
      <div className="p-2 bg-rose-50/80 rounded-xl border border-rose-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-rose-900 text-xs">
              Rupture du Joint (Break Joint)
            </div>
            <div className="text-[10px] text-rose-700/80">
              Casse le joint et désaimante si on tire ou secoue trop fort
            </div>
          </div>
          <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer whitespace-nowrap shrink-0">
            <input
              type="checkbox"
              checked={Boolean(config.jointBreakable)}
              onChange={(e) =>
                onChange({
                  jointBreakable: e.target.checked,
                  jointBreakForce: config.jointBreakForce ?? 240,
                  jointBreakShakeThreshold: config.jointBreakShakeThreshold ?? 100,
                  jointBreakFallWithGravity: config.jointBreakFallWithGravity ?? true,
                })
              }
              className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
            />
            <span>Cassable</span>
          </label>
        </div>

        {config.jointBreakable && (
          <div className="space-y-2 pt-1 border-t border-rose-200/70">
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                <span className="font-bold">Résistance à l&apos;arrachement</span>
                <EditableNumericValue
                  value={config.jointBreakForce ?? 240}
                  precision={1}
                  onChange={(v) => onChange({ jointBreakForce: v })}
                  className="font-mono tabular-nums font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min="50"
                max="800"
                step="10"
                value={Math.max(50, Math.min(800, config.jointBreakForce ?? 240))}
                onChange={(e) => onChange({ jointBreakForce: parseFloat(e.target.value) })}
                className="w-full accent-rose-600"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                <span className="font-bold">Tolérance aux secousses</span>
                <EditableNumericValue
                  value={config.jointBreakShakeThreshold ?? 100}
                  displayText={
                    (config.jointBreakShakeThreshold ?? 100) > 0
                      ? `${Math.round(config.jointBreakShakeThreshold ?? 100)}`
                      : 'Désactivé'
                  }
                  precision={1}
                  onChange={(v) => onChange({ jointBreakShakeThreshold: v })}
                  className="font-mono tabular-nums font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min="0"
                max="300"
                step="10"
                value={Math.max(0, Math.min(300, config.jointBreakShakeThreshold ?? 100))}
                onChange={(e) =>
                  onChange({ jointBreakShakeThreshold: parseFloat(e.target.value) })
                }
                className="w-full accent-rose-600"
              />
            </div>

            <label className="flex items-center justify-between gap-2 pt-0.5 cursor-pointer">
              <div>
                <div className="font-bold text-slate-700 text-[11px]">
                  Tomber librement après rupture
                </div>
                <div className="text-[10px] text-slate-500">
                  Active gravité et rebonds dès que le joint casse
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.jointBreakFallWithGravity !== false}
                onChange={(e) => onChange({ jointBreakFallWithGravity: e.target.checked })}
                className="w-4 h-4 accent-rose-600 rounded cursor-pointer shrink-0"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
};
