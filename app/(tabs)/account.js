import React from 'react';
import { View, Text, ScrollView, StyleSheet, Image, ActivityIndicator, TouchableOpacity, Linking } from 'react-native';
import { useAuth } from '../../src/context/AuthContext';
import { Card, Button, Badge } from '../../src/components/ui';
import { COLORS as C } from '../../src/constants';
import { fmtDateTime } from '../../src/utils/helpers';
import { confirmAction } from '../../src/utils/confirm';

function GoogleButton({ onPress, disabled }) {
  return (
    <TouchableOpacity onPress={onPress} disabled={disabled}
      style={[gb.btn, disabled && { opacity: 0.5 }]}>
      <View style={gb.g}><Text style={gb.gText}>G</Text></View>
      <Text style={gb.label}>Continue with Google</Text>
    </TouchableOpacity>
  );
}

const gb = StyleSheet.create({
  btn: {
    backgroundColor: '#fff', borderRadius: 12, paddingVertical: 13,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
  },
  g: { width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  gText: { color: '#4285F4', fontWeight: '900', fontSize: 18 },
  label: { color: '#1f1f1f', fontWeight: '700', fontSize: 15 },
});

export default function Account() {
  const auth = useAuth();

  function syncLabel() {
    const s = auth.syncState;
    if (s.status === 'syncing') return 'Syncing…';
    if (s.status === 'error') return s.error || 'Error';
    if (s.status === 'expired') return 'Session expired';
    if (s.lastSync) return `Last synced ${fmtDateTime(s.lastSync)}`;
    return 'Not synced yet';
  }

  function syncColor() {
    const st = auth.syncState.status;
    if (st === 'error' || st === 'expired') return C.red;
    if (st === 'syncing') return C.amber;
    return C.green;
  }

  function confirmDeleteCloudBackup() {
    confirmAction(
      'Delete cloud backup?',
      'This permanently deletes your backup file from Google Drive. Nothing on this device is affected — it stays exactly as it is.',
      () => {
        confirmAction(
          'Are you sure?',
          'This cannot be undone. Once deleted, the Google Drive backup cannot be recovered.',
          () => auth.deleteCloudBackup(),
          'Delete permanently'
        );
      },
      'Continue'
    );
  }

  return (
    <ScrollView style={{ flex: 1, backgroundColor: C.bg }} contentContainerStyle={{ padding: 16, paddingBottom: 40 }}>
      <Text style={s.title}>Account & Backup</Text>

      {!auth.configured && (
        <Card style={{ borderColor: C.amber }}>
          <Text style={s.h}>⚙️ Setup needed</Text>
          <Text style={s.dim}>
            Google sign-in isn't configured yet. Add your OAuth client IDs from Google Cloud Console
            to a .env file (EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID, _ANDROID_CLIENT_ID, _IOS_CLIENT_ID),
            then rebuild. See the README section “Google & Drive setup”.
          </Text>
        </Card>
      )}

      {auth.isSignedIn ? (
        <>
          <Card>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
              {auth.user.picture ? (
                <Image source={{ uri: auth.user.picture }} style={s.avatar} />
              ) : (
                <View style={[s.avatar, s.avatarFallback]}><Text style={{ fontSize: 22 }}>👤</Text></View>
              )}
              <View style={{ flex: 1 }}>
                <Text style={s.name}>{auth.user.name}</Text>
                <Text style={s.dim}>{auth.user.email}</Text>
              </View>
            </View>
          </Card>

          <Card>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={s.h}>☁️ Google Drive Sync</Text>
              <Badge label={syncLabel()} color={syncColor()} />
            </View>
            <Text style={s.dim}>
              Your data is stored in a private app folder in your Google Drive. It's not visible in
              your normal Drive files and only this app can read it.
            </Text>

            <View style={{ height: 12 }} />
            {auth.syncState.status === 'syncing' ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 }}>
                <ActivityIndicator color={C.accent} />
                <Text style={s.dim}>Working…</Text>
              </View>
            ) : (
              <>
                <Button title="Sync now (merge)" onPress={() => auth.syncNow()} />
                <View style={{ height: 8 }} />
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <Button title="Back up ↑" variant="secondary" small style={{ flex: 1 }} onPress={auth.backupNow} />
                  <Button title="Restore ↓" variant="secondary" small style={{ flex: 1 }} onPress={auth.restoreNow} />
                </View>
              </>
            )}
            {auth.syncState.error ? <Text style={[s.dim, { color: C.red, marginTop: 10 }]}>{auth.syncState.error}</Text> : null}
          </Card>

          <Card>
            <Text style={s.dim}>
              “Sync now” pulls the cloud copy, merges it with what's on this device, and pushes the
              result back — safe to run on multiple devices. “Restore” overwrites local data with the
              cloud copy. “Back up” overwrites the cloud copy with this device's data.
            </Text>
          </Card>

          <Card style={{ borderColor: C.red }}>
            <Text style={s.h}>Delete cloud backup</Text>
            <Text style={s.dim}>
              Permanently removes your backup file from Google Drive. Your vehicles, logs, documents
              and reminders on this device are not touched.
            </Text>
            <View style={{ height: 12 }} />
            <Button
              title="Delete cloud backup"
              variant="danger"
              small
              onPress={confirmDeleteCloudBackup}
            />
          </Card>

          <Button title="Sign out" variant="danger" onPress={auth.signOut} style={{ marginTop: 8 }} />
        </>
      ) : (
        <Card>
          <Text style={s.h}>Sign in to back up your garage</Text>
          <Text style={s.dim}>
            Sign in with Google to save your vehicles, service history, inventory, documents and
            reminders to your own Google Drive, and sync across devices.
          </Text>
          <View style={{ height: 14 }} />
          <GoogleButton onPress={auth.signIn} disabled={!auth.canPrompt} />
          <Text style={[s.dim, { textAlign: 'center', marginTop: 10 }]}>
            Requires a development/production build (not Expo Go).
          </Text>
          {auth.syncState.error ? <Text style={[s.dim, { color: C.red, marginTop: 10 }]}>{auth.syncState.error}</Text> : null}
        </Card>
      )}

      <Text style={[s.dim, { marginTop: 16, textAlign: 'center' }]}>
        Data is always kept on your device too — Google Drive is only for backup and multi-device sync.
      </Text>

      <Text style={[s.dim, { marginTop: 24, textAlign: 'center', fontSize: 11 }]}>
        ServiceMyRide is free and open source.{'\n'}Developed by George Danilopoulos.
      </Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://github.com/mnimonic/ServiceMyRide')}>
        <Text style={[s.dim, { marginTop: 4, textAlign: 'center', fontSize: 11, color: C.accent }]}>
          View source on GitHub
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  title: { color: C.text, fontSize: 24, fontWeight: '800', marginBottom: 14 },
  h: { color: C.text, fontSize: 16, fontWeight: '700' },
  name: { color: C.text, fontSize: 18, fontWeight: '700' },
  dim: { color: C.textDim, fontSize: 13, lineHeight: 19 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.cardAlt },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
});
