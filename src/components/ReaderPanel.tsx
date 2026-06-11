import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useReaderStore } from "../core/reader/readerStore";
import { htmlToReadableBlocks, sanitizeHtml } from "../core/reader/content";
import { browserTTS } from "../core/tts/browserTTS";
import { useSettingsStore } from "../stores/settingsStore";
import {
  getBackendNovel,
  listBackendNovelChapters,
} from "../core/backend/client";
import BookCover from "./BookCover";
import { glossaryManager } from "../core/glossary/manager";

export default function ReaderPanel({
  onBackToLibrary,
}: {
  onBackToLibrary?: () => void;
}) {
  const novelId = useReaderStore((s) => s.novelId ?? "No novel");
  const chapterId = useReaderStore((s) => s.chapterId ?? "No chapter loaded");
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
  const ttsRate = useSettingsStore((s) => s.ttsRate);
  const ttsPitch = useSettingsStore((s) => s.ttsPitch);
  const ttsVolume = useSettingsStore((s) => s.ttsVolume);
  const ttsVoiceURI = useSettingsStore((s) => s.ttsVoiceURI);
  const setTtsRate = useSettingsStore((s) => s.setTtsRate);
  const setTtsPitch = useSettingsStore((s) => s.setTtsPitch);
  const setTtsVolume = useSettingsStore((s) => s.setTtsVolume);
  const setTtsVoiceURI = useSettingsStore((s) => s.setTtsVoiceURI);
  const [ttsActive, setTtsActive] = useState(false);
  const [ttsPaused, setTtsPaused] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [showChrome, setShowChrome] = useState(true);
  const [nearEnd, setNearEnd] = useState(false);
  const [meta, setMeta] = useState<any>(null);
  const [prevChapter, setPrevChapter] = useState<{
    id: string;
    title: string;
  } | null>(null);
  const [currentChapter, setCurrentChapter] = useState<any>(null);
  const [nextChapter, setNextChapter] = useState<any>(null);
  const [ttsBlockIndex, setTtsBlockIndex] = useState<number | null>(null);
  const [ttsStartBlockIndex, setTtsStartBlockIndex] = useState(0);
  const [autoReadNext, setAutoReadNext] = useState(false);
  const [pendingAutoRead, setPendingAutoRead] = useState(false);
  const [glossaryEnabled, setGlossaryEnabled] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const ttsBlockCountRef = useRef(0);
  const autoReadNextRef = useRef(false);
  const nextChapterRef = useRef<any>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let frame = 0;
    let lastSave = 0;

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const distanceToEnd = el.scrollHeight - el.scrollTop - el.clientHeight;
        setNearEnd(distanceToEnd < 220);
        const now = Date.now();
        if (now - lastSave > 1000) {
          lastSave = now;
          saveProgress({ scrollY: el.scrollTop });
        }
      });
    };

    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [novel, chapters] = await Promise.all([
          getBackendNovel(novelId),
          listBackendNovelChapters(novelId),
        ]);
        setMeta(novel);
        const index = chapters.findIndex((chapter) => chapter.id === chapterId);
        const currentChapter = index >= 0 ? chapters[index] : null;
        setCurrentChapter(currentChapter);

        const prev = index > 0 ? chapters[index - 1] : null;
        if (!cancelled) {
          setPrevChapter(
            prev
              ? {
                  id: prev.id,
                  title: prev.title,
                }
              : null,
          );
        }
        const next = index >= 0 ? chapters[index + 1] : null;
        if (!cancelled) {
          setNextChapter(
            next
              ? {
                  id: next.id,
                  title: next.title,
                }
              : null,
          );
        }
      } catch (e) {
        if (!cancelled) setNextChapter(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [novelId, chapterId, content]);

  const open = async () => {
    if (!currentChapter) return;
    await openChapter(novelId, chapterId);
  };

  const safeContent = useMemo(
    () => (content ? sanitizeHtml(content) : ""),
    [content],
  );
  const glossaryContent = useMemo(() => {
    if (!safeContent || !glossaryEnabled) return safeContent;
    if (typeof document === "undefined") {
      return glossaryManager.applyGlossary(safeContent, {
        novelId,
        style: "xianxia",
      });
    }

    const template = document.createElement("template");
    template.innerHTML = safeContent;
    const walker = document.createTreeWalker(
      template.content,
      NodeFilter.SHOW_TEXT,
    );
    let node = walker.nextNode();
    while (node) {
      node.nodeValue = glossaryManager.applyGlossary(node.nodeValue || "", {
        novelId,
        style: "xianxia",
      });
      node = walker.nextNode();
    }
    return template.innerHTML;
  }, [glossaryEnabled, novelId, safeContent]);
  const readableBlocks = useMemo(
    () => (glossaryContent ? htmlToReadableBlocks(glossaryContent) : []),
    [glossaryContent],
  );

  useEffect(() => {
    ttsBlockCountRef.current = readableBlocks.length;
  }, [readableBlocks.length]);

  useEffect(() => {
    autoReadNextRef.current = autoReadNext;
  }, [autoReadNext]);

  useEffect(() => {
    nextChapterRef.current = nextChapter;
  }, [nextChapter]);

  useEffect(() => {
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
      if (nextVoiceURI !== currentVoiceURI) setTtsVoiceURI(nextVoiceURI);
    };

    updateVoices();
    return browserTTS.onVoicesChanged(updateVoices);
  }, [setTtsVoiceURI]);

  useEffect(() => {
    browserTTS.onProgress((info) => {
      if (info.status === "start" || info.status === "boundary") {
        setTtsBlockIndex(info.utteranceIndex);
      }
      if (
        info.status === "end" &&
        info.utteranceIndex === ttsBlockCountRef.current - 1
      ) {
        setTtsActive(false);
        setTtsPaused(false);
        setTtsBlockIndex(null);
        if (autoReadNextRef.current && nextChapterRef.current) {
          setPendingAutoRead(true);
          void openChapter(novelId, nextChapterRef.current.id).then(() => {
            if (containerRef.current) containerRef.current.scrollTop = 0;
          });
        }
      }
      if (info.status === "error") {
        setTtsActive(false);
        setTtsPaused(false);
      }
    });
    browserTTS.onState((state) => {
      setTtsActive(state.speaking);
      setTtsPaused(state.paused);
    });

    return () => {
      browserTTS.onProgress(undefined);
      browserTTS.onState(undefined);
      browserTTS.stop();
    };
  }, [novelId, openChapter]);

  useEffect(() => {
    if (ttsBlockIndex == null || !containerRef.current) return;
    const block = containerRef.current.querySelector<HTMLElement>(
      `[data-tts-block="${ttsBlockIndex}"]`,
    );
    if (!block) return;

    const container = containerRef.current;
    const blockTop = block.offsetTop;
    const blockBottom = blockTop + block.offsetHeight;
    const visibleTop = container.scrollTop + 80;
    const visibleBottom = container.scrollTop + container.clientHeight - 80;

    if (blockTop < visibleTop || blockBottom > visibleBottom) {
      container.scrollTo({
        top: Math.max(0, blockTop - container.clientHeight * 0.35),
        behavior: "smooth",
      });
    }
  }, [ttsBlockIndex]);

  const getVisibleBlockIndex = useCallback(() => {
    if (!containerRef.current || readableBlocks.length === 0) return 0;
    const container = containerRef.current;
    const targetTop = container.scrollTop + container.clientHeight * 0.32;
    let bestIndex = 0;
    let bestDistance = Number.POSITIVE_INFINITY;

    readableBlocks.forEach((_block, index) => {
      const el = container.querySelector<HTMLElement>(
        `[data-tts-block="${index}"]`,
      );
      if (!el) return;
      const distance = Math.abs(el.offsetTop - targetTop);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestIndex;
  }, [readableBlocks]);

  const playFromBlock = useCallback(
    (startIndex: number) => {
      const normalizedStart = Math.max(
        0,
        Math.min(startIndex, readableBlocks.length - 1),
      );
      const texts = readableBlocks
        .slice(normalizedStart)
        .map((block) => block.text)
        .filter(Boolean);
      if (!texts.length) return;
      ttsBlockCountRef.current = readableBlocks.length;
      setTtsStartBlockIndex(normalizedStart);
      setTtsBlockIndex(normalizedStart);
      setTtsPaused(false);
      browserTTS.speak(texts, {
        rate: ttsRate,
        pitch: ttsPitch,
        volume: ttsVolume,
        lang: "vi-VN",
        voiceURI: ttsVoiceURI,
        utteranceOffset: normalizedStart,
      });
      setTtsActive(true);
    },
    [readableBlocks, ttsPitch, ttsRate, ttsVoiceURI, ttsVolume],
  );

  const hasReadableBlocks = readableBlocks.length > 0;

  useEffect(() => {
    if (!pendingAutoRead || !autoReadNext || !hasReadableBlocks) return;
    setPendingAutoRead(false);
    playFromBlock(0);
  }, [autoReadNext, hasReadableBlocks, pendingAutoRead, playFromBlock]);

  const readCurrent = () => {
    playFromBlock(0);
  };

  const readFromVisible = () => {
    playFromBlock(getVisibleBlockIndex());
  };

  const pauseReading = () => {
    browserTTS.pause();
  };

  const resumeReading = () => {
    browserTTS.resume();
  };

  const jumpReading = (direction: -1 | 1) => {
    const baseIndex = ttsBlockIndex ?? getVisibleBlockIndex();
    playFromBlock(baseIndex + direction);
  };

  const stopReading = () => {
    browserTTS.stop();
    setTtsActive(false);
    setTtsPaused(false);
    setTtsBlockIndex(null);
  };

  const openNext = async () => {
    if (!nextChapter) return;
    stopReading();
    await openChapter(novelId, nextChapter.id);
    if (containerRef.current) containerRef.current.scrollTop = 0;
  };

  const ttsProgress =
    ttsBlockIndex == null || readableBlocks.length === 0
      ? 0
      : Math.round(((ttsBlockIndex + 1) / readableBlocks.length) * 100);

  const currentTtsBlockLabel =
    ttsBlockIndex == null ? ttsStartBlockIndex + 1 : ttsBlockIndex + 1;

  return (
    <div className="reader-panel">
      {showChrome && (
        <div className="reader-toolbar">
          <button
            className="ghost-button"
            onClick={() => {
              stopReading();
              onBackToLibrary?.();
            }}
          >
            Library
          </button>
          <div className="min-w-0 flex-1 text-center">
            {/* <p className="panel-kicker">Now reading</p> */}
            <div className="flex items-center gap-3 justify-center">
              <BookCover
                title={meta?.title || novelId}
                meta={meta}
                className="h-10 w-10 shrink-0 rounded-xl object-cover shadow-lg shadow-black/20"
              />
              <div className="flex flex-col gap-1 items-start">
                <h2 className="truncate text-lg font-semibold text-[var(--app-fg)]">
                  {/* {novelId} */}
                  {meta?.title || novelId}
                </h2>
                <p className="text-sm text-[var(--muted)]">
                  {meta?.author || "Unknown author"}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              className="secondary-button"
              onClick={() => setShowPrefs((v) => !v)}
            >
              Aa
            </button>
            <button
              className="secondary-button"
              onClick={readFromVisible}
              disabled={!hasReadableBlocks}
            >
              Listen
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
      )}

      {showChrome && safeContent && (
        <div className="reader-player">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
              <span className="font-semibold uppercase tracking-wide">
                Voice player
              </span>
              <span>
                Block {Math.min(currentTtsBlockLabel, readableBlocks.length)} of{" "}
                {readableBlocks.length}
              </span>
              {ttsActive && (
                <span className="badge badge-good">
                  {ttsPaused ? "paused" : "playing"}
                </span>
              )}
            </div>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all"
                style={{ width: `${ttsProgress}%` }}
              />
            </div>
          </div>

          <div className="reader-player-actions">
            <button
              className="secondary-button"
              onClick={readCurrent}
              disabled={!hasReadableBlocks}
              title="Read from chapter start"
            >
              Start
            </button>
            <button
              className="secondary-button"
              onClick={readFromVisible}
              disabled={!hasReadableBlocks}
              title="Read from visible paragraph"
            >
              Here
            </button>
            <button
              className="ghost-button"
              onClick={() => jumpReading(-1)}
              disabled={!hasReadableBlocks}
              title="Previous paragraph"
            >
              Prev
            </button>
            {ttsPaused ? (
              <button
                className="primary-button"
                onClick={resumeReading}
                disabled={!ttsActive}
              >
                Resume
              </button>
            ) : (
              <button
                className="primary-button"
                onClick={pauseReading}
                disabled={!ttsActive}
              >
                Pause
              </button>
            )}
            <button
              className="ghost-button"
              onClick={() => jumpReading(1)}
              disabled={!hasReadableBlocks}
              title="Next paragraph"
            >
              Next
            </button>
            <label className="reader-player-toggle">
              <input
                type="checkbox"
                checked={autoReadNext}
                onChange={(e) => setAutoReadNext(e.target.checked)}
              />
              Auto next
            </label>
          </div>
        </div>
      )}

      {showPrefs && (
        <div className="reader-settings-sheet">
          <label className="grid gap-2 text-sm text-[var(--muted)]">
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
          <label className="grid gap-2 text-sm text-[var(--muted)]">
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
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            Font size: {fontSize}px
            <input
              type="range"
              min={14}
              max={28}
              value={fontSize}
              onChange={(e) => setFontSize(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
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
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            TTS voice
            <select
              className="field-input w-full"
              value={ttsVoiceURI}
              onChange={(e) => setTtsVoiceURI(e.target.value)}
            >
              <option value="">Auto Vietnamese</option>
              {voices.map((voice) => (
                <option key={voice.voiceURI} value={voice.voiceURI}>
                  {voice.name} ({voice.lang})
                </option>
              ))}
            </select>
          </label>
          <label className="reader-player-toggle self-end">
            <input
              type="checkbox"
              checked={glossaryEnabled}
              onChange={(e) => setGlossaryEnabled(e.target.checked)}
            />
            Xianxia glossary
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            Rate: {ttsRate}
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={ttsRate}
              onChange={(e) => setTtsRate(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            Pitch: {ttsPitch}
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={ttsPitch}
              onChange={(e) => setTtsPitch(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-2 text-sm text-[var(--muted)]">
            Volume: {ttsVolume}
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={ttsVolume}
              onChange={(e) => setTtsVolume(Number(e.target.value))}
            />
          </label>
        </div>
      )}

      {showChrome && (
        <div className="hidden gap-3 border-b border-[var(--border)] bg-[var(--panel)] p-4 sm:grid sm:grid-cols-[1fr_160px_auto]">
          <input
            className="field-input"
            placeholder="Novel ID"
            value={currentChapter?.title || novelId}
            onChange={(e) => setNovelId(e.target.value)}
          />
          <input
            className="field-input"
            placeholder="Chapter ID"
            value={chapterId}
            onChange={(e) => setChapterId(e.target.value)}
          />
          <button className="primary-button" onClick={open}>
            Go to
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        className={`reader-content reader-theme-${readerTheme}`}
        style={{
          fontSize,
          lineHeight,
          fontFamily:
            fontFamily === "serif"
              ? "Georgia, Cambria, Times New Roman, serif"
              : undefined,
        }}
      >
        {safeContent ? (
          <article className="reader-page">
            <button
              className="reader-toggle"
              onClick={() => setShowChrome((v) => !v)}
            >
              {showChrome ? "Focus" : "Menu"}
            </button>
            <div>
              {readableBlocks.map((block, index) => (
                <div
                  key={index}
                  data-tts-block={index}
                  className={
                    ttsBlockIndex === index
                      ? "reader-tts-block reader-tts-block-active"
                      : "reader-tts-block"
                  }
                  dangerouslySetInnerHTML={{ __html: block.html }}
                />
              ))}
            </div>
          </article>
        ) : (
          <div className="reader-empty">
            <div className="text-lg font-semibold text-[var(--app-fg)]">
              No chapter loaded
            </div>
            <div className="mt-2 max-w-md text-sm text-[var(--muted)]">
              Open a saved chapter from the library, or use Advanced mode to
              crawl and download a novel first.
            </div>
          </div>
        )}
      </div>

      {safeContent && nearEnd && nextChapter && (
        <button className="next-chapter-fab" onClick={openNext}>
          <span className="text-xs text-white/60">Next chapter</span>
          <span className="max-w-[220px] truncate text-sm font-semibold">
            {nextChapter.title}
          </span>
        </button>
      )}
    </div>
  );
}
