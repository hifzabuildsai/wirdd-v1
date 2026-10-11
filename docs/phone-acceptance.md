# Physical Android acceptance

Build ID / commit / APK SHA-256:

Device / Android version / installer result:

## S10 Android 12 — install and manual flow

1. Download the candidate standalone APK completely. Open and install. Record the exact failure text if it fails. With Android Platform Tools, use `adb install -r candidate.apk` to preserve existing app data and capture `INSTALL_FAILED_*`. Never uninstall just to hide an upgrade/signing conflict.
2. Launch and complete onboarding. APK v4 offers only manual mode on Android 12. The new Whisper candidate offers offline voice beta and mic permission; manual mode remains available without permission.
3. Start manual session. Add 20, remove 2; expect 18. Pause: +1 is disabled. Resume, add 2; expect 20. End and skip mood. Dashboard and Qalb agree.
4. Force-stop/relaunch: expect the saved 20 and closed history. During another session add 5, force-stop/relaunch: expect the five committed counts retained and the interrupted session closed.
5. Open Settings permissions/support. Attempt deletion during a session: blocked. End, cancel deletion: history retained. Confirm deletion: sessions, counts and progress cleared.

Owner accepted APK v4 install/onboarding/manual sessions 5 + 8 = 13 and reopening retains 13. For the new candidate, first verify upgrade preserves that 13. Do not delete the owner's history for test convenience; deletion tests belong on a disposable device/history.

## Android 12+ ARM64 — offline voice proof

Candidate build/source / bundled model / speaker:

Models are bundled. Start with ten normal recitations, leaving a brief gap and allowing counts to settle. Repeat with airplane mode enabled and Wi-Fi off. Independently tally real recitations; app totals alone are not evidence of accuracy.

| Block | Actual | Detected | Misses | Extras | Notes |
| --- | ---: | ---: | ---: | ---: | --- |
| Normal | 20 | | | | |
| Rapid | 10 | | | | |
| Noisy | 20 | | | | |
| Silence, 60 sec | 0 | | | | |
| Unrelated speech, 60 sec | 0 | | | | |

For a promising device expand normal recitation to 100+ across multiple sessions/speakers. Proposed normal gate: `max(0, 1 - (misses + extras) / actual) >= 0.95`, with zero false positives in the defined silence/unrelated blocks. Report rapid/noisy separately; do not claim their support before defining and meeting thresholds.

Test denied/revoked mic, absent model, pause/resume/end, foreground/background/lock, phone call, earbuds and a 20–30 minute session. Background/lock must pause and release the microphone with no additions; returning must require explicit Resume. Listening label must match actual capture. Manually correct and verify restart totals. Record device/build-specific failures.

Installation result:

Manual result:

Voice result / accuracy:

Interruptions and long-session result:

Acceptance owner / date:
