import React, { createContext, useContext, useState, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { CursorState, renderCursorSvg, calculateCursorOffsetPx } from '../utils/cursorIcons';

interface CursorContextType {
  cursorState: CursorState;
  setCursorState: (state: CursorState) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  hoveredEntityId: string | null;
  setHoveredEntityId: (id: string | null) => void;
}

const CursorContext = createContext<CursorContextType>({
  cursorState: 'idle',
  setCursorState: () => {},
  isDragging: false,
  setIsDragging: () => {},
  hoveredEntityId: null,
  setHoveredEntityId: () => {},
});

export const useAppCursor = () => useContext(CursorContext);

export function CursorProvider({ children }: { children: React.ReactNode }) {
  const [cursorState, setCursorState] = useState<CursorState>('idle');
  const [isDragging, setIsDragging] = useState(false);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [pointerPos, setPointerPos] = useState({ x: -100, y: -100 });
  const [isPointerOverScene, setIsPointerOverScene] = useState(false);

  const appMode = useSceneStore((state) => state.appMode);
  const settings = useSceneStore((state) => state.settings);

  const isPlayMode = appMode === 'play';
  const useCustomCursors = settings.useCustomCursors !== false;
  const isCursorActive = isPlayMode && useCustomCursors;

  useEffect(() => {
    const handleWindowPointerMove = (e: PointerEvent) => {
      setPointerPos({ x: e.clientX, y: e.clientY });

      if (!isCursorActive) {
        setIsPointerOverScene(false);
        return;
      }

      const sceneEl = document.getElementById('scene-canvas-container') || document.getElementById('canvas-drawing-container');
      if (sceneEl) {
        const rect = sceneEl.getBoundingClientRect();
        const isInsideScene =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        setIsPointerOverScene(isInsideScene);
      } else {
        const target = e.target as HTMLElement | null;
        const isInsideScene = !!target?.closest?.('#scene-canvas-container, #canvas-drawing-container');
        setIsPointerOverScene(isInsideScene);
      }
    };

    const handleWindowPointerUp = () => {
      if (isDragging) {
        setIsDragging(false);
        setCursorState('release');
        setTimeout(() => {
          setCursorState('idle');
        }, 150);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove);
    window.addEventListener('pointerup', handleWindowPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowPointerUp);
    };
  }, [isDragging, isCursorActive]);

  const customPaths = settings.customCursorVectorPaths?.[cursorState];
  const sourceMode = settings.cursorSourceMode || 'hugeicons';
  const offset = calculateCursorOffsetPx(cursorState, settings);
  const hasShadow = settings.cursorShadow !== false;

  return (
    <CursorContext.Provider
      value={{
        cursorState,
        setCursorState,
        isDragging,
        setIsDragging,
        hoveredEntityId,
        setHoveredEntityId,
      }}
    >
      {children}

      {/* Floating Animated Hugeicons Cursor - Play Mode Only */}
      {isCursorActive && isPointerOverScene && (
        <div
          id="custom-scene-cursor"
          className="fixed pointer-events-none z-[99999] transition-transform duration-75 ease-out select-none will-change-transform"
          style={{
            left: `${pointerPos.x}px`,
            top: `${pointerPos.y}px`,
            transform: `translate(-${offset.x}px, -${offset.y}px)`,
          }}
        >
          <div className={`w-9 h-9 transition-all ${hasShadow ? 'drop-shadow-md' : ''}`}>
            {renderCursorSvg(cursorState, {
              customVectorPaths: customPaths,
              sourceMode,
            })}
          </div>
        </div>
      )}
    </CursorContext.Provider>
  );
}
