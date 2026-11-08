import React, { useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import {
  TriggerType,
  TriggerPhase,
  ActionType,
  RuleAction,
  EntityType,
  DynamicRule,
  ActionTargetMode,
  SoundType,
  RuleFolder,
  CustomSound,
} from '../types';
import { EntityMiniPreview } from './EntityMiniPreview';
import { SpawnLocationPicker } from './SpawnLocationPicker';
import { SoundRecorderModal } from './SoundRecorderModal';
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
} from 'lucide-react';
import { soundSynth } from '../utils/sound';

type ActiveModal =
  | {
      type: 'subject';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
    }
  | {
      type: 'target';
      ruleId: string;
      subStep?: 'choose_object' | 'choose_state';
      selectedEntityType?: EntityType;
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
        | 'choose_spawn_location'
        | 'choose_sound';
      actionType?: ActionType;
      targetMode?: ActionTargetMode;
      selectedTargetType?: EntityType;
      pendingSpawnType?: EntityType;
      toggleStateA?: string;
      toggleStateB?: string;
      spawnOffset?: { x: number; y: number };
      spawnAbsoluteCoords?: { x: number; y: number };
    }
  | null;

interface WizardData {
  step: 1 | 2 | 3 | 4; // 1: Sujet, 2: Event, 3: Cible, 4: Action
  subjectSubStep?: 'choose_object' | 'choose_state';
  targetSubStep?: 'choose_object' | 'choose_state';
  actionSubStep?:
    | 'main'
    | 'state_picker'
    | 'third_party_entity_picker'
    | 'third_party_state_picker'
    | 'third_party_destroy_picker'
    | 'toggle_entity_picker'
    | 'toggle_states_picker'
    | 'spawn_entity_picker'
    | 'spawn_location_picker'
    | 'sound_picker';
  name: string;
  subjectType: EntityType;
  subjectStateId?: string;
  triggerType: TriggerType;
  triggerPhase?: TriggerPhase;
  targetType: EntityType;
  targetStateId?: string;
  actionType?: ActionType;
  actionTargetMode?: ActionTargetMode;
  actionTargetType?: EntityType;
  actionTargetStateId?: string;
  pendingSpawnType?: EntityType;
  actionSpawnEntityType?: EntityType;
  actionSpawnLocationMode?: 'at_subject' | 'at_target' | 'offset_subject' | 'offset_target' | 'random' | 'absolute';
  actionSoundType?: SoundType;
  toggleStateA?: string;
  toggleStateB?: string;
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

