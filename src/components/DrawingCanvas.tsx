import React, { useRef, useState, useEffect } from 'react';
import {
  MousePointer,
  Pencil,
  GitCommit,
  Square,
  Circle,
  Lasso,
  PaintBucket,
  Eraser,
  Scissors,
  RotateCcw,
  Undo2,
  Layers,
  Pipette,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
  Grid,
  Magnet,
  Sparkles,
  Shield,
  Shapes,
  Target,
  Crosshair,
  Download,
} from 'lucide-react';
import { VectorPath, VectorPoint, VectorRect, ColliderType } from '../types';

export interface OnionStateOption {
  id: string;
  name: string;
  vectorPaths?: VectorPath[];
}

export interface ReferenceGuideOption {
  id: string;
  name: string;
  paths?: Array<{ d: string; stroke?: string; fill?: string; strokeWidth?: number }>;
  hotspot?: { x: number; y: number };
  isCustom?: boolean;
}

interface DrawingCanvasProps {
  onVectorChange: (paths: VectorPath[], svgDataUrl?: string) => void;
  initialPaths?: VectorPath[];
  initialColliderType?: ColliderType;
  initialStrokeColor?: string;
  initialFillColor?: string;
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
  onColliderChange?: (colliderType: ColliderType) => void;
  referenceGuide?: ReferenceGuideOption;
  availableReferenceGuides?: ReferenceGuideOption[];
  initialHotspot?: { x: number; y: number };
  onHotspotChange?: (pos: { x: number; y: number }) => void;
  isCursorMode?: boolean;
}

const COLOR_PALETTE = [
  '#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#1e293b', '#64748b', '#ffffff',
];

export type DrawTool =
  | 'select'
  | 'pencil'
  | 'lasso_fill'
  | 'polyline'
  | 'rectangle'
  | 'bucket'
  | 'eraser_stroke'
  | 'eraser_partial'
  | 'hotspot';

/**
 * Generate standard SVG path data for a rounded rectangle.
 */
export function generateRoundedRectPath(rect: VectorRect): string {
  const { x, y, width, height } = rect;
  const maxR = Math.min(Math.abs(width), Math.abs(height)) / 2;
  const r = Math.min(maxR, Math.max(0, rect.cornerRadius || 0));

  const rx = width < 0 ? x + width : x;
  const ry = height < 0 ? y + height : y;
  const rw = Math.abs(width);
  const rh = Math.abs(height);

  if (r <= 0) {
    return `M ${rx} ${ry} h ${rw} v ${rh} h ${-rw} Z`;
  }

  return `M ${rx + r} ${ry} ` +
    `h ${rw - 2 * r} ` +
    `a ${r} ${r} 0 0 1 ${r} ${r} ` +
    `v ${rh - 2 * r} ` +
    `a ${r} ${r} 0 0 1 ${-r} ${r} ` +
    `h ${-(rw - 2 * r)} ` +
    `a ${r} ${r} 0 0 1 ${-r} ${-r} ` +
    `v ${-(rh - 2 * r)} ` +
    `a ${r} ${r} 0 0 1 ${r} ${-r} Z`;
}

/**
 * Convert point array to smooth bezier SVG path for freehand drawing
 */
export function pointsToSmoothPath(points: VectorPoint[], isClosed = false): string {
  if (points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const xc = (points[i].x + points[i - 1].x) / 2;
    const yc = (points[i].y + points[i - 1].y) / 2;
    path += ` Q ${points[i - 1].x} ${points[i - 1].y}, ${xc} ${yc}`;
  }
  path += ` L ${points[points.length - 1].x} ${points[points.length - 1].y}`;
  if (isClosed) {
    path += ' Z';
  }
  return path;
}

/**
 * Convert point array to straight segments SVG path for polylines
 */
export function pointsToPolylinePath(points: VectorPoint[], isClosed = false): string {
  if (points.length === 0) return '';
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    path += ` L ${points[i].x} ${points[i].y}`;
  }
  if (isClosed) {
    path += ' Z';
  }
  return path;
}

/**
 * Point in polygon test (ray-casting algorithm)
 */
