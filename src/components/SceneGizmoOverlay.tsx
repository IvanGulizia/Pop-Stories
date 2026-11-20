import React, { useEffect, useState } from 'react';
import { EMPTY_LIST, useSceneStore } from '../store/useSceneStore';
import {
  ConstantVelocityBehaviorConfig,
  Entity,
  FleeBehaviorConfig,
  FollowBehaviorConfig,
  InteractivePuppetBehaviorConfig,
  JiggleBehaviorConfig,
  LookAtBehaviorConfig,
  MoveToBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  PatrolBehaviorConfig,
  PhysicsBehaviorConfig,
  Position,
  SliderBehaviorConfig,
  WanderingBehaviorConfig,
} from '../types';
import { getEntityWorldColliderBounds } from '../utils/collider';
import { isGizmoCategoryVisible, resolveGizmoSettings } from '../utils/gizmoHelpers';
import {
  getActiveDragPositions,
  getEffectiveBehaviors,
  getGizmoRuntimeDebugData,
} from '../utils/matterPhysicsEngine';
import { getSliderTrackGeometry } from '../utils/physics/sliderSolver';
import {
  getParentAnchorWorldPosition,
  getPivotWorldPosition,
  resolveEffectivePivot,
} from '../utils/physics/pivotHelpers';
import {
  computeJointRestWorldDeg,
  resolveJointLimits,
} from '../utils/physics/jointAngularSolver';

interface SceneGizmoOverlayProps {
  mousePosRef: React.MutableRefObject<{ x: number; y: number } | null>;
}

function degToRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function getEntityCenter(entity: Entity): Position {
  return {
    x: entity.position.x + entity.size.width / 2,
    y: entity.position.y + entity.size.height / 2,
  };
}

