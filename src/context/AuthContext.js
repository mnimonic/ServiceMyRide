import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import * as db from '../storage/db';
import {
  findBackupFile, uploadBackup, downloadBackup, fetchUserInfo,
} from '../utils/googleDrive';

WebBrowser.maybeCompleteAuthSession();

const AUTH_KEY = 'servicemyride:auth:v1';
const Ctx = createContext(null);

// Client IDs come from env (EXPO_PUBLIC_* is exposed to the client at build).
// Fill these in from Google Cloud Console -> Credentials. See README.
// expo-auth-session throws if the platform's client id is `undefined` (even before
// signIn() is called), so fall back to '' rather than leaving it unset.
const CLIENT_IDS = {
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || '',
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || '',
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || '',
};

// Scopes: profile/email for identity, drive.appdata for the hidden backup folder.
const SCOPES = [
  'openid',
  'profile',
  'email',
  'https://www.googleapis.com/auth/drive.appdata',
];

export function AuthProvider({ children, onDataChanged }) {
  const [user, setUser] = useState(null);          // { name, email, picture }
  const [token, setToken] = useState(null);        // access token
  const [ready, setReady] = useState(false);       // finished restoring session
  const [syncState, setSyncState] = useState({ status: 'idle', lastSync: null, error: null });

  const [request, response, promptAsync] = Google.useAuthRequest({
    ...CLIENT_IDS,
    scopes: SCOPES,
  });

  const configured = !!(CLIENT_IDS.webClientId || CLIENT_IDS.androidClientId || CLIENT_IDS.iosClientId);

  // Restore a saved session on launch
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(AUTH_KEY);
        if (raw) {
          const saved = JSON.parse(raw);
          setUser(saved.user || null);
          setToken(saved.token || null);
          setSyncState((s) => ({ ...s, lastSync: saved.lastSync || null }));
        }
      } catch (e) {}
      setReady(true);
    })();
  }, []);

  // Handle the OAuth response
  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = response.authentication?.accessToken;
      if (accessToken) handleToken(accessToken);
    } else if (response?.type === 'error') {
      setSyncState((s) => ({ ...s, status: 'error', error: 'Sign-in failed' }));
    }
  }, [response]);

  async function handleToken(accessToken) {
    setToken(accessToken);
    try {
      const info = await fetchUserInfo(accessToken);
      const u = { name: info.name, email: info.email, picture: info.picture };
      setUser(u);
      await persistSession({ user: u, token: accessToken });
      // Auto pull-then-push on first sign-in so devices converge
      await syncNow(accessToken, u);
    } catch (e) {
      setSyncState((s) => ({ ...s, status: 'error', error: String(e.message || e) }));
    }
  }

  async function persistSession(patch) {
    const raw = await AsyncStorage.getItem(AUTH_KEY);
    const cur = raw ? JSON.parse(raw) : {};
    const next = { ...cur, ...patch };
    await AsyncStorage.setItem(AUTH_KEY, JSON.stringify(next));
  }

  const signIn = useCallback(() => {
    if (!configured) {
      setSyncState((s) => ({ ...s, status: 'error', error: 'Google client IDs not configured' }));
      return;
    }
    promptAsync();
  }, [configured, promptAsync]);

  const signOut = useCallback(async () => {
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem(AUTH_KEY);
    setSyncState({ status: 'idle', lastSync: null, error: null });
  }, []);

  // Core sync: pull remote (merge into local), then push merged result up.
  const syncNow = useCallback(async (tok = token, usr = user) => {
    if (!tok) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const existing = await findBackupFile(tok);
      if (existing) {
        const remote = await downloadBackup(tok, existing.id);
        await db.mergeAll(remote);
      }
      const merged = await db.dump();
      const fileMeta = await uploadBackup(tok, merged, existing?.id);
      const lastSync = fileMeta.modifiedTime || new Date().toISOString();
      setSyncState({ status: 'idle', lastSync, error: null });
      await persistSession({ lastSync });
      onDataChanged && onDataChanged(); // let app refresh from storage
    } catch (e) {
      // 401 -> token expired; force re-auth
      const msg = String(e.message || e);
      if (msg.includes('401')) {
        setSyncState({ status: 'expired', lastSync: syncState.lastSync, error: 'Session expired, sign in again' });
        await signOut();
      } else {
        setSyncState((s) => ({ ...s, status: 'error', error: msg }));
      }
    }
  }, [token, user, onDataChanged, signOut, syncState.lastSync]);

  // Explicit "push my current data up" (overwrites merge order toward local)
  const backupNow = useCallback(async () => {
    if (!token) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const existing = await findBackupFile(token);
      const data = await db.dump();
      const fileMeta = await uploadBackup(token, data, existing?.id);
      const lastSync = fileMeta.modifiedTime || new Date().toISOString();
      setSyncState({ status: 'idle', lastSync, error: null });
      await persistSession({ lastSync });
    } catch (e) {
      setSyncState((s) => ({ ...s, status: 'error', error: String(e.message || e) }));
    }
  }, [token]);

  // Explicit "replace local with cloud copy"
  const restoreNow = useCallback(async () => {
    if (!token) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const existing = await findBackupFile(token);
      if (!existing) {
        setSyncState((s) => ({ ...s, status: 'error', error: 'No cloud backup found' }));
        return;
      }
      const remote = await downloadBackup(token, existing.id);
      await db.replaceAll(remote);
      setSyncState({ status: 'idle', lastSync: new Date().toISOString(), error: null });
      onDataChanged && onDataChanged();
    } catch (e) {
      setSyncState((s) => ({ ...s, status: 'error', error: String(e.message || e) }));
    }
  }, [token, onDataChanged]);

  const api = {
    user, token, ready, configured, syncState,
    signIn, signOut, syncNow, backupNow, restoreNow,
    canPrompt: !!request,
    isSignedIn: !!user,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
