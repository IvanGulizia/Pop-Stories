import {
  TriggerType,
  TriggerPhase,
  ActionType,
  EntityType,
  EntityId,
  SelectionMode,
  ActionTargetMode,
  SoundType,
  ParticleShape,
  ParentOffset,
  CustomParticlePreset,
  CustomParticleUsageMode,
  SceneTransitionType,
  CameraFollowMode,
} from '../../types';

export const SCENE_TRANSITION_OPTIONS: {
  id: SceneTransitionType;
  label: string;
  shortLabel: string;
}[] = [
  { id: 'fade', label: '🌑 Fondu au noir', shortLabel: 'Fondu noir' },
  { id: 'fade_white', label: '⬜ Fondu au blanc', shortLabel: 'Fondu blanc' },
  { id: 'slide_left', label: '⬅️ Glissement gauche', shortLabel: 'Glissé ←' },
  { id: 'slide_right', label: '➡️ Glissement droite', shortLabel: 'Glissé →' },
  { id: 'slide_up', label: '⬆️ Glissement haut', shortLabel: 'Glissé ↑' },
  { id: 'slide_down', label: '⬇️ Glissement bas', shortLabel: 'Glissé ↓' },
  { id: 'iris', label: '🎯 Iris (noir)', shortLabel: 'Iris noir' },
  { id: 'iris_white', label: '⚪ Iris (blanc)', shortLabel: 'Iris blanc' },
  { id: 'wipe_left', label: '🧹 Balayage', shortLabel: 'Balayage' },
  { id: 'curtain', label: '🎭 Rideau théâtre', shortLabel: 'Rideau' },
  { id: 'zoom_fade', label: '🔍 Zoom + fondu', shortLabel: 'Zoom fondu' },
  { id: 'none', label: '⚡ Instantanée', shortLabel: 'Instantané' },
];

export function getSceneTransitionShortLabel(transition?: SceneTransitionType): string {
  const id = transition || 'fade';
  return SCENE_TRANSITION_OPTIONS.find((opt) => opt.id === id)?.shortLabel || 'Fondu noir';
}

