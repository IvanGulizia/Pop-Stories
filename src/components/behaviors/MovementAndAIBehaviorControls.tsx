import React from 'react';
import { ArrowDown, ArrowUp, Paintbrush, Plus, Trash2 } from 'lucide-react';
import {
  Entity,
  EntityState,
  FleeBehaviorConfig,
  FollowBehaviorConfig,
  MoveToBehaviorConfig,
  PatrolBehaviorConfig,
  PatrolMode,
  PatrolWaypoint,
  WanderingBehaviorConfig,
} from '../../types';
import { FlipControls, InertiaControls } from './BehaviorSharedControls';

export function PatrolBehaviorControls({
  b,
  update,
  targetEntityOptions = [],
}: {
  b: PatrolBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions?: Entity[];
}) {
  const patrolMode: PatrolMode = b.patrolMode || 'symmetric';
  const waypoints: PatrolWaypoint[] = b.waypoints || [];
  const pauseVal = b.pauseAtEnds ?? b.pauseDuration ?? 0.5;

  const addWaypoint = () => {
    const lastWp = waypoints[waypoints.length - 1];
    const nextWp: PatrolWaypoint = {
      id: `wp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
      mode: 'position',
      x: lastWp ? lastWp.x + 120 : 200,
      y: lastWp ? lastWp.y : 200,
      pauseSec: 0,
    };
    update({ waypoints: [...waypoints, nextWp] });
  };

  const updateWaypoint = (idx: number, patch: Partial<PatrolWaypoint>) => {
    const next = waypoints.map((wp, i) => (i === idx ? { ...wp, ...patch } : wp));
    update({ waypoints: next });
  };

  const removeWaypoint = (idx: number) => {
    update({ waypoints: waypoints.filter((_, i) => i !== idx) });
  };

  const moveWaypoint = (idx: number, dir: -1 | 1) => {
    const targetIdx = idx + dir;
    if (targetIdx < 0 || targetIdx >= waypoints.length) return;
    const next = [...waypoints];
    const [item] = next.splice(idx, 1);
    next.splice(targetIdx, 0, item);
    update({ waypoints: next });
  };

  return (
    <div className="space-y-1.5">
      {/* Ligne 0: Mode de patrouille */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
        <span className="font-bold text-slate-700 text-xs block">Mode de patrouille</span>
        <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
          {([
            { id: 'symmetric', label: 'Symétrique ↔' },
            { id: 'one_way_return', label: 'Aller-retour →' },
            { id: 'waypoints', label: 'Multi-points 📍' },
          ] as const).map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => update({ patrolMode: opt.id })}
              className={`py-1 px-1.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                patrolMode === opt.id
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'text-slate-600 hover:bg-white/70'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <p className="text-[10px] text-slate-400 leading-tight">
          {patrolMode === 'symmetric'
            ? 'Oscille symétriquement de -Distance à +Distance autour du point de départ.'
            : patrolMode === 'one_way_return'
            ? 'Part du point de départ (0) jusqu’à +Distance puis revient au départ.'
            : 'Suit une liste ordonnée de points (coordonnées ou entités de la scène).'}
        </p>
      </div>

      {patrolMode !== 'waypoints' ? (
        <>
          {/* Ligne 1: Axe de patrouille */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Axe d'oscillation</span>
            <select
              value={b.axis}
              onChange={(e) => update({ axis: e.target.value as any })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="horizontal">Horizontal (Gauche - Droite)</option>
              <option value="vertical">Vertical (Haut - Bas)</option>
            </select>
          </div>

          {/* Sens initial */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Sens initial</span>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg">
              <button
                type="button"
                onClick={() => update({ initialDirection: 1 })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  (b.initialDirection ?? 1) === 1 ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}
              >
                {b.axis === 'vertical' ? '↓ Bas (+)' : '→ Droite (+)'}
              </button>
              <button
                type="button"
                onClick={() => update({ initialDirection: -1 })}
                className={`px-2 py-0.5 rounded text-[10px] font-bold cursor-pointer ${
                  b.initialDirection === -1 ? 'bg-blue-600 text-white' : 'text-slate-600'
                }`}
              >
                {b.axis === 'vertical' ? '↑ Haut (-)' : '← Gauche (-)'}
              </button>
            </div>
          </div>

          {/* Ligne 2: Portée de patrouille */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Distance de patrouille</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.range} px
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="600"
              step="10"
              value={b.range}
              onChange={(e) => update({ range: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>
        </>
      ) : (
        /* Éditeur Multi-points (Waypoints) */
        <div className="p-2 bg-blue-50/40 rounded-xl border border-blue-200 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="font-bold text-blue-950 text-xs">Parcours ({waypoints.length} points)</span>
            <select
              value={b.waypointLoopMode || 'ping_pong'}
              onChange={(e) => update({ waypointLoopMode: e.target.value as any })}
              className="bg-white border border-blue-200 rounded-lg px-1.5 py-0.5 text-[10px] font-bold text-blue-800"
            >
              <option value="ping_pong">Aller-retour (Ping-Pong)</option>
              <option value="loop">Boucle fermée (1 → N → 1)</option>
            </select>
          </div>

          <div className="space-y-1.5">
            {waypoints.map((wp, idx) => {
              const wpMode = wp.mode || (wp.entityId ? 'entity' : 'position');
              return (
                <div key={wp.id} className="p-1.5 bg-white rounded-lg border border-slate-200 space-y-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </span>
                    <select
                      value={wpMode}
                      onChange={(e) => updateWaypoint(idx, { mode: e.target.value as 'position' | 'entity' })}
                      className="bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[10px] font-bold text-slate-700"
                    >
                      <option value="position">Position X / Y</option>
                      <option value="entity">Entité cible</option>
                    </select>
                    <div className="flex items-center gap-0.5">
                      <button
                        type="button"
                        onClick={() => moveWaypoint(idx, -1)}
                        disabled={idx === 0}
                        className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Monter"
                      >
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveWaypoint(idx, 1)}
                        disabled={idx === waypoints.length - 1}
                        className="p-0.5 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                        title="Descendre"
                      >
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeWaypoint(idx)}
                        className="p-0.5 text-slate-400 hover:text-rose-600 cursor-pointer"
                        title="Supprimer ce point"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {wpMode === 'entity' ? (
                    <select
                      value={wp.entityId || ''}
                      onChange={(e) => updateWaypoint(idx, { entityId: e.target.value || undefined })}
                      className="w-full bg-slate-50 border border-slate-200 rounded px-2 py-1 text-[11px] font-medium text-slate-800"
                    >
                      <option value="">-- Choisir une entité --</option>
                      {targetEntityOptions.map((ent) => (
                        <option key={ent.id} value={ent.id}>
                          {ent.name}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="grid grid-cols-3 gap-1">
                      <label className="text-[9px] font-bold text-slate-500">
                        X
                        <input
                          type="number"
                          value={Math.round(wp.x)}
                          onChange={(e) => updateWaypoint(idx, { x: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-800"
                        />
                      </label>
                      <label className="text-[9px] font-bold text-slate-500">
                        Y
                        <input
                          type="number"
                          value={Math.round(wp.y)}
                          onChange={(e) => updateWaypoint(idx, { y: parseFloat(e.target.value) || 0 })}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-800"
                        />
                      </label>
                      <label className="text-[9px] font-bold text-slate-500">
                        Pause (s)
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={wp.pauseSec ?? wp.pauseDuration ?? 0}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 0;
                            updateWaypoint(idx, { pauseSec: val, pauseDuration: val });
                          }}
                          className="w-full bg-slate-50 border border-slate-200 rounded px-1.5 py-0.5 text-[11px] font-mono font-bold text-slate-800"
                        />
                      </label>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <button
            type="button"
            onClick={addWaypoint}
            className="w-full py-1.5 bg-white hover:bg-blue-50 border border-dashed border-blue-300 rounded-lg text-[11px] font-bold text-blue-700 flex items-center justify-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Ajouter un point de passage</span>
          </button>
        </div>
      )}

      {/* Ligne 3: Vitesse de patrouille */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Vitesse de marche</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.speed} px/s
          </span>
        </div>
        <input
          type="range"
          min="20"
          max="300"
          step="10"
          value={b.speed}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 4: Pause aux bornes */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Pause aux bornes / points</span>
        <div className="flex items-center gap-1">
          <input
            type="number"
            min="0"
            max="10"
            step="0.1"
            value={pauseVal}
            onChange={(e) => {
              const v = parseFloat(e.target.value) || 0;
              update({ pauseDuration: v, pauseAtEnds: v });
            }}
            className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
          />
          <span className="text-slate-400 text-xs">sec</span>
        </div>
      </div>

      {/* Détections physiques (Murs & Bords de plateforme) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-bold text-slate-700 text-xs">Demi-tour sur mur / obstacle</div>
            <div className="text-[10px] text-slate-400">Inverse la direction si un obstacle solide bloque</div>
          </div>
          <input
            type="checkbox"
            checked={Boolean(b.turnOnWall)}
            onChange={(e) => update({ turnOnWall: e.target.checked })}
            className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
          />
        </div>

        {(patrolMode !== 'waypoints' && b.axis === 'horizontal') && (
          <div className="pt-1.5 border-t border-slate-100 space-y-1.5">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-700 text-xs">Détection du vide (Bords)</div>
                <div className="text-[10px] text-slate-400">Évite de tomber en bout de plateforme</div>
              </div>
              <input
                type="checkbox"
                checked={Boolean(b.detectLedges)}
                onChange={(e) => update({ detectLedges: e.target.checked })}
                className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
              />
            </div>
            {b.detectLedges && (
              <div>
                <div className="flex justify-between items-center text-[11px] text-slate-700">
                  <span>Profondeur de sonde</span>
                  <span className="font-mono font-bold text-blue-700">{b.ledgeCheckDepth ?? 28} px</span>
                </div>
                <input
                  type="range"
                  min="10"
                  max="80"
                  step="2"
                  value={b.ledgeCheckDepth ?? 28}
                  onChange={(e) => update({ ledgeCheckDepth: parseInt(e.target.value, 10) })}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>
            )}
          </div>
        )}
      </div>

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}

export function WanderingBehaviorControls({
  b,
  update,
}: {
  b: WanderingBehaviorConfig;
  update: (partial: any) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Mode de déplacement */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Type de déplacement</span>
        <select
          value={b.mode || 'free_2d'}
          onChange={(e) => update({ mode: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[180px]"
        >
          <option value="free_2d">Zone 2D (Toutes directions)</option>
          <option value="horizontal">Horizontal (Sol / Plateforme)</option>
        </select>
      </div>

      {/* Ligne 2: Rayon de la zone */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Rayon de la zone</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.radius ?? 160} px
          </span>
        </div>
        <input
          type="range"
          min="40"
          max="600"
          step="10"
          value={b.radius ?? 160}
          onChange={(e) => update({ radius: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 3: Vitesse */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Vitesse de déplacement</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.speed ?? 90} px/s
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="400"
          step="10"
          value={b.speed ?? 90}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 4: Niveau d'aléatoire (errance) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Aléatoire des virages</span>
            <span className="text-[10px] text-slate-400 block">
              {(b.randomness ?? 65) < 35
                ? 'Trajectoires douces et progressives'
                : (b.randomness ?? 65) > 70
                ? 'Changements de cap brusques et vifs'
                : 'Exploration naturelle équilibrée'}
            </span>
          </div>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.randomness ?? 65}%
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          value={b.randomness ?? 65}
          onChange={(e) => update({ randomness: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 5: Fréquence de changement de direction */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Intervalle de décision</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {(b.changeInterval ?? 1.5).toFixed(1)} s
          </span>
        </div>
        <input
          type="range"
          min="0.3"
          max="5"
          step="0.1"
          value={b.changeInterval ?? 1.5}
          onChange={(e) => update({ changeInterval: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 6: Pause aléatoire max */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Pause aléatoire max</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {(b.pauseDuration ?? 0.8).toFixed(1)} s
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="4"
          step="0.2"
          value={b.pauseDuration ?? 0.8}
          onChange={(e) => update({ pauseDuration: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 7: Orienter dans le sens du mouvement (uniquement mode 2D) */}
      {(b.mode || 'free_2d') === 'free_2d' && (
        <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
          <div>
            <div className="font-bold text-slate-700 text-xs">Orienter vers le trajet</div>
            <div className="text-[10px] text-slate-400">Fait pivoter l'objet face à sa direction</div>
          </div>
          <input
            type="checkbox"
            checked={b.orientToMovement === true}
            onChange={(e) => update({ orientToMovement: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
          />
        </div>
      )}

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0.78} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}

export function MoveToBehaviorControls({
  b,
  update,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
}: {
  b: MoveToBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Type de cible */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Type de cible</span>
        <select
          value={b.targetType}
          onChange={(e) => update({ targetType: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[190px]"
        >
          <option value="position">Position fixe (X, Y)</option>
          <option value="entity">Entité précise de la scène</option>
          <option value="nearest_type">Type d'objet le plus proche</option>
          <option value="nearest_tag">Tag le plus proche (#tag)</option>
        </select>
      </div>

      {/* Ligne 2: Entité cible, Type, Tag ou Coordonnées X, Y */}
      {b.targetType === 'entity' ? (
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
      ) : b.targetType === 'nearest_type' ? (
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
      ) : b.targetType === 'nearest_tag' ? (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Tag recherché</span>
          <div className="flex items-center gap-1">
            <input
              type="text"
              list={`tags-moveto-${b.id}`}
              placeholder="ex: cible, piece..."
              value={b.targetTag || ''}
              onChange={(e) => update({ targetTag: e.target.value.replace(/^#/, '') })}
              className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            />
            <datalist id={`tags-moveto-${b.id}`}>
              {availableTags.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>
          </div>
        </div>
      ) : (
        <>
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Coordonnée X cible</span>
            <input
              type="number"
              value={b.targetPosition?.x ?? 100}
              onChange={(e) =>
                update({
                  targetPosition: {
                    x: parseFloat(e.target.value) || 0,
                    y: b.targetPosition?.y ?? 100,
                  },
                })
              }
              className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
            />
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Coordonnée Y cible</span>
            <input
              type="number"
              value={b.targetPosition?.y ?? 100}
              onChange={(e) =>
                update({
                  targetPosition: {
                    x: b.targetPosition?.x ?? 100,
                    y: parseFloat(e.target.value) || 0,
                  },
                })
              }
              className="w-24 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
            />
          </div>
        </>
      )}

      {/* Ligne 3: Vitesse */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Vitesse de ralliement</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.speed || 120} px/s
          </span>
        </div>
        <input
          type="range"
          min="10"
          max="600"
          step="10"
          value={b.speed || 120}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}

export function FollowBehaviorControls({
  b,
  update,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
}: {
  b: FollowBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Cible à suivre */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Cible à suivre</span>
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
          <span className="font-bold text-slate-700 text-xs">Entité suivie</span>
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
            list={`tags-follow-${b.id}`}
            placeholder="ex: joueur, proie..."
            value={b.targetTag || ''}
            onChange={(e) => update({ targetTag: e.target.value.replace(/^#/, '') })}
            className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          />
          <datalist id={`tags-follow-${b.id}`}>
            {availableTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      )}

      {/* Ligne 3: Distance minimale d'arrêt */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <span className="font-bold">Distance minimale d'arrêt</span>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.minDistance} px
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="150"
          step="5"
          value={b.minDistance}
          onChange={(e) => update({ minDistance: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Ligne 4: Mode de poursuite (Vitesse constante vs Ressort élastique) */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Type de suivi</span>
        <select
          value={b.followMode || 'constant_speed'}
          onChange={(e) => update({ followMode: e.target.value as 'constant_speed' | 'spring' })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[190px]"
        >
          <option value="constant_speed">Vitesse constante</option>
          <option value="spring">Ressort / Damping élastique</option>
        </select>
      </div>

      {(b.followMode || 'constant_speed') === 'spring' ? (
        <div className="p-2 bg-violet-50/40 rounded-xl border border-violet-200 space-y-2">
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Raideur du ressort</span>
              <span className="font-mono font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded text-[11px]">
                {Math.round(b.springStiffness ?? 120)}
              </span>
            </div>
            <input
              type="range"
              min="20"
              max="450"
              step="10"
              value={b.springStiffness ?? 120}
              onChange={(e) => update({ springStiffness: parseFloat(e.target.value) })}
              className="w-full accent-violet-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Amortissement (Damping)</span>
              <span className="font-mono font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded text-[11px]">
                {(b.springDamping ?? 10).toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="1"
              max="35"
              step="0.5"
              value={b.springDamping ?? 10}
              onChange={(e) => update({ springDamping: parseFloat(e.target.value) })}
              className="w-full accent-violet-600"
            />
          </div>

          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Éloignement max (Laisse)</span>
              <span className="font-mono font-bold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded text-[11px]">
                {(b.springMaxDistance ?? 0) > 0 ? `${Math.round(b.springMaxDistance!)} px` : 'Libre'}
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="400"
              step="10"
              value={b.springMaxDistance ?? 0}
              onChange={(e) => update({ springMaxDistance: parseFloat(e.target.value) })}
              className="w-full accent-violet-600"
            />
          </div>
        </div>
      ) : (
        <>
          {/* Vitesse de suivi classique */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Vitesse de poursuite</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.speed} px/s
              </span>
            </div>
            <input
              type="range"
              min="30"
              max="400"
              step="10"
              value={b.speed}
              onChange={(e) => update({ speed: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0.8} update={update} />
        </>
      )}

      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}

export function FleeBehaviorControls({
  b,
  update,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  onQuickCreateState,
  onEditStateDrawing,
}: {
  b: FleeBehaviorConfig;
  update: (partial: any) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  onQuickCreateState: (suggestedName: string, folderName?: string) => string;
  onEditStateDrawing?: (stateId: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      {/* Ligne 1: Menace à fuir */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Menace à fuir</span>
        <select
          value={b.targetType || 'mouse'}
          onChange={(e) => update({ targetType: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[190px]"
        >
          <option value="mouse">Curseur / Souris</option>
          <option value="entity">Entité précise</option>
          <option value="nearest_type">Type d'objet le plus proche</option>
          <option value="nearest_tag">Tag le plus proche (#tag)</option>
        </select>
      </div>

      {b.targetType === 'entity' && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Entité crainte</span>
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
            list={`tags-flee-${b.id}`}
            placeholder="ex: danger, joueur..."
            value={b.targetTag || ''}
            onChange={(e) => update({ targetTag: e.target.value.replace(/^#/, '') })}
            className="w-32 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          />
          <datalist id={`tags-flee-${b.id}`}>
            {availableTags.map((t) => (
              <option key={t} value={t} />
            ))}
          </datalist>
        </div>
      )}

      {/* Rayon de fuite */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Rayon de détection (Fuite)</span>
            <span className="text-[10px] text-slate-400 block">
              {(b.fleeRadius ?? 220) === 0
                ? '0 = Fuit en permanence sans limite de distance'
                : `Fuit dès que la menace entre à moins de ${b.fleeRadius ?? 220} px`}
            </span>
          </div>
          <span className="font-mono font-bold text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded text-[11px]">
            {(b.fleeRadius ?? 220) === 0 ? '∞' : `${b.fleeRadius ?? 220} px`}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="600"
          step="10"
          value={b.fleeRadius ?? 220}
          onChange={(e) => update({ fleeRadius: parseFloat(e.target.value) })}
          className="w-full accent-rose-500"
        />
      </div>

      {/* Vitesse de fuite */}
      <div className="p-2 bg-white rounded-xl border border-slate-200">
        <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
          <div>
            <span className="font-bold">Vitesse de fuite</span>
            <span className="text-[10px] text-slate-400 block">
              {(b.speed ?? 160) === 0
                ? '0 = Peur sur place (réaction visuelle sans bouger)'
                : 'Vitesse de recul lorsque la menace approche'}
            </span>
          </div>
          <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
            {b.speed ?? 160} px/s
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="500"
          step="10"
          value={b.speed ?? 160}
          onChange={(e) => update({ speed: parseFloat(e.target.value) })}
          className="w-full accent-indigo-600"
        />
      </div>

      {/* Axe de fuite */}
      <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
        <span className="font-bold text-slate-700 text-xs">Axe de déplacement</span>
        <select
          value={b.axisMode || 'free_2d'}
          onChange={(e) => update({ axisMode: e.target.value as any })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
        >
          <option value="free_2d">Zone 2D (Toutes directions)</option>
          <option value="horizontal">Horizontal (Sol / Plateforme)</option>
        </select>
      </div>

      {/* Suspendre la peur pendant le drag */}
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Suspendre la peur pendant le Drag</div>
          <div className="text-[10px] text-slate-400">Évite de fuir ou d'écraser les états quand on l'attrape</div>
        </div>
        <input
          type="checkbox"
          checked={b.pauseWhileDragged !== false}
          onChange={(e) => update({ pauseWhileDragged: e.target.checked })}
          className="w-4 h-4 accent-rose-500 rounded cursor-pointer"
        />
      </div>

      {/* États visuels (Conscience / Peur — Garde-fou actif) */}
      <div className="p-2.5 bg-rose-50/70 rounded-xl border border-rose-200 space-y-2">
        <div>
          <div className="text-[11px] font-extrabold text-rose-800 uppercase tracking-wider">
            États visuels (Conscience / Peur)
          </div>
          <div className="text-[10px] text-rose-600/90 leading-snug">
            Garde-fou actif : bascule uniquement si l'entité est dans l'un de ces deux états (n'écrase jamais Drag, Survol, Blessé…).
          </div>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-rose-100">
            <span className="text-[11px] font-bold text-slate-700">État Calme (Hors rayon)</span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={b.stateBindings?.calmStateId || ''}
                onChange={(e) =>
                  update({
                    stateBindings: {
                      ...(b.stateBindings || {}),
                      calmStateId: e.target.value || undefined,
                    },
                  })
                }
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
              >
                <option value="">-- Non défini --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const createdId = onQuickCreateState('Calme', 'Expressions');
                  if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), calmStateId: createdId } });
                }}
                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                title="Créer et lier l'état « Calme »"
              >
                <Plus className="w-3 h-3" />
              </button>
              {b.stateBindings?.calmStateId && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(b.stateBindings!.calmStateId!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
          <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-rose-100">
            <span className="text-[11px] font-bold text-slate-700">État Apeuré (Menace proche)</span>
            <div className="flex items-center gap-1 shrink-0">
              <select
                value={b.stateBindings?.scaredStateId || ''}
                onChange={(e) =>
                  update({
                    stateBindings: {
                      ...(b.stateBindings || {}),
                      scaredStateId: e.target.value || undefined,
                    },
                  })
                }
                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[140px]"
              >
                <option value="">-- Non défini --</option>
                {stateList.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => {
                  const createdId = onQuickCreateState('Apeuré', 'Expressions');
                  if (createdId) update({ stateBindings: { ...(b.stateBindings || {}), scaredStateId: createdId } });
                }}
                className="p-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg cursor-pointer"
                title="Créer et lier l'état « Apeuré »"
              >
                <Plus className="w-3 h-3" />
              </button>
              {b.stateBindings?.scaredStateId && onEditStateDrawing && (
                <button
                  type="button"
                  onClick={() => onEditStateDrawing(b.stateBindings!.scaredStateId!)}
                  className="p-1 bg-slate-50 hover:bg-indigo-100 text-indigo-700 border border-slate-200 rounded-lg cursor-pointer"
                  title="Dessiner cet état"
                >
                  <Paintbrush className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <InertiaControls acceleration={b.acceleration} damping={b.damping} defaultDamping={0.85} update={update} />
      <FlipControls flipOnMove={b.flipOnMove} flipInvert={b.flipInvert} update={update} />
    </div>
  );
}
