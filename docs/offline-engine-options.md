# Android 12 voice feasibility

Update 11 October: S10 APK v4 install/manual history accepted. The new candidate
integrates checksum-pinned multilingual Whisper tiny + Silero VAD using whisper.rn
0.7.4 and a local Expo AudioRecord module. It still needs native/device acceptance;
the earlier feasibility assessment below is retained as decision context. See
[candidate implementation](android12-voice-candidate.md).

The confirmed test phone is an S10 on Android 12. The current Expo speech module does not guarantee local-only recognition below API 33; the installed native implementation uses an advisory offline preference there. Keep manual mode on this path. Removing the Android 13 guard is not an acceptable substitute for a local engine.

For a separate measured spike, evaluate multilingual Whisper tiny through [whisper.rn](https://github.com/mybigday/whisper.rn), a React Native binding for [whisper.cpp](https://github.com/ggml-org/whisper.cpp). These projects provide Android/local inference integration; they do not prove real-time Astaghfirullah accuracy on the S10. Check New Architecture/Expo SDK 54 build compatibility, memory/CPU/battery, model packaging/license, microphone interruption handling and silence hallucinations. Use Arabic transcription rather than English-only weights. A chunked engine also needs explicit overlap/event deduplication, with no audio/transcript retention or upload.

[Vosk's model catalogue](https://alphacephei.com/vosk/models) lists a 318 MB Arabic MGB2 model under Apache 2.0, a 1.3 GB Arabic model under AGPL, and a 158 MB Tunisian Arabic small model under Apache 2.0. None is a proven lightweight Astaghfirullah keyword model for this product. Vocabulary/grammar constraints can create false positives, so silence and unrelated-speech testing are essential. Model size and dialect alone do not establish device suitability.

Working recommendation: first use the signed beta to accept installation/manual durability on S10. If an Android 13+ phone is available, measure the existing engine before replacing it. If S10 voice is essential, benchmark Whisper tiny and a suitably licensed Vosk model against the same independently tallied protocol before choosing an engine or integrating it into the release candidate. This is a feasibility recommendation, not an implemented or tested voice feature.
