import React, { useState, useEffect } from 'react';
import { browserTTS } from '../core/tts/browserTTS';

export default function TTSControls() {
  const [text, setText] = useState('');
  const [rate, setRate] = useState(1);
  const [pitch, setPitch] = useState(1);
  const [volume, setVolume] = useState(1);
  const [speaking, setSpeaking] = useState(false);
  const [progress, setProgress] = useState<{
    utteranceIndex: number;
    charIndex: number;
  } | null>(null);

  useEffect(() => {
    setText(
      'This is a demo of the local browser TTS. It will read sentence by sentence.',
    );
    browserTTS.onProgress((info) =>
      setProgress({
        utteranceIndex: info.utteranceIndex,
        charIndex: info.charIndex,
      }),
    );
    return () => {
      browserTTS.onProgress(undefined);
      browserTTS.stop();
    };
  }, []);

  const handlePlay = () => {
    browserTTS.speak(text, { rate, pitch, volume });
    setSpeaking(true);
  };

  const handlePause = () => {
    browserTTS.pause();
    setSpeaking(false);
  };

  const handleResume = () => {
    browserTTS.resume();
    setSpeaking(true);
  };

  const handleStop = () => {
    browserTTS.stop();
    setSpeaking(false);
    setProgress(null);
  };

  return (
    <div className="surface-panel">
      <p className="panel-kicker">Voice</p>
      <h2 className="panel-title">TTS controls</h2>
      <textarea
        className="field-input mt-3 h-28 w-full resize-none"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="mt-3 grid gap-3 text-sm text-[var(--muted)]">
        <label className="grid gap-1">
          Rate
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1">
          Pitch
          <input
            type="range"
            min="0.5"
            max="2"
            step="0.1"
            value={pitch}
            onChange={(e) => setPitch(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1">
          Volume
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <button className="primary-button" onClick={handlePlay}>
          Play
        </button>
        <button className="secondary-button" onClick={handlePause}>
          Pause
        </button>
        <button className="secondary-button" onClick={handleResume}>
          Resume
        </button>
        <button className="ghost-button" onClick={handleStop}>
          Stop
        </button>
      </div>
      <div className="mt-3 text-sm text-[var(--muted)]">
        Speaking: {speaking ? 'Yes' : 'No'}
      </div>
      <div className="mt-1 text-sm text-[var(--muted)]">
        Progress:{' '}
        {progress
          ? `utterance ${progress.utteranceIndex} char ${progress.charIndex}`
          : '—'}
      </div>
    </div>
  );
}
