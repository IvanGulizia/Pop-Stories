import React, { useState } from 'react';
import {
  Entity,
  EntityBehavior,
  BehaviorType,
  PhysicsBehaviorConfig,
  DraggableBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  LookAtBehaviorConfig,
  FollowBehaviorConfig,
  MoveToBehaviorConfig,
  PatrolBehaviorConfig,
  WanderingBehaviorConfig,
  KeyboardControlBehaviorConfig,
  BoundaryBehaviorConfig,
  BehaviorOverride,
  AutoDestroyBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  FleeBehaviorConfig,
  HealthBehaviorConfig,
  EntityState,
  ParticleShape,
  CustomParticlePreset,
  CustomParticleUsageMode,
} from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { ParticleEditorModal } from './ParticleEditorModal';
import { invalidateCustomParticleSprite } from '../utils/particleSystem';
import {
  Activity,
  Hand,
  ArrowRight,
  Repeat,
  Compass,
  Move,
  Gamepad2,
  Shield,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Layers,
  Sparkles,
  Undo2,
  X,
  Clock,
  RotateCcw,
  Shuffle,
  Paintbrush,
  Pencil,
  Wind,
  Sliders,
  Heart,
} from 'lucide-react';

interface BehaviorManagerProps {
  entity: Entity;
  selectedStateId?: string;
}

