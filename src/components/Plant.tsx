import { motion, useMotionValue, useDragControls } from 'motion/react';
import { Entity } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { useEffect, useRef, useState } from 'react';
import { isPointInsideEntityCollider, getEntityColliderBounds, getEntityColliderClipPath } from '../utils/collider';
import { useAppCursor } from '../context/CursorContext';
import { isEntityDraggable, setEntityRuntimeVelocity, syncEntityDragPosition } from '../utils/matterPhysicsEngine';

interface PlantProps {
  entity: Entity;
  style?: React.CSSProperties;
}

export function Plant({ entity, style }: PlantProps) {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);
  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const enableHoverScaleAnimation = useSceneStore((state) => state.settings.enableHoverScaleAnimation);
  const showColliderDebugGizmos = useSceneStore((state) => state.settings.showColliderDebugGizmos);
  const appMode = useSceneStore((state) => state.appMode);

  const [isResizing, setIsResizing] = useState(false);
  const isDraggingRef = useRef(false);
  const hasMovedBeyondDragThresholdRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const lastHandledClickTimeRef = useRef<number>(0);
  const upHandledForPointerRef = useRef<boolean>(false);
  const dragControls = useDragControls();
  const { setCursorState, setIsDragging } = useAppCursor();

  const isSelected = selectedEntityId === entity.id;
  const currentState = entity.states[entity.currentStateId] || {
    id: entity.currentStateId,
    name: entity.currentStateId,
    color: '#22c55e',
    scale: 1,
    rotation: 0,
    stemHeight: 40,
    flowerColor: '#ec4899',
    flowerPetals: 6,
  };

  const { canDrag: canDragFromBehavior, throwable, maxThrowSpeed } = isEntityDraggable(entity, currentState);
  const canDrag = !isResizing && (appMode !== 'play' || canDragFromBehavior);
  const dragSamplesRef = useRef<{ x: number; y: number; time: number }[]>([]);

  const x = useMotionValue(entity.position.x);
  const y = useMotionValue(entity.position.y);
  const isHoveringRef = useRef(false);

  const getSceneEventPosition = (clientX: number, clientY: number) => {
    const container = document.getElementById('scene-canvas-container');
    if (!container) return undefined;
    const rect = container.getBoundingClientRect();
    return {
      x: Math.round((clientX - rect.left) * 10) / 10,
      y: Math.round((clientY - rect.top) * 10) / 10,
    };
  };

  useEffect(() => {
    x.set(entity.position.x);
    y.set(entity.position.y);
  }, [entity.position.x, entity.position.y, x, y]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
    dragSamplesRef.current = [{ x: entity.position.x, y: entity.position.y, time: performance.now() }];
    setIsDragging(true);
    setCursorState('drag');
  };

  const handleDrag = () => {
    isDraggingRef.current = true;
    setCursorState('drag');
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

    const now = performance.now();
    dragSamplesRef.current.push({ x: numX, y: numY, time: now });
    if (dragSamplesRef.current.length > 5) {
      dragSamplesRef.current.shift();
    }

    if (!isNaN(numX) && !isNaN(numY)) {
      if (appMode === 'play') {
        syncEntityDragPosition(entity.id, numX, numY, entity.size.width, entity.size.height);
      }
      evaluateRulesWithTemp({
        [entity.id]: { x: numX, y: numY },
      });
    }
  };

  const handleDragEnd = () => {
    const currentX = x.get();
    const currentY = y.get();
    const numX = typeof currentX === 'string' ? parseFloat(currentX) : currentX;
    const numY = typeof currentY === 'string' ? parseFloat(currentY) : currentY;

    if (!isNaN(numX) && !isNaN(numY)) {
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

      // Injection de l'élan physique au lâcher en mode Play
      if (appMode === 'play' && throwable && dragSamplesRef.current.length >= 2) {
        const samples = dragSamplesRef.current;
        const now = performance.now();
        const last = samples[samples.length - 1];

        if (now - last.time <= 90) {
          let first = samples[0];
          for (let i = samples.length - 2; i >= 0; i--) {
            if (last.time - samples[i].time >= 35) {
              first = samples[i];
              break;
            }
          }
          const dt = (last.time - first.time) / 1000;
          if (dt > 0.01 && dt < 0.3) {
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
      isDraggingRef.current = false;
      hasMovedBeyondDragThresholdRef.current = false;
      setCursorState(canDrag ? 'hover_drag' : 'hover_click');
    }, 120);
  };

  const handleResizePointerDown = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);

    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = entity.size.width;
    const startHeight = entity.size.height;

    const handlePointerMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      let newWidth = Math.max(48, Math.min(400, Math.round(startWidth + deltaX)));
      let newHeight = Math.max(48, Math.min(400, Math.round(startHeight + deltaY)));

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

  const stemHeight = currentState.stemHeight ?? 40;
  const flowerColor = currentState.flowerColor || '#ec4899';
  const petals = currentState.flowerPetals ?? (currentState.id === 'fleur' ? 8 : 0);
  const hasFlower = petals > 0 || stemHeight > 60;

  const petalAngles = Array.from({ length: petals }, (_, i) => (360 / Math.max(1, petals)) * i);

  const colliderGeometry = getEntityColliderBounds(entity, currentState);
  const colliderType = colliderGeometry.colliderType;
  const colliderClipPath = getEntityColliderClipPath(entity, currentState) || (colliderType === 'circle' ? 'circle(50% at 50% 50%)' : 'inset(0% round 16px)');

  return (
    <motion.div
      className="absolute flex flex-col items-center justify-end select-none"
      style={{
        left: 0,
        top: 0,
        x,
        y,
        width: entity.size.width,
        height: entity.size.height,
        zIndex: isSelected && appMode !== 'play' ? 30 : undefined,
        pointerEvents: 'none',
        ...style,
      }}
      drag={canDrag}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={{
        scale: currentState.scale,
        rotate: currentState.rotation,
      }}
      transition={appMode === 'play' ? { duration: 0 } : { type: 'spring', bounce: 0.35, duration: 0.6 }}
      whileHover={enableHoverScaleAnimation ? { scale: currentState.scale * (isSelected ? 1.0 : 1.03) } : undefined}
    >
      {/* Hitbox interactive délimitée strictement par le collider vert */}
      <div
        className={`absolute inset-0 pointer-events-auto flex items-center justify-center z-10 ${
          canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        style={{
          clipPath: colliderClipPath,
        }}
        onPointerEnter={(e) => {
          if (isDraggingRef.current || appMode !== 'play') return;
          const pt = getSceneEventPosition(e.clientX, e.clientY);
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
            entity,
            currentState
          );
          if (isInside) {
            setCursorState(canDrag ? 'hover_drag' : 'hover_click');
            if (!isHoveringRef.current) {
              isHoveringRef.current = true;
              triggerPointerEvent(entity.id, 'enter', pt);
            }
          } else {
            setCursorState('idle');
            if (isHoveringRef.current) {
              isHoveringRef.current = false;
              triggerPointerEvent(entity.id, 'exit', pt);
            }
          }
        }}
        onPointerMove={(e) => {
          if (isDraggingRef.current || appMode !== 'play') return;
          const pt = getSceneEventPosition(e.clientX, e.clientY);
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
            entity,
            currentState
          );
          if (isInside) {
            setCursorState(canDrag ? 'hover_drag' : 'hover_click');
            if (!isHoveringRef.current) {
              isHoveringRef.current = true;
              triggerPointerEvent(entity.id, 'enter', pt);
            }
          } else {
            setCursorState('idle');
            if (isHoveringRef.current) {
              isHoveringRef.current = false;
              triggerPointerEvent(entity.id, 'exit', pt);
            }
          }
        }}
        onPointerLeave={(e) => {
          if (appMode === 'play' && isHoveringRef.current) {
            isHoveringRef.current = false;
            setCursorState('idle');
            triggerPointerEvent(entity.id, 'exit', getSceneEventPosition(e.clientX, e.clientY));
          }
        }}
        onPointerDown={(e) => {
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
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

          if (canDrag) {
            dragControls.start(e);
            if (appMode === 'play') setCursorState('drag');
          } else {
            if (appMode === 'play') setCursorState('click');
          }
          if (appMode === 'play') {
            upHandledForPointerRef.current = false;
            const pt = getSceneEventPosition(e.clientX, e.clientY);
            triggerPointerEvent(entity.id, 'mouse_down', pt);

            const handleGlobalUp = (upEvent: PointerEvent) => {
              window.removeEventListener('pointerup', handleGlobalUp);
              if (upHandledForPointerRef.current) return;
              upHandledForPointerRef.current = true;
              const upPt = getSceneEventPosition(upEvent.clientX, upEvent.clientY);
              triggerPointerEvent(entity.id, 'mouse_up', upPt);
            };
            window.addEventListener('pointerup', handleGlobalUp, { once: true });
          }
        }}
        onPointerUp={(e) => {
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
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

          upHandledForPointerRef.current = true;
          const pt = getSceneEventPosition(e.clientX, e.clientY);
          const duration = Date.now() - (pointerDownTimeRef.current || 0);
          const dist = pointerDownPosRef.current
            ? Math.hypot(e.clientX - pointerDownPosRef.current.x, e.clientY - pointerDownPosRef.current.y)
            : 0;

          const isPureClick = !hasMovedBeyondDragThresholdRef.current && dist < 6 && duration < 700;

          if (isPureClick && isInside) {
            lastHandledClickTimeRef.current = Date.now();
            selectEntity(entity.id);
            triggerPointerEvent(entity.id, 'click', pt);
            triggerPointerEvent(entity.id, 'mouse_up', pt);
            setCursorState(canDrag ? 'hover_drag' : 'hover_click');
          } else if (!hasMovedBeyondDragThresholdRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            if (isInside) {
              setCursorState(canDrag ? 'hover_drag' : 'hover_click');
              triggerPointerEvent(entity.id, 'mouse_up', pt);
            } else {
              setCursorState('idle');
              triggerPointerEvent(entity.id, 'mouse_up', pt);
            }
          }
        }}
        onClick={(e) => {
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
            entity,
            currentState
          );
          if (!isInside) {
            return;
          }

          e.stopPropagation();
          if (appMode !== 'play') {
            selectEntity(entity.id);
            return;
          }

          if (Date.now() - (lastHandledClickTimeRef.current || 0) < 350) {
            return;
          }

          selectEntity(entity.id);
          if (!hasMovedBeyondDragThresholdRef.current) {
            lastHandledClickTimeRef.current = Date.now();
            setCursorState(canDrag ? 'hover_drag' : 'hover_click');
            triggerPointerEvent(entity.id, 'click', getSceneEventPosition(e.clientX, e.clientY));
          }
        }}
      />
      {/* Gizmo Debug des Colliders (si activé dans les réglages) */}
      {showColliderDebugGizmos && (
        <div className="absolute inset-0 pointer-events-none z-50">
          <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
            {colliderGeometry.colliderType === 'circle' ? (
              <circle
                cx={colliderGeometry.centerX}
                cy={colliderGeometry.centerY}
                r={colliderGeometry.radius}
                fill="rgba(16, 185, 129, 0.15)"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 3"
              />
            ) : (
              <rect
                x={colliderGeometry.x}
                y={colliderGeometry.y}
                width={colliderGeometry.width}
                height={colliderGeometry.height}
                fill="rgba(16, 185, 129, 0.15)"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="4 3"
                rx="4"
              />
            )}
          </svg>
          <div className="absolute -top-3.5 -left-3.5 bg-emerald-700 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs flex items-center gap-1 whitespace-nowrap">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-ping" />
            <span>Zone : {colliderGeometry.colliderType}</span>
          </div>
        </div>
      )}

      {/* Anneau de sélection & poignée de redimensionnement */}
      {isSelected && appMode !== 'play' && (
        <>
          <motion.div
            className={`absolute -inset-2 ${
              colliderType === 'circle' ? 'rounded-full' : 'rounded-2xl'
            } border-2 border-indigo-500 border-dashed pointer-events-none`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          />

          <div
            onPointerDown={handleResizePointerDown}
            onClick={(e) => e.stopPropagation()}
            className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize z-40 flex items-center justify-center hover:scale-125 transition-transform group"
            title="Glisser pour redimensionner"
          >
            <div className="w-2 h-2 bg-indigo-600 rounded-full group-hover:scale-110" />
          </div>

          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none whitespace-nowrap">
            {entity.size.width} × {entity.size.height} px
          </div>
        </>
      )}

      <div
        className="relative w-full h-full flex items-end justify-center"
        style={{ transform: entity.flipX ? 'scaleX(-1)' : undefined }}
      >
        {/* Pot / Terre */}
        <div className="absolute bottom-0 w-24 h-12 bg-amber-800 rounded-b-xl rounded-t-sm z-10 shadow-sm" />

        {/* Tige */}
        <motion.div
          className="absolute bottom-10 rounded-full z-0"
          style={{ backgroundColor: currentState.color }}
          initial={false}
          animate={{
            height: stemHeight,
            width: 8,
          }}
          transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        />

        {/* Feuille gauche */}
        <motion.div
          className="absolute rounded-tl-full rounded-br-full origin-bottom-right"
          style={{ backgroundColor: currentState.color }}
          initial={false}
          animate={{
            bottom: 10 + stemHeight * 0.4,
            left: '50%',
            width: stemHeight * 0.35,
            height: stemHeight * 0.22,
            marginLeft: 4,
            rotate: 20,
          }}
          transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        />

        {/* Feuille droite */}
        <motion.div
          className="absolute rounded-tr-full rounded-bl-full origin-bottom-left"
          style={{ backgroundColor: currentState.color }}
          initial={false}
          animate={{
            bottom: 10 + stemHeight * 0.3,
            right: '50%',
            width: stemHeight * 0.3,
            height: stemHeight * 0.18,
            marginRight: 4,
            rotate: -20,
          }}
          transition={{ type: 'spring', bounce: 0.4, duration: 0.6 }}
        />

        {/* Fleur (Apparaît selon l'état) */}
        <motion.div
          className="absolute z-20 flex items-center justify-center"
          style={{ bottom: 10 + stemHeight + 10 }}
          initial={false}
          animate={{
            scale: hasFlower ? 1 : 0,
            opacity: hasFlower ? 1 : 0,
          }}
          transition={{ type: 'spring', bounce: 0.5, duration: 0.7 }}
        >
          {/* Pétales dynamiques */}
          {petalAngles.map((rot) => (
            <div
              key={rot}
              className="absolute w-5 h-10 rounded-full origin-bottom shadow-sm"
              style={{
                backgroundColor: flowerColor,
                transform: `rotate(${rot}deg) translateY(-8px)`,
              }}
            />
          ))}
          {/* Centre de la fleur */}
          {hasFlower && <div className="absolute w-7 h-7 bg-amber-300 rounded-full z-10 shadow-inner border border-amber-400" />}
        </motion.div>
      </div>

      {/* Label de l'état */}
      {showCanvasLabels && appMode !== 'play' && (
        <div className="absolute -bottom-7 bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700 shadow-xs border border-slate-200 pointer-events-none whitespace-nowrap">
          {currentState.name}
        </div>
      )}
    </motion.div>
  );
}
