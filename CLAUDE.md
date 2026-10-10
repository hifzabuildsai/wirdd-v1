# Wirdd engineering context

Android tester branch on Expo SDK 54, React Native 0.81.5, Expo Router 6,
TypeScript, Zustand, SQLite, expo-speech-recognition, and Notifee.
Read README.md and the source before changing behavior.

The tester edition has no account or payment flow. Porcupine is not active and
there is no Arabic keyword asset; do not repeat the older Porcupine claim.
The new voice candidate uses whisper.rn 0.7.4, bundled multilingual Whisper
tiny, Silero VAD and the local WirddAudio Expo module for 16 kHz PCM capture.
It targets Android 12 as well as newer Android; no Android speech provider or
network recognition fallback is used. Run `npm run prepare:voice` to fetch and
checksum-verify models before export/prebuild. EAS fetches them after install;
model binaries are excluded from Git. The old SpeechEngine is retained as
inactive reference code with tests, not selected by the voice hook.
No physical-device voice accuracy has been recorded. The current beta deliberately
pauses voice on app background or screen lock and requires explicit resume.
The owner S10 on Android 12 installed APK v4 after freeing storage. Owner verified
two manual sessions (5 + 8) and total 13 retained after closing/reopening the app.
The Whisper candidate still needs a native build, safe upgrade and real voice tests.

Every count change must reach SQLite before the displayed count changes. The
session and daily summary are local. Do not silently enable network recognition,
save/upload audio, or add fake paid entitlement. Raw PCM and transcripts must
remain in bounded memory; no prompt biases recognition towards the counted phrase.
The free voice session has
a foreground notification while capture is active; background/lock removes it.
Historical event/session calendar dates are pinned at write time. Old timestamps
are backfilled in the timezone at migration; original timezone cannot be inferred.
Run tests with Node 24+ (SQLite and module hooks). Emulator smoke evidence is
separate from physical installation and microphone acceptance.

Run `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`, and a preview APK
build before device acceptance. The preview profile uses internal distribution.
Do not merge or advertise release completion from automated tests alone.
