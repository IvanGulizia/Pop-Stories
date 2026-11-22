import React from 'react';
import {
  Activity,
  ArrowRight,
  Clock,
  Compass,
  Gamepad2,
  Hand,
  Heart,
  Magnet,
  Move,
  Repeat,
  RotateCw,
  Shield,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Waves,
  Wind,
} from 'lucide-react';
import {
  AutoDestroyBehaviorConfig,
  BehaviorType,
  BoundaryBehaviorConfig,
  ConstantVelocityBehaviorConfig,
  DraggableBehaviorConfig,
  Entity,
  EntityBehavior,
  FleeBehaviorConfig,
  FollowBehaviorConfig,
  HealthBehaviorConfig,
  InteractivePuppetBehaviorConfig,
  JiggleBehaviorConfig,
  KeyboardControlBehaviorConfig,
  LookAtBehaviorConfig,
  MoveToBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  PatrolBehaviorConfig,
  PhysicsBehaviorConfig,
  RotateDragBehaviorConfig,
  SliderBehaviorConfig,
  SnapBehaviorConfig,
  StrokeWiggleBehaviorConfig,
  WanderingBehaviorConfig,
} from '../../types';

export function generateBehaviorId(type: BehaviorType): string {
  return `${type}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createDefaultBehaviorConfig(type: BehaviorType, entity: Entity): EntityBehavior {
  switch (type) {
    case 'draggable':
      return {
        id: generateBehaviorId('draggable'),
        type: 'draggable',
        enabled: true,
        throwable: true,
        maxThrowSpeed: 1500,
        precisePhysicsGrab: false,
      } as DraggableBehaviorConfig;
    case 'interactive_puppet':
      return {
        id: generateBehaviorId('interactive_puppet'),
        type: 'interactive_puppet',
        enabled: true,
        throwable: true,
        maxThrowSpeed: 1500,
        precisePhysicsGrab: false,
        swingMode: 'both',
        swingAroundGrabPoint: false,
        pendulumIntensity: 1.0,
        pendulumMaxAngle: 32,
        pendulumSmoothing: 0.18,
        swingSpeedThreshold: 320,
        shakeThreshold: 3,
        approachFarDistance: 280,
        approachNearDistance: 120,
        hoverEnterDuration: 0.18,
        hoverDwellDelay: 1.5,
        hoverReturnDelay: 0,
        hoverExitDuration: 0.2,
        dragStartDuration: 0.18,
        dragDwellDelay: 2.0,
        swingReturnDelay: 0.15,
        shakeHoldDuration: 0.45,
        dragOverReturnDelay: 0,
        dragReleaseDuration: 0.2,
        minFallHeight: 20,
        landDuration: 0.18,
        dragOverTargets: [],
        stateBindings: {
          idleStateId: entity.currentStateId,
        },
      } as InteractivePuppetBehaviorConfig;
    case 'physics':
      return {
        id: generateBehaviorId('physics'),
        type: 'physics',
        enabled: true,
        isTrigger: false,
        isStatic: false,
        gravity: 400,
        bounce: 0.4,
        friction: 0.6,
        frictionStatic: 0.5,
        frictionAir: 0.015,
        mass: 1,
        freezeRotation: false,
      } as PhysicsBehaviorConfig;
    case 'auto_destroy':
      return {
        id: generateBehaviorId('auto_destroy'),
        type: 'auto_destroy',
        enabled: true,
        delay: 3,
      } as AutoDestroyBehaviorConfig;
    case 'constant_velocity':
      return {
        id: generateBehaviorId('constant_velocity'),
        type: 'constant_velocity',
        enabled: true,
        vx: 80,
        vy: 0,
        angularVelocity: 0,
      } as ConstantVelocityBehaviorConfig;
    case 'look_at':
      return {
        id: generateBehaviorId('look_at'),
        type: 'look_at',
        enabled: true,
        targetType: 'mouse',
        lookMode: 'rotate',
        rotationOffset: 0,
        maxAngle: 0,
        orbitRadius: 8,
        orbitRadiusY: 8,
        smoothSpeed: 0,
        flipMode: 'none',
        facingDirection: 'right',
        flipDeadzone: 12,
      } as LookAtBehaviorConfig;
    case 'follow':
      return {
        id: generateBehaviorId('follow'),
        type: 'follow',
        enabled: true,
        targetType: 'mouse',
        speed: 120,
        minDistance: 40,
      } as FollowBehaviorConfig;
    case 'move_to':
      return {
        id: generateBehaviorId('move_to'),
        type: 'move_to',
        enabled: true,
        targetType: 'position',
        targetPosition: { x: 200, y: 200 },
        speed: 100,
      } as MoveToBehaviorConfig;
    case 'patrol':
      return {
        id: generateBehaviorId('patrol'),
        type: 'patrol',
        enabled: true,
        axis: 'horizontal',
        range: 120,
        speed: 100,
        pauseDuration: 0.5,
      } as PatrolBehaviorConfig;
    case 'wandering':
      return {
        id: generateBehaviorId('wandering'),
        type: 'wandering',
        enabled: true,
        mode: 'free_2d',
        radius: 160,
        speed: 90,
        randomness: 65,
        changeInterval: 1.5,
        pauseDuration: 0.8,
        orientToMovement: false,
      } as WanderingBehaviorConfig;
    case 'flee':
      return {
        id: generateBehaviorId('flee'),
        type: 'flee',
        enabled: true,
        targetType: 'mouse',
        speed: 160,
        fleeRadius: 220,
        axisMode: 'free_2d',
        acceleration: 0.35,
        damping: 0.85,
        flipOnMove: false,
        pauseWhileDragged: true,
      } as FleeBehaviorConfig;
    case 'keyboard_control':
      return {
        id: generateBehaviorId('keyboard_control'),
        type: 'keyboard_control',
        enabled: true,
        layout: 'both',
        speed: 180,
        mode: 'top_down',
        jumpForce: 450,
        allowHorizontal: true,
        allowVertical: true,
        allowJump: true,
      } as KeyboardControlBehaviorConfig;
    case 'boundary_behavior':
      return {
        id: generateBehaviorId('boundary_behavior'),
        type: 'boundary_behavior',
        enabled: true,
        mode: 'bounce',
        bounciness: 0.8,
      } as BoundaryBehaviorConfig;
    case 'particle_emitter':
      return {
        id: generateBehaviorId('particle_emitter'),
        type: 'particle_emitter',
        enabled: true,
        rate: 14,
        color: '#f59e0b',
        color2: '#ef4444',
        shape: 'circle',
        speed: 140,
        size: 6,
        lifetime: 0.8,
        gravity: 160,
        spread: 60,
        angle: -90,
        offsetX: 0,
        offsetY: 0,
      } as ParticleEmitterBehaviorConfig;
    case 'health':
      return {
        id: generateBehaviorId('health'),
        type: 'health',
        enabled: true,
        maxHp: 3,
        damageTag: 'danger',
        damageCooldown: 1.0,
        knockbackForce: 220,
        showHealthBar: true,
        onDeath: 'destroy',
      } as HealthBehaviorConfig;
    case 'jiggle':
      return {
        id: generateBehaviorId('jiggle'),
        type: 'jiggle',
        enabled: true,
        stiffness: 180,
        damping: 9,
        inertia: 1.0,
        maxAngle: 35,
        gravityPull: 40,
        restAngleOffset: 0,
        initialAngleOffset: 0,
        squashIntensity: 0.25,
      collideWithWorld: true,
        useCustomPivot: false,
      } as JiggleBehaviorConfig;
    case 'stroke_wiggle':
      return {
        id: generateBehaviorId('stroke_wiggle'),
        type: 'stroke_wiggle',
        enabled: true,
        amplitude: 2.2,
        fps: 6,
        frameCount: 4,
        detail: 'medium',
        affectFill: true,
        previewInEdit: false,
      } as StrokeWiggleBehaviorConfig;
    case 'slider':
      return {
        id: generateBehaviorId('slider'),
        type: 'slider',
        enabled: true,
        geometryMode: 'line_1d',
        length: 220,
        angle: 0,
        width: 180,
        height: 180,
        radius: 90,
        dragMode: 'physics_spring',
        dragStiffness: 220,
        dragDamping: 16,
        boundaryBounce: 0.35,
        stepsX: 0,
        stepsY: 0,
        stepMode: 'magnetic',
        magneticStrength: 140,
        returnMode: 'none',
        returnPosition: 0.5,
        returnStiffness: 140,
        returnDamping: 12,
        outputMin: 0,
        outputMax: 100,
        showTrackInPlay: true,
      } as SliderBehaviorConfig;
    case 'rotate_drag':
      return {
        id: generateBehaviorId('rotate_drag'),
        type: 'rotate_drag',
        enabled: true,
        gestureMode: 'circular',
        dragMode: 'physics_spring',
        sensitivity: 0.85,
        dragStiffness: 240,
        dragDamping: 16,
        inertiaDamping: 4,
        limitRange: true,
        minAngle: -135,
        maxAngle: 135,
        boundaryBounce: 0.3,
        steps: 0,
        stepAngleDeg: 30,
        stepMode: 'magnetic',
        magneticStrength: 140,
        returnMode: 'none',
        restAngle: 0,
        returnStiffness: 140,
        returnDamping: 12,
        outputMin: 0,
        outputMax: 100,
        showDialInPlay: true,
      } as RotateDragBehaviorConfig;
    case 'snap':
      return {
        id: generateBehaviorId('snap'),
        type: 'snap',
        enabled: true,
        snapRole: 'magnet_object',
        targetType: 'any',
        snapTrigger: 'on_release',
        snapRadius: 48,
        snapMode: 'magnetic_smooth',
        smoothSpeed: 0.3,
        snapAlignment: 'center',
        sourceAnchor: 'center',
        targetAnchor: 'center',
        offsetX: 0,
        offsetY: 0,
        matchTargetRotation: false,
        rotationOffset: 0,
        attachBehavior: 'position_only',
        springStiffness: 0.25,
        springDamping: 0.18,
        magnetEnabled: false,
        magnetRadius: 120,
        magnetForce: 260,
        allowPullUnsnap: true,
        unsnapDistance: 72,
        reSnapCooldownSec: 0.35,
      } as SnapBehaviorConfig;
  }
}

export function getBehaviorIcon(type: BehaviorType): React.ReactNode {
  switch (type) {
    case 'draggable':
      return <Hand className="w-4 h-4 text-indigo-600" />;
    case 'interactive_puppet':
      return <Sparkles className="w-4 h-4 text-violet-600" />;
    case 'physics':
      return <Activity className="w-4 h-4 text-emerald-600" />;
    case 'constant_velocity':
      return <ArrowRight className="w-4 h-4 text-cyan-600" />;
    case 'look_at':
      return <Compass className="w-4 h-4 text-indigo-600" />;
    case 'follow':
      return <Move className="w-4 h-4 text-violet-600" />;
    case 'move_to':
      return <Move className="w-4 h-4 text-amber-600" />;
    case 'patrol':
      return <Repeat className="w-4 h-4 text-blue-600" />;
    case 'wandering':
      return <Shuffle className="w-4 h-4 text-emerald-600" />;
    case 'flee':
      return <Wind className="w-4 h-4 text-rose-500" />;
    case 'keyboard_control':
      return <Gamepad2 className="w-4 h-4 text-rose-600" />;
    case 'boundary_behavior':
      return <Shield className="w-4 h-4 text-teal-600" />;
    case 'auto_destroy':
      return <Clock className="w-4 h-4 text-orange-600" />;
    case 'particle_emitter':
      return <Sparkles className="w-4 h-4 text-amber-500" />;
    case 'health':
      return <Heart className="w-4 h-4 text-rose-500" />;
    case 'jiggle':
      return <Waves className="w-4 h-4 text-fuchsia-600" />;
    case 'stroke_wiggle':
      return <Waves className="w-4 h-4 text-cyan-600" />;
    case 'slider':
      return <SlidersHorizontal className="w-4 h-4 text-sky-600" />;
    case 'rotate_drag':
      return <RotateCw className="w-4 h-4 text-amber-600" />;
    case 'snap':
      return <Magnet className="w-4 h-4 text-cyan-600" />;
  }
}

export function getBehaviorTitle(type: BehaviorType): string {
  switch (type) {
    case 'draggable':
      return 'Déplaçable à la souris';
    case 'interactive_puppet':
      return 'Marionnette Interactive (Drag avancé)';
    case 'physics':
      return 'Physique & Gravité';
    case 'auto_destroy':
      return 'Autodestruction (Lifespan)';
    case 'constant_velocity':
      return 'Vitesse Continue';
    case 'look_at':
      return 'Orientation (Look At)';
    case 'follow':
      return 'Suivre (Follow)';
    case 'move_to':
      return 'Aller vers (Move To)';
    case 'patrol':
      return 'Patrouille';
    case 'wandering':
      return 'Balade Aléatoire (Wandering)';
    case 'flee':
      return 'Fuir (Flee)';
    case 'keyboard_control':
      return 'Contrôles Joueur';
    case 'boundary_behavior':
      return 'Bords de Scène';
    case 'particle_emitter':
      return 'Émetteur de Particules';
    case 'health':
      return 'Santé & Dégâts';
    case 'jiggle':
      return 'Jiggle & Ressort Rotatif';
    case 'stroke_wiggle':
      return 'Wiggle des Traits (Ligne Vivante)';
    case 'slider':
      return 'Slider & Glissière Contrainte';
    case 'rotate_drag':
      return 'Cadran Rotatif au Drag (Volant)';
    case 'snap':
      return 'Aimant & Snap (Collage sur cible)';
  }
}
