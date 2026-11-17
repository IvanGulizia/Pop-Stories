import React, { useEffect, useRef, useState } from 'react';
import { useDragControls, useMotionValue } from 'motion/react';
import { Entity, EntityState, HealthBehaviorConfig } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import {
  getEntityColliderBounds,
  getEntityColliderClipPath,
  isPointInsideEntityCollider,
} from '../utils/collider';
import { useAppCursor } from '../context/CursorContext';
import { CursorState } from '../utils/cursorIcons';
import {
  getEffectiveBehaviors,
  getEntityRuntimeHealth,
  isEntityDraggable,
  notifyEntityDragLifecycle,
  notifyEntityHoverState,
  setActiveDragPosition,
  setEntityRuntimeVelocity,
  syncEntityDragPosition,
} from '../utils/matterPhysicsEngine';
import {
  getEntityDragControls,
  registerEntityDragControls,
  resolvePointerTargetEntity,
  unregisterEntityDragControls,
} from '../utils/dragDelegationRegistry';
import { getPivotWorldPosition, resolveEffectivePivot } from '../utils/physics/pivotHelpers';
import { shortestAngleDiffRad } from '../utils/physics/lookAtSolver';

export interface UseEntityPointerInteractionOptions {
  entity: Entity;
  fallbackState: EntityState;
  minResizeSize?: number;
  maxResizeSize?: number;
  useFallbackClipPath?: boolean;
}

