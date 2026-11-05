import Dexie from 'dexie';

/**
 * On-device storage for slow or missing signal.
 *
 * Three stores:
 * - cache:  the last good response for a read, so a page can open offline.
 * - drafts: form work saved before it has ever reached the server.
 * - outbox: writes waiting to be sent when signal returns.
 *
 * The database is opened lazily and quietly disabled when the browser has no
 * IndexedDB (for example during a unit test in jsdom). Every helper then
 * behaves as a no-op instead of breaking the page.
 */

let db = null;
let unavailable = false;

export function getDb() {
  if (db || unavailable) return db;
  if (typeof indexedDB === 'undefined') {
    unavailable = true;
    return null;
  }
  try {
    db = new Dexie('placa_offline');
    db.version(1).stores({
      cache: 'key, updated_at',
      drafts: 'key, updated_at',
      outbox: '++id, kind, created_at',
    });
  } catch {
    unavailable = true;
    db = null;
  }
  return db;
}

const listeners = new Set();

export function onOutboxChange(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function announce() {
  for (const listener of listeners) {
    try {
      listener();
    } catch {
      // A broken listener must not stop a save.
    }
  }
}

function now() {
  return new Date().toISOString();
}

export async function cacheSet(key, value) {
  const store = getDb();
  if (!store) return;
  try {
    await store.cache.put({ key, value, updated_at: now() });
  } catch {
    // Cache is best effort.
  }
}

export async function cacheGet(key) {
  const store = getDb();
  if (!store) return null;
  try {
    const row = await store.cache.get(key);
    return row ? row.value : null;
  } catch {
    return null;
  }
}

export async function cacheClear(prefix) {
  const store = getDb();
  if (!store) return;
  try {
    if (!prefix) await store.cache.clear();
    else await store.cache.where('key').startsWith(prefix).delete();
  } catch {
    // ignore
  }
}

export async function saveDraft(key, data) {
  const store = getDb();
  if (!store) return;
  try {
    await store.drafts.put({ key, data, updated_at: now() });
  } catch {
    // ignore
  }
}

export async function getDraft(key) {
  const store = getDb();
  if (!store) return null;
  try {
    const row = await store.drafts.get(key);
    return row ? row.data : null;
  } catch {
    return null;
  }
}

export async function deleteDraft(key) {
  const store = getDb();
  if (!store) return;
  try {
    await store.drafts.delete(key);
  } catch {
    // ignore
  }
}

export async function listDrafts(prefix = '') {
  const store = getDb();
  if (!store) return [];
  try {
    const rows = await store.drafts.toArray();
    return rows
      .filter((row) => !prefix || row.key.startsWith(prefix))
      .sort((left, right) => String(right.updated_at).localeCompare(String(left.updated_at)));
  } catch {
    return [];
  }
}

export async function enqueueOutbox({ kind, payload, label = '', submit = false }) {
  const store = getDb();
  if (!store) return null;
  try {
    const id = await store.outbox.add({
      kind,
      payload,
      label,
      submit,
      attempts: 0,
      last_error: null,
      created_at: now(),
    });
    announce();
    return id;
  } catch {
    return null;
  }
}

export async function listOutbox() {
  const store = getDb();
  if (!store) return [];
  try {
    return await store.outbox.orderBy('created_at').toArray();
  } catch {
    return [];
  }
}

export async function removeOutbox(id) {
  const store = getDb();
  if (!store) return;
  try {
    await store.outbox.delete(id);
    announce();
  } catch {
    // ignore
  }
}

export async function updateOutbox(id, changes) {
  const store = getDb();
  if (!store) return;
  try {
    await store.outbox.update(id, changes);
    announce();
  } catch {
    // ignore
  }
}

export async function outboxCount() {
  const store = getDb();
  if (!store) return 0;
  try {
    return await store.outbox.count();
  } catch {
    return 0;
  }
}
