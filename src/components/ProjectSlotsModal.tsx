import { useState, useEffect, useMemo } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { ProjectSlot, SceneAspectRatio } from '../types';
import { QUOTA_TIER_OPTIONS_MB, estimateJsonBytes } from '../utils/localStorageDB';
import {
  FolderArchive,
  Save,
  Trash2,
  Copy,
  Edit2,
  Check,
  X,
  Play,
  RotateCcw,
  Calendar,
  Layers,
  Zap,
  Plus,
  CheckCircle2,
  AlertCircle,
  HardDrive,
} from 'lucide-react';

interface ProjectSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type PendingQuotaAction =
  | { kind: 'create'; name: string }
  | { kind: 'overwrite'; slot: ProjectSlot }
  | { kind: 'duplicate'; slotId: string };

function formatBytesLabel(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 Ko';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} Go`;
}

export function ProjectSlotsModal({ isOpen, onClose }: ProjectSlotsModalProps) {
  const projectSlots = useSceneStore((state) => state.projectSlots);
  const saveProjectToSlot = useSceneStore((state) => state.saveProjectToSlot);
  const loadProjectFromSlot = useSceneStore((state) => state.loadProjectFromSlot);
  const deleteProjectSlot = useSceneStore((state) => state.deleteProjectSlot);
  const duplicateProjectSlot = useSceneStore((state) => state.duplicateProjectSlot);
  const renameProjectSlot = useSceneStore((state) => state.renameProjectSlot);
  const currentSlotId = useSceneStore((state) => state.currentSlotId);
  const quotaLimitMb = useSceneStore((state) => state.quotaLimitMb);
  const setQuotaLimitMb = useSceneStore((state) => state.setQuotaLimitMb);
  const getStorageStats = useSceneStore((state) => state.getStorageStats);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const clearProject = useSceneStore((state) => state.clearProject);
  const autoSaveDraft = useSceneStore((state) => state.autoSaveDraft);
  const restoreAutoSaveDraft = useSceneStore((state) => state.restoreAutoSaveDraft);
  const discardAutoSaveDraft = useSceneStore((state) => state.discardAutoSaveDraft);

  const slots = useMemo(
    () => [...projectSlots].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [projectSlots]
  );

  const slotSizes = useMemo(() => {
    const map: Record<string, number> = {};
    for (const s of slots) {
      map[s.id] = s.sizeBytes ?? estimateJsonBytes(s.data || s);
    }
    return map;
  }, [slots]);

  const currentProjectBytes = useMemo(() => {
    if (!isOpen) return 0;
    return estimateJsonBytes(useSceneStore.getState().exportProject());
  }, [isOpen, projectSlots.length]);

  const [newSlotName, setNewSlotName] = useState('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingOverwriteId, setConfirmingOverwriteId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [quotaAlert, setQuotaAlert] = useState<{ message: string; pending: PendingQuotaAction } | null>(null);
  const [storageStats, setStorageStats] = useState<{
    slotsBytes: number;
    collectionBytes: number;
    totalAppBytes: number;
    quotaMb: number;
    browserUsageBytes?: number;
    browserQuotaBytes?: number;
  } | null>(null);

  const refreshStats = () => {
    getStorageStats()
      .then((res) => setStorageStats(res))
      .catch(() => {});
  };

  useEffect(() => {
    if (isOpen) {
      refreshStats();
      setNewSlotName((prev) => (prev.trim() ? prev : `Mon Projet #${slots.length + 1}`));
    } else {
      setQuotaAlert(null);
    }
  }, [isOpen, projectSlots.length, quotaLimitMb]);

  if (!isOpen) return null;

  const showNotice = (type: 'success' | 'error', message: string) => {
    setFeedback({ type, message });
    setTimeout(() => setFeedback(null), 3500);
  };

  const handleCreateNewSave = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSlotName.trim() || `Projet #${slots.length + 1}`;
    const res = saveProjectToSlot(name);
    if (res.success) {
      setQuotaAlert(null);
      showNotice('success', res.message);
      setNewSlotName(`Mon Projet #${slots.length + 2}`);
      refreshStats();
    } else if (res.quotaExceeded) {
      setQuotaAlert({
        message: res.message,
        pending: { kind: 'create', name },
      });
    } else {
      showNotice('error', res.message);
    }
  };

  const handleOverwrite = (slot: ProjectSlot) => {
    const res = saveProjectToSlot(slot.name, slot.id);
    if (res.success) {
      setQuotaAlert(null);
      showNotice('success', res.message);
      setConfirmingOverwriteId(null);
      refreshStats();
    } else if (res.quotaExceeded) {
      setConfirmingOverwriteId(null);
      setQuotaAlert({
        message: res.message,
        pending: { kind: 'overwrite', slot },
      });
    } else {
      showNotice('error', res.message);
    }
  };

  const handleLoad = (slot: ProjectSlot) => {
    const res = loadProjectFromSlot(slot.id);
    if (res.success) {
      showNotice('success', res.message);
      setTimeout(() => {
        onClose();
      }, 450);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleDelete = (slot: ProjectSlot) => {
    const res = deleteProjectSlot(slot.id);
    if (res.success) {
      setQuotaAlert(null);
      showNotice('success', res.message);
      setConfirmingDeleteId(null);
      refreshStats();
    } else {
      showNotice('error', res.message);
    }
  };

  const handleDuplicate = (slot: ProjectSlot) => {
    const res = duplicateProjectSlot(slot.id);
    if (res.success) {
      setQuotaAlert(null);
      showNotice('success', res.message);
      refreshStats();
    } else if (res.quotaExceeded) {
      setQuotaAlert({
        message: res.message,
        pending: { kind: 'duplicate', slotId: slot.id },
      });
    } else {
      showNotice('error', res.message);
    }
  };

  const handleUpgradeQuotaAndRetry = (newQuotaMb: number) => {
    setQuotaLimitMb(newQuotaMb);
    if (!quotaAlert) {
      refreshStats();
      return;
    }
    const { pending } = quotaAlert;
    let res: { success: boolean; message: string; quotaExceeded?: boolean } | null = null;
    if (pending.kind === 'create') {
      res = saveProjectToSlot(pending.name);
      if (res.success) setNewSlotName(`Mon Projet #${slots.length + 2}`);
    } else if (pending.kind === 'overwrite') {
      res = saveProjectToSlot(pending.slot.name, pending.slot.id);
    } else if (pending.kind === 'duplicate') {
      res = duplicateProjectSlot(pending.slotId);
    }
    if (res?.success) {
      setQuotaAlert(null);
      showNotice('success', `Limite relevée (${newQuotaMb === 0 ? 'Illimité' : `${newQuotaMb} Mo`}) — ${res.message}`);
      refreshStats();
    } else if (res?.quotaExceeded) {
      setQuotaAlert({ message: res.message, pending });
    } else if (res) {
      showNotice('error', res.message);
    }
  };

  const startRename = (slot: ProjectSlot) => {
    setEditingSlotId(slot.id);
    setEditingName(slot.name);
  };

  const saveRename = (slotId: string) => {
    const res = renameProjectSlot(slotId, editingName);
    if (res.success) {
      showNotice('success', res.message);
      setEditingSlotId(null);
    } else {
      showNotice('error', res.message);
    }
  };

  const formatAspectRatioBadge = (ratio?: SceneAspectRatio) => {
    switch (ratio) {
      case '16:9': return '16:9 🖥️';
      case '4:3': return '4:3 📺';
      case '1:1': return '1:1 ⏹️';
      case '9:16': return '9:16 📱';
      default: return 'Libre ↔️';
    }
  };

  const usedBytes = storageStats?.totalAppBytes ?? estimateJsonBytes(slots);
  const limitBytes = quotaLimitMb > 0 ? quotaLimitMb * 1024 * 1024 : null;
  const usagePct = limitBytes ? Math.min(100, Math.round((usedBytes / limitBytes) * 100)) : 0;

  return (
    <div
      data-modal-open="true"
      className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
    >
      <div className="bg-white rounded-3xl border border-slate-200/90 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* HEADER */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center">
              <FolderArchive className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                Sauvegardes Locales (Slots)
                <span className="text-xs font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                  {slots.length} {slots.length > 1 ? 'slots' : 'slot'}
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Stockage 100 % local sur votre machine (IndexedDB navigateur — aucun serveur/cloud)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* JAUGE DE STOCKAGE LOCAL & QUOTA */}
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/40 flex flex-col gap-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2 text-slate-700 font-semibold">
              <HardDrive className="w-3.5 h-3.5 text-indigo-500" />
              <span>
                Utilisé : <strong className="font-mono text-slate-900">{formatBytesLabel(usedBytes)}</strong>
                {quotaLimitMb > 0 ? (
                  <> / <strong className="font-mono text-indigo-700">{quotaLimitMb} Mo</strong></>
                ) : (
                  <> <span className="text-emerald-700 font-bold">(Quota interne illimité)</span></>
                )}
              </span>
              {storageStats?.browserQuotaBytes ? (
                <span className="text-[10px] text-slate-400 font-medium hidden sm:inline">
                  • Plafond disque navigateur : ~{formatBytesLabel(storageStats.browserQuotaBytes)}
                </span>
              ) : null}
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-slate-500">Limite locale :</span>
              <select
                value={quotaLimitMb}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  setQuotaLimitMb(val);
                  refreshStats();
                }}
                className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-[11px] font-bold text-slate-800 cursor-pointer"
              >
                {QUOTA_TIER_OPTIONS_MB.map((tier) => (
                  <option key={tier} value={tier}>
                    {tier === 0 ? 'Illimité (limite disque)' : tier >= 1000 ? `${tier / 1000} Go` : `${tier} Mo`}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {quotaLimitMb > 0 && (
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  usagePct >= 90 ? 'bg-rose-500' : usagePct >= 70 ? 'bg-amber-500' : 'bg-indigo-500'
                }`}
                style={{ width: `${usagePct}%` }}
              />
            </div>
          )}
        </div>

        {/* ALERTE QUOTA DEPASSE AVEC OPTIONS D'EXTENSION */}
        {quotaAlert && (
          <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-amber-50 border border-amber-300 space-y-2.5 animate-in fade-in duration-150">
            <div className="flex items-start gap-2 text-xs font-bold text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <div>{quotaAlert.message}</div>
                <div className="text-[11px] font-medium text-amber-800 mt-0.5">
                  Vous pouvez augmenter le quota ci-dessous (reprise automatique de la sauvegarde) ou supprimer d'anciens slots.
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {[100, 250, 500, 0]
                .filter((tier) => tier === 0 || tier > quotaLimitMb)
                .map((tier) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => handleUpgradeQuotaAndRetry(tier)}
                    className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[11px] font-bold cursor-pointer shadow-2xs transition-all"
                  >
                    {tier === 0 ? 'Passer en Illimité' : `Passer à ${tier} Mo`}
                  </button>
                ))}
              <button
                type="button"
                onClick={() => setQuotaAlert(null)}
                className="px-2.5 py-1 bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-xl text-[11px] font-semibold cursor-pointer"
              >
                Fermer
              </button>
            </div>
          </div>
        )}

        {/* FEEDBACK NOTICE */}
        {feedback && (
          <div className={`mx-5 mt-4 p-3 rounded-2xl flex items-center gap-2 text-xs font-bold transition-all ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
              : 'bg-rose-50 text-rose-800 border border-rose-200'
          }`}>
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* NOUVELLE SAUVEGARDE FORM */}
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white space-y-2">
          <form onSubmit={handleCreateNewSave} className="flex gap-2">
            <input
              type="text"
              value={newSlotName}
              onChange={(e) => setNewSlotName(e.target.value)}
              placeholder="Nom de la nouvelle sauvegarde (ex: Jeu de plateformes, Tamagotchi...)"
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-slate-50/50 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
            <button
              type="submit"
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs active:scale-98 shrink-0"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Sauvegarder l'état actuel</span>
            </button>
          </form>
          <div className="flex items-center justify-between text-[11px] text-slate-500 px-1">
            <span>
              Poids du projet actuel :{' '}
              <strong className="font-mono text-slate-700">{formatBytesLabel(currentProjectBytes)}</strong>
            </span>
            <span className="text-[10px] text-slate-400">
              Auto-Save local sur brouillon séparé (n'écrase aucun slot)
            </span>
          </div>
        </div>

        {/* LISTE DES SLOTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[220px]">
          {/* CARTE BROUILLON AUTO-SAVE (OPTION A) */}
          {autoSaveDraft && (
            <div className="p-3.5 rounded-2xl border border-emerald-200 bg-emerald-50/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 bg-emerald-600 text-white rounded-full">
                    Brouillon Auto-Save
                  </span>
                  {autoSaveDraft.sourceSlotName && (
                    <span className="text-xs font-bold text-emerald-950 truncate">
                      ({autoSaveDraft.sourceSlotName})
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2 text-[11px] text-emerald-900/80">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3 text-emerald-600" />
                    {new Date(autoSaveDraft.updatedAt).toLocaleDateString('fr-FR', {
                      day: 'numeric',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  <span>•</span>
                  <span>
                    {autoSaveDraft.entitiesCount} {autoSaveDraft.entitiesCount > 1 ? 'entités' : 'entité'}
                  </span>
                  <span>•</span>
                  <span>
                    {autoSaveDraft.rulesCount} {autoSaveDraft.rulesCount > 1 ? 'règles' : 'règle'}
                  </span>
                  <span>•</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatBytesLabel(autoSaveDraft.sizeBytes)}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  onClick={() => {
                    const res = restoreAutoSaveDraft();
                    if (res.success) {
                      showNotice('success', res.message);
                      setTimeout(() => onClose(), 400);
                    } else {
                      showNotice('error', res.message);
                    }
                  }}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Restaurer</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    discardAutoSaveDraft();
                    showNotice('success', 'Brouillon Auto-Save supprimé.');
                  }}
                  className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-emerald-200 hover:border-rose-200 rounded-xl text-xs cursor-pointer"
                  title="Supprimer le brouillon Auto-Save"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FolderArchive className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Aucun slot enregistré</p>
              <p className="text-[11px] text-slate-400 max-w-sm mt-0.5 mb-3">
                Vous n'avez pas encore sauvegardé de projet sur votre machine. Donnez un nom ci-dessus et cliquez sur "Sauvegarder l'état actuel".
              </p>
            </div>
          ) : (
            slots.map((slot) => {
              const isCurrent = currentSlotId === slot.id;
              const isEditing = editingSlotId === slot.id;
              const updatedDate = new Date(slot.updatedAt).toLocaleDateString('fr-FR', {
                day: 'numeric',
                month: 'short',
                hour: '2-digit',
                minute: '2-digit',
              });

              return (
                <div
                  key={slot.id}
                  className={`p-3.5 rounded-2xl border transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 ${
                    isCurrent
                      ? 'bg-indigo-50/50 border-indigo-300 ring-2 ring-indigo-500/20'
                      : 'bg-white hover:bg-slate-50/80 border-slate-200'
                  }`}
                >
                  {/* Slot Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {isEditing ? (
                        <div className="flex items-center gap-1 flex-1 max-w-md">
                          <input
                            type="text"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            className="px-2 py-1 text-xs font-bold rounded-lg border border-indigo-400 bg-white focus:outline-none w-full"
                            autoFocus
                          />
                          <button
                            onClick={() => saveRename(slot.id)}
                            className="p-1 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 cursor-pointer"
                            title="Valider"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingSlotId(null)}
                            className="p-1 text-slate-500 hover:bg-slate-200 rounded-lg cursor-pointer"
                            title="Annuler"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <h4 className="text-sm font-bold text-slate-800 truncate">
                            {slot.name}
                          </h4>
                          {isCurrent && (
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full">
                              Projet Actif
                            </span>
                          )}
                          <button
                            onClick={() => startRename(slot)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                            title="Renommer ce slot"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                        </>
                      )}
                    </div>

                    {/* Metadata tags */}
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-slate-400" />
                        {updatedDate}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        {slot.entitiesCount} {slot.entitiesCount > 1 ? 'entités' : 'entité'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-medium text-slate-600">
                        <Zap className="w-3 h-3 text-amber-500 fill-amber-500" />
                        {slot.rulesCount} {slot.rulesCount > 1 ? 'règles' : 'règle'}
                      </span>
                      <span>•</span>
                      <span className="flex items-center gap-1 font-mono font-bold text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded border border-slate-200">
                        <HardDrive className="w-3 h-3 text-indigo-500" />
                        {formatBytesLabel(slotSizes[slot.id] ?? 0)}
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 bg-slate-100 text-slate-600 rounded text-[10px] font-semibold border border-slate-200">
                        {formatAspectRatioBadge(slot.aspectRatio)}
                      </span>
                    </div>
                  </div>

                  {/* Actions buttons */}
                  <div className="flex items-center gap-1.5 shrink-0 self-end sm:self-center">
                    <button
                      onClick={() => handleLoad(slot)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-xs active:scale-98"
                      title="Charger ce projet dans le studio"
                    >
                      <Play className="w-3 h-3 fill-white" />
                      <span>Charger</span>
                    </button>

                    {confirmingOverwriteId === slot.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOverwrite(slot)}
                          className="px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs animate-in zoom-in-95 flex items-center gap-1"
                          title="Confirmer l'écrasement de cette sauvegarde"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Confirmer ?</span>
                        </button>
                        <button
                          onClick={() => setConfirmingOverwriteId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                          title="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingOverwriteId(slot.id)}
                        className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 hover:border-indigo-300 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 cursor-pointer"
                        title="Écraser ce slot avec l'état actuel de votre projet"
                      >
                        <Save className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Écraser</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleDuplicate(slot)}
                      className="p-1.5 bg-white hover:bg-slate-100 text-slate-600 border border-slate-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                      title="Dupliquer ce slot"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>

                    {confirmingDeleteId === slot.id ? (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleDelete(slot)}
                          className="px-2.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs animate-in zoom-in-95 flex items-center gap-1"
                          title="Confirmer la suppression"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Supprimer ?</span>
                        </button>
                        <button
                          onClick={() => setConfirmingDeleteId(null)}
                          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl cursor-pointer"
                          title="Annuler"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmingDeleteId(slot.id)}
                        className="p-1.5 bg-white hover:bg-rose-50 text-rose-600 border border-slate-200 hover:border-rose-200 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
                        title="Supprimer ce slot"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* FOOTER ACTIONS */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/80 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                clearProject();
                onClose();
              }}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-slate-500" />
              <span>Nouveau Projet Vierge</span>
            </button>

            <button
              onClick={() => {
                restoreDefaultScene();
                onClose();
              }}
              className="px-3 py-1.5 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Restaurer Démo</span>
            </button>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
}
