<div align="center">

<img src="./assets/icon.png" width="96" alt="ServiceMyRide icon" />

# ServiceMyRide

**Your garage, in your pocket — no backend, no subscription, no ads.**

A cross-platform vehicle service tracker built with **React Native + Expo**.
Track maintenance, documents, inventory, and drives for every car, bike, or scooter you own — entirely on-device.

[![Expo SDK](https://img.shields.io/badge/Expo-SDK%2051-000020?logo=expo&logoColor=white)](https://expo.dev)
[![React Native](https://img.shields.io/badge/React%20Native-0.74-61DAFB?logo=react&logoColor=black)](https://reactnative.dev)
[![Platforms](https://img.shields.io/badge/platform-Android%20%7C%20iOS%20%7C%20Web-informational)](#requirements)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](#contributing)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

</div>

---

## Contents

- [Why ServiceMyRide?](#why-servicemyride)
- [Features](#features)
- [Requirements](#requirements)
- [Setup](#setup)
- [Run](#run)
- [Google Sign-In & Drive backup](#google-sign-in--drive-backup)
- [Project structure](#project-structure)
- [Customizing maintenance intervals](#customizing-maintenance-intervals)
- [Notes on Bluetooth detection](#notes-on-bluetooth-detection)
- [Contributing](#contributing)
- [License](#license)

## Why ServiceMyRide?

Most vehicle-maintenance apps assume a cloud account, a subscription, or a fleet of trackers reporting telemetry. ServiceMyRide assumes none of that: everything lives in a single JSON document on your device, so it works fully offline from the first launch. Signing in with Google is optional and only unlocks backup/sync to a private folder in your own Drive — your data is never sent anywhere else.

## Features

| | |
|---|---|
| 🚗 **Multi-vehicle garage** | Cars, motorcycles, electric scooters, or custom types — with odometer, make/model/year, and plate. |
| 🔧 **Maintenance tracking** | Pick from presets (oil, filters, brakes, coolant, spark plugs, chain, tires, battery…) filtered by vehicle type, or add your own custom task. Every log stores date, odometer, cost, and notes. |
| 🟢 **Smart due status** | Computes **OK / Soon / Overdue** per task from *both* a time interval and an odometer interval, and surfaces alerts on the home dashboard. |
| 📦 **Parts inventory** | Track parts you've bought but not installed yet — category, quantity, cost, linked vehicle, and a mark-used/in-stock toggle, with total stock value. |
| 📄 **Documents & due dates** | Insurance, registration/license, inspection, road tax, warranty — with an auto-scheduled expiry reminder N days ahead. |
| ⏰ **Reminders** | One-off or repeating (daily/weekly/monthly) local notifications, with quick presets like "charge the battery." |
| 📶 **Bluetooth drive detection** | Pair a vehicle with its Bluetooth device (head unit, helmet intercom, scooter dongle). A drive session auto-opens on connect and closes on disconnect — plus manual logging as a fallback (and the default on web). |
| 📍 **GPS distance tracking** | Optionally track distance travelled during a drive session using device location. |
| ☁️ **Google sign-in + Drive backup** | Back up all your data to a private folder in your own Google Drive and sync it across devices. Works on web, iOS, and Android. |

All data is stored locally via AsyncStorage as a single JSON document (easy to migrate to SQLite later). Google Drive is used only for backup/sync — the app works fully offline without signing in.

## Requirements

- Node.js 18+ and npm
- Expo CLI (`npm i -g expo` optional — `npx expo` works without a global install)
- A **development build** for Bluetooth + notifications on device, since `react-native-ble-plx` is a native module and won't run in Expo Go.

## Setup

```bash
git clone https://github.com/mnimonic/ServiceMyRide.git
cd ServiceMyRide
npm install
```

## Run

**Web** — fastest way to preview; Bluetooth/notifications degrade to manual entry / no-op:

```bash
npm run web
```

**Android / iOS with native modules** (Bluetooth + notifications):

```bash
# one-time: create a dev build
npx expo install expo-dev-client
npx expo prebuild
npx expo run:android      # or: npx expo run:ios (needs macOS + Xcode)
```

Then `npm start` and open the dev build.

> [!NOTE]
> Expo Go does **not** include `react-native-ble-plx`. The app still runs there, but Bluetooth pairing shows a "not available" message — use a dev build for full functionality.

## Google Sign-In & Drive backup

<details>
<summary><strong>How sync works</strong></summary>

| Action | Effect |
|---|---|
| **Sign in** | Pulls any existing cloud backup, merges it with local data, and pushes the result back. |
| **Sync now (merge)** | Same pull → merge → push; safe to run on multiple devices (union of records by id, local wins on conflicts). Runs automatically once when the Garage tab opens. |
| **Back up ↑** | Overwrites the cloud copy with this device's data. |
| **Restore ↓** | Overwrites this device's data with the cloud copy. |

If an access token expires (401), the app signs you out so you can re-authenticate. Adding long-lived silent refresh would require a backend to exchange the OAuth refresh token — the current setup deliberately keeps everything client-side.

</details>

<details>
<summary><strong>Platform differences</strong></summary>

Web and iOS use `expo-auth-session` for "Login with Google"; Android uses `@react-native-google-signin/google-signin` (a native Play Services flow), because **Google no longer supports custom-scheme redirects for Android OAuth clients** — the browser-redirect approach `expo-auth-session` relies on cannot work there anymore.

All platforms use the Google Drive REST API for backup. Backups live in Drive's **`appDataFolder`** — a hidden, per-app folder — so the app only requests the narrow `drive.appdata` scope, and your backup never clutters your visible Drive.

</details>

<details>
<summary><strong>Step-by-step Google Cloud setup</strong></summary>

1. **Create a Google Cloud project** → https://console.cloud.google.com
2. **OAuth consent screen**: configure it (External is fine for personal use), add your email as a test user, and under **Data access → Add or remove scopes** add `.../auth/userinfo.email`, `.../auth/userinfo.profile`, and (search "Drive", from the **Google Drive API**) `.../auth/drive.appdata`.
3. **Enable the Google Drive API** under APIs & Services → Library — the `drive.appdata` scope won't show up in step 2 until this is enabled.
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

> [!NOTE]
> Like Bluetooth and notifications, Google Sign-In needs a **development build** on device — it does not work in Expo Go. On web it works with just the Web client ID.

</details>

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
    bluetooth.js            react-native-ble-plx drive detection
    googleDrive.js          Google Drive REST API (appDataFolder backup)
    helpers.js              Dates + maintenance-status computation
```

## Customizing maintenance intervals

Edit `src/constants/index.js` → `MAINTENANCE_PRESETS`. Each entry has:

- `intervalKm` — odometer-based interval (or `null`)
- `intervalMonths` — time-based interval (or `null`)
- `appliesTo` — which vehicle types show this task

## Notes on Bluetooth detection

BLE `isDeviceConnected` polling (every 15s) is used as a portable approach that works the same way across platforms. For true background detection when the app is closed, you'd add background BLE plus a foreground service (Android) / background modes (iOS) — the config in `app.json` already enables the permissions and background mode flags to build on.

## Contributing

Issues and pull requests are welcome. There's no test suite, lint config, or build/typecheck script in this repo yet, so please:

- Keep changes scoped and test them by actually running the app (`npm run web` for a quick check, a dev build for Bluetooth/notifications/GPS).
- Follow the existing patterns — see `src/storage/db.js` for the data layer and `src/components/ui.js` for shared UI primitives — rather than introducing new ones for the same purpose.
- Open an issue first for larger changes (new record types, new sync behavior) so the approach can be discussed before you invest the time.

## License

[MIT](./LICENSE) © George Danilopoulos
