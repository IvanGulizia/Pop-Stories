import React, { useEffect, useId } from 'react';
import { Check, Crosshair, Magnet, Unlink } from 'lucide-react';
import {
  ActionTargetMode,
  Entity,
  EntityId,
  EntityType,
  ParentOffset,
  Position,
  RuleAction,
  SnapAlignmentMode,
  SnapAnchorPreset,
  SnapAttachBehavior,
} from '../../types';
import { useSceneStore } from '../../store/useSceneStore';
import { EntityOption, formatRoleLabel } from './ruleBookTypes';
import { SnapJointConfigFields } from '../shared/SnapJointConfigFields';

const ANCHOR_OPTIONS: { value: SnapAnchorPreset; label: string }[] = [
  { value: 'center', label: 'Centre' },
  { value: 'pivot', label: 'Point de Pivot' },
  { value: 'custom_canvas', label: 'Repère personnalisé' },
  { value: 'top', label: 'Haut' },
  { value: 'bottom', label: 'Bas' },
  { value: 'left', label: 'Gauche' },
  { value: 'right', label: 'Droite' },
  { value: 'top_left', label: 'Haut-Gauche' },
  { value: 'top_right', label: 'Haut-Droite' },
  { value: 'bottom_left', label: 'Bas-Gauche' },
  { value: 'bottom_right', label: 'Bas-Droite' },
];

export interface SnapActionConfigDraft {
  targetMode?: ActionTargetMode;
  targetId?: EntityId;
  targetType?: EntityType;
  targetTag?: string;
  snapTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'any';
  snapTargetEntityId?: EntityId;
  snapTargetEntityType?: EntityType;
  snapTargetTag?: string;
  snapAlignment?: SnapAlignmentMode;
  snapSourceAnchor?: SnapAnchorPreset;
  snapTargetAnchor?: SnapAnchorPreset;
  snapCustomSourceAnchor?: Position;
  snapCustomTargetAnchor?: Position;
  snapOffsetX?: number;
  snapOffsetY?: number;
  snapMatchRotation?: boolean;
  snapRotationOffset?: number;
  snapAttachBehavior?: SnapAttachBehavior;
  snapJointConfig?: Partial<ParentOffset>;
  unsnapImpulseSpeed?: number;
  unsnapImpulseAngle?: number;
  unsnapCooldownSec?: number;
}

