import React from 'react';
import { FolderOpen, MapPin, Paintbrush, Sliders, Sparkles } from 'lucide-react';
import {
  CustomParticlePreset,
  ParticleAnchorPreset,
  ParticleColorMode,
  ParticleDirectionMode,
  ParticleEffectConfig,
  ParticleEffectPreset,
  ParticleEmissionShape,
  ParticleShape,
} from '../../types';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import { remapPresetConfigSprites } from './ParticlePresetLibrary';
import { ParticleOriginDraft } from './ParticleActionOriginSection';

interface QuickBurstPreset {
  label: string;
  count: number;
  color: string;
  color2: string;
  shape: ParticleShape;
  speed: number;
  gravity: number;
  spread: number;
}

const QUICK_BURST_PRESETS: QuickBurstPreset[] = [
  {
    label: '🔥 Étincelles',
    count: 16,
    color: '#f59e0b',
    color2: '#ef4444',
    shape: 'spark',
    speed: 220,
    gravity: 280,
    spread: 140,
  },
  {
    label: '💥 Explosion',
    count: 28,
    color: '#ef4444',
    color2: '#fbbf24',
    shape: 'circle',
    speed: 260,
    gravity: 180,
    spread: 360,
  },
  {
    label: '✨ Magie',
    count: 20,
    color: '#8b5cf6',
    color2: '#ec4899',
    shape: 'star',
    speed: 140,
    gravity: -60,
    spread: 360,
  },
  {
    label: '🎉 Confettis',
    count: 32,
    color: '#10b981',
    color2: '#3b82f6',
    shape: 'square',
    speed: 210,
    gravity: 240,
    spread: 180,
  },
];

const SHAPE_LABELS: Record<ParticleShape, string> = {
  circle: 'Rond',
  square: 'Carré',
  spark: 'Étincelle',
  star: 'Étoile',
  custom: 'Dessin custom ✨',
};

const ORIGIN_LABELS: Record<string, string> = {
  subject: 'Sujet',
  target: 'Cible touchée',
  event_point: 'Point exact (événement)',
  mouse: 'Curseur souris',
  coordinates: 'Coordonnées (X, Y)',
  entity: 'Entité ciblée',
  type: 'Par type d’objet',
  tag: 'Par #Tag',
  last_spawned: 'Dernier objet créé',
};

const ANCHOR_LABELS: Record<ParticleAnchorPreset, string> = {
  center: 'Centre',
  top: 'Haut',
  bottom: 'Bas',
  left: 'Gauche',
  right: 'Droite',
  top_left: 'Haut gauche',
  top_right: 'Haut droite',
  bottom_left: 'Bas gauche',
  bottom_right: 'Bas droite',
  pivot: 'Pivot',
};

const DIRECTION_LABELS: Record<ParticleDirectionMode, string> = {
  angle: 'Angle fixe',
  facing: 'Sens entité',
  mouse: 'Vers souris',
  toward_target: 'Vers cible',
  away_target: 'Opposé à cible',
};

const ZONE_LABELS: Record<ParticleEmissionShape, string> = {
  point: 'Point',
  circle: 'Disque',
  box: 'Rectangle',
};

const COLOR_MODE_LABELS: Record<ParticleColorMode, string> = {
  single: '1 couleur',
  two_colors: 'Mix 2',
  gradient_lifetime: 'Dégradé vie',
};

export interface ParticleSummarySnapshot {
  shape: ParticleShape;
  customParticleIds?: string[];
  color: string;
  color2?: string;
  colorMode?: ParticleColorMode;
  rate?: number;
  rateMax?: number;
  count?: number;
  countMax?: number;
  speed: number;
  speedMax?: number;
  size: number;
  sizeMax?: number;
  lifetime: number;
  lifetimeMax?: number;
  gravity: number;
  spread: number;
  angle: number;
  directionMode?: ParticleDirectionMode;
  emissionShape?: ParticleEmissionShape;
  anchor?: ParticleAnchorPreset;
  offsetX?: number;
  offsetY?: number;
  emitterDuration?: number;
  emitterLoop?: boolean;
  initialBurstCount?: number;
  burstInterval?: number;
  burstCount?: number;
}

