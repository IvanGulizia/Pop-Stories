import React from 'react';
import { ColliderType } from '../../types';

export type ColliderDragAction =
  | null
  | 'move_box'
  | 'resize_nw'
  | 'resize_ne'
  | 'resize_se'
  | 'resize_sw'
  | 'move_circle'
  | 'resize_circle_r';

export interface ManualColliderRect {
  x: number;
  y: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  radius: number;
}

interface DrawingCanvasColliderOverlayProps {
  showColliderPreview: boolean;
  isSharedColliderEntity: boolean;
  isReferenceStateForSharedCollider: boolean;
  overrideCollider: boolean;
  colliderMode: 'auto' | 'manual';
  colliderType: ColliderType;
  manualCollider: ManualColliderRect;
  isColliderBodyDraggable: boolean;
  isLocked?: boolean;
  overallBounds: { x: number; y: number; width: number; height: number };
  onStartColliderDrag: (action: NonNullable<ColliderDragAction>, e: React.PointerEvent<SVGElement>) => void;
}

export function DrawingCanvasColliderOverlay({
  showColliderPreview,
  isSharedColliderEntity,
  isReferenceStateForSharedCollider,
  overrideCollider,
  colliderMode,
  colliderType,
  manualCollider,
  isColliderBodyDraggable,
  isLocked = false,
  overallBounds,
  onStartColliderDrag,
}: DrawingCanvasColliderOverlayProps) {
  if (!showColliderPreview) return null;

  const isInheritedShared =
    isSharedColliderEntity && !isReferenceStateForSharedCollider && !overrideCollider;
  const isManualEditable = colliderMode === 'manual' && !isInheritedShared && !isLocked;

  if (colliderMode === 'manual' && !isInheritedShared) {
    const canDragBody = isColliderBodyDraggable && !isLocked;
    if (colliderType === 'circle') {
      const cx = manualCollider.centerX;
      const cy = manualCollider.centerY;
      const r = manualCollider.radius;
      return (
        <g
          className="select-none"
          opacity={isLocked ? 0.65 : 1}
          style={{ pointerEvents: isLocked ? 'none' : undefined }}
        >
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill={canDragBody ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.05)'}
            stroke="#10b981"
            strokeWidth="1.8"
            strokeDasharray="4 3"
            className={canDragBody ? 'cursor-move' : undefined}
            style={{ pointerEvents: canDragBody ? 'auto' : 'none' }}
            onPointerDown={(e) => canDragBody && onStartColliderDrag('move_circle', e)}
          />
          {/* Anneau de bordure cliquable pour déplacer le cercle à tout moment */}
          {!isLocked && (
            <circle
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke="transparent"
              strokeWidth="8"
              className="cursor-move"
              style={{ pointerEvents: 'stroke' }}
              onPointerDown={(e) => onStartColliderDrag('move_circle', e)}
            />
          )}
          {/* Poignée centrale de déplacement */}
          <circle
            cx={cx}
            cy={cy}
            r="4.5"
            fill="#10b981"
            stroke="#ffffff"
            strokeWidth="1.5"
            className={isManualEditable ? 'cursor-move' : undefined}
            style={{ pointerEvents: isManualEditable ? 'auto' : 'none' }}
            onPointerDown={(e) => isManualEditable && onStartColliderDrag('move_circle', e)}
          />
          {/* Poignée droite de rayon */}
          {!isLocked && (
            <circle
              cx={Math.min(196, cx + r)}
              cy={cy}
              r="5"
              fill="#ffffff"
              stroke="#059669"
              strokeWidth="2"
              className="cursor-ew-resize"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => onStartColliderDrag('resize_circle_r', e)}
            />
          )}
        </g>
      );
    }

    // Manuel Rectangle (Box)
    const bx = manualCollider.x;
    const by = manualCollider.y;
    const bw = manualCollider.width;
    const bh = manualCollider.height;
    return (
      <g
        className="select-none"
        opacity={isLocked ? 0.65 : 1}
        style={{ pointerEvents: isLocked ? 'none' : undefined }}
      >
        <rect
          x={bx}
          y={by}
          width={bw}
          height={bh}
          fill={canDragBody ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.05)'}
          stroke="#10b981"
          strokeWidth="1.8"
          strokeDasharray="4 3"
          rx="3"
          className={canDragBody ? 'cursor-move' : undefined}
          style={{ pointerEvents: canDragBody ? 'auto' : 'none' }}
          onPointerDown={(e) => canDragBody && onStartColliderDrag('move_box', e)}
        />
        {/* Contour transparent saisissable pour déplacer le rectangle */}
        {!isLocked && (
          <>
            <rect
              x={bx}
              y={by}
              width={bw}
              height={bh}
              fill="none"
              stroke="transparent"
              strokeWidth="8"
              className="cursor-move"
              style={{ pointerEvents: 'stroke' }}
              onPointerDown={(e) => onStartColliderDrag('move_box', e)}
            />
            {/* 4 Poignées d'angle pour redimensionner */}
            <rect
              x={bx - 4}
              y={by - 4}
              width="8"
              height="8"
              rx="2"
              fill="#ffffff"
              stroke="#059669"
              strokeWidth="2"
              className="cursor-nwse-resize"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => onStartColliderDrag('resize_nw', e)}
            />
            <rect
              x={bx + bw - 4}
              y={by - 4}
              width="8"
              height="8"
              rx="2"
              fill="#ffffff"
              stroke="#059669"
              strokeWidth="2"
              className="cursor-nesw-resize"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => onStartColliderDrag('resize_ne', e)}
            />
            <rect
              x={bx + bw - 4}
              y={by + bh - 4}
              width="8"
              height="8"
              rx="2"
              fill="#ffffff"
              stroke="#059669"
              strokeWidth="2"
              className="cursor-nwse-resize"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => onStartColliderDrag('resize_se', e)}
            />
            <rect
              x={bx - 4}
              y={by + bh - 4}
              width="8"
              height="8"
              rx="2"
              fill="#ffffff"
              stroke="#059669"
              strokeWidth="2"
              className="cursor-nesw-resize"
              style={{ pointerEvents: 'auto' }}
              onPointerDown={(e) => onStartColliderDrag('resize_sw', e)}
            />
          </>
        )}
      </g>
    );
  }

  return (
    <g className={`pointer-events-none select-none ${isInheritedShared ? 'opacity-45' : 'opacity-80'}`}>
      {colliderType === 'circle' && (
        <circle
          cx={overallBounds.x + overallBounds.width / 2}
          cy={overallBounds.y + overallBounds.height / 2}
          r={Math.max(overallBounds.width, overallBounds.height) / 2}
          fill="rgba(16, 185, 129, 0.05)"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
        />
      )}
      {colliderType === 'box' && (
        <rect
          x={overallBounds.x}
          y={overallBounds.y}
          width={overallBounds.width}
          height={overallBounds.height}
          fill="rgba(16, 185, 129, 0.05)"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="4 3"
          rx="4"
        />
      )}
      {colliderType === 'polygon' && (
        <rect
          x={overallBounds.x}
          y={overallBounds.y}
          width={overallBounds.width}
          height={overallBounds.height}
          fill="rgba(16, 185, 129, 0.05)"
          stroke="#10b981"
          strokeWidth="1.5"
          strokeDasharray="3 3"
        />
      )}
    </g>
  );
}
