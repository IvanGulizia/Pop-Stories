import React from 'react';
import { Check, Clapperboard } from 'lucide-react';
import { ActionTargetMode, Entity, EntityId, EntityType, RuleAction } from '../../types';
import { EntityOption, formatRoleLabel } from './ruleBookTypes';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export interface ControlAnimationConfigDraft {
  targetMode?: ActionTargetMode;
  targetId?: EntityId;
  targetType?: EntityType;
  targetTag?: string;
  animControlMode?: 'set_frame' | 'step_frame' | 'set_progress' | 'reset';
  animFrameNumber?: number;
  animStepDelta?: number;
  animProgressPercent?: number;
  animLoopOnStep?: boolean;
}

interface ControlAnimationConfigEditorProps {
  draft: ControlAnimationConfigDraft;
  onPatch: (patch: Partial<ControlAnimationConfigDraft>) => void;
  onConfirm: (actionData: Omit<RuleAction, 'id'>) => void;
  isRelational: boolean;
  isGlobal?: boolean;
  subjectType: EntityType;
  targetType: EntityType;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  subjectHint?: string;
  targetHint?: string;
}

export const ControlAnimationConfigEditor: React.FC<ControlAnimationConfigEditorProps> = ({
  draft,
  onPatch,
  onConfirm,
  isRelational,
  isGlobal = false,
  subjectType,
  targetType,
  entities,
  availableEntityOptions,
  allProjectTags,
  subjectHint,
  targetHint,
}) => {
  const entityList = Object.values(entities);
  const firstEntityId = entityList[0]?.id || '';
  const firstEntityType = availableEntityOptions[0]?.type || '';

  const tMode: ActionTargetMode = draft.targetMode || (isGlobal ? 'instance' : 'subject');
  const animMode = draft.animControlMode || 'step_frame';
  const frameNumber = Math.max(1, Math.round(draft.animFrameNumber ?? 1));
  const stepDelta = Math.round(draft.animStepDelta ?? 1);
  const progressPercent = Math.max(0, Math.min(100, draft.animProgressPercent ?? 50));
  const loopOnStep = Boolean(draft.animLoopOnStep);

  // Indice informatif du nombre de frames si une entité est identifiable
  const resolvedPreviewEntity: Entity | undefined =
    tMode === 'instance'
      ? entities[draft.targetId || firstEntityId]
      : tMode === 'type'
      ? entityList.find((e) => e.type === (draft.targetType || firstEntityType))
      : tMode === 'subject'
      ? entityList.find((e) => e.type === subjectType)
      : tMode === 'target'
      ? entityList.find((e) => e.type === targetType)
      : undefined;
  const previewFrameCount =
    resolvedPreviewEntity?.states[resolvedPreviewEntity.currentStateId]?.frames?.length ?? 0;

  return (
    <div className="space-y-4 max-w-lg mx-auto py-2">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 bg-violet-100 text-violet-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Clapperboard className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-black text-slate-800">Contrôler l&apos;animation (Frames / Cliquet)</h4>
        <p className="text-xs text-slate-500">
          Avance, saute à une frame précise ou réinitialise la progression d&apos;une animation pilotée ou flipbook.
        </p>
      </div>

      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        {/* Cible */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Objet à animer</span>
          <select
            value={tMode}
            onChange={(e) => onPatch({ targetMode: e.target.value as ActionTargetMode })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {!isGlobal && <option value="subject">{formatRoleLabel('Sujet', subjectHint)}</option>}
            {isRelational && <option value="target">{formatRoleLabel('Cible touchée', targetHint)}</option>}
            <option value="last_spawned">Dernier objet créé</option>
            <option value="instance">Entité précise</option>
            <option value="type">Par Type</option>
            <option value="tag">Par Tag (#tag)</option>
          </select>
        </div>

        {tMode === 'instance' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Instance</span>
            <select
              value={draft.targetId || firstEntityId}
              onChange={(e) => onPatch({ targetId: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[230px]"
            >
              {entityList.map((ent) => (
                <option key={ent.id} value={ent.id}>
                  {ent.name}
                </option>
              ))}
            </select>
          </div>
        )}

        {tMode === 'type' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Type ciblé</span>
            <select
              value={draft.targetType || firstEntityType}
              onChange={(e) => onPatch({ targetType: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              {availableEntityOptions.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {tMode === 'tag' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Tag (#tag)</span>
            <input
              type="text"
              list="control-anim-target-tags"
              value={draft.targetTag || ''}
              onChange={(e) => onPatch({ targetTag: e.target.value.replace(/^#/, '') })}
              placeholder="ex: orange, porte..."
              className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="control-anim-target-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Choix du mode de contrôle */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">
            Opération sur l&apos;animation :
            {previewFrameCount > 0 && (
              <span className="ml-1.5 text-[10px] font-semibold text-violet-600">
                ({previewFrameCount} frame{previewFrameCount > 1 ? 's' : ''} détectée{previewFrameCount > 1 ? 's' : ''})
              </span>
            )}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                { id: 'step_frame', label: '⏭️ Avancer / Reculer' },
                { id: 'set_frame', label: '🎯 Aller à la Frame N' },
                { id: 'set_progress', label: '📊 Fixer à X %' },
                { id: 'reset', label: '⏮️ Réinitialiser (0%)' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ animControlMode: opt.id })}
                className={`py-2 px-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  animMode === opt.id
                    ? 'bg-violet-600 text-white border-violet-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-violet-50'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Paramètres spécifiques au mode */}
        {animMode === 'step_frame' && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Pas en frames (Δ)</span>
              <div className="flex items-center gap-1.5">
                {[-1, 1, 2].map((delta) => (
                  <button
                    key={delta}
                    type="button"
                    onClick={() => onPatch({ animStepDelta: delta })}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border cursor-pointer ${
                      stepDelta === delta
                        ? 'bg-violet-600 text-white border-violet-700'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-violet-50'
                    }`}
                  >
                    {delta > 0 ? `+${delta}` : delta}
                  </button>
                ))}
                <EditableNumericValue
                  value={stepDelta}
                  onChange={(v) => onPatch({ animStepDelta: Math.round(v) })}
                  precision={0}
                  className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
                />
              </div>
            </div>

            <label className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100 cursor-pointer">
              <span className="text-xs font-bold text-slate-700">Boucler au bout (Loop)</span>
              <input
                type="checkbox"
                checked={loopOnStep}
                onChange={(e) => onPatch({ animLoopOnStep: e.target.checked })}
                className="w-4 h-4 accent-violet-600 rounded cursor-pointer"
              />
            </label>
          </div>
        )}

        {animMode === 'set_frame' && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-slate-700 text-xs">Numéro de frame cible</div>
              <div className="text-[10px] text-slate-400">1 = première image de l&apos;état courant</div>
            </div>
            <EditableNumericValue
              value={frameNumber}
              onChange={(v) => onPatch({ animFrameNumber: Math.max(1, Math.round(v)) })}
              precision={0}
              className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
            />
          </div>
        )}

        {animMode === 'set_progress' && (
          <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Progression (0 – 100 %)</span>
              <EditableNumericValue
                value={progressPercent}
                onChange={(v) => onPatch({ animProgressPercent: Math.max(0, Math.min(100, v)) })}
                precision={1}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
              />
            </div>
            <div className="flex items-center gap-1 justify-end">
              {[0, 25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={() => onPatch({ animProgressPercent: pct })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                    Math.round(progressPercent) === pct
                      ? 'bg-violet-600 text-white border-violet-700'
                      : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-violet-50'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {animMode === 'reset' && (
          <div className="p-3 bg-violet-50/70 rounded-xl border border-violet-200 text-xs text-violet-900">
            Remet l&apos;animation et le cliquet irréversible à <strong>0% (Frame 1)</strong> afin de pouvoir rejouer la progression depuis le début.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onConfirm({
            type: 'control_animation',
            targetMode: tMode,
            targetId: tMode === 'instance' ? draft.targetId || firstEntityId : undefined,
            targetType:
              tMode === 'type'
                ? draft.targetType || firstEntityType
                : tMode === 'target'
                ? targetType
                : tMode === 'subject'
                ? subjectType
                : undefined,
            targetTag:
              tMode === 'tag'
                ? (draft.targetTag || '').trim().replace(/^#/, '')
                : undefined,
            animControlMode: animMode,
            animFrameNumber: animMode === 'set_frame' ? frameNumber : undefined,
            animStepDelta: animMode === 'step_frame' ? stepDelta : undefined,
            animProgressPercent: animMode === 'set_progress' ? progressPercent : undefined,
            animLoopOnStep: animMode === 'step_frame' ? loopOnStep : undefined,
          });
        }}
        className="w-full py-3 bg-violet-600 hover:bg-violet-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider le contrôle d&apos;animation</span>
      </button>
    </div>
  );
};
