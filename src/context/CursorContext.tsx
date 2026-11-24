import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { CursorState, renderCursorSvg, calculateCursorOffsetPx } from '../utils/cursorIcons';

interface CursorContextType {
  cursorState: CursorState;
  setCursorState: (state: CursorState) => void;
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  isDragCursorLocked: () => boolean;
  setDragCursorLocked: (locked: boolean) => void;
  hoveredEntityId: string | null;
  setHoveredEntityId: (id: string | null) => void;
}

const CursorContext = createContext<CursorContextType>({
  cursorState: 'idle',
  setCursorState: () => {},
  isDragging: false,
  setIsDragging: () => {},
  isDragCursorLocked: () => false,
  setDragCursorLocked: () => {},
  hoveredEntityId: null,
  setHoveredEntityId: () => {},
});

export const useAppCursor = () => useContext(CursorContext);

export function CursorProvider({ children }: { children: React.ReactNode }) {
  const [cursorState, setCursorStateRaw] = useState<CursorState>('idle');
  const [isDragging, setIsDraggingState] = useState(false);
  const [hoveredEntityId, setHoveredEntityId] = useState<string | null>(null);
  const [isPointerOverScene, setIsPointerOverScene] = useState(false);

  const pointerPosRef = useRef({ x: -100, y: -100 });
  const cursorElRef = useRef<HTMLDivElement>(null);
  const dragLockRef = useRef(false);
  const releaseTimerRef = useRef<number | null>(null);

  const setDragCursorLocked = (locked: boolean) => {
    dragLockRef.current = locked;
    if (locked && releaseTimerRef.current !== null) {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    setIsDraggingState(locked);
  };

  const isDragCursorLocked = () => dragLockRef.current;

  const setIsDragging = (dragging: boolean) => {
    setDragCursorLocked(dragging);
  };

  const setCursorState = (next: CursorState) => {
    // While drag is locked, never allow hover/idle/pointer updates to overwrite the drag cursor
    if (dragLockRef.current && next !== 'drag') {
      return;
    }
    if (releaseTimerRef.current !== null && next !== 'idle' && next !== 'release') {
      window.clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    setCursorStateRaw(next);
  };

  const appMode = useSceneStore((state) => state.appMode);
  const settings = useSceneStore((state) => state.settings);

  const isPlayMode = appMode === 'play';
  const useCustomCursors = settings.useCustomCursors !== false;
  const isCursorActive = isPlayMode && useCustomCursors;

  const customPaths = settings.customCursorVectorPaths?.[cursorState];
  const sourceMode = settings.cursorSourceMode || 'hugeicons';
  const offset = calculateCursorOffsetPx(cursorState, settings);
  const hasShadow = settings.cursorShadow !== false;
  const offsetRef = useRef(offset);
  offsetRef.current = offset;

  const showFloatingCursor = isCursorActive && (isPointerOverScene || isDragging);

  // Sync root document class so native Chrome cursor stays hidden even during drag capture / fast movement
  useEffect(() => {
    if (typeof document === 'undefined') return;
    if (showFloatingCursor) {
      document.documentElement.classList.add('atelier-cursor-hidden');
    } else {
      document.documentElement.classList.remove('atelier-cursor-hidden');
    }
    return () => {
      document.documentElement.classList.remove('atelier-cursor-hidden');
    };
  }, [showFloatingCursor]);

  // Apply updated offset transform immediately when cursorState changes
  useEffect(() => {
    const el = cursorElRef.current;
    if (!el || !showFloatingCursor) return;
    const { x, y } = pointerPosRef.current;
    el.style.transform = `translate3d(${x - offset.x}px, ${y - offset.y}px, 0)`;
  }, [offset.x, offset.y, showFloatingCursor]);

  useEffect(() => {
    const updatePosition = (clientX: number, clientY: number) => {
      pointerPosRef.current.x = clientX;
      pointerPosRef.current.y = clientY;
      const el = cursorElRef.current;
      if (el) {
        const off = offsetRef.current;
        el.style.transform = `translate3d(${clientX - off.x}px, ${clientY - off.y}px, 0)`;
      }
    };

    const handleWindowPointerMove = (e: PointerEvent) => {
      updatePosition(e.clientX, e.clientY);

      if (!isCursorActive) {
        setIsPointerOverScene((prev) => (prev ? false : prev));
        return;
      }

      const sceneEl =
        document.getElementById('scene-canvas-container') ||
        document.getElementById('canvas-drawing-container');
      if (sceneEl) {
        const rect = sceneEl.getBoundingClientRect();
        const isInsideScene =
          e.clientX >= rect.left &&
          e.clientX <= rect.right &&
          e.clientY >= rect.top &&
          e.clientY <= rect.bottom;
        setIsPointerOverScene((prev) => (prev === isInsideScene ? prev : isInsideScene));
      } else {
        const target = e.target as HTMLElement | null;
        const isInsideScene = !!target?.closest?.('#scene-canvas-container, #canvas-drawing-container');
        setIsPointerOverScene((prev) => (prev === isInsideScene ? prev : isInsideScene));
      }
    };

    const handleWindowRelease = () => {
      if (dragLockRef.current || isDragging) {
        dragLockRef.current = false;
        setIsDraggingState(false);
        setCursorStateRaw('release');
        if (releaseTimerRef.current !== null) {
          window.clearTimeout(releaseTimerRef.current);
        }
        releaseTimerRef.current = window.setTimeout(() => {
          releaseTimerRef.current = null;
          if (!dragLockRef.current) {
            setCursorStateRaw('idle');
          }
        }, 150);
      }
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: true });
    window.addEventListener('pointerup', handleWindowRelease);
    window.addEventListener('pointercancel', handleWindowRelease);

    return () => {
      window.removeEventListener('pointermove', handleWindowPointerMove);
      window.removeEventListener('pointerup', handleWindowRelease);
      window.removeEventListener('pointercancel', handleWindowRelease);
    };
  }, [isDragging, isCursorActive]);

  return (
    <CursorContext.Provider
      value={{
        cursorState,
        setCursorState,
        isDragging,
        setIsDragging,
        isDragCursorLocked,
        setDragCursorLocked,
        hoveredEntityId,
        setHoveredEntityId,
      }}
    >
      {children}

      {/* Floating Animated Custom Cursor - Play Mode Only (Direct GPU translate3d without transition lag) */}
      {showFloatingCursor && (
        <div
          id="custom-scene-cursor"
          ref={cursorElRef}
          className="fixed top-0 left-0 pointer-events-none z-[99999] select-none will-change-transform"
          style={{
            transform: `translate3d(${pointerPosRef.current.x - offset.x}px, ${pointerPosRef.current.y - offset.y}px, 0)`,
          }}
        >
          <div className={`w-9 h-9 ${hasShadow ? 'drop-shadow-md' : ''}`}>
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

