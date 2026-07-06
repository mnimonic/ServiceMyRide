import AsyncStorage from '@react-native-async-storage/async-storage';

// Single-key JSON store. Keeps everything in one document for simplicity and
// atomic writes. For larger datasets you'd move to SQLite/expo-sqlite.
const KEY = 'servicemyride:v1';

const EMPTY = {
  vehicles: [],       // {id,name,type,make,model,year,plate,odometer,photo,bleId,bleName,maintenanceOverrides}
  maintenance: [],    // {id,vehicleId,date,odometer,cost,notes,tasks:[{taskKey,label}]} — one record per service visit
  documents: [],      // {id,vehicleId,typeKey,label,dueDate,notifId,notes}
  inventory: [],      // {id,name,category,qty,vehicleId,purchaseDate,cost,notes,used}
  reminders: [],      // {id,vehicleId,title,body,date,repeat,notifId,enabled}
  drives: [],         // {id,vehicleId,start,end,bleName}
  settings: { odoUnit: 'km' },
};

let cache = null;

// Older records logged one task per record (`taskKey`/`label` directly on the
// record). Fold those into the current `tasks: [{taskKey,label}]` shape so
// the rest of the app only ever deals with one format.
function migrateMaintenance(db) {
  db.maintenance = (db.maintenance || []).map((m) => {
    if (m.tasks) return m;
    const { taskKey, label, ...rest } = m;
    return { ...rest, tasks: [{ taskKey, label }] };
  });
}

export async function load() {
  if (cache) return cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    cache = raw ? { ...EMPTY, ...JSON.parse(raw) } : { ...EMPTY };
  } catch (e) {
    cache = { ...EMPTY };
  }
  migrateMaintenance(cache);
  return cache;
}

async function persist() {
  await AsyncStorage.setItem(KEY, JSON.stringify(cache));
}

// Force a fresh read from storage (used after a Drive restore/merge rewrites it).
export async function reload() {
  cache = null;
  return load();
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Generic collection helpers -------------------------------------------------
export async function all(collection) {
  const db = await load();
  return db[collection] || [];
}

export async function insert(collection, item) {
  const db = await load();
  const record = { id: uid(), createdAt: Date.now(), ...item };
  db[collection] = [record, ...(db[collection] || [])];
  await persist();
  return record;
}

export async function update(collection, id, patch) {
  const db = await load();
  db[collection] = (db[collection] || []).map((r) =>
    r.id === id ? { ...r, ...patch } : r
  );
  await persist();
  return db[collection].find((r) => r.id === id);
}

export async function remove(collection, id) {
  const db = await load();
  db[collection] = (db[collection] || []).filter((r) => r.id !== id);
  await persist();
}

export async function getSettings() {
  const db = await load();
  return db.settings;
}

export async function setSettings(patch) {
  const db = await load();
  db.settings = { ...db.settings, ...patch };
  await persist();
  return db.settings;
}

// --- Backup / restore support -----------------------------------------------

// Return the entire DB document (used to push to Google Drive).
export async function dump() {
  const db = await load();
  return db;
}

// Overwrite the entire DB document (used when restoring from Drive).
// We shallow-merge onto EMPTY so any missing/newer collections stay valid.
export async function replaceAll(data) {
  cache = { ...EMPTY, ...data, settings: { ...EMPTY.settings, ...(data.settings || {}) } };
  migrateMaintenance(cache);
  await persist();
  return cache;
}

// Merge a remote backup into local data by id (last-write-wins per record,
// keyed on the record id). Simple union so nothing local is silently lost.
export async function mergeAll(remote) {
  const db = await load();
  const collections = ['vehicles', 'maintenance', 'documents', 'inventory', 'reminders', 'drives'];
  for (const c of collections) {
    const localArr = db[c] || [];
    const remoteArr = (remote && remote[c]) || [];
    const byId = new Map();
    // remote first, then local overrides (local considered fresher on device)
    for (const r of remoteArr) byId.set(r.id, r);
    for (const r of localArr) byId.set(r.id, r);
    db[c] = Array.from(byId.values());
  }
  db.settings = { ...(remote?.settings || {}), ...db.settings };
  migrateMaintenance(db);
  await persist();
  return db;
}

// Cascade delete a vehicle and its related records
export async function removeVehicleCascade(vehicleId) {
  const db = await load();
  db.vehicles = db.vehicles.filter((v) => v.id !== vehicleId);
  db.maintenance = db.maintenance.filter((m) => m.vehicleId !== vehicleId);
  db.documents = db.documents.filter((d) => d.vehicleId !== vehicleId);
  db.reminders = db.reminders.filter((r) => r.vehicleId !== vehicleId);
  db.inventory = db.inventory.map((i) =>
    i.vehicleId === vehicleId ? { ...i, vehicleId: null } : i
  );
  db.drives = db.drives.filter((dr) => dr.vehicleId !== vehicleId);
  await persist();
}
