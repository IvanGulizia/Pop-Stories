import { motion, useMotionValue, useDragControls } from 'motion/react';
import { Entity } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { useEffect, useRef, useState } from 'react';
import { isPointInsideEntityCollider, getColliderClipPath } from '../utils/collider';

interface AppleProps {
  entity: Entity;
}

export function Apple({ entity }: AppleProps) {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);

  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const appMode = useSceneStore((state) => state.appMode);

  const [isResizing, setIsResizing] = useState(false);
  const isDraggingRef = useRef(false);
  const dragControls = useDragControls();

  const isSelected = selectedEntityId === entity.id;
  const currentState = entity.states[entity.currentStateId] || {
    id: entity.currentStateId,
    name: entity.currentStateId,
    color: '#ef4444',
    scale: 1,
    rotation: 0,
  };

  const canDrag = !isResizing && (appMode !== 'play' || entity.isDraggable);

  const x = useMotionValue(entity.position.x);
  const y = useMotionValue(entity.position.y);

  // Sync external changes
  useEffect(() => {
    x.set(entity.position.x);
    y.set(entity.position.y);
  }, [entity.position.x, entity.position.y, x, y]);

  const handleDragStart = () => {
    isDraggingRef.current = true;
  };

  const handleDrag = () => {
    isDraggingRef.current = true;
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

    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
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

      let newWidth = Math.max(32, Math.min(400, Math.round(startWidth + deltaX)));
      let newHeight = Math.max(32, Math.min(400, Math.round(startHeight + deltaY)));

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

  const colliderType = currentState.colliderType || entity.colliderType || 'circle';

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
        if (canDrag) {
          dragControls.start(e);
        }
        triggerPointerEvent(entity.id, 'mouse_down');
      }}
      onPointerUp={(e) => {
        if (!isDraggingRef.current) {
          const isInside = isPointInsideEntityCollider(
            e.clientX,
            e.clientY,
            e.currentTarget as HTMLElement,
            entity,
            currentState
          );
          if (isInside) {
            triggerPointerEvent(entity.id, 'mouse_up');
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
        if (!isDraggingRef.current) {
          triggerPointerEvent(entity.id, 'click');
        }
      }}
      animate={{
        scale: currentState.scale,
        rotate: currentState.rotation,
      }}
      whileHover={{ scale: currentState.scale * (isSelected ? 1.0 : 1.03) }}
    >
      {/* Selection Ring & Resize Handle */}
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

      <div className="relative w-full h-full flex items-center justify-center">
        {/* Corps de la pomme */}
        <div
          className="w-full h-full rounded-[2rem] border-2 border-black/20 transition-colors duration-300 max-w-[85%] max-h-[85%]"
          style={{ backgroundColor: currentState.color }}
        />
        {/* Croquer la pomme si état "croquee" */}
        {currentState.id === 'croquee' && (
          <div className="absolute right-1 top-2 w-5 h-8 bg-slate-50 rounded-full border-l border-black/10" />
        )}
        {/* Ombre de volume */}
        <div className="absolute w-4 h-8 bg-white/30 rounded-full left-2 top-2 rotate-12 pointer-events-none" />
        {/* Queue */}
        <div className="absolute top-0 w-1.5 h-4 bg-amber-900 -mt-2 rounded-t-full -rotate-12 pointer-events-none" />
        {/* Feuille */}
        <div className="absolute top-0 right-3 w-5 h-3 bg-green-500 rounded-tl-full rounded-br-full -mt-1 rotate-12 pointer-events-none" />
      </div>

      {/* Comportement affiché seulement si activé dans les réglages et pas en mode play */}
      {showCanvasLabels && appMode !== 'play' && (
        <div className="absolute -bottom-7 pointer-events-none bg-white/90 backdrop-blur-xs px-2 py-0.5 rounded-md text-[11px] font-medium text-slate-700 shadow-xs border border-slate-200 flex items-center gap-1 whitespace-nowrap">
          {entity.isDraggable && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
          {currentState.name}
        </div>
      )}
    </motion.div>
  );
}