  const [filterType, setFilterType] = useState<'all' | 'collision' | 'click'>('all');
  const [filterObject, setFilterObject] = useState<string>('all');
  const [showFiltersManual, setShowFiltersManual] = useState(false);
  const [activeModal, setActiveModal] = useState<ActiveModal>(null);
  const [activeWizard, setActiveWizard] = useState<WizardData | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);

  // Folder & Search state
  const [selectedFolderId, setSelectedFolderId] = useState<string | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCreatingFolder, setIsCreatingFolder] = useState<boolean>(false);
  const [newFolderName, setNewFolderName] = useState<string>('');
  const [isSoundModalOpen, setIsSoundModalOpen] = useState<boolean>(false);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [collapsedRuleIds, setCollapsedRuleIds] = useState<Record<string, boolean>>({});

  const toggleCollapseRule = (id: string) => {
    setCollapsedRuleIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

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

  // Helper to find representative entity from canvas or archetype library
  const getEntityObj = (type?: string) => {
    if (!type) return undefined;
    return entityList.find((e) => e.type === type) || customArchetypes[type];
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
      subjectType: defaultSub,
      subjectStateId: undefined,
      triggerType: 'collision',
      triggerPhase: 'enter',
      targetType: defaultTar,
      targetStateId: undefined,
      actionSubStep: 'main',
    });
  };

  // Quick 1-click finalize wizard with an action
  const completeWizardWithAction = (actionData?: Partial<RuleAction>) => {
    if (!activeWizard) return;

    const isCollision = activeWizard.triggerType === 'collision';
    const actions: RuleAction[] = [];

    if (actionData && actionData.type) {
      actions.push({
        id: `act-${Date.now()}`,
        type: actionData.type,
        targetMode: actionData.targetMode || (isCollision ? 'target' : 'subject'),
        targetType: actionData.targetType || (actionData.targetMode === 'subject' ? activeWizard.subjectType : activeWizard.targetType),
        spawnLocationMode: actionData.spawnLocationMode || (isCollision ? 'at_target' : 'at_subject'),
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
        subjectMode: 'type',
        subjectType: activeWizard.subjectType,
        subjectStateId: activeWizard.subjectStateId,
        targetMode: isCollision ? 'type' : undefined,
        targetType: isCollision ? activeWizard.targetType : undefined,
        targetStateId: isCollision ? activeWizard.targetStateId : undefined,
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

    // 3. Filtres avancés optionnels (Collision / Clic / Objet)
    if (!areFiltersVisible) return true;

    if (filterType !== 'all') {
      if (filterType === 'collision' && rule.trigger.type !== 'collision') return false;
      if (filterType === 'click' && rule.trigger.type !== 'click' && rule.trigger.type !== 'drag') return false;
    }
    if (filterObject !== 'all') {
      const matchSubject = rule.trigger.subjectType === filterObject;
      const matchTarget = rule.trigger.targetType === filterObject;
      const matchAction = rule.actions.some(
        (a) => a.targetType === filterObject || a.spawnEntityType === filterObject
      );
      if (!matchSubject && !matchTarget && !matchAction) return false;
    }
    return true;
  });

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

      {/* --- FOLDER TABS BAR (Dossiers Thématiques Pliables) --- */}
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
          filteredRules.map((rule) => {
            const isCollision = rule.trigger.type === 'collision';

            // Find subject display info
            const subjectType = rule.trigger.subjectType || availableEntityOptions[0]?.type || 'apple';
            const subjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
            const subjectEntity = getEntityObj(subjectType);
            const subjectStateName = rule.trigger.subjectStateId
              ? subjectEntity?.states[rule.trigger.subjectStateId]?.name || rule.trigger.subjectStateId
              : 'Tous les états';

            // Find target display info
            const targetType = rule.trigger.targetType || availableEntityOptions[1]?.type || 'plant';
            const targetOpt = availableEntityOptions.find((o) => o.type === targetType);
            const targetEntity = getEntityObj(targetType);
            const targetStateName = rule.trigger.targetStateId
              ? targetEntity?.states[rule.trigger.targetStateId]?.name || rule.trigger.targetStateId
              : 'Tous les états';

            // Event badge info
            let eventName = 'Contact';
            let eventIcon = '💥';
            let eventSub = 'Collision (Premier contact)';
            if (rule.trigger.type === 'click') {
              eventName = 'Clic';
              eventIcon = '👆';
              eventSub = 'Sur l’objet';
              if (rule.trigger.phase === 'mouse_down') {
                eventName = 'Appui';
                eventIcon = '✋';
                eventSub = 'Bouton enfoncé';
              } else if (rule.trigger.phase === 'mouse_up') {
                eventName = 'Relâcher';
                eventIcon = '👋';
                eventSub = 'Bouton relâché';
              }
            } else if (rule.trigger.type === 'drag' || rule.trigger.phase === 'drag_release') {
              eventName = 'Relâcher';
              eventIcon = '🫳';
              eventSub = 'On Release';
            } else if (rule.trigger.type === 'collision') {
              if (rule.trigger.phase === 'collision_release') {
                eventName = 'Relâcher sur cible';
                eventIcon = '🎯';
                eventSub = 'Collision on Release';
              } else if (rule.trigger.phase === 'release') {
                eventName = 'Séparation';
                eventIcon = '💨';
                eventSub = 'Fin de contact';
              } else if (rule.trigger.phase === 'stay') {
                eventName = 'Pendant le contact';
                eventIcon = '⏳';
                eventSub = 'Contact continu';
              }
            }

            const subjectSlotKey = `${rule.id}-subject`;
            const targetSlotKey = `${rule.id}-target`;
            const isCollapsed = !!collapsedRuleIds[rule.id];

            return (
              <div
                key={rule.id}
                className={`p-3.5 sm:p-4 rounded-3xl border transition-all shadow-xs ${
                  rule.enabled
                    ? 'bg-white border-slate-200/90 hover:border-slate-300'
                    : 'bg-slate-50/70 border-slate-200/50 opacity-60'
                }`}
              >
                {/* 1. Header Bar: Accordion Toggle, Name, Folder picker, Active toggle, Duplicate, Delete */}
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2.5">
                  <div className="flex items-center gap-2 flex-wrap">
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
                      className="text-xs font-bold text-slate-800 bg-transparent hover:bg-slate-100 focus:bg-white px-2 py-1 rounded-lg border border-transparent hover:border-slate-200 focus:border-slate-300 focus:outline-none transition-colors max-w-xs"
                      placeholder="Nom de la règle..."
                    />

                    {/* Folder assignment picker */}
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
                  </div>

                  <div className="flex items-center gap-1.5">
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
                      <div className="flex items-center gap-1.5 font-bold text-slate-800">
                        <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-2xs">
                          <EntityMiniPreview entity={subjectEntity} type={subjectType} stateId={rule.trigger.subjectStateId} size={20} />
                        </div>
                        <span>{subjectOpt?.label || subjectType}</span>
                        {rule.trigger.subjectStateId && (
                          <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1 py-0.2 rounded font-medium">({subjectStateName})</span>
                        )}
                      </div>

                      <span className="text-slate-400">➔</span>

                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900 text-white font-bold text-[11px]">
                        <span>{eventIcon}</span>
                        <span>{eventName}</span>
                      </div>

                      {isCollision && (
                        <>
                          <span className="text-slate-400">➔</span>
                          <div className="flex items-center gap-1.5 font-bold text-slate-800">
                            <div className="w-6 h-6 rounded-md bg-white border border-slate-200 flex items-center justify-center p-0.5 shadow-2xs">
                              <EntityMiniPreview entity={targetEntity} type={targetType} stateId={rule.trigger.targetStateId} size={20} />
                            </div>
                            <span>{targetOpt?.label || targetType}</span>
                            {rule.trigger.targetStateId && (
                              <span className="text-[10px] text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded font-medium">({targetStateName})</span>
                            )}
                          </div>
                        </>
                      )}

                      <span className="text-indigo-500 font-bold ml-1">➔</span>

                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold bg-indigo-50 border border-indigo-200 text-indigo-700 px-2 py-0.5 rounded-full">
                          {rule.actions.length} action{rule.actions.length > 1 ? 's' : ''}
                        </span>
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
                          setActiveModal({
                            type: 'subject',
                            ruleId: rule.id,
                            subStep: 'choose_object',
                          })
                        }
                        onDragOver={(e) => {
                          e.preventDefault();
                          setDragOverSlot(subjectSlotKey);
                        }}
                        onDragLeave={() => setDragOverSlot(null)}
                        onDrop={(e) => handleDropOnSlot(e, rule.id, 'subject')}
                        className={`w-32 h-36 bg-white border rounded-2xl p-3 flex flex-col items-center justify-between shadow-xs transition-all cursor-pointer text-center group ${
                          dragOverSlot === subjectSlotKey
                            ? 'border-indigo-500 ring-4 ring-indigo-300/50 bg-indigo-50/40 scale-105'
                            : 'border-slate-200 hover:border-slate-400'
                        }`}
                        title="Cliquer pour changer l'objet ou son état requis"
                      >
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                          Sujet
                        </div>

                        <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                          <EntityMiniPreview
                            entity={subjectEntity}
                            type={subjectType}
                            stateId={rule.trigger.subjectStateId}
                            size={48}
                          />
                        </div>

                        <div className="w-full">
                          <div className="text-xs font-bold text-slate-800 truncate">
                            {subjectOpt?.label || subjectType}
                          </div>
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveModal({
                                type: 'subject',
                                ruleId: rule.id,
                                subStep: 'choose_state',
                                selectedEntityType: subjectType,
                              });
                            }}
                            className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer"
                            title="Cliquer pour changer l'état requis"
                          >
                            {subjectStateName}
                          </div>
                        </div>
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
                          <div className="text-[9px] text-slate-400 truncate mt-0.5">
                            {eventSub}
                          </div>
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
                          title="Cliquer pour changer la cible ou son état requis"
                        >
                          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider group-hover:text-indigo-600">
                            Cible touchée
                          </div>

                          <div className="w-14 h-14 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center p-1 shadow-2xs group-hover:scale-105 transition-transform">
                            <EntityMiniPreview
                              entity={targetEntity}
                              type={targetType}
                              stateId={rule.trigger.targetStateId}
                              size={48}
                            />
                          </div>

                          <div className="w-full">
                            <div className="text-xs font-bold text-slate-800 truncate">
                              {targetOpt?.label || targetType}
                            </div>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveModal({
                                  type: 'target',
                                  ruleId: rule.id,
                                  subStep: 'choose_state',
                                  selectedEntityType: targetType,
                                });
                              }}
                              className="text-[9px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200/60 px-1.5 py-0.5 rounded-md font-bold truncate mt-0.5 cursor-pointer"
                              title="Cliquer pour changer l'état requis de la cible"
                            >
                              {targetStateName}
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
                              : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                          actionDetail = `${targetLabel} → ${actStateObj?.name || 'État ' + (act.targetStateId || '...')}`;
                        } else if (act.type === 'delete_entity') {
                          actionBadge = 'Détruire';
                          const targetLabel =
                            act.targetMode === 'subject'
                              ? `Sujet (${subjectOpt?.label || subjectType})`
                              : act.targetMode === 'target'
                              ? `Cible (${targetOpt?.label || targetType})`
                              : getEntityObj(act.targetType)?.name || act.targetType || 'Objet';
                          actionDetail = `Supprimer ${targetLabel}`;
                        } else if (act.type === 'spawn_entity') {
                          actionBadge = 'Créer Entité';
                          const locLabel =
                            act.spawnLocationMode === 'at_target'
                              ? 'Sur Cible'
                              : act.spawnLocationMode === 'at_subject'
                              ? 'Sur Sujet'
                              : act.spawnLocationMode === 'random'
                              ? 'Aléatoire'
                              : act.spawnLocationMode?.startsWith('offset')
                              ? 'Décalé'
                              : 'Fixe';
                          actionDetail = `+ ${act.spawnEntityType || 'Objet'} • ${locLabel}`;
                        } else if (act.type === 'play_sound') {
                          actionBadge = 'Jouer Son';
                          actionDetail = customSound ? `Son vocal : ${customSound.name}` : act.soundType ? `Son ${act.soundType}` : 'Effet sonore';
                        } else if (act.type === 'toggle_state') {
                          actionBadge = 'Basculer État';
                          actionDetail = 'Alterner ou cycler';
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
                                  subStep: 'main',
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
                                    size={44}
                                  />
                                  <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white rounded-full p-0.5 shadow-xs text-[10px]">
                                    ✨
                                  </div>
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
                                    : act.type === 'play_sound'
                                    ? customSound?.name || `Son ${act.soundType || ''}`
                                    : act.targetMode === 'subject'
                                    ? `Sujet (${subjectOpt?.label || 'Objet'})`
                                    : act.targetMode === 'target'
                                    ? `Cible (${targetOpt?.label || 'Objet'})`
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
            );
          })
        )}
      </div>

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
              {/* ÉTAPE 1 : SUJET (Grandes Cartes) */}
              {activeWizard.step === 1 && (
                <div>
                  {activeWizard.subjectSubStep === 'choose_state' ? (
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
                                  subjectType: opt.type,
                                  subjectSubStep: 'choose_state',
                                });
                              } else {
                                setActiveWizard({
                                  ...activeWizard,
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

              {/* ÉTAPE 2 : ÉVÉNEMENT (Grandes Cartes) */}
              {activeWizard.step === 2 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Collision Contact */}
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
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      💥
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Collision (Contact Immédiat)
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Dès que le sujet touche une cible spécifique
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
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      🎯
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Au Relâchement sur Cible
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le joueur glisse et lâche le sujet sur la cible
                      </div>
                    </div>
                  </button>

                  {/* Clic Direct */}
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
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      👆
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Clic Souris / Pointeur
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le joueur clique directement sur le sujet
                      </div>
                    </div>
                  </button>

                  {/* Glisser Relâcher Libre (Drop) */}
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
                    className="p-5 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs hover:shadow-md group active:scale-95"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-3xl shadow-2xs group-hover:scale-110 transition-transform shrink-0">
                      🫳
                    </div>
                    <div>
                      <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                        Relâcher dans le vide (Drop)
                      </div>
                      <div className="text-xs text-slate-500 mt-1">
                        Quand le sujet est relâché n'importe où
                      </div>
                    </div>
                  </button>
                </div>
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
                                  targetType: opt.type,
                                  targetSubStep: 'choose_state',
                                });
                              } else {
                                setActiveWizard({
                                  ...activeWizard,
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
                        Choisissez quel autre objet vous souhaitez détruire :
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

                    return (
                      <div className="space-y-4">
                        <div className="text-xs font-bold text-slate-600">
                          Comment faire basculer {ent?.name || relevantType} ?
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                          {/* Option 1: Cycler tous les états */}
                          <button
                            type="button"
                            onClick={() => {
                              completeWizardWithAction({
                                type: 'toggle_state',
                                targetMode: 'type',
                                targetType: relevantType,
                              });
                            }}
                            className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                          >
                            <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                              🔄
                            </div>
                            <div>
                              <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                Cycler entre tous les états ({states.length} états)
                              </div>
                              <div className="text-[11px] text-slate-500 mt-0.5">
                                Passe au suivant séquentiellement à chaque événement
                              </div>
                            </div>
                          </button>

                          {/* Option 2: Basculer spécifiquement entre État 1 et État 2 */}
                          {states.length >= 2 && (
                            <button
                              type="button"
                              onClick={() => {
                                completeWizardWithAction({
                                  type: 'toggle_state',
                                  targetMode: 'type',
                                  targetType: relevantType,
                                  toggleStateAId: states[0].id,
                                  toggleStateBId: states[1].id,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                ⇄
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                  Basculer : {states[0].name} ⇄ {states[1].name}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Aller-retour binaire entre ces 2 états
                                </div>
                              </div>
                            </button>
                          )}
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
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                setActiveWizard({
                                  ...activeWizard,
                                  pendingSpawnType: opt.type,
                                  actionSubStep: 'spawn_location_picker',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                + {opt.label}
                              </div>
                            </button>
                          );
                        })}
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
                        onConfirm={(data) => {
                          completeWizardWithAction({
                            type: 'spawn_entity',
                            spawnEntityType: activeWizard.pendingSpawnType,
                            spawnLocationMode: data.spawnLocationMode,
                            spawnOffset: data.spawnOffset,
                            spawnPosition: data.spawnPosition,
                            spawnAbsoluteCoords: data.spawnAbsoluteCoords,
                            spawnSizeMode: data.spawnSizeMode,
                            spawnScaleMultiplier: data.spawnScaleMultiplier,
                            spawnCustomSize: data.spawnCustomSize,
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
                                subjectType: relevantType,
                                subjectStateId: undefined,
                              },
                            });
                          } else {
                            updateRule(rule.id, {
                              trigger: {
                                ...rule.trigger,
                                targetType: relevantType,
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
                                  subjectType: relevantType,
                                  subjectStateId: st.id,
                                },
                              });
                            } else {
                              updateRule(rule.id, {
                                trigger: {
                                  ...rule.trigger,
                                  targetType: relevantType,
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5 overflow-y-auto pr-1 flex-1 py-1">
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
                                  selectedEntityType: opt.type,
                                });
                              } else {
                                if (isSubject) {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      subjectType: opt.type,
                                      subjectStateId: undefined,
                                    },
                                  });
                                } else {
                                  updateRule(rule.id, {
                                    trigger: {
                                      ...rule.trigger,
                                      targetType: opt.type,
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

                  <div className="space-y-3 overflow-y-auto pr-1 flex-1 py-1">
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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        💥
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Collision (Premier Contact)
                        </div>
                        <div className="text-xs text-slate-500">Quand le sujet touche une cible</div>
                      </div>
                    </button>

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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        🎯
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Collision au Relâchement
                        </div>
                        <div className="text-xs text-slate-500">Quand le sujet est lâché sur la cible touchée</div>
                      </div>
                    </button>

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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        👆
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Clic Direct sur le Sujet
                        </div>
                        <div className="text-xs text-slate-500">Quand l'utilisateur clique sur l'objet</div>
                      </div>
                    </button>

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
                      className="w-full p-4 bg-slate-50 hover:bg-indigo-50 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl flex items-center gap-4 text-left cursor-pointer transition-all shadow-xs group active:scale-98"
                    >
                      <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center text-2xl shrink-0 shadow-2xs group-hover:scale-110 transition-transform">
                        🫳
                      </div>
                      <div>
                        <div className="text-sm font-black text-slate-900 group-hover:text-indigo-700">
                          Relâcher dans le vide (Drop)
                        </div>
                        <div className="text-xs text-slate-500">Quand l'objet est relâché n'importe où</div>
                      </div>
                    </button>
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
                          onClick={() => setActiveModal({ ...activeModal, subStep: 'main' })}
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
                      const modalSubjectEntity = getEntityObj(subjectType);
                      const modalSubjectOpt = availableEntityOptions.find((o) => o.type === subjectType);
                      const modalSubjectName = modalSubjectEntity?.name || modalSubjectOpt?.label || subjectType;

                      const modalTargetEntity = getEntityObj(targetType);
                      const modalTargetOpt = availableEntityOptions.find((o) => o.type === targetType);
                      const modalTargetName = modalTargetEntity?.name || modalTargetOpt?.label || targetType;

                      return (
                        <div className={`grid grid-cols-1 ${isCollision ? 'lg:grid-cols-3 md:grid-cols-2' : 'md:grid-cols-2'} gap-4 items-start`}>
                          {/* SECTION 1 : SUJET */}
                          <div className="space-y-3 bg-slate-50/80 p-3.5 rounded-3xl border border-slate-200/90 flex flex-col h-full shadow-2xs">
                            {/* En-tête Sujet avec miniature et nom de l'entité */}
                            <div className="flex items-center gap-2.5 p-2.5 rounded-2xl bg-indigo-50 border border-indigo-200/80 shadow-2xs">
                              <div className="w-10 h-10 rounded-xl bg-white border border-indigo-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                                <EntityMiniPreview
                                  entity={modalSubjectEntity}
                                  type={subjectType}
                                  stateId={rule.trigger.subjectStateId}
                                  size={36}
                                />
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
                                <div className="w-10 h-10 rounded-xl bg-white border border-emerald-200 flex items-center justify-center p-1 shadow-2xs shrink-0">
                                  <EntityMiniPreview
                                    entity={modalTargetEntity}
                                    type={targetType}
                                    stateId={rule.trigger.targetStateId}
                                    size={36}
                                  />
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
                          Cliquez sur l'objet à détruire / faire disparaître de la scène :
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

                      return (
                        <div className="space-y-4">
                          <div className="text-xs font-bold text-slate-600">
                            Comment faire basculer {ent?.name || relevantType} ?
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            {/* Option 1: Cycler tous les états */}
                            <button
                              type="button"
                              onClick={() => {
                                applyAction({
                                  type: 'toggle_state',
                                  targetMode: 'type',
                                  targetType: relevantType,
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                🔄
                              </div>
                              <div>
                                <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                  Cycler entre tous les états
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  Passe au suivant à chaque événement
                                </div>
                              </div>
                            </button>

                            {/* Option 2: Basculer spécifiquement entre État 1 et État 2 */}
                            {states.length >= 2 && (
                              <button
                                type="button"
                                onClick={() => {
                                  applyAction({
                                    type: 'toggle_state',
                                    targetMode: 'type',
                                    targetType: relevantType,
                                    toggleStateAId: states[0].id,
                                    toggleStateBId: states[1].id,
                                  });
                                }}
                                className="p-4 bg-slate-50 hover:bg-violet-50 border-2 border-slate-200 hover:border-violet-500 rounded-3xl flex items-center gap-3.5 text-left cursor-pointer transition-all shadow-xs group active:scale-95"
                              >
                                <div className="w-14 h-14 rounded-2xl bg-violet-100 text-violet-700 flex items-center justify-center text-2xl shrink-0 group-hover:scale-110 transition-transform">
                                  ⇄
                                </div>
                                <div>
                                  <div className="text-xs font-black text-slate-900 group-hover:text-violet-700">
                                    Basculer : {states[0].name} ⇄ {states[1].name}
                                  </div>
                                  <div className="text-[11px] text-slate-500 mt-0.5">
                                    Aller-retour binaire entre 2 états
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Choix d'objet à spawner */}
                    {activeModal.subStep === 'choose_spawn_entity' && (
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
                        {availableEntityOptions.map((opt) => {
                          const ent = getEntityObj(opt.type);
                          return (
                            <button
                              key={opt.type}
                              type="button"
                              onClick={() => {
                                setActiveModal({
                                  ...activeModal,
                                  pendingSpawnType: opt.type,
                                  subStep: 'choose_spawn_location',
                                });
                              }}
                              className="p-4 bg-slate-50 hover:bg-amber-50 border-2 border-slate-200 hover:border-amber-500 rounded-3xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-all shadow-xs group active:scale-95"
                            >
                              <div className="w-16 h-16 rounded-2xl bg-white border border-slate-200 flex items-center justify-center p-1.5 shadow-2xs group-hover:scale-110 transition-transform">
                                <EntityMiniPreview entity={ent} type={opt.type} size={52} />
                              </div>
                              <div className="text-xs font-black text-slate-800 group-hover:text-amber-700 truncate w-full text-center">
                                + {opt.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    {/* Choix de l'emplacement de spawn avec SpawnLocationPicker */}
                    {activeModal.subStep === 'choose_spawn_location' && (
                      <div className="space-y-3">
                        <div className="text-xs font-bold text-slate-600">
                          Où faire apparaître {getEntityObj(activeModal.pendingSpawnType)?.name || activeModal.pendingSpawnType} ?
                        </div>
                        <SpawnLocationPicker
                          isCollision={isCollision}
                          subjectEntity={getEntityObj(subjectType)}
                          targetEntity={getEntityObj(targetType)}
                          spawnEntity={getEntityObj(activeModal.pendingSpawnType)}
                          initialMode={isCollision ? 'at_target' : 'at_subject'}
                          onConfirm={(data) => {
                            applyAction({
                              type: 'spawn_entity',
                              spawnEntityType: activeModal.pendingSpawnType,
                              spawnLocationMode: data.spawnLocationMode,
                              spawnOffset: data.spawnOffset,
                              spawnPosition: data.spawnPosition,
                              spawnAbsoluteCoords: data.spawnAbsoluteCoords,
                              spawnSizeMode: data.spawnSizeMode,
                              spawnScaleMultiplier: data.spawnScaleMultiplier,
                              spawnCustomSize: data.spawnCustomSize,
                            });
                          }}
                          onCancel={() => {
                            setActiveModal({ ...activeModal, subStep: 'choose_spawn_entity' });
                          }}
                        />
                      </div>
                    )}

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
    </div>
  );
}
