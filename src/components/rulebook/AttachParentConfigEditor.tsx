import React from 'react';
import { Check } from 'lucide-react';
import { ActionTargetMode, Entity, EntityType, ParentOffset, RuleAction } from '../../types';
import { ParentOffsetFieldsEditor } from '../shared/ParentOffsetFieldsEditor';
import { EntityOption, formatRoleLabel } from './ruleBookTypes';

export interface AttachParentConfigDraft {
  parentChildMode?: ActionTargetMode;
  parentChildId?: string;
  parentChildType?: EntityType;
  parentChildTag?: string;
  parentTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  parentEntityId?: string;
  parentEntityType?: EntityType;
  parentEntityTag?: string;
  parentOffset?: ParentOffset;
  attachKeepCurrentOffset?: boolean;
  attachDisableCollisions?: boolean;
}

interface AttachParentConfigEditorProps {
  draft: AttachParentConfigDraft;
  onPatch: (patch: Partial<AttachParentConfigDraft>) => void;
  onConfirm: (actionData: Omit<RuleAction, 'id'>) => void;
  isRelational: boolean;
  isGlobal?: boolean;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  subjectHint?: string;
  targetHint?: string;
}

export const AttachParentConfigEditor: React.FC<AttachParentConfigEditorProps> = ({
  draft,
  onPatch,
  onConfirm,
  isRelational,
  isGlobal = false,
  entities,
  availableEntityOptions,
  allProjectTags,
  subjectHint,
  targetHint,
}) => {
  const entityList = Object.values(entities);
  const firstEntityId = entityList[0]?.id || '';
  const firstEntityType = availableEntityOptions[0]?.type || '';

  const childMode: ActionTargetMode =
    draft.parentChildMode || (isGlobal ? 'instance' : 'subject');
  const parentMode =
    draft.parentTargetMode || (isRelational ? 'target' : 'entity');

  const disableCollisions = Boolean(
    draft.attachDisableCollisions ?? draft.parentOffset?.disableCollisionsWhileAttached
  );

  const effectiveOffset: ParentOffset = {
    x: draft.parentOffset?.x ?? 0,
    y: draft.parentOffset?.y ?? 0,
    rotationOffset: draft.parentOffset?.rotationOffset ?? 0,
    inheritRotation: draft.parentOffset?.inheritRotation !== false,
    inheritFlip: draft.parentOffset?.inheritFlip !== false,
    attachmentMode: draft.parentOffset?.attachmentMode || 'rigid',
    ...draft.parentOffset,
    disableCollisionsWhileAttached: disableCollisions,
  };

  const parentName =
    parentMode === 'entity'
      ? entities[draft.parentEntityId || firstEntityId]?.name
      : parentMode === 'type'
      ? availableEntityOptions.find(
          (o) => o.type === (draft.parentEntityType || firstEntityType)
        )?.label
      : parentMode === 'tag' && draft.parentEntityTag
      ? `#${draft.parentEntityTag}`
      : undefined;

  const handleOffsetChange = (patch: Partial<ParentOffset>) => {
    const nextOffset: ParentOffset = {
      ...effectiveOffset,
      ...patch,
    };
    const nextDisable =
      patch.disableCollisionsWhileAttached !== undefined
        ? patch.disableCollisionsWhileAttached
        : disableCollisions;

    onPatch({
      parentOffset: nextOffset,
      attachDisableCollisions: nextDisable,
    });
  };

  return (
    <div className="space-y-4 max-w-xl mx-auto py-2">
      <div className="space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
        {/* Objet enfant */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Objet enfant à attacher</span>
          <select
            value={childMode}
            onChange={(e) => onPatch({ parentChildMode: e.target.value as ActionTargetMode })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {!isGlobal && <option value="subject">{formatRoleLabel('Sujet', subjectHint)}</option>}
            {isRelational && <option value="target">{formatRoleLabel('Cible touchée', targetHint)}</option>}
            <option value="last_spawned">Dernier objet créé</option>
            <option value="instance">Entité de la scène</option>
            <option value="type">Par Type</option>
            <option value="tag">Par Tag (#tag)</option>
          </select>
        </div>

        {childMode === 'instance' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Choisir l'enfant</span>
            <select
              value={draft.parentChildId || firstEntityId}
              onChange={(e) => onPatch({ parentChildId: e.target.value })}
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

        {childMode === 'type' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Type enfant</span>
            <select
              value={draft.parentChildType || firstEntityType}
              onChange={(e) => onPatch({ parentChildType: e.target.value })}
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

        {childMode === 'tag' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Tag enfant</span>
            <input
              type="text"
              list="attach-child-tags"
              value={draft.parentChildTag || ''}
              onChange={(e) =>
                onPatch({ parentChildTag: e.target.value.replace(/^#/, '') })
              }
              placeholder="ex: arme"
              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="attach-child-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Objet parent */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Objet parent (Porteur)</span>
          <select
            value={parentMode}
            onChange={(e) => onPatch({ parentTargetMode: e.target.value as any })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {!isGlobal && <option value="subject">{formatRoleLabel('Sujet', subjectHint)}</option>}
            {isRelational && <option value="target">{formatRoleLabel('Cible touchée', targetHint)}</option>}
            <option value="entity">Entité de la scène</option>
            <option value="type">Par Type</option>
            <option value="tag">Par Tag (#tag)</option>
            <option value="last_spawned">Dernier objet créé</option>
          </select>
        </div>

        {parentMode === 'entity' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Choisir parent</span>
            <select
              value={draft.parentEntityId || firstEntityId}
              onChange={(e) => onPatch({ parentEntityId: e.target.value })}
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

        {parentMode === 'type' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Type parent</span>
            <select
              value={draft.parentEntityType || firstEntityType}
              onChange={(e) => onPatch({ parentEntityType: e.target.value })}
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

        {parentMode === 'tag' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Tag parent</span>
            <input
              type="text"
              list="attach-parent-tags"
              value={draft.parentEntityTag || ''}
              onChange={(e) =>
                onPatch({ parentEntityTag: e.target.value.replace(/^#/, '') })
              }
              placeholder="ex: joueur"
              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="attach-parent-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Conserver le décalage actuel */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700 text-xs block">
              Conserver le décalage actuel
            </span>
            <span className="text-[10px] text-slate-400">
              Fige l’objet à sa position relative du moment (idéal pour attraper une balle en vol)
            </span>
          </div>
          <input
            type="checkbox"
            checked={Boolean(draft.attachKeepCurrentOffset)}
            onChange={(e) => onPatch({ attachKeepCurrentOffset: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
          />
        </div>

        {/* Configuration complète du mode d'attache (Rigide / Ressort / Joint Physique, Break Joint, etc.) */}
        <ParentOffsetFieldsEditor
          offset={effectiveOffset}
          onChange={handleOffsetChange}
          parentName={parentName}
          showOffsets={!draft.attachKeepCurrentOffset}
          showDisableCollisionsOption={true}
          compact={true}
        />
      </div>

      <button
        type="button"
        onClick={() => {
          onConfirm({
            type: 'attach_to_parent',
            targetMode: childMode,
            targetId:
              childMode === 'instance' ? draft.parentChildId || firstEntityId : undefined,
            targetType:
              childMode === 'type' ? draft.parentChildType || firstEntityType : undefined,
            targetTag:
              childMode === 'tag'
                ? (draft.parentChildTag || '').trim().replace(/^#/, '')
                : undefined,
            parentTargetMode: parentMode,
            parentEntityId:
              parentMode === 'entity' ? draft.parentEntityId || firstEntityId : undefined,
            parentEntityType:
              parentMode === 'type' ? draft.parentEntityType || firstEntityType : undefined,
            parentEntityTag:
              parentMode === 'tag'
                ? (draft.parentEntityTag || '').trim().replace(/^#/, '')
                : undefined,
            parentOffset: effectiveOffset,
            attachKeepCurrentOffset: Boolean(draft.attachKeepCurrentOffset),
            attachDisableCollisions: disableCollisions,
          });
        }}
        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider l'attachement</span>
      </button>
    </div>
  );
};
