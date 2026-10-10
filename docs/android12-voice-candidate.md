# Android 12 offline voice candidate

Owner's Samsung S10/Android 12 now has confirmed APK v4 installation, manual
session totals 5 + 8 = 13 and reopening preserves 13. Installer failure was
`INSTALL_FAILED_INSUFFICIENT_STORAGE`: 616 MB free before cleanup, 4.2 GB after.
No signing workaround, uninstallation, or history deletion was needed.

The next candidate selects WhisperEngine for Android, backed by whisper.rn 0.7.4
and a local Expo AudioRecord module. It bundles checksum-pinned multilingual
Whisper tiny and Silero VAD. Native capture delivers only bytes actually read;
start resolves after actual PCM, stop stops and joins the recording worker, and
Android microphone silencing by another app/call reports an interruption.
The tester APK includes ARM64 and x86_64; 32-bit devices are outside this candidate.

PCM is converted to float32 in memory. Half-second VAD windows collect disjoint
utterances with a silence-only pre-roll. One second of silence ends an utterance.
Only complete transcription results increment counts, so revisable partial
transcripts cannot double count. No prompt or previous-transcript context biases
recognition. Capture, VAD and decode generations reject late events/results after
pause. All counts still commit to SQLite before UI updates.

VAD backlog is bounded to four seconds and the decoding queue to two utterances.
An uninterrupted utterance over twenty seconds or processing backlog pauses with
an actionable error instead of dropping audio silently. Decode has a thirty-second
deadline. Pause/background discards unfinished audio and pending recognition;
counts already saved remain. Users must pause briefly and allow counts to settle
before ending. A phrase can be missed at a VAD boundary; this must be measured.

The model and audio buffers never leave the phone and are not saved to files.
Models download only at build time. Native model initialization may take a few
seconds; the app shows “Preparing offline voice”. Display labels have increased
contrast based on the owner's recording.

Automated lifecycle tests cannot prove VAD/model accuracy. On the S10, first
upgrade without uninstalling and verify total 13 remains. Grant mic, say ten
normal phrases with a one-second gap, wait for counts to settle, then record the
detected total. Repeat in airplane mode with Wi-Fi off. Follow the full phone
acceptance protocol before claiming reliability: silence/unrelated speech,
normal/rapid/noisy recitations, pause/resume, lock/background, calls, storage,
latency, memory and battery. The original >=95% accuracy gate remains unmet until
independent device tallies are available.
