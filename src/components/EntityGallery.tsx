import { useSceneStore } from '../store/useSceneStore';
import { EntityMiniPreview } from './EntityMiniPreview';
import { Plus, Sparkles, Box, GripVertical } from 'lucide-react';
import { EntityType } from '../types';

interface EntityGalleryProps {
  onOpenCreateModal: () => void;
}

interface ArchetypeItem {
  type: EntityType;
  name: string;
  defaultStateId?: string;
  statesCount: number;
}

export function EntityGallery({ onOpenCreateModal }: EntityGalleryProps) {
  const entities = useSceneStore((state) => state.entities);
  const addEntity = useSceneStore((state) => state.addEntity);
  const spawnEntity = useSceneStore((state) => state.spawnEntity);

  const entityList = Object.values(entities);

  // Build unique catalog of available objects (base objects + any custom created ones)
  const catalog: ArchetypeItem[] = [
    {
      type: 'plant',
      name: 'Plante',
      statesCount: 2,
    },
    {
      type: 'apple',
      name: 'Pomme',
      statesCount: 2,
    },
    {
      type: 'custom',
      name: 'Étoile',
      statesCount: 2,
    },
  ];

  // Include custom types from the scene or drawings
  entityList.forEach((e) => {
    if (
      e.type !== 'plant' &&
      e.type !== 'apple' &&
      e.type !== 'custom' &&
      !catalog.some((item) => item.type === e.type)
    ) {
      catalog.push({
        type: e.type,
        name: e.name,
        statesCount: Object.keys(e.states || {}).length || 1,
      });
    }
  });

  const handleDragStart = (e: React.DragEvent, item: ArchetypeItem) => {
    const dragData = {
      kind: 'entity-archetype',
      entityType: item.type,
      name: item.name,
    };
    e.dataTransfer.setData('application/json', JSON.stringify(dragData));
    e.dataTransfer.setData('text/plain', item.type);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleSpawn = (item: ArchetypeItem) => {
    if (item.type === 'plant' || item.type === 'apple' || item.type === 'custom') {
      addEntity(item.type);
    } else {
      spawnEntity({
        type: item.type,
        position: { x: 200 + Math.random() * 80, y: 200 + Math.random() * 80 },
      });
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 text-slate-800">
      {/* 1. CREATION CARD AT THE VERY TOP */}
      <button
        onClick={onOpenCreateModal}
        className="w-full p-3.5 bg-slate-900 hover:bg-slate-800 active:scale-[0.98] text-white rounded-2xl shadow-xs transition-all flex flex-col items-center justify-center gap-2 cursor-pointer border border-slate-700/50 group"
      >
        <div className="w-9 h-9 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center transition-colors">
          <Plus className="w-5 h-5 text-white" strokeWidth={2.5} />
        </div>
        <div className="text-center">
          <div className="text-xs font-bold tracking-wide">Créer une Entité</div>
          <div className="text-[10px] text-slate-300 font-normal">Dessiner un objet vectoriel</div>
        </div>
      </button>

      {/* 2. CATALOGUE D'OBJETS DISPONIBLES */}
      <div className="flex-1 flex flex-col min-h-0 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Catalogue d'Objets ({catalog.length})
          </span>
          <span className="text-[10px] text-slate-400">Glisser ou placer</span>
        </div>

        <div className="space-y-2 overflow-y-auto flex-1 pr-1">
          {catalog.map((item) => {
            const representativeEntity = entityList.find((e) => e.type === item.type);

            return (
              <div
                key={item.type}
                draggable
                onDragStart={(e) => handleDragStart(e, item)}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200/90 hover:border-slate-300 rounded-2xl flex items-center justify-between shadow-2xs gap-2.5 transition-all cursor-grab active:cursor-grabbing group"
                title="Glissez cet objet sur le Canvas ou sur une case de règle Storyboard"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="text-slate-300 group-hover:text-slate-500 transition-colors">
                    <GripVertical className="w-3.5 h-3.5" />
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center p-1 overflow-hidden shrink-0 border border-slate-200/70">
                    <EntityMiniPreview entity={representativeEntity} type={item.type} size={32} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-800 truncate">{item.name}</p>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {item.statesCount} {item.statesCount > 1 ? 'états' : 'état'}
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleSpawn(item)}
                  className="px-2.5 py-1.5 text-[11px] font-bold bg-slate-100 hover:bg-slate-900 hover:text-white text-slate-700 rounded-xl transition-all cursor-pointer shrink-0 shadow-2xs"
                  title="Placer sur le canvas"
                >
                  + Placer
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
