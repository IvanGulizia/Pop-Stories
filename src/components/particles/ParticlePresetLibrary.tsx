import React, { useMemo, useState } from 'react';
import { BookmarkPlus, Check, FolderOpen, Globe, Sparkles, Trash2 } from 'lucide-react';
import { CustomParticlePreset, ParticleEffectConfig, ParticleEffectPreset } from '../../types';
import { EMPTY_LIST, EMPTY_RECORD, useSceneStore } from '../../store/useSceneStore';

export interface QuickParticlePresetItem {
  id: string;
  label: string;
  config: Partial<ParticleEffectConfig>;
}

interface ParticlePresetLibraryProps {
  mode: 'emitter' | 'burst';
  currentConfig: ParticleEffectConfig;
  quickPresets: QuickParticlePresetItem[];
  onApplyConfig: (patch: Partial<ParticleEffectConfig>) => void;
}

export function remapPresetConfigSprites(
  config: ParticleEffectConfig,
  embeddedSprites: CustomParticlePreset[] | undefined,
  importSprites: (sprites?: CustomParticlePreset[]) => Record<string, string>
): ParticleEffectConfig {
  const idMap = importSprites(embeddedSprites);
  const next: ParticleEffectConfig = JSON.parse(JSON.stringify(config));
  if (next.customParticleId && idMap[next.customParticleId]) {
    next.customParticleId = idMap[next.customParticleId];
  }
  if (Array.isArray(next.customParticleIds)) {
    next.customParticleIds = next.customParticleIds.map((id) => idMap[id] || id);
  }
  return next;
}

