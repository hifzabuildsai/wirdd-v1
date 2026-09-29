# Wirdd · Android tester edition

Wirdd counts Astaghfirullah during a session. This branch is a **reviewable tester candidate**, not a released or physically verified app. There is no account or checkout in the tester flow.

## Setup

- Node.js 20+, npm, Android SDK or EAS access, a physical Android phone for acceptance.
- `npm ci`
- `npx tsc --noEmit && npm run lint && npx expo-doctor`
- `npx expo start --dev-client` for a development build.
- `eas build --platform android --profile preview` for an internally distributed APK. `eas.json` sets `distribution: internal`. Expo Go cannot run the bundled native speech and notification modules.

No Supabase, Paddle, Picovoice, or account credentials are required for the tester flow. Old unused server and payment scaffolding is not part of this edition.

## Architecture and data flow

`app/(tabs)/index.tsx` owns the visible session controls. `useVoiceDetection` obtains Android microphone permission and starts `AndroidSpeechEngine`. The engine requests `requiresOnDeviceRecognition: true` for `ar-SA`, waits for an `audiostart` event, and parses final text results in memory. The app code has no network recognizer fallback. Installed-locale lists are unreliable across recognition services, so the native start result and physical offline test are the gate.

The first final result in each recognition cycle is counted; alternatives and duplicate final events in that cycle are ignored. Repeated phrases in one transcript are counted individually. The old 1.5-second time debounce was removed. Device accuracy, fast repetitions, false positives, interruptions, and recognition gaps between short recognition cycles are **unverified**.

`sessionStore` records each count change in SQLite (`count_events`) and updates the session count before updating the UI. A process restart closes any unfinished SQLite session with its last committed count. Daily summaries use local calendar dates. Pause turns off recognition; end saves the count and optional mood. Manual mode needs no microphone.

Notifee displays a foreground notification for voice sessions without a Pro gate. The notification has no quick actions until background action handling has device proof. A notification alone does not prove microphone capture survives a locked screen or process death. If an interrupted process restarts, the last committed count is preserved and the session is closed; it does not invent recitations during the gap.

## Privacy

Wirdd does not save raw audio or transcripts, and the tester flow does not call an app backend. It stores count events, session timestamps, and optional mood in local SQLite. The Android on-device speech service processes microphone input; its availability and installed Arabic model are device dependent. Airplane-mode use must be checked on the actual supported phone before advertising offline performance. No raw audio capture or upload exists in app code.

## Supported scope and limitations

- Android only, preferably Android 13+ with installed on-device Arabic recognition. Device model support is unverified.
- The core voice flow, notification continuity on a locked screen, Bluetooth earbuds, permission changes, and phone calls are pending physical acceptance.
- Some speech recognizers may not emit a separate final result for each fast repetition. The count can be corrected with +1 and −1.
- No cloud backup, purchase, payment, custom phrase, export, or account in this tester edition.
- Corrections reverse the most recent unmatched count on its original local day. Verify daylight-saving and clock-change behavior before a broader release.

## Reproducible phone acceptance

Record the device model, Android version, speech service and Arabic offline model. Install the preview APK, then:

1. Complete onboarding with Wi-Fi/mobile data off. Grant the mic. Start voice mode: expect a visible listening state and notification. If unavailable, expect a clear error and manual fallback; record the exact error.
2. Independently tally 20 normal phrases, 10 rapid phrases, 60 seconds silence, 60 seconds ordinary speech, then 20 phrases with background noise. Record app increments for each block, `actual`, `detected`, misses, extra counts, and false positives. `accuracy = 1 - (misses + extras) / actual` for the 50 intended phrases. Count false positives separately for silence and ordinary speech. No target is claimed yet.
3. Add +1, remove −1, pause and say five phrases (expect no additions), resume and say five (record detections), then end. Verify the saved session and local today total. Restart app and verify the same count. Deny/revoke permission and verify no active listening claim; regrant and retry.
4. Repeat with the screen locked for two minutes and with earbuds if available. Verify count changes, notification state, pause/end in app, and whether microphone use continues. Test an incoming call, app swipe away, and a forced stop; record exact recovery and any count gap.

Do not call the release accepted until these results and a reviewed APK are recorded. Send tester feedback to the person who invited you.
