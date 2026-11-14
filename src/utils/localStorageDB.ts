import { AutoSaveDraft, Entity, ProjectSlot } from '../types';

const DB_NAME = 'atelier-vivant-local-db';
const DB_VERSION = 1;
const STORE_SLOTS = 'project_slots';
const STORE_KV = 'kv_store';

const LEGACY_SLOTS_KEY = 'atelier-vivant-project-slots-v1';
const LEGACY_COLLECTION_KEY = 'atelier-vivant-custom-entity-collection-v1';
const QUOTA_MB_KEY = 'atelier-vivant-soft-quota-mb-v1';
const AUTOSAVE_DRAFT_KEY = 'autosave_draft';

export const DEFAULT_SOFT_QUOTA_MB = 50;
export const QUOTA_TIER_OPTIONS_MB = [50, 100, 250, 500, 1000, 0]; // 0 = illimité (selon navigateur)

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB non disponible'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SLOTS)) {
        db.createObjectStore(STORE_SLOTS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Erreur ouverture IndexedDB'));
  });
}

export function getSoftQuotaMb(): number {
  if (typeof window === 'undefined' || !window.localStorage) return DEFAULT_SOFT_QUOTA_MB;
  try {
    const raw = window.localStorage.getItem(QUOTA_MB_KEY);
    if (raw === null) return DEFAULT_SOFT_QUOTA_MB;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_SOFT_QUOTA_MB;
  } catch {
    return DEFAULT_SOFT_QUOTA_MB;
  }
}

export function setSoftQuotaMb(mb: number): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(QUOTA_MB_KEY, String(Math.max(0, Math.round(mb))));
  } catch {
    // ignore
  }
}

export function estimateJsonBytes(value: unknown): number {
  try {
    const str = JSON.stringify(value) || '';
    return new Blob([str]).size;
  } catch {
    return 0;
  }
}

export async function getBrowserStorageEstimate(): Promise<{
  usageBytes?: number;
  quotaBytes?: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      return {
        usageBytes: est.usage,
        quotaBytes: est.quota,
      };
    } catch {
      return {};
    }
  }
  return {};
}

export async function loadAllSlotsFromDB(): Promise<ProjectSlot[]> {
  try {
    const db = await openDB();
    const slots = await new Promise<ProjectSlot[]>((resolve, reject) => {
      const tx = db.transaction(STORE_SLOTS, 'readonly');
      const store = tx.objectStore(STORE_SLOTS);
      const req = store.getAll();
      req.onsuccess = () => resolve((req.result as ProjectSlot[]) || []);
      req.onerror = () => reject(req.error);
    });

    // Migration automatique depuis l'ancien localStorage (limite 5 Mo)
    if (typeof window !== 'undefined' && window.localStorage) {
      const legacyRaw = window.localStorage.getItem(LEGACY_SLOTS_KEY);
      if (legacyRaw) {
        try {
          const legacyParsed = JSON.parse(legacyRaw);
          if (Array.isArray(legacyParsed) && legacyParsed.length > 0) {
            const existingIds = new Set(slots.map((s) => s.id));
            const toMigrate = legacyParsed.filter((s: ProjectSlot) => s && s.id && !existingIds.has(s.id));
            if (toMigrate.length > 0) {
              const txW = db.transaction(STORE_SLOTS, 'readwrite');
              const storeW = txW.objectStore(STORE_SLOTS);
              toMigrate.forEach((s: ProjectSlot) => storeW.put(s));
              await new Promise<void>((res, rej) => {
                txW.oncomplete = () => res();
                txW.onerror = () => rej(txW.error);
              });
              slots.push(...toMigrate);
            }
            window.localStorage.removeItem(LEGACY_SLOTS_KEY);
          }
        } catch {
          // ignore corrupted legacy data
        }
      }
    }

    return slots.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  } catch (err) {
    console.warn('IndexedDB unavailable, reading fallback localStorage:', err);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LEGACY_SLOTS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) : [];
      } catch {
        return [];
      }
    }
    return [];
  }
}

export async function putSlotInDB(slot: ProjectSlot): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SLOTS, 'readwrite');
      const store = tx.objectStore(STORE_SLOTS);
      store.put(slot);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Demander la persistance si possible pour éviter l'éviction automatique par le navigateur
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }
  } catch (err) {
    console.error('Failed to persist slot in IndexedDB:', err);
    throw err;
  }
}

export async function deleteSlotFromDB(slotId: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_SLOTS, 'readwrite');
      tx.objectStore(STORE_SLOTS).delete(slotId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.error('Failed to delete slot from IndexedDB:', err);
  }
}

export async function loadCollectionFromDB(): Promise<Record<string, Entity>> {
  try {
    const db = await openDB();
    const fromIdb = await new Promise<Record<string, Entity> | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get('entity_collection');
      req.onsuccess = () => resolve((req.result as Record<string, Entity>) || null);
      req.onerror = () => reject(req.error);
    });
    if (fromIdb && Object.keys(fromIdb).length > 0) {
      return fromIdb;
    }
    if (typeof window !== 'undefined' && window.localStorage) {
      const raw = window.localStorage.getItem(LEGACY_COLLECTION_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          await saveCollectionInDB(parsed);
          return parsed;
        }
      }
    }
    return fromIdb || {};
  } catch {
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        const raw = window.localStorage.getItem(LEGACY_COLLECTION_KEY);
        return raw ? JSON.parse(raw) : {};
      } catch {
        return {};
      }
    }
    return {};
  }
}

export async function saveCollectionInDB(coll: Record<string, Entity>): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(coll, 'entity_collection');
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    // Nettoyer l'ancien localStorage s'il contenait la collection pour libérer les 5 Mo du navigateur
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(LEGACY_COLLECTION_KEY);
    }
  } catch (err) {
    console.warn('IndexedDB collection save failed, trying localStorage fallback:', err);
    if (typeof window !== 'undefined' && window.localStorage) {
      try {
        window.localStorage.setItem(LEGACY_COLLECTION_KEY, JSON.stringify(coll));
      } catch {
        // ignore quota fallback
      }
    }
  }
}

export async function loadAutoSaveDraftFromDB(): Promise<AutoSaveDraft | null> {
  try {
    const db = await openDB();
    const res = await new Promise<AutoSaveDraft | null>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const req = tx.objectStore(STORE_KV).get(AUTOSAVE_DRAFT_KEY);
      req.onsuccess = () => resolve((req.result as AutoSaveDraft) || null);
      req.onerror = () => reject(req.error);
    });
    return res && res.data ? res : null;
  } catch {
    return null;
  }
}

export async function saveAutoSaveDraftInDB(draft: AutoSaveDraft): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).put(draft, AUTOSAVE_DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Auto-save IndexedDB write skipped:', err);
  }
}

export async function clearAutoSaveDraftFromDB(): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      tx.objectStore(STORE_KV).delete(AUTOSAVE_DRAFT_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn('Auto-save clear failed:', err);
  }
}
