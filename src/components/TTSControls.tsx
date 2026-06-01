import React, { useState, useEffect } from "react";
import { browserTTS } from "../core/tts/browserTTS";
import { useSettingsStore } from "../stores/settingsStore";

export default function TTSControls() {
  const [text, setText] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const rate = useSettingsStore((s) => s.ttsRate);
  const pitch = useSettingsStore((s) => s.ttsPitch);
  const volume = useSettingsStore((s) => s.ttsVolume);
  const voiceURI = useSettingsStore((s) => s.ttsVoiceURI);
  const setRate = useSettingsStore((s) => s.setTtsRate);
  const setPitch = useSettingsStore((s) => s.setTtsPitch);
  const setVolume = useSettingsStore((s) => s.setTtsVolume);
  const setVoiceURI = useSettingsStore((s) => s.setTtsVoiceURI);
  const [progress, setProgress] = useState<{
    utteranceIndex: number;
    charIndex: number;
    status: string;
  } | null>(null);

  useEffect(() => {
    setText(
      "Đây là phần kiểm tra giọng đọc tiếng Việt. Ứng dụng sẽ đọc từng câu để bạn nghe thử.",
    );
    const updateVoices = () => {
      const availableVoices = browserTTS.getVoices();
      const currentVoiceURI = useSettingsStore.getState().ttsVoiceURI;
      setVoices(availableVoices);
      const nextVoiceURI =
        currentVoiceURI &&
        availableVoices.some((voice) => voice.voiceURI === currentVoiceURI)
          ? currentVoiceURI
          : availableVoices.find(
              (voice) => voice.lang.toLowerCase() === "vi-vn",
            )?.voiceURI ||
            availableVoices.find((voice) =>
              voice.lang.toLowerCase().startsWith("vi"),
            )?.voiceURI ||
            "";
      if (nextVoiceURI !== currentVoiceURI) setVoiceURI(nextVoiceURI);
    };

    updateVoices();
    const removeVoicesListener = browserTTS.onVoicesChanged(updateVoices);
    browserTTS.onProgress((info) =>
      setProgress({
        utteranceIndex: info.utteranceIndex,
        charIndex: info.charIndex,
        status: info.status,
      }),
    );
    return () => {
      removeVoicesListener();
      browserTTS.onProgress(undefined);
      browserTTS.stop();
    };
  }, [setVoiceURI]);

  const handlePlay = () => {
    browserTTS.speak(text, { rate, pitch, volume, lang: "vi-VN", voiceURI });
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
          Rate: {rate}
          <input
            type="range"
            min="0.5"
            max="4"
            step="0.1"
            value={rate}
            onChange={(e) => setRate(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1">
          Pitch: {pitch}
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
          Volume: {volume}
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(Number(e.target.value))}
          />
        </label>
        <label className="grid gap-1">
          Voice
          <select
            className="field-input"
            value={voiceURI}
            onChange={(e) => setVoiceURI(e.target.value)}
          >
            <option value="">Auto Vietnamese</option>
            {voices.map((voice) => (
              <option key={voice.voiceURI} value={voice.voiceURI}>
                {voice.name} ({voice.lang})
              </option>
            ))}
          </select>
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
        Speaking: {speaking ? "Yes" : "No"}
      </div>
      <div className="mt-1 text-sm text-[var(--muted)]">
        Progress:{" "}
        {progress
          ? `utterance ${progress.utteranceIndex} char ${progress.charIndex} ${progress.status}`
          : "—"}
      </div>
    </div>
  );
}
