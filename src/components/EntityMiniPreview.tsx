import React from 'react';
import { Entity, EntityType, EntityState, VectorPath } from '../types';

interface EntityMiniPreviewProps {
  entity?: Entity;
  type?: EntityType;
  stateId?: string;
  className?: string;
  size?: number;
}

export function EntityMiniPreview({
  entity,
  type = 'custom',
  stateId,
  className = '',
  size = 48,
}: EntityMiniPreviewProps) {
  const actualType = entity?.type || type;
  const activeState: EntityState | undefined = entity
    ? entity.states[stateId || entity.currentStateId]
    : undefined;

  // Render vector paths if available
  const vectorPaths: VectorPath[] | undefined =
    activeState?.vectorPaths || entity?.vectorPaths;

  if (vectorPaths && vectorPaths.length > 0) {
    return (
      <div
        className={`flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 200 200" className="w-full h-full">
          {vectorPaths.map((p) => (
            <path
              key={p.id}
              d={p.d}
              stroke={p.stroke}
              strokeWidth={p.strokeWidth || 3}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill={p.fill || 'none'}
            />
          ))}
        </svg>
      </div>
    );
  }

  // Preset: Plant
  if (actualType === 'plant') {
    const isFlower = (stateId || entity?.currentStateId) === 'fleur';
    return (
      <div
        className={`flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Pot */}
          <path d="M30 75 L70 75 L65 92 L35 92 Z" fill="#92400e" />
          <path d="M26 70 L74 70 L70 76 L30 76 Z" fill="#b45309" />
          {/* Stem */}
          <path
            d={isFlower ? 'M50 70 Q46 45 50 25' : 'M50 70 Q48 55 50 45'}
            stroke="#16a34a"
            strokeWidth="5"
            strokeLinecap="round"
            fill="none"
          />
          {/* Leaves */}
          <path d="M50 55 Q35 50 32 40 Q45 42 50 55" fill="#22c55e" />
          <path d="M50 50 Q65 45 68 35 Q55 37 50 50" fill="#22c55e" />
          {/* Flower petals if in flower state */}
          {isFlower ? (
            <g transform="translate(50, 25)">
              {[0, 45, 90, 135, 180, 225, 270, 315].map((angle) => (
                <circle
                  key={angle}
                  cx={Math.cos((angle * Math.PI) / 180) * 12}
                  cy={Math.sin((angle * Math.PI) / 180) * 12}
                  r="6"
                  fill="#ec4899"
                />
              ))}
              <circle cx="0" cy="0" r="7" fill="#fbbf24" />
            </g>
          ) : (
            <circle cx="50" cy="42" r="5" fill="#86efac" />
          )}
        </svg>
      </div>
    );
  }

  // Preset: Apple
  if (actualType === 'apple') {
    const isCroquee = (stateId || entity?.currentStateId) === 'croquee';
    return (
      <div
        className={`flex items-center justify-center overflow-hidden shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        <svg viewBox="0 0 100 100" className="w-full h-full">
          {/* Stem & Leaf */}
          <path d="M50 30 Q54 18 60 14" stroke="#78350f" strokeWidth="4" strokeLinecap="round" fill="none" />
          <path d="M52 24 Q68 18 70 26 Q58 32 52 24" fill="#22c55e" />
          {/* Body */}
          {isCroquee ? (
            <path
              d="M30 40 C20 55 22 80 40 85 C46 87 50 84 54 84 C58 84 62 87 68 85 C84 80 88 58 82 46 C76 49 70 45 69 38 C68 34 71 31 74 29 C66 26 56 30 50 35 C44 30 36 28 30 40 Z"
              fill="#ef4444"
            />
          ) : (
            <path
              d="M30 38 C18 52 20 80 38 86 C45 88 49 85 54 85 C59 85 63 88 70 86 C88 80 90 52 78 38 C68 28 58 34 54 34 C50 34 40 28 30 38 Z"
              fill="#ef4444"
            />
          )}
          {/* Bite mark highlight if croquée */}
          {isCroquee && (
            <path d="M72 36 C67 43 72 52 78 50" fill="none" stroke="#fef08a" strokeWidth="3" />
          )}
        </svg>
      </div>
    );
  }

  // Preset: Custom Star / General Emoji
  if (entity?.icon) {
    return (
      <div
        className={`flex items-center justify-center text-xl shrink-0 ${className}`}
        style={{ width: size, height: size }}
      >
        {entity.icon}
      </div>
    );
  }

  return (
    <div
      className={`flex items-center justify-center text-xl shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      ⭐
    </div>
  );
}
