import {
  DraggableBehaviorConfig,
  Entity,
  EntityBehavior,
  EntityState,
  InteractivePuppetBehaviorConfig,
  PhysicsBehaviorConfig,
} from '../../types';

/**
 * Résout les comportements effectifs d'une entité pour son état actuel
 * en fusionnant la configuration de base avec les surcharges de l'état.
 */
export function getEffectiveBehaviors(
  entity: Entity,
  currentState?: EntityState
): EntityBehavior[] {
  const baseBehaviors = entity.behaviors || [];
  const overrides = currentState?.behaviorOverrides || {};

  return baseBehaviors
    .map((b) => {
      const override = overrides[b.id];
      if (!override) {
        return b.enabled ? b : null;
      }
      if (override.enabled === false) {
        return null;
      }
      return {
        ...b,
        ...override,
        enabled: override.enabled ?? b.enabled,
      } as EntityBehavior;
    })
    .filter((b): b is EntityBehavior => b !== null && b.enabled !== false);
}

/**
 * Détermine si une entité est déplaçable à la souris et si l'inertie de lancer est activée.
 * L'inertie de lancer (throwable) n'est active que si l'entité dispose d'une physique dynamique (pas statique).
 */
export function isEntityDraggable(entity: Entity, currentState?: EntityState): {
  canDrag: boolean;
  throwable: boolean;
  maxThrowSpeed: number;
  hasDynamicPhysics: boolean;
} {
  const effective = getEffectiveBehaviors(entity, currentState);
  const puppetBehavior = effective.find((b) => b.type === 'interactive_puppet') as
    | InteractivePuppetBehaviorConfig
    | undefined;
  const dragBehavior = effective.find((b) => b.type === 'draggable') as DraggableBehaviorConfig | undefined;
  const physics = effective.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;

  // Une entité n'a de physique dynamique que si le composant 'physics' est présent et n'est pas statique
  const hasDynamicPhysics = !!physics && physics.isStatic !== true;

  if (puppetBehavior && puppetBehavior.enabled !== false) {
    return {
      canDrag: true,
      throwable: puppetBehavior.throwable !== false && hasDynamicPhysics,
      maxThrowSpeed: puppetBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
    };
  }

  if (dragBehavior) {
    return {
      canDrag: dragBehavior.enabled !== false,
      throwable: dragBehavior.throwable !== false && hasDynamicPhysics,
      maxThrowSpeed: dragBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
    };
  }

  // Par défaut en mode Play, les entités ne sont PAS draggables sans composant actif
  return {
    canDrag: false,
    throwable: false,
    maxThrowSpeed: 1500,
    hasDynamicPhysics,
  };
}
