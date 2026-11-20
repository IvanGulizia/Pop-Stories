import { Position, SliderBehaviorConfig, SliderGeometryMode } from '../../types';

export interface SliderRuntimeState {
  originCx: number;
  originCy: number;
  localX: number; // En 1D : position signée [-halfLen, +halfLen] sur le rail ; en 2D : décalage X
  localY: number; // En 1D : 0 ; en 2D : décalage Y
  vx: number;
  vy: number;
  isGrabbed: boolean;
  grabOffsetWorld: Position; // Décalage centre entité - point saisi souris
  targetWorld: Position;     // Position monde courante du pointeur pendant le drag
}

export interface SliderTrackGeometry {
  geometryMode: SliderGeometryMode;
  originCx: number;
  originCy: number;
  // 1D
  halfLen: number;
  angleRad: number;
  ux: number;
  uy: number;
  startPt: Position;
  endPt: Position;
  // 2D rect
  halfW: number;
  halfH: number;
  // 2D circle
  radius: number;
  // Return target local coords
  returnLocalX: number;
  returnLocalY: number;
  returnWorldPt: Position;
}

export function getSliderTrackGeometry(
  originCx: number,
  originCy: number,
  config: SliderBehaviorConfig
): SliderTrackGeometry {
  const geometryMode: SliderGeometryMode = config.geometryMode || 'line_1d';
  const length = Math.max(10, config.length ?? 220);
  const halfLen = length / 2;
  const angleRad = ((config.angle ?? 0) * Math.PI) / 180;
  const ux = Math.cos(angleRad);
  const uy = Math.sin(angleRad);

  const width = Math.max(10, config.width ?? 180);
  const height = Math.max(10, config.height ?? 180);
  const halfW = width / 2;
  const halfH = height / 2;
  const radius = Math.max(5, config.radius ?? 90);

  let returnLocalX = 0;
  let returnLocalY = 0;
  if (geometryMode === 'line_1d') {
    const retNorm = Math.max(0, Math.min(1, config.returnPosition ?? 0.5));
    returnLocalX = (retNorm - 0.5) * 2 * halfLen;
  }

  const returnWorldPt: Position =
    geometryMode === 'line_1d'
      ? {
          x: originCx + ux * returnLocalX,
          y: originCy + uy * returnLocalX,
        }
      : { x: originCx, y: originCy };

  return {
    geometryMode,
    originCx,
    originCy,
    halfLen,
    angleRad,
    ux,
    uy,
    startPt: { x: originCx - ux * halfLen, y: originCy - uy * halfLen },
    endPt: { x: originCx + ux * halfLen, y: originCy + uy * halfLen },
    halfW,
    halfH,
    radius,
    returnLocalX,
    returnLocalY,
    returnWorldPt,
  };
}

export function worldCenterToSliderLocal(
  cx: number,
  cy: number,
  geom: SliderTrackGeometry
): { lx: number; ly: number } {
  const dx = cx - geom.originCx;
  const dy = cy - geom.originCy;
  if (geom.geometryMode === 'line_1d') {
    return {
      lx: dx * geom.ux + dy * geom.uy,
      ly: 0,
    };
  }
  return { lx: dx, ly: dy };
}

export function sliderLocalToWorldCenter(
  lx: number,
  ly: number,
  geom: SliderTrackGeometry
): Position {
  if (geom.geometryMode === 'line_1d') {
    return {
      x: geom.originCx + geom.ux * lx,
      y: geom.originCy + geom.uy * lx,
    };
  }
  return {
    x: geom.originCx + lx,
    y: geom.originCy + ly,
  };
}

