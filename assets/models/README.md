# Offline recognition model bundle

Run `npm run prepare:voice` before Android export. The build-time script downloads
multilingual Whisper base Q5_1 (not base.en) and Silero v6.2.0 from the upstream GGML
repositories, verifies the pinned file lengths and SHA-256 values in
`scripts/voice-models.json`, and fails the build on a mismatch. EAS runs the same
script after dependency installation. No model is downloaded from inside the app.

Whisper weights/code: MIT, https://github.com/openai/whisper and
https://huggingface.co/ggerganov/whisper.cpp . Silero VAD: MIT,
https://github.com/snakers4/silero-vad . GGML conversion/runtime: MIT,
https://github.com/ggml-org/whisper.cpp . Binding: MIT,
https://github.com/mybigday/whisper.rn . Upstream notices are kept alongside this
file's sibling `assets/model-notices` directory and included in the Android
assets by the local module build.

The two model files add about 61 MB before APK compression. Android 12 offline
availability is an implementation target; device accuracy and CPU/battery/latency
remain acceptance gates. App capture/transcription does not write audio to disk.
