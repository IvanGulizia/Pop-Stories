import React from 'react';
import { Check } from 'lucide-react';
import { ActionTargetMode, Entity, EntityType, RuleAction } from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';
import { EntityOption } from './ruleBookTypes';

export interface ApplyImpulseConfigDraft {
  targetMode?: ActionTargetMode;
  targetId?: string;
  targetType?: EntityType;
  targetTag?: string;
  impulseStrength?: number;
  impulseDirectionMode?: 'cardinal' | 'angle' | 'facing' | 'toward_target' | 'away_target';
  impulseCardinal?: 'up' | 'down' | 'left' | 'right';
  impulseAngle?: number;
  impulseApplyMode?: 'add' | 'set';
  impulseTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  impulseTargetEntityId?: string;
  impulseTargetEntityType?: EntityType;
  impulseTargetTag?: string;
  impulseAngular?: number;
}

interface ApplyImpulseConfigEditorProps {
  draft: ApplyImpulseConfigDraft;
  onPatch: (patch: Partial<ApplyImpulseConfigDraft>) => void;
  onConfirm: (actionData: Omit<RuleAction, 'id'>) => void;
  isRelational: boolean;
  isGlobal?: boolean;
  subjectType: EntityType;
  targetType: EntityType;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
}

export const ApplyImpulseConfigEditor: React.FC<ApplyImpulseConfigEditorProps> = ({
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

  const tMode: ActionTargetMode =
    draft.targetMode || (isGlobal ? 'instance' : 'subject');
  const strength = draft.impulseStrength ?? 350;
  const applyMode = draft.impulseApplyMode || 'add';
  const dirMode = draft.impulseDirectionMode || 'cardinal';
  const cardinal = draft.impulseCardinal || 'up';
  const angle = draft.impulseAngle ?? -90;
  const angular = draft.impulseAngular ?? 0;
  const refMode =
    draft.impulseTargetMode || (isRelational ? 'target' : 'entity');

  return (
    <div className="space-y-4 max-w-xl mx-auto py-2">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 bg-orange-100 text-orange-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
          💥
        </div>
        <h4 className="text-sm font-black text-slate-800">Force / Impulsion Physique</h4>
        <p className="text-xs text-slate-500">
          Propulsez, faites sauter ou donnez une vitesse de rotation à une entité en jeu.
        </p>
      </div>

      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        {/* Entité propulsée */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Entité propulsée</span>
          <select
            value={tMode}
            onChange={(e) => onPatch({ targetMode: e.target.value as ActionTargetMode })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {!isGlobal && <option value="subject">Sujet</option>}
            {isRelational && <option value="target">Cible touchée</option>}
            <option value="last_spawned">Dernier objet créé</option>
            <option value="instance">Entité précise</option>
            <option value="type">Par Type</option>
            <option value="tag">Par Tag (#tag)</option>
          </select>
        </div>

        {tMode === 'instance' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Choisir l'entité</span>
            <select
              value={draft.targetId || firstEntityId}
              onChange={(e) => onPatch({ targetId: e.target.value })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[220px]"
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
            <span className="font-bold text-slate-700 text-xs">Type propulsé</span>
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
              list="impulse-target-tags"
              value={draft.targetTag || ''}
              onChange={(e) =>
                onPatch({ targetTag: e.target.value.replace(/^#/, '') })
              }
              placeholder="ex: joueur, balle..."
              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="impulse-target-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Mode d'application */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Application</span>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              onClick={() => onPatch({ impulseApplyMode: 'add' })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                applyMode === 'add'
                  ? 'bg-orange-600 text-white border-orange-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-orange-50'
              }`}
            >
              + Ajouter à la vitesse
            </button>
            <button
              type="button"
              onClick={() => onPatch({ impulseApplyMode: 'set' })}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border cursor-pointer transition-colors ${
                applyMode === 'set'
                  ? 'bg-orange-600 text-white border-orange-700'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-orange-50'
              }`}
            >
              = Fixer la vitesse
            </button>
          </div>
        </div>

        {/* Puissance */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 text-xs">Force / Puissance</span>
            <EditableNumericValue
              value={strength}
              unit="px/s"
              precision={1}
              onChange={(v) => onPatch({ impulseStrength: v })}
              className="font-mono tabular-nums font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-xs cursor-text"
            />
          </div>
          <input
            type="range"
            min="0"
            max="1200"
            step="25"
            value={Math.max(0, Math.min(1200, strength))}
            onChange={(e) => onPatch({ impulseStrength: parseFloat(e.target.value) })}
            className="w-full accent-orange-600"
          />
        </div>

        {/* Direction */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Direction</span>
          <select
            value={dirMode}
            onChange={(e) => onPatch({ impulseDirectionMode: e.target.value as any })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            <option value="cardinal">Cardinale (↑ Haut / ↓ Bas / ← / →)</option>
            <option value="angle">Angle libre (degrés °)</option>
            <option value="facing">Direction du regard / rotation</option>
            <option value="toward_target">Vers une cible / souris</option>
            <option value="away_target">À l'opposé (repousser)</option>
          </select>
        </div>

        {dirMode === 'cardinal' && (
          <div className="grid grid-cols-4 gap-1.5 bg-white p-2 rounded-xl border border-slate-200">
            {(
              [
                { id: 'left', label: '← Gauche' },
                { id: 'right', label: '→ Droite' },
                { id: 'up', label: '↑ Haut' },
                { id: 'down', label: '↓ Bas' },
              ] as const
            ).map((dir) => (
              <button
                key={dir.id}
                type="button"
                onClick={() => onPatch({ impulseCardinal: dir.id })}
                className={`py-1.5 rounded-lg text-[11px] font-bold border cursor-pointer transition-all ${
                  cardinal === dir.id
                    ? 'bg-orange-600 text-white border-orange-700 shadow-2xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        )}

        {dirMode === 'angle' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700 text-xs">Angle de poussée</span>
              <EditableNumericValue
                value={angle}
                unit="°"
                precision={1}
                onChange={(v) => onPatch({ impulseAngle: v })}
                className="font-mono tabular-nums font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-xs cursor-text"
              />
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.max(-180, Math.min(180, angle))}
              onChange={(e) => onPatch({ impulseAngle: parseFloat(e.target.value) })}
              className="w-full accent-orange-600"
            />
          </div>
        )}

        {(dirMode === 'toward_target' || dirMode === 'away_target') && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Référence directionnelle</span>
              <select
                value={refMode}
                onChange={(e) => onPatch({ impulseTargetMode: e.target.value as any })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                {!isGlobal && <option value="subject">Sujet</option>}
                {isRelational && <option value="target">Cible touchée</option>}
                <option value="last_spawned">Dernier objet créé</option>
                <option value="mouse">Souris (curseur)</option>
                <option value="entity">Instance précise</option>
                <option value="type">Par Type</option>
                <option value="tag">Par Tag (#tag)</option>
              </select>
            </div>
            {refMode === 'entity' && (
              <select
                value={draft.impulseTargetEntityId || firstEntityId}
                onChange={(e) => onPatch({ impulseTargetEntityId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                {entityList.map((ent) => (
                  <option key={ent.id} value={ent.id}>
                    {ent.name}
                  </option>
                ))}
              </select>
            )}
            {refMode === 'type' && (
              <select
                value={draft.impulseTargetEntityType || firstEntityType}
                onChange={(e) => onPatch({ impulseTargetEntityType: e.target.value })}
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              >
                {availableEntityOptions.map((opt) => (
                  <option key={opt.type} value={opt.type}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
            {refMode === 'tag' && (
              <input
                type="text"
                list="impulse-ref-tags"
                value={draft.impulseTargetTag || ''}
                onChange={(e) =>
                  onPatch({ impulseTargetTag: e.target.value.replace(/^#/, '') })
                }
                placeholder="ex: joueur"
                className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              />
            )}
            <datalist id="impulse-ref-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Impulsion angulaire optionnelle */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-700 text-xs">
              Effet de rotation (Spin / Couple)
            </span>
            <EditableNumericValue
              value={angular}
              unit="°/s"
              precision={1}
              onChange={(v) => onPatch({ impulseAngular: v })}
              className="font-mono tabular-nums font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 px-1.5 py-0.5 rounded text-xs cursor-text"
            />
          </div>
          <input
            type="range"
            min="-720"
            max="720"
            step="15"
            value={Math.max(-720, Math.min(720, angular))}
            onChange={(e) => onPatch({ impulseAngular: parseFloat(e.target.value) })}
            className="w-full accent-orange-600"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onConfirm({
            type: 'apply_impulse',
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
            impulseStrength: strength,
            impulseApplyMode: applyMode,
            impulseDirectionMode: dirMode,
            impulseCardinal: dirMode === 'cardinal' ? cardinal : undefined,
            impulseAngle: dirMode === 'angle' ? angle : undefined,
            impulseTargetMode:
              dirMode === 'toward_target' || dirMode === 'away_target'
                ? refMode
                : undefined,
            impulseTargetEntityId:
              (dirMode === 'toward_target' || dirMode === 'away_target') &&
              refMode === 'entity'
                ? draft.impulseTargetEntityId || firstEntityId
                : undefined,
            impulseTargetEntityType:
              (dirMode === 'toward_target' || dirMode === 'away_target') &&
              refMode === 'type'
                ? draft.impulseTargetEntityType || firstEntityType
                : undefined,
            impulseTargetTag:
              (dirMode === 'toward_target' || dirMode === 'away_target') &&
              refMode === 'tag'
                ? (draft.impulseTargetTag || '').trim().replace(/^#/, '')
                : undefined,
            impulseAngular: angular,
          });
        }}
        className="w-full py-3 bg-orange-600 hover:bg-orange-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider l'impulsion physique</span>
      </button>
    </div>
  );
};
