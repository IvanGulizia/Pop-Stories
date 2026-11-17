import React from 'react';
import { EntityPivot } from '../../types';

interface DrawingCanvasPivotOverlayProps {
  showPivotPreview: boolean;
  pivot: EntityPivot;
  isPlacementActive: boolean;
  isDraggingPivot: boolean;
  isLocked?: boolean;
  onStartPivotDrag: (e: React.PointerEvent<SVGElement>) => void;
}

export function DrawingCanvasPivotOverlay({
  showPivotPreview,
  pivot,
  isPlacementActive,
  isDraggingPivot,
  isLocked = false,
  onStartPivotDrag,
}: DrawingCanvasPivotOverlayProps) {
  if (!showPivotPreview) return null;

  const px = Math.round(pivot.x * 2000) / 10;
  const py = Math.round(pivot.y * 2000) / 10;
  const pctX = Math.round(pivot.x * 100);
  const pctY = Math.round(pivot.y * 100);

  // Garder le badge lisible à l'intérieur du viewBox 0..200
  const badgeX = px > 122 ? px - 74 : px + 8;
  const badgeY = py < 22 ? py + 8 : py - 18;

  return (
    <g
      className="select-none"
      opacity={isLocked ? 0.65 : 1}
      style={{ pointerEvents: isLocked ? 'none' : undefined }}
    >
      {/* Axes guides discrets lorsque le pivot est actif / glissé */}
      {(isPlacementActive || isDraggingPivot) && !isLocked && (
        <g className="pointer-events-none" opacity="0.45">
          <line
            x1={px}
            y1="0"
            x2={px}
            y2="200"
            stroke="#d946ef"
            strokeWidth="0.9"
            strokeDasharray="3 3"
          />
          <line
            x1="0"
            y1={py}
            x2="200"
            y2={py}
            stroke="#d946ef"
            strokeWidth="0.9"
            strokeDasharray="3 3"
          />
        </g>
      )}

      {/* Cible interactive du pivot */}
      <g
        className={isLocked ? undefined : 'cursor-move'}
        style={{ pointerEvents: isLocked ? 'none' : 'auto' }}
        onPointerDown={(e) => {
          if (isLocked) return;
          e.stopPropagation();
          onStartPivotDrag(e);
        }}
      >
        <circle
          cx={px}
          cy={py}
          r="12"
          fill="rgba(217, 70, 239, 0.14)"
          stroke="#d946ef"
          strokeWidth="1.2"
          strokeDasharray="3 2"
        />
        <line x1={px - 17} y1={py} x2={px + 17} y2={py} stroke="#c026d3" strokeWidth="1.3" />
        <line x1={px} y1={py - 17} x2={px} y2={py + 17} stroke="#c026d3" strokeWidth="1.3" />
        <circle cx={px} cy={py} r="4.5" fill="#d946ef" stroke="#ffffff" strokeWidth="1.6" />
        <circle cx={px} cy={py} r="1.4" fill="#ffffff" />
      </g>

      {/* Badge coordonnées (%) */}
      <g transform={`translate(${badgeX}, ${badgeY})`} className="pointer-events-none">
        <rect x="0" y="0" width="66" height="14" rx="3.5" fill="#701a75" opacity="0.9" />
        <text
          x="33"
          y="9.8"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="7.2"
          fontWeight="bold"
          fontFamily="monospace"
        >
          Pivot {pctX}%,{pctY}%
        </text>
      </g>
    </g>
  );
}
