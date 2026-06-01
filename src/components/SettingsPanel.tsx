import React, { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export default function SettingsPanel() {
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const readerTheme = useSettingsStore((s) => s.readerTheme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const setReaderTheme = useSettingsStore((s) => s.setReaderTheme);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="surface-panel">
      <p className="panel-kicker">Preferences</p>
      <h2 className="panel-title">Settings</h2>
      <div className="mt-3">
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-slate-600">Theme</label>
          <button
            className={theme === 'light' ? 'secondary-button' : 'ghost-button'}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            className={theme === 'dark' ? 'secondary-button' : 'ghost-button'}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
        <div className="mt-3">
          <label className="block text-sm text-slate-600">
            Reader font size: {fontSize}px
          </label>
          <input
            type="range"
            min={12}
            max={28}
            value={fontSize}
            onChange={(e) => setFontSize(Number(e.target.value))}
          />
        </div>
        <div className="mt-3 grid gap-3">
          <label className="grid gap-1 text-sm text-slate-600">
            Reader color
            <select
              className="field-input"
              value={readerTheme}
              onChange={(e) => setReaderTheme(e.target.value as any)}
            >
              <option value="paper">Paper</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            Font family
            <select
              className="field-input"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as any)}
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm text-slate-600">
            Line height: {lineHeight.toFixed(2)}
            <input
              type="range"
              min={1.4}
              max={2.4}
              step={0.05}
              value={lineHeight}
              onChange={(e) => setLineHeight(Number(e.target.value))}
            />
          </label>
        </div>
      </div>
    </div>
  );
}