export type ActiveModal =
  | {
      type: 'subject';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
      selectionMode?: SelectionMode;
      selectedEntityId?: EntityId;
      tagInput?: string;
    }
  | {
      type: 'target';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
      selectionMode?: SelectionMode;
      selectedEntityId?: EntityId;
      tagInput?: string;
    }
  | {
      type: 'event';
      ruleId: string;
      subStep?: 'main' | 'key_picker' | 'config_event_params';
      triggerType?: TriggerType;
      triggerPhase?: TriggerPhase;
      timerInterval?: number;
      timerType?: 'once' | 'repeat';
      keyName?: string;
      proximityDistance?: number;
      boundaryEdge?: 'any' | 'top' | 'bottom' | 'left' | 'right';
      variableName?: string;
      variableOperator?: '>=' | '==' | '<=' | '>' | '<' | '!=';
      variableValue?: number;
      variableTriggerMode?: 'threshold' | 'on_change';
      autoRevert?: boolean;
      collisionExitMargin?: number;
      collisionTriggerOnce?: boolean;
      triggerMaxCount?: number;
      triggerCooldownSec?: number;
      triggerStartDelaySec?: number;
      triggerRequireReset?: boolean;
    }
  | {
      type: 'action';
      ruleId: string;
      actionIndex?: number;
      actionId?: string;
      subStep?:
        | 'main'
        | 'choose_state'
        | 'choose_third_party_entity'
        | 'choose_third_party_state'
        | 'choose_third_party_destroy'
        | 'choose_toggle_entity'
        | 'choose_toggle_states'
        | 'choose_spawn_entity'
        | 'choose_spawn_state'
        | 'choose_spawn_location'
        | 'choose_sound'
        | 'choose_delay_duration'
        | 'choose_particles'
        | 'choose_attach_parent'
        | 'choose_detach_parent'
        | 'choose_move_entity'
        | 'choose_variable_action'
        | 'choose_scene_action'
        | 'choose_camera_action';
      actionType?: ActionType;
      targetMode?: ActionTargetMode;
      selectedTargetType?: EntityType;
      variableName?: string;
      variableOperation?: 'set' | 'add' | 'subtract' | 'multiply';
      variableValue?: number;
      scoreAmount?: number;
      pendingSpawnType?: EntityType;
      pendingSpawnInitialStateId?: string;
      toggleStateA?: string;
      toggleStateB?: string;
      toggleTargetStateId?: string;
      toggleMode?: 'two_states' | 'current_and_target' | 'cycle_all';
      delayDuration?: number;
      spawnOffset?: { x: number; y: number };
      spawnAbsoluteCoords?: { x: number; y: number };
      targetTag?: string;
      // Particles config
      particleOriginMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'event_point';
      particleOriginEntityId?: string;
      particleOriginEntityType?: EntityType;
      particleOriginTag?: string;
      particleCount?: number;
      particleColor?: string;
      particleColor2?: string;
      particleShape?: ParticleShape;
      customParticleId?: string;
      customParticleIds?: string[];
      customParticleMode?: CustomParticleUsageMode;
      useParticleTint?: boolean;
      particleSpeed?: number;
      particleSize?: number;
      particleLifetime?: number;
      particleGravity?: number;
      particleSpread?: number;
      particleAngle?: number;
      // Parenting config
      parentChildMode?: ActionTargetMode;
      parentChildType?: EntityType;
      parentChildTag?: string;
      parentTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
      parentEntityId?: string;
      parentEntityType?: EntityType;
      parentEntityTag?: string;
      parentOffset?: ParentOffset;
      // Move Entity config
      moveDistance?: number;
      moveDirectionMode?: 'cardinal' | 'angle' | 'facing' | 'toward_target' | 'away_target';
      moveCardinal?: 'right' | 'left' | 'up' | 'down';
      moveAngle?: number;
      moveApplyMode?: 'instant' | 'impulse';
      moveTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
      moveTargetEntityId?: string;
      moveTargetEntityType?: EntityType;
      moveTargetTag?: string;
      // Scene change config
      targetSceneId?: string;
      sceneTransition?: SceneTransitionType;
      sceneTransitionDuration?: number;
      // Camera action config
      cameraCommand?: 'shake' | 'zoom' | 'follow' | 'move_to' | 'reset';
      cameraShakeIntensity?: number;
      cameraShakeDuration?: number;
      cameraZoom?: number;
      cameraDuration?: number;
      cameraFollowMode?: CameraFollowMode;
      cameraTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
      cameraTargetId?: string;
      cameraTargetType?: EntityType;
      cameraTargetTag?: string;
      cameraPosition?: { x: number; y: number };
      cameraMoveTargetKind?: 'position' | 'entity';
    }
  | null;

export type ActionModalSubStep = Extract<NonNullable<ActiveModal>, { type: 'action' }>['subStep'];

export interface WizardData {
  step: 1 | 2 | 3; // 1: Condition, 2: Objets (Sujet / Cible), 3: Action
  objectPhase?: 'subject' | 'target';
  subjectSubStep?: 'choose_object' | 'choose_state';
  targetSubStep?: 'choose_object' | 'choose_state';
  actionSubStep?:
    | 'main'
    | 'config_event_params'
    | 'state_picker'
    | 'third_party_entity_picker'
    | 'third_party_state_picker'
    | 'third_party_destroy_picker'
    | 'toggle_entity_picker'
    | 'toggle_states_picker'
    | 'spawn_entity_picker'
    | 'spawn_state_picker'
    | 'spawn_location_picker'
    | 'sound_picker'
    | 'key_picker'
    | 'delay_duration_picker'
    | 'particle_picker'
    | 'attach_parent_picker'
    | 'detach_parent_picker'
    | 'move_entity_picker'
    | 'variable_action_picker'
    | 'scene_action_picker'
    | 'camera_action_picker';
  delayDuration?: number;
  variableOperation?: 'set' | 'add' | 'subtract' | 'multiply';
  scoreAmount?: number;
  name: string;
  subjectMode?: SelectionMode;
  subjectId?: EntityId;
  subjectType: EntityType;
  subjectTag?: string;
  subjectStateId?: string;
  triggerType: TriggerType;
  triggerPhase?: TriggerPhase;
  targetMode?: SelectionMode;
  targetId?: EntityId;
  targetType: EntityType;
  targetTag?: string;
  targetStateId?: string;
  actionType?: ActionType;
  actionTargetMode?: ActionTargetMode;
  actionTargetType?: EntityType;
  actionTargetStateId?: string;
  pendingSpawnType?: EntityType;
  actionSpawnEntityType?: EntityType;
  actionSpawnInitialStateId?: string;
  actionSpawnLocationMode?:
    | 'at_subject'
    | 'at_target'
    | 'at_entity'
    | 'at_event_point'
    | 'offset_subject'
    | 'offset_target'
    | 'offset_entity'
    | 'offset_event_point'
    | 'random'
    | 'absolute';
  actionSoundType?: SoundType;
  toggleStateA?: string;
  toggleStateB?: string;
  toggleTargetStateId?: string;
  toggleMode?: 'two_states' | 'current_and_target' | 'cycle_all';
  actionTargetTag?: string;

