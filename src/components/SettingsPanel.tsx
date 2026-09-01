import { useSceneStore } from '../store/useSceneStore';
import { Sliders, Eye, Grid, Tag, Trash2, RotateCcw, Volume2, Download, Upload, CheckCircle2, AlertCircle, Filter, MousePointer2, Paintbrush, Undo2, Scan } from 'lucide-react';
import { soundSynth } from '../utils/sound';
import { useRef, useState } from 'react';
import { CursorState, cursorMetadata, renderCursorSvg, getHugeIconGuidePaths, getDefaultCursorHotspot } from '../utils/cursorIcons';
import { FullScreenDrawingModal } from './FullScreenDrawingModal';
import { ReferenceGuideOption } from './DrawingCanvas';

interface SettingsPanelProps {
  onOpenClearModal?: () => void;
}

export function SettingsPanel({ onOpenClearModal }: SettingsPanelProps) {
  const settings = useSceneStore((state) => state.settings);
  const updateSettings = useSceneStore((state) => state.updateSettings);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const exportProject = useSceneStore((state) => state.exportProject);
  const importProject = useSceneStore((state) => state.importProject);

  const [importStatus, setImportStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [editingCursorState, setEditingCursorState] = useState<CursorState | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cursorFileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = () => {
    try {
      const data = exportProject();
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `atelier-vivant-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setImportStatus({ type: 'success', message: 'Projet exporté avec succès !' });
      setTimeout(() => setImportStatus(null), 3500);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: 'Erreur lors de l’exportation.' });
    }
  };

  const handleExportCursorPack = () => {
    try {
      const packData = {
        type: 'vector_cursor_pack' as const,
        version: 1,
        name: 'Pack Curseur Atelier',
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
      link.download = `pack-curseurs-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      setImportStatus({ type: 'success', message: 'Pack de curseurs exporté avec succès !' });
      setTimeout(() => setImportStatus(null), 3500);
    } catch (err: any) {
      setImportStatus({ type: 'error', message: 'Erreur lors de l’exportation du pack de curseurs.' });
    }
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
      } catch (err: any) {
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
      } catch (err: any) {
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
    <div className="space-y-4 text-slate-800">
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

        // 1. Modèle Hugeicon officiel pour l'état en cours
        availableGuides.push({
          id: `hugeicon-${editingCursorState}`,
          name: `Modèle Hugeicons (${cursorMetadata[editingCursorState]?.label})`,
          paths: getHugeIconGuidePaths(editingCursorState),
          hotspot: getDefaultCursorHotspot(editingCursorState),
          isCustom: false,
        });

        // 2. Autres états de curseur personnalisés déjà dessinés par l'utilisateur
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

        // 3. Autres modèles Hugeicons
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

      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
        <Sliders className="w-4 h-4 text-slate-600" />
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
          Paramètres du Studio
        </h3>
      </div>

      {/* Import / Export Feedback */}
      {importStatus && (
        <div
          className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
            importStatus.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
        >
          {importStatus.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{importStatus.message}</span>
        </div>
      )}

      {/* Toggle Labels */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Eye className="w-4 h-4 text-slate-500" />
          <div>
            <label className="text-xs font-bold text-slate-800 block">Étiquettes Canvas</label>
            <span className="text-[10px] text-slate-500">Nom & état sur la scène</span>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ showCanvasLabels: !settings.showCanvasLabels })}
          className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
            settings.showCanvasLabels ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
        </button>
      </div>

      {/* Toggle Grid */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Grid className="w-4 h-4 text-slate-500" />
          <div>
            <label className="text-xs font-bold text-slate-800 block">Grille de Repère</label>
            <span className="text-[10px] text-slate-500">Motif de fond</span>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ showGrid: !settings.showGrid })}
          className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
            settings.showGrid ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
        </button>
      </div>

      {/* Grid Style */}
      {settings.showGrid && (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1.5">
          <label className="text-[11px] font-bold text-slate-700 block">Style du repère</label>
          <div className="grid grid-cols-3 gap-1.5">
            {[
              { id: 'dots', label: 'Points' },
              { id: 'lines', label: 'Lignes' },
              { id: 'clean', label: 'Épuré' },
            ].map((st) => (
              <button
                key={st.id}
                onClick={() => updateSettings({ gridStyle: st.id as any })}
                className={`py-1.5 px-2 text-[11px] font-bold rounded-lg transition-colors cursor-pointer text-center ${
                  settings.gridStyle === st.id
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {st.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Toggle Tags System */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Tag className="w-3.5 h-3.5 text-purple-600" />
          <div>
            <label className="text-xs font-bold text-slate-800 block">Système de #Tags</label>
            <span className="text-[10px] text-slate-500">Filtrage & règles par tags</span>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ showTagsSystem: !settings.showTagsSystem })}
          className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
            settings.showTagsSystem ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
        </button>
      </div>

      {/* Toggle RuleBook Filters */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Filter className="w-3.5 h-3.5 text-indigo-600" />
          <div>
            <label className="text-xs font-bold text-slate-800 block">Filtres du Livre de Règles</label>
            <span className="text-[10px] text-slate-500">Filtrer par objet et par type d'événement</span>
          </div>
        </div>
        <button
          onClick={() => updateSettings({ showRuleFilters: !settings.showRuleFilters })}
          className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
            settings.showRuleFilters ? 'bg-slate-900 justify-end' : 'bg-slate-300 justify-start'
          }`}
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
        </button>
      </div>

      {/* Toggle Gizmo Debug des Colliders */}
      <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200/80">
        <div className="flex items-center gap-2.5">
          <Scan className="w-3.5 h-3.5 text-emerald-600" />
          <div>
            <label className="text-xs font-bold text-slate-800 block">Gizmo Debug des Colliders</label>
            <span className="text-[10px] text-slate-500">Affiche la zone verte de collision en direct</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => updateSettings({ showColliderDebugGizmos: !settings.showColliderDebugGizmos })}
          className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
            settings.showColliderDebugGizmos ? 'bg-emerald-600 justify-end' : 'bg-slate-300 justify-start'
          }`}
          title="Afficher/Masquer le contour vert de hitbox des entités en jeu et en édition"
        >
          <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
        </button>
      </div>

      {/* CURSEURS PERSONNALISÉS & PACK HUGEICONS */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MousePointer2 className="w-4 h-4 text-indigo-600" />
            <div>
              <label className="text-xs font-bold text-slate-800 block">Curseurs Dynamiques (Mode Jeu)</label>
              <span className="text-[10px] text-slate-500">Pack Hugeicons & Personnalisation</span>
            </div>
          </div>
          <button
            onClick={() => updateSettings({ useCustomCursors: settings.useCustomCursors === false ? true : false })}
            className={`w-9 h-5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
              settings.useCustomCursors !== false ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
            }`}
            title="Activer/Désactiver les curseurs vectoriels dynamiques en mode jeu"
          >
            <div className="w-4 h-4 bg-white rounded-full shadow-xs" />
          </button>
        </div>

        {settings.useCustomCursors !== false && (
          <div className="space-y-3 pt-1">
            {/* SWITCH / SELECTEUR DE SOURCE : HUGEICONS VS DESSINS PERSONNALISÉS */}
            <div className="space-y-1.5 bg-white p-2 rounded-xl border border-slate-200 shadow-2xs">
              <label className="text-[10px] font-bold text-slate-600 uppercase tracking-wider block">
                Style des icônes du curseur
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  onClick={() => updateSettings({ cursorSourceMode: 'hugeicons' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    (settings.cursorSourceMode || 'hugeicons') === 'hugeicons'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>⚡ Pack Hugeicons</span>
                </button>
                <button
                  type="button"
                  onClick={() => updateSettings({ cursorSourceMode: 'custom_drawn' })}
                  className={`py-1.5 px-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                    settings.cursorSourceMode === 'custom_drawn'
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>🎨 Dessin Atelier</span>
                </button>
              </div>
            </div>

            {/* CURSOR SHADOW & PACK ACTIONS */}
            <div className="bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div>
                  <label className="text-xs font-semibold text-slate-700 block">Effet d'ombre portée</label>
                  <span className="text-[10px] text-slate-400">Ajoute un relief immersif sous le curseur</span>
                </div>
                <button
                  type="button"
                  onClick={() => updateSettings({ cursorShadow: settings.cursorShadow === false ? true : false })}
                  className={`w-8 h-4.5 rounded-full transition-colors p-0.5 cursor-pointer flex items-center ${
                    settings.cursorShadow !== false ? 'bg-indigo-600 justify-end' : 'bg-slate-300 justify-start'
                  }`}
                  title="Activer ou désactiver l'ombre portée sous le curseur"
                >
                  <div className="w-3.5 h-3.5 bg-white rounded-full shadow-xs" />
                </button>
              </div>

              <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCursorPack}
                  className="flex-1 py-1.5 px-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Exporter les dessins et configurations de ce pack de curseurs"
                >
                  <Download className="w-3 h-3 text-slate-500" />
                  <span>Exporter le Pack</span>
                </button>
                <button
                  type="button"
                  onClick={() => cursorFileInputRef.current?.click()}
                  className="flex-1 py-1.5 px-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  title="Importer un pack de curseurs JSON"
                >
                  <Upload className="w-3 h-3 text-indigo-600" />
                  <span>Importer un Pack</span>
                </button>
              </div>
            </div>

            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              États du curseur ({Object.keys(cursorMetadata).length})
            </span>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(cursorMetadata) as CursorState[]).map((st) => {
                const meta = cursorMetadata[st];
                const customVecs = settings.customCursorVectorPaths?.[st];
                const isCustom = !!customVecs && customVecs.length > 0;
                const activeSourceMode = settings.cursorSourceMode || 'hugeicons';

                return (
                  <div
                    key={st}
                    className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2 shadow-2xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-lg bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0 p-1.5">
                        {renderCursorSvg(st, {
                          customVectorPaths: customVecs,
                          sourceMode: activeSourceMode,
                        })}
                      </div>
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate flex items-center gap-1.5">
                          {meta.label}
                          {isCustom && (
                            <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">
                              Dessiné
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate">
                          Ref : <span className="font-semibold text-slate-600">{meta.refHugeIcon}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => setEditingCursorState(st)}
                        className="p-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Dessiner ce curseur dans l'atelier vectoriel"
                      >
                        <Paintbrush className="w-3 h-3" />
                        <span className="text-[10px] font-bold">Dessiner</span>
                      </button>

                      {isCustom && (
                        <button
                          onClick={() => handleResetCursor(st)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Restaurer l'icône d'origine Hugeicon"
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
        )}
      </div>

      {/* Audio Synth Preview (light test) */}
      <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-slate-600" />
          <label className="text-xs font-bold text-slate-800">Test Synthétiseur Sonore</label>
        </div>
        <div className="grid grid-cols-3 gap-1.5">
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
              onClick={() => soundSynth.play(snd.id as any)}
              className="py-1 text-[10px] font-semibold bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              {snd.label}
            </button>
          ))}
        </div>
      </div>

      {/* Scene Maintenance & Import / Export */}
      <div className="pt-2 space-y-2.5">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block px-1">
          Import / Export & Sauvegarde
        </span>

        {/* Export & Import Buttons */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleExport}
            className="p-2.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl text-xs font-bold text-indigo-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="Exporter tout le projet au format JSON"
          >
            <Download className="w-3.5 h-3.5" /> Exporter JSON
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
            title="Importer un fichier de projet JSON"
          >
            <Upload className="w-3.5 h-3.5" /> Importer JSON
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </div>

        <button
          onClick={restoreDefaultScene}
          className="w-full p-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Restaurer Scène de Démo
        </button>

        {onOpenClearModal && (
          <button
            onClick={onOpenClearModal}
            className="w-full p-2.5 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl text-xs font-bold text-rose-700 transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" /> Nettoyer Scène / Projet
          </button>
        )}
      </div>
    </div>
  );
}
