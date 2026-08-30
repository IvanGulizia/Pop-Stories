import { useSceneStore } from '../store/useSceneStore';
import { X, Sliders, Eye, Grid, Tag, Filter } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden text-slate-800 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-800">Paramètres d'Affichage</h2>
              <p className="text-[11px] text-slate-500">Personnalisez votre espace de travail</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4">
          {/* Toggle Labels */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <Eye className="w-4 h-4 text-slate-500" />
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Afficher les étiquettes sur le canvas
                </label>
                <span className="text-[11px] text-slate-500">
                  Affiche le nom et l'état sous chaque objet sur la scène
                </span>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ showCanvasLabels: !settings.showCanvasLabels })}
              className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                settings.showCanvasLabels ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
            </button>
          </div>

          {/* Toggle Grid */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <Grid className="w-4 h-4 text-slate-500" />
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Grille d'arrière-plan
                </label>
                <span className="text-[11px] text-slate-500">
                  Afficher un motif de repère sur le canvas
                </span>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ showGrid: !settings.showGrid })}
              className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                settings.showGrid ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
            </button>
          </div>

          {/* Toggle Tags System */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <Tag className="w-4 h-4 text-purple-600" />
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Système de Tags (Catégorisation)
                </label>
                <span className="text-[11px] text-slate-500">
                  Activer la gestion et le filtrage par #tags sur les objets et les règles
                </span>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ showTagsSystem: !settings.showTagsSystem })}
              className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                settings.showTagsSystem ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
            </button>
          </div>

          {/* Toggle RuleBook Filters */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-indigo-600" />
              <div>
                <label className="text-xs font-bold text-slate-800 block">
                  Filtres du Livre de Règles
                </label>
                <span className="text-[11px] text-slate-500">
                  Afficher les filtres par type d'événement et par objet dans le livre de règles
                </span>
              </div>
            </div>
            <button
              onClick={() => updateSettings({ showRuleFilters: !settings.showRuleFilters })}
              className={`w-11 h-6 rounded-full transition-colors p-1 cursor-pointer flex items-center ${
                settings.showRuleFilters ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
              }`}
            >
              <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
            </button>
          </div>

          {/* Grid Style */}
          {settings.showGrid && (
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
              <label className="text-xs font-bold text-slate-700 block">Style de la grille</label>
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'dots', label: 'Points' },
                  { id: 'lines', label: 'Quadrillage' },
                  { id: 'clean', label: 'Épuré' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => updateSettings({ gridStyle: st.id as any })}
                    className={`py-1.5 px-3 text-xs font-semibold rounded-lg border transition-all cursor-pointer ${
                      settings.gridStyle === st.id
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
