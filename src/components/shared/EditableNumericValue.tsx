import React, { useEffect, useRef, useState } from 'react';

interface EditableNumericValueProps {
  value: number;
  onChange: (next: number) => void;
  unit?: string;
  displayText?: string;
  title?: string;
  className?: string;
  inputClassName?: string;
  precision?: number;
  allowEmptyToFallback?: number;
}

/**
 * Pastille numérique cliquable pour saisir librement n'importe quel nombre
 * (zéro, décimales fines, valeurs négatives ou supérieures à la plage du slider),
 * sans aucun bridage min/max imposé lors de la saisie manuelle.
 */
export function EditableNumericValue({
  value,
  onChange,
  unit = '',
  displayText,
  title = 'Cliquer pour saisir librement une valeur',
  className = 'text-[10px] font-mono font-bold text-slate-700 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 px-1.5 py-0.5 rounded border border-transparent hover:border-indigo-200 transition-colors cursor-text tabular-nums',
  inputClassName = 'w-16 text-[10px] font-mono font-bold text-indigo-800 bg-white border border-indigo-400 rounded px-1.5 py-0.5 outline-none ring-1 ring-indigo-500/30 text-right tabular-nums',
  precision = 3,
  allowEmptyToFallback,
}: EditableNumericValueProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const formatNum = (n: number): string => {
    if (!Number.isFinite(n)) return '0';
    const factor = Math.pow(10, precision);
    const rounded = Math.round(n * factor) / factor;
    return String(rounded);
  };

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const commit = () => {
    const raw = draft.trim().replace(',', '.');
    if (raw === '') {
      if (allowEmptyToFallback !== undefined) {
        onChange(allowEmptyToFallback);
      }
      setIsEditing(false);
      return;
    }
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) {
      onChange(parsed);
    }
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <input
        ref={inputRef}
        type="number"
        step="any"
        value={draft}
        onClick={(e) => e.stopPropagation()}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            e.stopPropagation();
            commit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            setIsEditing(false);
          }
        }}
        className={inputClassName}
      />
    );
  }

  const label = displayText !== undefined ? displayText : `${formatNum(value)}${unit ? ` ${unit}` : ''}`;

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        setDraft(formatNum(value));
        setIsEditing(true);
      }}
      title={title}
      className={className}
    >
      {label}
    </button>
  );
}
