import React, { useEffect, useState } from 'react';
import { Keyboard, Radio } from 'lucide-react';

export interface KeyboardKeySelectorProps {
  keyName: string;
  keyCode?: string;
  onSelect: (keyName: string, keyCode?: string) => void;
  compact?: boolean;
}

const SPECIAL_KEYS: Array<{ keyName: string; keyCode: string; label: string }> = [
  { keyName: 'Space', keyCode: 'Space', label: 'Espace' },
  { keyName: 'Enter', keyCode: 'Enter', label: 'Entrée' },
  { keyName: 'Shift', keyCode: 'ShiftLeft', label: 'Shift' },
  { keyName: 'Control', keyCode: 'ControlLeft', label: 'Ctrl' },
  { keyName: 'Alt', keyCode: 'AltLeft', label: 'Alt' },
  { keyName: 'Escape', keyCode: 'Escape', label: 'Échap' },
  { keyName: 'Tab', keyCode: 'Tab', label: 'Tab' },
  { keyName: 'Backspace', keyCode: 'Backspace', label: 'Retour ⌫' },
];

const ARROW_KEYS: Array<{ keyName: string; keyCode: string; label: string }> = [
  { keyName: 'ArrowUp', keyCode: 'ArrowUp', label: '↑ Haut' },
  { keyName: 'ArrowDown', keyCode: 'ArrowDown', label: '↓ Bas' },
  { keyName: 'ArrowLeft', keyCode: 'ArrowLeft', label: '← Gauche' },
  { keyName: 'ArrowRight', keyCode: 'ArrowRight', label: '→ Droite' },
];

const LETTER_KEYS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const DIGIT_KEYS = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
const F_KEYS = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];

export function formatKeyboardTriggerLabel(keyName?: string, keyCode?: string): string {
  const k = (keyName || '').trim();
  if (!k && !keyCode) return 'Espace';
  if (k === 'any') return "N'importe quelle touche";
  if (k === ' ' || k === 'Space' || keyCode === 'Space') return 'Espace';
  if (k === 'ArrowUp' || keyCode === 'ArrowUp') return '↑ Flèche Haut';
  if (k === 'ArrowDown' || keyCode === 'ArrowDown') return '↓ Flèche Bas';
  if (k === 'ArrowLeft' || keyCode === 'ArrowLeft') return '← Flèche Gauche';
  if (k === 'ArrowRight' || keyCode === 'ArrowRight') return '→ Flèche Droite';
  if (k === 'Enter' || keyCode === 'Enter' || keyCode === 'NumpadEnter') return 'Entrée';
  if (k === 'Escape' || k === 'Esc' || keyCode === 'Escape') return 'Échap';
  if (k === 'Shift' || keyCode === 'ShiftLeft' || keyCode === 'ShiftRight') return 'Shift';
  if (k === 'Control' || keyCode === 'ControlLeft' || keyCode === 'ControlRight') return 'Ctrl';
  if (k === 'Alt' || keyCode === 'AltLeft' || keyCode === 'AltRight') return 'Alt';
  if (k === 'Tab' || keyCode === 'Tab') return 'Tab';
  if (k === 'Backspace' || keyCode === 'Backspace') return 'Retour ⌫';
  if (keyCode && keyCode.startsWith('Digit')) {
    return `${k || keyCode.replace('Digit', '')} (${keyCode})`;
  }
  if (k.length === 1) return k.toUpperCase();
  return k || keyCode || 'Espace';
}

function normalizeCapturedKey(e: KeyboardEvent): { keyName: string; keyCode: string } {
  const code = e.code || '';
  let keyName = e.key || '';
  if (keyName === ' ' || code === 'Space') keyName = 'Space';
  else if (keyName.length === 1) {
    keyName = /^[a-z]$/i.test(keyName) ? keyName.toUpperCase() : keyName;
  }
  return { keyName, keyCode: code };
}

