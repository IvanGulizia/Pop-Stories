import { motion } from 'motion/react';
import { Entity } from '../types';
import { useEntityPointerInteraction } from '../hooks/useEntityPointerInteraction';
import { resolveEffectivePivot } from '../utils/physics/pivotHelpers';
import { EntitySelectionOverlay, EntitySiblingHalo } from './EntitySelectionOverlay';

interface PlantProps {
  entity: Entity;
  style?: React.CSSProperties;
}

export function Plant({ entity, style }: PlantProps) {
  const {
    appMode,
    showCanvasLabels,
    enableHoverScaleAnimation,
    isSelected,
    isSameTypeSibling,
    currentState,
    hasSlider,
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
    healthConfig,
    runtimeHealth,
    hitboxProps,
  } = useEntityPointerInteraction({
    entity,
    fallbackState: {
      id: entity.currentStateId,
      name: entity.currentStateId,
      color: '#22c55e',
      scale: 1,
      rotation: 0,
      stemHeight: 40,
      flowerColor: '#ec4899',
      flowerPetals: 6,
    },
    minResizeSize: 48,
    maxResizeSize: 400,
    useFallbackClipPath: true,
  });

  const stemHeight = currentState.stemHeight ?? 40;
  const flowerColor = currentState.flowerColor || '#ec4899';
  const petals = currentState.flowerPetals ?? (currentState.id === 'fleur' ? 8 : 0);
  const hasFlower = petals > 0 || stemHeight > 60;

  const petalAngles = Array.from({ length: petals }, (_, i) => (360 / Math.max(1, petals)) * i);

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
      className="absolute flex flex-col items-center justify-end select-none"
      style={{
        left: 0,
        top: 0,
        x,
        y,
        width: entity.size.width,
        height: entity.size.height,
        transformOrigin: `${effPivot.x * 100}% ${effPivot.y * 100}%`,
        zIndex: isSelected && appMode !== 'play' ? 30 : undefined,
        pointerEvents: 'none',
        opacity: runtimeOpacity,
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
      transition={appMode === 'play' ? { duration: 0 } : { type: 'spring', bounce: 0.35, duration: 0.6 }}
      whileHover={
        enableHoverScaleAnimation
          ? {
              scaleX: baseScale * runtimeScaleX * (isSelected ? 1.0 : 1.03),
              scaleY: baseScale * runtimeScaleY * (isSelected ? 1.0 : 1.03),
            }
          : undefined
      }
    >
      {/* Hitbox interactive délimitée strictement par le collider vert */}
      <div {...hitboxProps} />

      {/* Halo discret pour les instances partageant le même modèle */}
      {isSameTypeSibling && appMode !== 'play' && <EntitySiblingHalo colliderType={colliderType} />}

      {/* Anneau de sélection, rotation directe & poignée de redimensionnement */}
      {isSelected && appMode !== 'play' && (
        <EntitySelectionOverlay
          colliderType={colliderType}
          width={entity.size.width}
          height={entity.size.height}
          rotation={currentState.rotation ?? 0}
          isRotating={isRotating}
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
        className={`relative w-full h-full flex items-end justify-center ${
          runtimeHealth?.isInvincible && healthConfig?.blinkOnDamage === true ? 'animate-pulse opacity-65' : ''
        } ${appMode !== 'play' && entity.disabled ? 'opacity-45 grayscale-[35%]' : ''}`}
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
