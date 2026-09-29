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
No physical-device accuracy or locked-screen proof has been recorded.

Every count change must reach SQLite before the displayed count changes. The
session and daily summary are local. Do not silently enable network recognition,
record/upload audio, or add fake paid entitlement. The free voice session has
a foreground notification; its lock-screen continuity is still a test gate.

Run `npx tsc --noEmit`, `npm run lint`, `npx expo-doctor`, and a preview APK
build before device acceptance. The preview profile uses internal distribution.
Do not merge or advertise release completion from automated tests alone.
