import {
  CustomParticlePreset,
  CustomParticleUsageMode,
  Entity,
  ParticleAnchorPreset,
  ParticleColorMode,
  ParticleEmissionShape,
  ParticleShape,
  Position,
} from '../types';
import { resolveEffectivePivot } from './physics/pivotHelpers';

export interface ParticleBurstOptions {
  x: number;
  y: number;
  count?: number;
  countMax?: number;
  color?: string;
  color2?: string;
  colorMode?: ParticleColorMode;
  shape?: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useTint?: boolean;
  speed?: number;
  speedMax?: number;
  size?: number;
  sizeMax?: number;
  endSizeScale?: number;
  lifetime?: number;
  lifetimeMax?: number;
  gravity?: number;
  drag?: number;
  opacityStart?: number;
  opacityEnd?: number;
  spinSpeed?: number;
  spread?: number; // degrés (0..360)
  angle?: number;  // degrés (-90 = haut)
  emissionShape?: ParticleEmissionShape;
  emissionRadius?: number;
  emissionWidth?: number;
  emissionHeight?: number;
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  endSizeScale: number;
  color: string;
  color2: string;
  colorMode: ParticleColorMode;
  opacityStart: number;
  opacityEnd: number;
  life: number;
  maxLife: number;
  gravity: number;
  drag: number;
  shape: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useTint?: boolean;
  rotation: number;
  vr: number;
  ageSeq: number;
}

const DEFAULT_MAX_PARTICLES = 420;
const SPRITE_SIZE = 96;

const customParticlePresetsMap = new Map<string, CustomParticlePreset>();
const customParticleSpriteCache = new Map<string, HTMLCanvasElement>();
let tintScratchCanvas: HTMLCanvasElement | null = null;
let latestMouseWorldPos: Position | null = null;

export function setLatestMouseWorldPos(pos: Position | null) {
  latestMouseWorldPos = pos ? { x: pos.x, y: pos.y } : null;
}

export function getLatestMouseWorldPos(): Position | null {
  return latestMouseWorldPos;
}

export function invalidateCustomParticleSprite(id: string) {
  customParticleSpriteCache.delete(id);
}

export function syncCustomParticlePresets(presets: CustomParticlePreset[]) {
  const nextIds = new Set<string>();
  presets.forEach((p) => {
    nextIds.add(p.id);
    const prev = customParticlePresetsMap.get(p.id);
    if (!prev || prev.vectorPaths !== p.vectorPaths) {
      customParticleSpriteCache.delete(p.id);
    }
    customParticlePresetsMap.set(p.id, p);
  });
  for (const existingId of customParticlePresetsMap.keys()) {
    if (!nextIds.has(existingId)) {
      customParticlePresetsMap.delete(existingId);
      customParticleSpriteCache.delete(existingId);
    }
  }
}

export function parseHexRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = (hex || '').trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(clean)) {
    return {
      r: parseInt(clean[0] + clean[0], 16),
      g: parseInt(clean[1] + clean[1], 16),
      b: parseInt(clean[2] + clean[2], 16),
    };
  }
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return {
      r: parseInt(clean.slice(0, 2), 16),
      g: parseInt(clean.slice(2, 4), 16),
      b: parseInt(clean.slice(4, 6), 16),
    };
  }
  return null;
}

export function interpolateHexColor(hexA: string, hexB: string, t: number): string {
  const clamped = Math.max(0, Math.min(1, t));
  const a = parseHexRgb(hexA);
  const b = parseHexRgb(hexB);
  if (!a || !b) return clamped < 0.5 ? hexA : hexB;
  const r = Math.round(a.r + (b.r - a.r) * clamped);
  const g = Math.round(a.g + (b.g - a.g) * clamped);
  const bl = Math.round(a.b + (b.b - a.b) * clamped);
  return `rgb(${r}, ${g}, ${bl})`;
}

export function sampleParticleRange(
  minVal: number,
  maxVal: number | undefined,
  legacyLowFactor: number,
  legacyHighFactor: number,
  rand: number = Math.random()
): number {
  if (maxVal !== undefined && Number.isFinite(maxVal)) {
    const lo = Math.min(minVal, maxVal);
    const hi = Math.max(minVal, maxVal);
    return lo + (hi - lo) * rand;
  }
  return minVal * (legacyLowFactor + rand * (legacyHighFactor - legacyLowFactor));
}

