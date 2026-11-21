import React from 'react';
import { ParentAttachmentMode, ParentOffset } from '../../types';
import { EditableNumericValue } from './EditableNumericValue';

interface ParentOffsetFieldsEditorProps {
  offset: Partial<ParentOffset>;
  onChange: (patch: Partial<ParentOffset>) => void;
  parentName?: string;
  showOffsets?: boolean;
  showDisableCollisionsOption?: boolean;
  compact?: boolean;
}

export function ParentOffsetFieldsEditor({
  offset,
  onChange,
  parentName,
  showOffsets = false,
  showDisableCollisionsOption = false,
  compact = false,
}: ParentOffsetFieldsEditorProps) {
  const attachmentMode = offset.attachmentMode || 'rigid';
  const rawMaxDist = offset.springMaxDistance ?? 0;
  const isMaxDistLimited =
    offset.springLimitMaxDistance === true ||
    (offset.springLimitMaxDistance !== false && rawMaxDist > 0);
  const angularStiffness = offset.jointAngularStiffness ?? 0;

  return (
    <div className="space-y-1.5">
      {showOffsets && (
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
            <span className="font-bold text-slate-600 text-[11px]">ΔX</span>
            <EditableNumericValue
              value={Math.round(offset.x ?? 0)}
              unit="px"
              onChange={(v) => onChange({ x: v })}
              className="text-[11px] font-mono font-bold text-slate-800 bg-slate-50 hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-200 cursor-text tabular-nums"
            />
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
            <span className="font-bold text-slate-600 text-[11px]">ΔY</span>
            <EditableNumericValue
              value={Math.round(offset.y ?? 0)}
              unit="px"
              onChange={(v) => onChange({ y: v })}
              className="text-[11px] font-mono font-bold text-slate-800 bg-slate-50 hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-200 cursor-text tabular-nums"
            />
          </div>
          <div className="p-2 bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-1">
            <span className="font-bold text-slate-600 text-[11px]">Rot</span>
            <EditableNumericValue
              value={Math.round(offset.rotationOffset ?? 0)}
              unit="°"
              onChange={(v) => onChange({ rotationOffset: v })}
              className="text-[11px] font-mono font-bold text-slate-800 bg-slate-50 hover:bg-indigo-50 px-1.5 py-0.5 rounded border border-slate-200 cursor-text tabular-nums"
            />
          </div>
        </div>
      )}

      {/* Suivre la rotation */}
      <div className={`${compact ? 'p-1.5' : 'p-2'} bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2`}>
        <div>
          <div className="font-bold text-slate-700 text-xs">Suivre la rotation du parent</div>
          {!compact && (
            <div className="text-[10px] text-slate-400">
              {parentName ? `Orbite et pivote avec « ${parentName} »` : "Orbite et pivote avec l'objet parent"}
            </div>
          )}
        </div>
        <input
          type="checkbox"
          checked={offset.inheritRotation !== false}
          onChange={(e) => onChange({ inheritRotation: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
        />
      </div>

      {/* Suivre le Flip horizontal */}
      <div className={`${compact ? 'p-1.5' : 'p-2'} bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2`}>
        <div>
          <div className="font-bold text-slate-700 text-xs">Suivre le Flip horizontal</div>
          {!compact && (
            <div className="text-[10px] text-slate-400">
              Inverse le côté et le dessin quand le parent se retourne
            </div>
          )}
        </div>
        <input
          type="checkbox"
          checked={offset.inheritFlip !== false}
          onChange={(e) => onChange({ inheritFlip: e.target.checked })}
          className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
        />
      </div>

      {showDisableCollisionsOption && (
        <div className={`${compact ? 'p-1.5' : 'p-2'} bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2`}>
          <div>
            <div className="font-bold text-slate-700 text-xs">Désactiver collisions avec le parent</div>
            {!compact && (
              <div className="text-[10px] text-slate-400">
                Empêche l'enfant et son parent de se repousser mutuellement
              </div>
            )}
          </div>
          <input
            type="checkbox"
            checked={offset.disableCollisionsWhileAttached !== false}
            onChange={(e) => onChange({ disableCollisionsWhileAttached: e.target.checked })}
            className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
          />
        </div>
      )}

      {/* Mode d'attache */}
      <div className={`${compact ? 'p-1.5' : 'p-2'} bg-white rounded-xl border border-slate-200 flex items-center justify-between gap-2`}>
        <span className="font-bold text-slate-700 text-xs">Mode d'attache</span>
        <select
          value={attachmentMode}
          onChange={(e) => onChange({ attachmentMode: e.target.value as ParentAttachmentMode })}
          className="bg-slate-50 border border-slate-300 rounded-lg px-2 py-1 text-xs font-medium text-slate-800 max-w-[190px]"
        >
          <option value="rigid">Rigide (Soudé)</option>
          <option value="spring">Ressort / Damping élastique</option>
          <option value="physics_joint">Joint Physique (Pendule)</option>
        </select>
      </div>

      {(attachmentMode === 'spring' || attachmentMode === 'physics_joint') && (
        <div className="p-2 bg-indigo-50/40 rounded-xl border border-indigo-200 space-y-2">
          {/* Raideur / Rigidité */}
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">
                {attachmentMode === 'physics_joint'
                  ? "Rigidité du point d'attache"
                  : 'Raideur du ressort'}
              </span>
              <EditableNumericValue
                value={offset.springStiffness ?? 160}
                precision={1}
                onChange={(v) => onChange({ springStiffness: v })}
                className="font-mono tabular-nums font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200/70 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0 cursor-text"
              />
            </div>
            <input
              type="range"
              min="20"
              max="500"
              step="10"
              value={Math.max(20, Math.min(500, offset.springStiffness ?? 160))}
              onChange={(e) => onChange({ springStiffness: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Amortissement linéaire */}
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">
                {attachmentMode === 'physics_joint'
                  ? 'Amortissement linéaire'
                  : 'Amortissement (Damping)'}
              </span>
              <EditableNumericValue
                value={offset.springDamping ?? 12}
                precision={2}
                onChange={(v) => onChange({ springDamping: v })}
                className="font-mono tabular-nums font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200/70 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0 cursor-text"
              />
            </div>
            <input
              type="range"
              min="1"
              max="40"
              step="0.5"
              value={Math.max(1, Math.min(40, offset.springDamping ?? 12))}
              onChange={(e) => onChange({ springDamping: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Distance max (Laisse) : Libre vs Limiter (incluant 0 px strict !) */}
          <div className="space-y-1">
            <div className="flex justify-between items-center text-xs text-slate-700 gap-2">
              <span className="font-bold">Distance max (Laisse)</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <div className="inline-flex rounded-lg border border-indigo-200 bg-white p-0.5 text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => onChange({ springLimitMaxDistance: false, springMaxDistance: 0 })}
                    className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                      !isMaxDistLimited
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-indigo-50'
                    }`}
                  >
                    Libre
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChange({
                        springLimitMaxDistance: true,
                        springMaxDistance: isMaxDistLimited ? rawMaxDist : 0,
                      })
                    }
                    className={`px-1.5 py-0.5 rounded-md cursor-pointer transition-colors ${
                      isMaxDistLimited
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-600 hover:bg-indigo-50'
                    }`}
                  >
                    Limiter
                  </button>
                </div>
                {isMaxDistLimited && (
                  <EditableNumericValue
                    value={rawMaxDist}
                    unit="px"
                    precision={1}
                    onChange={(v) =>
                      onChange({
                        springLimitMaxDistance: true,
                        springMaxDistance: v,
                      })
                    }
                    className="font-mono tabular-nums font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200/70 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0 cursor-text"
                  />
                )}
              </div>
            </div>
            {isMaxDistLimited && (
              <input
                type="range"
                min="0"
                max="350"
                step="5"
                value={Math.max(0, Math.min(350, rawMaxDist))}
                onChange={(e) =>
                  onChange({
                    springLimitMaxDistance: true,
                    springMaxDistance: parseFloat(e.target.value),
                  })
                }
                className="w-full accent-indigo-600"
              />
            )}
          </div>

          {/* Pesanteur locale */}
          <div>
            <div className="flex justify-between items-center text-xs text-slate-700 mb-1">
              <span className="font-bold">Pesanteur locale</span>
              <EditableNumericValue
                value={offset.springGravity ?? (attachmentMode === 'physics_joint' ? 400 : 0)}
                unit="px/s²"
                precision={1}
                onChange={(v) => onChange({ springGravity: v })}
                className="font-mono tabular-nums font-bold text-indigo-700 bg-indigo-100 hover:bg-indigo-200/70 px-1.5 py-0.5 rounded text-[11px] whitespace-nowrap shrink-0 cursor-text"
              />
            </div>
            <input
              type="range"
              min="-200"
              max="800"
              step="20"
              value={Math.max(
                -200,
                Math.min(800, offset.springGravity ?? (attachmentMode === 'physics_joint' ? 400 : 0))
              )}
              onChange={(e) => onChange({ springGravity: parseFloat(e.target.value) })}
              className="w-full accent-indigo-600"
            />
          </div>

          {/* Paramètres spécifiques Joint Physique */}
          {attachmentMode === 'physics_joint' && (
            <div className="p-2 bg-sky-50/70 rounded-xl border border-sky-200 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="font-bold text-sky-900 text-xs">
                    Contraintes & Ressort du Joint
                  </div>
                  <div className="text-[10px] text-sky-700/80">
                    Butées angulaires, freinage doux et rappel ressort
                  </div>
                </div>
                <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer whitespace-nowrap shrink-0">
                  <input
                    type="checkbox"
                    checked={Boolean(offset.jointEnableAngleLimits)}
                    onChange={(e) =>
                      onChange({
                        jointEnableAngleLimits: e.target.checked,
                        jointMinAngle: offset.jointMinAngle ?? -75,
                        jointMaxAngle: offset.jointMaxAngle ?? 75,
                        jointBrakeAngle: offset.jointBrakeAngle ?? 20,
                        jointBrakeStrength: offset.jointBrakeStrength ?? 75,
                      })
                    }
                    className="w-4 h-4 accent-sky-600 rounded cursor-pointer"
                  />
                  <span>Limiter l'angle</span>
                </label>
              </div>

              {offset.jointEnableAngleLimits && (
                <div className="space-y-2 pt-1 border-t border-sky-200/70">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                        <span className="font-bold">Angle min</span>
                        <EditableNumericValue
                          value={offset.jointMinAngle ?? -75}
                          unit="°"
                          precision={1}
                          onChange={(v) => onChange({ jointMinAngle: v })}
                          className="font-mono tabular-nums font-bold text-sky-700 hover:bg-sky-100 px-1 rounded cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min="-179"
                        max={Math.round(offset.jointMaxAngle ?? 75)}
                        step="1"
                        value={Math.max(
                          -179,
                          Math.min(offset.jointMinAngle ?? -75, offset.jointMaxAngle ?? 75)
                        )}
                        onChange={(e) => onChange({ jointMinAngle: parseFloat(e.target.value) })}
                        className="w-full accent-sky-600"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                        <span className="font-bold">Angle max</span>
                        <EditableNumericValue
                          value={offset.jointMaxAngle ?? 75}
                          unit="°"
                          precision={1}
                          onChange={(v) => onChange({ jointMaxAngle: v })}
                          className="font-mono tabular-nums font-bold text-sky-700 hover:bg-sky-100 px-1 rounded cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min={Math.round(offset.jointMinAngle ?? -75)}
                        max="179"
                        step="1"
                        value={Math.min(
                          179,
                          Math.max(offset.jointMaxAngle ?? 75, offset.jointMinAngle ?? -75)
                        )}
                        onChange={(e) => onChange({ jointMaxAngle: parseFloat(e.target.value) })}
                        className="w-full accent-sky-600"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                      <span className="font-bold">2e angle : Zone de freinage</span>
                      <EditableNumericValue
                        value={offset.jointBrakeAngle ?? 20}
                        displayText={
                          (offset.jointBrakeAngle ?? 20) > 0
                            ? `${Math.round(offset.jointBrakeAngle ?? 20)}°`
                            : 'Désactivé'
                        }
                        precision={1}
                        onChange={(v) => onChange({ jointBrakeAngle: v })}
                        className="font-mono tabular-nums font-bold text-amber-700 bg-amber-100 hover:bg-amber-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 cursor-text"
                      />
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="90"
                      step="1"
                      value={Math.max(0, Math.min(90, offset.jointBrakeAngle ?? 20))}
                      onChange={(e) => onChange({ jointBrakeAngle: parseFloat(e.target.value) })}
                      className="w-full accent-amber-500"
                    />
                  </div>

                  {(offset.jointBrakeAngle ?? 20) > 0 && (
                    <div>
                      <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                        <span className="font-bold">Force de freinage</span>
                        <EditableNumericValue
                          value={offset.jointBrakeStrength ?? 75}
                          unit="%"
                          precision={1}
                          onChange={(v) => onChange({ jointBrakeStrength: v })}
                          className="font-mono tabular-nums font-bold text-amber-700 hover:bg-amber-100 px-1 rounded cursor-text"
                        />
                      </div>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="5"
                        value={Math.max(0, Math.min(100, offset.jointBrakeStrength ?? 75))}
                        onChange={(e) => onChange({ jointBrakeStrength: parseFloat(e.target.value) })}
                        className="w-full accent-amber-500"
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="pt-1 border-t border-sky-200/70 space-y-2">
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                    <span className="font-bold">Angle de départ (Play)</span>
                    <EditableNumericValue
                      value={offset.jointInitialAngleOffset ?? 0}
                      displayText={`${(offset.jointInitialAngleOffset ?? 0) > 0 ? '+' : ''}${Math.round(offset.jointInitialAngleOffset ?? 0)}°`}
                      precision={1}
                      onChange={(v) => onChange({ jointInitialAngleOffset: v })}
                      className="font-mono tabular-nums font-bold text-sky-700 hover:bg-sky-100 px-1 rounded cursor-text"
                    />
                  </div>
                  <input
                    type="range"
                    min="-180"
                    max="180"
                    step="1"
                    value={Math.max(-180, Math.min(180, offset.jointInitialAngleOffset ?? 0))}
                    onChange={(e) =>
                      onChange({ jointInitialAngleOffset: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                    <span className="font-bold">Ressort angulaire (Rappel)</span>
                    <EditableNumericValue
                      value={angularStiffness}
                      displayText={angularStiffness > 0 ? `${Math.round(angularStiffness)}` : 'Libre'}
                      precision={1}
                      onChange={(v) => onChange({ jointAngularStiffness: v })}
                      className="font-mono tabular-nums font-bold text-sky-700 bg-sky-100 hover:bg-sky-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 cursor-text"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1200"
                    step="10"
                    value={Math.max(0, Math.min(1200, angularStiffness))}
                    onChange={(e) =>
                      onChange({ jointAngularStiffness: parseFloat(e.target.value) })
                    }
                    className="w-full accent-sky-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                    <span className="font-bold">Amortissement angulaire</span>
                    <EditableNumericValue
                      value={offset.jointAngularDamping ?? 3}
                      precision={2}
                      onChange={(v) => onChange({ jointAngularDamping: v })}
                      className="font-mono tabular-nums font-bold text-sky-700 hover:bg-sky-100 px-1 rounded cursor-text"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="25"
                    step="0.5"
                    value={Math.max(0, Math.min(25, offset.jointAngularDamping ?? 3))}
                    onChange={(e) => onChange({ jointAngularDamping: parseFloat(e.target.value) })}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Collisions avec le monde */}
          <div className="pt-1 border-t border-indigo-200/60 flex items-center justify-between gap-2">
            <div>
              <div className="font-bold text-slate-700 text-xs">
                Collisions avec murs, sols & objets
              </div>
              <div className="text-[10px] text-slate-500">
                {attachmentMode === 'physics_joint'
                  ? 'Actif par défaut en Joint Physique (désactiver pour passer en capteur libre)'
                  : 'Active la réponse physique avec le décor sans heurter le parent'}
              </div>
            </div>
            <input
              type="checkbox"
              checked={
                attachmentMode === 'physics_joint'
                  ? offset.collideWithWorld !== false
                  : Boolean(offset.collideWithWorld)
              }
              onChange={(e) => onChange({ collideWithWorld: e.target.checked })}
              className="w-4 h-4 accent-indigo-600 rounded cursor-pointer shrink-0"
            />
          </div>

          {/* Rupture du Joint (Break Joint) */}
          <div className="p-2 bg-rose-50/70 rounded-xl border border-rose-200 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="font-bold text-rose-900 text-xs">
                  Rupture du Joint (Break Joint)
                </div>
                <div className="text-[10px] text-rose-700/80">
                  Se détache si on tire trop fort ou secoue vivement (événement Règles)
                </div>
              </div>
              <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700 cursor-pointer whitespace-nowrap shrink-0">
                <input
                  type="checkbox"
                  checked={Boolean(offset.jointBreakable)}
                  onChange={(e) =>
                    onChange({
                      jointBreakable: e.target.checked,
                      jointBreakForce: offset.jointBreakForce ?? 240,
                      jointBreakShakeThreshold: offset.jointBreakShakeThreshold ?? 100,
                      jointBreakFallWithGravity: offset.jointBreakFallWithGravity ?? true,
                    })
                  }
                  className="w-4 h-4 accent-rose-600 rounded cursor-pointer"
                />
                <span>Cassable</span>
              </label>
            </div>

            {offset.jointBreakable && (
              <div className="space-y-2 pt-1 border-t border-rose-200/70">
                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                    <span className="font-bold">Résistance à l'arrachement</span>
                    <EditableNumericValue
                      value={offset.jointBreakForce ?? 240}
                      precision={1}
                      onChange={(v) => onChange({ jointBreakForce: v })}
                      className="font-mono tabular-nums font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 cursor-text"
                    />
                  </div>
                  <input
                    type="range"
                    min="50"
                    max="800"
                    step="10"
                    value={Math.max(50, Math.min(800, offset.jointBreakForce ?? 240))}
                    onChange={(e) => onChange({ jointBreakForce: parseFloat(e.target.value) })}
                    className="w-full accent-rose-600"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center text-[11px] text-slate-700 mb-0.5">
                    <span className="font-bold">Tolérance aux secousses</span>
                    <EditableNumericValue
                      value={offset.jointBreakShakeThreshold ?? 100}
                      displayText={
                        (offset.jointBreakShakeThreshold ?? 100) > 0
                          ? `${Math.round(offset.jointBreakShakeThreshold ?? 100)}`
                          : 'Désactivé'
                      }
                      precision={1}
                      onChange={(v) => onChange({ jointBreakShakeThreshold: v })}
                      className="font-mono tabular-nums font-bold text-rose-700 bg-rose-100 hover:bg-rose-200 px-1.5 py-0.5 rounded whitespace-nowrap shrink-0 cursor-text"
                    />
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="300"
                    step="10"
                    value={Math.max(0, Math.min(300, offset.jointBreakShakeThreshold ?? 100))}
                    onChange={(e) =>
                      onChange({ jointBreakShakeThreshold: parseFloat(e.target.value) })
                    }
                    className="w-full accent-rose-600"
                  />
                </div>

                <div className="flex items-center justify-between gap-2 pt-0.5">
                  <div>
                    <div className="font-bold text-slate-700 text-[11px]">
                      Tomber librement après rupture
                    </div>
                    <div className="text-[10px] text-slate-500">
                      Active la gravité et les rebonds dès que le joint casse
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={offset.jointBreakFallWithGravity !== false}
                    onChange={(e) => onChange({ jointBreakFallWithGravity: e.target.checked })}
                    className="w-4 h-4 accent-rose-600 rounded cursor-pointer shrink-0"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
