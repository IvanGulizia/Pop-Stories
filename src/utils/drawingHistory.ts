import { DrawingLayer, VectorPath } from '../types';

export interface DrawingHistorySnapshot {
  paths: VectorPath[];
  layers: DrawingLayer[];
}

export interface FrameHistoryEntry {
  stack: DrawingHistorySnapshot[];
  index: number;
}

export function cloneVectorPaths(paths: VectorPath[]): VectorPath[] {
  return JSON.parse(JSON.stringify(paths || []));
}

export function cloneDrawingLayers(layers: DrawingLayer[]): DrawingLayer[] {
  return JSON.parse(JSON.stringify(layers || []));
}

export function createSnapshot(
  paths: VectorPath[],
  layers: DrawingLayer[]
): DrawingHistorySnapshot {
  return {
    paths: cloneVectorPaths(paths),
    layers: cloneDrawingLayers(layers),
  };
}

export function createFrameHistoryEntry(
  paths: VectorPath[],
  layers: DrawingLayer[]
): FrameHistoryEntry {
  return {
    stack: [createSnapshot(paths, layers)],
    index: 0,
  };
}

export function pushSnapshotToEntry(
  entry: FrameHistoryEntry,
  paths: VectorPath[],
  layers: DrawingLayer[],
  maxHistory = 60
): FrameHistoryEntry {
  const trimmed = entry.stack.slice(0, entry.index + 1);
  trimmed.push(createSnapshot(paths, layers));
  if (trimmed.length > maxHistory) {
    trimmed.shift();
  }
  return {
    stack: trimmed,
    index: trimmed.length - 1,
  };
}

export function stepUndoEntry(entry: FrameHistoryEntry): {
  nextEntry: FrameHistoryEntry;
  snapshot: DrawingHistorySnapshot;
} | null {
  if (entry.index <= 0) return null;
  const nextIndex = entry.index - 1;
  const raw = entry.stack[nextIndex];
  if (!raw) return null;
  return {
    nextEntry: {
      stack: entry.stack,
      index: nextIndex,
    },
    snapshot: createSnapshot(raw.paths, raw.layers),
  };
}

export function stepRedoEntry(entry: FrameHistoryEntry): {
  nextEntry: FrameHistoryEntry;
  snapshot: DrawingHistorySnapshot;
} | null {
  if (entry.index >= entry.stack.length - 1) return null;
  const nextIndex = entry.index + 1;
  const raw = entry.stack[nextIndex];
  if (!raw) return null;
  return {
    nextEntry: {
      stack: entry.stack,
      index: nextIndex,
    },
    snapshot: createSnapshot(raw.paths, raw.layers),
  };
}

export function switchFrameHistoryInStore(
  store: Map<string, FrameHistoryEntry>,
  prevFrameKey: string | undefined,
  prevEntry: FrameHistoryEntry,
  nextFrameKey: string,
  nextInitialPaths: VectorPath[],
  nextInitialLayers: DrawingLayer[]
): FrameHistoryEntry {
  if (prevFrameKey) {
    store.set(prevFrameKey, prevEntry);
  }
  const existing = store.get(nextFrameKey);
  if (existing && existing.stack.length > 0) {
    const clampedIdx = Math.max(0, Math.min(existing.index, existing.stack.length - 1));
    const currentSnap = existing.stack[clampedIdx];
    const currentSig = JSON.stringify(currentSnap?.paths || []);
    const incomingSig = JSON.stringify(nextInitialPaths || []);
    if (currentSig === incomingSig) {
      return {
        stack: existing.stack,
        index: clampedIdx,
      };
    }
    // Si l'état initial externe diffère (ex: réinitialisation), préserver l'historique et empiler l'état courant
    const synced = pushSnapshotToEntry(
      { stack: existing.stack, index: clampedIdx },
      nextInitialPaths,
      nextInitialLayers
    );
    store.set(nextFrameKey, synced);
    return synced;
  }

  const created = createFrameHistoryEntry(nextInitialPaths, nextInitialLayers);
  store.set(nextFrameKey, created);
  return created;
}
