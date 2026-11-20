export interface TransitionDomSnapshot {
  id: string;
  node: HTMLElement;
  backgroundColor: string;
  width: number;
  height: number;
}

const snapshotMap = new Map<string, TransitionDomSnapshot>();

/**
 * Capture un clone DOM visuel figé de la scène courante avant son remplacement
 * afin de réaliser les transitions Push sans exécuter un deuxième moteur physique.
 */
export function captureStageSnapshot(transId: string, backgroundColor: string): boolean {
  if (typeof document === 'undefined') return false;
  const stageEl = document.getElementById('scene-stage-capture');
  if (!stageEl) return false;
  const rect = stageEl.getBoundingClientRect();
  const clone = stageEl.cloneNode(true) as HTMLElement;
  clone.removeAttribute('id');
  clone.style.pointerEvents = 'none';
  // Supprimer les attributs id potentiellement dupliqués dans le clone pour garder un DOM sain
  clone.querySelectorAll('[id]').forEach((el) => {
    el.removeAttribute('id');
  });
  snapshotMap.set(transId, {
    id: transId,
    node: clone,
    backgroundColor: backgroundColor || '#ffffff',
    width: Math.max(1, Math.round(rect.width)),
    height: Math.max(1, Math.round(rect.height)),
  });
  return true;
}

export function getTransitionSnapshot(transId: string): TransitionDomSnapshot | undefined {
  return snapshotMap.get(transId);
}

export function releaseTransitionSnapshot(transId: string) {
  snapshotMap.delete(transId);
}

export function clearAllTransitionSnapshots() {
  snapshotMap.clear();
}
