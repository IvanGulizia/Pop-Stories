import { Position, Size, SpawnRandomZone } from '../types';

export function getDefaultSpawnRandomZone(sceneBounds: Size): SpawnRandomZone {
  const bw = Math.max(40, Math.round(sceneBounds.width));
  const bh = Math.max(40, Math.round(sceneBounds.height));
  const width = Math.max(40, Math.round(bw * 0.6));
  const height = Math.max(40, Math.round(bh * 0.5));
  const x = Math.max(0, Math.round((bw - width) / 2));
  const y = Math.max(0, Math.round((bh - height) / 2));
  return { x, y, width, height };
}

export function clampSpawnRandomZone(zone: SpawnRandomZone, sceneBounds: Size): SpawnRandomZone {
  const bw = Math.max(20, Math.round(sceneBounds.width));
  const bh = Math.max(20, Math.round(sceneBounds.height));
  const width = Math.max(20, Math.min(bw, Math.round(zone.width)));
  const height = Math.max(20, Math.min(bh, Math.round(zone.height)));
  const x = Math.max(0, Math.min(bw - width, Math.round(zone.x)));
  const y = Math.max(0, Math.min(bh - height, Math.round(zone.y)));
  return { x, y, width, height };
}

export interface ComputeRandomSpawnParams {
  sceneBounds: Size;
  spawnSize: Size;
  scope?: 'canvas' | 'zone';
  zone?: SpawnRandomZone;
  rng?: () => number;
}

/**
 * Calcule les coordonnées top-left (x, y) d'apparition aléatoire d'une entité,
 * soit sur l'ensemble du canvas ('canvas'), soit à l'intérieur d'une zone rectangulaire ('zone').
 */
export function computeRandomSpawnPosition({
  sceneBounds,
  spawnSize,
  scope = 'canvas',
  zone,
  rng = Math.random,
}: ComputeRandomSpawnParams): Position {
  const bw = Math.max(40, Math.round(sceneBounds.width));
  const bh = Math.max(40, Math.round(sceneBounds.height));
  const sw = Math.max(1, Math.round(spawnSize.width));
  const sh = Math.max(1, Math.round(spawnSize.height));

  if (scope === 'zone' && zone) {
    const z = clampSpawnRandomZone(zone, { width: bw, height: bh });
    let x: number;
    let y: number;

    if (z.width >= sw) {
      x = z.x + rng() * (z.width - sw);
    } else {
      const centerX = z.x + rng() * z.width;
      x = Math.max(0, Math.min(Math.max(0, bw - sw), centerX - sw / 2));
    }

    if (z.height >= sh) {
      y = z.y + rng() * (z.height - sh);
    } else {
      const centerY = z.y + rng() * z.height;
      y = Math.max(0, Math.min(Math.max(0, bh - sh), centerY - sh / 2));
    }

    return {
      x: Math.round(x),
      y: Math.round(y),
    };
  }

  const availW = Math.max(40, bw - sw - 40);
  const availH = Math.max(40, bh - sh - 40);
  return {
    x: Math.floor(rng() * availW + 20),
    y: Math.floor(rng() * availH + 20),
  };
}
