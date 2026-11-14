import { CustomParticlePreset, CustomParticleUsageMode, ParticleShape } from '../types';

export interface ParticleBurstOptions {
  x: number;
  y: number;
  count?: number;
  color?: string;
  color2?: string;
  shape?: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useTint?: boolean;
  speed?: number;
  size?: number;
  lifetime?: number;
  gravity?: number;
  spread?: number; // degrés (0..360)
  angle?: number;  // degrés (-90 = haut)
}

interface PooledParticle {
  active: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  life: number;
  maxLife: number;
  gravity: number;
  shape: ParticleShape;
  customParticleId?: string;
  customParticleIds?: string[];
  customParticleMode?: CustomParticleUsageMode;
  useTint?: boolean;
  rotation: number;
  vr: number;
  ageSeq: number;
}

const DEFAULT_MAX_PARTICLES = 280;
const SPRITE_SIZE = 96;

const customParticlePresetsMap = new Map<string, CustomParticlePreset>();
const customParticleSpriteCache = new Map<string, HTMLCanvasElement>();
let tintScratchCanvas: HTMLCanvasElement | null = null;

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
    dt: number
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
    color: '#f59e0b',
    life: 0,
    maxLife: 0.7,
    gravity: 220,
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
    const count = Math.max(1, Math.min(80, Math.round(opts.count ?? 18)));
    const color1 = opts.color || '#f59e0b';
    const color2 = opts.color2 || color1;
    const shape: ParticleShape = opts.shape || 'circle';
    const baseSpeed = Math.max(5, opts.speed ?? 180);
    const baseSize = Math.max(2, Math.min(48, opts.size ?? 6));
    const baseLife = Math.max(0.1, Math.min(4, opts.lifetime ?? 0.7));
    const gravity = opts.gravity ?? 220;
    const spreadRad = ((opts.spread ?? 360) * Math.PI) / 180;
    const centerAngleRad = ((opts.angle ?? -90) * Math.PI) / 180;
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
      const spd = baseSpeed * (0.45 + Math.random() * 0.75);
      const life = baseLife * (0.7 + Math.random() * 0.5);

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

      p.active = true;
      p.x = opts.x + (Math.random() - 0.5) * 6;
      p.y = opts.y + (Math.random() - 0.5) * 6;
      p.vx = Math.cos(theta) * spd;
      p.vy = Math.sin(theta) * spd;
      p.size = baseSize * (0.7 + Math.random() * 0.6);
      p.color = Math.random() < 0.5 ? color1 : color2;
      p.life = life;
      p.maxLife = life;
      p.gravity = gravity;
      p.shape = shape;
      p.customParticleId = chosenCustomId;
      p.customParticleIds = customList.length > 1 && customMode === 'lifetime_anim' ? customList : undefined;
      p.customParticleMode = customMode;
      p.useTint = opts.useTint;
      p.rotation = Math.random() * Math.PI * 2;
      p.vr = (Math.random() - 0.5) * 8;
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
    dt: number
  ): boolean => {
    ctx.clearRect(0, 0, width, height);

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
      p.x += p.vx * clampedDt;
      p.y += p.vy * clampedDt;
      p.rotation += p.vr * clampedDt;

      const progress = Math.max(0, Math.min(1, p.life / p.maxLife));
      const currentSize = p.size * (0.35 + progress * 0.65);

      ctx.save();
      ctx.globalAlpha = progress;
      ctx.fillStyle = p.color;
      ctx.translate(p.x, p.y);

      if (p.shape === 'custom') {
        let spriteId = p.customParticleId;
        if (p.customParticleMode === 'lifetime_anim' && p.customParticleIds && p.customParticleIds.length > 1) {
          const elapsedNorm = 1 - progress;
          const frameIdx = Math.min(
            p.customParticleIds.length - 1,
            Math.max(0, Math.floor(elapsedNorm * p.customParticleIds.length))
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
              tctx.fillStyle = p.color;
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
  dt: number
): boolean {
  return defaultScenePool.stepAndRender(ctx, width, height, dt);
}
