# Activating Expo push notifications (LinkUp)

Step-by-step guide to enable **Expo push** on **Android** and **iOS** for this app. The client already uses `expo-notifications` and stores the token on the user profile (see `lib/notifications/registerPushNotifications.ts` and `contexts/NotificationInboxContext.tsx`).

---

## 1. Expo account and EAS project

1. Install the CLI: `npm i -g eas-cli`
2. Log in: `eas login`
3. From the project root, link or create the project: `eas init`
4. Copy the **EAS project ID** from the [Expo dashboard](https://expo.dev) (Project → Project settings) or from the `eas init` output.

---

## 2. Set `projectId` in app config

In `app.json`, under `expo.extra.eas`, set the real project UUID (not the placeholder).

`getExpoPushTokenAsync` in `lib/notifications/registerPushNotifications.ts` reads:

- `Constants.expoConfig?.extra?.eas?.projectId`, or  
- `Constants.easConfig?.projectId`

Without a valid **EAS project ID**, obtaining a device push token on real builds often fails.

If you use `app.config.js`, ensure the merged config still exposes `extra.eas.projectId` (it spreads `app.json` today).

---

## 3. iOS — Apple and EAS

1. **Apple Developer Program** membership (required for real devices and TestFlight).
2. In **Apple Developer**, create an **App ID** matching `ios.bundleIdentifier` (e.g. `com.linkup.app` in `app.json`).
3. Enable **Push Notifications** for that App ID.
4. Run **`eas credentials`** (or use the EAS dashboard) so EAS can manage:
   - Distribution certificate / provisioning profile (as needed), and  
   - **APNs** (key or auth) for push.
5. Produce an iOS binary with push entitlements, e.g.  
   `eas build --platform ios`

Use a **development build** or **TestFlight/store build** for reliable push tests; Expo Go has limitations.

---

## 4. Android — FCM and EAS

1. In **Google Cloud Console**, create or select a project and enable **Firebase Cloud Messaging (FCM)**.
2. Register the Android app in Firebase with package name **`com.linkup.app`** (see `app.json` → `android.package`).
3. In **EAS**, add **FCM** credentials (service account / JSON flow per [Expo Android push docs](https://docs.expo.dev/push-notifications/push-notifications-setup/)).
4. Build Android, e.g.  
   `eas build --platform android`

---

## 5. Rebuild native apps

Push depends on **native** configuration:

- After changing plugins, `projectId`, or push credentials, create a **new** build:
  - **EAS:** `eas build --platform ios` / `android`, or  
  - **Local:** `npx expo run:ios` / `npx expo run:android` after a clean prebuild if you maintain `ios/` and `android/`.

Metro-only reloads are not enough for credential or entitlement changes.

---

## 6. Client behavior (already implemented)

1. **`expo-notifications` plugin** is listed in `app.json` (`plugins` → `expo-notifications`).
2. **`registerForPushNotificationsAsync`** requests permission and calls `getExpoPushTokenAsync` with `projectId` when available.
3. **`persistExpoPushToken`** writes `preferences.expo_push_token` (and `expo_push_token_updated_at`) on `profiles` in Supabase.
4. **`NotificationInboxContext`** registers push when the user is signed in and profile push is not turned off (`preferences.notifications.push`).

On device, the user must **allow notifications** in the OS prompt.

---

## 7. Sending pushes (server)

1. Read the stored **Expo push token** from the user’s profile (`ExponentPushToken[...]`).
2. Call the **Expo Push API**:  
   `POST https://exp.host/--/api/v2/push/send`  
   with a JSON body per [Expo’s push API format](https://docs.expo.dev/push-notifications/sending-notifications/) (`to`, `title`, `body`, `data`, etc.).
3. Optionally continue inserting rows into `public.notifications` for the in-app inbox; push is an extra delivery channel.

**Security:** keep push copy generic; avoid sensitive amounts or KYC details in notification text (see comment in `registerPushNotifications.ts`).

---

## 8. Verification checklist

| Step | Action |
|------|--------|
| 1 | `eas login` + `eas init` |
| 2 | Set real `expo.extra.eas.projectId` in `app.json` |
| 3 | iOS: Push capability + EAS APNs + new iOS build |
| 4 | Android: FCM in EAS + new Android build |
| 5 | Install the new build on a **physical device** |
| 6 | Grant notification permission |
| 7 | Confirm `profiles.preferences.expo_push_token` in Supabase |
| 8 | Send a test message via Expo Push API or Expo’s push notification tool |

---

## 9. Reference files in this repo

- `lib/notifications/registerPushNotifications.ts` — permission, token, persist to profile  
- `contexts/NotificationInboxContext.tsx` — when registration runs, notification handlers  
- `app.json` — `expo-notifications` plugin, `ios.bundleIdentifier`, `android.package`, `extra.eas.projectId`

---

## 10. EAS Build vs local `expo run`

- **EAS Build** is the usual path for **TestFlight / Play Store** and managed push credentials.
- **Local `expo run:*`** can work after `npx expo prebuild` if you configure the same bundle ID / package and install the right native push setup; many teams still use EAS for signing and APNs/FCM uploads.

Choose one workflow and follow the matching Expo docs for credential upload.
