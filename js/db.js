// IndexedDB: тренировки целиком (store "workouts") и прочее — заметки, настройки (store "kv").

const DB_NAME = 'gymlog';
const DB_VERSION = 1;

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('workouts')) db.createObjectStore('workouts', { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

const result = (req) =>
  new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

const complete = (tx) =>
  new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = tx.onabort = () => reject(tx.error);
  });

export async function loadAll() {
  const db = await open();
  const tx = db.transaction(['workouts', 'kv']);
  const kvStore = tx.objectStore('kv');
  const [workouts, keys, values] = await Promise.all([
    result(tx.objectStore('workouts').getAll()),
    result(kvStore.getAllKeys()),
    result(kvStore.getAll()),
  ]);
  const kv = {};
  keys.forEach((k, i) => (kv[k] = values[i]));
  return { workouts, kv };
}

export async function putWorkout(workout) {
  const db = await open();
  const tx = db.transaction('workouts', 'readwrite');
  tx.objectStore('workouts').put(workout);
  return complete(tx);
}

export async function deleteWorkout(id) {
  const db = await open();
  const tx = db.transaction('workouts', 'readwrite');
  tx.objectStore('workouts').delete(id);
  return complete(tx);
}

export async function setKV(key, value) {
  const db = await open();
  const tx = db.transaction('kv', 'readwrite');
  tx.objectStore('kv').put(value, key);
  return complete(tx);
}

// Полная замена данных — для импорта из резервной копии и сброса.
export async function replaceAll({ workouts, kv }) {
  const db = await open();
  const tx = db.transaction(['workouts', 'kv'], 'readwrite');
  const ws = tx.objectStore('workouts');
  const ks = tx.objectStore('kv');
  ws.clear();
  ks.clear();
  for (const w of workouts) ws.put(w);
  for (const [k, v] of Object.entries(kv)) ks.put(v, k);
  return complete(tx);
}
