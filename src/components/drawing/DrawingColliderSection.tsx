import { Shield, Eye, EyeOff, Sparkles, Square, Circle, Shapes } from 'lucide-react';
import { ColliderType } from '../../types';
import { ManualColliderRect } from './DrawingCanvasColliderOverlay';

interface DrawingColliderSectionProps {
  showColliderPreview: boolean;
  onToggleShowColliderPreview: () => void;
  onAutoDetectCollider: () => void;
  isSharedColliderEntity: boolean;
  isReferenceStateForSharedCollider: boolean;
  overrideCollider: boolean;
  onToggleOverrideCollider: (nextOverride: boolean) => void;
  colliderMode: 'auto' | 'manual';
  onSwitchColliderMode: (mode: 'auto' | 'manual') => void;
  colliderType: ColliderType;
  onSelectColliderType: (type: ColliderType) => void;
  isColliderBodyDraggable: boolean;
  onToggleColliderBodyDraggable: () => void;
  onInitManualFromDrawing: () => void;
  manualCollider: ManualColliderRect;
  onUpdateManualCollider: (shape: ColliderType, next: ManualColliderRect) => void;
}

export function DrawingColliderSection({
  showColliderPreview,
  onToggleShowColliderPreview,
  onAutoDetectCollider,
  isSharedColliderEntity,
  isReferenceStateForSharedCollider,
  overrideCollider,
  onToggleOverrideCollider,
  colliderMode,
  onSwitchColliderMode,
  colliderType,
  onSelectColliderType,
  isColliderBodyDraggable,
  onToggleColliderBodyDraggable,
  onInitManualFromDrawing,
  manualCollider,
  onUpdateManualCollider,
}: DrawingColliderSectionProps) {
  return (
    <div className="bg-white p-3 rounded-2xl border border-emerald-200/80 shadow-2xs space-y-2.5">
      <div className="flex items-center justify-between gap-1.5">
        <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
          <Shield className="w-3.5 h-3.5 text-emerald-600" /> Collider
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleShowColliderPreview}
            className={`p-1 rounded-lg border text-[10px] cursor-pointer transition-colors ${
              showColliderPreview
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-slate-50 text-slate-400 border-slate-200'
            }`}
            title={showColliderPreview ? 'Masquer la zone collider' : 'Afficher la zone collider'}
          >
            {showColliderPreview ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
          </button>
          <button
            type="button"
            onClick={onAutoDetectCollider}
            className="text-[10px] font-bold text-emerald-700 hover:text-emerald-900 bg-emerald-50 hover:bg-emerald-100 px-2 py-0.5 rounded-lg border border-emerald-200 flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
            title="Calculer/détecter automatiquement d'après le dessin"
          >
            <Sparkles className="w-3 h-3 text-emerald-600" /> Auto-dessin
          </button>
        </div>
      </div>

      {/* Statut Partagé / Surcharge d'état */}
      {isSharedColliderEntity && (
        <div className="p-2 rounded-xl bg-indigo-50/70 border border-indigo-200/80 space-y-1.5">
          {isReferenceStateForSharedCollider ? (
            <div className="text-[10px] font-bold text-indigo-800 leading-snug">
              🔗 État de référence du collider partagé : toute modification ici s'applique aux états qui n'ont pas de surcharge.
            </div>
          ) : (
            <div className="flex items-center justify-between gap-2">
              <div className="text-[10px] font-bold text-indigo-900 leading-tight">
                {overrideCollider
                  ? '✏️ Surcharge active pour cet état'
                  : '🔗 Hérite du collider partagé'}
              </div>
              <button
                type="button"
                onClick={() => onToggleOverrideCollider(!overrideCollider)}
                className={`px-2 py-0.5 rounded-lg text-[10px] font-black border cursor-pointer transition-all shrink-0 ${
                  overrideCollider
                    ? 'bg-indigo-600 text-white border-indigo-700'
                    : 'bg-white text-indigo-700 border-indigo-300 hover:bg-indigo-100'
                }`}
              >
                {overrideCollider ? 'Surchargé ✓' : 'Surcharger'}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Sélecteur Mode Auto vs Manuel (masqué uniquement si héritage strict sans surcharge) */}
      {!(isSharedColliderEntity && !isReferenceStateForSharedCollider && !overrideCollider) && (
        <>
          <div className="grid grid-cols-2 p-0.5 bg-slate-100 rounded-xl gap-1">
            <button
              type="button"
              onClick={() => onSwitchColliderMode('auto')}
              className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                colliderMode === 'auto'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Automatique
            </button>
            <button
              type="button"
              onClick={() => onSwitchColliderMode('manual')}
              className={`py-1 text-[10px] font-bold rounded-lg transition-all cursor-pointer ${
                colliderMode === 'manual'
                  ? 'bg-white text-emerald-700 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Manuel (Sur mesure)
            </button>
          </div>

          {/* Forme du Collider */}
          <div className={`grid ${colliderMode === 'manual' ? 'grid-cols-2' : 'grid-cols-3'} gap-1.5`}>
            <button
              type="button"
              onClick={() => onSelectColliderType('box')}
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
              onClick={() => onSelectColliderType('circle')}
              className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                colliderType === 'circle'
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
              title="Collider Cercle"
            >
              <Circle className="w-3 h-3" /> Cercle
            </button>
            {colliderMode === 'auto' && (
              <button
                type="button"
                onClick={() => onSelectColliderType('polygon')}
                className={`py-1.5 px-2 rounded-xl border text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer ${
                  colliderType === 'polygon'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-400 ring-2 ring-emerald-200 shadow-2xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
                title="Collider Polyligne / Polygone"
              >
                <Shapes className="w-3 h-3" /> Polyligne
              </button>
            )}
          </div>

          {/* Réglages précis en mode Manuel */}
          {colliderMode === 'manual' && (
            <div className="p-2 bg-emerald-50/50 rounded-xl border border-emerald-200/80 space-y-2">
              <div className="flex items-center justify-between gap-1.5">
                <button
                  type="button"
                  onClick={onToggleColliderBodyDraggable}
                  className={`flex-1 py-1 px-2 rounded-lg text-[10px] font-bold border cursor-pointer transition-all ${
                    isColliderBodyDraggable
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-2xs'
                      : 'bg-white text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                  }`}
                  title="Permet de saisir l'intérieur de la forme verte pour la déplacer (désactivez pour dessiner dedans)"
                >
                  {isColliderBodyDraggable ? '✋ Déplacement actif' : '✋ Déplacer la zone'}
                </button>
                <button
                  type="button"
                  onClick={onInitManualFromDrawing}
                  className="py-1 px-2 rounded-lg text-[10px] font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 cursor-pointer"
                  title="Recaler sur les bords exacts du dessin"
                >
                  Caler
                </button>
              </div>

              {colliderType === 'circle' ? (
                <div className="grid grid-cols-3 gap-1.5 text-[10px]">
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Centre X</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={Math.round(manualCollider.centerX)}
                      onChange={(e) => {
                        const cx = Math.max(0, Math.min(200, Number(e.target.value) || 0));
                        onUpdateManualCollider('circle', {
                          ...manualCollider,
                          centerX: cx,
                          x: cx - manualCollider.radius,
                        });
                      }}
                      className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Centre Y</span>
                    <input
                      type="number"
                      min={0}
                      max={200}
                      value={Math.round(manualCollider.centerY)}
                      onChange={(e) => {
                        const cy = Math.max(0, Math.min(200, Number(e.target.value) || 0));
                        onUpdateManualCollider('circle', {
                          ...manualCollider,
                          centerY: cy,
                          y: cy - manualCollider.radius,
                        });
                      }}
                      className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Rayon</span>
                    <input
                      type="number"
                      min={6}
                      max={130}
                      value={Math.round(manualCollider.radius)}
                      onChange={(e) => {
                        const r = Math.max(6, Math.min(130, Number(e.target.value) || 10));
                        onUpdateManualCollider('circle', {
                          ...manualCollider,
                          radius: r,
                          width: r * 2,
                          height: r * 2,
                          x: manualCollider.centerX - r,
                          y: manualCollider.centerY - r,
                        });
                      }}
                      className="w-full px-1.5 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-1 text-[10px]">
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">X</span>
                    <input
                      type="number"
                      min={0}
                      max={190}
                      value={Math.round(manualCollider.x)}
                      onChange={(e) => {
                        const nx = Math.max(0, Math.min(190, Number(e.target.value) || 0));
                        onUpdateManualCollider('box', {
                          ...manualCollider,
                          x: nx,
                          centerX: nx + manualCollider.width / 2,
                        });
                      }}
                      className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Y</span>
                    <input
                      type="number"
                      min={0}
                      max={190}
                      value={Math.round(manualCollider.y)}
                      onChange={(e) => {
                        const ny = Math.max(0, Math.min(190, Number(e.target.value) || 0));
                        onUpdateManualCollider('box', {
                          ...manualCollider,
                          y: ny,
                          centerY: ny + manualCollider.height / 2,
                        });
                      }}
                      className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Larg.</span>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={Math.round(manualCollider.width)}
                      onChange={(e) => {
                        const nw = Math.max(10, Math.min(200, Number(e.target.value) || 10));
                        onUpdateManualCollider('box', {
                          ...manualCollider,
                          width: nw,
                          centerX: manualCollider.x + nw / 2,
                        });
                      }}
                      className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                  <label className="space-y-0.5">
                    <span className="font-bold text-slate-500 block">Haut.</span>
                    <input
                      type="number"
                      min={10}
                      max={200}
                      value={Math.round(manualCollider.height)}
                      onChange={(e) => {
                        const nh = Math.max(10, Math.min(200, Number(e.target.value) || 10));
                        onUpdateManualCollider('box', {
                          ...manualCollider,
                          height: nh,
                          centerY: manualCollider.y + nh / 2,
                        });
                      }}
                      className="w-full px-1 py-1 bg-white border border-emerald-200 rounded-md font-mono font-bold text-slate-800"
                    />
                  </label>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
