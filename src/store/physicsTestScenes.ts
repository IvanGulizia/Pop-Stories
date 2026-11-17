import {
  DynamicRule,
  Entity,
  EntityId,
  EntityPivot,
  SceneLayerGroup,
  VectorPath,
} from '../types';
import { computeRelativeParentOffset } from './parentingHelpers';
import { DEFAULT_PROJECT_PALETTE, initialFolders, initialSceneLayerGroups } from './storeDefaults';

export type PhysicsTestSceneId =
  | 'jiggle-chain'
  | 'physics-joint-pendulum'
  | 'follow-spring-drag';

export interface PhysicsTestSceneDescriptor {
  id: PhysicsTestSceneId;
  title: string;
  subtitle: string;
  keyParams: string[];
}

export const PHYSICS_TEST_SCENE_DESCRIPTORS: PhysicsTestSceneDescriptor[] = [
  {
    id: 'jiggle-chain',
    title: 'Chaîne Jiggle (3 maillons)',
    subtitle: 'Tête déplaçable + chaîne A→B→C avec angle de départ hors repos',
    keyParams: [
      'Pivots haut-centre (0.5, 0) sur chaque maillon',
      'Angle de départ (+55° / -45° / +35°) → Ressort vers repos (0°)',
      'Raideur dégressive (180 → 130 → 95), Inertie (1.4 → 2.2)',
    ],
  },
  {
    id: 'physics-joint-pendulum',
    title: 'Joint Physique + Collisions',
    subtitle: 'Pendule articulé (physics_joint) + sol, rebords et caisses physiques',
    keyParams: [
      'Attachement Joint Physique (raideur 420, amortissement 8)',
      'Pesanteur locale 450–520 px/s² + collisions monde actives',
      'Caisses dynamiques au sol pour tester les chocs en direct',
    ],
  },
  {
    id: 'follow-spring-drag',
    title: 'Suivi Temps Réel (Drag + Follow)',
    subtitle: 'Glissez la Cible : le suiveur ressort et LookAt réagissent sans relâcher',
    keyParams: [
      'Follow mode Ressort (min 65px, laisse max 210px, K=150, D=8.5)',
      'LookAt rotation instantanée + Pupille Orbite sur la Cible',
      'Suivi continu à 60 FPS pendant le glisser-déposer',
    ],
  },
];

function cloneBaseLayerGroups(): SceneLayerGroup[] {
  return JSON.parse(JSON.stringify(initialSceneLayerGroups));
}

function makeCircleSvg(fill: string, stroke: string, innerDetail?: VectorPath[]): VectorPath[] {
  return [
    {
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      d: 'M 100 16 A 84 84 0 1 0 100 184 A 84 84 0 1 0 100 16 Z',
      stroke,
      strokeWidth: 7,
      fill,
    },
    ...(innerDetail || []),
  ];
}

function makeCapsuleSvg(fill: string, stroke: string, withBoltDot = true): VectorPath[] {
  const paths: VectorPath[] = [
    {
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      d: 'M 62 14 L 138 14 Q 160 14 160 36 L 160 164 Q 160 186 138 186 L 62 186 Q 40 186 40 164 L 40 36 Q 40 14 62 14 Z',
      stroke,
      strokeWidth: 8,
      fill,
    },
  ];
  if (withBoltDot) {
    paths.push({
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      d: 'M 100 14 A 10 10 0 1 0 100 34 A 10 10 0 1 0 100 14 Z',
      stroke,
      strokeWidth: 4,
      fill: '#ffffff',
    });
  }
  return paths;
}

function makePointerEyeSvg(fill: string, stroke: string): VectorPath[] {
  return [
    {
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      d: 'M 100 18 A 82 82 0 1 0 100 182 A 82 82 0 1 0 100 18 Z',
      stroke,
      strokeWidth: 7,
      fill,
    },
    {
      id: `p-${Math.random().toString(36).slice(2, 8)}`,
      d: 'M 100 100 L 174 100 M 152 80 L 178 100 L 152 120',
      stroke: '#0f172a',
      strokeWidth: 9,
      fill: 'none',
    },
  ];
}

export interface BuiltPhysicsTestScene {
  entities: Record<EntityId, Entity>;
  entityOrder: EntityId[];
  layerGroups: SceneLayerGroup[];
  rules: DynamicRule[];
  selectedEntityId: EntityId;
  projectPalette: typeof DEFAULT_PROJECT_PALETTE;
  folders: typeof initialFolders;
}

