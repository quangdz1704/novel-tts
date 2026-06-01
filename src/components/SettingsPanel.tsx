import React, { useEffect } from 'react';
import { useSettingsStore } from '../stores/settingsStore';

export default function SettingsPanel() {
  const theme = useSettingsStore((s) => s.theme);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const setTheme = useSettingsStore((s) => s.setTheme);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const load = useSettingsStore((s) => s.load);

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">Settings</h2>
      <div className="mt-3">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">Theme</label>
          <button
            className={`px-3 py-1 rounded ${theme === 'light' ? 'bg-gray-600' : 'bg-gray-800'}`}
            onClick={() => setTheme('light')}
          >
            Light
          </button>
          <button
            className={`px-3 py-1 rounded ${theme === 'dark' ? 'bg-gray-600' : 'bg-gray-800'}`}
            onClick={() => setTheme('dark')}
          >
            Dark
          </button>
        </div>
        <div className="mt-3">
          <label className="block text-sm">
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
      </div>
    </div>
  );
}
