import React, { useState, useMemo } from 'react';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../store/useSceneStore';
import {
  ActionType,
  RuleAction,
  RuleTrigger,
  EntityType,
  SelectionMode,
  DynamicRule,
  SoundType,
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import { SoundRecorderModal } from './SoundRecorderModal';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { ParticleEditorModal } from './ParticleEditorModal';
import { invalidateCustomParticleSprite } from '../utils/particleSystem';
import {
  Plus,
  Trash2,
  Copy,
  ArrowRight,
  X,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  Search,
  Folder,
  FolderPlus,
  Play,
  Mic,
  Check,
  GripVertical,
} from 'lucide-react';
import { soundSynth } from '../utils/sound';
import {
  ActiveModal,
  ParticleDrawingTarget,
  WizardData,
} from './rulebook/ruleBookTypes';
import {
  formatEntityStateName,
  getEntityObjFromList,
  RuleActionSummaryBadge,
} from './rulebook/RuleActionSummaryBadge';
import { RuleCreationWizardModal } from './rulebook/RuleCreationWizardModal';
import { RuleSlotEditModal } from './rulebook/RuleSlotEditModal';

export function RuleBook() {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const rules = useSceneStore((state) => state.rules);
  const folders = useSceneStore((state) => state.folders || EMPTY_LIST);
  const customSounds = useSceneStore((state) => state.customSounds || EMPTY_LIST);
  const addRule = useSceneStore((state) => state.addRule);
  const updateRule = useSceneStore((state) => state.updateRule);
  const deleteRule = useSceneStore((state) => state.deleteRule);
  const toggleRule = useSceneStore((state) => state.toggleRule);
  const duplicateRule = useSceneStore((state) => state.duplicateRule);
  const setRuleFolder = useSceneStore((state) => state.setRuleFolder);
  const addFolder = useSceneStore((state) => state.addFolder);
  const deleteFolder = useSceneStore((state) => state.deleteFolder);
  const settings = useSceneStore((state) => state.settings);
  const customParticles = useSceneStore((state) => state.customParticles || EMPTY_LIST);
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
  const [particleDrawingTarget, setParticleDrawingTarget] = useState<ParticleDrawingTarget | null>(null);
  const [particleEditorContext, setParticleEditorContext] = useState<'wizard' | 'modal' | null>(null);

  // Folder & Search state
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isSoundModalOpen, setIsSoundModalOpen] = useState<boolean>(false);
  const [, setPlayingSoundId] = useState<string | null>(null);
  const collapsedRuleIds = useSceneStore((state) => state.collapsedRuleIds || EMPTY_RECORD);
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

  const layerGroups = useSceneStore((state) => state.layerGroups || EMPTY_LIST);

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
  const getEntityObj = (type?: string) =>
    getEntityObjFromList(type, entityList, customArchetypes);

  const formatStateName = (stateId?: string, entObj?: any) =>
    formatEntityStateName(stateId, entObj, entityList, customArchetypes);

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

  // Helpers d'ouverture directe en 1 clic vers les modales d'édition de règle
  const openRuleSubjectModal = (
    rule: DynamicRule,
    subStep: 'choose_object' | 'choose_state' = 'choose_object'
  ) => {
    const mode = rule.trigger.subjectMode || 'type';
    const inst = mode === 'instance' && rule.trigger.subjectId ? entities[rule.trigger.subjectId] : undefined;
    const type = inst?.type || rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
    setActiveModal({
      type: 'subject',
      ruleId: rule.id,
      subStep,
      selectionMode: mode,
      selectedEntityType: type,
      selectedEntityId: rule.trigger.subjectId,
      tagInput: rule.trigger.subjectTag || '',
    });
  };

  const openRuleTargetModal = (
    rule: DynamicRule,
    subStep: 'choose_object' | 'choose_state' = 'choose_object'
  ) => {
    const mode = rule.trigger.targetMode || 'type';
    const inst = mode === 'instance' && rule.trigger.targetId ? entities[rule.trigger.targetId] : undefined;
    const type = inst?.type || rule.trigger.targetType || availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant';
    setActiveModal({
      type: 'target',
      ruleId: rule.id,
      subStep,
      selectionMode: mode,
      selectedEntityType: type,
      selectedEntityId: rule.trigger.targetId,
      tagInput: rule.trigger.targetTag || '',
    });
  };

  const openRuleEventModal = (
    rule: DynamicRule,
    subStep: 'main' | 'key_picker' | 'config_event_params' = 'main'
  ) => {
    setActiveModal({
      type: 'event',
      ruleId: rule.id,
      subStep,
      triggerType: rule.trigger.type,
      triggerPhase: rule.trigger.phase,
      timerInterval: rule.trigger.timerInterval ?? 2,
      timerType: rule.trigger.timerType ?? 'repeat',
      keyName: rule.trigger.keyName ?? 'Space',
      proximityDistance: rule.trigger.proximityDistance ?? 80,
      boundaryEdge: rule.trigger.boundaryEdge ?? 'any',
      variableName: rule.trigger.variableName ?? 'score',
      variableOperator: rule.trigger.variableOperator ?? '>=',
      variableValue: rule.trigger.variableValue ?? 5,
      autoRevert: rule.trigger.autoRevert ?? false,
      collisionExitMargin: rule.trigger.collisionExitMargin ?? 10,
      collisionTriggerOnce: rule.trigger.collisionTriggerOnce ?? false,
    });
  };

  const openRuleActionModal = (
    rule: DynamicRule,
    act: RuleAction,
    actIdx: number,
    overrideSubStep?: Extract<NonNullable<ActiveModal>, { type: 'action' }>['subStep']
  ) => {
    const isCollisionOrProx = rule.trigger.type === 'collision' || rule.trigger.type === 'proximity';
    const subType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
    const tarType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';
    const resolvedTargetType =
      act.targetMode === 'subject'
        ? subType
        : act.targetMode === 'target'
        ? tarType
        : act.targetType || subType;

    const defaultSubStep: Extract<NonNullable<ActiveModal>, { type: 'action' }>['subStep'] =
      act.type === 'delay'
        ? 'choose_delay_duration'
        : act.type === 'emit_particles'
        ? 'choose_particles'
        : act.type === 'attach_to_parent'
        ? 'choose_attach_parent'
        : act.type === 'detach_parent'
        ? 'choose_detach_parent'
        : act.type === 'move_entity'
        ? 'choose_move_entity'
        : 'main';

    setActiveModal({
      type: 'action',
      ruleId: rule.id,
      actionIndex: actIdx,
      actionId: act.id,
      actionType: act.type,
      targetMode: act.targetMode || (isCollisionOrProx ? 'target' : 'subject'),
      selectedTargetType: resolvedTargetType,
      targetTag: act.targetTag,
      pendingSpawnType: act.spawnEntityType || availableEntityOptions[0]?.type,
      pendingSpawnInitialStateId: act.spawnInitialStateId,
      toggleStateA: act.toggleStateAId,
      toggleStateB: act.toggleStateBId,
      toggleTargetStateId: act.toggleTargetStateId,
      toggleMode: act.toggleMode,
      subStep: overrideSubStep || defaultSubStep,
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
      customParticleIds: act.customParticleIds,
      customParticleMode: act.customParticleMode,
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
      moveDistance: act.moveDistance ?? 40,
      moveDirectionMode: act.moveDirectionMode || 'cardinal',
      moveCardinal: act.moveCardinal || 'right',
      moveAngle: act.moveAngle ?? 0,
      moveApplyMode: act.moveApplyMode || 'instant',
      moveTargetMode: act.moveTargetMode || (isCollisionOrProx ? 'target' : 'entity'),
      moveTargetEntityId: act.moveTargetEntityId,
      moveTargetEntityType: act.moveTargetEntityType,
      moveTargetTag: act.moveTargetTag,
    });
  };

  // Action badge renderer for compact view - supports 1-click jump to action or sub-step
  const renderActionSummary = (
    act: RuleAction,
    trigger: RuleTrigger,
    rule?: DynamicRule,
    actIdx?: number
  ) => (
    <RuleActionSummaryBadge
      act={act}
      trigger={trigger}
      rule={rule}
      actIdx={actIdx}
      entities={entities}
      customSounds={customSounds}
      customParticles={customParticles}
      getEntityObj={getEntityObj}
      formatStateName={formatStateName}
      openRuleActionModal={openRuleActionModal}
    />
  );

  // Start guided sequential wizard (1. Condition > 2. Objets > 3. Action)
  const startCreationWizard = () => {
    const defaultSub = availableEntityOptions[0]?.type || 'apple';
    const defaultTar = availableEntityOptions[1]?.type || availableEntityOptions[0]?.type || 'plant';

    setActiveWizard({
      step: 1,
      objectPhase: 'subject',
      subjectSubStep: 'choose_object',
      targetSubStep: 'choose_object',
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
            <span>Sons &amp; Voix</span>
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
              Clics &amp; Relâché
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
            } else if (rule.trigger.type === 'joint_break' || rule.trigger.phase === 'joint_break') {
              eventName = 'Rupture de Joint';
              eventIcon = '⛓️‍💥';
              eventSub = 'Joint cassé';
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

                  {/* 2. Compact View when Collapsed (Accordéon fermé) — Ordre: QUAND [Condition] -> [Objets] -> [Actions] */}
                  {isCollapsed ? (
                    <div
                      onClick={() => toggleCollapseRule(rule.id)}
                      className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50 hover:bg-indigo-50/40 rounded-2xl border border-slate-200/80 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-2 flex-wrap text-xs">
                        {/* 1. QUAND [Condition] */}
                        <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                          QUAND
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRuleEventModal(rule, 'main');
                            }}
                            className="flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-slate-900 hover:bg-indigo-700 text-white font-bold text-[11px] transition-colors cursor-pointer"
                            title="Changer la condition déclencheur"
                          >
                            <span>{eventIcon}</span>
                            <span>{eventName}</span>
                          </button>
                          {['timer', 'keyboard', 'proximity', 'boundary', 'variable', 'collision'].includes(rule.trigger.type) && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRuleEventModal(
                                  rule,
                                  rule.trigger.type === 'keyboard' ? 'key_picker' : 'config_event_params'
                                );
                              }}
                              className="px-1.5 py-0.5 rounded-md bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300/80 font-bold text-[10px] transition-colors cursor-pointer"
                              title="Configurer les paramètres de la condition"
                            >
                              ⚙️
                            </button>
                          )}
                        </div>

                        <span className="text-slate-400 font-bold">➔</span>

                        {/* 2. [Objets : Sujet / Cible] */}
                        {isGlobalTrigger ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRuleEventModal(rule, 'main');
                            }}
                            className="flex items-center gap-1.5 font-extrabold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/80 px-2 py-0.5 rounded-xl transition-colors cursor-pointer"
                            title="Événement global (aucun objet requis)"
                          >
                            <span>⚡ Système / Global</span>
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRuleSubjectModal(rule, 'choose_object');
                              }}
                              className="flex items-center gap-1.5 hover:bg-white rounded-lg px-1 py-0.5 transition-colors cursor-pointer"
                              title="Changer le Sujet"
                            >
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
                            </button>
                            {rule.trigger.subjectStateId && subjectMode !== 'any' && subjectMode !== 'tag' && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRuleSubjectModal(rule, 'choose_state');
                                }}
                                className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                                title="Changer l'état requis du Sujet"
                              >
                                ({subjectStateName})
                              </button>
                            )}
                          </div>
                        )}

                        {isCollision && (
                          <>
                            <span className="text-slate-400 font-bold">↔</span>
                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRuleTargetModal(rule, 'choose_object');
                                }}
                                className="flex items-center gap-1.5 hover:bg-white rounded-lg px-1 py-0.5 transition-colors cursor-pointer"
                                title="Changer la Cible"
                              >
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
                              </button>
                              {rule.trigger.targetStateId && targetMode !== 'any' && targetMode !== 'tag' && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRuleTargetModal(rule, 'choose_state');
                                  }}
                                  className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.5 rounded font-medium cursor-pointer"
                                  title="Changer l'état requis de la Cible"
                                >
                                  ({targetStateName})
                                </button>
                              )}
                            </div>
                          </>
                        )}

                        <span className="text-indigo-500 font-bold ml-1">➔</span>

                        {/* 3. Visuel complet et cliquable en 1 clic des actions en mode compact */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rule.actions.map((act, actIdx) => (
                            <React.Fragment key={act.id}>
                              {renderActionSummary(act, rule.trigger, rule, actIdx)}
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
                    /* 3. Horizontal Storyboard Flow (Déplié) — Ordre: QUAND [Condition] -> [Objets] -> [Actions] */
                    <div className="flex items-center gap-3 overflow-x-auto pb-1 pt-1 scrollbar-thin">
                      {/* --- SECTION QUAND & OBJETS --- */}
                      <div className="flex items-center gap-2.5 bg-slate-50 p-2.5 rounded-2xl border border-slate-200/90 shrink-0">
                        {/* CASE 1: CONDITION (Large Card) */}
                        <div
                          role="button"
                          tabIndex={0}
                          onClick={() => openRuleEventModal(rule, 'main')}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              openRuleEventModal(rule, 'main');
                            }
                          }}
                          className="w-36 h-36 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group"
                          title="Cliquer pour changer le type de condition"
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                              1. Quand
                            </span>
                            {['timer', 'keyboard', 'proximity', 'boundary', 'variable', 'collision'].includes(rule.trigger.type) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRuleEventModal(
                                    rule,
                                    rule.trigger.type === 'keyboard' ? 'key_picker' : 'config_event_params'
                                  );
                                }}
                                className="text-[9px] font-bold bg-white/10 hover:bg-amber-400 hover:text-slate-900 text-amber-300 px-1.5 py-0.5 rounded transition-colors cursor-pointer"
                                title="Ouvrir les réglages de cette condition"
                              >
                                ⚙️
                              </button>
                            )}
                          </div>
                          <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-2xl shadow-inner group-hover:scale-110 transition-transform">
                            {eventIcon}
                          </div>
                          <div className="w-full">
                            <div className="text-xs font-black uppercase tracking-tight text-amber-300 truncate">
                              {eventName}
                            </div>
                            {/* Contrôles interactifs inline pour modifier les valeurs de conditions */}
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
                              <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <select
                                  value={rule.trigger.keyName || 'Space'}
                                  onChange={(e) => updateRule(rule.id, { trigger: { ...rule.trigger, keyName: e.target.value } })}
                                  className="text-[9px] font-bold bg-slate-800 text-amber-300 border border-slate-700 rounded px-1 py-0.5 outline-none cursor-pointer flex-1 text-center"
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
                        </div>

                        {/* CASE 2: SUJET (Large Card) */}
                        <div
                          role={isGlobalTrigger ? undefined : 'button'}
                          tabIndex={isGlobalTrigger ? undefined : 0}
                          onClick={() => !isGlobalTrigger && openRuleSubjectModal(rule, 'choose_object')}
                          onKeyDown={(e) => {
                            if (!isGlobalTrigger && (e.key === 'Enter' || e.key === ' ')) {
                              e.preventDefault();
                              openRuleSubjectModal(rule, 'choose_object');
                            }
                          }}
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
                            {isGlobalTrigger ? '2. Portée' : '2. Sujet'}
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
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openRuleSubjectModal(
                                      rule,
                                      subjectMode === 'any' || subjectMode === 'tag' ? 'choose_object' : 'choose_state'
                                    );
                                  }}
                                  className={`w-full text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer border ${
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
                                    ? "N'importe quel objet"
                                    : subjectMode === 'tag'
                                    ? 'Filtre #Tag'
                                    : subjectMode === 'instance'
                                    ? `Instance • ${subjectStateName}`
                                    : subjectStateName}
                                </button>
                              </div>
                            </>
                          )}
                        </div>

                        {/* CASE 3: CIBLE (Seulement si Collision ou Proximité) */}
                        {isCollision && (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => openRuleTargetModal(rule, 'choose_object')}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                openRuleTargetModal(rule, 'choose_object');
                              }
                            }}
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
                              Cible
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
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRuleTargetModal(
                                    rule,
                                    targetMode === 'any' || targetMode === 'tag' ? 'choose_object' : 'choose_state'
                                  );
                                }}
                                className={`w-full text-[9px] px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer border ${
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
                                  ? "N'importe quel objet"
                                  : targetMode === 'tag'
                                  ? 'Filtre #Tag'
                                  : targetMode === 'instance'
                                  ? `Instance • ${targetStateName}`
                                  : targetStateName}
                              </button>
                            </div>
                          </div>
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
                          } else if (act.type === 'toggle_state') {
                            actionBadge = 'Basculer État';
                            const stAName = actEntity?.states[act.toggleStateAId || '']?.name || 'État A';
                            const stBName = actEntity?.states[act.toggleStateBId || '']?.name || 'État B';
                            actionDetail =
                              act.toggleMode === 'two_states' || (act.toggleStateAId && act.toggleStateBId)
                                ? `${stAName} ⇄ ${stBName}`
                                : act.toggleMode === 'current_and_target' || act.toggleTargetStateId
                                ? `Actuel ⇄ ${actEntity?.states[act.toggleTargetStateId || '']?.name || 'État'}`
                                : 'Cycle tous les états';
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
                                ? act.spawnRandomScope === 'zone'
                                  ? 'Aléatoire (Zone)'
                                  : 'Aléatoire (Canvas)'
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
                            const selectedIds =
                              act.customParticleIds && act.customParticleIds.length > 0
                                ? act.customParticleIds
                                : act.customParticleId
                                ? [act.customParticleId]
                                : [];
                            const customP =
                              selectedIds.length === 1
                                ? customParticles.find((p) => p.id === selectedIds[0])?.name
                                : selectedIds.length > 1
                                ? `${selectedIds.length} dessins`
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
                          } else if (act.type === 'move_entity') {
                            actionBadge = 'Déplacer';
                            const dist = act.moveDistance ?? 40;
                            const dirTxt =
                              act.moveDirectionMode === 'angle'
                                ? `${act.moveAngle ?? 0}°`
                                : act.moveDirectionMode === 'facing'
                                ? 'Direction regard'
                                : act.moveDirectionMode === 'toward_target'
                                ? 'Vers référence'
                                : act.moveDirectionMode === 'away_target'
                                ? 'À l’opposé'
                                : act.moveCardinal === 'left'
                                ? 'Gauche ←'
                                : act.moveCardinal === 'up'
                                ? 'Haut ↑'
                                : act.moveCardinal === 'down'
                                ? 'Bas ↓'
                                : 'Droite →';
                            actionDetail = `${dist} px • ${dirTxt}`;
                          } else if (act.type === 'play_sound') {
                            actionBadge = 'Jouer Son';
                            actionDetail = customSound ? `Son vocal : ${customSound.name}` : act.soundType ? `Son ${act.soundType}` : 'Effet sonore';
                          } else if (act.type === 'add_score') {
                            actionBadge = 'Score';
                            actionDetail = `+${act.scoreAmount || 1} point(s)`;
                          } else if (act.type === 'delay') {
                            actionBadge = 'Attendre (Pause)';
                            actionDetail = `Délai : ${act.delayDuration || 1}s`;
                          }

                          const detailSubStep: Extract<NonNullable<ActiveModal>, { type: 'action' }>['subStep'] =
                            act.type === 'change_state'
                              ? 'choose_state'
                              : act.type === 'toggle_state'
                              ? 'choose_toggle_states'
                              : act.type === 'spawn_entity'
                              ? 'choose_spawn_location'
                              : act.type === 'emit_particles'
                              ? 'choose_particles'
                              : act.type === 'attach_to_parent'
                              ? 'choose_attach_parent'
                              : act.type === 'detach_parent'
                              ? 'choose_detach_parent'
                              : act.type === 'move_entity'
                              ? 'choose_move_entity'
                              : act.type === 'play_sound'
                              ? 'choose_sound'
                              : act.type === 'delay'
                              ? 'choose_delay_duration'
                              : 'main';

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

                              <div
                                role="button"
                                tabIndex={0}
                                onClick={() => openRuleActionModal(rule, act, actIdx)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    openRuleActionModal(rule, act, actIdx);
                                  }
                                }}
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
                                ) : act.type === 'move_entity' ? (
                                  <div className="w-14 h-14 rounded-2xl bg-sky-50 border border-sky-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                    🏃
                                  </div>
                                ) : act.type === 'add_score' ? (
                                  <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                    🏆
                                  </div>
                                ) : act.type === 'play_sound' ? (
                                  <div className="relative w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-2xl shadow-2xs group-hover:scale-105 transition-transform">
                                    🔊
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePlayPreview(act.soundType, act.customSoundId);
                                      }}
                                      className="absolute -bottom-1 -right-1 bg-purple-600 text-white rounded-full p-1 shadow-xs hover:bg-purple-700 cursor-pointer"
                                      title="Écouter"
                                    >
                                      <Play className="w-2.5 h-2.5 fill-current" />
                                    </button>
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
                                      : act.type === 'add_score'
                                      ? 'Ajouter Score'
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
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openRuleActionModal(rule, act, actIdx, detailSubStep);
                                    }}
                                    className="w-full text-[9px] text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer transition-colors"
                                    title="Accès direct au réglage de cette action"
                                  >
                                    {actionDetail}
                                  </button>
                                </div>
                              </div>
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
            <span className="text-slate-500 text-[11px]">
              Règles {(validPage - 1) * RULES_PER_PAGE + 1} à {Math.min(filteredRules.length, validPage * RULES_PER_PAGE)} sur {filteredRules.length}
            </span>
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
        <RuleCreationWizardModal
          activeWizard={activeWizard}
          setActiveWizard={setActiveWizard}
          entities={entities}
          entityList={entityList}
          availableEntityOptions={availableEntityOptions}
          allProjectTags={allProjectTags}
          customSounds={customSounds}
          customParticles={customParticles}
          deleteCustomParticle={deleteCustomParticle}
          setIsSoundModalOpen={setIsSoundModalOpen}
          setParticleDrawingTarget={setParticleDrawingTarget}
          setParticleEditorContext={setParticleEditorContext}
          getEntityObj={getEntityObj}
          completeWizardWithAction={completeWizardWithAction}
        />
      )}

      {/* ========================================================================= */}
      {/* 🎯 MODALS FOR DIRECT SLOT EDITING (Grande taille, 1 clic) */}
      {/* ========================================================================= */}
      {activeModal && (
        <RuleSlotEditModal
          activeModal={activeModal}
          setActiveModal={setActiveModal}
          rules={rules}
          updateRule={updateRule}
          entities={entities}
          entityList={entityList}
          availableEntityOptions={availableEntityOptions}
          allProjectTags={allProjectTags}
          customSounds={customSounds}
          customParticles={customParticles}
          deleteCustomParticle={deleteCustomParticle}
          setIsSoundModalOpen={setIsSoundModalOpen}
          setParticleDrawingTarget={(t) => setParticleDrawingTarget(t)}
          setParticleEditorContext={setParticleEditorContext}
          getEntityObj={getEntityObj}
          openRuleSubjectModal={openRuleSubjectModal}
          openRuleTargetModal={openRuleTargetModal}
          openRuleEventModal={openRuleEventModal}
          openRuleActionModal={openRuleActionModal}
        />
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
          enableFlipbook={false}
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
              const existingIds =
                activeWizard.customParticleIds && activeWizard.customParticleIds.length > 0
                  ? activeWizard.customParticleIds
                  : activeWizard.customParticleId
                  ? [activeWizard.customParticleId]
                  : [];
              const nextIds = existingIds.includes(targetPresetId)
                ? existingIds
                : [...existingIds, targetPresetId];
              setActiveWizard({
                ...activeWizard,
                particleShape: 'custom',
                customParticleId: nextIds[0],
                customParticleIds: nextIds,
              });
            } else if (
              particleDrawingTarget.context === 'modal' &&
              activeModal &&
              activeModal.type === 'action'
            ) {
              const existingIds =
                activeModal.customParticleIds && activeModal.customParticleIds.length > 0
                  ? activeModal.customParticleIds
                  : activeModal.customParticleId
                  ? [activeModal.customParticleId]
                  : [];
              const nextIds = existingIds.includes(targetPresetId)
                ? existingIds
                : [...existingIds, targetPresetId];
              setActiveModal({
                ...activeModal,
                particleShape: 'custom',
                customParticleId: nextIds[0],
                customParticleIds: nextIds,
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
              customParticleIds: src.customParticleIds,
              customParticleMode: src.customParticleMode,
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
              const nextCustomIds =
                cfg.shape === 'custom'
                  ? cfg.customParticleIds && cfg.customParticleIds.length > 0
                    ? cfg.customParticleIds
                    : cfg.customParticleId
                    ? [cfg.customParticleId]
                    : []
                  : undefined;
              const patch = {
                particleShape: cfg.shape,
                customParticleId: cfg.shape === 'custom' ? (nextCustomIds?.[0] || cfg.customParticleId) : undefined,
                customParticleIds: nextCustomIds,
                customParticleMode: cfg.shape === 'custom' ? cfg.customParticleMode : undefined,
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
