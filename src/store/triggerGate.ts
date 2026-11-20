import { DynamicRule } from '../types';

let playSessionStartedAt = Date.now();

export const ruleFireCounts: Record<string, number> = {};
export const ruleLastFireTimestamps: Record<string, number> = {};
export const contextCooldownTimestamps: Record<string, number> = {};
export const ruleConditionWasTrue: Record<string, boolean> = {};

export function getPlaySessionStartedAt(): number {
  return playSessionStartedAt;
}

export function resetPlaySessionClock(now: number = Date.now()): void {
  playSessionStartedAt = now;
}

export function clearTriggerGateState(): void {
  Object.keys(ruleFireCounts).forEach((k) => delete ruleFireCounts[k]);
  Object.keys(ruleLastFireTimestamps).forEach((k) => delete ruleLastFireTimestamps[k]);
  Object.keys(contextCooldownTimestamps).forEach((k) => delete contextCooldownTimestamps[k]);
  Object.keys(ruleConditionWasTrue).forEach((k) => delete ruleConditionWasTrue[k]);
}

export function getRuleFireCount(ruleId: string): number {
  return ruleFireCounts[ruleId] || 0;
}

export interface TriggerGateOptions {
  cooldownKey?: string;
  edgeKey?: string;
  useEdgeGating?: boolean;
}

export function canRuleFireWithGate(
  rule: DynamicRule,
  now: number,
  defaultCooldownMs: number,
  options?: TriggerGateOptions
): boolean {
  const startDelaySec = rule.trigger.triggerStartDelaySec ?? 0;
  if (startDelaySec > 0 && now - playSessionStartedAt < startDelaySec * 1000) {
    return false;
  }

  const maxCount = Math.floor(rule.trigger.triggerMaxCount ?? 0);
  if (maxCount > 0 && (ruleFireCounts[rule.id] || 0) >= maxCount) {
    return false;
  }

  if (options?.useEdgeGating && rule.trigger.triggerRequireReset) {
    const eKey = options.edgeKey || rule.id;
    if (ruleConditionWasTrue[eKey]) {
      return false;
    }
  }

  const customCooldownSec = rule.trigger.triggerCooldownSec ?? 0;
  if (customCooldownSec > 0) {
    const customCooldownMs = customCooldownSec * 1000;
    if (now - (ruleLastFireTimestamps[rule.id] || 0) < customCooldownMs) {
      return false;
    }
  } else if (defaultCooldownMs > 0) {
    const effectiveDefault =
      options?.useEdgeGating && rule.trigger.triggerRequireReset
        ? 0
        : defaultCooldownMs;
    const cKey = options?.cooldownKey || rule.id;
    if (now - (contextCooldownTimestamps[cKey] || 0) < effectiveDefault) {
      return false;
    }
  }

  return true;
}

export function markContinuousConditionFalse(rule: DynamicRule, edgeKey?: string): void {
  if (!rule.trigger.triggerRequireReset) return;
  const eKey = edgeKey || rule.id;
  if (ruleConditionWasTrue[eKey]) {
    ruleConditionWasTrue[eKey] = false;
  }
}

export function recordRuleFired(
  rule: DynamicRule,
  now: number,
  options?: Pick<TriggerGateOptions, 'cooldownKey' | 'edgeKey'>
): void {
  ruleFireCounts[rule.id] = (ruleFireCounts[rule.id] || 0) + 1;
  ruleLastFireTimestamps[rule.id] = now;
  const cKey = options?.cooldownKey || rule.id;
  contextCooldownTimestamps[cKey] = now;
  if (rule.trigger.triggerRequireReset) {
    const eKey = options?.edgeKey || rule.id;
    ruleConditionWasTrue[eKey] = true;
  }
}
