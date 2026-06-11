type ProgressCallback = (info: {
  charIndex: number;
  utteranceIndex: number;
  status: 'start' | 'boundary' | 'end' | 'error';
}) => void;

type StateCallback = (state: {
  speaking: boolean;
  paused: boolean;
}) => void;

type SpeakOptions = {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
  voiceURI?: string;
  utteranceOffset?: number;
};

export class BrowserTTS {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  private queue: SpeechSynthesisUtterance[] = [];
  private isSpeaking = false;
  private isPaused = false;
  private progressCb?: ProgressCallback;
  private stateCb?: StateCallback;

  speak(text: string | string[], opts: SpeakOptions = {}) {
    if (!this.synth) return;
    this.stop();
    const chunks = Array.isArray(text) ? text.filter(Boolean) : this.splitSentences(text);
    const voice = this.pickVoice(opts.lang ?? 'vi-VN', opts.voiceURI);
    const utteranceOffset = opts.utteranceOffset ?? 0;
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
      const utteranceIndex = utteranceOffset + idx;
      u.onstart = () => {
        this.isSpeaking = true;
        this.isPaused = false;
        this.emitState();
        this.progressCb?.({ charIndex: 0, utteranceIndex, status: 'start' });
      };
      u.onboundary = (ev: any) => {
        if (ev && ev.charIndex != null)
          this.progressCb?.({
            charIndex: ev.charIndex,
            utteranceIndex,
            status: 'boundary',
          });
      };
      u.onend = () => {
        this.progressCb?.({
          charIndex: u.text.length,
          utteranceIndex,
          status: 'end',
        });
        if (idx === this.queue.length - 1) {
          this.isSpeaking = false;
          this.isPaused = false;
          this.emitState();
        }
      };
      u.onerror = () => {
        this.progressCb?.({
          charIndex: 0,
          utteranceIndex,
          status: 'error',
        });
        if (idx === this.queue.length - 1) {
          this.isSpeaking = false;
          this.isPaused = false;
          this.emitState();
        }
      };
      this.synth!.speak(u);
    });
    this.isSpeaking = true;
    this.isPaused = false;
    this.emitState();
  }

  pause() {
    if (!this.synth) return;
    if (this.synth.speaking) {
      this.synth.pause();
      this.isPaused = true;
      this.emitState();
    }
  }

  resume() {
    if (!this.synth) return;
    if (this.synth.paused) {
      this.synth.resume();
      this.isPaused = false;
      this.emitState();
    }
  }

  stop() {
    if (!this.synth) return;
    this.synth.cancel();
    this.queue = [];
    this.isSpeaking = false;
    this.isPaused = false;
    this.emitState();
  }

  onProgress(cb: ProgressCallback | undefined) {
    this.progressCb = cb;
  }

  onState(cb: StateCallback | undefined) {
    this.stateCb = cb;
    if (cb) this.emitState();
  }

  getState() {
    return {
      speaking: this.isSpeaking,
      paused: this.isPaused,
    };
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

  private emitState() {
    this.stateCb?.({
      speaking: this.isSpeaking,
      paused: this.isPaused,
    });
  }

  private splitSentences(text: string) {
    const parts = text.split(/(?<=[.!?。！？。！？])\s+/);
    return parts.filter(Boolean);
  }
}

export const browserTTS = new BrowserTTS();