  // Particles config
  particleOriginMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'event_point';
  particleOriginEntityId?: string;
  particleOriginEntityType?: EntityType;
  particleOriginTag?: string;
  particleCount?: number;
  particleColor?: string;
  particleColor2?: string;
  particleShape?: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useParticleTint?: boolean;
  particleSpeed?: number;
  particleSize?: number;
  particleLifetime?: number;
  particleGravity?: number;
  particleSpread?: number;
  particleAngle?: number;

  // Parenting config
  parentChildMode?: ActionTargetMode;
  parentChildType?: EntityType;
  parentChildTag?: string;
  parentTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  parentEntityId?: string;
  parentEntityType?: EntityType;
  parentEntityTag?: string;
  parentOffset?: ParentOffset;

  // Move Entity config
  moveDistance?: number;
  moveDirectionMode?: 'cardinal' | 'angle' | 'facing' | 'toward_target' | 'away_target';
  moveCardinal?: 'right' | 'left' | 'up' | 'down';
  moveAngle?: number;
  moveApplyMode?: 'instant' | 'impulse';
  moveTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned' | 'mouse';
  moveTargetEntityId?: string;
  moveTargetEntityType?: EntityType;
  moveTargetTag?: string;

  // Configuration Minuteurs, Clavier, Proximité, Bords, Score
  timerInterval?: number;
  timerType?: 'once' | 'repeat';
  keyName?: string;
  proximityDistance?: number;
  boundaryEdge?: 'any' | 'top' | 'bottom' | 'left' | 'right';
  variableName?: string;
  variableOperator?: '>=' | '==' | '<=' | '>' | '<' | '!=';
  variableValue?: number;
  variableTriggerMode?: 'threshold' | 'on_change';
  autoRevert?: boolean;
  collisionExitMargin?: number;
  collisionTriggerOnce?: boolean;
  triggerMaxCount?: number;
  triggerCooldownSec?: number;
  triggerStartDelaySec?: number;
  triggerRequireReset?: boolean;
  targetSceneId?: string;
  sceneTransition?: SceneTransitionType;
  sceneTransitionDuration?: number;
  // Camera action config
  cameraCommand?: 'shake' | 'zoom' | 'follow' | 'move_to' | 'reset';
  cameraShakeIntensity?: number;
  cameraShakeDuration?: number;
  cameraZoom?: number;
  cameraDuration?: number;
  cameraFollowMode?: CameraFollowMode;
  cameraTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  cameraTargetId?: string;
  cameraTargetType?: EntityType;
  cameraTargetTag?: string;
  cameraPosition?: { x: number; y: number };
  cameraMoveTargetKind?: 'position' | 'entity';
}

export interface EntityOption {
  type: EntityType;
  label: string;
}

export type ParticleDrawingTarget = {
  context: 'wizard' | 'modal';
  editingPreset?: CustomParticlePreset;
} | null;
