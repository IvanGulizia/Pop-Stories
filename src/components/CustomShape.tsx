import { motion, useMotionValue, useDragControls } from 'motion/react';
import { Entity, EntityState } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { useEffect, useRef, useState } from 'react';
import { isPointInsideEntityCollider, getEntityColliderBounds } from '../utils/collider';
import { useAppCursor } from '../context/CursorContext';

interface CustomShapeProps {
  entity: Entity;
}

export function CustomShape({ entity }: CustomShapeProps) {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);
  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const showColliderDebugGizmos = useSceneStore((state) => state.settings.showColliderDebugGizmos);
  const appMode = useSceneStore((state) => state.appMode);

  const [isResizing, setIsResizing] = useState(false);
  const isDraggingRef = useRef(false);
  const hasMovedBeyondDragThresholdRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const dragControls = useDragControls();
  const { setCursorState, setIsDragging } = useAppCursor();

  const isSelected = selectedEntityId === entity.id;
  const currentState: EntityState = entity.states[entity.currentStateId] || {
    id: entity.currentStateId,
    name: entity.currentStateId,
    color: '#eab308',
    scale: 1,
    rotation: 0,
    vectorPaths: [],
  };

  const canDrag = !isResizing && (appMode !== 'play' || entity.isDraggable);
  const rules = useSceneStore((state) => state.rules);

  const hasClickRules = rules.some(
    (r) =>
      r.enabled &&
      r.trigger.type === 'click' &&
      ((r.trigger.subjectMode === 'instance' && r.trigger.subjectId === entity.id) ||
        (r.trigger.subjectMode === 'type' && r.trigger.subjectType === entity.type) ||
        (r.trigger.subjectMode === 'tag' && r.trigger.subjectTag && entity.tags?.includes(r.trigger.subjectTag)) ||
        (!r.trigger.subjectMode && (r.trigger.subjectId === entity.id || r.trigger.subjectType === entity.type)))
  );

  const isClickable = hasClickRules || appMode !== 'play';
  const isDraggable = canDrag;

  const getHoverState = (): import('../utils/cursorIcons').CursorState => {
    if (isDraggable && hasClickRules) {
      return 'hover_drag_click';
    }
    if (isDraggable) {
      return 'hover_drag';
    }
    if (isClickable) {
      return 'hover_click';
    }
    return 'idle';
  };

  const x = useMotionValue(entity.position.x);
  const y = useMotionValue(entity.position.y);

  useEffect(() => {
    x.set(entity.position.x);
    y.set(entity.position.y);
  }, [entity.position.x, entity.position.y, x, y]);

  const handleDragStart = () => {
    hasMovedBeyondDragThresholdRef.current = true;
    isDraggingRef.current = true;
    setIsDragging(true);
    setCursorState('drag');
  };

  const handleDrag = () => {
    hasMovedBeyondDragThresholdRef.current = true;
    isDraggingRef.current = true;
    setCursorState('drag');
    const currentX = x.get();
    const currentY = y.get();
    const numX = typeof currentX === 'string' ? parseFloat(currentX) : currentX;
    const numY = typeof currentY === 'string' ? parseFloat(currentY) : currentY;

    if (!isNaN(numX) && !isNaN(numY)) {
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
      triggerDragRelease(entity.id);
    }

    setIsDragging(false);
    setCursorState('release');
    setTimeout(() => {
      isDraggingRef.current = false;
      hasMovedBeyondDragThresholdRef.current = false;
      setCursorState(getHoverState());
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

      let newWidth = Math.max(32, Math.min(600, Math.round(startWidth + deltaX)));
      let newHeight = Math.max(32, Math.min(600, Math.round(startHeight + deltaY)));

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

  const colliderGeometry = getEntityColliderBounds(entity, currentState);
  const colliderType = colliderGeometry.colliderType;

  return (
    <motion.div
      className={`absolute flex items-center justify-center ${
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
      } ${isSelected ? 'z-30' : 'z-20'}`}
      style={{
        left: 0,
        top: 0,
        width: entity.size.width,
        height: entity.size.height,
        borderRadius: colliderType === 'circle' ? '50%' : '16px',
        x,
        y,
      }}
      drag={canDrag}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      onPointerEnter={(e) => {
        if (isDraggingRef.current || appMode !== 'play') return;
        const isInside = isPointInsideEntityCollider(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
          entity,
          currentState
        );
        if (isInside) {
          setCursorState(getHoverState());
        } else {
          setCursorState('idle');
        }
      }}
      onPointerMove={(e) => {
        if (isDraggingRef.current || appMode !== 'play') return;
        const isInside = isPointInsideEntityCollider(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
          entity,
          currentState
        );
        if (isInside) {
          setCursorState(getHoverState());
        } else {
          setCursorState('idle');
        }
      }}
      onPointerLeave={() => {
        if (!isDraggingRef.current && appMode === 'play') {
          setCursorState('idle');
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

        pointerDownPosRef.current = { x: e.clientX, y: e.clientY };
        hasMovedBeyondDragThresholdRef.current = false;
        isDraggingRef.current = false;

        if (canDrag) {
          dragControls.start(e);
          setCursorState('drag');
        } else {
          setCursorState('click');
        }
        triggerPointerEvent(entity.id, 'mouse_down');
      }}
      onPointerUp={(e) => {
        const isInside = isPointInsideEntityCollider(
          e.clientX,
          e.clientY,
          e.currentTarget as HTMLElement,
          entity,
          currentState
        );

        if (!hasMovedBeyondDragThresholdRef.current) {
          // Pure click / pointer release (no actual dragging)
          isDraggingRef.current = false;
          setIsDragging(false);
          if (isInside) {
            setCursorState(getHoverState());
            triggerPointerEvent(entity.id, 'mouse_up');
          } else {
            setCursorState('idle');
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
        selectEntity(entity.id);
        if (!hasMovedBeyondDragThresholdRef.current) {
          setCursorState(getHoverState());
          triggerPointerEvent(entity.id, 'click');
        }
      }}
      animate={{
        scale: currentState.scale,
        rotate: currentState.rotation,
      }}
      whileHover={{ scale: currentState.scale * (isSelected ? 1.0 : 1.03) }}
    >
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

      {/* Anneau de sélection et poignée de redimensionnement */}
      {isSelected && appMode !== 'play' && (
        <>
          <motion.div
            className={`absolute -inset-2 ${
              colliderType === 'circle' ? 'rounded-full' : 'rounded-2xl'
            } border-2 border-indigo-500 border-dashed pointer-events-none`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
          />

          {/* Poignée de redimensionnement de l'entité */}
          <div
            onPointerDown={handleResizePointerDown}
            onClick={(e) => e.stopPropagation()}
            className="absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize z-40 flex items-center justify-center hover:scale-125 transition-transform group"
            title="Glisser pour redimensionner"
          >
            <div className="w-2 h-2 bg-indigo-600 rounded-full group-hover:scale-110" />
          </div>

          {/* Badge de taille */}
          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none whitespace-nowrap">
            {entity.size.width} × {entity.size.height} px
          </div>
        </>
      )}

      {/* Visuel personnalisé : Vectoriel SVG, Image, Icône ou Forme SVG par défaut */}
      <div className="relative w-full h-full flex items-center justify-center">
        {(currentState?.vectorPaths && currentState.vectorPaths.length > 0) ? (
          <div className="w-full h-full flex items-center justify-center select-none p-1">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full pointer-events-none overflow-visible"
            >
              {currentState.vectorPaths.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  fill={p.fill || 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        ) : (currentState?.drawingDataUrl || entity.drawingDataUrl) ? (
          <div className="w-full h-full flex items-center justify-center p-1 select-none overflow-hidden">
            <img
              src={currentState?.drawingDataUrl || entity.drawingDataUrl}
              alt={entity.name}
              className="w-full h-full object-contain pointer-events-none"
            />
          </div>
        ) : (entity.vectorPaths && entity.vectorPaths.length > 0) ? (
          <div className="w-full h-full flex items-center justify-center select-none p-1">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full pointer-events-none overflow-visible"
            >
              {entity.vectorPaths.map((p) => (
                <path
                  key={p.id}
                  d={p.d}
                  stroke={p.stroke}
                  strokeWidth={p.strokeWidth}
                  fill={p.fill || 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))}
            </svg>
          </div>
        ) : entity.icon ? (
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl border border-white/20 transition-all duration-300 select-none"
            style={{
              backgroundColor: currentState.color,
            }}
          >
            {entity.icon}
          </div>
        ) : (
          <svg
            viewBox="0 0 24 24"
            className="w-16 h-16 transition-colors duration-300"
            fill={currentState.color}
            stroke="rgba(0,0,0,0.15)"
            strokeWidth="1"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
        )}
      </div>

      {/* Libellé minimaliste (si activé dans les réglages et pas en mode Play) */}
      {showCanvasLabels && appMode !== 'play' && (isSelected || entity.isDraggable) && (
        <div className="absolute -bottom-6 pointer-events-none bg-slate-800/90 text-white backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-xs border border-slate-700/50 flex items-center gap-1.5 whitespace-nowrap">
          {entity.isDraggable && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />}
          <span>{entity.name}</span>
          <span className="opacity-60 font-mono text-[9px]">({currentState.name})</span>
        </div>
      )}
    </motion.div>
  );
}
