import React from 'react';
import { Crosshair, Magnet, Paintbrush, Plus } from 'lucide-react';
import {
  Entity,
  EntityState,
  SnapAlignmentMode,
  SnapAnchorPreset,
  SnapAnimationMode,
  SnapAttachBehavior,
  SnapBehaviorConfig,
  SnapRole,
  SnapTargetType,
  SnapTriggerMode,
} from '../../types';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import { EditableNumericValue } from '../shared/EditableNumericValue';
import { SnapJointConfigFields } from '../shared/SnapJointConfigFields';

const ANCHOR_OPTIONS: { value: SnapAnchorPreset; label: string }[] = [
  { value: 'center', label: 'Centre' },
  { value: 'pivot', label: 'Point de Pivot' },
  { value: 'custom_canvas', label: 'Repère sur canvas' },
  { value: 'top', label: 'Haut' },
  { value: 'bottom', label: 'Bas' },
  { value: 'left', label: 'Gauche' },
  { value: 'right', label: 'Droite' },
  { value: 'top_left', label: 'Haut-Gauche' },
  { value: 'top_right', label: 'Haut-Droite' },
  { value: 'bottom_left', label: 'Bas-Gauche' },
  { value: 'bottom_right', label: 'Bas-Droite' },
];

export function SnapBehaviorControls({
  b,
  update,
  entityId,
  behaviorId,
  stateId,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: SnapBehaviorConfig;
  update: (partial: Partial<SnapBehaviorConfig>) => void;
  entityId?: string;
  behaviorId?: string;
  stateId?: string;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  const sceneEntities = useSceneStore((s) => s.entities || EMPTY_RECORD);
  const startSnapPinCanvasPick = useSceneStore((s) => s.startSnapPinCanvasPick);

  const snapRole: SnapRole = b.snapRole || 'magnet_object';
  const isReceptacle = snapRole === 'receptacle';
  const targetType: SnapTargetType = b.targetType || 'any';
  const snapTrigger: SnapTriggerMode = b.snapTrigger || 'on_release';
  const snapMode: SnapAnimationMode = b.snapMode || 'magnetic_smooth';
  const snapAlignment: SnapAlignmentMode = b.snapAlignment || 'center';
  const attachBehavior: SnapAttachBehavior = b.attachBehavior || 'position_only';
  const radius = b.snapRadius ?? 48;
  const magnetRadius = Math.max(radius, b.magnetRadius ?? 120);
  const magnetForce = b.magnetForce ?? 260;
  const unsnapDist = b.unsnapDistance ?? Math.round(radius * 1.5);
  const allowPullUnsnap = b.allowPullUnsnap !== false;
  const reSnapCooldown = b.reSnapCooldownSec ?? 0.35;

  const canPickSourceOnCanvas = Boolean(entityId && behaviorId && sceneEntities[entityId]);

  const resolvedTargetEntityId = React.useMemo(() => {
    const candidates = Object.values(sceneEntities).filter((ent) => ent.id !== entityId);
    if (candidates.length === 0) return undefined;
    if (targetType === 'entity' && b.targetEntityId && sceneEntities[b.targetEntityId]) {
      return b.targetEntityId;
    }
    if (targetType === 'type' && b.targetEntityType) {
      return candidates.find((c) => c.type === b.targetEntityType)?.id;
    }
    if (targetType === 'tag' && b.targetTag) {
      const clean = b.targetTag.trim().replace(/^#/, '').toLowerCase();
      return candidates.find((c) =>
        (c.tags || []).some((t) => t.trim().replace(/^#/, '').toLowerCase() === clean)
      )?.id;
    }
    return candidates[0]?.id;
  }, [sceneEntities, entityId, targetType, b.targetEntityId, b.targetEntityType, b.targetTag]);

  const canPickTargetOnCanvas = Boolean(entityId && behaviorId && resolvedTargetEntityId);

  return (
    <div className="space-y-2.5">
      {/* 0. Rôle du Snap : Objet aimanté vs Réceptacle */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-700">Rôle de cet objet</span>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-0.5 text-[10px] font-bold">
            <button
              type="button"
              onClick={() => update({ snapRole: 'magnet_object' })}
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                !isReceptacle
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Objet aimanté
            </button>
            <button
              type="button"
              onClick={() =>
                update({
                  snapRole: 'receptacle',
                  maxCapacity: b.maxCapacity ?? 1,
                })
              }
              className={`px-2 py-1 rounded-md cursor-pointer transition-colors ${
                isReceptacle
                  ? 'bg-violet-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Réceptacle (Socle)
            </button>
          </div>
        </div>

        <div className="text-[10px] text-slate-500">
          {isReceptacle
            ? 'Attire et capture automatiquement les objets correspondants jusqu’à sa capacité max.'
            : 'Cet objet vient se coller automatiquement vers une cible ou un socle.'}
        </div>

        {isReceptacle && (
          <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-slate-100">
            <span className="text-[11px] font-bold text-violet-900">
              Capacité max (nb d&apos;objets)
            </span>
            <input
              type="number"
              step="any"
              value={b.maxCapacity ?? 1}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) {
                  update({ maxCapacity: Math.max(1, Math.round(v)) });
                }
              }}
              className="w-20 bg-violet-50 border border-violet-200 rounded-lg px-2 py-1 text-xs font-mono font-bold text-right text-violet-900"
            />
          </div>
        )}
      </div>

      {/* 1. Cible de l'aimant */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Magnet className="w-3.5 h-3.5 text-cyan-600" />
          <span>{isReceptacle ? 'Objets acceptés par le réceptacle' : "Cible d'aimantation"}</span>
        </div>

        <select
          value={targetType}
          onChange={(e) => update({ targetType: e.target.value as SnapTargetType })}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
        >
          <option value="any">N&apos;importe quel objet à portée</option>
          <option value="entity">Une instance précise</option>
          <option value="type">Un type d&apos;objet</option>
          <option value="tag">Un #Tag spécifique</option>
        </select>

        {targetType === 'entity' && (
          <select
            value={b.targetEntityId || ''}
            onChange={(e) => update({ targetEntityId: e.target.value || undefined })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="">-- Choisir l&apos;objet cible --</option>
            {targetEntityOptions.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
        )}

        {targetType === 'type' && (
          <select
            value={b.targetEntityType || ''}
            onChange={(e) => update({ targetEntityType: e.target.value || undefined })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="">-- Choisir un type --</option>
            {entityTypeOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.label}
              </option>
            ))}
          </select>
        )}

        {targetType === 'tag' && (
          <div className="space-y-1">
            <input
              type="text"
              value={b.targetTag || ''}
              onChange={(e) => update({ targetTag: e.target.value })}
              placeholder="ex: socle, slot, aimant..."
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
            />
            {availableTags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {availableTags.slice(0, 8).map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => update({ targetTag: tag })}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold border cursor-pointer ${
                      b.targetTag === tag
                        ? 'bg-cyan-600 text-white border-cyan-700'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-cyan-50'
                    }`}
                  >
                    #{tag}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* 2. Déclenchement, Zone de snap & Champ d'attraction magnétique */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Déclenchement</span>
            <select
              value={snapTrigger}
              onChange={(e) => update({ snapTrigger: e.target.value as SnapTriggerMode })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
            >
              <option value="on_release">Au relâcher</option>
              <option value="always_when_near">Dès qu&apos;il s&apos;approche</option>
            </select>
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Transition</span>
            <select
              value={snapMode}
              onChange={(e) => update({ snapMode: e.target.value as SnapAnimationMode })}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800"
            >
              <option value="magnetic_smooth">Glissement doux</option>
              <option value="instant">Instantané</option>
            </select>
          </div>
        </div>

        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
            <span className="font-bold">Rayon de capture (Snap)</span>
            <EditableNumericValue
              value={radius}
              unit="px"
              precision={0}
              onChange={(v) => update({ snapRadius: v })}
              className="font-mono font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
            />
          </div>
          <input
            type="range"
            min="8"
            max="220"
            step="2"
            value={Math.max(8, Math.min(220, radius))}
            onChange={(e) => update({ snapRadius: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-600"
          />
        </div>

        {snapMode === 'magnetic_smooth' && (
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
              <span className="font-bold">Vitesse d&apos;aspiration</span>
              <EditableNumericValue
                value={Math.round((b.smoothSpeed ?? 0.3) * 100)}
                unit="%"
                precision={0}
                onChange={(v) => update({ smoothSpeed: v / 100 })}
                className="font-mono font-bold text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded text-[11px] cursor-text tabular-nums"
              />
            </div>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={Math.max(0.05, Math.min(1, b.smoothSpeed ?? 0.3))}
              onChange={(e) => update({ smoothSpeed: parseFloat(e.target.value) })}
              className="w-full accent-cyan-600"
            />
          </div>
        )}

        {/* Champ d'attraction magnétique (#10) */}
        <div className="pt-2 border-t border-slate-100 space-y-2">
          <label className="flex items-center justify-between gap-2 cursor-pointer">
            <div>
              <div className="text-[11px] font-bold text-violet-900">
                Champ d&apos;attraction magnétique
              </div>
              <div className="text-[10px] text-slate-400">
                Attire doucement l&apos;objet avant d&apos;atteindre le snap
              </div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(b.magnetEnabled)}
              onChange={(e) =>
                update({
                  magnetEnabled: e.target.checked,
                  magnetRadius: b.magnetRadius ?? Math.max(radius + 40, 120),
                  magnetForce: b.magnetForce ?? 260,
                })
              }
              className="w-4 h-4 accent-violet-600 rounded cursor-pointer shrink-0"
            />
          </label>

          {b.magnetEnabled && (
            <div className="p-2 bg-violet-50/70 rounded-xl border border-violet-200/80 space-y-1.5">
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-bold">Rayon du champ magnétique</span>
                  <EditableNumericValue
                    value={magnetRadius}
                    unit="px"
                    precision={0}
                    onChange={(v) => update({ magnetRadius: v })}
                    className="font-mono font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min={Math.max(16, Math.round(radius))}
                  max="420"
                  step="5"
                  value={Math.max(radius, Math.min(420, magnetRadius))}
                  onChange={(e) => update({ magnetRadius: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-bold">Force d&apos;attraction</span>
                  <EditableNumericValue
                    value={magnetForce}
                    unit="px/s"
                    precision={0}
                    onChange={(v) => update({ magnetForce: v })}
                    className="font-mono font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded cursor-text tabular-nums"
                  />
                </div>
                <input
                  type="range"
                  min="20"
                  max="800"
                  step="10"
                  value={Math.max(20, Math.min(800, magnetForce))}
                  onChange={(e) => update({ magnetForce: parseInt(e.target.value, 10) })}
                  className="w-full accent-violet-600"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 3. Alignement & Ancre */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Alignement sur cible</span>
          <select
            value={snapAlignment}
            onChange={(e) => update({ snapAlignment: e.target.value as SnapAlignmentMode })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800"
          >
            <option value="center">Centre sur centre</option>
            <option value="anchor_offset">Par points d&apos;ancrage (Pivot / Repère canvas / Côtés…)</option>
            <option value="edge_closest">Bord le plus proche (aimant bord à bord)</option>
          </select>
        </div>

        {snapAlignment === 'center' && (
          <div className="p-2 bg-cyan-50/70 rounded-xl border border-cyan-200/80 space-y-1.5">
            <div className="text-[10px] font-bold text-cyan-900 flex items-center gap-1">
              <Crosshair className="w-3 h-3" />
              <span>Repère direct sur le canvas (tige, slot, bord…)</span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                type="button"
                disabled={!canPickSourceOnCanvas}
                onClick={() => {
                  if (!entityId || !behaviorId) return;
                  update({
                    snapAlignment: 'anchor_offset',
                    sourceAnchor: 'custom_canvas',
                    ...(b.customSourceAnchor ? {} : { customSourceAnchor: { x: 0.5, y: 0.5 } }),
                  });
                  startSnapPinCanvasPick({
                    entityId,
                    behaviorId,
                    stateId,
                    pinRole: 'source',
                    referenceEntityId: entityId,
                  });
                }}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  canPickSourceOnCanvas
                    ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-2xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={
                  canPickSourceOnCanvas
                    ? 'Passer en repère canvas et cliquer le point exact sur cet objet'
                    : 'Disponible sur une instance placée dans la scène'
                }
              >
                <Crosshair className="w-3 h-3 shrink-0" />
                <span className="truncate">{isReceptacle ? 'Repère réceptacle' : 'Repère objet'}</span>
              </button>
              <button
                type="button"
                disabled={!canPickTargetOnCanvas}
                onClick={() => {
                  if (!entityId || !behaviorId || !resolvedTargetEntityId) return;
                  update({
                    snapAlignment: 'anchor_offset',
                    targetAnchor: 'custom_canvas',
                    ...(b.customTargetAnchor ? {} : { customTargetAnchor: { x: 0.5, y: 0.5 } }),
                  });
                  startSnapPinCanvasPick({
                    entityId,
                    behaviorId,
                    stateId,
                    pinRole: 'target',
                    referenceEntityId: resolvedTargetEntityId,
                  });
                }}
                className={`px-2 py-1.5 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                  canPickTargetOnCanvas
                    ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
                title={
                  canPickTargetOnCanvas
                    ? `Passer en repère canvas et cliquer sur la cible (${sceneEntities[resolvedTargetEntityId!]?.name})`
                    : 'Aucune entité cible correspondante trouvée sur la scène'
                }
              >
                <Crosshair className="w-3 h-3 shrink-0" />
                <span className="truncate">{isReceptacle ? 'Repère capturé' : 'Repère cible'}</span>
              </button>
            </div>
          </div>
        )}

        {snapAlignment !== 'center' && snapAlignment !== 'anchor_offset' && (
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={!canPickSourceOnCanvas}
              onClick={() => {
                if (!entityId || !behaviorId) return;
                update({
                  snapAlignment: 'anchor_offset',
                  sourceAnchor: 'custom_canvas',
                  ...(b.customSourceAnchor ? {} : { customSourceAnchor: { x: 0.5, y: 0.5 } }),
                });
                startSnapPinCanvasPick({
                  entityId,
                  behaviorId,
                  stateId,
                  pinRole: 'source',
                  referenceEntityId: entityId,
                });
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                canPickSourceOnCanvas
                  ? 'bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span className="truncate">{isReceptacle ? 'Poser repère réceptacle' : 'Poser repère objet'}</span>
            </button>
            <button
              type="button"
              disabled={!canPickTargetOnCanvas}
              onClick={() => {
                if (!entityId || !behaviorId || !resolvedTargetEntityId) return;
                update({
                  snapAlignment: 'anchor_offset',
                  targetAnchor: 'custom_canvas',
                  ...(b.customTargetAnchor ? {} : { customTargetAnchor: { x: 0.5, y: 0.5 } }),
                });
                startSnapPinCanvasPick({
                  entityId,
                  behaviorId,
                  stateId,
                  pinRole: 'target',
                  referenceEntityId: resolvedTargetEntityId,
                });
              }}
              className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${
                canPickTargetOnCanvas
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 cursor-pointer'
                  : 'bg-slate-100 text-slate-400 cursor-not-allowed'
              }`}
            >
              <Crosshair className="w-3 h-3 shrink-0" />
              <span className="truncate">{isReceptacle ? 'Poser repère capturé' : 'Poser repère cible'}</span>
            </button>
          </div>
        )}

        {snapAlignment === 'anchor_offset' && (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isReceptacle ? 'Ancre du réceptacle' : 'Ancre de cet objet'}
                </span>
                <select
                  value={b.sourceAnchor || 'center'}
                  onChange={(e) => {
                    const next = e.target.value as SnapAnchorPreset;
                    update({
                      sourceAnchor: next,
                      ...(next === 'custom_canvas' && !b.customSourceAnchor
                        ? { customSourceAnchor: { x: 0.5, y: 0.5 } }
                        : {}),
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
                >
                  {ANCHOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
                  {isReceptacle ? 'Ancre objet capturé' : 'Ancre de la cible'}
                </span>
                <select
                  value={b.targetAnchor || 'center'}
                  onChange={(e) => {
                    const next = e.target.value as SnapAnchorPreset;
                    update({
                      targetAnchor: next,
                      ...(next === 'custom_canvas' && !b.customTargetAnchor
                        ? { customTargetAnchor: { x: 0.5, y: 0.5 } }
                        : {}),
                    });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
                >
                  {ANCHOR_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {b.sourceAnchor === 'custom_canvas' && (
              <div className="p-2 bg-cyan-50/70 rounded-xl border border-cyan-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-cyan-900">
                    Repère {isReceptacle ? 'réceptacle' : 'objet'} (0..1)
                  </span>
                  <button
                    type="button"
                    disabled={!canPickSourceOnCanvas}
                    onClick={() => {
                      if (!entityId || !behaviorId) return;
                      startSnapPinCanvasPick({
                        entityId,
                        behaviorId,
                        stateId,
                        pinRole: 'source',
                        referenceEntityId: entityId,
                      });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                      canPickSourceOnCanvas
                        ? 'bg-cyan-600 hover:bg-cyan-700 text-white cursor-pointer shadow-2xs'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title={
                      canPickSourceOnCanvas
                        ? 'Cliquer directement sur le canvas pour poser le repère'
                        : 'Disponible sur une instance placée dans la scène'
                    }
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Placer sur le canvas</span>
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between gap-1 bg-white px-2 py-1 rounded-lg border border-cyan-200">
                    <span className="text-[10px] font-bold text-slate-500">X</span>
                    <input
                      type="number"
                      step="any"
                      value={b.customSourceAnchor?.x ?? 0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          update({
                            customSourceAnchor: { x: v, y: b.customSourceAnchor?.y ?? 0.5 },
                          });
                        }
                      }}
                      className="w-16 text-right font-mono font-bold text-[11px] text-slate-800 outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-white px-2 py-1 rounded-lg border border-cyan-200">
                    <span className="text-[10px] font-bold text-slate-500">Y</span>
                    <input
                      type="number"
                      step="any"
                      value={b.customSourceAnchor?.y ?? 0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          update({
                            customSourceAnchor: { x: b.customSourceAnchor?.x ?? 0.5, y: v },
                          });
                        }
                      }}
                      className="w-16 text-right font-mono font-bold text-[11px] text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            {b.targetAnchor === 'custom_canvas' && (
              <div className="p-2 bg-indigo-50/70 rounded-xl border border-indigo-200 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-bold text-indigo-900">
                    Repère {isReceptacle ? 'objet capturé' : 'cible'} (0..1)
                  </span>
                  <button
                    type="button"
                    disabled={!canPickTargetOnCanvas}
                    onClick={() => {
                      if (!entityId || !behaviorId || !resolvedTargetEntityId) return;
                      startSnapPinCanvasPick({
                        entityId,
                        behaviorId,
                        stateId,
                        pinRole: 'target',
                        referenceEntityId: resolvedTargetEntityId,
                      });
                    }}
                    className={`px-2 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-colors ${
                      canPickTargetOnCanvas
                        ? 'bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer shadow-2xs'
                        : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                    }`}
                    title={
                      canPickTargetOnCanvas
                        ? `Cliquer sur la scène (réf: ${sceneEntities[resolvedTargetEntityId!]?.name})`
                        : 'Aucune entité cible correspondante trouvée sur la scène'
                    }
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Placer sur le canvas</span>
                  </button>
                </div>
                {!canPickTargetOnCanvas && (
                  <div className="text-[10px] text-indigo-700/80 italic">
                    Placez une entité cible correspondante sur la scène pour utiliser la visée directe.
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="flex items-center justify-between gap-1 bg-white px-2 py-1 rounded-lg border border-indigo-200">
                    <span className="text-[10px] font-bold text-slate-500">X</span>
                    <input
                      type="number"
                      step="any"
                      value={b.customTargetAnchor?.x ?? 0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          update({
                            customTargetAnchor: { x: v, y: b.customTargetAnchor?.y ?? 0.5 },
                          });
                        }
                      }}
                      className="w-16 text-right font-mono font-bold text-[11px] text-slate-800 outline-none"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-1 bg-white px-2 py-1 rounded-lg border border-indigo-200">
                    <span className="text-[10px] font-bold text-slate-500">Y</span>
                    <input
                      type="number"
                      step="any"
                      value={b.customTargetAnchor?.y ?? 0.5}
                      onChange={(e) => {
                        const v = parseFloat(e.target.value);
                        if (Number.isFinite(v)) {
                          update({
                            customTargetAnchor: { x: b.customTargetAnchor?.x ?? 0.5, y: v },
                          });
                        }
                      }}
                      className="w-16 text-right font-mono font-bold text-[11px] text-slate-800 outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 gap-1.5">
          <div>
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Décalage X (px)</span>
            <input
              type="number"
              step="any"
              value={b.offsetX ?? 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) update({ offsetX: v });
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>
          <div>
            <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Décalage Y (px)</span>
            <input
              type="number"
              step="any"
              value={b.offsetY ?? 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) update({ offsetY: v });
              }}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <span className="text-[11px] font-bold text-slate-700">Aligner la rotation sur la cible</span>
          <input
            type="checkbox"
            checked={Boolean(b.matchTargetRotation)}
            onChange={(e) => update({ matchTargetRotation: e.target.checked })}
            className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
          />
        </div>

        {b.matchTargetRotation && (
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold text-slate-500">Décalage angle (°)</span>
            <input
              type="number"
              step="any"
              value={b.rotationOffset ?? 0}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v)) update({ rotationOffset: v });
              }}
              className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-right"
            />
          </div>
        )}
      </div>

      {/* 4. Liaison après aimantation & Arrachement */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <span className="text-[10px] font-bold text-slate-500 block mb-0.5">
            Comportement après snap (Liaison)
          </span>
          <select
            value={attachBehavior}
            onChange={(e) => update({ attachBehavior: e.target.value as SnapAttachBehavior })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-bold text-slate-800"
          >
            <option value="position_only">Placer uniquement (sans parentage)</option>
            <option value="freeze_physics">Poser et figer la physique (statique)</option>
            <option value="parent_rigid">Parenter solidement (suit la cible)</option>
            <option value="parent_spring">Parenter avec ressort souple</option>
            <option value="parent_physics_joint">Parenter avec Joint Physique (Break Joint)</option>
            <option value="bidirectional_joint">Joint bidirectionnel (sans parentage)</option>
          </select>
        </div>

        {(attachBehavior === 'parent_spring' || attachBehavior === 'bidirectional_joint') && (
          <div className="space-y-1.5 bg-cyan-50/50 p-2 rounded-lg border border-cyan-200/70">
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                  <span>Raideur</span>
                  <EditableNumericValue
                    value={b.springStiffness ?? (attachBehavior === 'bidirectional_joint' ? 0.65 : 0.25)}
                    precision={2}
                    onChange={(v) => update({ springStiffness: v })}
                    className="font-mono font-bold text-cyan-700 cursor-text"
                  />
                </div>
                <input
                  type="range"
                  min="0.02"
                  max="1"
                  step="0.02"
                  value={Math.max(
                    0.02,
                    Math.min(1, b.springStiffness ?? (attachBehavior === 'bidirectional_joint' ? 0.65 : 0.25))
                  )}
                  onChange={(e) => update({ springStiffness: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-600"
                />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-bold text-slate-600">
                  <span>Amorti</span>
                  <EditableNumericValue
                    value={b.springDamping ?? (attachBehavior === 'bidirectional_joint' ? 0.25 : 0.18)}
                    precision={2}
                    onChange={(v) => update({ springDamping: v })}
                    className="font-mono font-bold text-cyan-700 cursor-text"
                  />
                </div>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.02"
                  value={Math.max(
                    0.01,
                    Math.min(1, b.springDamping ?? (attachBehavior === 'bidirectional_joint' ? 0.25 : 0.18))
                  )}
                  onChange={(e) => update({ springDamping: parseFloat(e.target.value) })}
                  className="w-full accent-cyan-600"
                />
              </div>
            </div>
            {attachBehavior === 'bidirectional_joint' && (
              <div className="space-y-2 pt-1.5 border-t border-cyan-200/70">
                <p className="text-[10px] leading-snug text-cyan-900">
                  Liaison symétrique sans hiérarchie : tirer la tête entraîne un corps libre, ou inversement. Si l&apos;un est figé ou épinglé au sol, tirer l&apos;autre le détache au-delà de la distance d&apos;arrachement.
                </p>

                <div className="grid grid-cols-1 gap-1.5">
                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[11px] font-bold text-slate-700">
                      Ignorer collisions entre objets liés
                    </span>
                    <input
                      type="checkbox"
                      checked={b.ignoreTargetCollision !== false}
                      onChange={(e) => update({ ignoreTargetCollision: e.target.checked })}
                      className="w-4 h-4 accent-cyan-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[11px] font-bold text-slate-700">
                      Autoriser le drag depuis la cible
                    </span>
                    <input
                      type="checkbox"
                      checked={b.allowTargetDrag !== false}
                      onChange={(e) => update({ allowTargetDrag: e.target.checked })}
                      className="w-4 h-4 accent-cyan-600 rounded cursor-pointer shrink-0"
                    />
                  </label>

                  <label className="flex items-center justify-between gap-2 cursor-pointer">
                    <span className="text-[11px] font-bold text-slate-700">
                      Suivre le balancement (Marionnette)
                    </span>
                    <input
                      type="checkbox"
                      checked={b.bidirectionalFollowSwing !== false}
                      onChange={(e) => update({ bidirectionalFollowSwing: e.target.checked })}
                      className="w-4 h-4 accent-cyan-600 rounded cursor-pointer shrink-0"
                    />
                  </label>
                </div>

                {b.bidirectionalFollowSwing !== false && (
                  <div className="grid grid-cols-3 gap-1.5 pt-1 border-t border-cyan-200/50">
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Couplage</span>
                        <EditableNumericValue
                          value={b.bidirectionalAngularStiffness ?? 45}
                          precision={0}
                          onChange={(v) => update({ bidirectionalAngularStiffness: v })}
                          className="font-mono font-bold text-cyan-700 cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="180"
                        step="5"
                        value={Math.max(0, Math.min(180, b.bidirectionalAngularStiffness ?? 45))}
                        onChange={(e) =>
                          update({ bidirectionalAngularStiffness: parseFloat(e.target.value) })
                        }
                        className="w-full accent-cyan-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Amorti rot.</span>
                        <EditableNumericValue
                          value={b.bidirectionalAngularDamping ?? 8}
                          precision={1}
                          onChange={(v) => update({ bidirectionalAngularDamping: v })}
                          className="font-mono font-bold text-cyan-700 cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min="1"
                        max="30"
                        step="0.5"
                        value={Math.max(1, Math.min(30, b.bidirectionalAngularDamping ?? 8))}
                        onChange={(e) =>
                          update({ bidirectionalAngularDamping: parseFloat(e.target.value) })
                        }
                        className="w-full accent-cyan-600"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between text-[10px] font-bold text-slate-600">
                        <span>Angle max</span>
                        <EditableNumericValue
                          value={b.bidirectionalMaxAngle ?? 55}
                          unit="°"
                          precision={0}
                          onChange={(v) => update({ bidirectionalMaxAngle: v })}
                          className="font-mono font-bold text-cyan-700 cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="160"
                        step="5"
                        value={Math.max(0, Math.min(160, b.bidirectionalMaxAngle ?? 55))}
                        onChange={(e) =>
                          update({ bidirectionalMaxAngle: parseFloat(e.target.value) })
                        }
                        className="w-full accent-cyan-600"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {attachBehavior === 'parent_physics_joint' && (
          <SnapJointConfigFields
            config={b.jointConfig || {}}
            onChange={(patch) =>
              update({
                jointConfig: {
                  ...(b.jointConfig || {}),
                  ...patch,
                },
              })
            }
          />
        )}

        {!isReceptacle && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100">
            <div>
              <div className="text-[11px] font-bold text-slate-700">Pré-attaché au démarrage</div>
              <div className="text-[10px] text-slate-400">Relie automatiquement dès le lancement du Play</div>
            </div>
            <input
              type="checkbox"
              checked={Boolean(b.startAttachedAtInit)}
              onChange={(e) => update({ startAttachedAtInit: e.target.checked })}
              className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-bold text-slate-700">Détacher en tirant à la souris</div>
            <div className="text-[10px] text-slate-400">Permet de retirer l&apos;objet aimanté</div>
          </div>
          <input
            type="checkbox"
            checked={allowPullUnsnap}
            onChange={(e) => update({ allowPullUnsnap: e.target.checked })}
            className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
          />
        </div>

        {allowPullUnsnap && (
          <div className="space-y-1.5 pt-1">
            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700">
                <span className="font-bold">Distance d&apos;arrachement</span>
                <EditableNumericValue
                  value={unsnapDist}
                  unit="px"
                  precision={0}
                  onChange={(v) => update({ unsnapDistance: v })}
                  className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min="16"
                max="280"
                step="2"
                value={Math.max(16, Math.min(280, unsnapDist))}
                onChange={(e) => update({ unsnapDistance: parseInt(e.target.value, 10) })}
                className="w-full accent-cyan-600"
              />
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold text-slate-500">Délai anti-recollage (s)</span>
              <input
                type="number"
                step="any"
                value={reSnapCooldown}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) update({ reSnapCooldownSec: v });
                }}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-right"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. États visuels automatiques Approche / Snap / Unsnap */}
      <div className="p-2.5 bg-cyan-50/50 rounded-xl border border-cyan-200/80 space-y-1.5">
        <div className="text-[11px] font-bold text-cyan-950">États automatiques (optionnel)</div>
        {[
          { key: 'approachingStateId' as const, label: "À l'approche (aimant)", suggested: 'Approche', val: b.approachingStateId },
          { key: 'snappedStateId' as const, label: 'État quand aimanté', suggested: 'Aimanté', val: b.snappedStateId },
          { key: 'pullingStateId' as const, label: 'En traction (résistance)', suggested: 'Traction', val: b.pullingStateId },
          { key: 'unsnappedStateId' as const, label: 'État au détachement', suggested: 'Libre', val: b.unsnappedStateId },
        ].map((slot) => (
          <div
            key={slot.key}
            className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-cyan-100"
          >
            <span className="text-[11px] font-bold text-slate-700 truncate">{slot.label}</span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={slot.val || ''}
                onChange={(e) => update({ [slot.key]: e.target.value || undefined })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[125px]"
              >
                <option value="">-- Aucun --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const createdId = onQuickCreateState(slot.suggested, 'Aimant');
                  if (createdId) update({ [slot.key]: createdId });
                }}
                className="p-1 bg-cyan-50 hover:bg-cyan-100 text-cyan-700 border border-cyan-200 rounded-lg cursor-pointer"
                title={`Créer et lier l'état « ${slot.suggested} »`}
              >
                <Plus className="w-3 h-3" />
              </button>
              {slot.val && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(slot.val!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="pt-1 text-[10px] leading-snug text-cyan-800/90">
          <strong>Priorité :</strong> Santé &gt; Snap &gt; Marionnette &gt; Locomotions (les états RuleBook externes restent intacts).{' '}
          {isReceptacle
            ? "Si un objet possède aussi son propre composant Snap « Objet aimanté », il pilote sa physique et ses ancres tandis que le Réceptacle gère sa capacité max et ses propres états."
            : "Compatible avec un Réceptacle : cet objet pilote ses ancres/physique, et le Réceptacle observe automatiquement la capture et sa capacité max."}
        </div>
      </div>
    </div>
  );
}
