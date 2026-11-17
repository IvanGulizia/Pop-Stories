import {
  DynamicRule,
  Entity,
  EntityId,
  ProjectPaletteColor,
  RuleFolder,
  SceneLayerGroup,
} from '../types';

export const EMPTY_RECORD: Record<string, never> = {};
export const EMPTY_LIST: never[] = [];
export const DEFAULT_SCENE_BOUNDS = { width: 800, height: 500 };

export const DEFAULT_PROJECT_PALETTE: ProjectPaletteColor[] = [
  { id: 'pal-1', name: 'Noir encre', color: '#000000' },
  { id: 'pal-2', name: 'Blanc pur', color: '#ffffff' },
  { id: 'pal-3', name: 'Gris ardoise', color: '#475569' },
  { id: 'pal-4', name: 'Gris perle', color: '#94a3b8' },
  { id: 'pal-5', name: 'Rouge vif', color: '#ef4444' },
  { id: 'pal-6', name: 'Orange ambré', color: '#f97316' },
  { id: 'pal-7', name: 'Jaune or', color: '#f59e0b' },
  { id: 'pal-8', name: 'Citron vert', color: '#84cc16' },
  { id: 'pal-9', name: 'Émeraude', color: '#10b981' },
  { id: 'pal-10', name: 'Sarcelle', color: '#14b8a6' },
  { id: 'pal-11', name: 'Cyan azur', color: '#06b6d4' },
  { id: 'pal-12', name: 'Bleu océan', color: '#3b82f6' },
  { id: 'pal-13', name: 'Indigo', color: '#6366f1' },
  { id: 'pal-14', name: 'Violet', color: '#8b5cf6' },
  { id: 'pal-15', name: 'Rose vif', color: '#ec4899' },
  { id: 'pal-16', name: 'Terre de Sienne', color: '#92400e' },
];

// Groupes de calques initiaux de la scène
export const initialSceneLayerGroups: SceneLayerGroup[] = [
  {
    id: 'group-bg',
    name: 'Arrière-plan (Background)',
    kind: 'background',
    isCollapsed: false,
    layers: [
      {
        id: 'layer-bg-1',
        name: 'Fond décoratif #1',
        visible: true,
        opacity: 1,
        parallaxFactor: 0,
        coordinateSpace: 'world',
        role: 'visual',
        vectorPaths: [],
      },
    ],
  },
  {
    id: 'group-col',
    name: 'Colliders de Décor (Murs / Sols)',
    kind: 'collider',
    isCollapsed: false,
    layers: [],
  },
  {
    id: 'group-fg',
    name: 'Premier-plan (Foreground)',
    kind: 'foreground',
    isCollapsed: false,
    layers: [],
  },
];

// État initial
export const initialEntities: Record<EntityId, Entity> = {
  'plant-1': {
    id: 'plant-1',
    name: 'Plante Magique',
    type: 'plant',
    tags: ['plante', 'nature'],
    position: { x: 420, y: 260 },
    size: { width: 256, height: 256 },
    currentStateId: 'pousse',
    isDraggable: false,
    states: {
      pousse: {
        id: 'pousse',
        name: 'Jeune Pousse',
        color: '#22c55e',
        scale: 0.85,
        rotation: 0,
        stemHeight: 30,
        flowerColor: '#f472b6',
        flowerPetals: 0,
      },
      fleur: {
        id: 'fleur',
        name: 'Grande Fleur',
        color: '#16a34a',
        scale: 1.15,
        rotation: 0,
        stemHeight: 85,
        flowerColor: '#ec4899',
        flowerPetals: 8,
      },
    },
  },
  'apple-1': {
    id: 'apple-1',
    name: 'Pomme Rouge',
    type: 'apple',
    tags: ['nourriture', 'fruit'],
    position: { x: 140, y: 160 },
    size: { width: 256, height: 256 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Normal',
        color: '#ef4444',
        scale: 1.0,
        rotation: 0,
      },
      croquee: {
        id: 'croquee',
        name: 'Croquée',
        color: '#dc2626',
        scale: 0.85,
        rotation: -12,
      },
    },
  },
};

export const defaultCustomArchetypes: Record<string, Entity> = {
  plant: {
    id: 'plant-archetype',
    name: 'Plante',
    type: 'plant',
    tags: ['plante', 'nature'],
    position: { x: 0, y: 0 },
    size: { width: 256, height: 256 },
    currentStateId: 'pousse',
    isDraggable: false,
    states: {
      pousse: {
        id: 'pousse',
        name: 'Jeune Pousse',
        color: '#22c55e',
        scale: 0.85,
        rotation: 0,
        stemHeight: 30,
        flowerColor: '#f472b6',
        flowerPetals: 0,
      },
      fleur: {
        id: 'fleur',
        name: 'Grande Fleur',
        color: '#16a34a',
        scale: 1.15,
        rotation: 0,
        stemHeight: 85,
        flowerColor: '#ec4899',
        flowerPetals: 8,
      },
    },
  },
  apple: {
    id: 'apple-archetype',
    name: 'Pomme',
    type: 'apple',
    tags: ['nourriture', 'fruit'],
    position: { x: 0, y: 0 },
    size: { width: 256, height: 256 },
    currentStateId: 'default',
    isDraggable: false,
    states: {
      default: {
        id: 'default',
        name: 'Normal',
        color: '#ef4444',
        scale: 1.0,
        rotation: 0,
      },
      croquee: {
        id: 'croquee',
        name: 'Croquée',
        color: '#dc2626',
        scale: 0.85,
        rotation: -12,
      },
    },
  },
  custom: {
    id: 'star-archetype',
    name: 'Étoile',
    type: 'custom',
    tags: ['magique', 'etoile'],
    position: { x: 0, y: 0 },
    size: { width: 70, height: 70 },
    currentStateId: 'default',
    isDraggable: false,
    icon: '⭐',
    states: {
      default: {
        id: 'default',
        name: 'Calme',
        color: '#eab308',
        scale: 1,
        rotation: 0,
      },
      brillant: {
        id: 'brillant',
        name: 'Étincelant',
        color: '#facc15',
        scale: 1.3,
        rotation: 45,
      },
    },
  },
};

export const initialFolders: RuleFolder[] = [
  { id: 'folder-interactions', name: 'Interactions & Contacts', color: 'indigo', isCollapsed: false },
  { id: 'folder-clicks', name: 'Contrôles & Clics', color: 'amber', isCollapsed: false },
  { id: 'folder-effects', name: 'Effets & Sons', color: 'emerald', isCollapsed: false },
];

export const initialRules: DynamicRule[] = [
  {
    id: 'rule-plant-bloom',
    name: 'Floraison de toutes les plantes au contact de la nourriture',
    enabled: true,
    folderId: 'folder-interactions',
    trigger: {
      type: 'collision',
      phase: 'enter',
      subjectMode: 'type',
      subjectType: 'apple', // Toutes les pommes
      targetMode: 'type',
      targetType: 'plant', // Toutes les plantes
    },
    actions: [
      {
        id: 'act-1',
        type: 'change_state',
        targetMode: 'target', // Modifie la plante qui touche la pomme
        targetStateId: 'fleur',
      },
    ],
  },
];