export function clampSliderLocalToBounds(
  lx: number,
  ly: number,
  vx: number,
  vy: number,
  geom: SliderTrackGeometry,
  boundaryBounce: number
): {
  lx: number;
  ly: number;
  vx: number;
  vy: number;
  hitBoundary: boolean;
} {
  const bounce = Math.max(0, Math.min(0.95, boundaryBounce));
  let hitBoundary = false;

  if (geom.geometryMode === 'line_1d') {
    let nextLx = lx;
    let nextVx = vx;
    if (nextLx < -geom.halfLen) {
      nextLx = -geom.halfLen;
      if (nextVx < 0) nextVx = -nextVx * bounce;
      hitBoundary = true;
    } else if (nextLx > geom.halfLen) {
      nextLx = geom.halfLen;
      if (nextVx > 0) nextVx = -nextVx * bounce;
      hitBoundary = true;
    }
    return { lx: nextLx, ly: 0, vx: nextVx, vy: 0, hitBoundary };
  }

  if (geom.geometryMode === 'rect_2d') {
    let nextLx = lx;
    let nextLy = ly;
    let nextVx = vx;
    let nextVy = vy;
    if (nextLx < -geom.halfW) {
      nextLx = -geom.halfW;
      if (nextVx < 0) nextVx = -nextVx * bounce;
      hitBoundary = true;
    } else if (nextLx > geom.halfW) {
      nextLx = geom.halfW;
      if (nextVx > 0) nextVx = -nextVx * bounce;
      hitBoundary = true;
    }
    if (nextLy < -geom.halfH) {
      nextLy = -geom.halfH;
      if (nextVy < 0) nextVy = -nextVy * bounce;
      hitBoundary = true;
    } else if (nextLy > geom.halfH) {
      nextLy = geom.halfH;
      if (nextVy > 0) nextVy = -nextVy * bounce;
      hitBoundary = true;
    }
    return { lx: nextLx, ly: nextLy, vx: nextVx, vy: nextVy, hitBoundary };
  }

  // circle_2d
  const dist = Math.hypot(lx, ly);
  if (dist > geom.radius && dist > 1e-6) {
    const nx = lx / dist;
    const ny = ly / dist;
    const clampedX = nx * geom.radius;
    const clampedY = ny * geom.radius;
    const radialVel = vx * nx + vy * ny;
    let nextVx = vx;
    let nextVy = vy;
    if (radialVel > 0) {
      nextVx -= (1 + bounce) * radialVel * nx;
      nextVy -= (1 + bounce) * radialVel * ny;
    }
    return { lx: clampedX, ly: clampedY, vx: nextVx, vy: nextVy, hitBoundary: true };
  }
  return { lx, ly, vx, vy, hitBoundary: false };
}

export function projectPointToSliderConstraint(
  worldTargetCenter: Position,
  geom: SliderTrackGeometry
): { lx: number; ly: number; worldCenter: Position } {
  const raw = worldCenterToSliderLocal(worldTargetCenter.x, worldTargetCenter.y, geom);
  const clamped = clampSliderLocalToBounds(raw.lx, raw.ly, 0, 0, geom, 0);
  return {
    lx: clamped.lx,
    ly: clamped.ly,
    worldCenter: sliderLocalToWorldCenter(clamped.lx, clamped.ly, geom),
  };
}

function snapAxisValue(val: number, halfSpan: number, steps: number): { snapped: number; stepIndex: number } {
  if (steps < 2 || halfSpan <= 1e-6) {
    return { snapped: val, stepIndex: 0 };
  }
  const t = Math.max(0, Math.min(1, (val + halfSpan) / (2 * halfSpan)));
  const idx = Math.round(t * (steps - 1));
  const snappedNorm = idx / (steps - 1);
  return {
    snapped: (snappedNorm - 0.5) * 2 * halfSpan,
    stepIndex: idx,
  };
}

