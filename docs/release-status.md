# Wirdd Android beta — 11 October 2026

## Scope

Android local Astaghfirullah sessions, corrections, pause/resume/end, optional mood, progress, local deletion and permission guidance. No accounts, payments, sync, reminders or iOS release. Foreground voice only for this beta; app background/lock pauses voice. Locked-screen support remains a separate unaccepted feature, pending the owner's final requirement and device evidence.

## Available device

Owner confirmed Samsung S10, Android 12. APK v4 installed through ADB after freeing storage from 616 MB to 4.2 GB. Exact installer error: `INSTALL_FAILED_INSUFFICIENT_STORAGE`. Owner recording verifies onboarding/navigation. Manual sessions 5 + 8 show total 13, retained after closing/reopening. See `outputs/s10-manual-acceptance.json`. The new Whisper/Silero candidate targets offline voice on Android 12; physical accuracy remains pending. See `docs/android12-voice-candidate.md`.

## Baseline APK inspection

EAS build `ce8bf55c-4348-40e6-ac08-c3e215804358`, preview, commit `674a2057e04f0d97ab9c16b9d015ad4d3b4a9f2a`.

Package `app.wirdd.android`, versionCode 2, minSdk 24, targetSdk 36; ARM64 and ARMv7 included; bundled JS present. ZIP CRC passed. Baseline certificate SHA-256 `52b3206a45c3e50561c6a1aa815152910fd5bcc0a5c5eeaea5f7293ebd3758c6`. See `outputs/baseline-apk-inspection.json` for file hash and details. Certificate extraction is not signature verification.

S10 installation/manual durability is confirmed. No uninstall or history deletion was needed.

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

Final APK: EAS build `b0541ddb-f2e9-4c63-b5ea-1659c97f38d8`, source `90e805041e4278c5be8843ee583bb69c1d1462e8`, versionCode 4. Native build finished. ZIP integrity passed, minSdk 24 and ARM64 support are present, backup is disabled, unused permissions are absent, and the signing certificate matches the baseline. Metadata and hashes are in `outputs/candidate-build.json` and `outputs/candidate-apk-inspection.json`.

25 automated tests passed, including production SQL against file-backed SQLite, rollback/reopening, old-schema migration and timezone corrections. Typecheck, lint, Android prebuild, Hermes export and source CI passed.

[Android 12 emulator run](https://github.com/hifzabuildsai/wirdd-v1/actions/runs/38086200345) passed baseline installation, candidate upgrade preserving a three-count session, restart preservation, and candidate clean installation/manual counting with networking disabled. Installer logs, UI XML, screenshots and logcat are attached to that run and downloaded under `outputs/native-smoke/`. See `outputs/native-smoke-result.json`. This proves emulator installation/manual durability, not physical S10 installation or microphone accuracy. Physical behavior remains unaccepted until the phone sheet is filled.

EAS preview artifacts expire: keep the local APK copies for reproducibility and refresh the workflow's baseline pin when accepting a new beta. The current baseline EAS artifact expires 14 October 2026 UTC.

Expo Doctor: 17/18 checks; React Native Directory marks Notifee unmaintained. Keep this visible. Retain existing notification integration for the beta rather than change engines and notification stack together. Before production, review replacement/removal options and test native compatibility.

## Remaining release gates

1. Exact S10 installer result, clean install/launch and safe upgrade on the replacement signed APK.
2. Android 13+ physical voice testing, Arabic model availability and independent airplane-mode accuracy measurement; or benchmark a different offline engine if S10 voice is required.
3. Background/lock auto-pause, calls, mic revoke/regrant and long sessions on physical phones.
4. Small-screen/font scaling/TalkBack and store screenshots. `assets/images/icon.png` is confirmed Expo starter artwork and needs replacement; review adaptive/splash assets too.
5. Play Console ownership/signing access, hosted privacy policy/support, store declarations, applicable testing track and production access.

No merge, Play submission or public release is accepted by automated checks alone.
