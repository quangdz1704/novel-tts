import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useReaderStore } from '../core/reader/readerStore';
import { htmlToText, sanitizeHtml } from '../core/reader/content';
import { browserTTS } from '../core/tts/browserTTS';
import { useSettingsStore } from '../stores/settingsStore';

export default function ReaderPanel() {
  const novelId = useReaderStore((s) => s.novelId ?? 'demo_novel');
  const chapterId = useReaderStore((s) => s.chapterId ?? '1');
  const content = useReaderStore((s) => s.content);
  const saveProgress = useReaderStore((s) => s.saveProgress);
  const restoreProgress = useReaderStore((s) => s.restoreProgress);
  const setNovelId = useReaderStore((s) => s.setNovelId);
  const setChapterId = useReaderStore((s) => s.setChapterId);
  const openChapter = useReaderStore((s) => s.openChapter);
  const fontSize = useSettingsStore((s) => s.fontSize);
  const lineHeight = useSettingsStore((s) => s.lineHeight);
  const readerTheme = useSettingsStore((s) => s.readerTheme);
  const fontFamily = useSettingsStore((s) => s.fontFamily);
  const setFontSize = useSettingsStore((s) => s.setFontSize);
  const setLineHeight = useSettingsStore((s) => s.setLineHeight);
  const setReaderTheme = useSettingsStore((s) => s.setReaderTheme);
  const setFontFamily = useSettingsStore((s) => s.setFontFamily);
  const [ttsActive, setTtsActive] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    let lastSave = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const now = Date.now();
        if (now - lastSave > 1000) {
          lastSave = now;
          saveProgress({ scrollY: el.scrollTop });
        }
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [saveProgress, content]);

  useEffect(() => {
    if (!content || !novelId) return;
    const restore = async () => {
      const pos = await restoreProgress(novelId);
      if (pos && containerRef.current)
        containerRef.current.scrollTop = pos.scrollY || 0;
    };
    restore();
  }, [content, novelId, restoreProgress]);

  const open = async () => {
    await openChapter(novelId, chapterId);
  };

  const safeContent = useMemo(
    () => (content ? sanitizeHtml(content) : ''),
    [content],
  );

  const readCurrent = () => {
    if (!safeContent) return;
    browserTTS.speak(htmlToText(safeContent), { rate: 1, pitch: 1, volume: 1 });
    setTtsActive(true);
  };

  const stopReading = () => {
    browserTTS.stop();
    setTtsActive(false);
  };

  return (
    <div className="reader-panel">
      <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="panel-kicker">Now reading</p>
          <h2 className="truncate text-xl font-semibold text-slate-950">
            {novelId}
          </h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            className="secondary-button"
            onClick={() => setShowPrefs((v) => !v)}
          >
            Appearance
          </button>
          <button
            className="secondary-button"
            onClick={readCurrent}
            disabled={!safeContent}
          >
            Read aloud
          </button>
          <button
            className="ghost-button"
            onClick={stopReading}
            disabled={!ttsActive}
          >
            Stop
          </button>
        </div>
      </div>

      {showPrefs && (
        <div className="grid gap-4 border-b border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="grid gap-2 text-sm text-slate-600">
            Theme
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
          <label className="grid gap-2 text-sm text-slate-600">
            Font
            <select
              className="field-input"
              value={fontFamily}
              onChange={(e) => setFontFamily(e.target.value as any)}
            >
              <option value="serif">Serif</option>
              <option value="sans">Sans</option>
            </select>
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
            Font size: {fontSize}px
            <input
              type="range"
              min={14}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm text-slate-600">
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
      )}

      <div className="grid gap-3 border-b border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_160px_auto]">
        <input
          className="field-input"
          placeholder="Novel ID"
          value={novelId}
          onChange={(e) => setNovelId(e.target.value)}
        />
        <input
          className="field-input"
          placeholder="Chapter ID"
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
        />
        <button className="primary-button" onClick={open}>
          Open
        </button>
      </div>

      <div
        ref={containerRef}
        className={`reader-content reader-theme-${readerTheme}`}
        style={{
          fontSize,
          lineHeight,
          fontFamily:
            fontFamily === 'serif'
              ? 'Georgia, Cambria, Times New Roman, serif'
              : undefined,
        }}
      >
        {safeContent ? (
          <div dangerouslySetInnerHTML={{ __html: safeContent }} />
        ) : (
          <div className="reader-empty">
            <div className="text-lg font-semibold text-slate-700">
              No chapter loaded
            </div>
            <div className="mt-2 max-w-md text-sm text-slate-500">
              Open a saved chapter from the library, or use Advanced mode to
              crawl and download a novel first.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
