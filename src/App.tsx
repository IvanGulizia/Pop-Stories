import { useState } from 'react';
import { Scene } from './components/Scene';
import { Inspector } from './components/Inspector';
import { RuleBook } from './components/RuleBook';
import { CreateEntityModal } from './components/CreateEntityModal';
import { EntityGallery } from './components/EntityGallery';
import { SettingsPanel } from './components/SettingsPanel';
import { useSceneStore } from './store/useSceneStore';
import {
  Play,
  Pencil,
  RotateCcw,
  X,
  Shapes,
  Image as ImageIcon,
  Zap,
  SlidersHorizontal,
  Settings,
  Trash2,
} from 'lucide-react';

export default function App() {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const appMode = useSceneStore((state) => state.appMode);
  const setAppMode = useSceneStore((state) => state.setAppMode);
  const resetScene = useSceneStore((state) => state.resetScene);
  const clearAllEntities = useSceneStore((state) => state.clearAllEntities);
  const clearProject = useSceneStore((state) => state.clearProject);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const rules = useSceneStore((state) => state.rules);

  // Main UI View States
  const [activeView, setActiveView] = useState<'canvas' | 'rules'>('canvas');
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(true);
  const [rightPanel, setRightPanel] = useState<'none' | 'inspector' | 'settings'>('inspector');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);

  const activeRulesCount = rules.filter((r) => r.enabled).length;

  const handleToggleRightPanel = (panel: 'inspector' | 'settings') => {
    if (rightPanel === panel) {
      setRightPanel('none');
    } else {
      setRightPanel(panel);
    }
  };

  return (
    <div className="h-screen w-screen bg-[#edf0f5] text-slate-900 font-sans flex flex-col overflow-hidden select-none">
      {/* Modal de création de dessin vectoriel */}
      <CreateEntityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* --- TOP BAR (Ui 1.0 layout) --- */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        {/* LEFT SECTION: ENTITIES TOGGLE */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEntitiesOpen(!isEntitiesOpen)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isEntitiesOpen
                ? 'bg-[#181c2e] text-white border border-[#2a304e]'
                : 'bg-[#22273e] text-slate-300 hover:text-white hover:bg-[#1c2136] border border-[#2e3556]'
            }`}
          >
            <Shapes className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            <span>Entities</span>
          </button>
        </div>

        {/* CENTER-LEFT SECTION: CANVAS / RULES TABS + FLOATING CONTROLS */}
        <div className="flex items-center gap-4">
          {/* Segmented View Tabs: Canvas & Rules */}
          <div className="flex items-center bg-[#1e233a] p-1 rounded-2xl border border-[#2e3556] shadow-xs">
            <button
              onClick={() => setActiveView('canvas')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeView === 'canvas'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <ImageIcon className="w-3.5 h-3.5" strokeWidth={2} />
              <span>Canvas</span>
            </button>

            <button
              onClick={() => setActiveView('rules')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
                activeView === 'rules'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-amber-500 fill-amber-500" strokeWidth={2} />
              <span>Rules</span>
            </button>
          </div>

          {/* Floating Circle Action Controls */}
          <div className="flex items-center gap-2 bg-[#1e233a] p-1 rounded-full border border-[#2e3556] shadow-xs">
            {/* Button 1: Edit Mode */}
            <button
              onClick={() => setAppMode('edit')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                appMode === 'edit'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Mode Édition"
            >
              <Pencil className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            {/* Button 2: Play Mode */}
            <button
              onClick={() => setAppMode('play')}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                appMode === 'play'
                  ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title="Mode Play (Interactif)"
            >
              <Play className="w-3.5 h-3.5 fill-current" strokeWidth={2} />
            </button>

            {/* Button 3: Reset Scene */}
            <button
              onClick={resetScene}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              title="Recharger la scène"
            >
              <RotateCcw className="w-3.5 h-3.5" strokeWidth={2} />
            </button>

            {/* Button 4: Deselect / Close */}
            <button
              onClick={() => {
                if (selectedEntityId) selectEntity(null);
                else setIsClearModalOpen(true);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all cursor-pointer"
              title={selectedEntityId ? 'Désélectionner' : 'Nettoyer la scène'}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* RIGHT SECTION: INSPECTOR & SETTINGS TABS */}
        <div className="flex items-center gap-2">
          {/* Inspector Tab */}
          <button
            onClick={() => handleToggleRightPanel('inspector')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              rightPanel === 'inspector'
                ? 'bg-[#181c2e] text-white border border-[#2a304e]'
                : 'bg-[#22273e] text-slate-300 hover:text-white hover:bg-[#1c2136] border border-[#2e3556]'
            }`}
          >
            <SlidersHorizontal className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            <span className="hidden sm:inline">Inspector</span>
          </button>

          {/* Settings Tab */}
          <button
            onClick={() => handleToggleRightPanel('settings')}
            className={`px-3.5 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              rightPanel === 'settings'
                ? 'bg-[#181c2e] text-white border border-[#2a304e]'
                : 'bg-[#22273e] text-slate-300 hover:text-white hover:bg-[#1c2136] border border-[#2e3556]'
            }`}
          >
            <Settings className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* --- MAIN WORKSPACE WITH 3 ROUNDED FRAMES --- */}
      <div className="flex-1 flex gap-3 px-3 sm:px-6 pb-4 overflow-hidden min-h-0">
        {/* 1. LEFT DRAWER: ENTITIES LIST */}
        {isEntitiesOpen && (
          <aside className="w-64 sm:w-72 bg-white rounded-3xl border border-slate-300/80 shadow-xs flex flex-col overflow-hidden shrink-0 transition-all">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Shapes className="w-4 h-4 text-slate-700" strokeWidth={2} />
                Entités
              </span>
              <button
                onClick={() => setIsEntitiesOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-3.5 flex-1 overflow-y-auto">
              <EntityGallery onOpenCreateModal={() => setIsCreateModalOpen(true)} />
            </div>
          </aside>
        )}

        {/* 2. CENTER FRAME: CANVAS OR RULES */}
        <main className="flex-1 bg-white rounded-3xl border border-slate-300/80 shadow-xs flex flex-col overflow-hidden min-w-0">
          {activeView === 'canvas' ? (
            <div className="flex-1 relative flex items-center justify-center min-h-0 overflow-hidden">
              <Scene onOpenCreateModal={() => setIsCreateModalOpen(true)} />
            </div>
          ) : (
            <div className="flex-1 p-4 sm:p-6 overflow-hidden flex flex-col min-h-0">
              <RuleBook />
            </div>
          )}
        </main>

        {/* 3. RIGHT DRAWER: INSPECTOR OR SETTINGS */}
        {rightPanel !== 'none' && (
          <aside className="w-72 sm:w-80 bg-white rounded-3xl border border-slate-300/80 shadow-xs flex flex-col overflow-hidden shrink-0 transition-all">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                {rightPanel === 'inspector' ? (
                  <>
                    <SlidersHorizontal className="w-4 h-4 text-slate-700" strokeWidth={2} />
                    Inspecteur d'Entité
                  </>
                ) : (
                  <>
                    <Settings className="w-4 h-4 text-slate-700" strokeWidth={2} />
                    Paramètres
                  </>
                )}
              </span>
              <button
                onClick={() => setRightPanel('none')}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {rightPanel === 'inspector' ? (
                <Inspector />
              ) : (
                <SettingsPanel onOpenClearModal={() => setIsClearModalOpen(true)} />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Nettoyage Modal */}
      {isClearModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 p-6 max-w-md w-full shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-100 text-rose-600 rounded-xl">
                  <Trash2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Nettoyer la Scène / Projet</h3>
                  <p className="text-xs text-slate-500">Choisissez l'option souhaitée :</p>
                </div>
              </div>
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => {
                  clearAllEntities();
                  setIsClearModalOpen(false);
                }}
                className="w-full text-left p-3.5 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700 flex items-center gap-2">
                  🧹 Vider le Canvas
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Supprime tous les objets posés sur la scène. Conserve vos règles Storyboard.
                </div>
              </button>

              <button
                onClick={() => {
                  clearProject();
                  setIsClearModalOpen(false);
                }}
                className="w-full text-left p-3.5 bg-slate-50 hover:bg-rose-50/60 border border-slate-200 hover:border-rose-300 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-rose-700 flex items-center gap-2">
                  💥 Réinitialiser Tout le Projet
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Efface les objets sur la scène ET supprime toutes les règles Storyboard.
                </div>
              </button>

              <button
                onClick={() => {
                  restoreDefaultScene();
                  setIsClearModalOpen(false);
                }}
                className="w-full text-left p-3.5 bg-slate-50 hover:bg-indigo-50/60 border border-slate-200 hover:border-indigo-300 rounded-2xl transition-all cursor-pointer group"
              >
                <div className="text-xs font-bold text-slate-800 group-hover:text-indigo-700 flex items-center gap-2">
                  🌱 Restaurer le projet de départ
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  Restaure la scène de démonstration d'origine (Plante, Pomme, Étoile).
                </div>
              </button>
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setIsClearModalOpen(false)}
                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
