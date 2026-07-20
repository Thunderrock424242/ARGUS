import type { VoiceAlertProvider, VoiceAlertRequest } from "@/packages/shared/types";

const PREFERRED_VOICE_PATTERN = /female|samantha|zira|aria|jenny|karen|moira|ava|susan/i;

export class BrowserSpeechVoiceAlertProvider implements VoiceAlertProvider {
  private activeUtterance: SpeechSynthesisUtterance | null = null;

  async speak(request: VoiceAlertRequest): Promise<void> {
    if (!("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) {
      throw new Error("Browser voice synthesis is unavailable.");
    }
    if (request.interruptCurrent) this.stop();
    const utterance = new SpeechSynthesisUtterance(request.message);
    utterance.rate = 0.95;
    utterance.pitch = 0.92;
    utterance.volume = request.priority === "critical" ? 0.9 : 0.75;
    const voices = window.speechSynthesis.getVoices();
    utterance.voice = voices.find((voice) => voice.lang.startsWith("en") && PREFERRED_VOICE_PATTERN.test(voice.name))
      ?? voices.find((voice) => voice.lang.startsWith("en"))
      ?? null;
    this.activeUtterance = utterance;
    await new Promise<void>((resolve, reject) => {
      utterance.onend = () => {
        this.activeUtterance = null;
        resolve();
      };
      utterance.onerror = (event) => {
        this.activeUtterance = null;
        reject(new Error(`Voice alert failed: ${event.error}`));
      };
      window.speechSynthesis.speak(utterance);
    });
  }

  stop(): void {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    this.activeUtterance = null;
  }

  isSpeaking(): boolean {
    return this.activeUtterance !== null && window.speechSynthesis.speaking;
  }
}

export function createBrowserVoiceAlertProvider(): VoiceAlertProvider | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  return new BrowserSpeechVoiceAlertProvider();
}

export async function playArgusSignalTone(volume = 0.3): Promise<void> {
  const AudioContextConstructor = window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) throw new Error("Browser audio is unavailable.");
  const context = new AudioContextConstructor();
  const oscillator = context.createOscillator();
  const gain = context.createGain();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(660, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.12);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(Math.max(0.001, volume * 0.16), context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.28);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.3);
  await new Promise((resolve) => setTimeout(resolve, 320));
  await context.close();
}
