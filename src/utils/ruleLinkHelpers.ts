import { DynamicRule, Entity, TriggerPhase, TriggerType } from '../types';

export interface RuleBookShortcutIntent {
  mode: 'filter' | 'create';
  entityId: string;
  entityType: string;
  entityName: string;
  triggerType: TriggerType;
  triggerPhase?: TriggerPhase;
  label: string;
  suggestedRuleName?: string;
}

function matchesPhase(
  rule: DynamicRule,
  expectedType: TriggerType,
  expectedPhase?: TriggerPhase
): boolean {
  if (!expectedPhase) return true;
  const actual = rule.trigger.phase;
  if (!actual) {
    // Règles historiques sans phase explicite
    if (expectedType === 'snap') return expectedPhase === 'enter';
    if (expectedType === 'collision') return expectedPhase === 'enter';
    if (expectedType === 'hover') return expectedPhase === 'hover_enter' || expectedPhase === 'enter';
    if (expectedType === 'drag') return expectedPhase === 'drag_release';
    return true;
  }
  if (actual === expectedPhase) return true;
  if (expectedType === 'hover') {
    if (expectedPhase === 'hover_enter' && actual === 'enter') return true;
    if (expectedPhase === 'enter' && actual === 'hover_enter') return true;
    if (expectedPhase === 'hover_exit' && actual === 'exit') return true;
    if (expectedPhase === 'exit' && actual === 'hover_exit') return true;
  }
  if (expectedType === 'collision') {
    if (expectedPhase === 'exit' && actual === 'release') return true;
    if (expectedPhase === 'release' && actual === 'exit') return true;
  }
  return false;
}

export function doesRuleMatchEntityAndTrigger(
  rule: DynamicRule,
  entity: Entity,
  triggerType: TriggerType,
  triggerPhase?: TriggerPhase
): boolean {
  const trig = rule.trigger;
  if (!trig) return false;

  const typeMatches =
    trig.type === triggerType ||
    (triggerType === 'joint_break' && trig.phase === 'joint_break') ||
    (triggerType === 'target_arrived' && trig.phase === 'target_arrived');

  if (!typeMatches) return false;
  if (!matchesPhase(rule, triggerType, triggerPhase)) return false;

  const entityTags = new Set((entity.tags || []).map((t) => t.trim().toLowerCase()));

  const matchesSubject =
    trig.subjectMode === 'any' ||
    (trig.subjectMode === 'instance' && trig.subjectId === entity.id) ||
    (trig.subjectMode === 'type' && trig.subjectType === entity.type) ||
    (trig.subjectMode === 'tag' &&
      Boolean(trig.subjectTag) &&
      entityTags.has(trig.subjectTag!.trim().replace(/^#/, '').toLowerCase())) ||
    (!trig.subjectMode && trig.subjectType === entity.type);

  if (matchesSubject) return true;

  // Pour les règles relationnelles (collision, snap, proximity, target_arrived), vérifier aussi si l'entité est Cible
  if (trig.targetMode) {
    const matchesTarget =
      (trig.targetMode === 'instance' && trig.targetId === entity.id) ||
      (trig.targetMode === 'type' && trig.targetType === entity.type) ||
      (trig.targetMode === 'tag' &&
        Boolean(trig.targetTag) &&
        entityTags.has(trig.targetTag!.trim().replace(/^#/, '').toLowerCase()));
    if (matchesTarget) return true;
  }

  return false;
}

export function findMatchingRulesForBehaviorEvent(
  rules: DynamicRule[],
  entity: Entity | undefined | null,
  triggerType: TriggerType,
  triggerPhase?: TriggerPhase
): DynamicRule[] {
  if (!entity) return [];
  return (rules || []).filter((rule) =>
    doesRuleMatchEntityAndTrigger(rule, entity, triggerType, triggerPhase)
  );
}
