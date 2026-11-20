import { AppSettings, GizmoCategoryId, GizmoSettings, GizmoVisibilityMode } from '../types';

export const DEFAULT_GIZMO_SETTINGS: GizmoSettings = {
  masterEnabled: true,
  onlySelected: false,
  categories: {
    hitboxes: 'edit',
    colliderLayers: 'edit',
    hierarchy: 'edit',
    lookAt: 'edit',
    puppetZones: 'edit',
    aiZones: 'edit',
    physicsVectors: 'edit',
    springsAndJiggle: 'edit',
    sliders: 'edit',
  },
};

export interface GizmoCategoryMeta {
  id: GizmoCategoryId;
  label: string;
  description: string;
  colorClass: string;
  dotColor: string;
}

export const GIZMO_CATEGORY_LIST: GizmoCategoryMeta[] = [
  {
    id: 'hitboxes',
    label: 'Hitboxes & Colliders',
    description: 'Formes de collision (Solide, Capteur, Désactivé, Délégation)',
    colorClass: 'text-emerald-700',
    dotColor: '#10b981',
  },
  {
    id: 'colliderLayers',
    label: 'Calques Colliders (Décor)',
    description: 'Murs, sols et zones capteurs dessinés sur la scène',
    colorClass: 'text-orange-700',
    dotColor: '#f97316',
  },
  {
    id: 'hierarchy',
    label: 'Hiérarchie & Pivots',
    description: 'Liens Parent → Enfant, pivots et décalages d’attachement',
    colorClass: 'text-indigo-700',
    dotColor: '#6366f1',
  },
  {
    id: 'springsAndJiggle',
    label: 'Ressorts, Laisses & Jiggle',
    description: 'Liens élastiques (damping/spring), cônes Jiggle ±angle, gravité et collisions',
    colorClass: 'text-fuchsia-700',
    dotColor: '#d946ef',
  },
  {
    id: 'lookAt',
    label: 'LookAt & Orbite Pupille',
    description: 'Axe de visée, cône limite ±angle, ellipse d’orbite et rayon cible',
    colorClass: 'text-cyan-700',
    dotColor: '#06b6d4',
  },
  {
    id: 'puppetZones',
    label: 'Zones Marionnette',
    description: 'Cercles d’approche (loin/proche), seuil chute et inclinaison',
    colorClass: 'text-violet-700',
    dotColor: '#8b5cf6',
  },
  {
    id: 'aiZones',
    label: 'Zones IA (Balade / Patrouille / Fuite)',
    description: 'Rayons de balade, fuite, suivi, segments de patrouille et cibles',
    colorClass: 'text-rose-700',
    dotColor: '#f43f5e',
  },
  {
    id: 'physicsVectors',
    label: 'Vecteurs & Émetteurs',
    description: 'Vitesse continue et cônes d’émission de particules',
    colorClass: 'text-amber-700',
    dotColor: '#f59e0b',
  },
  {
    id: 'sliders',
    label: 'Sliders & Glissières',
    description: 'Rails 1D, zones 2D (boîte/disque), crans et position de rappel',
    colorClass: 'text-sky-700',
    dotColor: '#0ea5e9',
  },
];

export function resolveGizmoSettings(settings?: AppSettings): GizmoSettings {
  const raw = settings?.gizmos;
  const legacyHitboxes: GizmoVisibilityMode =
    settings?.showColliderDebugGizmos === false && !raw ? 'off' : 'edit';

  return {
    masterEnabled: raw?.masterEnabled ?? DEFAULT_GIZMO_SETTINGS.masterEnabled,
    onlySelected: raw?.onlySelected ?? DEFAULT_GIZMO_SETTINGS.onlySelected,
    categories: {
      hitboxes: raw?.categories?.hitboxes ?? legacyHitboxes,
      colliderLayers: raw?.categories?.colliderLayers ?? DEFAULT_GIZMO_SETTINGS.categories.colliderLayers,
      hierarchy: raw?.categories?.hierarchy ?? DEFAULT_GIZMO_SETTINGS.categories.hierarchy,
      lookAt: raw?.categories?.lookAt ?? DEFAULT_GIZMO_SETTINGS.categories.lookAt,
      puppetZones: raw?.categories?.puppetZones ?? DEFAULT_GIZMO_SETTINGS.categories.puppetZones,
      aiZones: raw?.categories?.aiZones ?? DEFAULT_GIZMO_SETTINGS.categories.aiZones,
      physicsVectors: raw?.categories?.physicsVectors ?? DEFAULT_GIZMO_SETTINGS.categories.physicsVectors,
      springsAndJiggle: raw?.categories?.springsAndJiggle ?? DEFAULT_GIZMO_SETTINGS.categories.springsAndJiggle,
      sliders: raw?.categories?.sliders ?? DEFAULT_GIZMO_SETTINGS.categories.sliders,
    },
  };
}

export function isGizmoCategoryVisible(
  settings: AppSettings | undefined,
  category: GizmoCategoryId,
  isPlayMode: boolean
): boolean {
  const resolved = resolveGizmoSettings(settings);
  if (!resolved.masterEnabled) return false;
  const mode = resolved.categories[category] || 'off';
  if (mode === 'off') return false;
  if (mode === 'both') return true;
  return isPlayMode ? mode === 'play' : mode === 'edit';
}
