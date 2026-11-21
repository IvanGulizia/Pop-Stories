import React from 'react';
import { Check } from 'lucide-react';
import { CameraFollowMode, Entity, EntityType, RuleAction } from '../../types';
import { EntityOption } from './ruleBookTypes';
import { EditableNumericValue } from '../shared/EditableNumericValue';

export interface CameraActionDraft {
  cameraCommand?: 'shake' | 'zoom' | 'follow' | 'move_to' | 'reset';
  cameraShakeIntensity?: number;
  cameraShakeDuration?: number;
  cameraZoom?: number;
  cameraDuration?: number;
  cameraFollowMode?: CameraFollowMode;
  cameraTargetMode?: 'subject' | 'target' | 'entity' | 'type' | 'tag' | 'last_spawned';
  cameraTargetId?: string;
  cameraTargetType?: EntityType;
  cameraTargetTag?: string;
  cameraPosition?: { x: number; y: number };
  cameraMoveTargetKind?: 'position' | 'entity';
}

interface CameraActionEditorProps {
  draft: CameraActionDraft;
  onPatch: (patch: Partial<CameraActionDraft>) => void;
  onConfirm: (actionData: Omit<RuleAction, 'id'>) => void;
  isRelational: boolean;
  isGlobal?: boolean;
  entities: Record<string, Entity>;
  availableEntityOptions: EntityOption[];
  allProjectTags: string[];
}

