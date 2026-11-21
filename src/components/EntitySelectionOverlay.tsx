import React from 'react';
import { motion } from 'motion/react';
import { RotateCw } from 'lucide-react';
import { ColliderType } from '../types';

interface EntitySelectionOverlayProps {
  colliderType: ColliderType;
  width: number;
  height: number;
  rotation: number;
  isRotating: boolean;
  onResizePointerDown: (e: React.PointerEvent) => void;
  onRotatePointerDown: (e: React.PointerEvent) => void;
}

export function EntitySelectionOverlay({
  colliderType,
  width,
  height,
  rotation,
  isRotating,
  onResizePointerDown,
  onRotatePointerDown,
}: EntitySelectionOverlayProps) {
  return (
    <>
      <motion.div
        className={`absolute -inset-2 ${
          colliderType === 'circle' ? 'rounded-full' : 'rounded-2xl'
        } border-2 border-indigo-500 border-dashed pointer-events-none`}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
      />

      {/* Poignée de rotation directe (en mode Édition) */}
      <div className="pointer-events-none absolute -top-13 left-1/2 -translate-x-1/2 flex flex-col items-center z-40">
        <div
          onPointerDown={onRotatePointerDown}
          onClick={(e) => e.stopPropagation()}
          style={{ touchAction: 'none' }}
          className={`pointer-events-auto w-6 h-6 rounded-full border-2 shadow-md flex items-center justify-center transition-transform cursor-grab active:cursor-grabbing ${
            isRotating
              ? 'bg-indigo-600 text-white border-white scale-115'
              : 'bg-white text-indigo-600 border-indigo-600 hover:scale-120'
          }`}
          title="Glisser pour pivoter sur le canvas (Shift : cran 15°)"
        >
          <RotateCw className="w-3 h-3" />
        </div>
        <div className="w-0.5 h-3.5 bg-indigo-500/80" />
      </div>

      {/* Badge angle en direct pendant la rotation ou dimensions */}
      {isRotating ? (
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 bg-indigo-700 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-sm pointer-events-none whitespace-nowrap z-50">
          {Math.round(rotation)}°
        </div>
      ) : (
        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[10px] font-mono font-bold px-2 py-0.5 rounded-md shadow-xs pointer-events-none whitespace-nowrap">
          {width} × {height} px
        </div>
      )}

      {/* Poignée de redimensionnement */}
      <div
        onPointerDown={onResizePointerDown}
        onClick={(e) => e.stopPropagation()}
        style={{ touchAction: 'none' }}
        className="pointer-events-auto absolute -bottom-3 -right-3 w-6 h-6 bg-white border-2 border-indigo-600 rounded-full shadow-md cursor-nwse-resize z-40 flex items-center justify-center hover:scale-125 transition-transform group"
        title="Glisser pour redimensionner"
      >
        <div className="w-2 h-2 bg-indigo-600 rounded-full group-hover:scale-110" />
      </div>
    </>
  );
}

export function EntitySiblingHalo({ colliderType }: { colliderType: ColliderType }) {
  return (
    <div
      className={`absolute -inset-1.5 ${
        colliderType === 'circle' ? 'rounded-full' : 'rounded-2xl'
      } border border-sky-400/80 border-dashed bg-sky-400/5 shadow-[0_0_12px_rgba(56,189,248,0.28)] pointer-events-none transition-opacity`}
    />
  );
}
