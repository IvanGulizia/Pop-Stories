import React, { useEffect, useRef, useState } from 'react';
import { useDragControls, useMotionValue } from 'motion/react';
import { Entity, EntityState, HealthBehaviorConfig, PhysicsBehaviorConfig, RotateDragBehaviorConfig } from '../types';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../store/useSceneStore';
import { useContextMenuTrigger } from './useContextMenuTrigger';
import {
  EntityHitTestContext,
  getEntityColliderBounds,
  getEntityColliderClipPath,
  isPointInsideEntityCollider,
} from '../utils/collider';
import { useAppCursor } from '../context/CursorContext';
import { CursorState } from '../utils/cursorIcons';
import {
  hasEntityClickRules,
  resolveEntityHoverCursorState,
  resolveEntityPressCursorState,
  resolveNativeHitboxCursorClass,
} from '../utils/cursorResolution';
import {
  computeLiveDragMagneticOffsetForEntity,
  endPhysicsGrab,
  getEffectiveBehaviors,
  getEntityRuntimeHealth,
  hasActiveWorldPin,
  isActiveBidirectionalDragTarget,
  isEntityDraggable,
  notifyEntityDragLifecycle,
  notifyEntityHoverState,
  releasePuppetGrabHold,
  resolvePlayEntityDraggable,
  setActiveDragPosition,
  setEntityRuntimeVelocity,
  setPuppetGrabPivot,
  startPhysicsGrab,
  startRotateDragGrab,
  startSliderGrab,
  syncEntityDragPosition,
  updatePhysicsGrabTarget,
  updateRotateDragGrabTarget,
  updateSliderGrabTarget,
  endRotateDragGrab,
  endSliderGrab,
} from '../utils/matterPhysicsEngine';
import {
  getEntityDragControls,
  registerEntityDragControls,
  resolvePointerTargetEntity,
  unregisterEntityDragControls,
} from '../utils/dragDelegationRegistry';
import {
  computeLocalGrabPivotFromClientPoint,
  getPivotWorldPosition,
  reanchorPositionForPivotChange,
  resolveEffectivePivot,
} from '../utils/physics/pivotHelpers';
import { shortestAngleDiffRad } from '../utils/physics/lookAtSolver';
import { getActiveCameraView } from '../utils/cameraRuntime';
import { screenToWorldPoint } from '../utils/cameraSolver';
import { resolveEffectiveParentOffset } from '../store/parentingHelpers';

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
  const selectedEntityIds = useSceneStore((state) => state.selectedEntityIds || EMPTY_LIST);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const batchTranslateEntities = useSceneStore((state) => state.batchTranslateEntities);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);
  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const enableHoverScaleAnimation = useSceneStore((state) => state.settings.enableHoverScaleAnimation);
  const useCustomCursors = useSceneStore((state) => state.settings.useCustomCursors !== false);
  const appMode = useSceneStore((state) => state.appMode);
  const rules = useSceneStore((state) => state.rules);

  const [isResizing, setIsResizing] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const isDraggingRef = useRef(false);
  const isPhysicsGrabbingRef = useRef(false);
  const physicsGrabCleanupRef = useRef<(() => void) | null>(null);
  const pushedDragHistoryRef = useRef(false);
  const lastEditDragPosRef = useRef<{ x: number; y: number } | null>(null);
  const handledSelectionToggleOnDownRef = useRef(false);
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
  const dragMagOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragMagOffset, setDragMagOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  const dragControls = useDragControls();
  const { setCursorState, setIsDragging, isDragCursorLocked, setDragCursorLocked } = useAppCursor();

  const {
    bind: editContextMenuBind,
    cancelLongPress,
    consumeLongPressClick,
  } = useContextMenuTrigger(
    (coords) => {
      if (useSceneStore.getState().appMode === 'play') return;
      const snap = useSceneStore.getState();
      const alreadyInSelection =
        snap.selectedEntityId === entity.id ||
        snap.selectedEntityIds.includes(entity.id);
      if (!alreadyInSelection) {
        selectEntity(entity.id);
      }
      window.dispatchEvent(
        new CustomEvent('atelier:open-entity-context-menu', {
          detail: { entityId: entity.id, x: coords.x, y: coords.y },
        })
      );
    },
    { ignoreInteractiveChildren: false }
  );

  const isPrimarySelected = selectedEntityId === entity.id;
  const isMultiSelected = selectedEntityIds.length > 1;
  const isSelected = isPrimarySelected || selectedEntityIds.includes(entity.id);
  const isSameTypeSibling = useSceneStore(
    (state) =>
      state.appMode !== 'play' &&
      !state.selectedEntityIds.includes(entity.id) &&
      Boolean(
        state.selectedEntityId &&
          state.selectedEntityId !== entity.id &&
          state.entities[state.selectedEntityId]?.type === entity.type
      )
  );
  const currentState: EntityState = entity.states[entity.currentStateId] || fallbackState;

  const playEntities = useSceneStore((state) => (state.appMode === 'play' ? state.entities : EMPTY_RECORD));
  const isBidirectionalDragTarget =
    appMode === 'play' && isActiveBidirectionalDragTarget(entity.id, playEntities);
  const {
    canDrag: canDragFromBehavior,
    hasSlider,
    hasRotateDrag,
    throwable,
    maxThrowSpeed,
  } =
    appMode === 'play'
      ? resolvePlayEntityDraggable(entity, currentState, isBidirectionalDragTarget)
      : isEntityDraggable(entity, currentState);
  const isPlayDisabled = appMode === 'play' && Boolean(entity.disabled);
  const canDrag = !isPlayDisabled && !isResizing && !isRotating && (appMode !== 'play' || canDragFromBehavior);

  // Santé & invincibilité runtime
  const healthConfig =
    appMode === 'play'
      ? (getEffectiveBehaviors(entity, currentState).find((b) => b.type === 'health') as
          | HealthBehaviorConfig
          | undefined)
      : undefined;
  const runtimeHealth = appMode === 'play' && healthConfig ? getEntityRuntimeHealth(entity.id) : null;

  const hasClickRules = hasEntityClickRules(entity, rules);

  const getTargetInteractionFlags = (target: Entity) => {
    const tState = target.states[target.currentStateId];
    const tLiveEntities = useSceneStore.getState().entities;
    const tDrag =
      appMode === 'play'
        ? resolvePlayEntityDraggable(
            target,
            tState,
            isActiveBidirectionalDragTarget(target.id, tLiveEntities)
          )
        : isEntityDraggable(target, tState);
    const tHasClick = hasEntityClickRules(target, rules);
    return { canDragTarget: tDrag.canDrag, hasClickRulesTarget: tHasClick };
  };

  const getHoverStateFor = (target: Entity): CursorState => {
    const { canDragTarget, hasClickRulesTarget } =
      target.id === entity.id
        ? { canDragTarget: canDrag, hasClickRulesTarget: hasClickRules }
        : getTargetInteractionFlags(target);
    const effectiveDrag = appMode !== 'play' ? !isResizing : canDragTarget;
    return resolveEntityHoverCursorState({
      appMode,
      canDrag: effectiveDrag,
      hasClickRules: hasClickRulesTarget,
    });
  };

  const getHoverState = (): CursorState => getHoverStateFor(entity);

  const getPlayPointerTarget = (): Entity => {
    if (appMode !== 'play') return entity;
    return resolvePointerTargetEntity(entity, useSceneStore.getState().entities);
  };

  const getCurrentCameraView = () => {
    const snap = useSceneStore.getState();
    return getActiveCameraView(snap.appMode, snap.editorCamera);
  };

  const getSceneEventPosition = (clientX: number, clientY: number) => {
    const container = document.getElementById('scene-canvas-container');
    if (!container) return undefined;
    const rect = container.getBoundingClientRect();
    const worldPt = screenToWorldPoint(clientX, clientY, rect, getCurrentCameraView());
    return {
      x: Math.round(worldPt.x * 10) / 10,
      y: Math.round(worldPt.y * 10) / 10,
    };
  };

  const x = useMotionValue(entity.position.x);
  const y = useMotionValue(entity.position.y);

  const buildEntityHitContext = (
    targetEnt: Entity,
    targetSt: EntityState | undefined
  ): EntityHitTestContext => {
    const effPivot = resolveEffectivePivot(targetEnt, targetSt);
    const totalRot =
      (targetSt?.rotation ?? 0) +
      (appMode === 'play' ? (targetEnt.runtimeTilt || 0) + (targetEnt.runtimeJiggleAngle || 0) : 0);
    const sBase = targetSt?.scale ?? 1;
    const rawX = targetEnt.id === entity.id ? Number(x.get()) : targetEnt.position.x;
    const rawY = targetEnt.id === entity.id ? Number(y.get()) : targetEnt.position.y;
    const magX = targetEnt.id === entity.id ? dragMagOffsetRef.current.x : 0;
    const magY = targetEnt.id === entity.id ? dragMagOffsetRef.current.y : 0;
    const livePos = {
      x: (Number.isFinite(rawX) ? rawX : targetEnt.position.x) + magX,
      y: (Number.isFinite(rawY) ? rawY : targetEnt.position.y) + magY,
    };
    const container =
      typeof document !== 'undefined' ? document.getElementById('scene-canvas-container') : null;
    return {
      position: livePos,
      totalRotationDeg: totalRot,
      scaleX: sBase * (appMode === 'play' ? (targetEnt.runtimeScaleX ?? 1) : 1),
      scaleY: sBase * (appMode === 'play' ? (targetEnt.runtimeScaleY ?? 1) : 1),
      effPivot,
      containerRect: container ? container.getBoundingClientRect() : null,
      camera: getCurrentCameraView(),
    };
  };

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
      if (physicsGrabCleanupRef.current) {
        physicsGrabCleanupRef.current();
        physicsGrabCleanupRef.current = null;
      }
      endPhysicsGrab(entity.id, false);
      endSliderGrab(entity.id);
      endRotateDragGrab(entity.id);
      releasePuppetGrabHold(entity.id);
      setActiveDragPosition(entity.id, null);
      if (hoveredTargetIdRef.current && hoveredTargetIdRef.current !== entity.id) {
        notifyEntityHoverState(hoveredTargetIdRef.current, false);
      }
      notifyEntityHoverState(entity.id, false);
      notifyEntityDragLifecycle(entity.id, 'end', undefined, false);
    };
  }, [entity.id]);

  const handleDragStart = () => {
    cancelLongPress();
    isDraggingRef.current = true;
    pushedDragHistoryRef.current = false;
    lastDragEvalTimeRef.current = 0;
    const rx = Number(x.get());
    const ry = Number(y.get());
    const liveEnt = useSceneStore.getState().entities[entity.id] || entity;
    lastEditDragPosRef.current = { x: liveEnt.position.x, y: liveEnt.position.y };
    const startPos =
      Number.isFinite(rx) && Number.isFinite(ry)
        ? { x: rx, y: ry }
        : { x: liveEnt.position.x, y: liveEnt.position.y };
    setActiveDragPosition(entity.id, startPos);
    if (appMode === 'play') {
      notifyEntityDragLifecycle(entity.id, 'start', startPos);
    }
    dragSamplesRef.current = [{ x: startPos.x, y: startPos.y, time: performance.now() }];
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
    setDragCursorLocked(true);
    setCursorState('drag');

    if (!isNaN(numX) && !isNaN(numY)) {
      let effectiveX = numX;
      let effectiveY = numY;
      if (appMode === 'play') {
        const snapState = useSceneStore.getState();
        const liveEnt = snapState.entities[entity.id] || entity;
        const mag = computeLiveDragMagneticOffsetForEntity(
          liveEnt,
          { x: numX, y: numY },
          snapState.entities
        );
        dragMagOffsetRef.current = mag;
        setDragMagOffset((prev) => (prev.x === mag.x && prev.y === mag.y ? prev : mag));
        effectiveX = numX + mag.x;
        effectiveY = numY + mag.y;
      } else if (dragMagOffsetRef.current.x !== 0 || dragMagOffsetRef.current.y !== 0) {
        dragMagOffsetRef.current = { x: 0, y: 0 };
        setDragMagOffset({ x: 0, y: 0 });
      }

      setActiveDragPosition(entity.id, { x: effectiveX, y: effectiveY });
      if (appMode === 'play') {
        const liveEnt = useSceneStore.getState().entities[entity.id] || entity;
        const liveSt = liveEnt.states[liveEnt.currentStateId] || currentState;
        const effPivot = resolveEffectivePivot(liveEnt, liveSt);
        syncEntityDragPosition(
          entity.id,
          effectiveX,
          effectiveY,
          liveEnt.size.width,
          liveEnt.size.height,
          effPivot
        );
        notifyEntityDragLifecycle(
          entity.id,
          'move',
          { x: effectiveX, y: effectiveY },
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
          const snap = useSceneStore.getState();
          if (
            snap.selectedEntityIds.length > 1 &&
            snap.selectedEntityIds.includes(entity.id)
          ) {
            const prevPos =
              lastEditDragPosRef.current || snap.entities[entity.id]?.position || entity.position;
            const stepDx = effectiveX - prevPos.x;
            const stepDy = effectiveY - prevPos.y;
            if (stepDx !== 0 || stepDy !== 0) {
              lastEditDragPosRef.current = { x: effectiveX, y: effectiveY };
              batchTranslateEntities(snap.selectedEntityIds, { dx: stepDx, dy: stepDy });
            }
          } else {
            updateEntityPosition(entity.id, { x: effectiveX, y: effectiveY });
            lastEditDragPosRef.current = { x: effectiveX, y: effectiveY };
          }
        }
        evaluateRulesWithTemp({
          [entity.id]: { x: effectiveX, y: effectiveY },
        });
      }
    }
  };

  const handleDragEnd = () => {
    const now = performance.now();
    const currentX = x.get();
    const currentY = y.get();
    const numX = typeof currentX === 'string' ? parseFloat(currentX) : currentX;
    const numY = typeof currentY === 'string' ? parseFloat(currentY) : currentY;
    const mag = dragMagOffsetRef.current;
    dragMagOffsetRef.current = { x: 0, y: 0 };
    setDragMagOffset({ x: 0, y: 0 });
    const finalX = !isNaN(numX) ? numX + (appMode === 'play' ? mag.x : 0) : numX;
    const finalY = !isNaN(numY) ? numY + (appMode === 'play' ? mag.y : 0) : numY;

    // Verrouiller la position finale du corps Matter avant de relâcher le verrou pour éviter toute téléportation
    if (appMode === 'play' && !isNaN(finalX) && !isNaN(finalY)) {
      const liveEnt = useSceneStore.getState().entities[entity.id] || entity;
      const liveSt = liveEnt.states[liveEnt.currentStateId] || currentState;
      const effPivot = resolveEffectivePivot(liveEnt, liveSt);
      syncEntityDragPosition(entity.id, finalX, finalY, liveEnt.size.width, liveEnt.size.height, effPivot);
    }

    // Libérer immédiatement le verrou de synchro visuelle pour que la physique poursuive sans aucun freeze
    isDraggingRef.current = false;
    pushedDragHistoryRef.current = false;
    lastDragEndTimeRef.current = now;
    setActiveDragPosition(entity.id, null);
    releasePuppetGrabHold(entity.id);
    if (appMode === 'play') {
      notifyEntityDragLifecycle(entity.id, 'end', undefined, hasMovedBeyondDragThresholdRef.current);
    }

    if (!isNaN(finalX) && !isNaN(finalY)) {
      x.set(finalX);
      y.set(finalY);
      if (appMode !== 'play') {
        const snap = useSceneStore.getState();
        if (
          snap.selectedEntityIds.length > 1 &&
          snap.selectedEntityIds.includes(entity.id)
        ) {
          const prevPos =
            lastEditDragPosRef.current || snap.entities[entity.id]?.position || entity.position;
          const remDx = finalX - prevPos.x;
          const remDy = finalY - prevPos.y;
          if (Math.abs(remDx) > 0.001 || Math.abs(remDy) > 0.001) {
            batchTranslateEntities(snap.selectedEntityIds, { dx: remDx, dy: remDy });
          }
        } else {
          updateEntityPosition(entity.id, {
            x: finalX,
            y: finalY,
          });
        }
        lastEditDragPosRef.current = null;
      } else {
        updateEntityPosition(entity.id, {
          x: finalX,
          y: finalY,
        });
      }
      evaluateRulesWithTemp();
      if (hasMovedBeyondDragThresholdRef.current) {
        triggerDragRelease(entity.id, {
          x: Math.round(finalX + entity.size.width / 2),
          y: Math.round(finalY + entity.size.height / 2),
        });
      }

      // Injection de l'élan physique au lancer en mode Play
      if (appMode === 'play' && throwable && dragSamplesRef.current.length >= 2) {
        const samples = dragSamplesRef.current;
        const lastRaw = samples[samples.length - 1];

        // Si la main s'est arrêtée plus de 90ms avant de relâcher le bouton, annuler le lancer
        if (now - lastRaw.time <= 90) {
          const last =
            now - lastRaw.time >= 4 && Math.hypot(finalX - lastRaw.x, finalY - lastRaw.y) > 0.5
              ? { x: finalX, y: finalY, time: now }
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

    setDragCursorLocked(false);
    setCursorState('release');
    setTimeout(() => {
      hasMovedBeyondDragThresholdRef.current = false;
      if (!isDraggingRef.current && !isDragCursorLocked()) {
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
    const zoomAtStart = Math.max(0.1, getCurrentCameraView().zoom || 1);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = (moveEvent.clientX - startX) / zoomAtStart;
      const deltaY = (moveEvent.clientY - startY) / zoomAtStart;

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
    const startWorld = screenToWorldPoint(e.clientX, e.clientY, rect, getCurrentCameraView());
    const startAngleRad = Math.atan2(
      startWorld.y - pivotWorld.y,
      startWorld.x - pivotWorld.x
    );
    const startRotationDeg = currentState.rotation ?? 0;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const liveRect = container.getBoundingClientRect();
      const curWorld = screenToWorldPoint(
        moveEvent.clientX,
        moveEvent.clientY,
        liveRect,
        getCurrentCameraView()
      );
      const curAngleRad = Math.atan2(
        curWorld.y - pivotWorld.y,
        curWorld.x - pivotWorld.x
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
    if (
      isPlayDisabled ||
      isDraggingRef.current ||
      isPhysicsGrabbingRef.current ||
      isDragCursorLocked() ||
      performance.now() - lastDragEndTimeRef.current < 130 ||
      appMode !== 'play'
    ) {
      return;
    }
    const pt = getSceneEventPosition(e.clientX, e.clientY);
    const isInside = isPointInsideEntityCollider(
      e.clientX,
      e.clientY,
      e.currentTarget,
      entity,
      currentState,
      buildEntityHitContext(entity, currentState)
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

  const hideNativeCursor = appMode === 'play' && useCustomCursors;
  const nativeTargetFlags =
    !hideNativeCursor &&
    appMode === 'play' &&
    entity.pointerDelegation &&
    entity.pointerDelegation !== 'self'
      ? getTargetInteractionFlags(resolvePointerTargetEntity(entity, useSceneStore.getState().entities))
      : { canDragTarget: canDrag, hasClickRulesTarget: hasClickRules };
  const nativeCursorClass = resolveNativeHitboxCursorClass({
    hideNativeCursor,
    appMode,
    canDrag: nativeTargetFlags.canDragTarget,
    hasClickRules: nativeTargetFlags.hasClickRulesTarget,
  });

  const hitboxProps: React.HTMLAttributes<HTMLDivElement> = {
    className: `absolute inset-0 ${
      appMode === 'play' && (entity.ignorePointer || entity.disabled) ? 'pointer-events-none' : 'pointer-events-auto'
    } flex items-center justify-center z-10 ${nativeCursorClass}`,
    style: {
      clipPath: colliderClipPath,
    },
    onContextMenu: (e) => {
      if (appMode === 'play') return;
      editContextMenuBind.onContextMenu(e);
    },
    onPointerEnter: handlePointerHoverCheck,
    onPointerMove: (e) => {
      if (appMode !== 'play') {
        editContextMenuBind.onPointerMove(e);
      }
      handlePointerHoverCheck(e);
    },
    onPointerCancel: () => {
      if (appMode !== 'play') {
        editContextMenuBind.onPointerCancel();
      }
    },
    onPointerLeave: (e) => {
      if (appMode !== 'play') {
        cancelLongPress();
      }
      if (appMode === 'play') {
        if (!isDraggingRef.current && !isPhysicsGrabbingRef.current && !isDragCursorLocked()) {
          setCursorState('idle');
        }
        if (isHoveringRef.current) {
          const exitId = hoveredTargetIdRef.current || entity.id;
          isHoveringRef.current = false;
          hoveredTargetIdRef.current = null;
          notifyEntityHoverState(exitId, false);
          triggerPointerEvent(exitId, 'exit', getSceneEventPosition(e.clientX, e.clientY));
        }
      }
    },
    onPointerDown: (e) => {
      const isInside = isPointInsideEntityCollider(
        e.clientX,
        e.clientY,
        e.currentTarget,
        entity,
        currentState,
        buildEntityHitContext(entity, currentState)
      );

      if (!isInside) {
        return;
      }

      e.stopPropagation();

      if (appMode !== 'play') {
        editContextMenuBind.onPointerDown(e);

        if (e.button === 2) {
          const snap = useSceneStore.getState();
          const alreadySelected =
            snap.selectedEntityId === entity.id ||
            snap.selectedEntityIds.includes(entity.id);
          if (!alreadySelected) {
            selectEntity(entity.id);
          }
          return;
        }

        if (e.shiftKey || e.metaKey || e.ctrlKey) {
          handledSelectionToggleOnDownRef.current = true;
          selectEntity(entity.id, { toggle: true });
          const stillSelected = useSceneStore.getState().selectedEntityIds.includes(entity.id);
          if (!stillSelected) {
            return;
          }
        } else {
          handledSelectionToggleOnDownRef.current = false;
          const snap = useSceneStore.getState();
          const alreadyInMulti =
            snap.selectedEntityIds.length > 1 &&
            snap.selectedEntityIds.includes(entity.id);
          if (!alreadyInMulti) {
            selectEntity(entity.id);
          }
        }
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
      const liveEntitiesMap = useSceneStore.getState().entities;
      const liveTarget = liveEntitiesMap[target.id] || target;
      if (liveTarget.disabled) {
        return;
      }
      const liveTargetState = liveTarget.states[liveTarget.currentStateId];
      const liveDragInfo = resolvePlayEntityDraggable(
        liveTarget,
        liveTargetState,
        isActiveBidirectionalDragTarget(liveTarget.id, liveEntitiesMap)
      );
      const canDragTarget =
        !isResizing && !isRotating && (target.id === entity.id ? liveDragInfo.canDrag && !isPlayDisabled : liveDragInfo.canDrag);

      const pt = getSceneEventPosition(e.clientX, e.clientY);
      upHandledForPointerRef.current = false;
      triggerPointerEvent(target.id, 'mouse_down', pt);

      const effParentOffset = resolveEffectiveParentOffset(liveTarget, liveTargetState);
      const attachMode = effParentOffset?.attachmentMode || 'rigid';
      const isDynamicAttachedChild = Boolean(
        liveTarget.parentId &&
          liveEntitiesMap[liveTarget.parentId] &&
          (attachMode === 'physics_joint' ||
            (attachMode === 'spring' && effParentOffset?.collideWithWorld === true))
      );

      // Mode 0 : Slider contraint (prioritaire sur draggable et saisie libre)
      if (canDragTarget && liveDragInfo.hasSlider && pt) {
        const entityCenter = {
          x: liveTarget.position.x + liveTarget.size.width / 2,
          y: liveTarget.position.y + liveTarget.size.height / 2,
        };
        const started = startSliderGrab(liveTarget.id, pt.x, pt.y, entityCenter);
        if (started) {
          if (physicsGrabCleanupRef.current) {
            physicsGrabCleanupRef.current();
            physicsGrabCleanupRef.current = null;
          }
          isPhysicsGrabbingRef.current = true;
          lastDragEvalTimeRef.current = 0;
          notifyEntityDragLifecycle(liveTarget.id, 'start', liveTarget.position);
          setIsDragging(true);
          setCursorState('drag');

          const downClientX = e.clientX;
          const downClientY = e.clientY;

          const handleSliderMove = (moveEv: PointerEvent) => {
            if (Math.hypot(moveEv.clientX - downClientX, moveEv.clientY - downClientY) > 4) {
              hasMovedBeyondDragThresholdRef.current = true;
            }
            const movePt = getSceneEventPosition(moveEv.clientX, moveEv.clientY);
            if (movePt) {
              updateSliderGrabTarget(liveTarget.id, movePt.x, movePt.y);
            }
            notifyEntityDragLifecycle(
              liveTarget.id,
              'move',
              undefined,
              hasMovedBeyondDragThresholdRef.current
            );
            setCursorState('drag');
          };

          const cleanupSliderListeners = () => {
            window.removeEventListener('pointermove', handleSliderMove);
            window.removeEventListener('pointerup', handleSliderUp);
            window.removeEventListener('pointercancel', handleSliderUp);
          };

          const handleSliderUp = (upEv: PointerEvent) => {
            cleanupSliderListeners();
            physicsGrabCleanupRef.current = null;
            isPhysicsGrabbingRef.current = false;
            lastDragEndTimeRef.current = performance.now();
            upHandledForPointerRef.current = true;

            endSliderGrab(liveTarget.id);
            notifyEntityDragLifecycle(
              liveTarget.id,
              'end',
              undefined,
              hasMovedBeyondDragThresholdRef.current
            );
            evaluateRulesWithTemp();

            const latestTarget =
              useSceneStore.getState().entities[liveTarget.id] || liveTarget;
            const upPt = getSceneEventPosition(upEv.clientX, upEv.clientY);
            const duration = Date.now() - (pointerDownTimeRef.current || 0);
            const dist = Math.hypot(upEv.clientX - downClientX, upEv.clientY - downClientY);
            const isPureClick = !hasMovedBeyondDragThresholdRef.current && dist < 6 && duration < 700;

            if (isPureClick) {
              lastHandledClickTimeRef.current = Date.now();
              selectEntity(liveTarget.id);
              triggerPointerEvent(liveTarget.id, 'click', upPt);
              triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
            } else {
              triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
              if (hasMovedBeyondDragThresholdRef.current) {
                triggerDragRelease(liveTarget.id, upPt);
              }
            }

            setIsDragging(false);
            setCursorState('release');
            setTimeout(() => {
              hasMovedBeyondDragThresholdRef.current = false;
              if (!isDraggingRef.current && !isPhysicsGrabbingRef.current) {
                setCursorState(getHoverStateFor(latestTarget));
              }
            }, 120);
          };

          physicsGrabCleanupRef.current = cleanupSliderListeners;
          window.addEventListener('pointermove', handleSliderMove);
          window.addEventListener('pointerup', handleSliderUp);
          window.addEventListener('pointercancel', handleSliderUp);
          return;
        }
      }

      // Mode 0b : Cadran Rotatif au Drag (rotate_drag)
      if (canDragTarget && liveDragInfo.hasRotateDrag && pt) {
        const rotateDragCfg = getEffectiveBehaviors(liveTarget, liveTargetState).find(
          (b): b is RotateDragBehaviorConfig => b.type === 'rotate_drag' && b.enabled !== false
        );
        if (rotateDragCfg) {
          const effPivot = resolveEffectivePivot(liveTarget, liveTargetState);
          const pivotWorld = getPivotWorldPosition(liveTarget.position, liveTarget.size, effPivot);
          const curRotDeg = liveTargetState?.rotation ?? 0;
          const started = startRotateDragGrab({
            entityId: liveTarget.id,
            pointerWorld: pt,
            pivotWorld,
            currentRotationDeg: curRotDeg,
            config: rotateDragCfg,
          });
          if (started) {
            if (physicsGrabCleanupRef.current) {
              physicsGrabCleanupRef.current();
              physicsGrabCleanupRef.current = null;
            }
            isPhysicsGrabbingRef.current = true;
            lastDragEvalTimeRef.current = 0;
            notifyEntityDragLifecycle(liveTarget.id, 'start', liveTarget.position);
            setIsDragging(true);
            setCursorState('drag');

            const downClientX = e.clientX;
            const downClientY = e.clientY;

            const handleRotateDragMove = (moveEv: PointerEvent) => {
              if (Math.hypot(moveEv.clientX - downClientX, moveEv.clientY - downClientY) > 4) {
                hasMovedBeyondDragThresholdRef.current = true;
              }
              const movePt = getSceneEventPosition(moveEv.clientX, moveEv.clientY);
              if (movePt) {
                const freshTarget = useSceneStore.getState().entities[liveTarget.id] || liveTarget;
                const freshState = freshTarget.states[freshTarget.currentStateId] || liveTargetState;
                const freshPivot = getPivotWorldPosition(
                  freshTarget.position,
                  freshTarget.size,
                  resolveEffectivePivot(freshTarget, freshState)
                );
                updateRotateDragGrabTarget(liveTarget.id, movePt, freshPivot, rotateDragCfg);
              }
              notifyEntityDragLifecycle(
                liveTarget.id,
                'move',
                undefined,
                hasMovedBeyondDragThresholdRef.current
              );
              setCursorState('drag');
            };

            const cleanupRotateDragListeners = () => {
              window.removeEventListener('pointermove', handleRotateDragMove);
              window.removeEventListener('pointerup', handleRotateDragUp);
              window.removeEventListener('pointercancel', handleRotateDragUp);
            };

            const handleRotateDragUp = (upEv: PointerEvent) => {
              cleanupRotateDragListeners();
              physicsGrabCleanupRef.current = null;
              isPhysicsGrabbingRef.current = false;
              lastDragEndTimeRef.current = performance.now();
              upHandledForPointerRef.current = true;

              endRotateDragGrab(liveTarget.id);
              notifyEntityDragLifecycle(
                liveTarget.id,
                'end',
                undefined,
                hasMovedBeyondDragThresholdRef.current
              );
              evaluateRulesWithTemp();

              const latestTarget =
                useSceneStore.getState().entities[liveTarget.id] || liveTarget;
              const upPt = getSceneEventPosition(upEv.clientX, upEv.clientY);
              const duration = Date.now() - (pointerDownTimeRef.current || 0);
              const dist = Math.hypot(upEv.clientX - downClientX, upEv.clientY - downClientY);
              const isPureClick =
                !hasMovedBeyondDragThresholdRef.current && dist < 6 && duration < 700;

              if (isPureClick) {
                lastHandledClickTimeRef.current = Date.now();
                selectEntity(liveTarget.id);
                triggerPointerEvent(liveTarget.id, 'click', upPt);
                triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
              } else {
                triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
                if (hasMovedBeyondDragThresholdRef.current) {
                  triggerDragRelease(liveTarget.id, upPt);
                }
              }

              setIsDragging(false);
              setCursorState('release');
              setTimeout(() => {
                hasMovedBeyondDragThresholdRef.current = false;
                if (!isDraggingRef.current && !isPhysicsGrabbingRef.current) {
                  setCursorState(getHoverStateFor(latestTarget));
                }
              }, 120);
            };

            physicsGrabCleanupRef.current = cleanupRotateDragListeners;
            window.addEventListener('pointermove', handleRotateDragMove);
            window.addEventListener('pointerup', handleRotateDragUp);
            window.addEventListener('pointercancel', handleRotateDragUp);
            return;
          }
        }
      }

      const effPhysicsForGrab = getEffectiveBehaviors(liveTarget, liveTargetState).find(
        (b): b is PhysicsBehaviorConfig => b.type === 'physics'
      );
      const hasLiveWorldPin =
        hasActiveWorldPin(liveTarget.id) ||
        Boolean(
          !isDynamicAttachedChild &&
            effPhysicsForGrab &&
            effPhysicsForGrab.enabled !== false &&
            !effPhysicsForGrab.isStatic &&
            effPhysicsForGrab.worldPinEnabled
        );

      // Mode 1 : Saisie physique (contrainte Matter.js au point cliqué si precisePhysicsGrab, enfant articulé ou World Pin actif)
      if (canDragTarget && (liveDragInfo.precisePhysicsGrab || isDynamicAttachedChild || hasLiveWorldPin) && pt) {
        const grabOptions = liveDragInfo.precisePhysicsGrab
          ? {
              rotationMode: liveDragInfo.grabRotationMode,
              maxAngle: liveDragInfo.grabMaxAngle,
              brakeAngle: liveDragInfo.grabBrakeAngle,
              angularStiffness: liveDragInfo.grabAngularStiffness,
              angularDamping: liveDragInfo.grabAngularDamping,
            }
          : { rotationMode: 'free' as const };
        const started = startPhysicsGrab(liveTarget.id, pt.x, pt.y, grabOptions);
        if (started) {
          if (physicsGrabCleanupRef.current) {
            physicsGrabCleanupRef.current();
            physicsGrabCleanupRef.current = null;
          }
          isPhysicsGrabbingRef.current = true;
          lastDragEvalTimeRef.current = 0;
          notifyEntityDragLifecycle(liveTarget.id, 'start', liveTarget.position);
          setIsDragging(true);
          setCursorState('drag');

          const downClientX = e.clientX;
          const downClientY = e.clientY;

          const handlePhysicsMove = (moveEv: PointerEvent) => {
            if (Math.hypot(moveEv.clientX - downClientX, moveEv.clientY - downClientY) > 4) {
              hasMovedBeyondDragThresholdRef.current = true;
            }
            const movePt = getSceneEventPosition(moveEv.clientX, moveEv.clientY);
            if (movePt) {
              updatePhysicsGrabTarget(liveTarget.id, movePt.x, movePt.y);
            }
            notifyEntityDragLifecycle(
              liveTarget.id,
              'move',
              undefined,
              hasMovedBeyondDragThresholdRef.current
            );
            setCursorState('drag');
            const now = performance.now();
            if (now - lastDragEvalTimeRef.current >= 16) {
              lastDragEvalTimeRef.current = now;
              evaluateRulesWithTemp();
            }
          };

          const cleanupPhysicsListeners = () => {
            window.removeEventListener('pointermove', handlePhysicsMove);
            window.removeEventListener('pointerup', handlePhysicsUp);
            window.removeEventListener('pointercancel', handlePhysicsUp);
          };

          const handlePhysicsUp = (upEv: PointerEvent) => {
            cleanupPhysicsListeners();
            physicsGrabCleanupRef.current = null;
            isPhysicsGrabbingRef.current = false;
            lastDragEndTimeRef.current = performance.now();
            upHandledForPointerRef.current = true;

            const latestTarget =
              useSceneStore.getState().entities[liveTarget.id] || liveTarget;
            const latestState = latestTarget.states[latestTarget.currentStateId];
            const latestDrag = resolvePlayEntityDraggable(
              latestTarget,
              latestState,
              isActiveBidirectionalDragTarget(latestTarget.id, useSceneStore.getState().entities)
            );

            endPhysicsGrab(
              liveTarget.id,
              latestDrag.throwable,
              latestDrag.maxThrowSpeed
            );
            notifyEntityDragLifecycle(
              liveTarget.id,
              'end',
              undefined,
              hasMovedBeyondDragThresholdRef.current
            );
            evaluateRulesWithTemp();

            const upPt = getSceneEventPosition(upEv.clientX, upEv.clientY);
            const duration = Date.now() - (pointerDownTimeRef.current || 0);
            const dist = Math.hypot(upEv.clientX - downClientX, upEv.clientY - downClientY);
            const isPureClick = !hasMovedBeyondDragThresholdRef.current && dist < 6 && duration < 700;

            if (isPureClick) {
              lastHandledClickTimeRef.current = Date.now();
              selectEntity(liveTarget.id);
              triggerPointerEvent(liveTarget.id, 'click', upPt);
              triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
            } else {
              triggerPointerEvent(liveTarget.id, 'mouse_up', upPt);
              if (hasMovedBeyondDragThresholdRef.current) {
                triggerDragRelease(liveTarget.id, upPt);
              }
            }

            setIsDragging(false);
            setCursorState('release');
            setTimeout(() => {
              hasMovedBeyondDragThresholdRef.current = false;
              if (!isDraggingRef.current && !isPhysicsGrabbingRef.current) {
                setCursorState(getHoverStateFor(latestTarget));
              }
            }, 120);
          };

          physicsGrabCleanupRef.current = cleanupPhysicsListeners;
          window.addEventListener('pointermove', handlePhysicsMove);
          window.addEventListener('pointerup', handlePhysicsUp);
          window.addEventListener('pointercancel', handlePhysicsUp);
          return;
        }
      }

      // Mode 2 : Balancement Marionnette depuis le point exact cliqué (cinématique Framer Motion)
      if (canDragTarget && liveDragInfo.swingAroundGrabPoint && pt) {
        const curEffPivot = resolveEffectivePivot(liveTarget, liveTargetState);
        const totalRot =
          (liveTargetState?.rotation ?? 0) +
          (liveTarget.runtimeTilt || 0) +
          (liveTarget.runtimeJiggleAngle || 0);
        const sBase = liveTargetState?.scale ?? 1;
        const sx = sBase * (liveTarget.runtimeScaleX ?? 1);
        const sy = sBase * (liveTarget.runtimeScaleY ?? 1);
        const grabRawPivot = computeLocalGrabPivotFromClientPoint({
          canvasPoint: pt,
          entityPosition: liveTarget.position,
          entitySize: liveTarget.size,
          currentEffPivot: curEffPivot,
          totalRotationDeg: totalRot,
          scaleX: sx,
          scaleY: sy,
          flipX: Boolean(liveTarget.flipX),
        });
        let reanchoredPos: { x: number; y: number } | undefined;
        if (Math.abs(totalRot) > 0.1) {
          const nextEffPivot = {
            x: liveTarget.flipX ? 1 - grabRawPivot.x : grabRawPivot.x,
            y: grabRawPivot.y,
          };
          reanchoredPos = reanchorPositionForPivotChange({
            position: liveTarget.position,
            size: liveTarget.size,
            oldEffPivot: curEffPivot,
            newEffPivot: nextEffPivot,
            rotationDeg: totalRot,
          });
          if (liveTarget.id === entity.id) {
            x.set(reanchoredPos.x);
            y.set(reanchoredPos.y);
          }
        }
        setPuppetGrabPivot(liveTarget.id, grabRawPivot, true);
        useSceneStore.getState().batchUpdateEntityTransforms({
          [liveTarget.id]: {
            ...(reanchoredPos ? { position: reanchoredPos } : {}),
            runtimePivot: grabRawPivot,
          },
        });
      }

      const targetHasClickRules =
        target.id === entity.id ? hasClickRules : hasEntityClickRules(liveTarget, rules);

      if (target.id !== entity.id) {
        if (canDragTarget) {
          setDragCursorLocked(true);
          getEntityDragControls(target.id)?.start(e);
          setCursorState('drag');
        } else {
          setCursorState(
            resolveEntityPressCursorState({
              appMode,
              canDrag: false,
              hasClickRules: targetHasClickRules,
            })
          );
        }
      } else if (canDrag) {
        setDragCursorLocked(true);
        dragControls.start(e);
        setCursorState('drag');
      } else {
        setCursorState(
          resolveEntityPressCursorState({
            appMode,
            canDrag: false,
            hasClickRules: targetHasClickRules,
          })
        );
      }

      const handleGlobalUp = (upEvent: PointerEvent) => {
        window.removeEventListener('pointerup', handleGlobalUp);
        window.removeEventListener('pointercancel', handleGlobalUp);
        releasePuppetGrabHold(liveTarget.id);
        if (isDragCursorLocked() && !isDraggingRef.current && !isPhysicsGrabbingRef.current) {
          setDragCursorLocked(false);
        }
        if (upHandledForPointerRef.current) return;
        upHandledForPointerRef.current = true;
        const upPt = getSceneEventPosition(upEvent.clientX, upEvent.clientY);
        triggerPointerEvent(target.id, 'mouse_up', upPt);
      };
      window.addEventListener('pointerup', handleGlobalUp, { once: true });
      window.addEventListener('pointercancel', handleGlobalUp, { once: true });
    },
    onPointerUp: (e) => {
      if (isPlayDisabled || isPhysicsGrabbingRef.current) {
        return;
      }
      const isInside = isPointInsideEntityCollider(
        e.clientX,
        e.clientY,
        e.currentTarget,
        entity,
        currentState,
        buildEntityHitContext(entity, currentState)
      );

      if (appMode !== 'play') {
        editContextMenuBind.onPointerUp();
        if (!hasMovedBeyondDragThresholdRef.current && isInside) {
          if (
            !consumeLongPressClick(e as any) &&
            !handledSelectionToggleOnDownRef.current &&
            !e.shiftKey &&
            !e.metaKey &&
            !e.ctrlKey
          ) {
            selectEntity(entity.id);
          }
        }
        handledSelectionToggleOnDownRef.current = false;
        isDraggingRef.current = false;
        setIsDragging(false);
        return;
      }

      const target =
        (pointerDownTargetIdRef.current && useSceneStore.getState().entities[pointerDownTargetIdRef.current]) ||
        getPlayPointerTarget();
      releasePuppetGrabHold(target.id);
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
        setDragCursorLocked(false);
        setCursorState(getHoverStateFor(target));
      } else if (!hasMovedBeyondDragThresholdRef.current && dist < 6) {
        isDraggingRef.current = false;
        setDragCursorLocked(false);
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
        currentState,
        buildEntityHitContext(entity, currentState)
      );
      if (!isInside) return;

      e.stopPropagation();
      if (appMode !== 'play') {
        if (consumeLongPressClick(e)) return;
        if (
          !e.shiftKey &&
          !e.metaKey &&
          !e.ctrlKey &&
          !handledSelectionToggleOnDownRef.current &&
          !hasMovedBeyondDragThresholdRef.current
        ) {
          selectEntity(entity.id);
        }
        handledSelectionToggleOnDownRef.current = false;
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

  const dragMagnetStyle: React.CSSProperties | undefined =
    appMode === 'play' && (dragMagOffset.x !== 0 || dragMagOffset.y !== 0)
      ? { translate: `${dragMagOffset.x}px ${dragMagOffset.y}px` }
      : undefined;

  return {
    appMode,
    showCanvasLabels,
    enableHoverScaleAnimation,
    isSelected,
    isPrimarySelected,
    showTransformHandles: isPrimarySelected || !isMultiSelected,
    isSameTypeSibling,
    currentState,
    canDragFromBehavior,
    hasSlider,
    canDrag,
    x,
    y,
    dragMagnetStyle,
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
