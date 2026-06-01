import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type SettingsState = {
  theme: 'system' | 'light' | 'dark';
  fontSize: number;
  readerTheme: 'paper' | 'light' | 'dark';
  lineHeight: number;
  fontFamily: 'sans' | 'serif';
  ttsRate: number;
  ttsPitch: number;
  ttsVolume: number;
  ttsVoiceURI: string;
  setTheme: (t: 'system' | 'light' | 'dark') => void;
  setFontSize: (n: number) => void;
  setReaderTheme: (t: 'paper' | 'light' | 'dark') => void;
  setLineHeight: (n: number) => void;
  setFontFamily: (f: 'sans' | 'serif') => void;
  setTtsRate: (n: number) => void;
  setTtsPitch: (n: number) => void;
  setTtsVolume: (n: number) => void;
  setTtsVoiceURI: (voiceURI: string) => void;
  load: () => void;
};

const KEY = 'novel_tts_settings';

function applyTheme(theme: SettingsState['theme']) {
  try {
    const root =
      typeof document !== 'undefined' ? document.documentElement : null;
    const prefersDark =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldUseDark = theme === 'dark' || (theme === 'system' && prefersDark);
    if (root) {
      root.dataset.appTheme = theme;
      if (shouldUseDark) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  } catch (e) {}
}

function applyReaderFontSize(fontSize: number) {
  try {
    const root =
      typeof document !== 'undefined' ? document.documentElement : null;
    if (root) root.style.setProperty('--reader-font-size', fontSize + 'px');
  } catch (e) {}
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'system',
      fontSize: 16,
      readerTheme: 'paper',
      lineHeight: 1.85,
      fontFamily: 'serif',
      ttsRate: 1,
      ttsPitch: 1,
      ttsVolume: 1,
      ttsVoiceURI: '',
      setTheme: (theme) => {
        set({ theme });
        applyTheme(theme);
      },
      setFontSize: (fontSize) => {
        set({ fontSize });
        applyReaderFontSize(fontSize);
      },
      setReaderTheme: (readerTheme) => set({ readerTheme }),
      setLineHeight: (lineHeight) => set({ lineHeight }),
      setFontFamily: (fontFamily) => set({ fontFamily }),
      setTtsRate: (ttsRate) => set({ ttsRate }),
      setTtsPitch: (ttsPitch) => set({ ttsPitch }),
      setTtsVolume: (ttsVolume) => set({ ttsVolume }),
      setTtsVoiceURI: (ttsVoiceURI) => set({ ttsVoiceURI }),
      load: () => {
        applyTheme(get().theme);
        applyReaderFontSize(get().fontSize);
      },
    }),
    {
      name: KEY,
      partialize: (state) => ({
        theme: state.theme,
        fontSize: state.fontSize,
        readerTheme: state.readerTheme,
        lineHeight: state.lineHeight,
        fontFamily: state.fontFamily,
        ttsRate: state.ttsRate,
        ttsPitch: state.ttsPitch,
        ttsVolume: state.ttsVolume,
        ttsVoiceURI: state.ttsVoiceURI,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        applyTheme(state.theme);
        applyReaderFontSize(state.fontSize);
      },
    },
  ),
);
