import React, { useCallback, useEffect, useRef } from 'react';

interface UseContextMenuTriggerOptions {
  disabled?: boolean;
  longPressMs?: number;
  moveTolerancePx?: number;
  ignoreInteractiveChildren?: boolean;
}

export function useContextMenuTrigger(
  onOpen: (coords: { x: number; y: number }) => void,
  options: UseContextMenuTriggerOptions = {}
) {
  const {
    disabled = false,
    longPressMs = 450,
    moveTolerancePx = 8,
    ignoreInteractiveChildren = true,
  } = options;

  const timerRef = useRef<number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const didOpenByLongPressRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    startPosRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const onContextMenu = useCallback(
    (e: React.MouseEvent) => {
      if (disabled) return;
      e.preventDefault();
      e.stopPropagation();
      clearTimer();
      onOpen({ x: e.clientX, y: e.clientY });
    },
    [disabled, clearTimer, onOpen]
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (disabled) return;
      if (e.pointerType !== 'touch' && e.pointerType !== 'pen') return;
      if (e.button !== 0) return;

      if (ignoreInteractiveChildren) {
        const target = e.target as HTMLElement | null;
        if (target?.closest('button, input, select, textarea, a, label, [role="slider"]')) {
          return;
        }
      }

      clearTimer();
      didOpenByLongPressRef.current = false;
      const clientX = e.clientX;
      const clientY = e.clientY;
      startPosRef.current = { x: clientX, y: clientY };

      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        startPosRef.current = null;
        didOpenByLongPressRef.current = true;
        onOpen({ x: clientX, y: clientY });
        window.setTimeout(() => {
          didOpenByLongPressRef.current = false;
        }, 400);
      }, longPressMs);
    },
    [disabled, ignoreInteractiveChildren, clearTimer, onOpen, longPressMs]
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!startPosRef.current) return;
      const dx = e.clientX - startPosRef.current.x;
      const dy = e.clientY - startPosRef.current.y;
      if (dx * dx + dy * dy > moveTolerancePx * moveTolerancePx) {
        clearTimer();
      }
    },
    [clearTimer, moveTolerancePx]
  );

  const onPointerUp = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const onPointerCancel = useCallback(() => {
    clearTimer();
  }, [clearTimer]);

  const consumeLongPressClick = useCallback((e?: React.MouseEvent) => {
    if (didOpenByLongPressRef.current) {
      didOpenByLongPressRef.current = false;
      e?.preventDefault();
      e?.stopPropagation();
      return true;
    }
    return false;
  }, []);

  return {
    bind: {
      onContextMenu,
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
    },
    cancelLongPress: clearTimer,
    consumeLongPressClick,
  };
}
