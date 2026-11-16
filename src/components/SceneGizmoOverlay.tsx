import React, { useEffect, useState } from 'react';
import { EMPTY_LIST, useSceneStore } from '../store/useSceneStore';
import {
  ConstantVelocityBehaviorConfig,
  Entity,
  FleeBehaviorConfig,
  FollowBehaviorConfig,
  InteractivePuppetBehaviorConfig,
  LookAtBehaviorConfig,
  MoveToBehaviorConfig,
  ParticleEmitterBehaviorConfig,
  PatrolBehaviorConfig,
  PhysicsBehaviorConfig,
  Position,
  WanderingBehaviorConfig,
} from '../types';
import { getEntityWorldColliderBounds } from '../utils/collider';
import { isGizmoCategoryVisible, resolveGizmoSettings } from '../utils/gizmoHelpers';
import { getEffectiveBehaviors, getGizmoRuntimeDebugData } from '../utils/matterPhysicsEngine';

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
  const entities = useSceneStore((state) => state.entities);
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

  const anyVisible =
    showHitboxes ||
    showColliderLayers ||
    showHierarchy ||
    showLookAt ||
    showPuppetZones ||
    showAiZones ||
    showPhysicsVectors;

  // Rafraîchissement fluide en Mode Play pour cibles souris / orbites / zones IA dynamiques
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!isPlayMode || !anyVisible || (!showLookAt && !showAiZones && !showPuppetZones)) {
      return;
    }
    let rafId = 0;
    const loop = () => {
      setTick((t) => (t + 1) % 1000000);
      rafId = requestAnimationFrame(loop);
    };
    rafId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafId);
  }, [isPlayMode, anyVisible, showLookAt, showAiZones, showPuppetZones]);

  if (!anyVisible) return null;

  const order = entityOrder.length > 0 ? entityOrder : Object.keys(entities);
  const allIds = Array.from(new Set([...order, ...Object.keys(entities)]));
  const allEntities = allIds.map((id) => entities[id]).filter((e): e is Entity => Boolean(e));

  const filterOnlySelected = resolvedSettings.onlySelected;
  const targetEntities = filterOnlySelected
    ? selectedEntityId && entities[selectedEntityId]
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
      {showHierarchy &&
        allEntities.map((child) => {
          if (!child.parentId || !entities[child.parentId]) return null;
          if (
            filterOnlySelected &&
            selectedEntityId !== child.id &&
            selectedEntityId !== child.parentId
          ) {
            return null;
          }
          const parent = entities[child.parentId];
          const pCenter = getEntityCenter(parent);
          const cCenter = getEntityCenter(child);
          const midX = (pCenter.x + cCenter.x) / 2;
          const midY = (pCenter.y + cCenter.y) / 2;
          const showDelta =
            selectedEntityId === child.id || selectedEntityId === parent.id;
          const dx = Math.round(child.parentOffset?.x ?? cCenter.x - pCenter.x);
          const dy = Math.round(child.parentOffset?.y ?? cCenter.y - pCenter.y);

          return (
            <g key={`gizmo-hier-${child.id}`}>
              <line
                x1={pCenter.x}
                y1={pCenter.y}
                x2={cCenter.x}
                y2={cCenter.y}
                stroke="#6366f1"
                strokeWidth="1.75"
                strokeDasharray="5 4"
                strokeOpacity={0.85}
                markerEnd="url(#gizmo-arrow-indigo)"
              />
              <circle
                cx={pCenter.x}
                cy={pCenter.y}
                r={4.5}
                fill="#ffffff"
                stroke="#6366f1"
                strokeWidth="2"
              />
              <circle
                cx={cCenter.x}
                cy={cCenter.y}
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
          const center = getEntityCenter(entity);
          const totalRot =
            (currentState?.rotation ?? 0) + (isPlayMode ? entity.runtimeTilt || 0 : 0);
          const mode = entity.colliderMode || 'default';
          const delegation = entity.pointerDelegation || 'self';

          let stroke = '#10b981';
          let fill = 'rgba(16, 185, 129, 0.12)';
          let badgeFill = '#047857';
          let statusLabel = `${wb.colliderType}`;

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
            statusLabel += delegation === 'root_parent' ? ' →Racine' : ' →Parent';
          }
          if (entity.ignorePointer) {
            statusLabel += ' 👻';
          }

          const badgeWidth = Math.max(54, statusLabel.length * 6.2 + 12);

          return (
            <g
              key={`gizmo-hitbox-${entity.id}`}
              transform={
                Math.abs(totalRot) > 0.05
                  ? `rotate(${totalRot} ${center.x} ${center.y})`
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
                  {statusLabel}
                </text>
              </g>
            </g>
          );
        })}
    </svg>
  );
}
