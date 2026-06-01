export type JobState =
  | 'pending'
  | 'downloading'
  | 'translating'
  | 'retrying'
  | 'done'
  | 'failed';

export interface CrawlJob {
  id: string;
  url: string;
  type: 'chapter' | 'metadata';
  attempts: number;
  state: JobState;
  result?: any;
  error?: string;
  meta?: Record<string, any>;
}

export interface CrawlerOptions {
  concurrency?: number;
  retryLimit?: number;
  retryDelayMs?: number;
  timeoutMs?: number;
}
