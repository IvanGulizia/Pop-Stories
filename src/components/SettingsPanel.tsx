import { Sliders, Eye, Grid, Tag, Trash2, RotateCcw, Volume2, Download, Upload, Filter, MousePointer2, Paintbrush, Undo2, Scan, Sparkles, Moon, ChevronDown, ChevronRight, FolderArchive, Tv, Layers, Zap, X, Crosshair } from 'lucide-react';
import { soundSynth } from '../utils/sound';
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CursorState, cursorMetadata, renderCursorSvg, getHugeIconGuidePaths, getDefaultCursorHotspot } from '../utils/cursorIcons';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { ReferenceGuideOption } from './DrawingCanvas';
import { useSceneStore } from '../store/useSceneStore';
import { PHYSICS_TEST_SCENE_DESCRIPTORS, PhysicsTestSceneId } from '../store/physicsTestScenes';
import { GizmoCategoryId, GizmoVisibilityMode, SceneAspectRatio } from '../types';
import { GIZMO_CATEGORY_LIST, resolveGizmoSettings } from '../utils/gizmoHelpers';

interface SettingsPanelProps {
  onOpenClearModal?: () => void;
  onOpenSlotsModal?: () => void;
}

export function SettingsPanel({ onOpenClearModal, onOpenSlotsModal }: SettingsPanelProps) {
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const loadTestScenePreset = useSceneStore((state) => state.loadTestScenePreset);
  const exportProject = useSceneStore((state) => state.exportProject);
  const importProject = useSceneStore((state) => state.importProject);

  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingCursorState, setEditingCursorState] = useState<CursorState | null>(null);
  const [exportModal, setExportModal] = useState<{
    kind: 'project' | 'cursor_pack';
    filename: string;
  } | null>(null);

  // Accordion Sections Open/Closed state (Closed by default)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    files: false,
    testScenes: false,
    canvas: false,
    gizmos: false,
    rules: false,
    cursors: false,
    play: false,
  });

  const handleLoadTestScene = (presetId: PhysicsTestSceneId, label: string) => {
    loadTestScenePreset(presetId);
    setImportStatus({ type: 'success', message: `Scène test chargée : ${label}` });
    setTimeout(() => setImportStatus(null), 3500);
  };

  const gizmos = resolveGizmoSettings(settings);

  const updateGizmos = (patch: Partial<typeof gizmos>) => {
    updateSettings({
      gizmos: {
        ...gizmos,
        ...patch,
        categories: {
          ...gizmos.categories,
          ...(patch.categories || {}),
        },
      },
    });
  };

  const setAllGizmosMode = (mode: GizmoVisibilityMode) => {
    const nextCategories = { ...gizmos.categories };
    GIZMO_CATEGORY_LIST.forEach((cat) => {
      nextCategories[cat.id] = mode;
    });
    updateSettings({
      gizmos: {
        ...gizmos,
        masterEnabled: mode !== 'off',
        categories: nextCategories,
      },
      showColliderDebugGizmos: mode !== 'off',
    });
  };

  const setCategoryMode = (id: GizmoCategoryId, mode: GizmoVisibilityMode) => {
    updateGizmos({
      categories: {
        ...gizmos.categories,
        [id]: mode,
      },
    });
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorFileInputRef = useRef<HTMLInputElement>(null);

  const toggleSection = (sectionKey: string) => {
    setOpenSections((prev) => ({
      ...prev,
      [sectionKey]: !prev[sectionKey],
    }));
  };

  const sanitizeExportFilename = (rawName: string, fallbackBase: string) => {
    const cleaned = rawName
      .trim()
      .replace(/\.json$/i, '')
      .replace(/[\\/:*?"<>|]+/g, '-');
    const base = cleaned || fallbackBase;
    return `${base}.json`;
  };

  const handleExport = () => {
    setExportModal({
      kind: 'project',
      filename: `atelier-vivant-${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const handleExportCursorPack = () => {
    setExportModal({
      kind: 'cursor_pack',
      filename: `pack-curseurs-${new Date().toISOString().slice(0, 10)}`,
    });
  };

  const executeConfirmExport = () => {
    if (!exportModal) return;
    const today = new Date().toISOString().slice(0, 10);
    if (exportModal.kind === 'project') {
      try {
        const finalFilename = sanitizeExportFilename(exportModal.filename, `atelier-vivant-${today}`);
        const data = exportProject();
        data.name = finalFilename.replace(/\.json$/i, '');
        const jsonStr = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setImportStatus({ type: 'success', message: `Exporté : ${finalFilename}` });
        setTimeout(() => setImportStatus(null), 3500);
      } catch {
        setImportStatus({ type: 'error', message: 'Erreur lors de l’exportation.' });
      }
    } else {
      try {
        const finalFilename = sanitizeExportFilename(exportModal.filename, `pack-curseurs-${today}`);
        const packData = {
          type: 'vector_cursor_pack' as const,
          version: 1,
          name: finalFilename.replace(/\.json$/i, ''),
          exportedAt: new Date().toISOString(),
          cursorSourceMode: settings.cursorSourceMode || 'custom_drawn',
          cursorShadow: settings.cursorShadow !== false,
          customCursorVectorPaths: settings.customCursorVectorPaths || {},
          customCursorPaths: settings.customCursorPaths || {},
          customCursorHotspots: settings.customCursorHotspots || {},
        };
        const jsonStr = JSON.stringify(packData, null, 2);
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = finalFilename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        setImportStatus({ type: 'success', message: `Pack exporté : ${finalFilename}` });
        setTimeout(() => setImportStatus(null), 3500);
      } catch {
        setImportStatus({ type: 'error', message: 'Erreur lors de l’exportation du pack de curseurs.' });
      }
    }
    setExportModal(null);
  };

  const handleImportCursorPackFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        if (parsed.type === 'vector_cursor_pack' || parsed.customCursorVectorPaths || parsed.customCursorPaths) {
          updateSettings({
            cursorSourceMode: parsed.cursorSourceMode || 'custom_drawn',
            cursorShadow: parsed.cursorShadow !== undefined ? parsed.cursorShadow : true,
            customCursorVectorPaths: {
              ...(settings.customCursorVectorPaths || {}),
              ...(parsed.customCursorVectorPaths || {}),
            },
            customCursorPaths: {
              ...(settings.customCursorPaths || {}),
              ...(parsed.customCursorPaths || {}),
            },
            customCursorHotspots: {
              ...(settings.customCursorHotspots || {}),
              ...(parsed.customCursorHotspots || {}),
            },
          });
          setImportStatus({ type: 'success', message: 'Pack de curseurs importé avec succès !' });
        } else {
          setImportStatus({ type: 'error', message: 'Le fichier ne contient pas de pack de curseurs valide.' });
        }
      } catch {
        setImportStatus({ type: 'error', message: 'Fichier JSON corrompu ou invalide.' });
      }
      setTimeout(() => setImportStatus(null), 4000);
      if (cursorFileInputRef.current) cursorFileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text);
        const result = importProject(parsed);
        if (result.success) {
          setImportStatus({ type: 'success', message: result.message || 'Projet importé avec succès !' });
        } else {
          setImportStatus({ type: 'error', message: result.message || 'Fichier de projet invalide.' });
        }
      } catch {
        setImportStatus({ type: 'error', message: 'Fichier JSON corrompu ou illisible.' });
      }
      setTimeout(() => setImportStatus(null), 4000);
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  const handleResetCursor = (st: CursorState) => {
    const currentVectors = { ...(settings.customCursorVectorPaths || {}) };
    delete currentVectors[st];
    const currentCustom = { ...(settings.customCursorPaths || {}) };
    delete currentCustom[st];
    const currentHotspots = { ...(settings.customCursorHotspots || {}) };
    delete currentHotspots[st];
    updateSettings({
      customCursorVectorPaths: currentVectors,
      customCursorPaths: currentCustom,
      customCursorHotspots: currentHotspots,
    });
  };

  return (
    <div className="space-y-3.5 text-slate-800">
      {/* Hidden file input for cursor packs */}
      <input
        type="file"
        ref={cursorFileInputRef}
        onChange={handleImportCursorPackFile}
        accept=".json"
        className="hidden"
      />

      {/* Modal de personnalisation de dessin d'un état de curseur */}
      {editingCursorState && (() => {
        const availableGuides: ReferenceGuideOption[] = [];

        availableGuides.push({
          id: `hugeicon-${editingCursorState}`,
          name: `Modèle Hugeicons (${cursorMetadata[editingCursorState]?.label})`,
          paths: getHugeIconGuidePaths(editingCursorState),
          hotspot: getDefaultCursorHotspot(editingCursorState),
          isCustom: false,
        });

        (Object.keys(cursorMetadata) as CursorState[]).forEach((st) => {
          const customVecs = settings.customCursorVectorPaths?.[st];
          if (customVecs && customVecs.length > 0 && st !== editingCursorState) {
            availableGuides.push({
              id: `custom-${st}`,
              name: `Dessin perso : ${cursorMetadata[st]?.label}`,
              paths: customVecs,
              hotspot: settings.customCursorHotspots?.[st] || getDefaultCursorHotspot(st),
              isCustom: true,
            });
          }
        });

        (Object.keys(cursorMetadata) as CursorState[]).forEach((st) => {
          if (st !== editingCursorState) {
            availableGuides.push({
              id: `hugeicon-${st}`,
              name: `Modèle Hugeicons : ${cursorMetadata[st]?.label}`,
              paths: getHugeIconGuidePaths(st),
              hotspot: getDefaultCursorHotspot(st),
              isCustom: false,
            });
          }
        });

        const activeGuide = availableGuides[0];

        return (
          <FullScreenDrawingModal
            title={`Dessiner le Curseur : ${cursorMetadata[editingCursorState]?.label}`}
            subtitle={`Référence Hugeicons : ${cursorMetadata[editingCursorState]?.refHugeIcon}`}
            currentEditingStateName={cursorMetadata[editingCursorState]?.label}
            initialPaths={settings.customCursorVectorPaths?.[editingCursorState] || []}
            initialHotspot={
              settings.customCursorHotspots?.[editingCursorState] ||
              getDefaultCursorHotspot(editingCursorState)
            }
            referenceGuide={activeGuide}
            availableReferenceGuides={availableGuides}
            isCursorMode={true}
            enableFlipbook={false}
            onSave={(paths, _dataUrl, _colliderType, _stateName, hotspot) => {
              if (paths && paths.length > 0) {
                const combinedD = paths.map((p) => p.d).join(' ');
                updateSettings({
                  cursorSourceMode: 'custom_drawn',
                  customCursorVectorPaths: {
                    ...(settings.customCursorVectorPaths || {}),
                    [editingCursorState]: paths,
                  },
                  customCursorPaths: {
                    ...(settings.customCursorPaths || {}),
                    [editingCursorState]: combinedD,
                  },
                  customCursorHotspots: hotspot
                    ? {
                        ...(settings.customCursorHotspots || {}),
                        [editingCursorState]: hotspot,
                      }
                    : settings.customCursorHotspots,
                });
              }
              setEditingCursorState(null);
            }}
            onClose={() => setEditingCursorState(null)}
          />
        );
      })()}

      {/* Header */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
            Paramètres du Studio
          </h3>
        </div>
        {importStatus && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            importStatus.type === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
          }`}>
            {importStatus.message}
          </span>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 1: FICHIERS & SAUVEGARDES (SLOTS) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-indigo-100 bg-indigo-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('files')}
          className="w-full p-3 flex items-center justify-between bg-indigo-100/50 hover:bg-indigo-100/80 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-indigo-950 uppercase tracking-wider">
            <FolderArchive className="w-4 h-4 text-indigo-600" />
            <span>1. Fichiers & Sauvegardes (Slots)</span>
          </div>
          {openSections.files ? <ChevronDown className="w-4 h-4 text-indigo-700" /> : <ChevronRight className="w-4 h-4 text-indigo-700" />}
        </button>

        {openSections.files && (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            {onOpenSlotsModal && (
              <button
                type="button"
                onClick={onOpenSlotsModal}
                className="w-full p-2.5 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm active:scale-[0.99]"
              >
                <FolderArchive className="w-4 h-4 text-indigo-200" />
                <span>Mes Projets & Sauvegardes Locales (Slots)</span>
              </button>
            )}

            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-indigo-100">
              <div>
                <div className="text-xs font-bold text-slate-800">Auto-Save brouillon local</div>
                <div className="text-[10px] text-slate-500 leading-snug">
                  Sauvegarde après 2,5 s d'inactivité en édition sans écraser vos slots
                </div>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ autoSaveEnabled: settings.autoSaveEnabled === false ? true : false })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center shrink-0 ${
                  settings.autoSaveEnabled !== false ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={handleExport}
                className="p-2.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                title="Exporter tout le projet au format JSON"
              >
                <Download className="w-3.5 h-3.5 text-indigo-600" /> Exporter JSON
              </button>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2.5 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs active:scale-98"
                title="Importer un fichier de projet JSON"
              >
                <Upload className="w-3.5 h-3.5 text-slate-600" /> Importer JSON
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleImportFile}
                className="hidden"
              />
            </div>

            <div className="grid grid-cols-2 gap-2 pt-1 border-t border-indigo-100">
              <button
                type="button"
                onClick={restoreDefaultScene}
                className="p-2 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-[11px] font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-500" /> Restaurer Démo
              </button>

              {onOpenClearModal && (
                <button
                  type="button"
                  onClick={onOpenClearModal}
                  className="p-2 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-[11px] font-bold text-rose-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" /> Nettoyer
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION : SCÈNES DE TEST (JIGGLE, JOINT PHYSIQUE & SUIVI CONTINU) */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-fuchsia-200/80 bg-fuchsia-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('testScenes')}
          className="w-full p-3 flex items-center justify-between bg-fuchsia-100/50 hover:bg-fuchsia-100/80 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-fuchsia-950 uppercase tracking-wider">
            <Sparkles className="w-4 h-4 text-fuchsia-600" />
            <span>Scènes de Test (Jiggle, Joint &amp; Drag)</span>
          </div>
          {openSections.testScenes ? (
            <ChevronDown className="w-4 h-4 text-fuchsia-700" />
          ) : (
            <ChevronRight className="w-4 h-4 text-fuchsia-700" />
          )}
        </button>

        {openSections.testScenes && (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            <p className="text-[10px] text-slate-600 leading-snug">
              Chargez un bac à sable pré-configuré (avec gizmos actifs) puis passez en mode{' '}
              <span className="font-bold text-slate-800">Play</span> pour tester en direct.
            </p>
            {PHYSICS_TEST_SCENE_DESCRIPTORS.map((preset) => (
              <div
                key={preset.id}
                className="p-2.5 bg-white rounded-xl border border-fuchsia-200/80 space-y-1.5 shadow-2xs"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-xs font-bold text-slate-900">{preset.title}</div>
                    <div className="text-[10px] text-slate-500 leading-snug">{preset.subtitle}</div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLoadTestScene(preset.id, preset.title)}
                    className="px-2.5 py-1 bg-fuchsia-600 hover:bg-fuchsia-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer shrink-0 shadow-2xs"
                  >
                    Charger
                  </button>
                </div>
                <ul className="space-y-0.5 text-[9.5px] text-slate-600 pl-2 border-l-2 border-fuchsia-200">
                  {preset.keyParams.map((kp, idx) => (
                    <li key={idx}>• {kp}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 2: CANVAS & SCÈNE */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-slate-200 bg-slate-50/60 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('canvas')}
          className="w-full p-3 flex items-center justify-between bg-slate-100 hover:bg-slate-200/60 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-slate-800 uppercase tracking-wider">
            <Tv className="w-4 h-4 text-indigo-600" />
            <span>2. Canvas & Scène</span>
          </div>
          {openSections.canvas ? <ChevronDown className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
        </button>

        {openSections.canvas && (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            {/* Format & Ratio */}
            <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-800 block">Format & Ratio</label>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-200 text-slate-700 rounded uppercase">
                  {settings.aspectRatio || 'free'}
                </span>
              </div>
              <div className="grid grid-cols-5 gap-1">
                {[
                  { id: '16:9', label: '16:9' },
                  { id: '4:3', label: '4:3' },
                  { id: '1:1', label: '1:1' },
                  { id: '9:16', label: '9:16' },
                  { id: 'free', label: 'Libre' },
                ].map((fmt) => {
                  const isSelected = (settings.aspectRatio || 'free') === fmt.id;
                  return (
                    <button
                      key={fmt.id}
                      type="button"
                      onClick={() => updateSettings({ aspectRatio: fmt.id as SceneAspectRatio })}
                      className={`py-1 text-center rounded-lg text-xs transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600 text-white font-bold shadow-xs'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                      }`}
                    >
                      {fmt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Étiquettes */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-800">Étiquettes Canvas</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showCanvasLabels: !settings.showCanvasLabels })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.showCanvasLabels ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Grille */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Grid className="w-4 h-4 text-slate-500" />
                <span className="text-xs font-bold text-slate-800">Grille de Repère</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showGrid: !settings.showGrid })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.showGrid ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {settings.showGrid && (
              <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase block">Style repère :</label>
                <div className="grid grid-cols-3 gap-1">
                  {[
                    { id: 'dots', label: 'Points' },
                    { id: 'lines', label: 'Lignes' },
                    { id: 'clean', label: 'Épuré' },
                  ].map((st) => (
                    <button
                      key={st.id}
                      type="button"
                      onClick={() => updateSettings({ gridStyle: st.id as any })}
                      className={`py-1 text-[11px] font-bold rounded-lg cursor-pointer text-center ${
                        settings.gridStyle === st.id
                          ? 'bg-slate-900 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {st.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Gizmo Debug Colliders */}
            {(() => {
              const isHitboxGizmoOn = gizmos.masterEnabled && gizmos.categories.hitboxes !== 'off';
              return (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Scan className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">Gizmo Debug Hitbox Vert</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSettings({ showColliderDebugGizmos: !isHitboxGizmoOn })}
                    className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                      isHitboxGizmoOn ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>
              );
            })()}

            {/* Tags System */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-600" />
                <span className="text-xs font-bold text-slate-800">Système de #Tags</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showTagsSystem: !settings.showTagsSystem })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.showTagsSystem ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Colored Onion Skin */}
            {(() => {
              const isColoredOnionOn = settings.coloredOnionSkin !== false;
              return (
                <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-200">
                  <div className="flex items-center gap-2">
                    <Paintbrush className="w-4 h-4 text-indigo-600" />
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-slate-800">Pelure d'oignon colorée</span>
                      <span className="text-[10px] text-slate-500">Sinon, silhouette grise en pointillés</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => updateSettings({ coloredOnionSkin: !isColoredOnionOn })}
                    className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center shrink-0 ${
                      isColoredOnionOn ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 3: GIZMOS & DEBUG VISUEL */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-cyan-200 bg-cyan-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('gizmos')}
          className="w-full p-3 flex items-center justify-between bg-cyan-100/60 hover:bg-cyan-100/90 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-cyan-950 uppercase tracking-wider">
            <Crosshair className="w-4 h-4 text-cyan-600" />
            <span>3. Gizmos & Debug Visuel</span>
          </div>
          {openSections.gizmos ? <ChevronDown className="w-4 h-4 text-cyan-700" /> : <ChevronRight className="w-4 h-4 text-cyan-700" />}
        </button>

        {openSections.gizmos && (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            {/* Master switch */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-cyan-200">
              <div>
                <div className="text-xs font-bold text-slate-800">Afficher les Gizmos sur la scène</div>
                <div className="text-[10px] text-slate-500">Interrupteur général (Édition & Jeu)</div>
              </div>
              <button
                type="button"
                onClick={() => updateGizmos({ masterEnabled: !gizmos.masterEnabled })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center shrink-0 ${
                  gizmos.masterEnabled ? 'bg-cyan-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Présets rapides */}
            <div className="p-2 bg-white rounded-xl border border-cyan-200 space-y-1.5">
              <div className="text-[10px] font-bold text-slate-500 uppercase">Présets rapides :</div>
              <div className="grid grid-cols-4 gap-1">
                {[
                  { id: 'both', label: 'Tout Les 2' },
                  { id: 'edit', label: 'Édit seul' },
                  { id: 'play', label: 'Play seul' },
                  { id: 'off', label: 'Tout Off' },
                ].map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setAllGizmosMode(preset.id as GizmoVisibilityMode)}
                    className="py-1 px-1 rounded-lg text-[10px] font-bold bg-slate-100 hover:bg-cyan-50 hover:text-cyan-800 text-slate-700 cursor-pointer transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Filtre objet sélectionné uniquement */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-cyan-200">
              <div>
                <div className="text-xs font-bold text-slate-800">Objet sélectionné uniquement</div>
                <div className="text-[10px] text-slate-500">N'affiche les gizmos d'entité que pour la sélection</div>
              </div>
              <button
                type="button"
                onClick={() => updateGizmos({ onlySelected: !gizmos.onlySelected })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center shrink-0 ${
                  gizmos.onlySelected ? 'bg-cyan-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Liste des 7 catégories de gizmos */}
            <div className="space-y-1.5">
              {GIZMO_CATEGORY_LIST.map((cat) => {
                const currentMode = gizmos.categories[cat.id] || 'off';
                return (
                  <div
                    key={cat.id}
                    className="p-2 bg-white rounded-xl border border-cyan-200/80 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cat.dotColor }}
                        />
                        <span className="text-xs font-bold text-slate-800 truncate">{cat.label}</span>
                      </div>
                    </div>
                    <div className="text-[10px] text-slate-400 leading-snug">{cat.description}</div>
                    <div className="grid grid-cols-4 gap-1 bg-slate-100 p-0.5 rounded-lg">
                      {(
                        [
                          { id: 'off', label: 'Off' },
                          { id: 'edit', label: 'Édit' },
                          { id: 'play', label: 'Play' },
                          { id: 'both', label: 'Les 2' },
                        ] as { id: GizmoVisibilityMode; label: string }[]
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setCategoryMode(cat.id, opt.id)}
                          className={`py-0.5 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                            currentMode === opt.id
                              ? opt.id === 'off'
                                ? 'bg-slate-600 text-white shadow-2xs'
                                : 'bg-cyan-600 text-white shadow-2xs'
                              : 'text-slate-600 hover:bg-white/70'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 4: RÈGLES & RULEBOOK */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('rules')}
          className="w-full p-3 flex items-center justify-between bg-amber-100/60 hover:bg-amber-100/90 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wider">
            <Zap className="w-4 h-4 text-amber-600 fill-amber-600" />
            <span>4. Règles & RuleBook</span>
          </div>
          {openSections.rules ? <ChevronDown className="w-4 h-4 text-amber-700" /> : <ChevronRight className="w-4 h-4 text-amber-700" />}
        </button>

        {openSections.rules && (
          <div className="p-3 space-y-2.5 animate-in fade-in duration-150">
            {/* Toggle Dossiers Thématiques */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
              <div>
                <label className="text-xs font-bold text-slate-800 block">Dossiers Thématiques</label>
                <span className="text-[10px] text-slate-500">Afficher la barre d'onglets dossiers</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showRuleFolders: settings.showRuleFolders === true ? false : true })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.showRuleFolders === true ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Select Mode Affichage Filtre Entité */}
            <div className="p-2.5 bg-white rounded-xl border border-amber-200 space-y-1.5">
              <label className="text-xs font-bold text-slate-800 block">
                Filtre d'Entités rapides (RuleBook)
              </label>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'icon_and_text', label: 'Icône + Texte' },
                  { id: 'icon_only', label: 'Icône seule' },
                  { id: 'text_only', label: 'Texte seul' },
                ].map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => updateSettings({ entityFilterDisplayMode: opt.id as any })}
                    className={`py-1 px-1.5 rounded-lg text-[10px] font-bold cursor-pointer text-center transition-all ${
                      (settings.entityFilterDisplayMode || 'icon_and_text') === opt.id
                        ? 'bg-amber-500 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Toggle Barre Filtres Avancés */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-amber-200">
              <div>
                <label className="text-xs font-bold text-slate-800 block">Barre de Filtres Avancés</label>
                <span className="text-[10px] text-slate-500">Filtrer par type de déclencheur</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ showRuleFilters: !settings.showRuleFilters })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.showRuleFilters ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 5: CURSEURS VECTORIELS DYNAMIQUES */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-purple-200 bg-purple-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('cursors')}
          className="w-full p-3 flex items-center justify-between bg-purple-100/60 hover:bg-purple-100/90 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-purple-950 uppercase tracking-wider">
            <MousePointer2 className="w-4 h-4 text-purple-600" />
            <span>5. Curseurs Vectoriels Dynamiques</span>
          </div>
          {openSections.cursors ? <ChevronDown className="w-4 h-4 text-purple-700" /> : <ChevronRight className="w-4 h-4 text-purple-700" />}
        </button>

        {openSections.cursors && (
          <div className="p-3 space-y-3 animate-in fade-in duration-150">
            <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-purple-200">
              <span className="text-xs font-bold text-slate-800">Utiliser Curseurs Vectoriels</span>
              <button
                type="button"
                onClick={() => updateSettings({ useCustomCursors: settings.useCustomCursors === false ? true : false })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.useCustomCursors !== false ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {settings.useCustomCursors !== false && (
              <>
                <div className="bg-white p-2 rounded-xl border border-purple-200 space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase block">Style d'icônes :</label>
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => updateSettings({ cursorSourceMode: 'hugeicons' })}
                      className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                        (settings.cursorSourceMode || 'hugeicons') === 'hugeicons'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      ⚡ Hugeicons
                    </button>
                    <button
                      type="button"
                      onClick={() => updateSettings({ cursorSourceMode: 'custom_drawn' })}
                      className={`py-1.5 text-xs font-bold rounded-lg cursor-pointer ${
                        settings.cursorSourceMode === 'custom_drawn'
                          ? 'bg-purple-600 text-white shadow-xs'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      🎨 Dessin Atelier
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between bg-white p-2.5 rounded-xl border border-purple-200">
                  <span className="text-xs font-semibold text-slate-700">Ombre Portée sous le curseur</span>
                  <button
                    type="button"
                    onClick={() => updateSettings({ cursorShadow: settings.cursorShadow === false ? true : false })}
                    className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                      settings.cursorShadow !== false ? 'bg-purple-600 justify-end' : 'bg-slate-300 justify-start'
                    }`}
                  >
                    <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleExportCursorPack}
                    className="flex-1 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3 h-3" /> Exporter Pack
                  </button>
                  <button
                    type="button"
                    onClick={() => cursorFileInputRef.current?.click()}
                    className="flex-1 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Upload className="w-3 h-3" /> Importer Pack
                  </button>
                </div>

                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold text-slate-500 uppercase block">États curseurs :</span>
                  <div className="space-y-1.5">
                    {(Object.keys(cursorMetadata) as CursorState[]).map((st) => {
                      const meta = cursorMetadata[st];
                      const customVecs = settings.customCursorVectorPaths?.[st];
                      const isCustom = !!customVecs && customVecs.length > 0;
                      return (
                        <div
                          key={st}
                          className="p-2 bg-white rounded-xl border border-purple-200/80 flex items-center justify-between text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded bg-slate-50 border border-slate-200 flex items-center justify-center p-1">
                              {renderCursorSvg(st, {
                                customVectorPaths: customVecs,
                                sourceMode: settings.cursorSourceMode || 'hugeicons',
                              })}
                            </div>
                            <span className="font-bold text-slate-800">{meta.label}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setEditingCursorState(st)}
                              className="px-2 py-1 bg-purple-100 hover:bg-purple-200 text-purple-800 text-[10px] font-bold rounded-lg cursor-pointer"
                            >
                              Dessiner
                            </button>
                            {isCustom && (
                              <button
                                type="button"
                                onClick={() => handleResetCursor(st)}
                                className="p-1 text-slate-400 hover:text-slate-700 cursor-pointer"
                              >
                                <Undo2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* ACCORDION CATEGORY 6: MODE PLAY & SYNTHÉTISEUR AUDIO */}
      {/* ========================================================================= */}
      <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 overflow-hidden transition-all shadow-2xs">
        <button
          type="button"
          onClick={() => toggleSection('play')}
          className="w-full p-3 flex items-center justify-between bg-emerald-100/60 hover:bg-emerald-100/90 transition-colors cursor-pointer text-left"
        >
          <div className="flex items-center gap-2 text-xs font-black text-emerald-950 uppercase tracking-wider">
            <Moon className="w-4 h-4 text-emerald-600" />
            <span>6. Mode Play & Présentation</span>
          </div>
          {openSections.play ? <ChevronDown className="w-4 h-4 text-emerald-700" /> : <ChevronRight className="w-4 h-4 text-emerald-700" />}
        </button>

        {openSections.play && (
          <div className="p-3 space-y-3 animate-in fade-in duration-150">
            {/* Assombrissement */}
            <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Assombrir en mode Play</span>
                <button
                  type="button"
                  onClick={() => updateSettings({ playModeOverlay: settings.playModeOverlay === false ? true : false })}
                  className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                    settings.playModeOverlay !== false ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                </button>
              </div>

              {settings.playModeOverlay !== false && (
                <div className="grid grid-cols-3 gap-1 pt-1">
                  {[
                    { id: 'light', label: 'Léger' },
                    { id: 'medium', label: 'Moyen' },
                    { id: 'dark', label: 'Intense' },
                  ].map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => updateSettings({ playModeDimOpacity: opt.id as any })}
                      className={`py-1 text-[10px] font-bold rounded-lg cursor-pointer text-center ${
                        (settings.playModeDimOpacity || 'medium') === opt.id
                          ? 'bg-emerald-600 text-white shadow-2xs'
                          : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Animation Hover */}
            <div className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-emerald-200">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-bold text-slate-800">Animation survol (Play)</span>
              </div>
              <button
                type="button"
                onClick={() => updateSettings({ enableHoverScaleAnimation: !settings.enableHoverScaleAnimation })}
                className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                  settings.enableHoverScaleAnimation ? 'bg-amber-500 justify-end' : 'bg-slate-300 justify-start'
                }`}
              >
                <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
              </button>
            </div>

            {/* Test Synthétiseur Sonore */}
            <div className="p-2.5 bg-white rounded-xl border border-emerald-200 space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                <Volume2 className="w-4 h-4 text-emerald-600" />
                <span>Test Synthétiseur Sonore</span>
              </div>
              <div className="grid grid-cols-3 gap-1">
                {[
                  { id: 'magic', label: '✨ Magic' },
                  { id: 'pop', label: '🎈 Pop' },
                  { id: 'bell', label: '🔔 Cloche' },
                  { id: 'bounce', label: '🏀 Rebond' },
                  { id: 'laser', label: '⚡ Laser' },
                  { id: 'win', label: '🏆 Win' },
                ].map((snd) => (
                  <button
                    key={snd.id}
                    type="button"
                    onClick={() => soundSynth.play(snd.id as any)}
                    className="py-1 text-[10px] font-semibold bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 rounded-lg transition-colors cursor-pointer"
                  >
                    {snd.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Modal de nommage du fichier d'export */}
      {exportModal &&
        createPortal(
          <div
            className="fixed inset-0 z-[10000] bg-slate-900/55 backdrop-blur-xs flex items-center justify-center p-4"
            onClick={() => setExportModal(null)}
          >
            <div
              className="bg-white rounded-3xl max-w-md w-full p-5 shadow-2xl border border-slate-200 space-y-4 animate-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center">
                    <Download className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">
                      {exportModal.kind === 'project'
                        ? 'Exporter le projet'
                        : 'Exporter le pack de curseurs'}
                    </h3>
                    <p className="text-[11px] text-slate-500">Choisissez le nom du fichier à télécharger</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setExportModal(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 rounded-xl hover:bg-slate-100 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 block">Nom du fichier</label>
                <div className="flex items-center bg-slate-50 border border-slate-300 focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-100 rounded-xl overflow-hidden">
                  <input
                    type="text"
                    autoFocus
                    value={exportModal.filename}
                    onChange={(e) => setExportModal({ ...exportModal, filename: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        executeConfirmExport();
                      } else if (e.key === 'Escape') {
                        setExportModal(null);
                      }
                    }}
                    placeholder="mon-projet"
                    className="flex-1 px-3 py-2 bg-transparent text-xs font-bold text-slate-800 outline-none"
                  />
                  <span className="px-3 py-2 text-xs font-mono font-bold text-slate-500 bg-slate-100 border-l border-slate-200">
                    .json
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setExportModal(null)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={executeConfirmExport}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black rounded-xl flex items-center gap-1.5 cursor-pointer shadow-sm"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Télécharger</span>
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
