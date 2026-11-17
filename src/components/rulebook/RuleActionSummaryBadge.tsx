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
import { ActionModalSubStep } from './ruleBookTypes';

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
      act.targetMode === 'last_spawned'
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
      act.targetMode === 'last_spawned'
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
          title="Régler l'état, l'emplacement et la taille"
        >
          (Créer - {humanStateName}{tagsBadge}{refBadge})
        </button>
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
    const selectedCustomIds =
      act.customParticleIds && act.customParticleIds.length > 0
        ? act.customParticleIds
        : act.customParticleId
        ? [act.customParticleId]
        : [];
    const shapeBadge =
      act.particleShape === 'custom' && selectedCustomIds.length > 0
        ? selectedCustomIds.length > 1
          ? `${selectedCustomIds.length} dessins`
          : customParticles.find((p) => p.id === selectedCustomIds[0])?.name || 'Dessin'
        : `${act.particleCount ?? 18}x`;
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
          (Détacher)
        </span>
      </div>
    );
  }
  if (act.type === 'move_entity') {
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
    const dist = act.moveDistance ?? 40;
    const dirLabel =
      act.moveDirectionMode === 'angle'
        ? `${act.moveAngle ?? 0}°`
        : act.moveDirectionMode === 'facing'
        ? 'Regard'
        : act.moveDirectionMode === 'toward_target'
        ? 'Vers cible'
        : act.moveDirectionMode === 'away_target'
        ? 'Fuir cible'
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
