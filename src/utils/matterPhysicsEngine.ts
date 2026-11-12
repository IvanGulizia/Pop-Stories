import Matter from 'matter-js';
import {
  Entity,
  EntityBehavior,
  EntityState,
  Position,
  PhysicsBehaviorConfig,
  DraggableBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  LookAtBehaviorConfig,
  FollowBehaviorConfig,
  MoveToBehaviorConfig,
  PatrolBehaviorConfig,
  KeyboardControlBehaviorConfig,
  BoundaryBehaviorConfig,
} from '../types';
import { getEntityColliderBounds } from './collider';

const { Engine, World, Bodies, Body } = Matter;

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
  const dragBehavior = effective.find((b) => b.type === 'draggable') as DraggableBehaviorConfig | undefined;
  const physics = effective.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;

  // Une entité n'a de physique dynamique que si le composant 'physics' est présent et n'est pas statique
  const hasDynamicPhysics = !!physics && physics.isStatic !== true;

  if (dragBehavior) {
    return {
      canDrag: dragBehavior.enabled !== false,
      throwable: (dragBehavior.throwable !== false) && hasDynamicPhysics,
      maxThrowSpeed: dragBehavior.maxThrowSpeed || 1500,
      hasDynamicPhysics,
    };
  }

  // Rétrocompatibilité avec la propriété entity.isDraggable
  return {
    canDrag: entity.isDraggable !== false,
    throwable: hasDynamicPhysics,
    maxThrowSpeed: 1500,
    hasDynamicPhysics,
  };
}

// État mémoire de la simulation Matter.js
let engine: Matter.Engine | null = null;
const bodyMap = new Map<string, Matter.Body>();
const colliderOffsets = new Map<string, { relCenterX: number; relCenterY: number }>();
const bodySignatures = new Map<string, string>();
const boundaryBodies: Matter.Body[] = [];
const patrolStates = new Map<string, { direction: 1 | -1; timer: number; initialPos: Position }>();
const activeKeys = new Set<string>();
let listenersAttached = false;

function handleKeyDown(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.add(e.key.toLowerCase());
  activeKeys.add(e.code);
}

function handleKeyUp(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  activeKeys.delete(e.key.toLowerCase());
  activeKeys.delete(e.code);
}

export function startKeyboardListening() {
  if (listenersAttached || typeof window === 'undefined') return;
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  listenersAttached = true;
}

export function stopKeyboardListening() {
  if (!listenersAttached || typeof window === 'undefined') return;
  window.removeEventListener('keydown', handleKeyDown);
  window.removeEventListener('keyup', handleKeyUp);
  activeKeys.clear();
  listenersAttached = false;
}

const activePhysicsCollisionPairs = new Set<string>();

export function getActivePhysicsCollisionPairs(): Set<string> {
  return activePhysicsCollisionPairs;
}

export function resetMatterPhysicsRuntime() {
  if (engine) {
    World.clear(engine.world, false);
    Engine.clear(engine);
    engine = null;
  }
  bodyMap.clear();
  colliderOffsets.clear();
  bodySignatures.clear();
  boundaryBodies.length = 0;
  patrolStates.clear();
  activeKeys.clear();
  activePhysicsCollisionPairs.clear();
}

/**
 * Injecte instantanément une vitesse physique dans un corps Matter.js (ex: lancer à la souris)
 * vx et vy sont fournis en px/s et convertis rigoureusement en unités de pas Matter.js (~60Hz).
 */
