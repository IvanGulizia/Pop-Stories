import { useSceneStore } from '../store/useSceneStore';
import { Sliders, Eye, Grid, Tag, Trash2, RotateCcw, Volume2, Download, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { soundSynth } from '../utils/sound';
import { useRef, useState } from 'react';

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
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  return (
    <div className="space-y-4 text-slate-800">
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