export const ParticlePresetLibrary: React.FC<ParticlePresetLibraryProps> = ({
  mode,
  currentConfig,
  quickPresets,
  onApplyConfig,
}) => {
  const projectPresets = useSceneStore((s) => s.projectParticlePresets || EMPTY_LIST);
  const localCollection = useSceneStore((s) => s.localParticleCollection || EMPTY_RECORD);
  const saveProjectParticlePreset = useSceneStore((s) => s.saveProjectParticlePreset);
  const deleteProjectParticlePreset = useSceneStore((s) => s.deleteProjectParticlePreset);
  const saveParticleToLocalCollection = useSceneStore((s) => s.saveParticleToLocalCollection);
  const deleteParticleFromLocalCollection = useSceneStore(
    (s) => s.deleteParticleFromLocalCollection
  );
  const importEmbeddedParticleSprites = useSceneStore((s) => s.importEmbeddedParticleSprites);

  const [activeTab, setActiveTab] = useState<'quick' | 'project' | 'global'>('quick');
  const [presetName, setPresetName] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);

  const globalList = useMemo(
    () =>
      Object.values(localCollection).sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      ),
    [localCollection]
  );

  const projectList = useMemo(
    () =>
      [...projectPresets].sort(
        (a, b) => (b.updatedAt || b.createdAt || 0) - (a.updatedAt || a.createdAt || 0)
      ),
    [projectPresets]
  );

  const showToast = (msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback((cur) => (cur === msg ? null : cur));
    }, 2200);
  };

  const handleApplySaved = (preset: ParticleEffectPreset) => {
    const mapped = remapPresetConfigSprites(
      preset.config,
      preset.embeddedCustomSprites,
      importEmbeddedParticleSprites
    );
    onApplyConfig(mapped);
    showToast(`Preset « ${preset.name} » appliqué`);
  };

  const handleSaveTo = (target: 'project' | 'global') => {
    const trimmed = presetName.trim() || `Particules ${new Date().toLocaleTimeString().slice(0, 5)}`;
    if (target === 'project') {
      saveProjectParticlePreset({ name: trimmed, config: currentConfig });
      setActiveTab('project');
      showToast(`Enregistré dans le projet`);
    } else {
      saveParticleToLocalCollection({ name: trimmed, config: currentConfig });
      setActiveTab('global');
      showToast(`Enregistré en collection inter-projets`);
    }
    setPresetName('');
  };

  const renderPresetCard = (preset: ParticleEffectPreset, scope: 'project' | 'global') => {
    const c1 = preset.config.color || '#f59e0b';
    const c2 = preset.config.colorMode === 'single' ? c1 : preset.config.color2 || c1;
    const countLabel =
      mode === 'emitter'
        ? `${preset.config.rate ?? 16}${preset.config.rateMax ? `–${preset.config.rateMax}` : ''}/s`
        : `${preset.config.count ?? 22}${preset.config.countMax ? `–${preset.config.countMax}` : ''}×`;
    return (
      <div
        key={preset.id}
        onClick={() => handleApplySaved(preset)}
        className="group relative p-2 bg-white hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 rounded-xl cursor-pointer transition-all flex items-center justify-between gap-2"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-4 h-4 rounded-full shrink-0 border border-black/10 shadow-2xs"
            style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
          />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-slate-800 truncate">{preset.name}</div>
            <div className="text-[9px] text-slate-500 font-medium truncate">
              {preset.config.shape} • {countLabel}
              {preset.config.emissionShape && preset.config.emissionShape !== 'point'
                ? ` • ${preset.config.emissionShape === 'circle' ? 'Disque' : 'Rect'}`
                : ''}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          {scope === 'project' ? (
            <button
              type="button"
              onClick={() => {
                saveParticleToLocalCollection({
                  name: preset.name,
                  config: preset.config,
                  embeddedCustomSprites: preset.embeddedCustomSprites,
                });
                showToast(`Copié vers collection globale`);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 cursor-pointer"
              title="Exporter vers la collection inter-projets"
            >
              <Globe className="w-3 h-3" />
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                saveProjectParticlePreset({
                  name: preset.name,
                  config: preset.config,
                  embeddedCustomSprites: preset.embeddedCustomSprites,
                });
                showToast(`Copié dans ce projet`);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 cursor-pointer"
              title="Copier dans le projet actif"
            >
              <FolderOpen className="w-3 h-3" />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              if (scope === 'project') deleteProjectParticlePreset(preset.id);
              else deleteParticleFromLocalCollection(preset.id);
            }}
            className="p-1 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
            title="Supprimer ce preset"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {/* Barre d'enregistrement rapide dans Projet ou Globale */}
      <div className="p-2 bg-white rounded-2xl border border-slate-200 space-y-1.5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <BookmarkPlus className="w-3 h-3 text-amber-500" />
            <span>Collection de particules</span>
          </span>
          {feedback && (
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded-lg flex items-center gap-1">
              <Check className="w-2.5 h-2.5" />
              {feedback}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Nom de la recette à enregistrer..."
            className="flex-1 min-w-0 bg-slate-50 border border-slate-300 rounded-xl px-2.5 py-1 text-xs font-medium text-slate-800 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => handleSaveTo('project')}
            className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-[10px] font-extrabold cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
            title="Enregistrer dans ce projet"
          >
            <FolderOpen className="w-3 h-3" />
            <span>Projet</span>
          </button>
          <button
            type="button"
            onClick={() => handleSaveTo('global')}
            className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-extrabold cursor-pointer shrink-0 flex items-center gap-1 shadow-2xs"
            title="Enregistrer dans votre collection inter-projets"
          >
            <Globe className="w-3 h-3" />
            <span>Globale</span>
          </button>
        </div>
      </div>

      {/* Onglets */}
      <div className="grid grid-cols-3 gap-1 bg-slate-200/70 p-1 rounded-xl text-[10px] font-extrabold">
        <button
          type="button"
          onClick={() => setActiveTab('quick')}
          className={`py-1 px-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
            activeTab === 'quick' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-600'
          }`}
        >
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Présets ({quickPresets.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('project')}
          className={`py-1 px-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
            activeTab === 'project' ? 'bg-white text-amber-800 shadow-2xs' : 'text-slate-600'
          }`}
        >
          <FolderOpen className="w-3 h-3 text-amber-500" />
          <span>Projet ({projectList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('global')}
          className={`py-1 px-2 rounded-lg cursor-pointer transition-all flex items-center justify-center gap-1 ${
            activeTab === 'global' ? 'bg-white text-indigo-800 shadow-2xs' : 'text-slate-600'
          }`}
        >
          <Globe className="w-3 h-3 text-indigo-500" />
          <span>Globale ({globalList.length})</span>
        </button>
      </div>

      {/* Contenu */}
      {activeTab === 'quick' && (
        <div className="grid grid-cols-3 gap-1.5">
          {quickPresets.map((preset) => {
            const c1 = preset.config.color || '#f59e0b';
            const c2 = preset.config.colorMode === 'single' ? c1 : preset.config.color2 || c1;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyConfig(preset.config)}
                className="px-2 py-1.5 bg-white hover:bg-amber-50 border border-slate-200 hover:border-amber-300 rounded-xl text-[11px] font-bold text-slate-700 transition-all cursor-pointer flex items-center gap-1.5 truncate"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0 border border-black/10"
                  style={{ background: `linear-gradient(135deg, ${c1}, ${c2})` }}
                />
                <span className="truncate">{preset.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {activeTab === 'project' && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
          {projectList.length === 0 ? (
            <div className="text-[11px] text-slate-500 bg-white/80 border border-slate-200 rounded-xl p-2.5 text-center">
              Aucun effet enregistré dans ce projet. Nommez-le ci-dessus puis cliquez sur <strong>Projet</strong>.
            </div>
          ) : (
            projectList.map((p) => renderPresetCard(p, 'project'))
          )}
        </div>
      )}

      {activeTab === 'global' && (
        <div className="max-h-36 overflow-y-auto space-y-1.5 pr-0.5">
          {globalList.length === 0 ? (
            <div className="text-[11px] text-slate-500 bg-white/80 border border-slate-200 rounded-xl p-2.5 text-center">
              Collection inter-projets vide. Cliquez sur <strong>Globale</strong> pour partager vos effets entre tous vos projets.
            </div>
          ) : (
            globalList.map((p) => renderPresetCard(p, 'global'))
          )}
        </div>
      )}
    </div>
  );
};