export function computeRelativeParticleOrigin(params: {
  entity?: Pick<Entity, 'position' | 'size' | 'flipX' | 'pivot' | 'runtimePivot' | 'states' | 'currentStateId'>;
  anchor?: ParticleAnchorPreset;
  offsetX?: number;
  offsetY?: number;
  baseAngleDeg?: number;
  followRotation?: boolean;
  overridePosition?: Position;
  overrideRotationDeg?: number;
  overrideFlipX?: boolean;
}): { x: number; y: number; angleDeg: number } {
  const {
    entity,
    anchor = 'center',
    offsetX = 0,
    offsetY = 0,
    baseAngleDeg = -90,
    followRotation = true,
    overridePosition,
    overrideRotationDeg,
    overrideFlipX,
  } = params;

  if (!entity) {
    return {
      x: offsetX,
      y: offsetY,
      angleDeg: baseAngleDeg,
    };
  }

  const pos = overridePosition || entity.position;
  const w = entity.size?.width ?? 0;
  const h = entity.size?.height ?? 0;
  const flipX = overrideFlipX !== undefined ? overrideFlipX : Boolean(entity.flipX);
  const curState = entity.states?.[entity.currentStateId];
  const rotDeg =
    overrideRotationDeg !== undefined ? overrideRotationDeg : (curState?.rotation ?? 0);

  // Coordonnées locales relatives au centre de l'entité selon l'ancre choisie
  let anchorLocalX = 0;
  let anchorLocalY = 0;
  if (anchor === 'top') {
    anchorLocalY = -h / 2;
  } else if (anchor === 'bottom') {
    anchorLocalY = h / 2;
  } else if (anchor === 'left') {
    anchorLocalX = -w / 2;
  } else if (anchor === 'right') {
    anchorLocalX = w / 2;
  } else if (anchor === 'pivot') {
    const effPivot = resolveEffectivePivot(entity, curState, undefined, flipX);
    anchorLocalX = (effPivot.x - 0.5) * w;
    anchorLocalY = (effPivot.y - 0.5) * h;
  }

  const centerX = pos.x + w / 2;
  const centerY = pos.y + h / 2;

  const rawOx = flipX && followRotation ? -offsetX : offsetX;
  const rawOy = offsetY;

  const localX = (anchor === 'pivot' ? anchorLocalX : flipX && followRotation ? -anchorLocalX : anchorLocalX) + rawOx;
  const localY = anchorLocalY + rawOy;

  let worldX = centerX + localX;
  let worldY = centerY + localY;
  let outAngle = baseAngleDeg;

  if (followRotation) {
    if (flipX) {
      outAngle = 180 - outAngle;
    }
    const rad = (rotDeg * Math.PI) / 180;
    const cos = Math.cos(rad);
    const sin = Math.sin(rad);
    worldX = centerX + localX * cos - localY * sin;
    worldY = centerY + localX * sin + localY * cos;
    outAngle += rotDeg;
  }

  return { x: worldX, y: worldY, angleDeg: outAngle };
}

function getOrBuildCustomParticleSprite(customParticleId?: string): HTMLCanvasElement | null {
  if (!customParticleId || typeof document === 'undefined') return null;
  const cached = customParticleSpriteCache.get(customParticleId);
  if (cached) return cached;

  const preset = customParticlePresetsMap.get(customParticleId);
  if (!preset || !preset.vectorPaths || preset.vectorPaths.length === 0) return null;

  const offscreen = document.createElement('canvas');
  offscreen.width = SPRITE_SIZE;
  offscreen.height = SPRITE_SIZE;
  const ctx = offscreen.getContext('2d');
  if (!ctx) return null;

  const scale = SPRITE_SIZE / 200;
  ctx.scale(scale, scale);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  for (const vp of preset.vectorPaths) {
    if (!vp.d) continue;
    try {
      const path2d = new Path2D(vp.d);
      if (vp.fill && vp.fill !== 'none') {
        ctx.fillStyle = vp.fill;
        ctx.fill(path2d);
      }
      if (vp.stroke && vp.stroke !== 'none' && (vp.strokeWidth ?? 0) > 0) {
        ctx.strokeStyle = vp.stroke;
        ctx.lineWidth = vp.strokeWidth;
        ctx.stroke(path2d);
      }
    } catch {
      // Ignorer un tracé mal formé sans interrompre le rendu des autres
    }
  }

  customParticleSpriteCache.set(customParticleId, offscreen);
  return offscreen;
}

