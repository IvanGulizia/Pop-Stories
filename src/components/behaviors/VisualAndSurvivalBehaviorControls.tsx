import React from 'react';
import { Paintbrush, Pencil, Sliders, X } from 'lucide-react';
import {
  CustomParticlePreset,
  CustomParticleUsageMode,
  Entity,
  EntityState,
  HealthBehaviorConfig,
  LookAtBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  ParticleShape,
} from '../../types';

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
                  <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[10px]">
                    {b.flipDeadzone ?? 12} px
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  step="2"
                  value={b.flipDeadzone ?? 12}
                  onChange={(e) => update({ flipDeadzone: parseInt(e.target.value, 10) || 0 })}
                  className="w-full accent-indigo-600 h-1.5"
                />
              </div>
            )}
          </div>

          {/* Ligne 3: Décalage angulaire */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Décalage d'angle</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.rotationOffset || 0}°
              </span>
            </div>
            <input
              type="range"
              min="-180"
              max="180"
              step="5"
              value={b.rotationOffset || 0}
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
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px] shrink-0">
                {isFreeCone ? 'Libre 360°' : `±${maxAngleVal}°`}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="180"
              step="5"
              value={maxAngleVal}
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
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {rx} px
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={rx}
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
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {ry} px
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="50"
              step="1"
              value={ry}
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
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.smoothSpeed || 0} °/s
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="720"
          step="30"
          value={b.smoothSpeed || 0}
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
          <span className="font-mono font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.rate ?? 14} part/s
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="40"
          step="1"
          value={b.rate ?? 14}
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
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.speed ?? 140} px/s
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="500"
          step="10"
          value={b.speed ?? 140}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 6: Taille */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Taille des particules</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.size ?? 6} px
          </span>
        </div>
        <input
          type="range"
          min="2"
          max="20"
          step="1"
          value={b.size ?? 6}
          onChange={(e) => update({ size: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 7: Durée de vie */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Durée de vie</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {(b.lifetime ?? 0.8).toFixed(1)} s
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="3.0"
          step="0.1"
          value={b.lifetime ?? 0.8}
          onChange={(e) => update({ lifetime: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 8: Gravité des particules */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Gravité / Flottaison</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.gravity ?? 160} px/s²
          </span>
        </div>
        <input
          type="range"
          min="-300"
          max="600"
          step="20"
          value={b.gravity ?? 160}
          onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 9: Direction */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Direction d'émission</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.angle ?? -90}°
          </span>
        </div>
        <input
          type="range"
          min="-180"
          max="180"
          step="5"
          value={b.angle ?? -90}
          onChange={(e) => update({ angle: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 10: Cône de dispersion */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Cône de dispersion</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.spread ?? 60}°
          </span>
        </div>
        <input
          type="range"
          min="5"
          max="360"
          step="5"
          value={b.spread ?? 60}
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
            value={b.offsetX ?? 0}
            onChange={(e) => update({ offsetX: parseFloat(e.target.value) || 0 })}
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
            value={b.offsetY ?? 0}
            onChange={(e) => update({ offsetY: parseFloat(e.target.value) || 0 })}
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
}: {
  b: HealthBehaviorConfig;
  update: (partial: any) => void;
  availableTags: string[];
  stateList: EntityState[];
}) {
  return (
    <div className="space-y-1.5">
      {/* Points de vie max */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Points de vie max (PV)</span>
          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.maxHp ?? 3} PV
          </span>
        </div>
        <input
          type="range"
          min="1"
          max="20"
          step="1"
          value={b.maxHp ?? 3}
          onChange={(e) => update({ maxHp: parseInt(e.target.value, 10) || 1 })}
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

      {/* Durée d'invincibilité */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Invincibilité après choc</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {(b.damageCooldown ?? 1.0).toFixed(1)} s
          </span>
        </div>
        <input
          type="range"
          min="0.2"
          max="4.0"
          step="0.1"
          value={b.damageCooldown ?? 1.0}
          onChange={(e) => update({ damageCooldown: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Recul (Knockback) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Recul au choc (Knockback)</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.knockbackForce ?? 220} px/s
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="600"
          step="20"
          value={b.knockbackForce ?? 220}
          onChange={(e) => update({ knockbackForce: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* État Blessé temporaire */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <div>
          <span className="font-bold text-slate-700 text-xs block">État « Blessé » (Optionnel)</span>
          <span className="text-[10px] text-slate-400">Protégé par le garde-fou pendant l'invincibilité</span>
        </div>
        <select
          value={b.hurtStateId || ''}
          onChange={(e) => update({ hurtStateId: e.target.value || undefined })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[140px]"
        >
          <option value="">-- Aucun --</option>
          {stateList.map((st) => (
            <option key={st.id} value={st.id}>
              {st.name}
            </option>
          ))}
        </select>
      </div>

      {/* État de retour après blessure */}
      {b.hurtStateId && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <div>
            <span className="font-bold text-slate-700 text-xs block">Retour après blessure</span>
            <span className="text-[10px] text-slate-400">Redonne la main au contrôleur</span>
          </div>
          <select
            value={b.recoverStateId || ''}
            onChange={(e) => update({ recoverStateId: e.target.value || undefined })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[140px]"
          >
            <option value="">État précédent (auto)</option>
            {stateList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Action à 0 PV */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Quand PV = 0</span>
        <select
          value={b.onDeath || 'destroy'}
          onChange={(e) => update({ onDeath: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="destroy">Détruire l'entité</option>
          <option value="change_state">Passer à un état (Mort)</option>
          <option value="none">Ne rien faire (0 PV)</option>
        </select>
      </div>

      {b.onDeath === 'change_state' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">État « Mort / K.O. »</span>
          <select
            value={b.deathStateId || ''}
            onChange={(e) => update({ deathStateId: e.target.value || undefined })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[140px]"
          >
            <option value="">-- Choisir --</option>
            {stateList.map((st) => (
              <option key={st.id} value={st.id}>
                {st.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