export const KeyboardKeySelector: React.FC<KeyboardKeySelectorProps> = ({
  keyName,
  keyCode,
  onSelect,
  compact = false,
}) => {
  const [isCapturing, setIsCapturing] = useState(false);

  useEffect(() => {
    if (!isCapturing) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === 'Escape' && e.shiftKey) {
        setIsCapturing(false);
        return;
      }
      const captured = normalizeCapturedKey(e);
      setIsCapturing(false);
      onSelect(captured.keyName, captured.keyCode);
    };
    window.addEventListener('keydown', handleKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true });
  }, [isCapturing, onSelect]);

  const isSelected = (candidateKey: string, candidateCode?: string) => {
    if (keyName === 'any' && candidateKey === 'any') return true;
    if (candidateCode && keyCode && candidateCode.toLowerCase() === keyCode.toLowerCase()) {
      return true;
    }
    return (keyName || '').toLowerCase() === candidateKey.toLowerCase();
  };

  return (
    <div className={compact ? 'space-y-2.5' : 'space-y-3'}>
      {/* Capture directe + touche sélectionnée */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setIsCapturing((v) => !v)}
          className={`flex-1 min-w-[200px] py-2.5 px-3 rounded-xl border-2 text-xs font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            isCapturing
              ? 'bg-amber-500 text-white border-amber-600 shadow-md animate-pulse'
              : 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:border-indigo-400'
          }`}
        >
          {isCapturing ? (
            <>
              <Radio className="w-4 h-4" />
              <span>Appuyez sur n&apos;importe quelle touche du clavier… (Shift+Échap annuler)</span>
            </>
          ) : (
            <>
              <Keyboard className="w-4 h-4" />
              <span>Capturer une touche en direct…</span>
            </>
          )}
        </button>

        <div className="px-3 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold flex items-center gap-2 shrink-0">
          <span className="text-[10px] uppercase tracking-wider text-slate-400">Actuelle :</span>
          <span className="font-mono">{formatKeyboardTriggerLabel(keyName, keyCode)}</span>
        </div>
      </div>

      {/* Touche générique */}
      <button
        type="button"
        onClick={() => onSelect('any', undefined)}
        className={`w-full py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
          isSelected('any')
            ? 'bg-amber-500 text-white border-amber-600 shadow-xs'
            : 'bg-amber-50/70 hover:bg-amber-100 text-amber-800 border-amber-200'
        }`}
      >
        ✨ N&apos;importe quelle touche (Any)
      </button>

      {/* Flèches */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Flèches directionnelles
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {ARROW_KEYS.map((item) => (
            <button
              key={item.keyCode}
              type="button"
              onClick={() => onSelect(item.keyName, item.keyCode)}
              className={`py-2 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                isSelected(item.keyName, item.keyCode)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Touches spéciales */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Touches spéciales
        </div>
        <div className="grid grid-cols-4 gap-1.5">
          {SPECIAL_KEYS.map((item) => (
            <button
              key={item.keyCode}
              type="button"
              onClick={() => onSelect(item.keyName, item.keyCode)}
              className={`py-1.5 px-2 rounded-lg border text-xs font-bold transition-all cursor-pointer ${
                isSelected(item.keyName, item.keyCode)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Chiffres 0-9 */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Chiffres
        </div>
        <div className="grid grid-cols-10 gap-1">
          {DIGIT_KEYS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => onSelect(d, `Digit${d}`)}
              className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                isSelected(d, `Digit${d}`)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Lettres A-Z */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Lettres A–Z
        </div>
        <div className="grid grid-cols-9 gap-1">
          {LETTER_KEYS.map((letter) => (
            <button
              key={letter}
              type="button"
              onClick={() => onSelect(letter, `Key${letter}`)}
              className={`py-1.5 rounded-lg border text-xs font-mono font-bold transition-all cursor-pointer ${
                isSelected(letter, `Key${letter}`)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white hover:bg-indigo-50 text-slate-700 border-slate-200'
              }`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Touches F1-F12 */}
      <div>
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">
          Touches de fonction
        </div>
        <div className="grid grid-cols-6 gap-1">
          {F_KEYS.map((fk) => (
            <button
              key={fk}
              type="button"
              onClick={() => onSelect(fk, fk)}
              className={`py-1 rounded-lg border text-[11px] font-mono font-bold transition-all cursor-pointer ${
                isSelected(fk, fk)
                  ? 'bg-indigo-600 text-white border-indigo-700 shadow-xs'
                  : 'bg-white hover:bg-indigo-50 text-slate-600 border-slate-200'
              }`}
            >
              {fk}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
