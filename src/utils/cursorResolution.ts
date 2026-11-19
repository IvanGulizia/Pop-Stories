import { DynamicRule, Entity } from '../types';
import { matchesEntityFilter } from '../store/collisionHelpers';
import { CursorState } from './cursorIcons';

/**
 * Vérifie si une entité possède au moins une règle active de type 'click' qui la cible
 * (par instance, type, tag normalisé ou 'any').
 */
export function hasEntityClickRules(target: Entity, rules: DynamicRule[]): boolean {
  return rules.some(
    (r) =>
      r.enabled &&
      r.trigger.type === 'click' &&
      matchesEntityFilter(
        target,
        r.trigger.subjectMode,
        r.trigger.subjectId,
        r.trigger.subjectType,
        r.trigger.subjectTag
      )
  );
}

export interface EntityCursorContext {
  appMode: 'edit' | 'play' | string;
  canDrag: boolean;
  hasClickRules: boolean;
}

/**
 * Calcule l'état du curseur personnalisé lors du survol d'une entité.
 */
export function resolveEntityHoverCursorState({
  appMode,
  canDrag,
  hasClickRules,
}: EntityCursorContext): CursorState {
  if (appMode !== 'play') {
    if (canDrag && hasClickRules) return 'hover_drag_click';
    if (canDrag) return 'hover_drag';
    return 'hover_click';
  }

  if (canDrag && hasClickRules) {
    return 'hover_drag_click';
  }
  if (canDrag) {
    return 'hover_drag';
  }
  if (hasClickRules) {
    return 'hover_click';
  }
  return 'idle';
}

/**
 * Calcule l'état du curseur personnalisé lors du clic (pointerDown) en mode Play.
 * Un objet non-draggable sans règle de clic reste en 'idle' (jamais 'click').
 */
export function resolveEntityPressCursorState({
  appMode,
  canDrag,
  hasClickRules,
}: EntityCursorContext): CursorState {
  if (canDrag) {
    return 'drag';
  }
  if (appMode !== 'play' || hasClickRules) {
    return 'click';
  }
  return 'idle';
}

/**
 * Calcule la classe CSS de curseur natif lorsque le curseur custom est désactivé.
 */
export function resolveNativeHitboxCursorClass({
  hideNativeCursor,
  appMode,
  canDrag,
  hasClickRules,
}: EntityCursorContext & { hideNativeCursor: boolean }): string {
  if (hideNativeCursor) {
    return '';
  }
  if (canDrag) {
    return 'cursor-grab active:cursor-grabbing';
  }
  if (appMode !== 'play' || hasClickRules) {
    return 'cursor-pointer';
  }
  return 'cursor-default';
}