interface ParticleInspectorSummaryProps {
  mode: 'emitter' | 'burst';
  summary: ParticleSummarySnapshot;
  originDraft?: ParticleOriginDraft;
  allowTarget?: boolean;
  customParticles: CustomParticlePreset[];
  onOpenStudio: (initialView?: 'studio' | 'draw_custom') => void;
  onApplySavedPreset: (mapped: ParticleEffectConfig) => void;
  onApplyQuickBurstPreset?: (preset: QuickBurstPreset) => void;
  onQuickChangeOriginMode?: (nextMode: NonNullable<ParticleOriginDraft['particleOriginMode']>) => void;
}

function fmtRange(minVal: number, maxVal?: number, unit = ''): string {
  if (maxVal !== undefined && Number.isFinite(maxVal) && maxVal !== minVal) {
    return `${minVal}–${maxVal}${unit}`;
  }
  return `${minVal}${unit}`;
}

export const ParticleInspectorSummary: React.FC<ParticleInspectorSummaryProps> = ({
  mode,
  summary,
  originDraft,
  allowTarget = false,
  customParticles,
  onOpenStudio,
  onApplySavedPreset,
  onApplyQuickBurstPreset,
  onQuickChangeOriginMode,
}) => {
  const projectPresets = useSceneStore((s) => s.projectParticlePresets || EMPTY_LIST);
  const localCollection = useSceneStore((s) => s.localParticleCollection || EMPTY_RECORD);
  const importEmbeddedParticleSprites = useSceneStore((s) => s.importEmbeddedParticleSprites);

  const allSavedPresets: { scope: string; preset: ParticleEffectPreset }[] = [
    ...projectPresets.map((preset) => ({ scope: 'Projet', preset })),
    ...Object.values(localCollection).map((preset) => ({ scope: 'Globale', preset })),
  ];

  const selectedCustomPresets =
    summary.shape === 'custom' && summary.customParticleIds && summary.customParticleIds.length > 0
      ? summary.customParticleIds
          .map((id) => customParticles.find((p) => p.id === id))
          .filter((p): p is CustomParticlePreset => Boolean(p))
      : [];

  const c1 = summary.color || '#f59e0b';
  const c2 = summary.colorMode === 'single' ? c1 : summary.color2 || c1;
  const originMode = originDraft?.particleOriginMode || 'subject';
  const timedDuration = summary.emitterDuration ?? 0;

  return (
    <div className="space-y-2">
      {/* CTA Principal vers le Studio Particules Unifié */}
      <button
        type="button"
        onClick={() => onOpenStudio('studio')}
        className="w-full py-2.5 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
      >
        <Sliders className="w-4 h-4" />
        <span>Ouvrir le Studio Particules &amp; Collection</span>
      </button>

      {/* Présets instantanés pour les actions d'événement */}
      {mode === 'burst' && onApplyQuickBurstPreset && (
        <div className="flex flex-wrap gap-1.5">
          {QUICK_BURST_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              onClick={() => onApplyQuickBurstPreset(preset)}
              className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-[11px] font-bold text-amber-900 cursor-pointer transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      )}

      {/* Sélecteur rapide depuis la Collection enregistrée */}
      {allSavedPresets.length > 0 && (
        <div className="p-2 bg-amber-50/70 rounded-xl border border-amber-200 flex items-center justify-between gap-2">
          <span className="font-bold text-amber-950 text-[11px] flex items-center gap-1.5 shrink-0">
            <FolderOpen className="w-3.5 h-3.5 text-amber-600" />
            <span>Appliquer recette</span>
          </span>
          <select
            value=""
            onChange={(e) => {
              const found = allSavedPresets.find(
                (x) => `${x.scope}:${x.preset.id}` === e.target.value
              );
              if (!found) return;
              const mapped = remapPresetConfigSprites(
                found.preset.config,
                found.preset.embeddedCustomSprites,
                importEmbeddedParticleSprites
              );
              onApplySavedPreset(mapped);
            }}
            className="bg-white border border-amber-300 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 max-w-[180px]"
          >
            <option value="">-- Choisir ({allSavedPresets.length}) --</option>
            {allSavedPresets.map(({ scope, preset }) => (
              <option key={`${scope}:${preset.id}`} value={`${scope}:${preset.id}`}>
                [{scope}] {preset.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Source rapide pour l'action d'événement */}
      {mode === 'burst' && originDraft && onQuickChangeOriginMode && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-[11px] flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-amber-500" />
            <span>Source d&apos;émission</span>
          </span>
          <select
            value={originMode}
            onChange={(e) =>
              onQuickChangeOriginMode(
                e.target.value as NonNullable<ParticleOriginDraft['particleOriginMode']>
              )
            }
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-semibold text-slate-800 max-w-[190px]"
          >
            <option value="subject">Sujet</option>
            {allowTarget && <option value="target">Cible touchée</option>}
            <option value="event_point">Point exact (Collision / Clic)</option>
            <option value="mouse">Position du curseur</option>
            <option value="coordinates">Coordonnées (X, Y)</option>
            <option value="entity">Entité de la scène</option>
            <option value="type">Par Type d&apos;objet</option>
            <option value="tag">Par #Tag</option>
            <option value="last_spawned">Dernier objet créé</option>
          </select>
        </div>
      )}

      {/* Résumé lisible de la configuration active */}
      <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <span
              className="w-5 h-5 rounded-full shrink-0 border border-black/15 shadow-2xs"
              style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
            />
            <div className="min-w-0">
              <div className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5 truncate">
                <Sparkles className="w-3 h-3 text-amber-500 shrink-0" />
                <span>{SHAPE_LABELS[summary.shape || 'circle']}</span>
                {summary.colorMode && (
                  <span className="text-[10px] font-semibold text-slate-400">
                    ({COLOR_MODE_LABELS[summary.colorMode]})
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 truncate">
                {mode === 'emitter'
                  ? `Débit ${fmtRange(summary.rate ?? 14, summary.rateMax, ' /s')}`
                  : `${fmtRange(summary.count ?? 20, summary.countMax, ' part.')}`}
                {' • '}
                Vitesse {fmtRange(summary.speed, summary.speedMax, ' px/s')}
                {' • '}
                Taille {fmtRange(summary.size, summary.sizeMax, ' px')}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onOpenStudio('draw_custom')}
            className="px-2 py-1 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer shrink-0"
            title="Dessiner une nouvelle particule personnalisée dans le Studio"
          >
            <Paintbrush className="w-3 h-3" />
            <span>Dessiner</span>
          </button>
        </div>

        {/* Aperçu miniature des sprites custom sélectionnés */}
        {selectedCustomPresets.length > 0 && (
          <div className="flex items-center gap-1.5 pt-1 border-t border-slate-100 overflow-x-auto">
            {selectedCustomPresets.slice(0, 5).map((preset) => (
              <div
                key={preset.id}
                className="w-7 h-7 rounded-lg bg-slate-50 border border-amber-200 flex items-center justify-center shrink-0"
                title={preset.name}
              >
                <svg viewBox="0 0 100 100" className="w-5 h-5">
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
            ))}
            {selectedCustomPresets.length > 5 && (
              <span className="text-[10px] font-bold text-amber-700">
                +{selectedCustomPresets.length - 5}
              </span>
            )}
          </div>
        )}

        {/* Badges condensés : durée de vie, gravité, direction, ancrage, cycle */}
        <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100 text-[10px] font-semibold text-slate-600">
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
            Vie {fmtRange(summary.lifetime, summary.lifetimeMax, 's')}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
            Gravité {summary.gravity}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
            {DIRECTION_LABELS[summary.directionMode || 'angle']}
            {(summary.directionMode || 'angle') === 'angle' ? ` (${summary.angle}°)` : ''}
            {` • Cône ${summary.spread}°`}
          </span>
          <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
            Zone: {ZONE_LABELS[summary.emissionShape || 'point']}
          </span>
          {mode === 'emitter' ? (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
              Ancre: {ANCHOR_LABELS[summary.anchor || 'center']}
              {(summary.offsetX || summary.offsetY)
                ? ` (${summary.offsetX ?? 0}, ${summary.offsetY ?? 0})`
                : ''}
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-md bg-slate-100">
              Origine: {ORIGIN_LABELS[originMode] || originMode}
            </span>
          )}
          {timedDuration > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900">
              Cycle {timedDuration}s{mode === 'emitter' && summary.emitterLoop !== false ? ' (boucle)' : ''}
            </span>
          )}
          {(summary.burstInterval ?? 0) > 0 && (
            <span className="px-1.5 py-0.5 rounded-md bg-amber-100 text-amber-900">
              Salve /{summary.burstInterval}s ({summary.burstCount ?? 12}×)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
