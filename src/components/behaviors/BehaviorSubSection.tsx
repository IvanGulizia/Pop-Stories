import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';

interface BehaviorSubSectionProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  summaryBadge?: string;
  persistKey?: string;
  defaultOpen?: boolean;
  tone?: 'slate' | 'violet' | 'cyan' | 'amber' | 'rose' | 'emerald' | 'blue';
  headerActions?: React.ReactNode;
  ruleShortcuts?: React.ReactNode;
  children: React.ReactNode;
}

const TONE_CLASSES: Record<NonNullable<BehaviorSubSectionProps['tone']>, { container: string; badge: string; title: string }> = {
  slate: {
    container: 'bg-white border-slate-200',
    badge: 'bg-slate-100 text-slate-600 border-slate-200',
    title: 'text-slate-800',
  },
  violet: {
    container: 'bg-violet-50/55 border-violet-200/80',
    badge: 'bg-violet-100 text-violet-800 border-violet-200',
    title: 'text-violet-950',
  },
  cyan: {
    container: 'bg-cyan-50/55 border-cyan-200/80',
    badge: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    title: 'text-cyan-950',
  },
  amber: {
    container: 'bg-amber-50/55 border-amber-200/80',
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    title: 'text-amber-950',
  },
  rose: {
    container: 'bg-rose-50/55 border-rose-200/80',
    badge: 'bg-rose-100 text-rose-800 border-rose-200',
    title: 'text-rose-950',
  },
  emerald: {
    container: 'bg-emerald-50/55 border-emerald-200/80',
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    title: 'text-emerald-950',
  },
  blue: {
    container: 'bg-blue-50/55 border-blue-200/80',
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    title: 'text-blue-950',
  },
};

export function BehaviorSubSection({
  title,
  subtitle,
  icon,
  summaryBadge,
  persistKey,
  defaultOpen = true,
  tone = 'slate',
  headerActions,
  ruleShortcuts,
  children,
}: BehaviorSubSectionProps) {
  const expandedSections = useSceneStore((s) => s.expandedBehaviorSections || EMPTY_RECORD);
  const setBehaviorSectionExpanded = useSceneStore((s) => s.setBehaviorSectionExpanded);
  const [localOpen, setLocalOpen] = useState(defaultOpen);

  const isOpen =
    persistKey && persistKey in expandedSections
      ? Boolean(expandedSections[persistKey])
      : persistKey
      ? defaultOpen
      : localOpen;

  const toggleOpen = () => {
    const next = !isOpen;
    if (persistKey) {
      setBehaviorSectionExpanded(persistKey, next);
    } else {
      setLocalOpen(next);
    }
  };

  const styles = TONE_CLASSES[tone];

  return (
    <div className={`rounded-xl border transition-colors ${styles.container}`}>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isOpen}
        onClick={toggleOpen}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            toggleOpen();
          }
        }}
        className="w-full min-h-[34px] px-2.5 py-1.5 flex items-center justify-between gap-2 cursor-pointer select-none rounded-xl hover:bg-slate-900/[0.02]"
      >
        <div className="flex items-center gap-1.5 min-w-0 flex-1">
          <span className="text-slate-400 shrink-0">
            {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </span>
          {icon && <span className="shrink-0">{icon}</span>}
          <div className="min-w-0 flex-1">
            <div className={`text-[11px] font-bold truncate ${styles.title}`}>{title}</div>
            {!isOpen && subtitle && (
              <div className="text-[9.5px] text-slate-400 truncate">{subtitle}</div>
            )}
          </div>
        </div>

        <div
          className="flex items-center gap-1.5 shrink-0"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {summaryBadge && (
            <button
              type="button"
              onClick={toggleOpen}
              className={`px-1.5 py-0.5 rounded-md text-[9.5px] font-bold border truncate max-w-[115px] cursor-pointer ${styles.badge}`}
              title={summaryBadge}
            >
              {summaryBadge}
            </button>
          )}
          {headerActions}
        </div>
      </div>

      {isOpen && (
        <>
          {ruleShortcuts && (
            <div
              className="hidden has-[button]:flex flex-wrap items-center gap-1.5 px-2.5 py-1.5 border-t border-slate-200/60 bg-slate-50/75"
              onClick={(e) => e.stopPropagation()}
            >
              <span className="text-[9.5px] font-extrabold uppercase tracking-wider text-slate-400 mr-0.5">
                Règles :
              </span>
              {ruleShortcuts}
            </div>
          )}
          <div className="px-2.5 pb-2.5 pt-1.5 border-t border-slate-200/60 space-y-2">
            {children}
          </div>
        </>
      )}
    </div>
  );
}