export function useEntityPointerInteraction({
  entity,
  fallbackState,
  minResizeSize = 32,
  maxResizeSize = 600,
  useFallbackClipPath = false,
}: UseEntityPointerInteractionOptions) {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);
  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const enableHoverScaleAnimation = useSceneStore((state) => state.settings.enableHoverScaleAnimation);
  const appMode = useSceneStore((state) => state.appMode);
  const rules = useSceneStore((state) => state.rules);

  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const isDraggingRef = useRef(false);
  const pushedDragHistoryRef = useRef(false);
  const lastDragEndTimeRef = useRef<number>(0);
  const lastDragEvalTimeRef = useRef<number>(0);
  const hasMovedBeyondDragThresholdRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const pointerDownTargetIdRef = useRef<string | null>(null);
  const hoveredTargetIdRef = useRef<string | null>(null);
  const lastHandledClickTimeRef = useRef<number>(0);
  const upHandledForPointerRef = useRef<boolean>(false);
  const isHoveringRef = useRef(false);
  const dragSamplesRef = useRef<{ x: number; y: number; time: number }[]>([]);

  const dragControls = useDragControls();
  const { setCursorState, setIsDragging } = useAppCursor();

  const isSelected = selectedEntityId === entity.id;
  const currentState: EntityState = entity.states[entity.currentStateId] || fallbackState;

  const { canDrag: canDragFromBehavior, throwable, maxThrowSpeed } = isEntityDraggable(entity, currentState);
  const canDrag = !isResizing && !isRotating && (appMode !== 'play' || canDragFromBehavior);

  // Santé & invincibilité runtime
  const healthConfig =
    appMode === 'play'
      ? (getEffectiveBehaviors(entity, currentState).find((b) => b.type === 'health') as
          | HealthBehaviorConfig
          | undefined)
      : undefined;
  const runtimeHealth = appMode === 'play' && healthConfig ? getEntityRuntimeHealth(entity.id) : null;

  const hasClickRules = rules.some(
    (r) =>
      r.enabled &&
      r.trigger.type === 'click' &&
      ((r.trigger.subjectMode === 'instance' && r.trigger.subjectId === entity.id) ||
        (r.trigger.subjectMode === 'type' && r.trigger.subjectType === entity.type) ||
        (r.trigger.subjectMode === 'tag' && r.trigger.subjectTag && entity.tags?.includes(r.trigger.subjectTag)) ||
        (!r.trigger.subjectMode && (r.trigger.subjectId === entity.id || r.trigger.subjectType === entity.type)))
  );

  const getTargetInteractionFlags = (target: Entity) => {
    const tState = target.states[target.currentStateId];
    const tDrag = isEntityDraggable(target, tState);
    const tHasClick = rules.some(
      (r) =>
        r.enabled &&
        r.trigger.type === 'click' &&
        ((r.trigger.subjectMode === 'instance' && r.trigger.subjectId === target.id) ||
          (r.trigger.subjectMode === 'type' && r.trigger.subjectType === target.type) ||
          (r.trigger.subjectMode === 'tag' && r.trigger.subjectTag && target.tags?.includes(r.trigger.subjectTag)) ||
          (!r.trigger.subjectMode && (r.trigger.subjectId === target.id || r.trigger.subjectType === target.type)))
    );
    return { canDragTarget: tDrag.canDrag, hasClickRulesTarget: tHasClick };
  };

  const getHoverStateFor = (target: Entity): CursorState => {
    const { canDragTarget, hasClickRulesTarget } =
      target.id === entity.id
        ? { canDragTarget: canDrag, hasClickRulesTarget: hasClickRules }
        : getTargetInteractionFlags(target);
    const effectiveDrag = appMode !== 'play' ? !isResizing : canDragTarget;
    const effectiveClick = hasClickRulesTarget || appMode !== 'play';

    if (effectiveDrag && hasClickRulesTarget) {
      return 'hover_drag_click';
    }
    if (effectiveDrag) {
      return 'hover_drag';
    }
    if (effectiveClick) {
      return 'hover_click';
    }
    return 'idle';
  };

  const getHoverState = (): CursorState => getHoverStateFor(entity);

  const getPlayPointerTarget = (): Entity => {
    if (appMode !== 'play') return entity;
    return resolvePointerTargetEntity(entity, useSceneStore.getState().entities);
  };

  const getSceneEventPosition = (clientX: number, clientY: number) => {
    const container = document.getElementById('scene-canvas-container');
    if (!container) return undefined;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) * 10) / 10,
      y: Math.round((clientY - rect.top) * 10) / 10,
    };
  };

  const x = useMotionValue(entity.position.x);
  const y = useMotionValue(entity.position.y);

  useEffect(() => {
    registerEntityDragControls(entity.id, dragControls);
    return () => unregisterEntityDragControls(entity.id, dragControls);
  }, [entity.id, dragControls]);

  useEffect(() => {
    if (isDraggingRef.current) return;
    x.set(entity.position.x);
    y.set(entity.position.y);
  }, [entity.position.x, entity.position.y, x, y]);

  useEffect(() => {
    return () => {
      setActiveDragPosition(entity.id, null);
      if (hoveredTargetIdRef.current && hoveredTargetIdRef.current !== entity.id) {
        notifyEntityHoverState(hoveredTargetIdRef.current, false);
      }
      notifyEntityHoverState(entity.id, false);
      notifyEntityDragLifecycle(entity.id, 'end', undefined, false);
    };
  }, [entity.id]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    pushedDragHistoryRef.current = false;
    lastDragEvalTimeRef.current = 0;
    setActiveDragPosition(entity.id, { x: entity.position.x, y: entity.position.y });
    if (appMode === 'play') {
      notifyEntityDragLifecycle(entity.id, 'start', { x: entity.position.x, y: entity.position.y });
    }
    dragSamplesRef.current = [{ x: entity.position.x, y: entity.position.y, time: performance.now() }];
    setIsDragging(true);
    setCursorState('drag');
  };

  const handleDrag = () => {
    const currentX = x.get();
    const currentY = y.get();
    const numX = typeof currentX === 'string' ? parseFloat(currentX) : currentX;
    const numY = typeof currentY === 'string' ? parseFloat(currentY) : currentY;

    if (pointerDownPosRef.current) {
      const dx = numX - entity.position.x;
      const dy = numY - entity.position.y;
      if (Math.hypot(dx, dy) > 4) {
        hasMovedBeyondDragThresholdRef.current = true;
      }
    } else {
      hasMovedBeyondDragThresholdRef.current = true;
    }

    // Échantillonnage de la trajectoire pour le calcul d'inertie de lancer (adapté 60Hz–240Hz)
    const now = performance.now();
    const prevSample = dragSamplesRef.current[dragSamplesRef.current.length - 1];
    if (!prevSample || now - prevSample.time >= 4) {
      dragSamplesRef.current.push({ x: numX, y: numY, time: now });
      if (dragSamplesRef.current.length > 12) {
        dragSamplesRef.current.shift();
      }
    }

    isDraggingRef.current = true;
    setCursorState('drag');

    if (!isNaN(numX) && !isNaN(numY)) {
      setActiveDragPosition(entity.id, { x: numX, y: numY });
      if (appMode === 'play') {
        syncEntityDragPosition(entity.id, numX, numY, entity.size.width, entity.size.height);
        notifyEntityDragLifecycle(
          entity.id,
          'move',
          { x: numX, y: numY },
          hasMovedBeyondDragThresholdRef.current
        );
      }
      if (now - lastDragEvalTimeRef.current >= 16) {
        lastDragEvalTimeRef.current = now;
        if (appMode !== 'play') {
          if (!pushedDragHistoryRef.current && hasMovedBeyondDragThresholdRef.current) {
            pushedDragHistoryRef.current = true;
            useSceneStore.getState().pushSceneHistory();
          }
          updateEntityPosition(entity.id, { x: numX, y: numY });
        }
        evaluateRulesWithTemp({
          [entity.id]: { x: numX, y: numY },
        });
      }
    }
  };

  const handleDragEnd = () => {
    const now = performance.now();
    // Libérer immédiatement le verrou de synchro visuelle pour que la physique poursuive sans aucun freeze
    isDraggingRef.current = false;
    pushedDragHistoryRef.current = false;
    lastDragEndTimeRef.current = now;
    setActiveDragPosition(entity.id, null);
    if (appMode === 'play') {
      notifyEntityDragLifecycle(entity.id, 'end', undefined, hasMovedBeyondDragThresholdRef.current);
    }

    const currentX = x.get();
    const currentY = y.get();
    const numX = typeof currentX === 'string' ? parseFloat(currentX) : currentX;
    const numY = typeof currentY === 'string' ? parseFloat(currentY) : currentY;

    if (!isNaN(numX) && !isNaN(numY)) {
      x.set(numX);
      y.set(numY);
      updateEntityPosition(entity.id, {
        x: numX,
        y: numY,
      });
      evaluateRulesWithTemp();
      if (hasMovedBeyondDragThresholdRef.current) {
        triggerDragRelease(entity.id, {
          x: Math.round(numX + entity.size.width / 2),
          y: Math.round(numY + entity.size.height / 2),
        });
      }

      // Injection de l'élan physique au lancer en mode Play
      if (appMode === 'play' && throwable && dragSamplesRef.current.length >= 2) {
        const samples = dragSamplesRef.current;
        const lastRaw = samples[samples.length - 1];

        // Si la main s'est arrêtée plus de 90ms avant de relâcher le bouton, annuler le lancer
        if (now - lastRaw.time <= 90) {
          const last =
            now - lastRaw.time >= 4 && Math.hypot(numX - lastRaw.x, numY - lastRaw.y) > 0.5
              ? { x: numX, y: numY, time: now }
              : lastRaw;
          let first = samples[0];
          for (let i = samples.length - 2; i >= 0; i--) {
            if (last.time - samples[i].time >= 40) {
              first = samples[i];
              break;
            }
          }
          const dt = (last.time - first.time) / 1000;
          if (dt > 0.012 && dt < 0.3) {
            let vx = (last.x - first.x) / dt;
            let vy = (last.y - first.y) / dt;
            const speed = Math.hypot(vx, vy);
            if (speed > maxThrowSpeed) {
              vx = (vx / speed) * maxThrowSpeed;
              vy = (vy / speed) * maxThrowSpeed;
            }
            if (speed > 40) {
              setEntityRuntimeVelocity(entity.id, Math.round(vx), Math.round(vy));
            }
          }
        }
      }
    }

    setIsDragging(false);
    setCursorState('release');
    setTimeout(() => {
      hasMovedBeyondDragThresholdRef.current = false;
      if (!isDraggingRef.current) {
        setCursorState(getHoverState());
      }
    }, 120);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    useSceneStore.getState().pushSceneHistory();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = entity.size.width;
    const startHeight = entity.size.height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = Math.max(minResizeSize, Math.min(maxResizeSize, Math.round(startWidth + deltaX)));
      let newHeight = Math.max(minResizeSize, Math.min(maxResizeSize, Math.round(startHeight + deltaY)));

      // Keep aspect ratio if near square or shift pressed
      if (Math.abs(startWidth - startHeight) < 5 || moveEvent.shiftKey) {
        const side = Math.max(newWidth, newHeight);
        newWidth = side;
        newHeight = side;
      }

      updateEntitySize(entity.id, { width: newWidth, height: newHeight });
    };

    const handlePointerUp = () => {
      setIsResizing(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handleRotatePointerDown = (e: React.PointerEvent) => {
    if (appMode === 'play') return;
    e.stopPropagation();
    e.preventDefault();
    const container = document.getElementById('scene-canvas-container');
    if (!container) return;

    useSceneStore.getState().pushSceneHistory();
    setIsRotating(true);

    const effPivot = resolveEffectivePivot(entity, currentState);
    const pivotWorld = getPivotWorldPosition(entity.position, entity.size, effPivot);
    const rect = container.getBoundingClientRect();
    const startAngleRad = Math.atan2(
      e.clientY - rect.top - pivotWorld.y,
      e.clientX - rect.left - pivotWorld.x
    );
    const startRotationDeg = currentState.rotation ?? 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const liveRect = container.getBoundingClientRect();
      const curAngleRad = Math.atan2(
        moveEvent.clientY - liveRect.top - pivotWorld.y,
        moveEvent.clientX - liveRect.left - pivotWorld.x
      );
      const deltaDeg = (shortestAngleDiffRad(startAngleRad, curAngleRad) * 180) / Math.PI;
      let nextRot = startRotationDeg + deltaDeg;
      while (nextRot > 180) nextRot -= 360;
      while (nextRot < -180) nextRot += 360;
      if (moveEvent.shiftKey) {
        nextRot = Math.round(nextRot / 15) * 15;
      } else {
        nextRot = Math.round(nextRot * 10) / 10;
      }
      useSceneStore
        .getState()
        .updateStateProperties(entity.id, currentState.id, { rotation: nextRot });
    };

    const handlePointerUp = () => {
      setIsRotating(false);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  const handlePointerHoverCheck = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDraggingRef.current || performance.now() - lastDragEndTimeRef.current < 130 || appMode !== 'play') return;
    const pt = getSceneEventPosition(e.clientX, e.clientY);
    const isInside = isPointInsideEntityCollider(
      e.clientX,
      e.clientY,
      e.currentTarget,
      entity,
      currentState
    );
    if (isInside) {
      const target = getPlayPointerTarget();
      setCursorState(getHoverStateFor(target));
      if (!isHoveringRef.current || hoveredTargetIdRef.current !== target.id) {
        if (hoveredTargetIdRef.current && hoveredTargetIdRef.current !== target.id) {
          notifyEntityHoverState(hoveredTargetIdRef.current, false);
          triggerPointerEvent(hoveredTargetIdRef.current, 'exit', pt);
        }
        isHoveringRef.current = true;
        hoveredTargetIdRef.current = target.id;
        notifyEntityHoverState(target.id, true);
        triggerPointerEvent(target.id, 'enter', pt);
      }
    } else {
      setCursorState('idle');
      if (isHoveringRef.current) {
        const exitId = hoveredTargetIdRef.current || entity.id;
        isHoveringRef.current = false;
        hoveredTargetIdRef.current = null;
        notifyEntityHoverState(exitId, false);
        triggerPointerEvent(exitId, 'exit', pt);
      }
    }
  };

  const colliderGeometry = getEntityColliderBounds(entity, currentState);
  const colliderType = colliderGeometry.colliderType;
  const rawClipPath = getEntityColliderClipPath(entity, currentState);
  const colliderClipPath = useFallbackClipPath
    ? rawClipPath || (colliderType === 'circle' ? 'circle(50% at 50% 50%)' : 'inset(0% round 16px)')
    : rawClipPath;

  const hitboxProps: React.HTMLAttributes<HTMLDivElement> = {
    className: `absolute inset-0 ${
      appMode === 'play' && entity.ignorePointer ? 'pointer-events-none' : 'pointer-events-auto'
    } flex items-center justify-center z-10 ${
      canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
    }`,
    style: {
      clipPath: colliderClipPath,
    },
    onPointerEnter: handlePointerHoverCheck,
    onPointerMove: handlePointerHoverCheck,
    onPointerLeave: (e) => {
      if (appMode === 'play' && isHoveringRef.current) {
        const exitId = hoveredTargetIdRef.current || entity.id;
        isHoveringRef.current = false;
        hoveredTargetIdRef.current = null;
        notifyEntityHoverState(exitId, false);
        setCursorState('idle');
        triggerPointerEvent(exitId, 'exit', getSceneEventPosition(e.clientX, e.clientY));
      }
    },
    onPointerDown: (e) => {
      const isInside = isPointInsideEntityCollider(
        e.clientX,
        e.clientY,
        e.currentTarget,
        entity,
        currentState
      );

      if (!isInside) {
        return;
      }

      e.stopPropagation();
      if (appMode !== 'play') {
        selectEntity(entity.id);
      }

      pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
      pointerDownTimeRef.current = Date.now();
      hasMovedBeyondDragThresholdRef.current = false;
      isDraggingRef.current = false;

      if (appMode !== 'play') {
        pointerDownTargetIdRef.current = entity.id;
        if (canDrag) {
          dragControls.start(e);
        }
        return;
      }

      const target = getPlayPointerTarget();
      pointerDownTargetIdRef.current = target.id;
      const { canDragTarget } =
        target.id === entity.id
          ? { canDragTarget: canDrag }
          : getTargetInteractionFlags(target);

      if (target.id !== entity.id) {
        if (canDragTarget) {
          getEntityDragControls(target.id)?.start(e);
          setCursorState('drag');
        } else {
          setCursorState('click');
        }
      } else if (canDrag) {
        dragControls.start(e);
        setCursorState('drag');
      } else {
        setCursorState('click');
      }

      upHandledForPointerRef.current = false;
      const pt = getSceneEventPosition(e.clientX, e.clientY);
      triggerPointerEvent(target.id, 'mouse_down', pt);

      const handleGlobalUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointerup', handleGlobalUp);
        if (upHandledForPointerRef.current) return;
        upHandledForPointerRef.current = true;
        const upPt = getSceneEventPosition(upEvent.clientX, upEvent.clientY);
        triggerPointerEvent(target.id, 'mouse_up', upPt);
      };
      window.addEventListener('pointerup', handleGlobalUp, { once: true });
    },
    onPointerUp: (e) => {
      const isInside = isPointInsideEntityCollider(
        e.clientX,
        e.clientY,
        e.currentTarget,
        entity,
        currentState
      );

      if (appMode !== 'play') {
        if (!hasMovedBeyondDragThresholdRef.current && isInside) {
          selectEntity(entity.id);
        }
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      const target =
        (pointerDownTargetIdRef.current && useSceneStore.getState().entities[pointerDownTargetIdRef.current]) ||
        getPlayPointerTarget();
      upHandledForPointerRef.current = true;
      const pt = getSceneEventPosition(e.clientX, e.clientY);
      const duration = Date.now() - (pointerDownTimeRef.current || 0);
      const dist = pointerDownPosRef.current
        ? Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y)
        : 0;

      const isPureClick = !hasMovedBeyondDragThresholdRef.current && dist < 6 && duration < 700;

      if (isPureClick && isInside) {
        lastHandledClickTimeRef.current = Date.now();
        selectEntity(target.id);
        triggerPointerEvent(target.id, 'click', pt);
        triggerPointerEvent(target.id, 'mouse_up', pt);
        setCursorState(getHoverStateFor(target));
      } else if (!hasMovedBeyondDragThresholdRef.current) {
        isDraggingRef.current = false;
        setIsDragging(false);
        if (isInside) {
          setCursorState(getHoverStateFor(target));
          triggerPointerEvent(target.id, 'mouse_up', pt);
        } else {
          setCursorState('idle');
          triggerPointerEvent(target.id, 'mouse_up', pt);
        }
      }
    },
    onClick: (e) => {
      const isInside = isPointInsideEntityCollider(
        e.clientX,
        e.clientY,
        e.currentTarget,
        entity,
        currentState
      );
      if (!isInside) return;

      e.stopPropagation();
      if (appMode !== 'play') {
        selectEntity(entity.id);
        return;
      }

      if (Date.now() - (lastHandledClickTimeRef.current || 0) < 350) {
        return;
      }

      const dist = pointerDownPosRef.current
        ? Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y)
        : 0;
      if (dist >= 6) return;

      const target = getPlayPointerTarget();
      selectEntity(target.id);
      if (!hasMovedBeyondDragThresholdRef.current && performance.now() - lastDragEndTimeRef.current >= 130) {
        lastHandledClickTimeRef.current = Date.now();
        setCursorState(getHoverStateFor(target));
        triggerPointerEvent(target.id, 'click', getSceneEventPosition(e.clientX, e.clientY));
      }
    },
  };

  return {
    appMode,
    showCanvasLabels,
    enableHoverScaleAnimation,
    isSelected,
    currentState,
    canDragFromBehavior,
    canDrag,
    x,
    y,
    dragControls,
    handleDragStart,
    handleDrag,
    handleDragEnd,
    handleResizePointerDown,
    handleRotatePointerDown,
    isRotating,
    colliderType,
    colliderClipPath,
    healthConfig,
    runtimeHealth,
    hitboxProps,
  };
}
