import React from 'react';
import { GrabRotationMode } from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export interface GrabPhysicsConfigFields {
  throwable?: boolean;
  maxThrowSpeed?: number;
  precisePhysicsGrab?: boolean;
  grabRotationMode?: GrabRotationMode;
  grabMaxAngle?: number;
  grabBrakeAngle?: number;
  grabAngularStiffness?: number;
  grabAngularDamping?: number;
  disableCollisionsWhileDragging?: boolean;
}

interface GrabPhysicsControlsProps {
  config: GrabPhysicsConfigFields;
  update: (partial: Partial<GrabPhysicsConfigFields>) => void;
  accent?: 'indigo' | 'violet';
  throwSubtitle?: string;
  preciseSubtitle?: string;
}

export function GrabPhysicsControls({
  config,
  update,
  accent = 'indigo',
  throwSubtitle = "Projette l'objet selon la vitesse du geste au lâcher",
  preciseSubtitle = "Attrape le coin ou le bord exact : l'objet penche sous gravité et tire les joints (Physique ou Joint requis)",
}: GrabPhysicsControlsProps) {
  const isViolet = accent === 'violet';
  const checkboxAccent = isViolet ? 'accent-violet-600' : 'accent-indigo-600';
  const rangeAccent = isViolet ? 'accent-violet-600' : 'accent-indigo-600';
  const badgeColor = isViolet ? 'text-violet-600 bg-violet-50' : 'text-indigo-600 bg-indigo-50';
  const activeTabBg = isViolet ? 'bg-violet-600 text-white shadow-xs' : 'bg-indigo-600 text-white shadow-xs';

  const rotMode: GrabRotationMode = config.grabRotationMode || 'free';
  const maxAngle = config.grabMaxAngle ?? 45;
  const brakeAngle = config.grabBrakeAngle ?? 15;
  const stiffness = config.grabAngularStiffness ?? 140;
  const damping = config.grabAngularDamping ?? 8;

  return (
    <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
      {/* 1. Inertie au lancer */}
      <div className="flex items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-700 text-xs">Inertie au lancer (Throw)</div>
          <div className="text-[10px] text-slate-400">{throwSubtitle}</div>
        </div>
        <input
          type="checkbox"
          checked={config.throwable !== false}
          onChange={(e) => update({ throwable: e.target.checked })}
          className={`w-4 h-4 ${checkboxAccent} rounded cursor-pointer shrink-0`}
        />
      </div>

      {config.throwable !== false && (
        <div className="pt-1.5 border-t border-slate-100">
          <div className="flex justify-between items-center text-[11px] text-slate-700 mb-1">
            <span className="font-semibold">Plafond de projection</span>
            <EditableNumericValue
              value={config.maxThrowSpeed ?? 1500}
              unit="px/s"
              precision={1}
              onChange={(v) => update({ maxThrowSpeed: v })}
              className={`font-mono tabular-nums font-bold ${badgeColor} px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-text`}
            />
          </div>
          <input
            type="range"
            min="300"
            max="3000"
            step="100"
            value={Math.max(300, Math.min(3000, config.maxThrowSpeed ?? 1500))}
            onChange={(e) => update({ maxThrowSpeed: parseFloat(e.target.value) })}
            className={`w-full ${rangeAccent} h-1.5`}
          />
        </div>
      )}

      {/* 2. Saisie physique précise au point cliqué */}
      <div className="pt-1.5 border-t border-slate-100 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-slate-700 text-xs">Saisie physique précise (au point cliqué)</div>
            <div className="text-[10px] text-slate-400">{preciseSubtitle}</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(config.precisePhysicsGrab)}
            onChange={(e) => update({ precisePhysicsGrab: e.target.checked })}
            className={`w-4 h-4 ${checkboxAccent} rounded cursor-pointer shrink-0`}
          />
        </div>

        {config.precisePhysicsGrab && (
          <div className="p-2 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
            <div>
              <div className="text-[10px] font-bold text-slate-600 mb-1">
                Rotation pendant la saisie physique
              </div>
              <div className="grid grid-cols-2 gap-1 bg-slate-200/70 p-0.5 rounded-lg">
                {(
                  [
                    { id: 'free', label: 'Libre 360°' },
                    { id: 'damped_limited', label: 'Limitée & Amortie' },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => update({ grabRotationMode: opt.id })}
                    className={`py-1 px-1.5 rounded-md text-[10px] font-bold transition-all cursor-pointer ${
                      rotMode === opt.id ? activeTabBg : 'text-slate-600 hover:bg-white/70'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {rotMode === 'damped_limited' && (
              <div className="space-y-1.5 pt-1 border-t border-slate-200/70">
                <div>
                  <div className="flex justify-between items-center text-[10.5px] text-slate-700">
                    <span className="font-semibold">Angle limite (±)</span>
                    <EditableNumericValue
                      value={maxAngle}
                      displayText={`±${Math.round(maxAngle)}°`}
                      precision={1}
                      onChange={(v) => update({ grabMaxAngle: v })}
                      className={`font-mono tabular-nums font-bold ${badgeColor} px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-text`}
                    />
                  </div>
                  <input
                    type="range"
                    min="10"
                    max="160"
                    step="5"
                    value={Math.max(10, Math.min(160, maxAngle))}
                    onChange={(e) => {
                      const nextMax = parseFloat(e.target.value);
                      update({
                        grabMaxAngle: nextMax,
                        ...(brakeAngle >= nextMax ? { grabBrakeAngle: Math.max(0, nextMax - 2) } : {}),
                      });
                    }}
                    className={`w-full ${rangeAccent} h-1.5`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10.5px] text-slate-700">
                    <span className="font-semibold">Zone de frein (amortisseur avant butée)</span>
                    <EditableNumericValue
                      value={brakeAngle}
                      unit="°"
                      precision={1}
                      onChange={(v) => update({ grabBrakeAngle: v })}
                      className={`font-mono tabular-nums font-bold ${badgeColor} px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-text`}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max={Math.max(1, Math.min(45, maxAngle - 1))}
                    step="1"
                    value={Math.max(0, Math.min(Math.max(1, Math.min(45, maxAngle - 1)), brakeAngle))}
                    onChange={(e) => update({ grabBrakeAngle: parseFloat(e.target.value) })}
                    className={`w-full ${rangeAccent} h-1.5`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10.5px] text-slate-700">
                    <span className="font-semibold">Rappel ressort (vers vertical)</span>
                    <EditableNumericValue
                      value={stiffness}
                      precision={1}
                      onChange={(v) => update({ grabAngularStiffness: v })}
                      className={`font-mono tabular-nums font-bold ${badgeColor} px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-text`}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="500"
                    step="10"
                    value={Math.max(0, Math.min(500, stiffness))}
                    onChange={(e) => update({ grabAngularStiffness: parseFloat(e.target.value) })}
                    className={`w-full ${rangeAccent} h-1.5`}
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[10.5px] text-slate-700">
                    <span className="font-semibold">Amortissement angulaire</span>
                    <EditableNumericValue
                      value={damping}
                      precision={2}
                      onChange={(v) => update({ grabAngularDamping: v })}
                      className={`font-mono tabular-nums font-bold ${badgeColor} px-1.5 py-0.5 rounded text-[10px] whitespace-nowrap shrink-0 cursor-text`}
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="30"
                    step="1"
                    value={Math.max(0, Math.min(30, damping))}
                    onChange={(e) => update({ grabAngularDamping: parseFloat(e.target.value) })}
                    className={`w-full ${rangeAccent} h-1.5`}
                  />
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 3. Désactiver les collisions solides pendant le drag */}
      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2">
        <div>
          <div className="font-bold text-slate-700 text-xs">Ignorer les collisions pendant le drag</div>
          <div className="text-[10px] text-slate-400">
            Passe en mode fantôme tant que l&apos;objet est tenu (évite de repousser les autres corps)
          </div>
        </div>
        <input
          type="checkbox"
          checked={Boolean(config.disableCollisionsWhileDragging)}
          onChange={(e) => update({ disableCollisionsWhileDragging: e.target.checked })}
          className={`w-4 h-4 ${checkboxAccent} rounded cursor-pointer shrink-0`}
        />
      </div>
    </div>
  );
}
