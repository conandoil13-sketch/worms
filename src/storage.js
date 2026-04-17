import { ART_STORE, DB_NAME, DB_VERSION, EQUIPPED_ARTWORK_KEY, LEGACY_STORAGE_KEY } from "./config.js";

let dbPromise;

function openDb() {
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);

            request.onupgradeneeded = () => {
                const db = request.result;
                if (!db.objectStoreNames.contains(ART_STORE)) {
                    db.createObjectStore(ART_STORE, { keyPath: "id" });
                }
            };

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }

    return dbPromise;
}

function runTransaction(mode, handler) {
    return openDb().then((db) => new Promise((resolve, reject) => {
        const transaction = db.transaction(ART_STORE, mode);
        const store = transaction.objectStore(ART_STORE);

        let result;
        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);

        result = handler(store);
    }));
}

export async function migrateLegacyGallery() {
    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
        return;
    }

    let legacyItems;
    try {
        legacyItems = JSON.parse(legacyRaw);
    } catch {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
    }

    if (!Array.isArray(legacyItems) || legacyItems.length === 0) {
        localStorage.removeItem(LEGACY_STORAGE_KEY);
        return;
    }

    await runTransaction("readwrite", (store) => {
        legacyItems.forEach((item) => {
            store.put({
                id: item.id ?? Date.now() + Math.random(),
                data: item.data,
                createdAt: item.createdAt ?? item.id ?? Date.now(),
                generation: item.generation ?? 1,
                parentId: item.parentId ?? null,
                genome: item.genome ?? null,
                metrics: item.metrics ?? null
            });
        });
    });

    localStorage.removeItem(LEGACY_STORAGE_KEY);
}

export async function saveArtwork(entry) {
    await runTransaction("readwrite", (store) => {
        store.put(entry);
    });

    return entry;
}

export async function getArtworks() {
    return runTransaction("readonly", (store) => new Promise((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => {
            const items = [...request.result].sort((a, b) => b.createdAt - a.createdAt);
            resolve(items);
        };
        request.onerror = () => reject(request.error);
    }));
}

export async function getArtworkById(id) {
    return runTransaction("readonly", (store) => new Promise((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result ?? null);
        request.onerror = () => reject(request.error);
    }));
}

export async function deleteArtwork(id) {
    await runTransaction("readwrite", (store) => {
        store.delete(id);
    });
}

export async function clearArtworks() {
    await runTransaction("readwrite", (store) => {
        store.clear();
    });
}

export function getEquippedArtworkId() {
    const raw = localStorage.getItem(EQUIPPED_ARTWORK_KEY);
    return raw ? Number(raw) : null;
}

export function setEquippedArtworkId(id) {
    if (id == null) {
        localStorage.removeItem(EQUIPPED_ARTWORK_KEY);
        return;
    }
    localStorage.setItem(EQUIPPED_ARTWORK_KEY, String(id));
}
