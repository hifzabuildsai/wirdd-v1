package expo.modules.wirddaudio

import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.AudioRecordingConfiguration
import android.media.MediaRecorder
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/** Foreground PCM capture only. No file, upload, or Android speech service. */
class WirddAudioModule : Module() {
  @Volatile private var running = false
  private var recorder: AudioRecord? = null
  private var worker: Thread? = null
  private var manager: AudioManager? = null
  private var activeToken = 0
  private val recordingCallback = object : AudioManager.AudioRecordingCallback() {
    override fun onRecordingConfigChanged(configs: List<AudioRecordingConfiguration>) {
      val active = recorder ?: return
      if (Build.VERSION.SDK_INT >= 29 && running &&
          configs.any { it.clientAudioSessionId == active.audioSessionId && it.isClientSilenced }) {
        sendEvent("onError", mapOf("token" to activeToken, "message" to "Microphone interrupted by another app or call. Pause and retry."))
      }
    }
  }

  override fun definition() = ModuleDefinition {
    Name("WirddAudio")
    Events("onAudio", "onError")
    AsyncFunction("start") { token: Int -> startCapture(token) }
    AsyncFunction("stop") { stopCapture() }
    OnDestroy { stopCapture() }
  }

  @Synchronized private fun startCapture(token: Int) {
    stopCapture()
    val minimum = AudioRecord.getMinBufferSize(16000, AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT)
    check(minimum > 0) { "16 kHz microphone capture is unavailable." }
    val audio = AudioRecord(MediaRecorder.AudioSource.VOICE_RECOGNITION, 16000,
      AudioFormat.CHANNEL_IN_MONO, AudioFormat.ENCODING_PCM_16BIT, maxOf(minimum * 2, 8192))
    try {
      check(audio.state == AudioRecord.STATE_INITIALIZED) { "Microphone could not initialize." }
      audio.startRecording()
      check(audio.recordingState == AudioRecord.RECORDSTATE_RECORDING) { "Microphone did not start." }
    } catch (error: Exception) { audio.release(); throw error }
    recorder = audio
    activeToken = token
    running = true
    manager = appContext.reactContext?.getSystemService(AudioManager::class.java)
    manager?.registerAudioRecordingCallback(recordingCallback, Handler(Looper.getMainLooper()))
    worker = Thread({
      android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)
      val buffer = ByteArray(4096)
      try {
        while (running) {
          val size = audio.read(buffer, 0, buffer.size, AudioRecord.READ_BLOCKING)
          if (!running) break
          check(size > 0) { "Microphone read failed ($size)." }
          sendEvent("onAudio", mapOf("token" to token,
            "pcm" to Base64.encodeToString(buffer, 0, size, Base64.NO_WRAP)))
        }
      } catch (error: Exception) {
        if (running) sendEvent("onError", mapOf("token" to token, "message" to (error.message ?: "Microphone stopped.")))
      } finally { audio.release() }
    }, "WirddMicrophone").also { it.start() }
  }

  @Synchronized private fun stopCapture() {
    running = false
    manager?.unregisterAudioRecordingCallback(recordingCallback)
    manager = null
    try { recorder?.stop() } catch (_: Exception) { }
    worker?.join(2000)
    check(worker?.isAlive != true) { "Microphone did not stop. Retry after closing Wirdd." }
    worker = null
    recorder = null
  }
}