export const CameraActionEditor: React.FC<CameraActionEditorProps> = ({
  draft,
  onPatch,
  onConfirm,
  isRelational,
  isGlobal = false,
  entities,
  availableEntityOptions,
  allProjectTags,
}) => {
  const cmd = draft.cameraCommand || 'shake';
  const shakeIntensity = draft.cameraShakeIntensity ?? 12;
  const shakeDuration = draft.cameraShakeDuration ?? 0.35;
  const zoom = draft.cameraZoom ?? 1.4;
  const duration = draft.cameraDuration ?? 0.45;
  const followMode = draft.cameraFollowMode || 'entity';
  const targetMode = draft.cameraTargetMode || (isGlobal ? 'entity' : 'subject');
  const moveTargetKind =
    draft.cameraMoveTargetKind || (draft.cameraPosition ? 'position' : 'entity');

  const entityList = Object.values(entities);
  const firstEntityId = entityList[0]?.id || '';
  const firstEntityType = availableEntityOptions[0]?.type || '';

  const handleConfirm = () => {
    if (cmd === 'shake') {
      onConfirm({
        type: 'camera_action',
        cameraCommand: 'shake',
        cameraShakeIntensity: shakeIntensity,
        cameraShakeDuration: shakeDuration,
      });
      return;
    }
    if (cmd === 'zoom') {
      onConfirm({
        type: 'camera_action',
        cameraCommand: 'zoom',
        cameraZoom: zoom,
        cameraDuration: duration,
      });
      return;
    }
    if (cmd === 'follow') {
      const resolvedTargetMode =
        followMode === 'none'
          ? undefined
          : followMode === 'type'
          ? 'type'
          : followMode === 'tag'
          ? 'tag'
          : targetMode;
      onConfirm({
        type: 'camera_action',
        cameraCommand: 'follow',
        cameraFollowMode: followMode,
        cameraTargetMode: resolvedTargetMode,
        cameraTargetId:
          followMode === 'entity' && targetMode === 'entity'
            ? draft.cameraTargetId || firstEntityId
            : undefined,
        cameraTargetType:
          followMode === 'type' ? draft.cameraTargetType || firstEntityType : undefined,
        cameraTargetTag:
          followMode === 'tag' ? (draft.cameraTargetTag || '').trim().replace(/^#/, '') : undefined,
      });
      return;
    }
    if (cmd === 'move_to') {
      if (moveTargetKind === 'position') {
        onConfirm({
          type: 'camera_action',
          cameraCommand: 'move_to',
          cameraPosition: {
            x: draft.cameraPosition?.x ?? 0,
            y: draft.cameraPosition?.y ?? 0,
          },
          cameraDuration: duration,
        });
      } else {
        onConfirm({
          type: 'camera_action',
          cameraCommand: 'move_to',
          cameraPosition: undefined,
          cameraTargetMode: targetMode === 'type' || targetMode === 'tag' ? 'entity' : targetMode,
          cameraTargetId:
            targetMode === 'entity' ? draft.cameraTargetId || firstEntityId : undefined,
          cameraDuration: duration,
        });
      }
      return;
    }
    onConfirm({
      type: 'camera_action',
      cameraCommand: 'reset',
      cameraDuration: duration,
    });
  };

  return (
    <div className="space-y-4 max-w-lg mx-auto py-2">
      <div className="text-center space-y-1">
        <div className="w-12 h-12 bg-cyan-100 text-cyan-700 rounded-2xl flex items-center justify-center text-2xl mx-auto shadow-xs">
          🎥
        </div>
        <h4 className="text-sm font-black text-slate-800">Caméra &amp; Effets</h4>
        <p className="text-xs text-slate-500">
          Secouez l'écran, zoomez, suivez un objet ou déplacez la caméra pendant le jeu.
        </p>
      </div>

      {/* Sélecteur de commande caméra */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
        {(
          [
            { id: 'shake', label: '💥 Secousse' },
            { id: 'zoom', label: '🔍 Zoom' },
            { id: 'follow', label: '🎯 Suivre' },
            { id: 'move_to', label: '📍 Aller à' },
            { id: 'reset', label: '🔄 Reset' },
          ] as const
        ).map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onPatch({ cameraCommand: item.id })}
            className={`py-2 px-2 rounded-xl text-[11px] font-black border transition-all cursor-pointer ${
              cmd === item.id
                ? 'bg-cyan-600 text-white border-cyan-700 shadow-2xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-200">
        {cmd === 'shake' && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: 'Léger', intensity: 6, duration: 0.2 },
                { label: 'Moyen', intensity: 14, duration: 0.35 },
                { label: 'Fort (Impact)', intensity: 28, duration: 0.55 },
              ].map((p) => (
                <button
                  key={p.label}
                  type="button"
                  onClick={() =>
                    onPatch({
                      cameraShakeIntensity: p.intensity,
                      cameraShakeDuration: p.duration,
                    })
                  }
                  className="px-2.5 py-1 text-[11px] font-bold bg-white hover:bg-cyan-50 text-slate-700 border border-slate-200 rounded-xl cursor-pointer"
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Intensité (amplitude) :</label>
                <EditableNumericValue
                  value={shakeIntensity}
                  unit="px"
                  precision={1}
                  onChange={(v) => onPatch({ cameraShakeIntensity: v })}
                  className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min={1}
                max={50}
                step={1}
                value={Math.max(1, Math.min(50, shakeIntensity))}
                onChange={(e) =>
                  onPatch({ cameraShakeIntensity: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Durée :</label>
                <EditableNumericValue
                  value={shakeDuration}
                  unit="s"
                  precision={2}
                  onChange={(v) => onPatch({ cameraShakeDuration: v })}
                  className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min={0.05}
                max={3}
                step={0.05}
                value={Math.max(0.05, Math.min(3, shakeDuration))}
                onChange={(e) =>
                  onPatch({ cameraShakeDuration: parseFloat(e.target.value) })
                }
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>
          </>
        )}

        {cmd === 'zoom' && (
          <>
            <div className="flex flex-wrap gap-1.5">
              {[0.5, 0.75, 1, 1.5, 2, 2.5].map((z) => (
                <button
                  key={z}
                  type="button"
                  onClick={() => onPatch({ cameraZoom: z })}
                  className={`px-2.5 py-1 text-[11px] font-bold border rounded-xl cursor-pointer ${
                    Math.abs(zoom - z) < 0.02
                      ? 'bg-cyan-600 text-white border-cyan-700'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-cyan-50'
                  }`}
                >
                  {z}×
                </button>
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Facteur de zoom :</label>
                <EditableNumericValue
                  value={zoom}
                  unit="×"
                  precision={2}
                  onChange={(v) => onPatch({ cameraZoom: v })}
                  className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min={0.25}
                max={3}
                step={0.05}
                value={Math.max(0.25, Math.min(3, zoom))}
                onChange={(e) => onPatch({ cameraZoom: parseFloat(e.target.value) })}
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Durée de transition :</label>
                <EditableNumericValue
                  value={duration}
                  unit="s"
                  precision={2}
                  onChange={(v) => onPatch({ cameraDuration: v })}
                  className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.05}
                value={Math.max(0, Math.min(5, duration))}
                onChange={(e) => onPatch({ cameraDuration: parseFloat(e.target.value) })}
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>
          </>
        )}

        {cmd === 'follow' && (
          <>
            <div>
              <label className="text-xs font-bold text-slate-700 block mb-1">Mode de suivi :</label>
              <select
                value={followMode}
                onChange={(e) =>
                  onPatch({ cameraFollowMode: e.target.value as CameraFollowMode })
                }
                className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
              >
                <option value="entity">Suivre une entité / sujet</option>
                <option value="type">Suivre un type d'objet</option>
                <option value="tag">Suivre un #tag</option>
                <option value="none">Arrêter de suivre (Caméra libre)</option>
              </select>
            </div>

            {followMode === 'entity' && (
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 block">Cible à suivre :</label>
                <select
                  value={targetMode}
                  onChange={(e) => onPatch({ cameraTargetMode: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                >
                  {!isGlobal && <option value="subject">Sujet déclencheur</option>}
                  {isRelational && <option value="target">Cible touchée</option>}
                  <option value="last_spawned">Dernier objet créé</option>
                  <option value="entity">Entité précise de la scène</option>
                </select>
                {targetMode === 'entity' && (
                  <select
                    value={draft.cameraTargetId || firstEntityId}
                    onChange={(e) => onPatch({ cameraTargetId: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  >
                    {entityList.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {followMode === 'type' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Type suivi :</label>
                <select
                  value={draft.cameraTargetType || firstEntityType}
                  onChange={(e) => onPatch({ cameraTargetType: e.target.value })}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                >
                  {availableEntityOptions.map((opt) => (
                    <option key={opt.type} value={opt.type}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {followMode === 'tag' && (
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">Tag suivi :</label>
                <input
                  type="text"
                  list="camera-action-tags"
                  value={draft.cameraTargetTag || ''}
                  onChange={(e) =>
                    onPatch({ cameraTargetTag: e.target.value.replace(/^#/, '') })
                  }
                  placeholder="ex: joueur"
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                />
                <datalist id="camera-action-tags">
                  {allProjectTags.map((t) => (
                    <option key={t} value={t} />
                  ))}
                </datalist>
              </div>
            )}
          </>
        )}

        {cmd === 'move_to' && (
          <>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() =>
                  onPatch({
                    cameraMoveTargetKind: 'entity',
                    cameraPosition: undefined,
                  })
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  moveTargetKind === 'entity'
                    ? 'bg-cyan-600 text-white border-cyan-700'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                🎯 Centrer sur une Entité
              </button>
              <button
                type="button"
                onClick={() =>
                  onPatch({
                    cameraMoveTargetKind: 'position',
                    cameraPosition: draft.cameraPosition || { x: 0, y: 0 },
                  })
                }
                className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                  moveTargetKind === 'position'
                    ? 'bg-cyan-600 text-white border-cyan-700'
                    : 'bg-white text-slate-700 border-slate-200'
                }`}
              >
                📐 Coordonnées (X, Y)
              </button>
            </div>

            {moveTargetKind === 'position' ? (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">X (px monde) :</label>
                  <input
                    type="number"
                    step="any"
                    value={draft.cameraPosition?.x ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onPatch({
                        cameraPosition: {
                          x: Number.isFinite(v) ? v : 0,
                          y: draft.cameraPosition?.y ?? 0,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Y (px monde) :</label>
                  <input
                    type="number"
                    step="any"
                    value={draft.cameraPosition?.y ?? 0}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      onPatch({
                        cameraPosition: {
                          x: draft.cameraPosition?.x ?? 0,
                          y: Number.isFinite(v) ? v : 0,
                        },
                      });
                    }}
                    className="w-full px-3 py-2 text-xs font-mono font-bold bg-white border border-slate-300 rounded-xl"
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <select
                  value={targetMode === 'type' || targetMode === 'tag' ? 'entity' : targetMode}
                  onChange={(e) => onPatch({ cameraTargetMode: e.target.value as any })}
                  className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                >
                  {!isGlobal && <option value="subject">Sujet déclencheur</option>}
                  {isRelational && <option value="target">Cible touchée</option>}
                  <option value="last_spawned">Dernier objet créé</option>
                  <option value="entity">Entité précise</option>
                </select>
                {targetMode === 'entity' && (
                  <select
                    value={draft.cameraTargetId || firstEntityId}
                    onChange={(e) => onPatch({ cameraTargetId: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-bold bg-white text-slate-900 border border-slate-300 rounded-xl"
                  >
                    {entityList.map((ent) => (
                      <option key={ent.id} value={ent.id}>
                        {ent.name}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">Durée du déplacement :</label>
                <EditableNumericValue
                  value={duration}
                  unit="s"
                  precision={2}
                  onChange={(v) => onPatch({ cameraDuration: v })}
                  className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
                />
              </div>
              <input
                type="range"
                min={0}
                max={5}
                step={0.05}
                value={Math.max(0, Math.min(5, duration))}
                onChange={(e) => onPatch({ cameraDuration: parseFloat(e.target.value) })}
                className="w-full accent-cyan-600 cursor-pointer"
              />
            </div>
          </>
        )}

        {cmd === 'reset' && (
          <div>
            <p className="text-xs text-slate-600 mb-3">
              Ramène la caméra à sa position, son zoom et sa cible de suivi par défaut configurés pour la scène.
            </p>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold text-slate-700">Durée du retour :</label>
              <EditableNumericValue
                value={duration}
                unit="s"
                precision={2}
                onChange={(v) => onPatch({ cameraDuration: v })}
                className="text-xs font-mono font-black text-cyan-700 bg-cyan-50 hover:bg-cyan-100 px-1.5 py-0.5 rounded cursor-text"
              />
            </div>
            <input
              type="range"
              min={0}
              max={5}
              step={0.05}
              value={Math.max(0, Math.min(5, duration))}
              onChange={(e) => onPatch({ cameraDuration: parseFloat(e.target.value) })}
              className="w-full accent-cyan-600 cursor-pointer"
            />
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        className="w-full py-3 bg-cyan-600 hover:bg-cyan-700 text-white font-black text-xs rounded-2xl shadow-md cursor-pointer flex items-center justify-center gap-2"
      >
        <Check className="w-4 h-4" />
        <span>Valider l'action Caméra</span>
      </button>
    </div>
  );
};
