import React, { useState, useMemo } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  TriggerType,
  TriggerPhase,
  ActionType,
  RuleAction,
  RuleTrigger,
  EntityType,
  EntityId,
  SelectionMode,
  DynamicRule,
  ActionTargetMode,
  SoundType,
  RuleFolder,
  CustomSound,
  SpawnReferenceMode,
  ParticleShape,
  ParentOffset,
  CustomParticlePreset,
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import { SpawnLocationPicker } from './SpawnLocationPicker';
import { SoundRecorderModal } from './SoundRecorderModal';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { ParticleEditorModal } from './ParticleEditorModal';
import { invalidateCustomParticleSprite } from '../utils/particleSystem';
import {
  Plus,
  Trash2,
  Copy,
  Zap,
  ArrowRight,
  X,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Filter,
  Volume2,
  Search,
  Folder,
  FolderPlus,
  FolderOpen,
  Play,
  Pause,
  Mic,
  Edit2,
  Check,
  GripVertical,
  Paintbrush,
  Pencil,
  Tag,
  Sliders,
} from 'lucide-react';
import { soundSynth } from '../utils/sound';

type ActiveModal =
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
  | { type: 'event'; ruleId: string }
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
        | 'choose_detach_parent';
      actionType?: ActionType;
      targetMode?: ActionTargetMode;
      selectedTargetType?: EntityType;
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
    }
  | null;

interface WizardData {
  step: 1 | 2 | 3 | 4; // 1: Sujet, 2: Event, 3: Cible, 4: Action
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
    | 'detach_parent_picker';
  delayDuration?: number;
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

  // Configuration Minuteurs, Clavier, Proximité, Bords, Score
  timerInterval?: number;
  timerType?: 'once' | 'repeat';
  keyName?: string;
  proximityDistance?: number;
  boundaryEdge?: 'any' | 'top' | 'bottom' | 'left' | 'right';
  variableName?: string;
  variableOperator?: '>=' | '==' | '<=';
  variableValue?: number;
  autoRevert?: boolean;
  collisionExitMargin?: number;
  collisionTriggerOnce?: boolean;
}

