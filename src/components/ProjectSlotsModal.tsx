import { useState, useEffect } from 'react';
import { useSceneStore } from '../store/useSceneStore';
import { ProjectSlot, SceneAspectRatio } from '../types';
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
  Sparkles,
  Calendar,
  Layers,
  Zap,
  Plus,
  Tv,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface ProjectSlotsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProjectSlotsModal({ isOpen, onClose }: ProjectSlotsModalProps) {
  const getProjectSlots = useSceneStore((state) => state.getProjectSlots);
  const saveProjectToSlot = useSceneStore((state) => state.saveProjectToSlot);
  const loadProjectFromSlot = useSceneStore((state) => state.loadProjectFromSlot);
  const deleteProjectSlot = useSceneStore((state) => state.deleteProjectSlot);
  const duplicateProjectSlot = useSceneStore((state) => state.duplicateProjectSlot);
  const renameProjectSlot = useSceneStore((state) => state.renameProjectSlot);
  const currentSlotId = useSceneStore((state) => state.currentSlotId);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const clearProject = useSceneStore((state) => state.clearProject);

  const [slots, setSlots] = useState<ProjectSlot[]>([]);
  const [newSlotName, setNewSlotName] = useState('');
  const [editingSlotId, setEditingSlotId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [confirmingOverwriteId, setConfirmingOverwriteId] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const refreshSlots = () => {
    setSlots(getProjectSlots());
  };

  useEffect(() => {
    if (isOpen) {
      refreshSlots();
      setNewSlotName(`Mon Projet #${slots.length + 1}`);
    }
  }, [isOpen]);

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
      showNotice('success', res.message);
      setNewSlotName(`Mon Projet #${slots.length + 2}`);
      refreshSlots();
    } else {
      showNotice('error', res.message);
    }
  };

  const handleOverwrite = (slot: ProjectSlot) => {
    const res = saveProjectToSlot(slot.name, slot.id);
    if (res.success) {
      showNotice('success', res.message);
      setConfirmingOverwriteId(null);
      refreshSlots();
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
      }, 500);
    } else {
      showNotice('error', res.message);
    }
  };

  const handleDelete = (slot: ProjectSlot) => {
    const res = deleteProjectSlot(slot.id);
    if (res.success) {
      showNotice('success', res.message);
      setConfirmingDeleteId(null);
      refreshSlots();
    } else {
      showNotice('error', res.message);
    }
  };

  const handleDuplicate = (slot: ProjectSlot) => {
    const res = duplicateProjectSlot(slot.id);
    if (res.success) {
      showNotice('success', res.message);
      refreshSlots();
    } else {
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
      refreshSlots();
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

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-50 flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
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
                Enregistrez et basculez instantanément entre vos différents projets dans le navigateur
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
        <div className="p-4 sm:p-5 border-b border-slate-100 bg-white">
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
        </div>

        {/* LISTE DES SLOTS */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 min-h-[220px]">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <FolderArchive className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-700">Aucun slot enregistré</p>
              <p className="text-[11px] text-slate-400 max-w-sm mt-0.5 mb-3">
                Vous n'avez pas encore sauvegardé de projet dans votre navigateur. Donnez un nom ci-dessus et cliquez sur "Sauvegarder l'état actuel".
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
