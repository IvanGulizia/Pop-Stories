import React from 'react';
import { Entity, ParticleDirectionMode } from '../../types';
import { EntityOption, formatRoleLabel } from '../rulebook/ruleBookTypes';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export interface ParticleEmissionExtrasDraft {
  particleAngle?: number;
  particleSpread?: number;
  particleDirectionMode?: ParticleDirectionMode;
  particleDirectionTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  particleDirectionTargetEntityId?: string;
  particleDirectionTargetEntityType?: string;
  particleDirectionTargetTag?: string;
  particleEmitDuration?: number;
  particleEmitRate?: number;
  particleBurstCount?: number;
  particleBurstInterval?: number;
  particleCount?: number;
}

interface ParticleActionEmissionExtrasSectionProps {
  draft: ParticleEmissionExtrasDraft;
  allowTarget: boolean;
  subjectHint?: string;
  targetHint?: string;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  datalistId: string;
  onPatch: (patch: Record<string, any>) => void;
}

export const ParticleActionEmissionExtrasSection: React.FC<ParticleActionEmissionExtrasSectionProps> = ({
  draft,
  allowTarget,
  subjectHint,
  targetHint,
  entities,
  availableEntityOptions,
  allProjectTags,
  datalistId,
  onPatch,
}) => {
  const dirMode: ParticleDirectionMode = draft.particleDirectionMode || 'angle';
  const dirTargetMode = draft.particleDirectionTargetMode || (allowTarget ? 'target' : 'entity');
  const emitDuration = draft.particleEmitDuration ?? 0;

  return (
    <div className="space-y-1.5">
      {/* Direction d'émission & Cône */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Direction d&apos;émission</span>
          <select
            value={dirMode}
            onChange={(e) => {
              const nextMode = e.target.value as ParticleDirectionMode;
              const patch: Record<string, any> = { particleDirectionMode: nextMode };
              if (
                (nextMode === 'toward_target' || nextMode === 'away_target') &&
                !draft.particleDirectionTargetMode
              ) {
                patch.particleDirectionTargetMode = allowTarget ? 'target' : 'entity';
                patch.particleDirectionTargetEntityId =
                  draft.particleDirectionTargetEntityId || Object.keys(entities)[0] || '';
              }
              onPatch(patch);
            }}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            <option value="angle">Angle fixe (°)</option>
            <option value="facing">Sens de l&apos;entité (rotation / flip)</option>
            <option value="mouse">Vers la souris</option>
            <option value="toward_target">
              {allowTarget ? `Vers ${formatRoleLabel('Cible', targetHint)}` : 'Vers une cible'}
            </option>
            <option value="away_target">
              {allowTarget
                ? `À l'opposé de ${formatRoleLabel('Cible', targetHint)}`
                : "À l'opposé d'une cible"}
            </option>
          </select>
        </div>

        {dirMode === 'angle' && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-semibold text-slate-600">Angle</span>
              <EditableNumericValue
                value={draft.particleAngle ?? -90}
                unit="°"
                precision={0}
                onChange={(v) => onPatch({ particleAngle: v })}
                className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
              />
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.max(-180, Math.min(180, draft.particleAngle ?? -90))}
              onChange={(e) => onPatch({ particleAngle: parseFloat(e.target.value) })}
              className="w-40 accent-indigo-600"
            />
          </div>
        )}

        {(dirMode === 'toward_target' || dirMode === 'away_target') && (
          <div className="pt-1 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-semibold text-slate-600">Cible de direction</span>
              <select
                value={dirTargetMode}
                onChange={(e) => onPatch({ particleDirectionTargetMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
              >
                <option value="subject">{formatRoleLabel('Sujet de la règle', subjectHint)}</option>
                {allowTarget && <option value="target">{formatRoleLabel('Cible touchée', targetHint)}</option>}
                <option value="entity">Entité de la scène</option>
                <option value="type">Par Type</option>
                <option value="tag">Par #Tag</option>
                <option value="last_spawned">Dernier objet créé</option>
                <option value="mouse">Curseur souris</option>
              </select>
            </div>

            {dirTargetMode === 'entity' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Entité</span>
                <select
                  value={draft.particleDirectionTargetEntityId || Object.keys(entities)[0] || ''}
                  onChange={(e) => onPatch({ particleDirectionTargetEntityId: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[190px]"
                >
                  {Object.values(entities).map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dirTargetMode === 'type' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Type</span>
                <select
                  value={draft.particleDirectionTargetEntityType || availableEntityOptions[0]?.type || ''}
                  onChange={(e) => onPatch({ particleDirectionTargetEntityType: e.target.value })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[190px]"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {dirTargetMode === 'tag' && (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Tag (#tag)</span>
                <input
                  type="text"
                  list={datalistId}
                  value={draft.particleDirectionTargetTag || ''}
                  onChange={(e) =>
                    onPatch({ particleDirectionTargetTag: e.target.value.replace(/^#/, '') })
                  }
                  placeholder="ex: joueur, cible..."
                  className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
                />
                <datalist id={datalistId}>
                  {allProjectTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-semibold text-slate-600">Dispersion (cône)</span>
            <EditableNumericValue
              value={draft.particleSpread ?? 360}
              unit="°"
              precision={0}
              onChange={(v) => onPatch({ particleSpread: v })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
            />
          </div>
          <input
            type="range"
            min="0"
            max="360"
            step="5"
            value={Math.max(0, Math.min(360, draft.particleSpread ?? 360))}
            onChange={(e) => onPatch({ particleSpread: parseFloat(e.target.value) })}
            className="w-40 accent-indigo-600"
          />
        </div>
      </div>

      {/* Durée d'émission & Salves périodiques */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700 text-xs block">
              Durée d&apos;émission (0 = burst unique)
            </span>
            <span className="text-[10px] text-slate-400">
              &gt; 0s : jet continu et/ou plusieurs salves temporisées
            </span>
          </div>
          <div className="flex items-center gap-1">
            <input
              type="number"
              step="any"
              value={emitDuration}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                onPatch({ particleEmitDuration: Number.isFinite(v) ? Math.max(0, v) : 0 });
              }}
              className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-amber-700"
            />
            <span className="text-[11px] text-slate-500">s</span>
          </div>
        </div>

        {emitDuration > 0 && (
          <div className="grid grid-cols-3 gap-1.5 pt-1.5 border-t border-slate-100 text-xs">
            <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-600">Débit continu (part/s)</span>
              <input
                type="number"
                step="any"
                value={draft.particleEmitRate ?? 20}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onPatch({ particleEmitRate: Number.isFinite(v) ? Math.max(0, v) : 0 });
                }}
                className="w-full bg-white border border-amber-200 rounded px-1.5 py-0.5 font-mono font-bold text-amber-800 text-[11px]"
              />
            </div>

            <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-600">Salve toutes les (s)</span>
              <input
                type="number"
                step="any"
                value={draft.particleBurstInterval ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onPatch({ particleBurstInterval: Number.isFinite(v) ? Math.max(0, v) : 0 });
                }}
                className="w-full bg-white border border-amber-200 rounded px-1.5 py-0.5 font-mono font-bold text-amber-800 text-[11px]"
              />
            </div>

            <div className="p-1.5 bg-amber-50/50 rounded-lg border border-amber-200/70 flex flex-col gap-0.5">
              <span className="text-[10px] font-bold text-slate-600">Nb / salve</span>
              <input
                type="number"
                step="any"
                value={draft.particleBurstCount ?? (draft.particleCount ?? 12)}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  onPatch({
                    particleBurstCount: Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0,
                  });
                }}
                className="w-full bg-white border border-amber-200 rounded px-1.5 py-0.5 font-mono font-bold text-amber-800 text-[11px]"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