export function buildPhysicsTestScene(presetId: PhysicsTestSceneId): BuiltPhysicsTestScene {
  const layerGroups = cloneBaseLayerGroups();
  const entities: Record<EntityId, Entity> = {};
  const entityOrder: EntityId[] = [];
  let selectedEntityId = '';

  if (presetId === 'jiggle-chain') {
    const head: Entity = {
      id: 'test-jiggle-head',
      name: 'Tête (Glisser)',
      type: 'test_jiggle_head',
      tags: ['test', 'draggable'],
      position: { x: 355, y: 70 },
      size: { width: 90, height: 90 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: true,
      vectorPaths: makeCircleSvg('#6366f1', '#312e81', [
        { id: 'eye-l', d: 'M 72 82 A 7 7 0 1 0 72 96 A 7 7 0 1 0 72 82 Z', stroke: '#ffffff', strokeWidth: 2, fill: '#ffffff' },
        { id: 'eye-r', d: 'M 128 82 A 7 7 0 1 0 128 96 A 7 7 0 1 0 128 82 Z', stroke: '#ffffff', strokeWidth: 2, fill: '#ffffff' },
        { id: 'smile', d: 'M 76 122 Q 100 144 124 122', stroke: '#ffffff', strokeWidth: 7, fill: 'none' },
      ]),
      states: {
        state_1: {
          id: 'state_1',
          name: 'Normal',
          color: '#6366f1',
          scale: 1,
          rotation: 0,
        },
      },
      behaviors: [
        { id: 'beh-drag-head', type: 'draggable', enabled: true, throwable: false, maxThrowSpeed: 900 },
      ],
    };

    const seg1Pivot: EntityPivot = { x: 0.5, y: 0 };
    const seg1: Entity = {
      id: 'test-jiggle-seg-1',
      name: 'Maillon 1 (Racine)',
      type: 'test_jiggle_seg_1',
      tags: ['test', 'jiggle'],
      position: { x: 376, y: 152 },
      size: { width: 48, height: 92 },
      pivot: seg1Pivot,
      colliderType: 'box',
      colliderMode: 'disabled',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCapsuleSvg('#ec4899', '#831843'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#ec4899', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-jiggle-1',
          type: 'jiggle',
          enabled: true,
          stiffness: 180,
          damping: 5,
          inertia: 1.4,
          maxAngle: 75,
          restAngleOffset: 0,
          initialAngleOffset: 55,
          gravityPull: 45,
          squashIntensity: 0.35,
          collideWithWorld: false,
          useCustomPivot: false,
        },
      ],
    };
    seg1.parentId = head.id;
    seg1.parentOffset = computeRelativeParentOffset(seg1, head, {
      x: 0,
      y: 0,
      attachmentMode: 'rigid',
      inheritRotation: true,
      inheritFlip: true,
    });

    const seg2: Entity = {
      id: 'test-jiggle-seg-2',
      name: 'Maillon 2 (Milieu)',
      type: 'test_jiggle_seg_2',
      tags: ['test', 'jiggle'],
      position: { x: 379, y: 236 },
      size: { width: 42, height: 86 },
      pivot: { x: 0.5, y: 0 },
      colliderType: 'box',
      colliderMode: 'disabled',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCapsuleSvg('#f43f5e', '#881337'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#f43f5e', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-jiggle-2',
          type: 'jiggle',
          enabled: true,
          stiffness: 130,
          damping: 4,
          inertia: 1.8,
          maxAngle: 85,
          restAngleOffset: 0,
          initialAngleOffset: -45,
          gravityPull: 55,
          squashIntensity: 0.35,
          collideWithWorld: false,
          useCustomPivot: false,
        },
      ],
    };
    seg2.parentId = seg1.id;
    seg2.parentOffset = computeRelativeParentOffset(seg2, seg1, {
      x: 0,
      y: 0,
      attachmentMode: 'rigid',
      inheritRotation: true,
      inheritFlip: true,
    });

    const tip: Entity = {
      id: 'test-jiggle-tip',
      name: 'Pointe (Bout)',
      type: 'test_jiggle_tip',
      tags: ['test', 'jiggle'],
      position: { x: 377, y: 314 },
      size: { width: 46, height: 68 },
      pivot: { x: 0.5, y: 0 },
      colliderType: 'circle',
      colliderMode: 'disabled',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCapsuleSvg('#f59e0b', '#78350f'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#f59e0b', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-jiggle-3',
          type: 'jiggle',
          enabled: true,
          stiffness: 95,
          damping: 3.5,
          inertia: 2.2,
          maxAngle: 95,
          restAngleOffset: 0,
          initialAngleOffset: 35,
          gravityPull: 70,
          squashIntensity: 0.45,
          collideWithWorld: false,
          useCustomPivot: false,
        },
      ],
    };
    tip.parentId = seg2.id;
    tip.parentOffset = computeRelativeParentOffset(tip, seg2, {
      x: 0,
      y: 0,
      attachmentMode: 'rigid',
      inheritRotation: true,
      inheritFlip: true,
    });

    entities[head.id] = head;
    entities[seg1.id] = seg1;
    entities[seg2.id] = seg2;
    entities[tip.id] = tip;
    entityOrder.push(head.id, seg1.id, seg2.id, tip.id);
    selectedEntityId = seg1.id;
  } else if (presetId === 'physics-joint-pendulum') {
    const colGroup = layerGroups.find((g) => g.kind === 'collider' || g.id === 'group-col');
    if (colGroup) {
      colGroup.layers.push({
        id: 'layer-col-test-walls',
        name: 'Sol & Plateformes Test',
        visible: true,
        opacity: 1,
        parallaxFactor: 0,
        coordinateSpace: 'world',
        role: 'collider',
        colliderFriction: 0.5,
        colliderBounce: 0.35,
        vectorPaths: [
          {
            id: 'wall-floor',
            d: 'M 20 445 L 780 445 L 780 475 L 20 475 Z',
            rect: { x: 20, y: 445, width: 760, height: 30 },
            stroke: '#334155',
            strokeWidth: 4,
            fill: '#475569',
          },
          {
            id: 'wall-ledge-left',
            d: 'M 100 315 L 235 315 L 235 338 L 100 338 Z',
            rect: { x: 100, y: 315, width: 135, height: 23 },
            stroke: '#0369a1',
            strokeWidth: 4,
            fill: '#0284c7',
          },
          {
            id: 'wall-ledge-right',
            d: 'M 545 340 L 690 340 L 690 363 L 545 363 Z',
            rect: { x: 545, y: 340, width: 145, height: 23 },
            stroke: '#0369a1',
            strokeWidth: 4,
            fill: '#0284c7',
          },
        ],
      });
    }

    const base: Entity = {
      id: 'test-joint-base',
      name: 'Support (Glisser)',
      type: 'test_joint_base',
      tags: ['test', 'draggable'],
      position: { x: 365, y: 65 },
      size: { width: 70, height: 70 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: true,
      vectorPaths: makeCircleSvg('#0284c7', '#0c4a6e'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#0284c7', scale: 1, rotation: 0 },
      },
      behaviors: [
        { id: 'beh-drag-base', type: 'draggable', enabled: true, throwable: false, maxThrowSpeed: 900 },
      ],
    };

    const arm: Entity = {
      id: 'test-joint-arm',
      name: 'Bras Articulé (Joint)',
      type: 'test_joint_arm',
      tags: ['test', 'joint'],
      position: { x: 378, y: 100 },
      size: { width: 44, height: 120 },
      pivot: { x: 0.5, y: 0 },
      colliderType: 'box',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCapsuleSvg('#38bdf8', '#0369a1'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#38bdf8', scale: 1, rotation: -35 },
      },
      behaviors: [],
    };
    arm.parentId = base.id;
    arm.parentOffset = computeRelativeParentOffset(arm, base, {
      x: 0,
      y: 0,
      attachmentMode: 'physics_joint',
      springStiffness: 420,
      springDamping: 8,
      springGravity: 460,
      collideWithWorld: true,
      inheritRotation: false,
      inheritFlip: true,
    });

    const ball: Entity = {
      id: 'test-joint-ball',
      name: 'Boulet Pendule (Joint)',
      type: 'test_joint_ball',
      tags: ['test', 'joint'],
      position: { x: 368, y: 212 },
      size: { width: 64, height: 64 },
      pivot: { x: 0.5, y: 0 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCircleSvg('#f97316', '#7c2d12', [
        { id: 'dot', d: 'M 100 18 A 14 14 0 1 0 100 46 A 14 14 0 1 0 100 18 Z', stroke: '#7c2d12', strokeWidth: 4, fill: '#fff7ed' },
      ]),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#f97316', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-phys-ball',
          type: 'physics',
          enabled: true,
          gravity: 500,
          mass: 2.2,
          bounce: 0.55,
          friction: 0.25,
          frictionAir: 0.012,
        },
      ],
    };
    ball.parentId = arm.id;
    ball.parentOffset = computeRelativeParentOffset(ball, arm, {
      x: 0,
      y: 0,
      attachmentMode: 'physics_joint',
      springStiffness: 420,
      springDamping: 8,
      springGravity: 520,
      collideWithWorld: true,
      inheritRotation: false,
      inheritFlip: true,
    });

    const crate1: Entity = {
      id: 'test-joint-crate-1',
      name: 'Caisse Physique 1',
      type: 'test_joint_crate',
      tags: ['test', 'crate'],
      position: { x: 315, y: 382 },
      size: { width: 60, height: 60 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'box',
      currentStateId: 'state_1',
      isDraggable: true,
      vectorPaths: makeCapsuleSvg('#10b981', '#065f46', false),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#10b981', scale: 1, rotation: 0 },
      },
      behaviors: [
        { id: 'beh-drag-c1', type: 'draggable', enabled: true, throwable: true, maxThrowSpeed: 900 },
        { id: 'beh-phys-c1', type: 'physics', enabled: true, gravity: 600, mass: 1.0, bounce: 0.5, friction: 0.4 },
      ],
    };

    const crate2: Entity = {
      id: 'test-joint-crate-2',
      name: 'Caisse Physique 2',
      type: 'test_joint_crate_2',
      tags: ['test', 'crate'],
      position: { x: 425, y: 382 },
      size: { width: 60, height: 60 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'box',
      currentStateId: 'state_1',
      isDraggable: true,
      vectorPaths: makeCapsuleSvg('#14b8a6', '#134e4a', false),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#14b8a6', scale: 1, rotation: 0 },
      },
      behaviors: [
        { id: 'beh-drag-c2', type: 'draggable', enabled: true, throwable: true, maxThrowSpeed: 900 },
        { id: 'beh-phys-c2', type: 'physics', enabled: true, gravity: 600, mass: 1.0, bounce: 0.5, friction: 0.4 },
      ],
    };

    entities[base.id] = base;
    entities[arm.id] = arm;
    entities[ball.id] = ball;
    entities[crate1.id] = crate1;
    entities[crate2.id] = crate2;
    entityOrder.push(base.id, arm.id, ball.id, crate1.id, crate2.id);
    selectedEntityId = arm.id;
  } else {
    // follow-spring-drag
    const target: Entity = {
      id: 'test-follow-target',
      name: 'Tête Cible (Glisser)',
      type: 'test_follow_target',
      tags: ['test', 'cible'],
      position: { x: 320, y: 200 },
      size: { width: 92, height: 92 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: true,
      vectorPaths: makeCircleSvg('#f43f5e', '#881337', [
        { id: 'hl', d: 'M 75 72 A 16 16 0 1 0 75 104', stroke: '#ffffff', strokeWidth: 7, fill: 'none' },
      ]),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#f43f5e', scale: 1, rotation: 0 },
      },
      behaviors: [
        { id: 'beh-drag-target', type: 'draggable', enabled: true, throwable: false, maxThrowSpeed: 900 },
      ],
    };

    const follower: Entity = {
      id: 'test-follow-spring',
      name: 'Suiveur Ressort',
      type: 'test_follow_spring',
      tags: ['test', 'follower'],
      position: { x: 130, y: 210 },
      size: { width: 76, height: 76 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makeCircleSvg('#ec4899', '#831843'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#ec4899', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-follow-spring',
          type: 'follow',
          enabled: true,
          targetType: 'entity',
          targetEntityId: target.id,
          followMode: 'spring',
          speed: 240,
          smoothing: 0.15,
          minDistance: 65,
          springStiffness: 150,
          springDamping: 8.5,
          springMaxDistance: 210,
        },
        {
          id: 'beh-follow-jiggle',
          type: 'jiggle',
          enabled: true,
          stiffness: 170,
          damping: 6,
          inertia: 1.3,
          maxAngle: 40,
          restAngleOffset: 0,
          gravityPull: 0,
          squashIntensity: 0.35,
          collideWithWorld: false,
        },
      ],
    };

    const lookAtTurret: Entity = {
      id: 'test-follow-lookat',
      name: 'Oeil LookAt Continu',
      type: 'test_follow_lookat',
      tags: ['test', 'lookat'],
      position: { x: 600, y: 200 },
      size: { width: 92, height: 92 },
      pivot: { x: 0.5, y: 0.5 },
      colliderType: 'circle',
      currentStateId: 'state_1',
      isDraggable: false,
      vectorPaths: makePointerEyeSvg('#e0f2fe', '#0284c7'),
      states: {
        state_1: { id: 'state_1', name: 'Normal', color: '#e0f2fe', scale: 1, rotation: 0 },
      },
      behaviors: [
        {
          id: 'beh-lookat-cont',
          type: 'look_at',
          enabled: true,
          targetType: 'entity',
          targetEntityId: target.id,
          lookMode: 'rotate',
          smoothSpeed: 0,
          rotationOffset: 0,
        },
      ],
    };

    entities[target.id] = target;
    entities[follower.id] = follower;
    entities[lookAtTurret.id] = lookAtTurret;
    entityOrder.push(target.id, follower.id, lookAtTurret.id);
    selectedEntityId = follower.id;
  }

  return {
    entities,
    entityOrder,
    layerGroups,
    rules: [],
    selectedEntityId,
    projectPalette: JSON.parse(JSON.stringify(DEFAULT_PROJECT_PALETTE)),
    folders: JSON.parse(JSON.stringify(initialFolders)),
  };
}
