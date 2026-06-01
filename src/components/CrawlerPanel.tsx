import React, { useState, useRef, useEffect } from 'react';
import { CrawlerQueue } from '../core/crawler/queue';
import { processJobBrowser } from '../core/crawler/browserWorker';
import { findAdapter } from '../core/sources';
import { useBackendCrawler } from '../hooks/useBackendCrawler';
import type { CrawlJob } from '../core/crawler/types';
import { ensureNovelDir, writeJsonFile } from '../core/storage/fsAdapter';
import { saveNovelMetadata } from '../core/storage/indexeddb';
import { useLibraryStore } from '../stores/libraryStore';
import { DownloadQueue, type DownloadJob } from '../core/jobs/downloadQueue';

export default function CrawlerPanel() {
  const [url, setUrl] = useState('');
  const [jobs, setJobs] = useState<CrawlJob[]>([]);
  const queueRef = useRef<CrawlerQueue | null>(null);
  const [downloads, setDownloads] = useState<any[]>([]);
  const downloadRef = useRef<DownloadQueue | null>(null);

  // If running in Tauri, prefer backend node crawler for heavy JS sites
  const backend = useBackendCrawler();

  useEffect(() => {
    const q = new CrawlerQueue({}, processJobBrowser);
    q.on('enqueue', (job: CrawlJob) => setJobs((s) => [...s, job]));
    q.on('start', (job: CrawlJob) =>
      setJobs((s) => s.map((j) => (j.id === job.id ? job : j))),
    );
    q.on('success', (job: CrawlJob) =>
      setJobs((s) => s.map((j) => (j.id === job.id ? job : j))),
    );
    q.on('retry', (job: CrawlJob) =>
      setJobs((s) => s.map((j) => (j.id === job.id ? job : j))),
    );
    q.on('failed', (job: CrawlJob) =>
      setJobs((s) => s.map((j) => (j.id === job.id ? job : j))),
    );
    queueRef.current = q;
    // init download queue
    const dq = new DownloadQueue(2);
    dq.on('enqueue', (job: any) => setDownloads((s) => [...s, job]));
    dq.on('start', (job: any) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? job : d))),
    );
    dq.on('success', (job: any) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? job : d))),
    );
    dq.on('failed', (job: any) =>
      setDownloads((s) => s.map((d) => (d.id === job.id ? job : d))),
    );
    downloadRef.current = dq;
    return () => {
      q.pause();
    };
  }, []);

  const handleAdd = async () => {
    if (!url) return;
    const adapter = findAdapter(url);
    const metaJob: CrawlJob = {
      id: `meta:${url}`,
      url,
      type: 'metadata',
      attempts: 0,
      state: 'pending',
    };

    if (backend) {
      const jobId = `job:${Date.now()}`;
      setJobs((s) => [...s, { ...metaJob, id: jobId, state: 'downloading' }]);
      backend
        .start(jobId, url, 'metadata', async (data: any) => {
          // update job with events
          setJobs((s) =>
            s.map((j) =>
              j.id === jobId
                ? {
                    ...j,
                    result: data,
                    state: data.event === 'done' ? 'done' : j.state,
                  }
                : j,
            ),
          );
          if (data.event === 'result' && data.payload) {
            const meta = data.payload;
            const novelId =
              (meta.title &&
                meta.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()) ||
              `novel_${Date.now()}`;
            try {
              await saveNovelMetadata(novelId, { id: novelId, ...meta, url });
            } catch (e) {
              console.error('IndexedDB save failed', e);
            }
            try {
              const dir = await ensureNovelDir(novelId);
              const path = `${dir}/metadata.json`;
              await writeJsonFile(path, { id: novelId, ...meta, url });
            } catch (e) {
              // ignore filesystem errors in web context
            }
            // update library store
            useLibraryStore.getState().addNovel({
              id: novelId,
              title: meta.title,
              author: meta.author,
              cover: meta.cover,
              url,
            });
          }
        })
        .catch(() => {
          // fallback to browser queue
          queueRef.current?.add(metaJob);
        });
    } else {
      queueRef.current?.add(metaJob);
    }

    // if adapter present, fetch chapter list and enqueue chapters (frontend adapter)
    if (adapter) {
      try {
        const novel = await adapter.getNovel(url);
        const chapters = await adapter.getChapters(url);
        const novelId =
          (novel.title &&
            novel.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()) ||
          `novel_${Date.now()}`;
        for (const [i, ch] of chapters.slice(0, 10).entries()) {
          const chapterId = ch.id || `ch_${i}`;
          const dj: DownloadJob = {
            id: ch.url,
            novelId,
            chapterId,
            title: ch.title,
            url: ch.url,
            attempts: 0,
            state: 'pending',
          };
          downloadRef.current?.add(dj);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">Crawler Demo</h2>
      <div className="mt-2 flex gap-2">
        <input
          className="flex-1 p-2 rounded bg-white/5"
          placeholder="Paste novel URL"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <button className="px-3 py-2 rounded bg-indigo-600" onClick={handleAdd}>
          Add
        </button>
      </div>
      <div className="mt-6">
        <h3 className="font-medium">Downloads</h3>
        <ul className="mt-2 space-y-2">
          {downloads.map((d) => (
            <li
              key={d.id}
              className="flex items-center justify-between p-2 bg-white/3 rounded"
            >
              <div>
                <div className="text-sm font-medium">
                  {d.title || d.chapterId}
                </div>
                <div className="text-xs text-slate-400">
                  state: {d.state} attempts: {d.attempts}
                </div>
              </div>
              <div>
                {d.state === 'downloading' && (
                  <span className="text-sm">Downloading…</span>
                )}
                {d.state === 'done' && (
                  <span className="text-sm text-green-400">Saved</span>
                )}
                {d.state === 'failed' && (
                  <span className="text-sm text-red-400">Failed</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4">
        <h3 className="font-medium">Queue</h3>
        <ul className="mt-2 space-y-2">
          {jobs.map((j) => (
            <li
              key={j.id}
              className="flex items-center justify-between p-2 bg-white/3 rounded"
            >
              <div className="truncate">
                <div className="text-sm font-medium">
                  {j.type} — {j.id}
                </div>
                <div className="text-xs text-slate-400">
                  state: {j.state} attempts: {j.attempts}
                </div>
                <div className="text-xs mt-1">
                  {j.result?.event === 'progress' && (
                    <div className="w-full bg-white/10 rounded h-2 mt-1">
                      <div
                        className="h-2 rounded bg-green-400"
                        style={{ width: `${j.result.percent}%` }}
                      />
                    </div>
                  )}
                  {j.result?.event === 'result' && (
                    <span>Title: {j.result.payload?.title || '—'}</span>
                  )}
                  {j.result?.event === 'error' && (
                    <span className="text-red-400">
                      Error: {j.result.message}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {backend && (
                  <button
                    className="px-2 py-1 rounded bg-yellow-600"
                    onClick={() => backend.stop(j.id)}
                  >
                    Stop
                  </button>
                )}
                <button
                  className="px-2 py-1 rounded bg-red-600"
                  onClick={() => queueRef.current?.cancel(j.id)}
                >
                  Cancel
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