export function snapSliderLocalToSteps(
  lx: number,
  ly: number,
  geom: SliderTrackGeometry,
  stepsX: number = 0,
  stepsY: number = 0
): { lx: number; ly: number; stepIndexX: number; stepIndexY: number } {
  if (geom.geometryMode === 'line_1d') {
    const sx = snapAxisValue(lx, geom.halfLen, stepsX);
    return { lx: sx.snapped, ly: 0, stepIndexX: sx.stepIndex, stepIndexY: 0 };
  }

  if (geom.geometryMode === 'rect_2d') {
    const sx = snapAxisValue(lx, geom.halfW, stepsX);
    const sy = snapAxisValue(ly, geom.halfH, stepsY);
    return { lx: sx.snapped, ly: sy.snapped, stepIndexX: sx.stepIndex, stepIndexY: sy.stepIndex };
  }

  // circle_2d: optional grid snap clamped inside circle
  const sx = snapAxisValue(lx, geom.radius, stepsX);
  const sy = snapAxisValue(ly, geom.radius, stepsY);
  const clamped = clampSliderLocalToBounds(sx.snapped, sy.snapped, 0, 0, geom, 0);
  return { lx: clamped.lx, ly: clamped.ly, stepIndexX: sx.stepIndex, stepIndexY: sy.stepIndex };
}

export function computeMagneticStepForce(
  lx: number,
  ly: number,
  geom: SliderTrackGeometry,
  stepsX: number,
  stepsY: number,
  strength: number
): { fx: number; fy: number } {
  if (strength <= 0) return { fx: 0, fy: 0 };

  let fx = 0;
  let fy = 0;

  if (geom.geometryMode === 'line_1d' && stepsX >= 2 && geom.halfLen > 1e-6) {
    const spacing = (2 * geom.halfLen) / (stepsX - 1);
    const nearest = snapAxisValue(lx, geom.halfLen, stepsX).snapped;
    const dist = nearest - lx;
    const wellRadius = Math.max(4, spacing * 0.55);
    if (Math.abs(dist) < wellRadius) {
      const normalized = 1 - Math.abs(dist) / wellRadius;
      fx = (dist / wellRadius) * strength * (0.4 + 0.6 * normalized);
    }
  } else if (geom.geometryMode === 'rect_2d') {
    if (stepsX >= 2 && geom.halfW > 1e-6) {
      const spacingX = (2 * geom.halfW) / (stepsX - 1);
      const nearestX = snapAxisValue(lx, geom.halfW, stepsX).snapped;
      const dx = nearestX - lx;
      const wellX = Math.max(4, spacingX * 0.55);
      if (Math.abs(dx) < wellX) {
        fx = (dx / wellX) * strength;
      }
    }
    if (stepsY >= 2 && geom.halfH > 1e-6) {
      const spacingY = (2 * geom.halfH) / (stepsY - 1);
      const nearestY = snapAxisValue(ly, geom.halfH, stepsY).snapped;
      const dy = nearestY - ly;
      const wellY = Math.max(4, spacingY * 0.55);
      if (Math.abs(dy) < wellY) {
        fy = (dy / wellY) * strength;
      }
    }
  }

  return { fx, fy };
}

