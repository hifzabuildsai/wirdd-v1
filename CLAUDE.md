# Wirdd engineering context

Android tester branch on Expo SDK 54, React Native 0.81.5, Expo Router 6,
TypeScript, Zustand, SQLite, expo-speech-recognition, and Notifee.
Read README.md and the source before changing behavior.

The tester edition has no account or payment flow. Porcupine is not active and
there is no Arabic keyword asset; do not repeat the older Porcupine claim.
Voice mode requires Android 13+ because the installed native module uses
`createOnDeviceSpeechRecognizer` only on API 33+. It requests
`requiresOnDeviceRecognition: true` and `ar-SA`; it still needs an installed
Arabic on-device model and physical airplane-mode verification.
No physical-device accuracy has been recorded. The current beta deliberately
pauses voice on app background or screen lock and requires explicit resume.
The confirmed owner test phone is an S10 on Android 12: manual mode only with
this engine. Android 12 voice needs a separate measured offline-engine spike.

Every count change must reach SQLite before the displayed count changes. The
session and daily summary are local. Do not silently enable network recognition,
record/upload audio, or add fake paid entitlement. The free voice session has
a foreground notification while capture is active; background/lock removes it.
Historical event/session calendar dates are pinned at write time. Old timestamps
are backfilled in the timezone at migration; original timezone cannot be inferred.
Run tests with Node 24+ (SQLite and module hooks). Emulator smoke evidence is
separate from physical installation and microphone acceptance.

Run `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`, and a preview APK
build before device acceptance. The preview profile uses internal distribution.
Do not merge or advertise release completion from automated tests alone.
