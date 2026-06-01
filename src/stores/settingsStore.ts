import { create } from 'zustand';

type SettingsState = {
  theme: 'light' | 'dark';
  fontSize: number;
  setTheme: (t: 'light' | 'dark') => void;
  setFontSize: (n: number) => void;
  load: () => void;
};

const KEY = 'novel_tts_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'light',
  fontSize: 16,
  setTheme: (t) => {
    set({ theme: t });
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ theme: t, fontSize: get().fontSize }),
      );
    } catch (e) {}
    try {
      const root =
        typeof document !== 'undefined' ? document.documentElement : null;
      if (root) {
        if (t === 'dark') root.classList.add('dark');
        else root.classList.remove('dark');
      }
    } catch (e) {}
  },
  setFontSize: (n) => {
    set({ fontSize: n });
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ theme: get().theme, fontSize: n }),
      );
    } catch (e) {}
    try {
      const root =
        typeof document !== 'undefined' ? document.documentElement : null;
      if (root) root.style.setProperty('--reader-font-size', n + 'px');
    } catch (e) {}
  },
  load: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.theme) get().setTheme(obj.theme);
        if (obj.fontSize) get().setFontSize(obj.fontSize);
      }
    } catch (e) {}
  },
}));
