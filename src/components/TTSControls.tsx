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
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">TTS Controls</h2>
      <textarea
        className="w-full h-28 p-2 mt-2 bg-white/5"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex gap-2 mt-2">
        <label className="flex items-center gap-2">
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
        <label className="flex items-center gap-2">
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
        <label className="flex items-center gap-2">
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
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-2 rounded bg-green-600" onClick={handlePlay}>
          Play
        </button>
        <button
          className="px-3 py-2 rounded bg-yellow-600"
          onClick={handlePause}
        >
          Pause
        </button>
        <button
          className="px-3 py-2 rounded bg-blue-600"
          onClick={handleResume}
        >
          Resume
        </button>
        <button className="px-3 py-2 rounded bg-red-600" onClick={handleStop}>
          Stop
        </button>
      </div>
      <div className="mt-2 text-sm text-gray-300">
        Speaking: {speaking ? 'Yes' : 'No'}
      </div>
      <div className="mt-1 text-sm text-gray-300">
        Progress:{' '}
        {progress
          ? `utterance ${progress.utteranceIndex} char ${progress.charIndex}`
          : '—'}
      </div>
    </div>
  );
}
