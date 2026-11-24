import { useEffect, useRef } from 'react';
import {
  clearParticles,
  getLatestMouseWorldPos,
  hasActiveParticles,
  hasActiveTimedEmitters,
  stepAndRenderParticles,
  stepTimedRuleEmitters,
  syncCustomParticlePresets,
} from '../utils/particleSystem';
import { useSceneStore } from '../store/useSceneStore';
import { getActiveCameraView } from '../utils/cameraRuntime';
import { getLastSpawnedEntityId } from '../store/ruleExecutionEngine';

interface ParticleCanvasOverlayProps {
  active: boolean;
}

export function ParticleCanvasOverlay({ active }: ParticleCanvasOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const customParticles = useSceneStore((state) => state.customParticles);

  useEffect(() => {
    syncCustomParticlePresets(customParticles);
  }, [customParticles]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let resizeRafId = 0;
    const resizeCanvas = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      const rect = parent.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      if (canvas.width !== w * dpr || canvas.height !== h * dpr) {
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const scheduleResizeCanvas = () => {
      if (resizeRafId) window.cancelAnimationFrame(resizeRafId);
      resizeRafId = window.requestAnimationFrame(() => {
        resizeRafId = 0;
        resizeCanvas();
      });
    };

    resizeCanvas();
    const ro = new ResizeObserver(scheduleResizeCanvas);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    if (!active) {
      clearParticles();
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      return () => {
        if (resizeRafId) window.cancelAnimationFrame(resizeRafId);
        ro.disconnect();
      };
    }

    let animId = 0;
    let lastTime = performance.now();
    let dirty = false;

    const loop = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;

      const ctx = canvas.getContext('2d');
      if (ctx) {
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cssW = canvas.width / dpr;
        const cssH = canvas.height / dpr;
        const storeSnap = useSceneStore.getState();
        const hasTimed = hasActiveTimedEmitters();
        if (hasTimed) {
          stepTimedRuleEmitters(
            dt,
            storeSnap.entities,
            getLatestMouseWorldPos(),
            getLastSpawnedEntityId()
          );
        }
        if (hasActiveParticles() || dirty) {
          const camView = getActiveCameraView(storeSnap.appMode, storeSnap.editorCamera);
          dirty = stepAndRenderParticles(ctx, cssW, cssH, dt, camView);
        }
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);

    return () => {
      if (resizeRafId) window.cancelAnimationFrame(resizeRafId);
      cancelAnimationFrame(animId);
      ro.disconnect();
      clearParticles();
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full pointer-events-none z-[38]"
      aria-hidden="true"
    />
  );
}
