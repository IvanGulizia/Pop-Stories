import React from 'react';
import { Plus, Zap } from 'lucide-react';
import { TriggerPhase, TriggerType } from '../../types';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';
import { findMatchingRulesForBehaviorEvent } from '../../utils/ruleLinkHelpers';

interface BehaviorRuleShortcutButtonProps {
  entityId?: string;
  triggerType: TriggerType;
  triggerPhase?: TriggerPhase;
  label: string;
  suggestedRuleName?: string;
  compact?: boolean;
}

export function BehaviorRuleShortcutButton({
  entityId,
  triggerType,
  triggerPhase,
  label,
  suggestedRuleName,
  compact = false,
}: BehaviorRuleShortcutButtonProps) {
  const entities = useSceneStore((s) => s.entities || EMPTY_RECORD);
  const customArchetypes = useSceneStore((s) => s.customArchetypes || EMPTY_RECORD);
  const rules = useSceneStore((s) => s.rules || EMPTY_LIST);
  const openRuleBookFromBehavior = useSceneStore((s) => s.openRuleBookFromBehavior);

  const entity = React.useMemo(() => {
    if (!entityId) return undefined;
    return (
      entities[entityId] ||
      Object.values(customArchetypes).find((arch) => arch.id === entityId)
    );
  }, [entities, customArchetypes, entityId]);

  const matchingRules = React.useMemo(
    () => findMatchingRulesForBehaviorEvent(rules, entity, triggerType, triggerPhase),
    [rules, entity, triggerType, triggerPhase]
  );

  if (!entity) return null;

  const count = matchingRules.length;

  const triggerOpen = (mode: 'filter' | 'create') => {
    openRuleBookFromBehavior({
      mode,
      entityId: entity.id,
      entityType: entity.type,
      entityName: entity.name,
      triggerType,
      triggerPhase,
      label,
      suggestedRuleName: suggestedRuleName || `${entity.name} — ${label}`,
    });
  };

  if (count > 0 && !compact) {
    return (
      <div className="inline-flex items-stretch rounded-lg border border-amber-300 bg-amber-100/90 shadow-2xs overflow-hidden shrink-0">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerOpen('filter');
          }}
          className="inline-flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-bold text-amber-950 hover:bg-amber-200/80 transition-colors cursor-pointer active:scale-[0.98]"
          title={`Voir ${count} règle${count > 1 ? 's' : ''} liée${count > 1 ? 's' : ''} à « ${label} » dans le RuleBook`}
        >
          <Zap className="w-3 h-3 text-amber-600 fill-amber-500 shrink-0" />
          <span className="truncate max-w-[165px]">{label}</span>
          <span className="px-1 py-0 rounded bg-amber-200/90 text-amber-950 text-[9.5px] font-extrabold tabular-nums">
            {count}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            triggerOpen('create');
          }}
          className="px-1.5 py-0.5 border-l border-amber-300/90 bg-amber-50/70 hover:bg-amber-200 text-amber-800 hover:text-amber-950 transition-colors cursor-pointer flex items-center justify-center"
          title={`Créer une nouvelle règle « ${label} »`}
          aria-label={`Créer une règle ${label}`}
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        triggerOpen(count > 0 ? 'filter' : 'create');
      }}
      className={`inline-flex items-center gap-1 rounded-lg border font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-[10.5px]'
      } ${
        count > 0
          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-2xs'
          : 'bg-white hover:bg-amber-50 text-slate-600 hover:text-amber-800 border-slate-200 hover:border-amber-300'
      }`}
      title={
        count > 0
          ? `Voir ${count} règle${count > 1 ? 's' : ''} liée${count > 1 ? 's' : ''} à « ${label} » dans le RuleBook`
          : `Créer une règle RuleBook déclenchée par « ${label} »`
      }
    >
      <Zap
        className={`w-3 h-3 shrink-0 ${count > 0 ? 'text-amber-600 fill-amber-500' : 'text-amber-500'}`}
      />
      {!compact ? (
        <span>{count > 0 ? `${label} (${count})` : `+ ${label}`}</span>
      ) : count > 0 ? (
        <span>{count}</span>
      ) : null}
    </button>
  );
}
