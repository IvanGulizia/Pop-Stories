import { motion, useMotionValue, useDragControls } from 'motion/react';
import { Entity, EntityState } from '../types';
import { useSceneStore } from '../store/useSceneStore';
import { useEffect, useRef, useState } from 'react';
import { isPointInsideEntityCollider, getEntityColliderBounds, getEntityColliderClipPath } from '../utils/collider';
import { useAppCursor } from '../context/CursorContext';
import { isEntityDraggable, setEntityRuntimeVelocity, syncEntityDragPosition } from '../utils/matterPhysicsEngine';

interface CustomShapeProps {
  entity: Entity;
  style?: React.CSSProperties;
}

export function CustomShape({ entity, style }: CustomShapeProps) {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const triggerPointerEvent = useSceneStore((state) => state.triggerPointerEvent);
  const triggerDragRelease = useSceneStore((state) => state.triggerDragRelease);
  const updateEntityPosition = useSceneStore((state) => state.updateEntityPosition);
  const updateEntitySize = useSceneStore((state) => state.updateEntitySize);
  const evaluateRulesWithTemp = useSceneStore((state) => state.evaluateRulesWithTemp);
  const showCanvasLabels = useSceneStore((state) => state.settings.showCanvasLabels);
  const showColliderDebugGizmos = useSceneStore((state) => state.settings.showColliderDebugGizmos);
  const enableHoverScaleAnimation = useSceneStore((state) => state.settings.enableHoverScaleAnimation);
  const appMode = useSceneStore((state) => state.appMode);

  const [isResizing, setIsResizing] = useState(false);
  const isDraggingRef = useRef(false);
  const hasMovedBeyondDragThresholdRef = useRef(false);
  const pointerDownPosRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownTimeRef = useRef<number>(0);
  const lastHandledClickTimeRef = useRef<number>(0);
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

  const { canDrag: canDragFromBehavior, throwable, maxThrowSpeed } = isEntityDraggable(entity, currentState);
  const canDrag = !isResizing && (appMode !== 'play' || canDragFromBehavior);
  const dragSamplesRef = useRef<{ x: number; y: number; time: number }[]>([]);
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
  const isHoveringRef = useRef(false);

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
    isDraggingRef.current = true;
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

    // Échantillonnage de la trajectoire pour le calcul d'inertie de lancer
    const now = performance.now();
    dragSamplesRef.current.push({ x: numX, y: numY, time: now });
    if (dragSamplesRef.current.length > 5) {
      dragSamplesRef.current.shift();
    }

    isDraggingRef.current = true;
    setCursorState('drag');

    if (!isNaN(numX) && !isNaN(numY)) {
      if (appMode === 'play') {
        syncEntityDragPosition(entity.id, numX, numY, entity.size.width, entity.size.height);
      }
      evaluateRulesWithTemp({
        [entity.id]: { x: numX, y: numY },
      });
    }
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

      // Injection de l'élan physique au lancer en mode Play
      if (appMode === 'play' && throwable && dragSamplesRef.current.length >= 2) {
        const samples = dragSamplesRef.current;
        const now = performance.now();
        const last = samples[samples.length - 1];

        // Si la main s'est arrêtée plus de 90ms avant de relâcher le bouton, annuler le lancer
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
  const colliderClipPath = getEntityColliderClipPath(entity, currentState);

  return (
    <motion.div
      className="absolute flex items-center justify-center select-none"
      style={{
        left: 0,
        top: 0,
        width: entity.size.width,
        height: entity.size.height,
        x,
        y,
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
      transition={appMode === 'play' ? { duration: 0 } : undefined}
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
            setCursorState(getHoverState());
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
            setCursorState(getHoverState());
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
            const pt = getSceneEventPosition(e.clientX, e.clientY);
            triggerPointerEvent(entity.id, 'mouse_down', pt);
            triggerPointerEvent(entity.id, 'down', pt);

            const handleGlobalUp = (upEvent: PointerEvent) => {
              window.removeEventListener('pointerup', handleGlobalUp);
              const upPt = getSceneEventPosition(upEvent.clientX, upEvent.clientY);
              triggerPointerEvent(entity.id, 'mouse_up', upPt);
              triggerPointerEvent(entity.id, 'up', upPt);
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
            setCursorState(getHoverState());
          } else if (!hasMovedBeyondDragThresholdRef.current) {
            isDraggingRef.current = false;
            setIsDragging(false);
            if (isInside) {
              setCursorState(getHoverState());
              triggerPointerEvent(entity.id, 'mouse_up', pt);
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
          if (!isInside) return;

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
            setCursorState(getHoverState());
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
      <div
        className="relative w-full h-full flex items-center justify-center"
        style={{ transform: entity.flipX ? 'scaleX(-1)' : undefined }}
      >
        {(currentState?.vectorPaths && currentState.vectorPaths.length > 0) ? (
          <div className="w-full h-full flex items-center justify-center select-none p-1">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full pointer-events-none overflow-visible"
            >
              {(() => {
                const layers = currentState.drawingLayers || (currentState.id === 'state_1' ? entity.drawingLayers : undefined);
                const paths = currentState.vectorPaths;
                if (!layers || layers.length === 0) {
                  return paths.map((p) => (
                    <path
                      key={p.id}
                      d={p.d}
                      stroke={p.stroke}
                      strokeWidth={p.strokeWidth}
                      fill={p.fill || 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ));
                }
                const fallbackLayerId = layers[layers.length - 1]?.id || 'layer-1';
                const layerIds = new Set(layers.map((l) => l.id));
                return [...layers].reverse().map((layer) => {
                  if (!layer.visible) return null;
                  const layerPaths = paths.filter((p) => {
                    const resolvedId = p.layerId && layerIds.has(p.layerId) ? p.layerId : fallbackLayerId;
                    return resolvedId === layer.id;
                  });
                  return (
                    <g key={layer.id} opacity={layer.opacity ?? 1}>
                      {layerPaths.map((p) => (
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
                    </g>
                  );
                });
              })()}
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
              {(() => {
                const layers = entity.drawingLayers;
                const paths = entity.vectorPaths;
                if (!layers || layers.length === 0) {
                  return paths.map((p) => (
                    <path
                      key={p.id}
                      d={p.d}
                      stroke={p.stroke}
                      strokeWidth={p.strokeWidth}
                      fill={p.fill || 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ));
                }
                const fallbackLayerId = layers[layers.length - 1]?.id || 'layer-1';
                const layerIds = new Set(layers.map((l) => l.id));
                return [...layers].reverse().map((layer) => {
                  if (!layer.visible) return null;
                  const layerPaths = paths.filter((p) => {
                    const resolvedId = p.layerId && layerIds.has(p.layerId) ? p.layerId : fallbackLayerId;
                    return resolvedId === layer.id;
                  });
                  return (
                    <g key={layer.id} opacity={layer.opacity ?? 1}>
                      {layerPaths.map((p) => (
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
                    </g>
                  );
                });
              })()}
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
      {showCanvasLabels && appMode !== 'play' && (isSelected || canDragFromBehavior) && (
        <div className="absolute -bottom-6 pointer-events-none bg-slate-800/90 text-white backdrop-blur-xs px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-wide shadow-xs border border-slate-700/50 flex items-center gap-1.5 whitespace-nowrap">
          {canDragFromBehavior && <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-ping" />}
          <span>{entity.name}</span>
          <span className="opacity-60 font-mono text-[9px]">({currentState.name})</span>
        </div>
      )}
    </motion.div>
  );
}
