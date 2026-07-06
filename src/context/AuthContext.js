import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
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

// Google removed custom-scheme redirect support for Android OAuth clients
// entirely ("Custom URI schemes are no longer supported on Android"), so
// expo-auth-session's browser-redirect flow can't work there anymore. Android
// signs in through the native Play Services flow instead (no redirect URI —
// Play Services authenticates the app via the package+SHA-1 already
// registered on the Android OAuth client). iOS/web still use expo-auth-session.
//
// iOS OAuth clients still redirect through the reversed-client-id scheme
// Google issues per client (e.g. com.googleusercontent.apps.<client-id>),
// which is registered as an additional `scheme` in app.config.js.
function reversedClientIdScheme(clientId) {
  const suffix = '.apps.googleusercontent.com';
  if (!clientId || !clientId.endsWith(suffix)) return null;
  return `com.googleusercontent.apps.${clientId.slice(0, -suffix.length)}`;
}

const NATIVE_REDIRECT_SCHEME = Platform.OS === 'ios' ? reversedClientIdScheme(CLIENT_IDS.iosClientId) : null;

function isSignInRequiredError(e) {
  return e?.code === statusCodes.SIGN_IN_REQUIRED;
}

export function AuthProvider({ children, onDataChanged }) {
  const [user, setUser] = useState(null);          // { name, email, picture }
  const [token, setToken] = useState(null);        // access token
  const [ready, setReady] = useState(false);       // finished restoring session
  const [syncState, setSyncState] = useState({ status: 'idle', lastSync: null, error: null });

  const [request, response, promptAsync] = Google.useAuthRequest(
    { ...CLIENT_IDS, scopes: SCOPES },
    NATIVE_REDIRECT_SCHEME ? { native: `${NATIVE_REDIRECT_SCHEME}:/oauth2redirect` } : {}
  );

  const configured = !!(CLIENT_IDS.webClientId || CLIENT_IDS.androidClientId || CLIENT_IDS.iosClientId);

  // Native Google Sign-In (Android) is configured against the *web* client id
  // — Play Services derives the Android client from the app's own signing
  // cert + package name, matched within the same Cloud project as this id.
  useEffect(() => {
    if (Platform.OS === 'android' && CLIENT_IDS.webClientId) {
      GoogleSignin.configure({
        webClientId: CLIENT_IDS.webClientId,
        scopes: ['https://www.googleapis.com/auth/drive.appdata'],
        offlineAccess: false,
      });
    }
  }, []);

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
        // Android: the native module's in-memory session doesn't survive a
        // cold start on its own, even though Play Services still holds a
        // refresh token on-device. Re-establish it via signInSilently (no UI)
        // so getTokens() below returns a live access token instead of the one
        // we cached (which may be hours old by now).
        if (Platform.OS === 'android' && GoogleSignin.hasPreviousSignIn()) {
          const result = await GoogleSignin.signInSilently();
          if (result.type === 'success') {
            const { user: u } = result.data;
            const tokens = await GoogleSignin.getTokens();
            const profile = { name: u.name, email: u.email, picture: u.photo };
            setUser(profile);
            setToken(tokens.accessToken);
            await persistSession({ user: profile, token: tokens.accessToken });
          } else {
            // Play Services has no saved credential (revoked / signed out on
            // device elsewhere) - our cached copy is stale, drop it.
            await clearSession();
          }
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

  async function signInAndroid() {
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();
      await handleToken(tokens.accessToken);
    } catch (e) {
      setSyncState((s) => ({ ...s, status: 'error', error: String(e.message || e) }));
    }
  }

  const signIn = useCallback(() => {
    if (!configured) {
      setSyncState((s) => ({ ...s, status: 'error', error: 'Google client IDs not configured' }));
      return;
    }
    if (Platform.OS === 'android') {
      signInAndroid();
      return;
    }
    promptAsync();
  }, [configured, promptAsync]);

  const clearSession = useCallback(async () => {
    if (Platform.OS === 'android') {
      try { await GoogleSignin.signOut(); } catch (e) {}
    }
    setUser(null);
    setToken(null);
    await AsyncStorage.removeItem(AUTH_KEY);
  }, []);

  const signOut = useCallback(async () => {
    await clearSession();
    setSyncState({ status: 'idle', lastSync: null, error: null });
  }, [clearSession]);

  // Shared 401 handling: access tokens expire (~1hr) and there's no backend to
  // hold a refresh token, so the only recovery is forcing the user to sign in
  // again. Setting syncState *after* clearSession (not before) so signOut's
  // own state reset can't clobber the "Session expired" message.
  const handleExpiredToken = useCallback(async () => {
    await clearSession();
    setSyncState((s) => ({ status: 'expired', lastSync: s.lastSync, error: 'Session expired, sign in again' }));
  }, [clearSession]);

  // On Android, Play Services holds its own refresh token and can mint a new
  // access token with no UI, so always ask it for a current one right before
  // hitting the Drive API rather than trusting whatever we cached at sign-in
  // (which may be well past its ~1hr expiry by now). iOS/web have no refresh
  // mechanism (see CLAUDE.md), so fall back to the token we already have.
  // Throws (SIGN_IN_REQUIRED) only if the on-device session is truly gone.
  const getFreshToken = useCallback(async (fallback) => {
    if (Platform.OS !== 'android') return fallback;
    const tokens = await GoogleSignin.getTokens();
    if (tokens.accessToken !== token) {
      setToken(tokens.accessToken);
      await persistSession({ token: tokens.accessToken });
    }
    return tokens.accessToken;
  }, [token]);

  // Core sync: pull remote (merge into local), then push merged result up.
  const syncNow = useCallback(async (tok = token, usr = user) => {
    if (!tok) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      tok = await getFreshToken(tok);
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
      const msg = String(e.message || e);
      if (msg.includes('401') || isSignInRequiredError(e)) {
        await handleExpiredToken();
      } else {
        setSyncState((s) => ({ ...s, status: 'error', error: msg }));
      }
    }
  }, [token, user, onDataChanged, handleExpiredToken, getFreshToken]);

  // Explicit "push my current data up" (overwrites merge order toward local)
  const backupNow = useCallback(async () => {
    if (!token) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const tok = await getFreshToken(token);
      const existing = await findBackupFile(tok);
      const data = await db.dump();
      const fileMeta = await uploadBackup(tok, data, existing?.id);
      const lastSync = fileMeta.modifiedTime || new Date().toISOString();
      setSyncState({ status: 'idle', lastSync, error: null });
      await persistSession({ lastSync });
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('401') || isSignInRequiredError(e)) {
        await handleExpiredToken();
      } else {
        setSyncState((s) => ({ ...s, status: 'error', error: msg }));
      }
    }
  }, [token, handleExpiredToken, getFreshToken]);

  // Explicit "replace local with cloud copy"
  const restoreNow = useCallback(async () => {
    if (!token) return;
    setSyncState((s) => ({ ...s, status: 'syncing', error: null }));
    try {
      const tok = await getFreshToken(token);
      const existing = await findBackupFile(tok);
      if (!existing) {
        setSyncState((s) => ({ ...s, status: 'error', error: 'No cloud backup found' }));
        return;
      }
      const remote = await downloadBackup(tok, existing.id);
      await db.replaceAll(remote);
      setSyncState({ status: 'idle', lastSync: new Date().toISOString(), error: null });
      onDataChanged && onDataChanged();
    } catch (e) {
      const msg = String(e.message || e);
      if (msg.includes('401') || isSignInRequiredError(e)) {
        await handleExpiredToken();
      } else {
        setSyncState((s) => ({ ...s, status: 'error', error: msg }));
      }
    }
  }, [token, onDataChanged, handleExpiredToken, getFreshToken]);

  const api = {
    user, token, ready, configured, syncState,
    signIn, signOut, syncNow, backupNow, restoreNow,
    canPrompt: Platform.OS === 'android' ? true : !!request,
    isSignedIn: !!user,
  };

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
