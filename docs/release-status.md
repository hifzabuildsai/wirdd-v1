# Wirdd Android beta — 11 October 2026

## Scope

Android local Astaghfirullah sessions, corrections, pause/resume/end, optional mood, progress, local deletion and permission guidance. No accounts, payments, sync, reminders or iOS release. Foreground voice only for this beta; app background/lock pauses voice. Locked-screen support remains a separate unaccepted feature, pending the owner's final requirement and device evidence.

## Available device

Owner confirmed Samsung S10, Android 12. This device can test APK installation, manual sessions, deletion and durable history. Current voice engine rejects Android below 13 before requesting microphone access. Voice on this S10 requires a different offline engine; allowing Android's advisory offline intent would weaken the privacy guarantee. No supported Android 13+ test device is confirmed.

## Baseline APK inspection

EAS build `ce8bf55c-4348-40e6-ac08-c3e215804358`, preview, commit `674a2057e04f0d97ab9c16b9d015ad4d3b4a9f2a`.

Package `app.wirdd.android`, versionCode 2, minSdk 24, targetSdk 36; ARM64 and ARMv7 included; bundled JS present. ZIP CRC passed. Baseline certificate SHA-256 `52b3206a45c3e50561c6a1aa815152910fd5bcc0a5c5eeaea5f7293ebd3758c6`. See `outputs/baseline-apk-inspection.json` for file hash and details. Certificate extraction is not signature verification.

Android 12 compatibility is not the apparent install blocker. The failed download has not been matched to this build, and no exact installer/ADB error has been supplied. Do not uninstall existing history as a routine workaround.

## Implemented

- Recognition startup has a fixed deadline independent of restart scheduling; duplicate end/final events are guarded. Audioend without a final/end event times out safely.
- Permission/start operations can be cancelled and duplicate starts are serialized. Startup detections remain buffered until storage/session/resume is ready.
- Voice pauses on background/lock and releases service/recognition; end failure leaves a paused retryable session. Optional mood failure is recoverable.
- Database opens during guarded startup; storage/setup failure presents a retry screen.
- Streaks use local calendar dates, retain yesterday until today ends, refresh on progress/focus/time, and have no thirty-day ceiling.
- Session/event dates are persisted and backfilled on upgrade; timezone changes no longer move new history. Old records lack original timezone metadata and are interpreted in the timezone at migration.
- Settings opens app permissions, shows version/privacy/local-only behavior, deletes history with confirmation, and links support.
- Backup is disabled; unused external storage, overlay, alarm, boot and notification-policy permissions are blocked.
- Preview APK/versionCode and production AAB profiles are explicit. CI includes main and Codex branches.

## Validation

Record final verification and replacement build metadata in `outputs/candidate-build.json` after the build finishes. Automated tests exercise lifecycle, phrases, dates and real SQLite SQL including rollback/reopening. Native Android prebuild validates generated configuration; Android export checks Hermes bundle generation. Physical Android behavior is unaccepted until the test sheet is filled.

Expo Doctor: 17/18 checks; React Native Directory marks Notifee unmaintained. Keep this visible. Retain existing notification integration for the beta rather than change engines and notification stack together. Before production, review replacement/removal options and test native compatibility.

## Remaining release gates

1. Exact S10 installer result, clean install/launch and safe upgrade on the replacement signed APK.
2. Android 13+ physical voice testing, Arabic model availability and independent airplane-mode accuracy measurement; or benchmark a different offline engine if S10 voice is required.
3. Background/lock auto-pause, calls, mic revoke/regrant and long sessions on physical phones.
4. Small-screen/font scaling/TalkBack, screenshots and branded asset review.
5. Play Console ownership/signing access, hosted privacy policy/support, store declarations, applicable testing track and production access.

No merge, Play submission or public release is accepted by automated checks alone.
