import React from 'react';
import { Dices, Paintbrush, Pencil, Plus, Sliders, X } from 'lucide-react';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import {
  CustomParticlePreset,
  CustomParticleUsageMode,
  Entity,
  EntityState,
  HealthBehaviorConfig,
  LookAtBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  ParticleShape,
  SceneTransitionType,
  StrokeWiggleBehaviorConfig,
} from '../../types';
import { SCENE_TRANSITION_OPTIONS } from '../rulebook/ruleBookTypes';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export function LookAtBehaviorControls({
  b,
  update,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
}: {
  b: LookAtBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
}) {
  const lookMode = b.lookMode || 'rotate';
  const maxAngleVal = b.maxAngle ?? 0;
  const isFreeCone = maxAngleVal <= 0 || maxAngleVal >= 180;
  const rx = b.orbitRadius ?? 8;
  const ry = b.orbitRadiusY ?? rx;

  return (
    <div className="space-y-1.5">
      {/* Sélecteur de mode LookAt */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 text-xs">Mode de suivi</span>
          <span className="text-[10px] text-slate-400">Fonctionne aussi sur enfants</span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => update({ lookMode: 'rotate' })}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              lookMode === 'rotate'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Rotation (Tête)
          </button>
          <button
            type="button"
            onClick={() => update({ lookMode: 'pupil_orbit' })}
            className={`px-2 py-1.5 rounded-lg text-[11px] font-bold border transition-colors ${
              lookMode === 'pupil_orbit'
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
            }`}
          >
            Orbite / Pupille (Œil)
          </button>
        </div>
      </div>

      {/* Ligne 1: Type de cible à regarder */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Cible à regarder</span>
        <select
          value={b.targetType}
          onChange={(e) => update({ targetType: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[190px]"
        >
          <option value="mouse">Curseur / Souris</option>
          <option value="entity">Entité précise</option>
          <option value="nearest_type">Type d'objet le plus proche</option>
          <option value="nearest_tag">Tag le plus proche (#tag)</option>
        </select>
      </div>

      {/* Ligne 2: Entité cible, Type ou Tag si applicable */}
      {b.targetType === 'entity' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Entité visée</span>
          <select
            value={b.targetEntityId || ''}
            onChange={(e) => update({ targetEntityId: e.target.value })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[160px]"
          >
            <option value="">-- Choisir une entité --</option>
            {targetEntityOptions.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {b.targetType === 'nearest_type' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Type recherché</span>
          <select
            value={b.targetEntityType || ''}
            onChange={(e) => update({ targetEntityType: e.target.value })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[160px]"
          >
            <option value="">-- Choisir un type --</option>
            {entityTypeOptions.map((opt) => (
              <option key={opt.type} value={opt.type}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
      )}

      {b.targetType === 'nearest_tag' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Tag recherché</span>
          <input
            type="text"
            list={`tags-lookat-${b.id}`}
            placeholder="ex: ennemi, joueur..."
            value={b.targetTag || ''}
            onChange={(e) => update({ targetTag: e.target.value.replace(/^#/, '') })}
            className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          />
          <datalist id={`tags-lookat-${b.id}`}>
            {availableTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      )}

      {lookMode === 'rotate' ? (
        <>
          {/* Orientation du dessin & Flip contextuel Gauche/Droite */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="font-bold text-slate-700 text-xs">Comportement Gauche/Droite</span>
            </div>
            <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
              <button
                type="button"
                onClick={() => update({ flipMode: 'none' })}
                className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  (b.flipMode || 'none') === 'none'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                Rotation libre 360°
              </button>
              <button
                type="button"
                onClick={() => update({ flipMode: 'flipX' })}
                className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                  b.flipMode === 'flipX'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:bg-white/70'
                }`}
              >
                Flip miroir auto (Tête)
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <span className="text-[11px] font-semibold text-slate-600">Dessin orienté vers :</span>
              <div className="grid grid-cols-2 gap-1 bg-slate-100 p-0.5 rounded-lg">
                <button
                  type="button"
                  onClick={() => update({ facingDirection: 'right' })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    (b.facingDirection || 'right') === 'right'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  Droite →
                </button>
                <button
                  type="button"
                  onClick={() => update({ facingDirection: 'left' })}
                  className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                    b.facingDirection === 'left'
                      ? 'bg-white text-indigo-700 shadow-2xs'
                      : 'text-slate-500'
                  }`}
                >
                  ← Gauche
                </button>
              </div>
            </div>

            {b.flipMode === 'flipX' && (
              <div className="pt-1 border-t border-slate-100">
                <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                  <span className="font-semibold">Zone morte flip (Anti-scintillement)</span>
                  <EditableNumericValue
                    value={b.flipDeadzone ?? 12}
                    unit="px"
                    precision={0}
                    onChange={(val) => update({ flipDeadzone: val })}
                    className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]"
                  />
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="2"
                  value={Math.max(0, Math.min(40, b.flipDeadzone ?? 12))}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) update({ flipDeadzone: v });
                  }}
                  className="w-full accent-indigo-600 h-1.5"
                />
              </div>
            )}
          </div>

          {/* Ligne 3: Décalage angulaire */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Décalage d'angle</span>
              <EditableNumericValue
                value={b.rotationOffset || 0}
                unit="°"
                precision={0}
                onChange={(val) => update({ rotationOffset: val })}
                className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
              />
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={Math.max(-180, Math.min(180, b.rotationOffset || 0))}
              onChange={(e) => update({ rotationOffset: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Cône de rotation max (clamp autour de l'orientation de repos) */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Cône de rotation max</span>
                <span className="text-[10px] text-slate-400 block">
                  Empêche une tête de faire un tour complet à l'envers
                </span>
              </div>
              <EditableNumericValue
                value={maxAngleVal}
                unit="°"
                precision={0}
                displayText={isFreeCone ? 'Libre 360°' : `±${maxAngleVal}°`}
                onChange={(val) => update({ maxAngle: val })}
                className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] shrink-0"
              />
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="5"
              value={Math.max(0, Math.min(180, maxAngleVal))}
              onChange={(e) => update({ maxAngle: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      ) : (
        <>
          {/* Orbite horizontale (X) */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Rayon horizontal (Orbite X)</span>
                <span className="text-[10px] text-slate-400 block">
                  Amplitude de glissement gauche/droite de la pupille
                </span>
              </div>
              <EditableNumericValue
                value={rx}
                unit="px"
                precision={0}
                onChange={(val) => update({ orbitRadius: val })}
                className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
              />
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={Math.max(1, Math.min(50, rx))}
              onChange={(e) => update({ orbitRadius: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Orbite verticale (Y) */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Rayon vertical (Orbite Y)</span>
                <span className="text-[10px] text-slate-400 block">
                  Amplitude haut/bas (utile pour des yeux ovales)
                </span>
              </div>
              <EditableNumericValue
                value={ry}
                unit="px"
                precision={0}
                onChange={(val) => update({ orbitRadiusY: val })}
                className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
              />
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={Math.max(1, Math.min(50, ry))}
              onChange={(e) => update({ orbitRadiusY: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      )}

      {/* Ligne 4: Lissage / Réactivité */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">
              {lookMode === 'pupil_orbit' ? 'Réactivité du regard' : 'Lissage angulaire'}
            </span>
            <span className="text-[10px] text-slate-400 block">
              {lookMode === 'pupil_orbit'
                ? '0 = suivi instantané, sinon glissement fluide'
                : '0 = instantané, sinon vitesse de pivot'}
            </span>
          </div>
          <EditableNumericValue
            value={b.smoothSpeed || 0}
            unit="°/s"
            precision={0}
            onChange={(val) => update({ smoothSpeed: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="0"
          max="720"
          step="30"
          value={Math.max(0, Math.min(720, b.smoothSpeed || 0))}
          onChange={(e) => update({ smoothSpeed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>
    </div>
  );
}

export function ParticleEmitterBehaviorControls({
  b,
  update,
  customParticles,
  onOpenParticleDrawer,
  onOpenParticleEditor,
  onDeleteCustomParticle,
}: {
  b: ParticleEmitterBehaviorConfig;
  update: (partial: any) => void;
  customParticles: CustomParticlePreset[];
  onOpenParticleDrawer: (editingPreset?: CustomParticlePreset) => void;
  onOpenParticleEditor: () => void;
  onDeleteCustomParticle: (presetId: string) => void;
}) {
  const selectedCustomIds: string[] =
    b.customParticleIds && b.customParticleIds.length > 0
      ? b.customParticleIds
      : b.customParticleId
      ? [b.customParticleId]
      : [];
  const toggleCustomParticleSelection = (presetId: string) => {
    const exists = selectedCustomIds.includes(presetId);
    let nextIds: string[];
    if (exists) {
      nextIds = selectedCustomIds.filter((id) => id !== presetId);
    } else {
      nextIds = [...selectedCustomIds, presetId];
    }
    update({
      customParticleIds: nextIds,
      customParticleId: nextIds[0],
    });
  };

  return (
    <div className="space-y-1.5">
      {/* Bouton Éditeur & Testeur interactif */}
      <button
        type="button"
        onClick={onOpenParticleEditor}
        className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
      >
        <Sliders className="w-3.5 h-3.5" />
        <span>Ouvrir l'Éditeur &amp; Testeur de Particules</span>
      </button>

      {/* Ligne 1: Forme des particules */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Forme des particules</span>
        <select
          value={b.shape || 'circle'}
          onChange={(e) => {
            const nextShape = e.target.value as ParticleShape;
            if (nextShape === 'custom' && selectedCustomIds.length === 0 && customParticles.length > 0) {
              update({
                shape: nextShape,
                customParticleId: customParticles[0].id,
                customParticleIds: [customParticles[0].id],
              });
            } else {
              update({ shape: nextShape });
            }
          }}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="circle">Rond (Bulle / Fumée)</option>
          <option value="square">Carré (Confetti / Pixel)</option>
          <option value="spark">Étincelle (Trait)</option>
          <option value="star">Étoile</option>
          <option value="custom">Particule dessinée ✨</option>
        </select>
      </div>

      {/* Galerie de particules dessinées si shape === 'custom' */}
      {b.shape === 'custom' && (
        <div className="p-2.5 bg-amber-50/60 rounded-xl border border-amber-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-bold text-amber-950">
              Particules ({selectedCustomIds.length} sél.) :
            </span>
            <button
              type="button"
              onClick={() => onOpenParticleDrawer(undefined)}
              className="px-2 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
            >
              <Paintbrush className="w-3 h-3" />
              <span>+ Dessiner</span>
            </button>
          </div>

          {customParticles.length === 0 ? (
            <div className="text-[11px] text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200/80 text-center">
              Aucune particule dessinée pour le moment. Cliquez sur <strong>+ Dessiner</strong> ci-dessus.
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-1.5">
              {customParticles.map((preset) => {
                const selIdx = selectedCustomIds.indexOf(preset.id);
                const isSel = selIdx !== -1;
                return (
                  <div
                    key={preset.id}
                    className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                      isSel
                        ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                        : 'bg-white/80 border-slate-200 hover:border-amber-300'
                    }`}
                    onClick={() => toggleCustomParticleSelection(preset.id)}
                  >
                    {isSel && (
                      <span className="absolute -top-1.5 -left-1.5 px-1.5 py-0.2 bg-amber-500 text-white rounded-full text-[9px] font-black shadow-2xs">
                        #{selIdx + 1}
                      </span>
                    )}
                    <div className="w-8 h-8 rounded-lg bg-slate-50 border border-slate-100 flex items-center justify-center overflow-hidden">
                      <svg viewBox="0 0 100 100" className="w-7 h-7">
                        {preset.vectorPaths.map((p) => (
                          <path
                            key={p.id}
                            d={p.d}
                            stroke={p.stroke}
                            strokeWidth={p.strokeWidth}
                            fill={p.fill || 'none'}
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        ))}
                      </svg>
                    </div>
                    <span className="text-[9px] font-bold text-slate-700 truncate w-full text-center">
                      {preset.name}
                    </span>
                    <div className="absolute -top-1.5 -right-1.5 hidden group-hover:flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenParticleDrawer(preset);
                        }}
                        className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                        title="Modifier ce dessin"
                      >
                        <Pencil className="w-2.5 h-2.5" />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteCustomParticle(preset.id);
                          if (isSel) {
                            const nextIds = selectedCustomIds.filter((id) => id !== preset.id);
                            update({ customParticleIds: nextIds, customParticleId: nextIds[0] });
                          }
                        }}
                        className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                        title="Supprimer ce preset"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {selectedCustomIds.length > 1 && (
            <div className="p-2 bg-white rounded-xl border border-amber-200 flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-700">Utilisation :</span>
              <select
                value={b.customParticleMode || 'random'}
                onChange={(e) => update({ customParticleMode: e.target.value as CustomParticleUsageMode })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
              >
                <option value="random">Aléatoire parmi les sélectionnées</option>
                <option value="sequence">Séquence (#1 → #2 → ...)</option>
                <option value="lifetime_anim">Animation sur durée de vie</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-1 border-t border-amber-200/70">
            <span className="text-[11px] font-bold text-slate-700">Teinter avec les couleurs d'émission</span>
            <input
              type="checkbox"
              checked={b.useParticleTint === true}
              onChange={(e) => update({ useParticleTint: e.target.checked })}
              className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Ligne 2: Débit d'émission */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Débit d'émission</span>
          <EditableNumericValue
            value={b.rate ?? 14}
            unit="part/s"
            precision={0}
            onChange={(val) => update({ rate: val })}
            className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="1"
          max="40"
          step="1"
          value={Math.max(1, Math.min(40, b.rate ?? 14))}
          onChange={(e) => update({ rate: parseInt(e.target.value, 10) })}
          className="w-full accent-amber-500"
        />
      </div>

      {/* Ligne 3: Couleur Principale */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Couleur principale</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">{b.color || '#f59e0b'}</span>
          <input
            type="color"
            value={b.color || '#f59e0b'}
            onChange={(e) => update({ color: e.target.value })}
            className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
          />
        </div>
      </div>

      {/* Ligne 4: Couleur Secondaire */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Couleur secondaire (Mix)</span>
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-slate-500">{b.color2 || b.color || '#ef4444'}</span>
          <input
            type="color"
            value={b.color2 || b.color || '#ef4444'}
            onChange={(e) => update({ color2: e.target.value })}
            className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
          />
        </div>
      </div>

      {/* Ligne 5: Vitesse initiale */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Vitesse d'éjection</span>
          <EditableNumericValue
            value={b.speed ?? 140}
            unit="px/s"
            precision={0}
            onChange={(val) => update({ speed: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={Math.max(10, Math.min(500, b.speed ?? 140))}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 6: Taille */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Taille des particules</span>
          <EditableNumericValue
            value={b.size ?? 6}
            unit="px"
            precision={0}
            onChange={(val) => update({ size: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="2"
          max="20"
          step="1"
          value={Math.max(2, Math.min(20, b.size ?? 6))}
          onChange={(e) => update({ size: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 7: Durée de vie */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Durée de vie</span>
          <EditableNumericValue
            value={b.lifetime ?? 0.8}
            unit="s"
            precision={1}
            onChange={(val) => update({ lifetime: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={Math.max(0.2, Math.min(3.0, b.lifetime ?? 0.8))}
          onChange={(e) => update({ lifetime: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 8: Gravité des particules */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Gravité / Flottaison</span>
          <EditableNumericValue
            value={b.gravity ?? 160}
            unit="px/s²"
            precision={0}
            onChange={(val) => update({ gravity: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="-300"
          max="600"
          step="20"
          value={Math.max(-300, Math.min(600, b.gravity ?? 160))}
          onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 9: Direction */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Direction d'émission</span>
          <EditableNumericValue
            value={b.angle ?? -90}
            unit="°"
            precision={0}
            onChange={(val) => update({ angle: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="5"
          value={Math.max(-180, Math.min(180, b.angle ?? -90))}
          onChange={(e) => update({ angle: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 10: Cône de dispersion */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Cône de dispersion</span>
          <EditableNumericValue
            value={b.spread ?? 60}
            unit="°"
            precision={0}
            onChange={(val) => update({ spread: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="5"
          max="360"
          step="5"
          value={Math.max(5, Math.min(360, b.spread ?? 60))}
          onChange={(e) => update({ spread: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 11: Décalage d'émission X */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Point d'émission ΔX</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="any"
            value={b.offsetX ?? 0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) update({ offsetX: v });
            }}
            className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
          />
          <span className="text-slate-400 text-xs">px</span>
        </div>
      </div>

      {/* Ligne 12: Décalage d'émission Y */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Point d'émission ΔY</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            step="any"
            value={b.offsetY ?? 0}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (Number.isFinite(v)) update({ offsetY: v });
            }}
            className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
          />
          <span className="text-slate-400 text-xs">px</span>
        </div>
      </div>
    </div>
  );
}

export function HealthBehaviorControls({
  b,
  update,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: HealthBehaviorConfig;
  update: (partial: any) => void;
  availableTags: string[];
  stateList: EntityState[];
  onQuickCreateState?: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  const scenes = useSceneStore((s) => s.scenes || EMPTY_LIST);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);

  const vulTop = b.vulnerableTop !== false;
  const vulBottom = b.vulnerableBottom !== false;
  const vulLeft = b.vulnerableLeft !== false;
  const vulRight = b.vulnerableRight !== false;
  const onDeath = b.onDeath || 'destroy';

  return (
    <div className="space-y-1.5">
      {/* Points de vie max */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Points de vie max (PV)</span>
          <EditableNumericValue
            value={b.maxHp ?? 3}
            unit="PV"
            precision={0}
            onChange={(val) => update({ maxHp: val })}
            className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={Math.max(1, Math.min(20, b.maxHp ?? 3))}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (Number.isFinite(v)) update({ maxHp: v });
          }}
          className="w-full accent-rose-500"
        />
      </div>

      {/* Tag danger au contact */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-700 text-xs block">Tag de danger (#tag)</span>
          <span className="text-[10px] text-slate-400">Entités ou calques colliders qui blessent</span>
        </div>
        <input
          type="text"
          list={`tags-health-${b.id}`}
          placeholder="ex: danger, ennemi"
          value={b.damageTag || ''}
          onChange={(e) => update({ damageTag: e.target.value.replace(/^#/, '') })}
          className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        />
        <datalist id={`tags-health-${b.id}`}>
          {availableTags.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </div>

      {/* Côtés vulnérables / immunisés (style Goomba) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <span className="font-bold text-slate-700 text-xs block">Côtés vulnérables aux dégâts</span>
          <span className="text-[10px] text-slate-400">
            Décochez un côté pour le rendre immunisé (ex : décochez Haut pour écraser un ennemi)
          </span>
        </div>
        <div className="grid grid-cols-3 gap-1 max-w-[210px] mx-auto">
          <div />
          <button
            type="button"
            onClick={() => update({ vulnerableTop: !vulTop })}
            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
              vulTop
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {vulTop ? '↑ Haut (Vuln.)' : '🛡️ Haut'}
          </button>
          <div />
          <button
            type="button"
            onClick={() => update({ vulnerableLeft: !vulLeft })}
            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
              vulLeft
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {vulLeft ? '← Gauche' : '🛡️ Gauche'}
          </button>
          <div className="flex items-center justify-center text-[10px] font-black text-slate-400">
            {vulTop && vulBottom && vulLeft && vulRight ? '4/4' : '🛡️'}
          </div>
          <button
            type="button"
            onClick={() => update({ vulnerableRight: !vulRight })}
            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
              vulRight
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {vulRight ? 'Droite →' : '🛡️ Droite'}
          </button>
          <div />
          <button
            type="button"
            onClick={() => update({ vulnerableBottom: !vulBottom })}
            className={`py-1 px-1.5 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
              vulBottom
                ? 'bg-rose-50 border-rose-300 text-rose-800'
                : 'bg-emerald-50 border-emerald-300 text-emerald-800'
            }`}
          >
            {vulBottom ? '↓ Bas' : '🛡️ Bas'}
          </button>
          <div />
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-slate-100">
          <div>
            <div className="font-bold text-slate-700 text-[11px]">Immunisé en haut si saut descendant</div>
            <div className="text-[9px] text-slate-400">Bloque le dégât quand on retombe sur la cible (vy &gt; 0)</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(b.immuneTopWhenFalling)}
            onChange={(e) => update({ immuneTopWhenFalling: e.target.checked })}
            className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Durée d'invincibilité & effet visuel optionnel */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <span className="font-bold">Invincibilité après choc</span>
            <EditableNumericValue
              value={b.damageCooldown ?? 1.0}
              unit="s"
              precision={1}
              onChange={(val) => update({ damageCooldown: val })}
              className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
            />
          </div>
          <input
            type="range"
            min="0.2"
            max="4.0"
            step="0.1"
            value={Math.max(0.2, Math.min(4.0, b.damageCooldown ?? 1.0))}
            onChange={(e) => update({ damageCooldown: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
        <div className="flex items-center justify-between pt-1.5 border-t border-slate-100">
          <div>
            <div className="font-bold text-slate-700 text-[11px]">Clignotement d'opacité aux dégâts</div>
            <div className="text-[9px] text-slate-400">Désactivé par défaut (activer pour un clignotement auto)</div>
          </div>
          <input
            type="checkbox"
            checked={b.blinkOnDamage === true}
            onChange={(e) => update({ blinkOnDamage: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      </div>

      {/* Recul (Knockback) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Recul au choc (Knockback)</span>
          <EditableNumericValue
            value={b.knockbackForce ?? 220}
            unit="px/s"
            precision={0}
            onChange={(val) => update({ knockbackForce: val })}
            className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="0"
          max="600"
          step="20"
          value={Math.max(0, Math.min(600, b.knockbackForce ?? 220))}
          onChange={(e) => update({ knockbackForce: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* État Blessé temporaire */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <span className="font-bold text-slate-700 text-xs block">État « Blessé » (Optionnel)</span>
          <span className="text-[10px] text-slate-400">Protégé par le garde-fou pendant l'invincibilité</span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <select
            value={b.hurtStateId || ''}
            onChange={(e) => update({ hurtStateId: e.target.value || undefined })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[125px]"
          >
            <option value="">-- Aucun --</option>
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
                const createdId = onQuickCreateState('Blessé', 'Santé');
                if (createdId) update({ hurtStateId: createdId });
              }}
              className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
              title="Créer et lier l'état « Blessé »"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
          {b.hurtStateId && onEditStateDrawing && (
            <button
              type="button"
              onClick={() => onEditStateDrawing(b.hurtStateId!)}
              className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
              title="Dessiner l'état « Blessé »"
            >
              <Paintbrush className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* État de retour après blessure */}
      {b.hurtStateId && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <span className="font-bold text-slate-700 text-xs block">Retour après blessure</span>
            <span className="text-[10px] text-slate-400">Redonne la main au contrôleur</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <select
              value={b.recoverStateId || ''}
              onChange={(e) => update({ recoverStateId: e.target.value || undefined })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[125px]"
            >
              <option value="">État précédent (auto)</option>
              {stateList.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.name}
                </option>
              ))}
            </select>
            {b.recoverStateId && onEditStateDrawing && (
              <button
                type="button"
                onClick={() => onEditStateDrawing(b.recoverStateId!)}
                className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                title="Dessiner cet état"
              >
                <Paintbrush className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Action à 0 PV */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Quand PV = 0</span>
          <select
            value={onDeath}
            onChange={(e) => update({ onDeath: e.target.value as any })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[175px]"
          >
            <option value="destroy">Détruire l'entité</option>
            <option value="change_state">Passer à un état (Mort)</option>
            <option value="restart_scene">Recharger la scène actuelle</option>
            <option value="change_scene">Aller à une autre scène</option>
            <option value="none">Ne rien faire (0 PV)</option>
          </select>
        </div>

        {(onDeath === 'change_state' || onDeath === 'restart_scene' || onDeath === 'change_scene') && (
          <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
            <span className="font-bold text-slate-700 text-[11px] min-w-0 truncate">
              {onDeath === 'change_state' ? 'État « Mort / K.O. »' : 'État animation Mort (optionnel)'}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={b.deathStateId || ''}
                onChange={(e) => update({ deathStateId: e.target.value || undefined })}
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[125px]"
              >
                <option value="">-- Aucun --</option>
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
                    const createdId = onQuickCreateState('Mort', 'Santé');
                    if (createdId) update({ deathStateId: createdId });
                  }}
                  className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                  title="Créer et lier l'état « Mort »"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              )}
              {b.deathStateId && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(b.deathStateId!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner l'état « Mort »"
                >
                  <Paintbrush className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        )}

        {(onDeath === 'restart_scene' || onDeath === 'change_scene') && (
          <div className="space-y-2 pt-1.5 border-t border-slate-100">
            {onDeath === 'change_scene' && (
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-700 text-[11px]">Scène cible</span>
                <select
                  value={b.deathTargetSceneId || scenes.find((s) => s.id !== activeSceneId)?.id || scenes[0]?.id || ''}
                  onChange={(e) => update({ deathTargetSceneId: e.target.value || undefined })}
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[160px]"
                >
                  {scenes.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                <span className="font-bold">Délai avant transition (anim. Mort)</span>
                <EditableNumericValue
                  value={b.deathDelaySec ?? 0}
                  unit="s"
                  precision={2}
                  onChange={(val) => update({ deathDelaySec: val })}
                  className="font-mono font-bold text-rose-600"
                />
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.1"
                value={Math.max(0, Math.min(5, b.deathDelaySec ?? 0))}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) update({ deathDelaySec: v });
                }}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-700 text-[11px]">Bloquer les contrôles pendant le délai</div>
                <div className="text-[9px] text-slate-400">Empêche de bouger durant l'animation de mort</div>
              </div>
              <input
                type="checkbox"
                checked={b.disableControlsOnDeath !== false}
                onChange={(e) => update({ disableControlsOnDeath: e.target.checked })}
                className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
              />
            </div>

            <div className="grid grid-cols-[1fr_76px] gap-1.5 items-end">
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Transition de scène</label>
                <select
                  value={b.deathSceneTransition || 'fade'}
                  onChange={(e) => update({ deathSceneTransition: e.target.value as SceneTransitionType })}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800"
                >
                  {SCENE_TRANSITION_OPTIONS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Durée (s)</label>
                <input
                  type="number"
                  step="any"
                  value={b.deathSceneTransitionDuration ?? 0.45}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    if (Number.isFinite(v)) update({ deathSceneTransitionDuration: v });
                  }}
                  className="w-full bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Afficher barre / cœurs en jeu */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Afficher les PV en Mode Play</div>
          <div className="text-[10px] text-slate-400">Cœurs / jauge au-dessus de l'objet</div>
        </div>
        <input
          type="checkbox"
          checked={b.showHealthBar !== false}
          onChange={(e) => update({ showHealthBar: e.target.checked })}
          className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
        />
      </div>
    </div>
  );
}

export function StrokeWiggleBehaviorControls({
  b,
  update,
}: {
  b: StrokeWiggleBehaviorConfig;
  update: (partial: any) => void;
}) {
  const initialGameVariables = useSceneStore((s) => s.initialGameVariables || EMPTY_RECORD);
  const variableNames = Array.from(new Set(['score', ...Object.keys(initialGameVariables)])).sort();
  const hasCustomStep = b.segmentStep !== undefined && b.segmentStep > 0;
  const hasVarBinding = Boolean(b.amplitudeVariableName || b.fpsVariableName);

  return (
    <div className="space-y-1.5">
      {/* Amplitude */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Amplitude du tremblement</span>
          <EditableNumericValue
            value={b.amplitude ?? 2.2}
            precision={1}
            onChange={(val) => update({ amplitude: val })}
            className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="0"
          max="15"
          step="0.2"
          value={Math.max(0, Math.min(15, b.amplitude ?? 2.2))}
          onChange={(e) => update({ amplitude: parseFloat(e.target.value) })}
          className="w-full accent-cyan-600 cursor-pointer"
        />
      </div>

      {/* Fréquence FPS */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Rythme (FPS)</span>
            <span className="text-[10px] text-slate-400 block">4–8 Hz recommandé pour un rendu crayonné naturel</span>
          </div>
          <EditableNumericValue
            value={b.fps ?? 6}
            unit="Hz"
            precision={0}
            onChange={(val) => update({ fps: val })}
            className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px] shrink-0"
          />
        </div>
        <input
          type="range"
          min="1"
          max="24"
          step="1"
          value={Math.max(1, Math.min(24, b.fps ?? 6))}
          onChange={(e) => update({ fps: parseInt(e.target.value, 10) })}
          className="w-full accent-cyan-600 cursor-pointer"
        />
      </div>

      {/* Nombre de variantes pré-calculées */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Variantes en boucle</span>
          <EditableNumericValue
            value={b.frameCount ?? 4}
            unit="tracés"
            precision={0}
            onChange={(val) => update({ frameCount: val })}
            className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px]"
          />
        </div>
        <input
          type="range"
          min="2"
          max="6"
          step="1"
          value={Math.max(2, Math.min(6, b.frameCount ?? 4))}
          onChange={(e) => update({ frameCount: parseInt(e.target.value, 10) })}
          className="w-full accent-cyan-600 cursor-pointer"
        />
      </div>

      {/* Finesse de subdivision (preset ou pas exact en px) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="font-bold text-slate-700 text-xs">Finesse de vibration</span>
          {hasCustomStep && (
            <button
              type="button"
              onClick={() => update({ segmentStep: undefined })}
              className="text-[10px] font-semibold text-cyan-700 hover:underline cursor-pointer"
            >
              Revenir aux préréglages
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'low', label: 'Douce', step: 28 },
            { id: 'medium', label: 'Normale', step: 16 },
            { id: 'high', label: 'Nerveuse', step: 10 },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ detail: opt.id, segmentStep: undefined })}
              className={`py-1 px-2 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                !hasCustomStep && (b.detail || 'medium') === opt.id
                  ? 'bg-cyan-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="pt-1">
          <div className="flex justify-between items-center text-[11px] text-slate-600 mb-0.5">
            <span>Pas exact (px)</span>
            <EditableNumericValue
              value={b.segmentStep ?? ((b.detail || 'medium') === 'low' ? 28 : (b.detail || 'medium') === 'high' ? 10 : 16)}
              unit="px"
              precision={0}
              displayText={
                hasCustomStep
                  ? `${b.segmentStep}px`
                  : `Auto (${(b.detail || 'medium') === 'low' ? 28 : (b.detail || 'medium') === 'high' ? 10 : 16}px)`
              }
              onChange={(val) => update({ segmentStep: val })}
              className="font-mono font-bold text-cyan-700"
            />
          </div>
          <input
            type="range"
            min="6"
            max="48"
            step="2"
            value={Math.max(
              6,
              Math.min(48, b.segmentStep ?? ((b.detail || 'medium') === 'low' ? 28 : (b.detail || 'medium') === 'high' ? 10 : 16))
            )}
            onChange={(e) => update({ segmentStep: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Contrôles avancés : Anisotropie verticale, Stabilité des bouts & Graine */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
            <span className="font-bold">Échelle verticale (Y / X)</span>
            <EditableNumericValue
              value={b.verticalScale ?? 1}
              precision={1}
              displayText={`×${(b.verticalScale ?? 1).toFixed(1)}`}
              onChange={(val) => update({ verticalScale: val })}
              className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px]"
            />
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={Math.max(0, Math.min(2, b.verticalScale ?? 1))}
            onChange={(e) => update({ verticalScale: parseFloat(e.target.value) })}
            className="w-full accent-cyan-600 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
            <div>
              <span className="font-bold">Stabilité des extrémités</span>
              <span className="text-[10px] text-slate-400 block">Ancre les bouts sur les traits ouverts</span>
            </div>
            <EditableNumericValue
              value={Math.round((b.endpointStability ?? 0) * 100)}
              unit="%"
              precision={0}
              onChange={(pct) => update({ endpointStability: pct / 100 })}
              className="font-mono font-bold text-cyan-700 bg-cyan-50 px-1.5 py-0.5 rounded text-[11px] shrink-0"
            />
          </div>
          <input
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={Math.max(0, Math.min(1, b.endpointStability ?? 0))}
            onChange={(e) => update({ endpointStability: parseFloat(e.target.value) })}
            className="w-full accent-cyan-600 cursor-pointer"
          />
        </div>

        <div>
          <div className="flex justify-between items-center text-xs text-slate-700 mb-0.5">
            <span className="font-bold">Graine aléatoire (Seed)</span>
            <div className="flex items-center gap-1.5">
              <EditableNumericValue
                value={b.seed ?? 0}
                precision={0}
                displayText={`#${b.seed ?? 0}`}
                onChange={(val) => update({ seed: val })}
                className="font-mono font-bold text-slate-600 text-[11px]"
              />
              <button
                type="button"
                onClick={() => update({ seed: Math.floor(Math.random() * 1000) })}
                className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-cyan-50 text-slate-700 hover:text-cyan-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer border border-slate-200"
                title="Générer une nouvelle graine"
              >
                <Dices className="w-3 h-3" /> Aléatoire
              </button>
            </div>
          </div>
          <input
            type="range"
            min="0"
            max="999"
            step="1"
            value={Math.max(0, Math.min(999, b.seed ?? 0))}
            onChange={(e) => update({ seed: parseInt(e.target.value, 10) })}
            className="w-full accent-cyan-600 cursor-pointer"
          />
        </div>
      </div>

      {/* Piloter par Variables (optionnel) */}
      <details
        open={hasVarBinding}
        className="p-2 bg-cyan-50/40 rounded-xl border border-cyan-200/80 space-y-1.5"
      >
        <summary className="text-xs font-bold text-cyan-900 cursor-pointer select-none flex items-center justify-between">
          <span>Piloter par Variables (optionnel)</span>
          {hasVarBinding && (
            <span className="text-[10px] font-mono bg-cyan-100 text-cyan-800 px-1.5 py-0.5 rounded">
              Actif
            </span>
          )}
        </summary>

        <datalist id="wiggle-vars-list">
          {variableNames.map((v) => (
            <option key={v} value={v} />
          ))}
        </datalist>

        <div className="pt-1.5 space-y-2">
          <div className="grid grid-cols-[1fr_76px] gap-1.5 items-end">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                Variable → Amplitude
              </label>
              <input
                type="text"
                list="wiggle-vars-list"
                placeholder="ex: tension"
                value={b.amplitudeVariableName || ''}
                onChange={(e) => update({ amplitudeVariableName: e.target.value.trim() || undefined })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                Mult.
              </label>
              <input
                type="number"
                step="any"
                value={b.amplitudeVariableMultiplier ?? 0.1}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) update({ amplitudeVariableMultiplier: v });
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
          </div>

          <div className="grid grid-cols-[1fr_76px] gap-1.5 items-end">
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                Variable → Cadence (FPS)
              </label>
              <input
                type="text"
                list="wiggle-vars-list"
                placeholder="ex: vitesse"
                value={b.fpsVariableName || ''}
                onChange={(e) => update({ fpsVariableName: e.target.value.trim() || undefined })}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                Mult.
              </label>
              <input
                type="number"
                step="any"
                value={b.fpsVariableMultiplier ?? 0.2}
                onChange={(e) => {
                  const v = parseFloat(e.target.value);
                  if (Number.isFinite(v)) update({ fpsVariableMultiplier: v });
                }}
                className="w-full bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-slate-800"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-500 leading-tight">
            En Play, s'ajoute à la valeur de base : <code className="font-mono">base + var × mult</code>.
          </p>
        </div>
      </details>

      {/* Options */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Animer aussi les formes remplies</div>
          <div className="text-[10px] text-slate-400">Désactivez pour ne faire vibrer que les traits</div>
        </div>
        <input
          type="checkbox"
          checked={b.affectFill !== false}
          onChange={(e) => update({ affectFill: e.target.checked })}
          className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Aperçu en mode Édition</div>
          <div className="text-[10px] text-slate-400">Permet de régler l'effet sans lancer Play</div>
        </div>
        <input
          type="checkbox"
          checked={Boolean(b.previewInEdit)}
          onChange={(e) => update({ previewInEdit: e.target.checked })}
          className="w-4 h-4 accent-cyan-600 rounded cursor-pointer"
        />
      </div>
    </div>
  );
}
