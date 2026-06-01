type ProgressCallback = (info: {
  charIndex: number;
  utteranceIndex: number;
}) => void;

export class BrowserTTS {
  private synth: SpeechSynthesis | null =
    typeof window !== 'undefined' && 'speechSynthesis' in window
      ? window.speechSynthesis
      : null;
  private queue: SpeechSynthesisUtterance[] = [];
  private isSpeaking = false;
  private progressCb?: ProgressCallback;

  speak(
    text: string,
    opts: { rate?: number; pitch?: number; volume?: number } = {},
  ) {
    if (!this.synth) return;
    this.stop();
    const sentences = this.splitSentences(text);
    this.queue = sentences.map((s) => {
      const u = new SpeechSynthesisUtterance(s);
      u.rate = opts.rate ?? 1;
      u.pitch = opts.pitch ?? 1;
      u.volume = opts.volume ?? 1;
      return u;
    });

    this.queue.forEach((u, idx) => {
      u.onboundary = (ev: any) => {
        if (ev && ev.charIndex != null)
          this.progressCb?.({ charIndex: ev.charIndex, utteranceIndex: idx });
      };
      u.onend = () => {
        // if last utterance, clear state
        if (idx === this.queue.length - 1) this.isSpeaking = false;
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

  private splitSentences(text: string) {
    // naive sentence splitter; keeps delimiters
    const parts = text.split(/(?<=[.!?。！？])\s+/);
    return parts.filter(Boolean);
  }
}

export const browserTTS = new BrowserTTS();
