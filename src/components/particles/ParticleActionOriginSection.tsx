import React from 'react';
import { FolderOpen } from 'lucide-react';
import {
  Entity,
  ParticleAnchorPreset,
  ParticleEffectPreset,
  Position,
} from '../../types';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import { EntityOption, formatRoleLabel } from '../rulebook/ruleBookTypes';
import { EditableNumericValue } from '../shared/EditableNumericValue';
import { remapPresetConfigSprites } from './ParticlePresetLibrary';

export interface ParticleOriginDraft {
  particleOriginMode?:
    | 'subject'
    | 'target'
    | 'entity'
    | 'type'
    | 'tag'
    | 'last_spawned'
    | 'event_point'
    | 'coordinates'
    | 'mouse';
  particleOriginEntityId?: string;
  particleOriginEntityType?: string;
  particleOriginTag?: string;
  particleCoords?: Position;
  particleAnchor?: ParticleAnchorPreset;
  particleOffsetX?: number;
  particleOffsetY?: number;
  particleMatchOriginRotation?: boolean;
}

interface ParticleActionOriginSectionProps {
  draft: ParticleOriginDraft;
  allowTarget: boolean;
  subjectHint?: string;
  targetHint?: string;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
  datalistId: string;
  hideSavedCollection?: boolean;
  onPatch: (patch: Record<string, any>) => void;
}

