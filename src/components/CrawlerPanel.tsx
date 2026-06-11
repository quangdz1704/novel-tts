import React, { useEffect, useRef, useState } from "react";
import {
  cancelBackendCrawl,
  createBackendCrawl,
  getBackendCrawlJob,
  listBackendCrawlItems,
  listBackendCrawlJobs,
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
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [maxChapters, setMaxChapters] = useState(0);
  const [retryLimit, setRetryLimit] = useState(3);
  const [retryBackoffMs, setRetryBackoffMs] = useState(2000);
  const [skipFailed, setSkipFailed] = useState(false);
  const [retryFailedAtEnd, setRetryFailedAtEnd] = useState(true);
  const [adapterUrl, setAdapterUrl] = useState("");
  const [history, setHistory] = useState<BackendCrawlJob[]>([]);
  const [backendJob, setBackendJob] = useState<BackendCrawlJob | null>(null);
  const [backendItems, setBackendItems] = useState<BackendCrawlItem[]>([]);
  const backendUnsubscribeRef = useRef<(() => void) | null>(null);

  const loadHistory = () =>
    listBackendCrawlJobs()
      .then(setHistory)
      .catch(() => {});

  useEffect(() => {
    void loadHistory();
    return () => backendUnsubscribeRef.current?.();
  }, []);

  const handlePreview = async () => {
    const targetUrl = url.trim();
    if (!targetUrl) return;
    setPreview(null);
    setMessage("");
    setBackendJob(null);
    setBackendItems([]);
    backendUnsubscribeRef.current?.();

    setLoadingPreview(true);
    try {
      const backendPreview = await previewWithBackend(targetUrl);
      setPreview(backendPreview);
      setAdapterUrl(targetUrl);
      setMessage(
        `Backend preview ready via ${backendPreview.transport}: ${backendPreview.meta.chapterCount || backendPreview.chapters.length} chapters detected.`,
      );
    } catch (e) {
      setMessage(`Preview failed: ${String(e)}`);
    } finally {
      setLoadingPreview(false);
    }
  };

  const trackBackendJob = (job: BackendCrawlJob) => {
    setBackendJob(job);
    backendUnsubscribeRef.current?.();
    backendUnsubscribeRef.current = subscribeToBackendCrawl(
      job.id,
      (nextJob) => {
        setBackendJob(nextJob);
        setHistory((jobs) => {
          const exists = jobs.some((item) => item.id === nextJob.id);
          return exists
            ? jobs.map((item) =>
                item.id === nextJob.id
                  ? {
                      ...nextJob,
                      novelTitle: nextJob.novelTitle || item.novelTitle,
                    }
                  : item,
              )
            : [nextJob, ...jobs];
        });
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
          void loadHistory();
        } else if (nextJob.state === "done_with_errors") {
          setMessage(
            `Backend crawl completed with ${nextJob.failedCount} failed chapter(s). Resume to retry them.`,
          );
          void loadHistory();
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
        void getBackendCrawlJob(job.id)
          .then((latestJob) => {
            setBackendJob(latestJob);
            setMessage(
              "Progress stream closed. Loaded the latest persisted job state.",
            );
            void loadHistory();
          })
          .catch(() =>
            setMessage(
              "Lost backend progress stream. The job may still be running.",
            ),
          ),
    );
  };

  const selectHistoryJob = async (job: BackendCrawlJob) => {
    backendUnsubscribeRef.current?.();
    setMessage("Loading persisted crawl status...");
    setBackendItems([]);
    try {
      const latestJob = await getBackendCrawlJob(job.id);
      setBackendJob(latestJob);
      setUrl(latestJob.sourceUrl);
      setAdapterUrl(latestJob.sourceUrl);
      setMaxChapters(latestJob.maxChapters);
      setRetryLimit(latestJob.retryLimit);
      setRetryBackoffMs(latestJob.retryBackoffMs);
      setSkipFailed(latestJob.skipFailed);
      setRetryFailedAtEnd(latestJob.retryFailedAtEnd);
      const items = await listBackendCrawlItems(latestJob.id);
      setBackendItems(items);
      setMessage(
        `Loaded crawl job: ${latestJob.completedCount} saved, ${latestJob.failedCount} failed (${latestJob.state}).`,
      );
      if (["pending", "running"].includes(latestJob.state)) {
        trackBackendJob(latestJob);
      }
    } catch (error) {
      setMessage(`Could not load crawl job: ${String(error)}`);
    }
  };

  const handleCrawl = async () => {
    if (!preview) return;
    setMessage("Creating backend crawl job...");
    try {
      const job = await createBackendCrawl(adapterUrl || preview.meta.url, {
        maxChapters,
        retryLimit,
        retryBackoffMs,
        skipFailed,
        retryFailedAtEnd,
      });
      void loadHistory();
      trackBackendJob(job);
    } catch (error) {
      setMessage(`Could not start backend crawl: ${String(error)}`);
    }
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

        <div className="mt-3 rounded-2xl border border-[var(--border)] bg-[var(--panel-elevated)] p-3">
          <div>
            <div className="text-sm font-medium text-[var(--app-fg)]">Backend crawl</div>
            <div className="text-xs text-[var(--muted)]">
              Node handles crawling and stores novels, chapters, jobs and progress in PostgreSQL.
            </div>
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
                  Start backend crawl
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
                  {backendJob.discoveredCount} discovered ·{" "}
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
                "done",
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
            <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
              {backendJob.startedAt && (
                <span>
                  Started: {new Date(backendJob.startedAt).toLocaleString()}
                </span>
              )}
              {backendJob.updatedAt && (
                <span>
                  Updated: {new Date(backendJob.updatedAt).toLocaleString()}
                </span>
              )}
            </div>
            {backendJob.error && (
              <>
                <div className="mt-2 text-xs text-red-500">
                  {backendJob.error}
                </div>
                {/HTTP (403|429|503)/.test(backendJob.error) && (
                  <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-600">
                    The source is rate-limiting or blocking requests. Wait for
                    the server cooldown before resuming; repeated manual
                    resumes can extend the block.
                  </div>
                )}
              </>
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

      </section>

      <aside className="surface-panel">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="panel-kicker">History</p>
            <h2 className="panel-title">Crawl jobs</h2>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">{history.length}</span>
            <button className="ghost-button" onClick={() => void loadHistory()}>
              Refresh
            </button>
          </div>
        </div>
        <div className="mt-4 max-h-[620px] space-y-2 overflow-auto pr-1">
          {history.length === 0 ? (
            <div className="empty-state">No crawl history yet.</div>
          ) : (
            history.map((job) => (
              <button
                key={job.id}
                className={`w-full rounded-xl border bg-[var(--panel-elevated)] p-3 text-left transition hover:border-[var(--accent)] ${
                  backendJob?.id === job.id
                    ? "border-[var(--accent)]"
                    : "border-[var(--border)]"
                }`}
                onClick={() => void selectHistoryJob(job)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 truncate text-sm font-semibold text-[var(--app-fg)]">
                    {job.novelTitle || job.sourceUrl}
                  </div>
                  <span
                    className={
                      job.state === "done"
                        ? "badge badge-good"
                        : ["failed", "done_with_errors"].includes(job.state)
                          ? "badge badge-bad"
                          : "badge badge-warn"
                    }
                  >
                    {job.state}
                  </span>
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {job.completedCount} saved · {job.failedCount} failed
                </div>
                <div className="mt-1 truncate text-xs text-[var(--muted)]">
                  {job.sourceUrl}
                </div>
                <div className="mt-1 text-xs text-[var(--muted)]">
                  {job.updatedAt
                    ? new Date(job.updatedAt).toLocaleString()
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
