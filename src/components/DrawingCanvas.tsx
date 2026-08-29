import React, { useRef, useState, useEffect } from 'react';
import {
  Eraser,
  RotateCcw,
  Undo2,
  Circle,
  Square,
  Star,
  Spline,
  Layers,
  Pipette,
  Eye,
  EyeOff,
} from 'lucide-react';
import { VectorPath } from '../types';

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

export function DrawingCanvas({
  onVectorChange,
  initialPaths = [],
  initialColor = '#6366f1',
  onionStates = [],
  currentEditingStateName,
}: DrawingCanvasProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [paths, setPaths] = useState<VectorPath[]>(initialPaths);
  const [currentPoints, setCurrentPoints] = useState<{ x: number; y: number }[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasingDrag, setIsErasingDrag] = useState(false);
  const [color, setColor] = useState(initialColor);
  const [lineWidth, setLineWidth] = useState(6);
  const [tool, setTool] = useState<'brush' | 'eraser' | 'circle' | 'square' | 'star'>('brush');

  // Onion skinning state
  const availableOnionStates = onionStates.filter((s) => (s.vectorPaths && s.vectorPaths.length > 0));
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

  // Convert points array into smooth SVG path d string
  const pointsToSVGPath = (points: { x: number; y: number }[]): string => {
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
  };

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

  const getSVGCoordinates = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
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

  const deletePathById = (pathId: string) => {
    const updated = paths.filter((p) => p.id !== pathId);
    setPaths(updated);
    notifyChange(updated);
  };

  const handlePointerDown = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const pt = getSVGCoordinates(e);

    if (tool === 'eraser') {
      setIsErasingDrag(true);
      return;
    }

    if (tool === 'circle') {
      const circlePath: VectorPath = {
        id: `path-${Date.now()}`,
        d: `M ${pt.x - 25} ${pt.y} a 25 25 0 1 0 50 0 a 25 25 0 1 0 -50 0`,
        stroke: color,
        strokeWidth: lineWidth,
        fill: color === '#ffffff' ? '#ffffff' : color + '22',
      };
      const updated = [...paths, circlePath];
      setPaths(updated);
      notifyChange(updated);
      return;
    }

    if (tool === 'square') {
      const squarePath: VectorPath = {
        id: `path-${Date.now()}`,
        d: `M ${pt.x - 25} ${pt.y - 25} h 50 v 50 h -50 z`,
        stroke: color,
        strokeWidth: lineWidth,
        fill: color === '#ffffff' ? '#ffffff' : color + '22',
      };
      const updated = [...paths, squarePath];
      setPaths(updated);
      notifyChange(updated);
      return;
    }

    if (tool === 'star') {
      const starD = `M ${pt.x} ${pt.y - 30} L ${pt.x + 8} ${pt.y - 10} L ${pt.x + 30} ${pt.y - 8} L ${pt.x + 14} ${pt.y + 8} L ${pt.x + 19} ${pt.y + 29} L ${pt.x} ${pt.y + 16} L ${pt.x - 19} ${pt.y + 29} L ${pt.x - 14} ${pt.y + 8} L ${pt.x - 30} ${pt.y - 8} L ${pt.x - 8} ${pt.y - 10} Z`;
      const starPath: VectorPath = {
        id: `path-${Date.now()}`,
        d: starD,
        stroke: color,
        strokeWidth: lineWidth,
        fill: color === '#ffffff' ? '#ffffff' : color + '33',
      };
      const updated = [...paths, starPath];
      setPaths(updated);
      notifyChange(updated);
      return;
    }

    setIsDrawing(true);
    setCurrentPoints([pt]);
  };

  const handlePointerMove = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    if (tool === 'eraser' && isErasingDrag) {
      // Eraser drag behavior
      return;
    }
    if (!isDrawing) return;
    const pt = getSVGCoordinates(e);
    setCurrentPoints((prev) => [...prev, pt]);
  };

  const handlePointerUp = () => {
    setIsErasingDrag(false);
    if (!isDrawing) return;
    setIsDrawing(false);

    if (currentPoints.length > 0) {
      const d = pointsToSVGPath(currentPoints);
      const newPath: VectorPath = {
        id: `path-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        d,
        stroke: color,
        strokeWidth: lineWidth,
        fill: 'none',
      };
      const updated = [...paths, newPath];
      setPaths(updated);
      notifyChange(updated);
    }
    setCurrentPoints([]);
  };

  const handlePathClick = (pathId: string, e: React.MouseEvent) => {
    if (tool === 'eraser') {
      e.stopPropagation();
      deletePathById(pathId);
    }
  };

  const handlePathMouseEnter = (pathId: string) => {
    if (tool === 'eraser' && isErasingDrag) {
      deletePathById(pathId);
    }
  };

  const handleUndo = () => {
    if (paths.length === 0) return;
    const updated = paths.slice(0, -1);
    setPaths(updated);
    notifyChange(updated);
  };

  const handleClear = () => {
    setPaths([]);
    setCurrentPoints([]);
    notifyChange([]);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-5 w-full h-full items-stretch overflow-hidden">
      {/* Zone de dessin Vectorielle SVG principale */}
      <div className="flex-1 bg-slate-100 border-2 border-slate-200 rounded-3xl p-4 flex flex-col items-center justify-center relative shadow-inner min-h-[360px] overflow-hidden">
        
        {/* Barre d'info d'état & pelure d'oignon */}
        <div className="w-full flex items-center justify-between px-3 py-1.5 mb-2 text-xs text-slate-500 font-medium select-none">
          <div className="flex items-center gap-2">
            {currentEditingStateName && (
              <span className="font-bold text-slate-700 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200 shadow-2xs">
                Dessin de l'état : <strong className="text-indigo-600 font-mono">{currentEditingStateName}</strong>
              </span>
            )}
            {tool === 'eraser' && (
              <span className="bg-rose-100 text-rose-700 font-bold px-2.5 py-0.5 rounded-lg text-[11px] animate-pulse">
                Mode Gomme : cliquez ou glissez sur un trait pour l'effacer
              </span>
            )}
          </div>

          <span className="bg-white text-slate-600 font-bold px-2.5 py-0.5 rounded-full font-mono border border-slate-200 shadow-2xs">
            {paths.length} {paths.length > 1 ? 'traits' : 'trait'}
          </span>
        </div>

        {/* SVG Drawing Canvas */}
        <div className="flex-1 w-full flex items-center justify-center relative">
          <svg
            ref={svgRef}
            viewBox="0 0 200 200"
            className={`w-full h-full max-w-[520px] max-h-[520px] aspect-square bg-white rounded-3xl touch-none select-none border-2 border-slate-300/80 shadow-md ${
              tool === 'eraser' ? 'cursor-not-allowed' : 'cursor-crosshair'
            }`}
            onMouseDown={handlePointerDown}
            onMouseMove={handlePointerMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handlePointerDown}
            onTouchMove={handlePointerMove}
            onTouchEnd={handlePointerUp}
          >
            {/* Grille de repère */}
            <defs>
              <pattern id="grid-dots-light" width="20" height="20" patternUnits="userSpaceOnUse">
                <circle cx="10" cy="10" r="1" fill="rgba(100,116,139,0.25)" />
              </pattern>
            </defs>
            <rect width="200" height="200" fill="url(#grid-dots-light)" />

            {/* Calque Pelure d'Oignon (Onion Skinning - État repère) */}
            {onionSkinEnabled && activeOnionReference?.vectorPaths && activeOnionReference.vectorPaths.length > 0 && (
              <g
                opacity={onionOpacity}
                className="pointer-events-none select-none transition-opacity duration-150"
              >
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

            {/* Tracés existants du dessin actif */}
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
                    ? 'hover:stroke-rose-600 hover:opacity-40 hover:stroke-[8px] cursor-pointer'
                    : ''
                }`}
                onClick={(e) => handlePathClick(p.id, e)}
                onMouseEnter={() => handlePathMouseEnter(p.id)}
              />
            ))}

            {/* Tracé en cours de création */}
            {isDrawing && currentPoints.length > 0 && (
              <path
                d={pointsToSVGPath(currentPoints)}
                stroke={color}
                strokeWidth={lineWidth}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>
      </div>

      {/* Barre d'outils vectorielle latérale (Contrôles, Palette, Pelure d'oignon, Aperçu réel) */}
      <div className="w-full lg:w-80 bg-slate-50 border border-slate-200 p-4 rounded-3xl flex flex-col justify-between gap-4 shrink-0 shadow-2xs overflow-y-auto max-h-full">
        
        <div className="space-y-4">
          {/* Aperçu à taille réelle (En dehors de la zone de dessin) */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                Aperçu Réel <span className="text-[10px] text-slate-400 font-mono font-normal">(1:1 sur scène)</span>
              </span>
              <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                200×200
              </span>
            </div>
            
            <div className="w-24 h-24 mx-auto bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-center p-2 shadow-inner relative overflow-hidden">
              {paths.length > 0 ? (
                <svg viewBox="0 0 200 200" className="w-full h-full pointer-events-none">
                  {paths.map((p) => (
                    <path
                      key={`prev-${p.id}`}
                      d={p.d}
                      stroke={p.stroke}
                      strokeWidth={p.strokeWidth}
                      fill={p.fill || 'none'}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  ))}
                </svg>
              ) : (
                <span className="text-[11px] text-slate-400 font-medium italic text-center">
                  Canvas vide
                </span>
              )}
            </div>
          </div>

          {/* Choix d'outil */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
              Outil
            </span>
            <div className="grid grid-cols-5 gap-1.5 bg-white p-1.5 rounded-2xl border border-slate-200 shadow-2xs">
              <button
                type="button"
                onClick={() => setTool('brush')}
                className={`p-2.5 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'brush'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Pinceau libre"
              >
                <Spline className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('circle')}
                className={`p-2.5 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'circle'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Cercle"
              >
                <Circle className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('square')}
                className={`p-2.5 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'square'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Carré"
              >
                <Square className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('star')}
                className={`p-2.5 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'star'
                    ? 'bg-indigo-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Étoile"
              >
                <Star className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setTool('eraser')}
                className={`p-2.5 rounded-xl transition-all flex justify-center items-center cursor-pointer ${
                  tool === 'eraser'
                    ? 'bg-rose-600 text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
                title="Gomme (cliquez sur un trait pour l'effacer)"
              >
                <Eraser className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Épaisseur du trait */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold text-slate-700">
              <span>Épaisseur du trait</span>
              <span className="font-mono text-indigo-600">{lineWidth}px</span>
            </div>
            <input
              type="range"
              min="2"
              max="24"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="w-full accent-indigo-600 cursor-pointer h-2 bg-slate-100 rounded-lg"
            />
          </div>

          {/* Palette de Couleurs & Couleur Personnalisée */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 block">Couleur du trait</span>
              <div className="flex items-center gap-1.5">
                {/* Sélecteur de couleur personnalisée */}
                <label
                  className="flex items-center gap-1 text-[11px] font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 px-2 py-0.5 rounded-lg border border-indigo-200 cursor-pointer transition-colors"
                  title="Choisir une couleur personnalisée"
                >
                  <Pipette className="w-3 h-3" />
                  <span>Personnalisée</span>
                  <input
                    type="color"
                    value={color.startsWith('#') ? color : '#6366f1'}
                    onChange={(e) => setColor(e.target.value)}
                    className="sr-only"
                  />
                </label>
              </div>
            </div>

            <div className="grid grid-cols-6 gap-2">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`w-7 h-7 rounded-xl border transition-all cursor-pointer ${
                    color === c
                      ? 'scale-110 ring-2 ring-indigo-500 ring-offset-1 z-10 shadow-sm'
                      : 'hover:scale-105 border-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-[11px] font-mono text-slate-500">
              <span>Couleur active :</span>
              <div className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 rounded-full border border-slate-300" style={{ backgroundColor: color }} />
                <span className="font-bold uppercase text-slate-700">{color}</span>
              </div>
            </div>
          </div>

          {/* Module Pelure d'Oignon (Onion Skinning) */}
          {availableOnionStates.length > 0 && (
            <div className="bg-white p-3 rounded-2xl border border-indigo-100 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> Pelure d'oignon
                </span>
                <button
                  type="button"
                  onClick={() => setOnionSkinEnabled(!onionSkinEnabled)}
                  className={`px-2 py-0.5 text-[11px] font-bold rounded-lg transition-colors flex items-center gap-1 cursor-pointer ${
                    onionSkinEnabled
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {onionSkinEnabled ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                  {onionSkinEnabled ? 'Activée' : 'Désactivée'}
                </button>
              </div>

              {onionSkinEnabled && (
                <div className="space-y-2 pt-1 border-t border-slate-100 animate-in fade-in duration-150">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      État de repère :
                    </label>
                    <select
                      value={selectedOnionStateId}
                      onChange={(e) => setSelectedOnionStateId(e.target.value)}
                      className="w-full text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                    >
                      {availableOnionStates.map((st) => (
                        <option key={st.id} value={st.id}>
                          Repère : État "{st.name}" ({st.vectorPaths?.length || 0} traits)
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-mono text-slate-500">
                      <span>Transparence repère</span>
                      <span>{Math.round(onionOpacity * 100)}%</span>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="0.8"
                      step="0.05"
                      value={onionOpacity}
                      onChange={(e) => setOnionOpacity(parseFloat(e.target.value))}
                      className="w-full accent-indigo-600 cursor-pointer h-1.5 bg-slate-100 rounded-lg"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions : Annuler & Effacer */}
        <div className="flex items-center gap-2 pt-3 border-t border-slate-200 shrink-0">
          <button
            type="button"
            onClick={handleUndo}
            disabled={paths.length === 0}
            className="flex-1 py-2 px-3 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-40 rounded-xl border border-slate-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Annuler le dernier trait"
          >
            <Undo2 className="w-3.5 h-3.5" /> Annuler trait
          </button>
          <button
            type="button"
            onClick={handleClear}
            disabled={paths.length === 0}
            className="flex-1 py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 disabled:opacity-40 rounded-xl border border-rose-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs active:scale-95"
            title="Effacer tout le dessin"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Tout effacer
          </button>
        </div>
      </div>
    </div>
  );
}