export function computeSliderOutputs(
  lx: number,
  ly: number,
  geom: SliderTrackGeometry,
  config: SliderBehaviorConfig
): {
  normX: number; // 0..1 in 1D, -1..1 in 2D
  normY: number; // 0 in 1D, -1..1 in 2D
  valueX: number;
  valueY: number;
  stepIndex: number;
  updates: Record<string, number>;
} {
  const defaultMin = geom.geometryMode === 'line_1d' ? 0 : -1;
  const defaultMax = geom.geometryMode === 'line_1d' ? 100 : 1;
  const outMin = config.outputMin ?? defaultMin;
  const outMax = config.outputMax ?? defaultMax;

  let normX = 0;
  let normY = 0;
  let valueX = 0;
  let valueY = 0;
  let stepIndex = 0;

  const stepsX = Math.max(0, Math.round(config.stepsX ?? 0));

  if (geom.geometryMode === 'line_1d') {
    normX = geom.halfLen > 1e-6 ? Math.max(0, Math.min(1, (lx + geom.halfLen) / (2 * geom.halfLen))) : 0.5;
    valueX = outMin + normX * (outMax - outMin);
    if (stepsX >= 2) {
      stepIndex = Math.round(normX * (stepsX - 1));
    }
  } else if (geom.geometryMode === 'rect_2d') {
    normX = geom.halfW > 1e-6 ? Math.max(-1, Math.min(1, lx / geom.halfW)) : 0;
    normY = geom.halfH > 1e-6 ? Math.max(-1, Math.min(1, ly / geom.halfH)) : 0;
    const tX = (normX + 1) / 2;
    const tY = (normY + 1) / 2;
    valueX = outMin + tX * (outMax - outMin);
    valueY = outMin + tY * (outMax - outMin);
    if (stepsX >= 2) {
      stepIndex = Math.round(tX * (stepsX - 1));
    }
  } else {
    normX = geom.radius > 1e-6 ? Math.max(-1, Math.min(1, lx / geom.radius)) : 0;
    normY = geom.radius > 1e-6 ? Math.max(-1, Math.min(1, ly / geom.radius)) : 0;
    const tX = (normX + 1) / 2;
    const tY = (normY + 1) / 2;
    valueX = outMin + tX * (outMax - outMin);
    valueY = outMin + tY * (outMax - outMin);
    if (stepsX >= 2) {
      stepIndex = Math.round(tX * (stepsX - 1));
    }
  }

  valueX = Math.round(valueX * 100) / 100;
  valueY = Math.round(valueY * 100) / 100;

  const updates: Record<string, number> = {};
  const varX = config.outputVariableX?.trim();
  const varY = config.outputVariableY?.trim();
  const varStep = config.outputStepVariable?.trim();

  if (varX) updates[varX] = valueX;
  if (varY && geom.geometryMode !== 'line_1d') updates[varY] = valueY;
  if (varStep) updates[varStep] = stepIndex;

  return { normX, normY, valueX, valueY, stepIndex, updates };
}

