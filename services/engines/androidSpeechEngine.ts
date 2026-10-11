import { Platform } from 'react-native';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { SpeechEngine } from './speechEngine';

export class AndroidSpeechEngine extends SpeechEngine {
  constructor() {
    super(ExpoSpeechRecognitionModule, Platform);
  }
}
