import { EventEmitter } from '../utils/miniEmitter';
import type { CrawlJob, CrawlerOptions } from './types';

export type JobProcessor = (
  job: CrawlJob,
  opts?: { timeoutMs?: number },
) => Promise<any>;

export class CrawlerQueue extends EventEmitter {
  private concurrency: number;
  private retryLimit: number;
  private retryDelayMs: number;
  private timeoutMs: number;
  private queue: CrawlJob[] = [];
  private running = 0;
  private paused = false;
  private processor: JobProcessor;

  constructor(opts: CrawlerOptions = {}, processor?: JobProcessor) {
    super();
    this.concurrency = opts.concurrency ?? 2;
    this.retryLimit = opts.retryLimit ?? 3;
    this.retryDelayMs = opts.retryDelayMs ?? 2000;
    this.timeoutMs = opts.timeoutMs ?? 30_000;
    if (!processor)
      throw new Error('CrawlerQueue requires a job processor function');
    this.processor = processor;
  }

  add(job: CrawlJob) {
    this.queue.push(job);
    this.emit('enqueue', job);
    this.next();
  }

  async next() {
    if (this.paused) return;
    while (this.running < this.concurrency && this.queue.length > 0) {
      const job = this.queue.shift()!;
      this.running++;
      this.handle(job).finally(() => {
        this.running--;
        this.emit('done', job);
        setTimeout(() => this.next(), 0);
      });
    }
  }

  async handle(job: CrawlJob) {
    job.state = 'downloading';
    this.emit('start', job);

    try {
      const result = await this.processor(job, { timeoutMs: this.timeoutMs });
      job.state = 'done';
      job.result = result;
      this.emit('success', job);
      return result;
    } catch (err: any) {
      job.attempts = (job.attempts || 0) + 1;
      job.error = String(err?.message || err);
      if (job.attempts <= this.retryLimit) {
        job.state = 'retrying';
        this.emit('retry', job);
        await new Promise((r) => setTimeout(r, this.retryDelayMs));
        this.queue.push(job);
      } else {
        job.state = 'failed';
        this.emit('failed', job);
      }
    }
  }

  pause() {
    this.paused = true;
  }

  resume() {
    this.paused = false;
    this.next();
  }

  cancel(jobId: string) {
    this.queue = this.queue.filter((j) => j.id !== jobId);
    this.emit('cancel', jobId);
  }
}