export function setEntityRuntimeVelocity(entityId: string, vx: number, vy: number) {
  const body = bodyMap.get(entityId);
  if (body) {
    // Si l'objet est statique (pas de physique dynamique), refuser toute impulsion
    if (body.isStatic) return;

    Matter.Sleeping.set(body, false);

    // Conversion px/s -> px/frame Matter.js (~60Hz)
    const matterVx = vx / 60;
    const matterVy = vy / 60;

    // Plafond de sécurité absolu (max 25 px/frame = 1500 px/s)
    const maxSpeedPerTick = 25;
    const speed = Math.hypot(matterVx, matterVy);
    let finalVx = matterVx;
    let finalVy = matterVy;
    if (speed > maxSpeedPerTick) {
      finalVx = (matterVx / speed) * maxSpeedPerTick;
      finalVy = (matterVy / speed) * maxSpeedPerTick;
    }

    Body.setVelocity(body, { x: finalVx, y: finalVy });
  }
}

/**
 * Synchronise la position d'un corps pendant un drag manuel à la souris
 * en tenant compte du décalage exact du collider calculé depuis le mode dessin.
 */
export function syncEntityDragPosition(
  entityId: string,
  left: number,
  top: number,
  width?: number,
  height?: number
) {
  const body = bodyMap.get(entityId);
  if (body) {
    const offset = colliderOffsets.get(entityId) || {
      relCenterX: (width ?? 100) / 2,
      relCenterY: (height ?? 100) / 2,
    };
    const cx = left + offset.relCenterX;
    const cy = top + offset.relCenterY;
    Matter.Sleeping.set(body, false);
    Body.setPosition(body, { x: cx, y: cy });
    Body.setVelocity(body, { x: 0, y: 0 });
  }
}

export interface PhysicsTickResult {
  updatedTransforms: Record<string, { position: Position; rotation?: number }>;
}

/**
 * Initialise le monde physique Matter.js avec les entités et bordures de scène
 * en calibrant les corps rigides rigoureusement sur les colliders verts du mode dessin.
 */