export function RuleBook() {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const rules = useSceneStore((state) => state.rules);
  const folders = useSceneStore((state) => state.folders || []);
  const customSounds = useSceneStore((state) => state.customSounds || []);
  const addRule = useSceneStore((state) => state.addRule);
  const updateRule = useSceneStore((state) => state.updateRule);
  const deleteRule = useSceneStore((state) => state.deleteRule);
  const toggleRule = useSceneStore((state) => state.toggleRule);
  const duplicateRule = useSceneStore((state) => state.duplicateRule);
  const setRuleFolder = useSceneStore((state) => state.setRuleFolder);
  const addFolder = useSceneStore((state) => state.addFolder);
  const deleteFolder = useSceneStore((state) => state.deleteFolder);
  const settings = useSceneStore((state) => state.settings);
  const customParticles = useSceneStore((state) => state.customParticles || []);
  const addCustomParticle = useSceneStore((state) => state.addCustomParticle);
  const updateCustomParticle = useSceneStore((state) => state.updateCustomParticle);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);

  // Pagination & Rule Drag-and-Drop state
  const currentPage = useSceneStore((state) => state.ruleBookPage || 1);
  const setCurrentPage = useSceneStore((state) => state.setRuleBookPage);
  const [draggedRuleId, setDraggedRuleId] = useState<string | null>(null);
  const [dragOverRuleTarget, setDragOverRuleTarget] = useState<{ id: string; position: 'above' | 'below' } | null>(null);
  const RULES_PER_PAGE = 5;
  const [filterObject, setFilterObject] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [showFiltersManual, setShowFiltersManual] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeWizard, setActiveWizard] = useState<WizardData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [wizardEntryTab, setWizardEntryTab] = useState<'subject' | 'global_event'>('subject');
  const [particleDrawingTarget, setParticleDrawingTarget] = useState<{
    context: 'wizard' | 'modal';
    editingPreset?: CustomParticlePreset;
  } | null>(null);
  const [particleEditorContext, setParticleEditorContext] = useState<'wizard' | 'modal' | null>(null);

  // Folder & Search state
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isSoundModalOpen, setIsSoundModalOpen] = useState<boolean>(false);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const collapsedRuleIds = useSceneStore((state) => state.collapsedRuleIds || {});
  const toggleCollapseRule = useSceneStore((state) => state.toggleRuleCollapse);

  // Sound preview helper
  const handlePlayPreview = (soundType?: SoundType, customSoundId?: string) => {
    if (customSoundId) {
      const snd = customSounds.find((s) => s.id === customSoundId);
      if (snd?.dataUrl) {
        soundSynth.playCustom(snd.dataUrl);
        setPlayingSoundId(customSoundId);
        setTimeout(() => setPlayingSoundId(null), 1200);
      }
    } else if (soundType) {
      soundSynth.play(soundType);
      setPlayingSoundId(soundType);
      setTimeout(() => setPlayingSoundId(null), 800);
    }
  };

  // Folder creation helper
  const handleCreateFolder = () => {
    if (!newFolderName.trim()) {
      setIsCreatingFolder(false);
      return;
    }
    const colors = ['indigo', 'emerald', 'amber', 'rose', 'purple', 'sky'];
    const randomColor = colors[folders.length % colors.length];
    const newId = addFolder(newFolderName.trim(), randomColor);
    setSelectedFolderId(newId);
    setNewFolderName('');
    setIsCreatingFolder(false);
  };

  const entityList = Object.values(entities);

  const layerGroups = useSceneStore((state) => state.layerGroups || []);

  // Tous les #tags utilisés dans le projet (entités, archétypes, calques collider, règles)
  const allProjectTags = useMemo(() => {
    const tagSet = new Set<string>();
    entityList.forEach((e) => e.tags?.forEach((t) => tagSet.add(t)));
    Object.values(customArchetypes).forEach((a) => a.tags?.forEach((t) => tagSet.add(t)));
    layerGroups.forEach((g) => {
      g.layers?.forEach((l) => l.colliderTags?.forEach((t) => tagSet.add(t)));
    });
    rules.forEach((r) => {
      if (r.trigger.subjectTag) tagSet.add(r.trigger.subjectTag);
      if (r.trigger.targetTag) tagSet.add(r.trigger.targetTag);
      r.actions.forEach((a) => {
        a.spawnTags?.forEach((t) => tagSet.add(t));
        if (a.targetTag) tagSet.add(a.targetTag);
        if (a.spawnReferenceTag) tagSet.add(a.spawnReferenceTag);
        if (a.particleOriginTag) tagSet.add(a.particleOriginTag);
        if (a.parentEntityTag) tagSet.add(a.parentEntityTag);
      });
    });
    return Array.from(tagSet).sort();
  }, [entityList, customArchetypes, layerGroups, rules]);

  // Helper to find representative entity from canvas or archetype library
  const getEntityObj = (type?: string) => {
    if (!type) return undefined;
    return (
      entityList.find((e) => e.type === type || e.id === type || e.name === type) ||
      customArchetypes[type] ||
      Object.values(customArchetypes).find((a) => a.id === type || a.name === type)
    );
  };

  const formatStateName = (stateId?: string, entObj?: any) => {
    if (!stateId) return 'Normal';
    if (entObj?.states?.[stateId]?.name) return entObj.states[stateId].name;
    const foundInObj = Object.values(entObj?.states || {}).find(
      (s: any) => s.id === stateId || s.name === stateId
    );
    if (foundInObj && (foundInObj as any).name) return (foundInObj as any).name;

    for (const ent of [...entityList, ...Object.values(customArchetypes)] as any[]) {
      if (ent?.states?.[stateId]?.name) return ent.states[stateId].name;
      const f = Object.values(ent?.states || {}).find(
        (s: any) => s.id === stateId || s.name === stateId
      );
      if (f && (f as any).name) return (f as any).name;
    }

    if (typeof stateId === 'string' && stateId.startsWith('state_')) {
      const parts = stateId.split('_');
      if (parts[1]) {
        return `État ${parts[1].toUpperCase()}`;
      }
    }
    return stateId;
  };

  // Action badge renderer for compact view - matching left side condition visual language
  const renderActionSummary = (act: RuleAction, trigger: RuleTrigger) => {
    if (act.type === 'change_state') {
      const targetType = act.targetMode === 'subject' || (!act.targetMode && !act.targetType)
        ? trigger.subjectType
        : (act.targetType || trigger.targetType || trigger.subjectType);

      const targetEntObj = getEntityObj(targetType);
      const humanStateName = formatStateName(act.targetStateId, targetEntObj);
      const targetLabel =
        act.targetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.targetMode === 'tag' && act.targetTag
          ? `#${act.targetTag}`
          : targetEntObj?.name || targetType || 'Objet';

      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
            <EntityMiniPreview entity={targetEntObj} type={targetType} stateId={act.targetStateId} size={18} />
          </div>
          <span className="text-xs truncate">{targetLabel}</span>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-medium truncate">
            ({humanStateName})
          </span>
        </div>
      );
    }
    if (act.type === 'toggle_state') {
      const targetType = act.targetMode === 'subject' ? trigger.subjectType : (act.targetType || trigger.targetType || trigger.subjectType);
      const targetEntObj = getEntityObj(targetType);
      const targetLabel =
        act.targetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.targetMode === 'tag' && act.targetTag
          ? `#${act.targetTag}`
          : targetEntObj?.name || targetType || 'Objet';

      let detail = 'Cycle tous les états';
      if (act.toggleStateAId && act.toggleStateBId && targetEntObj) {
        const nameA = targetEntObj.states[act.toggleStateAId]?.name || act.toggleStateAId;
        const nameB = targetEntObj.states[act.toggleStateBId]?.name || act.toggleStateBId;
        detail = `${nameA} ⇄ ${nameB}`;
      } else if (act.toggleTargetStateId && targetEntObj) {
        const nameT = targetEntObj.states[act.toggleTargetStateId]?.name || act.toggleTargetStateId;
        detail = `Actuel ⇄ ${nameT}`;
      }

      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            🔄
          </div>
          <span className="text-xs truncate">{targetLabel}</span>
          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium truncate">
            ({detail})
          </span>
        </div>
      );
    }
    if (act.type === 'delete_entity') {
      const targetType = act.targetMode === 'subject' ? trigger.subjectType : (act.targetType || trigger.targetType || trigger.subjectType);
      const targetEntObj = getEntityObj(targetType);
      const targetLabel =
        act.targetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.targetMode === 'tag' && act.targetTag
          ? `#${act.targetTag}`
          : targetEntObj?.name || targetType || 'Objet';
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            💥
          </div>
          <span className="text-xs truncate">{targetLabel}</span>
          <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-medium truncate">
            (Détruire)
          </span>
        </div>
      );
    }
    if (act.type === 'spawn_entity') {
      const spawnType = act.spawnEntityType || 'apple';
      const spawnEntObj = getEntityObj(spawnType);
      const spawnStateObj = spawnEntObj?.states[act.spawnInitialStateId || spawnEntObj?.currentStateId || ''];
      const humanStateName = spawnStateObj?.name || 'Normal';
      const spawnLabel = spawnEntObj?.name || spawnType;
      const tagsBadge = act.spawnTags && act.spawnTags.length > 0 ? ` #${act.spawnTags[0]}` : '';
      const refBadge =
        act.spawnLocationMode === 'at_event_point' || act.spawnLocationMode === 'offset_event_point'
          ? ' @Point exact'
          : act.spawnReferenceMode === 'last_spawned'
          ? ' @Dernier'
          : act.spawnReferenceMode === 'tag' && act.spawnReferenceTag
          ? ` @#${act.spawnReferenceTag}`
          : act.spawnReferenceMode === 'entity' && act.spawnReferenceEntityId
          ? ` @${entities[act.spawnReferenceEntityId]?.name || 'Entité'}`
          : act.spawnReferenceMode === 'type' && act.spawnReferenceEntityType
          ? ` @${getEntityObj(act.spawnReferenceEntityType)?.name || act.spawnReferenceEntityType}`
          : '';
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
            <EntityMiniPreview entity={spawnEntObj} type={spawnType} stateId={act.spawnInitialStateId} size={18} />
          </div>
          <span className="text-xs truncate">{spawnLabel}</span>
          <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded font-medium truncate">
            (Créer - {humanStateName}{tagsBadge}{refBadge})
          </span>
        </div>
      );
    }
    if (act.type === 'emit_particles') {
      const originBadge =
        act.particleOriginMode === 'event_point'
          ? ' @Point exact'
          : act.particleOriginMode === 'tag' && act.particleOriginTag
          ? ` @#${act.particleOriginTag}`
          : '';
      const shapeBadge =
        act.particleShape === 'custom' && act.customParticleId
          ? customParticles.find((p) => p.id === act.customParticleId)?.name || 'Dessin'
          : `${act.particleCount ?? 18}x`;
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            ✨
          </div>
          <span className="text-xs truncate">Particules</span>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium truncate">
            ({shapeBadge}{originBadge})
          </span>
        </div>
      );
    }
    if (act.type === 'attach_to_parent') {
      const childLabel =
        act.targetMode === 'subject'
          ? 'Sujet'
          : act.targetMode === 'target'
          ? 'Cible'
          : act.targetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.targetMode === 'tag' && act.targetTag
          ? `#${act.targetTag}`
          : getEntityObj(act.targetType)?.name || 'Enfant';
      const parentLabel =
        act.parentTargetMode === 'subject'
          ? 'Sujet'
          : act.parentTargetMode === 'target'
          ? 'Cible'
          : act.parentTargetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.parentTargetMode === 'tag' && act.parentEntityTag
          ? `#${act.parentEntityTag}`
          : act.parentTargetMode === 'entity' && act.parentEntityId
          ? entities[act.parentEntityId]?.name || 'Entité'
          : getEntityObj(act.parentEntityType)?.name || 'Parent';
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            🔗
          </div>
          <span className="text-xs truncate">{childLabel}</span>
          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-medium truncate">
            (➔ {parentLabel})
          </span>
        </div>
      );
    }
    if (act.type === 'detach_parent') {
      const targetLabel =
        act.targetMode === 'subject'
          ? 'Sujet'
          : act.targetMode === 'target'
          ? 'Cible'
          : act.targetMode === 'last_spawned'
          ? 'Dernier créé'
          : act.targetMode === 'tag' && act.targetTag
          ? `#${act.targetTag}`
          : getEntityObj(act.targetType)?.name || 'Objet';
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            ✂️
          </div>
          <span className="text-xs truncate">{targetLabel}</span>
          <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-medium truncate">
            (Détacher)
          </span>
        </div>
      );
    }
    if (act.type === 'play_sound') {
      const soundLabel = act.customSoundId
        ? (customSounds.find((s) => s.id === act.customSoundId)?.name || 'Audio')
        : (act.soundType || 'Audio');
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            🎵
          </div>
          <span className="text-xs truncate">Son</span>
          <span className="text-[10px] text-purple-700 bg-purple-50 px-1.5 py-0.2 rounded font-medium truncate">
            ({soundLabel})
          </span>
        </div>
      );
    }
    if (act.type === 'add_score') {
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            🏆
          </div>
          <span className="text-xs truncate">Score</span>
          <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium truncate">
            (+{act.scoreAmount || 1})
          </span>
        </div>
      );
    }
    if (act.type === 'delay') {
      return (
        <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
          <div className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] shrink-0 font-black">
            ⏱️
          </div>
          <span className="text-xs truncate">Pause</span>
          <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-medium truncate">
            ({act.delayDuration || 1}s)
          </span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0">
        <span className="text-xs">⚡ {act.type}</span>
      </div>
    );
  };

  // Available entity options (archetypes & custom drawn only)
  const availableEntityOptions: { type: EntityType; label: string }[] = [];

  Object.entries(customArchetypes).forEach(([archetypeType, arch]) => {
    if (!availableEntityOptions.some((opt) => opt.type === archetypeType)) {
      availableEntityOptions.push({
        type: archetypeType,
        label: arch.name || archetypeType,
      });
    }
  });

  entityList.forEach((e) => {
    if (!availableEntityOptions.some((opt) => opt.type === e.type)) {
      availableEntityOptions.push({
        type: e.type,
        label: e.name || e.type,
      });
    }
  });

  // Check if filters should be displayed
  const areFiltersVisible = settings?.showRuleFilters || showFiltersManual;

  // Start guided sequential wizard (Sujet > Event > Cible > Action)
  const startCreationWizard = () => {
    const defaultSub = availableEntityOptions[0]?.type || 'apple';
    const defaultTar = availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant';

    setActiveWizard({
      step: 1,
      subjectSubStep: 'choose_object',
      name: `Règle #${rules.length + 1}`,
      subjectMode: 'type',
      subjectType: defaultSub,
      subjectStateId: undefined,
      triggerType: 'collision',
      triggerPhase: 'enter',
      targetMode: 'type',
      targetType: defaultTar,
      targetStateId: undefined,
      actionSubStep: 'main',
    });
  };

  // Quick 1-click finalize wizard with an action
  const completeWizardWithAction = (actionData?: Partial<RuleAction>) => {
    if (!activeWizard) return;

    const needsTarget = activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity';
    const subMode: SelectionMode = activeWizard.subjectMode || 'type';
    const tarMode: SelectionMode = activeWizard.targetMode || 'type';
    const resolvedSubType =
      subMode === 'instance' && activeWizard.subjectId
        ? entities[activeWizard.subjectId]?.type || activeWizard.subjectType
        : activeWizard.subjectType;
    const resolvedTarType =
      tarMode === 'instance' && activeWizard.targetId
        ? entities[activeWizard.targetId]?.type || activeWizard.targetType
        : activeWizard.targetType;

    const actions: RuleAction[] = [];

    if (actionData && actionData.type) {
      actions.push({
        id: `act-${Date.now()}`,
        type: actionData.type,
        targetMode: actionData.targetMode || (needsTarget ? 'target' : 'subject'),
        targetType:
          actionData.targetType ||
          (actionData.targetMode === 'subject' ? resolvedSubType : resolvedTarType),
        spawnLocationMode: actionData.spawnLocationMode || (needsTarget ? 'at_target' : 'at_subject'),
        spawnSizeMode: actionData.spawnSizeMode || 'default',
        ...actionData,
      });
    }

    addRule({
      name: activeWizard.name,
      enabled: true,
      trigger: {
        type: activeWizard.triggerType,
        phase: activeWizard.triggerPhase || 'enter',
        subjectMode: subMode,
        subjectType: subMode === 'type' ? resolvedSubType : undefined,
        subjectId: subMode === 'instance' ? activeWizard.subjectId : undefined,
        subjectTag: subMode === 'tag' ? activeWizard.subjectTag : undefined,
        subjectStateId: subMode === 'any' || subMode === 'tag' ? undefined : activeWizard.subjectStateId,
        targetMode: needsTarget ? tarMode : undefined,
        targetType: needsTarget && tarMode === 'type' ? resolvedTarType : undefined,
        targetId: needsTarget && tarMode === 'instance' ? activeWizard.targetId : undefined,
        targetTag: needsTarget && tarMode === 'tag' ? activeWizard.targetTag : undefined,
        targetStateId: needsTarget && tarMode !== 'any' && tarMode !== 'tag' ? activeWizard.targetStateId : undefined,
        timerInterval: activeWizard.timerInterval,
        timerType: activeWizard.timerType,
        keyName: activeWizard.keyName,
        proximityDistance: activeWizard.proximityDistance,
        boundaryEdge: activeWizard.boundaryEdge,
        variableName: activeWizard.variableName,
        variableOperator: activeWizard.variableOperator,
        variableValue: activeWizard.variableValue,
        autoRevert: activeWizard.autoRevert,
        collisionExitMargin: activeWizard.collisionExitMargin,
        collisionTriggerOnce: activeWizard.collisionTriggerOnce,
      },
      actions,
    });

    setActiveWizard(null);
  };

  // Drag and drop handlers onto storyboard slots
  const handleDropOnSlot = (
    e: React.DragEvent,
    ruleId: string,
    slotType: 'subject' | 'target' | 'action',
    actionId?: string
  ) => {
    e.preventDefault();
    setDragOverSlot(null);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);

      const targetRule = rules.find((r) => r.id === ruleId);
      if (!targetRule) return;

      if (slotType === 'subject') {
        if (data.kind === 'entity-archetype') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              subjectType: data.entityType,
              subjectStateId: undefined,
            },
          });
        } else if (data.kind === 'entity-state') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              subjectType: data.entityType,
              subjectStateId: data.stateId,
            },
          });
        }
      } else if (slotType === 'target') {
        if (data.kind === 'entity-archetype') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              targetType: data.entityType,
              targetStateId: undefined,
            },
          });
        } else if (data.kind === 'entity-state') {
          updateRule(ruleId, {
            trigger: {
              ...targetRule.trigger,
              targetType: data.entityType,
              targetStateId: data.stateId,
            },
          });
        }
      } else if (slotType === 'action' && actionId) {
        if (data.kind === 'entity-state') {
          const updatedActions = targetRule.actions.map((act) =>
            act.id === actionId
              ? {
                  ...act,
                  type: 'change_state' as ActionType,
                  targetType: data.entityType,
                  targetStateId: data.stateId,
                }
              : act
          );
          updateRule(ruleId, { actions: updatedActions });
        }
      }
    } catch {
      // ignore drop errors
    }
  };

  // Filter rules
  const filteredRules = rules.filter((rule) => {
    // 1. Filtrage par Dossier
    if (selectedFolderId !== 'all') {
      if (selectedFolderId === 'unassigned') {
        if (rule.folderId) return false;
      } else {
        if (rule.folderId !== selectedFolderId) return false;
      }
    }

    // 2. Recherche textuelle instantanée
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const ruleNameMatch = rule.name.toLowerCase().includes(q);
      const subjectOpt = availableEntityOptions.find((o) => o.type === rule.trigger.subjectType);
      const targetOpt = availableEntityOptions.find((o) => o.type === rule.trigger.targetType);
      const subjectMatch = (subjectOpt?.label || rule.trigger.subjectType || '').toLowerCase().includes(q);
      const targetMatch = (targetOpt?.label || rule.trigger.targetType || '').toLowerCase().includes(q);
      const actionMatch = rule.actions.some((a) => {
        const customSound = a.customSoundId ? customSounds.find((s) => s.id === a.customSoundId) : null;
        return (
          (customSound?.name || '').toLowerCase().includes(q) ||
          (a.soundType || '').toLowerCase().includes(q) ||
          (a.spawnEntityType || '').toLowerCase().includes(q) ||
          (a.type || '').toLowerCase().includes(q)
        );
      });
      if (!ruleNameMatch && !subjectMatch && !targetMatch && !actionMatch) return false;
    }

    // 3. Filtrage par Entité (Bandeau 1-clic racine)
    if (filterObject !== 'all') {
      const matchSubject = rule.trigger.subjectType === filterObject || rule.trigger.subjectMode === 'any';
      const matchTarget = rule.trigger.targetType === filterObject || rule.trigger.targetMode === 'any';
      const matchAction = rule.actions.some(
        (a) => a.targetType === filterObject || a.spawnEntityType === filterObject
      );
      if (!matchSubject && !matchTarget && !matchAction) return false;
    }

    // 4. Filtres par type d'événement (Collision / Clic)
    if (areFiltersVisible && filterType !== 'all') {
      if (filterType === 'collision' && rule.trigger.type !== 'collision') return false;
      if (filterType === 'click' && rule.trigger.type !== 'click' && rule.trigger.type !== 'drag') return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredRules.length / RULES_PER_PAGE));
  const validPage = Math.min(Math.max(1, currentPage), totalPages);
  const paginatedRules = filteredRules.slice((validPage - 1) * RULES_PER_PAGE, validPage * RULES_PER_PAGE);

  return (
    <div className="bg-slate-50/80 rounded-3xl border border-slate-200 p-4 sm:p-5 flex flex-col h-full overflow-hidden text-slate-800 space-y-3.5">
      {/* --- TOP BAR: Title, Search, Audio manager, New Rule --- */}
      <div className="flex items-center justify-between gap-3 flex-wrap border-b border-slate-200/80 pb-3 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-slate-800 tracking-tight">
              Livre de Règles
            </span>
            <span className="text-xs font-bold bg-slate-200/80 text-slate-700 px-2 py-0.5 rounded-full">
              {rules.length}
            </span>
          </div>

          {/* Barre de Recherche instantanée */}
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher une règle, entité, son..."
              className="pl-8 pr-7 py-1 text-xs font-medium bg-white rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-300 outline-none w-48 sm:w-60 transition-all"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Bouton pour ouvrir le gestionnaire de sons audio / micro */}
          <button
            type="button"
            onClick={() => setIsSoundModalOpen(true)}
            className="px-2.5 py-1 text-xs font-bold rounded-xl border border-purple-200 bg-purple-50 hover:bg-purple-100/80 text-purple-700 transition-all cursor-pointer flex items-center gap-1.5 shadow-2xs"
            title="Enregistrer au micro ou importer des effets sonores"
          >
            <Mic className="w-3.5 h-3.5" />
            <span>Sons & Voix</span>
            {customSounds.length > 0 && (
              <span className="text-[10px] bg-purple-200/80 text-purple-900 px-1.5 py-0.2 rounded-full font-black">
                {customSounds.length}
              </span>
            )}
          </button>

          {/* Bouton discret pour basculer les filtres optionnels */}
          {!settings?.showRuleFilters && (
            <button
              type="button"
              onClick={() => setShowFiltersManual(!showFiltersManual)}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer flex items-center gap-1.5 ${
                showFiltersManual
                  ? 'bg-indigo-50 border-indigo-300 text-indigo-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
              title="Afficher/masquer les filtres par type d'événement ou d'objet"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Filtres</span>
            </button>
          )}
        </div>

        {/* Right: New Rule Button */}
        <button
          type="button"
          onClick={startCreationWizard}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 text-white font-bold text-xs rounded-2xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2.5} />
          <span>Nouvelle règle</span>
        </button>
      </div>

      {/* --- 1-CLICK ENTITY FILTER BAR AT ROOT OF RULEBOOK --- */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin bg-slate-100/70 p-1.5 rounded-2xl border border-slate-200/80">
        <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider px-1">Entités :</span>
        <button
          type="button"
          onClick={() => setFilterObject('all')}
          className={`px-2.5 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer shrink-0 ${
            filterObject === 'all'
              ? 'bg-indigo-600 text-white shadow-2xs'
              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
          }`}
        >
          Toutes
        </button>
        {availableEntityOptions.map((opt) => {
          const ent = getEntityObj(opt.type);
          const isSelected = filterObject === opt.type;
          const displayMode = settings?.entityFilterDisplayMode || 'icon_and_text';

          return (
            <button
              key={opt.type}
              type="button"
              onClick={() => setFilterObject(isSelected ? 'all' : opt.type)}
              className={`px-2.5 py-1 text-xs font-bold rounded-xl border transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                isSelected
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-2xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-indigo-50/60'
              }`}
              title={`Filtrer les règles pour ${opt.label}`}
            >
              {displayMode !== 'text_only' && (
                <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center p-0.5 shrink-0">
                  <EntityMiniPreview entity={ent} type={opt.type} size={14} />
                </div>
              )}
              {displayMode !== 'icon_only' && <span>{opt.label}</span>}
            </button>
          );
        })}
      </div>

      {/* --- FOLDER TABS BAR (Dossiers Thématiques Pliables - Optionnel via Settings) --- */}
      {settings?.showRuleFolders && (
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 shrink-0 scrollbar-thin">
          {/* Tab: Toutes */}
          <button
            type="button"
            onClick={() => setSelectedFolderId('all')}
            className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
              selectedFolderId === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span>Toutes</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
              selectedFolderId === 'all' ? 'bg-slate-700 text-slate-200' : 'bg-slate-100 text-slate-500'
            }`}>
              {rules.length}
            </span>
          </button>

          {/* Dynamic folders */}
          {folders.map((folder) => {
            const count = rules.filter((r) => r.folderId === folder.id).length;
            const isSelected = selectedFolderId === folder.id;

            const colorClasses: Record<string, string> = {
              indigo: isSelected ? 'bg-indigo-600 text-white' : 'hover:border-indigo-300 text-indigo-800',
              emerald: isSelected ? 'bg-emerald-600 text-white' : 'hover:border-emerald-300 text-emerald-800',
              amber: isSelected ? 'bg-amber-600 text-white' : 'hover:border-amber-300 text-amber-800',
              rose: isSelected ? 'bg-rose-600 text-white' : 'hover:border-rose-300 text-rose-800',
              purple: isSelected ? 'bg-purple-600 text-white' : 'hover:border-purple-300 text-purple-800',
              sky: isSelected ? 'bg-sky-600 text-white' : 'hover:border-sky-300 text-sky-800',
            };

            return (
              <div
                key={folder.id}
                className={`flex items-center rounded-xl border transition-all shrink-0 ${
                  isSelected
                    ? 'border-transparent shadow-xs ' + (colorClasses[folder.color || 'indigo'] || 'bg-indigo-600 text-white')
                    : 'bg-white border-slate-200 ' + (colorClasses[folder.color || 'indigo'] || 'text-slate-700')
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSelectedFolderId(folder.id)}
                  className="px-3 py-1.5 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Folder className="w-3.5 h-3.5 fill-current opacity-80" />
                  <span>{folder.name}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                    isSelected ? 'bg-black/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {count}
                  </span>
                </button>
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Supprimer le dossier "${folder.name}" ? (Les règles seront conservées en Non Classées)`)) {
                        deleteFolder(folder.id);
                        setSelectedFolderId('all');
                      }
                    }}
                    className="pr-2 pl-0.5 text-white/70 hover:text-white cursor-pointer"
                    title="Supprimer ce dossier"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Tab: Non classées */}
          {rules.some((r) => !r.folderId) && (
            <button
              type="button"
              onClick={() => setSelectedFolderId('unassigned')}
              className={`px-3 py-1.5 text-xs font-bold rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shrink-0 ${
                selectedFolderId === 'unassigned'
                  ? 'bg-slate-700 text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-500 hover:bg-slate-100'
              }`}
            >
              <span>Non classées</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                selectedFolderId === 'unassigned' ? 'bg-slate-800 text-slate-200' : 'bg-slate-100 text-slate-500'
              }`}>
                {rules.filter((r) => !r.folderId).length}
              </span>
            </button>
          )}

          {/* Add folder inline form / button */}
          {isCreatingFolder ? (
            <div className="flex items-center gap-1 bg-white border border-indigo-300 rounded-xl px-2 py-1 shrink-0">
              <input
                type="text"
                autoFocus
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreateFolder();
                  if (e.key === 'Escape') setIsCreatingFolder(false);
                }}
                placeholder="Nom du dossier..."
                className="text-xs font-bold text-slate-800 outline-none w-28"
              />
              <button
                type="button"
                onClick={handleCreateFolder}
                className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg cursor-pointer"
                title="Créer"
              >
                <Check className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setIsCreatingFolder(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
                title="Annuler"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsCreatingFolder(true)}
              className="px-2.5 py-1.5 text-xs font-bold rounded-xl border border-dashed border-slate-300 hover:border-indigo-400 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/40 transition-all flex items-center gap-1 cursor-pointer shrink-0"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>+ Dossier</span>
            </button>
          )}
        </div>
      )}

      {/* Barre de filtres avancés (Visible si togglée) */}
      {areFiltersVisible && (
        <div className="flex items-center gap-2 flex-wrap animate-in fade-in duration-150 border-b border-slate-200/60 pb-2">
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <button
              type="button"
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'all'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Tous types
            </button>
            <button
              type="button"
              onClick={() => setFilterType('collision')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'collision'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Collisions
            </button>
            <button
              type="button"
              onClick={() => setFilterType('click')}
              className={`px-3 py-1 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filterType === 'click'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Clics & Relâché
            </button>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl border border-slate-200 shadow-2xs">
            <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
            <select
              value={filterObject}
              onChange={(e) => setFilterObject(e.target.value)}
              className="text-xs font-bold text-slate-700 bg-transparent pr-2 py-0.5 outline-none cursor-pointer"
            >
              <option value="all">Tous les objets</option>
              {availableEntityOptions.map((opt) => (
                <option key={opt.type} value={opt.type}>
                  Objet : {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* --- RULES LIST (2-COLUMN SEMANTIC LAYOUT: SUJET À GAUCHE, CIBLE À DROITE) --- */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1">
        {filteredRules.length === 0 ? (
          <div
            onClick={startCreationWizard}
            className="border-2 border-dashed border-slate-300 hover:border-indigo-400 bg-slate-50/60 hover:bg-indigo-50/30 rounded-3xl p-8 text-center flex flex-col items-center justify-center cursor-pointer transition-all min-h-[220px] group"
          >
            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-3xl group-hover:scale-110 transition-transform mb-3">
              ⚡
            </div>
            <div className="text-sm font-bold text-slate-800">
              {searchQuery || selectedFolderId !== 'all' ? 'Aucune règle ne correspond aux filtres' : 'Créer une règle en quelques clics rapides'}
            </div>
            <p className="text-xs text-slate-400 max-w-xs mx-auto mt-1">
              Structure logique en 2 colonnes : Sujet à gauche, Cible et Sons à droite.
            </p>
          </div>
        ) : (
          paginatedRules.map((rule) => {
            const isCollision = rule.trigger.type === 'collision' || rule.trigger.type === 'proximity';

            // Find subject display info (Type / #Tag / Instance / Tous)
            const subjectMode = rule.trigger.subjectMode || 'type';
            const subjectInst = subjectMode === 'instance' && rule.trigger.subjectId ? entities[rule.trigger.subjectId] : undefined;
            const subjectType = subjectInst?.type || rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
            const subjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
            const subjectEntity = subjectInst || getEntityObj(subjectType);
            const subjectDisplayLabel =
              subjectMode === 'any'
                ? 'Tous les objets'
                : subjectMode === 'tag'
                ? `#${rule.trigger.subjectTag || 'tag'}`
                : subjectMode === 'instance'
                ? subjectInst?.name || 'Instance précise'
                : subjectOpt?.label || subjectType;
            const subjectStateName = rule.trigger.subjectStateId
              ? subjectEntity?.states[rule.trigger.subjectStateId]?.name || rule.trigger.subjectStateId
              : 'Tous les états';

            // Find target display info (Type / #Tag / Instance / Tous)
            const targetMode = rule.trigger.targetMode || 'type';
            const targetInst = targetMode === 'instance' && rule.trigger.targetId ? entities[rule.trigger.targetId] : undefined;
            const targetType = targetInst?.type || rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';
            const targetOpt = availableEntityOptions.find((o) => o.type === targetType);
            const targetEntity = targetInst || getEntityObj(targetType);
            const targetDisplayLabel =
              targetMode === 'any'
                ? 'Tous les objets'
                : targetMode === 'tag'
                ? `#${rule.trigger.targetTag || 'tag'}`
                : targetMode === 'instance'
                ? targetInst?.name || 'Instance précise'
                : targetOpt?.label || targetType;
            const targetStateName = rule.trigger.targetStateId
              ? targetEntity?.states[rule.trigger.targetStateId]?.name || rule.trigger.targetStateId
              : 'Tous les états';

            // Event badge info
            let eventName = 'Contact';
            let eventIcon = '💥';
            let eventSub = 'Collision (Premier contact)';
            if (rule.trigger.type === 'hover') {
              if (rule.trigger.phase === 'exit' || rule.trigger.phase === 'hover_exit') {
                eventName = 'Sortie Survol';
                eventIcon = '🏃';
                eventSub = 'Mouse Hover Exit';
              } else {
                eventName = 'Survol';
                eventIcon = '👀';
                eventSub = 'Mouse Hover Enter';
              }
            } else if (rule.trigger.type === 'click') {
              eventName = 'Clic';
              eventIcon = '👆';
              eventSub = 'Sur l’objet';
              if (rule.trigger.phase === 'mouse_down' || rule.trigger.phase === 'down') {
                eventName = 'Appui';
                eventIcon = '👇';
                eventSub = 'Mouse Down';
              } else if (rule.trigger.phase === 'mouse_up' || rule.trigger.phase === 'up') {
                eventName = 'Relâcher';
                eventIcon = '🖐️';
                eventSub = 'Mouse Up';
              }
            } else if (rule.trigger.type === 'drag' || rule.trigger.phase === 'drag_release') {
              eventName = 'Relâcher';
              eventIcon = '🫳';
              eventSub = 'On Release';
            } else if (rule.trigger.type === 'timer') {
              eventName = `Timer (${rule.trigger.timerInterval || 2}s)`;
              eventIcon = '⏱️';
              eventSub = rule.trigger.timerType === 'once' ? 'Après délai' : 'Chaque intervalle';
            } else if (rule.trigger.type === 'keyboard') {
              const kPhase = rule.trigger.phase === 'up' || rule.trigger.phase === 'key_up' ? ' (Relâché)' : ' (Appui)';
              eventName = `Touche [${rule.trigger.keyName || 'Espace'}]${kPhase}`;
              eventIcon = '⌨️';
              eventSub = 'Touche Clavier';
            } else if (rule.trigger.type === 'state_change') {
              eventName = "Chgt d'État";
              eventIcon = '🔄';
              eventSub = 'Nouveau statut';
            } else if (rule.trigger.type === 'proximity') {
              eventName = `Proximité (<${rule.trigger.proximityDistance || 80}px)`;
              eventIcon = '📏';
              eventSub = 'Approche de Cible';
            } else if (rule.trigger.type === 'boundary') {
              eventName = 'Bord de Scène';
              eventIcon = '🖼️';
              eventSub = 'Toucher le cadre';
            } else if (rule.trigger.type === 'variable') {
              eventName = `Score ${rule.trigger.variableOperator || '>='} ${rule.trigger.variableValue ?? 5}`;
              eventIcon = '📊';
              eventSub = 'Condition de Score';
            } else if (rule.trigger.type === 'collision') {
              if (rule.trigger.phase === 'collision_release') {
                eventName = 'Relâcher sur cible';
                eventIcon = '🎯';
                eventSub = 'Collision on Release';
              } else if (rule.trigger.phase === 'exit' || rule.trigger.phase === 'release') {
                eventName = 'Collision Sortie';
                eventIcon = '💨';
                eventSub = 'Collision on Exit';
              } else if (rule.trigger.phase === 'stay') {
                eventName = 'Contact Continu';
                eventIcon = '⏳';
                eventSub = 'Pendant le contact';
              } else {
                eventName = 'Collision Entrée';
                eventIcon = '💥';
                eventSub = 'Collision on Enter';
              }
            }

            const subjectSlotKey = `${rule.id}-subject`;
            const targetSlotKey = `${rule.id}-target`;
            // Default rules to collapsed state (Request 3)
            const isCollapsed = collapsedRuleIds[rule.id] !== false;
            const isGlobalTrigger = ['keyboard', 'timer', 'variable'].includes(rule.trigger.type);

            const isRuleTargeted = dragOverRuleTarget?.id === rule.id;
            const showGapAbove = isRuleTargeted && dragOverRuleTarget.position === 'above';
            const showGapBelow = isRuleTargeted && dragOverRuleTarget.position === 'below';

            return (
              <div key={rule.id} className="relative">
                {/* Visual Drag Indicator ABOVE */}
                {showGapAbove && (
                  <div className="absolute -top-2 left-2 right-2 h-1.5 bg-indigo-600 rounded-full shadow-md z-30 pointer-events-none animate-pulse flex items-center justify-center">
                    <span className="bg-indigo-600 text-white text-[9px] font-black px-2 py-0.5 rounded-full -top-2.5 relative shadow-xs">
                      ↓ Placer la règle ici
                    </span>
                  </div>
                )}

                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    const rect = e.currentTarget.getBoundingClientRect();
                    const midY = rect.top + rect.height / 2;
                    const pos = e.clientY < midY ? 'above' : 'below';
                    if (dragOverRuleTarget?.id !== rule.id || dragOverRuleTarget.position !== pos) {
                      setDragOverRuleTarget({ id: rule.id, position: pos });
                    }
                  }}
                  onDragLeave={() => {
                    if (dragOverRuleTarget?.id === rule.id) {
                      setDragOverRuleTarget(null);
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sourceId = e.dataTransfer.getData('text/rule-id') || draggedRuleId;
                    if (sourceId && sourceId !== rule.id) {
                      useSceneStore.getState().reorderRules(sourceId, rule.id, dragOverRuleTarget?.position || 'above');
                    }
                    setDraggedRuleId(null);
                    setDragOverRuleTarget(null);
                  }}
                  className={`p-3.5 sm:p-4 rounded-3xl border transition-all shadow-xs ${
                    isRuleTargeted && dragOverRuleTarget?.position === 'above'
                      ? 'border-t-4 border-t-indigo-600 border-x-indigo-400 border-b-slate-200 bg-indigo-50/40 shadow-md'
                      : isRuleTargeted && dragOverRuleTarget?.position === 'below'
                      ? 'border-b-4 border-b-indigo-600 border-x-indigo-400 border-t-slate-200 bg-indigo-50/40 shadow-md'
                      : rule.enabled
                      ? 'bg-white border-slate-200/90 hover:border-slate-300'
                      : 'bg-slate-50/70 border-slate-200/50 opacity-60'
                  }`}
                >
                  {/* 1. Header Bar: Accordion Toggle, Name, Folder picker, Active toggle, Duplicate, Delete */}
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      {/* Drag handle for rule hierarchy reordering */}
                      <div
                        draggable={true}
                        onDragStart={(e) => {
                          e.dataTransfer.setData('text/rule-id', rule.id);
                          e.dataTransfer.effectAllowed = 'move';
                          setDraggedRuleId(rule.id);
                        }}
                        onDragEnd={() => {
                          setDraggedRuleId(null);
                          setDragOverRuleTarget(null);
                        }}
                        className="p-1 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded cursor-grab active:cursor-grabbing flex items-center justify-center"
                        title="Glisser-déposer pour réordonner cette règle"
                      >
                        <GripVertical className="w-4 h-4" />
                      </div>

                    {/* Accordion toggle button */}
                    <button
                      type="button"
                      onClick={() => toggleCollapseRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer flex items-center justify-center"
                      title={isCollapsed ? 'Déplier la règle' : 'Replier la règle (gain de place)'}
                    >
                      {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>

                    <input
                      type="text"
                      value={rule.name}
                      onChange={(e) => updateRule(rule.id, { name: e.target.value })}
                      className="text-sm font-black text-slate-900 bg-transparent hover:bg-slate-100 focus:bg-white px-2 py-1 rounded-xl border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none transition-colors flex-1 min-w-[200px] max-w-[50%]"
                      placeholder="Nom de la règle..."
                    />

                    {/* Folder assignment picker (Masqué par défaut, activable dans Settings) */}
                    {settings?.showRuleFolders && (
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg border border-slate-200">
                        <Folder className="w-3 h-3 text-slate-400" />
                        <select
                          value={rule.folderId || 'none'}
                          onChange={(e) => setRuleFolder(rule.id, e.target.value === 'none' ? undefined : e.target.value)}
                          className="text-[11px] font-bold text-slate-600 bg-transparent outline-none cursor-pointer pr-1"
                        >
                          <option value="none">Sans dossier</option>
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              Dossier : {f.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    {/* Bouton Toggle Auto-remise à l'état initial */}
                    <button
                      type="button"
                      onClick={() => updateRule(rule.id, { trigger: { ...rule.trigger, autoRevert: !rule.trigger.autoRevert } })}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1 ${
                        rule.trigger.autoRevert
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs'
                          : 'bg-slate-100 text-slate-500 border border-slate-200 hover:text-slate-700'
                      }`}
                      title="Remise automatique à l'état initial lors de la fin de l'événement (relâchement, sortie de survol, etc.)"
                    >
                      <span>↩️ Auto-remise</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleRule(rule.id)}
                      className={`px-2.5 py-0.5 text-[10px] font-bold rounded-lg transition-colors cursor-pointer ${
                        rule.enabled
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-slate-100 text-slate-500 border border-slate-200'
                      }`}
                    >
                      {rule.enabled ? 'Active' : 'Désactivée'}
                    </button>

                    <button
                      type="button"
                      onClick={() => duplicateRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                      title="Dupliquer cette règle"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => deleteRule(rule.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                      title="Supprimer la règle"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* 2. Compact View when Collapsed (Accordéon fermé) */}
                {isCollapsed ? (
                  <div
                    onClick={() => toggleCollapseRule(rule.id)}
                    className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 hover:bg-indigo-50/40 rounded-2xl border border-slate-200/80 cursor-pointer transition-all"
                  >
                    <div className="flex items-center gap-2 flex-wrap text-xs">
                      {isGlobalTrigger ? (
                        <div className="flex items-center gap-1.5 font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/80 px-2 py-0.5 rounded-xl">
                          <span>⚡ Système / Global</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 font-bold text-slate-800">
                          {subjectMode === 'any' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 font-black">
                              🌐 {subjectDisplayLabel}
                            </span>
                          ) : subjectMode === 'tag' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200 font-black">
                              🏷️ {subjectDisplayLabel}
                            </span>
                          ) : (
                            <>
                              <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-2xs">
                                <EntityMiniPreview entity={subjectEntity} type={subjectType} stateId={rule.trigger.subjectStateId} size={20} />
                              </div>
                              <span>{subjectDisplayLabel}</span>
                            </>
                          )}
                          {rule.trigger.subjectStateId && subjectMode !== 'any' && (
                            <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded font-medium">({subjectStateName})</span>
                          )}
                        </div>
                      )}

                      <span className="text-slate-400">➔</span>

                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 text-white font-bold text-[11px]">
                        <span>{eventIcon}</span>
                        <span>{eventName}</span>
                      </div>

                      {isCollision && (
                        <>
                          <span className="text-slate-400">➔</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            {targetMode === 'any' ? (
                              <span className="px-2 py-0.5 rounded-lg bg-emerald-100 text-emerald-800 border border-emerald-200 font-black">
                                🌐 {targetDisplayLabel}
                              </span>
                            ) : targetMode === 'tag' ? (
                              <span className="px-2 py-0.5 rounded-lg bg-purple-100 text-purple-800 border border-purple-200 font-black">
                                🏷️ {targetDisplayLabel}
                              </span>
                            ) : (
                              <>
                                <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-2xs">
                                  <EntityMiniPreview entity={targetEntity} type={targetType} stateId={rule.trigger.targetStateId} size={20} />
                                </div>
                                <span>{targetDisplayLabel}</span>
                              </>
                            )}
                            {rule.trigger.targetStateId && targetMode !== 'any' && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">({targetStateName})</span>
                            )}
                          </div>
                        </>
                      )}

                      <span className="text-indigo-500 font-bold ml-1">➔</span>

                      {/* Visuel complet des actions en mode compact */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {rule.actions.map((act) => (
                          <React.Fragment key={act.id}>
                            {renderActionSummary(act, rule.trigger)}
                          </React.Fragment>
                        ))}
                        {rule.trigger.autoRevert && (
                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                            <span>↩️ Auto-remise</span>
                          </span>
                        )}
                      </div>
                    </div>

                    <ChevronDown className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                  </div>
                ) : (
                  /* 3. Horizontal Storyboard Flow with Large Cards in One Line (Déplié) */
                  <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                    {/* --- DÉCLENCHEUR SECTION --- */}
                    <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                      {/* CASE 1: SUJET (Large Card) */}
                      <button
                        type="button"
                        onClick={() =>
                          !isGlobalTrigger &&
                          setActiveModal({
                            type: 'subject',
                            ruleId: rule.id,
                            subStep: 'choose_object',
                          })
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          if (!isGlobalTrigger) setDragOverSlot(subjectSlotKey);
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => !isGlobalTrigger && handleDropOnSlot(e, rule.id, 'subject')}
                        className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all text-center group ${
                          isGlobalTrigger
                            ? 'border-indigo-200 bg-indigo-50/20 cursor-default'
                            : dragOverSlot === subjectSlotKey
                            ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105 cursor-pointer'
                            : 'border-slate-200 hover:border-slate-400 cursor-pointer'
                        }`}
                        title={isGlobalTrigger ? 'Événement Global / Système' : "Cliquer pour changer l'objet ou son état requis"}
                      >
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                          Sujet
                        </div>

                        {isGlobalTrigger ? (
                          <>
                            <div className="w-14 h-14 rounded-2xl bg-indigo-100/90 text-indigo-700 border border-indigo-200 flex items-center justify-center text-2xl shadow-inner font-black">
                              ⚡
                            </div>
                            <div className="w-full">
                              <div className="text-xs font-black text-indigo-900 truncate">
                                Système
                              </div>
                              <div className="text-[9px] text-indigo-600 bg-indigo-50 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5">
                                Événement Global
                              </div>
                            </div>
                          </>
                        ) : (
                          <>
                            {subjectMode === 'any' ? (
                              <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                🌐
                              </div>
                            ) : subjectMode === 'tag' ? (
                              <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                🏷️
                              </div>
                            ) : (
                              <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                                <EntityMiniPreview
                                  entity={subjectEntity}
                                  type={subjectType}
                                  stateId={rule.trigger.subjectStateId}
                                  size={48}
                                />
                              </div>
                            )}

                            <div className="w-full">
                              <div className="text-xs font-bold text-slate-800 truncate">
                                {subjectDisplayLabel}
                              </div>
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (subjectMode === 'any' || subjectMode === 'tag') {
                                    setActiveModal({
                                      type: 'subject',
                                      ruleId: rule.id,
                                      subStep: 'choose_object',
                                      selectionMode: subjectMode,
                                      tagInput: rule.trigger.subjectTag || '',
                                    });
                                    return;
                                  }
                                  setActiveModal({
                                    type: 'subject',
                                    ruleId: rule.id,
                                    subStep: 'choose_state',
                                    selectionMode: subjectMode,
                                    selectedEntityType: subjectType,
                                    selectedEntityId: rule.trigger.subjectId,
                                  });
                                }}
                                className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer border ${
                                  subjectMode === 'any'
                                    ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/70'
                                    : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/60'
                                }`}
                                title={
                                  subjectMode === 'any'
                                    ? 'Cliquer pour restreindre à un objet ou tag'
                                    : subjectMode === 'tag'
                                    ? 'Cliquer pour modifier le tag'
                                    : "Cliquer pour changer l'état requis"
                                }
                              >
                                {subjectMode === 'any'
                                  ? 'N\'importe quel objet'
                                  : subjectMode === 'tag'
                                  ? 'Filtre #Tag'
                                  : subjectMode === 'instance'
                                  ? `Instance • ${subjectStateName}`
                                  : subjectStateName}
                              </div>
                            </div>
                          </>
                        )}
                      </button>

                      {/* CASE 2: ÉVÉNEMENT (Large Card) */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            type: 'event',
                            ruleId: rule.id,
                          })
                        }
                        className="w-32 h-36 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group"
                        title="Cliquer pour changer le type d'événement"
                      >
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          Événement
                        </span>
                        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                          {eventIcon}
                        </div>
                        <div className="w-full">
                          <div className="text-xs font-black uppercase tracking-tight text-amber-300 truncate">
                            {eventName}
                          </div>
                          {/* Contrôles interactifs inline pour modifier les valeurs de conditions (Minuteur, Touche, Proximité, Score, Bords) */}
                          {rule.trigger.type === 'timer' && (
                            <div className="mt-1 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="number"
                                min={0.5}
                                step={0.5}
                                value={rule.trigger.timerInterval || 2}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, timerInterval: Math.max(0.5, parseFloat(e.target.value) || 1) } })}
                                className="w-12 text-center text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none"
                              />
                              <span className="text-[9px] text-slate-400">sec</span>
                            </div>
                          )}
                          {rule.trigger.type === 'keyboard' && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={rule.trigger.keyName || 'Space'}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, keyName: e.target.value } })}
                                className="text-[9px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none cursor-pointer w-full text-center"
                              >
                                <option value="Space">Espace</option>
                                <option value="ArrowUp">↑ Haut</option>
                                <option value="ArrowDown">↓ Bas</option>
                                <option value="ArrowLeft">← Gauche</option>
                                <option value="ArrowRight">→ Droite</option>
                                <option value="Enter">Entrée</option>
                                <option value="a">Touche A</option>
                                <option value="w">Touche W</option>
                                <option value="s">Touche S</option>
                                <option value="d">Touche D</option>
                                <option value="any">Toute touche</option>
                              </select>
                            </div>
                          )}
                          {rule.trigger.type === 'proximity' && (
                            <div className="mt-1 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="number"
                                min={10}
                                step={10}
                                value={rule.trigger.proximityDistance || 80}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, proximityDistance: Math.max(10, parseInt(e.target.value) || 50) } })}
                                className="w-14 text-center text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none"
                              />
                              <span className="text-[9px] text-slate-400">px</span>
                            </div>
                          )}
                          {rule.trigger.type === 'boundary' && (
                            <div className="mt-1" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={rule.trigger.boundaryEdge || 'any'}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, boundaryEdge: e.target.value as any } })}
                                className="text-[9px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none cursor-pointer w-full"
                              >
                                <option value="any">Tous bords</option>
                                <option value="top">Haut</option>
                                <option value="bottom">Bas</option>
                                <option value="left">Gauche</option>
                                <option value="right">Droite</option>
                              </select>
                            </div>
                          )}
                          {rule.trigger.type === 'variable' && (
                            <div className="mt-1 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <select
                                value={rule.trigger.variableOperator || '>='}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, variableOperator: e.target.value as any } })}
                                className="text-[9px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none cursor-pointer"
                              >
                                <option value=">=">&gt;=</option>
                                <option value="==">==</option>
                                <option value="<=">&lt;=</option>
                              </select>
                              <input
                                type="number"
                                value={rule.trigger.variableValue ?? 5}
                                onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, variableValue: parseInt(e.target.value) || 0 } })}
                                className="w-10 text-center text-[10px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none"
                              />
                            </div>
                          )}
                          {rule.trigger.type === 'collision' && (
                            <div className="mt-1 flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                              <input
                                type="number"
                                min={0}
                                max={60}
                                step={2}
                                value={rule.trigger.collisionExitMargin ?? 10}
                                onChange={(e) =>
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                                    },
                                  })
                                }
                                title="Marge anti-rebond de sortie (px)"
                                className="w-10 text-center text-[9px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-0.5 py-0.5 outline-none"
                              />
                              <span className="text-[8px] text-slate-400">px</span>
                              <button
                                type="button"
                                onClick={() =>
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      collisionTriggerOnce: !rule.trigger.collisionTriggerOnce,
                                    },
                                  })
                                }
                                title="Limiter à 1 seul déclenchement par paire d'objets"
                                className={`px-1.5 py-0.5 rounded text-[8px] font-black cursor-pointer border transition-colors ${
                                  rule.trigger.collisionTriggerOnce
                                    ? 'bg-emerald-500 text-white border-emerald-400'
                                    : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
                                }`}
                              >
                                1×
                              </button>
                            </div>
                          )}
                          {rule.trigger.type !== 'timer' && rule.trigger.type !== 'keyboard' && rule.trigger.type !== 'proximity' && rule.trigger.type !== 'boundary' && rule.trigger.type !== 'variable' && rule.trigger.type !== 'collision' && (
                            <div className="text-[9px] text-slate-400 truncate mt-0.5">
                              {eventSub}
                            </div>
                          )}
                        </div>
                      </button>

                      {/* CASE 3: CIBLE (Seulement si Collision) */}
                      {isCollision && (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveModal({
                              type: 'target',
                              ruleId: rule.id,
                              subStep: 'choose_object',
                              selectionMode: targetMode,
                              selectedEntityId: rule.trigger.targetId,
                              tagInput: rule.trigger.targetTag || '',
                            })
                          }
                          onDragOver={(e) => {
                            e.preventDefault();
                            setDragOverSlot(targetSlotKey);
                          }}
                          onDragLeave={() => setDragOverSlot(null)}
                          onDrop={(e) => handleDropOnSlot(e, rule.id, 'target')}
                          className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                            dragOverSlot === targetSlotKey
                              ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                              : 'border-slate-200 hover:border-slate-400'
                          }`}
                          title="Cliquer pour changer la cible, son tag ou son état requis"
                        >
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                            Cible touchée
                          </div>

                          {targetMode === 'any' ? (
                            <div className="w-14 h-14 rounded-xl bg-emerald-100 text-emerald-700 border border-emerald-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                              🌐
                            </div>
                          ) : targetMode === 'tag' ? (
                            <div className="w-14 h-14 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                              🏷️
                            </div>
                          ) : (
                            <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                              <EntityMiniPreview
                                entity={targetEntity}
                                type={targetType}
                                stateId={rule.trigger.targetStateId}
                                size={48}
                              />
                            </div>
                          )}

                          <div className="w-full">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {targetDisplayLabel}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                if (targetMode === 'any' || targetMode === 'tag') {
                                  setActiveModal({
                                    type: 'target',
                                    ruleId: rule.id,
                                    subStep: 'choose_object',
                                    selectionMode: targetMode,
                                    tagInput: rule.trigger.targetTag || '',
                                  });
                                  return;
                                }
                                setActiveModal({
                                  type: 'target',
                                  ruleId: rule.id,
                                  subStep: 'choose_state',
                                  selectionMode: targetMode,
                                  selectedEntityType: targetType,
                                  selectedEntityId: rule.trigger.targetId,
                                });
                              }}
                              className={`text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer border ${
                                targetMode === 'any'
                                  ? 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border-emerald-200/70'
                                  : 'text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border-indigo-200/60'
                              }`}
                              title={
                                targetMode === 'any'
                                  ? 'Cliquer pour choisir un objet ou tag spécifique'
                                  : targetMode === 'tag'
                                  ? 'Cliquer pour modifier le tag'
                                  : "Cliquer pour changer l'état requis de la cible"
                              }
                            >
                              {targetMode === 'any'
                                ? 'N\'importe quel objet'
                                : targetMode === 'tag'
                                ? 'Filtre #Tag'
                                : targetMode === 'instance'
                                ? `Instance • ${targetStateName}`
                                : targetStateName}
                            </div>
                          </div>
                        </button>
                      )}
                    </div>

                    {/* Connecteur Arrow */}
                    <div className="text-slate-400 flex items-center justify-center shrink-0">
                      <ArrowRight className="w-5 h-5 text-indigo-500" strokeWidth={2.5} />
                    </div>

                    {/* --- ACTIONS SÉQUENCE --- */}
                    <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                      {rule.actions.map((act, actIdx) => {
                        const actTargetMode = act.targetMode || 'target';
                        const actTargetType =
                          actTargetMode === 'subject'
                            ? subjectType
                            : actTargetMode === 'target'
                            ? targetType
                            : act.targetType || targetType;

                        const actEntity = getEntityObj(actTargetType);
                        const actStateObj = actEntity && act.targetStateId ? actEntity.states[act.targetStateId] : null;
                        const customSound = act.customSoundId ? customSounds.find((s) => s.id === act.customSoundId) : null;

                        let actionBadge = 'Action';
                        let actionDetail = 'Exécuter';

                        if (act.type === 'change_state') {
                          actionBadge = "Changer d'état";
                          const targetLabel =
                            act.targetMode === 'subject'
                              ? `Sujet (${subjectOpt?.label || subjectType})`
                              : act.targetMode === 'target'
                              ? `Cible (${targetOpt?.label || targetType})`
                              : act.targetMode === 'last_spawned'
                              ? 'Dernier créé'
                              : act.targetMode === 'tag' && act.targetTag
                              ? `#${act.targetTag}`
                              : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                          actionDetail = `${targetLabel} → ${actStateObj?.name || 'État ' + (act.targetStateId || '...')}`;
                        } else if (act.type === 'delete_entity') {
                          actionBadge = 'Détruire';
                          const targetLabel =
                            act.targetMode === 'subject'
                              ? `Sujet (${subjectOpt?.label || subjectType})`
                              : act.targetMode === 'target'
                              ? `Cible (${targetOpt?.label || targetType})`
                              : act.targetMode === 'last_spawned'
                              ? 'Dernier créé'
                              : act.targetMode === 'tag' && act.targetTag
                              ? `#${act.targetTag}`
                              : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                          actionDetail = `Supprimer ${targetLabel}`;
                        } else if (act.type === 'spawn_entity') {
                          actionBadge = 'Créer Entité';
                          const locLabel =
                            act.spawnLocationMode === 'at_event_point'
                              ? 'Point exact'
                              : act.spawnLocationMode === 'offset_event_point'
                              ? 'Décalé (Point exact)'
                              : act.spawnReferenceMode === 'last_spawned'
                              ? 'Sur Dernier créé'
                              : act.spawnReferenceMode === 'tag' && act.spawnReferenceTag
                              ? `Sur #${act.spawnReferenceTag}`
                              : act.spawnReferenceMode === 'entity' && act.spawnReferenceEntityId
                              ? `Sur ${entities[act.spawnReferenceEntityId]?.name || 'Entité'}`
                              : act.spawnLocationMode === 'at_target'
                              ? 'Sur Cible'
                              : act.spawnLocationMode === 'at_subject'
                              ? 'Sur Sujet'
                              : act.spawnLocationMode === 'random'
                              ? 'Aléatoire'
                              : act.spawnLocationMode?.startsWith('offset')
                              ? 'Décalé'
                              : 'Fixe';
                          const spawnEntForState = getEntityObj(act.spawnEntityType);
                          const initStName = act.spawnInitialStateId
                            ? spawnEntForState?.states[act.spawnInitialStateId]?.name
                            : undefined;
                          actionDetail = `+ ${act.spawnEntityType || 'Objet'}${initStName ? ` (${initStName})` : ''} • ${locLabel}`;
                        } else if (act.type === 'emit_particles') {
                          actionBadge = 'Particules';
                          const customP = act.customParticleId
                            ? customParticles.find((p) => p.id === act.customParticleId)?.name
                            : undefined;
                          actionDetail = `${act.particleCount ?? 18}x ${
                            act.particleShape === 'custom' && customP ? `✨ ${customP}` : act.particleShape || 'circle'
                          }${act.particleOriginMode === 'event_point' ? ' • Point exact' : ''}`;
                        } else if (act.type === 'attach_to_parent') {
                          actionBadge = 'Attacher Parent';
                          actionDetail = `Lier à ${
                            act.parentTargetMode === 'subject'
                              ? 'Sujet'
                              : act.parentTargetMode === 'target'
                              ? 'Cible'
                              : act.parentTargetMode === 'last_spawned'
                              ? 'Dernier créé'
                              : act.parentTargetMode === 'tag' && act.parentEntityTag
                              ? `#${act.parentEntityTag}`
                              : act.parentTargetMode === 'entity' && act.parentEntityId
                              ? entities[act.parentEntityId]?.name || 'Entité'
                              : act.parentEntityType || 'Parent'
                          }`;
                        } else if (act.type === 'detach_parent') {
                          actionBadge = 'Détacher Parent';
                          actionDetail = 'Libérer du parent';
                        } else if (act.type === 'play_sound') {
                          actionBadge = 'Jouer Son';
                          actionDetail = customSound ? `Son vocal : ${customSound.name}` : act.soundType ? `Son ${act.soundType}` : 'Effet sonore';
                        } else if (act.type === 'delay') {
                          actionBadge = 'Attendre (Pause)';
                          actionDetail = `Délai : ${act.delayDuration || 1}s`;
                        }

                        const actionSlotKey = `${rule.id}-act-${act.id}`;

                        return (
                          <div key={act.id} className="relative group">
                            {/* Remove Action Button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                const updatedActions = rule.actions.filter((_, idx) => idx !== actIdx);
                                updateRule(rule.id, { actions: updatedActions });
                              }}
                              className="absolute -top-2 -right-2 w-5 h-5 bg-rose-500 hover:bg-rose-600 text-white rounded-full flex items-center justify-center text-xs shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                              title="Supprimer cette action"
                            >
                              <X className="w-3 h-3" />
                            </button>

                            <button
                              type="button"
                              onClick={() =>
                                setActiveModal({
                                  type: 'action',
                                  ruleId: rule.id,
                                  actionIndex: actIdx,
                                  actionId: act.id,
                                  actionType: act.type,
                                  targetMode: act.targetMode || 'target',
                                  subStep:
                                    act.type === 'delay'
                                      ? 'choose_delay_duration'
                                      : act.type === 'emit_particles'
                                      ? 'choose_particles'
                                      : act.type === 'attach_to_parent'
                                      ? 'choose_attach_parent'
                                      : act.type === 'detach_parent'
                                      ? 'choose_detach_parent'
                                      : 'main',
                                  delayDuration: act.delayDuration || 1,
                                  particleOriginMode: act.particleOriginMode,
                                  particleOriginEntityId: act.particleOriginEntityId,
                                  particleOriginEntityType: act.particleOriginEntityType,
                                  particleOriginTag: act.particleOriginTag,
                                  particleCount: act.particleCount,
                                  particleColor: act.particleColor,
                                  particleColor2: act.particleColor2,
                                  particleShape: act.particleShape,
                                  customParticleId: act.customParticleId,
                                  useParticleTint: act.useParticleTint,
                                  particleSpeed: act.particleSpeed,
                                  particleSize: act.particleSize,
                                  particleLifetime: act.particleLifetime,
                                  particleGravity: act.particleGravity,
                                  particleSpread: act.particleSpread,
                                  particleAngle: act.particleAngle,
                                  parentChildMode: act.targetMode,
                                  parentChildType: act.targetType,
                                  parentChildTag: act.targetTag,
                                  parentTargetMode: act.parentTargetMode,
                                  parentEntityId: act.parentEntityId,
                                  parentEntityType: act.parentEntityType,
                                  parentEntityTag: act.parentEntityTag,
                                  parentOffset: act.parentOffset,
                                })
                              }
                              onDragOver={(e) => {
                                e.preventDefault();
                                setDragOverSlot(actionSlotKey);
                              }}
                              onDragLeave={() => setDragOverSlot(null)}
                              onDrop={(e) => handleDropOnSlot(e, rule.id, 'action', act.id)}
                              className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                                dragOverSlot === actionSlotKey
                                  ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                                  : 'border-slate-200 hover:border-slate-400'
                              }`}
                              title="Cliquer pour modifier cette action"
                            >
                              <div className="text-[10px] font-bold text-indigo-600 uppercase tracking-wider">
                                {actionBadge}
                              </div>

                              {act.type === 'delete_entity' ? (
                                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  💥
                                </div>
                              ) : act.type === 'emit_particles' ? (
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  ✨
                                </div>
                              ) : act.type === 'attach_to_parent' ? (
                                <div className="w-14 h-14 rounded-2xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  🔗
                                </div>
                              ) : act.type === 'detach_parent' ? (
                                <div className="w-14 h-14 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  ✂️
                                </div>
                              ) : act.type === 'play_sound' ? (
                                <div className="relative w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  🔊
                                  <div
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handlePlayPreview(act.soundType, act.customSoundId);
                                    }}
                                    className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-1 shadow-xs hover:bg-purple-700 cursor-pointer"
                                    title="Écouter"
                                  >
                                    <Play className="w-2.5 h-2.5 fill-current" />
                                  </div>
                                </div>
                              ) : act.type === 'spawn_entity' ? (
                                <div className="relative w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                                  <EntityMiniPreview
                                    entity={getEntityObj(act.spawnEntityType || 'custom')}
                                    type={act.spawnEntityType || 'custom'}
                                    stateId={act.spawnInitialStateId}
                                    size={44}
                                  />
                                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs text-[10px]">
                                    ✨
                                  </div>
                                </div>
                              ) : act.type === 'delay' ? (
                                <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                  ⏱️
                                </div>
                              ) : (
                                <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                                  <EntityMiniPreview
                                    entity={actEntity}
                                    type={actTargetType}
                                    stateId={act.targetStateId}
                                    size={44}
                                  />
                                </div>
                              )}

                              <div className="w-full">
                                <div className="text-[11px] font-bold text-slate-800 truncate">
                                  {act.type === 'spawn_entity'
                                    ? `Créer ${act.spawnEntityType || 'Objet'}`
                                    : act.type === 'emit_particles'
                                    ? 'Salve de particules'
                                    : act.type === 'play_sound'
                                    ? customSound?.name || `Son ${act.soundType || ''}`
                                    : act.targetMode === 'subject'
                                    ? `Sujet (${subjectOpt?.label || 'Objet'})`
                                    : act.targetMode === 'target'
                                    ? `Cible (${targetOpt?.label || 'Objet'})`
                                    : act.targetMode === 'last_spawned'
                                    ? '✨ Dernier objet créé'
                                    : act.targetMode === 'tag' && act.targetTag
                                    ? `🏷️ Tag #${act.targetTag}`
                                    : actEntity?.name || act.targetType || 'Autre Objet'}
                                </div>
                                <div className="text-[9px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md font-medium truncate mt-0.5">
                                  {actionDetail}
                                </div>
                              </div>
                            </button>
                          </div>
                        );
                      })}

                      {/* + Action Slot Button */}
                      <button
                        type="button"
                        onClick={() =>
                          setActiveModal({
                            type: 'action',
                            ruleId: rule.id,
                            actionIndex: undefined,
                            actionType: 'change_state',
                            targetMode: isCollision ? 'target' : 'subject',
                            subStep: 'main',
                          })
                        }
                        className="w-24 h-36 border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/40 rounded-2xl flex flex-col items-center justify-center gap-2 text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer shrink-0"
                        title="Ajouter une action à la règle"
                      >
                        <Plus className="w-6 h-6" strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-wider">+ Action</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Visual Drag Indicator BELOW */}
              {showGapBelow && (
                <div className="my-1.5 py-1.5 px-4 bg-indigo-50 border-2 border-dashed border-indigo-500 rounded-2xl text-center text-indigo-700 text-xs font-bold shadow-xs animate-pulse flex items-center justify-center gap-1.5">
                  <span>↑ Placer la règle ici (En-dessous)</span>
                </div>
              )}
            </div>
            );
          })
        )}
      </div>

      {/* --- PAGINATION BAR (Max 5 règles par page) --- */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-3 py-2 bg-white rounded-2xl border border-slate-200/90 text-xs font-bold text-slate-700 shrink-0 shadow-2xs">
          <button
            type="button"
            disabled={validPage === 1}
            onClick={() => setCurrentPage(Math.max(1, validPage - 1))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-slate-700 transition-all cursor-pointer flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Précédent</span>
          </button>

          <div className="flex items-center gap-2">
            <span className="text-slate-500 text-[11px]">Règles {((validPage - 1) * RULES_PER_PAGE) + 1} à {Math.min(filteredRules.length, validPage * RULES_PER_PAGE)} sur {filteredRules.length}</span>
            <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-lg font-mono">
              Page {validPage} / {totalPages}
            </span>
          </div>

          <button
            type="button"
            disabled={validPage === totalPages}
            onClick={() => setCurrentPage(Math.min(totalPages, validPage + 1))}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 disabled:opacity-40 disabled:pointer-events-none rounded-xl text-slate-700 transition-all cursor-pointer flex items-center gap-1"
          >
            <span>Suivant</span>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🪄 1-CLICK SEQUENTIAL CREATION WIZARD (Grandes Cartes, 1 Clic par Étape) */}
      {/* ========================================================================= */}
      {activeWizard && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl border border-slate-200 p-6 w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col overflow-hidden ${
            activeWizard.step === 4 && activeWizard.triggerType === 'collision' ? 'max-w-5xl' : 'max-w-4xl'
          }`}>
            {/* Header with Stepper */}
            <div className="border-b border-slate-100 pb-3 shrink-0 flex items-center justify-between">
              <div className="flex items-center gap-3">
                {activeWizard.step > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      if (activeWizard.actionSubStep === 'toggle_states_picker') {
                        setActiveWizard({ ...activeWizard, actionSubStep: 'toggle_entity_picker' });
                      } else if (activeWizard.actionSubStep === 'spawn_location_picker') {
                        const spEnt = getEntityObj(activeWizard.pendingSpawnType);
                        const hasMultiStates = Object.keys(spEnt?.states || {}).length > 1;
                        setActiveWizard({
                          ...activeWizard,
                          actionSubStep: hasMultiStates ? 'spawn_state_picker' : 'spawn_entity_picker',
                        });
                      } else if (activeWizard.actionSubStep === 'spawn_state_picker') {
                        setActiveWizard({ ...activeWizard, actionSubStep: 'spawn_entity_picker' });
                      } else if (activeWizard.actionSubStep === 'third_party_state_picker') {
                        setActiveWizard({ ...activeWizard, actionSubStep: 'third_party_entity_picker' });
                      } else if (activeWizard.actionSubStep && activeWizard.actionSubStep !== 'main') {
                        setActiveWizard({ ...activeWizard, actionSubStep: 'main' });
                      } else if (activeWizard.step === 3 && activeWizard.targetSubStep === 'choose_state') {
                        setActiveWizard({ ...activeWizard, targetSubStep: 'choose_object' });
                      } else if (activeWizard.step === 1 && activeWizard.subjectSubStep === 'choose_state') {
                        setActiveWizard({ ...activeWizard, subjectSubStep: 'choose_object' });
                      } else {
                        const prevStep =
                          activeWizard.step === 4 && activeWizard.triggerType !== 'collision' ? 2 : activeWizard.step - 1;
                        setActiveWizard({
                          ...activeWizard,
                          step: prevStep as any,
                          actionSubStep: 'main',
                          subjectSubStep: 'choose_object',
                          targetSubStep: 'choose_object',
                        });
                      }
                    }}
                    className="p-2 text-slate-500 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors"
                    title="Revenir à l'étape précédente"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                )}
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-amber-500" />
                    <span>
                      {activeWizard.step === 1 &&
                        (activeWizard.subjectSubStep === 'choose_state'
                          ? `Étape 1 : Quel état pour ${getEntityObj(activeWizard.subjectType)?.name || activeWizard.subjectType} ?`
                          : 'Étape 1 : Qui agit ? (Objet Sujet)')}
                      {activeWizard.step === 2 && 'Étape 2 : Quel événement déclencheur ?'}
                      {activeWizard.step === 3 &&
                        (activeWizard.targetSubStep === 'choose_state'
                          ? `Étape 3 : Quel état requis pour la cible ${getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType} ?`
                          : 'Étape 3 : Avec quel objet cible ?')}
                      {activeWizard.step === 4 && 'Étape 4 : Que doit-il se passer ? (Action)'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Cliquez sur une grande carte pour passer instantanément à l'étape suivante.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setActiveWizard(null)}
                className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Stepper Progress Badges */}
            <div className="grid grid-cols-4 gap-2 shrink-0">
              {[
                { num: 1, label: '1. Sujet' },
                { num: 2, label: '2. Événement' },
                { num: 3, label: '3. Cible' },
                { num: 4, label: '4. Action' },
              ].map((st) => {
                const isActive = st.num === activeWizard.step;
                const isDone = activeWizard.step > st.num;
                return (
                  <div
                    key={st.num}
                    className={`py-1.5 px-2 rounded-xl text-xs font-bold text-center border transition-all ${
                      isActive
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm scale-102'
                        : isDone
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        : 'bg-slate-50 text-slate-400 border-slate-200'
                    }`}
                  >
                    {st.label}
                  </div>
                );
              })}
            </div>

            {/* --- BODY (Large Cards Grid) --- */}
            <div className="overflow-y-auto flex-1 pr-1 py-1">
              {/* ÉTAPE 1 : SUJET (Grandes Cartes) OU ÉVÉNEMENT GLOBAL */}
              {activeWizard.step === 1 && (
                <div className="space-y-4">
                  {/* Switcher de mode de départ : Par Objet vs Par Événement Global */}
                  <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
                    <button
                      type="button"
                      onClick={() => setWizardEntryTab('subject')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        wizardEntryTab === 'subject'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>📦 Par Objet / Sujet (Plante, Pomme, etc.)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setWizardEntryTab('global_event')}
                      className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
                        wizardEntryTab === 'global_event'
                          ? 'bg-white text-indigo-700 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      <span>⚡ Par Événement Global (Minuteur, Clavier, Score...)</span>
                    </button>
                  </div>

                  {wizardEntryTab === 'global_event' ? (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez un événement thématique global (déclenchement sans sélectionner un objet d'abord) :
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {/* Minuteur / Chronomètre */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'timer',
                              timerInterval: 2,
                              timerType: 'repeat',
                              step: 2,
                              actionSubStep: 'config_event_params',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex items-center gap-4 cursor-pointer transition-all shadow-xs group active:scale-95 text-left"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-amber-100 text-amber-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                            ⏱️
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 group-hover:text-amber-800">
                              Minuteur / Chronomètre
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Exécuter périodiquement (toutes les X secondes)
                            </div>
                          </div>
                        </button>

                        {/* Touche de Clavier */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'keyboard',
                              keyName: 'Space',
                              triggerPhase: 'down',
                              step: 2,
                              actionSubStep: 'config_event_params',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex items-center gap-4 cursor-pointer transition-all shadow-xs group active:scale-95 text-left"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                            ⌨️
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 group-hover:text-purple-800">
                              Touche de Clavier
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Espace, Flèches de direction, Touches A, S, D (Appui ou Relâché)
                            </div>
                          </div>
                        </button>

                        {/* Condition de Score */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'variable',
                              variableName: 'score',
                              variableOperator: '>=',
                              variableValue: 5,
                              step: 2,
                              actionSubStep: 'config_event_params',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex items-center gap-4 cursor-pointer transition-all shadow-xs group active:scale-95 text-left"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                            📊
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 group-hover:text-emerald-800">
                              Score &amp; Compteur
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Déclencher quand le score atteint le seuil choisi
                            </div>
                          </div>
                        </button>

                        {/* Bord de Scène */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              subjectMode: 'any',
                              subjectType: undefined,
                              subjectId: undefined,
                              subjectTag: undefined,
                              subjectStateId: undefined,
                              triggerType: 'boundary',
                              boundaryEdge: 'any',
                              step: 2,
                              actionSubStep: 'config_event_params',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex items-center gap-4 cursor-pointer transition-all shadow-xs group active:scale-95 text-left"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-rose-100 text-rose-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                            🖼️
                          </div>
                          <div>
                            <div className="text-sm font-black text-slate-900 group-hover:text-rose-800">
                              Bord de Scène
                            </div>
                            <div className="text-xs text-slate-500 mt-1">
                              Toucher le cadre extérieur du Canvas
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>
                  ) : activeWizard.subjectSubStep === 'choose_state' ? (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez si la règle requiert un état précis ou s'applique à tous les états :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* Option : Tous les états */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              subjectStateId: undefined,
                              subjectSubStep: 'choose_object',
                              step: 2,
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div className="text-center w-full">
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                              Tous les états
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">N'importe quelle apparence</div>
                          </div>
                        </button>

                        {/* Options : États spécifiques */}
                        {Object.values(getEntityObj(activeWizard.subjectType)?.states || {}).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setActiveWizard({
                                ...activeWizard,
                                subjectStateId: st.id,
                                subjectSubStep: 'choose_object',
                                step: 2,
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview
                                entity={getEntityObj(activeWizard.subjectType)}
                                type={activeWizard.subjectType}
                                stateId={st.id}
                                size={52}
                              />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                État {st.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Seulement dans cet état</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sélecteur Type / #Tag / Instance précise / Tous objets (Sujet) */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'type' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            (activeWizard.subjectMode || 'type') === 'type'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🧩 Par Type
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'tag' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.subjectMode === 'tag'
                              ? 'bg-white text-purple-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🏷️ Par #Tag
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'instance' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.subjectMode === 'instance'
                              ? 'bg-white text-cyan-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📍 Instance
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, subjectMode: 'any' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.subjectMode === 'any'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🌐 Tous objets
                        </button>
                      </div>

                      {activeWizard.subjectMode === 'any' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveWizard({
                              ...activeWizard,
                              subjectMode: 'any',
                              subjectType: undefined,
                              subjectId: undefined,
                              subjectTag: undefined,
                              subjectStateId: undefined,
                              step: 2,
                            })
                          }
                          className="w-full p-6 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs group text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                              🌐
                            </div>
                            <div>
                              <div className="text-sm font-black text-emerald-950">
                                Tous les objets de la scène
                              </div>
                              <div className="text-xs text-emerald-700 mt-1">
                                La règle s'appliquera à n'importe quelle entité (présente ou créée en cours de partie).
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
                        </button>
                      ) : activeWizard.subjectMode === 'tag' ? (
                        <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
                          <div className="text-xs font-bold text-purple-950">
                            Cibler toutes les entités (existantes ou créées en jeu) portant un #Tag :
                          </div>
                          {allProjectTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {allProjectTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() =>
                                    setActiveWizard({
                                      ...activeWizard,
                                      subjectMode: 'tag',
                                      subjectTag: tag,
                                      subjectStateId: undefined,
                                      step: 2,
                                    })
                                  }
                                  className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                                >
                                  #{tag} →
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={activeWizard.subjectTag || ''}
                              onChange={(e) =>
                                setActiveWizard({ ...activeWizard, subjectTag: e.target.value.replace(/^#/, '') })
                              }
                              placeholder="Ou saisir un tag (ex: ennemi, piece...)"
                              className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                            />
                            <button
                              type="button"
                              disabled={!activeWizard.subjectTag?.trim()}
                              onClick={() => {
                                if (!activeWizard.subjectTag?.trim()) return;
                                setActiveWizard({
                                  ...activeWizard,
                                  subjectMode: 'tag',
                                  subjectTag: activeWizard.subjectTag.trim().replace(/^#/, ''),
                                  subjectStateId: undefined,
                                  step: 2,
                                });
                              }}
                              className="px-4 py-2 bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Valider →
                            </button>
                          </div>
                        </div>
                      ) : activeWizard.subjectMode === 'instance' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {entityList.length === 0 ? (
                            <div className="col-span-full text-center text-xs text-slate-500 py-6">
                              Aucune entité posée sur la scène.
                            </div>
                          ) : (
                            entityList.map((inst) => {
                              const statesCount = Object.keys(inst.states || {}).length;
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => {
                                    if (statesCount > 1) {
                                      setActiveWizard({
                                        ...activeWizard,
                                        subjectMode: 'instance',
                                        subjectId: inst.id,
                                        subjectType: inst.type,
                                        subjectSubStep: 'choose_state',
                                      });
                                    } else {
                                      setActiveWizard({
                                        ...activeWizard,
                                        subjectMode: 'instance',
                                        subjectId: inst.id,
                                        subjectType: inst.type,
                                        subjectStateId: undefined,
                                        step: 2,
                                      });
                                    }
                                  }}
                                  className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                                >
                                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                                    <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                                  </div>
                                  <div className="text-center w-full">
                                    <div className="text-xs font-black text-slate-800 truncate">{inst.name}</div>
                                    <div className="text-[10px] text-slate-400">
                                      ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesCount = Object.keys(ent?.states || {}).length;
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesCount > 1) {
                                    setActiveWizard({
                                      ...activeWizard,
                                      subjectMode: 'type',
                                      subjectType: opt.type,
                                      subjectSubStep: 'choose_state',
                                    });
                                  } else {
                                    setActiveWizard({
                                      ...activeWizard,
                                      subjectMode: 'type',
                                      subjectType: opt.type,
                                      subjectStateId: undefined,
                                      step: 2,
                                    });
                                  }
                                }}
                                className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                              >
                                <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={64} />
                                </div>
                                <div className="text-center w-full">
                                  <div className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                    {opt.label}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {statesCount > 1 ? `${statesCount} états disponibles →` : 'Choisir comme Sujet →'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 2 : ÉVÉNEMENT (Organisé en Cases Logiques & Écran Intermédiaire de Paramètres) */}
              {activeWizard.step === 2 && (
                activeWizard.actionSubStep === 'config_event_params' ? (
                  <div className="bg-slate-50/90 p-6 rounded-3xl border border-slate-200/90 space-y-6 max-w-xl mx-auto shadow-xs animate-in fade-in zoom-in-95">
                    <div className="flex items-center gap-3 border-b border-slate-200 pb-4">
                      <div className="w-12 h-12 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl font-black shadow-inner">
                        ⚙️
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-900">
                          Réglage des paramètres de l'événement
                        </h4>
                        <p className="text-xs text-slate-500">
                          Définissez la valeur exacte pour cet événement avant de continuer.
                        </p>
                      </div>
                    </div>

                    {/* 1. Minuteur / Timer */}
                    {activeWizard.triggerType === 'timer' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Intervalle de temps (secondes) :</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={0.5}
                              step={0.5}
                              value={activeWizard.timerInterval || 2}
                              onChange={(e) => setActiveWizard({ ...activeWizard, timerInterval: Math.max(0.5, parseFloat(e.target.value) || 1) })}
                              className="w-28 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
                            />
                            <span className="text-xs text-slate-500 font-bold">secondes</span>
                          </div>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Fréquence de déclenchement :</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveWizard({ ...activeWizard, timerType: 'repeat' })}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                activeWizard.timerType !== 'once' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              🔁 Répéter (Toutes les X sec)
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveWizard({ ...activeWizard, timerType: 'once' })}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                activeWizard.timerType === 'once' ? 'bg-indigo-50 border-indigo-500 text-indigo-700 shadow-2xs' : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              1️⃣ Une seule fois (Après X sec)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 2. Touche de Clavier */}
                    {activeWizard.triggerType === 'keyboard' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Touche à détecter :</label>
                          <select
                            value={activeWizard.keyName || 'Space'}
                            onChange={(e) => setActiveWizard({ ...activeWizard, keyName: e.target.value })}
                            className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                          >
                            <option value="Space">Touche Espace (Spacebar)</option>
                            <option value="ArrowUp">↑ Flèche Haut</option>
                            <option value="ArrowDown">↓ Flèche Bas</option>
                            <option value="ArrowLeft">← Flèche Gauche</option>
                            <option value="ArrowRight">→ Flèche Droite</option>
                            <option value="Enter">Touche Entrée</option>
                            <option value="a">Touche A</option>
                            <option value="w">Touche W</option>
                            <option value="s">Touche S</option>
                            <option value="d">Touche D</option>
                            <option value="any">N'importe quelle touche</option>
                          </select>
                        </div>

                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Phase de la touche (Key Down / Key Up) :</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'down' })}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                activeWizard.triggerPhase !== 'up' && activeWizard.triggerPhase !== 'key_up'
                                  ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              👇 Appui (Key Down)
                            </button>
                            <button
                              type="button"
                              onClick={() => setActiveWizard({ ...activeWizard, triggerPhase: 'up' })}
                              className={`p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                                activeWizard.triggerPhase === 'up' || activeWizard.triggerPhase === 'key_up'
                                  ? 'bg-purple-50 border-purple-500 text-purple-700 shadow-2xs'
                                  : 'bg-white border-slate-200 text-slate-600'
                              }`}
                            >
                              🖐️ Relâchement (Key Up)
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 3. Proximité */}
                    {activeWizard.triggerType === 'proximity' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Rayon de proximité (pixels) :</label>
                          <div className="flex items-center gap-3">
                            <input
                              type="number"
                              min={10}
                              step={10}
                              value={activeWizard.proximityDistance || 80}
                              onChange={(e) => setActiveWizard({ ...activeWizard, proximityDistance: Math.max(10, parseInt(e.target.value) || 50) })}
                              className="w-32 text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                            />
                            <span className="text-xs text-slate-500 font-bold">pixels</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 4. Variable / Score */}
                    {activeWizard.triggerType === 'variable' && (
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Comparaison :</label>
                            <select
                              value={activeWizard.variableOperator || '>='}
                              onChange={(e) => setActiveWizard({ ...activeWizard, variableOperator: e.target.value as any })}
                              className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                            >
                              <option value=">=">Supérieur ou Égal (&gt;=)</option>
                              <option value="==">Exactement Égal (==)</option>
                              <option value="<=">Inférieur ou Égal (&lt;=)</option>
                            </select>
                          </div>

                          <div>
                            <label className="text-xs font-bold text-slate-700 block mb-1">Valeur du Score :</label>
                            <input
                              type="number"
                              value={activeWizard.variableValue ?? 5}
                              onChange={(e) => setActiveWizard({ ...activeWizard, variableValue: parseInt(e.target.value) || 0 })}
                              className="w-full text-center text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2 outline-none"
                            />
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 5. Bord de Scène */}
                    {activeWizard.triggerType === 'boundary' && (
                      <div className="space-y-4">
                        <div>
                          <label className="text-xs font-bold text-slate-700 block mb-1">Bord de scène à contacter :</label>
                          <select
                            value={activeWizard.boundaryEdge || 'any'}
                            onChange={(e) => setActiveWizard({ ...activeWizard, boundaryEdge: e.target.value as any })}
                            className="w-full text-sm font-bold bg-white text-slate-900 border border-slate-300 rounded-xl px-3 py-2.5 outline-none cursor-pointer"
                          >
                            <option value="any">N'importe quel bord</option>
                            <option value="top">Bord Haut</option>
                            <option value="bottom">Bord Bas</option>
                            <option value="left">Bord Gauche</option>
                            <option value="right">Bord Droit</option>
                          </select>
                        </div>
                      </div>
                    )}

                    {/* 6. Option d'Auto-remise dédiée */}
                    {['click', 'hover', 'keyboard', 'collision', 'proximity'].includes(activeWizard.triggerType) && (
                      <div className="pt-2 border-t border-slate-200/80 space-y-2">
                        <label className="text-xs font-bold text-slate-800 block flex items-center gap-1.5">
                          <span>🔄 Option d'Auto-remise (Restaurer l'état initial au relâchement/sortie) :</span>
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setActiveWizard({ ...activeWizard, autoRevert: true })}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              activeWizard.autoRevert
                                ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-300/60 text-emerald-950 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-black text-xs text-emerald-800">
                              <span>↩️ Activer l'Auto-remise</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                              Restaure l'état initial au relâchement (clic/touche) ou à la fin du survol/contact (ex: Clic Down → État B, Clic Up → Normal).
                            </span>
                          </button>

                          <button
                            type="button"
                            onClick={() => setActiveWizard({ ...activeWizard, autoRevert: false })}
                            className={`p-3 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                              !activeWizard.autoRevert
                                ? 'bg-slate-100 border-slate-400 ring-2 ring-slate-300/60 text-slate-900 shadow-2xs'
                                : 'bg-white border-slate-200 hover:border-slate-300 text-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-black text-xs text-slate-700">
                              <span>➡️ Pas d'Auto-remise</span>
                            </div>
                            <span className="text-[10px] text-slate-500 font-medium mt-1 leading-tight">
                              Conserve le nouvel état définitivement après l'événement.
                            </span>
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const needsTarget = activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity';
                          const nextStep = needsTarget ? 3 : 4;
                          setActiveWizard({
                            ...activeWizard,
                            step: nextStep,
                            actionSubStep: 'main',
                            targetSubStep: 'choose_object',
                          });
                        }}
                        className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                      >
                        <span>Continuer vers {activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity' ? 'la Cible' : "l'Action"}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ) : (
                <div className="space-y-5">
                  {/* CASE 1 : COLLISIONS & CONTACTS */}
                  <div className="bg-indigo-50/50 p-4 rounded-3xl border border-indigo-200/80 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-black uppercase text-indigo-800 tracking-wider">
                      <span>💥 Collisions & Contacts entre Objets</span>
                      <span className="text-[10px] font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-full">
                        Nécessite une Cible
                      </span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {/* Collision Entrée */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'collision',
                            triggerPhase: 'enter',
                            step: 3,
                            targetSubStep: 'choose_object',
                          });
                        }}
                        className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          💥
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                            Collision Entrée
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Premier contact quand le sujet touche la cible
                          </div>
                        </div>
                      </button>

                      {/* Collision Sortie */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'collision',
                            triggerPhase: 'exit',
                            step: 3,
                            targetSubStep: 'choose_object',
                          });
                        }}
                        className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-sky-100 text-sky-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          💨
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                            Collision Sortie
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Séparation dès que le sujet quitte la cible
                          </div>
                        </div>
                      </button>

                      {/* Contact Continu */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'collision',
                            triggerPhase: 'stay',
                            step: 3,
                            targetSubStep: 'choose_object',
                          });
                        }}
                        className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          ⏳
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                            Contact Continu
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Maintenu tant que les deux objets se touchent
                          </div>
                        </div>
                      </button>

                      {/* Collision Au Relâchement */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'collision',
                            triggerPhase: 'collision_release',
                            step: 3,
                            targetSubStep: 'choose_object',
                          });
                        }}
                        className="p-4 bg-white hover:bg-indigo-100/60 border-2 border-indigo-100 hover:border-indigo-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          🎯
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                            Lâché sur Cible
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Relâchement du sujet pendant la collision
                          </div>
                        </div>
                      </button>
                    </div>

                    {/* Options anti-boucle Collision (Hystérésis & 1x par paire) */}
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-indigo-200/70">
                      <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900">
                        <span>Marge anti-rebond sortie :</span>
                        <input
                          type="number"
                          min={0}
                          max={60}
                          step={2}
                          value={activeWizard.collisionExitMargin ?? 10}
                          onChange={(e) =>
                            setActiveWizard({
                              ...activeWizard,
                              collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                            })
                          }
                          className="w-14 px-2 py-1 text-center text-xs font-bold bg-white border border-indigo-200 rounded-lg outline-none focus:border-indigo-500"
                        />
                        <span className="text-[10px] text-indigo-600 font-normal">px (évite les boucles si l'état change de taille)</span>
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveWizard({
                            ...activeWizard,
                            collisionTriggerOnce: !activeWizard.collisionTriggerOnce,
                          })
                        }
                        className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                          activeWizard.collisionTriggerOnce
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                            : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/60'
                        }`}
                      >
                        {activeWizard.collisionTriggerOnce ? '✓ 1 seule fois par paire' : '1× par paire (Optionnel)'}
                      </button>
                    </div>
                  </div>

                  {/* CASE 2 : CLICS & POINTEUR */}
                  <div className="bg-purple-50/50 p-4 rounded-3xl border border-purple-200/80 space-y-3">
                    <div className="text-xs font-black uppercase text-purple-800 tracking-wider">
                      👆 Clics & Pointeur Souris / Tactile
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {/* Clic Complet */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'click',
                            triggerPhase: 'click',
                            step: 4,
                            actionSubStep: 'main',
                          });
                        }}
                        className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          👆
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                            Clic Complet
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Action exécutée lors d'un clic complet sur l'objet
                          </div>
                        </div>
                      </button>

                      {/* Appui Clic (Mouse Down) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'click',
                            triggerPhase: 'down',
                            step: 4,
                            actionSubStep: 'main',
                          });
                        }}
                        className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          👇
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                            Appui Clic (Mouse Down)
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Dès la pression du bouton du pointeur
                          </div>
                        </div>
                      </button>

                      {/* Relâchement Clic (Mouse Up) */}
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'click',
                            triggerPhase: 'up',
                            step: 4,
                            actionSubStep: 'main',
                          });
                        }}
                        className="p-4 bg-white hover:bg-purple-100/60 border-2 border-purple-100 hover:border-purple-500 rounded-2xl flex flex-col justify-between gap-2 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          🖐️
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                            Relâchement Clic (Mouse Up)
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Au relâchement du bouton du pointeur
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* CASE 3 & 4 : SURVOL & GLISSER-DÉPOSER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* CASE 3 : SURVOL SOURIS (HOVER) */}
                    <div className="bg-amber-50/50 p-4 rounded-3xl border border-amber-200/80 space-y-3">
                      <div className="text-xs font-black uppercase text-amber-800 tracking-wider">
                        👀 Survol Souris (Hover)
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'hover',
                              triggerPhase: 'hover_enter',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-3.5 bg-white hover:bg-amber-100/60 border-2 border-amber-100 hover:border-amber-500 rounded-2xl flex flex-col justify-between gap-1.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                            👀
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-800">
                              Survol Entrée
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Mouse Hover Enter
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'hover',
                              triggerPhase: 'hover_exit',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-3.5 bg-white hover:bg-amber-100/60 border-2 border-amber-100 hover:border-amber-500 rounded-2xl flex flex-col justify-between gap-1.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-xl shadow-2xs group-hover:scale-110 transition-transform">
                            🏃
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-amber-800">
                              Survol Sortie
                            </div>
                            <div className="text-[10px] text-slate-500 mt-0.5">
                              Mouse Hover Exit
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* CASE 4 : GLISSER-DÉPOSER (DRAG & DROP) */}
                    <div className="bg-emerald-50/50 p-4 rounded-3xl border border-emerald-200/80 space-y-3">
                      <div className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                        🫳 Glisser-Déposer libre
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'drag',
                            triggerPhase: 'drag_release',
                            step: 4,
                            actionSubStep: 'main',
                          });
                        }}
                        className="w-full p-3.5 bg-white hover:bg-emerald-100/60 border-2 border-emerald-100 hover:border-emerald-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                          🫳
                        </div>
                        <div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-emerald-800">
                            Relâcher dans le vide (Drop)
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Quand l'objet est déposé n'importe où sur le canvas
                          </div>
                        </div>
                      </button>
                    </div>
                  </div>

                  {/* CASE 5 & 6 : MINUTEURS & CLAVIER */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* CASE 5 : MINUTEURS & CHRONOMÈTRES */}
                    <div className="bg-cyan-50/50 p-4 rounded-3xl border border-cyan-200/80 space-y-3">
                      <div className="text-xs font-black uppercase text-cyan-800 tracking-wider">
                        ⏱️ Minuteurs & Chronomètres
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'timer',
                              timerInterval: 3,
                              timerType: 'once',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-3 bg-white hover:bg-cyan-100/60 border-2 border-cyan-100 hover:border-cyan-500 rounded-2xl text-left cursor-pointer transition-all shadow-xs group"
                        >
                          <div className="text-xl mb-1">⏱️</div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-cyan-800">
                            Après 3 secondes
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Timer unique
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              triggerType: 'timer',
                              timerInterval: 2,
                              timerType: 'repeat',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-3 bg-white hover:bg-cyan-100/60 border-2 border-cyan-100 hover:border-cyan-500 rounded-2xl text-left cursor-pointer transition-all shadow-xs group"
                        >
                          <div className="text-xl mb-1">🔄</div>
                          <div className="text-xs font-black text-slate-900 group-hover:text-cyan-800">
                            Toutes les 2 secondes
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Timer récurrent
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* CASE 6 : CLAVIER & COMMANDES (Unique carte -> Choix de la touche) */}
                    <div className="bg-slate-100/80 p-4 rounded-3xl border border-slate-300 space-y-3">
                      <div className="text-xs font-black uppercase text-slate-800 tracking-wider">
                        ⌨️ Touches du Clavier
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'keyboard',
                            actionSubStep: 'key_picker',
                          });
                        }}
                        className="w-full p-4 bg-white hover:bg-slate-200/80 border-2 border-slate-300 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-12 h-12 rounded-xl bg-slate-200 text-slate-800 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                          ⌨️
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                            Touche de Clavier
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            Choisir la touche (Espace, Flèches, Z/Q/S/D, Entrée, etc.) →
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-indigo-600 shrink-0" />
                      </button>
                    </div>
                  </div>

                  {/* CASE 7, 8, 9, 10 : ÉTATS, PROXIMITÉ, BORDS & SCORE */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* CASE 7 : CHANGEMENT D'ÉTAT */}
                    <div className="bg-violet-50/50 p-3.5 rounded-2xl border border-violet-200 space-y-2">
                      <div className="text-xs font-black uppercase text-violet-800">🔄 Changement d'État</div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'state_change',
                            step: 4,
                            actionSubStep: 'main',
                          });
                        }}
                        className="w-full p-2.5 bg-white hover:bg-violet-100 border border-violet-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                      >
                        <span className="text-xl">✨</span>
                        <div>
                          <div className="text-xs font-black text-slate-900">Nouveau statut</div>
                          <div className="text-[9px] text-slate-500">L'objet passe à l'état X</div>
                        </div>
                      </button>
                    </div>

                    {/* CASE 8 : PROXIMITÉ */}
                    <div className="bg-sky-50/50 p-3.5 rounded-2xl border border-sky-200 space-y-2">
                      <div className="text-xs font-black uppercase text-sky-800">📏 Proximité</div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'proximity',
                            proximityDistance: 80,
                            actionSubStep: 'config_event_params',
                          });
                        }}
                        className="w-full p-2.5 bg-white hover:bg-sky-100 border border-sky-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                      >
                        <span className="text-xl">📏</span>
                        <div>
                          <div className="text-xs font-black text-slate-900">Approche Cible</div>
                          <div className="text-[9px] text-slate-500">Définir le rayon en px →</div>
                        </div>
                      </button>
                    </div>

                    {/* CASE 9 : BORDS DE SCÈNE */}
                    <div className="bg-rose-50/50 p-3.5 rounded-2xl border border-rose-200 space-y-2">
                      <div className="text-xs font-black uppercase text-rose-800">🖼️ Bords du Canvas</div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'boundary',
                            boundaryEdge: 'any',
                            actionSubStep: 'config_event_params',
                          });
                        }}
                        className="w-full p-2.5 bg-white hover:bg-rose-100 border border-rose-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                      >
                        <span className="text-xl">🖼️</span>
                        <div>
                          <div className="text-xs font-black text-slate-900">Touche le Cadre</div>
                          <div className="text-[9px] text-slate-500">Définir le bord à contacter →</div>
                        </div>
                      </button>
                    </div>

                    {/* CASE 10 : SCORE & VARIABLE */}
                    <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200 space-y-2">
                      <div className="text-xs font-black uppercase text-amber-800">📊 Score &amp; Variables</div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveWizard({
                            ...activeWizard,
                            triggerType: 'variable',
                            variableName: 'score',
                            variableOperator: '>=',
                            variableValue: 5,
                            actionSubStep: 'config_event_params',
                          });
                        }}
                        className="w-full p-2.5 bg-white hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                      >
                        <span className="text-xl">🏆</span>
                        <div>
                          <div className="text-xs font-black text-slate-900">Score &amp; Compteur</div>
                          <div className="text-[9px] text-slate-500">Régler le seuil du score →</div>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )
            )}

              {/* ÉTAPE 3 : CIBLE (Collision - Grandes Cartes) */}
              {activeWizard.step === 3 && (
                <div>
                  {activeWizard.targetSubStep === 'choose_state' ? (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez si la règle requiert un état précis pour la cible {getEntityObj(activeWizard.targetType)?.name || activeWizard.targetType} :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        {/* Option : Tous les états */}
                        <button
                          type="button"
                          onClick={() => {
                            setActiveWizard({
                              ...activeWizard,
                              targetStateId: undefined,
                              targetSubStep: 'choose_object',
                              step: 4,
                              actionSubStep: 'main',
                            });
                          }}
                          className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                            ✨
                          </div>
                          <div className="text-center w-full">
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                              Tous les états
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">Toute apparence de la cible</div>
                          </div>
                        </button>

                        {/* Options : États spécifiques de la cible */}
                        {Object.values(getEntityObj(activeWizard.targetType)?.states || {}).map((st) => (
                          <button
                            key={st.id}
                            type="button"
                            onClick={() => {
                              setActiveWizard({
                                ...activeWizard,
                                targetStateId: st.id,
                                targetSubStep: 'choose_object',
                                step: 4,
                                actionSubStep: 'main',
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                              <EntityMiniPreview
                                entity={getEntityObj(activeWizard.targetType)}
                                type={activeWizard.targetType}
                                stateId={st.id}
                                size={52}
                              />
                            </div>
                            <div className="text-center w-full">
                              <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                État {st.name}
                              </div>
                              <div className="text-[10px] text-slate-400 mt-0.5">Seulement si la cible est dans cet état</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* Sélecteur Type / #Tag / Instance précise / Tous objets (Cible) */}
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'type' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            (activeWizard.targetMode || 'type') === 'type'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🧩 Par Type
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'tag' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.targetMode === 'tag'
                              ? 'bg-white text-purple-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🏷️ Par #Tag
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'instance' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.targetMode === 'instance'
                              ? 'bg-white text-cyan-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📍 Instance
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveWizard({ ...activeWizard, targetMode: 'any' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeWizard.targetMode === 'any'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🌐 Tous objets
                        </button>
                      </div>

                      {activeWizard.targetMode === 'any' ? (
                        <button
                          type="button"
                          onClick={() =>
                            setActiveWizard({
                              ...activeWizard,
                              targetMode: 'any',
                              targetType: undefined,
                              targetId: undefined,
                              targetTag: undefined,
                              targetStateId: undefined,
                              step: 4,
                              actionSubStep: 'main',
                            })
                          }
                          className="w-full p-6 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs group text-left"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-3xl shrink-0 group-hover:scale-110 transition-transform">
                              🌐
                            </div>
                            <div>
                              <div className="text-sm font-black text-emerald-950">
                                N'importe quel autre objet (Tous les objets)
                              </div>
                              <div className="text-xs text-emerald-700 mt-1">
                                Déclencher la collision ou proximité avec tout autre objet sur le canvas (y compris ceux créés en jeu).
                              </div>
                            </div>
                          </div>
                          <ChevronRight className="w-5 h-5 text-emerald-700 shrink-0" />
                        </button>
                      ) : activeWizard.targetMode === 'tag' ? (
                        <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
                          <div className="text-xs font-bold text-purple-950">
                            Déclencher lorsque le Sujet touche n'importe quel objet portant ce #Tag (ex: projectiles, ennemis créés en jeu) :
                          </div>
                          {allProjectTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {allProjectTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() =>
                                    setActiveWizard({
                                      ...activeWizard,
                                      targetMode: 'tag',
                                      targetTag: tag,
                                      targetStateId: undefined,
                                      step: 4,
                                      actionSubStep: 'main',
                                    })
                                  }
                                  className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                                >
                                  #{tag} →
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={activeWizard.targetTag || ''}
                              onChange={(e) =>
                                setActiveWizard({ ...activeWizard, targetTag: e.target.value.replace(/^#/, '') })
                              }
                              placeholder="Ou saisir un tag cible (ex: projectile, mur...)"
                              className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                            />
                            <button
                              type="button"
                              disabled={!activeWizard.targetTag?.trim()}
                              onClick={() => {
                                if (!activeWizard.targetTag?.trim()) return;
                                setActiveWizard({
                                  ...activeWizard,
                                  targetMode: 'tag',
                                  targetTag: activeWizard.targetTag.trim().replace(/^#/, ''),
                                  targetStateId: undefined,
                                  step: 4,
                                  actionSubStep: 'main',
                                });
                              }}
                              className="px-4 py-2 bg-purple-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Valider →
                            </button>
                          </div>
                        </div>
                      ) : activeWizard.targetMode === 'instance' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {entityList.length === 0 ? (
                            <div className="col-span-full text-center text-xs text-slate-500 py-6">
                              Aucune entité posée sur la scène.
                            </div>
                          ) : (
                            entityList.map((inst) => {
                              const statesCount = Object.keys(inst.states || {}).length;
                              return (
                                <button
                                  key={inst.id}
                                  type="button"
                                  onClick={() => {
                                    if (statesCount > 1) {
                                      setActiveWizard({
                                        ...activeWizard,
                                        targetMode: 'instance',
                                        targetId: inst.id,
                                        targetType: inst.type,
                                        targetSubStep: 'choose_state',
                                      });
                                    } else {
                                      setActiveWizard({
                                        ...activeWizard,
                                        targetMode: 'instance',
                                        targetId: inst.id,
                                        targetType: inst.type,
                                        targetStateId: undefined,
                                        step: 4,
                                        actionSubStep: 'main',
                                      });
                                    }
                                  }}
                                  className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                                >
                                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                                    <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                                  </div>
                                  <div className="text-center w-full">
                                    <div className="text-xs font-black text-slate-800 truncate">{inst.name}</div>
                                    <div className="text-[10px] text-slate-400">
                                      ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                                    </div>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesCount = Object.keys(ent?.states || {}).length;
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesCount > 1) {
                                    setActiveWizard({
                                      ...activeWizard,
                                      targetMode: 'type',
                                      targetType: opt.type,
                                      targetSubStep: 'choose_state',
                                    });
                                  } else {
                                    setActiveWizard({
                                      ...activeWizard,
                                      targetMode: 'type',
                                      targetType: opt.type,
                                      targetStateId: undefined,
                                      step: 4,
                                      actionSubStep: 'main',
                                    });
                                  }
                                }}
                                className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3.5 cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                              >
                                <div className="w-20 h-20 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-2 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={64} />
                                </div>
                                <div className="text-center w-full">
                                  <div className="text-sm font-black text-slate-800 group-hover:text-indigo-700 truncate">
                                    {opt.label}
                                  </div>
                                  <div className="text-[11px] text-slate-400 mt-0.5">
                                    {statesCount > 1 ? `${statesCount} états disponibles →` : 'Choisir comme Cible →'}
                                  </div>
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ÉTAPE 4 : ACTION (Grandes Cartes, 1 Clic pour Finaliser) */}
              {activeWizard.step === 4 && (
                <div>
                  {/* Mode Principal Étape 4 */}
                  {activeWizard.actionSubStep === 'main' && (() => {
                    const wizardSubjectEntity = getEntityObj(activeWizard.subjectType);
                    const wizardSubjectOpt = availableEntityOptions.find((o) => o.type === activeWizard.subjectType);
                    const wizardSubjectName = wizardSubjectEntity?.name || wizardSubjectOpt?.label || activeWizard.subjectType;

                    const wizardTargetEntity = getEntityObj(activeWizard.targetType);
                    const wizardTargetOpt = availableEntityOptions.find((o) => o.type === activeWizard.targetType);
                    const wizardTargetName = wizardTargetEntity?.name || wizardTargetOpt?.label || activeWizard.targetType;
                    const isCollision = activeWizard.triggerType === 'collision';

                    return (
                      <div className="space-y-4">
                        {/* Option Auto-remise (Restauration Automatique) */}
                        <div className="flex items-center justify-between bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-3 shadow-2xs">
                          <div className="flex items-center gap-2.5">
                            <span className="text-xl">↩️</span>
                            <div>
                              <div className="text-xs font-black text-emerald-950">
                                Restauration Automatique (Auto-remise)
                              </div>
                              <div className="text-[10px] text-emerald-700 font-medium mt-0.5">
                                Rétablit automatiquement l'état initial lors de la fin de l'événement (relâchement du clic, sortie de survol, etc.)
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setActiveWizard({ ...activeWizard, autoRevert: !activeWizard.autoRevert })}
                            className={`px-3 py-1.5 text-xs font-black rounded-xl transition-all cursor-pointer border shrink-0 ${
                              activeWizard.autoRevert
                                ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                                : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                            }`}
                          >
                            {activeWizard.autoRevert ? '✓ Restauration Active' : 'Désactivée'}
                          </button>
                        </div>

                        <div className={`grid grid-cols-1 ${isCollision ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'} gap-4 items-start`}>
                          {/* SECTION 1 : SUJET */}
                          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                            {/* En-tête Sujet avec miniature et nom de l'entité */}
                            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                              <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                                <EntityMiniPreview
                                  entity={wizardSubjectEntity}
                                  type={activeWizard.subjectType}
                                  stateId={activeWizard.subjectStateId}
                                  size={36}
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                                    Sujet (Qui agit)
                                  </span>
                                </div>
                                <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={wizardSubjectName}>
                                  {wizardSubjectName}
                                </div>
                              </div>
                            </div>

                            {/* Actions sur le Sujet */}
                            <div className="space-y-2.5 flex-1">
                              {/* 1. Changer l'état du Sujet */}
                              <button
                                type="button"
                                onClick={() => {
                                  const statesList = wizardSubjectEntity ? Object.values(wizardSubjectEntity.states) : [];
                                  if (statesList.length > 1) {
                                    setActiveWizard({
                                      ...activeWizard,
                                      actionTargetMode: 'subject',
                                      actionTargetType: activeWizard.subjectType,
                                      actionSubStep: 'state_picker',
                                    });
                                  } else {
                                    completeWizardWithAction({
                                      type: 'change_state',
                                      targetMode: 'subject',
                                      targetType: activeWizard.subjectType,
                                    });
                                  }
                                }}
                                className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔄
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                                    Changer l'état du Sujet
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Transformer « {wizardSubjectName} »
                                  </div>
                                </div>
                              </button>

                              {/* 2. Basculer l'état (Toggle ⇄ / Cycle) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'toggle_entity_picker',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-violet-50/70 border-2 border-slate-200 hover:border-violet-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔀
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-violet-700 truncate">
                                    Basculer l'état (Toggle ⇄ / Cycle)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Alterner A ⇄ B sur « {wizardSubjectName} »
                                  </div>
                                </div>
                              </button>

                              {/* 3. Détruire le Sujet */}
                              <button
                                type="button"
                                onClick={() => {
                                  completeWizardWithAction({
                                    type: 'delete_entity',
                                    targetMode: 'subject',
                                    targetType: activeWizard.subjectType,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  💥
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détruire le Sujet
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Faire disparaître « {wizardSubjectName} »
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* SECTION 2 : CIBLE (Si Collision) */}
                          {isCollision && (
                            <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                              {/* En-tête Cible avec miniature et nom de l'entité */}
                              <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                                  <EntityMiniPreview
                                    entity={wizardTargetEntity}
                                    type={activeWizard.targetType}
                                    stateId={activeWizard.targetStateId}
                                    size={36}
                                  />
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                                      Cible (Touchée)
                                    </span>
                                  </div>
                                  <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={wizardTargetName}>
                                    {wizardTargetName}
                                  </div>
                                </div>
                              </div>

                              {/* Actions sur la Cible */}
                              <div className="space-y-2.5 flex-1">
                                {/* 1. Changer l'état de la Cible */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const statesList = wizardTargetEntity ? Object.values(wizardTargetEntity.states) : [];
                                    if (statesList.length > 1) {
                                      setActiveWizard({
                                        ...activeWizard,
                                        actionTargetMode: 'target',
                                        actionTargetType: activeWizard.targetType,
                                        actionSubStep: 'state_picker',
                                      });
                                    } else {
                                      completeWizardWithAction({
                                        type: 'change_state',
                                        targetMode: 'target',
                                        targetType: activeWizard.targetType,
                                      });
                                    }
                                  }}
                                  className="w-full p-3.5 bg-white hover:bg-emerald-50/70 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                    🔄
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700 truncate">
                                      Changer l'état de la Cible
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      Transformer « {wizardTargetName} »
                                    </div>
                                  </div>
                                </button>

                                {/* 2. Détruire la Cible */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    completeWizardWithAction({
                                      type: 'delete_entity',
                                      targetMode: 'target',
                                      targetType: activeWizard.targetType,
                                    });
                                  }}
                                  className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                    💥
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                      Détruire la Cible
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      Faire disparaître « {wizardTargetName} »
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* SECTION 3 : MONDE & EFFETS */}
                          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                            {/* En-tête Monde & Effets */}
                            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-purple-50 border border-purple-200/80 shadow-2xs">
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xl shrink-0 shadow-2xs">
                                🌐
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                                    Monde & Effets
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                                  Apparitions, sons & tiers
                                </div>
                              </div>
                            </div>

                            {/* Actions Monde & Effets */}
                            <div className="space-y-2.5 flex-1">
                              {/* 1. Créer un nouvel Objet (Spawn) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'spawn_entity_picker',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ✨
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Créer un nouvel Objet (Spawn)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Faire apparaître sur la scène
                                  </div>
                                </div>
                              </button>

                              {/* 2. Jouer un effet sonore */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'sound_picker',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-purple-50/70 border-2 border-slate-200 hover:border-purple-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔊
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-purple-700 truncate">
                                    Jouer un effet sonore
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Effets audio ou voix micro
                                  </div>
                                </div>
                              </button>

                              {/* 2.5. Attendre / Pause (Délai) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'delay_duration_picker',
                                    delayDuration: activeWizard.delayDuration || 1,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ⏱️
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Attendre / Pause (Délai)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Définir un délai en secondes avant l'action suivante
                                  </div>
                                </div>
                              </button>

                              {/* 3. Changer un Autre Objet (Tierce) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'third_party_entity_picker',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-cyan-50/70 border-2 border-slate-200 hover:border-cyan-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🪄
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700 truncate">
                                    Changer un Autre Objet (Tierce)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Modifier une entité C à distance
                                  </div>
                                </div>
                              </button>

                              {/* 4. Détruire un Autre Objet (Tierce) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'third_party_destroy_picker',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  💣
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détruire un Autre Objet (Tierce)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Supprimer une entité C à distance
                                  </div>
                                </div>
                              </button>

                              {/* 5. Émettre des Particules */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'particle_picker',
                                    particleOriginMode: isCollision ? 'target' : 'subject',
                                    particleCount: 20,
                                    particleColor: '#f59e0b',
                                    particleColor2: '#ef4444',
                                    particleShape: 'circle',
                                    particleSpeed: 180,
                                    particleSize: 6,
                                    particleLifetime: 0.7,
                                    particleGravity: 220,
                                    particleSpread: 360,
                                    particleAngle: -90,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🎆
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Émettre des Particules
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Étincelles, explosion ou confettis légers
                                  </div>
                                </div>
                              </button>

                              {/* 6. Attacher à un Parent (Parenting) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'attach_parent_picker',
                                    parentChildMode: 'subject',
                                    parentTargetMode: isCollision ? 'target' : 'entity',
                                    parentEntityId: Object.keys(entities)[0] || '',
                                    parentOffset: { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true },
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔗
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                                    Attacher à un Parent
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Solidariser une entité (arme, accessoire)
                                  </div>
                                </div>
                              </button>

                              {/* 7. Détacher du Parent */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionSubStep: 'detach_parent_picker',
                                    actionTargetMode: 'subject',
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ✂️
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détacher du Parent
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Désolidariser en cours de partie
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>

                        {/* Créer sans action immédiate */}
                        <div className="flex justify-end pt-3 border-t border-slate-100">
                          <button
                            type="button"
                            onClick={() => completeWizardWithAction(undefined)}
                            className="px-5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-2xl transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <span>Terminer sans action (+ Action plus tard)</span>
                            <ChevronRight className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'état (Sujet ou Cible) */}
                  {activeWizard.actionSubStep === 'state_picker' && (() => {
                    const targetEntType = activeWizard.actionTargetType || activeWizard.subjectType;
                    const ent = getEntityObj(targetEntType);
                    const states = ent ? Object.values(ent.states) : [];

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur le nouvel état à appliquer à {ent?.name || targetEntType} :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'change_state',
                                  targetMode: activeWizard.actionTargetMode || 'target',
                                  targetType: targetEntType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={targetEntType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'Entité Tierce */}
                  {activeWizard.actionSubStep === 'third_party_entity_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez quel autre objet vous souhaitez modifier :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                const statesList = ent ? Object.values(ent.states) : [];
                                if (statesList.length > 1) {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionTargetMode: 'type',
                                    actionTargetType: opt.type,
                                    actionSubStep: 'third_party_state_picker',
                                  });
                                } else {
                                  completeWizardWithAction({
                                    type: 'change_state',
                                    targetMode: 'type',
                                    targetType: opt.type,
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700 truncate w-full text-center">
                                {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'état pour l'Entité Tierce */}
                  {activeWizard.actionSubStep === 'third_party_state_picker' && (() => {
                    const targetEntType = activeWizard.actionTargetType || availableEntityOptions[0]?.type || 'plant';
                    const ent = getEntityObj(targetEntType);
                    const states = ent ? Object.values(ent.states) : [];

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Quel état appliquer à {ent?.name || targetEntType} ?
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'change_state',
                                  targetMode: 'type',
                                  targetType: targetEntType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={targetEntType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'objet pour Détruire un Objet Tierce */}
                  {activeWizard.actionSubStep === 'third_party_destroy_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez quel objet (ou groupe d'instances dynamiques) détruire :
                      </div>

                      {/* Pistes C & A : Dernier objet créé ou Tag dynamique */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80">
                        <button
                          type="button"
                          onClick={() => {
                            completeWizardWithAction({
                              type: 'delete_entity',
                              targetMode: 'last_spawned',
                            });
                          }}
                          className="p-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs"
                        >
                          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                            ✨
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-800">Dernier objet créé</div>
                            <div className="text-[10px] text-slate-500">Cible la dernière instance apparue en jeu</div>
                          </div>
                        </button>

                        <div className="p-2.5 bg-white border border-indigo-200 rounded-2xl flex items-center justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-[11px] font-black text-slate-800">🏷️ Par Tag (#tag)</div>
                            <input
                              type="text"
                              value={activeWizard.actionTargetTag || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetTag: e.target.value.replace(/^#/, '') })}
                              placeholder="ex: projectile, piece..."
                              className="w-full mt-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                            />
                          </div>
                          <button
                            type="button"
                            disabled={!activeWizard.actionTargetTag?.trim()}
                            onClick={() => {
                              if (!activeWizard.actionTargetTag?.trim()) return;
                              completeWizardWithAction({
                                type: 'delete_entity',
                                targetMode: 'tag',
                                targetTag: activeWizard.actionTargetTag.trim().replace(/^#/, ''),
                              });
                            }}
                            className="px-3 py-1.5 bg-rose-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                          >
                            Détruire
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'delete_entity',
                                  targetMode: 'type',
                                  targetType: opt.type,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-rose-700 truncate w-full text-center">
                                {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'objet pour Toggle / Cycle */}
                  {activeWizard.actionSubStep === 'toggle_entity_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Sur quel objet basculer l'état (Toggle / Cycle) ?
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          const statesList = ent ? Object.values(ent.states) : [];
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                if (statesList.length >= 2) {
                                  setActiveWizard({
                                    ...activeWizard,
                                    actionTargetType: opt.type,
                                    actionSubStep: 'toggle_states_picker',
                                  });
                                } else {
                                  completeWizardWithAction({
                                    type: 'toggle_state',
                                    targetMode: 'type',
                                    targetType: opt.type,
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-violet-700 truncate w-full text-center">
                                {opt.label}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                {statesList.length} états disponibles
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix des états pour Toggle / Cycle */}
                  {activeWizard.actionSubStep === 'toggle_states_picker' && (() => {
                    const relevantType = activeWizard.actionTargetType || availableEntityOptions[0]?.type || 'apple';
                    const ent = getEntityObj(relevantType);
                    const states = ent ? Object.values(ent.states) : [];
                    const stateA = activeWizard.toggleStateA || states[0]?.id || '';
                    const stateB = activeWizard.toggleStateB || (states[1]?.id || states[0]?.id || '');
                    const targetState = activeWizard.toggleTargetStateId || (states[1]?.id || states[0]?.id || '');

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Comment faire basculer {ent?.name || relevantType} ?
                        </div>

                        <div className="space-y-3">
                          {/* Option 1: Basculer spécifiquement entre 2 états précis */}
                          {states.length >= 2 && (
                            <div className="p-4 bg-white border-2 border-violet-200 rounded-3xl space-y-3 shadow-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                                  ⇄
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900">
                                    Basculer entre 2 états précis
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Passe alternativement de l'état A à l'état B à chaque déclenchement
                                  </div>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Premier état (A) :
                                  </label>
                                  <select
                                    value={stateA}
                                    onChange={(e) =>
                                      setActiveWizard({ ...activeWizard, toggleStateA: e.target.value })
                                    }
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                                  >
                                    {states.map((st) => (
                                      <option key={st.id} value={st.id}>
                                        {st.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    Deuxième état (B) :
                                  </label>
                                  <select
                                    value={stateB}
                                    onChange={(e) =>
                                      setActiveWizard({ ...activeWizard, toggleStateB: e.target.value })
                                    }
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                                  >
                                    {states.map((st) => (
                                      <option key={st.id} value={st.id}>
                                        {st.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  completeWizardWithAction({
                                    type: 'toggle_state',
                                    targetMode: 'type',
                                    targetType: relevantType,
                                    toggleMode: 'two_states',
                                    toggleStateAId: stateA,
                                    toggleStateBId: stateB,
                                  });
                                }}
                                className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                              >
                                Valider la bascule ({ent?.states[stateA]?.name || 'A'} ⇄ {ent?.states[stateB]?.name || 'B'})
                              </button>
                            </div>
                          )}

                          {/* Option 2: Basculer entre l'état actuel et un autre état */}
                          {states.length >= 2 && (
                            <div className="p-4 bg-white border-2 border-indigo-200 rounded-3xl space-y-3 shadow-xs">
                              <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                  ⚡
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900">
                                    Basculer entre l'état actuel et un état cible
                                  </div>
                                  <div className="text-[11px] text-slate-500">
                                    Passe à l'état cible, puis revient à l'état précédent au clic suivant
                                  </div>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                  État cible à activer/désactiver :
                                </label>
                                <select
                                  value={targetState}
                                  onChange={(e) =>
                                    setActiveWizard({ ...activeWizard, toggleTargetStateId: e.target.value })
                                  }
                                  className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-indigo-500 cursor-pointer"
                                >
                                  {states.map((st) => (
                                    <option key={st.id} value={st.id}>
                                      {st.name}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <button
                                type="button"
                                onClick={() => {
                                  completeWizardWithAction({
                                    type: 'toggle_state',
                                    targetMode: 'type',
                                    targetType: relevantType,
                                    toggleMode: 'current_and_target',
                                    toggleTargetStateId: targetState,
                                  });
                                }}
                                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                              >
                                Valider la bascule (Actuel ⇄ {ent?.states[targetState]?.name || 'Cible'})
                              </button>
                            </div>
                          )}

                          {/* Option 3: Cycler tous les états */}
                          <button
                            type="button"
                            onClick={() => {
                              completeWizardWithAction({
                                type: 'toggle_state',
                                targetMode: 'type',
                                targetType: relevantType,
                                toggleMode: 'cycle_all',
                              });
                            }}
                            className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 rounded-3xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group active:scale-98"
                          >
                            <div className="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                              🔄
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-800">
                                Cycler séquentiellement entre tous les états ({states.length} états)
                              </div>
                              <div className="text-[11px] text-slate-500">
                                Fait défiler les états 1 → 2 → 3... en boucle
                              </div>
                            </div>
                          </button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de l'objet à faire apparaître (Spawn) */}
                  {activeWizard.actionSubStep === 'spawn_entity_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Cliquez sur l'objet à faire apparaître :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          const statesList = ent ? Object.values(ent.states) : [];
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                if (statesList.length > 1) {
                                  setActiveWizard({
                                    ...activeWizard,
                                    pendingSpawnType: opt.type,
                                    actionSubStep: 'spawn_state_picker',
                                  });
                                } else {
                                  setActiveWizard({
                                    ...activeWizard,
                                    pendingSpawnType: opt.type,
                                    actionSpawnInitialStateId: undefined,
                                    actionSubStep: 'spawn_location_picker',
                                  });
                                }
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                + {opt.label}
                              </div>
                              {statesList.length > 1 && (
                                <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                                  {statesList.length} états →
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'état initial pour l'objet créé (Spawn State Picker) */}
                  {activeWizard.actionSubStep === 'spawn_state_picker' && (() => {
                    const spawnType = activeWizard.pendingSpawnType || availableEntityOptions[0]?.type || 'apple';
                    const ent = getEntityObj(spawnType);
                    const states = ent ? Object.values(ent.states) : [];

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Choisissez l'état dans lequel « {ent?.name || spawnType} » va apparaître :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                setActiveWizard({
                                  ...activeWizard,
                                  actionSpawnInitialStateId: st.id,
                                  actionSubStep: 'spawn_location_picker',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={spawnType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })()}

                  {/* Sous-étape : Choix de la touche Clavier (Key Picker Window) */}
                  {activeWizard.actionSubStep === 'key_picker' && (
                    <div className="space-y-4">
                      <div className="text-xs font-bold text-slate-600">
                        Choisissez la touche du clavier qui déclenche cette règle :
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {[
                          { key: 'Space', label: "Barre d'Espace", icon: '🚀' },
                          { key: 'ArrowUp', label: 'Flèche Haut ⬆️', icon: '⬆️' },
                          { key: 'ArrowDown', label: 'Flèche Bas ⬇️', icon: '⬇️' },
                          { key: 'ArrowLeft', label: 'Flèche Gauche ⬅️', icon: '⬅️' },
                          { key: 'ArrowRight', label: 'Flèche Droite ➡️', icon: '➡️' },
                          { key: 'Enter', label: 'Touche Entrée ↩️', icon: '↩️' },
                          { key: 'z', label: 'Touche Z (Avancer)', icon: '⌨️' },
                          { key: 'q', label: 'Touche Q (Gauche)', icon: '⌨️' },
                          { key: 's', label: 'Touche S (Reculer)', icon: '⌨️' },
                          { key: 'd', label: 'Touche D (Droite)', icon: '⌨️' },
                          { key: 'any', label: 'N’importe quelle touche', icon: '🌟' },
                        ].map((k) => (
                          <button
                            key={k.key}
                            type="button"
                            onClick={() => {
                              setActiveWizard({
                                ...activeWizard,
                                triggerType: 'keyboard',
                                keyName: k.key,
                                step: 4,
                                actionSubStep: 'main',
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform">
                              {k.icon}
                            </div>
                            <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 text-center">
                              {k.label}
                            </div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sous-étape : Choix de l'emplacement de spawn avec SpawnLocationPicker */}
                  {activeWizard.actionSubStep === 'spawn_location_picker' && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-600">
                        Où faire apparaître {getEntityObj(activeWizard.pendingSpawnType)?.name || activeWizard.pendingSpawnType} ?
                      </div>
                      <SpawnLocationPicker
                        isCollision={activeWizard.triggerType === 'collision'}
                        subjectEntity={getEntityObj(activeWizard.subjectType)}
                        targetEntity={getEntityObj(activeWizard.targetType)}
                        spawnEntity={getEntityObj(activeWizard.pendingSpawnType)}
                        initialMode={activeWizard.triggerType === 'collision' ? 'at_target' : 'at_subject'}
                        initialStateId={activeWizard.actionSpawnInitialStateId}
                        onConfirm={(data) => {
                          completeWizardWithAction({
                            type: 'spawn_entity',
                            spawnEntityType: activeWizard.pendingSpawnType,
                            spawnInitialStateId: data.spawnInitialStateId || activeWizard.actionSpawnInitialStateId,
                            spawnLocationMode: data.spawnLocationMode,
                            spawnReferenceMode: data.spawnReferenceMode,
                            spawnReferenceEntityId: data.spawnReferenceEntityId,
                            spawnReferenceEntityType: data.spawnReferenceEntityType,
                            spawnReferenceTag: data.spawnReferenceTag,
                            spawnOffset: data.spawnOffset,
                            spawnPosition: data.spawnPosition,
                            spawnAbsoluteCoords: data.spawnAbsoluteCoords,
                            spawnSizeMode: data.spawnSizeMode,
                            spawnScaleMultiplier: data.spawnScaleMultiplier,
                            spawnCustomSize: data.spawnCustomSize,
                            spawnTags: data.spawnTags,
                          });
                        }}
                        onCancel={() => {
                          setActiveWizard({ ...activeWizard, actionSubStep: 'spawn_entity_picker' });
                        }}
                      />
                    </div>
                  )}

                  {/* Sous-étape : Choix du son */}
                  {activeWizard.actionSubStep === 'sound_picker' && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur l'effet sonore à jouer :
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsSoundModalOpen(true)}
                          className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        >
                          <Mic className="w-3.5 h-3.5" />
                          <span>+ Enregistrer micro / Importer</span>
                        </button>
                      </div>

                      {/* Sons personnalisés (Micro & Upload) */}
                      {customSounds.length > 0 && (
                        <div className="space-y-2">
                          <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                            Mes Sons ({customSounds.length})
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                            {customSounds.map((snd) => (
                              <button
                                key={snd.id}
                                type="button"
                                onClick={() => {
                                  soundSynth.playCustom(snd.dataUrl);
                                  completeWizardWithAction({
                                    type: 'play_sound',
                                    customSoundId: snd.id,
                                  });
                                }}
                                className="p-3 bg-purple-50/70 hover:bg-purple-100/90 border border-purple-200 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                              >
                                <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                                  {snd.source === 'mic' ? '🎤' : '📁'}
                                </div>
                                <div className="min-w-0">
                                  <div className="text-xs font-bold text-slate-800 truncate">{snd.name}</div>
                                  <div className="text-[10px] text-purple-700 font-medium">
                                    {snd.duration ? `${snd.duration}s` : 'Audio'}
                                  </div>
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                        Sons Prédéfinis
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {[
                          { id: 'win', label: '🏆 Victoire' },
                          { id: 'magic', label: '✨ Magie' },
                          { id: 'pop', label: '🎈 Pop' },
                          { id: 'bounce', label: '🏀 Rebond' },
                          { id: 'bell', label: '🔔 Cloche' },
                          { id: 'laser', label: '⚡ Laser' },
                        ].map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              soundSynth.play(s.id as any);
                              completeWizardWithAction({
                                type: 'play_sound',
                                soundType: s.id as any,
                              });
                            }}
                            className="p-5 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <span className="text-3xl group-hover:scale-125 transition-transform">
                              {s.label.split(' ')[0]}
                            </span>
                            <span className="text-xs font-black text-slate-800 group-hover:text-purple-700">
                              {s.label.split(' ')[1]}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Étape dédiée : Configuration de la durée du Délai (Attendre / Pause) */}
                  {activeWizard.actionSubStep === 'delay_duration_picker' && (
                    <div className="space-y-6 max-w-lg mx-auto py-2">
                      <div className="text-center space-y-1">
                        <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                          ⏱️
                        </div>
                        <h4 className="text-sm font-black text-slate-800">
                          Définir la durée de la pause (Délai)
                        </h4>
                        <p className="text-xs text-slate-500">
                          L'exécution des actions qui suivent sera suspendue pendant ce temps.
                        </p>
                      </div>

                      {/* Presets rapides */}
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                          Durées suggérées :
                        </label>
                        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                          {[
                            { sec: 0.2, label: '0.2s', sub: 'Éclair' },
                            { sec: 0.5, label: '0.5s', sub: 'Rapide' },
                            { sec: 1.0, label: '1.0s', sub: 'Défaut' },
                            { sec: 2.0, label: '2.0s', sub: 'Pause' },
                            { sec: 3.0, label: '3.0s', sub: 'Moyen' },
                            { sec: 5.0, label: '5.0s', sub: 'Long' },
                          ].map((p) => {
                            const isSelected = (activeWizard.delayDuration || 1) === p.sec;
                            return (
                              <button
                                key={p.sec}
                                type="button"
                                onClick={() => setActiveWizard({ ...activeWizard, delayDuration: p.sec })}
                                className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                  isSelected
                                    ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105 font-black'
                                    : 'bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-700 font-bold'
                                }`}
                              >
                                <div className="text-xs">{p.label}</div>
                                <div className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>{p.sub}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {/* Slider et Champ numérique */}
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">Durée précise (secondes) :</span>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="number"
                              min="0.1"
                              max="60"
                              step="0.1"
                              value={activeWizard.delayDuration ?? 1}
                              onChange={(e) => {
                                const val = Math.max(0.1, Math.min(60, parseFloat(e.target.value) || 0.1));
                                setActiveWizard({ ...activeWizard, delayDuration: Math.round(val * 10) / 10 });
                              }}
                              className="w-20 px-2 py-1 text-center font-mono font-black text-sm bg-white border border-amber-400 rounded-lg shadow-2xs outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <span className="text-xs font-black text-slate-600">sec</span>
                          </div>
                        </div>

                        <input
                          type="range"
                          min="0.1"
                          max="10.0"
                          step="0.1"
                          value={activeWizard.delayDuration ?? 1}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value) || 1;
                            setActiveWizard({ ...activeWizard, delayDuration: Math.round(val * 10) / 10 });
                          }}
                          className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          completeWizardWithAction({
                            type: 'delay',
                            delayDuration: activeWizard.delayDuration ?? 1,
                          });
                        }}
                        className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Valider ce délai ({activeWizard.delayDuration ?? 1}s)</span>
                      </button>
                    </div>
                  )}

                  {/* Sous-étape Wizard : Émettre des Particules */}
                  {activeWizard.actionSubStep === 'particle_picker' && (
                    <div className="space-y-4 max-w-xl mx-auto py-2">
                      <div className="flex flex-wrap gap-2">
                        {[
                          { label: '🔥 Étincelles', count: 16, color: '#f59e0b', color2: '#ef4444', shape: 'spark' as ParticleShape, speed: 220, gravity: 280, spread: 140 },
                          { label: '💥 Explosion', count: 28, color: '#ef4444', color2: '#fbbf24', shape: 'circle' as ParticleShape, speed: 260, gravity: 180, spread: 360 },
                          { label: '✨ Magie', count: 20, color: '#8b5cf6', color2: '#ec4899', shape: 'star' as ParticleShape, speed: 140, gravity: -60, spread: 360 },
                          { label: '🎉 Confettis', count: 32, color: '#10b981', color2: '#3b82f6', shape: 'square' as ParticleShape, speed: 210, gravity: 240, spread: 180 },
                        ].map((preset) => (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() =>
                              setActiveWizard({
                                ...activeWizard,
                                particleCount: preset.count,
                                particleColor: preset.color,
                                particleColor2: preset.color2,
                                particleShape: preset.shape,
                                particleSpeed: preset.speed,
                                particleGravity: preset.gravity,
                                particleSpread: preset.spread,
                              })
                            }
                            className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 cursor-pointer transition-colors"
                          >
                            {preset.label}
                          </button>
                        ))}
                      </div>

                      <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Source d'émission</span>
                          <select
                            value={activeWizard.particleOriginMode || 'subject'}
                            onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginMode: e.target.value as any })}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="subject">Sujet</option>
                            {(activeWizard.triggerType === 'collision' || activeWizard.triggerType === 'proximity') && (
                              <option value="target">Cible touchée</option>
                            )}
                            <option value="event_point">💥 Point exact (Collision / Clic)</option>
                            <option value="entity">Entité de la scène</option>
                            <option value="type">Par Type d'objet</option>
                            <option value="tag">Par #Tag</option>
                            <option value="last_spawned">Dernier objet créé</option>
                          </select>
                        </div>

                        {activeWizard.particleOriginMode === 'entity' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Entité source</span>
                            <select
                              value={activeWizard.particleOriginEntityId || Object.keys(entities)[0] || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginEntityId: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              {Object.values(entities).map((ent) => (
                                <option key={ent.id} value={ent.id}>{ent.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeWizard.particleOriginMode === 'type' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Type source</span>
                            <select
                              value={activeWizard.particleOriginEntityType || availableEntityOptions[0]?.type || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginEntityType: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              {availableEntityOptions.map((opt) => (
                                <option key={opt.type} value={opt.type}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeWizard.particleOriginMode === 'tag' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Tag source (#tag)</span>
                            <input
                              type="text"
                              list="wizard-particle-tags"
                              value={activeWizard.particleOriginTag || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, particleOriginTag: e.target.value.replace(/^#/, '') })}
                              placeholder="ex: joueur, ennemi..."
                              className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            />
                            <datalist id="wizard-particle-tags">
                              {allProjectTags.map((t) => (
                                <option key={t} value={t} />
                              ))}
                            </datalist>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => setParticleEditorContext('wizard')}
                          className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
                        >
                          <Sliders className="w-3.5 h-3.5" />
                          <span>Ouvrir l'Éditeur &amp; Testeur Visuel</span>
                        </button>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Forme</span>
                          <select
                            value={activeWizard.particleShape || 'circle'}
                            onChange={(e) => {
                              const nextShape = e.target.value as ParticleShape;
                              setActiveWizard({
                                ...activeWizard,
                                particleShape: nextShape,
                                customParticleId:
                                  nextShape === 'custom' && !activeWizard.customParticleId && customParticles.length > 0
                                    ? customParticles[0].id
                                    : activeWizard.customParticleId,
                              });
                            }}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="circle">Rond</option>
                            <option value="square">Carré</option>
                            <option value="spark">Étincelle</option>
                            <option value="star">Étoile</option>
                            <option value="custom">Particule dessinée ✨</option>
                          </select>
                        </div>

                        {activeWizard.particleShape === 'custom' && (
                          <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-[11px] font-bold text-amber-950">Particule vectorielle :</span>
                              <button
                                type="button"
                                onClick={() => setParticleDrawingTarget({ context: 'wizard' })}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                              >
                                <Paintbrush className="w-3 h-3" />
                                <span>+ Dessiner une particule</span>
                              </button>
                            </div>
                            {customParticles.length === 0 ? (
                              <div className="text-[11px] text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200 text-center">
                                Aucune particule dessinée. Cliquez sur <strong>+ Dessiner une particule</strong>.
                              </div>
                            ) : (
                              <div className="grid grid-cols-4 gap-1.5">
                                {customParticles.map((preset) => {
                                  const isSel = activeWizard.customParticleId === preset.id;
                                  return (
                                    <div
                                      key={preset.id}
                                      onClick={() => setActiveWizard({ ...activeWizard, customParticleId: preset.id })}
                                      className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                        isSel
                                          ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                                          : 'bg-white/80 border-slate-200 hover:border-amber-300'
                                      }`}
                                    >
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
                                            setParticleDrawingTarget({ context: 'wizard', editingPreset: preset });
                                          }}
                                          className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                          title="Modifier"
                                        >
                                          <Pencil className="w-2.5 h-2.5" />
                                        </button>
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            deleteCustomParticle(preset.id);
                                            invalidateCustomParticleSprite(preset.id);
                                            if (isSel) setActiveWizard({ ...activeWizard, customParticleId: undefined });
                                          }}
                                          className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                          title="Supprimer"
                                        >
                                          <X className="w-2.5 h-2.5" />
                                        </button>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex items-center justify-between pt-1 border-t border-amber-200/70">
                              <span className="text-[11px] font-bold text-slate-700">Teinter avec les couleurs d'émission</span>
                              <input
                                type="checkbox"
                                checked={activeWizard.useParticleTint === true}
                                onChange={(e) => setActiveWizard({ ...activeWizard, useParticleTint: e.target.checked })}
                                className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                              />
                            </div>
                          </div>
                        )}

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Nombre ({activeWizard.particleCount ?? 20})</span>
                          <input
                            type="range"
                            min="4"
                            max="50"
                            step="2"
                            value={activeWizard.particleCount ?? 20}
                            onChange={(e) => setActiveWizard({ ...activeWizard, particleCount: parseInt(e.target.value, 10) })}
                            className="w-40 accent-amber-500"
                          />
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Couleurs (Mix)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="color"
                              value={activeWizard.particleColor || '#f59e0b'}
                              onChange={(e) => setActiveWizard({ ...activeWizard, particleColor: e.target.value })}
                              className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                            />
                            <input
                              type="color"
                              value={activeWizard.particleColor2 || '#ef4444'}
                              onChange={(e) => setActiveWizard({ ...activeWizard, particleColor2: e.target.value })}
                              className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Taille ({activeWizard.particleSize ?? 6} px)</span>
                          <input
                            type="range"
                            min="2"
                            max="24"
                            step="1"
                            value={activeWizard.particleSize ?? 6}
                            onChange={(e) => setActiveWizard({ ...activeWizard, particleSize: parseFloat(e.target.value) })}
                            className="w-40 accent-indigo-600"
                          />
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Vitesse ({activeWizard.particleSpeed ?? 180} px/s)</span>
                          <input
                            type="range"
                            min="40"
                            max="450"
                            step="10"
                            value={activeWizard.particleSpeed ?? 180}
                            onChange={(e) => setActiveWizard({ ...activeWizard, particleSpeed: parseFloat(e.target.value) })}
                            className="w-40 accent-indigo-600"
                          />
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Gravité ({activeWizard.particleGravity ?? 220})</span>
                          <input
                            type="range"
                            min="-200"
                            max="500"
                            step="20"
                            value={activeWizard.particleGravity ?? 220}
                            onChange={(e) => setActiveWizard({ ...activeWizard, particleGravity: parseFloat(e.target.value) })}
                            className="w-40 accent-indigo-600"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          const pOriginMode = activeWizard.particleOriginMode || 'subject';
                          completeWizardWithAction({
                            type: 'emit_particles',
                            particleOriginMode: pOriginMode,
                            particleOriginEntityId:
                              pOriginMode === 'entity'
                                ? activeWizard.particleOriginEntityId || Object.keys(entities)[0]
                                : undefined,
                            particleOriginEntityType:
                              pOriginMode === 'type'
                                ? activeWizard.particleOriginEntityType || availableEntityOptions[0]?.type
                                : undefined,
                            particleOriginTag:
                              pOriginMode === 'tag'
                                ? (activeWizard.particleOriginTag || '').trim().replace(/^#/, '')
                                : undefined,
                            particleCount: activeWizard.particleCount ?? 20,
                            particleColor: activeWizard.particleColor ?? '#f59e0b',
                            particleColor2: activeWizard.particleColor2 ?? '#ef4444',
                            particleShape: activeWizard.particleShape ?? 'circle',
                            customParticleId:
                              activeWizard.particleShape === 'custom' ? activeWizard.customParticleId : undefined,
                            useParticleTint:
                              activeWizard.particleShape === 'custom' ? Boolean(activeWizard.useParticleTint) : undefined,
                            particleSpeed: activeWizard.particleSpeed ?? 180,
                            particleSize: activeWizard.particleSize ?? 6,
                            particleLifetime: activeWizard.particleLifetime ?? 0.7,
                            particleGravity: activeWizard.particleGravity ?? 220,
                            particleSpread: activeWizard.particleSpread ?? 360,
                            particleAngle: activeWizard.particleAngle ?? -90,
                          });
                        }}
                        className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Valider l'effet de particules</span>
                      </button>
                    </div>
                  )}

                  {/* Sous-étape Wizard : Attacher à un Parent */}
                  {activeWizard.actionSubStep === 'attach_parent_picker' && (
                    <div className="space-y-4 max-w-xl mx-auto py-2">
                      <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Objet enfant à attacher</span>
                          <select
                            value={activeWizard.parentChildMode || 'subject'}
                            onChange={(e) => setActiveWizard({ ...activeWizard, parentChildMode: e.target.value as any })}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="subject">Sujet</option>
                            {activeWizard.triggerType === 'collision' && <option value="target">Cible touchée</option>}
                            <option value="last_spawned">Dernier objet créé</option>
                            <option value="tag">Par Tag (#tag)</option>
                          </select>
                        </div>

                        {activeWizard.parentChildMode === 'tag' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Tag enfant</span>
                            <input
                              type="text"
                              value={activeWizard.parentChildTag || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, parentChildTag: e.target.value.replace(/^#/, '') })}
                              placeholder="ex: arme"
                              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            />
                          </div>
                        )}

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Objet parent (Porteur)</span>
                          <select
                            value={activeWizard.parentTargetMode || (activeWizard.triggerType === 'collision' ? 'target' : 'entity')}
                            onChange={(e) => setActiveWizard({ ...activeWizard, parentTargetMode: e.target.value as any })}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="subject">Sujet</option>
                            {activeWizard.triggerType === 'collision' && <option value="target">Cible touchée</option>}
                            <option value="entity">Entité de la scène</option>
                            <option value="type">Par Type</option>
                            <option value="tag">Par Tag (#tag)</option>
                            <option value="last_spawned">Dernier objet créé</option>
                          </select>
                        </div>

                        {activeWizard.parentTargetMode === 'entity' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Choisir parent</span>
                            <select
                              value={activeWizard.parentEntityId || Object.keys(entities)[0] || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityId: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              {Object.values(entities).map((ent) => (
                                <option key={ent.id} value={ent.id}>{ent.name}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeWizard.parentTargetMode === 'type' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Type parent</span>
                            <select
                              value={activeWizard.parentEntityType || availableEntityOptions[0]?.type || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityType: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              {availableEntityOptions.map((opt) => (
                                <option key={opt.type} value={opt.type}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}

                        {activeWizard.parentTargetMode === 'tag' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Tag parent</span>
                            <input
                              type="text"
                              value={activeWizard.parentEntityTag || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, parentEntityTag: e.target.value.replace(/^#/, '') })}
                              placeholder="ex: joueur"
                              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            />
                          </div>
                        )}

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Décalage ΔX / ΔY (px)</span>
                          <div className="flex items-center gap-2">
                            <input
                              type="number"
                              value={activeWizard.parentOffset?.x ?? 0}
                              onChange={(e) =>
                                setActiveWizard({
                                  ...activeWizard,
                                  parentOffset: {
                                    x: parseFloat(e.target.value) || 0,
                                    y: activeWizard.parentOffset?.y ?? 0,
                                    inheritRotation: activeWizard.parentOffset?.inheritRotation ?? true,
                                    inheritFlip: activeWizard.parentOffset?.inheritFlip ?? true,
                                  },
                                })
                              }
                              className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                            />
                            <input
                              type="number"
                              value={activeWizard.parentOffset?.y ?? 0}
                              onChange={(e) =>
                                setActiveWizard({
                                  ...activeWizard,
                                  parentOffset: {
                                    x: activeWizard.parentOffset?.x ?? 0,
                                    y: parseFloat(e.target.value) || 0,
                                    inheritRotation: activeWizard.parentOffset?.inheritRotation ?? true,
                                    inheritFlip: activeWizard.parentOffset?.inheritFlip ?? true,
                                  },
                                })
                              }
                              className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                            />
                          </div>
                        </div>

                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                          <span className="font-bold text-slate-700 text-xs">Hériter rotation & Flip du parent</span>
                          <input
                            type="checkbox"
                            checked={activeWizard.parentOffset?.inheritRotation !== false}
                            onChange={(e) =>
                              setActiveWizard({
                                ...activeWizard,
                                parentOffset: {
                                  x: activeWizard.parentOffset?.x ?? 0,
                                  y: activeWizard.parentOffset?.y ?? 0,
                                  inheritRotation: e.target.checked,
                                  inheritFlip: e.target.checked,
                                },
                              })
                            }
                            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          completeWizardWithAction({
                            type: 'attach_to_parent',
                            targetMode: activeWizard.parentChildMode || 'subject',
                            targetTag: activeWizard.parentChildMode === 'tag' ? activeWizard.parentChildTag : undefined,
                            parentTargetMode: activeWizard.parentTargetMode || 'entity',
                            parentEntityId: activeWizard.parentTargetMode === 'entity' ? activeWizard.parentEntityId || Object.keys(entities)[0] : undefined,
                            parentEntityType: activeWizard.parentTargetMode === 'type' ? activeWizard.parentEntityType || availableEntityOptions[0]?.type : undefined,
                            parentEntityTag: activeWizard.parentTargetMode === 'tag' ? activeWizard.parentEntityTag : undefined,
                            parentOffset: activeWizard.parentOffset,
                          });
                        }}
                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Valider l'attachement</span>
                      </button>
                    </div>
                  )}

                  {/* Sous-étape Wizard : Détacher du Parent */}
                  {activeWizard.actionSubStep === 'detach_parent_picker' && (
                    <div className="space-y-4 max-w-xl mx-auto py-2">
                      <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                          <span className="font-bold text-slate-700 text-xs">Objet à détacher</span>
                          <select
                            value={activeWizard.actionTargetMode || 'subject'}
                            onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetMode: e.target.value as any })}
                            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                          >
                            <option value="subject">Sujet</option>
                            {activeWizard.triggerType === 'collision' && <option value="target">Cible touchée</option>}
                            <option value="last_spawned">Dernier objet créé</option>
                            <option value="tag">Par Tag (#tag)</option>
                            <option value="type">Par Type</option>
                          </select>
                        </div>

                        {activeWizard.actionTargetMode === 'tag' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Tag à détacher</span>
                            <input
                              type="text"
                              value={activeWizard.actionTargetTag || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetTag: e.target.value.replace(/^#/, '') })}
                              placeholder="ex: arme"
                              className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            />
                          </div>
                        )}

                        {activeWizard.actionTargetMode === 'type' && (
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Type à détacher</span>
                            <select
                              value={activeWizard.actionTargetType || availableEntityOptions[0]?.type || ''}
                              onChange={(e) => setActiveWizard({ ...activeWizard, actionTargetType: e.target.value })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              {availableEntityOptions.map((opt) => (
                                <option key={opt.type} value={opt.type}>{opt.label}</option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          completeWizardWithAction({
                            type: 'detach_parent',
                            targetMode: activeWizard.actionTargetMode || 'subject',
                            targetTag: activeWizard.actionTargetMode === 'tag' ? activeWizard.actionTargetTag : undefined,
                            targetType: activeWizard.actionTargetMode === 'type' ? activeWizard.actionTargetType || availableEntityOptions[0]?.type : undefined,
                          });
                        }}
                        className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                      >
                        <Check className="w-4 h-4" />
                        <span>Valider le détachement</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 🎯 MODALS FOR DIRECT SLOT EDITING (Grande taille, 1 clic) */}
      {/* ========================================================================= */}
      {activeModal && (
        <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`bg-white rounded-3xl border border-slate-200 p-6 w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] flex flex-col overflow-hidden ${
            activeModal.type === 'action' ? 'max-w-5xl' : 'max-w-2xl'
          }`}>
            {/* 1. SUJET / CIBLE MODAL */}
            {(activeModal.type === 'subject' || activeModal.type === 'target') && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isSubject = activeModal.type === 'subject';
              const activeSelMode: SelectionMode =
                activeModal.selectionMode ||
                (isSubject ? rule.trigger.subjectMode : rule.trigger.targetMode) ||
                'type';
              const currentType = isSubject ? rule.trigger.subjectType : rule.trigger.targetType;
              const relevantType = activeModal.selectedEntityType || currentType || availableEntityOptions[0]?.type || 'apple';
              const ent = getEntityObj(relevantType);
              const states = ent ? Object.values(ent.states) : [];

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {activeModal.subStep === 'choose_state' && (
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_object' })}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="text-base font-black text-slate-900">
                        {activeModal.subStep === 'choose_state'
                          ? `Choisir l'état de ${ent?.name || relevantType}`
                          : isSubject
                          ? "Changer l'Objet Sujet"
                          : "Changer l'Objet Cible"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {activeModal.subStep === 'choose_state' ? (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 overflow-y-auto pr-1 flex-1 py-1">
                      {/* Option Tous les états */}
                      <button
                        type="button"
                        onClick={() => {
                          if (isSubject) {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                subjectMode: activeSelMode,
                                subjectType: activeSelMode === 'type' ? relevantType : undefined,
                                subjectId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                                subjectTag: undefined,
                                subjectStateId: undefined,
                              },
                            });
                          } else {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                targetMode: activeSelMode,
                                targetType: activeSelMode === 'type' ? relevantType : undefined,
                                targetId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                                targetTag: undefined,
                                targetStateId: undefined,
                              },
                            });
                          }
                          setActiveModal(null);
                        }}
                        className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                      >
                        <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-110 transition-transform">
                          ✨
                        </div>
                        <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700">
                          Tous les états
                        </div>
                        <div className="text-[10px] text-slate-400">N'importe quel état</div>
                      </button>

                      {/* États spécifiques */}
                      {states.map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => {
                            if (isSubject) {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  subjectMode: activeSelMode,
                                  subjectType: activeSelMode === 'type' ? relevantType : undefined,
                                  subjectId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                                  subjectTag: undefined,
                                  subjectStateId: st.id,
                                },
                              });
                            } else {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  targetMode: activeSelMode,
                                  targetType: activeSelMode === 'type' ? relevantType : undefined,
                                  targetId: activeSelMode === 'instance' ? activeModal.selectedEntityId : undefined,
                                  targetTag: undefined,
                                  targetStateId: st.id,
                                },
                              });
                            }
                            setActiveModal(null);
                          }}
                          className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                        >
                          <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                            <EntityMiniPreview entity={ent} type={relevantType} stateId={st.id} size={44} />
                          </div>
                          <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate w-full text-center">
                            État {st.name}
                          </div>
                          <div className="text-[10px] text-slate-400">État requis</div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
                      <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, selectionMode: 'type' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSelMode === 'type'
                              ? 'bg-white text-indigo-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🧩 Par Type
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, selectionMode: 'tag' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSelMode === 'tag'
                              ? 'bg-white text-purple-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🏷️ Par #Tag
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, selectionMode: 'instance' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSelMode === 'instance'
                              ? 'bg-white text-cyan-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          📍 Instance
                        </button>
                        <button
                          type="button"
                          onClick={() => setActiveModal({ ...activeModal, selectionMode: 'any' })}
                          className={`flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                            activeSelMode === 'any'
                              ? 'bg-white text-emerald-700 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          🌐 Tous objets
                        </button>
                      </div>

                      {activeSelMode === 'any' ? (
                        <button
                          type="button"
                          onClick={() => {
                            if (isSubject) {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  subjectMode: 'any',
                                  subjectType: undefined,
                                  subjectId: undefined,
                                  subjectTag: undefined,
                                  subjectStateId: undefined,
                                },
                              });
                            } else {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  targetMode: 'any',
                                  targetType: undefined,
                                  targetId: undefined,
                                  targetTag: undefined,
                                  targetStateId: undefined,
                                },
                              });
                            }
                            setActiveModal(null);
                          }}
                          className="w-full p-5 bg-emerald-50/70 hover:bg-emerald-100/70 border-2 border-emerald-300 hover:border-emerald-500 rounded-3xl flex items-center justify-between gap-4 cursor-pointer transition-all shadow-xs text-left"
                        >
                          <div className="flex items-center gap-3.5">
                            <div className="w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl shrink-0">
                              🌐
                            </div>
                            <div>
                              <div className="text-sm font-black text-emerald-950">
                                Tous les objets (N'importe quel objet)
                              </div>
                              <div className="text-xs text-emerald-700 mt-0.5">
                                Inclut tous les objets actuels et futurs sur le canvas.
                              </div>
                            </div>
                          </div>
                          <Check className="w-5 h-5 text-emerald-700 shrink-0" />
                        </button>
                      ) : activeSelMode === 'tag' ? (
                        <div className="p-4 bg-purple-50/50 border-2 border-purple-200 rounded-3xl space-y-3">
                          <div className="text-xs font-bold text-purple-950">
                            Cibler par #Tag (inclut les instances créées dynamiquement) :
                          </div>
                          {allProjectTags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {allProjectTags.map((tag) => (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => {
                                    if (isSubject) {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          subjectMode: 'tag',
                                          subjectTag: tag,
                                          subjectId: undefined,
                                          subjectStateId: undefined,
                                        },
                                      });
                                    } else {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          targetMode: 'tag',
                                          targetTag: tag,
                                          targetId: undefined,
                                          targetStateId: undefined,
                                        },
                                      });
                                    }
                                    setActiveModal(null);
                                  }}
                                  className="px-3 py-1.5 bg-white hover:bg-purple-600 hover:text-white text-purple-800 border border-purple-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs"
                                >
                                  #{tag}
                                </button>
                              ))}
                            </div>
                          )}
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={activeModal.tagInput ?? (isSubject ? rule.trigger.subjectTag || '' : rule.trigger.targetTag || '')}
                              onChange={(e) =>
                                setActiveModal({ ...activeModal, tagInput: e.target.value.replace(/^#/, '') })
                              }
                              placeholder="Ex: projectile, ennemi..."
                              className="flex-1 px-3 py-2 text-xs font-bold bg-white border border-purple-300 rounded-xl outline-none focus:border-purple-600"
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const clean = (
                                  activeModal.tagInput ??
                                  (isSubject ? rule.trigger.subjectTag || '' : rule.trigger.targetTag || '')
                                )
                                  .trim()
                                  .replace(/^#/, '');
                                if (!clean) return;
                                if (isSubject) {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      subjectMode: 'tag',
                                      subjectTag: clean,
                                      subjectId: undefined,
                                      subjectStateId: undefined,
                                    },
                                  });
                                } else {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      targetMode: 'tag',
                                      targetTag: clean,
                                      targetId: undefined,
                                      targetStateId: undefined,
                                    },
                                  });
                                }
                                setActiveModal(null);
                              }}
                              className="px-4 py-2 bg-purple-600 text-white text-xs font-bold rounded-xl cursor-pointer"
                            >
                              Appliquer
                            </button>
                          </div>
                        </div>
                      ) : activeSelMode === 'instance' ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {entityList.map((inst) => {
                            const statesCount = Object.keys(inst.states || {}).length;
                            return (
                              <button
                                key={inst.id}
                                type="button"
                                onClick={() => {
                                  if (statesCount > 1) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_state',
                                      selectionMode: 'instance',
                                      selectedEntityId: inst.id,
                                      selectedEntityType: inst.type,
                                    });
                                  } else {
                                    if (isSubject) {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          subjectMode: 'instance',
                                          subjectId: inst.id,
                                          subjectType: inst.type,
                                          subjectTag: undefined,
                                          subjectStateId: undefined,
                                        },
                                      });
                                    } else {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          targetMode: 'instance',
                                          targetId: inst.id,
                                          targetType: inst.type,
                                          targetTag: undefined,
                                          targetStateId: undefined,
                                        },
                                      });
                                    }
                                    setActiveModal(null);
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2.5 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs">
                                  <EntityMiniPreview entity={inst} type={inst.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 truncate w-full text-center">
                                  {inst.name}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  ({Math.round(inst.position.x)}, {Math.round(inst.position.y)})
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const entObj = getEntityObj(opt.type);
                            const statesCount = Object.keys(entObj?.states || {}).length;

                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesCount > 1) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_state',
                                      selectionMode: 'type',
                                      selectedEntityType: opt.type,
                                    });
                                  } else {
                                    if (isSubject) {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          subjectMode: 'type',
                                          subjectType: opt.type,
                                          subjectId: undefined,
                                          subjectTag: undefined,
                                          subjectStateId: undefined,
                                        },
                                      });
                                    } else {
                                      updateRule(rule.id, {
                                        trigger: {
                                          ...rule.trigger,
                                          targetMode: 'type',
                                          targetType: opt.type,
                                          targetId: undefined,
                                          targetTag: undefined,
                                          targetStateId: undefined,
                                        },
                                      });
                                    }
                                    setActiveModal(null);
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex flex-col items-center justify-center gap-3 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={entObj} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-indigo-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {statesCount > 1 ? `${statesCount} états →` : 'Sélectionner'}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* 2. ÉVÉNEMENT MODAL */}
            {activeModal.type === 'event' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <h3 className="text-base font-black text-slate-900">Type d'Événement</h3>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="space-y-4 overflow-y-auto pr-1 flex-1 py-1">
                    {/* CASE 1 : COLLISIONS */}
                    <div className="bg-indigo-50/50 p-3.5 rounded-2xl border border-indigo-200/80 space-y-2">
                      <div className="text-xs font-black uppercase text-indigo-800 tracking-wider">
                        💥 Collisions & Contacts entre Objets
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {/* Collision Entrée */}
                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'collision',
                                phase: 'enter',
                                targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                            💥
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                              Collision Entrée
                            </div>
                            <div className="text-[10px] text-slate-500">Premier contact</div>
                          </div>
                        </button>

                        {/* Collision Sortie */}
                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'collision',
                                phase: 'exit',
                                targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                            💨
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                              Collision Sortie
                            </div>
                            <div className="text-[10px] text-slate-500">Séparation / Fin de contact</div>
                          </div>
                        </button>

                        {/* Contact Continu */}
                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'collision',
                                phase: 'stay',
                                targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                            ⏳
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                              Contact Continu
                            </div>
                            <div className="text-[10px] text-slate-500">Pendant le contact</div>
                          </div>
                        </button>

                        {/* Collision Relâchement */}
                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'collision',
                                phase: 'collision_release',
                                targetType: rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-indigo-100/60 border border-indigo-200 rounded-xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-xl shrink-0 group-hover:scale-110 transition-transform">
                            🎯
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-indigo-800">
                              Lâché sur Cible
                            </div>
                            <div className="text-[10px] text-slate-500">Relâché au-dessus</div>
                          </div>
                        </button>
                      </div>

                      {/* Options avancées anti-boucle & stabilité collision */}
                      <div className="mt-2 pt-2.5 border-t border-indigo-200/70 flex flex-wrap items-center justify-between gap-2.5">
                        <label className="flex items-center gap-2 text-[11px] font-bold text-indigo-900">
                          <span>Marge séparation (anti-boucle) :</span>
                          <input
                            type="number"
                            min={0}
                            max={60}
                            step={2}
                            value={rule.trigger.collisionExitMargin ?? 10}
                            onChange={(e) =>
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  collisionExitMargin: Math.max(0, Math.min(60, parseInt(e.target.value, 10) || 0)),
                                },
                              })
                            }
                            className="w-14 px-2 py-1 text-center text-xs font-bold bg-white border border-indigo-200 rounded-lg outline-none focus:border-indigo-500"
                          />
                          <span className="text-[10px] font-normal text-indigo-700">px</span>
                        </label>
                        <button
                          type="button"
                          onClick={() =>
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                collisionTriggerOnce: !rule.trigger.collisionTriggerOnce,
                              },
                            })
                          }
                          className={`px-3 py-1.5 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
                            rule.trigger.collisionTriggerOnce
                              ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                              : 'bg-white text-slate-700 border-indigo-200 hover:bg-indigo-100/60'
                          }`}
                        >
                          {rule.trigger.collisionTriggerOnce ? '✓ Déclencher 1 seule fois par paire' : '1× seule fois par paire'}
                        </button>
                      </div>
                    </div>

                    {/* CASE 2 : CLICS */}
                    <div className="bg-purple-50/50 p-3.5 rounded-2xl border border-purple-200/80 space-y-2">
                      <div className="text-xs font-black uppercase text-purple-800 tracking-wider">
                        👆 Clics & Pointeur
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'click',
                                phase: 'click',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                            👆
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                              Clic Complet
                            </div>
                            <div className="text-[10px] text-slate-500">Click classique</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'click',
                                phase: 'down',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                            👇
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                              Appui (Down)
                            </div>
                            <div className="text-[10px] text-slate-500">Pression bouton</div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                type: 'click',
                                phase: 'up',
                              },
                            });
                            setActiveModal(null);
                          }}
                          className="p-3 bg-white hover:bg-purple-100/60 border border-purple-200 rounded-xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                        >
                          <div className="w-8 h-8 rounded-lg bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                            🖐️
                          </div>
                          <div>
                            <div className="text-xs font-black text-slate-900 group-hover:text-purple-800">
                              Relâché (Up)
                            </div>
                            <div className="text-[10px] text-slate-500">Relâchement bouton</div>
                          </div>
                        </button>
                      </div>
                    </div>

                    {/* CASE 3 & 4 : SURVOL & GLISSER */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {/* SURVOL SOURIS */}
                      <div className="bg-amber-50/50 p-3.5 rounded-2xl border border-amber-200/80 space-y-2">
                        <div className="text-xs font-black uppercase text-amber-800 tracking-wider">
                          👀 Survol Souris (Hover)
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  type: 'hover',
                                  phase: 'hover_enter',
                                },
                              });
                              setActiveModal(null);
                            }}
                            className="p-2.5 bg-white hover:bg-amber-100/60 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                              👀
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900">Entrée</div>
                              <div className="text-[9px] text-slate-500">Hover Enter</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  type: 'hover',
                                  phase: 'hover_exit',
                                },
                              });
                              setActiveModal(null);
                            }}
                            className="p-2.5 bg-white hover:bg-amber-100/60 border border-amber-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="w-7 h-7 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-sm shrink-0">
                              🏃
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900">Sortie</div>
                              <div className="text-[9px] text-slate-500">Hover Exit</div>
                            </div>
                          </button>
                        </div>
                      </div>

                      {/* GLISSER-DÉPOSER & BORDS DU CANVAS */}
                      <div className="bg-emerald-50/50 p-3.5 rounded-2xl border border-emerald-200/80 space-y-2">
                        <div className="text-xs font-black uppercase text-emerald-800 tracking-wider">
                          🫳 Glisser-Déposer &amp; Bords
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  type: 'drag',
                                  phase: 'drag_release',
                                },
                              });
                              setActiveModal(null);
                            }}
                            className="w-full p-2.5 bg-white hover:bg-emerald-100/60 border border-emerald-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0">
                              🫳
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900">Relâcher libre</div>
                              <div className="text-[10px] text-slate-500">Lâcher dans le vide</div>
                            </div>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  type: 'boundary',
                                  boundaryEdge: rule.trigger.boundaryEdge || 'any',
                                },
                              });
                              setActiveModal(null);
                            }}
                            className="w-full p-2.5 bg-white hover:bg-rose-100/60 border border-rose-200 rounded-xl flex items-center gap-2 text-left cursor-pointer transition-all shadow-2xs group"
                          >
                            <div className="w-8 h-8 rounded-lg bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0">
                              🖼️
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900">Bord de Scène</div>
                              <div className="text-[10px] text-slate-500">Touche le cadre</div>
                            </div>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 3. ACTION DIRECT MODAL */}
            {activeModal.type === 'action' && (() => {
              const rule = rules.find((r) => r.id === activeModal.ruleId);
              if (!rule) return null;

              const isCollision = rule.trigger.type === 'collision';
              const subjectType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
              const targetType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';

              const applyAction = (actionData: Partial<RuleAction>) => {
                if (activeModal.actionIndex !== undefined) {
                  const updatedActions = [...rule.actions];
                  updatedActions[activeModal.actionIndex] = {
                    ...updatedActions[activeModal.actionIndex],
                    ...actionData,
                  };
                  updateRule(rule.id, { actions: updatedActions });
                } else {
                  const newAct: RuleAction = {
                    id: `act-${Date.now()}`,
                    type: actionData.type || 'change_state',
                    targetMode: actionData.targetMode || (isCollision ? 'target' : 'subject'),
                    targetType: actionData.targetType || (actionData.targetMode === 'subject' ? subjectType : targetType),
                    ...actionData,
                  };
                  updateRule(rule.id, { actions: [...rule.actions, newAct] });
                }
                setActiveModal(null);
              };

              return (
                <div className="space-y-4 flex flex-col h-full overflow-hidden">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-3 shrink-0">
                    <div className="flex items-center gap-2">
                      {activeModal.subStep && activeModal.subStep !== 'main' && (
                        <button
                          type="button"
                          onClick={() => {
                            if (activeModal.subStep === 'choose_spawn_location') {
                              const spEnt = getEntityObj(activeModal.pendingSpawnType);
                              const hasMulti = Object.keys(spEnt?.states || {}).length > 1;
                              setActiveModal({
                                ...activeModal,
                                subStep: hasMulti ? 'choose_spawn_state' : 'choose_spawn_entity',
                              });
                            } else if (activeModal.subStep === 'choose_spawn_state') {
                              setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' });
                            } else {
                              setActiveModal({ ...activeModal, subStep: 'main' });
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
                        >
                          <ChevronLeft className="w-4 h-4" />
                        </button>
                      )}
                      <h3 className="text-base font-black text-slate-900">
                        {activeModal.actionIndex !== undefined ? "Modifier l'Action" : 'Nouvelle Action'}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveModal(null)}
                      className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="overflow-y-auto pr-1 flex-1 py-1">
                    {(!activeModal.subStep || activeModal.subStep === 'main') && (() => {
                      const modalSubjectIsAny = rule.trigger.subjectMode === 'any';
                      const modalSubjectIsTag = rule.trigger.subjectMode === 'tag';
                      const modalSubjectEntity = modalSubjectIsAny || modalSubjectIsTag ? undefined : getEntityObj(subjectType);
                      const modalSubjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
                      const modalSubjectName = modalSubjectIsAny
                        ? 'Tous les objets'
                        : modalSubjectIsTag
                        ? `#${rule.trigger.subjectTag || 'tag'}`
                        : modalSubjectEntity?.name || modalSubjectOpt?.label || subjectType;

                      const modalTargetIsAny = rule.trigger.targetMode === 'any';
                      const modalTargetIsTag = rule.trigger.targetMode === 'tag';
                      const modalTargetEntity = modalTargetIsAny || modalTargetIsTag ? undefined : getEntityObj(targetType);
                      const modalTargetOpt = availableEntityOptions.find((o) => o.type === targetType);
                      const modalTargetName = modalTargetIsAny
                        ? 'Tous les objets'
                        : modalTargetIsTag
                        ? `#${rule.trigger.targetTag || 'tag'}`
                        : modalTargetEntity?.name || modalTargetOpt?.label || targetType;

                      return (
                        <div className={`grid grid-cols-1 ${isCollision ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'} gap-4 items-start`}>
                          {/* SECTION 1 : SUJET */}
                          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                            {/* En-tête Sujet avec miniature et nom de l'entité */}
                            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                              <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center p-1 shadow-2xs shrink-0 text-lg">
                                {modalSubjectIsAny ? (
                                  '🌐'
                                ) : modalSubjectIsTag ? (
                                  '🏷️'
                                ) : (
                                  <EntityMiniPreview
                                    entity={modalSubjectEntity}
                                    type={subjectType}
                                    stateId={rule.trigger.subjectStateId}
                                    size={36}
                                  />
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-600 text-white shadow-2xs">
                                    Sujet (Qui agit)
                                  </span>
                                </div>
                                <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={modalSubjectName}>
                                  {modalSubjectName}
                                </div>
                              </div>
                            </div>

                            {/* Actions sur le Sujet */}
                            <div className="space-y-2.5 flex-1">
                              {/* 1. Changer l'état du Sujet */}
                              <button
                                type="button"
                                onClick={() => {
                                  const ent = getEntityObj(subjectType);
                                  if (ent && Object.values(ent.states).length > 1) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_state',
                                      targetMode: 'subject',
                                      selectedTargetType: subjectType,
                                    });
                                  } else {
                                    applyAction({
                                      type: 'change_state',
                                      targetMode: 'subject',
                                      targetType: subjectType,
                                    });
                                  }
                                }}
                                className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔄
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                                    Changer l'état du Sujet
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Transformer « {modalSubjectName} »
                                  </div>
                                </div>
                              </button>

                              {/* 2. Basculer entre états (Toggle) */}
                              <button
                                type="button"
                                onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_toggle_entity' })}
                                className="w-full p-3.5 bg-white hover:bg-violet-50/70 border-2 border-slate-200 hover:border-violet-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔀
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-violet-700 truncate">
                                    Basculer l'état (Toggle ⇄ / Cycle)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Alterner A ⇄ B sur « {modalSubjectName} »
                                  </div>
                                </div>
                              </button>

                              {/* 3. Détruire le Sujet */}
                              <button
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'delete_entity',
                                    targetMode: 'subject',
                                    targetType: subjectType,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  💥
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détruire le Sujet
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Faire disparaître « {modalSubjectName} »
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>

                          {/* SECTION 2 : CIBLE (Si Collision) */}
                          {isCollision && (
                            <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                              {/* En-tête Cible avec miniature et nom de l'entité */}
                              <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 shadow-2xs">
                                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-1 shadow-2xs shrink-0 text-lg">
                                  {modalTargetIsAny ? (
                                    '🌐'
                                  ) : modalTargetIsTag ? (
                                    '🏷️'
                                  ) : (
                                    <EntityMiniPreview
                                      entity={modalTargetEntity}
                                      type={targetType}
                                      stateId={rule.trigger.targetStateId}
                                      size={36}
                                    />
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-600 text-white shadow-2xs">
                                      Cible (Touchée)
                                    </span>
                                  </div>
                                  <div className="text-sm font-black text-slate-800 truncate mt-0.5" title={modalTargetName}>
                                    {modalTargetName}
                                  </div>
                                </div>
                              </div>

                              {/* Actions sur la Cible */}
                              <div className="space-y-2.5 flex-1">
                                {/* 1. Changer état Cible */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    const ent = getEntityObj(targetType);
                                    if (ent && Object.values(ent.states).length > 1) {
                                      setActiveModal({
                                        ...activeModal,
                                        subStep: 'choose_state',
                                        targetMode: 'target',
                                        selectedTargetType: targetType,
                                      });
                                    } else {
                                      applyAction({
                                        type: 'change_state',
                                        targetMode: 'target',
                                        targetType,
                                      });
                                    }
                                  }}
                                  className="w-full p-3.5 bg-white hover:bg-emerald-50/70 border-2 border-slate-200 hover:border-emerald-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                    🔄
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-black text-slate-900 group-hover:text-emerald-700 truncate">
                                      Changer l'état de la Cible
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      Transformer « {modalTargetName} »
                                    </div>
                                  </div>
                                </button>

                                {/* 2. Détruire Cible */}
                                <button
                                  type="button"
                                  onClick={() => {
                                    applyAction({
                                      type: 'delete_entity',
                                      targetMode: 'target',
                                      targetType,
                                    });
                                  }}
                                  className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                                >
                                  <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                    💥
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                      Détruire la Cible
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                      Faire disparaître « {modalTargetName} »
                                    </div>
                                  </div>
                                </button>
                              </div>
                            </div>
                          )}

                          {/* SECTION 3 : MONDE & EFFETS */}
                          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                            {/* En-tête Monde & Effets */}
                            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-purple-50 border border-purple-200/80 shadow-2xs">
                              <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 border border-purple-200 flex items-center justify-center text-xl shrink-0 shadow-2xs">
                                🌐
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-full bg-purple-600 text-white shadow-2xs">
                                    Monde & Effets
                                  </span>
                                </div>
                                <div className="text-xs font-bold text-slate-700 truncate mt-0.5">
                                  Apparitions, sons & tiers
                                </div>
                              </div>
                            </div>

                            {/* Actions Monde & Effets */}
                            <div className="space-y-2.5 flex-1">
                              {/* 1. Créer un Objet */}
                              <button
                                type="button"
                                onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' })}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ✨
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Créer un nouvel Objet (Spawn)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Faire apparaître sur la scène
                                  </div>
                                </div>
                              </button>

                              {/* 2. Jouer un son */}
                              <button
                                type="button"
                                onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_sound' })}
                                className="w-full p-3.5 bg-white hover:bg-purple-50/70 border-2 border-slate-200 hover:border-purple-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔊
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-purple-700 truncate">
                                    Jouer un effet sonore
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Effets audio ou voix micro
                                  </div>
                                </div>
                              </button>

                              {/* 2.5. Attendre / Pause (Délai) */}
                              <button
                                type="button"
                                onClick={() => {
                                  setActiveModal({
                                    ...activeModal,
                                    subStep: 'choose_delay_duration',
                                    delayDuration: activeModal.delayDuration || 1,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ⏱️
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Attendre / Pause (Délai)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Définir un délai en secondes avant l'action suivante
                                  </div>
                                </div>
                              </button>

                              {/* 3. Changer état d'un Autre Objet (Entité Tierce) */}
                              <button
                                type="button"
                                onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_third_party_entity' })}
                                className="w-full p-3.5 bg-white hover:bg-cyan-50/70 border-2 border-slate-200 hover:border-cyan-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🪄
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-cyan-700 truncate">
                                    Changer un Autre Objet (Tierce)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Modifier une entité C à distance
                                  </div>
                                </div>
                              </button>

                              {/* 4. Détruire Autre Objet (Tierce) */}
                              <button
                                type="button"
                                onClick={() => setActiveModal({ ...activeModal, subStep: 'choose_third_party_destroy' })}
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  💣
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détruire un Autre Objet (Tierce)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Supprimer une entité C à distance
                                  </div>
                                </div>
                              </button>

                              {/* 5. Ajouter au Score (+1) */}
                              <button
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'add_score',
                                    scoreAmount: 1,
                                  });
                                }}
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🏆
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Ajouter au Score (+1)
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Incrémenter le score de jeu
                                  </div>
                                </div>
                              </button>

                              {/* 6. Émettre des Particules */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveModal({
                                    ...activeModal,
                                    subStep: 'choose_particles',
                                    particleOriginMode: isCollision ? 'target' : 'subject',
                                    particleCount: 20,
                                    particleColor: '#f59e0b',
                                    particleColor2: '#ef4444',
                                    particleShape: 'circle',
                                    particleSpeed: 180,
                                    particleSize: 6,
                                    particleLifetime: 0.7,
                                    particleGravity: 220,
                                    particleSpread: 360,
                                    particleAngle: -90,
                                  })
                                }
                                className="w-full p-3.5 bg-white hover:bg-amber-50/70 border-2 border-slate-200 hover:border-amber-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🎆
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-amber-700 truncate">
                                    Émettre des Particules
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Étincelles, explosion ou confettis légers
                                  </div>
                                </div>
                              </button>

                              {/* 7. Attacher à un Parent (Parenting) */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveModal({
                                    ...activeModal,
                                    subStep: 'choose_attach_parent',
                                    parentChildMode: 'subject',
                                    parentTargetMode: isCollision ? 'target' : 'entity',
                                    parentEntityId: Object.keys(entities)[0] || '',
                                    parentOffset: { x: 0, y: 0, rotationOffset: 0, inheritRotation: true, inheritFlip: true },
                                  })
                                }
                                className="w-full p-3.5 bg-white hover:bg-indigo-50/70 border-2 border-slate-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  🔗
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-indigo-700 truncate">
                                    Attacher à un Parent
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Solidariser une entité (arme, accessoire)
                                  </div>
                                </div>
                              </button>

                              {/* 8. Détacher du Parent */}
                              <button
                                type="button"
                                onClick={() =>
                                  setActiveModal({
                                    ...activeModal,
                                    subStep: 'choose_detach_parent',
                                    targetMode: 'subject',
                                  })
                                }
                                className="w-full p-3.5 bg-white hover:bg-rose-50/70 border-2 border-slate-200 hover:border-rose-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-[0.98]"
                              >
                                <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-110 transition-transform">
                                  ✂️
                                </div>
                                <div className="min-w-0 flex-1">
                                  <div className="text-xs font-black text-slate-900 group-hover:text-rose-700 truncate">
                                    Détacher du Parent
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                                    Désolidariser en cours de partie
                                  </div>
                                </div>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'état direct */}
                    {activeModal.subStep === 'choose_state' && (() => {
                      const relevantType = activeModal.selectedTargetType || targetType;
                      const ent = getEntityObj(relevantType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {states.map((st) => (
                            <button
                              key={st.id}
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'change_state',
                                  targetMode: activeModal.targetMode || 'target',
                                  targetType: relevantType,
                                  targetStateId: st.id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={relevantType} stateId={st.id} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-emerald-700">
                                État {st.name}
                              </div>
                            </button>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Choix d'entité tierce */}
                    {activeModal.subStep === 'choose_third_party_entity' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur l'autre objet dont vous souhaitez changer l'état :
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesList = ent ? Object.values(ent.states) : [];

                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesList.length > 1) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_third_party_state',
                                      selectedTargetType: opt.type,
                                    });
                                  } else {
                                    applyAction({
                                      type: 'change_state',
                                      targetMode: 'type',
                                      targetType: opt.type,
                                    });
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix d'état pour entité tierce */}
                    {activeModal.subStep === 'choose_third_party_state' && (() => {
                      const thirdType = activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'plant';
                      const ent = getEntityObj(thirdType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Quel état appliquer à {ent?.name || thirdType} ?
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                            {states.map((st) => (
                              <button
                                key={st.id}
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'change_state',
                                    targetMode: 'type',
                                    targetType: thirdType,
                                    targetStateId: st.id,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-cyan-50 border-2 border-slate-200 hover:border-cyan-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={thirdType} stateId={st.id} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-cyan-700">
                                  État {st.name}
                                </div>
                              </button>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'entité tierce à détruire */}
                    {activeModal.subStep === 'choose_third_party_destroy' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Cliquez sur l'objet (ou groupe d'instances dynamiques) à détruire :
                        </div>

                        {/* Pistes C & A : Dernier objet créé ou Tag dynamique */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-indigo-50/50 p-3 rounded-2xl border border-indigo-200/80">
                          <button
                            type="button"
                            onClick={() => {
                              applyAction({
                                type: 'delete_entity',
                                targetMode: 'last_spawned',
                              });
                            }}
                            className="p-3 bg-white hover:bg-indigo-50 border border-indigo-200 hover:border-indigo-500 rounded-2xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs"
                          >
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center text-lg shrink-0">
                              ✨
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-800">Dernier objet créé</div>
                              <div className="text-[10px] text-slate-500">Cible la dernière instance apparue en jeu</div>
                            </div>
                          </button>

                          <div className="p-2.5 bg-white border border-indigo-200 rounded-2xl flex items-center justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="text-[11px] font-black text-slate-800">🏷️ Par Tag (#tag)</div>
                              <input
                                type="text"
                                value={activeModal.targetTag || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, targetTag: e.target.value.replace(/^#/, '') })}
                                placeholder="ex: projectile, piece..."
                                className="w-full mt-1 px-2 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-indigo-500"
                              />
                            </div>
                            <button
                              type="button"
                              disabled={!activeModal.targetTag?.trim()}
                              onClick={() => {
                                if (!activeModal.targetTag?.trim()) return;
                                applyAction({
                                  type: 'delete_entity',
                                  targetMode: 'tag',
                                  targetTag: activeModal.targetTag.trim().replace(/^#/, ''),
                                });
                              }}
                              className="px-3 py-1.5 bg-rose-600 disabled:bg-slate-200 text-white disabled:text-slate-400 text-xs font-bold rounded-xl cursor-pointer shrink-0"
                            >
                              Détruire
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'delete_entity',
                                    targetMode: 'type',
                                    targetType: opt.type,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-rose-50 border-2 border-slate-200 hover:border-rose-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-rose-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-rose-500 font-bold">Détruire</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix d'objet pour Toggle */}
                    {activeModal.subStep === 'choose_toggle_entity' && (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Sur quel objet basculer l'état (Toggle) ?
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {availableEntityOptions.map((opt) => {
                            const ent = getEntityObj(opt.type);
                            const statesList = ent ? Object.values(ent.states) : [];
                            return (
                              <button
                                key={opt.type}
                                type="button"
                                onClick={() => {
                                  if (statesList.length >= 2) {
                                    setActiveModal({
                                      ...activeModal,
                                      subStep: 'choose_toggle_states',
                                      selectedTargetType: opt.type,
                                    });
                                  } else {
                                    applyAction({
                                      type: 'toggle_state',
                                      targetMode: 'type',
                                      targetType: opt.type,
                                    });
                                  }
                                }}
                                className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                  <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                </div>
                                <div className="text-xs font-black text-slate-800 group-hover:text-violet-700 truncate w-full text-center">
                                  {opt.label}
                                </div>
                                <div className="text-[10px] text-slate-400">
                                  {statesList.length} états disponibles
                                </div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Choix des états pour Toggle */}
                    {activeModal.subStep === 'choose_toggle_states' && (() => {
                      const relevantType = activeModal.selectedTargetType || availableEntityOptions[0]?.type || 'apple';
                      const ent = getEntityObj(relevantType);
                      const states = ent ? Object.values(ent.states) : [];

                      const stateA = activeModal.toggleStateA || states[0]?.id || '';
                      const stateB = activeModal.toggleStateB || (states[1]?.id || states[0]?.id || '');
                      const targetState = activeModal.toggleTargetStateId || (states[1]?.id || states[0]?.id || '');

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Comment faire basculer {ent?.name || relevantType} ?
                          </div>

                          <div className="space-y-3">
                            {/* Option 1: Basculer spécifiquement entre 2 états précis */}
                            {states.length >= 2 && (
                              <div className="p-4 bg-white border-2 border-violet-200 rounded-3xl space-y-3 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-sm shrink-0">
                                    ⇄
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-slate-900">
                                      Basculer entre 2 états précis
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Passe alternativement de l'état A à l'état B à chaque déclenchement
                                    </div>
                                  </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                      Premier état (A) :
                                    </label>
                                    <select
                                      value={stateA}
                                      onChange={(e) =>
                                        setActiveModal({ ...activeModal, toggleStateA: e.target.value })
                                      }
                                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                                    >
                                      {states.map((st) => (
                                        <option key={st.id} value={st.id}>
                                          {st.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>

                                  <div>
                                    <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                      Deuxième état (B) :
                                    </label>
                                    <select
                                      value={stateB}
                                      onChange={(e) =>
                                        setActiveModal({ ...activeModal, toggleStateB: e.target.value })
                                      }
                                      className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-violet-500 cursor-pointer"
                                    >
                                      {states.map((st) => (
                                        <option key={st.id} value={st.id}>
                                          {st.name}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    applyAction({
                                      type: 'toggle_state',
                                      targetMode: 'type',
                                      targetType: relevantType,
                                      toggleMode: 'two_states',
                                      toggleStateAId: stateA,
                                      toggleStateBId: stateB,
                                    });
                                  }}
                                  className="w-full py-2 bg-violet-600 hover:bg-violet-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                                >
                                  Valider la bascule ({ent?.states[stateA]?.name || 'A'} ⇄ {ent?.states[stateB]?.name || 'B'})
                                </button>
                              </div>
                            )}

                            {/* Option 2: Basculer entre l'état actuel et un autre état */}
                            {states.length >= 2 && (
                              <div className="p-4 bg-white border-2 border-indigo-200 rounded-3xl space-y-3 shadow-xs">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                                    ⚡
                                  </div>
                                  <div>
                                    <div className="text-xs font-black text-slate-900">
                                      Basculer entre l'état actuel et un état cible
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      Passe à l'état cible, puis revient à l'état précédent au clic suivant
                                    </div>
                                  </div>
                                </div>

                                <div>
                                  <label className="text-[10px] font-bold text-slate-500 block mb-1">
                                    État cible à activer/désactiver :
                                  </label>
                                  <select
                                    value={targetState}
                                    onChange={(e) =>
                                      setActiveModal({ ...activeModal, toggleTargetStateId: e.target.value })
                                    }
                                    className="w-full text-xs font-bold text-slate-800 bg-slate-50 border border-slate-200 rounded-xl p-2 focus:outline-indigo-500 cursor-pointer"
                                  >
                                    {states.map((st) => (
                                      <option key={st.id} value={st.id}>
                                        {st.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => {
                                    applyAction({
                                      type: 'toggle_state',
                                      targetMode: 'type',
                                      targetType: relevantType,
                                      toggleMode: 'current_and_target',
                                      toggleTargetStateId: targetState,
                                    });
                                  }}
                                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
                                >
                                  Valider la bascule (Actuel ⇄ {ent?.states[targetState]?.name || 'Cible'})
                                </button>
                              </div>
                            )}

                            {/* Option 3: Cycler tous les états */}
                            <button
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'toggle_state',
                                  targetMode: 'type',
                                  targetType: relevantType,
                                  toggleMode: 'cycle_all',
                                });
                              }}
                              className="w-full p-3.5 bg-slate-50 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-300 rounded-3xl flex items-center gap-3 text-left cursor-pointer transition-all shadow-2xs group active:scale-98"
                            >
                              <div className="w-10 h-10 rounded-2xl bg-slate-200 text-slate-700 flex items-center justify-center text-lg shrink-0 group-hover:scale-105 transition-transform">
                                🔄
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-800">
                                  Cycler séquentiellement entre tous les états ({states.length} états)
                                </div>
                                <div className="text-[11px] text-slate-500">
                                  Fait défiler les états 1 → 2 → 3... en boucle
                                </div>
                              </div>
                            </button>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'objet à spawner */}
                    {activeModal.subStep === 'choose_spawn_entity' && (() => {
                      const existingSpawnAct =
                        activeModal.actionIndex !== undefined ? rule.actions[activeModal.actionIndex] : undefined;
                      return (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-600">
                            Cliquez sur l'objet à faire apparaître :
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                            {availableEntityOptions.map((opt) => {
                              const ent = getEntityObj(opt.type);
                              const statesList = ent ? Object.values(ent.states) : [];
                              const preselectedStateId =
                                existingSpawnAct?.type === 'spawn_entity' &&
                                existingSpawnAct?.spawnEntityType === opt.type
                                  ? existingSpawnAct.spawnInitialStateId
                                  : undefined;
                              return (
                                <button
                                  key={opt.type}
                                  type="button"
                                  onClick={() => {
                                    if (statesList.length > 1) {
                                      setActiveModal({
                                        ...activeModal,
                                        pendingSpawnType: opt.type,
                                        pendingSpawnInitialStateId: preselectedStateId,
                                        subStep: 'choose_spawn_state',
                                      });
                                    } else {
                                      setActiveModal({
                                        ...activeModal,
                                        pendingSpawnType: opt.type,
                                        pendingSpawnInitialStateId: undefined,
                                        subStep: 'choose_spawn_location',
                                      });
                                    }
                                  }}
                                  className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                                >
                                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                    <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                                  </div>
                                  <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                    + {opt.label}
                                  </div>
                                  {statesList.length > 1 && (
                                    <div className="text-[10px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full font-bold">
                                      {statesList.length} états →
                                    </div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix de l'état initial pour l'objet créé (Edit Modal) */}
                    {activeModal.subStep === 'choose_spawn_state' && (() => {
                      const spawnType = activeModal.pendingSpawnType || availableEntityOptions[0]?.type || 'apple';
                      const ent = getEntityObj(spawnType);
                      const states = ent ? Object.values(ent.states) : [];

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Choisissez l'état initial dans lequel « {ent?.name || spawnType} » va apparaître :
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                            {states.map((st) => {
                              const isCurrentSel = activeModal.pendingSpawnInitialStateId === st.id;
                              return (
                                <button
                                  key={st.id}
                                  type="button"
                                  onClick={() => {
                                    setActiveModal({
                                      ...activeModal,
                                      pendingSpawnInitialStateId: st.id,
                                      subStep: 'choose_spawn_location',
                                    });
                                  }}
                                  className={`p-4 border-2 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95 ${
                                    isCurrentSel
                                      ? 'bg-amber-50 border-amber-500 ring-2 ring-amber-200'
                                      : 'bg-slate-50 hover:bg-amber-50 border-slate-200 hover:border-amber-500'
                                  }`}
                                >
                                  <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                    <EntityMiniPreview entity={ent} type={spawnType} stateId={st.id} size={52} />
                                  </div>
                                  <div className="text-xs font-black text-slate-800 group-hover:text-amber-700">
                                    État {st.name}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix de l'emplacement de spawn avec SpawnLocationPicker */}
                    {activeModal.subStep === 'choose_spawn_location' && (() => {
                      const existingSpawnAct =
                        activeModal.actionIndex !== undefined ? rule.actions[activeModal.actionIndex] : undefined;
                      const isEditingSameSpawn = existingSpawnAct?.type === 'spawn_entity';
                      return (
                        <div className="space-y-3">
                          <div className="text-xs font-bold text-slate-600">
                            Où faire apparaître {getEntityObj(activeModal.pendingSpawnType)?.name || activeModal.pendingSpawnType} ?
                          </div>
                          <SpawnLocationPicker
                            isCollision={isCollision}
                            subjectEntity={getEntityObj(subjectType)}
                            targetEntity={getEntityObj(targetType)}
                            spawnEntity={getEntityObj(activeModal.pendingSpawnType)}
                            initialMode={
                              isEditingSameSpawn && existingSpawnAct?.spawnLocationMode
                                ? existingSpawnAct.spawnLocationMode
                                : isCollision
                                ? 'at_target'
                                : 'at_subject'
                            }
                            initialStateId={
                              activeModal.pendingSpawnInitialStateId ||
                              (isEditingSameSpawn ? existingSpawnAct?.spawnInitialStateId : undefined)
                            }
                            initialOffset={isEditingSameSpawn ? existingSpawnAct?.spawnOffset : undefined}
                            initialAbsoluteCoords={isEditingSameSpawn ? existingSpawnAct?.spawnAbsoluteCoords : undefined}
                            initialSizeMode={isEditingSameSpawn ? existingSpawnAct?.spawnSizeMode : undefined}
                            initialScaleMultiplier={isEditingSameSpawn ? existingSpawnAct?.spawnScaleMultiplier : undefined}
                            initialCustomSize={isEditingSameSpawn ? existingSpawnAct?.spawnCustomSize : undefined}
                            initialTags={isEditingSameSpawn ? existingSpawnAct?.spawnTags : undefined}
                            initialReferenceMode={isEditingSameSpawn ? existingSpawnAct?.spawnReferenceMode : undefined}
                            initialReferenceEntityId={isEditingSameSpawn ? existingSpawnAct?.spawnReferenceEntityId : undefined}
                            initialReferenceEntityType={isEditingSameSpawn ? existingSpawnAct?.spawnReferenceEntityType : undefined}
                            initialReferenceTag={isEditingSameSpawn ? existingSpawnAct?.spawnReferenceTag : undefined}
                            onConfirm={(data) => {
                              applyAction({
                                type: 'spawn_entity',
                                spawnEntityType: activeModal.pendingSpawnType,
                                spawnInitialStateId:
                                  data.spawnInitialStateId || activeModal.pendingSpawnInitialStateId,
                                spawnLocationMode: data.spawnLocationMode,
                                spawnReferenceMode: data.spawnReferenceMode,
                                spawnReferenceEntityId: data.spawnReferenceEntityId,
                                spawnReferenceEntityType: data.spawnReferenceEntityType,
                                spawnReferenceTag: data.spawnReferenceTag,
                                spawnOffset: data.spawnOffset,
                                spawnPosition: data.spawnPosition,
                                spawnAbsoluteCoords: data.spawnAbsoluteCoords,
                                spawnSizeMode: data.spawnSizeMode,
                                spawnScaleMultiplier: data.spawnScaleMultiplier,
                                spawnCustomSize: data.spawnCustomSize,
                                spawnTags: data.spawnTags,
                              });
                            }}
                            onCancel={() => {
                              setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' });
                            }}
                          />
                        </div>
                      );
                    })()}

                    {/* Choix du son */}
                    {activeModal.subStep === 'choose_sound' && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="text-xs font-bold text-slate-600">
                            Choisissez un son ou enregistrez votre voix :
                          </div>
                          <button
                            type="button"
                            onClick={() => setIsSoundModalOpen(true)}
                            className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 text-xs font-bold rounded-xl border border-purple-200 flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          >
                            <Mic className="w-3.5 h-3.5" />
                            <span>+ Enregistrer micro / Importer</span>
                          </button>
                        </div>

                        {/* Sons personnalisés (Micro & Upload) */}
                        {customSounds.length > 0 && (
                          <div className="space-y-2">
                            <div className="text-[10px] font-black uppercase text-purple-800 tracking-wider">
                              Mes Sons ({customSounds.length})
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                              {customSounds.map((snd) => (
                                <button
                                  key={snd.id}
                                  type="button"
                                  onClick={() => {
                                    soundSynth.playCustom(snd.dataUrl);
                                    applyAction({
                                      type: 'play_sound',
                                      customSoundId: snd.id,
                                    });
                                  }}
                                  className="p-3 bg-purple-50/70 hover:bg-purple-100/90 border border-purple-200 rounded-2xl flex items-center gap-2.5 text-left cursor-pointer transition-all shadow-2xs group"
                                >
                                  <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center shrink-0">
                                    {snd.source === 'mic' ? '🎤' : '📁'}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="text-xs font-bold text-slate-800 truncate">{snd.name}</div>
                                    <div className="text-[10px] text-purple-700 font-medium">
                                      {snd.duration ? `${snd.duration}s` : 'Audio'}
                                    </div>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          Sons Synthétisés
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                          {[
                            { id: 'win', label: '🏆 Victoire' },
                            { id: 'magic', label: '✨ Magie' },
                            { id: 'pop', label: '🎈 Pop' },
                            { id: 'bounce', label: '🏀 Rebond' },
                            { id: 'bell', label: '🔔 Cloche' },
                            { id: 'laser', label: '⚡ Laser' },
                          ].map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => {
                                soundSynth.play(s.id as any);
                                applyAction({
                                  type: 'play_sound',
                                  soundType: s.id as any,
                                });
                              }}
                              className="p-5 bg-slate-50 hover:bg-purple-50 border-2 border-slate-200 hover:border-purple-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <span className="text-3xl group-hover:scale-125 transition-transform">
                                {s.label.split(' ')[0]}
                              </span>
                              <span className="text-xs font-black text-slate-800 group-hover:text-purple-700">
                                {s.label.split(' ')[1]}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Étape dédiée : Configuration de la durée du Délai (Modal Action) */}
                    {activeModal.subStep === 'choose_delay_duration' && (
                      <div className="space-y-6 max-w-lg mx-auto py-2">
                        <div className="text-center space-y-1">
                          <div className="w-14 h-14 bg-amber-100 text-amber-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
                            ⏱️
                          </div>
                          <h4 className="text-sm font-black text-slate-800">
                            Définir la durée de la pause (Délai)
                          </h4>
                          <p className="text-xs text-slate-500">
                            L'exécution des actions qui suivent sera suspendue pendant ce temps.
                          </p>
                        </div>

                        {/* Presets rapides */}
                        <div className="space-y-1.5">
                          <label className="text-[11px] font-black uppercase text-slate-400 tracking-wider block">
                            Durées suggérées :
                          </label>
                          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                            {[
                              { sec: 0.2, label: '0.2s', sub: 'Éclair' },
                              { sec: 0.5, label: '0.5s', sub: 'Rapide' },
                              { sec: 1.0, label: '1.0s', sub: 'Défaut' },
                              { sec: 2.0, label: '2.0s', sub: 'Pause' },
                              { sec: 3.0, label: '3.0s', sub: 'Moyen' },
                              { sec: 5.0, label: '5.0s', sub: 'Long' },
                            ].map((p) => {
                              const isSelected = (activeModal.delayDuration || 1) === p.sec;
                              return (
                                <button
                                  key={p.sec}
                                  type="button"
                                  onClick={() => setActiveModal({ ...activeModal, delayDuration: p.sec })}
                                  className={`p-2.5 rounded-xl border text-center transition-all cursor-pointer ${
                                    isSelected
                                      ? 'bg-amber-500 text-white border-amber-600 shadow-sm scale-105 font-black'
                                      : 'bg-slate-50 hover:bg-amber-50/60 border-slate-200 text-slate-700 font-bold'
                                  }`}
                                >
                                  <div className="text-xs">{p.label}</div>
                                  <div className={`text-[9px] ${isSelected ? 'text-amber-100' : 'text-slate-400'}`}>{p.sub}</div>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* Slider et Champ numérique */}
                        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700">Durée précise (secondes) :</span>
                            <div className="flex items-center gap-1.5">
                              <input
                                type="number"
                                min="0.1"
                                max="60"
                                step="0.1"
                                value={activeModal.delayDuration ?? 1}
                                onChange={(e) => {
                                  const val = Math.max(0.1, Math.min(60, parseFloat(e.target.value) || 0.1));
                                  setActiveModal({ ...activeModal, delayDuration: Math.round(val * 10) / 10 });
                                }}
                                className="w-20 px-2 py-1 text-center font-mono font-black text-sm bg-white border border-amber-400 rounded-lg shadow-2xs outline-none focus:ring-2 focus:ring-amber-400"
                              />
                              <span className="text-xs font-black text-slate-600">sec</span>
                            </div>
                          </div>

                          <input
                            type="range"
                            min="0.1"
                            max="10.0"
                            step="0.1"
                            value={activeModal.delayDuration ?? 1}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 1;
                              setActiveModal({ ...activeModal, delayDuration: Math.round(val * 10) / 10 });
                            }}
                            className="w-full accent-amber-500 cursor-pointer h-2 bg-slate-200 rounded-lg"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            applyAction({
                              type: 'delay',
                              delayDuration: activeModal.delayDuration ?? 1,
                            });
                          }}
                          className="w-full py-3.5 bg-amber-500 hover:bg-amber-600 text-white font-black text-sm rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Valider ce délai ({activeModal.delayDuration ?? 1}s)</span>
                        </button>
                      </div>
                    )}

                    {/* Modal Action : Émettre des Particules */}
                    {activeModal.subStep === 'choose_particles' && (
                      <div className="space-y-4 max-w-xl mx-auto py-2">
                        <div className="flex flex-wrap gap-2">
                          {[
                            { label: '🔥 Étincelles', count: 16, color: '#f59e0b', color2: '#ef4444', shape: 'spark' as ParticleShape, speed: 220, gravity: 280, spread: 140 },
                            { label: '💥 Explosion', count: 28, color: '#ef4444', color2: '#fbbf24', shape: 'circle' as ParticleShape, speed: 260, gravity: 180, spread: 360 },
                            { label: '✨ Magie', count: 20, color: '#8b5cf6', color2: '#ec4899', shape: 'star' as ParticleShape, speed: 140, gravity: -60, spread: 360 },
                            { label: '🎉 Confettis', count: 32, color: '#10b981', color2: '#3b82f6', shape: 'square' as ParticleShape, speed: 210, gravity: 240, spread: 180 },
                          ].map((preset) => (
                            <button
                              key={preset.label}
                              type="button"
                              onClick={() =>
                                setActiveModal({
                                  ...activeModal,
                                  particleCount: preset.count,
                                  particleColor: preset.color,
                                  particleColor2: preset.color2,
                                  particleShape: preset.shape,
                                  particleSpeed: preset.speed,
                                  particleGravity: preset.gravity,
                                  particleSpread: preset.spread,
                                })
                              }
                              className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl text-xs font-bold text-amber-900 cursor-pointer transition-colors"
                            >
                              {preset.label}
                            </button>
                          ))}
                        </div>

                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Source d'émission</span>
                            <select
                              value={activeModal.particleOriginMode || 'subject'}
                              onChange={(e) => setActiveModal({ ...activeModal, particleOriginMode: e.target.value as any })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              <option value="subject">Sujet</option>
                              {(isCollision || rule.trigger.type === 'proximity') && (
                                <option value="target">Cible touchée</option>
                              )}
                              <option value="event_point">💥 Point exact (Collision / Clic)</option>
                              <option value="entity">Entité de la scène</option>
                              <option value="type">Par Type d'objet</option>
                              <option value="tag">Par #Tag</option>
                              <option value="last_spawned">Dernier objet créé</option>
                            </select>
                          </div>

                          {activeModal.particleOriginMode === 'entity' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Entité source</span>
                              <select
                                value={activeModal.particleOriginEntityId || Object.keys(entities)[0] || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, particleOriginEntityId: e.target.value })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {Object.values(entities).map((ent) => (
                                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeModal.particleOriginMode === 'type' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Type source</span>
                              <select
                                value={activeModal.particleOriginEntityType || availableEntityOptions[0]?.type || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, particleOriginEntityType: e.target.value })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {availableEntityOptions.map((opt) => (
                                  <option key={opt.type} value={opt.type}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeModal.particleOriginMode === 'tag' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Tag source (#tag)</span>
                              <input
                                type="text"
                                list="modal-particle-tags"
                                value={activeModal.particleOriginTag || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, particleOriginTag: e.target.value.replace(/^#/, '') })}
                                placeholder="ex: joueur, ennemi..."
                                className="w-44 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              />
                              <datalist id="modal-particle-tags">
                                {allProjectTags.map((t) => (
                                  <option key={t} value={t} />
                                ))}
                              </datalist>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setParticleEditorContext('modal')}
                            className="w-full py-2 px-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-xs transition-all active:scale-[0.99]"
                          >
                            <Sliders className="w-3.5 h-3.5" />
                            <span>Ouvrir l'Éditeur &amp; Testeur Visuel</span>
                          </button>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Forme</span>
                            <select
                              value={activeModal.particleShape || 'circle'}
                              onChange={(e) => {
                                const nextShape = e.target.value as ParticleShape;
                                setActiveModal({
                                  ...activeModal,
                                  particleShape: nextShape,
                                  customParticleId:
                                    nextShape === 'custom' && !activeModal.customParticleId && customParticles.length > 0
                                      ? customParticles[0].id
                                      : activeModal.customParticleId,
                                });
                              }}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              <option value="circle">Rond</option>
                              <option value="square">Carré</option>
                              <option value="spark">Étincelle</option>
                              <option value="star">Étoile</option>
                              <option value="custom">Particule dessinée ✨</option>
                            </select>
                          </div>

                          {activeModal.particleShape === 'custom' && (
                            <div className="p-2.5 bg-amber-50/70 rounded-xl border border-amber-200 space-y-2">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[11px] font-bold text-amber-950">Particule vectorielle :</span>
                                <button
                                  type="button"
                                  onClick={() => setParticleDrawingTarget({ context: 'modal' })}
                                  className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-[10px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                >
                                  <Paintbrush className="w-3 h-3" />
                                  <span>+ Dessiner une particule</span>
                                </button>
                              </div>
                              {customParticles.length === 0 ? (
                                <div className="text-[11px] text-amber-800 bg-white/80 rounded-lg p-2 border border-amber-200 text-center">
                                  Aucune particule dessinée. Cliquez sur <strong>+ Dessiner une particule</strong>.
                                </div>
                              ) : (
                                <div className="grid grid-cols-4 gap-1.5">
                                  {customParticles.map((preset) => {
                                    const isSel = activeModal.customParticleId === preset.id;
                                    return (
                                      <div
                                        key={preset.id}
                                        onClick={() => setActiveModal({ ...activeModal, customParticleId: preset.id })}
                                        className={`relative group p-1.5 rounded-xl border flex flex-col items-center gap-1 cursor-pointer transition-all ${
                                          isSel
                                            ? 'bg-white border-amber-500 ring-2 ring-amber-300/60 shadow-xs'
                                            : 'bg-white/80 border-slate-200 hover:border-amber-300'
                                        }`}
                                      >
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
                                              setParticleDrawingTarget({ context: 'modal', editingPreset: preset });
                                            }}
                                            className="w-4 h-4 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                            title="Modifier"
                                          >
                                            <Pencil className="w-2.5 h-2.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              deleteCustomParticle(preset.id);
                                              invalidateCustomParticleSprite(preset.id);
                                              if (isSel) setActiveModal({ ...activeModal, customParticleId: undefined });
                                            }}
                                            className="w-4 h-4 rounded-full bg-rose-600 text-white flex items-center justify-center shadow-xs cursor-pointer"
                                            title="Supprimer"
                                          >
                                            <X className="w-2.5 h-2.5" />
                                          </button>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              <div className="flex items-center justify-between pt-1 border-t border-amber-200/70">
                                <span className="text-[11px] font-bold text-slate-700">Teinter avec les couleurs d'émission</span>
                                <input
                                  type="checkbox"
                                  checked={activeModal.useParticleTint === true}
                                  onChange={(e) => setActiveModal({ ...activeModal, useParticleTint: e.target.checked })}
                                  className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                                />
                              </div>
                            </div>
                          )}

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Nombre ({activeModal.particleCount ?? 20})</span>
                            <input
                              type="range"
                              min="4"
                              max="50"
                              step="2"
                              value={activeModal.particleCount ?? 20}
                              onChange={(e) => setActiveModal({ ...activeModal, particleCount: parseInt(e.target.value, 10) })}
                              className="w-40 accent-amber-500"
                            />
                          </div>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Couleurs (Mix)</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={activeModal.particleColor || '#f59e0b'}
                                onChange={(e) => setActiveModal({ ...activeModal, particleColor: e.target.value })}
                                className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                              />
                              <input
                                type="color"
                                value={activeModal.particleColor2 || '#ef4444'}
                                onChange={(e) => setActiveModal({ ...activeModal, particleColor2: e.target.value })}
                                className="w-8 h-6 rounded border border-slate-300 cursor-pointer"
                              />
                            </div>
                          </div>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Taille ({activeModal.particleSize ?? 6} px)</span>
                            <input
                              type="range"
                              min="2"
                              max="24"
                              step="1"
                              value={activeModal.particleSize ?? 6}
                              onChange={(e) => setActiveModal({ ...activeModal, particleSize: parseFloat(e.target.value) })}
                              className="w-40 accent-indigo-600"
                            />
                          </div>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Vitesse ({activeModal.particleSpeed ?? 180} px/s)</span>
                            <input
                              type="range"
                              min="40"
                              max="450"
                              step="10"
                              value={activeModal.particleSpeed ?? 180}
                              onChange={(e) => setActiveModal({ ...activeModal, particleSpeed: parseFloat(e.target.value) })}
                              className="w-40 accent-indigo-600"
                            />
                          </div>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Gravité ({activeModal.particleGravity ?? 220})</span>
                            <input
                              type="range"
                              min="-200"
                              max="500"
                              step="20"
                              value={activeModal.particleGravity ?? 220}
                              onChange={(e) => setActiveModal({ ...activeModal, particleGravity: parseFloat(e.target.value) })}
                              className="w-40 accent-indigo-600"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const pOriginMode = activeModal.particleOriginMode || 'subject';
                            applyAction({
                              type: 'emit_particles',
                              particleOriginMode: pOriginMode,
                              particleOriginEntityId:
                                pOriginMode === 'entity'
                                  ? activeModal.particleOriginEntityId || Object.keys(entities)[0]
                                  : undefined,
                              particleOriginEntityType:
                                pOriginMode === 'type'
                                  ? activeModal.particleOriginEntityType || availableEntityOptions[0]?.type
                                  : undefined,
                              particleOriginTag:
                                pOriginMode === 'tag'
                                  ? (activeModal.particleOriginTag || '').trim().replace(/^#/, '')
                                  : undefined,
                              particleCount: activeModal.particleCount ?? 20,
                              particleColor: activeModal.particleColor ?? '#f59e0b',
                              particleColor2: activeModal.particleColor2 ?? '#ef4444',
                              particleShape: activeModal.particleShape ?? 'circle',
                              customParticleId:
                                activeModal.particleShape === 'custom' ? activeModal.customParticleId : undefined,
                              useParticleTint:
                                activeModal.particleShape === 'custom' ? Boolean(activeModal.useParticleTint) : undefined,
                              particleSpeed: activeModal.particleSpeed ?? 180,
                              particleSize: activeModal.particleSize ?? 6,
                              particleLifetime: activeModal.particleLifetime ?? 0.7,
                              particleGravity: activeModal.particleGravity ?? 220,
                              particleSpread: activeModal.particleSpread ?? 360,
                              particleAngle: activeModal.particleAngle ?? -90,
                            });
                          }}
                          className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Valider l'effet de particules</span>
                        </button>
                      </div>
                    )}

                    {/* Modal Action : Attacher à un Parent */}
                    {activeModal.subStep === 'choose_attach_parent' && (
                      <div className="space-y-4 max-w-xl mx-auto py-2">
                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Objet enfant à attacher</span>
                            <select
                              value={activeModal.parentChildMode || 'subject'}
                              onChange={(e) => setActiveModal({ ...activeModal, parentChildMode: e.target.value as any })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              <option value="subject">Sujet</option>
                              {isCollision && <option value="target">Cible touchée</option>}
                              <option value="last_spawned">Dernier objet créé</option>
                              <option value="tag">Par Tag (#tag)</option>
                            </select>
                          </div>

                          {activeModal.parentChildMode === 'tag' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Tag enfant</span>
                              <input
                                type="text"
                                value={activeModal.parentChildTag || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, parentChildTag: e.target.value.replace(/^#/, '') })}
                                placeholder="ex: arme"
                                className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              />
                            </div>
                          )}

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Objet parent (Porteur)</span>
                            <select
                              value={activeModal.parentTargetMode || (isCollision ? 'target' : 'entity')}
                              onChange={(e) => setActiveModal({ ...activeModal, parentTargetMode: e.target.value as any })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              <option value="subject">Sujet</option>
                              {isCollision && <option value="target">Cible touchée</option>}
                              <option value="entity">Entité de la scène</option>
                              <option value="type">Par Type</option>
                              <option value="tag">Par Tag (#tag)</option>
                              <option value="last_spawned">Dernier objet créé</option>
                            </select>
                          </div>

                          {activeModal.parentTargetMode === 'entity' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Choisir parent</span>
                              <select
                                value={activeModal.parentEntityId || Object.keys(entities)[0] || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, parentEntityId: e.target.value })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {Object.values(entities).map((ent) => (
                                  <option key={ent.id} value={ent.id}>{ent.name}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeModal.parentTargetMode === 'type' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Type parent</span>
                              <select
                                value={activeModal.parentEntityType || availableEntityOptions[0]?.type || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, parentEntityType: e.target.value })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {availableEntityOptions.map((opt) => (
                                  <option key={opt.type} value={opt.type}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          )}

                          {activeModal.parentTargetMode === 'tag' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Tag parent</span>
                              <input
                                type="text"
                                value={activeModal.parentEntityTag || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, parentEntityTag: e.target.value.replace(/^#/, '') })}
                                placeholder="ex: joueur"
                                className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              />
                            </div>
                          )}

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Décalage ΔX / ΔY (px)</span>
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                value={activeModal.parentOffset?.x ?? 0}
                                onChange={(e) =>
                                  setActiveModal({
                                    ...activeModal,
                                    parentOffset: {
                                      x: parseFloat(e.target.value) || 0,
                                      y: activeModal.parentOffset?.y ?? 0,
                                      inheritRotation: activeModal.parentOffset?.inheritRotation ?? true,
                                      inheritFlip: activeModal.parentOffset?.inheritFlip ?? true,
                                    },
                                  })
                                }
                                className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                              />
                              <input
                                type="number"
                                value={activeModal.parentOffset?.y ?? 0}
                                onChange={(e) =>
                                  setActiveModal({
                                    ...activeModal,
                                    parentOffset: {
                                      x: activeModal.parentOffset?.x ?? 0,
                                      y: parseFloat(e.target.value) || 0,
                                      inheritRotation: activeModal.parentOffset?.inheritRotation ?? true,
                                      inheritFlip: activeModal.parentOffset?.inheritFlip ?? true,
                                    },
                                  })
                                }
                                className="w-16 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-mono text-right"
                              />
                            </div>
                          </div>

                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
                            <span className="font-bold text-slate-700 text-xs">Hériter rotation & Flip du parent</span>
                            <input
                              type="checkbox"
                              checked={activeModal.parentOffset?.inheritRotation !== false}
                              onChange={(e) =>
                                setActiveModal({
                                  ...activeModal,
                                  parentOffset: {
                                    x: activeModal.parentOffset?.x ?? 0,
                                    y: activeModal.parentOffset?.y ?? 0,
                                    inheritRotation: e.target.checked,
                                    inheritFlip: e.target.checked,
                                  },
                                })
                              }
                              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                            />
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            applyAction({
                              type: 'attach_to_parent',
                              targetMode: activeModal.parentChildMode || 'subject',
                              targetTag: activeModal.parentChildMode === 'tag' ? activeModal.parentChildTag : undefined,
                              parentTargetMode: activeModal.parentTargetMode || 'entity',
                              parentEntityId: activeModal.parentTargetMode === 'entity' ? activeModal.parentEntityId || Object.keys(entities)[0] : undefined,
                              parentEntityType: activeModal.parentTargetMode === 'type' ? activeModal.parentEntityType || availableEntityOptions[0]?.type : undefined,
                              parentEntityTag: activeModal.parentTargetMode === 'tag' ? activeModal.parentEntityTag : undefined,
                              parentOffset: activeModal.parentOffset,
                            });
                          }}
                          className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Valider l'attachement</span>
                        </button>
                      </div>
                    )}

                    {/* Modal Action : Détacher du Parent */}
                    {activeModal.subStep === 'choose_detach_parent' && (
                      <div className="space-y-4 max-w-xl mx-auto py-2">
                        <div className="space-y-1.5 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                            <span className="font-bold text-slate-700 text-xs">Objet à détacher</span>
                            <select
                              value={activeModal.targetMode || 'subject'}
                              onChange={(e) => setActiveModal({ ...activeModal, targetMode: e.target.value as any })}
                              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                            >
                              <option value="subject">Sujet</option>
                              {isCollision && <option value="target">Cible touchée</option>}
                              <option value="last_spawned">Dernier objet créé</option>
                              <option value="tag">Par Tag (#tag)</option>
                              <option value="type">Par Type</option>
                            </select>
                          </div>

                          {activeModal.targetMode === 'tag' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Tag à détacher</span>
                              <input
                                type="text"
                                value={activeModal.targetTag || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, targetTag: e.target.value.replace(/^#/, '') })}
                                placeholder="ex: arme"
                                className="w-40 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              />
                            </div>
                          )}

                          {activeModal.targetMode === 'type' && (
                            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
                              <span className="font-bold text-slate-700 text-xs">Type à détacher</span>
                              <select
                                value={activeModal.selectedTargetType || availableEntityOptions[0]?.type || ''}
                                onChange={(e) => setActiveModal({ ...activeModal, selectedTargetType: e.target.value })}
                                className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
                              >
                                {availableEntityOptions.map((opt) => (
                                  <option key={opt.type} value={opt.type}>{opt.label}</option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            applyAction({
                              type: 'detach_parent',
                              targetMode: activeModal.targetMode || 'subject',
                              targetTag: activeModal.targetMode === 'tag' ? activeModal.targetTag : undefined,
                              targetType: activeModal.targetMode === 'type' ? activeModal.selectedTargetType || availableEntityOptions[0]?.type : undefined,
                            });
                          }}
                          className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
                        >
                          <Check className="w-4 h-4" />
                          <span>Valider le détachement</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Boîte modale de gestion et enregistrement des sons audio */}
      <SoundRecorderModal
        isOpen={isSoundModalOpen}
        onClose={() => setIsSoundModalOpen(false)}
        onSelectSound={(sound) => {
          if (activeModal && activeModal.type === 'action') {
            const rule = rules.find((r) => r.id === activeModal.ruleId);
            if (rule) {
              const updatedActions = [...rule.actions];
              const newAct: RuleAction = {
                id: `act-${Date.now()}`,
                type: 'play_sound',
                customSoundId: sound.id,
              };
              if (activeModal.actionIndex !== undefined) {
                updatedActions[activeModal.actionIndex] = {
                  ...updatedActions[activeModal.actionIndex],
                  type: 'play_sound',
                  customSoundId: sound.id,
                };
              } else {
                updatedActions.push(newAct);
              }
              updateRule(rule.id, { actions: updatedActions });
              setActiveModal(null);
            }
          }
        }}
      />
      {/* Atelier de dessin plein écran pour particule personnalisée */}
      {particleDrawingTarget && (
        <FullScreenDrawingModal
          title={
            particleDrawingTarget.editingPreset
              ? `Modifier particule : ${particleDrawingTarget.editingPreset.name}`
              : 'Dessiner une particule'
          }
          subtitle="Dessinez votre particule personnalisée"
          initialPaths={particleDrawingTarget.editingPreset?.vectorPaths || []}
          currentEditingStateName={
            particleDrawingTarget.editingPreset?.name || `Particule ${customParticles.length + 1}`
          }
          onSave={(paths, _dataUrl, _colliderType, customName) => {
            const finalName = (customName || '').trim() || `Particule ${customParticles.length + 1}`;
            let targetPresetId = particleDrawingTarget.editingPreset?.id;
            if (targetPresetId) {
              updateCustomParticle(targetPresetId, {
                name: finalName,
                vectorPaths: paths,
              });
              invalidateCustomParticleSprite(targetPresetId);
            } else {
              targetPresetId = addCustomParticle({
                name: finalName,
                vectorPaths: paths,
                useTint: false,
              });
            }
            if (particleDrawingTarget.context === 'wizard' && activeWizard) {
              setActiveWizard({
                ...activeWizard,
                particleShape: 'custom',
                customParticleId: targetPresetId,
              });
            } else if (
              particleDrawingTarget.context === 'modal' &&
              activeModal &&
              activeModal.type === 'action'
            ) {
              setActiveModal({
                ...activeModal,
                particleShape: 'custom',
                customParticleId: targetPresetId,
              });
            }
            setParticleDrawingTarget(null);
          }}
          onClose={() => setParticleDrawingTarget(null)}
        />
      )}

      {/* Éditeur & Testeur interactif de particules (Action emit_particles) */}
      {particleEditorContext && (() => {
        const src =
          particleEditorContext === 'wizard'
            ? activeWizard
            : activeModal && activeModal.type === 'action'
            ? activeModal
            : null;
        if (!src) return null;
        return (
          <ParticleEditorModal
            isOpen={true}
            mode="burst"
            initialConfig={{
              shape: src.particleShape || 'circle',
              customParticleId: src.customParticleId,
              useParticleTint: src.useParticleTint,
              color: src.particleColor || '#f59e0b',
              color2: src.particleColor2 || '#ef4444',
              count: src.particleCount ?? 20,
              speed: src.particleSpeed ?? 180,
              size: src.particleSize ?? 6,
              lifetime: src.particleLifetime ?? 0.7,
              gravity: src.particleGravity ?? 220,
              spread: src.particleSpread ?? 360,
              angle: src.particleAngle ?? -90,
            }}
            onApply={(cfg) => {
              const patch = {
                particleShape: cfg.shape,
                customParticleId: cfg.shape === 'custom' ? cfg.customParticleId : undefined,
                useParticleTint: cfg.shape === 'custom' ? Boolean(cfg.useParticleTint) : undefined,
                particleColor: cfg.color,
                particleColor2: cfg.color2,
                particleCount: cfg.count ?? 20,
                particleSpeed: cfg.speed,
                particleSize: cfg.size,
                particleLifetime: cfg.lifetime,
                particleGravity: cfg.gravity,
                particleSpread: cfg.spread,
                particleAngle: cfg.angle,
              };
              if (particleEditorContext === 'wizard' && activeWizard) {
                setActiveWizard({ ...activeWizard, ...patch });
              } else if (particleEditorContext === 'modal' && activeModal && activeModal.type === 'action') {
                setActiveModal({ ...activeModal, ...patch });
              }
              setParticleEditorContext(null);
            }}
            onClose={() => setParticleEditorContext(null)}
          />
        );
      })()}
    </div>
  );
}
