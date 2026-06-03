// Minimal IndexedDB key/value store, app-local and NOT synced — backs the
// per-device sync base/working copy that powers offline 3-way merge (local.js)
// and the stable device id. A same-origin iframe has full IndexedDB access.
// Each op opens + closes its own connection and resolves on transaction
// completion (not just request success) so a close can't abort an in-flight tx.
const DB_NAME = 'notes-local'
const STORE = 'kv'

function open() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB_NAME, 1)
    r.onupgradeneeded = () => {
      const db = r.result
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
    }
    r.onsuccess = () => resolve(r.result)
    r.onerror = () => reject(r.error)
  })
}

async function run(mode, fn) {
  const db = await open()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const store = tx.objectStore(STORE)
      const box = {}
      fn(store, box)
      tx.oncomplete = () => resolve(box.value)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export function idbGet(key) {
  return run('readonly', (store, box) => {
    const r = store.get(key)
    r.onsuccess = () => { box.value = r.result }
  })
}

export function idbSet(key, value) {
  return run('readwrite', (store) => { store.put(value, key) })
}

export function idbDel(key) {
  return run('readwrite', (store) => { store.delete(key) })
}

export function idbEntries() {
  return run('readonly', (store, box) => {
    box.value = []
    const r = store.openCursor()
    r.onsuccess = (e) => {
      const cur = e.target.result
      if (!cur) return
      box.value.push([cur.key, cur.value])
      cur.continue()
    }
  })
}
