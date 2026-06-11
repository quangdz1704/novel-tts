import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ensureNovelDir,
  listChapters,
  listNovels,
  writeJsonFile,
} from "../core/storage/localLibraryStorage";
import {
  listNovelsMetadata,
  listReadingProgress,
  saveNovelMetadata,
} from "../core/storage/indexeddb";
import NovelCard from "./NovelCard";
import { useReaderStore } from "../core/reader/readerStore";
import BookCover from "./BookCover";
import { DownloadQueue, type DownloadJob } from "../core/jobs/downloadQueue";
import { findAdapter, getSourceInfo } from "../core/sources";

type SortMode = "recentRead" | "recentCrawl" | "title";

type LibraryItem = {
  id: string;
  firstChapter?: string;
  chapterCount: number;
  chapters: Array<{ id: string; title: string; url?: string }>;
  meta: any;
  progress?: any;
};

export default function LibraryPanel({ onRead }: { onRead?: () => void }) {
  const [novels, setNovels] = useState<LibraryItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>();
  const [sort, setSort] = useState<SortMode>("recentRead");
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [updateJobs, setUpdateJobs] = useState<DownloadJob[]>([]);
  const [updateMessage, setUpdateMessage] = useState("");
  const downloadRef = useRef<DownloadQueue | null>(null);
  const openChapter = useReaderStore((s) => s.openChapter);

  const loadLibrary = useCallback(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        const [files, dbMeta, progressRows] = await Promise.all([
          listNovels(),
          listNovelsMetadata(),
          listReadingProgress(),
        ]);
        if (!mounted) return;
        const metaById: Record<string, any> = {};
        ((dbMeta as any[]) || []).forEach((m) => (metaById[m.id] = m));
        const progressById: Record<string, any> = {};
        ((progressRows as any[]) || []).forEach((p) => {
          progressById[p.novelId] = p;
        });

        const ids = files.filter((name: string | undefined): name is string =>
          Boolean(name),
        );
        const items = await Promise.all(
          ids.map(async (id: string) => {
            const storedChapters = await listChapters(id);
            const metaChapters = (metaById[id]?.chapters || []).map(
              (ch: any, index: number) => ({
                id: `ch_${String(index + 1).padStart(4, "0")}`,
                title: ch.title,
                url: ch.url,
              }),
            );
            const chapters =
              metaChapters.length > 0
                ? metaChapters
                : storedChapters.map((chapterId: string) => ({
                    id: chapterId,
                    title: chapterId,
                  }));
            return {
              id,
              firstChapter:
                progressById[id]?.chapterId ||
                chapters[0]?.id ||
                storedChapters[0],
              chapterCount: chapters.length || storedChapters.length,
              chapters,
              meta: metaById[id] || { id },
              progress: progressById[id],
            };
          }),
        );
        if (!mounted) return;
        setNovels(items);
        setSelectedId((current) => current || items[0]?.id);
      } catch (e) {
        console.error("LibraryPanel load error", e);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => loadLibrary(), [loadLibrary]);

  useEffect(() => {
    const dq = new DownloadQueue(3);
    dq.on("enqueue", (job: DownloadJob) => setUpdateJobs((s) => [...s, job]));
    dq.on("start", (job: DownloadJob) =>
      setUpdateJobs((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    dq.on("success", (job: DownloadJob) =>
      setUpdateJobs((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    dq.on("failed", (job: DownloadJob) =>
      setUpdateJobs((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    downloadRef.current = dq;
  }, []);

  const sorted = useMemo(() => {
    return [...novels].sort((a, b) => {
      if (sort === "title") {
        return (a.meta.title || a.id).localeCompare(b.meta.title || b.id);
      }
      if (sort === "recentCrawl") {
        return (
          new Date(b.meta.lastCrawledAt || 0).getTime() -
          new Date(a.meta.lastCrawledAt || 0).getTime()
        );
      }
      return (
        new Date(b.meta.lastReadAt || b.progress?.updatedAt || 0).getTime() -
        new Date(a.meta.lastReadAt || a.progress?.updatedAt || 0).getTime()
      );
    });
  }, [novels, sort]);

  const selected = sorted.find((item) => item.id === selectedId) || sorted[0];

  const open = (novelId: string, chapterId?: string) => {
    if (!chapterId) return;
    openChapter(novelId, chapterId);
    onRead?.();
  };

  const updateSelected = async () => {
    if (!selected || updatingId) return;
    const sourceUrl = selected.meta.sourceUrl || selected.meta.url;
    const adapter = sourceUrl ? findAdapter(sourceUrl) : undefined;
    if (!sourceUrl || !adapter) {
      setUpdateMessage("This novel has no supported source URL to update.");
      return;
    }

    setUpdatingId(selected.id);
    setUpdateJobs([]);
    setUpdateMessage("Checking latest chapter list...");
    try {
      const [freshMeta, sourceChapters, storedChapters] = await Promise.all([
        adapter.getNovel(sourceUrl),
        adapter.getChapters(sourceUrl, { maxChapters: 0 }),
        listChapters(selected.id),
      ]);
      const chapters = sourceChapters.map((chapter, index) => ({
        ...chapter,
        id: `ch_${String(index + 1).padStart(4, "0")}`,
      }));
      const stored = new Set(storedChapters);
      const missing = chapters.filter((chapter) => !stored.has(chapter.id));
      const nextMeta = {
        ...selected.meta,
        ...freshMeta,
        ...getSourceInfo(sourceUrl, adapter),
        id: selected.id,
        url: sourceUrl,
        sourceUrl,
        chapters,
        chapterCount: chapters.length,
        lastCrawledAt: new Date().toISOString(),
      };

      await saveNovelMetadata(selected.id, nextMeta);
      try {
        const dir = await ensureNovelDir(selected.id);
        await writeJsonFile(`${dir}/metadata.json`, nextMeta);
      } catch (e) {}

      setNovels((items) =>
        items.map((item) =>
          item.id === selected.id
            ? {
                ...item,
                meta: nextMeta,
                chapters,
                chapterCount: chapters.length,
                firstChapter:
                  item.progress?.chapterId || chapters[0]?.id || item.firstChapter,
              }
            : item,
        ),
      );

      if (missing.length === 0) {
        setUpdateMessage("Library is already up to date.");
        return;
      }

      missing.forEach((chapter) => {
        downloadRef.current?.add({
          id: chapter.url,
          novelId: selected.id,
          chapterId: chapter.id,
          title: chapter.title,
          url: chapter.url,
          attempts: 0,
          state: "pending",
        });
      });
      setUpdateMessage(`Found ${missing.length} new chapters. Download started.`);
    } catch (e) {
      setUpdateMessage(`Update failed: ${String(e)}`);
    } finally {
      setUpdatingId(null);
    }
  };

  const updateDoneCount = updateJobs.filter((job) => job.state === "done").length;
  const updateFailedCount = updateJobs.filter(
    (job) => job.state === "failed",
  ).length;
  const updateProgress =
    updateJobs.length > 0
      ? Math.round((updateDoneCount / updateJobs.length) * 100)
      : 0;

  return (
    <div className="library-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="panel-kicker">Bookshelf</p>
          <h2 className="text-3xl font-semibold tracking-tight text-[var(--app-fg)]">
            Choose your next chapter
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-[var(--muted)]">
            Pick up from your latest chapter, inspect story details, or sort by
            recent crawl updates.
          </p>
        </div>
        <select
          className="field-input"
          value={sort}
          onChange={(e) => setSort(e.target.value as SortMode)}
        >
          <option value="recentRead">Recent read</option>
          <option value="recentCrawl">Recent update</option>
          <option value="title">Title</option>
        </select>
      </div>

      {loading ? (
        <div className="mt-3 empty-state">Loading library...</div>
      ) : sorted.length === 0 ? (
        <div className="mt-3 empty-state">
          No books yet. Use Advanced mode, preview a URL, then confirm crawl.
        </div>
      ) : (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div>
            <div className="books-grid">
              {sorted.map((item) => (
                <NovelCard
                  key={item.id}
                  novelId={item.id}
                  meta={item.meta}
                  chapterCount={item.chapterCount}
                  selected={item.id === selected?.id}
                  onSelect={() => setSelectedId(item.id)}
                  onOpen={() => open(item.id, item.firstChapter)}
                />
              ))}
            </div>
          </div>

          {selected && (
            <div className="">
              <aside className="story-drawer sticky top-24">
                <div className="flex gap-3">
                  <BookCover
                    title={selected.meta.title || selected.id}
                    meta={selected.meta}
                    className="h-32 w-24 shrink-0 rounded-xl object-cover shadow-lg shadow-black/20"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="line-clamp-2 text-lg font-semibold text-[var(--app-fg)]">
                      {selected.meta.title || selected.id}
                    </h3>
                    <p className="mt-1 text-sm text-[var(--muted)]">
                      {selected.meta.author || "Unknown author"}
                    </p>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {selected.meta.status || "Unknown status"} ·{" "}
                      {selected.chapterCount} chapters
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button
                    className="primary-button"
                    onClick={() => open(selected.id, selected.firstChapter)}
                  >
                    {selected.meta.lastReadChapterId ? "Continue" : "Start"}
                  </button>
                  <button
                    className="secondary-button"
                    onClick={updateSelected}
                    disabled={Boolean(updatingId)}
                    title="Check source for new chapters"
                  >
                    {updatingId === selected.id ? "Updating..." : "Update"}
                  </button>
                </div>

                {updateMessage && (
                  <div className="mt-3 rounded-xl bg-[var(--panel-elevated)] p-3 text-sm text-[var(--muted)]">
                    {updateMessage}
                    {updateJobs.length > 0 && (
                      <div className="mt-2">
                        <div className="flex items-center justify-between gap-3 text-xs">
                          <span>
                            {updateDoneCount}/{updateJobs.length} saved
                          </span>
                          <span>{updateFailedCount} failed</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-black/20">
                          <div
                            className="h-full rounded-full bg-[var(--accent)] transition-all"
                            style={{ width: `${updateProgress}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selected.meta.lastReadChapterTitle && (
                  <div className="mt-3 rounded-xl bg-[var(--panel-elevated)] p-3 text-sm text-[var(--muted)]">
                    Last read: {selected.meta.lastReadChapterTitle}
                  </div>
                )}

                <details className="mt-3 rounded-xl bg-[var(--panel-elevated)] p-3">
                  <summary className="cursor-pointer text-sm font-medium text-[var(--app-fg)]">
                    Story info
                  </summary>
                  {/* <pre className="mt-2 text-sm leading-6 text-[var(--muted)]">
                    {selected.meta.summary || "No summary available."}
                  </pre> */}
                  <p className="mt-2 text-sm leading-6 text-[var(--muted)] h-fit max-h-[220px] overflow-y-auto break-all scroll-hidden whitespace-pre-line">
                    {selected.meta.summary || "No summary available."}
                  </p>
                </details>

                <div className="mt-3">
                  <div className="section-label">Chapters</div>
                  <div className="mt-2 max-h-[212px] overflow-auto rounded-xl bg-[var(--panel-elevated)]">
                    {selected.chapters.map((chapter, index) => (
                      <button
                        key={chapter.id}
                        className="flex w-full items-center gap-3 border-b border-[var(--border)] px-3 py-2.5 text-left text-sm last:border-0 hover:bg-white/5"
                        onClick={() => open(selected.id, chapter.id)}
                      >
                        <span className="w-9 shrink-0 text-xs text-[var(--muted)]">
                          {index + 1}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[var(--app-fg)]">
                          {chapter.title}
                        </span>
                        {selected.meta.lastReadChapterId === chapter.id && (
                          <span className="badge badge-good">last</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              </aside>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
