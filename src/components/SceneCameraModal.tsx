import React from 'react';
import {
  Camera,
  Maximize2,
  Crosshair,
  ZoomIn,
  RotateCcw,
  X,
  Compass,
  Lock,
} from 'lucide-react';
import { useSceneStore } from '../store/useSceneStore';
import { CameraFollowAxis, CameraFollowMode } from '../types';
import { DEFAULT_SCENE_CAMERA_CONFIG } from '../utils/cameraSolver';

interface SceneCameraModalProps {
  onClose: () => void;
}

const WORLD_PRESETS = [
  { label: 'Horiz. 2400×600', width: 2400, height: 600 },
  { label: 'Monde 2000×1200', width: 2000, height: 1200 },
  { label: 'Tour 900×2000', width: 900, height: 2000 },
  { label: 'Long 3200×800', width: 3200, height: 800 },
];

export function SceneCameraModal({ onClose }: SceneCameraModalProps) {
  const camera = useSceneStore((s) => s.camera || DEFAULT_SCENE_CAMERA_CONFIG);
  const updateSceneCamera = useSceneStore((s) => s.updateSceneCamera);
  const sceneBounds = useSceneStore((s) => s.sceneBounds);
  const entities = useSceneStore((s) => s.entities);
  const scenes = useSceneStore((s) => s.scenes);
  const activeSceneId = useSceneStore((s) => s.activeSceneId);

  const activeSceneName = scenes.find((s) => s.id === activeSceneId)?.name || 'Scène active';
  const entityList = Object.values(entities);
  const uniqueTypes = Array.from(new Set(entityList.map((e) => e.type))).filter(Boolean);

  return (
    <div
      data-modal-open="true"
      className="fixed inset-0 bg-slate-900/45 backdrop-blur-xs z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-50/90 border-b border-slate-200 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-sky-100 text-sky-700 rounded-xl">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Caméra & Monde — {activeSceneName}
              </h3>
              <p className="text-[11px] text-slate-500">
                Dimensions du niveau, suivi de cible, zoom Play et limites de caméra
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => updateSceneCamera({ ...DEFAULT_SCENE_CAMERA_CONFIG })}
              className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold text-slate-600 hover:text-slate-900 bg-white border border-slate-200 hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
              title="Réinitialiser la configuration caméra de cette scène"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Défaut</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 rounded-xl cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {/* 1. Taille du monde */}
          <section className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
                <Maximize2 className="w-3.5 h-3.5 text-sky-600" />
                Espace du Monde (Niveau)
              </span>
              <span className="text-[10px] font-mono font-bold text-slate-500 bg-white px-2 py-0.5 rounded-lg border border-slate-200">
                Viewport : {sceneBounds.width}×{sceneBounds.height}px
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => updateSceneCamera({ worldMode: 'viewport' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  camera.worldMode === 'viewport'
                    ? 'bg-sky-50 border-sky-400 text-sky-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs">Écran Fixe (Viewport)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Le monde correspond exactement au cadre visible ({sceneBounds.width}×{sceneBounds.height}).
                </div>
              </button>

              <button
                type="button"
                onClick={() => updateSceneCamera({ worldMode: 'custom' })}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                  camera.worldMode === 'custom'
                    ? 'bg-sky-50 border-sky-400 text-sky-950 shadow-2xs'
                    : 'bg-white border-slate-200 text-slate-600 hover:border-slate-300'
                }`}
              >
                <div className="font-bold text-xs">Monde Étendu (Scrolling)</div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Grand niveau scrollable avec caméra mobile et parallaxe.
                </div>
              </button>
            </div>

            {camera.worldMode === 'custom' && (
              <div className="pt-2 space-y-3 border-t border-slate-200/80">
                <div className="flex flex-wrap gap-1.5">
                  {WORLD_PRESETS.map((preset) => {
                    const isActive =
                      camera.worldWidth === preset.width && camera.worldHeight === preset.height;
                    return (
                      <button
                        key={preset.label}
                        type="button"
                        onClick={() =>
                          updateSceneCamera({
                            worldWidth: preset.width,
                            worldHeight: preset.height,
                          })
                        }
                        className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-sky-600 text-white border-sky-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-sky-300'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Largeur du monde (px)
                    </label>
                    <input
                      type="number"
                      min={200}
                      max={10000}
                      step={50}
                      value={camera.worldWidth ?? 1600}
                      onChange={(e) =>
                        updateSceneCamera({
                          worldWidth: Math.max(200, Math.min(10000, Number(e.target.value) || 1600)),
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Hauteur du monde (px)
                    </label>
                    <input
                      type="number"
                      min={200}
                      max={10000}
                      step={50}
                      value={camera.worldHeight ?? 900}
                      onChange={(e) =>
                        updateSceneCamera({
                          worldHeight: Math.max(200, Math.min(10000, Number(e.target.value) || 900)),
                        })
                      }
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono font-bold text-slate-800 outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={camera.showWorldBoundsInEdit !== false}
                    onChange={(e) => updateSceneCamera({ showWorldBoundsInEdit: e.target.checked })}
                    className="rounded accent-sky-600"
                  />
                  <span>Afficher les limites du monde & l'aperçu caméra en mode Édition</span>
                </label>
              </div>
            )}
          </section>

          {/* 2. Suivi automatique */}
          <section className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <Crosshair className="w-3.5 h-3.5 text-indigo-600" />
              Suivi de Cible (Mode Play)
            </span>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {(
                [
                  { id: 'none', label: 'Aucun (Fixe)' },
                  { id: 'entity', label: 'Entité précise' },
                  { id: 'type', label: 'Par Type' },
                  { id: 'tag', label: 'Par Tag #' },
                ] as { id: CameraFollowMode; label: string }[]
              ).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => updateSceneCamera({ followMode: m.id })}
                  className={`px-2.5 py-2 rounded-xl text-[11px] font-bold border cursor-pointer transition-all ${
                    camera.followMode === m.id
                      ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>

            {camera.followMode === 'entity' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Entité à suivre
                </label>
                <select
                  value={camera.followEntityId || ''}
                  onChange={(e) => updateSceneCamera({ followEntityId: e.target.value || undefined })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">-- Choisir une entité --</option>
                  {entityList.map((ent) => (
                    <option key={ent.id} value={ent.id}>
                      {ent.name} ({ent.type})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {camera.followMode === 'type' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Type d'entité à suivre
                </label>
                <select
                  value={camera.followEntityType || ''}
                  onChange={(e) =>
                    updateSceneCamera({ followEntityType: e.target.value || undefined })
                  }
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300"
                >
                  <option value="">-- Choisir un type --</option>
                  {uniqueTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {camera.followMode === 'tag' && (
              <div>
                <label className="block text-[10px] font-bold text-slate-600 mb-1">
                  Tag de l'entité à suivre
                </label>
                <input
                  type="text"
                  value={camera.followTag || ''}
                  onChange={(e) => updateSceneCamera({ followTag: e.target.value })}
                  placeholder="ex: joueur"
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            )}

            {camera.followMode !== 'none' && (
              <div className="space-y-3 pt-2 border-t border-slate-200/80">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-600 shrink-0">Axes :</span>
                  {(
                    [
                      { id: 'both', label: 'Libre (X & Y)' },
                      { id: 'horizontal', label: 'Horizontal (X)' },
                      { id: 'vertical', label: 'Vertical (Y)' },
                    ] as { id: CameraFollowAxis; label: string }[]
                  ).map((ax) => (
                    <button
                      key={ax.id}
                      type="button"
                      onClick={() => updateSceneCamera({ followAxis: ax.id })}
                      className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border cursor-pointer ${
                        (camera.followAxis || 'both') === ax.id
                          ? 'bg-indigo-100 text-indigo-800 border-indigo-300'
                          : 'bg-white text-slate-600 border-slate-200'
                      }`}
                    >
                      {ax.label}
                    </button>
                  ))}
                </div>

                <div>
                  <div className="flex items-center justify-between text-[10px] font-bold text-slate-600 mb-1">
                    <span>Fluidité / Lissage (Smoothing)</span>
                    <span className="font-mono text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                      {(camera.followSmoothing ?? 0.14) >= 0.99
                        ? 'Instantané'
                        : `${Math.round((camera.followSmoothing ?? 0.14) * 100)}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.03}
                    max={1}
                    step={0.01}
                    value={camera.followSmoothing ?? 0.14}
                    onChange={(e) =>
                      updateSceneCamera({ followSmoothing: parseFloat(e.target.value) })
                    }
                    className="w-full accent-indigo-600 cursor-pointer h-1.5"
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Zone morte X
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      step={10}
                      value={camera.deadzoneX ?? 0}
                      onChange={(e) =>
                        updateSceneCamera({ deadzoneX: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Zone morte Y
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={600}
                      step={10}
                      value={camera.deadzoneY ?? 0}
                      onChange={(e) =>
                        updateSceneCamera({ deadzoneY: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Décalage X
                    </label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      step={10}
                      value={camera.offsetX ?? 0}
                      onChange={(e) =>
                        updateSceneCamera({ offsetX: Number(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-600 mb-1">
                      Décalage Y
                    </label>
                    <input
                      type="number"
                      min={-500}
                      max={500}
                      step={10}
                      value={camera.offsetY ?? 0}
                      onChange={(e) =>
                        updateSceneCamera({ offsetY: Number(e.target.value) || 0 })
                      }
                      className="w-full px-2 py-1 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* 3. Zoom & Position Initiale */}
          <section className="p-4 bg-slate-50 border border-slate-200/90 rounded-2xl space-y-3">
            <span className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-1.5">
              <ZoomIn className="w-3.5 h-3.5 text-emerald-600" />
              Zoom & Position de Départ (Play)
            </span>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-700">
                <span>Zoom initial en Play</span>
                <span className="font-mono text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                  {Math.round((camera.zoom ?? 1) * 100)}% ({(camera.zoom ?? 1).toFixed(2)}×)
                </span>
              </div>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={camera.zoom ?? 1}
                onChange={(e) => updateSceneCamera({ zoom: parseFloat(e.target.value) })}
                className="w-full accent-emerald-600 cursor-pointer h-1.5"
              />
              <div className="flex flex-wrap gap-1">
                {[0.5, 0.75, 1, 1.25, 1.5, 2].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => updateSceneCamera({ zoom: z })}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border cursor-pointer ${
                      Math.abs((camera.zoom ?? 1) - z) < 0.02
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-300'
                    }`}
                  >
                    {z}×
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <label className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-slate-400" />
                  Caméra X initiale (px)
                </label>
                <input
                  type="number"
                  step={20}
                  value={camera.initialX ?? 0}
                  onChange={(e) => updateSceneCamera({ initialX: Number(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-600 mb-1 flex items-center gap-1">
                  <Compass className="w-3 h-3 text-slate-400" />
                  Caméra Y initiale (px)
                </label>
                <input
                  type="number"
                  step={20}
                  value={camera.initialY ?? 0}
                  onChange={(e) => updateSceneCamera({ initialY: Number(e.target.value) || 0 })}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl font-mono text-slate-800"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-700 cursor-pointer pt-1">
              <input
                type="checkbox"
                checked={camera.clampToWorld !== false}
                onChange={(e) => updateSceneCamera({ clampToWorld: e.target.checked })}
                className="rounded accent-emerald-600"
              />
              <Lock className="w-3.5 h-3.5 text-slate-500" />
              <span>Bloquer la caméra à l'intérieur du monde (éviter les bords vides)</span>
            </label>
          </section>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
          >
            Terminer
          </button>
        </div>
      </div>
    </div>
  );
}