export interface ParticlePoolInstance {
  emitBurst: (opts: ParticleBurstOptions) => void;
  clear: () => void;
  hasActive: () => boolean;
  stepAndRender: (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dt: number,
    camera?: { x: number; y: number; zoom: number }
  ) => boolean;
}

export function createParticlePool(maxParticles: number = DEFAULT_MAX_PARTICLES): ParticlePoolInstance {
  let sequenceCounter = 0;
  let customSeqCounter = 0;

  const pool: PooledParticle[] = Array.from({ length: maxParticles }, () => ({
    active: false,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    size: 5,
    endSizeScale: 0.35,
    color: '#f59e0b',
    color2: '#f59e0b',
    colorMode: 'two_colors',
    opacityStart: 1,
    opacityEnd: 0,
    life: 0,
    maxLife: 0.7,
    gravity: 220,
    drag: 0,
    shape: 'circle',
    customParticleId: undefined,
    customParticleIds: undefined,
    customParticleMode: undefined,
    useTint: false,
    rotation: 0,
    vr: 0,
    ageSeq: 0,
  }));

  const acquireSlot = (): PooledParticle => {
    let oldestIdx = 0;
    let minSeq = Infinity;

    for (let i = 0; i < maxParticles; i++) {
      if (!pool[i].active) {
        return pool[i];
      }
      if (pool[i].ageSeq < minSeq) {
        minSeq = pool[i].ageSeq;
        oldestIdx = i;
      }
    }
    return pool[oldestIdx];
  };

  const emitBurst = (opts: ParticleBurstOptions) => {
    const minCount = Math.max(1, Math.round(opts.count ?? 18));
    const rawCount =
      opts.countMax !== undefined && Number.isFinite(opts.countMax)
        ? Math.round(sampleParticleRange(minCount, Math.max(1, opts.countMax), 1, 1))
        : minCount;
    const count = Math.max(1, Math.min(180, rawCount));

    const color1 = opts.color || '#f59e0b';
    const color2 = opts.color2 || color1;
    const colorMode: ParticleColorMode =
      opts.colorMode || (opts.color2 && opts.color2 !== color1 ? 'two_colors' : 'single');

    const shape: ParticleShape = opts.shape || 'circle';
    const baseSpeed = Math.max(0, opts.speed ?? 180);
    const baseSize = Math.max(1, Math.min(96, opts.size ?? 6));
    const endSizeScale = Math.max(0, Math.min(4, opts.endSizeScale ?? 0.35));
    const baseLife = Math.max(0.05, Math.min(12, opts.lifetime ?? 0.7));
    const gravity = opts.gravity ?? 220;
    const drag = Math.max(0, opts.drag ?? 0);
    const opacityStart = Math.max(0, Math.min(1, opts.opacityStart ?? 1));
    const opacityEnd = Math.max(0, Math.min(1, opts.opacityEnd ?? 0));
    const spreadRad = ((opts.spread ?? 360) * Math.PI) / 180;
    const centerAngleRad = ((opts.angle ?? -90) * Math.PI) / 180;
    const emissionShape: ParticleEmissionShape = opts.emissionShape || 'point';
    const emissionRadius = Math.max(0, opts.emissionRadius ?? 28);
    const emissionWidth = Math.max(0, opts.emissionWidth ?? 60);
    const emissionHeight = Math.max(0, opts.emissionHeight ?? 30);

    const customList =
      opts.customParticleIds && opts.customParticleIds.length > 0
        ? opts.customParticleIds
        : opts.customParticleId
        ? [opts.customParticleId]
        : [];
    const customMode: CustomParticleUsageMode = opts.customParticleMode || 'random';

    for (let i = 0; i < count; i++) {
      const p = acquireSlot();
      const theta = centerAngleRad + (Math.random() - 0.5) * spreadRad;
      const spd = Math.max(0, sampleParticleRange(baseSpeed, opts.speedMax, 0.45, 1.2));
      const life = Math.max(0.05, sampleParticleRange(baseLife, opts.lifetimeMax, 0.7, 1.2));
      const size = Math.max(1, sampleParticleRange(baseSize, opts.sizeMax, 0.7, 1.3));

      let chosenCustomId = customList[0];
      if (customList.length > 1) {
        if (customMode === 'sequence') {
          chosenCustomId = customList[customSeqCounter % customList.length];
          customSeqCounter = (customSeqCounter + 1) % 100000;
        } else if (customMode === 'lifetime_anim') {
          chosenCustomId = customList[0];
        } else {
          chosenCustomId = customList[Math.floor(Math.random() * customList.length)];
        }
      }

      let spawnDx = (Math.random() - 0.5) * 6;
      let spawnDy = (Math.random() - 0.5) * 6;
      if (emissionShape === 'circle') {
        const a = Math.random() * Math.PI * 2;
        const r = emissionRadius * Math.sqrt(Math.random());
        spawnDx = Math.cos(a) * r;
        spawnDy = Math.sin(a) * r;
      } else if (emissionShape === 'box') {
        spawnDx = (Math.random() - 0.5) * emissionWidth;
        spawnDy = (Math.random() - 0.5) * emissionHeight;
      }

      p.active = true;
      p.x = opts.x + spawnDx;
      p.y = opts.y + spawnDy;
      p.vx = Math.cos(theta) * spd;
      p.vy = Math.sin(theta) * spd;
      p.size = size;
      p.endSizeScale = endSizeScale;
      p.colorMode = colorMode;
      if (colorMode === 'single') {
        p.color = color1;
        p.color2 = color1;
      } else if (colorMode === 'gradient_lifetime') {
        p.color = color1;
        p.color2 = color2;
      } else {
        p.color = Math.random() < 0.5 ? color1 : color2;
        p.color2 = p.color;
      }
      p.opacityStart = opacityStart;
      p.opacityEnd = opacityEnd;
      p.life = life;
      p.maxLife = life;
      p.gravity = gravity;
      p.drag = drag;
      p.shape = shape;
      p.customParticleId = chosenCustomId;
      p.customParticleIds = customList.length > 1 && customMode === 'lifetime_anim' ? customList : undefined;
      p.customParticleMode = customMode;
      p.useTint = opts.useTint;
      p.rotation = Math.random() * Math.PI * 2;
      p.vr =
        opts.spinSpeed !== undefined && Number.isFinite(opts.spinSpeed)
          ? ((opts.spinSpeed * (0.7 + Math.random() * 0.6)) * Math.PI) / 180
          : (Math.random() - 0.5) * 8;
      p.ageSeq = ++sequenceCounter;
    }
  };

  const clear = () => {
    for (let i = 0; i < maxParticles; i++) {
      pool[i].active = false;
    }
  };

  const hasActive = (): boolean => {
    for (let i = 0; i < maxParticles; i++) {
      if (pool[i].active) return true;
    }
    return false;
  };

  const stepAndRender = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dt: number,
    camera?: { x: number; y: number; zoom: number }
  ): boolean => {
    ctx.clearRect(0, 0, width, height);

    ctx.save();
    if (camera) {
      const safeZoom = Math.max(0.1, camera.zoom || 1);
      ctx.scale(safeZoom, safeZoom);
      ctx.translate(-(camera.x || 0), -(camera.y || 0));
    }

    let anyActive = false;
    const clampedDt = Math.min(dt, 0.05);

    for (let i = 0; i < maxParticles; i++) {
      const p = pool[i];
      if (!p.active) continue;

      p.life -= clampedDt;
      if (p.life <= 0) {
        p.active = false;
        continue;
      }

      anyActive = true;
      p.vy += p.gravity * clampedDt;
      if (p.drag > 0) {
        const damp = Math.exp(-p.drag * clampedDt);
        p.vx *= damp;
        p.vy *= damp;
      }
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.rotation += p.vr * clampedDt;

      const remaining = Math.max(0, Math.min(1, p.life / p.maxLife));
      const elapsed = 1 - remaining;
      const sizeScale = 1 + (p.endSizeScale - 1) * elapsed;
      const currentSize = Math.max(0.4, p.size * sizeScale);
      const currentAlpha = Math.max(
        0,
        Math.min(1, p.opacityStart + (p.opacityEnd - p.opacityStart) * elapsed)
      );
      const drawColor =
        p.colorMode === 'gradient_lifetime'
          ? interpolateHexColor(p.color, p.color2, elapsed)
          : p.color;

      ctx.save();
      ctx.globalAlpha = currentAlpha;
      ctx.fillStyle = drawColor;
      ctx.translate(p.x, p.y);

      if (p.shape === 'custom') {
        let spriteId = p.customParticleId;
        if (p.customParticleMode === 'lifetime_anim' && p.customParticleIds && p.customParticleIds.length > 1) {
          const frameIdx = Math.min(
            p.customParticleIds.length - 1,
            Math.max(0, Math.floor(elapsed * p.customParticleIds.length))
          );
          spriteId = p.customParticleIds[frameIdx];
        }
        const sprite = getOrBuildCustomParticleSprite(spriteId);
        if (sprite) {
          const drawDim = Math.max(4, currentSize * 1.9);
          ctx.rotate(p.rotation);
          if (p.useTint && typeof document !== 'undefined') {
            if (!tintScratchCanvas) {
              tintScratchCanvas = document.createElement('canvas');
              tintScratchCanvas.width = SPRITE_SIZE;
              tintScratchCanvas.height = SPRITE_SIZE;
            }
            const tctx = tintScratchCanvas.getContext('2d');
            if (tctx) {
              tctx.clearRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
              tctx.globalCompositeOperation = 'source-over';
              tctx.drawImage(sprite, 0, 0, SPRITE_SIZE, SPRITE_SIZE);
              tctx.globalCompositeOperation = 'source-atop';
              tctx.fillStyle = drawColor;
              tctx.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);
              tctx.globalCompositeOperation = 'source-over';
              ctx.drawImage(tintScratchCanvas, -drawDim / 2, -drawDim / 2, drawDim, drawDim);
            } else {
              ctx.drawImage(sprite, -drawDim / 2, -drawDim / 2, drawDim, drawDim);
            }
          } else {
            ctx.drawImage(sprite, -drawDim / 2, -drawDim / 2, drawDim, drawDim);
          }
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, currentSize * 0.55, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (p.shape === 'circle') {
        ctx.beginPath();
        ctx.arc(0, 0, currentSize * 0.55, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'square') {
        ctx.rotate(p.rotation);
        ctx.fillRect(-currentSize * 0.5, -currentSize * 0.5, currentSize, currentSize);
      } else if (p.shape === 'spark') {
        const moveAngle = Math.atan2(p.vy, p.vx);
        ctx.rotate(moveAngle);
        ctx.beginPath();
        ctx.ellipse(0, 0, currentSize * 1.1, Math.max(1.2, currentSize * 0.28), 0, 0, Math.PI * 2);
        ctx.fill();
      } else if (p.shape === 'star') {
        ctx.rotate(p.rotation);
        const outerR = currentSize * 0.7;
        const innerR = outerR * 0.42;
        ctx.beginPath();
        for (let s = 0; s < 8; s++) {
          const r = s % 2 === 0 ? outerR : innerR;
          const a = (s * Math.PI) / 4;
          if (s === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        ctx.closePath();
        ctx.fill();
      }

      ctx.restore();
    }

    ctx.restore();
    ctx.globalAlpha = 1;
    return anyActive;
  };

  return { emitBurst, clear, hasActive, stepAndRender };
}

const defaultScenePool = createParticlePool(DEFAULT_MAX_PARTICLES);

export function emitParticlesBurst(opts: ParticleBurstOptions) {
  defaultScenePool.emitBurst(opts);
}

export function clearParticles() {
  defaultScenePool.clear();
}

export function hasActiveParticles(): boolean {
  return defaultScenePool.hasActive();
}

export function stepAndRenderParticles(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  dt: number,
  camera?: { x: number; y: number; zoom: number }
): boolean {
  return defaultScenePool.stepAndRender(ctx, width, height, dt, camera);
}
