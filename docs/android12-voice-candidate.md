# Android 12 offline voice candidate

Current result: v8 (base Q5_1, beam size 3) installed on S10 but the owner's
three-phrase test still counted zero. Live feedback showed 105.3 seconds received,
28 speech windows and 11 recognitions; the last recognized words were incorrect.
See `outputs/s10-v8-voice-diagnostics.json`. Voice accuracy remains failed.

The next candidate adds a six-second, one-recitation check in idle state or in
Voice check while paused. It bypasses VAD and transcribes the entire bounded
sample with the same microphone, PCM conversion and model. Capture stops before
decoding. It never creates a session or adds counts. Audio stays in memory and
the text is shown only in the live panel. Cancellation/background discards the
sample and ignores late results. This distinguishes boundary failures from
capture/recognition failures; it is not an accuracy fix. Normal sessions also
show the last decoded sample duration and maximum received RMS level.

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

Build v5 `86c74898-b960-4536-b549-b864814351f0` finished and was upgraded on the
S10 without uninstalling. App cold launch and Dashboard still show total 13 and
the two previous sessions. Owner confirmed microphone listening, but reported no
voice increments. v5 is not a successful voice candidate. Both model
file hashes were checked in the packaged APK, alongside all license notices.

Root cause found in the pinned library: its native `requireAudioBufferArgument`
calls `decodePcm16`, although the TypeScript VAD comment says Float32. v5 passed
Float32 bytes into both native VAD and transcription, corrupting the waveform
and doubling its sample count. The correction explicitly encodes little-endian
PCM16 at both library boundaries. Regression tests check byte length, sample
values, endianness and overload handling. Physical recognition must be retested.
The v5 emulator startup/pause/resume smoke passed but did not exercise speech;
it cannot validate this boundary or accuracy.

v6 (`a2e8a796-a185-4998-8821-517abd67e502`) built and upgraded on S10; emulator
install/history/start/pause/resume passed. Owner still detected zero for three
spaced recitations after ten seconds of silence. Dashboard retained 13. v6 is
not accepted. Candidate v7 adds an optional Voice check panel with live audio
duration/RMS, speech windows, completed recognitions, last recognized text and
phrase matches. This feedback is in memory only, cleared on stop/restart, and
never written to logs, SQLite or files. It is diagnostic evidence, not a voice
accuracy fix.

PCM is converted to float32 for internal buffering and back to PCM16 for native
model calls. Half-second VAD windows collect disjoint
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
