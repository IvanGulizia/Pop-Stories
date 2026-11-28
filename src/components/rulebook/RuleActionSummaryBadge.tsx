import React from 'react';
import {
  RuleAction,
  RuleTrigger,
  DynamicRule,
  Entity,
  CustomSound,
  CustomParticlePreset,
} from '../../types';
import { EntityMiniPreview } from '../EntityMiniPreview';
import {
  ActionModalSubStep,
  formatRoleLabel,
  getSceneTransitionShortLabel,
  resolveTriggerSubjectHint,
  resolveTriggerTargetHint,
} from './ruleBookTypes';
import { useSceneStore, EMPTY_LIST, EMPTY_RECORD } from '../../store/useSceneStore';

export function getEntityObjFromList(
  type: string | undefined,
  entityList: Entity[],
  customArchetypes: Record<string, Entity>
): Entity | undefined {
  if (!type) return undefined;
  return (
    entityList.find((e) => e.type === type || e.id === type || e.name === type) ||
    customArchetypes[type] ||
    Object.values(customArchetypes).find((a) => a.id === type || a.name === type)
  );
}

export function formatEntityStateName(
  stateId: string | undefined,
  entObj: Entity | undefined,
  entityList: Entity[],
  customArchetypes: Record<string, Entity>
): string {
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
}

interface RuleActionSummaryBadgeProps {
  act: RuleAction;
  trigger: RuleTrigger;
  rule?: DynamicRule;
  actIdx?: number;
  entities: Record<string, Entity>;
  customSounds: CustomSound[];
  customParticles: CustomParticlePreset[];
  getEntityObj: (type?: string) => Entity | undefined;
  formatStateName: (stateId?: string, entObj?: any) => string;
  openRuleActionModal: (
    rule: DynamicRule,
    act: RuleAction,
    actIdx: number,
    overrideSubStep?: ActionModalSubStep
  ) => void;
}

