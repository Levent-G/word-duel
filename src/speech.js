import { setAudioModeAsync } from 'expo-audio';
import * as Speech from 'expo-speech';

let audioReady = null;

/** iOS mutes speech when the ring switch is on silent unless the audio session allows it. */
export function ensureAudioMode() {
  if (!audioReady) {
    audioReady = setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }
  return audioReady;
}

export async function speak(text, rate = 0.9) {
  if (!text) return;
  await ensureAudioMode();
  Speech.stop();
  Speech.speak(text, { language: 'en-US', rate });
}

export function stopSpeaking() {
  Speech.stop();
}