function isPointInPolygon(point: VectorPoint, vs: VectorPoint[]): boolean {
  const x = point.x, y = point.y;
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i].x, yi = vs[i].y;
    const xj = vs[j].x, yj = vs[j].y;
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export function DrawingCanvas({
  onVectorChange,
  initialPaths = [],
  initialColliderType = 'box',
  initialStrokeColor = '#6366f1',
  initialFillColor = 'none',
  onionStates = [],
  currentEditingStateName,
  onColliderChange,
  referenceGuide,
  initialHotspot,
  onHotspotChange,
  isCursorMode = false,
  availableReferenceGuides,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<VectorPath[]>(initialPaths);
  const [strokeColor, setStrokeColor] = useState(initialStrokeColor);
  const [strokeWidth, setStrokeWidth] = useState(6);
  const [fillColor, setFillColor] = useState<string>(initialFillColor);
  const [cornerRadius, setCornerRadius] = useState<number>(0);
  const [tool, setTool] = useState<DrawTool>('pencil');
  const [colliderType, setColliderType] = useState<ColliderType>(initialColliderType);
  const [showColliderPreview, setShowColliderPreview] = useState(true);

  // Reference Guide & Hotspot state (Repère de dessin & point d'impact)
  const [selectedGuideId, setSelectedGuideId] = useState<string>(
    referenceGuide?.id || availableReferenceGuides?.[0]?.id || ''
  );
  const activeReferenceGuide =
    availableReferenceGuides?.find((g) => g.id === selectedGuideId) || referenceGuide;

  const [guideOpacity, setGuideOpacity] = useState<number>(
    activeReferenceGuide ? 0.45 : 0
  );
  const [hotspot, setHotspot] = useState<VectorPoint>(
    initialHotspot || activeReferenceGuide?.hotspot || { x: 75, y: 25 }
  );
  // Hotspot est strictement réservé au mode curseur
  const [showHotspot, setShowHotspot] = useState<boolean>(isCursorMode);
  const [isDraggingHotspot, setIsDraggingHotspot] = useState(false);

  // Active color tab in toolbar ('stroke' | 'fill')
  const [colorMode, setColorMode] = useState<'stroke' | 'fill'>('stroke');

  // Multi-Selection & Transform state
  const [selectedPathIds, setSelectedPathIds] = useState<string[]>([]);
  const [isMarqueeSelecting, setIsMarqueeSelecting] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<VectorRect | null>(null);

  // Interaction dragging states
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasingPartial, setIsErasingPartial] = useState(false);
  const [cursorPos, setCursorPos] = useState<VectorPoint | null>(null);
  const [currentPoints, setCurrentPoints] = useState<VectorPoint[]>([]);
  const [startPoint, setStartPoint] = useState<VectorPoint | null>(null);
  const [currentRect, setCurrentRect] = useState<VectorRect | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<VectorPoint | null>(null);
  const [activeHandle, setActiveHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | null>(null);

  // Active polyline in progress
  const [activePolylinePoints, setActivePolylinePoints] = useState<VectorPoint[]>([]);

  // Grille & Magnétisme (Snap to grid)
  const [showGrid, setShowGrid] = useState(false);
  const [snapToGrid, setSnapToGrid] = useState(false);
  const [gridSnapSize, setGridSnapSize] = useState(10);

  // Onion skinning state
  const availableOnionStates = onionStates.filter((s) => s.vectorPaths && s.vectorPaths.length > 0);
  const [onionSkinEnabled, setOnionSkinEnabled] = useState(availableOnionStates.length > 0);
  const [selectedOnionStateId, setSelectedOnionStateId] = useState<string>(
    availableOnionStates[0]?.id || ''
  );
  const [onionOpacity, setOnionOpacity] = useState(0.35);

  useEffect(() => {
    if (!selectedOnionStateId && availableOnionStates.length > 0) {
      setSelectedOnionStateId(availableOnionStates[0].id);
    }
  }, [availableOnionStates, selectedOnionStateId]);

  const activeOnionReference = availableOnionStates.find((s) => s.id === selectedOnionStateId);
  const selectedPaths = paths.filter((p) => selectedPathIds.includes(p.id));
  const primarySelectedPath = selectedPaths[0] || null;

  // Sync properties when selecting shapes
  useEffect(() => {
    if (primarySelectedPath) {
      setStrokeColor(primarySelectedPath.stroke);
      setStrokeWidth(primarySelectedPath.strokeWidth);
      setFillColor(primarySelectedPath.fill || 'none');
      if (primarySelectedPath.rect) {
        setCornerRadius(primarySelectedPath.rect.cornerRadius || 0);
      }
    }
  }, [selectedPathIds]);

  const notifyChange = (updatedPaths: VectorPath[]) => {
    if (!svgRef.current) {
      onVectorChange(updatedPaths);
      return;
    }
    const svgContent = svgRef.current.outerHTML;
    const encoded = encodeURIComponent(svgContent);
    const dataUrl = `data:image/svg+xml;charset=utf-8,${encoded}`;
    onVectorChange(updatedPaths, dataUrl);
  };

  const handleColliderTypeSelect = (type: ColliderType) => {
    setColliderType(type);
    if (onColliderChange) {
      onColliderChange(type);
    }
  };

  // Auto-detect collider from current paths bounds
  const handleAutoDetectCollider = () => {
    if (paths.length === 0) {
      handleColliderTypeSelect('box');
      return;
    }

    let minX = 200, maxX = 0, minY = 200, maxY = 0;
    let hasPolyline = false;

    paths.forEach((p) => {
      if (p.type === 'polyline') hasPolyline = true;
      const b = getPathBounds(p);
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    });

    const w = Math.max(10, maxX - minX);
    const h = Math.max(10, maxY - minY);
    const ratio = w / h;

    if (hasPolyline) {
      handleColliderTypeSelect('polygon');
    } else if (ratio >= 0.8 && ratio <= 1.25) {
      handleColliderTypeSelect('circle');
    } else {
      handleColliderTypeSelect('box');
    }
  };

  const getSVGCoordinates = (
    e: React.PointerEvent<any> | React.MouseEvent<any> | React.TouchEvent<any> | PointerEvent | MouseEvent
  ): VectorPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e && (e as any).touches) {
      if ((e as any).touches.length === 0) return { x: 0, y: 0 };
      clientX = (e as any).touches[0].clientX;
      clientY = (e as any).touches[0].clientY;
    } else {
      clientX = (e as any).clientX ?? 0;
      clientY = (e as any).clientY ?? 0;
    }

    const scaleX = 200 / rect.width;
    const scaleY = 200 / rect.height;

    let x = (clientX - rect.left) * scaleX;
    let y = (clientY - rect.top) * scaleY;

    if (snapToGrid) {
      x = Math.round(x / gridSnapSize) * gridSnapSize;
      y = Math.round(y / gridSnapSize) * gridSnapSize;
    } else {
      // 1-decimal place precision preserves ultra-smooth Apple Pencil / touch curves without stair-stepping
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
    }

    x = Math.max(0, Math.min(200, x));
    y = Math.max(0, Math.min(200, y));

    return { x, y };
  };

  // Compute bounding box for a path
  const getPathBounds = (p: VectorPath) => {
    if (p.rect) {
      const rx = p.rect.width < 0 ? p.rect.x + p.rect.width : p.rect.x;
      const ry = p.rect.height < 0 ? p.rect.y + p.rect.height : p.rect.y;
      return {
        x: rx,
        y: ry,
        width: Math.abs(p.rect.width),
        height: Math.abs(p.rect.height),
      };
    }
    if (p.points && p.points.length > 0) {
      const xs = p.points.map((pt) => pt.x);
      const ys = p.points.map((pt) => pt.y);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);
      return {
        x: minX,
        y: minY,
        width: Math.max(8, maxX - minX),
        height: Math.max(8, maxY - minY),
      };
    }
    return { x: 0, y: 0, width: 200, height: 200 };
  };

  // Overall drawing bounds for collider overlay
  const getDrawingOverallBounds = () => {
    if (paths.length === 0) return { x: 40, y: 40, width: 120, height: 120 };
    let minX = 200, maxX = 0, minY = 200, maxY = 0;
    paths.forEach((p) => {
      const b = getPathBounds(p);
      minX = Math.min(minX, b.x);
      maxX = Math.max(maxX, b.x + b.width);
      minY = Math.min(minY, b.y);
      maxY = Math.max(maxY, b.y + b.height);
    });
    return {
      x: Math.max(4, minX - 4),
      y: Math.max(4, minY - 4),
      width: Math.min(192, Math.max(16, maxX - minX + 8)),
      height: Math.min(192, Math.max(16, maxY - minY + 8)),
    };
  };

  // Partial eraser execution
  const applyPartialEraser = (pt: VectorPoint, radius = Math.max(8, strokeWidth * 1.5)) => {
    let hasChanged = false;
    const newPaths: VectorPath[] = [];

    paths.forEach((p) => {
      if (p.rect) {
        // If clicking/touching rect with eraser, check if pt is near boundary
        const b = getPathBounds(p);
        const nearEdge =
          pt.x >= b.x - radius &&
          pt.x <= b.x + b.width + radius &&
          pt.y >= b.y - radius &&
          pt.y <= b.y + b.height + radius;
        if (nearEdge) {
          hasChanged = true;
          // erase rect
          return;
        }
        newPaths.push(p);
        return;
      }

      if (p.points && p.points.length > 0) {
        const remainingChunks: VectorPoint[][] = [];
        let currentChunk: VectorPoint[] = [];

        p.points.forEach((pPoint) => {
          const dist = Math.hypot(pPoint.x - pt.x, pPoint.y - pt.y);
          if (dist <= radius) {
            hasChanged = true;
            if (currentChunk.length >= 2) {
              remainingChunks.push(currentChunk);
            }
            currentChunk = [];
          } else {
            currentChunk.push(pPoint);
          }
        });

        if (currentChunk.length >= 2) {
          remainingChunks.push(currentChunk);
        }

        if (remainingChunks.length === 0) {
          hasChanged = true;
          // all points erased
        } else {
          remainingChunks.forEach((chunk, cIdx) => {
            const isClosed = p.d.endsWith('Z') && remainingChunks.length === 1;
            const newD =
              p.type === 'polyline'
                ? pointsToPolylinePath(chunk, isClosed)
                : pointsToSmoothPath(chunk, isClosed);
            newPaths.push({
              ...p,
              id: `${p.id}-sub-${cIdx}-${Date.now().toString(36)}`,
              points: chunk,
              d: newD,
            });
          });
        }
      } else {
        newPaths.push(p);
      }
    });

    if (hasChanged) {
      setPaths(newPaths);
      notifyChange(newPaths);
    }
  };

  // --- MOUSE / POINTER / TOUCH HANDLERS ---
  const handlePointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    try {
      (e.target as Element).setPointerCapture?.(e.pointerId);
    } catch (_) {}

    const pt = getSVGCoordinates(e);
    setCursorPos(pt);

    if (tool === 'select') {
      if (!e.shiftKey) {
        setSelectedPathIds([]);
      }
      setIsMarqueeSelecting(true);
      setStartPoint(pt);
      setMarqueeRect({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    if (tool === 'hotspot') {
      setHotspot(pt);
      if (onHotspotChange) onHotspotChange(pt);
      return;
    }

    if (tool === 'bucket') {
      // Paint bucket: fill any clicked or enclosing shape
      const activeColor = fillColor !== 'none' ? fillColor : (strokeColor !== 'none' ? strokeColor : '#6366f1');
      let filledOne = false;

      // Check reverse order (top to bottom)
      const updated = [...paths];
      for (let i = updated.length - 1; i >= 0; i--) {
        const p = updated[i];
        if (p.rect) {
          const b = getPathBounds(p);
          if (pt.x >= b.x && pt.x <= b.x + b.width && pt.y >= b.y && pt.y <= b.y + b.height) {
            updated[i] = { ...p, fill: activeColor };
            filledOne = true;
            break;
          }
        } else if (p.points && p.points.length >= 3) {
          const first = p.points[0];
          const last = p.points[p.points.length - 1];
          const isNearlyClosed = Math.hypot(first.x - last.x, first.y - last.y) < 26;
          if (isPointInPolygon(pt, p.points) || isNearlyClosed) {
            const closedPts = isNearlyClosed && !p.d.endsWith('Z') ? [...p.points, first] : p.points;
            const newD =
              p.type === 'polyline'
                ? pointsToPolylinePath(closedPts, true)
                : pointsToSmoothPath(closedPts, true);
            updated[i] = {
              ...p,
              points: closedPts,
              d: newD,
              fill: activeColor,
            };
            filledOne = true;
            break;
          }
        }
      }

      if (!filledOne && paths.length > 0) {
        // Fallback: fill nearest shape
        let nearestIdx = -1;
        let minDist = Infinity;
        paths.forEach((p, idx) => {
          const b = getPathBounds(p);
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          const d = Math.hypot(cx - pt.x, cy - pt.y);
          if (d < minDist) {
            minDist = d;
            nearestIdx = idx;
          }
        });
        if (nearestIdx >= 0) {
          const p = updated[nearestIdx];
          const newD = p.d.endsWith('Z') ? p.d : `${p.d} Z`;
          updated[nearestIdx] = { ...p, d: newD, fill: activeColor };
          filledOne = true;
        }
      }

      if (filledOne) {
        setPaths(updated);
        notifyChange(updated);
      }
      return;
    }

    if (tool === 'eraser_partial') {
      setIsErasingPartial(true);
      applyPartialEraser(pt);
      return;
    }

    if (tool === 'eraser_stroke') {
      return;
    }

    if (tool === 'pencil' || tool === 'lasso_fill') {
      setIsDrawing(true);
      setCurrentPoints([pt]);
      return;
    }

    if (tool === 'rectangle') {
      setIsDrawing(true);
      setStartPoint(pt);
      setCurrentRect({ x: pt.x, y: pt.y, width: 0, height: 0, cornerRadius });
      return;
    }

    if (tool === 'polyline') {
      if (activePolylinePoints.length > 0) {
        const first = activePolylinePoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        if (dist < 8 && activePolylinePoints.length >= 3) {
          finishPolyline(true);
          return;
        }
      }
      setActivePolylinePoints((prev) => [...prev, pt]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const pt = getSVGCoordinates(e);
    setCursorPos(pt);

    if (isDraggingHotspot) {
      setHotspot(pt);
      if (onHotspotChange) onHotspotChange(pt);
      return;
    }

    if (isErasingPartial && tool === 'eraser_partial') {
      applyPartialEraser(pt);
      return;
    }

    // Select Tool: Marquee drag or multi-shape translation
    if (tool === 'select') {
      if (isMarqueeSelecting && startPoint) {
        const mx = Math.min(startPoint.x, pt.x);
        const my = Math.min(startPoint.y, pt.y);
        const mw = Math.abs(pt.x - startPoint.x);
        const mh = Math.abs(pt.y - startPoint.y);
        setMarqueeRect({ x: mx, y: my, width: mw, height: mh });

        const hitIds: string[] = [];
        paths.forEach((p) => {
          const b = getPathBounds(p);
          if (
            b.x < mx + mw &&
            b.x + b.width > mx &&
            b.y < my + mh &&
            b.y + b.height > my
          ) {
            hitIds.push(p.id);
          }
        });
        setSelectedPathIds((prev) => {
          if (e.shiftKey) {
            return Array.from(new Set([...prev, ...hitIds]));
          }
          return hitIds;
        });
        return;
      }

      if (isDraggingShape && dragStartMouse && selectedPathIds.length > 0) {
        const dx = pt.x - dragStartMouse.x;
        const dy = pt.y - dragStartMouse.y;

        const updated = paths.map((p) => {
          if (!selectedPathIds.includes(p.id)) return p;
          if (p.rect) {
            const newRect = { ...p.rect, x: p.rect.x + dx, y: p.rect.y + dy };
            return {
              ...p,
              rect: newRect,
              d: generateRoundedRectPath(newRect),
            };
          }
          if (p.points) {
            const newPoints = p.points.map((ptItem) => ({
              x: ptItem.x + dx,
              y: ptItem.y + dy,
            }));
            return {
              ...p,
              points: newPoints,
              d:
                p.type === 'polyline'
                  ? pointsToPolylinePath(newPoints, p.d.endsWith('Z'))
                  : pointsToSmoothPath(newPoints, p.d.endsWith('Z')),
            };
          }
          return p;
        });
        setPaths(updated);
        setDragStartMouse(pt);
        return;
      }

      // Handle corner resizing when exactly 1 rect is selected
      if (activeHandle && primarySelectedPath?.rect && selectedPathIds.length === 1) {
        const r = primarySelectedPath.rect;
        let newX = r.x;
        let newY = r.y;
        let newW = r.width;
        let newH = r.height;

        if (activeHandle === 'se') {
          newW = pt.x - r.x;
          newH = pt.y - r.y;
        } else if (activeHandle === 'sw') {
          newW = r.x + r.width - pt.x;
          newX = pt.x;
          newH = pt.y - r.y;
        } else if (activeHandle === 'ne') {
          newW = pt.x - r.x;
          newH = r.y + r.height - pt.y;
          newY = pt.y;
        } else if (activeHandle === 'nw') {
          newW = r.x + r.width - pt.x;
          newX = pt.x;
          newH = r.y + r.height - pt.y;
          newY = pt.y;
        }

        const newRect: VectorRect = {
          x: newX,
          y: newY,
          width: newW,
          height: newH,
          cornerRadius: r.cornerRadius,
        };
        const updated = paths.map((p) =>
          p.id === primarySelectedPath.id
            ? { ...p, rect: newRect, d: generateRoundedRectPath(newRect) }
            : p
        );
        setPaths(updated);
        return;
      }
    }

    if (!isDrawing) return;

    if (tool === 'pencil' || tool === 'lasso_fill') {
      const nativeEvt = e.nativeEvent as any;
      const coalesced =
        typeof nativeEvt?.getCoalescedEvents === 'function'
          ? nativeEvt.getCoalescedEvents()
          : [nativeEvt];

      const ptsToAdd: VectorPoint[] = [];
      for (const subEvt of coalesced) {
        ptsToAdd.push(getSVGCoordinates(subEvt));
      }

      setCurrentPoints((prev) => {
        const pts = [...prev];
        for (const newPt of ptsToAdd) {
          const last = pts[pts.length - 1];
          if (!last || Math.hypot(newPt.x - last.x, newPt.y - last.y) >= 0.7) {
            pts.push(newPt);
          }
        }
        return pts;
      });
    } else if (tool === 'rectangle' && startPoint) {
      const width = pt.x - startPoint.x;
      const height = pt.y - startPoint.y;
      setCurrentRect({
        x: startPoint.x,
        y: startPoint.y,
        width,
        height,
        cornerRadius,
      });
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<SVGSVGElement>) => {
    if (e) {
      try {
        (e.target as Element).releasePointerCapture?.(e.pointerId);
      } catch (_) {}
    }

    if (isDraggingHotspot) {
      setIsDraggingHotspot(false);
      if (onHotspotChange) onHotspotChange(hotspot);
    }

    if (isErasingPartial) {
      setIsErasingPartial(false);
    }

    if (isMarqueeSelecting) {
      setIsMarqueeSelecting(false);
      setMarqueeRect(null);
      setStartPoint(null);
      return;
    }

    if (isDraggingShape || activeHandle) {
      setIsDraggingShape(false);
      setActiveHandle(null);
      setDragStartMouse(null);
      notifyChange(paths);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'pencil' && currentPoints.length > 0) {
      const firstPt = currentPoints[0];
      const lastPt = currentPoints[currentPoints.length - 1];
      const isLoop =
        currentPoints.length >= 6 && Math.hypot(firstPt.x - lastPt.x, firstPt.y - lastPt.y) < 18;
      const finalPoints = isLoop ? [...currentPoints, firstPt] : currentPoints;
      const d = pointsToSmoothPath(finalPoints, isLoop);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor === 'none' ? '#6366f1' : strokeColor,
        strokeWidth,
        fill: isLoop && fillColor !== 'none' ? fillColor : 'none',
        type: 'freehand',
        points: finalPoints,
      };
      const updated = [...paths, newPath];
      setPaths(updated);
      notifyChange(updated);
    } else if (tool === 'lasso_fill' && currentPoints.length > 1) {
      const d = pointsToSmoothPath(currentPoints, true);
      const effectiveFill = fillColor !== 'none' ? fillColor : strokeColor;
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor,
        strokeWidth: strokeColor === 'none' ? 0 : strokeWidth,
        fill: effectiveFill,
        type: 'freehand',
        points: currentPoints,
      };
      const updated = [...paths, newPath];
      setPaths(updated);
      notifyChange(updated);
    } else if (tool === 'rectangle' && currentRect && Math.abs(currentRect.width) > 4) {
      const d = generateRoundedRectPath(currentRect);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: strokeColor === 'none' ? '#6366f1' : strokeColor,
        strokeWidth,
        fill: fillColor === 'none' ? 'none' : fillColor,
        type: 'rectangle',
        rect: currentRect,
      };
      const updated = [...paths, newPath];
      setPaths(updated);
      setSelectedPathIds([newPath.id]);
      setTool('select');
      notifyChange(updated);
    }

    setCurrentPoints([]);
    setCurrentRect(null);
    setStartPoint(null);
  };

  const finishPolyline = (closed = false) => {
    if (activePolylinePoints.length < 2) {
      setActivePolylinePoints([]);
      return;
    }
    const d = pointsToPolylinePath(activePolylinePoints, closed);
    const newPath: VectorPath = {
      id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      d,
      stroke: strokeColor === 'none' ? '#6366f1' : strokeColor,
      strokeWidth,
      fill: closed && fillColor !== 'none' ? fillColor : 'none',
      type: 'polyline',
      points: activePolylinePoints,
    };
    const updated = [...paths, newPath];
    setPaths(updated);
    setActivePolylinePoints([]);
    setSelectedPathIds([newPath.id]);
    setTool('select');
    notifyChange(updated);
  };

  const handleShapeClick = (p: VectorPath, e: React.MouseEvent | React.PointerEvent) => {
    e.stopPropagation();
    if (tool === 'bucket') {
      const activeColor = fillColor !== 'none' ? fillColor : (strokeColor !== 'none' ? strokeColor : '#6366f1');
      const updated = paths.map((item) => {
        if (item.id !== p.id) return item;
        let newD = item.d;
        let newPts = item.points;
        if (item.points && item.points.length >= 3) {
          const first = item.points[0];
          const last = item.points[item.points.length - 1];
          if (Math.hypot(first.x - last.x, first.y - last.y) < 26 && !item.d.endsWith('Z')) {
            newPts = [...item.points, first];
            newD =
              item.type === 'polyline'
                ? pointsToPolylinePath(newPts, true)
                : pointsToSmoothPath(newPts, true);
          }
        } else if (!newD.endsWith('Z')) {
          newD = `${newD} Z`;
        }
        return { ...item, points: newPts, d: newD, fill: activeColor };
      });
      setPaths(updated);
      notifyChange(updated);
      return;
    }
    if (tool === 'eraser_stroke') {
      const updated = paths.filter((item) => item.id !== p.id);
      setPaths(updated);
      setSelectedPathIds((prev) => prev.filter((id) => id !== p.id));
      notifyChange(updated);
      return;
    }
    if (tool === 'select') {
      if (e.shiftKey) {
        setSelectedPathIds((prev) =>
          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
        );
      } else {
        if (!selectedPathIds.includes(p.id)) {
          setSelectedPathIds([p.id]);
        }
      }
    }
  };

  const updateSelectedShapeProperties = (
    partial: Partial<{
      stroke: string;
      strokeWidth: number;
      fill: string;
      cornerRadius: number;
    }>
  ) => {
    if (selectedPathIds.length === 0) return;
    const updated = paths.map((p) => {
      if (!selectedPathIds.includes(p.id)) return p;
      let newRect = p.rect;
      let newD = p.d;

      if (partial.cornerRadius !== undefined && p.rect) {
        newRect = { ...p.rect, cornerRadius: partial.cornerRadius };
        newD = generateRoundedRectPath(newRect);
      }

      return {
        ...p,
        stroke: partial.stroke !== undefined ? partial.stroke : p.stroke,
        strokeWidth: partial.strokeWidth !== undefined ? partial.strokeWidth : p.strokeWidth,
        fill: partial.fill !== undefined ? partial.fill : p.fill,
        rect: newRect,
        d: newD,
      };
    });

    setPaths(updated);
    notifyChange(updated);
  };

  const handleDuplicateSelected = () => {
    if (selectedPathIds.length === 0) return;
    const newSelectedIds: string[] = [];
    const duplicatedPaths: VectorPath[] = [];

    paths.forEach((p) => {
      if (!selectedPathIds.includes(p.id)) return;
      const newId = `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
      newSelectedIds.push(newId);

      if (p.rect) {
        const newRect = {
          ...p.rect,
          x: p.rect.x + 10,
          y: p.rect.y + 10,
        };
        duplicatedPaths.push({
          ...p,
          id: newId,
          rect: newRect,
          d: generateRoundedRectPath(newRect),
        });
      } else if (p.points) {
        const newPoints = p.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 }));
        duplicatedPaths.push({
          ...p,
          id: newId,
          points: newPoints,
          d:
            p.type === 'polyline'
              ? pointsToPolylinePath(newPoints, p.d.endsWith('Z'))
              : pointsToSmoothPath(newPoints, p.d.endsWith('Z')),
        });
      } else {
        duplicatedPaths.push({ ...p, id: newId });
      }
    });

    const updated = [...paths, ...duplicatedPaths];
    setPaths(updated);
    setSelectedPathIds(newSelectedIds);
    notifyChange(updated);
  };

  const handleDeleteSelected = () => {
    if (selectedPathIds.length === 0) return;
    const updated = paths.filter((p) => !selectedPathIds.includes(p.id));
    setPaths(updated);
    setSelectedPathIds([]);
    notifyChange(updated);
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const updated = paths.slice(0, -1);
    setPaths(updated);
    setSelectedPathIds((prev) => prev.filter((id) => updated.some((p) => p.id === id)));
    notifyChange(updated);
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPoints([]);
    setActivePolylinePoints([]);
    setSelectedPathIds([]);
    notifyChange([]);
  };

  const handleCopyGuideToCanvas = () => {
    if (!activeReferenceGuide?.paths || activeReferenceGuide.paths.length === 0) return;
    const isCustom = activeReferenceGuide.isCustom;
    const newPaths: VectorPath[] = activeReferenceGuide.paths.map((p, idx) => ({
      id: `guide-imported-${Date.now()}-${idx}`,
      type: (p as VectorPath).type || 'freehand',
      d: p.d,
      transform: isCustom ? undefined : 'scale(8.333333333333334)',
      stroke: strokeColor === 'none' ? (p.stroke || '#0f172a') : strokeColor,
      strokeWidth: p.strokeWidth || (isCustom ? 4 : 1.8),
      fill: p.fill && p.fill !== 'none' ? (fillColor === 'none' ? p.fill : fillColor) : 'none',
      rect: (p as VectorPath).rect,
      points: (p as VectorPath).points,
    }));
    const updated = [...paths, ...newPaths];
    setPaths(updated);
    notifyChange(updated);
  };

  const handleResetHotspot = () => {
    const defaultPos = activeReferenceGuide?.hotspot || { x: 75, y: 25 };
    setHotspot(defaultPos);
    if (onHotspotChange) onHotspotChange(defaultPos);
  };

  const selectedBounds = (() => {
    if (selectedPathIds.length === 0) return null;
    let minX = 200, minY = 200, maxX = 0, maxY = 0;
    let count = 0;
    paths.forEach((p) => {
      if (selectedPathIds.includes(p.id)) {
        const b = getPathBounds(p);
        minX = Math.min(minX, b.x);
        minY = Math.min(minY, b.y);
        maxX = Math.max(maxX, b.x + b.width);
        maxY = Math.max(maxY, b.y + b.height);
        count++;
      }
    });
    if (count === 0) return null;
    return {
      x: minX,
      y: minY,
      width: Math.max(8, maxX - minX),
      height: Math.max(8, maxY - minY),
    };
  })();
  const overallBounds = getDrawingOverallBounds();

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full items-stretch overflow-hidden">
      {/* Zone de dessin Vectorielle SVG principale */}
      <div className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-center relative shadow-inner min-h-[360px] overflow-hidden">
        {/* Top Info Bar */}
        <div className="w-full flex items-center justify-between px-3 py-1 mb-2 text-xs text-slate-500 font-medium select-none flex-wrap gap-2">
          <div className="flex items-center gap-2">
            {currentEditingStateName && (
              <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                État en cours : <strong className="text-indigo-600 font-mono">{currentEditingStateName}</strong>
              </span>
            )}
            {tool === 'polyline' && activePolylinePoints.length > 0 && (
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] animate-pulse">
                Polyligne : {activePolylinePoints.length} pts
              </span>
            )}
            {tool === 'lasso_fill' && (
              <span className="bg-purple-100 text-purple-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Lasso Plein (Fill)
              </span>
            )}
            {tool === 'bucket' && (
              <span className="bg-teal-100 text-teal-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Pot de Peinture : Cliquez sur une forme ou son intérieur
              </span>
            )}
            {tool === 'eraser_partial' && (
              <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Gomme Précise (Efface les bouts de traits)
              </span>
            )}
            {tool === 'eraser_stroke' && (
              <span className="bg-rose-100 text-rose-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Gomme Trait (Efface la forme entière)
              </span>
            )}
            {tool === 'select' && selectedPathIds.length > 0 && (
              <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                {selectedPathIds.length > 1
                  ? `${selectedPathIds.length} formes sélectionnées`
                  : '1 forme sélectionnée'}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Guide & Hotspot Quick Toggles */}
            {(activeReferenceGuide || isCursorMode) && (
              <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                {activeReferenceGuide && (
                  <button
                    type="button"
                    onClick={() => setGuideOpacity(guideOpacity > 0 ? 0 : 0.45)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      guideOpacity > 0
                        ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title="Afficher/Masquer le dessin repère (calque modèle)"
                  >
                    <Target className="w-3 h-3" />
                    <span>Modèle {guideOpacity > 0 ? 'On' : 'Off'}</span>
                  </button>
                )}

                {isCursorMode && (
                  <button
                    type="button"
                    onClick={() => setShowHotspot(!showHotspot)}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                      showHotspot
                        ? 'bg-rose-100 text-rose-700 border border-rose-200 shadow-2xs'
                        : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                    }`}
                    title="Afficher/Masquer le point d'impact réel du curseur"
                  >
                    <Crosshair className="w-3 h-3" />
                    <span>Impact ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})</span>
                  </button>
                )}
              </div>
            )}

            {/* Grille & Magnétisme Toggles */}
            <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setShowGrid(!showGrid)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  showGrid
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Afficher/Masquer la grille de repère"
              >
                <Grid className="w-3 h-3" />
                <span>Grille {showGrid ? 'On' : 'Off'}</span>
              </button>

              <button
                type="button"
                onClick={() => setSnapToGrid(!snapToGrid)}
                className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                  snapToGrid
                    ? 'bg-indigo-100 text-indigo-700 border border-indigo-200 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
                title="Activer/Désactiver l'aimant Snap to Grid"
              >
                <Magnet className="w-3 h-3" />
                <span>Snap {snapToGrid ? 'On' : 'Off'}</span>
              </button>
            </div>

            {tool === 'polyline' && activePolylinePoints.length >= 2 && (
              <button
                type="button"
                onClick={() => finishPolyline(false)}
                className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" /> Valider
              </button>
            )}
            <span className="bg-white text-slate-600 font-bold px-2.5 py-0.5 rounded-full font-mono border border-slate-200 shadow-2xs text-[11px]">
              {paths.length} {paths.length > 1 ? 'formes' : 'forme'}
            </span>
          </div>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="flex-1 w-full flex items-center justify-center relative">
          <svg
            ref={svgRef}
            viewBox="0 0 200 200"
            className={`w-full h-full max-w-[500px] max-h-[500px] aspect-square bg-white rounded-3xl touch-none select-none border border-slate-300 shadow-md ${
              tool === 'eraser_stroke' || tool === 'eraser_partial'
                ? 'cursor-none'
                : tool === 'bucket'
                ? 'cursor-cell'
                : tool === 'select'
                ? 'cursor-default'
                : 'cursor-crosshair'
            }`}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            onPointerLeave={() => {
              handlePointerUp();
              setCursorPos(null);
            }}
            onDoubleClick={() => {
              if (tool === 'polyline') {
                finishPolyline(false);
              }
            }}
          >
            {/* Grille de repère */}
            <defs>
              <pattern id="grid-dots-light" width={gridSnapSize * 2} height={gridSnapSize * 2} patternUnits="userSpaceOnUse">
                <circle cx={gridSnapSize} cy={gridSnapSize} r="1" fill="rgba(100,116,139,0.25)" />
                <path d={`M ${gridSnapSize * 2} 0 L 0 0 0 ${gridSnapSize * 2}`} fill="none" stroke="rgba(148,163,184,0.18)" strokeWidth="0.5" />
              </pattern>
            </defs>
            {showGrid && <rect width="200" height="200" fill="url(#grid-dots-light)" />}

            {/* Calque Modèle de Référence (Dessin repère Hugeicons / Guide d'un autre état de curseur) */}
            {activeReferenceGuide && activeReferenceGuide.paths && guideOpacity > 0 && (
              <g
                className="pointer-events-none select-none"
                opacity={guideOpacity}
                transform={activeReferenceGuide.isCustom ? undefined : 'scale(8.333333333333334)'}
              >
                {/* White outline backdrop for maximum contrast against any canvas background */}
                <g
                  stroke="#ffffff"
                  strokeWidth={activeReferenceGuide.isCustom ? 5 : 3.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity="0.95"
                >
                  {activeReferenceGuide.paths.map((p, idx) => (
                    <path
                      key={`guide-bg-${idx}`}
                      d={p.d}
                      fill={p.fill && p.fill !== 'none' ? '#ffffff' : 'none'}
                    />
                  ))}
                </g>
                {/* Main guide strokes in distinctive indigo/cobalt */}
                <g stroke="#4f46e5" fill="none">
                  {activeReferenceGuide.paths.map((p, idx) => (
                    <path
                      key={`guide-fg-${idx}`}
                      d={p.d}
                      stroke="#4f46e5"
                      fill={p.fill && p.fill !== 'none' ? 'rgba(99, 102, 241, 0.25)' : 'none'}
                      strokeWidth={p.strokeWidth || (activeReferenceGuide.isCustom ? 3.5 : 1.8)}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray={activeReferenceGuide.isCustom ? '4 2' : undefined}
                    />
                  ))}
                </g>
              </g>
            )}

            {/* Calque Pelure d'Oignon (Onion Skinning) */}
            {onionSkinEnabled && activeOnionReference?.vectorPaths && activeOnionReference.vectorPaths.length > 0 && (
              <g opacity={onionOpacity} className="pointer-events-none select-none">
                {activeOnionReference.vectorPaths.map((p, idx) => (
                  <path
                    key={`onion-${p.id || idx}`}
                    d={p.d}
                    stroke="#64748b"
                    strokeWidth={p.strokeWidth || 4}
                    strokeDasharray="4 2"
                    fill={p.fill && p.fill !== 'none' ? '#94a3b8' : 'none'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}
              </g>
            )}

            {/* Aperçu du Collider actif */}
            {showColliderPreview && (
              <g className="pointer-events-none select-none opacity-80">
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
            )}

            {/* Tracés existants */}
            {paths.map((p) => {
              const isSelected = selectedPathIds.includes(p.id);
              return (
                <path
                  key={p.id}
                  d={p.d}
                  stroke={isSelected ? '#6366f1' : p.stroke}
                  strokeWidth={isSelected ? p.strokeWidth + 1 : p.strokeWidth}
                  fill={p.fill || 'none'}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={`transition-all ${
                    tool === 'eraser_stroke'
                      ? 'hover:stroke-rose-500 hover:opacity-40 cursor-pointer'
                      : tool === 'bucket'
                      ? 'hover:opacity-80 cursor-cell'
                      : tool === 'select'
                      ? isSelected
                        ? 'cursor-move filter drop-shadow-xs'
                        : 'hover:opacity-90 cursor-pointer'
                      : ''
                  }`}
                  onClick={(e) => handleShapeClick(p, e)}
                  onPointerDown={(e) => {
                    if (tool === 'select') {
                      e.stopPropagation();
                      try {
                        (e.target as Element).setPointerCapture?.(e.pointerId);
                      } catch (_) {}
                      if (e.shiftKey) {
                        setSelectedPathIds((prev) =>
                          prev.includes(p.id) ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                        );
                      } else {
                        if (!selectedPathIds.includes(p.id)) {
                          setSelectedPathIds([p.id]);
                        }
                      }
                      setIsDraggingShape(true);
                      setDragStartMouse(getSVGCoordinates(e));
                    }
                  }}
                />
              );
            })}

            {/* Tracé Freehand / Pencil en cours */}
            {isDrawing && tool === 'pencil' && currentPoints.length > 0 && (
              <path
                d={pointsToSmoothPath(currentPoints)}
                stroke={strokeColor === 'none' ? '#6366f1' : strokeColor}
                strokeWidth={strokeWidth}
                fill={fillColor === 'none' ? 'none' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Tracé Lasso Plein en cours */}
            {isDrawing && tool === 'lasso_fill' && currentPoints.length > 1 && (
              <path
                d={pointsToSmoothPath(currentPoints, true)}
                stroke={strokeColor === 'none' ? '#6366f1' : strokeColor}
                strokeWidth={strokeWidth}
                fill={fillColor !== 'none' ? fillColor : strokeColor}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.8}
              />
            )}

            {/* Rectangle en cours */}
            {isDrawing && tool === 'rectangle' && currentRect && (
              <path
                d={generateRoundedRectPath(currentRect)}
                stroke={strokeColor === 'none' ? '#6366f1' : strokeColor}
                strokeWidth={strokeWidth}
                fill={fillColor === 'none' ? 'rgba(99,102,241,0.1)' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Polyligne en cours */}
            {tool === 'polyline' && activePolylinePoints.length > 0 && (
              <g>
                <path
                  d={pointsToPolylinePath(activePolylinePoints, false)}
                  stroke={strokeColor === 'none' ? '#6366f1' : strokeColor}
                  strokeWidth={strokeWidth}
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="4 2"
                />
                {activePolylinePoints.map((pt, idx) => (
                  <circle
                    key={`poly-node-${idx}`}
                    cx={pt.x}
                    cy={pt.y}
                    r={idx === 0 ? 5 : 3.5}
                    fill={idx === 0 ? '#10b981' : '#6366f1'}
                    stroke="#ffffff"
                    strokeWidth="1.5"
                    className="cursor-pointer"
                  />
                ))}
              </g>
            )}

            {/* Curseur Gomme circulaire */}
            {(tool === 'eraser_partial' || tool === 'eraser_stroke') && cursorPos && (
              <g className="pointer-events-none">
                <circle
                  cx={cursorPos.x}
                  cy={cursorPos.y}
                  r={tool === 'eraser_partial' ? Math.max(6, strokeWidth * 1.5) : 8}
                  fill="rgba(244, 63, 94, 0.2)"
                  stroke="#f43f5e"
                  strokeWidth="1.5"
                />
              </g>
            )}

            {/* Marquee Selection Rectangle */}
            {isMarqueeSelecting && marqueeRect && (
              <rect
                x={marqueeRect.x}
                y={marqueeRect.y}
                width={marqueeRect.width}
                height={marqueeRect.height}
                fill="rgba(99, 102, 241, 0.08)"
                stroke="#6366f1"
                strokeWidth="1.2"
                strokeDasharray="4 3"
                className="pointer-events-none select-none"
              />
            )}

            {/* Figma-Style Multi-Bounding Box & Transformation Handles */}
            {tool === 'select' && selectedBounds && selectedPathIds.length > 0 && (
              <g className="select-none">
                <rect
                  x={selectedBounds.x}
                  y={selectedBounds.y}
                  width={selectedBounds.width}
                  height={selectedBounds.height}
                  fill="rgba(99,102,241,0.04)"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="4 3"
                  className="cursor-move"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    try {
                      (e.target as Element).setPointerCapture?.(e.pointerId);
                    } catch (_) {}
                    setIsDraggingShape(true);
                    setDragStartMouse(getSVGCoordinates(e));
                  }}
                />

                {/* Show corner resize handles if single rect is selected */}
                {selectedPathIds.length === 1 && primarySelectedPath?.rect && (
                  <>
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('nw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('ne');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('se');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('sw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                  </>
                )}
              </g>
            )}

            {/* Repère de position réelle du curseur (Point d'impact Hotspot) */}
            {showHotspot && (
              <g
                className="cursor-move select-none"
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setIsDraggingHotspot(true);
                }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  setIsDraggingHotspot(true);
                }}
              >
                {/* Target radar halo */}
                <circle
                  cx={hotspot.x}
                  cy={hotspot.y}
                  r="15"
                  fill="rgba(239, 68, 68, 0.15)"
                  stroke="#ef4444"
                  strokeWidth="1.2"
                  strokeDasharray="3 2"
                />
                {/* Crosshairs */}
                <line x1={hotspot.x - 20} y1={hotspot.y} x2={hotspot.x + 20} y2={hotspot.y} stroke="#ef4444" strokeWidth="1.2" />
                <line x1={hotspot.x} y1={hotspot.y - 20} x2={hotspot.x} y2={hotspot.y + 20} stroke="#ef4444" strokeWidth="1.2" />
                {/* Bullseye center */}
                <circle cx={hotspot.x} cy={hotspot.y} r="4.5" fill="#ef4444" stroke="#ffffff" strokeWidth="1.5" />
                <circle cx={hotspot.x} cy={hotspot.y} r="1.5" fill="#ffffff" />
                {/* Coordinate badge */}
                <g transform={`translate(${hotspot.x + 8}, ${hotspot.y - 18})`}>
                  <rect x="0" y="0" width="76" height="15" rx="3" fill="#0f172a" opacity="0.88" />
                  <text x="38" y="11" textAnchor="middle" fill="#ffffff" fontSize="7.5" fontWeight="bold" fontFamily="sans-serif">
                    Impact: ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})
                  </text>
                </g>
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Barre d'outils vectorielle latérale (Outils, Colliders, Inspecteur, Palette Stroke & Fill) */}
      <div className="w-full lg:w-84 bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-3xl flex flex-col justify-between gap-3 shrink-0 shadow-2xs overflow-y-auto max-h-full">
        <div className="space-y-3.5">
          {/* Choix d'outil */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Outils de dessin
            </span>
            <div className="grid grid-cols-4 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
              {/* Pointeur */}
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'select'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pointeur / Sélection & Déplacement"
              >
                <MousePointer className="w-4 h-4" />
                <span className="text-[9px]">Sélect</span>
              </button>

              {/* Crayon / Pinceau (Dessin libre) */}
              <button
                type="button"
                onClick={() => {
                  setTool('pencil');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'pencil'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Crayon / Dessin libre"
              >
                <Pencil className="w-4 h-4" />
                <span className="text-[9px]">Crayon</span>
              </button>

              {/* Lasso Fill (Forme pleine fermée) */}
              <button
                type="button"
                onClick={() => {
                  setTool('lasso_fill');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'lasso_fill'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Lasso / Pinceau en mode Remplissage (Fill)"
              >
                <Lasso className="w-4 h-4" />
                <span className="text-[9px]">Lasso</span>
              </button>

              {/* Pot de peinture */}
              <button
                type="button"
                onClick={() => {
                  setTool('bucket');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'bucket'
                    ? 'bg-teal-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pot de peinture (Remplir une forme)"
              >
                <PaintBucket className="w-4 h-4" />
                <span className="text-[9px]">Pot</span>
              </button>

              {/* Polyligne */}
              <button
                type="button"
                onClick={() => {
                  setTool('polyline');
                  setSelectedPathIds([]);
                  setActivePolylinePoints([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'polyline'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Polyligne (cliquez point par point)"
              >
                <GitCommit className="w-4 h-4" />
                <span className="text-[9px]">Ligne</span>
              </button>

              {/* Rectangle arrondi */}
              <button
                type="button"
                onClick={() => {
                  setTool('rectangle');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'rectangle'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Rectangle / Cercle"
              >
                <Square className="w-4 h-4" />
                <span className="text-[9px]">Rect</span>
              </button>

              {/* Gomme Précise (Normal - segments de traits) */}
              <button
                type="button"
                onClick={() => {
                  setTool('eraser_partial');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'eraser_partial'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme Précise (Efface les bouts de traits)"
              >
                <Eraser className="w-4 h-4" />
                <span className="text-[9px]">Gomme</span>
              </button>

              {/* Gomme Trait entier */}
              <button
                type="button"
                onClick={() => {
                  setTool('eraser_stroke');
                  setSelectedPathIds([]);
                }}
                className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                  tool === 'eraser_stroke'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme Objet (Efface le trait ou la forme entière en 1 clic)"
              >
                <Scissors className="w-4 h-4" />
                <span className="text-[9px]">Objet</span>
              </button>

              {/* Point d'Impact Hotspot (Curseur) */}
              {(isCursorMode || referenceGuide || initialHotspot) && (
                <button
                  type="button"
                  onClick={() => {
                    setTool('hotspot');
                    setSelectedPathIds([]);
                  }}
                  className={`p-2 rounded-xl transition-all flex flex-col justify-center items-center gap-0.5 cursor-pointer ${
                    tool === 'hotspot'
                      ? 'bg-rose-600 text-white font-bold shadow-2xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Définir le point d'impact réel du curseur (Hotspot)"
                >
                  <Crosshair className="w-4 h-4 text-rose-500" />
                  <span className="text-[9px]">Impact</span>
                </button>
              )}
            </div>
          </div>

          {/* Section Définition des Colliders */}
          <div className="bg-white p-3 rounded-2xl border border-emerald-100 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-600" /> Forme du Collider
              </span>
              <button
                type="button"
                onClick={handleAutoDetectCollider}
                className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                title="Détecter automatiquement d'après le tracé de votre dessin"
              >
                <Sparkles className="w-3 h-3 text-emerald-600" /> Tracé auto
              </button>
            </div>

            <div className="grid grid-cols-3 gap-1.5">
              <button
                type="button"
                onClick={() => handleColliderTypeSelect('box')}
                className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  colliderType === 'box'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Collider Rectangle"
              >
                <Square className="w-3 h-3" /> Rectangle
              </button>
              <button
                type="button"
                onClick={() => handleColliderTypeSelect('circle')}
                className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  colliderType === 'circle'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Collider Cercle"
              >
                <Circle className="w-3 h-3" /> Cercle
              </button>
              <button
                type="button"
                onClick={() => handleColliderTypeSelect('polygon')}
                className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  colliderType === 'polygon'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Collider Polyligne / Polygone"
              >
                <Shapes className="w-3 h-3" /> Polyligne
              </button>
            </div>
          </div>

          {/* Inspecteur des formes sélectionnées */}
          {tool === 'select' && selectedPathIds.length > 0 && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  {selectedPathIds.length > 1
                    ? `${selectedPathIds.length} formes sélectionnées`
                    : '1 forme sélectionnée'}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="p-1 text-indigo-600 hover:bg-indigo-200/60 rounded-lg cursor-pointer transition-colors"
                    title="Dupliquer la sélection"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                    title="Supprimer la sélection"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {selectedPathIds.length === 1 && primarySelectedPath?.rect && (
                <div className="space-y-1">
                  <div className="flex justify-between text-[11px] font-bold text-indigo-950">
                    <span>Arrondi des angles (0 = rectangle, 50 = rond)</span>
                    <span className="font-mono text-indigo-700">{cornerRadius}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    value={cornerRadius}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setCornerRadius(val);
                      updateSelectedShapeProperties({ cornerRadius: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}

          {/* Double Sélecteur Couleur : Trait (Stroke) & Remplissage (Fill) */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
            {/* Tabs Stroke / Fill */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl gap-1">
              <button
                type="button"
                onClick={() => setColorMode('stroke')}
                className={`py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  colorMode === 'stroke'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: strokeColor === 'none' ? 'transparent' : strokeColor }}
                />
                <span>Contour</span>
              </button>
              <button
                type="button"
                onClick={() => setColorMode('fill')}
                className={`py-1 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  colorMode === 'fill'
                    ? 'bg-white text-indigo-700 shadow-xs'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <div
                  className="w-3 h-3 rounded-full border border-slate-300"
                  style={{ backgroundColor: fillColor === 'none' ? 'transparent' : fillColor }}
                />
                <span>Remplissage</span>
              </button>
            </div>

            {/* Stroke Controls */}
            {colorMode === 'stroke' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Couleur du contour</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setStrokeColor('none');
                        if (selectedPathIds.length > 0) updateSelectedShapeProperties({ stroke: 'none' });
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${
                        strokeColor === 'none'
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Sans trait
                    </button>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer">
                      <Pipette className="w-3 h-3" />
                      <input
                        type="color"
                        value={strokeColor.startsWith('#') ? strokeColor : '#6366f1'}
                        onChange={(e) => {
                          const c = e.target.value;
                          setStrokeColor(c);
                          if (selectedPathIds.length > 0) updateSelectedShapeProperties({ stroke: c });
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={`stroke-${c}`}
                      type="button"
                      onClick={() => {
                        setStrokeColor(c);
                        if (selectedPathIds.length > 0) updateSelectedShapeProperties({ stroke: c });
                      }}
                      className={`w-6 h-6 rounded-xl border transition-all cursor-pointer ${
                        strokeColor === c
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm'
                          : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>

                {/* Épaisseur du trait */}
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-700">
                    <span>Épaisseur</span>
                    <span className="font-mono text-indigo-600">{strokeWidth}px</span>
                  </div>
                  <input
                    type="range"
                    min="2"
                    max="24"
                    value={strokeWidth}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      setStrokeWidth(val);
                      if (selectedPathIds.length > 0) updateSelectedShapeProperties({ strokeWidth: val });
                    }}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                  />
                </div>
              </div>
            )}

            {/* Fill Controls */}
            {colorMode === 'fill' && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-700">Couleur de remplissage</span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setFillColor('none');
                        if (selectedPathIds.length > 0) updateSelectedShapeProperties({ fill: 'none' });
                      }}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-md border cursor-pointer ${
                        fillColor === 'none'
                          ? 'bg-rose-50 text-rose-700 border-rose-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      Transparent
                    </button>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer">
                      <Pipette className="w-3 h-3" />
                      <input
                        type="color"
                        value={fillColor.startsWith('#') ? fillColor : '#6366f1'}
                        onChange={(e) => {
                          const c = e.target.value;
                          setFillColor(c);
                          if (selectedPathIds.length > 0) updateSelectedShapeProperties({ fill: c });
                        }}
                        className="sr-only"
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-6 gap-1.5">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={`fill-${c}`}
                      type="button"
                      onClick={() => {
                        setFillColor(c);
                        if (selectedPathIds.length > 0) updateSelectedShapeProperties({ fill: c });
                      }}
                      className={`w-6 h-6 rounded-xl border transition-all cursor-pointer ${
                        fillColor === c
                          ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm'
                          : 'hover:scale-105 border-slate-300'
                      }`}
                      style={{ backgroundColor: c }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Module Modèle Repère & Point de Contact Curseur (Hotspot) */}
          {(activeReferenceGuide || isCursorMode) && (
            <div className="bg-indigo-50/80 p-3 rounded-2xl border border-indigo-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-indigo-950 flex items-center gap-1.5 truncate max-w-[160px]">
                  <Target className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">
                    {activeReferenceGuide ? `Repère : ${activeReferenceGuide.name}` : "Point d'impact"}
                  </span>
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  {activeReferenceGuide && (
                    <button
                      type="button"
                      onClick={() => setGuideOpacity(guideOpacity > 0 ? 0 : 0.45)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        guideOpacity > 0
                          ? 'bg-indigo-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {guideOpacity > 0 ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                      Guide
                    </button>
                  )}
                  {isCursorMode && (
                    <button
                      type="button"
                      onClick={() => setShowHotspot(!showHotspot)}
                      className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                        showHotspot
                          ? 'bg-rose-600 text-white shadow-2xs'
                          : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <Crosshair className="w-3 h-3" />
                      Impact
                    </button>
                  )}
                </div>
              </div>

              {/* Sélecteur de repère si plusieurs sont disponibles */}
              {availableReferenceGuides && availableReferenceGuides.length > 1 && (
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-indigo-900 block">
                    Choisir le repère de calque :
                  </label>
                  <select
                    value={selectedGuideId}
                    onChange={(e) => {
                      setSelectedGuideId(e.target.value);
                      if (guideOpacity === 0) setGuideOpacity(0.45);
                    }}
                    className="w-full text-xs font-bold text-slate-800 bg-white border border-indigo-200 rounded-xl px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 shadow-2xs cursor-pointer"
                  >
                    {availableReferenceGuides.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.isCustom ? `🎨 ${g.name}` : `⚡ ${g.name}`}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {activeReferenceGuide && guideOpacity > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-indigo-200/60">
                  <div className="flex items-center justify-between text-[11px] font-bold text-indigo-900">
                    <span>Opacité du dessin repère</span>
                    <span className="font-mono">{Math.round(guideOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0.05"
                    max="0.9"
                    step="0.05"
                    value={guideOpacity}
                    onChange={(e) => setGuideOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-indigo-200/70 rounded-lg"
                  />
                  {activeReferenceGuide.paths && activeReferenceGuide.paths.length > 0 && (
                    <button
                      type="button"
                      onClick={handleCopyGuideToCanvas}
                      className="w-full py-1.5 px-2 bg-white hover:bg-indigo-100/80 text-indigo-700 text-[11px] font-bold rounded-xl border border-indigo-300 transition-colors flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer active:scale-98"
                      title="Copie le tracé du repère directement sur votre canevas pour le retoucher ou le colorer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Copier le tracé du repère dans le dessin
                    </button>
                  )}
                </div>
              )}

              {isCursorMode && showHotspot && (
                <div className="flex items-center justify-between text-[11px] font-bold text-slate-700 bg-white p-2 rounded-xl border border-indigo-100 shadow-2xs">
                  <span className="flex items-center gap-1.5 text-rose-700">
                    <Crosshair className="w-3.5 h-3.5 text-rose-600" />
                    Point : ({Math.round(hotspot.x)}, {Math.round(hotspot.y)})
                  </span>
                  <button
                    type="button"
                    onClick={handleResetHotspot}
                    className="text-[10px] text-slate-500 hover:text-slate-800 underline cursor-pointer"
                  >
                    Réinitialiser
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Module Pelure d'Oignon (Onion Skinning) */}
          {availableOnionStates.length > 0 && (
            <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Pelure d'oignon
                </span>
                <button
                  type="button"
                  onClick={() => setOnionSkinEnabled(!onionSkinEnabled)}
                  className={`px-2 py-0.5 text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    onionSkinEnabled
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {onionSkinEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {onionSkinEnabled ? 'On' : 'Off'}
                </button>
              </div>

              {onionSkinEnabled && (
                <div className="space-y-1.5 pt-1 border-t border-slate-100 animate-in fade-in duration-150">
                  <select
                    value={selectedOnionStateId}
                    onChange={(e) => setSelectedOnionStateId(e.target.value)}
                    className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2 py-1 focus:outline-none cursor-pointer"
                  >
                    {availableOnionStates.map((st) => (
                      <option key={st.id} value={st.id}>
                        Repère : "{st.name}"
                      </option>
                    ))}
                  </select>

                  <input
                    type="range"
                    min="0.1"
                    max="0.8"
                    step="0.05"
                    value={onionOpacity}
                    onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer h-1 bg-slate-100 rounded-lg"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions : Annuler & Effacer */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={paths.length === 0}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Annuler le dernier tracé"
          >
            <Undo2 className="w-3.5 h-3.5" /> Annuler
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={paths.length === 0}
            className="flex-1 py-1.5 px-2 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1 cursor-pointer shadow-2xs active:scale-95"
            title="Effacer tout"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Effacer
          </button>
        </div>
      </div>
    </div>
  );
}
