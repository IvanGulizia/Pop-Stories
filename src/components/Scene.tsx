import { useSceneStore } from '../store/useSceneStore';
import { Apple } from './Apple';
import { Plant } from './Plant';
import { CustomShape } from './CustomShape';
import { Sparkles } from 'lucide-react';

interface SceneProps {
  onOpenCreateModal?: () => void;
}

export function Scene({ onOpenCreateModal }: SceneProps) {
  const entities = useSceneStore((state) => state.entities);
  const selectEntity = useSceneStore((state) => state.selectEntity);
  const addEntity = useSceneStore((state) => state.addEntity);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);
  const settings = useSceneStore((state) => state.settings);

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

  return (
    <div
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="relative w-full h-full min-h-[500px] bg-white rounded-3xl border-2 border-slate-200/90 overflow-hidden shadow-inner cursor-crosshair select-none flex flex-col"
      onClick={() => selectEntity(null)}
    >
      {/* Canvas Grid Background */}
      {settings.showGrid && settings.gridStyle !== 'clean' && (
        <div
          className="absolute inset-0 pointer-events-none transition-opacity duration-300"
          style={getGridStyle()}
        />
      )}

      {/* Empty State Overlay when no entities exist */}
      {Object.keys(entities).length === 0 && (
        <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center z-10 pointer-events-auto">
          <div className="w-16 h-16 bg-indigo-50 border border-indigo-100 rounded-3xl flex items-center justify-center text-3xl shadow-xs mb-4">
            🎨
          </div>
          <h3 className="text-lg font-bold text-slate-800 tracking-tight">
            Votre atelier vivant est vide
          </h3>
          <p className="text-xs text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
            Commencez par dessiner une forme vectorielle originale ou ajoutez un modèle de départ.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {onOpenCreateModal && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onOpenCreateModal();
                }}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-2xl shadow-md transition-all flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <Sparkles className="w-4 h-4" /> ✨ Dessiner un objet vectoriel
              </button>
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                addEntity('plant');
              }}
              className="px-3.5 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-2xl border border-slate-200 transition-colors cursor-pointer"
            >
              🌱 Ajouter une plante
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
