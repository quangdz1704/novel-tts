type ProgressCallback = (info: {
  charIndex: number;
  utteranceIndex: number;
  status: 'start' | 'boundary' | 'end' | 'error';
}) => void;

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceURI?: string;
};

export class BrowserTTS {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  private queue: SpeechSynthesisUtterance[] = [];
  private isSpeaking = false;
  private progressCb?: ProgressCallback;

  speak(text: string | string[], opts: SpeakOptions = {}) {
    if (!this.synth) return;
    this.stop();
    const chunks = Array.isArray(text) ? text.filter(Boolean) : this.splitSentences(text);
    const voice = this.pickVoice(opts.lang ?? 'vi-VN', opts.voiceURI);
    this.queue = chunks.map((s) => {
      const u = new SpeechSynthesisUtterance(s);
      u.lang = voice?.lang || opts.lang || 'vi-VN';
      if (voice) u.voice = voice;
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.volume = opts.volume ?? 1;
      return u;
    });

    this.queue.forEach((u, idx) => {
      u.onstart = () => {
        this.progressCb?.({ charIndex: 0, utteranceIndex: idx, status: 'start' });
      };
      u.onboundary = (ev: any) => {
        if (ev && ev.charIndex != null)
          this.progressCb?.({
            charIndex: ev.charIndex,
            utteranceIndex: idx,
            status: 'boundary',
          });
      };
      u.onend = () => {
        this.progressCb?.({
          charIndex: u.text.length,
          utteranceIndex: idx,
          status: 'end',
        });
        if (idx === this.queue.length - 1) {
          this.isSpeaking = false;
        }
      };
      u.onerror = () => {
        this.progressCb?.({
          charIndex: 0,
          utteranceIndex: idx,
          status: 'error',
        });
        if (idx === this.queue.length - 1) {
          this.isSpeaking = false;
        }
      };
      this.synth!.speak(u);
    });
    this.isSpeaking = true;
  }

  pause() {
    if (!this.synth) return;
    if (this.synth.speaking) this.synth.pause();
  }

  resume() {
    if (!this.synth) return;
    if (this.synth.paused) this.synth.resume();
  }

  stop() {
    if (!this.synth) return;
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
  }

  onProgress(cb: ProgressCallback | undefined) {
    this.progressCb = cb;
  }

  getVoices() {
    if (!this.synth) return [];
    return this.synth.getVoices();
  }

  onVoicesChanged(cb: () => void) {
    if (!this.synth) return () => {};
    this.synth.addEventListener('voiceschanged', cb);
    return () => this.synth?.removeEventListener('voiceschanged', cb);
  }

  private pickVoice(lang: string, voiceURI?: string) {
    const voices = this.getVoices();
    if (voiceURI) {
      const selected = voices.find((voice) => voice.voiceURI === voiceURI);
      if (selected) return selected;
    }

    const normalized = lang.toLowerCase();
    return (
      voices.find((voice) => voice.lang.toLowerCase() === normalized) ||
      voices.find((voice) => voice.lang.toLowerCase().startsWith(normalized.split('-')[0])) ||
      voices.find((voice) => voice.default) ||
      voices[0]
    );
  }

  private splitSentences(text: string) {
    const parts = text.split(/(?<=[.!?。！？。！？])\s+/);
    return parts.filter(Boolean);
  }
}

export const browserTTS = new BrowserTTS();
