import {
  DraggableBehaviorConfig,
  Entity,
  EntityBehavior,
  EntityState,
  InteractivePuppetBehaviorConfig,
  PhysicsBehaviorConfig,
  SliderBehaviorConfig,
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
 * Détermine si une entité est déplaçable à la souris, si l'inertie de lancer est activée,
 * et si le mode saisie physique précise / balancement depuis le point saisi / slider contraint est demandé.
 */
export function isEntityDraggable(entity: Entity, currentState?: EntityState): {
  canDrag: boolean;
  hasSlider: boolean;
  throwable: boolean;
  maxThrowSpeed: number;
  hasDynamicPhysics: boolean;
  precisePhysicsGrab: boolean;
  swingAroundGrabPoint: boolean;
  grabRotationMode: 'free' | 'damped_limited';
  grabMaxAngle: number;
  grabBrakeAngle: number;
  grabAngularStiffness: number;
  grabAngularDamping: number;
} {
  const effective = getEffectiveBehaviors(entity, currentState);
  const sliderBehavior = effective.find((b) => b.type === 'slider') as SliderBehaviorConfig | undefined;
  const puppetBehavior = effective.find((b) => b.type === 'interactive_puppet') as
    | InteractivePuppetBehaviorConfig
    | undefined;
  const dragBehavior = effective.find((b) => b.type === 'draggable') as DraggableBehaviorConfig | undefined;
  const physics = effective.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;

  const attachMode = entity.parentOffset?.attachmentMode || 'rigid';
  const isDynamicAttachedChild = Boolean(
    entity.parentId &&
      (attachMode === 'physics_joint' ||
        (attachMode === 'spring' && entity.parentOffset?.collideWithWorld === true))
  );

  // Une entité a de la physique dynamique si Physics non-statique OU si c'est un enfant articulé en physics_joint / spring+monde
  const hasDynamicPhysics = (!!physics && physics.isStatic !== true) || isDynamicAttachedChild;

  // Priorité stricte au composant Slider contraint (évite tout conflit avec Draggable/Marionnette)
  if (sliderBehavior && sliderBehavior.enabled !== false) {
    return {
      canDrag: true,
      hasSlider: true,
      throwable: false,
      maxThrowSpeed: 0,
      hasDynamicPhysics: false,
      precisePhysicsGrab: false,
      swingAroundGrabPoint: false,
      grabRotationMode: 'free',
      grabMaxAngle: 45,
      grabBrakeAngle: 15,
      grabAngularStiffness: 140,
      grabAngularDamping: 8,
    };
  }

  if (puppetBehavior && puppetBehavior.enabled !== false) {
    const grabSource =
      puppetBehavior.precisePhysicsGrab || !dragBehavior?.precisePhysicsGrab
        ? puppetBehavior
        : dragBehavior;
    return {
      canDrag: true,
      hasSlider: false,
      throwable: puppetBehavior.throwable !== false && hasDynamicPhysics,
      maxThrowSpeed: puppetBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
      precisePhysicsGrab:
        Boolean(puppetBehavior.precisePhysicsGrab || dragBehavior?.precisePhysicsGrab) &&
        hasDynamicPhysics,
      swingAroundGrabPoint: Boolean(puppetBehavior.swingAroundGrabPoint),
      grabRotationMode: grabSource.grabRotationMode || 'free',
      grabMaxAngle: grabSource.grabMaxAngle ?? 45,
      grabBrakeAngle: grabSource.grabBrakeAngle ?? 15,
      grabAngularStiffness: grabSource.grabAngularStiffness ?? 140,
      grabAngularDamping: grabSource.grabAngularDamping ?? 8,
    };
  }

  if (dragBehavior) {
    return {
      canDrag: dragBehavior.enabled !== false,
      hasSlider: false,
      throwable: dragBehavior.throwable !== false && hasDynamicPhysics,
      maxThrowSpeed: dragBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
      precisePhysicsGrab: Boolean(dragBehavior.precisePhysicsGrab) && hasDynamicPhysics,
      swingAroundGrabPoint: false,
      grabRotationMode: dragBehavior.grabRotationMode || 'free',
      grabMaxAngle: dragBehavior.grabMaxAngle ?? 45,
      grabBrakeAngle: dragBehavior.grabBrakeAngle ?? 15,
      grabAngularStiffness: dragBehavior.grabAngularStiffness ?? 140,
      grabAngularDamping: dragBehavior.grabAngularDamping ?? 8,
    };
  }

  // Par défaut en mode Play, les entités ne sont PAS draggables sans composant actif
  return {
    canDrag: false,
    hasSlider: false,
    throwable: false,
    maxThrowSpeed: 1500,
    hasDynamicPhysics,
    precisePhysicsGrab: false,
    swingAroundGrabPoint: false,
    grabRotationMode: 'free',
    grabMaxAngle: 45,
    grabBrakeAngle: 15,
    grabAngularStiffness: 140,
    grabAngularDamping: 8,
  };
}
