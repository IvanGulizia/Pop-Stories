import { motion } from 'motion/react';
import { Entity } from '../types';
import { useEntityPointerInteraction } from '../hooks/useEntityPointerInteraction';
import { resolveEffectivePivot } from '../utils/physics/pivotHelpers';
import { EntitySelectionOverlay, EntitySiblingHalo } from './EntitySelectionOverlay';

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
    showTransformHandles,
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

  const effPivot = resolveEffectivePivot(entity, currentState);
  const baseScale = currentState.scale ?? 1;
  const animScaleMult = appMode === 'play' ? (entity.runtimeAnimScale ?? 1) : 1;
  const runtimeScaleX = (appMode === 'play' ? (entity.runtimeScaleX ?? 1) : 1) * animScaleMult;
  const runtimeScaleY = (appMode === 'play' ? (entity.runtimeScaleY ?? 1) : 1) * animScaleMult;
  const runtimeOpacity = appMode === 'play' ? (entity.runtimeAnimOpacity ?? 1) : 1;
  const totalRotation =
    (currentState.rotation ?? 0) +
    (appMode === 'play'
      ? (entity.runtimeTilt || 0) + (entity.runtimeJiggleAngle || 0) + (entity.runtimeAnimRotation || 0)
      : 0);

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
        transformOrigin: `${effPivot.x * 100}% ${effPivot.y * 100}%`,
        zIndex: isSelected && appMode !== 'play' ? 30 : undefined,
        pointerEvents: 'none',
        opacity: runtimeOpacity,
        ...dragMagnetStyle,
        ...style,
      }}
      drag={appMode === 'play' && hasSlider ? false : canDrag}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
      onDragStart={handleDragStart}
      onDrag={handleDrag}
      onDragEnd={handleDragEnd}
      animate={{
        scaleX: baseScale * runtimeScaleX,
        scaleY: baseScale * runtimeScaleY,
        rotate: totalRotation,
      }}
      transition={appMode === 'play' ? { duration: 0 } : undefined}
      whileHover={
        enableHoverScaleAnimation
          ? {
              scaleX: baseScale * runtimeScaleX * (isSelected ? 1.0 : 1.03),
              scaleY: baseScale * runtimeScaleY * (isSelected ? 1.0 : 1.03),
            }
          : undefined
      }
    >
      {/* Hitbox interactive délimitée par le collider vert */}
      <div {...hitboxProps} />

      {/* Halo discret pour les instances partageant le même modèle */}
      {isSameTypeSibling && appMode !== 'play' && <EntitySiblingHalo colliderType={colliderType} />}

      {/* Selection Ring, Rotation & Resize Handles */}
      {isSelected && appMode !== 'play' && (
        <EntitySelectionOverlay
          colliderType={colliderType}
          width={entity.size.width}
          height={entity.size.height}
          rotation={currentState.rotation ?? 0}
          isRotating={isRotating}
          showHandles={showTransformHandles}
          onResizePointerDown={handleResizePointerDown}
          onRotatePointerDown={handleRotatePointerDown}
        />
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

      {appMode !== 'play' && entity.disabled && (
        <div
          className="absolute -top-2 -left-2 z-40 pointer-events-none px-1.5 py-0.5 rounded bg-slate-800/90 text-rose-300 border border-rose-400/50 text-[9px] font-black tracking-wider shadow-xs"
          title="Objet désactivé (ignoré en mode Play)"
        >
          OFF
        </div>
      )}

      <div
        className={`relative w-full h-full flex items-center justify-center ${
          runtimeHealth?.isInvincible && healthConfig?.blinkOnDamage === true ? 'animate-pulse opacity-65' : ''
        } ${appMode !== 'play' && entity.disabled ? 'opacity-45 grayscale-[35%]' : ''}`}
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
