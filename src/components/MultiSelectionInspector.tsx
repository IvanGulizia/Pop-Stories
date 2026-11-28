import React, { useMemo, useState } from 'react';
import {
  AlignHorizontalJustifyStart,
  AlignVerticalJustifyStart,
  ChevronDown,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  Layers,
  Move,
  Power,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../store/useSceneStore';
import {
  BehaviorType,
  CustomParticlePreset,
  Entity,
  ParticleEmitterBehaviorConfig,
} from '../types';
import {
  computeMixedBehaviorKeys,
  findCommonBehaviorTypes,
} from '../utils/behaviorClipboardHelpers';
import { getBehaviorIcon, getBehaviorTitle } from './behaviors/behaviorMetadata';
import { renderBehaviorControls } from './BehaviorManager';
import { ParticleEditorModal } from './ParticleEditorModal';
import { invalidateCustomParticleSprite } from '../utils/particleSystem';

interface MultiSelectionInspectorProps {
  entityIds: string[];
}

export function MultiSelectionInspector({ entityIds }: MultiSelectionInspectorProps) {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || EMPTY_RECORD);
  const rules = useSceneStore((state) => state.rules || EMPTY_LIST);
  const customParticles = useSceneStore((state) => state.customParticles || EMPTY_LIST);

  const selectEntity = useSceneStore((state) => state.selectEntity);
  const pushSceneHistory = useSceneStore((state) => state.pushSceneHistory);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const batchTranslateEntities = useSceneStore((state) => state.batchTranslateEntities);
  const batchDeleteEntities = useSceneStore((state) => state.batchDeleteEntities);
  const batchDuplicateEntities = useSceneStore((state) => state.batchDuplicateEntities);
  const batchUpdateEntityDetails = useSceneStore((state) => state.batchUpdateEntityDetails);
  const batchUpdateEntityBehaviorPartial = useSceneStore(
    (state) => state.batchUpdateEntityBehaviorPartial
  );
  const applyBehaviorToEntities = useSceneStore((state) => state.applyBehaviorToEntities);
  const deleteCustomParticle = useSceneStore((state) => state.deleteCustomParticle);

  const [expandedTypes, setExpandedTypes] = useState<Record<string, boolean>>({});
  const [alignedBadgeType, setAlignedBadgeType] = useState<BehaviorType | null>(null);
  const [particleEditorState, setParticleEditorState] = useState<{
    initialView?: 'studio' | 'draw_custom';
    editingPreset?: CustomParticlePreset;
  } | null>(null);

  const selectedEntities = useMemo(
    () =>
      entityIds
        .map((id) => entities[id])
        .filter((ent): ent is Entity => Boolean(ent)),
    [entityIds, entities]
  );

  const resolvedIds = useMemo(() => selectedEntities.map((e) => e.id), [selectedEntities]);

  const commonTypes = useMemo(
    () => findCommonBehaviorTypes(selectedEntities),
    [selectedEntities]
  );

  const targetEntityOptions = useMemo(() => {
    const selectedSet = new Set(resolvedIds);
    return Object.values(entities).filter((e) => !selectedSet.has(e.id));
  }, [entities, resolvedIds]);

  const entityTypeOptions = useMemo(() => {
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

  const availableTags = useMemo(() => {
    const tagSet = new Set<string>();
    Object.values(entities).forEach((e) => {
      e.tags?.forEach((t) => tagSet.add(t));
    });
    (rules || []).forEach((r) => {
      if (r.trigger?.subjectTag) tagSet.add(r.trigger.subjectTag);
      if (r.trigger?.targetTag) tagSet.add(r.trigger.targetTag);
      r.actions.forEach((a) => {
        if (a.targetTag) tagSet.add(a.targetTag);
      });
    });
    return Array.from(tagSet);
  }, [entities, rules]);

  if (selectedEntities.length < 2) return null;

  const first = selectedEntities[0];
  const allHidden = selectedEntities.every((e) => e.visible === false);
  const allDisabled = selectedEntities.every((e) => Boolean(e.disabled));

  const handleAlignAxis = (axis: 'x' | 'y') => {
    pushSceneHistory();
    selectedEntities.slice(1).forEach((ent) => {
      updateEntityPosition(ent.id, {
        x: axis === 'x' ? first.position.x : ent.position.x,
        y: axis === 'y' ? first.position.y : ent.position.y,
      });
    });
  };

  const handleNudge = (dx: number, dy: number) => {
    pushSceneHistory();
    batchTranslateEntities(resolvedIds, { dx, dy });
  };

  const handleAlignBehavior = (behaviorType: BehaviorType) => {
    applyBehaviorToEntities(first.id, behaviorType, resolvedIds);
    setAlignedBadgeType(behaviorType);
    window.setTimeout(() => {
      setAlignedBadgeType((cur) => (cur === behaviorType ? null : cur));
    }, 1400);
  };

  return (
    <div className="space-y-4 text-slate-800">
      {/* En-tête Multi-Sélection */}
      <div className="bg-indigo-50/70 border border-indigo-200 rounded-2xl p-3 space-y-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="inline-flex items-center justify-center w-6 h-6 rounded-xl bg-indigo-600 text-white text-xs font-black shadow-2xs shrink-0">
                {selectedEntities.length}
              </span>
              <h3 className="text-sm font-black text-indigo-950 tracking-tight truncate">
                {selectedEntities.length} objets sélectionnés
              </h3>
            </div>
            <p className="text-[11px] text-indigo-800/80 mt-1">
              Référence (1er) : <strong className="font-bold">{first.name}</strong>
            </p>
          </div>
          <button
            type="button"
            onClick={() => selectEntity(first.id)}
            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900 bg-white hover:bg-indigo-100 border border-indigo-200 px-2 py-1 rounded-xl cursor-pointer shrink-0 flex items-center gap-1"
            title="Ne garder que le premier objet sélectionné"
          >
            <X className="w-3 h-3" /> Isoler 1er
          </button>
        </div>

        {/* Puces cliquables des objets sélectionnés */}
        <div className="flex flex-wrap gap-1">
          {selectedEntities.slice(0, 8).map((ent, idx) => (
            <button
              key={ent.id}
              type="button"
              onClick={() => selectEntity(ent.id)}
              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer truncate max-w-[135px] ${
                idx === 0
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-indigo-300'
              }`}
              title={`Sélectionner uniquement « ${ent.name} »`}
            >
              {idx === 0 ? `1er · ${ent.name}` : ent.name}
            </button>
          ))}
          {selectedEntities.length > 8 && (
            <span className="px-2 py-0.5 rounded-lg text-[10px] font-bold bg-white/80 text-slate-500 border border-slate-200">
              +{selectedEntities.length - 8}
            </span>
          )}
        </div>

        {/* Actions groupées rapides */}
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          <button
            type="button"
            onClick={() => batchUpdateEntityDetails(resolvedIds, { visible: allHidden })}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
          >
            {allHidden ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
            <span>{allHidden ? 'Tout afficher' : 'Tout masquer'}</span>
          </button>

          <button
            type="button"
            onClick={() => batchUpdateEntityDetails(resolvedIds, { disabled: !allDisabled })}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[11px] font-bold text-slate-700 cursor-pointer"
          >
            <Power className={`w-3.5 h-3.5 ${allDisabled ? 'text-emerald-600' : 'text-rose-500'}`} />
            <span>{allDisabled ? 'Tout activer' : 'Tout désactiver'}</span>
          </button>

          <button
            type="button"
            onClick={() => batchDuplicateEntities(resolvedIds)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-indigo-50 border border-slate-200 hover:border-indigo-300 text-[11px] font-bold text-indigo-700 cursor-pointer"
          >
            <Copy className="w-3.5 h-3.5" />
            <span>Dupliquer ({selectedEntities.length})</span>
          </button>

          <button
            type="button"
            onClick={() => batchDeleteEntities(resolvedIds)}
            className="flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-300 text-[11px] font-bold text-rose-600 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Supprimer ({selectedEntities.length})</span>
          </button>
        </div>
      </div>

      {/* Déplacement relatif & Alignement */}
      <div className="bg-slate-50/90 border border-slate-200 rounded-2xl p-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Move className="w-3.5 h-3.5 text-indigo-500" /> Position & Alignement
          </span>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => handleAlignAxis('x')}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-[10px] font-bold text-slate-700 hover:text-indigo-700 cursor-pointer flex items-center gap-1"
              title={`Aligner la coordonnée X de tous les objets sur « ${first.name} »`}
            >
              <AlignHorizontalJustifyStart className="w-3 h-3" /> Aligner X
            </button>
            <button
              type="button"
              onClick={() => handleAlignAxis('y')}
              className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-50 border border-slate-200 text-[10px] font-bold text-slate-700 hover:text-indigo-700 cursor-pointer flex items-center gap-1"
              title={`Aligner la coordonnée Y de tous les objets sur « ${first.name} »`}
            >
              <AlignVerticalJustifyStart className="w-3 h-3" /> Aligner Y
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-[10px] font-bold text-slate-500">ΔX</span>
            <div className="flex items-center gap-1">
              {[-10, -1, 1, 10].map((step) => (
                <button
                  key={`dx-${step}`}
                  type="button"
                  onClick={() => handleNudge(step, 0)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 text-[10px] font-mono font-bold text-slate-700 hover:text-indigo-800 cursor-pointer"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-2 py-1">
            <span className="text-[10px] font-bold text-slate-500">ΔY</span>
            <div className="flex items-center gap-1">
              {[-10, -1, 1, 10].map((step) => (
                <button
                  key={`dy-${step}`}
                  type="button"
                  onClick={() => handleNudge(0, step)}
                  className="px-1.5 py-0.5 rounded bg-slate-100 hover:bg-indigo-100 text-[10px] font-mono font-bold text-slate-700 hover:text-indigo-800 cursor-pointer"
                >
                  {step > 0 ? `+${step}` : step}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Composants communs éditables en lot */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" /> Composants communs ({commonTypes.length})
          </label>
        </div>

        {commonTypes.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 text-center space-y-1">
            <p className="text-xs font-bold text-slate-600">Aucun composant commun</p>
            <p className="text-[11px] text-slate-400">
              Les composants partagés par ces {selectedEntities.length} objets apparaîtront ici pour les modifier simultanément.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {commonTypes.map((behaviorType, idx) => {
              const firstBehavior = (first.behaviors || []).find((b) => b.type === behaviorType);
              if (!firstBehavior) return null;

              const isExpanded = expandedTypes[behaviorType] ?? idx === 0;
              const mixedKeys = computeMixedBehaviorKeys(selectedEntities, behaviorType);
              const isEnabledMixed = mixedKeys.has('enabled');
              const mixedKeysList = Array.from(mixedKeys);
              const isAlignedNow = alignedBadgeType === behaviorType;

              return (
                <div
                  key={behaviorType}
                  className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden"
                >
                  <div
                    onClick={() =>
                      setExpandedTypes((prev) => ({
                        ...prev,
                        [behaviorType]: !isExpanded,
                      }))
                    }
                    className="p-2.5 flex items-center justify-between gap-2 cursor-pointer select-none"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-slate-400">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </span>
                      {getBehaviorIcon(behaviorType)}
                      <span className="text-xs font-bold text-slate-800 truncate">
                        {getBehaviorTitle(behaviorType)}
                      </span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 shrink-0">
                        {selectedEntities.length}/{selectedEntities.length}
                      </span>
                      {mixedKeys.size > 0 && (
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0"
                          title={`Champs avec valeurs différentes : ${mixedKeysList.join(', ')}`}
                        >
                          Mixte ({mixedKeys.size})
                        </span>
                      )}
                    </div>

                    <div
                      className="flex items-center gap-1.5 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(firstBehavior.enabled)}
                        ref={(el) => {
                          if (el) el.indeterminate = isEnabledMixed;
                        }}
                        onChange={(e) =>
                          batchUpdateEntityBehaviorPartial(resolvedIds, behaviorType, {
                            enabled: e.target.checked,
                          })
                        }
                        className="w-4 h-4 rounded text-indigo-600 cursor-pointer accent-indigo-600"
                        title={
                          isEnabledMixed
                            ? 'Activation mixte selon les objets — cliquer pour tout activer/désactiver'
                            : 'Activer / Désactiver sur toute la sélection'
                        }
                      />
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="px-3 pb-3 pt-1.5 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
                      <div className="p-2 rounded-xl bg-indigo-50/80 border border-indigo-200 flex items-center justify-between gap-2 text-[10px] text-indigo-900">
                        <span className="leading-snug">
                          <strong>Édition par champ</strong> : seul le paramètre modifié est appliqué aux {selectedEntities.length} objets.
                        </span>
                        <button
                          type="button"
                          onClick={() => handleAlignBehavior(behaviorType)}
                          className="px-2 py-1 rounded-lg bg-white hover:bg-indigo-100 border border-indigo-300 text-indigo-700 font-bold whitespace-nowrap cursor-pointer shrink-0 flex items-center gap-1"
                          title={`Copier toutes les valeurs actuelles de « ${first.name} » vers les ${selectedEntities.length - 1} autres objets`}
                        >
                          <Sparkles className="w-3 h-3" />
                          <span>
                            {isAlignedNow ? 'Aligné ✓' : `Tout aligner sur ${first.name}`}
                          </span>
                        </button>
                      </div>

                      {mixedKeys.size > 0 && (
                        <div className="px-2 py-1 rounded-lg bg-amber-50 border border-amber-200 text-[10px] text-amber-800">
                          Valeurs mixtes détectées sur : <span className="font-mono">{mixedKeysList.slice(0, 5).join(', ')}{mixedKeysList.length > 5 ? ` (+${mixedKeysList.length - 5})` : ''}</span>. Les valeurs affichées proviennent de « {first.name} ».
                        </div>
                      )}

                      {renderBehaviorControls({
                        entityId: undefined,
                        stateId: undefined,
                        behavior: firstBehavior,
                        override: undefined,
                        isOverridden: false,
                        onUpdateBase: (partial) =>
                          batchUpdateEntityBehaviorPartial(
                            resolvedIds,
                            behaviorType,
                            partial as Record<string, any>
                          ),
                        onUpdateOverride: () => {},
                        targetEntityOptions,
                        entityTypeOptions,
                        availableTags,
                        stateList: Object.values(first.states),
                        customParticles,
                        onOpenParticleDrawer: (editingPreset) =>
                          setParticleEditorState({
                            initialView: 'draw_custom',
                            editingPreset,
                          }),
                        onOpenParticleEditor: (initialView) =>
                          setParticleEditorState({ initialView }),
                        onDeleteCustomParticle: (presetId) => {
                          deleteCustomParticle(presetId);
                          invalidateCustomParticleSprite(presetId);
                        },
                        onQuickCreateState: () => first.currentStateId,
                        hasGroundedPhysics: false,
                        hasFrozenRotation: false,
                        hasPhysicsJointParent: false,
                        onActivateGroundedPhysics: () => {},
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Studio Particules si l'utilisateur ouvre l'éditeur depuis un ParticleEmitter commun */}
      {particleEditorState && (() => {
        const eff = (first.behaviors || []).find(
          (bh): bh is ParticleEmitterBehaviorConfig => bh.type === 'particle_emitter'
        );
        if (!eff) return null;
        return (
          <ParticleEditorModal
            isOpen={true}
            mode="emitter"
            initialView={particleEditorState.initialView}
            initialEditingPreset={particleEditorState.editingPreset}
            initialConfig={{
              shape: eff.shape || 'circle',
              customParticleId: eff.customParticleId,
              customParticleIds: eff.customParticleIds,
              customParticleMode: eff.customParticleMode,
              useParticleTint: eff.useParticleTint,
              color: eff.color || '#f59e0b',
              color2: eff.color2 || eff.color || '#ef4444',
              colorMode: eff.colorMode,
              rate: eff.rate ?? 14,
              rateMax: eff.rateMax,
              speed: eff.speed ?? 140,
              speedMax: eff.speedMax,
              size: eff.size ?? 6,
              sizeMax: eff.sizeMax,
              endSizeScale: eff.endSizeScale,
              lifetime: eff.lifetime ?? 0.8,
              lifetimeMax: eff.lifetimeMax,
              gravity: eff.gravity ?? 160,
              drag: eff.drag,
              opacityStart: eff.opacityStart,
              opacityEnd: eff.opacityEnd,
              spinSpeed: eff.spinSpeed,
              spread: eff.spread ?? 60,
              angle: eff.angle ?? -90,
              directionMode: eff.directionMode,
              directionTargetMode: eff.directionTargetMode,
              directionTargetEntityId: eff.directionTargetEntityId,
              directionTargetEntityType: eff.directionTargetEntityType,
              directionTargetTag: eff.directionTargetTag,
              offsetX: eff.offsetX ?? 0,
              offsetY: eff.offsetY ?? 0,
              anchor: eff.anchor,
              followRotation: eff.followRotation,
              emissionShape: eff.emissionShape,
              emissionRadius: eff.emissionRadius,
              emissionWidth: eff.emissionWidth,
              emissionHeight: eff.emissionHeight,
              emitterDuration: eff.emitterDuration,
              emitterLoop: eff.emitterLoop,
              initialBurstCount: eff.initialBurstCount,
              burstInterval: eff.burstInterval,
              burstCount: eff.burstCount,
            }}
            onApply={(cfg) => {
              batchUpdateEntityBehaviorPartial(resolvedIds, 'particle_emitter', {
                shape: cfg.shape,
                customParticleId:
                  cfg.shape === 'custom'
                    ? cfg.customParticleIds?.[0] || cfg.customParticleId
                    : undefined,
                customParticleIds: cfg.shape === 'custom' ? cfg.customParticleIds : undefined,
                customParticleMode: cfg.shape === 'custom' ? cfg.customParticleMode : undefined,
                useParticleTint:
                  cfg.shape === 'custom' ? Boolean(cfg.useParticleTint) : undefined,
                color: cfg.color,
                color2: cfg.color2,
                colorMode: cfg.colorMode,
                rate: cfg.rate ?? 14,
                rateMax: cfg.rateMax,
                speed: cfg.speed,
                speedMax: cfg.speedMax,
                size: cfg.size,
                sizeMax: cfg.sizeMax,
                endSizeScale: cfg.endSizeScale,
                lifetime: cfg.lifetime,
                lifetimeMax: cfg.lifetimeMax,
                gravity: cfg.gravity,
                drag: cfg.drag,
                opacityStart: cfg.opacityStart,
                opacityEnd: cfg.opacityEnd,
                spinSpeed: cfg.spinSpeed,
                spread: cfg.spread,
                angle: cfg.angle,
                directionMode: cfg.directionMode,
                directionTargetMode: cfg.directionTargetMode,
                directionTargetEntityId: cfg.directionTargetEntityId,
                directionTargetEntityType: cfg.directionTargetEntityType,
                directionTargetTag: cfg.directionTargetTag,
                offsetX: cfg.offsetX ?? 0,
                offsetY: cfg.offsetY ?? 0,
                anchor: cfg.anchor,
                followRotation: cfg.followRotation,
                emissionShape: cfg.emissionShape,
                emissionRadius: cfg.emissionRadius,
                emissionWidth: cfg.emissionWidth,
                emissionHeight: cfg.emissionHeight,
                emitterDuration: cfg.emitterDuration,
                emitterLoop: cfg.emitterLoop,
                initialBurstCount: cfg.initialBurstCount,
                burstInterval: cfg.burstInterval,
                burstCount: cfg.burstCount,
              });
              setParticleEditorState(null);
            }}
            onClose={() => setParticleEditorState(null)}
          />
        );
      })()}
    </div>
  );
}
