import { EventEmitter } from '../utils/miniEmitter';
import {
  ensureNovelDir,
  writeJsonFile,
} from '../storage/localLibraryStorage';
import { findAdapter } from '../sources';
import { extractReadableContent } from '../reader/content';

export type DownloadJob = {
  id: string;
  novelId: string;
  chapterId: string;
  title?: string;
  url: string;
  attempts: number;
  state: 'pending' | 'downloading' | 'done' | 'failed';
  error?: string;
};

export class DownloadQueue extends EventEmitter {
  private concurrency = 2;
  private queue: DownloadJob[] = [];
  private running = 0;

  constructor(concurrency = 2) {
    super();
    this.concurrency = concurrency;
  }

  add(job: DownloadJob) {
    this.queue.push(job);
    this.emit('enqueue', job);
    this.next();
  }

  async next() {
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.download(job).finally(() => {
        this.running--;
        this.emit('done', job);
        setTimeout(() => this.next(), 0);
      });
    }
  }

  async download(job: DownloadJob) {
    job.state = 'downloading';
    this.emit('start', job);
    try {
      const adapter = findAdapter(job.url);
      let title = job.title;
      let content = '';

      if (adapter) {
        const chapter = await adapter.getChapter(job.url);
        title = chapter.title || title;
        content = chapter.content;
      } else {
        const res = await fetch(job.url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        content = extractReadableContent(await res.text());
      }

      // save chapter as JSON
      const dir = await ensureNovelDir(job.novelId);
      const path = `${dir}/chapters/${job.chapterId}.json`;
      await writeJsonFile(path, {
        id: job.chapterId,
        title,
        url: job.url,
        content: extractReadableContent(content),
      });
      job.state = 'done';
      this.emit('success', job);
    } catch (e) {
      job.attempts = (job.attempts || 0) + 1;
      job.state = 'failed';
      job.error = String(e);
      this.emit('failed', job);
    }
  }
}
