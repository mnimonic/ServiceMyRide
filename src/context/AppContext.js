import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as db from '../storage/db';
import { setRefresh } from './refreshBridge';

const Ctx = createContext(null);

export function AppProvider({ children }) {
  const [state, setState] = useState({
    vehicles: [],
    maintenance: [],
    documents: [],
    inventory: [],
    reminders: [],
    drives: [],
    settings: { odoUnit: 'km' },
    loaded: false,
  });

  const refresh = useCallback(async () => {
    // db caches internally; force a re-read from AsyncStorage so post-sync
    // (restore/merge) data shows up. We reset the cache via load() which
    // returns the current cache — so we read straight from storage here.
    const data = await db.reload();
    setState({ ...data, loaded: true });
  }, []);

  useEffect(() => {
    refresh();
    setRefresh(refresh); // let AuthContext trigger a reload after Drive sync
  }, [refresh]);

  const api = {
    ...state,
    refresh,
    insert: async (c, item) => { const r = await db.insert(c, item); await refresh(); return r; },
    update: async (c, id, patch) => { const r = await db.update(c, id, patch); await refresh(); return r; },
    remove: async (c, id) => { await db.remove(c, id); await refresh(); },
    removeVehicle: async (id) => { await db.removeVehicleCascade(id); await refresh(); },
    setSettings: async (patch) => { await db.setSettings(patch); await refresh(); },
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useApp() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