function ensurePhysicsWorld(canvasBounds: { width: number; height: number }, entities: Record<string, Entity>) {
  if (!engine) {
    engine = Engine.create({
      gravity: { x: 0, y: 1, scale: 0.001 },
      enableSleeping: false,
    });

    // Écouteur de collisions pour capture temps-réel et rebond calibré
    Matter.Events.on(engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const idA = pair.bodyA.label;
        const idB = pair.bodyB.label;
        if (idA && idB) {
          activePhysicsCollisionPairs.add(`${idA}:::${idB}`);
          activePhysicsCollisionPairs.add(`${idB}:::${idA}`);
        }

        // Calibrage du rebond selon la surface heurtée
        const isWallA = idA.startsWith('boundary_');
        const isWallB = idB.startsWith('boundary_');
        if (isWallA || isWallB) {
          const entityBody = isWallA ? pair.bodyB : pair.bodyA;
          pair.restitution = entityBody.restitution || 0.0;
        } else {
          pair.restitution = Math.max(pair.bodyA.restitution || 0, pair.bodyB.restitution || 0);
        }
      });
    });

    Matter.Events.on(engine, 'collisionActive', (event) => {
      event.pairs.forEach((pair) => {
        const idA = pair.bodyA.label;
        const idB = pair.bodyB.label;
        if (idA && idB) {
          activePhysicsCollisionPairs.add(`${idA}:::${idB}`);
          activePhysicsCollisionPairs.add(`${idB}:::${idA}`);
        }
      });
    });
  }

  // Création / mise à jour des bordures solides de scène
  // wallThickness placé strictement à l'extérieur des coordonnées [0, w] et [0, h]
  const wallThickness = 100;
  const w = Math.max(100, canvasBounds.width);
  const h = Math.max(100, canvasBounds.height);

  if (boundaryBodies.length === 0) {
    // Murs avec restitution neutre 0.0 : le rebond est déterminé par la variable rebond de l'entité
    const ground = Bodies.rectangle(w / 2, h + wallThickness / 2, w * 3, wallThickness, {
      isStatic: true,
      label: 'boundary_ground',
      restitution: 0.0,
      friction: 0.1,
    });
    const ceiling = Bodies.rectangle(w / 2, -wallThickness / 2, w * 3, wallThickness, {
      isStatic: true,
      label: 'boundary_ceiling',
      restitution: 0.0,
      friction: 0.1,
    });
    const leftWall = Bodies.rectangle(-wallThickness / 2, h / 2, wallThickness, h * 3, {
      isStatic: true,
      label: 'boundary_left',
      restitution: 0.0,
      friction: 0.1,
    });
    const rightWall = Bodies.rectangle(w + wallThickness / 2, h / 2, wallThickness, h * 3, {
      isStatic: true,
      label: 'boundary_right',
      restitution: 0.0,
      friction: 0.1,
    });

    boundaryBodies.push(ground, ceiling, leftWall, rightWall);
    World.add(engine.world, boundaryBodies);
  } else {
    // Repositionner les murs si la taille du canvas a changé
    Body.setPosition(boundaryBodies[0], { x: w / 2, y: h + wallThickness / 2 });
    Body.setPosition(boundaryBodies[1], { x: w / 2, y: -wallThickness / 2 });
    Body.setPosition(boundaryBodies[2], { x: -wallThickness / 2, y: h / 2 });
    Body.setPosition(boundaryBodies[3], { x: w + wallThickness / 2, y: h / 2 });
  }

  // Synchronisation des corps d'entités dans Matter.World
  const entityList = Object.values(entities);
  const currentEntityIds = new Set(entityList.map((e) => e.id));

  // Retirer les corps des entités détruites
  for (const [id, body] of bodyMap.entries()) {
    if (!currentEntityIds.has(id)) {
      World.remove(engine.world, body);
      bodyMap.delete(id);
      colliderOffsets.delete(id);
      bodySignatures.delete(id);
      patrolStates.delete(id);
    }
  }

  // Créer ou mettre à jour les corps existants
  for (const entity of entityList) {
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);

    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;
    const hasMovement = effectiveBehaviors.some((b) =>
      ['keyboard_control', 'constant_velocity', 'patrol', 'move_to', 'follow'].includes(b.type)
    );

    // RÈGLE D'OR : Sans composant physics explicite, l'objet n'a PAS de physique dynamique.
    // - S'il n'a ni physics ni mouvement : isStatic = true (obstacle inamovible, zéro gravité).
    // - S'il n'a pas physics mais a un comportement de mouvement (ex: patrouille, clavier) : isStatic = false, mais gravité annulée.
    // - S'il a le composant physics : isStatic = physics.isStatic === true.
    let isStatic = true;
    if (physics) {
      isStatic = physics.isStatic === true;
    } else if (hasMovement) {
      isStatic = false;
    }

    const isSensor = physics?.isTrigger === true;

    // Calcul précis du collider issu du mode dessin (coordonnées viewBox 200x200)
    const geom = getEntityColliderBounds(entity, currentState);
    const scale = currentState?.scale ?? 1;
    const scaleX = (entity.size.width * scale) / 200;
    const scaleY = (entity.size.height * scale) / 200;

    const relCenterX = geom.centerX * scaleX;
    const relCenterY = geom.centerY * scaleY;
    const worldCenterX = entity.position.x + relCenterX;
    const worldCenterY = entity.position.y + relCenterY;
    const colliderType = geom.colliderType;

    const colliderWidth = Math.max(12, Math.round(geom.width * scaleX));
    const colliderHeight = Math.max(12, Math.round(geom.height * scaleY));
    const colliderRadius = Math.max(6, Math.round(geom.radius * Math.max(scaleX, scaleY)));

    const signature = `${colliderType}_${colliderWidth}_${colliderHeight}_${colliderRadius}_${isStatic}_${isSensor}`;
    let body = bodyMap.get(entity.id);

    // Si le corps n'existe pas ou si la forme du collider a été modifiée dans le mode dessin, le recréer
    if (!body || bodySignatures.get(entity.id) !== signature) {
      if (body) {
        World.remove(engine.world, body);
        bodyMap.delete(entity.id);
      }

      const restitution = physics?.bounce ?? boundary?.bounciness ?? 0.0;
      const friction = 1 - (physics?.friction ?? 0.98);

      const bodyOptions: Matter.IBodyDefinition = {
        label: entity.id,
        isStatic,
        isSensor,
        restitution,
        friction,
        frictionAir: 0.02,
        mass: Math.max(0.1, physics?.mass || 1),
      };

      if (colliderType === 'circle') {
        body = Bodies.circle(worldCenterX, worldCenterY, colliderRadius, bodyOptions);
      } else {
        body = Bodies.rectangle(worldCenterX, worldCenterY, colliderWidth, colliderHeight, bodyOptions);
      }

      if (currentState?.rotation) {
        Body.setAngle(body, (currentState.rotation * Math.PI) / 180);
      }

      bodyMap.set(entity.id, body);
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      bodySignatures.set(entity.id, signature);
      World.add(engine.world, body);
    } else {
      colliderOffsets.set(entity.id, { relCenterX, relCenterY });
      if (physics) {
        body.isSensor = physics.isTrigger === true;
        body.restitution = physics.bounce ?? 0.0;
      }
    }
  }
}

