import React from 'react';
import { ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { Entity, EntityState } from '../../types';

interface HitboxColliderCardProps {
  entity: Entity;
  entities: Record<string, Entity>;
  targetState?: EntityState;
  stateList: EntityState[];
  activeStateId: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  updateEntityDetails: (entityId: string, partial: Partial<Entity>) => void;
  updateStateProperties: (entityId: string, stateId: string, partial: Partial<EntityState>) => void;
  onEditStateDrawing?: (stateId: string) => void;
}

export function HitboxColliderCard({
  entity,
  entities,
  targetState,
  stateList,
  activeStateId,
  isExpanded,
  onToggleExpand,
  updateEntityDetails,
  updateStateProperties,
  onEditStateDrawing,
}: HitboxColliderCardProps) {
  const refStateId =
    entity.colliderReferenceStateId ||
    Object.keys(entity.states)[0] ||
    entity.currentStateId;
  const refState = entity.states[refStateId];
  const activeMode = targetState?.colliderBounds?.mode || entity.colliderBounds?.mode || 'auto';
  const activeShape =
    targetState?.colliderBounds?.shape ||
    targetState?.colliderType ||
    entity.colliderBounds?.shape ||
    entity.colliderType ||
    (entity.type === 'apple' ? 'circle' : 'box');
  const shapeLabel =
    activeShape === 'circle' ? 'Cercle' : activeShape === 'polygon' ? 'Polyligne' : 'Rectangle';
  const modeLabel = activeMode === 'manual' ? 'Manuel' : 'Auto';
  const isOverridden = Boolean(targetState?.overrideCollider);
  const colliderMode = entity.colliderMode || 'default';
  const pointerDelegation = entity.pointerDelegation || 'self';
  const ignorePointer = Boolean(entity.ignorePointer);
  const parentEntity = entity.parentId ? entities[entity.parentId] : undefined;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 hover:border-slate-300 transition-all shadow-2xs overflow-hidden">
      <div
        onClick={onToggleExpand}
        className="p-2.5 flex items-center justify-between gap-2 cursor-pointer select-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            className="text-slate-400 hover:text-slate-600 cursor-pointer"
          >
            {isExpanded ? (
              <ChevronDown className="w-4 h-4" />
            ) : (
              <ChevronRight className="w-4 h-4" />
            )}
          </button>
          <div
            className={`w-7 h-7 rounded-lg border flex items-center justify-center shrink-0 ${
              colliderMode === 'disabled'
                ? 'bg-slate-100 border-slate-300 text-slate-500'
                : colliderMode === 'trigger_only'
                ? 'bg-sky-50 border-sky-200 text-sky-600'
                : 'bg-emerald-50 border-emerald-200 text-emerald-600'
            }`}
          >
            <Shield className="w-4 h-4" />
          </div>
          <div className="min-w-0">
            <div className="text-xs font-bold text-slate-800 flex items-center gap-1.5 truncate">
              <span>Hitbox & Collider</span>
              {colliderMode === 'disabled' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                  Désactivé
                </span>
              )}
              {colliderMode === 'trigger_only' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700">
                  Capteur
                </span>
              )}
              {pointerDelegation !== 'self' && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700">
                  → {pointerDelegation === 'parent' ? 'Parent' : 'Racine'}
                </span>
              )}
              {ignorePointer && (
                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-600">
                  Ignorer souris
                </span>
              )}
            </div>
            <div className="text-[10px] text-slate-500 flex items-center gap-1 truncate">
              {entity.sharedCollider ? (
                <span className="text-emerald-700 font-semibold">
                  Partagée ({refState?.name || 'Réf'}) • {modeLabel}
                </span>
              ) : (
                <span>
                  Par défaut • {modeLabel} • {shapeLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {onEditStateDrawing && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditStateDrawing(activeStateId || entity.currentStateId);
            }}
            className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer shrink-0"
            title="Configurer la hitbox dans l'atelier de dessin"
          >
            Configurer
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-2 border-t border-slate-100 bg-slate-50/50 space-y-2 text-xs">
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <div className="font-bold text-slate-700 text-xs">Hitbox de l'état « {targetState?.name} »</div>
              <div className="text-[10px] text-emerald-700 font-semibold">
                {modeLabel} • {shapeLabel}
              </div>
            </div>
            {onEditStateDrawing && (
              <button
                type="button"
                onClick={() => onEditStateDrawing(activeStateId || entity.currentStateId)}
                className="px-2.5 py-1 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[11px] font-bold cursor-pointer shadow-2xs shrink-0"
              >
                Ajuster dans Dessin
              </button>
            )}
          </div>

          {/* Mode de collision physique */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-1.5">
            <div>
              <div className="font-bold text-slate-700 text-xs">Mode du Collider physique</div>
              <div className="text-[10px] text-slate-400 leading-snug">
                {colliderMode === 'disabled'
                  ? 'Aucune collision physique ni détection de contact (visuel et LookAt actifs).'
                  : colliderMode === 'trigger_only'
                  ? 'Capteur traversable uniquement (ne repousse jamais les autres objets).'
                  : 'Suit le comportement normal (solide si Physique activée, sinon capteur).'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'default', label: 'Normal' },
                { id: 'trigger_only', label: 'Capteur' },
                { id: 'disabled', label: 'Désactivé' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    updateEntityDetails(entity.id, {
                      colliderMode: opt.id as Entity['colliderMode'],
                    })
                  }
                  className={`py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    colliderMode === opt.id
                      ? opt.id === 'disabled'
                        ? 'bg-slate-700 text-white shadow-2xs'
                        : opt.id === 'trigger_only'
                        ? 'bg-sky-600 text-white shadow-2xs'
                        : 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Délégation souris / Drag parent-enfant */}
          <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
            <div>
              <div className="font-bold text-slate-700 text-xs">Interaction Souris / Drag (Mode Play)</div>
              <div className="text-[10px] text-slate-400 leading-snug">
                {pointerDelegation === 'self'
                  ? 'Les clics, survols et drags agissent directement sur cet objet.'
                  : pointerDelegation === 'parent'
                  ? `Transmet les clics, survols et drags au parent direct${parentEntity ? ` (« ${parentEntity.name} »)` : ''}.`
                  : 'Remonte et transmet toute interaction souris au parent final racine du groupe.'}
              </div>
            </div>
            <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-lg">
              {[
                { id: 'self', label: 'Soi-même' },
                { id: 'parent', label: 'Parent direct' },
                { id: 'root_parent', label: 'Parent final' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() =>
                    updateEntityDetails(entity.id, {
                      pointerDelegation: opt.id as Entity['pointerDelegation'],
                    })
                  }
                  className={`py-1 rounded-md text-[10px] font-bold cursor-pointer transition-all ${
                    pointerDelegation === opt.id
                      ? 'bg-indigo-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:bg-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {pointerDelegation !== 'self' && !parentEntity && (
              <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1">
                Cet objet n’a pas encore de parent : tant qu’il est indépendant, il répond lui-même.
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-slate-100">
              <div>
                <div className="font-bold text-slate-700 text-[11px]">
                  Ignorer la souris en Mode Play
                </div>
                <div className="text-[10px] text-slate-400 leading-snug">
                  Laisse passer les clics/survols à travers cet élément (ex: pupille sur œil).
                </div>
              </div>
              <input
                type="checkbox"
                checked={ignorePointer}
                onChange={(e) =>
                  updateEntityDetails(entity.id, {
                    ignorePointer: e.target.checked,
                  })
                }
                className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
              />
            </div>
          </div>

          {stateList.length > 1 && (
            <div className="p-2 bg-white rounded-xl border border-slate-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-slate-700 text-xs">
                    Collider commun entre les états
                  </div>
                  <div className="text-[10px] text-slate-400 leading-snug">
                    Conserve la même hitbox quand l'état change (évite les boucles Enter/Exit).
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={Boolean(entity.sharedCollider)}
                  onChange={(e) =>
                    updateEntityDetails(entity.id, {
                      sharedCollider: e.target.checked,
                      colliderReferenceStateId:
                        entity.colliderReferenceStateId ||
                        Object.keys(entity.states)[0] ||
                        entity.currentStateId,
                    })
                  }
                  className="w-4 h-4 accent-emerald-600 rounded cursor-pointer shrink-0"
                />
              </div>

              {entity.sharedCollider && (
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold text-slate-600">
                      État de référence :
                    </span>
                    <select
                      value={refStateId}
                      onChange={(e) =>
                        updateEntityDetails(entity.id, {
                          colliderReferenceStateId: e.target.value,
                        })
                      }
                      className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 max-w-[165px]"
                    >
                      {stateList.map((st) => (
                        <option key={st.id} value={st.id}>
                          {st.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {targetState && targetState.id !== refStateId && (
                    <div className="p-2 bg-indigo-50/50 rounded-xl border border-indigo-200/80 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <div className="text-[11px] font-bold text-indigo-950">
                            Créer un override sur « {targetState.name} »
                          </div>
                          <div className="text-[10px] text-slate-500">
                            Utiliser une hitbox propre pour cet état uniquement
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isOverridden}
                          onChange={(e) =>
                            updateStateProperties(entity.id, targetState.id, {
                              overrideCollider: e.target.checked,
                            })
                          }
                          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
                        />
                      </div>
                      {isOverridden && onEditStateDrawing && (
                        <div className="flex justify-end pt-1 border-t border-indigo-100">
                          <button
                            type="button"
                            onClick={() => onEditStateDrawing(targetState.id)}
                            className="px-2 py-0.5 bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-[10px] font-bold cursor-pointer"
                          >
                            Modifier cette hitbox
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
