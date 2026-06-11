import React, { useEffect, useMemo, useRef, useState } from "react";
import { findAdapter, getSourceInfo } from "../core/sources";
import {
  ensureNovelDir,
  writeJsonFile,
} from "../core/storage/localLibraryStorage";
import {
  listNovelsMetadata,
  saveNovelMetadata,
} from "../core/storage/indexeddb";
import { useLibraryStore } from "../stores/libraryStore";
import { DownloadQueue, type DownloadJob } from "../core/jobs/downloadQueue";
import { toSafeId } from "../core/reader/content";
import {
  cancelBackendCrawl,
  createBackendCrawl,
  listBackendCrawlItems,
  previewWithBackend,
  resumeBackendCrawl,
  subscribeToBackendCrawl,
  type BackendCrawlJob,
  type BackendCrawlItem,
} from "../core/backend/client";
import BookCover from "./BookCover";

type Preview = {
  novelId: string;
  meta: any;
  chapters: Array<{ id: string; title: string; url: string }>;
};

const SAMPLE_URL = "https://wikicv.net/truyen/ngu-tien-mon-XyI88VS4CA5PobdX";

export default function CrawlerPanel() {
  const [crawlMode, setCrawlMode] = useState<"basic" | "advanced">("basic");
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [downloads, setDownloads] = useState<DownloadJob[]>([]);
  const [message, setMessage] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [maxChapters, setMaxChapters] = useState(0);
  const [retryLimit, setRetryLimit] = useState(3);
  const [retryBackoffMs, setRetryBackoffMs] = useState(2000);
  const [skipFailed, setSkipFailed] = useState(false);
  const [retryFailedAtEnd, setRetryFailedAtEnd] = useState(true);
  const [adapterUrl, setAdapterUrl] = useState("");
  const [history, setHistory] = useState<any[]>([]);
  const [backendJob, setBackendJob] = useState<BackendCrawlJob | null>(null);
  const [backendItems, setBackendItems] = useState<BackendCrawlItem[]>([]);
  const downloadRef = useRef<DownloadQueue | null>(null);
  const backendUnsubscribeRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const dq = new DownloadQueue(3);
    dq.on("enqueue", (job: DownloadJob) => setDownloads((s) => [...s, job]));
    dq.on("start", (job: DownloadJob) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    dq.on("success", (job: DownloadJob) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    dq.on("failed", (job: DownloadJob) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? { ...job } : d))),
    );
    downloadRef.current = dq;
    listNovelsMetadata()
      .then((rows: any) =>
        setHistory(
          [...((rows as any[]) || [])].sort(
            (a, b) =>
              new Date(b.lastCrawledAt || 0).getTime() -
              new Date(a.lastCrawledAt || 0).getTime(),
          ),
        ),
      )
      .catch(() => {});
    return () => backendUnsubscribeRef.current?.();
  }, []);

  const handlePreview = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;
    const adapter = findAdapter(targetUrl);
    setPreview(null);
    setMessage("");
    setDownloads([]);
    setBackendJob(null);
    setBackendItems([]);

    if (!adapter) {
      setMessage(
        "Unsupported source. Current adapters: WikiCV, NovelBin, TruyenFull.",
      );
      return;
    }

    setLoadingPreview(true);
    try {
      if (crawlMode === "advanced") {
        const backendPreview = await previewWithBackend(targetUrl);
        setPreview(backendPreview);
        setAdapterUrl(targetUrl);
        setMessage(
          `Backend preview ready via ${backendPreview.transport}: ${backendPreview.meta.chapterCount || backendPreview.chapters.length} chapters detected.`,
        );
        return;
      }

      const meta = await adapter.getNovel(targetUrl);
      const chapters = await adapter.getChapters(targetUrl, { maxChapters: 3 });
      const novelId = toSafeId(meta.title || targetUrl, `novel_${Date.now()}`);
      const enrichedMeta = {
        ...meta,
        ...getSourceInfo(targetUrl, adapter),
        id: novelId,
        url: targetUrl,
        chapterCount: meta.chapterCount || chapters.length,
        chapters,
        lastCrawledAt: new Date().toISOString(),
      };
      setPreview({ novelId, meta: enrichedMeta, chapters });
      setAdapterUrl(targetUrl);
      setMessage(
        `Preview ready: ${meta.chapterCount || chapters.length} chapters detected, showing first ${chapters.length}.`,
      );
    } catch (e) {
      setMessage(`Preview failed: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const saveMetadata = async (data: Preview) => {
    await saveNovelMetadata(data.novelId, data.meta);
    try {
      const dir = await ensureNovelDir(data.novelId);
      await writeJsonFile(`${dir}/metadata.json`, data.meta);
    } catch (e) {}
    await useLibraryStore.getState().addNovel(data.meta);
    setHistory((items) => [
      data.meta,
      ...items.filter((item) => item.id !== data.meta.id),
    ]);
  };

  const trackBackendJob = (job: BackendCrawlJob) => {
    setBackendJob(job);
    backendUnsubscribeRef.current?.();
    backendUnsubscribeRef.current = subscribeToBackendCrawl(
      job.id,
      (nextJob) => {
        setBackendJob(nextJob);
        if (
          [
            "done",
            "done_with_errors",
            "paused",
            "failed",
            "cancelled",
          ].includes(nextJob.state)
        ) {
          void listBackendCrawlItems(nextJob.id)
            .then(setBackendItems)
            .catch(() => {});
        }
        if (nextJob.state === "done") {
          setMessage(
            `Backend crawl completed: ${nextJob.completedCount} chapters saved.`,
          );
        } else if (nextJob.state === "done_with_errors") {
          setMessage(
            `Backend crawl completed with ${nextJob.failedCount} failed chapter(s). Resume to retry them.`,
          );
        } else if (nextJob.state === "paused") {
          setMessage(
            `Backend crawl paused after saving ${nextJob.completedCount} chapters: ${nextJob.error || "retryable error"}`,
          );
        } else if (nextJob.state === "failed") {
          setMessage(
            `Backend crawl failed: ${nextJob.error || "Unknown error"}`,
          );
        } else if (nextJob.state === "cancelled") {
          setMessage("Backend crawl cancelled. Progress is still saved.");
        } else {
          setMessage(
            `Backend crawl running: ${nextJob.completedCount} saved, ${nextJob.failedCount} failed.`,
          );
        }
      },
      () =>
        setMessage(
          "Lost backend progress stream. The job may still be running.",
        ),
    );
  };

  const handleCrawl = async () => {
    if (!preview) return;
    if (crawlMode === "advanced") {
      setMessage("Creating backend crawl job...");
      try {
        const job = await createBackendCrawl(
          adapterUrl || preview.meta.url,
          {
            maxChapters,
            retryLimit,
            retryBackoffMs,
            skipFailed,
            retryFailedAtEnd,
          },
        );
        trackBackendJob(job);
      } catch (error) {
        setMessage(`Could not start backend crawl: ${String(error)}`);
      }
      return;
    }

    const adapter = findAdapter(adapterUrl || preview.meta.url);
    if (!adapter) return;
    setMessage("Preparing chapter list...");
    const chapters =
      maxChapters > 0
        ? await adapter.getChapters(adapterUrl || preview.meta.url, {
            maxChapters,
          })
        : await adapter.getChapters(adapterUrl || preview.meta.url, {
            maxChapters: 0,
          });
    const crawlData = {
      ...preview,
      chapters,
      meta: {
        ...preview.meta,
        chapters,
        chapterCount: chapters.length,
        lastCrawledAt: new Date().toISOString(),
      },
    };
    await saveMetadata(crawlData);
    const selected =
      maxChapters > 0 ? chapters.slice(0, maxChapters) : chapters;
    setDownloads([]);
    selected.forEach((ch, index) => {
      downloadRef.current?.add({
        id: ch.url,
        novelId: crawlData.novelId,
        chapterId: `ch_${String(index + 1).padStart(4, "0")}`,
        title: ch.title,
        url: ch.url,
        attempts: 0,
        state: "pending",
      });
    });
    setPreview(crawlData);
    setMessage(
      `Crawling ${selected.length} chapters. You can keep reading while this runs.`,
    );
  };

  const handleResumeBackend = async () => {
    if (!backendJob) return;
    setMessage("Resuming backend crawl from persisted progress...");
    try {
      trackBackendJob(
        await resumeBackendCrawl(backendJob.id, {
          maxChapters,
          retryLimit,
          retryBackoffMs,
          skipFailed,
          retryFailedAtEnd,
        }),
      );
    } catch (error) {
      setMessage(`Could not resume backend crawl: ${String(error)}`);
    }
  };

  const doneCount = downloads.filter((d) => d.state === "done").length;
  const failedCount = downloads.filter((d) => d.state === "failed").length;
  const activeCount = downloads.filter((d) => d.state === "downloading").length;
  const progress =
    downloads.length > 0 ? Math.round((doneCount / downloads.length) * 100) : 0;
  const backendTarget =
    backendJob && backendJob.maxChapters > 0
      ? backendJob.maxChapters
      : Math.max(
          backendJob?.discoveredCount || 0,
          backendJob?.completedCount || 0,
          1,
        );
  const backendProgress = backendJob
    ? Math.min(
        100,
        Math.round((backendJob.completedCount / backendTarget) * 100),
      )
    : 0;

  const latestDownloads = useMemo(
    () => downloads.slice(-8).reverse(),
    [downloads],
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="surface-panel">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="panel-kicker">Crawler</p>
            <h2 className="panel-title">New crawl or update</h2>
          </div>
          <button className="ghost-button" onClick={() => setUrl(SAMPLE_URL)}>
            Use WikiCV sample
          </button>
        </div>

        <div className="mt-4 grid gap-2 lg:grid-cols-[1fr_auto]">
          <input
            className="field-input"
            placeholder="Paste novel URL"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
          <button
            className="primary-button"
            onClick={handlePreview}
            disabled={loadingPreview}
          >
            {loadingPreview ? "Scanning..." : "Preview"}
          </button>
        </div>

        <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="text-sm font-medium text-[var(--app-fg)]">
              Crawl mode
            </div>
            <div className="text-xs text-[var(--muted)]">
              Basic runs in this tab. Advanced uses Node, PostgreSQL and
              Playwright fallback.
            </div>
          </div>
          <div className="segmented-control">
            <button
              className={crawlMode === "basic" ? "active" : ""}
              onClick={() => setCrawlMode("basic")}
            >
              Basic
            </button>
            <button
              className={crawlMode === "advanced" ? "active" : ""}
              onClick={() => setCrawlMode("advanced")}
            >
              Advanced
            </button>
          </div>
        </div>

        {message && <div className="mt-3 status-note">{message}</div>}

        {preview && (
          <div className="mt-4 grid gap-4 lg:grid-cols-[220px_1fr]">
            <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)]">
              <BookCover
                title={preview.meta.title}
                meta={preview.meta}
                className="h-full min-h-64 w-full object-cover"
              />
            </div>

            <div className="min-w-0">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <h3 className="truncate text-xl font-semibold text-[var(--app-fg)]">
                    {preview.meta.title}
                  </h3>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {preview.meta.author || "Unknown author"} ·{" "}
                    {preview.meta.status || "Unknown status"}
                  </p>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    {preview.meta.chapterCount || preview.chapters.length}{" "}
                    chapters
                    {preview.meta.latestChapter
                      ? ` · latest: ${preview.meta.latestChapter}`
                      : ""}
                  </p>
                </div>
                <button
                  className="primary-button whitespace-nowrap"
                  onClick={handleCrawl}
                >
                  {crawlMode === "advanced"
                    ? "Start backend crawl"
                    : "Confirm & crawl"}
                </button>
              </div>

              <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3">
                <label className="text-sm font-medium text-app-fg whitespace-nowrap">
                  Chapter limit
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    className="field-input w-32"
                    type="number"
                    min={0}
                    value={maxChapters}
                    onChange={(e) => setMaxChapters(Number(e.target.value))}
                  />
                  <span className="text-sm text-[var(--muted)]">
                    `0` means all chapters. Use a small number for quick tests.
                  </span>
                </div>
              </div>

              {crawlMode === "advanced" && (
                <div className="mt-3 grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3 sm:grid-cols-2">
                  <label className="text-sm text-[var(--app-fg)]">
                    Retry count
                    <input
                      className="field-input mt-1"
                      type="number"
                      min={0}
                      max={10}
                      value={retryLimit}
                      onChange={(e) => setRetryLimit(Number(e.target.value))}
                    />
                  </label>
                  <label className="text-sm text-[var(--app-fg)]">
                    Initial backoff (ms)
                    <input
                      className="field-input mt-1"
                      type="number"
                      min={250}
                      max={60000}
                      step={250}
                      value={retryBackoffMs}
                      onChange={(e) =>
                        setRetryBackoffMs(Number(e.target.value))
                      }
                    />
                  </label>
                  <label className="flex items-start gap-2 text-sm text-[var(--app-fg)]">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={skipFailed}
                      onChange={(e) => setSkipFailed(e.target.checked)}
                    />
                    <span>
                      Skip failed chapter when its next URL is already known.
                    </span>
                  </label>
                  <label className="flex items-start gap-2 text-sm text-[var(--app-fg)]">
                    <input
                      className="mt-1"
                      type="checkbox"
                      checked={retryFailedAtEnd}
                      onChange={(e) => setRetryFailedAtEnd(e.target.checked)}
                    />
                    <span>Retry skipped chapters after the main crawl.</span>
                  </label>
                </div>
              )}

              <details className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3">
                <summary className="cursor-pointer text-sm font-medium text-[var(--app-fg)]">
                  Chapter list preview
                </summary>
                <div className="mt-3 max-h-56 overflow-auto">
                  {preview.chapters.slice(0, 80).map((ch, index) => (
                    <div
                      key={ch.url}
                      className="flex gap-3 border-b border-[var(--border)] py-2 text-sm last:border-0"
                    >
                      <span className="w-10 shrink-0 text-[var(--muted)]">
                        {index + 1}
                      </span>
                      <span className="min-w-0 truncate text-[var(--app-fg)]">
                        {ch.title}
                      </span>
                    </div>
                  ))}
                </div>
              </details>
            </div>
          </div>
        )}

        {backendJob && (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium text-[var(--app-fg)]">
                  Backend job
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {backendJob.completedCount} saved · {backendJob.failedCount}{" "}
                  failed · {backendJob.state}
                </div>
              </div>
              {["pending", "running"].includes(backendJob.state) && (
                <button
                  className="ghost-button"
                  onClick={() => void cancelBackendCrawl(backendJob.id)}
                >
                  Cancel
                </button>
              )}
              {[
                "paused",
                "failed",
                "done_with_errors",
                "cancelled",
              ].includes(backendJob.state) && (
                <button
                  className="primary-button"
                  onClick={() => void handleResumeBackend()}
                >
                  Resume
                </button>
              )}
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${backendProgress}%` }}
              />
            </div>
            {backendJob.currentUrl && (
              <div className="mt-2 truncate text-xs text-[var(--muted)]">
                {backendJob.currentUrl}
              </div>
            )}
            {backendJob.error && (
              <div className="mt-2 text-xs text-red-500">
                {backendJob.error}
              </div>
            )}
            {backendItems.some((item) => item.state === "failed") && (
              <details className="mt-3 text-xs text-[var(--muted)]">
                <summary className="cursor-pointer">
                  Failed chapter details
                </summary>
                <div className="mt-2 grid gap-2">
                  {backendItems
                    .filter((item) => item.state === "failed")
                    .map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl border border-[var(--border)] p-2"
                      >
                        <div>
                          #{item.position} · attempts {item.attempts}
                        </div>
                        <div className="mt-1 break-all text-red-500">
                          {item.error}
                        </div>
                      </div>
                    ))}
                </div>
              </details>
            )}
          </div>
        )}

        {downloads.length > 0 && (
          <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3">
            <div className="flex items-center justify-between gap-3 text-sm text-[var(--muted)]">
              <span>
                {doneCount}/{downloads.length} saved · active {activeCount} ·
                failed {failedCount}
              </span>
              <button
                className="ghost-button"
                onClick={() => setShowLog((v) => !v)}
              >
                {showLog ? "Hide log" : "Show log"}
              </button>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-black/25">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>

            {showLog && (
              <div className="mt-3 grid max-h-72 gap-2 overflow-auto pr-1 sm:grid-cols-2">
                {latestDownloads.map((d) => (
                  <div
                    key={d.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--panel)] p-3"
                  >
                    <div className="truncate text-sm font-medium text-[var(--app-fg)]">
                      {d.title || d.chapterId}
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 text-xs text-[var(--muted)]">
                      <span>{d.chapterId}</span>
                      <span
                        className={
                          d.state === "done"
                            ? "badge badge-good"
                            : d.state === "failed"
                              ? "badge badge-bad"
                              : "badge badge-warn"
                        }
                      >
                        {d.state}
                      </span>
                    </div>
                    {d.error && (
                      <div className="mt-1 truncate text-xs text-red-600">
                        {d.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      <aside className="surface-panel">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="panel-kicker">History</p>
            <h2 className="panel-title">Crawled novels</h2>
          </div>
          <span className="text-sm text-[var(--muted)]">{history.length}</span>
        </div>
        <div className="mt-4 max-h-[620px] space-y-2 overflow-auto pr-1">
          {history.length === 0 ? (
            <div className="empty-state">No crawl history yet.</div>
          ) : (
            history.map((item) => (
              <button
                key={item.id}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3 text-left transition hover:border-[var(--accent)]"
                onClick={() => {
                  setUrl(item.url || "");
                  setMessage(
                    "Loaded from history. Preview again to update metadata.",
                  );
                }}
              >
                <div className="truncate text-sm font-semibold text-[var(--app-fg)]">
                  {item.title || item.id}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {item.chapterCount || item.chapters?.length || 0} chapters
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {item.lastCrawledAt
                    ? new Date(item.lastCrawledAt).toLocaleString()
                    : "No timestamp"}
                </div>
              </button>
            ))
          )}
        </div>
      </aside>
    </div>
  );
}