interface SnapActionConfigEditorProps {
  mode: 'snap_to' | 'unsnap';
  draft: SnapActionConfigDraft;
  onPatch: (patch: Partial<SnapActionConfigDraft>) => void;
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

export const SnapActionConfigEditor: React.FC<SnapActionConfigEditorProps> = ({
  mode,
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
  const pickerRequestId = useId();
  const startSnapPinCanvasPick = useSceneStore((s) => s.startSnapPinCanvasPick);
  const snapPinCanvasPickResult = useSceneStore((s) => s.snapPinCanvasPickResult);
  const clearSnapPinCanvasPickResult = useSceneStore((s) => s.clearSnapPinCanvasPickResult);

  const entityList = Object.values(entities);
  const firstEntityId = entityList[0]?.id || '';
  const firstEntityType = availableEntityOptions[0]?.type || '';

  const tMode: ActionTargetMode = draft.targetMode || (isGlobal ? 'instance' : 'subject');
  const snapTargetMode = draft.snapTargetMode || (isRelational ? 'target' : 'entity');
  const alignment: SnapAlignmentMode = draft.snapAlignment || 'center';
  const attachBehavior: SnapAttachBehavior = draft.snapAttachBehavior || 'parent_rigid';
  const unsnapImpulseSpeed = draft.unsnapImpulseSpeed ?? 0;
  const unsnapImpulseAngle = draft.unsnapImpulseAngle ?? -45;
  const unsnapCooldownSec = draft.unsnapCooldownSec ?? 0.35;

  const resolveSourceTargetType = (): EntityType | undefined => {
    if (tMode === 'type') return draft.targetType || firstEntityType;
    if (tMode === 'target') return targetType;
    if (tMode === 'subject') return subjectType;
    return undefined;
  };

  const resolvedSourceEntityId = React.useMemo(() => {
    if (tMode === 'instance') {
      return (draft.targetId && entities[draft.targetId]) ? draft.targetId : firstEntityId || undefined;
    }
    if (tMode === 'subject') {
      return entityList.find((e) => e.type === subjectType)?.id || firstEntityId || undefined;
    }
    if (tMode === 'target') {
      return entityList.find((e) => e.type === targetType)?.id || firstEntityId || undefined;
    }
    if (tMode === 'type') {
      const tt = draft.targetType || firstEntityType;
      return entityList.find((e) => e.type === tt)?.id;
    }
    if (tMode === 'tag' && draft.targetTag) {
      const clean = draft.targetTag.trim().replace(/^#/, '').toLowerCase();
      return entityList.find((e) =>
        (e.tags || []).some((t) => t.trim().replace(/^#/, '').toLowerCase() === clean)
      )?.id;
    }
    return undefined;
  }, [tMode, draft.targetId, draft.targetType, draft.targetTag, subjectType, targetType, entities, entityList, firstEntityId, firstEntityType]);

  const resolvedTargetEntityId = React.useMemo(() => {
    if (snapTargetMode === 'entity') {
      return (draft.snapTargetEntityId && entities[draft.snapTargetEntityId])
        ? draft.snapTargetEntityId
        : firstEntityId || undefined;
    }
    if (snapTargetMode === 'subject') {
      return entityList.find((e) => e.type === subjectType)?.id || firstEntityId || undefined;
    }
    if (snapTargetMode === 'target') {
      return entityList.find((e) => e.type === targetType)?.id || firstEntityId || undefined;
    }
    if (snapTargetMode === 'type') {
      const tt = draft.snapTargetEntityType || firstEntityType;
      return entityList.find((e) => e.type === tt)?.id;
    }
    if (snapTargetMode === 'tag' && draft.snapTargetTag) {
      const clean = draft.snapTargetTag.trim().replace(/^#/, '').toLowerCase();
      return entityList.find((e) =>
        (e.tags || []).some((t) => t.trim().replace(/^#/, '').toLowerCase() === clean)
      )?.id;
    }
    return undefined;
  }, [snapTargetMode, draft.snapTargetEntityId, draft.snapTargetEntityType, draft.snapTargetTag, subjectType, targetType, entities, entityList, firstEntityId, firstEntityType]);

  useEffect(() => {
    if (!snapPinCanvasPickResult || snapPinCanvasPickResult.requestId !== pickerRequestId) {
      return;
    }
    if (snapPinCanvasPickResult.pinRole === 'source') {
      onPatch({
        snapAlignment: 'anchor_offset',
        snapSourceAnchor: 'custom_canvas',
        snapCustomSourceAnchor: snapPinCanvasPickResult.anchor,
      });
    } else {
      onPatch({
        snapAlignment: 'anchor_offset',
        snapTargetAnchor: 'custom_canvas',
        snapCustomTargetAnchor: snapPinCanvasPickResult.anchor,
      });
    }
    clearSnapPinCanvasPickResult();
  }, [snapPinCanvasPickResult, pickerRequestId, onPatch, clearSnapPinCanvasPickResult]);

  const handleLaunchCanvasPin = (pinRole: 'source' | 'target') => {
    const refId = pinRole === 'source' ? resolvedSourceEntityId : resolvedTargetEntityId;
    if (!refId) return;
    if (pinRole === 'source') {
      onPatch({
        snapAlignment: 'anchor_offset',
        snapSourceAnchor: 'custom_canvas',
        ...(draft.snapCustomSourceAnchor ? {} : { snapCustomSourceAnchor: { x: 0.5, y: 0.5 } }),
      });
    } else {
      onPatch({
        snapAlignment: 'anchor_offset',
        snapTargetAnchor: 'custom_canvas',
        ...(draft.snapCustomTargetAnchor ? {} : { snapCustomTargetAnchor: { x: 0.5, y: 0.5 } }),
      });
    }
    startSnapPinCanvasPick({
      requestId: pickerRequestId,
      pinRole,
      referenceEntityId: refId,
    });
  };

  if (mode === 'unsnap') {
    return (
      <div className="space-y-4 max-w-xl mx-auto py-2">
        <div className="text-center space-y-1">
          <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <Unlink className="w-6 h-6" />
          </div>
          <h4 className="text-sm font-black text-slate-800">Désaimanter (Unsnap)</h4>
          <p className="text-xs text-slate-500">
            Détache l&apos;objet de sa cible magnétique avec un délai anti-recollage et une impulsion optionnelle.
          </p>
        </div>

        <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Objet à désaimanter</span>
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
              <span className="font-bold text-slate-700 text-xs">Choisir l&apos;entité</span>
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
              <span className="font-bold text-slate-700 text-xs">Type à désaimanter</span>
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
                list="unsnap-target-tags"
                value={draft.targetTag || ''}
                onChange={(e) => onPatch({ targetTag: e.target.value.replace(/^#/, '') })}
                placeholder="ex: bloc, cle..."
                className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
              />
              <datalist id="unsnap-target-tags">
                {allProjectTags.map((t) => (
                  <option key={t} value={t} />
                ))}
              </datalist>
            </div>
          )}

          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Délai anti-recollage (s)</span>
            <input
              type="number"
              step="any"
              value={unsnapCooldownSec}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) {
                  onPatch({ unsnapCooldownSec: v });
                }
              }}
              className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
            />
          </div>

          <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">
                Impulsion d&apos;éjection (optionnelle, px/s)
              </span>
              <input
                type="number"
                step="any"
                value={unsnapImpulseSpeed}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) {
                    onPatch({ unsnapImpulseSpeed: v });
                  }
                }}
                className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
              />
            </div>

            {unsnapImpulseSpeed > 0 && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
                <span className="font-bold text-slate-700 text-[11px]">Angle d&apos;éjection (°)</span>
                <div className="flex items-center gap-1 flex-wrap justify-end">
                  {[
                    { label: '↑ -90°', val: -90 },
                    { label: '↗ -45°', val: -45 },
                    { label: '→ 0°', val: 0 },
                    { label: '← 180°', val: 180 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      onClick={() => onPatch({ unsnapImpulseAngle: p.val })}
                      className={`px-2 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                        unsnapImpulseAngle === p.val
                          ? 'bg-cyan-600 text-white border-cyan-700'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-cyan-50'
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    step="any"
                    value={unsnapImpulseAngle}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isFinite(v)) {
                        onPatch({ unsnapImpulseAngle: v });
                      }
                    }}
                    className="w-16 bg-slate-50 border border-slate-300 rounded px-1.5 py-0.5 text-[11px] font-mono text-right"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            onConfirm({
              type: 'unsnap',
              targetMode: tMode,
              targetId: tMode === 'instance' ? draft.targetId || firstEntityId : undefined,
              targetType: resolveSourceTargetType(),
              targetTag:
                tMode === 'tag'
                  ? (draft.targetTag || '').trim().replace(/^#/, '')
                  : undefined,
              unsnapCooldownSec,
              unsnapImpulseSpeed: unsnapImpulseSpeed > 0 ? unsnapImpulseSpeed : undefined,
              unsnapImpulseAngle: unsnapImpulseSpeed > 0 ? unsnapImpulseAngle : undefined,
            });
          }}
          className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
        >
          <Check className="w-4 h-4" />
          <span>Valider le désaimantage</span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-xl mx-auto py-2">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
          <Magnet className="w-6 h-6" />
        </div>
        <h4 className="text-sm font-black text-slate-800">Aimanter vers une Cible (Snap)</h4>
        <p className="text-xs text-slate-500">
          Aligne et colle instantanément un objet sur une cible ou un socle avec la liaison choisie.
        </p>
      </div>

      <div className="space-y-2 bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
        {/* Objet à aimanter */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Objet à aimanter</span>
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
            <span className="font-bold text-slate-700 text-xs">Choisir l&apos;objet</span>
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
            <span className="font-bold text-slate-700 text-xs">Type à aimanter</span>
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
            <span className="font-bold text-slate-700 text-xs">Tag objet (#tag)</span>
            <input
              type="text"
              list="snap-source-tags"
              value={draft.targetTag || ''}
              onChange={(e) => onPatch({ targetTag: e.target.value.replace(/^#/, '') })}
              placeholder="ex: piece, objet..."
              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="snap-source-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Cible de l'aimant */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Cible d&apos;aimantation (Socle)</span>
          <select
            value={snapTargetMode}
            onChange={(e) => onPatch({ snapTargetMode: e.target.value as any })}
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

        {snapTargetMode === 'entity' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Choisir la cible</span>
            <select
              value={draft.snapTargetEntityId || firstEntityId}
              onChange={(e) => onPatch({ snapTargetEntityId: e.target.value })}
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

        {snapTargetMode === 'type' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Type cible</span>
            <select
              value={draft.snapTargetEntityType || firstEntityType}
              onChange={(e) => onPatch({ snapTargetEntityType: e.target.value })}
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

        {snapTargetMode === 'tag' && (
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Tag cible</span>
            <input
              type="text"
              list="snap-target-tags"
              value={draft.snapTargetTag || ''}
              onChange={(e) => onPatch({ snapTargetTag: e.target.value.replace(/^#/, '') })}
              placeholder="ex: socle, slot..."
              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id="snap-target-tags">
              {allProjectTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        )}

        {/* Alignement & Ancres */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Alignement</span>
            <select
              value={alignment}
              onChange={(e) => onPatch({ snapAlignment: e.target.value as SnapAlignmentMode })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="center">Centre sur centre</option>
              <option value="anchor_offset">Par points d&apos;ancrage</option>
              <option value="edge_closest">Bord le plus proche</option>
            </select>
          </div>

          {alignment !== 'anchor_offset' && (
            <div className="p-2 bg-cyan-50/70 rounded-xl border border-cyan-200/80 space-y-1.5">
              <div className="text-[10px] font-bold text-cyan-900 flex items-center gap-1">
                <Crosshair className="w-3 h-3" />
                <span>Repère direct sur le canvas</span>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={!resolvedSourceEntityId}
                  onClick={() => handleLaunchCanvasPin('source')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                    resolvedSourceEntityId
                      ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-2xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Crosshair className="w-3 h-3 shrink-0" />
                  <span>Placer repère objet</span>
                </button>
                <button
                  type="button"
                  disabled={!resolvedTargetEntityId}
                  onClick={() => handleLaunchCanvasPin('target')}
                  className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                    resolvedTargetEntityId
                      ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs'
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <Crosshair className="w-3 h-3 shrink-0" />
                  <span>Placer repère cible</span>
                </button>
              </div>
            </div>
          )}

          {alignment === 'anchor_offset' && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Ancre objet</span>
                  <select
                    value={draft.snapSourceAnchor || 'center'}
                    onChange={(e) => {
                      const next = e.target.value as SnapAnchorPreset;
                      onPatch({
                        snapSourceAnchor: next,
                        ...(next === 'custom_canvas' && !draft.snapCustomSourceAnchor
                          ? { snapCustomSourceAnchor: { x: 0.5, y: 0.5 } }
                          : {}),
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {ANCHOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Ancre cible</span>
                  <select
                    value={draft.snapTargetAnchor || 'center'}
                    onChange={(e) => {
                      const next = e.target.value as SnapAnchorPreset;
                      onPatch({
                        snapTargetAnchor: next,
                        ...(next === 'custom_canvas' && !draft.snapCustomTargetAnchor
                          ? { snapCustomTargetAnchor: { x: 0.5, y: 0.5 } }
                          : {}),
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                  >
                    {ANCHOR_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {draft.snapSourceAnchor === 'custom_canvas' && (
                <div className="p-2 bg-cyan-50/70 rounded-xl border border-cyan-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-cyan-900">Repère objet (0..1)</span>
                    <button
                      type="button"
                      disabled={!resolvedSourceEntityId}
                      onClick={() => handleLaunchCanvasPin('source')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                        resolvedSourceEntityId
                          ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-2xs'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Placer sur le canvas</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-[10px] font-bold text-cyan-900">X</span>
                      <input
                        type="number"
                        step="any"
                        value={draft.snapCustomSourceAnchor?.x ?? 0.5}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            onPatch({
                              snapCustomSourceAnchor: {
                                x: v,
                                y: draft.snapCustomSourceAnchor?.y ?? 0.5,
                              },
                            });
                          }
                        }}
                        className="w-16 bg-white border border-cyan-200 rounded px-1.5 py-0.5 font-mono font-bold text-right text-slate-800"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-[10px] font-bold text-cyan-900">Y</span>
                      <input
                        type="number"
                        step="any"
                        value={draft.snapCustomSourceAnchor?.y ?? 0.5}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            onPatch({
                              snapCustomSourceAnchor: {
                                x: draft.snapCustomSourceAnchor?.x ?? 0.5,
                                y: v,
                              },
                            });
                          }
                        }}
                        className="w-16 bg-white border border-cyan-200 rounded px-1.5 py-0.5 font-mono font-bold text-right text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}

              {draft.snapTargetAnchor === 'custom_canvas' && (
                <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold text-indigo-900">Repère cible (0..1)</span>
                    <button
                      type="button"
                      disabled={!resolvedTargetEntityId}
                      onClick={() => handleLaunchCanvasPin('target')}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                        resolvedTargetEntityId
                          ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs'
                          : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span>Placer sur le canvas</span>
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-[10px] font-bold text-indigo-900">X</span>
                      <input
                        type="number"
                        step="any"
                        value={draft.snapCustomTargetAnchor?.x ?? 0.5}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            onPatch({
                              snapCustomTargetAnchor: {
                                x: v,
                                y: draft.snapCustomTargetAnchor?.y ?? 0.5,
                              },
                            });
                          }
                        }}
                        className="w-16 bg-white border border-indigo-200 rounded px-1.5 py-0.5 font-mono font-bold text-right text-slate-800"
                      />
                    </div>
                    <div className="flex items-center justify-between gap-1 text-xs">
                      <span className="text-[10px] font-bold text-indigo-900">Y</span>
                      <input
                        type="number"
                        step="any"
                        value={draft.snapCustomTargetAnchor?.y ?? 0.5}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (Number.isFinite(v)) {
                            onPatch({
                              snapCustomTargetAnchor: {
                                x: draft.snapCustomTargetAnchor?.x ?? 0.5,
                                y: v,
                              },
                            });
                          }
                        }}
                        className="w-16 bg-white border border-indigo-200 rounded px-1.5 py-0.5 font-mono font-bold text-right text-slate-800"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500">Décalage X (px)</span>
              <input
                type="number"
                step="any"
                value={draft.snapOffsetX ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) onPatch({ snapOffsetX: v });
                }}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500">Décalage Y (px)</span>
              <input
                type="number"
                step="any"
                value={draft.snapOffsetY ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) onPatch({ snapOffsetY: v });
                }}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="text-xs font-bold text-slate-700">Aligner la rotation sur la cible</span>
            <input
              type="checkbox"
              checked={Boolean(draft.snapMatchRotation)}
              onChange={(e) => onPatch({ snapMatchRotation: e.target.checked })}
              className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
            />
          </div>

          {draft.snapMatchRotation && (
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500">Décalage angle (°)</span>
              <input
                type="number"
                step="any"
                value={draft.snapRotationOffset ?? 0}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) onPatch({ snapRotationOffset: v });
                }}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-slate-800"
              />
            </div>
          )}
        </div>

        {/* Liaison après snap */}
        <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Liaison après snap</span>
            <select
              value={attachBehavior}
              onChange={(e) => onPatch({ snapAttachBehavior: e.target.value as SnapAttachBehavior })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="parent_rigid">Parenter solidement</option>
              <option value="parent_spring">Parenter avec ressort</option>
              <option value="parent_physics_joint">Parenter avec Joint Physique (Break Joint)</option>
              <option value="bidirectional_joint">Joint bidirectionnel (sans parentage)</option>
              <option value="position_only">Placer uniquement</option>
              <option value="freeze_physics">Poser et figer la physique</option>
            </select>
          </div>

          {attachBehavior === 'parent_physics_joint' && (
            <SnapJointConfigFields
              config={draft.snapJointConfig || {}}
              onChange={(patch) =>
                onPatch({
                  snapJointConfig: {
                    ...(draft.snapJointConfig || {}),
                    ...patch,
                  },
                })
              }
            />
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          onConfirm({
            type: 'snap_to',
            targetMode: tMode,
            targetId: tMode === 'instance' ? draft.targetId || firstEntityId : undefined,
            targetType: resolveSourceTargetType(),
            targetTag:
              tMode === 'tag'
                ? (draft.targetTag || '').trim().replace(/^#/, '')
                : undefined,
            snapTargetMode,
            snapTargetEntityId:
              snapTargetMode === 'entity' ? draft.snapTargetEntityId || firstEntityId : undefined,
            snapTargetEntityType:
              snapTargetMode === 'type' ? draft.snapTargetEntityType || firstEntityType : undefined,
            snapTargetTag:
              snapTargetMode === 'tag'
                ? (draft.snapTargetTag || '').trim().replace(/^#/, '')
                : undefined,
            snapAlignment: alignment,
            snapSourceAnchor: alignment === 'anchor_offset' ? draft.snapSourceAnchor || 'center' : undefined,
            snapTargetAnchor: alignment === 'anchor_offset' ? draft.snapTargetAnchor || 'center' : undefined,
            snapCustomSourceAnchor:
              alignment === 'anchor_offset' && draft.snapSourceAnchor === 'custom_canvas'
                ? draft.snapCustomSourceAnchor || { x: 0.5, y: 0.5 }
                : undefined,
            snapCustomTargetAnchor:
              alignment === 'anchor_offset' && draft.snapTargetAnchor === 'custom_canvas'
                ? draft.snapCustomTargetAnchor || { x: 0.5, y: 0.5 }
                : undefined,
            snapOffsetX: draft.snapOffsetX ?? 0,
            snapOffsetY: draft.snapOffsetY ?? 0,
            snapMatchRotation: Boolean(draft.snapMatchRotation),
            snapRotationOffset: draft.snapMatchRotation ? draft.snapRotationOffset ?? 0 : 0,
            snapAttachBehavior: attachBehavior,
            snapJointConfig:
              attachBehavior === 'parent_physics_joint' ? draft.snapJointConfig : undefined,
          });
        }}
        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider l&apos;aimantation</span>
      </button>
    </div>
  );
};
