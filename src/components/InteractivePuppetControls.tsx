import React, { useState } from 'react';
import {
  Entity,
  EntityState,
  InteractivePuppetBehaviorConfig,
  InteractivePuppetDragOverRule,
} from '../types';
import {
  ChevronDown,
  ChevronRight,
  Layers,
  Paintbrush,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

interface InteractivePuppetControlsProps {
  behavior: InteractivePuppetBehaviorConfig;
  update: (partial: Partial<InteractivePuppetBehaviorConfig>) => void;
  stateList: EntityState[];
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  onQuickCreateState?: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}

export function InteractivePuppetControls({
  behavior: b,
  update,
  stateList,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  onQuickCreateState,
  onEditStateDrawing,
}: InteractivePuppetControlsProps) {
  const [phaseTab, setPhaseTab] = useState<'hover' | 'drag' | 'air'>('drag');
  const [showShortTimings, setShowShortTimings] = useState(false);

  const swingMode = b.swingMode || 'both';
  const showPendulum = swingMode === 'pendulum' || swingMode === 'both';
  const showSwingStates = swingMode === 'states' || swingMode === 'both';
  const sb = b.stateBindings || {};

  const updateBinding = (key: keyof NonNullable<InteractivePuppetBehaviorConfig['stateBindings']>, value: string) => {
    update({
      stateBindings: {
        ...sb,
        [key]: value || undefined,
      },
    });
  };

  const renderStateSelect = (
    label: string,
    key: keyof NonNullable<InteractivePuppetBehaviorConfig['stateBindings']>,
    hint?: string,
    suggestedName?: string
  ) => {
    const selectedId = sb[key] || '';
    return (
      <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-violet-100">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-bold text-slate-700 truncate">{label}</div>
          {hint && <div className="text-[9px] text-slate-400 truncate">{hint}</div>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={selectedId}
            onChange={(e) => updateBinding(key, e.target.value)}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
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
                const createdId = onQuickCreateState(suggestedName || label, 'Marionnette');
                if (createdId) updateBinding(key, createdId);
              }}
              className="p-1 bg-violet-50 hover:bg-violet-100 text-violet-700 border border-violet-200 rounded-lg cursor-pointer transition-colors"
              title={`Créer automatiquement l'état « ${suggestedName || label} »`}
            >
              <Plus className="w-3 h-3" />
            </button>
          )}
          {selectedId && onEditStateDrawing && (
            <button
              type="button"
              onClick={() => onEditStateDrawing(selectedId)}
              className="p-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg cursor-pointer transition-colors"
              title="Dessiner cet état"
            >
              <Paintbrush className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    );
  };

  const hoverCount = [
    sb.approachFarStateId,
    sb.approachNearStateId,
    sb.hoverEnterStateId,
    sb.hoverStateId,
    sb.hoverDwellStateId,
    sb.hoverExitStateId,
  ].filter(Boolean).length;

  const dragCount = [
    sb.dragStartStateId,
    sb.dragStateId,
    sb.dragDwellStateId,
    sb.swingStateId,
    sb.swingLeftStateId,
    sb.swingRightStateId,
    sb.shakeStateId,
    sb.dragReleaseStateId,
  ].filter(Boolean).length;

  const airCount = [sb.idleStateId, sb.fallStateId, sb.landStateId].filter(Boolean).length;

  const dragOverTargets = b.dragOverTargets || [];

  const handleAddDragOverRule = () => {
    const newRule: InteractivePuppetDragOverRule = {
      id: `dragover_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      targetMode: availableTags.length > 0 ? 'tag' : targetEntityOptions.length > 0 ? 'entity' : 'type',
      targetTag: availableTags[0] || '',
      targetEntityId: targetEntityOptions[0]?.id,
      targetEntityType: entityTypeOptions[0]?.type,
      stateId: stateList[0]?.id,
    };
    update({ dragOverTargets: [...dragOverTargets, newRule] });
  };

  const handleUpdateDragOverRule = (id: string, patch: Partial<InteractivePuppetDragOverRule>) => {
    update({
      dragOverTargets: dragOverTargets.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    });
  };

  const handleDeleteDragOverRule = (id: string) => {
    update({
      dragOverTargets: dragOverTargets.filter((r) => r.id !== id),
    });
  };

  return (
    <div className="space-y-2">
      {/* 1. Drag & Inertie au lancer */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs">Inertie au lancer (Throw)</div>
            <div className="text-[10px] text-slate-400">
              Projette la marionnette au lâcher (avec composant Physique)
            </div>
          </div>
          <input
            type="checkbox"
            checked={b.throwable !== false}
            onChange={(e) => update({ throwable: e.target.checked })}
            className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
          />
        </div>

        {b.throwable !== false && (
          <div className="pt-1.5 border-t border-slate-100">
            <div className="flex justify-between items-center text-[11px] text-slate-700 mb-1">
              <span className="font-semibold">Plafond de projection</span>
              <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                {b.maxThrowSpeed || 1500} px/s
              </span>
            </div>
            <input
              type="range"
              min="300"
              max="3000"
              step="100"
              value={b.maxThrowSpeed || 1500}
              onChange={(e) => update({ maxThrowSpeed: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        )}
      </div>

      {/* 2. Balancement & Pendule */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <div className="font-bold text-slate-700 text-xs">Balancement pendant le Drag</div>
          <div className="text-[10px] text-slate-400">
            Testez l'inclinaison pendulaire, les états visuels ou les deux combinés
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
          {(
            [
              { id: 'pendulum', label: 'Pendule' },
              { id: 'states', label: 'États' },
              { id: 'both', label: 'Les deux' },
            ] as const
          ).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ swingMode: opt.id })}
              className={`py-1 px-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                swingMode === opt.id
                  ? 'bg-violet-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {showPendulum && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-semibold">Amplitude max du pendule</span>
                <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                  ±{b.pendulumMaxAngle ?? 32}°
                </span>
              </div>
              <input
                type="range"
                min="5"
                max="65"
                step="1"
                value={b.pendulumMaxAngle ?? 32}
                onChange={(e) => update({ pendulumMaxAngle: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-semibold">Réactivité à la vitesse</span>
                <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                  {(b.pendulumIntensity ?? 1.0).toFixed(1)}x
                </span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.2"
                step="0.1"
                value={b.pendulumIntensity ?? 1.0}
                onChange={(e) => update({ pendulumIntensity: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-semibold">Amortissement ressort</span>
                <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                  {Math.round((b.pendulumSmoothing ?? 0.18) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0.05"
                max="0.5"
                step="0.02"
                value={b.pendulumSmoothing ?? 0.18}
                onChange={(e) => update({ pendulumSmoothing: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
          </div>
        )}

        {showSwingStates && (
          <div className="space-y-1.5 pt-1 border-t border-slate-100">
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-semibold">Seuil vitesse état Balancement</span>
                <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                  {b.swingSpeedThreshold ?? 320} px/s
                </span>
              </div>
              <input
                type="range"
                min="80"
                max="900"
                step="20"
                value={b.swingSpeedThreshold ?? 320}
                onChange={(e) => update({ swingSpeedThreshold: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-semibold">Sensibilité Secousse (allers-retours)</span>
                <span className="font-mono font-bold text-violet-600 bg-violet-50 px-1.5 py-0.5 rounded text-[10px]">
                  {b.shakeThreshold ?? 3}x
                </span>
              </div>
              <input
                type="range"
                min="2"
                max="6"
                step="1"
                value={b.shakeThreshold ?? 3}
                onChange={(e) => update({ shakeThreshold: parseInt(e.target.value, 10) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
          </div>
        )}
      </div>

      {/* 3. Paliers d'approche & Temporisations */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="font-bold text-slate-700 text-xs">Paliers d'approche & Seuils</div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Zone lointaine</span>
              <span className="font-mono font-bold text-violet-600">{b.approachFarDistance ?? 280} px</span>
            </div>
            <input
              type="range"
              min="80"
              max="600"
              step="10"
              value={b.approachFarDistance ?? 280}
              onChange={(e) => update({ approachFarDistance: parseInt(e.target.value, 10) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Zone proche</span>
              <span className="font-mono font-bold text-violet-600">{b.approachNearDistance ?? 120} px</span>
            </div>
            <input
              type="range"
              min="20"
              max="300"
              step="10"
              value={b.approachNearDistance ?? 120}
              onChange={(e) => update({ approachNearDistance: parseInt(e.target.value, 10) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Survol maintenu</span>
              <span className="font-mono font-bold text-violet-600">{(b.hoverDwellDelay ?? 1.5).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="5"
              step="0.1"
              value={b.hoverDwellDelay ?? 1.5}
              onChange={(e) => update({ hoverDwellDelay: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Retour après survol</span>
              <span className="font-mono font-bold text-violet-600">{(b.hoverReturnDelay ?? 0).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={b.hoverReturnDelay ?? 0}
              onChange={(e) => update({ hoverReturnDelay: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Drag maintenu</span>
              <span className="font-mono font-bold text-violet-600">{(b.dragDwellDelay ?? 2.0).toFixed(1)}s</span>
            </div>
            <input
              type="range"
              min="0.3"
              max="6"
              step="0.1"
              value={b.dragDwellDelay ?? 2.0}
              onChange={(e) => update({ dragDwellDelay: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Retour Balancement</span>
              <span className="font-mono font-bold text-violet-600">{(b.swingReturnDelay ?? 0.15).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={b.swingReturnDelay ?? 0.15}
              onChange={(e) => update({ swingReturnDelay: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Maintien Secousse</span>
              <span className="font-mono font-bold text-violet-600">{(b.shakeHoldDuration ?? 0.45).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="2.5"
              step="0.05"
              value={b.shakeHoldDuration ?? 0.45}
              onChange={(e) => update({ shakeHoldDuration: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Retour Drag Cible</span>
              <span className="font-mono font-bold text-violet-600">{(b.dragOverReturnDelay ?? 0).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={b.dragOverReturnDelay ?? 0}
              onChange={(e) => update({ dragOverReturnDelay: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Hauteur min. chute</span>
              <span className="font-mono font-bold text-violet-600">{b.minFallHeight ?? 20} px</span>
            </div>
            <input
              type="range"
              min="0"
              max="160"
              step="2"
              value={b.minFallHeight ?? 20}
              onChange={(e) => update({ minFallHeight: parseInt(e.target.value, 10) || 0 })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
          <div>
            <div className="flex justify-between text-[10px] text-slate-600 mb-0.5">
              <span className="font-semibold">Durée Land</span>
              <span className="font-mono font-bold text-violet-600">{(b.landDuration ?? 0.18).toFixed(2)}s</span>
            </div>
            <input
              type="range"
              min="0.05"
              max="0.6"
              step="0.05"
              value={b.landDuration ?? 0.18}
              onChange={(e) => update({ landDuration: parseFloat(e.target.value) })}
              className="w-full accent-violet-600 h-1.5"
            />
          </div>
        </div>

        <button
          type="button"
          onClick={() => setShowShortTimings((v) => !v)}
          className="w-full flex items-center justify-between pt-1.5 border-t border-slate-100 text-[10px] font-bold text-slate-500 hover:text-violet-600 cursor-pointer"
        >
          <span>Durées de transitions courtes (Enter / Exit / Start / Release)</span>
          {showShortTimings ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>

        {showShortTimings && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Hover Enter</span>
                <span className="font-mono font-bold text-violet-600">{(b.hoverEnterDuration ?? 0.18).toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.5"
                step="0.05"
                value={b.hoverEnterDuration ?? 0.18}
                onChange={(e) => update({ hoverEnterDuration: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Hover Exit</span>
                <span className="font-mono font-bold text-violet-600">{(b.hoverExitDuration ?? 0.2).toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.5"
                step="0.05"
                value={b.hoverExitDuration ?? 0.2}
                onChange={(e) => update({ hoverExitDuration: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Drag Start</span>
                <span className="font-mono font-bold text-violet-600">{(b.dragStartDuration ?? 0.18).toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.5"
                step="0.05"
                value={b.dragStartDuration ?? 0.18}
                onChange={(e) => update({ dragStartDuration: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-slate-600">
                <span>Drag Release</span>
                <span className="font-mono font-bold text-violet-600">{(b.dragReleaseDuration ?? 0.2).toFixed(2)}s</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.5"
                step="0.05"
                value={b.dragReleaseDuration ?? 0.2}
                onChange={(e) => update({ dragReleaseDuration: parseFloat(e.target.value) })}
                className="w-full accent-violet-600 h-1.5"
              />
            </div>
          </div>
        )}
      </div>

      {/* 4. Drag au-dessus d'entités ou #tags */}
      <div className="p-2 bg-amber-50/50 rounded-xl border border-amber-200/80 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <div className="font-bold text-amber-950 text-xs flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5 text-amber-600" />
              <span>Drag au-dessus d'une cible</span>
            </div>
            <div className="text-[10px] text-amber-800/75">
              Sous-état affiché quand on tient l'objet au-dessus d'une entité ou d'un #tag
            </div>
          </div>
          <button
            type="button"
            onClick={handleAddDragOverRule}
            className="px-2 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-900 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus className="w-3 h-3" /> Cible
          </button>
        </div>

        {dragOverTargets.length > 0 && (
          <div className="space-y-1.5">
            {dragOverTargets.map((rule) => (
              <div
                key={rule.id}
                className="p-1.5 bg-white rounded-lg border border-amber-200 space-y-1.5"
              >
                <div className="flex items-center gap-1">
                  <select
                    value={rule.targetMode}
                    onChange={(e) =>
                      handleUpdateDragOverRule(rule.id, {
                        targetMode: e.target.value as InteractivePuppetDragOverRule['targetMode'],
                      })
                    }
                    className="bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[10px] font-bold text-slate-700"
                  >
                    <option value="tag">#Tag</option>
                    <option value="entity">Entité</option>
                    <option value="type">Type</option>
                  </select>

                  {rule.targetMode === 'entity' && (
                    <select
                      value={rule.targetEntityId || ''}
                      onChange={(e) => handleUpdateDragOverRule(rule.id, { targetEntityId: e.target.value })}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[10px] font-medium text-slate-800"
                    >
                      <option value="">-- Entité cible --</option>
                      {targetEntityOptions.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name}
                        </option>
                      ))}
                    </select>
                  )}

                  {rule.targetMode === 'type' && (
                    <select
                      value={rule.targetEntityType || ''}
                      onChange={(e) => handleUpdateDragOverRule(rule.id, { targetEntityType: e.target.value })}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[10px] font-medium text-slate-800"
                    >
                      <option value="">-- Type cible --</option>
                      {entityTypeOptions.map((t) => (
                        <option key={t.type} value={t.type}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  )}

                  {rule.targetMode === 'tag' && (
                    <input
                      type="text"
                      list={`puppet-tags-${rule.id}`}
                      placeholder="ex: zone_depot"
                      value={rule.targetTag || ''}
                      onChange={(e) => handleUpdateDragOverRule(rule.id, { targetTag: e.target.value })}
                      className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded px-1.5 py-1 text-[10px] font-medium text-slate-800"
                    />
                  )}
                  {rule.targetMode === 'tag' && (
                    <datalist id={`puppet-tags-${rule.id}`}>
                      {availableTags.map((t) => (
                        <option key={t} value={t} />
                      ))}
                    </datalist>
                  )}

                  <button
                    type="button"
                    onClick={() => handleDeleteDragOverRule(rule.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer shrink-0"
                    title="Supprimer cette cible"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-semibold text-amber-800">➔ État affiché :</span>
                  <div className="flex items-center gap-1">
                    <select
                      value={rule.stateId || ''}
                      onChange={(e) => handleUpdateDragOverRule(rule.id, { stateId: e.target.value || undefined })}
                      className="bg-amber-50/70 border border-amber-200 rounded px-2 py-0.5 text-[10px] font-bold text-slate-800 max-w-[155px]"
                    >
                      <option value="">-- Choisir état --</option>
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
                          const baseLabel = rule.targetTag ? `Sur ${rule.targetTag}` : 'Drag Over';
                          const createdId = onQuickCreateState(baseLabel, 'Marionnette');
                          if (createdId) handleUpdateDragOverRule(rule.id, { stateId: createdId });
                        }}
                        className="p-0.5 bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 rounded cursor-pointer"
                        title="Créer un état dédié pour cette cible"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    )}
                    {rule.stateId && onEditStateDrawing && (
                      <button
                        type="button"
                        onClick={() => onEditStateDrawing(rule.stateId!)}
                        className="p-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded cursor-pointer"
                        title="Dessiner cet état"
                      >
                        <Paintbrush className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 5. Liaisons automatiques d'états visuels + Garde-fou */}
      <div className="p-2.5 bg-violet-50/60 rounded-xl border border-violet-200/80 space-y-2">
        <div>
          <div className="font-bold text-violet-950 text-xs flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-violet-600" />
            <span>États visuels automatiques (Garde-fou actif)</span>
          </div>
          <div className="text-[10px] text-violet-800/80 leading-snug mt-0.5">
            Ne liez que les états utiles : les emplacements vides sont ignorés et les états externes restent intacts.
          </div>
        </div>

        {/* Sous-onglets par phase pour éviter de surcharger l'inspecteur */}
        <div className="grid grid-cols-3 gap-1 bg-white/80 p-1 rounded-xl border border-violet-100">
          <button
            type="button"
            onClick={() => setPhaseTab('hover')}
            className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              phaseTab === 'hover' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            Approche/Survol ({hoverCount})
          </button>
          <button
            type="button"
            onClick={() => setPhaseTab('drag')}
            className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              phaseTab === 'drag' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            Drag/Balanc. ({dragCount})
          </button>
          <button
            type="button"
            onClick={() => setPhaseTab('air')}
            className={`py-1 px-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
              phaseTab === 'air' ? 'bg-violet-600 text-white shadow-xs' : 'text-slate-600 hover:bg-violet-50'
            }`}
          >
            Repos/Chute ({airCount})
          </button>
        </div>

        <div className="space-y-1.5">
          {phaseTab === 'hover' && (
            <>
              {renderStateSelect('Approche Lointaine', 'approachFarStateId', `Curseur ≤ ${b.approachFarDistance ?? 280} px`, 'Approche Loin')}
              {renderStateSelect('Approche Proche', 'approachNearStateId', `Curseur ≤ ${b.approachNearDistance ?? 120} px`, 'Approche Proche')}
              {renderStateSelect('Entrée Survol (Enter)', 'hoverEnterStateId', 'Transition courte à l’entrée', 'Hover Enter')}
              {renderStateSelect('Survol (Hover)', 'hoverStateId', 'Tant que le curseur est dessus', 'Survol')}
              {renderStateSelect('Survol Maintenu (Dwell)', 'hoverDwellStateId', `Après ${(b.hoverDwellDelay ?? 1.5).toFixed(1)}s`, 'Survol Long')}
              {renderStateSelect('Sortie Survol (Exit)', 'hoverExitStateId', 'Transition courte à la sortie', 'Hover Exit')}
            </>
          )}

          {phaseTab === 'drag' && (
            <>
              {renderStateSelect('Saisie (Drag Start)', 'dragStartStateId', 'Juste au moment où on l’attrape', 'Drag Start')}
              {renderStateSelect('Tenue (Drag)', 'dragStateId', 'Tenu sous le curseur', 'Drag')}
              {renderStateSelect('Tenue Maintenue (Dwell)', 'dragDwellStateId', `Tenu > ${(b.dragDwellDelay ?? 2.0).toFixed(1)}s`, 'Drag Long')}
              {showSwingStates && (
                <>
                  {renderStateSelect('Balancement (Rapide)', 'swingStateId', 'Générique gauche/droite', 'Balancement')}
                  {renderStateSelect('Balancement Gauche', 'swingLeftStateId', 'Optionnel (remplace générique)', 'Balance Gauche')}
                  {renderStateSelect('Balancement Droite', 'swingRightStateId', 'Optionnel (remplace générique)', 'Balance Droite')}
                </>
              )}
              {renderStateSelect('Secousse / Vertige', 'shakeStateId', 'Allers-retours rapides', 'Secousse')}
              {renderStateSelect('Relâchement (Release)', 'dragReleaseStateId', 'Juste après avoir lâché', 'Drag Release')}
            </>
          )}

          {phaseTab === 'air' && (
            <>
              {renderStateSelect('Repos (Idle)', 'idleStateId', 'État par défaut au calme', 'Repos')}
              {renderStateSelect('Chute (Fall)', 'fallStateId', `Après chute > ${b.minFallHeight ?? 20} px`, 'Chute')}
              {renderStateSelect('Atterrissage (Land)', 'landStateId', 'À la réception au sol', 'Land')}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
