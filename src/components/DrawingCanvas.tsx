import React, { useRef, useState, useEffect } from 'react';
import {
  MousePointer,
  Spline,
  GitCommit,
  Square,
  Eraser,
  RotateCcw,
  Undo2,
  Layers,
  Pipette,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  Check,
} from 'lucide-react';
import { VectorPath, VectorPoint, VectorRect } from '../types';

export interface OnionStateOption {
  id: string;
  name: string;
  vectorPaths?: VectorPath[];
}

interface DrawingCanvasProps {
  onVectorChange: (paths: VectorPath[], svgDataUrl?: string) => void;
  initialPaths?: VectorPath[];
  initialColor?: string;
  onionStates?: OnionStateOption[];
  currentEditingStateName?: string;
}

const COLOR_PALETTE = [
  '#6366f1', '#ef4444', '#f97316', '#f59e0b', '#10b981',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#1e293b', '#64748b', '#ffffff',
];

export type DrawTool = 'select' | 'brush' | 'polyline' | 'rectangle' | 'eraser';

/**
 * Generate standard SVG path data for a rounded rectangle.
 * When cornerRadius reaches width/2 (or height/2 on square), it becomes a perfect circle.
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
export function pointsToSmoothPath(points: VectorPoint[]): string {
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

export function DrawingCanvas({
  onVectorChange,
  initialPaths = [],
  initialColor = '#6366f1',
  onionStates = [],
  currentEditingStateName,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<VectorPath[]>(initialPaths);
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(6);
  const [fillColor, setFillColor] = useState<string>('none');
  const [cornerRadius, setCornerRadius] = useState<number>(0);
  const [tool, setTool] = useState<DrawTool>('brush');

  // Selection & Transform state
  const [selectedPathId, setSelectedPathId] = useState<string | null>(null);
  const [selectedVertexIndex, setSelectedVertexIndex] = useState<number | null>(null);

  // Interaction dragging states
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPoints, setCurrentPoints] = useState<VectorPoint[]>([]);
  const [startPoint, setStartPoint] = useState<VectorPoint | null>(null);
  const [currentRect, setCurrentRect] = useState<VectorRect | null>(null);
  const [isDraggingShape, setIsDraggingShape] = useState(false);
  const [dragStartMouse, setDragStartMouse] = useState<VectorPoint | null>(null);
  const [activeHandle, setActiveHandle] = useState<'nw' | 'ne' | 'se' | 'sw' | 'vertex' | null>(null);

  // Active polyline in progress
  const [activePolylinePoints, setActivePolylinePoints] = useState<VectorPoint[]>([]);

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

  const selectedPath = paths.find((p) => p.id === selectedPathId) || null;

  // Sync properties when selecting a shape
  useEffect(() => {
    if (selectedPath) {
      setColor(selectedPath.stroke);
      setLineWidth(selectedPath.strokeWidth);
      setFillColor(selectedPath.fill || 'none');
      if (selectedPath.rect) {
        setCornerRadius(selectedPath.rect.cornerRadius || 0);
      }
    }
  }, [selectedPathId]);

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

  const getSVGCoordinates = (
    e: React.MouseEvent<any> | React.TouchEvent<any>
  ): VectorPoint => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const rect = svg.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const scaleX = 200 / rect.width;
    const scaleY = 200 / rect.height;

    const x = Math.max(0, Math.min(200, Math.round((clientX - rect.left) * scaleX)));
    const y = Math.max(0, Math.min(200, Math.round((clientY - rect.top) * scaleY)));

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

  // --- MOUSE / TOUCH HANDLERS ---
  const handlePointerDown = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const pt = getSVGCoordinates(e);

    if (tool === 'select') {
      // If clicking empty canvas in select mode
      setSelectedPathId(null);
      setSelectedVertexIndex(null);
      return;
    }

    if (tool === 'eraser') {
      return;
    }

    if (tool === 'brush') {
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
      // Polyline clicking mode
      if (activePolylinePoints.length > 0) {
        const first = activePolylinePoints[0];
        const dist = Math.hypot(pt.x - first.x, pt.y - first.y);
        // If clicking close to starting point -> close polyline
        if (dist < 8 && activePolylinePoints.length >= 3) {
          finishPolyline(true);
          return;
        }
      }
      setActivePolylinePoints((prev) => [...prev, pt]);
    }
  };

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const pt = getSVGCoordinates(e);

    // Resizing or moving with selection handles
    if (tool === 'select' && selectedPath && dragStartMouse) {
      const dx = pt.x - dragStartMouse.x;
      const dy = pt.y - dragStartMouse.y;

      if (isDraggingShape) {
        // Move whole shape
        const updated = paths.map((p) => {
          if (p.id !== selectedPath.id) return p;
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
                  : pointsToSmoothPath(newPoints),
            };
          }
          return p;
        });
        setPaths(updated);
        setDragStartMouse(pt);
        return;
      }

      if (activeHandle === 'vertex' && selectedVertexIndex !== null && selectedPath.points) {
        // Move single vertex of polyline
        const updated = paths.map((p) => {
          if (p.id !== selectedPath.id || !p.points) return p;
          const newPoints = [...p.points];
          newPoints[selectedVertexIndex] = pt;
          return {
            ...p,
            points: newPoints,
            d:
              p.type === 'polyline'
                ? pointsToPolylinePath(newPoints, p.d.endsWith('Z'))
                : pointsToSmoothPath(newPoints),
          };
        });
        setPaths(updated);
        return;
      }

      if (activeHandle && selectedPath.rect) {
        // Scale rounded rect via corner handles
        const r = selectedPath.rect;
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
          p.id === selectedPath.id
            ? { ...p, rect: newRect, d: generateRoundedRectPath(newRect) }
            : p
        );
        setPaths(updated);
        return;
      }
    }

    if (!isDrawing) return;

    if (tool === 'brush') {
      setCurrentPoints((prev) => [...prev, pt]);
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

  const handlePointerUp = () => {
    if (isDraggingShape || activeHandle) {
      setIsDraggingShape(false);
      setActiveHandle(null);
      setDragStartMouse(null);
      notifyChange(paths);
      return;
    }

    if (!isDrawing) return;
    setIsDrawing(false);

    if (tool === 'brush' && currentPoints.length > 0) {
      const d = pointsToSmoothPath(currentPoints);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: color,
        strokeWidth: lineWidth,
        fill: fillColor === 'none' ? 'none' : fillColor,
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
        stroke: color,
        strokeWidth: lineWidth,
        fill: fillColor === 'none' ? 'none' : fillColor,
        type: 'rectangle',
        rect: currentRect,
      };
      const updated = [...paths, newPath];
      setPaths(updated);
      setSelectedPathId(newPath.id);
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
      stroke: color,
      strokeWidth: lineWidth,
      fill: closed && fillColor !== 'none' ? fillColor : 'none',
      type: 'polyline',
      points: activePolylinePoints,
    };
    const updated = [...paths, newPath];
    setPaths(updated);
    setActivePolylinePoints([]);
    setSelectedPathId(newPath.id);
    setTool('select');
    notifyChange(updated);
  };

  const handleShapeClick = (p: VectorPath, e: React.MouseEvent) => {
    e.stopPropagation();
    if (tool === 'eraser') {
      const updated = paths.filter((item) => item.id !== p.id);
      setPaths(updated);
      if (selectedPathId === p.id) setSelectedPathId(null);
      notifyChange(updated);
      return;
    }
    if (tool === 'select') {
      setSelectedPathId(p.id);
      setSelectedVertexIndex(null);
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
    if (!selectedPathId) return;
    const updated = paths.map((p) => {
      if (p.id !== selectedPathId) return p;
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
    if (!selectedPath) return;
    const newId = `path-${Date.now()}`;
    let duplicated: VectorPath;

    if (selectedPath.rect) {
      const newRect = {
        ...selectedPath.rect,
        x: selectedPath.rect.x + 10,
        y: selectedPath.rect.y + 10,
      };
      duplicated = {
        ...selectedPath,
        id: newId,
        rect: newRect,
        d: generateRoundedRectPath(newRect),
      };
    } else if (selectedPath.points) {
      const newPoints = selectedPath.points.map((pt) => ({ x: pt.x + 10, y: pt.y + 10 }));
      duplicated = {
        ...selectedPath,
        id: newId,
        points: newPoints,
        d:
          selectedPath.type === 'polyline'
            ? pointsToPolylinePath(newPoints, selectedPath.d.endsWith('Z'))
            : pointsToSmoothPath(newPoints),
      };
    } else {
      duplicated = { ...selectedPath, id: newId };
    }

    const updated = [...paths, duplicated];
    setPaths(updated);
    setSelectedPathId(newId);
    notifyChange(updated);
  };

  const handleDeleteSelected = () => {
    if (!selectedPathId) return;
    const updated = paths.filter((p) => p.id !== selectedPathId);
    setPaths(updated);
    setSelectedPathId(null);
    notifyChange(updated);
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const updated = paths.slice(0, -1);
    setPaths(updated);
    if (selectedPathId && !updated.some((p) => p.id === selectedPathId)) {
      setSelectedPathId(null);
    }
    notifyChange(updated);
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPoints([]);
    setActivePolylinePoints([]);
    setSelectedPathId(null);
    notifyChange([]);
  };

  const selectedBounds = selectedPath ? getPathBounds(selectedPath) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-4 w-full h-full items-stretch overflow-hidden">
      {/* Zone de dessin Vectorielle SVG principale */}
      <div className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-3xl p-3 sm:p-4 flex flex-col items-center justify-center relative shadow-inner min-h-[360px] overflow-hidden">
        {/* Top Info Bar */}
        <div className="w-full flex items-center justify-between px-3 py-1 mb-2 text-xs text-slate-500 font-medium select-none">
          <div className="flex items-center gap-2">
            {currentEditingStateName && (
              <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                État en cours : <strong className="text-indigo-600 font-mono">{currentEditingStateName}</strong>
              </span>
            )}
            {tool === 'polyline' && activePolylinePoints.length > 0 && (
              <span className="bg-amber-100 text-amber-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px] animate-pulse">
                Polyligne : {activePolylinePoints.length} points — double-cliquez pour terminer
              </span>
            )}
            {tool === 'select' && selectedPath && (
              <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-lg text-[11px]">
                Forme sélectionnée : manipulez les poignées ou modifiez les propriétés
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {tool === 'polyline' && activePolylinePoints.length >= 2 && (
              <button
                type="button"
                onClick={() => finishPolyline(false)}
                className="px-2 py-0.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] hover:bg-indigo-700 flex items-center gap-1 cursor-pointer"
              >
                <Check className="w-3 h-3" /> Valider tracé
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
              tool === 'eraser'
                ? 'cursor-not-allowed'
                : tool === 'select'
                ? 'cursor-default'
                : 'cursor-crosshair'
            }`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
            onDoubleClick={() => {
              if (tool === 'polyline') {
                finishPolyline(false);
              }
            }}
          >
            {/* Grille de repère Figma-style */}
            <defs>
              <pattern id="grid-dots-light" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="rgba(100,116,139,0.2)" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#grid-dots-light)" />

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

            {/* Tracés existants */}
            {paths.map((p) => (
              <path
                key={p.id}
                d={p.d}
                stroke={p.stroke}
                strokeWidth={p.strokeWidth}
                fill={p.fill || 'none'}
                strokeLinecap="round"
                strokeLinejoin="round"
                className={`transition-all ${
                  tool === 'eraser'
                    ? 'hover:stroke-rose-500 hover:opacity-40 cursor-pointer'
                    : tool === 'select'
                    ? 'hover:opacity-90 cursor-pointer'
                    : ''
                }`}
                onClick={(e) => handleShapeClick(p, e)}
              />
            ))}

            {/* Tracé Freehand en cours */}
            {isDrawing && tool === 'brush' && currentPoints.length > 0 && (
              <path
                d={pointsToSmoothPath(currentPoints)}
                stroke={color}
                strokeWidth={lineWidth}
                fill={fillColor === 'none' ? 'none' : fillColor}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Rectangle en cours */}
            {isDrawing && tool === 'rectangle' && currentRect && (
              <path
                d={generateRoundedRectPath(currentRect)}
                stroke={color}
                strokeWidth={lineWidth}
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
                  stroke={color}
                  strokeWidth={lineWidth}
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

            {/* Figma-Style Bounding Box & Transformation Handles */}
            {tool === 'select' && selectedPath && selectedBounds && (
              <g className="select-none">
                {/* Bounding Rectangle */}
                <rect
                  x={selectedBounds.x}
                  y={selectedBounds.y}
                  width={selectedBounds.width}
                  height={selectedBounds.height}
                  fill="rgba(99,102,241,0.04)"
                  stroke="#6366f1"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="cursor-move"
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    setIsDraggingShape(true);
                    setDragStartMouse(getSVGCoordinates(e));
                  }}
                />

                {/* Corner Resize Handles for Rectangles */}
                {selectedPath.rect && (
                  <>
                    {/* NW */}
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('nw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    {/* NE */}
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('ne');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    {/* SE */}
                    <rect
                      x={selectedBounds.x + selectedBounds.width - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nwse-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('se');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                    {/* SW */}
                    <rect
                      x={selectedBounds.x - 4}
                      y={selectedBounds.y + selectedBounds.height - 4}
                      width="8"
                      height="8"
                      fill="#ffffff"
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-nesw-resize"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setActiveHandle('sw');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                  </>
                )}

                {/* Vertex Point Handles for Polylines & Freehand */}
                {selectedPath.points &&
                  selectedPath.points.map((pt, idx) => (
                    <circle
                      key={`handle-vertex-${idx}`}
                      cx={pt.x}
                      cy={pt.y}
                      r={selectedVertexIndex === idx ? 5 : 4}
                      fill={selectedVertexIndex === idx ? '#4f46e5' : '#ffffff'}
                      stroke="#6366f1"
                      strokeWidth="2"
                      className="cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setSelectedVertexIndex(idx);
                        setActiveHandle('vertex');
                        setDragStartMouse(getSVGCoordinates(e));
                      }}
                    />
                  ))}
              </g>
            )}
          </svg>
        </div>
      </div>

      {/* Barre d'outils vectorielle latérale (Outils, Inspecteur de forme, Palette) */}
      <div className="w-full lg:w-80 bg-slate-50 border border-slate-200 p-3.5 sm:p-4 rounded-3xl flex flex-col justify-between gap-3 shrink-0 shadow-2xs overflow-y-auto max-h-full">
        <div className="space-y-3.5">
          {/* Choix d'outil */}
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
              Outil de dessin & manipulation
            </span>
            <div className="grid grid-cols-5 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setTool('select')}
                className={`p-2 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'select'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pointeur / Sélection & Modification (Figma-style)"
              >
                <MousePointer className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('brush');
                  setSelectedPathId(null);
                }}
                className={`p-2 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'brush'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Dessin libre"
              >
                <Spline className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('polyline');
                  setSelectedPathId(null);
                  setActivePolylinePoints([]);
                }}
                className={`p-2 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'polyline'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Polyligne (cliquez point par point)"
              >
                <GitCommit className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('rectangle');
                  setSelectedPathId(null);
                }}
                className={`p-2 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'rectangle'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Rectangle arrondi (peut devenir un cercle)"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('eraser');
                  setSelectedPathId(null);
                }}
                className={`p-2 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'eraser'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Inspecteur de la forme sélectionnée */}
          {tool === 'select' && selectedPath && (
            <div className="bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl space-y-2.5 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  Forme active
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDuplicateSelected}
                    className="p-1 text-indigo-600 hover:bg-indigo-200/60 rounded-lg cursor-pointer transition-colors"
                    title="Dupliquer la forme"
                  >
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={handleDeleteSelected}
                    className="p-1 text-rose-600 hover:bg-rose-100 rounded-lg cursor-pointer transition-colors"
                    title="Supprimer la forme"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Si rectangle : Slider Arrondi / Cercle */}
              {selectedPath.rect && (
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

              {/* Remplissage de la forme */}
              <div className="flex items-center justify-between pt-1 border-t border-indigo-200/60 text-xs">
                <span className="font-bold text-indigo-950 text-[11px]">Remplissage</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const newFill = fillColor === 'none' ? color : 'none';
                      setFillColor(newFill);
                      updateSelectedShapeProperties({ fill: newFill });
                    }}
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md border transition-all cursor-pointer ${
                      fillColor !== 'none'
                        ? 'bg-indigo-600 text-white border-indigo-700'
                        : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {fillColor !== 'none' ? 'Rempli' : 'Transparent'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Épaisseur du trait */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Épaisseur</span>
              <span className="font-mono text-indigo-600">{lineWidth}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="24"
              value={lineWidth}
              onChange={(e) => {
                const val = Number(e.target.value);
                setLineWidth(val);
                if (selectedPathId) {
                  updateSelectedShapeProperties({ strokeWidth: val });
                }
              }}
              className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
            />
          </div>

          {/* Palette de Couleurs */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 block">Couleur</span>
              <label
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer transition-colors"
                title="Choisir une couleur personnalisée"
              >
                <Pipette className="w-3 h-3" />
                <span>Pipette</span>
                <input
                  type="color"
                  value={color.startsWith('#') ? color : '#6366f1'}
                  onChange={(e) => {
                    const c = e.target.value;
                    setColor(c);
                    if (selectedPathId) {
                      updateSelectedShapeProperties({ stroke: c });
                    }
                  }}
                  className="sr-only"
                />
              </label>
            </div>

            <div className="grid grid-cols-6 gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => {
                    setColor(c);
                    if (selectedPathId) {
                      updateSelectedShapeProperties({ stroke: c });
                    }
                  }}
                  className={`w-6 h-6 rounded-xl border transition-all cursor-pointer ${
                    color === c
                      ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm'
                      : 'hover:scale-105 border-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>
          </div>

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
            title="Annuler"
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
