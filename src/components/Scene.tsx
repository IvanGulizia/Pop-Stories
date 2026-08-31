import { useSceneStore } from '../store/useSceneStore';
import { Apple } from './Apple';
import { Plant } from './Plant';
import { CustomShape } from './CustomShape';
import { Sparkles, Paintbrush, PlayCircle } from 'lucide-react';

interface SceneProps {
  onOpenCreateModal?: () => void;
}

export function Scene({ onOpenCreateModal }: SceneProps) {
  const entities = useSceneStore((state) => state.entities);
  const customArchetypes = useSceneStore((state) => state.customArchetypes || {});
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const restoreDefaultScene = useSceneStore((state) => state.restoreDefaultScene);
  const settings = useSceneStore((state) => state.settings);
  const appMode = useSceneStore((state) => state.appMode);

  const hasEntitiesOnCanvas = Object.keys(entities).length > 0;
  const hasArchetypesInCatalog = Object.keys(customArchetypes).length > 0;
  const isCompletelyEmptyProject = !hasEntitiesOnCanvas && !hasArchetypesInCatalog;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (!dataStr) return;
      const data = JSON.parse(dataStr);
      if (data.kind === 'entity-archetype' && data.entityType) {
        const rect = e.currentTarget.getBoundingClientRect();
        const dropX = Math.max(20, Math.min(rect.width - 80, e.clientX - rect.left - 40));
        const dropY = Math.max(20, Math.min(rect.height - 80, e.clientY - rect.top - 40));

        spawnEntity({
          type: data.entityType,
          position: { x: dropX, y: dropY },
        });
      }
    } catch (err) {
      console.error('Error handling drop on scene:', err);
    }
  };

  // Background pattern calculations
  const getGridStyle = () => {
    if (!settings.showGrid || settings.gridStyle === 'clean') return {};
    if (settings.gridStyle === 'lines') {
      return {
        backgroundImage: 'linear-gradient(to right, #cbd5e1 1px, transparent 1px), linear-gradient(to bottom, #cbd5e1 1px, transparent 1px)',
        backgroundSize: '24px 24px',
        opacity: 0.15,
      };
    }
    // 'dots'
    return {
      backgroundImage: 'radial-gradient(#334155 1.5px, transparent 1.5px)',
      backgroundSize: '24px 24px',
      opacity: 0.08,
    };
  };

  const isPlayMode = appMode === 'play';
  const isCustomCursorActive = isPlayMode && settings.useCustomCursors !== false;

  return (
    <div
      id="scene-canvas-container"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`relative w-full h-full min-h-[500px] bg-white overflow-hidden select-none flex flex-col ${
        isCustomCursorActive ? 'cursor-none [&_*]:cursor-none!' : 'cursor-crosshair'
      }`}
      onClick={() => selectEntity(null)}
    >
      {/* Canvas Grid Background */}
      {settings.showGrid && settings.gridStyle !== 'clean' && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={getGridStyle()}
        />
      )}

      {/* Empty State Overlay when no entities and no archetypes exist */}
      {isCompletelyEmptyProject && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto bg-slate-50/50 backdrop-blur-2xs">
          <div className="w-16 h-16 bg-white border border-slate-200 rounded-3xl flex items-center justify-center text-3xl shadow-sm mb-4 animate-in zoom-in-95 duration-200">
            🎨
          </div>
          <h3 className="text-xl font-bold text-slate-800 tracking-tight">
            Nouveau Projet Atelier Vivant
          </h3>
          <p className="text-xs text-slate-500 max-w-md mt-1.5 mb-6 leading-relaxed">
            Le canvas et vos règles sont vides. Choisissez comment démarrer votre projet :
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg w-full">
            {/* Option 1: Créer une Entité */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenCreateModal) onOpenCreateModal();
              }}
              className="p-5 bg-white hover:bg-indigo-50/40 border-2 border-slate-200 hover:border-indigo-500 rounded-3xl shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 text-indigo-600 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                  <Paintbrush className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">
                  Nouveau
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-indigo-950 flex items-center gap-1.5">
                  Créer une entité
                  <Sparkles className="w-3.5 h-3.5 text-indigo-500" />
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Ouvre l'atelier de dessin vectoriel pour concevoir votre premier objet et ses états.
                </div>
              </div>
            </button>

            {/* Option 2: Ouvrir la Scène Démo */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                restoreDefaultScene();
              }}
              className="p-5 bg-white hover:bg-emerald-50/40 border-2 border-slate-200 hover:border-emerald-500 rounded-3xl shadow-xs hover:shadow-md transition-all text-left flex flex-col justify-between gap-3 group cursor-pointer active:scale-[0.98]"
            >
              <div className="flex items-center justify-between">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                  <PlayCircle className="w-5 h-5" />
                </div>
                <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  Démo
                </span>
              </div>
              <div>
                <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-950">
                  Ouvrir la scène d'exemple
                </div>
                <div className="text-[11px] text-slate-500 mt-1 leading-snug">
                  Charge la scène interactive d'exemple (Plante magique, Pomme, règles Storyboard).
                </div>
              </div>
            </button>
          </div>
        </div>
      )}

      {/* Rendering Entities */}
      {Object.values(entities).map((entity) => {
        if (entity.type === 'plant') {
          return <Plant key={entity.id} entity={entity} />;
        }
        if (entity.type === 'apple') {
          return <Apple key={entity.id} entity={entity} />;
        }
        return <CustomShape key={entity.id} entity={entity} />;
      })}
    </div>
  );
}