export const RuleActionSummaryBadge: React.FC<RuleActionSummaryBadgeProps> = ({
  act,
  trigger,
  rule,
  actIdx,
  entities,
  customSounds,
  customParticles,
  getEntityObj,
  formatStateName,
  openRuleActionModal,
}) => {
  const scenes = useSceneStore((s) => s.scenes || EMPTY_LIST);
  const customArchetypes = useSceneStore((s) => s.customArchetypes || EMPTY_RECORD);
  const subjectHint = resolveTriggerSubjectHint(trigger, {
    entities,
    customArchetypes,
    getEntityObj,
  });
  const targetHint = resolveTriggerTargetHint(trigger, {
    entities,
    customArchetypes,
    getEntityObj,
  });
  const subjectRoleLabel = formatRoleLabel('Sujet', subjectHint);
  const targetRoleLabel = formatRoleLabel('Cible', targetHint);
  const canJump = Boolean(rule && actIdx !== undefined);
  const jumpMain = (e: React.MouseEvent) => {
    if (!rule || actIdx === undefined) return;
    e.stopPropagation();
    openRuleActionModal(rule, act, actIdx, 'main');
  };
  const jumpSub = (e: React.MouseEvent, sub: ActionModalSubStep) => {
    if (!rule || actIdx === undefined) return;
    e.stopPropagation();
    openRuleActionModal(rule, act, actIdx, sub);
  };

  if (act.type === 'change_state') {
    const targetType =
      act.targetMode === 'subject' || (!act.targetMode && !act.targetType)
        ? trigger.subjectType
        : act.targetType || trigger.targetType || trigger.subjectType;

    const targetEntObj = getEntityObj(targetType);
    const humanStateName = formatStateName(act.targetStateId, targetEntObj);
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : targetEntObj?.name || targetType || 'Objet';
    const hasMultiStates = Object.keys(targetEntObj?.states || {}).length > 1;

    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? jumpMain : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <EntityMiniPreview entity={targetEntObj} type={targetType} stateId={act.targetStateId} size={18} />
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <button
          type="button"
          onClick={(e) => jumpSub(e, hasMultiStates ? 'choose_state' : 'main')}
          className="text-[10px] text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-1.5 py-0.2 rounded font-medium truncate cursor-pointer"
          title="Changer l'état appliqué"
        >
          ({humanStateName})
        </button>
      </div>
    );
  }
  if (act.type === 'toggle_state') {
    const targetType =
      act.targetMode === 'subject'
        ? trigger.subjectType
        : act.targetType || trigger.targetType || trigger.subjectType;
    const targetEntObj = getEntityObj(targetType);
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
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
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? jumpMain : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-purple-400 hover:bg-purple-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-purple-100 text-purple-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🔄
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <button
          type="button"
          onClick={(e) =>
            jumpSub(e, Object.keys(targetEntObj?.states || {}).length >= 2 ? 'choose_toggle_states' : 'choose_toggle_entity')
          }
          className="text-[10px] text-purple-700 bg-purple-50 hover:bg-purple-100 px-1.5 py-0.2 rounded font-medium truncate cursor-pointer"
          title="Configurer la bascule d'états"
        >
          ({detail})
        </button>
      </div>
    );
  }
  if (act.type === 'delete_entity') {
    const targetType =
      act.targetMode === 'subject'
        ? trigger.subjectType
        : act.targetType || trigger.targetType || trigger.subjectType;
    const targetEntObj = getEntityObj(targetType);
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : targetEntObj?.name || targetType || 'Objet';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? jumpMain : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-rose-400 hover:bg-rose-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
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
      act.spawnLocationMode === 'random'
        ? act.spawnRandomScope === 'zone' && act.spawnRandomZone
          ? ` @Zone (${act.spawnRandomZone.width}×${act.spawnRandomZone.height})`
          : ' @Aléatoire'
        : act.spawnLocationMode === 'at_event_point' || act.spawnLocationMode === 'offset_event_point'
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
    const impulseBadge =
      (act.spawnImpulseSpeed || 0) > 0
        ? ` 🚀 ${Math.round(act.spawnImpulseSpeed!)}px/s @ ${Math.round(act.spawnImpulseAngle ?? 0)}°`
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? jumpMain : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-emerald-400 hover:bg-emerald-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-slate-50 border border-slate-200 flex items-center justify-center p-0.5 shrink-0 overflow-hidden">
          <EntityMiniPreview entity={spawnEntObj} type={spawnType} stateId={act.spawnInitialStateId} size={18} />
        </div>
        <button
          type="button"
          onClick={(e) => jumpSub(e, 'choose_spawn_entity')}
          className="text-xs truncate hover:underline cursor-pointer"
          title="Changer l'objet créé"
        >
          {spawnLabel}
        </button>
        <button
          type="button"
          onClick={(e) => jumpSub(e, 'choose_spawn_location')}
          className="text-[10px] text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-1.5 py-0.2 rounded font-medium truncate cursor-pointer"
          title="Régler l'état, l'emplacement, l'impulsion et la taille"
        >
          (Créer - {humanStateName}{tagsBadge}{refBadge}{impulseBadge})
        </button>
      </div>
    );
  }
  if (act.type === 'emit_particles') {
    const originBadge =
      act.particleOriginMode === 'event_point'
        ? ' @Point exact'
        : act.particleOriginMode === 'mouse'
        ? ' @Souris'
        : act.particleOriginMode === 'coordinates'
        ? ` @(${Math.round(act.particleCoords?.x ?? 300)},${Math.round(act.particleCoords?.y ?? 200)})`
        : act.particleOriginMode === 'tag' && act.particleOriginTag
        ? ` @#${act.particleOriginTag}`
        : '';
    const selectedCustomIds =
      act.customParticleIds && act.customParticleIds.length > 0
        ? act.customParticleIds
        : act.customParticleId
        ? [act.customParticleId]
        : [];
    const countLabel =
      act.particleCountMax !== undefined
        ? `${act.particleCount ?? 18}–${act.particleCountMax}x`
        : `${act.particleCount ?? 18}x`;
    const shapeBadge =
      act.particleShape === 'custom' && selectedCustomIds.length > 0
        ? selectedCustomIds.length > 1
          ? `${selectedCustomIds.length} dessins`
          : customParticles.find((p) => p.id === selectedCustomIds[0])?.name || 'Dessin'
        : countLabel;
    const durationBadge =
      (act.particleEmitDuration ?? 0) > 0
        ? ` • ${Number(act.particleEmitDuration!.toFixed(2))}s`
        : '';
    const dirBadge =
      act.particleDirectionMode === 'facing'
        ? ' • Sens'
        : act.particleDirectionMode === 'mouse'
        ? ' • ➔Souris'
        : act.particleDirectionMode === 'toward_target'
        ? ` • ➔${formatRoleLabel('Cible', targetHint)}`
        : act.particleDirectionMode === 'away_target'
        ? ` • ${formatRoleLabel('Opposé', targetHint)}`
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_particles') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          ✨
        </div>
        <span className="text-xs truncate">Particules</span>
        <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({shapeBadge}{durationBadge}{dirBadge}{originBadge})
        </span>
      </div>
    );
  }
  if (act.type === 'attach_to_parent') {
    const childLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Enfant';
    const parentLabel =
      act.parentTargetMode === 'subject'
        ? subjectRoleLabel
        : act.parentTargetMode === 'target'
        ? targetRoleLabel
        : act.parentTargetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.parentTargetMode === 'tag' && act.parentEntityTag
        ? `#${act.parentEntityTag}`
        : act.parentTargetMode === 'entity' && act.parentEntityId
        ? entities[act.parentEntityId]?.name || 'Entité'
        : getEntityObj(act.parentEntityType)?.name || 'Parent';
    const attMode = act.parentOffset?.attachmentMode;
    const modeTag =
      attMode === 'physics_joint'
        ? ' • Joint'
        : attMode === 'spring'
        ? ' • Ressort'
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_attach_parent') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-indigo-400 hover:bg-indigo-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🔗
        </div>
        <span className="text-xs truncate">{childLabel}</span>
        <span className="text-[10px] text-indigo-700 bg-indigo-50 px-1.5 py-0.2 rounded font-medium truncate">
          (➔ {parentLabel}{modeTag}{act.attachDisableCollisions ? ' • Sans collision' : ''})
        </span>
      </div>
    );
  }
  if (act.type === 'detach_parent') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const impulseNote =
      (act.detachImpulseSpeed || 0) > 0
        ? ` 🚀 ${Math.round(act.detachImpulseSpeed!)}px/s @ ${Math.round(act.detachImpulseAngle ?? -45)}°`
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_detach_parent') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-rose-400 hover:bg-rose-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-rose-100 text-rose-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          ✂️
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded font-medium truncate">
          (Détacher{impulseNote})
        </span>
      </div>
    );
  }
  if (act.type === 'snap_to') {
    const srcLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const dstLabel =
      act.snapTargetMode === 'subject'
        ? subjectRoleLabel
        : act.snapTargetMode === 'target'
        ? targetRoleLabel
        : act.snapTargetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.snapTargetMode === 'entity' && act.snapTargetEntityId
        ? entities[act.snapTargetEntityId]?.name || 'Cible'
        : act.snapTargetMode === 'tag' && act.snapTargetTag
        ? `#${act.snapTargetTag}`
        : getEntityObj(act.snapTargetEntityType)?.name || targetRoleLabel;
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_snap_to') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-cyan-400 hover:bg-cyan-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🧲
        </div>
        <span className="text-xs truncate">{srcLabel}</span>
        <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-medium truncate">
          (→ {dstLabel}{act.snapAttachBehavior === 'parent_physics_joint' ? ' • Joint' : ''})
        </span>
      </div>
    );
  }
  if (act.type === 'unsnap') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const impulseNote =
      (act.unsnapImpulseSpeed || 0) > 0
        ? ` 🚀 ${Math.round(act.unsnapImpulseSpeed!)}px/s`
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_unsnap') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-cyan-400 hover:bg-cyan-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🔓
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-medium truncate">
          (Unsnap{impulseNote})
        </span>
      </div>
    );
  }
  if (act.type === 'control_animation') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const mode = act.animControlMode || 'step_frame';
    const modeTxt =
      mode === 'set_frame'
        ? `Frame ${Math.max(1, Math.round(act.animFrameNumber ?? 1))}`
        : mode === 'set_progress'
        ? `${Math.round(act.animProgressPercent ?? 50)}%`
        : mode === 'reset'
        ? 'Reset 0%'
        : `${(act.animStepDelta ?? 1) >= 0 ? '+' : ''}${Math.round(act.animStepDelta ?? 1)} frame${
            act.animLoopOnStep ? ' (loop)' : ''
          }`;
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_control_animation') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-violet-400 hover:bg-violet-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🎞️
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({modeTxt})
        </span>
      </div>
    );
  }
  if (act.type === 'move_entity') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const dist = act.moveDistance ?? 40;
    const dirLabel =
      act.moveDirectionMode === 'angle'
        ? `${act.moveAngle ?? 0}°`
        : act.moveDirectionMode === 'facing'
        ? 'Regard'
        : act.moveDirectionMode === 'toward_target'
        ? formatRoleLabel('Vers cible', targetHint)
        : act.moveDirectionMode === 'away_target'
        ? formatRoleLabel('Fuir cible', targetHint)
        : act.moveCardinal === 'left'
        ? '←'
        : act.moveCardinal === 'up'
        ? '↑'
        : act.moveCardinal === 'down'
        ? '↓'
        : '→';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_move_entity') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-sky-400 hover:bg-sky-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🏃
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded font-medium truncate">
          (+{dist}px {dirLabel})
        </span>
      </div>
    );
  }
  if (act.type === 'apply_impulse') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const strength = Math.round(act.impulseStrength ?? 350);
    const dirLabel =
      act.impulseDirectionMode === 'angle'
        ? `${Math.round(act.impulseAngle ?? -90)}°`
        : act.impulseDirectionMode === 'facing'
        ? 'Regard'
        : act.impulseDirectionMode === 'toward_target'
        ? formatRoleLabel('Vers cible', targetHint)
        : act.impulseDirectionMode === 'away_target'
        ? formatRoleLabel('Repousser', targetHint)
        : act.impulseCardinal === 'left'
        ? '←'
        : act.impulseCardinal === 'right'
        ? '→'
        : act.impulseCardinal === 'down'
        ? '↓'
        : '↑';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_apply_impulse') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-orange-400 hover:bg-orange-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-orange-100 text-orange-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          💥
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-orange-700 bg-orange-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({act.impulseApplyMode === 'set' ? '=' : '+'}{strength}px/s {dirLabel})
        </span>
      </div>
    );
  }
  if (act.type === 'set_entity_enabled') {
    const targetLabel =
      act.targetMode === 'subject'
        ? subjectRoleLabel
        : act.targetMode === 'target'
        ? targetRoleLabel
        : act.targetMode === 'last_spawned'
        ? 'Dernier créé'
        : act.targetMode === 'instance' && act.targetId
        ? entities[act.targetId]?.name || 'Entité'
        : act.targetMode === 'tag' && act.targetTag
        ? `#${act.targetTag}`
        : getEntityObj(act.targetType)?.name || 'Objet';
    const modeLabel =
      act.enabledActionMode === 'enable'
        ? 'Activer'
        : act.enabledActionMode === 'toggle'
        ? 'Basculer'
        : 'Désactiver';
    const scopeLabel =
      act.enabledScope === 'self'
        ? 'seul'
        : act.enabledScope === 'with_parent'
        ? '+parent'
        : act.enabledScope === 'with_children'
        ? '+enfants'
        : act.enabledScope === 'entire_hierarchy'
        ? 'toute la hiérarchie'
        : '';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_set_entity_enabled') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-slate-500 hover:bg-slate-100/70 cursor-pointer transition-colors' : ''
        }`}
      >
        <div className="w-5 h-5 rounded-md bg-slate-200 text-slate-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          ⏻
        </div>
        <span className="text-xs truncate">{targetLabel}</span>
        <span className="text-[10px] text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded font-medium truncate">
          ({modeLabel}{scopeLabel ? ` • ${scopeLabel}` : ''})
        </span>
      </div>
    );
  }
  if (act.type === 'play_sound') {
    const soundLabel = act.customSoundId
      ? customSounds.find((s) => s.id === act.customSoundId)?.name || 'Audio'
      : act.soundType || 'Audio';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_sound') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-purple-400 hover:bg-purple-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
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
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? jumpMain : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-amber-400 hover:bg-amber-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
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
  if (act.type === 'set_variable') {
    const varName = act.variableName || 'score';
    const opSym =
      act.variableOperation === 'add'
        ? '+'
        : act.variableOperation === 'subtract'
        ? '−'
        : act.variableOperation === 'multiply'
        ? '×'
        : '=';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_variable_action') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-sky-400 hover:bg-sky-50/40 cursor-pointer transition-colors' : ''
        }`}
        title="Configurer l'action sur la variable"
      >
        <div className="w-5 h-5 rounded-md bg-sky-100 text-sky-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          📊
        </div>
        <span className="text-xs truncate">{varName}</span>
        <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({opSym} {act.variableValue ?? 1})
        </span>
      </div>
    );
  }
  if (act.type === 'delay') {
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_delay_duration') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-cyan-400 hover:bg-cyan-50/40 cursor-pointer transition-colors' : ''
        }`}
      >
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
  if (act.type === 'change_scene') {
    const targetSceneName = scenes.find((s) => s.id === act.targetSceneId)?.name || 'Scène';
    const transLabel = getSceneTransitionShortLabel(act.sceneTransition);
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_scene_action') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-violet-400 hover:bg-violet-50/40 cursor-pointer transition-colors' : ''
        }`}
        title="Configurer le changement de scène"
      >
        <div className="w-5 h-5 rounded-md bg-violet-100 text-violet-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🎬
        </div>
        <span className="text-xs truncate">Scène → {targetSceneName}</span>
        <span className="text-[10px] text-violet-700 bg-violet-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({transLabel})
        </span>
      </div>
    );
  }
  if (act.type === 'camera_action') {
    const cmd = act.cameraCommand || 'shake';
    const detail =
      cmd === 'shake'
        ? `Secousse ${act.cameraShakeIntensity ?? 12}px`
        : cmd === 'zoom'
        ? `Zoom ${(act.cameraZoom ?? 1.4).toFixed(2)}×`
        : cmd === 'follow'
        ? act.cameraFollowMode === 'none'
          ? 'Suivi OFF'
          : act.cameraTargetMode === 'subject'
          ? `Suivre ${subjectRoleLabel}`
          : act.cameraTargetMode === 'target'
          ? `Suivre ${targetRoleLabel}`
          : act.cameraTargetMode === 'last_spawned'
          ? 'Suivre dernier'
          : (act.cameraFollowMode === 'tag' || act.cameraTargetMode === 'tag') && act.cameraTargetTag
          ? `Suivre #${act.cameraTargetTag}`
          : act.cameraFollowMode === 'entity' && act.cameraTargetId
          ? `Suivre ${entities[act.cameraTargetId]?.name || 'Entité'}`
          : (act.cameraFollowMode === 'type' || act.cameraTargetMode === 'type') && act.cameraTargetType
          ? `Suivre ${getEntityObj(act.cameraTargetType)?.name || act.cameraTargetType}`
          : `Suivre ${targetRoleLabel}`
        : cmd === 'move_to'
        ? act.cameraPosition
          ? `Aller (${Math.round(act.cameraPosition.x)}, ${Math.round(act.cameraPosition.y)})`
          : `Aller sur ${act.cameraTargetMode === 'subject' ? subjectRoleLabel : targetRoleLabel}`
        : 'Reset';
    return (
      <div
        role={canJump ? 'button' : undefined}
        tabIndex={canJump ? 0 : undefined}
        onClick={canJump ? (e) => jumpSub(e, 'choose_camera_action') : undefined}
        className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
          canJump ? 'hover:border-cyan-400 hover:bg-cyan-50/40 cursor-pointer transition-colors' : ''
        }`}
        title="Configurer l'action Caméra"
      >
        <div className="w-5 h-5 rounded-md bg-cyan-100 text-cyan-700 flex items-center justify-center text-[10px] shrink-0 font-black">
          🎥
        </div>
        <span className="text-xs truncate">Caméra</span>
        <span className="text-[10px] text-cyan-700 bg-cyan-50 px-1.5 py-0.2 rounded font-medium truncate">
          ({detail})
        </span>
      </div>
    );
  }
  return (
    <div
      role={canJump ? 'button' : undefined}
      tabIndex={canJump ? 0 : undefined}
      onClick={canJump ? jumpMain : undefined}
      className={`flex items-center gap-1.5 font-bold text-slate-800 bg-white border border-slate-200/90 rounded-xl px-2 py-1 shadow-2xs shrink-0 ${
        canJump ? 'hover:border-indigo-400 cursor-pointer transition-colors' : ''
      }`}
    >
      <span className="text-xs">⚡ {act.type}</span>
    </div>
  );
};
