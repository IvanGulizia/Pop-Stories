import { useState, useEffect } from 'react';
import { Scene } from './components/Scene';
import { Inspector } from './components/Inspector';
import { RuleBook } from './components/RuleBook';
import { CreateEntityModal } from './components/CreateEntityModal';
import { EntityGallery } from './components/EntityGallery';
import { SceneHierarchyList } from './components/SceneHierarchyList';
import { SettingsPanel } from './components/SettingsPanel';
import { ProjectSlotsModal } from './components/ProjectSlotsModal';
import { FullScreenDrawingModal } from './components/FullScreenDrawingModal';
import { DrawingToolsPanel } from './components/DrawingToolsPanel';
import { useSceneStore } from './store/useSceneStore';
import { SceneLayer, SceneLayerGroup } from './types';
import {
  Play,
  Pencil,
  RotateCcw,
  X,
  Shapes,
  Layers,
  Image as ImageIcon,
  Zap,
  SlidersHorizontal,
  Settings,
  Trash2,
  FolderArchive,
  Save,
} from 'lucide-react';

export default function App() {
  const selectedEntityId = useSceneStore((state) => state.selectedEntityId);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const selectedLayerId = useSceneStore((state) => state.selectedLayerId);
  const selectLayer = useSceneStore((state) => state.selectLayer);
  const appMode = useSceneStore((state) => state.appMode);
  const setAppMode = useSceneStore((state) => state.setAppMode);
  const resetScene = useSceneStore((state) => state.resetScene);
  const clearAllEntities = useSceneStore((state) => state.clearAllEntities);
  const clearProject = useSceneStore((state) => state.clearProject);
  const rules = useSceneStore((state) => state.rules);
  const entities = useSceneStore((state) => state.entities);
  const settings = useSceneStore((state) => state.settings);
  const setLayerVectorPaths = useSceneStore((state) => state.setLayerVectorPaths);
  const sceneUndoCount = useSceneStore((state) => state.sceneUndoStack.length);
  const sceneRedoCount = useSceneStore((state) => state.sceneRedoStack.length);
  const undoScene = useSceneStore((state) => state.undoScene);
  const redoScene = useSceneStore((state) => state.redoScene);

  // Main UI View States
  const [activeView, setActiveView] = useState<'canvas' | 'rules'>('canvas');
  const [isEntitiesOpen, setIsEntitiesOpen] = useState(true);
  const [leftTab, setLeftTab] = useState<'entities' | 'scene'>('entities');
  const [rightPanel, setRightPanel] = useState<'none' | 'inspector' | 'settings'>('inspector');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isClearModalOpen, setIsClearModalOpen] = useState(false);
  const [isSlotsModalOpen, setIsSlotsModalOpen] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Drawing Layer State
  const [editingLayer, setEditingLayer] = useState<{ layer: SceneLayer; group: SceneLayerGroup } | null>(null);

  // Ouvrir automatiquement le panneau outils si un calque est sélectionné en édition
  useEffect(() => {
    if (selectedLayerId && appMode === 'edit' && rightPanel !== 'inspector') {
      setRightPanel('inspector');
    }
  }, [selectedLayerId, appMode]);

  // Point 4: Quitter / valider automatiquement le mode dessin de calque au clic en dehors (ou perte de fenêtre)
  useEffect(() => {
    if (!selectedLayerId || appMode !== 'edit') return;
    const handlePointerDownOutside = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null;
      if (!el) return;
      // Ne pas interrompre si une modale est ouverte ou si le clic est sur le canvas, les outils de dessin ou la liste des calques
      if (el.closest('[data-modal-open="true"]')) return;
      if (el.closest('#scene-canvas-container, #drawing-tools-panel, #scene-layer-manager, [data-layer-drawing-keep]')) {
        return;
      }
      useSceneStore.getState().selectLayer(null);
    };
    const handleWindowBlur = () => {
      useSceneStore.getState().selectLayer(null);
    };
    window.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('blur', handleWindowBlur);
    return () => {
      window.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('blur', handleWindowBlur);
    };
  }, [selectedLayerId, appMode]);

  // Point 5: Raccourcis clavier globaux du studio (Cmd/Ctrl+Z, Shift+Z / Y, S, D, P, Enter, Suppr, Escape — sans Espace!)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      const key = e.key.toLowerCase();
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target?.isContentEditable;
      const hasBlockingModal = Boolean(
        isCreateModalOpen ||
        isSlotsModalOpen ||
        isClearModalOpen ||
        editingLayer ||
        document.querySelector('[data-modal-open="true"]')
      );

      // Cmd/Ctrl + S : Sauvegarde locale rapide sur le slot actif (ou ouverture des slots)
      if (mod && key === 's') {
        e.preventDefault();
        if (hasBlockingModal) return;
        const st = useSceneStore.getState();
        const activeSlot = st.currentSlotId
          ? st.projectSlots.find((s) => s.id === st.currentSlotId)
          : undefined;
        if (activeSlot) {
          const res = st.saveProjectToSlot(activeSlot.name, activeSlot.id);
          if (res.success) {
            setSaveToast(`Enregistré : ${activeSlot.name}`);
            setTimeout(() => setSaveToast(null), 2200);
          } else if (res.quotaExceeded) {
            setIsSlotsModalOpen(true);
          }
        } else {
          setIsSlotsModalOpen(true);
        }
        return;
      }

      if (hasBlockingModal || isTyping) return;

      // Cmd/Ctrl + P ou Cmd/Ctrl + Enter : Basculer Play <-> Édition (Espace reste libre pour le saut)
      if (mod && (key === 'p' || e.key === 'Enter')) {
        e.preventDefault();
        const st = useSceneStore.getState();
        if (st.appMode === 'play') {
          st.setAppMode('edit');
        } else {
          if (st.selectedLayerId) st.selectLayer(null);
          st.setAppMode('play');
          setActiveView('canvas');
        }
        return;
      }

      // Échap : Quitter Play -> Quitter dessin calque -> Désélectionner entité
      if (e.key === 'Escape') {
        const st = useSceneStore.getState();
        if (st.appMode === 'play') {
          st.setAppMode('edit');
        } else if (st.selectedLayerId) {
          st.selectLayer(null);
        } else if (st.selectedEntityId) {
          st.selectEntity(null);
        }
        return;
      }

      // Les raccourcis d'édition ci-dessous ne s'appliquent qu'en mode Édition
      const st = useSceneStore.getState();
      if (st.appMode !== 'edit') return;

      // Cmd/Ctrl + Z : Annuler (Undo) / Cmd/Ctrl + Shift + Z ou Cmd/Ctrl + Y : Rétablir (Redo)
      if (mod && key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          st.redoScene();
        } else {
          st.undoScene();
        }
        return;
      }
      if (mod && key === 'y') {
        e.preventDefault();
        st.redoScene();
        return;
      }

      // Cmd/Ctrl + D : Dupliquer l'entité sélectionnée
      if (mod && key === 'd') {
        if (st.selectedEntityId) {
          e.preventDefault();
          st.duplicateEntity(st.selectedEntityId);
        }
        return;
      }

      // Suppr / Retour arrière : Supprimer l'entité sélectionnée
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (st.selectedEntityId && !st.selectedLayerId) {
          e.preventDefault();
          st.deleteEntity(st.selectedEntityId);
        }
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [isCreateModalOpen, isSlotsModalOpen, isClearModalOpen, editingLayer]);

  // Keyboard Event Listener in Play Mode (Down & Up phases)
  useEffect(() => {
    if (appMode !== 'play') return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.repeat) return; // Ignore continuous auto-repeat key events
      useSceneStore.getState().triggerKeyEvent(e.key, 'down');
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      useSceneStore.getState().triggerKeyEvent(e.key, 'up');
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [appMode]);

  // Continuous 60fps evaluation loop in Play mode when not on canvas (Scene handles canvas tick)
  useEffect(() => {
    if (appMode !== 'play' || activeView === 'canvas') return;
    let animId: number;
    const loop = () => {
      useSceneStore.getState().evaluateRules();
      animId = requestAnimationFrame(loop);
    };
    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [appMode, activeView]);

  const activeRulesCount = rules.filter((r) => r.enabled).length;
  const activeEntitiesCount = Object.keys(entities).length;

  const handleToggleRightPanel = (panel: 'inspector' | 'settings') => {
    if (panel === 'settings' && selectedLayerId) {
      selectLayer(null);
    }
    if (rightPanel === panel) {
      setRightPanel('none');
    } else {
      setRightPanel(panel);
    }
  };

  return (
    <div className={`h-screen w-screen text-slate-900 font-sans flex flex-col overflow-hidden select-none transition-colors duration-300 ${
      appMode === 'play' && settings.playModeOverlay !== false ? 'bg-[#0b0e17]' : 'bg-[#edf0f5]'
    }`}>
      {/* Modal de création de dessin vectoriel */}
      <CreateEntityModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Overlay d'assombrissement du mode Play */}
      {appMode === 'play' && settings.playModeOverlay !== false && (
        <div
          className={`fixed inset-0 pointer-events-none z-20 transition-all duration-300 ${
            settings.playModeDimOpacity === 'light'
              ? 'bg-slate-950/45 backdrop-blur-[1px]'
              : settings.playModeDimOpacity === 'dark'
              ? 'bg-slate-950/85 backdrop-blur-xs'
              : 'bg-slate-950/65 backdrop-blur-[1px]'
          }`}
        />
      )}

      {/* --- TOP BAR (Ui 1.0 layout) --- */}
      <header className="h-16 px-4 sm:px-6 flex items-center justify-between shrink-0 z-30">
        {/* LEFT SECTION: ENTITIES / SCENE TOGGLE */}
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsEntitiesOpen(!isEntitiesOpen)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold uppercase tracking-wider flex items-center gap-2 transition-all cursor-pointer shadow-xs ${
              isEntitiesOpen
                ? 'bg-[#181c2e] text-white border border-[#2a304e]'
                : 'bg-[#22273e] text-slate-300 hover:text-white hover:bg-[#1c2136] border border-[#2e3556]'
            }`}
          >
            {leftTab === 'scene' ? (
              <Layers className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            ) : (
              <Shapes className="w-4 h-4 text-indigo-400" strokeWidth={1.75} />
            )}
            <span>{leftTab === 'scene' ? 'Scène' : 'Entités'}</span>
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
              onClick={() => {
                if (selectedLayerId) selectLayer(null);
                setActiveView('rules');
              }}
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
              onClick={() => {
                if (appMode === 'play') {
                  setAppMode('edit');
                } else {
                  if (selectedLayerId) selectLayer(null);
                  setAppMode('play');
                  setActiveView('canvas');
                }
              }}
              className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                appMode === 'play'
                  ? 'bg-emerald-500 text-white shadow-sm ring-2 ring-emerald-400/40'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
              title={appMode === 'play' ? "Repasser en mode Édition (Cmd/Ctrl+P ou Cmd/Ctrl+Entrée)" : "Mode Play (Cmd/Ctrl+P ou Cmd/Ctrl+Entrée)"}
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
                if (selectedLayerId) selectLayer(null);
                else if (selectedEntityId) selectEntity(null);
                else setIsClearModalOpen(true);
              }}
              className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-rose-400 hover:bg-white/10 transition-all cursor-pointer"
              title={selectedLayerId ? 'Terminer le dessin du calque' : selectedEntityId ? 'Désélectionner' : 'Nettoyer la scène'}
            >
              <X className="w-3.5 h-3.5" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* RIGHT SECTION: SLOTS, INSPECTOR & SETTINGS TABS */}
        <div className="flex items-center gap-2">
          {saveToast && (
            <span className="px-2.5 py-1 bg-emerald-500 text-white rounded-xl text-[11px] font-bold shadow-xs animate-in fade-in duration-150">
              {saveToast}
            </span>
          )}
          {/* Slots / Mes Projets Button (Floppy Disk Icon Only) */}
          <button
            onClick={() => setIsSlotsModalOpen(true)}
            className="w-9 h-9 rounded-2xl flex items-center justify-center transition-all cursor-pointer shadow-xs bg-[#22273e] text-indigo-300 hover:text-white hover:bg-[#1c2136] border border-indigo-500/40 active:scale-95"
            title="Sauvegardes locales & Slots (Cmd/Ctrl+S)"
          >
            <Save className="w-4 h-4 text-indigo-400" strokeWidth={2} />
          </button>

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
        {/* 1. LEFT DRAWER: ENTITIES & SCENE HIERARCHY */}
        {isEntitiesOpen && (
          <aside className="w-64 sm:w-76 bg-white rounded-3xl border border-slate-300/80 shadow-xs flex flex-col overflow-hidden shrink-0 transition-all">
            {/* Header with Segmented Switcher */}
            <div className="p-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between shrink-0 gap-2">
              <div className="flex items-center bg-slate-200/80 p-0.5 rounded-2xl flex-1">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedLayerId) selectLayer(null);
                    setLeftTab('entities');
                  }}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    leftTab === 'entities'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Shapes className="w-3.5 h-3.5 text-indigo-600" strokeWidth={2} />
                  <span>Entités</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLeftTab('scene')}
                  className={`flex-1 py-1.5 px-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                    leftTab === 'scene'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5 text-indigo-600" strokeWidth={2} />
                  <span>Scène</span>
                  <span className="text-[10px] px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded-full font-bold">
                    {activeEntitiesCount}
                  </span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => setIsEntitiesOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl cursor-pointer shrink-0"
                title="Masquer le panneau latéral"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-3.5 flex-1 overflow-y-auto">
              {leftTab === 'entities' ? (
                <EntityGallery onOpenCreateModal={() => setIsCreateModalOpen(true)} />
              ) : (
                <SceneHierarchyList
                  onOpenCreateModal={() => setIsCreateModalOpen(true)}
                  onOpenDrawLayerModal={(layer, group) => setEditingLayer({ layer, group })}
                />
              )}
            </div>
          </aside>
        )}

        {/* 2. CENTER FRAME: CANVAS OR RULES */}
        <main className={`flex-1 bg-white rounded-3xl border shadow-xs flex flex-col overflow-hidden min-w-0 transition-all duration-300 ${
          appMode === 'play'
            ? 'z-30 border-emerald-500/60 ring-4 ring-emerald-500/30 shadow-2xl'
            : 'border-slate-300/80 z-10'
        }`}>
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

        {/* 3. RIGHT DRAWER: INSPECTOR, DRAWING TOOLS OR SETTINGS */}
        {rightPanel !== 'none' && (
          <aside className="w-72 sm:w-80 bg-white rounded-3xl border border-slate-300/80 shadow-xs flex flex-col overflow-hidden shrink-0 transition-all">
            <div className="p-3.5 bg-slate-50/80 border-b border-slate-200/80 flex items-center justify-between shrink-0">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                {selectedLayerId ? (
                  <>
                    <Pencil className="w-4 h-4 text-indigo-600" strokeWidth={2} />
                    Dessin Décor
                  </>
                ) : rightPanel === 'inspector' ? (
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
                onClick={() => {
                  if (selectedLayerId) selectLayer(null);
                  setRightPanel('none');
                }}
                className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="p-4 flex-1 overflow-y-auto">
              {selectedLayerId ? (
                <DrawingToolsPanel
                  onUndo={() => undoScene()}
                  onRedo={() => redoScene()}
                  canUndo={sceneUndoCount > 0}
                  canRedo={sceneRedoCount > 0}
                  onClearLayer={() => {
                    useSceneStore.getState().setLayerVectorPaths(selectedLayerId, []);
                  }}
                  onClose={() => selectLayer(null)}
                />
              ) : rightPanel === 'inspector' ? (
                <Inspector />
              ) : (
                <SettingsPanel
                  onOpenClearModal={() => setIsClearModalOpen(true)}
                  onOpenSlotsModal={() => setIsSlotsModalOpen(true)}
                />
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Modal de Sauvegardes Locales (Slots) */}
      <ProjectSlotsModal
        isOpen={isSlotsModalOpen}
        onClose={() => setIsSlotsModalOpen(false)}
      />

      {/* Modal de dessin pour calque de décor (Background / Foreground) */}
      {editingLayer && (
        <FullScreenDrawingModal
          title={`Dessiner : ${editingLayer.layer.name}`}
          subtitle={`Groupe : ${editingLayer.group.name} (${editingLayer.group.kind === 'background' ? 'Arrière-plan' : 'Premier-plan'})`}
          currentEditingStateName={editingLayer.layer.name}
          initialPaths={editingLayer.layer.vectorPaths || []}
          onSave={(paths) => {
            setLayerVectorPaths(editingLayer.layer.id, paths);
            setEditingLayer(null);
          }}
          onClose={() => setEditingLayer(null)}
        />
      )}

      {/* Nettoyage Modal */}
      {isClearModalOpen && (
        <div
          data-modal-open="true"
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
        >
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