export function BehaviorManager({ entity, selectedStateId }: BehaviorManagerProps) {
  const updateEntityBehaviors = useSceneStore((state) => state.updateEntityBehaviors);
  const updateStateBehaviorOverride = useSceneStore((state) => state.updateStateBehaviorOverride);
  const removeStateBehaviorOverride = useSceneStore((state) => state.removeStateBehaviorOverride);
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes);
  const rules = useSceneStore((state) => state.rules);
  const layerGroups = useSceneStore((state) => state.layerGroups || []);
  const customParticles = useSceneStore((state) => state.customParticles || []);
  const addCustomParticle = useSceneStore((state) => state.addCustomParticle);
  const updateCustomParticle = useSceneStore((state) => state.updateCustomParticle);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);

  const baseBehaviors = entity.behaviors || [];
  const stateList = Object.values(entity.states);

  const [activeStateId, setActiveStateId] = useState<string>(
    selectedStateId || entity.currentStateId
  );
  const [expandedBehaviorId, setExpandedBehaviorId] = useState<string | null>(baseBehaviors[0]?.id || null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [particleDrawerState, setParticleDrawerState] = useState<{
    behaviorId: string;
    isOverridden: boolean;
    editingPreset?: CustomParticlePreset;
  } | null>(null);
  const [particleEditorState, setParticleEditorState] = useState<{
    behaviorId: string;
    isOverridden: boolean;
  } | null>(null);

  // Sync with selectedStateId if it changes from parent Inspector
  React.useEffect(() => {
    if (selectedStateId && entity.states[selectedStateId]) {
      setActiveStateId(selectedStateId);
    }
  }, [selectedStateId, entity.states]);

  const targetState = entity.states[activeStateId] || stateList[0];
  const targetEntityOptions = Object.values(entities).filter((e) => e.id !== entity.id);

  // Options dynamiques de Types et de Tags pour les comportements autonomes (Piste D)
  const entityTypeOptions = React.useMemo(() => {
    const map = new Map<string, string>();
    Object.values(entities).forEach((e) => {
      if (!map.has(e.type)) {
        map.set(e.type, e.name.replace(/\s+\d+$/, ''));
      }
    });
    Object.values(customArchetypes || {}).forEach((arch) => {
      if (!map.has(arch.type)) {
        map.set(arch.type, arch.name);
      }
    });
    return Array.from(map.entries()).map(([type, label]) => ({ type, label }));
  }, [entities, customArchetypes]);

  const availableTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(entities).forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    (rules || []).forEach((r) => {
      if (r.trigger?.subjectTag) tagSet.add(r.trigger.subjectTag);
      if (r.trigger?.targetTag) tagSet.add(r.trigger.targetTag);
      r.actions.forEach((a) => {
        if (a.targetTag) tagSet.add(a.targetTag);
        a.spawnTags?.forEach((t) => tagSet.add(t));
      });
    });
    (layerGroups || []).forEach((g) => {
      (g.layers || []).forEach((l) => {
        l.colliderTags?.forEach((t) => tagSet.add(t));
      });
    });
    return Array.from(tagSet);
  }, [entities, rules, layerGroups]);

  const generateBehaviorId = (type: BehaviorType) => {
    return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  };

  const handleAddBehavior = (type: BehaviorType) => {
    let newBehavior: EntityBehavior;

    switch (type) {
      case 'draggable':
        newBehavior = {
          id: generateBehaviorId('draggable'),
          type: 'draggable',
          enabled: true,
          throwable: true,
          maxThrowSpeed: 1500,
        } as DraggableBehaviorConfig;
        break;
      case 'physics':
        newBehavior = {
          id: generateBehaviorId('physics'),
          type: 'physics',
          enabled: true,
          isTrigger: false,
          isStatic: false,
          gravity: 400,
          bounce: 0.4,
          friction: 0.6,
          frictionStatic: 0.5,
          frictionAir: 0.015,
          mass: 1,
          freezeRotation: false,
        } as PhysicsBehaviorConfig;
        break;
      case 'auto_destroy':
        newBehavior = {
          id: generateBehaviorId('auto_destroy'),
          type: 'auto_destroy',
          enabled: true,
          delay: 3,
        } as AutoDestroyBehaviorConfig;
        break;
      case 'constant_velocity':
        newBehavior = {
          id: generateBehaviorId('constant_velocity'),
          type: 'constant_velocity',
          enabled: true,
          vx: 80,
          vy: 0,
          angularVelocity: 0,
        } as ConstantVelocityBehaviorConfig;
        break;
      case 'look_at':
        newBehavior = {
          id: generateBehaviorId('look_at'),
          type: 'look_at',
          enabled: true,
          targetType: 'mouse',
          rotationOffset: 0,
          smoothSpeed: 0,
        } as LookAtBehaviorConfig;
        break;
      case 'follow':
        newBehavior = {
          id: generateBehaviorId('follow'),
          type: 'follow',
          enabled: true,
          targetType: 'mouse',
          speed: 120,
          minDistance: 40,
        } as FollowBehaviorConfig;
        break;
      case 'move_to':
        newBehavior = {
          id: generateBehaviorId('move_to'),
          type: 'move_to',
          enabled: true,
          targetType: 'position',
          targetPosition: { x: 200, y: 200 },
          speed: 100,
        } as MoveToBehaviorConfig;
        break;
      case 'patrol':
        newBehavior = {
          id: generateBehaviorId('patrol'),
          type: 'patrol',
          enabled: true,
          axis: 'horizontal',
          range: 120,
          speed: 100,
          pauseDuration: 0.5,
        } as PatrolBehaviorConfig;
        break;
      case 'wandering':
        newBehavior = {
          id: generateBehaviorId('wandering'),
          type: 'wandering',
          enabled: true,
          mode: 'free_2d',
          radius: 160,
          speed: 90,
          randomness: 65,
          changeInterval: 1.5,
          pauseDuration: 0.8,
          orientToMovement: false,
        } as WanderingBehaviorConfig;
        break;
      case 'flee':
        newBehavior = {
          id: generateBehaviorId('flee'),
          type: 'flee',
          enabled: true,
          targetType: 'mouse',
          speed: 160,
          fleeRadius: 220,
          axisMode: 'free_2d',
          acceleration: 0.35,
          damping: 0.85,
          flipOnMove: false,
        } as FleeBehaviorConfig;
        break;
      case 'keyboard_control':
        newBehavior = {
          id: generateBehaviorId('keyboard_control'),
          type: 'keyboard_control',
          enabled: true,
          layout: 'both',
          speed: 180,
          mode: 'top_down',
          jumpForce: 450,
          allowHorizontal: true,
          allowVertical: true,
          allowJump: true,
        } as KeyboardControlBehaviorConfig;
        break;
      case 'boundary_behavior':
        newBehavior = {
          id: generateBehaviorId('boundary_behavior'),
          type: 'boundary_behavior',
          enabled: true,
          mode: 'bounce',
          bounciness: 0.8,
        } as BoundaryBehaviorConfig;
        break;
      case 'particle_emitter':
        newBehavior = {
          id: generateBehaviorId('particle_emitter'),
          type: 'particle_emitter',
          enabled: true,
          rate: 14,
          color: '#f59e0b',
          color2: '#ef4444',
          shape: 'circle',
          speed: 140,
          size: 6,
          lifetime: 0.8,
          gravity: 160,
          spread: 60,
          angle: -90,
          offsetX: 0,
          offsetY: 0,
        } as ParticleEmitterBehaviorConfig;
        break;
      case 'health':
        newBehavior = {
          id: generateBehaviorId('health'),
          type: 'health',
          enabled: true,
          maxHp: 3,
          damageTag: 'danger',
          damageCooldown: 1.0,
          knockbackForce: 220,
          showHealthBar: true,
          onDeath: 'destroy',
        } as HealthBehaviorConfig;
        break;
    }

    const updated = [...baseBehaviors, newBehavior];
    updateEntityBehaviors(entity.id, updated);
    setExpandedBehaviorId(newBehavior.id);
    setIsAddModalOpen(false);
  };

  const handleDeleteBehavior = (behaviorId: string) => {
    const updated = baseBehaviors.filter((b) => b.id !== behaviorId);
    updateEntityBehaviors(entity.id, updated);
    if (expandedBehaviorId === behaviorId) setExpandedBehaviorId(null);
  };

  const handleUpdateBaseBehavior = (behaviorId: string, partial: Partial<EntityBehavior>) => {
    const updated = baseBehaviors.map((b) => {
      if (b.id === behaviorId) {
        return { ...b, ...partial } as EntityBehavior;
      }
      return b;
    });
    updateEntityBehaviors(entity.id, updated);
  };

  const handleToggleOverride = (behavior: EntityBehavior) => {
    if (!targetState) return;
    const currentOverride = targetState.behaviorOverrides?.[behavior.id];
    if (currentOverride) {
      // Annuler l'override et revenir au composant partagé
      removeStateBehaviorOverride(entity.id, targetState.id, behavior.id);
    } else {
      // Cloner la configuration actuelle dans l'override de cet état
      updateStateBehaviorOverride(entity.id, targetState.id, behavior.id, {
        ...JSON.parse(JSON.stringify(behavior)),
      });
    }
  };

  const handleUpdateOverride = (behaviorId: string, partial: BehaviorOverride) => {
    if (!targetState) return;
    updateStateBehaviorOverride(entity.id, targetState.id, behaviorId, partial);
  };

  const getBehaviorIcon = (type: BehaviorType) => {
    switch (type) {
      case 'draggable':
        return <Hand className="w-4 h-4 text-indigo-600" />;
      case 'physics':
        return <Activity className="w-4 h-4 text-emerald-600" />;
      case 'constant_velocity':
        return <ArrowRight className="w-4 h-4 text-cyan-600" />;
      case 'look_at':
        return <Compass className="w-4 h-4 text-indigo-600" />;
      case 'follow':
        return <Move className="w-4 h-4 text-violet-600" />;
      case 'move_to':
        return <Move className="w-4 h-4 text-amber-600" />;
      case 'patrol':
        return <Repeat className="w-4 h-4 text-blue-600" />;
      case 'wandering':
        return <Shuffle className="w-4 h-4 text-emerald-600" />;
      case 'flee':
        return <Wind className="w-4 h-4 text-rose-500" />;
      case 'keyboard_control':
        return <Gamepad2 className="w-4 h-4 text-rose-600" />;
      case 'boundary_behavior':
        return <Shield className="w-4 h-4 text-teal-600" />;
      case 'auto_destroy':
        return <Clock className="w-4 h-4 text-orange-600" />;
      case 'particle_emitter':
        return <Sparkles className="w-4 h-4 text-amber-500" />;
      case 'health':
        return <Heart className="w-4 h-4 text-rose-500" />;
    }
  };

  const getBehaviorTitle = (type: BehaviorType) => {
    switch (type) {
      case 'draggable':
        return 'Déplaçable à la souris';
      case 'physics':
        return 'Physique & Gravité';
      case 'auto_destroy':
        return 'Autodestruction (Lifespan)';
      case 'constant_velocity':
        return 'Vitesse Continue';
      case 'look_at':
        return 'Orientation (Look At)';
      case 'follow':
        return 'Suivre (Follow)';
      case 'move_to':
        return 'Aller vers (Move To)';
      case 'patrol':
        return 'Patrouille';
      case 'wandering':
        return 'Balade Aléatoire (Wandering)';
      case 'flee':
        return 'Fuir (Flee)';
      case 'keyboard_control':
        return 'Contrôles Joueur';
      case 'boundary_behavior':
        return 'Bords de Scène';
      case 'particle_emitter':
        return 'Émetteur de Particules';
      case 'health':
        return 'Santé & Dégâts';
    }
  };

  return (
    <div className="space-y-3">
      {/* En-tête de section */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
          <Activity className="w-4 h-4 text-indigo-600" />
          <span>Composants & Physique</span>
        </div>

        <button
          type="button"
          onClick={() => setIsAddModalOpen(true)}
          className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 cursor-pointer shadow-2xs transition-all active:scale-95"
          title="Ajouter un composant à cet objet"
        >
          <Plus className="w-3.5 h-3.5" /> Ajouter
        </button>
      </div>

      {/* Sélecteur d'état inspecté si plusieurs états existent */}
      {stateList.length > 1 && (
        <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1.5 overflow-x-auto scrollbar-thin">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1 shrink-0">
            État inspecté :
          </span>
          {stateList.map((st) => {
            const isTarget = st.id === activeStateId;
            const overrideCount = st.behaviorOverrides ? Object.keys(st.behaviorOverrides).length : 0;
            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setActiveStateId(st.id)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap cursor-pointer flex items-center gap-1 ${
                  isTarget
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                }`}
              >
                <span>{st.name}</span>
                {overrideCount > 0 && (
                  <span className={`text-[9px] px-1 rounded-full ${isTarget ? 'bg-indigo-400 text-white' : 'bg-amber-100 text-amber-800'}`}>
                    {overrideCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Liste des Composants attachés */}
      {baseBehaviors.length > 0 && (
        <div className="space-y-2">
          {baseBehaviors.map((behavior) => {
            const isExpanded = expandedBehaviorId === behavior.id;
            const overrides = targetState?.behaviorOverrides || {};
            const override = overrides[behavior.id];
            const hasOverride = Boolean(override);

            const isEffectiveEnabled = hasOverride && override?.enabled !== undefined
              ? override.enabled
              : behavior.enabled;

            return (
              <div
                key={behavior.id}
                className={`bg-white rounded-2xl border transition-all shadow-2xs overflow-hidden ${
                  hasOverride
                    ? 'border-amber-300 ring-2 ring-amber-100/80'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                {/* Carte En-tête */}
                <div
                  onClick={() => setExpandedBehaviorId(isExpanded ? null : behavior.id)}
                  className="p-2.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <button
                      type="button"
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      {isExpanded ? (
                        <ChevronDown className="w-4 h-4" />
                      ) : (
                        <ChevronRight className="w-4 h-4" />
                      )}
                    </button>
                    <div className="w-7 h-7 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
                      {getBehaviorIcon(behavior.type)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
                        <span>{getBehaviorTitle(behavior.type)}</span>
                      </div>
                      <div className="text-[10px] text-slate-400 flex items-center gap-1 truncate">
                        {hasOverride ? (
                          <span className="text-amber-700 font-semibold flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5 text-amber-500" /> Override {targetState?.name}
                          </span>
                        ) : (
                          <span className="text-slate-400">Partagé</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {/* Toggle activation on/off */}
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isEffectiveEnabled}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          if (hasOverride) {
                            handleUpdateOverride(behavior.id, { enabled: checked });
                          } else {
                            handleUpdateBaseBehavior(behavior.id, { enabled: checked });
                          }
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-8 h-4 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-3 after:w-3.5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </label>

                    {/* Supprimer le composant de l'entité */}
                    <button
                      type="button"
                      onClick={() => handleDeleteBehavior(behavior.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                      title="Supprimer ce composant"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Tiroir de Réglages du Composant */}
                {isExpanded && (
                  <div className="px-3 pb-3 pt-1 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                    {/* Ligne dédiée : Mention et action d'Override (Point 2) */}
                    <div
                      className={`p-2 rounded-xl flex items-center justify-between text-xs border ${
                        hasOverride
                          ? 'bg-amber-50 border-amber-300 text-amber-950 shadow-2xs'
                          : 'bg-slate-100/80 border-slate-200 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        {hasOverride ? (
                          <>
                            <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                            <span className="truncate">
                              <strong className="text-amber-950 font-bold">Override actif</strong> pour l'état{' '}
                              <strong className="text-amber-800 underline decoration-amber-400">
                                {targetState?.name}
                              </strong>
                            </span>
                          </>
                        ) : (
                          <>
                            <Layers className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate text-slate-600">Valeur partagée (tous les états)</span>
                          </>
                        )}
                      </div>

                      {stateList.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleToggleOverride(behavior)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0 ml-2 ${
                            hasOverride
                              ? 'bg-amber-200 hover:bg-amber-300 text-amber-950 border border-amber-300 shadow-2xs'
                              : 'bg-white hover:bg-indigo-50 text-slate-700 hover:text-indigo-600 border border-slate-300 shadow-2xs'
                          }`}
                          title={
                            hasOverride
                              ? `Annuler l'override pour l'état ${targetState?.name} (revenir au composant partagé)`
                              : `Créer un override spécifique pour l'état ${targetState?.name}`
                          }
                        >
                          {hasOverride ? (
                            <>
                              <Undo2 className="w-3 h-3 text-amber-800" />
                              <span>Annuler l'override</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3 h-3 text-indigo-500" />
                              <span>Créer un override</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    {/* Formulaire des attributs empilés ligne par ligne (Point 1 - Style Unity Inspector) */}
                    {renderBehaviorControls({
                      behavior,
                      override,
                      isOverridden: hasOverride,
                      onUpdateBase: (partial) => handleUpdateBaseBehavior(behavior.id, partial),
                      onUpdateOverride: (partial) => handleUpdateOverride(behavior.id, partial),
                      targetEntityOptions,
                      entityTypeOptions,
                      availableTags,
                      stateList,
                      customParticles,
                      onOpenParticleDrawer: (editingPreset) =>
                        setParticleDrawerState({
                          behaviorId: behavior.id,
                          isOverridden: hasOverride,
                          editingPreset,
                        }),
                      onOpenParticleEditor: () =>
                        setParticleEditorState({
                          behaviorId: behavior.id,
                          isOverridden: hasOverride,
                        }),
                      onDeleteCustomParticle: (presetId) => {
                        deleteCustomParticle(presetId);
                        invalidateCustomParticleSprite(presetId);
                      },
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modal / Sélecteur d'Ajout de Composant */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
                  <Plus className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 text-sm">Ajouter un composant</h3>
                  <p className="text-[11px] text-slate-500">Comportements et physique pour cet objet</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 max-h-[70vh] overflow-y-auto space-y-4">
              {/* Catégorie 1: Manipulation à la Souris */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Manipulation à la Souris
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('draggable')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Hand className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Déplaçable à la souris (Drag & Throw)</div>
                    <div className="text-[11px] text-slate-500">Permet d'attraper l'objet et de le projeter avec élan et inertie.</div>
                  </div>
                </button>
              </div>

              {/* Catégorie 2: Bords de scène */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Bords de Scène
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('boundary_behavior')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-teal-400 hover:bg-teal-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-teal-100 text-teal-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Gestion des Bords de Scène</div>
                    <div className="text-[11px] text-slate-500">Rebond élastique, téléportation (Wrap) ou butée infranchissable.</div>
                  </div>
                </button>
              </div>

              {/* Catégorie 3: Contrôles Joueur */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Contrôles Joueur
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('keyboard_control')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Gamepad2 className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Contrôles Clavier (Flèches / ZQSD)</div>
                    <div className="text-[11px] text-slate-500">Pilotage direct en vue de dessus ou mode plateforme avec saut.</div>
                  </div>
                </button>
              </div>

              {/* Catégorie 4: Physique & Vitesse */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Physique & Vitesse
                </span>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddBehavior('physics')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Activity className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Gravité & Chute (RigidBody 2D)</div>
                      <div className="text-[11px] text-slate-500">Masse, rebond élastique, obstacle fixe ou capteur trigger.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('constant_velocity')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-cyan-400 hover:bg-cyan-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-cyan-100 text-cyan-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <ArrowRight className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Vitesse Continue (Projectile & Rotation)</div>
                      <div className="text-[11px] text-slate-500">Propulsion vectorielle et rotation angulaire constante.</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Catégorie 5: Déplacements autonomes */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Déplacements Autonomes & Visée
                </span>
                <div className="space-y-1.5">
                  <button
                    type="button"
                    onClick={() => handleAddBehavior('patrol')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Repeat className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Patrouille (Va-et-vient)</div>
                      <div className="text-[11px] text-slate-500">Mouvement oscillatoire horizontal ou vertical avec pause.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('wandering')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-emerald-400 hover:bg-emerald-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Shuffle className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Balade Aléatoire (Wandering)</div>
                      <div className="text-[11px] text-slate-500">Déplacement autonome et organique dans une zone paramétrable.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('move_to')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Move className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Aller vers (Move To)</div>
                      <div className="text-[11px] text-slate-500">Ralliement automatique d'une coordonnée ou d'une autre entité.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('look_at')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-indigo-400 hover:bg-indigo-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Compass className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Orientation (Look At)</div>
                      <div className="text-[11px] text-slate-500">Visée continue vers la souris ou une entité cible.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('follow')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-violet-400 hover:bg-violet-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Move className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Suivre (Follow)</div>
                      <div className="text-[11px] text-slate-500">Poursuite continue avec distance minimale de sécurité.</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAddBehavior('flee')}
                    className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                      <Wind className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-800 text-xs">Fuir (Flee)</div>
                      <div className="text-[11px] text-slate-500">S'éloigne automatiquement de la souris, d'une entité ou d'un tag.</div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Catégorie 6: Effets Visuels & Particules */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Effets Visuels & Particules
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('particle_emitter')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-amber-400 hover:bg-amber-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Émetteur de Particules</div>
                    <div className="text-[11px] text-slate-500">Flux léger de particules (étincelles, fumée, traînée) en Canvas 2D.</div>
                  </div>
                </button>
              </div>

              {/* Catégorie 7: Cycle de Vie & Nettoyage */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Cycle de Vie & Nettoyage
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('auto_destroy')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-orange-400 hover:bg-orange-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Autodestruction (Lifespan)</div>
                    <div className="text-[11px] text-slate-500">Détruit automatiquement l'entité après un délai défini (en secondes).</div>
                  </div>
                </button>
              </div>

              {/* Catégorie 8: Jeu & Survie (Modulaire) */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                  Jeu & Survie
                </span>
                <button
                  type="button"
                  onClick={() => handleAddBehavior('health')}
                  className="w-full p-2.5 rounded-2xl border border-slate-200 hover:border-rose-400 hover:bg-rose-50/30 flex items-center gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                    <Heart className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-800 text-xs">Santé & Dégâts (PV / Invincibilité)</div>
                    <div className="text-[11px] text-slate-500">Cœurs/PV, contact par #tag (ex: #danger), clignotement, recul et état Blessé coopératif.</div>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Atelier de dessin plein écran pour particule personnalisée */}
      {particleDrawerState && (
        <FullScreenDrawingModal
          title={
            particleDrawerState.editingPreset
              ? `Modifier particule : ${particleDrawerState.editingPreset.name}`
              : 'Dessiner une particule'
          }
          subtitle="Dessinez votre particule personnalisée"
          enableFlipbook={false}
          initialPaths={particleDrawerState.editingPreset?.vectorPaths || []}
          currentEditingStateName={
            particleDrawerState.editingPreset?.name || `Particule ${customParticles.length + 1}`
          }
          onSave={(paths, _dataUrl, _colliderType, customName) => {
            const finalName = (customName || '').trim() || `Particule ${customParticles.length + 1}`;
            let targetPresetId = particleDrawerState.editingPreset?.id;
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
            const curBeh = baseBehaviors.find((bh) => bh.id === particleDrawerState.behaviorId);
            const curOv = particleDrawerState.isOverridden
              ? targetState?.behaviorOverrides?.[particleDrawerState.behaviorId]
              : undefined;
            const curEffective = { ...(curBeh || {}), ...(curOv || {}) } as ParticleEmitterBehaviorConfig;
            const existingIds =
              curEffective.customParticleIds && curEffective.customParticleIds.length > 0
                ? curEffective.customParticleIds
                : curEffective.customParticleId
                ? [curEffective.customParticleId]
                : [];
            const nextIds = existingIds.includes(targetPresetId)
              ? existingIds
              : [...existingIds, targetPresetId];
            const patch: Partial<ParticleEmitterBehaviorConfig> = {
              shape: 'custom',
              customParticleId: nextIds[0],
              customParticleIds: nextIds,
              customParticleMode: curEffective.customParticleMode || 'random',
            };
            if (particleDrawerState.isOverridden) {
              handleUpdateOverride(particleDrawerState.behaviorId, patch);
            } else {
              handleUpdateBaseBehavior(particleDrawerState.behaviorId, patch);
            }
            setParticleDrawerState(null);
          }}
          onClose={() => setParticleDrawerState(null)}
        />
      )}
      {/* Éditeur & Testeur interactif de particules */}
      {particleEditorState && (() => {
        const base = baseBehaviors.find((bh) => bh.id === particleEditorState.behaviorId);
        if (!base || base.type !== 'particle_emitter') return null;
        const ov = particleEditorState.isOverridden
          ? targetState?.behaviorOverrides?.[base.id]
          : undefined;
        const effective = { ...base, ...(ov || {}) } as ParticleEmitterBehaviorConfig;
        return (
          <ParticleEditorModal
            isOpen={true}
            mode="emitter"
            initialConfig={{
              shape: effective.shape || 'circle',
              customParticleId: effective.customParticleId,
              customParticleIds: effective.customParticleIds,
              customParticleMode: effective.customParticleMode,
              useParticleTint: effective.useParticleTint,
              color: effective.color || '#f59e0b',
              color2: effective.color2 || effective.color || '#ef4444',
              rate: effective.rate ?? 14,
              speed: effective.speed ?? 140,
              size: effective.size ?? 6,
              lifetime: effective.lifetime ?? 0.8,
              gravity: effective.gravity ?? 160,
              spread: effective.spread ?? 60,
              angle: effective.angle ?? -90,
              offsetX: effective.offsetX ?? 0,
              offsetY: effective.offsetY ?? 0,
            }}
            onApply={(cfg) => {
              const patch: Partial<ParticleEmitterBehaviorConfig> = {
                shape: cfg.shape,
                customParticleId: cfg.shape === 'custom' ? (cfg.customParticleIds?.[0] || cfg.customParticleId) : undefined,
                customParticleIds: cfg.shape === 'custom' ? cfg.customParticleIds : undefined,
                customParticleMode: cfg.shape === 'custom' ? cfg.customParticleMode : undefined,
                useParticleTint: cfg.shape === 'custom' ? Boolean(cfg.useParticleTint) : undefined,
                color: cfg.color,
                color2: cfg.color2,
                rate: cfg.rate ?? 14,
                speed: cfg.speed,
                size: cfg.size,
                lifetime: cfg.lifetime,
                gravity: cfg.gravity,
                spread: cfg.spread,
                angle: cfg.angle,
                offsetX: cfg.offsetX ?? 0,
                offsetY: cfg.offsetY ?? 0,
              };
              if (particleEditorState.isOverridden) {
                handleUpdateOverride(particleEditorState.behaviorId, patch);
              } else {
                handleUpdateBaseBehavior(particleEditorState.behaviorId, patch);
              }
              setParticleEditorState(null);
            }}
            onClose={() => setParticleEditorState(null)}
          />
        );
      })()}
    </div>
  );
}

// Formulaires dynamiques de configuration : Style Unity Inspector (Chaque attribut sur sa propre ligne empilée)
function renderBehaviorControls({
  behavior,
  override,
  isOverridden,
  onUpdateBase,
  onUpdateOverride,
  targetEntityOptions,
  entityTypeOptions,
  availableTags,
  stateList,
  customParticles,
  onOpenParticleDrawer,
  onOpenParticleEditor,
  onDeleteCustomParticle,
}: {
  behavior: EntityBehavior;
  override?: BehaviorOverride;
  isOverridden: boolean;
  onUpdateBase: (partial: Partial<EntityBehavior>) => void;
  onUpdateOverride: (partial: BehaviorOverride) => void;
  targetEntityOptions: Entity[];
  entityTypeOptions: { type: string; label: string }[];
  availableTags: string[];
  stateList: EntityState[];
  customParticles: CustomParticlePreset[];
  onOpenParticleDrawer: (editingPreset?: CustomParticlePreset) => void;
  onOpenParticleEditor: () => void;
  onDeleteCustomParticle: (presetId: string) => void;
}) {
  const update = (partial: any) => {
    if (isOverridden) {
      onUpdateOverride(partial);
    } else {
      onUpdateBase(partial);
    }
  };

  const renderFlipControls = (b: { flipOnMove?: boolean; flipInvert?: boolean }) => (
    <>
      <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
        <div>
          <div className="font-bold text-slate-700 text-xs">Flip horizontal (Sens du déplacement)</div>
          <div className="text-[10px] text-slate-400">Retourne l'objet horizontalement vers l'avant</div>
        </div>
        <input
          type="checkbox"
          checked={b.flipOnMove === true}
          onChange={(e) => update({ flipOnMove: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
        />
      </div>
      {b.flipOnMove === true && (
        <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
          <span className="font-bold text-slate-700 text-xs">Sens du dessin d'origine</span>
          <select
            value={b.flipInvert ? 'left' : 'right'}
            onChange={(e) => update({ flipInvert: e.target.value === 'left' })}
            className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
          >
            <option value="right">Regarde vers la droite (Défaut)</option>
            <option value="left">Regarde vers la gauche (Inversé)</option>
          </select>
        </div>
      )}
    </>
  );

  const renderInertiaControls = (
    b: { acceleration?: number; damping?: number },
    defaultDamping: number = 0
  ) => {
    const accelVal = b.acceleration ?? 1;
    const dampVal = b.damping ?? defaultDamping;
    return (
      <>
        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <div>
              <span className="font-bold">Accélération (Réactivité)</span>
              <span className="text-[10px] text-slate-400 block">
                {accelVal >= 0.95 ? 'Démarrage instantané' : accelVal <= 0.2 ? 'Montée lente et lourde' : 'Accélération progressive'}
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
              {Math.round(accelVal * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0.05"
            max="1"
            step="0.05"
            value={accelVal}
            onChange={(e) => update({ acceleration: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>

        <div className="p-2 bg-white rounded-xl border border-slate-200">
          <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
            <div>
              <span className="font-bold">Inertie / Glisse (Damping)</span>
              <span className="text-[10px] text-slate-400 block">
                {dampVal <= 0.05 ? 'Arrêt sec immédiat' : dampVal >= 0.9 ? 'Longue glisse (effet patinoire / espace)' : 'Décélération amortie'}
              </span>
            </div>
            <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
              {Math.round(dampVal * 100)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="0.98"
            step="0.02"
            value={dampVal}
            onChange={(e) => update({ damping: parseFloat(e.target.value) })}
            className="w-full accent-indigo-600"
          />
        </div>
      </>
    );
  };

  switch (behavior.type) {
    case 'draggable': {
      const b = { ...behavior, ...(override || {}) } as DraggableBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Inertie au lancer */}
          <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-700 text-xs">Inertie au lancer (Throw)</div>
              <div className="text-[10px] text-slate-400">Projette l'objet selon la vitesse du geste au lâcher</div>
            </div>
            <input
              type="checkbox"
              checked={b.throwable !== false}
              onChange={(e) => update({ throwable: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Ligne 2: Plafond de vitesse */}
          {b.throwable !== false && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-bold">Plafond de projection</span>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {b.maxThrowSpeed || 1500} px/s
                </span>
              </div>
              <input
                type="range"
                min="300"
                max="3000"
                step="100"
                value={b.maxThrowSpeed || 1500}
                onChange={(e) => update({ maxThrowSpeed: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}
        </div>
      );
    }

    case 'physics': {
      const b = { ...behavior, ...(override || {}) } as PhysicsBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Collider Solide vs Trigger */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-700 text-xs">Collider Solide</div>
              <div className="text-[10px] text-slate-400">
                {b.isTrigger ? 'Zone fantôme / Capteur (traverse sans bloquer)' : 'Corps solide (bloque et repousse)'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={b.isTrigger !== true}
              onChange={(e) => update({ isTrigger: !e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              title="Décocher pour en faire un Trigger (capteur sans collision physique)"
            />
          </div>

          {/* Ligne 2: Obstacle Fixe */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
            <div>
              <div className="font-bold text-slate-700 text-xs">Obstacle Fixe (Inamovible)</div>
              <div className="text-[10px] text-slate-400">
                {b.isStatic ? 'Immobile / Solide fixe (Masse infinie)' : 'Corps physique mobile (Dynamique)'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={b.isStatic === true}
              onChange={(e) => update({ isStatic: e.target.checked })}
              className="w-4 h-4 accent-emerald-600 rounded cursor-pointer"
              title="Cocher pour un mur, un sol ou une plateforme infranchissable"
            />
          </div>

          {/* Ligne 3: Gravité verticale (seulement si non statique) */}
          {!b.isStatic && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-bold">Gravité verticale</span>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {b.gravity ?? 400} px/s²
                </span>
              </div>
              <input
                type="range"
                min="-2000"
                max="2000"
                step="50"
                value={b.gravity ?? 400}
                onChange={(e) => update({ gravity: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          {/* Ligne 4: Rebond sur les autres objets */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Rebond (Restitution)</span>
                <span className="text-[10px] text-slate-400 block">Élasticité du choc avec les autres objets</span>
              </div>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {Math.round((b.bounce ?? 0.4) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1.2"
              step="0.05"
              value={b.bounce ?? 0.4}
              onChange={(e) => update({ bounce: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Ligne 5: Friction / Adhérence au contact */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Adhérence surface (Friction)</span>
                <span className="text-[10px] text-slate-400 block">
                  0 = Glace (glisse) • 0.6+ = Accroche &amp; fait rouler les balles
                </span>
              </div>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {Math.round((b.friction ?? 0.6) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={b.friction ?? 0.6}
              onChange={(e) => update({ friction: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Ligne 5.5: Résistance de l'air (Friction Air) */}
          {!b.isStatic && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <div>
                  <span className="font-bold">Résistance de l'air (Freinage)</span>
                  <span className="text-[10px] text-slate-400 block">
                    0 = Vide spatial (aucun freinage) • 0.05+ = Freinage fort
                  </span>
                </div>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {(b.frictionAir ?? 0.015).toFixed(3)}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="0.25"
                step="0.005"
                value={b.frictionAir ?? 0.015}
                onChange={(e) => update({ frictionAir: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          {/* Ligne 6: Masse du corps */}
          {!b.isStatic && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <div>
                  <span className="font-bold">Masse</span>
                  <span className="text-[10px] text-slate-400 block">Influence la résistance aux chocs</span>
                </div>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {b.mass ?? 1} kg
                </span>
              </div>
              <input
                type="range"
                min="0.1"
                max="50"
                step="0.1"
                value={b.mass ?? 1}
                onChange={(e) => update({ mass: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          {/* Ligne 7: Figer la rotation (Freeze Rotation) */}
          {!b.isStatic && (
            <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Figer la rotation (Freeze Rotation)</span>
                </div>
                <div className="text-[10px] text-slate-400">
                  {b.freezeRotation ? 'Rotation bloquée (l\'objet reste droit sans basculer)' : 'Rotation libre sous l\'effet des chocs'}
                </div>
              </div>
              <input
                type="checkbox"
                checked={b.freezeRotation === true}
                onChange={(e) => update({ freezeRotation: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                title="Empêche l'objet de pivoter lors des collisions physiques"
              />
            </div>
          )}
        </div>
      );
    }

    case 'auto_destroy': {
      const b = { ...behavior, ...(override || {}) } as AutoDestroyBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Durée de vie avant autodestruction */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Durée de vie (Délai)</span>
                <span className="text-[10px] text-slate-400 block">Délai avant suppression automatique</span>
              </div>
              <span className="font-mono font-bold text-orange-600 bg-orange-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.delay ?? 3} s
              </span>
            </div>
            <input
              type="range"
              min="0.2"
              max="20"
              step="0.2"
              value={b.delay ?? 3}
              onChange={(e) => update({ delay: parseFloat(e.target.value) })}
              className="w-full accent-orange-600"
            />
          </div>
        </div>
      );
    }

    case 'constant_velocity': {
      const b = { ...behavior, ...(override || {}) } as ConstantVelocityBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Vitesse X */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-700 text-xs block">Vitesse horizontale X</span>
              <span className="text-[10px] text-slate-400">Négatif = gauche, Positif = droite</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={b.vx}
                onChange={(e) => update({ vx: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
              />
              <span className="text-slate-400 text-xs">px/s</span>
            </div>
          </div>

          {/* Ligne 2: Vitesse Y */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div>
              <span className="font-bold text-slate-700 text-xs block">Vitesse verticale Y</span>
              <span className="text-[10px] text-slate-400">Négatif = haut, Positif = bas</span>
            </div>
            <div className="flex items-center gap-1">
              <input
                type="number"
                value={b.vy}
                onChange={(e) => update({ vy: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
              />
              <span className="text-slate-400 text-xs">px/s</span>
            </div>
          </div>

          {/* Ligne 3: Rotation continue */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Rotation continue</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.angularVelocity || 0} °/s
              </span>
            </div>
            <input
              type="range"
              min="-360"
              max="360"
              step="10"
              value={b.angularVelocity || 0}
              onChange={(e) => update({ angularVelocity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {renderInertiaControls(b, 0)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'keyboard_control': {
      const b = { ...behavior, ...(override || {}) } as KeyboardControlBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Mode de jeu */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Mode de jeu</span>
            <select
              value={b.mode}
              onChange={(e) => update({ mode: e.target.value as any })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="top_down">Vue de dessus (8 directions)</option>
              <option value="platformer">Plateforme (Gauche/Droite + Saut)</option>
            </select>
          </div>

          {/* Ligne 2: Type de touches */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Touches actives</span>
            <select
              value={b.layout}
              onChange={(e) => update({ layout: e.target.value as any })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="both">Flèches & ZQSD / WASD</option>
              <option value="arrows">Flèches uniquement</option>
              <option value="wasd">Touches ZQSD / WASD</option>
            </select>
          </div>

          {/* Ligne 3: Restriction Axe Horizontal */}
          <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
            <div>
              <div className="font-bold text-slate-700 text-xs">Mouvement horizontal (Gauche / Droite)</div>
              <div className="text-[10px] text-slate-400">Autorise le déplacement sur l'axe X</div>
            </div>
            <input
              type="checkbox"
              checked={b.allowHorizontal !== false}
              onChange={(e) => update({ allowHorizontal: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
            />
          </div>

          {/* Ligne 4: Restriction Axe Vertical (si mode Vue de dessus) */}
          {b.mode === 'top_down' && (
            <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
              <div>
                <div className="font-bold text-slate-700 text-xs">Mouvement vertical (Haut / Bas)</div>
                <div className="text-[10px] text-slate-400">Autorise le déplacement sur l'axe Y</div>
              </div>
              <input
                type="checkbox"
                checked={b.allowVertical !== false}
                onChange={(e) => update({ allowVertical: e.target.checked })}
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
              />
            </div>
          )}

          {/* Ligne 5: Autoriser le saut (si mode Plateforme) */}
          {b.mode === 'platformer' && (
            <>
              <div className="flex items-center justify-between p-2 bg-white rounded-xl border border-slate-200">
                <div>
                  <div className="font-bold text-slate-700 text-xs">Autoriser le saut</div>
                  <div className="text-[10px] text-slate-400">Active l'impulsion verticale (Haut / Espace)</div>
                </div>
                <input
                  type="checkbox"
                  checked={b.allowJump !== false}
                  onChange={(e) => update({ allowJump: e.target.checked })}
                  className="w-4 h-4 accent-indigo-600 rounded cursor-pointer"
                />
              </div>

              {b.allowJump !== false && (
                <div className="p-2 bg-white rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                    <span className="font-bold">Nombre de sauts max</span>
                    <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                      {b.maxJumps ?? 1} {(b.maxJumps ?? 1) > 1 ? 'sauts' : 'saut'}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="1"
                    value={b.maxJumps ?? 1}
                    onChange={(e) => update({ maxJumps: parseInt(e.target.value, 10) || 1 })}
                    className="w-full accent-indigo-600 h-1.5"
                  />
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    1 = saut simple (au sol), 2 = double saut, etc.
                  </div>
                </div>
              )}
            </>
          )}

          {/* Ligne 6: Vitesse de déplacement */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Vitesse de course</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.speed} px/s
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="500"
              step="10"
              value={b.speed}
              onChange={(e) => update({ speed: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Ligne 7: Force de saut (si mode plateforme et saut autorisé) */}
          {b.mode === 'platformer' && b.allowJump !== false && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <span className="font-bold">Impulsion de saut</span>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {b.jumpForce || 450} px/s
                </span>
              </div>
              <input
                type="range"
                min="200"
                max="800"
                step="25"
                value={b.jumpForce || 450}
                onChange={(e) => update({ jumpForce: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}

          {renderInertiaControls(b, 0.8)}
          {renderFlipControls(b)}

          {/* Ligne 8: Liaisons automatiques d'états visuels + Garde-fou */}
          <div className="p-2.5 bg-indigo-50/50 rounded-xl border border-indigo-200/80 space-y-2">
            <div>
              <div className="font-bold text-indigo-900 text-xs flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-indigo-600" />
                <span>États visuels automatiques (Garde-fou actif)</span>
              </div>
              <div className="text-[10px] text-indigo-700/80 leading-snug mt-0.5">
                Change d'état automatiquement selon le mouvement. Ne remplace jamais les autres états (ex : Blessé, Attaque).
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-bold text-slate-700">Repos (Idle)</span>
                <select
                  value={b.stateBindings?.idleStateId || ''}
                  onChange={(e) =>
                    update({
                      stateBindings: {
                        ...(b.stateBindings || {}),
                        idleStateId: e.target.value || undefined,
                      },
                    })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[155px]"
                >
                  <option value="">-- Non défini --</option>
                  {stateList.map((st) => (
                    <option key={st.id} value={st.id}>
                      État {st.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                <span className="text-[11px] font-bold text-slate-700">Marche / Mouvement</span>
                <select
                  value={b.stateBindings?.moveStateId || ''}
                  onChange={(e) =>
                    update({
                      stateBindings: {
                        ...(b.stateBindings || {}),
                        moveStateId: e.target.value || undefined,
                      },
                    })
                  }
                  className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[155px]"
                >
                  <option value="">-- Non défini --</option>
                  {stateList.map((st) => (
                    <option key={st.id} value={st.id}>
                      État {st.name}
                    </option>
                  ))}
                </select>
              </div>

              {b.mode === 'platformer' && (
                <>
                  <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                    <span className="text-[11px] font-bold text-slate-700">Saut (Montée)</span>
                    <select
                      value={b.stateBindings?.jumpStateId || ''}
                      onChange={(e) =>
                        update({
                          stateBindings: {
                            ...(b.stateBindings || {}),
                            jumpStateId: e.target.value || undefined,
                          },
                        })
                      }
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[155px]"
                    >
                      <option value="">-- Non défini --</option>
                      {stateList.map((st) => (
                        <option key={st.id} value={st.id}>
                          État {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center justify-between gap-2 bg-white p-1.5 rounded-lg border border-indigo-100">
                    <span className="text-[11px] font-bold text-slate-700">Chute (Descente)</span>
                    <select
                      value={b.stateBindings?.fallStateId || ''}
                      onChange={(e) =>
                        update({
                          stateBindings: {
                            ...(b.stateBindings || {}),
                            fallStateId: e.target.value || undefined,
                          },
                        })
                      }
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-medium text-slate-800 max-w-[155px]"
                    >
                      <option value="">-- Non défini --</option>
                      {stateList.map((st) => (
                        <option key={st.id} value={st.id}>
                          État {st.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      );
    }

    case 'patrol': {
      const b = { ...behavior, ...(override || {}) } as PatrolBehaviorConfig;
      return (
        <div className="space-y-1.5">
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
              max="400"
              step="10"
              value={b.range}
              onChange={(e) => update({ range: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

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

          {/* Ligne 4: Pause aux extrémités */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Pause aux bornes</span>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min="0"
                max="10"
                step="0.1"
                value={b.pauseDuration}
                onChange={(e) => update({ pauseDuration: parseFloat(e.target.value) || 0 })}
                className="w-20 bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 font-mono font-bold text-xs text-right text-slate-800"
              />
              <span className="text-slate-400 text-xs">sec</span>
            </div>
          </div>

          {renderInertiaControls(b, 0)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'wandering': {
      const b = { ...behavior, ...(override || {}) } as WanderingBehaviorConfig;
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

          {renderInertiaControls(b, 0.78)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'move_to': {
      const b = { ...behavior, ...(override || {}) } as MoveToBehaviorConfig;
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

          {renderInertiaControls(b, 0)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'look_at': {
      const b = { ...behavior, ...(override || {}) } as LookAtBehaviorConfig;
      return (
        <div className="space-y-1.5">
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

          {/* Ligne 4: Lissage angulaire */}
          <div className="p-2 bg-white rounded-xl border border-slate-200">
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <div>
                <span className="font-bold">Lissage angulaire</span>
                <span className="text-[10px] text-slate-400 block">0 = instantané, sinon vitesse de pivot</span>
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

    case 'follow': {
      const b = { ...behavior, ...(override || {}) } as FollowBehaviorConfig;
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

          {/* Ligne 4: Vitesse de suivi */}
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

          {renderInertiaControls(b, 0.8)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'flee': {
      const b = { ...behavior, ...(override || {}) } as FleeBehaviorConfig;
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
              <span className="font-bold">Vitesse de fuite</span>
              <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                {b.speed ?? 160} px/s
              </span>
            </div>
            <input
              type="range"
              min="30"
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

          {renderInertiaControls(b, 0.85)}
          {renderFlipControls(b)}
        </div>
      );
    }

    case 'boundary_behavior': {
      const b = { ...behavior, ...(override || {}) } as BoundaryBehaviorConfig;
      return (
        <div className="space-y-1.5">
          {/* Ligne 1: Comportement aux bords */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <span className="font-bold text-slate-700 text-xs">Comportement aux bords</span>
            <select
              value={b.mode}
              onChange={(e) => update({ mode: e.target.value as any })}
              className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800"
            >
              <option value="bounce">Rebond élastique</option>
              <option value="wrap">Téléportation continue (Wrap)</option>
              <option value="clamp">Butée infranchissable (Clamp)</option>
            </select>
          </div>

          {/* Ligne 2: Élasticité du rebond aux bords */}
          {b.mode === 'bounce' && (
            <div className="p-2 bg-white rounded-xl border border-slate-200">
              <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
                <div>
                  <span className="font-bold">Rebond sur les bords</span>
                  <span className="text-[10px] text-slate-400 block">Élasticité spécifique contre le cadre du canvas</span>
                </div>
                <span className="font-mono font-bold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded text-[11px]">
                  {Math.round((b.bounciness ?? 0.8) * 100)}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={b.bounciness ?? 0.8}
                onChange={(e) => update({ bounciness: parseFloat(e.target.value) })}
                className="w-full accent-indigo-600"
              />
            </div>
          )}
        </div>
      );
    }

    case 'particle_emitter': {
      const b = { ...behavior, ...(override || {}) } as ParticleEmitterBehaviorConfig;
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

    case 'health': {
      const b = { ...behavior, ...(override || {}) } as HealthBehaviorConfig;
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
                  État {st.name}
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
                    État {st.name}
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
                    État {st.name}
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
  }
}
