import { motion } from 'motion/react';
import { Entity, StrokeWiggleBehaviorConfig } from '../types';
import { useEffect, useMemo, useState } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { useEntityPointerInteraction } from '../hooks/useEntityPointerInteraction';
import { resolveEffectivePivot } from '../utils/physics/pivotHelpers';
import { getEffectiveBehaviors } from '../utils/physics/behaviorResolution';
import { buildWiggledPathVariants } from '../utils/strokeWiggle';
import { EntitySelectionOverlay, EntitySiblingHalo } from './EntitySelectionOverlay';

interface CustomShapeProps {
  entity: Entity;
  style?: React.CSSProperties;
}

export function CustomShape({ entity, style }: CustomShapeProps) {
  const {
    appMode,
    showCanvasLabels,
    enableHoverScaleAnimation,
    isSelected,
    isSameTypeSibling,
    currentState,
    canDragFromBehavior,
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
      color: '#eab308',
      scale: 1,
      rotation: 0,
      vectorPaths: [],
    },
    minResizeSize: 32,
    maxResizeSize: 600,
    useFallbackClipPath: false,
  });

  // Animation Flipbook par état en mode Play
  const [animFrameIndex, setAnimFrameIndex] = useState(0);
  const stateFrames = currentState?.frames;
  const hasFlipbook = Boolean(stateFrames && stateFrames.length > 1);

  useEffect(() => {
    setAnimFrameIndex(0);
    if (appMode !== 'play' || !stateFrames || stateFrames.length <= 1) return;

    const total = stateFrames.length;
    const fps = Math.max(1, Math.min(24, currentState.frameRate || 8));
    const loopMode = currentState.animationLoop || 'loop';
    let idx = 0;
    let dir: 1 | -1 = 1;

    const timer = window.setInterval(() => {
      if (loopMode === 'ping_pong') {
        let next = idx + dir;
        if (next >= total) {
          dir = -1;
          next = Math.max(0, total - 2);
        } else if (next < 0) {
          dir = 1;
          next = Math.min(total - 1, 1);
        }
        idx = next;
        setAnimFrameIndex(idx);
      } else if (loopMode === 'once') {
        if (idx + 1 >= total) return;
        idx = idx + 1;
        setAnimFrameIndex(idx);
      } else {
        idx = (idx + 1) % total;
        setAnimFrameIndex(idx);
      }
    }, Math.max(35, Math.round(1000 / fps)));

    return () => window.clearInterval(timer);
  }, [appMode, currentState.id, stateFrames?.length, currentState.frameRate, currentState.animationLoop]);

  const activeAnimFrame =
    appMode === 'play' && hasFlipbook && stateFrames
      ? stateFrames[Math.max(0, Math.min(animFrameIndex, stateFrames.length - 1))]
      : undefined;
  const activeVectorPaths = activeAnimFrame?.vectorPaths || currentState?.vectorPaths;
  const activeDrawingLayers =
    activeAnimFrame?.drawingLayers ??
    currentState?.drawingLayers ??
    (currentState.id === 'state_1' ? entity.drawingLayers : undefined);

  // Effet Wiggle des traits ("Boiling Lines") avec variantes pré-calculées en cache et liaison Variable optionnelle
  const effectiveBehaviors = getEffectiveBehaviors(entity, currentState);
  const wiggleBehavior = effectiveBehaviors.find(
    (b): b is StrokeWiggleBehaviorConfig => b.type === 'stroke_wiggle' && b.enabled
  );
  const ampVarName = wiggleBehavior?.amplitudeVariableName?.trim() || '';
  const fpsVarName = wiggleBehavior?.fpsVariableName?.trim() || '';
  const ampVarValue = useSceneStore((s) =>
    ampVarName ? (s.appMode === 'play' ? s.gameVariables[ampVarName] : s.initialGameVariables[ampVarName]) : undefined
  );
  const fpsVarValue = useSceneStore((s) =>
    fpsVarName ? (s.appMode === 'play' ? s.gameVariables[fpsVarName] : s.initialGameVariables[fpsVarName]) : undefined
  );

  const rawEffectiveAmp =
    (wiggleBehavior?.amplitude ?? 0) +
    (ampVarName ? (ampVarValue ?? 0) * (wiggleBehavior?.amplitudeVariableMultiplier ?? 1) : 0);
  // Quantification par pas de 0.2 pour éviter de recalculer les variantes sur du bruit flottant continu
  const quantizedAmplitude = Math.max(0, Math.min(15, Math.round(rawEffectiveAmp * 5) / 5));

  const rawEffectiveFps =
    (wiggleBehavior?.fps ?? 6) +
    (fpsVarName ? (fpsVarValue ?? 0) * (wiggleBehavior?.fpsVariableMultiplier ?? 1) : 0);
  const effectiveWiggleFps = Math.max(1, Math.min(24, Math.round(rawEffectiveFps)));

  const isWiggleActive = Boolean(
    wiggleBehavior &&
      (appMode === 'play' || wiggleBehavior.previewInEdit) &&
      quantizedAmplitude > 0.01 &&
      activeVectorPaths &&
      activeVectorPaths.length > 0
  );
  const wiggleVariants = useMemo(() => {
    if (!isWiggleActive || !wiggleBehavior || !activeVectorPaths) return null;
    return buildWiggledPathVariants(activeVectorPaths, {
      amplitude: quantizedAmplitude,
      frameCount: wiggleBehavior.frameCount,
      detail: wiggleBehavior.detail,
      segmentStep: wiggleBehavior.segmentStep,
      verticalScale: wiggleBehavior.verticalScale,
      endpointStability: wiggleBehavior.endpointStability,
      seed: wiggleBehavior.seed,
      affectFill: wiggleBehavior.affectFill,
    });
  }, [
    isWiggleActive,
    activeVectorPaths,
    quantizedAmplitude,
    wiggleBehavior?.frameCount,
    wiggleBehavior?.detail,
    wiggleBehavior?.segmentStep,
    wiggleBehavior?.verticalScale,
    wiggleBehavior?.endpointStability,
    wiggleBehavior?.seed,
    wiggleBehavior?.affectFill,
  ]);
  const [wiggleSlot, setWiggleSlot] = useState(0);

  useEffect(() => {
    setWiggleSlot(0);
    if (!isWiggleActive || !wiggleVariants || wiggleVariants.length <= 1 || !wiggleBehavior) return;
    const timer = window.setInterval(() => {
      setWiggleSlot((prev) => (prev + 1) % wiggleVariants.length);
    }, Math.max(40, Math.round(1000 / effectiveWiggleFps)));
    return () => window.clearInterval(timer);
  }, [isWiggleActive, wiggleVariants, effectiveWiggleFps]);

  const renderedVectorPaths =
    isWiggleActive && wiggleVariants && wiggleVariants.length > 0
      ? wiggleVariants[wiggleSlot % wiggleVariants.length]
      : activeVectorPaths;

  const effPivot = resolveEffectivePivot(entity, currentState);
  const baseScale = currentState.scale ?? 1;
  const runtimeScaleX = appMode === 'play' ? (entity.runtimeScaleX ?? 1) : 1;
  const runtimeScaleY = appMode === 'play' ? (entity.runtimeScaleY ?? 1) : 1;
  const totalRotation =
    (currentState.rotation ?? 0) +
    (appMode === 'play' ? (entity.runtimeTilt || 0) + (entity.runtimeJiggleAngle || 0) : 0);

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
      {/* Hitbox interactive délimitée strictement par le collider vert */}
      <div {...hitboxProps} />

      {/* Halo discret pour les instances partageant le même modèle */}
      {isSameTypeSibling && appMode !== 'play' && <EntitySiblingHalo colliderType={colliderType} />}

      {/* Anneau de sélection, rotation directe et poignée de redimensionnement */}
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

      {/* Barre / Cœurs de PV en mode Play */}
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
            <div className="flex items-center gap-1">
              <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-rose-500 transition-all duration-150"
                  style={{ width: `${Math.max(0, Math.min(100, (runtimeHealth.hp / runtimeHealth.maxHp) * 100))}%` }}
                />
              </div>
              <span className="text-[9px] font-mono font-bold text-rose-700">
                {runtimeHealth.hp}/{runtimeHealth.maxHp}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Visuel personnalisé : Vectoriel SVG, Image, Icône ou Forme SVG par défaut */}
      <div
        className={`relative w-full h-full flex items-center justify-center ${
          runtimeHealth?.isInvincible && healthConfig?.blinkOnDamage === true ? 'animate-pulse opacity-65' : ''
        }`}
        style={{ transform: entity.flipX ? 'scaleX(-1)' : undefined }}
      >
        {(renderedVectorPaths && renderedVectorPaths.length > 0) ? (
          <div className="w-full h-full flex items-center justify-center select-none p-1">
            <svg
              viewBox="0 0 200 200"
              className="w-full h-full pointer-events-none overflow-visible"
            >
              {(() => {
                const layers = activeDrawingLayers;
                const paths = renderedVectorPaths;
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
