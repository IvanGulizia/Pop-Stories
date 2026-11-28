import React from 'react';
import { Zap } from 'lucide-react';
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
  compact = true,
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

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        openRuleBookFromBehavior({
          mode: count > 0 ? 'filter' : 'create',
          entityId: entity.id,
          entityType: entity.type,
          entityName: entity.name,
          triggerType,
          triggerPhase,
          label,
          suggestedRuleName: suggestedRuleName || `${entity.name} — ${label}`,
        });
      }}
      className={`inline-flex items-center gap-1 rounded-lg border font-bold transition-all cursor-pointer shrink-0 active:scale-95 ${
        compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
      } ${
        count > 0
          ? 'bg-amber-100 hover:bg-amber-200 text-amber-900 border-amber-300 shadow-2xs'
          : 'bg-white hover:bg-amber-50 text-slate-500 hover:text-amber-700 border-slate-200 hover:border-amber-300'
      }`}
      title={
        count > 0
          ? `Voir ${count} règle${count > 1 ? 's' : ''} liée${count > 1 ? 's' : ''} à « ${label} » dans le RuleBook`
          : `Créer une règle RuleBook déclenchée par « ${label} »`
      }
    >
      <Zap
        className={`w-3 h-3 ${count > 0 ? 'text-amber-600 fill-amber-500' : 'text-amber-500'}`}
      />
      {count > 0 ? <span>{count}</span> : !compact && <span>Règle</span>}
    </button>
  );
}
