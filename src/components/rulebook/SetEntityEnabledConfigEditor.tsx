import React from 'react';
import { Check } from 'lucide-react';
import { ActionTargetMode, Entity, EntityType, RuleAction } from '../../types';
import { EntityOption } from './ruleBookTypes';

export interface SetEntityEnabledConfigDraft {
  enabledActionMode?: 'enable' | 'disable' | 'toggle';
  targetMode?: ActionTargetMode;
  targetId?: string;
  targetType?: EntityType;
  targetTag?: string;
}

interface SetEntityEnabledConfigEditorProps {
  draft: SetEntityEnabledConfigDraft;
  onPatch: (patch: Partial<SetEntityEnabledConfigDraft>) => void;
  onConfirm: (actionData: Omit<RuleAction, 'id'>) => void;
  isRelational: boolean;
  isGlobal?: boolean;
  subjectType: EntityType;
  targetType: EntityType;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
}

export const SetEntityEnabledConfigEditor: React.FC<SetEntityEnabledConfigEditorProps> = ({
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
}) => {
  const entityList = Object.values(entities);
  const firstEntityId = entityList[0]?.id || '';
  const firstEntityType = availableEntityOptions[0]?.type || '';

  const enabledMode = draft.enabledActionMode || 'disable';
  const tMode: ActionTargetMode =
    draft.targetMode || (isGlobal ? 'instance' : 'subject');

  return (
    <div className="space-y-4 max-w-lg mx-auto py-2">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 bg-slate-200 text-slate-800 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
          ⏻
        </div>
        <h4 className="text-sm font-black text-slate-800">Activer / Désactiver une entité</h4>
        <p className="text-xs text-slate-500">
          Une entité désactivée disparaît temporairement de la scène (ni rendue, ni physique, ni collisions) sans être détruite.
        </p>
      </div>

      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        {/* Choix d'état actif/désactivé */}
        <div>
          <label className="text-xs font-bold text-slate-700 block mb-1.5">Action :</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(
              [
                { id: 'disable', label: '⏸️ Désactiver' },
                { id: 'enable', label: '▶️ Réactiver' },
                { id: 'toggle', label: '🔄 Basculer' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => onPatch({ enabledActionMode: opt.id })}
                className={`py-2 px-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  enabledMode === opt.id
                    ? opt.id === 'disable'
                      ? 'bg-slate-800 text-white border-slate-900 shadow-2xs'
                      : opt.id === 'enable'
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ciblage */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Entité ciblée</span>
          <select
            value={tMode}
            onChange={(e) => onPatch({ targetMode: e.target.value as ActionTargetMode })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {!isGlobal && <option value="subject">Sujet</option>}
            {isRelational && <option value="target">Cible touchée</option>}
            <option value="instance">Entité précise (recommandé)</option>
            <option value="type">Par Type</option>
            <option value="tag">Par Tag (#tag)</option>
            <option value="last_spawned">Dernier objet créé</option>
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
                  {ent.disabled ? ' (désactivé)' : ''}
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
              list="enabled-target-tags"
              value={draft.targetTag || ''}
              onChange={(e) => onPatch({ targetTag: e.target.value.replace(/^#/, '') })}
              placeholder="ex: porte, piege..."
              className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="enabled-target-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          onConfirm({
            type: 'set_entity_enabled',
            enabledActionMode: enabledMode,
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
          });
        }}
        className="w-full py-3 bg-slate-800 hover:bg-slate-900 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider l'activation / désactivation</span>
      </button>
    </div>
  );
};
