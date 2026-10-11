# Wirdd · Android tester edition

Wirdd counts Astaghfirullah in local sessions. APK installation and manual history reopening were verified on the owner's Samsung S10/Android 12. v5 and v6 microphone startup works, but owner recitation tests still produce zero. The next candidate adds live Voice check feedback to diagnose capture, speech detection and recognition; physical voice acceptance remains open. This is a beta; no account or checkout flow.

## Setup

- Node.js 24+ for tests (SQLite/module hooks), npm, Android SDK or EAS access.
- `npm ci`
- `npm run prepare:voice` downloads checksum-pinned bundled models before export. EAS runs this automatically after dependency installation.
- `npm run typecheck`, `npm run lint`, `npm test`, `npx expo-doctor`.
- `npx expo prebuild --platform android --no-install`.
- `eas build --platform android --profile preview` produces the signed APK. Expo Go cannot run the native modules.

No backend/payment credentials required. Preview increments versionCode and retains existing signing credentials for upgrades.

## Voice and data flow

The voice hook requests mic permission and starts WhisperEngine. The next candidate bundles multilingual Whisper base Q5_1 and Silero VAD to process 16 kHz PCM from the local WirddAudio Expo module. v7 diagnostics reached speech detection and recognition, but recognized text did not match the recited phrase; the old tiny model remains unaccepted. No Android speech provider or network recognition fallback is used. Models download only at build time, with pinned lengths/SHA-256. The older Android 13 SpeechEngine remains inactive reference code with tests.

Disjoint utterances finish after one second of silence. Complete results count repetitions once; partial revisions are never counted. Audio/transcript queues are bounded in memory. Backlog pauses with an error instead of silently dropping input. Users should pause briefly and let counts settle before ending. Physical accuracy, VAD boundaries, false positives, latency and battery remain unverified. See [Android 12 candidate](docs/android12-voice-candidate.md).

SQLite commits each count, event and summary before updating UI. Startup detections wait until a session exists. Process recovery closes unfinished sessions with their committed counts and rebuilds summaries. Session/event creation dates stay pinned across timezone changes; corrections reverse the latest unmatched event on its original date. Legacy timestamps are backfilled in the migration timezone because original timezone cannot be inferred.

Voice requires an open foreground app. Pause/end, background/lock stop capture and invalidate pending results; explicit resume is required. No counts are invented during gaps. Existing Notifee notification remains during active voice capture. Manual mode needs no mic.

## Privacy and support scope

PCM and transcripts stay in bounded memory; no audio file, transcript storage or upload is created. SQLite stores counts, timestamps and optional mood. Backup is disabled; uninstall/clear data loses history. Settings deletes history after ending an active session. Upstream MIT notices ship in Android assets.

Candidate targets Android 12 and newer on ARM64 including S10, with x86_64 for emulator coverage. No 32-bit ABI. Airplane-mode accuracy needs physical verification. No accounts, sync, payments, custom phrases, reminders, export or iOS release. Locked-screen voice is excluded.

## Acceptance and evidence

Upgrade without uninstalling and check existing history remains. S10 APK v4 saved 5 + 8 = 13 and retained 13 after closing/reopening; the initial install error was insufficient storage. See `outputs/s10-manual-acceptance.json`.

Independently tally normal/rapid/noisy phrases, silence/unrelated speech, pause/resume, background/lock and calls. Verify airplane mode with Wi-Fi off, permission changes, latency and battery. Record misses/extras/false positives. The >=95% accuracy gate remains pending. Follow [phone acceptance](docs/phone-acceptance.md).

Tests cover phrase parsing, calendar streaks, production file-backed SQLite durability/migration/deletion, old speech lifecycle and offline capture/VAD/decode lifecycle with injected interfaces. These do not prove microphone accuracy.

`scripts/inspect_apk.py` records SHA-256, ZIP integrity, manifest SDK/ABIs and extracted certificate fingerprints; it is not cryptographic signature verification. Disposable Android 12 emulator checks install/upgrade/reopen/offline manual durability and rejects physical devices.

Expo Doctor retains Notifee's unmaintained warning and lacks directory metadata for whisper.rn/local WirddAudio. Build/device compatibility remains required. See [release status](docs/release-status.md). Keep local APK copies as EAS URLs expire. Do not merge or advertise launch completion from automated checks alone.
