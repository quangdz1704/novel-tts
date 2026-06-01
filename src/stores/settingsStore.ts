import { create } from 'zustand';

type SettingsState = {
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  readerTheme: 'paper' | 'light' | 'dark';
  lineHeight: number;
  fontFamily: 'sans' | 'serif';
  setTheme: (t: 'system' | 'light' | 'dark') => void;
  setFontSize: (n: number) => void;
  setReaderTheme: (t: 'paper' | 'light' | 'dark') => void;
  setLineHeight: (n: number) => void;
  setFontFamily: (f: 'sans' | 'serif') => void;
  load: () => void;
};

const KEY = 'novel_tts_settings';

export const useSettingsStore = create<SettingsState>((set, get) => ({
  theme: 'system',
  fontSize: 16,
  readerTheme: 'paper',
  lineHeight: 1.85,
  fontFamily: 'serif',
  setTheme: (t) => {
    set({ theme: t });
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ ...get(), theme: t }),
      );
    } catch (e) {}
    try {
      const root =
        typeof document !== 'undefined' ? document.documentElement : null;
      const prefersDark =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-color-scheme: dark)').matches;
      const shouldUseDark = t === 'dark' || (t === 'system' && prefersDark);
      if (root) {
        root.dataset.appTheme = t;
        if (shouldUseDark) root.classList.add('dark');
        else root.classList.remove('dark');
      }
    } catch (e) {}
  },
  setFontSize: (n) => {
    set({ fontSize: n });
    try {
      localStorage.setItem(
        KEY,
        JSON.stringify({ ...get(), fontSize: n }),
      );
    } catch (e) {}
    try {
      const root =
        typeof document !== 'undefined' ? document.documentElement : null;
      if (root) root.style.setProperty('--reader-font-size', n + 'px');
    } catch (e) {}
  },
  setReaderTheme: (t) => {
    set({ readerTheme: t });
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...get(), readerTheme: t }));
    } catch (e) {}
  },
  setLineHeight: (n) => {
    set({ lineHeight: n });
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...get(), lineHeight: n }));
    } catch (e) {}
  },
  setFontFamily: (f) => {
    set({ fontFamily: f });
    try {
      localStorage.setItem(KEY, JSON.stringify({ ...get(), fontFamily: f }));
    } catch (e) {}
  },
  load: () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj.theme) get().setTheme(obj.theme);
        if (obj.fontSize) get().setFontSize(obj.fontSize);
        if (obj.readerTheme) get().setReaderTheme(obj.readerTheme);
        if (obj.lineHeight) get().setLineHeight(obj.lineHeight);
        if (obj.fontFamily) get().setFontFamily(obj.fontFamily);
      } else {
        get().setTheme(get().theme);
      }
    } catch (e) {}
  },
}));