export function stepSliderPhysics(params: {
  state: SliderRuntimeState;
  config: SliderBehaviorConfig;
  dt: number;
}): {
  worldCenter: Position;
  geom: SliderTrackGeometry;
  outputs: ReturnType<typeof computeSliderOutputs>;
} {
  const { state, config, dt } = params;
  const geom = getSliderTrackGeometry(state.originCx, state.originCy, config);
  const dragMode = config.dragMode || 'physics_spring';
  const stepMode = config.stepMode || 'magnetic';
  const stepsX = Math.max(0, Math.round(config.stepsX ?? 0));
  const stepsY = Math.max(0, Math.round(config.stepsY ?? 0));
  const returnMode = config.returnMode || 'none';
  const boundaryBounce = Math.max(0, Math.min(0.95, config.boundaryBounce ?? 0.35));

  if (state.isGrabbed && dragMode === 'direct') {
    const desiredCenter = {
      x: state.targetWorld.x + state.grabOffsetWorld.x,
      y: state.targetWorld.y + state.grabOffsetWorld.y,
    };
    const projected = projectPointToSliderConstraint(desiredCenter, geom);
    let nextLx = projected.lx;
    let nextLy = projected.ly;

    if (stepMode === 'strict' && (stepsX >= 2 || (geom.geometryMode === 'rect_2d' && stepsY >= 2))) {
      const snapped = snapSliderLocalToSteps(nextLx, nextLy, geom, stepsX, stepsY);
      nextLx = snapped.lx;
      nextLy = snapped.ly;
    }

    state.vx = dt > 0.001 ? (nextLx - state.localX) / dt : 0;
    state.vy = dt > 0.001 ? (nextLy - state.localY) / dt : 0;
    state.localX = nextLx;
    state.localY = nextLy;

    const worldCenter = sliderLocalToWorldCenter(state.localX, state.localY, geom);
    return {
      worldCenter,
      geom,
      outputs: computeSliderOutputs(state.localX, state.localY, geom, config),
    };
  }

  // Simulation ressort & inertie avec sous-pas pour stabilité numérique
  const subSteps = 2;
  const subDt = dt / subSteps;

  for (let i = 0; i < subSteps; i++) {
    let ax = 0;
    let ay = 0;

    if (state.isGrabbed) {
      const desiredCenter = {
        x: state.targetWorld.x + state.grabOffsetWorld.x,
        y: state.targetWorld.y + state.grabOffsetWorld.y,
      };
      const desiredLocal = worldCenterToSliderLocal(desiredCenter.x, desiredCenter.y, geom);
      const clampedDesired = clampSliderLocalToBounds(desiredLocal.lx, desiredLocal.ly, 0, 0, geom, 0);
      const k = Math.max(10, config.dragStiffness ?? 220);
      const c = Math.max(1, config.dragDamping ?? 16);
      ax += k * (clampedDesired.lx - state.localX) - c * state.vx;
      ay += k * (clampedDesired.ly - state.localY) - c * state.vy;
    } else {
      if (returnMode === 'spring_return') {
        const kRet = Math.max(5, config.returnStiffness ?? 140);
        const cRet = Math.max(1, config.returnDamping ?? 12);
        ax += kRet * (geom.returnLocalX - state.localX) - cRet * state.vx;
        ay += kRet * (geom.returnLocalY - state.localY) - cRet * state.vy;
      } else {
        // Friction douce naturelle lorsqu'on lâche sans retour élastique
        const frictionDamp = 6.5;
        ax -= frictionDamp * state.vx;
        ay -= frictionDamp * state.vy;
      }
    }

    // Crantage magnétique (force wells sur les crans)
    if (stepMode === 'magnetic' && (stepsX >= 2 || (geom.geometryMode === 'rect_2d' && stepsY >= 2))) {
      const magStrength = config.magneticStrength ?? 140;
      const magForce = computeMagneticStepForce(state.localX, state.localY, geom, stepsX, stepsY, magStrength);
      // En drag direct avec magnétisme ou relâchement, les puits attirent vers le cran le plus proche
      const scaleFactor = state.isGrabbed ? 0.5 : 1.0;
      ax += magForce.fx * 12 * scaleFactor;
      ay += magForce.fy * 12 * scaleFactor;
      if (!state.isGrabbed && returnMode === 'none') {
        ax -= 4.0 * state.vx;
        ay -= 4.0 * state.vy;
      }
    }

    state.vx += ax * subDt;
    state.vy += ay * subDt;
    state.localX += state.vx * subDt;
    state.localY += state.vy * subDt;

    const clamped = clampSliderLocalToBounds(
      state.localX,
      state.localY,
      state.vx,
      state.vy,
      geom,
      boundaryBounce
    );
    state.localX = clamped.lx;
    state.localY = clamped.ly;
    state.vx = clamped.vx;
    state.vy = clamped.vy;
  }

  // Crantage strict au relâchement / post-pas si demandé
  if (stepMode === 'strict' && (stepsX >= 2 || (geom.geometryMode === 'rect_2d' && stepsY >= 2))) {
    const snapped = snapSliderLocalToSteps(state.localX, state.localY, geom, stepsX, stepsY);
    state.localX = snapped.lx;
    state.localY = snapped.ly;
    state.vx = 0;
    state.vy = 0;
  }

  if (!state.isGrabbed && Math.hypot(state.vx, state.vy) < 0.8) {
    if (returnMode === 'spring_return') {
      if (Math.hypot(state.localX - geom.returnLocalX, state.localY - geom.returnLocalY) < 0.4) {
        state.localX = geom.returnLocalX;
        state.localY = geom.returnLocalY;
        state.vx = 0;
        state.vy = 0;
      }
    } else if (stepMode === 'magnetic' && (stepsX >= 2 || stepsY >= 2)) {
      const snapped = snapSliderLocalToSteps(state.localX, state.localY, geom, stepsX, stepsY);
      if (Math.hypot(state.localX - snapped.lx, state.localY - snapped.ly) < 0.8) {
        state.localX = snapped.lx;
        state.localY = snapped.ly;
        state.vx = 0;
        state.vy = 0;
      }
    } else {
      state.vx = 0;
      state.vy = 0;
    }
  }

  const worldCenter = sliderLocalToWorldCenter(state.localX, state.localY, geom);
  return {
    worldCenter,
    geom,
    outputs: computeSliderOutputs(state.localX, state.localY, geom, config),
  };
}
