# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

ServiceMyRide — a cross-platform (Android/iOS) vehicle service tracker built with React Native + Expo (expo-router, SDK 51). No backend: all data lives on-device in a single AsyncStorage JSON document, with optional Google Drive backup/sync. Web is not a supported target — the app relies on native modules (Classic Bluetooth, GPS, notifications, native Google Sign-In) throughout.

## Commands

```bash
npm install       # install deps
npm start         # start Metro, then open in a dev build (see below)
npm run android   # expo start --android
npm run ios       # expo start --ios
```

There is no test suite, lint config, or build/typecheck script in this repo — don't assume one exists.

Native modules (the local `modules/servicemyride-bluetooth`, `expo-notifications`) don't work in Expo Go. To test Bluetooth drive detection or local notifications on a device, a dev client build is required:

```bash
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android   # or npx expo run:ios (needs macOS + Xcode)
```

Google Sign-In requires client IDs in `.env` (copied from `.env.example`, `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`) — see README.md for the full Google Cloud Console setup. Without them, `AuthContext.configured` is false and sign-in shows a "not configured" error instead of crashing.

## Architecture

### Data layer: single-document store

`src/storage/db.js` is the only place that touches AsyncStorage. Everything (vehicles, maintenance, documents, inventory, reminders, drives, settings) lives under one key (`servicemyride:v1`) as one JSON blob, cached in memory (`cache`) after first `load()`. All mutations go through generic `insert(collection, item)` / `update(collection, id, patch)` / `remove(collection, id)` — there's no per-entity module. `removeVehicleCascade(id)` is the one hand-written exception, since deleting a vehicle must cascade into maintenance/documents/reminders/drives (inventory is unlinked, not deleted). When adding a new record type, add it to `EMPTY` and the `collections` array in `mergeAll`, not a new file.

### State: two independent contexts + an event bridge

- `src/context/AppContext.js` wraps `db.js` in React state and re-`refresh()`es (a full re-read from storage) after every mutation. Screens consume it via `useApp()`.
- `src/context/AuthContext.js` owns Google sign-in and Drive sync (`src/utils/googleDrive.js`), independently of `AppContext`. Sign-in is platform-split: Android uses `@react-native-google-signin/google-signin` (native Play Services flow — Google dropped custom-scheme redirect support for Android OAuth clients, so `expo-auth-session`'s browser-redirect flow can't work there), while iOS still uses `expo-auth-session`. Both paths converge on the same `handleToken(accessToken)`.
- These two contexts deliberately don't import each other. Since a Drive sync/restore rewrites AsyncStorage out from under `AppContext`'s in-memory cache, `AuthContext` must trigger a reload — it does so through `src/context/refreshBridge.js`, a tiny module-level callback registry, wired up in `app/_layout.js` (`<AuthProvider onDataChanged={triggerRefresh}>`). If you add a third piece of cross-context state, follow this same one-directional bridge pattern rather than merging the two contexts or having them import each other.

### Sync semantics (`AuthContext` + `db.js`)

Three distinct operations, not to be confused:
- **`syncNow`** (auto-runs on sign-in and once when the Garage tab opens): pull remote → `mergeAll` into local (union by record `id`, local wins on conflict) → `dump()` and push the merged result back up.
- **`backupNow`** ("Back up ↑"): overwrite the cloud file with local data, no merge.
- **`restoreNow`** ("Restore ↓"): overwrite local data with the cloud file (`replaceAll`), no merge.

A 401 during sync is treated as an expired token, but recovery is platform-split: on Android, `getFreshToken()` asks `GoogleSignin.getTokens()` for a current access token before every Drive call (Play Services holds its own refresh token and silently mints a new one, no UI) — a 401/`SIGN_IN_REQUIRED` only reaches `handleExpiredToken()` (force-sign-out) if that on-device session is truly gone. On launch, the restore effect similarly calls `GoogleSignin.signInSilently()` before trusting the cached token, since the native module's session doesn't survive a cold start on its own. iOS has no such refresh path (`expo-auth-session`'s implicit flow never returns a refresh token, and there's no backend to exchange one), so a 401 there always force-signs-out.

Drive storage uses the `appDataFolder` scope (`src/utils/googleDrive.js`) — a hidden per-app folder — so only `drive.appdata` is requested, not full Drive access. The whole DB document is one file (`servicemyride-backup.json`); there's no per-collection sync.

### Maintenance due-status logic

`src/utils/helpers.js:computeMaintenanceStatus(vehicle, maintenanceRecords)` is the core domain logic: for each `MAINTENANCE_PRESETS` entry applicable to the vehicle's type, it finds the most recent matching record and independently checks both a time interval (`intervalMonths`) and an odometer interval (`intervalKm`), taking the worse of the two (`overdue` > `soon` > `ok`). This same function drives both the per-vehicle detail screen and the home-dashboard alerts, so changes here affect both. Maintenance intervals are configured in `src/constants/index.js` (`MAINTENANCE_PRESETS`), not hardcoded in components.

### Bluetooth drive detection

Android only — there is no public API on iOS for a third-party app to enumerate already-paired Classic Bluetooth accessories or observe their connection state (Apple restricts that to MFi accessories via ExternalAccessory), so `src/utils/bluetooth.js:isSupported()` is hardcoded false off-Android.

The app never scans for or initiates its own Bluetooth connection — the user pairs the vehicle's Bluetooth (head unit, intercom, dongle) once via the phone's own OS Bluetooth settings, then picks it from that already-paired/bonded list in `app/vehicle/[id].js`. `modules/servicemyride-bluetooth` is a local native module (Kotlin, autolinked from `./modules` — see its `expo-module.config.json`) that exposes `getBondedDevices()` and `startMonitoring(deviceId)`/`stopMonitoring()`. Monitoring registers an Android `BroadcastReceiver` for the system-level `ACTION_ACL_CONNECTED`/`ACTION_ACL_DISCONNECTED` intents (the same signal Android fires for any Classic Bluetooth link — HFP/A2DP/SPP — which is what virtually all vehicle Bluetooth uses, unlike BLE) filtered to the selected device's address, and emits `onDeviceConnected`/`onDeviceDisconnected` events back to JS. `src/utils/bluetooth.js` wraps that in `listPairedDevices()` and `monitorDevice(deviceId, {onConnect, onDisconnect})`; a vehicle stores the chosen device by id/name (`bleId`/`bleName`), and connect/disconnect open/close a drive session with GPS distance tracking (see `app/vehicle/[id].js`). This only runs while the vehicle detail screen is mounted — there's no background service.

### Routing

`app/` uses expo-router file-based routing. `app/_layout.js` sets up the provider tree (`SafeAreaProvider > AppProvider > AuthProvider > Stack`) and global stack chrome. `app/(tabs)/` is the bottom-tab group (Garage/Reminders/Inventory/Documents/Account); `app/vehicle/[id].js` is the vehicle detail screen (maintenance history, Bluetooth device select, drives) reached from the Garage tab.

### UI

`src/components/ui.js` holds all shared primitives (Card, Button, Field, Chip, Sheet, Badge, etc.) — screens compose these rather than styling raw RN components inline. Colors come from `COLORS` in `src/constants/index.js` (a single dark theme, referenced as `C` by convention) — don't hardcode hex colors in screens.
