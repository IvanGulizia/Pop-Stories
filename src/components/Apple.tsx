import { motion } from 'motion/react';
import { Entity } from '../types';
import { useEntityPointerInteraction } from '../hooks/useEntityPointerInteraction';

interface AppleProps {
  entity: Entity;
  style?: React.CSSProperties;
}

export function Apple({ entity, style }: AppleProps) {
  const {
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
    colliderType,
    healthConfig,
    runtimeHealth,
    hitboxProps,
  } = useEntityPointerInteraction({
    entity,
    fallbackState: {
      id: entity.currentStateId,
      name: entity.currentStateId,
      color: '#ef4444',
      scale: 1,
      rotation: 0,
    },
    minResizeSize: 32,
    maxResizeSize: 400,
    useFallbackClipPath: true,
  });

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
        scale: currentState.scale ?? 1,
        rotate: (currentState.rotation ?? 0) + (appMode === 'play' ? (entity.runtimeTilt || 0) : 0),
      }}
      transition={appMode === 'play' ? { duration: 0 } : undefined}
      whileHover={enableHoverScaleAnimation ? { scale: (currentState.scale ?? 1) * (isSelected ? 1.0 : 1.03) } : undefined}
    >
      {/* Hitbox interactive délimitée par le collider vert */}
      <div {...hitboxProps} />

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
            style={{ touchAction: 'none' }}
            className="pointer-events-auto absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize z-40 flex items-center justify-center hover:scale-125 transition-transform group"
            title="Glisser pour redimensionner"
          >
            <div className="w-2 h-2 bg-indigo-600 rounded-full group-hover:scale-110" />
          </div>

          <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none whitespace-nowrap">
            {entity.size.width} × {entity.size.height} px
          </div>
        </>
      )}

      {appMode === 'play' && healthConfig && healthConfig.showHealthBar !== false && runtimeHealth && (
        <div className="absolute -top-5 left-1/2 -translate-x-1/2 pointer-events-none z-50 flex items-center gap-0.5 bg-white/90 backdrop-blur-xs px-1.5 py-0.5 rounded-full border border-rose-200 shadow-xs whitespace-nowrap">
          {runtimeHealth.maxHp <= 6 ? (
            Array.from({ length: runtimeHealth.maxHp }).map((_, idx) => (
              <span
                key={idx}
                className={`text-[10px] leading-none ${
                  idx < runtimeHealth.hp ? 'text-rose-500' : 'text-slate-300'
                }`}
              >
                ♥
              </span>
            ))
          ) : (
            <span className="text-[9px] font-mono font-bold text-rose-700">
              ♥ {runtimeHealth.hp}/{runtimeHealth.maxHp}
            </span>
          )}
        </div>
      )}

      <div
        className={`relative w-full h-full flex items-center justify-center ${
          runtimeHealth?.isInvincible ? 'animate-pulse opacity-65' : ''
        }`}
        style={{ transform: entity.flipX ? 'scaleX(-1)' : undefined }}
      >
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
          {canDragFromBehavior && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse" />}
          {currentState.name}
        </div>
      )}
    </motion.div>
  );
}
