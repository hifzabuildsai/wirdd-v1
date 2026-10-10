# Wirdd · Android tester edition

Wirdd counts Astaghfirullah during a session. This branch is a **reviewable tester candidate**, not a released or physically verified app. There is no account or checkout in the tester flow.

## Setup

- Node.js 24+ for tests (Node SQLite and module hooks), npm, Android SDK or EAS access, a physical Android phone for acceptance.
- `npm ci`
- `npx tsc --noEmit && npm run lint && npx expo-doctor`
- `npx expo start --dev-client` for a development build.
- `eas build --platform android --profile preview` for an internally distributed APK. `eas.json` sets `distribution: internal`. Expo Go cannot run the bundled native speech and notification modules.

No Supabase, Paddle, Picovoice, or account credentials are required for the tester flow. Old unused server and payment scaffolding is not part of this edition.

## Architecture and data flow

`app/(tabs)/index.tsx` owns the visible session controls. `useVoiceDetection` obtains Android microphone permission and starts `AndroidSpeechEngine`. On Android 13+ only, the installed native module uses `createOnDeviceSpeechRecognizer` for `requiresOnDeviceRecognition: true`. The engine requests `ar-SA`, waits for an `audiostart` event, and parses final text results in memory. Android 12 is blocked from voice mode because this library uses only an advisory offline intent there. The app code has no network recognizer fallback. Installed-locale lists are unreliable across recognition services, so the native start result and physical airplane-mode test are still the gate.

The first final result in each recognition cycle is counted; alternatives and duplicate final events in that cycle are ignored. Repeated phrases in one transcript are counted individually. The old 1.5-second time debounce was removed. Device accuracy, fast repetitions, false positives, interruptions, and recognition gaps between short recognition cycles are **unverified**.

`sessionStore` records each count change and its daily summary in one SQLite transaction before updating the UI. Detections during microphone startup are buffered until a session row exists. A process restart closes any unfinished SQLite session with its last committed count and rebuilds daily summaries. Daily summaries use local calendar dates. Pause turns off recognition; end saves the count and optional mood. Manual mode needs no microphone.

Notifee displays a foreground notification while voice counting is active. This beta scopes voice counting to an open, foreground app: backgrounding or locking the phone pauses voice, releases recognition and stops the service. Resume is explicit after returning. Locked-screen counting is excluded until physical evidence supports it. If an interrupted process restarts, the last committed count is preserved and the session is closed; it does not invent recitations during the gap.

## Privacy

Wirdd does not save raw audio or transcripts, and the tester flow does not call an app backend. It stores count events, session timestamps, and optional mood in local SQLite. Android app backup is disabled. Clearing app data or uninstalling loses local history. Settings can delete history after ending an active session. The Android on-device speech service processes microphone input; its availability and installed Arabic model are device dependent. Airplane-mode use must be checked on the actual supported phone before advertising offline performance. No raw audio capture or upload exists in app code.

## Supported scope and limitations

- Android 13+ for voice mode with installed on-device Arabic recognition; manual mode is available on older Android versions. Device model support is unverified.
- The core voice flow, background auto-pause, Bluetooth earbuds, permission changes, and phone calls are pending physical acceptance. Locked-screen voice is excluded from this beta.
- Some speech recognizers may not emit a separate final result for each fast repetition. The count can be corrected with +1 and −1.
- No cloud backup, purchase, payment, custom phrase, export, or account in this tester edition.
- Corrections reverse the most recent unmatched count on its original local day. New session/event calendar dates are stored at creation so timezone changes do not move history. Existing pre-migration timestamps are backfilled using the phone's timezone at migration; their original timezone cannot be reconstructed. Verify clock changes on physical devices before a broader release.

## Reproducible phone acceptance

Record the device model, Android version, speech service and Arabic offline model. Install the preview APK, then:

1. Complete onboarding with Wi-Fi/mobile data off. Grant the mic. Start voice mode: expect a visible listening state and notification. If unavailable, expect a clear error and manual fallback; record the exact error.
2. Independently tally 20 normal phrases, 10 rapid phrases, 60 seconds silence, 60 seconds ordinary speech, then 20 phrases with background noise. Record app increments for each block, `actual`, `detected`, misses, extra counts, and false positives. `accuracy = 1 - (misses + extras) / actual` for the 50 intended phrases. Count false positives separately for silence and ordinary speech. No target is claimed yet.
3. Add +1, remove −1, pause and say five phrases (expect no additions), resume and say five (record detections), then end. Verify the saved session and local today total. Restart app and verify the same count. Deny/revoke permission and verify no active listening claim; regrant and retry.
4. Lock the screen or background the app: expect voice to pause, the microphone to stop and no counts to accrue. Return and explicitly resume. Repeat with earbuds if available. Test an incoming call, app swipe away, and a forced stop; record exact recovery and any count gap.

## Automated verification and build evidence

`npm test` exercises phrase parsing, recognizer lifecycle with a simulated native bridge, calendar streaks, and production database SQL against file-backed SQLite. It verifies transactional rollback, process reopening, midnight corrections, legacy history and deletion. These tests do not establish microphone accuracy or physical installation.

Preview builds explicitly use APK packaging and increment the remote versionCode. Keep the same existing EAS signing credentials for upgrades. `scripts/inspect_apk.py <apk> --output <report.json>` records SHA-256, ZIP integrity, manifest SDK/package/version, ABIs and extracted v2 signing certificate fingerprints. It does not cryptographically verify signatures.

See [release status](docs/release-status.md) and [phone test sheet](docs/phone-acceptance.md). Expo Doctor flags `@notifee/react-native` as unmaintained in React Native Directory. It is retained for this beta's existing notification integration; native build and device tests remain required, and its maintenance/compatibility decision remains open for production.

The APK smoke workflow downloads checksum-pinned EAS artifacts and uses a disposable Android 12 emulator to check baseline install, upgrade preserving a three-count manual session, restart preservation, and candidate clean installation. It retains installer output, UI XML, screenshots and logcat. The script rejects physical devices. Emulator results do not establish S10 installation or microphone accuracy.

Do not call the release accepted until these results and a reviewed APK are recorded. Send tester feedback to the person who invited you.