/**
 * Exécute un pas de simulation Matter.js et applique les comportements
 */
export function stepMatterPhysics(params: {
  entities: Record<string, Entity>;
  deltaTime: number; // en secondes
  canvasBounds: { width: number; height: number };
  mousePos?: { x: number; y: number } | null;
}): PhysicsTickResult {
  const { entities, deltaTime, canvasBounds, mousePos } = params;
  const dt = Math.min(deltaTime, 0.05);

  ensurePhysicsWorld(canvasBounds, entities);
  if (!engine) return { updatedTransforms: {} };

  const updatedTransforms: Record<string, { position: Position; rotation?: number }> = {};
  const entityList = Object.values(entities);

  for (const entity of entityList) {
    const currentState = entity.states[entity.currentStateId];
    const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
    const body = bodyMap.get(entity.id);

    if (!body || effectiveBehaviors.length === 0) continue;

    // Récupérer les comportements configurés
    const physics = effectiveBehaviors.find((b) => b.type === 'physics') as PhysicsBehaviorConfig | undefined;
    const constVel = effectiveBehaviors.find((b) => b.type === 'constant_velocity') as ConstantVelocityBehaviorConfig | undefined;
    const keyboard = effectiveBehaviors.find((b) => b.type === 'keyboard_control') as KeyboardControlBehaviorConfig | undefined;
    const patrol = effectiveBehaviors.find((b) => b.type === 'patrol') as PatrolBehaviorConfig | undefined;
    const moveTo = effectiveBehaviors.find((b) => b.type === 'move_to') as MoveToBehaviorConfig | undefined;
    const follow = effectiveBehaviors.find((b) => b.type === 'follow') as FollowBehaviorConfig | undefined;
    const lookAt = effectiveBehaviors.find((b) => b.type === 'look_at') as LookAtBehaviorConfig | undefined;
    const boundary = effectiveBehaviors.find((b) => b.type === 'boundary_behavior') as BoundaryBehaviorConfig | undefined;

    // 0. Annulation de la gravité pour les entités sans composant 'physics' mais avec mouvement actif
    if (!physics && !body.isStatic) {
      Body.applyForce(body, body.position, {
        x: 0,
        y: -0.001 * body.mass * (engine.world.gravity.y || 1),
      });
      // S'il n'y a pas d'action verticale commandée, amortir vy résiduel
      if (!keyboard && !constVel?.vy && !patrol && !moveTo && !follow) {
        Body.setVelocity(body, { x: body.velocity.x, y: body.velocity.y * 0.8 });
      }
    }

    // 1. Gravité personnalisée
    if (physics && !physics.isStatic) {
      const customG = physics.gravity ?? 400;
      const defaultG = 9.8 * 60; // échelle approximative Matter.js
      const diffG = customG - defaultG;
      if (Math.abs(diffG) > 10) {
        Body.applyForce(body, body.position, {
          x: 0,
          y: (diffG * 0.000002) * body.mass,
        });
      }
    }

    // 2. Vitesse continue (convertie de px/s vers px/frame)
    if (constVel) {
      if (constVel.vx !== undefined && constVel.vx !== 0) {
        Body.setVelocity(body, { x: constVel.vx / 60, y: body.velocity.y });
      }
      if (constVel.vy !== undefined && constVel.vy !== 0) {
        Body.setVelocity(body, { x: body.velocity.x, y: constVel.vy / 60 });
      }
      if (constVel.angularVelocity) {
        Body.setAngularVelocity(body, ((constVel.angularVelocity / 60) * Math.PI) / 180);
      }
    }

    // 3. Contrôles Joueur (Clavier)
    if (keyboard) {
      const layout = keyboard.layout || 'both';
      const allowArrows = layout === 'arrows' || layout === 'both';
      const allowWasd = layout === 'wasd' || layout === 'both';

      const left =
        (allowArrows && activeKeys.has('arrowleft')) ||
        (allowWasd && (activeKeys.has('a') || activeKeys.has('q') || activeKeys.has('keya')));
      const right =
        (allowArrows && activeKeys.has('arrowright')) ||
        (allowWasd && (activeKeys.has('d') || activeKeys.has('keyd')));
      const up =
        (allowArrows && activeKeys.has('arrowup')) ||
        (allowWasd && (activeKeys.has('w') || activeKeys.has('z') || activeKeys.has('keyw'))) ||
        activeKeys.has(' ') ||
        activeKeys.has('space');
      const down =
        (allowArrows && activeKeys.has('arrowdown')) ||
        (allowWasd && (activeKeys.has('s') || activeKeys.has('keys')));

      const speed = (keyboard.speed ?? 180) / 60; // conversion px/s -> px/frame

      if (keyboard.mode === 'top_down') {
        let mx = 0;
        let my = 0;
        if (left) mx -= 1;
        if (right) mx += 1;
        if (up) my -= 1;
        if (down) my += 1;

        if (mx !== 0 && my !== 0) {
          mx *= 0.7071;
          my *= 0.7071;
        }

        if (mx !== 0 || my !== 0) {
          Body.setVelocity(body, { x: mx * speed, y: my * speed });
        } else if (!physics) {
          Body.setVelocity(body, { x: body.velocity.x * 0.8, y: body.velocity.y * 0.8 });
        }
      } else {
        // Mode Plateforme
        let vx = body.velocity.x;
        if (left) vx = -speed;
        else if (right) vx = speed;
        else if (!physics) vx *= 0.8;

        // Détection de contact au sol pour le saut
        const isGrounded = Math.abs(body.velocity.y) < 1.2;
        let vy = body.velocity.y;
        if (up && isGrounded) {
          vy = -((keyboard.jumpForce ?? 450) / 60);
        }

        Body.setVelocity(body, { x: vx, y: vy });
      }
    }

    // 4. Patrouille
    if (patrol) {
      let patrolState = patrolStates.get(entity.id);
      if (!patrolState) {
        patrolState = { direction: 1, timer: 0, initialPos: { ...entity.position } };
        patrolStates.set(entity.id, patrolState);
      }

      if (patrolState.timer > 0) {
        patrolState.timer -= dt;
        Body.setVelocity(body, { x: 0, y: 0 });
      } else {
        const origin = patrolState.initialPos;
        const range = patrol.range ?? 120;
        const speed = (patrol.speed ?? 100) / 60; // px/s -> px/frame
        const pause = patrol.pauseDuration ?? 0.5;

        if (patrol.axis === 'horizontal') {
          Body.setVelocity(body, { x: patrolState.direction * speed, y: body.velocity.y });
          const currentOffset = body.position.x - (origin.x + entity.size.width / 2);
          if (Math.abs(currentOffset) >= range) {
            patrolState.direction = currentOffset > 0 ? -1 : 1;
            patrolState.timer = pause;
            Body.setVelocity(body, { x: 0, y: body.velocity.y });
          }
        } else {
          Body.setVelocity(body, { x: body.velocity.x, y: patrolState.direction * speed });
          const currentOffset = body.position.y - (origin.y + entity.size.height / 2);
          if (Math.abs(currentOffset) >= range) {
            patrolState.direction = currentOffset > 0 ? -1 : 1;
            patrolState.timer = pause;
            Body.setVelocity(body, { x: body.velocity.x, y: 0 });
          }
        }
      }
    }

    // 5. Move To
    if (moveTo) {
      let targetX = entity.position.x;
      let targetY = entity.position.y;

      if (moveTo.targetType === 'position' && moveTo.targetPosition) {
        targetX = moveTo.targetPosition.x;
        targetY = moveTo.targetPosition.y;
      } else if (moveTo.targetType === 'entity' && moveTo.targetEntityId) {
        const targetEntity = entities[moveTo.targetEntityId];
        if (targetEntity) {
          targetX = targetEntity.position.x;
          targetY = targetEntity.position.y;
        }
      }

      const offset = colliderOffsets.get(entity.id) || { relCenterX: entity.size.width / 2, relCenterY: entity.size.height / 2 };
      const currentEntityX = body.position.x - offset.relCenterX;
      const currentEntityY = body.position.y - offset.relCenterY;
      const dx = targetX - currentEntityX;
      const dy = targetY - currentEntityY;
      const dist = Math.hypot(dx, dy);

      if (dist > 4) {
        const speed = (moveTo.speed ?? 120) / 60; // px/s -> px/frame
        Body.setVelocity(body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
      } else {
        Body.setVelocity(body, { x: 0, y: 0 });
      }
    }

    // 6. Follow
    if (follow) {
      let targetX = body.position.x;
      let targetY = body.position.y;

      if (follow.targetType === 'mouse' && mousePos) {
        targetX = mousePos.x;
        targetY = mousePos.y;
      } else if (follow.targetType === 'entity' && follow.targetEntityId) {
        const targetEntity = entities[follow.targetEntityId];
        if (targetEntity) {
          const targetOffset = colliderOffsets.get(targetEntity.id) || { relCenterX: targetEntity.size.width / 2, relCenterY: targetEntity.size.height / 2 };
          targetX = targetEntity.position.x + targetOffset.relCenterX;
          targetY = targetEntity.position.y + targetOffset.relCenterY;
        }
      }

      const dx = targetX - body.position.x;
      const dy = targetY - body.position.y;
      const dist = Math.hypot(dx, dy);
      const minDistance = follow.minDistance ?? 40;

      if (dist > minDistance) {
        const speed = (follow.speed ?? 150) / 60; // px/s -> px/frame
        Body.setVelocity(body, { x: (dx / dist) * speed, y: (dy / dist) * speed });
      } else {
        Body.setVelocity(body, { x: body.velocity.x * 0.8, y: body.velocity.y * 0.8 });
      }
    }

    // 7. Look At
    if (lookAt) {
      let targetX = body.position.x;
      let targetY = body.position.y;

      if (lookAt.targetType === 'mouse' && mousePos) {
        targetX = mousePos.x;
        targetY = mousePos.y;
      } else if (lookAt.targetType === 'entity' && lookAt.targetEntityId) {
        const targetEntity = entities[lookAt.targetEntityId];
        if (targetEntity) {
          const targetOffset = colliderOffsets.get(targetEntity.id) || { relCenterX: targetEntity.size.width / 2, relCenterY: targetEntity.size.height / 2 };
          targetX = targetEntity.position.x + targetOffset.relCenterX;
          targetY = targetEntity.position.y + targetOffset.relCenterY;
        }
      }

      const dx = targetX - body.position.x;
      const dy = targetY - body.position.y;
      const targetAngleRad = Math.atan2(dy, dx) + ((lookAt.rotationOffset || 0) * Math.PI) / 180;

      const smoothSpeed = lookAt.smoothSpeed ?? 0;
      if (smoothSpeed > 0) {
        let diff = (targetAngleRad - body.angle + Math.PI) % (Math.PI * 2) - Math.PI;
        if (diff < -Math.PI) diff += Math.PI * 2;
        const maxStep = ((smoothSpeed * Math.PI) / 180) * dt;
        if (Math.abs(diff) <= maxStep) {
          Body.setAngle(body, targetAngleRad);
        } else {
          Body.setAngle(body, body.angle + Math.sign(diff) * maxStep);
        }
      } else {
        Body.setAngle(body, targetAngleRad);
      }
    }

    // 8. Gestion des bords de scène spéciaux (Wrap, Clamp)
    if (boundary) {
      const mode = boundary.mode || 'bounce';
      if (mode === 'wrap') {
        const halfW = entity.size.width / 2;
        const halfH = entity.size.height / 2;
        let newX = body.position.x;
        let newY = body.position.y;

        if (body.position.x < -halfW) newX = canvasBounds.width + halfW;
        else if (body.position.x > canvasBounds.width + halfW) newX = -halfW;

        if (body.position.y < -halfH) newY = canvasBounds.height + halfH;
        else if (body.position.y > canvasBounds.height + halfH) newY = -halfH;

        if (newX !== body.position.x || newY !== body.position.y) {
          Body.setPosition(body, { x: newX, y: newY });
        }
      } else if (mode === 'clamp') {
        const minX = entity.size.width / 2;
        const maxX = canvasBounds.width - entity.size.width / 2;
        const minY = entity.size.height / 2;
        const maxY = canvasBounds.height - entity.size.height / 2;

        const clampedX = Math.max(minX, Math.min(maxX, body.position.x));
        const clampedY = Math.max(minY, Math.min(maxY, body.position.y));

        if (clampedX !== body.position.x || clampedY !== body.position.y) {
          Body.setPosition(body, { x: clampedX, y: clampedY });
        }
      }
    }

    // Plafond de vitesse terminale pour éviter toute dérive physique incontrôlée
    const maxVelocity = 30; // 30 px/frame = 1800 px/s
    const currentSpeed = Math.hypot(body.velocity.x, body.velocity.y);
    if (currentSpeed > maxVelocity) {
      Body.setVelocity(body, {
        x: (body.velocity.x / currentSpeed) * maxVelocity,
        y: (body.velocity.y / currentSpeed) * maxVelocity,
      });
    }
  }

  // Tique d'itération physique du moteur Matter.js
  Engine.update(engine, dt * 1000);

  // Synchronisation des positions et rotations issues de Matter.js vers Zustand
  for (const entity of entityList) {
    const body = bodyMap.get(entity.id);
    // Les corps purement statiques (sans mouvement) ne modifient jamais l'état React
    if (!body || body.isStatic) continue;

    const offset = colliderOffsets.get(entity.id) || {
      relCenterX: entity.size.width / 2,
      relCenterY: entity.size.height / 2,
    };

    const newX = Math.round((body.position.x - offset.relCenterX) * 10) / 10;
    const newY = Math.round((body.position.y - offset.relCenterY) * 10) / 10;
    const newRot = Math.round(((body.angle * 180) / Math.PI) * 10) / 10;

    const posChanged = Math.abs(newX - entity.position.x) > 0.05 || Math.abs(newY - entity.position.y) > 0.05;
    const rotChanged = Math.abs(newRot - (entity.states[entity.currentStateId]?.rotation || 0)) > 0.1;

    if (posChanged || rotChanged) {
      updatedTransforms[entity.id] = {
        position: { x: newX, y: newY },
        ...(rotChanged ? { rotation: newRot } : {}),
      };
    }
  }

  return { updatedTransforms };
}
