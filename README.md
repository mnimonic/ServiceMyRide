# ServiceMyRide

A cross-platform (Android / iOS / Web) vehicle service tracker built with **React Native + Expo (expo-router)**.

## Features

- **Multi-vehicle garage** — cars, motorcycles, electric scooters, or custom types. Per-vehicle odometer, make/model/year/plate.
- **Maintenance tracking** — pick from a preset list (engine oil, oil filter, air filter, cabin filter, brake pads/fluid, coolant, spark plugs, chain, tires, battery…) filtered by vehicle type, **or enter your own custom task**. Each log stores date, odometer, cost and notes.
- **Smart due status** — computes “OK / Soon / Overdue” per task using time intervals *and* odometer intervals, and surfaces alerts on the home dashboard.
- **Parts inventory** — track items you’ve bought but not used yet, with category, quantity, cost, linked vehicle, and a “mark used / in stock” toggle. Shows total stock value.
- **Documents & due dates** — insurance, registration/license, KTEO inspection, road tax, warranty. Auto-schedules an expiry reminder N days before the due date.
- **Reminders** — one-off or repeating (daily/weekly/monthly) local notifications. Quick presets like “Charge the battery”.
- **Bluetooth drive detection** — pair a vehicle with its Bluetooth device (head unit, helmet intercom, scooter dongle). When that device connects, a drive session auto-opens; when it disconnects, it closes. Manual drive logging also available (and it’s the fallback on web).
- **Login with Google + Google Drive backup** — sign in with your Google account and back up all your data to a private folder in your own Google Drive, synced across devices. Works on web, iOS and Android.

All data is stored locally on-device via AsyncStorage (single JSON document, easy to migrate to SQLite later). Google Drive is used only for backup/sync — the app works fully offline without signing in.

## Google & Drive setup

Web and iOS use `expo-auth-session` for “Login with Google”; Android uses `@react-native-google-signin/google-signin` (a native Play Services flow), because **Google no longer supports custom-scheme redirects for Android OAuth clients** — the browser-redirect approach `expo-auth-session` relies on cannot work there anymore. All platforms use the Google Drive REST API for backup. Backups live in Drive’s **appDataFolder** — a hidden, per-app folder — so we only request the narrow `drive.appdata` scope, and your backup never clutters your visible Drive.

1. **Create a Google Cloud project** → https://console.cloud.google.com
2. **OAuth consent screen**: configure it (External is fine for personal use), add your email as a test user, and under **Data access → Add or remove scopes** add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and (search “Drive”, from the **Google Drive API**) `.../auth/drive.appdata`.
3. **Enable the Google Drive API** under APIs & Services → Library — the `drive.appdata` scope won’t show up in step 2 until this is enabled.
4. **Create credentials → OAuth client IDs**, one per platform you target:
   - **Web application** — add your dev URL (e.g. `http://localhost:8081`) to *Authorized JavaScript origins* and the Expo auth redirect to *Authorized redirect URIs*. **This one is also required for Android**: the native sign-in library authenticates the app via Play Services (using the Android client below) but is *configured* with the Web client id.
   - **iOS** — bundle id `com.servicemyride.app`.
   - **Android** — package `com.servicemyride.app` + the SHA-1 of your signing key (debug keystore for local dev-client builds: `keytool -list -v -keystore ~/.android/debug.keystore -alias androiddebugkey -storepass android -keypass android`; production key via `eas credentials`).
5. **Copy `.env.example` to `.env`** and paste the client IDs:
   ```
   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=...
   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=...
   ```
6. Rebuild (`npx expo prebuild` then `npx expo run:android`/`run:ios` — the Android sign-in library is a native module, so a Metro-only restart isn't enough after first install). Open the **Account** tab and tap **Continue with Google**.

> Like Bluetooth and notifications, Google Sign-In needs a **development build** on device — it does not work in Expo Go. On web it works with just the Web client ID.

### How sync works

- **Sign in** pulls any existing cloud backup, merges it with local data, and pushes the result back.
- **Sync now (merge)** — same pull-merge-push; safe to run on multiple devices (union of records by id, local wins on conflicts).
- **Back up ↑** — overwrite the cloud copy with this device’s data.
- **Restore ↓** — overwrite this device’s data with the cloud copy.
- The Garage screen auto-syncs once on open when you’re signed in.

If an access token expires (401), the app signs you out so you can re-authenticate. For long-lived silent refresh you’d add a backend to exchange the OAuth refresh token; the current setup keeps everything client-side.

## Requirements

- Node.js 18+ and npm
- Expo CLI (`npm i -g expo` optional; `npx expo` works)
- For Bluetooth + notifications on device: a **development build** (not Expo Go), because `react-native-ble-plx` is a native module.

## Setup

```bash
cd ServiceMyRide
npm install
```

## Run

**Web** (fastest to preview; Bluetooth/notifications degrade to manual/no-op):
```bash
npm run web
```

**Android / iOS with native modules (Bluetooth + notifications):**
```bash
# one-time: create a dev build
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android      # or: npx expo run:ios (needs macOS + Xcode)
```

Then `npm start` and open the dev build.

> Expo Go does **not** include `react-native-ble-plx`. The app still runs there, but Bluetooth pairing shows a “not available” message. Use a dev build for full functionality.

## Project structure

```
app/
  _layout.js               Root stack + AppProvider + AuthProvider
  (tabs)/
    _layout.js             Bottom tab navigator
    index.js               Garage: vehicle list + dashboard alerts + auto-sync
    reminders.js           Reminders (local notifications)
    inventory.js           Parts inventory
    documents.js           Insurance / registration / due dates
    account.js             Google sign-in + Drive backup/restore/sync
  vehicle/[id].js          Vehicle detail: maintenance, BLE pairing, drives
src/
  constants/index.js       Colors, vehicle types, maintenance presets, doc types
  context/
    AppContext.js          Global data state + CRUD wrappers
    AuthContext.js         Google auth, token storage, Drive sync logic
    refreshBridge.js       Lets AuthContext trigger an AppContext reload post-sync
  storage/db.js            AsyncStorage repository (+ dump/replaceAll/mergeAll)
  components/ui.js         Reusable UI (Card, Button, Field, Chip, Sheet, Badge…)
  utils/
    notifications.js       expo-notifications scheduling
    bluetooth.js           react-native-ble-plx drive detection
    googleDrive.js         Google Drive REST API (appDataFolder backup)
    helpers.js             Dates + maintenance-status computation
```

## Customizing maintenance intervals

Edit `src/constants/index.js` → `MAINTENANCE_PRESETS`. Each entry has:
- `intervalKm` — odometer-based interval (or `null`)
- `intervalMonths` — time-based interval (or `null`)
- `appliesTo` — which vehicle types show this task

## Notes on Bluetooth detection

BLE `isDeviceConnected` polling (15s) is used as a portable approach. For true background detection when the app is closed, you’d add background BLE + a foreground service (Android) / background modes (iOS) — the config in `app.json` already enables the permissions and background mode flags to build on.
