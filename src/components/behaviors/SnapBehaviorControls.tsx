import React from 'react';
import { Magnet, Paintbrush, Plus } from 'lucide-react';
import {
  Entity,
  EntityState,
  ParticleAnchorPreset,
  SnapAlignmentMode,
  SnapAnimationMode,
  SnapAttachBehavior,
  SnapBehaviorConfig,
  SnapTargetType,
  SnapTriggerMode,
} from '../../types';
import { EditableNumericValue } from '../shared/EditableNumericValue';

const ANCHOR_OPTIONS: { value: ParticleAnchorPreset; label: string }[] = [
  { value: 'center', label: 'Centre' },
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
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: SnapBehaviorConfig;
  update: (partial: Partial<SnapBehaviorConfig>) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  const targetType: SnapTargetType = b.targetType || 'any';
  const snapTrigger: SnapTriggerMode = b.snapTrigger || 'on_release';
  const snapMode: SnapAnimationMode = b.snapMode || 'magnetic_smooth';
  const snapAlignment: SnapAlignmentMode = b.snapAlignment || 'center';
  const attachBehavior: SnapAttachBehavior = b.attachBehavior || 'position_only';
  const radius = b.snapRadius ?? 48;
  const unsnapDist = b.unsnapDistance ?? Math.round(radius * 1.5);
  const allowPullUnsnap = b.allowPullUnsnap !== false;
  const reSnapCooldown = b.reSnapCooldownSec ?? 0.35;

  return (
    <div className="space-y-2.5">
      {/* 1. Cible de l'aimant */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Magnet className="w-3.5 h-3.5 text-cyan-600" />
          <span>Cible d'aimantation</span>
        </div>

        <select
          value={targetType}
          onChange={(e) => update({ targetType: e.target.value as SnapTargetType })}
          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
        >
          <option value="any">N'importe quel objet à portée</option>
          <option value="entity">Une instance précise</option>
          <option value="type">Un type d'objet</option>
          <option value="tag">Un #Tag spécifique</option>
        </select>

        {targetType === 'entity' && (
          <select
            value={b.targetEntityId || ''}
            onChange={(e) => update({ targetEntityId: e.target.value || undefined })}
            className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-800"
          >
            <option value="">-- Choisir l'objet cible --</option>
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

      {/* 2. Déclenchement & Zone d'aimantation */}
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
              <option value="always_when_near">Dès qu'il s'approche</option>
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
            <span className="font-bold">Rayon d'aimantation</span>
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
              <span className="font-bold">Vitesse d'aspiration</span>
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
            <option value="anchor_offset">Par points d'ancrage (Haut/Bas/Côtés…)</option>
            <option value="edge_closest">Bord le plus proche (aimant bord à bord)</option>
          </select>
        </div>

        {snapAlignment === 'anchor_offset' && (
          <div className="grid grid-cols-2 gap-1.5">
            <div>
              <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Ancre de cet objet</span>
              <select
                value={b.sourceAnchor || 'center'}
                onChange={(e) => update({ sourceAnchor: e.target.value as ParticleAnchorPreset })}
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
              <span className="text-[10px] font-bold text-slate-500 block mb-0.5">Ancre de la cible</span>
              <select
                value={b.targetAnchor || 'center'}
                onChange={(e) => update({ targetAnchor: e.target.value as ParticleAnchorPreset })}
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
                update({ offsetX: Number.isFinite(v) ? v : 0 });
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
                update({ offsetY: Number.isFinite(v) ? v : 0 });
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
                update({ rotationOffset: Number.isFinite(v) ? v : 0 });
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
          </select>
        </div>

        {attachBehavior === 'parent_spring' && (
          <div className="grid grid-cols-2 gap-1.5 bg-cyan-50/50 p-2 rounded-lg border border-cyan-200/70">
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>Raideur</span>
                <EditableNumericValue
                  value={b.springStiffness ?? 0.25}
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
                value={Math.max(0.02, Math.min(1, b.springStiffness ?? 0.25))}
                onChange={(e) => update({ springStiffness: parseFloat(e.target.value) })}
                className="w-full accent-cyan-600"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] font-bold text-slate-600">
                <span>Amorti</span>
                <EditableNumericValue
                  value={b.springDamping ?? 0.18}
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
                value={Math.max(0.01, Math.min(1, b.springDamping ?? 0.18))}
                onChange={(e) => update({ springDamping: parseFloat(e.target.value) })}
                className="w-full accent-cyan-600"
              />
            </div>
          </div>
        )}

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div>
            <div className="text-[11px] font-bold text-slate-700">Détacher en tirant à la souris</div>
            <div className="text-[10px] text-slate-400">Permet de retirer l'objet aimanté</div>
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
                <span className="font-bold">Distance d'arrachement</span>
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
                  update({ reSnapCooldownSec: Number.isFinite(v) ? v : 0 });
                }}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono font-bold text-slate-800 text-right"
              />
            </div>
          </div>
        )}
      </div>

      {/* 5. États visuels automatiques Snap / Unsnap */}
      <div className="p-2.5 bg-cyan-50/50 rounded-xl border border-cyan-200/80 space-y-1.5">
        <div className="text-[11px] font-bold text-cyan-950">États automatiques (optionnel)</div>
        {[
          { key: 'snappedStateId' as const, label: 'État quand aimanté', suggested: 'Aimanté', val: b.snappedStateId },
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
      </div>
    </div>
  );
}