function buildSpringZigzagPoints(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  coils = 7,
  amplitude = 5.5
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.hypot(dx, dy);
  if (dist < 10) {
    return `${x1},${y1} ${x2},${y2}`;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  const nx = -uy;
  const ny = ux;
  const lead = Math.min(10, dist * 0.16);
  const pts: string[] = [`${x1},${y1}`];
  const pStartX = x1 + ux * lead;
  const pStartY = y1 + uy * lead;
  pts.push(`${pStartX.toFixed(1)},${pStartY.toFixed(1)}`);

  const usable = dist - lead * 2;
  if (usable > 6) {
    for (let i = 1; i <= coils; i++) {
      const t = (i - 0.5) / coils;
      const side = i % 2 === 0 ? 1 : -1;
      const px = pStartX + ux * (usable * t) + nx * (amplitude * side);
      const py = pStartY + uy * (usable * t) + ny * (amplitude * side);
      pts.push(`${px.toFixed(1)},${py.toFixed(1)}`);
    }
  }

  const pEndX = x2 - ux * lead;
  const pEndY = y2 - uy * lead;
  pts.push(`${pEndX.toFixed(1)},${pEndY.toFixed(1)}`);
  pts.push(`${x2},${y2}`);
  return pts.join(' ');
}

function computeResolvedParentRotation(
  entity: Entity,
  entities: Record<string, Entity>,
  isPlayMode: boolean
): { baseRot: number; effectiveFlip: boolean } {
  const visited = new Set<string>([entity.id]);
  const chain: Entity[] = [];
  let curr: Entity | undefined = entity.parentId ? entities[entity.parentId] : undefined;
  while (curr && !visited.has(curr.id)) {
    visited.add(curr.id);
    chain.unshift(curr);
    curr = curr.parentId ? entities[curr.parentId] : undefined;
  }

  let accRot = 0;
  let accFlip = false;
  for (const anc of chain) {
    const ancState = anc.states[anc.currentStateId];
    accRot = (ancState?.rotation ?? 0) + (isPlayMode ? (anc.runtimeTilt ?? 0) : 0);
    accFlip = Boolean(anc.flipX);
  }

  if (!entity.parentId || !entities[entity.parentId]) {
    return { baseRot: 0, effectiveFlip: Boolean(entity.flipX) };
  }

  const offset = entity.parentOffset || {
    x: 0,
    y: 0,
    rotationOffset: 0,
    inheritRotation: true,
    inheritFlip: true,
  };
  const inheritRot = offset.inheritRotation !== false;
  const inheritFlip = offset.inheritFlip !== false;
  const rotOffset = (offset.rotationOffset || 0) * (inheritFlip && accFlip ? -1 : 1);
  return {
    baseRot: (inheritRot ? accRot : 0) + rotOffset,
    effectiveFlip: inheritFlip ? accFlip : Boolean(entity.flipX),
  };
}

function buildArcSectorPath(
  cx: number,
  cy: number,
  r: number,
  startAngleDeg: number,
  endAngleDeg: number
): string {
  const span = Math.abs(endAngleDeg - startAngleDeg);
  if (span >= 359.5) {
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`;
  }
  const startRad = degToRad(startAngleDeg);
  const endRad = degToRad(endAngleDeg);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const largeArc = span > 180 ? 1 : 0;
  const sweep = endAngleDeg >= startAngleDeg ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${largeArc} ${sweep} ${x2} ${y2} Z`;
}

export function SceneGizmoOverlay({ mousePosRef }: SceneGizmoOverlayProps) {
  const rawEntities = useSceneStore((state) => state.entities);
  const entityOrder = useSceneStore((state) => state.entityOrder || EMPTY_LIST);
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const appMode = useSceneStore((state) => state.appMode);
  const settings = useSceneStore((state) => state.settings);
  const layerGroups = useSceneStore((state) => state.layerGroups || EMPTY_LIST);
  const sceneBounds = useSceneStore((state) => state.sceneBounds);

  const isPlayMode = appMode === 'play';
  const resolvedSettings = resolveGizmoSettings(settings);
  const showHitboxes = isGizmoCategoryVisible(settings, 'hitboxes', isPlayMode);
  const showColliderLayers = isGizmoCategoryVisible(settings, 'colliderLayers', isPlayMode);
  const showHierarchy = isGizmoCategoryVisible(settings, 'hierarchy', isPlayMode);
  const showLookAt = isGizmoCategoryVisible(settings, 'lookAt', isPlayMode);
  const showPuppetZones = isGizmoCategoryVisible(settings, 'puppetZones', isPlayMode);
  const showAiZones = isGizmoCategoryVisible(settings, 'aiZones', isPlayMode);
  const showPhysicsVectors = isGizmoCategoryVisible(settings, 'physicsVectors', isPlayMode);
  const showSpringsAndJiggle = isGizmoCategoryVisible(settings, 'springsAndJiggle', isPlayMode);
  const showSliders = isGizmoCategoryVisible(settings, 'sliders', isPlayMode);

  const anyVisible =
    showHitboxes ||
    showColliderLayers ||
    showHierarchy ||
    showLookAt ||
    showPuppetZones ||
    showAiZones ||
    showPhysicsVectors ||
    showSpringsAndJiggle ||
    showSliders;

  // Rafraîchissement fluide en Mode Play pour cibles souris / orbites / zones IA / ressorts & sliders
  const [, setTick] = useState(0);
  useEffect(() => {
    if (
      !isPlayMode ||
      !anyVisible ||
      (!showLookAt && !showAiZones && !showPuppetZones && !showSpringsAndJiggle && !showSliders)
    ) {
      return;
    }
    let rafId = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlayMode, anyVisible, showLookAt, showAiZones, showPuppetZones, showSpringsAndJiggle, showSliders]);

  if (!anyVisible) return null;

  const activeDrags = isPlayMode ? getActiveDragPositions() : null;
  const entities: Record<string, Entity> =
    activeDrags && Object.keys(activeDrags).length > 0
      ? Object.fromEntries(
          Object.entries(rawEntities).map(([id, ent]) =>
            activeDrags[id] ? [id, { ...ent, position: activeDrags[id] }] : [id, ent]
          )
        )
      : rawEntities;

  const order = entityOrder.length > 0 ? entityOrder : Object.keys(entities);
  const allIds = Array.from(new Set([...order, ...Object.keys(entities)]));
  const allEntities = allIds
    .map((id) => entities[id])
    .filter((e): e is Entity => Boolean(e) && e.visible !== false);

  const filterOnlySelected = resolvedSettings.onlySelected;
  const targetEntities = filterOnlySelected
    ? selectedEntityId && entities[selectedEntityId] && entities[selectedEntityId].visible !== false
      ? [entities[selectedEntityId]]
      : []
    : allEntities;

  const runtimeDebug = isPlayMode ? getGizmoRuntimeDebugData() : null;
  const liveMousePos = mousePosRef.current;

  return (
    <svg
      className="absolute inset-0 w-full h-full pointer-events-none z-[45] overflow-visible select-none"
      aria-hidden="true"
    >
      <defs>
        <marker
          id="gizmo-arrow-indigo"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill="#6366f1" />
        </marker>
        <marker
          id="gizmo-arrow-cyan"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill="#06b6d4" />
        </marker>
        <marker
          id="gizmo-arrow-rose"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill="#f43f5e" />
        </marker>
        <marker
          id="gizmo-arrow-amber"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill="#f59e0b" />
        </marker>
        <marker
          id="gizmo-arrow-fuchsia"
          markerWidth="7"
          markerHeight="7"
          refX="5.5"
          refY="3.5"
          orient="auto"
        >
          <path d="M 0 0.5 L 6 3.5 L 0 6.5 z" fill="#d946ef" />
        </marker>
      </defs>

      {/* 1. CALQUES COLLIDERS DE DÉCOR */}
      {showColliderLayers &&
        layerGroups.flatMap((g) =>
          g.layers
            .filter(
              (l) =>
                (l.role === 'collider' || g.kind === 'collider') &&
                l.visible &&
                (l.vectorPaths?.length || 0) > 0
            )
            .map((layer) => {
              const isLegacy200 = layer.coordinateSpace === 'legacy_200';
              const sx = isLegacy200 ? Math.max(100, sceneBounds.width || 800) / 200 : 1;
              const sy = isLegacy200 ? Math.max(100, sceneBounds.height || 500) / 200 : 1;
              const isTrigger = Boolean(layer.colliderIsTrigger);
              const tagsText = (layer.colliderTags || []).map((t) => `#${t.replace(/^#/, '')}`).join(' ');
              let badgeX = 12;
              let badgeY = 18;
              const firstPath = layer.vectorPaths?.[0];
              if (firstPath?.rect) {
                badgeX = firstPath.rect.x * sx;
                badgeY = Math.max(14, firstPath.rect.y * sy - 6);
              } else if (firstPath?.points && firstPath.points.length > 0) {
                badgeX = firstPath.points[0].x * sx;
                badgeY = Math.max(14, firstPath.points[0].y * sy - 6);
              }

              return (
                <g key={`gizmo-col-layer-${layer.id}`}>
                  <g transform={isLegacy200 ? `scale(${sx} ${sy})` : undefined}>
                    {(layer.vectorPaths || []).map((p, idx) => (
                      <path
                        key={p.id || idx}
                        d={p.d}
                        stroke={isTrigger ? '#38bdf8' : '#f97316'}
                        strokeWidth={Math.max(2, (p.strokeWidth || 4) / Math.max(1, sx))}
                        strokeDasharray="6 4"
                        strokeOpacity={0.75}
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        transform={p.transform}
                      />
                    ))}
                  </g>
                  <g transform={`translate(${badgeX}, ${badgeY})`}>
                    <rect
                      x={0}
                      y={-12}
                      width={Math.min(220, 68 + (tagsText ? tagsText.length * 6 : 0))}
                      height={15}
                      rx={4}
                      fill={isTrigger ? '#0284c7' : '#ea580c'}
                      fillOpacity={0.88}
                    />
                    <text
                      x={5}
                      y={-1.5}
                      fill="#ffffff"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {isTrigger ? 'Capteur' : 'Collider'}
                      {tagsText ? ` ${tagsText}` : ''}
                    </text>
                  </g>
                </g>
              );
            })
        )}

      {/* 2. HIÉRARCHIE & PIVOTS (PARENT -> ENFANT) */}
      {showHierarchy && (
        <>
          {allEntities.map((child) => {
            if (!child.parentId || !entities[child.parentId] || entities[child.parentId].visible === false) return null;
            if (
              filterOnlySelected &&
              selectedEntityId !== child.id &&
              selectedEntityId !== child.parentId
            ) {
              return null;
            }
            const parent = entities[child.parentId];
            const pState = parent.states[parent.currentStateId];
            const cState = child.states[child.currentStateId];
            const pPivot = getPivotWorldPosition(
              parent.position,
              parent.size,
              resolveEffectivePivot(parent, pState)
            );
            const cPivot = getPivotWorldPosition(
              child.position,
              child.size,
              resolveEffectivePivot(child, cState)
            );
            const midX = (pPivot.x + cPivot.x) / 2;
            const midY = (pPivot.y + cPivot.y) / 2;
            const showDelta =
              selectedEntityId === child.id || selectedEntityId === parent.id;
            const dx = Math.round(child.parentOffset?.x ?? cPivot.x - pPivot.x);
            const dy = Math.round(child.parentOffset?.y ?? cPivot.y - pPivot.y);

            return (
              <g key={`gizmo-hier-${child.id}`}>
                <line
                  x1={pPivot.x}
                  y1={pPivot.y}
                  x2={cPivot.x}
                  y2={cPivot.y}
                  stroke="#6366f1"
                  strokeWidth="1.75"
                  strokeDasharray="5 4"
                  strokeOpacity={0.85}
                  markerEnd="url(#gizmo-arrow-indigo)"
                />
                <circle
                  cx={pPivot.x}
                  cy={pPivot.y}
                  r={4.5}
                  fill="#ffffff"
                  stroke="#6366f1"
                  strokeWidth="2"
                />
                <circle
                  cx={cPivot.x}
                  cy={cPivot.y}
                  r={3.5}
                  fill="#6366f1"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                {showDelta && (
                  <g transform={`translate(${midX}, ${midY - 8})`}>
                    <rect
                      x={-34}
                      y={-10}
                      width={68}
                      height={14}
                      rx={4}
                      fill="#4338ca"
                      fillOpacity={0.9}
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      Δ({dx},{dy})
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* Réticules de pivot sur entités sélectionnées, attachées ou à pivot décentré */}
          {targetEntities.map((entity) => {
            const st = entity.states[entity.currentStateId];
            const effPivot = resolveEffectivePivot(entity, st);
            const isOffCenter =
              Math.abs(effPivot.x - 0.5) > 0.015 || Math.abs(effPivot.y - 0.5) > 0.015;
            if (!isOffCenter && selectedEntityId !== entity.id && !entity.parentId) {
              return null;
            }
            const pw = getPivotWorldPosition(entity.position, entity.size, effPivot);
            return (
              <g key={`gizmo-pivot-${entity.id}`}>
                <circle
                  cx={pw.x}
                  cy={pw.y}
                  r={5.5}
                  fill="none"
                  stroke="#d946ef"
                  strokeWidth="1.5"
                  strokeOpacity={0.9}
                />
                <line x1={pw.x - 8} y1={pw.y} x2={pw.x + 8} y2={pw.y} stroke="#d946ef" strokeWidth="1.3" />
                <line x1={pw.x} y1={pw.y - 8} x2={pw.x} y2={pw.y + 8} stroke="#d946ef" strokeWidth="1.3" />
                <circle cx={pw.x} cy={pw.y} r={2} fill="#d946ef" />
              </g>
            );
          })}
        </>
      )}

      {/* 3. ZONES MARIONNETTE (INTERACTIVE PUPPET) */}
      {showPuppetZones &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const effective = getEffectiveBehaviors(entity, currentState);
          const puppet = effective.find((b) => b.type === 'interactive_puppet') as
            | InteractivePuppetBehaviorConfig
            | undefined;
          if (!puppet) return null;

          const wb = getEntityWorldColliderBounds(entity, currentState);
          const physics = effective.find((b) => b.type === 'physics') as
            | PhysicsBehaviorConfig
            | undefined;
          const far = Math.max(0, puppet.approachFarDistance ?? 280);
          const near = Math.max(0, puppet.approachNearDistance ?? 120);
          const minFall = Math.max(0, puppet.minFallHeight ?? 20);
          const tilt = isPlayMode ? entity.runtimeTilt || 0 : 0;

          return (
            <g key={`gizmo-puppet-${entity.id}`}>
              {far > 0 &&
                (wb.colliderType === 'circle' ? (
                  <circle
                    cx={wb.centerX}
                    cy={wb.centerY}
                    r={wb.radius + far}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="1.25"
                    strokeDasharray="6 5"
                    strokeOpacity={0.45}
                  />
                ) : (
                  <rect
                    x={wb.x - far}
                    y={wb.y - far}
                    width={wb.width + far * 2}
                    height={wb.height + far * 2}
                    rx={Math.min(36, far * 0.25)}
                    fill="none"
                    stroke="#8b5cf6"
                    strokeWidth="1.25"
                    strokeDasharray="6 5"
                    strokeOpacity={0.45}
                  />
                ))}
              {far > 0 && (
                <text
                  x={wb.centerX}
                  y={wb.colliderType === 'circle' ? wb.centerY - wb.radius - far - 4 : wb.y - far - 4}
                  textAnchor="middle"
                  fill="#7c3aed"
                  fillOpacity={0.85}
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  Approche loin ({far}px)
                </text>
              )}

              {near > 0 &&
                (wb.colliderType === 'circle' ? (
                  <circle
                    cx={wb.centerX}
                    cy={wb.centerY}
                    r={wb.radius + near}
                    fill="rgba(139, 92, 246, 0.04)"
                    stroke="#8b5cf6"
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                  />
                ) : (
                  <rect
                    x={wb.x - near}
                    y={wb.y - near}
                    width={wb.width + near * 2}
                    height={wb.height + near * 2}
                    rx={Math.min(24, near * 0.25)}
                    fill="rgba(139, 92, 246, 0.04)"
                    stroke="#8b5cf6"
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                    strokeOpacity={0.7}
                  />
                ))}
              {near > 0 && (
                <text
                  x={wb.centerX}
                  y={wb.colliderType === 'circle' ? wb.centerY - wb.radius - near - 4 : wb.y - near - 4}
                  textAnchor="middle"
                  fill="#6d28d9"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  Proche ({near}px)
                </text>
              )}

              {physics && !physics.isStatic && minFall > 0 && (
                <g opacity={0.75}>
                  <line
                    x1={wb.centerX - 18}
                    y1={wb.y + wb.height + minFall}
                    x2={wb.centerX + 18}
                    y2={wb.y + wb.height + minFall}
                    stroke="#8b5cf6"
                    strokeWidth="1.5"
                    strokeDasharray="3 2"
                  />
                  <line
                    x1={wb.centerX}
                    y1={wb.y + wb.height}
                    x2={wb.centerX}
                    y2={wb.y + wb.height + minFall}
                    stroke="#8b5cf6"
                    strokeWidth="1"
                    strokeDasharray="2 2"
                  />
                </g>
              )}

              {isPlayMode && puppet.swingAroundGrabPoint && entity.runtimePivot && (() => {
                const grabEffPivot = resolveEffectivePivot(entity, currentState);
                const grabWorld = getPivotWorldPosition(entity.position, entity.size, grabEffPivot);
                return (
                  <g>
                    <circle
                      cx={grabWorld.x}
                      cy={grabWorld.y}
                      r={7}
                      fill="rgba(139, 92, 246, 0.16)"
                      stroke="#7c3aed"
                      strokeWidth="1.6"
                    />
                    <line
                      x1={grabWorld.x - 9}
                      y1={grabWorld.y}
                      x2={grabWorld.x + 9}
                      y2={grabWorld.y}
                      stroke="#7c3aed"
                      strokeWidth="1.4"
                    />
                    <line
                      x1={grabWorld.x}
                      y1={grabWorld.y - 9}
                      x2={grabWorld.x}
                      y2={grabWorld.y + 9}
                      stroke="#7c3aed"
                      strokeWidth="1.4"
                    />
                    <circle cx={grabWorld.x} cy={grabWorld.y} r={2.5} fill="#06b6d4" />
                  </g>
                );
              })()}

              {Math.abs(tilt) > 0.5 && (
                <g transform={`translate(${wb.centerX}, ${wb.y - 16})`}>
                  <rect x={-36} y={-10} width={72} height={14} rx={4} fill="#6d28d9" fillOpacity={0.9} />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    Pendule {Math.round(tilt)}°
                  </text>
                </g>
              )}
            </g>
          );
        })}

      {/* 4. ZONES IA (BALADE, PATROUILLE, FUITE, SUIVI, ALLER VERS) */}
      {showAiZones &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const effective = getEffectiveBehaviors(entity, currentState);
          const center = getEntityCenter(entity);
          const elements: React.ReactNode[] = [];

          const wandering = effective.find((b) => b.type === 'wandering') as
            | WanderingBehaviorConfig
            | undefined;
          if (wandering) {
            const wData = runtimeDebug?.wanderOrigins[entity.id];
            const origin = wData?.origin || center;
            const r = Math.max(20, wandering.radius ?? 160);
            elements.push(
              <g key={`ai-wander-${entity.id}`}>
                {wandering.mode === 'horizontal' ? (
                  <>
                    <line
                      x1={origin.x - r}
                      y1={origin.y}
                      x2={origin.x + r}
                      y2={origin.y}
                      stroke="#f43f5e"
                      strokeWidth="1.75"
                      strokeDasharray="5 4"
                      strokeOpacity={0.8}
                    />
                    <line
                      x1={origin.x - r}
                      y1={origin.y - 8}
                      x2={origin.x - r}
                      y2={origin.y + 8}
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                    <line
                      x1={origin.x + r}
                      y1={origin.y - 8}
                      x2={origin.x + r}
                      y2={origin.y + 8}
                      stroke="#f43f5e"
                      strokeWidth="2"
                    />
                  </>
                ) : (
                  <circle
                    cx={origin.x}
                    cy={origin.y}
                    r={r}
                    fill="rgba(244, 63, 94, 0.04)"
                    stroke="#f43f5e"
                    strokeWidth="1.5"
                    strokeDasharray="6 4"
                    strokeOpacity={0.75}
                  />
                )}
                <circle cx={origin.x} cy={origin.y} r={3} fill="#f43f5e" />
                {wData?.targetPoint && (
                  <>
                    <line
                      x1={center.x}
                      y1={center.y}
                      x2={wData.targetPoint.x}
                      y2={wData.targetPoint.y}
                      stroke="#f43f5e"
                      strokeWidth="1.25"
                      strokeDasharray="3 3"
                      markerEnd="url(#gizmo-arrow-rose)"
                    />
                    <circle
                      cx={wData.targetPoint.x}
                      cy={wData.targetPoint.y}
                      r={4}
                      fill="none"
                      stroke="#f43f5e"
                      strokeWidth="1.5"
                    />
                  </>
                )}
              </g>
            );
          }

          const patrol = effective.find((b) => b.type === 'patrol') as
            | PatrolBehaviorConfig
            | undefined;
          if (patrol) {
            const pOrigPos = runtimeDebug?.patrolOrigins[entity.id];
            const origin = pOrigPos
              ? { x: pOrigPos.x + entity.size.width / 2, y: pOrigPos.y + entity.size.height / 2 }
              : center;
            const range = Math.max(10, patrol.range ?? 120);
            const isVert = patrol.axis === 'vertical';
            const x1 = isVert ? origin.x : origin.x - range;
            const y1 = isVert ? origin.y - range : origin.y;
            const x2 = isVert ? origin.x : origin.x + range;
            const y2 = isVert ? origin.y + range : origin.y;
            elements.push(
              <g key={`ai-patrol-${entity.id}`}>
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke="#f43f5e"
                  strokeWidth="1.75"
                  strokeDasharray="5 3"
                  strokeOpacity={0.85}
                />
                {isVert ? (
                  <>
                    <line x1={x1 - 7} y1={y1} x2={x1 + 7} y2={y1} stroke="#f43f5e" strokeWidth="2" />
                    <line x1={x2 - 7} y1={y2} x2={x2 + 7} y2={y2} stroke="#f43f5e" strokeWidth="2" />
                  </>
                ) : (
                  <>
                    <line x1={x1} y1={y1 - 7} x2={x1} y2={y1 + 7} stroke="#f43f5e" strokeWidth="2" />
                    <line x1={x2} y1={y2 - 7} x2={x2} y2={y2 + 7} stroke="#f43f5e" strokeWidth="2" />
                  </>
                )}
                <circle cx={origin.x} cy={origin.y} r={3} fill="#f43f5e" />
              </g>
            );
          }

          const flee = effective.find((b) => b.type === 'flee') as FleeBehaviorConfig | undefined;
          if (flee && (flee.fleeRadius ?? 220) > 0) {
            const fr = flee.fleeRadius ?? 220;
            elements.push(
              <g key={`ai-flee-${entity.id}`}>
                <circle
                  cx={center.x}
                  cy={center.y}
                  r={fr}
                  fill="rgba(244, 63, 94, 0.03)"
                  stroke="#e11d48"
                  strokeWidth="1.3"
                  strokeDasharray="4 4"
                  strokeOpacity={0.65}
                />
                <text
                  x={center.x}
                  y={center.y - fr - 4}
                  textAnchor="middle"
                  fill="#be123c"
                  fontSize="9"
                  fontFamily="monospace"
                  fontWeight="700"
                >
                  Fuite {fr}px
                </text>
              </g>
            );
          }

          const follow = effective.find((b) => b.type === 'follow') as
            | FollowBehaviorConfig
            | undefined;
          if (follow) {
            const minD = Math.max(0, follow.minDistance ?? 40);
            const tEnt =
              follow.targetType === 'entity' && follow.targetEntityId
                ? entities[follow.targetEntityId]
                : undefined;
            const tCenter = tEnt ? getEntityCenter(tEnt) : null;
            elements.push(
              <g key={`ai-follow-${entity.id}`}>
                {minD > 0 && (
                  <circle
                    cx={center.x}
                    cy={center.y}
                    r={minD}
                    fill="none"
                    stroke="#fb7185"
                    strokeWidth="1.25"
                    strokeDasharray="3 3"
                    strokeOpacity={0.8}
                  />
                )}
                {tCenter && (
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={tCenter.x}
                    y2={tCenter.y}
                    stroke="#f43f5e"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    markerEnd="url(#gizmo-arrow-rose)"
                  />
                )}
              </g>
            );
          }

          const moveTo = effective.find((b) => b.type === 'move_to') as
            | MoveToBehaviorConfig
            | undefined;
          if (moveTo) {
            let dest: Position | null = null;
            if (moveTo.targetType === 'position' && moveTo.targetPosition) {
              dest = {
                x: moveTo.targetPosition.x + entity.size.width / 2,
                y: moveTo.targetPosition.y + entity.size.height / 2,
              };
            } else if (moveTo.targetType === 'entity' && moveTo.targetEntityId && entities[moveTo.targetEntityId]) {
              dest = getEntityCenter(entities[moveTo.targetEntityId]);
            }
            if (dest) {
              elements.push(
                <g key={`ai-moveto-${entity.id}`}>
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={dest.x}
                    y2={dest.y}
                    stroke="#f43f5e"
                    strokeWidth="1.4"
                    strokeDasharray="5 3"
                    markerEnd="url(#gizmo-arrow-rose)"
                  />
                  <circle cx={dest.x} cy={dest.y} r={5} fill="none" stroke="#f43f5e" strokeWidth="1.5" />
                </g>
              );
            }
          }

          return elements.length > 0 ? <g key={`gizmo-ai-${entity.id}`}>{elements}</g> : null;
        })}

      {/* 5. VECTEURS PHYSIQUES & ÉMETTEURS DE PARTICULES */}
      {showPhysicsVectors &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const effective = getEffectiveBehaviors(entity, currentState);
          const center = getEntityCenter(entity);
          const rotDeg = (currentState?.rotation ?? 0) + (isPlayMode ? entity.runtimeTilt || 0 : 0);
          const constVel = effective.find((b) => b.type === 'constant_velocity') as
            | ConstantVelocityBehaviorConfig
            | undefined;
          const emitter = effective.find((b) => b.type === 'particle_emitter') as
            | ParticleEmitterBehaviorConfig
            | undefined;

          return (
            <g key={`gizmo-vec-${entity.id}`}>
              {constVel && ((constVel.vx || 0) !== 0 || (constVel.vy || 0) !== 0) && (() => {
                const vx = constVel.vx || 0;
                const vy = constVel.vy || 0;
                const mag = Math.hypot(vx, vy);
                const len = Math.max(22, Math.min(95, mag * 0.35));
                const endX = center.x + (vx / mag) * len;
                const endY = center.y + (vy / mag) * len;
                return (
                  <g>
                    <line
                      x1={center.x}
                      y1={center.y}
                      x2={endX}
                      y2={endY}
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      markerEnd="url(#gizmo-arrow-amber)"
                    />
                    <text
                      x={endX + 6}
                      y={endY - 4}
                      fill="#b45309"
                      fontSize="9"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {Math.round(mag)} px/s
                    </text>
                  </g>
                );
              })()}

              {emitter && (() => {
                const rawOx = entity.flipX ? -(emitter.offsetX ?? 0) : (emitter.offsetX ?? 0);
                const rawOy = emitter.offsetY ?? 0;
                const rad = degToRad(rotDeg);
                const emitX = center.x + rawOx * Math.cos(rad) - rawOy * Math.sin(rad);
                const emitY = center.y + rawOx * Math.sin(rad) + rawOy * Math.cos(rad);
                const emitAngle = (emitter.angle ?? -90) + rotDeg;
                const spread = Math.max(0, Math.min(360, emitter.spread ?? 60));
                const rCone = 48;
                const dirRad = degToRad(emitAngle);
                const endX = emitX + Math.cos(dirRad) * (rCone + 8);
                const endY = emitY + Math.sin(dirRad) * (rCone + 8);
                return (
                  <g>
                    <path
                      d={buildArcSectorPath(
                        emitX,
                        emitY,
                        rCone,
                        emitAngle - spread / 2,
                        emitAngle + spread / 2
                      )}
                      fill="rgba(245, 158, 11, 0.14)"
                      stroke="#f59e0b"
                      strokeWidth="1.25"
                      strokeDasharray="3 3"
                    />
                    <line
                      x1={emitX}
                      y1={emitY}
                      x2={endX}
                      y2={endY}
                      stroke="#d97706"
                      strokeWidth="1.8"
                      markerEnd="url(#gizmo-arrow-amber)"
                    />
                    <circle
                      cx={emitX}
                      cy={emitY}
                      r={4}
                      fill="#f59e0b"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </g>
                );
              })()}
            </g>
          );
        })}

      {/* 6. LOOK AT (CÔNES ANGLES ±LIMITES, FLIP, ORBITE PUPILLE & RAYON CIBLE) */}
      {showLookAt &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const effective = getEffectiveBehaviors(entity, currentState);
          const lookAt = effective.find((b) => b.type === 'look_at') as
            | LookAtBehaviorConfig
            | undefined;
          if (!lookAt) return null;

          const center = getEntityCenter(entity);
          const { baseRot } = computeResolvedParentRotation(entity, entities, isPlayMode);
          const currentRot =
            (currentState?.rotation ?? 0) + (isPlayMode ? entity.runtimeTilt || 0 : 0);
          const flipX = Boolean(entity.flipX);

          // Calcul du centre d'ancrage pour pupil_orbit
          let orbitAnchor = center;
          if (
            (lookAt.lookMode || 'rotate') === 'pupil_orbit' &&
            entity.parentId &&
            entities[entity.parentId]
          ) {
            const parent = entities[entity.parentId];
            const pState = parent.states[parent.currentStateId];
            const pRot = (pState?.rotation ?? 0) + (isPlayMode ? parent.runtimeTilt || 0 : 0);
            const pFlip = Boolean(parent.flipX);
            const pCenter = getEntityCenter(parent);
            const offset = entity.parentOffset || { x: 0, y: 0 };
            const lx = offset.inheritFlip !== false && pFlip ? -offset.x : offset.x;
            const ly = offset.y;
            const pRad = offset.inheritRotation !== false ? degToRad(pRot) : 0;
            orbitAnchor = {
              x: pCenter.x + lx * Math.cos(pRad) - ly * Math.sin(pRad),
              y: pCenter.y + lx * Math.sin(pRad) + ly * Math.cos(pRad),
            };
          }

          // Cible affichée : runtime en Play, ou entité cible / souris en aperçu
          let targetPt: Position | null = runtimeDebug?.lookAtTargets[entity.id] || null;
          if (!targetPt && lookAt.targetType === 'entity' && lookAt.targetEntityId && entities[lookAt.targetEntityId]) {
            targetPt = getEntityCenter(entities[lookAt.targetEntityId]);
          } else if (!targetPt && lookAt.targetType === 'mouse' && liveMousePos) {
            targetPt = liveMousePos;
          }

          if (lookAt.lookMode === 'pupil_orbit') {
            const rx = Math.max(2, lookAt.orbitRadius ?? 8);
            const ry = Math.max(2, lookAt.orbitRadiusY ?? rx);
            return (
              <g key={`gizmo-lookat-${entity.id}`}>
                <ellipse
                  cx={orbitAnchor.x}
                  cy={orbitAnchor.y}
                  rx={rx}
                  ry={ry}
                  fill="rgba(6, 182, 212, 0.14)"
                  stroke="#06b6d4"
                  strokeWidth="1.6"
                  strokeDasharray="3 2"
                />
                <circle cx={orbitAnchor.x} cy={orbitAnchor.y} r={2} fill="#0891b2" />
                {targetPt && (
                  <>
                    <line
                      x1={center.x}
                      y1={center.y}
                      x2={targetPt.x}
                      y2={targetPt.y}
                      stroke="#06b6d4"
                      strokeWidth="1.2"
                      strokeDasharray="4 4"
                      strokeOpacity={0.75}
                    />
                    <circle cx={targetPt.x} cy={targetPt.y} r={4} fill="none" stroke="#06b6d4" strokeWidth="1.5" />
                  </>
                )}
              </g>
            );
          }

          // Mode rotate : direction actuelle, cône de limite ±maxAngle & état flipX
          const useFlipX = lookAt.flipMode === 'flipX';
          const baseLeft = lookAt.facingDirection === 'left';
          const rotOffset = lookAt.rotationOffset || 0;
          const coneRadius = Math.max(46, Math.max(entity.size.width, entity.size.height) * 0.72);
          const hasCone = Boolean(lookAt.maxAngle && lookAt.maxAngle > 0 && lookAt.maxAngle < 180);
          const maxAngle = lookAt.maxAngle ?? 180;

          // Direction de repos (centre du cône autorisé)
          let restScreenDeg: number;
          let currentFacingScreenDeg: number;
          if (useFlipX) {
            const lookingLeft = baseLeft ? !flipX : flipX;
            const sideSign = flipX ? -1 : 1;
            const facingBase = lookingLeft ? 180 : 0;
            restScreenDeg = baseRot + facingBase + sideSign * rotOffset;
            currentFacingScreenDeg = currentRot + facingBase + sideSign * rotOffset;
          } else {
            const facingBase = baseLeft ? 180 : 0;
            restScreenDeg = baseRot + facingBase + rotOffset;
            currentFacingScreenDeg = currentRot + facingBase + rotOffset;
          }

          const arrowRad = degToRad(currentFacingScreenDeg);
          const arrowLen = Math.max(36, coneRadius * 0.88);
          const arrowEndX = center.x + Math.cos(arrowRad) * arrowLen;
          const arrowEndY = center.y + Math.sin(arrowRad) * arrowLen;

          return (
            <g key={`gizmo-lookat-${entity.id}`}>
              {hasCone && (
                <>
                  <path
                    d={buildArcSectorPath(
                      center.x,
                      center.y,
                      coneRadius,
                      restScreenDeg - maxAngle,
                      restScreenDeg + maxAngle
                    )}
                    fill="rgba(6, 182, 212, 0.13)"
                    stroke="#06b6d4"
                    strokeWidth="1.4"
                    strokeDasharray="4 3"
                  />
                  {/* Axe central de repos */}
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={center.x + Math.cos(degToRad(restScreenDeg)) * coneRadius}
                    y2={center.y + Math.sin(degToRad(restScreenDeg)) * coneRadius}
                    stroke="#0891b2"
                    strokeWidth="1"
                    strokeDasharray="2 3"
                    strokeOpacity={0.75}
                  />
                </>
              )}

              {/* Vecteur d'orientation actuel */}
              <line
                x1={center.x}
                y1={center.y}
                x2={arrowEndX}
                y2={arrowEndY}
                stroke="#06b6d4"
                strokeWidth="2.2"
                markerEnd="url(#gizmo-arrow-cyan)"
              />

              {/* Ligne pointillée vers la cible réelle */}
              {targetPt && (
                <>
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={targetPt.x}
                    y2={targetPt.y}
                    stroke="#22d3ee"
                    strokeWidth="1.2"
                    strokeDasharray="4 4"
                    strokeOpacity={0.8}
                  />
                  <circle
                    cx={targetPt.x}
                    cy={targetPt.y}
                    r={4.5}
                    fill="none"
                    stroke="#06b6d4"
                    strokeWidth="1.6"
                  />
                </>
              )}

              {/* Badge Angle limite / FlipX */}
              {(hasCone || useFlipX) && (
                <g transform={`translate(${center.x}, ${center.y + entity.size.height / 2 + 12})`}>
                  <rect
                    x={-48}
                    y={-9}
                    width={96}
                    height={14}
                    rx={4}
                    fill="#0e7490"
                    fillOpacity={0.9}
                  />
                  <text
                    x={0}
                    y={1}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {hasCone ? `±${maxAngle}°` : '360°'}
                    {useFlipX ? (flipX ? ' • Flip G' : ' • Flip D') : ''}
                  </text>
                </g>
              )}
            </g>
          );
        })}

      {/* 7. HITBOXES & COLLIDERS D'ENTITÉS */}
      {showHitboxes &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const wb = getEntityWorldColliderBounds(entity, currentState);
          const effPivot = resolveEffectivePivot(entity, currentState);
          const pivotWorld = getPivotWorldPosition(entity.position, entity.size, effPivot);
          const totalRot =
            (currentState?.rotation ?? 0) +
            (isPlayMode ? (entity.runtimeTilt || 0) + (entity.runtimeJiggleAngle || 0) : 0);
          const mode = entity.colliderMode || 'default';
          const delegation = entity.pointerDelegation || 'self';

          let stroke = '#10b981';
          let fill = 'rgba(16, 185, 129, 0.12)';
          let badgeFill = '#047857';
          let statusLabel = '';

          if (mode === 'disabled') {
            stroke = '#64748b';
            fill = 'rgba(100, 116, 139, 0.08)';
            badgeFill = '#475569';
            statusLabel = '✕ OFF';
          } else if (mode === 'trigger_only') {
            stroke = '#0ea5e9';
            fill = 'rgba(14, 165, 233, 0.12)';
            badgeFill = '#0369a1';
            statusLabel = 'Capteur';
          }

          if (delegation !== 'self') {
            statusLabel += (statusLabel ? ' ' : '') + (delegation === 'root_parent' ? '→Racine' : '→Parent');
          }
          if (entity.ignorePointer) {
            statusLabel += (statusLabel ? ' ' : '') + '👻';
          }

          const trimmedLabel = statusLabel.trim();
          const badgeWidth = Math.max(46, trimmedLabel.length * 6.2 + 12);

          return (
            <g
              key={`gizmo-hitbox-${entity.id}`}
              transform={
                Math.abs(totalRot) > 0.05
                  ? `rotate(${totalRot} ${pivotWorld.x} ${pivotWorld.y})`
                  : undefined
              }
            >
              {wb.colliderType === 'circle' ? (
                <circle
                  cx={wb.centerX}
                  cy={wb.centerY}
                  r={wb.radius}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.75"
                  strokeDasharray="5 3"
                />
              ) : (
                <rect
                  x={wb.x}
                  y={wb.y}
                  width={wb.width}
                  height={wb.height}
                  rx={4}
                  fill={fill}
                  stroke={stroke}
                  strokeWidth="1.75"
                  strokeDasharray="5 3"
                />
              )}
              <line
                x1={wb.centerX - 4}
                y1={wb.centerY}
                x2={wb.centerX + 4}
                y2={wb.centerY}
                stroke={stroke}
                strokeWidth="1.2"
              />
              <line
                x1={wb.centerX}
                y1={wb.centerY - 4}
                x2={wb.centerX}
                y2={wb.centerY + 4}
                stroke={stroke}
                strokeWidth="1.2"
              />
              {trimmedLabel.length > 0 && (
                <g transform={`translate(${wb.x - 2}, ${wb.y - 4})`}>
                  <rect
                    x={0}
                    y={-12}
                    width={badgeWidth}
                    height={14}
                    rx={4}
                    fill={badgeFill}
                    fillOpacity={0.92}
                  />
                  <text
                    x={6}
                    y={-2}
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {trimmedLabel}
                  </text>
                </g>
              )}
            </g>
          );
        })}

      {/* 8. RESSORTS D'ATTACHEMENT, FOLLOW ÉLASTIQUE & JIGGLE */}
      {showSpringsAndJiggle && (
        <>
          {/* A. Liens Parents -> Enfants en mode Ressort ou Joint Physique */}
          {allEntities.map((child) => {
            if (!child.parentId || !entities[child.parentId]) return null;
            if (
              filterOnlySelected &&
              selectedEntityId !== child.id &&
              selectedEntityId !== child.parentId
            ) {
              return null;
            }
            const mode = child.parentOffset?.attachmentMode || 'rigid';
            if (mode !== 'spring' && mode !== 'physics_joint') return null;

            const parent = entities[child.parentId];
            const pState = parent.states[parent.currentStateId];
            const cState = child.states[child.currentStateId];
            const offset = child.parentOffset || { x: 0, y: 0 };
            const pEffPivot = resolveEffectivePivot(parent, pState);
            const pRot =
              (pState?.rotation ?? 0) +
              (isPlayMode ? (parent.runtimeTilt || 0) + (parent.runtimeJiggleAngle || 0) : 0);
            const pFlip = Boolean(parent.flipX);

            let targetAnchor = isPlayMode ? runtimeDebug?.springAnchors[child.id] : undefined;
            if (!targetAnchor) {
              targetAnchor = getParentAnchorWorldPosition({
                parentPosition: parent.position,
                parentSize: parent.size,
                parentPivot: pEffPivot,
                parentRotDeg: pRot,
                parentFlipX: pFlip,
                offsetX: offset.x,
                offsetY: offset.y,
                inheritRotation: offset.inheritRotation !== false,
                inheritFlip: offset.inheritFlip !== false,
              });
            }

            const childEffPivot = resolveEffectivePivot(child, cState);
            const childPivotWorld = getPivotWorldPosition(
              child.position,
              child.size,
              childEffPivot
            );
            const maxDist = Math.max(0, offset.springMaxDistance ?? 0);
            const isJoint = mode === 'physics_joint';
            const strokeColor = isJoint ? '#0ea5e9' : '#8b5cf6';
            const hasWorldCol = isJoint
              ? offset.collideWithWorld !== false
              : Boolean(offset.collideWithWorld);
            const midX = (targetAnchor.x + childPivotWorld.x) / 2;
            const midY = (targetAnchor.y + childPivotWorld.y) / 2;

            // Calcul des cônes de butée et de freinage (7-1) pour physics_joint
            const showJointArcs =
              isJoint && (selectedEntityId === child.id || selectedEntityId === parent.id || isPlayMode);
            const restWorldDeg = isJoint
              ? computeJointRestWorldDeg({
                  offset: child.parentOffset,
                  parentRotDeg: pRot,
                  parentFlipX: pFlip,
                })
              : 0;
            const limits = isJoint ? resolveJointLimits(child.parentOffset) : null;
            const leverDx = (0.5 - childEffPivot.x) * child.size.width;
            const leverDy = (0.5 - childEffPivot.y) * child.size.height;
            const leverDist = Math.hypot(leverDx, leverDy);
            const unrotatedLeverDeg =
              leverDist >= 4 ? (Math.atan2(leverDy, leverDx) * 180) / Math.PI : 90;
            const centerRestDeg = unrotatedLeverDeg + restWorldDeg;
            const coneRadius = Math.max(
              40,
              Math.min(86, leverDist > 6 ? leverDist + 14 : Math.max(child.size.width, child.size.height) * 0.55)
            );
            const initAngleOffset = child.parentOffset?.jointInitialAngleOffset ?? 0;
            const showStartRay = isJoint && !isPlayMode && Math.abs(initAngleOffset) > 0.5;
            const startWorldDeg = centerRestDeg + initAngleOffset;

            return (
              <g key={`gizmo-spring-link-${child.id}`}>
                {showJointArcs && limits?.enabled && (
                  <>
                    {/* Cône principal autorisé [minAngle, maxAngle] */}
                    <path
                      d={buildArcSectorPath(
                        targetAnchor.x,
                        targetAnchor.y,
                        coneRadius,
                        centerRestDeg + limits.minAngle,
                        centerRestDeg + limits.maxAngle
                      )}
                      fill="rgba(14, 165, 233, 0.08)"
                      stroke="#0284c7"
                      strokeOpacity={0.65}
                      strokeWidth="1.25"
                      strokeDasharray="4 3"
                    />
                    {/* 2e angle : Zones de freinage progressif en ambre aux deux extrémités */}
                    {limits.brakeAngle > 0.5 && (
                      <>
                        <path
                          d={buildArcSectorPath(
                            targetAnchor.x,
                            targetAnchor.y,
                            coneRadius,
                            centerRestDeg + limits.minAngle,
                            centerRestDeg + limits.minAngle + limits.brakeAngle
                          )}
                          fill="rgba(245, 158, 11, 0.22)"
                          stroke="#f59e0b"
                          strokeOpacity={0.85}
                          strokeWidth="1.25"
                        />
                        <path
                          d={buildArcSectorPath(
                            targetAnchor.x,
                            targetAnchor.y,
                            coneRadius,
                            centerRestDeg + limits.maxAngle - limits.brakeAngle,
                            centerRestDeg + limits.maxAngle
                          )}
                          fill="rgba(245, 158, 11, 0.22)"
                          stroke="#f59e0b"
                          strokeOpacity={0.85}
                          strokeWidth="1.25"
                        />
                      </>
                    )}
                  </>
                )}

                {showJointArcs && (limits?.enabled || (child.parentOffset?.jointAngularStiffness ?? 0) > 0 || showStartRay) && (
                  <line
                    x1={targetAnchor.x}
                    y1={targetAnchor.y}
                    x2={targetAnchor.x + coneRadius * Math.cos(degToRad(centerRestDeg))}
                    y2={targetAnchor.y + coneRadius * Math.sin(degToRad(centerRestDeg))}
                    stroke="#0284c7"
                    strokeWidth="1.4"
                    strokeDasharray="3 3"
                    strokeOpacity={0.8}
                  />
                )}

                {showStartRay && (
                  <>
                    <line
                      x1={targetAnchor.x}
                      y1={targetAnchor.y}
                      x2={targetAnchor.x + coneRadius * 0.9 * Math.cos(degToRad(startWorldDeg))}
                      y2={targetAnchor.y + coneRadius * 0.9 * Math.sin(degToRad(startWorldDeg))}
                      stroke="#10b981"
                      strokeWidth="2"
                    />
                    <circle
                      cx={targetAnchor.x + coneRadius * 0.9 * Math.cos(degToRad(startWorldDeg))}
                      cy={targetAnchor.y + coneRadius * 0.9 * Math.sin(degToRad(startWorldDeg))}
                      r={3.5}
                      fill="#10b981"
                      stroke="#ffffff"
                      strokeWidth="1.5"
                    />
                  </>
                )}

                {maxDist > 0 && (
                  <circle
                    cx={targetAnchor.x}
                    cy={targetAnchor.y}
                    r={maxDist}
                    fill={isJoint ? 'rgba(14, 165, 233, 0.04)' : 'rgba(139, 92, 246, 0.04)'}
                    stroke={strokeColor}
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    strokeOpacity={0.65}
                  />
                )}
                {(() => {
                  const stress = isPlayMode ? (runtimeDebug?.jointStressRatios?.[child.id] ?? 0) : 0;
                  const effectiveStroke =
                    offset.jointBreakable && stress > 0.72
                      ? '#ef4444'
                      : offset.jointBreakable && stress > 0.42
                      ? '#f59e0b'
                      : strokeColor;
                  return (
                    <>
                      <polyline
                        points={buildSpringZigzagPoints(
                          targetAnchor.x,
                          targetAnchor.y,
                          childPivotWorld.x,
                          childPivotWorld.y,
                          7,
                          5.5
                        )}
                        fill="none"
                        stroke={effectiveStroke}
                        strokeWidth={stress > 0.42 ? '2.4' : '1.9'}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                      />
                      <circle
                        cx={targetAnchor.x}
                        cy={targetAnchor.y}
                        r={isJoint ? 4.5 : 4}
                        fill="#ffffff"
                        stroke={effectiveStroke}
                        strokeWidth="2"
                      />
                      <circle
                        cx={childPivotWorld.x}
                        cy={childPivotWorld.y}
                        r={4}
                        fill={effectiveStroke}
                        stroke="#ffffff"
                        strokeWidth="1.5"
                      />
                    </>
                  );
                })()}
                {(selectedEntityId === child.id || selectedEntityId === parent.id) && (
                  <g transform={`translate(${midX}, ${midY - 11})`}>
                    <rect
                      x={-52}
                      y={-10}
                      width={104}
                      height={14}
                      rx={4}
                      fill={isJoint ? '#0369a1' : '#6d28d9'}
                      fillOpacity={0.92}
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      {isJoint ? 'Joint' : 'Ressort'}
                      {hasWorldCol ? ' +Col' : ''}
                      {isJoint && limits?.enabled ? ' 🔒' : ''}
                      {offset.jointBreakable ? ' ⛓️‍💥' : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}

          {/* A-bis. Saisies physiques actives (precisePhysicsGrab) */}
          {isPlayMode &&
            runtimeDebug?.grabPins &&
            Object.entries(runtimeDebug.grabPins).map(([entId, pin]) => (
              <g key={`gizmo-grab-pin-${entId}`}>
                <line
                  x1={pin.grabWorld.x}
                  y1={pin.grabWorld.y}
                  x2={pin.target.x}
                  y2={pin.target.y}
                  stroke="#ec4899"
                  strokeWidth="1.75"
                  strokeDasharray="3 2"
                />
                <circle
                  cx={pin.grabWorld.x}
                  cy={pin.grabWorld.y}
                  r={4.5}
                  fill="#ec4899"
                  stroke="#ffffff"
                  strokeWidth="1.5"
                />
                <circle
                  cx={pin.target.x}
                  cy={pin.target.y}
                  r={3.5}
                  fill="#ffffff"
                  stroke="#ec4899"
                  strokeWidth="1.5"
                />
              </g>
            ))}

          {/* B. Follow en mode Ressort / Damping */}
          {targetEntities.map((entity) => {
            const currentState = entity.states[entity.currentStateId];
            const effective = getEffectiveBehaviors(entity, currentState);
            const follow = effective.find((b) => b.type === 'follow') as
              | FollowBehaviorConfig
              | undefined;
            if (!follow || follow.followMode !== 'spring') return null;

            const center = getEntityCenter(entity);
            let targetPt: Position | null = null;
            if (follow.targetType === 'entity' && follow.targetEntityId && entities[follow.targetEntityId]) {
              targetPt = getEntityCenter(entities[follow.targetEntityId]);
            } else if (follow.targetType === 'mouse' && liveMousePos) {
              targetPt = liveMousePos;
            }
            if (!targetPt) return null;

            const maxDist = Math.max(0, follow.springMaxDistance ?? 0);
            return (
              <g key={`gizmo-follow-spring-${entity.id}`}>
                {maxDist > 0 && (
                  <circle
                    cx={targetPt.x}
                    cy={targetPt.y}
                    r={maxDist}
                    fill="none"
                    stroke="#ec4899"
                    strokeWidth="1.25"
                    strokeDasharray="4 4"
                    strokeOpacity={0.6}
                  />
                )}
                <polyline
                  points={buildSpringZigzagPoints(targetPt.x, targetPt.y, center.x, center.y, 8, 5)}
                  fill="none"
                  stroke="#ec4899"
                  strokeWidth="1.75"
                  strokeLinejoin="round"
                />
                <circle cx={targetPt.x} cy={targetPt.y} r={4} fill="none" stroke="#ec4899" strokeWidth="1.6" />
              </g>
            );
          })}

          {/* C. Composants Jiggle (Cônes ±maxAngle, Tiges pendulaires, Gravité, Pivots & Squash) */}
          {targetEntities.map((entity) => {
            const currentState = entity.states[entity.currentStateId];
            const effective = getEffectiveBehaviors(entity, currentState);
            const jiggle = effective.find((b) => b.type === 'jiggle') as
              | JiggleBehaviorConfig
              | undefined;
            if (!jiggle) return null;

            const effPivot = entity.runtimePivot
              ? resolveEffectivePivot(entity, currentState)
              : resolveEffectivePivot(
                  entity,
                  currentState,
                  jiggle.useCustomPivot ? jiggle.pivotOverride : undefined
                );
            const jDebug = isPlayMode ? runtimeDebug?.jigglePivots[entity.id] : undefined;
            const pivotWorld =
              jDebug?.world || getPivotWorldPosition(entity.position, entity.size, effPivot);
            const comWorld = getEntityCenter(entity);
            const dx = comWorld.x - pivotWorld.x;
            const dy = comWorld.y - pivotWorld.y;
            const leverLen = Math.hypot(dx, dy);
            const rodLen = Math.max(26, leverLen, Math.min(entity.size.width, entity.size.height) * 0.45);
            const baseRodDeg = leverLen >= 4 ? (Math.atan2(dy, dx) * 180) / Math.PI : 90;
            const maxAng = Math.max(5, jiggle.maxAngle ?? 35);
            const restOffset = (jiggle.restAngleOffset ?? 0) * (entity.flipX ? -1 : 1);
            const centerRodDeg = baseRodDeg + (isPlayMode ? 0 : restOffset);
            const currentJiggleDeg = jDebug ? jDebug.angleDeg : isPlayMode ? entity.runtimeJiggleAngle || 0 : 0;
            const tipAngleRad = degToRad(baseRodDeg + currentJiggleDeg);
            const tipX = pivotWorld.x + Math.cos(tipAngleRad) * rodLen;
            const tipY = pivotWorld.y + Math.sin(tipAngleRad) * rodLen;
            const gravPull = jiggle.gravityPull ?? 40;

            return (
              <g key={`gizmo-jiggle-${entity.id}`}>
                {/* Cône d'amplitude ±maxAngle */}
                <path
                  d={buildArcSectorPath(
                    pivotWorld.x,
                    pivotWorld.y,
                    rodLen,
                    centerRodDeg - maxAng,
                    centerRodDeg + maxAng
                  )}
                  fill="rgba(217, 70, 239, 0.10)"
                  stroke="#d946ef"
                  strokeWidth="1.35"
                  strokeDasharray="4 3"
                />

                {/* Tige pendulaire Pivot -> Centre de masse */}
                <line
                  x1={pivotWorld.x}
                  y1={pivotWorld.y}
                  x2={tipX}
                  y2={tipY}
                  stroke="#c026d3"
                  strokeWidth="2"
                />
                <circle cx={tipX} cy={tipY} r={3.5} fill="#c026d3" stroke="#ffffff" strokeWidth="1.2" />

                {/* Réticule du pivot effectif Jiggle */}
                <circle
                  cx={pivotWorld.x}
                  cy={pivotWorld.y}
                  r={6}
                  fill="rgba(217, 70, 239, 0.14)"
                  stroke="#a21caf"
                  strokeWidth="1.6"
                />
                <line
                  x1={pivotWorld.x - 8}
                  y1={pivotWorld.y}
                  x2={pivotWorld.x + 8}
                  y2={pivotWorld.y}
                  stroke="#a21caf"
                  strokeWidth="1.4"
                />
                <line
                  x1={pivotWorld.x}
                  y1={pivotWorld.y - 8}
                  x2={pivotWorld.x}
                  y2={pivotWorld.y + 8}
                  stroke="#a21caf"
                  strokeWidth="1.4"
                />

                {/* Flèche de pesanteur locale */}
                {Math.abs(gravPull) > 1 && (
                  <line
                    x1={comWorld.x}
                    y1={comWorld.y}
                    x2={comWorld.x}
                    y2={comWorld.y + Math.sign(gravPull) * Math.min(34, Math.max(14, Math.abs(gravPull) * 0.22))}
                    stroke="#f59e0b"
                    strokeWidth="1.8"
                    markerEnd="url(#gizmo-arrow-amber)"
                  />
                )}

                {/* Badge Angle & Squash en Mode Play ou si sélectionné */}
                {(isPlayMode || selectedEntityId === entity.id) && (
                  <g transform={`translate(${pivotWorld.x}, ${pivotWorld.y - 16})`}>
                    <rect
                      x={-48}
                      y={-10}
                      width={96}
                      height={14}
                      rx={4}
                      fill="#86198f"
                      fillOpacity={0.92}
                    />
                    <text
                      x={0}
                      y={0}
                      textAnchor="middle"
                      fill="#ffffff"
                      fontSize="8.5"
                      fontFamily="monospace"
                      fontWeight="700"
                    >
                      Jiggle {currentJiggleDeg >= 0 ? '+' : ''}
                      {Math.round(currentJiggleDeg)}°
                      {jDebug && (Math.abs(jDebug.squashX - 1) > 0.02 || Math.abs(jDebug.squashY - 1) > 0.02)
                        ? ` S:${jDebug.squashX.toFixed(2)}`
                        : ''}
                    </text>
                  </g>
                )}
              </g>
            );
          })}
        </>
      )}

      {/* 9. GIZMOS SLIDERS & GLISSIÈRES CONTRAINTES */}
      {showSliders &&
        targetEntities.map((entity) => {
          const currentState = entity.states[entity.currentStateId];
          const effective = getEffectiveBehaviors(entity, currentState);
          const slider = effective.find((b) => b.type === 'slider') as
            | SliderBehaviorConfig
            | undefined;
          if (!slider) return null;

          const rtTrack = isPlayMode ? runtimeDebug?.sliderTracks?.[entity.id] : undefined;
          const center = getEntityCenter(entity);
          const geom =
            rtTrack?.geom || getSliderTrackGeometry(center.x, center.y, slider);
          const stepsX = Math.max(0, Math.round(slider.stepsX ?? 0));
          const stepsY = Math.max(0, Math.round(slider.stepsY ?? 0));
          const is2D = geom.geometryMode !== 'line_1d';

          let badgeLabel = '';
          if (rtTrack) {
            badgeLabel = is2D
              ? `X:${rtTrack.valueX} Y:${rtTrack.valueY}`
              : `${rtTrack.valueX}${stepsX >= 2 ? ` [#${rtTrack.stepIndex}]` : ''}`;
          } else {
            badgeLabel =
              geom.geometryMode === 'line_1d'
                ? `Rail ${Math.round(geom.halfLen * 2)}px (${Math.round(slider.angle ?? 0)}°)`
                : geom.geometryMode === 'rect_2d'
                ? `Zone ${Math.round(geom.halfW * 2)}×${Math.round(geom.halfH * 2)}`
                : `Disque R=${Math.round(geom.radius)}px`;
          }

          const nx = -geom.uy;
          const ny = geom.ux;

          return (
            <g key={`gizmo-slider-${entity.id}`}>
              {geom.geometryMode === 'line_1d' && (
                <>
                  <line
                    x1={geom.startPt.x}
                    y1={geom.startPt.y}
                    x2={geom.endPt.x}
                    y2={geom.endPt.y}
                    stroke="#0ea5e9"
                    strokeWidth="2.2"
                    strokeDasharray="6 4"
                  />
                  {/* Butées d'extrémités */}
                  <line
                    x1={geom.startPt.x - nx * 9}
                    y1={geom.startPt.y - ny * 9}
                    x2={geom.startPt.x + nx * 9}
                    y2={geom.startPt.y + ny * 9}
                    stroke="#0284c7"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  <line
                    x1={geom.endPt.x - nx * 9}
                    y1={geom.endPt.y - ny * 9}
                    x2={geom.endPt.x + nx * 9}
                    y2={geom.endPt.y + ny * 9}
                    stroke="#0284c7"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                  {/* Crans */}
                  {stepsX >= 2 &&
                    Array.from({ length: stepsX }).map((_, idx) => {
                      const t = idx / (stepsX - 1);
                      const lx = (t - 0.5) * 2 * geom.halfLen;
                      const px = geom.originCx + geom.ux * lx;
                      const py = geom.originCy + geom.uy * lx;
                      return (
                        <line
                          key={idx}
                          x1={px - nx * 5.5}
                          y1={py - ny * 5.5}
                          x2={px + nx * 5.5}
                          y2={py + ny * 5.5}
                          stroke="#0369a1"
                          strokeWidth="1.6"
                        />
                      );
                    })}
                </>
              )}

              {geom.geometryMode === 'rect_2d' && (
                <>
                  <rect
                    x={geom.originCx - geom.halfW}
                    y={geom.originCy - geom.halfH}
                    width={geom.halfW * 2}
                    height={geom.halfH * 2}
                    rx={6}
                    fill="rgba(14, 165, 233, 0.08)"
                    stroke="#0ea5e9"
                    strokeWidth="1.75"
                    strokeDasharray="6 4"
                  />
                  {stepsX >= 2 &&
                    stepsY >= 2 &&
                    Array.from({ length: stepsX }).flatMap((_, ix) =>
                      Array.from({ length: stepsY }).map((__, iy) => {
                        const px = geom.originCx + (ix / (stepsX - 1) - 0.5) * 2 * geom.halfW;
                        const py = geom.originCy + (iy / (stepsY - 1) - 0.5) * 2 * geom.halfH;
                        return (
                          <circle
                            key={`${ix}-${iy}`}
                            cx={px}
                            cy={py}
                            r={2.2}
                            fill="#0284c7"
                            fillOpacity={0.75}
                          />
                        );
                      })
                    )}
                </>
              )}

              {geom.geometryMode === 'circle_2d' && (
                <circle
                  cx={geom.originCx}
                  cy={geom.originCy}
                  r={geom.radius}
                  fill="rgba(14, 165, 233, 0.08)"
                  stroke="#0ea5e9"
                  strokeWidth="1.75"
                  strokeDasharray="6 4"
                />
              )}

              {/* Point d'origine & cible de rappel */}
              <circle
                cx={geom.originCx}
                cy={geom.originCy}
                r={3.5}
                fill="#ffffff"
                stroke="#0284c7"
                strokeWidth="1.5"
              />
              {slider.returnMode === 'spring_return' && (
                <g>
                  <circle
                    cx={geom.returnWorldPt.x}
                    cy={geom.returnWorldPt.y}
                    r={6}
                    fill="rgba(14, 165, 233, 0.22)"
                    stroke="#0284c7"
                    strokeWidth="1.5"
                  />
                  <line
                    x1={center.x}
                    y1={center.y}
                    x2={geom.returnWorldPt.x}
                    y2={geom.returnWorldPt.y}
                    stroke="#38bdf8"
                    strokeWidth="1.35"
                    strokeDasharray="3 3"
                  />
                </g>
              )}

              {/* Badge info slider */}
              {(isPlayMode || selectedEntityId === entity.id) && (
                <g transform={`translate(${center.x}, ${entity.position.y - 14})`}>
                  <rect
                    x={-54}
                    y={-10}
                    width={108}
                    height={14}
                    rx={4}
                    fill="#0369a1"
                    fillOpacity={0.92}
                  />
                  <text
                    x={0}
                    y={0}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize="8.5"
                    fontFamily="monospace"
                    fontWeight="700"
                  >
                    {badgeLabel}
                  </text>
                </g>
              )}
            </g>
          );
        })}
    </svg>
  );
}
