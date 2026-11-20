import React from 'react';
import { TriggerType } from '../../types';

interface TriggerLimitsSectionProps {
  triggerType: TriggerType;
  variableTriggerMode?: 'threshold' | 'on_change';
  triggerMaxCount?: number;
  triggerCooldownSec?: number;
  triggerStartDelaySec?: number;
  triggerRequireReset?: boolean;
  onChange: (patch: {
    triggerMaxCount?: number;
    triggerCooldownSec?: number;
    triggerStartDelaySec?: number;
    triggerRequireReset?: boolean;
  }) => void;
}

export const TriggerLimitsSection: React.FC<TriggerLimitsSectionProps> = ({
  triggerType,
  variableTriggerMode,
  triggerMaxCount,
  triggerCooldownSec,
  triggerStartDelaySec,
  triggerRequireReset,
  onChange,
}) => {
  const normalizedMax =
    triggerMaxCount !== undefined && triggerMaxCount > 0 ? Math.round(triggerMaxCount) : 0;
  const isUnlimited = normalizedMax === 0;
  const isOnce = normalizedMax === 1;
  const isCustomN = normalizedMax > 1;

  const supportsEdgeReset =
    triggerType === 'proximity' ||
    triggerType === 'boundary' ||
    (triggerType === 'variable' && (variableTriggerMode || 'threshold') !== 'on_change');

  return (
    <div className="pt-3 border-t border-slate-200/80 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <label className="text-xs font-bold text-slate-800 block">
          🎯 Fréquence, Limites &amp; Délais :
        </label>
        <span className="text-[10px] text-slate-400 font-medium">
          Par session Play / scène
        </span>
      </div>

      {/* Nombre max de déclenchements */}
      <div className="space-y-1.5">
        <span className="text-[11px] font-semibold text-slate-600 block">
          Nombre maximum de déclenchements :
        </span>
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => onChange({ triggerMaxCount: undefined })}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isUnlimited
                ? 'bg-indigo-50 border-indigo-500 text-indigo-800 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            ∞ Illimité
          </button>
          <button
            type="button"
            onClick={() => onChange({ triggerMaxCount: 1 })}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isOnce
                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            1× Une fois
          </button>
          <button
            type="button"
            onClick={() => onChange({ triggerMaxCount: isCustomN ? normalizedMax : 2 })}
            className={`px-2.5 py-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
              isCustomN
                ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-2xs'
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            {isCustomN ? `${normalizedMax}× Limité` : 'N× Limité'}
          </button>
        </div>

        {normalizedMax >= 1 && (
          <div className="flex items-center justify-between gap-2 bg-white border border-slate-200 rounded-xl px-3 py-2 mt-1.5">
            <span className="text-[11px] font-bold text-slate-700">
              Max exact (fois) :
            </span>
            <input
              type="number"
              min={1}
              max={999}
              step={1}
              value={normalizedMax}
              onChange={(e) => {
                const parsed = parseInt(e.target.value, 10);
                onChange({
                  triggerMaxCount: Number.isFinite(parsed) && parsed >= 1 ? parsed : 1,
                });
              }}
              className="w-20 text-center text-xs font-black bg-slate-50 text-slate-900 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        )}
      </div>

      {/* Cooldown & Délai initial */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 space-y-1">
          <label className="text-[11px] font-bold text-slate-700 block">
            ⏱️ Cooldown (sec)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              step={0.25}
              value={triggerCooldownSec ?? 0}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                onChange({
                  triggerCooldownSec:
                    Number.isFinite(parsed) && parsed > 0 ? Math.min(120, parsed) : undefined,
                });
              }}
              className="w-20 text-center text-xs font-bold bg-slate-50 text-slate-900 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="text-[10px] text-slate-400 leading-tight">
              Pause min. entre 2 tirs
            </span>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-2.5 space-y-1">
          <label className="text-[11px] font-bold text-slate-700 block">
            ⏳ Délai lancement (sec)
          </label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={0}
              max={120}
              step={0.5}
              value={triggerStartDelaySec ?? 0}
              onChange={(e) => {
                const parsed = parseFloat(e.target.value);
                onChange({
                  triggerStartDelaySec:
                    Number.isFinite(parsed) && parsed > 0 ? Math.min(120, parsed) : undefined,
                });
              }}
              className="w-20 text-center text-xs font-bold bg-slate-50 text-slate-900 border border-slate-300 rounded-lg px-2 py-1 outline-none focus:ring-2 focus:ring-indigo-400"
            />
            <span className="text-[10px] text-slate-400 leading-tight">
              Attente après Play / scène
            </span>
          </div>
        </div>
      </div>

      {/* Front montant (1x par passage) pour conditions continues */}
      {supportsEdgeReset && (
        <button
          type="button"
          onClick={() => onChange({ triggerRequireReset: !triggerRequireReset })}
          className={`w-full p-2.5 rounded-2xl border text-left transition-all cursor-pointer flex items-center justify-between gap-2 ${
            triggerRequireReset
              ? 'bg-sky-50 border-sky-500 text-sky-950 shadow-2xs'
              : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
          }`}
        >
          <div>
            <div className="text-xs font-black text-sky-900">
              ↗ 1× par passage (Front montant)
            </div>
            <div className="text-[10px] text-slate-500 mt-0.5 leading-tight">
              Déclenche uniquement quand la condition devient vraie, puis attend qu'elle redevienne fausse avant de réarmer.
            </div>
          </div>
          <span
            className={`px-2 py-0.5 rounded-lg text-[10px] font-black shrink-0 ${
              triggerRequireReset ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-500'
            }`}
          >
            {triggerRequireReset ? 'ACTIF' : 'OFF'}
          </span>
        </button>
      )}
    </div>
  );
};
