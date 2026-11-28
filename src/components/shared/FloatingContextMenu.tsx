import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

export interface FloatingContextMenuItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  shortcut?: string;
  disabled?: boolean;
  danger?: boolean;
  dividerBefore?: boolean;
  dividerAfter?: boolean;
  onSelect: () => void;
}

interface FloatingContextMenuProps {
  x: number;
  y: number;
  title?: string;
  subtitle?: string;
  items: FloatingContextMenuItem[];
  onClose: () => void;
}

export function FloatingContextMenu({
  x,
  y,
  title,
  subtitle,
  items,
  onClose,
}: FloatingContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || typeof window === 'undefined') return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const clampedLeft = Math.max(
      margin,
      Math.min(x, window.innerWidth - rect.width - margin)
    );
    const clampedTop = Math.max(
      margin,
      Math.min(y, window.innerHeight - rect.height - margin)
    );
    setPos({ left: clampedLeft, top: clampedTop });
  }, [x, y, items.length]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999]"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) {
          e.stopPropagation();
          onClose();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={menuRef}
        style={{ left: `${pos.left}px`, top: `${pos.top}px` }}
        className="fixed min-w-[210px] max-w-[270px] bg-white rounded-2xl border border-slate-200 shadow-2xl py-1.5 text-slate-800 animate-in fade-in zoom-in-95 duration-100 select-none"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {(title || subtitle) && (
          <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
            {title && (
              <div className="text-[11px] font-extrabold text-slate-800 truncate">{title}</div>
            )}
            {subtitle && (
              <div className="text-[10px] text-slate-400 truncate">{subtitle}</div>
            )}
          </div>
        )}

        <div className="px-1 space-y-0.5 max-h-[70vh] overflow-y-auto">
          {items.map((item) => (
            <React.Fragment key={item.id}>
              {item.dividerBefore && <div className="my-1 border-t border-slate-100" />}
              <button
                type="button"
                disabled={item.disabled}
                onClick={(e) => {
                  e.stopPropagation();
                  if (item.disabled) return;
                  item.onSelect();
                  onClose();
                }}
                className={`w-full min-h-[36px] px-2.5 py-1.5 rounded-xl flex items-center justify-between gap-2 text-left text-xs font-semibold transition-colors ${
                  item.disabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : item.danger
                    ? 'text-rose-600 hover:bg-rose-50 cursor-pointer'
                    : 'text-slate-700 hover:bg-indigo-50 hover:text-indigo-800 cursor-pointer'
                }`}
              >
                <span className="flex items-center gap-2 min-w-0">
                  {item.icon && <span className="shrink-0 opacity-85">{item.icon}</span>}
                  <span className="truncate">{item.label}</span>
                </span>
                {item.shortcut && (
                  <span className="text-[10px] font-mono text-slate-400 shrink-0">
                    {item.shortcut}
                  </span>
                )}
              </button>
              {item.dividerAfter && <div className="my-1 border-t border-slate-100" />}
            </React.Fragment>
          ))}
        </div>
      </div>
    </div>,
    document.body
  );
}