export const ParticleActionOriginSection: React.FC<ParticleActionOriginSectionProps> = ({
  draft,
  allowTarget,
  subjectHint,
  targetHint,
  entities,
  availableEntityOptions,
  allProjectTags,
  datalistId,
  hideSavedCollection = false,
  onPatch,
}) => {
  const projectPresets = useSceneStore((s) => s.projectParticlePresets || EMPTY_LIST);
  const localCollection = useSceneStore((s) => s.localParticleCollection || EMPTY_RECORD);
  const importEmbeddedParticleSprites = useSceneStore((s) => s.importEmbeddedParticleSprites);

  const savedList: { scope: string; preset: ParticleEffectPreset }[] = [
    ...projectPresets.map((preset) => ({ scope: 'Projet', preset })),
    ...Object.values(localCollection).map((preset) => ({ scope: 'Globale', preset })),
  ];

  const mode = draft.particleOriginMode || 'subject';
  const isEntityOrigin =
    mode === 'subject' ||
    mode === 'target' ||
    mode === 'entity' ||
    mode === 'type' ||
    mode === 'tag' ||
    mode === 'last_spawned';

  return (
    <div className="space-y-1.5">
      {!hideSavedCollection && savedList.length > 0 && (
        <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
          <span className="font-bold text-amber-950 text-xs flex items-center gap-1.5">
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Collection enregistrée</span>
          </span>
          <select
            value=""
            onChange={(e) => {
              const found = savedList.find((x) => `${x.scope}:${x.preset.id}` === e.target.value);
              if (!found) return;
              const mapped = remapPresetConfigSprites(
                found.preset.config,
                found.preset.embeddedCustomSprites,
                importEmbeddedParticleSprites
              );
              onPatch({
                particleShape: mapped.shape,
                customParticleId: mapped.customParticleId,
                customParticleIds: mapped.customParticleIds,
                customParticleMode: mapped.customParticleMode,
                useParticleTint: mapped.useParticleTint,
                particleColor: mapped.color,
                particleColor2: mapped.color2,
                particleColorMode: mapped.colorMode,
                particleCount: mapped.count ?? 22,
                particleCountMax: mapped.countMax,
                particleSpeed: mapped.speed,
                particleSpeedMax: mapped.speedMax,
                particleSize: mapped.size,
                particleSizeMax: mapped.sizeMax,
                particleEndSizeScale: mapped.endSizeScale,
                particleLifetime: mapped.lifetime,
                particleLifetimeMax: mapped.lifetimeMax,
                particleGravity: mapped.gravity,
                particleDrag: mapped.drag,
                particleOpacityStart: mapped.opacityStart,
                particleOpacityEnd: mapped.opacityEnd,
                particleSpinSpeed: mapped.spinSpeed,
                particleSpread: mapped.spread,
                particleAngle: mapped.angle,
                particleDirectionMode: mapped.directionMode,
                particleDirectionTargetMode: mapped.directionTargetMode,
                particleDirectionTargetEntityId: mapped.directionTargetEntityId,
                particleDirectionTargetEntityType: mapped.directionTargetEntityType,
                particleDirectionTargetTag: mapped.directionTargetTag,
                particleEmissionShape: mapped.emissionShape,
                particleEmissionRadius: mapped.emissionRadius,
                particleEmissionWidth: mapped.emissionWidth,
                particleEmissionHeight: mapped.emissionHeight,
              });
            }}
            className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 max-w-[210px]"
          >
            <option value="">-- Charger un effet ({savedList.length}) --</option>
            {savedList.map(({ scope, preset }) => (
              <option key={`${scope}:${preset.id}`} value={`${scope}:${preset.id}`}>
                [{scope}] {preset.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Source d'émission</span>
        <select
          value={mode}
          onChange={(e) => onPatch({ particleOriginMode: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="subject">{formatRoleLabel('Sujet', subjectHint)}</option>
          {allowTarget && <option value="target">{formatRoleLabel('Cible touchée', targetHint)}</option>}
          <option value="event_point">💥 Point exact (Collision / Clic)</option>
          <option value="mouse">🖱️ Position du curseur / souris</option>
          <option value="coordinates">📍 Coordonnées exactes (X, Y)</option>
          <option value="entity">Entité de la scène</option>
          <option value="type">Par Type d'objet</option>
          <option value="tag">Par #Tag</option>
          <option value="last_spawned">Dernier objet créé</option>
        </select>
      </div>

      {mode === 'entity' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Entité source</span>
          <select
            value={draft.particleOriginEntityId || Object.keys(entities)[0] || ''}
            onChange={(e) => onPatch({ particleOriginEntityId: e.target.value })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            {Object.values(entities).map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {mode === 'type' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Type source</span>
          <select
            value={draft.particleOriginEntityType || availableEntityOptions[0]?.type || ''}
            onChange={(e) => onPatch({ particleOriginEntityType: e.target.value })}
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

      {mode === 'tag' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Tag source (#tag)</span>
          <input
            type="text"
            list={datalistId}
            value={draft.particleOriginTag || ''}
            onChange={(e) => onPatch({ particleOriginTag: e.target.value.replace(/^#/, '') })}
            placeholder="ex: joueur, ennemi..."
            className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          />
          <datalist id={datalistId}>
            {allProjectTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      )}

      {mode === 'coordinates' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-bold text-slate-700">Position X</span>
            <EditableNumericValue
              value={draft.particleCoords?.x ?? 300}
              unit="px"
              precision={0}
              onChange={(v) =>
                onPatch({
                  particleCoords: { x: v, y: draft.particleCoords?.y ?? 200 },
                })
              }
              className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg"
            />
          </div>
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-bold text-slate-700">Position Y</span>
            <EditableNumericValue
              value={draft.particleCoords?.y ?? 200}
              unit="px"
              precision={0}
              onChange={(v) =>
                onPatch({
                  particleCoords: { x: draft.particleCoords?.x ?? 300, y: v },
                })
              }
              className="font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-lg"
            />
          </div>
        </div>
      )}

      {isEntityOrigin && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Point d'ancrage relatif</span>
            <select
              value={draft.particleAnchor || 'center'}
              onChange={(e) => onPatch({ particleAnchor: e.target.value as ParticleAnchorPreset })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="center">Centre</option>
              <option value="top">Bord Haut</option>
              <option value="bottom">Bord Bas</option>
              <option value="left">Bord Gauche</option>
              <option value="right">Bord Droite</option>
              <option value="pivot">Point de Pivot</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2 pt-1 border-t border-slate-100">
            <div className="flex items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-slate-600">Décalage ΔX</span>
              <EditableNumericValue
                value={draft.particleOffsetX ?? 0}
                unit="px"
                precision={0}
                onChange={(v) => onPatch({ particleOffsetX: v })}
                className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
              />
            </div>
            <div className="flex items-center justify-between gap-1 text-xs">
              <span className="font-semibold text-slate-600">Décalage ΔY</span>
              <EditableNumericValue
                value={draft.particleOffsetY ?? 0}
                unit="px"
                precision={0}
                onChange={(v) => onPatch({ particleOffsetY: v })}
                className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
              />
            </div>
          </div>
          <label className="flex items-center justify-between pt-1 border-t border-slate-100 cursor-pointer">
            <span className="text-[11px] font-semibold text-slate-600">
              Suivre rotation &amp; miroir (flipX) de l'objet
            </span>
            <input
              type="checkbox"
              checked={draft.particleMatchOriginRotation !== false}
              onChange={(e) => onPatch({ particleMatchOriginRotation: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </label>
        </div>
      )}

      {(mode === 'mouse' || mode === 'event_point') && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-semibold text-slate-600">Décalage ΔX</span>
            <EditableNumericValue
              value={draft.particleOffsetX ?? 0}
              unit="px"
              precision={0}
              onChange={(v) => onPatch({ particleOffsetX: v })}
              className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
            />
          </div>
          <div className="flex items-center justify-between gap-1 text-xs">
            <span className="font-semibold text-slate-600">Décalage ΔY</span>
            <EditableNumericValue
              value={draft.particleOffsetY ?? 0}
              unit="px"
              precision={0}
              onChange={(v) => onPatch({ particleOffsetY: v })}
              className="font-mono font-bold text-slate-800 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg"
            />
          </div>
        </div>
      )}
    </div>
  );
};
