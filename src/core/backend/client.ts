export type BackendCrawlJob = {
  id: string;
  sourceUrl: string;
  sourceKey: string;
  state:
    | 'pending'
    | 'running'
    | 'done'
    | 'done_with_errors'
    | 'paused'
    | 'failed'
    | 'cancelled';
  maxChapters: number;
  discoveredCount: number;
  completedCount: number;
  failedCount: number;
  currentUrl?: string;
  novelId?: string;
  novelTitle?: string;
  retryLimit: number;
  retryBackoffMs: number;
  skipFailed: boolean;
  retryFailedAtEnd: boolean;
  error?: string;
  createdAt?: string;
  startedAt?: string;
  finishedAt?: string;
  updatedAt?: string;
};

export type BackendCrawlItem = {
  id: string;
  sourceUrl: string;
  position: number;
  title?: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  error?: string;
  nextUrl?: string;
  updatedAt: string;
};

export type BackendNovel = {
  id: string;
  sourceKey: string;
  sourceUrl: string;
  title: string;
  author?: string;
  summary?: string;
  cover?: string;
  status?: string;
  chapterCount?: number;
  latestChapter?: string;
  lastCrawledAt?: string;
  lastReadChapterId?: string;
  lastReadChapterTitle?: string;
  lastReadAt?: string;
  readingPosition?: Record<string, unknown>;
};

export type BackendChapter = {
  id: string;
  novelId: string;
  sourceUrl: string;
  position: number;
  title: string;
  content?: string;
  contentText?: string;
  crawledAt?: string;
};

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...init?.headers,
    },
  });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(
      payload.error || `Backend request failed: HTTP ${response.status}`,
    );
  }
  return payload;
}

function mapBackendNovel(row: any): BackendNovel {
  return {
    id: String(row.id),
    sourceKey: row.source_key,
    sourceUrl: row.source_url,
    title: row.title,
    author: row.author,
    summary: row.summary,
    cover: row.cover_url,
    status: row.status,
    chapterCount: row.chapter_count,
    latestChapter: row.latest_chapter,
    lastCrawledAt: row.last_crawled_at,
    lastReadChapterId: row.last_read_chapter_id
      ? String(row.last_read_chapter_id)
      : undefined,
    lastReadChapterTitle: row.last_read_chapter_title,
    lastReadAt: row.last_read_at,
    readingPosition: row.reading_position,
  };
}

export async function listBackendNovels() {
  const rows = await apiRequest<any[]>('/api/novels');
  return rows.map(mapBackendNovel);
}

export async function getBackendNovel(novelId: string) {
  return mapBackendNovel(await apiRequest<any>(`/api/novels/${novelId}`));
}

export async function listBackendNovelChapters(novelId: string) {
  const rows = await apiRequest<any[]>(`/api/novels/${novelId}/chapters`);
  return rows.map(
    (row): BackendChapter => ({
      id: String(row.id),
      novelId: String(row.novel_id),
      sourceUrl: row.source_url,
      position: row.position,
      title: row.title,
      crawledAt: row.crawled_at,
    }),
  );
}

export async function getBackendChapter(id: string) {
  const row = await apiRequest<any>(`/api/chapters/${id}`);
  return {
    id: String(row.id),
    novelId: String(row.novel_id),
    sourceUrl: row.source_url,
    position: row.position,
    title: row.title,
    content: row.content_html,
    contentText: row.content_text,
    crawledAt: row.crawled_at,
  } satisfies BackendChapter;
}

export type BackendReadingProgress = {
  novelId: string;
  chapterId?: string;
  position: Record<string, unknown>;
  updatedAt: string;
};

function mapReadingProgress(row: any): BackendReadingProgress {
  return {
    novelId: String(row.novel_id),
    chapterId: row.chapter_id ? String(row.chapter_id) : undefined,
    position: row.position || {},
    updatedAt: row.updated_at,
  };
}

export async function getBackendReadingProgress(novelId: string) {
  try {
    return mapReadingProgress(
      await apiRequest<any>(`/api/novels/${novelId}/progress`),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.toLowerCase().includes('not found')
    ) {
      return null;
    }
    throw error;
  }
}

export async function saveBackendReadingProgress(
  novelId: string,
  data: { chapterId?: string; position: Record<string, unknown> },
) {
  return mapReadingProgress(
    await apiRequest<any>(`/api/novels/${novelId}/progress`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  );
}

export function previewWithBackend(url: string) {
  return apiRequest<{
    novelId: string;
    meta: any;
    chapters: Array<{ id: string; title: string; url: string }>;
    transport: 'http' | 'playwright';
  }>('/api/crawl/preview', {
    method: 'POST',
    body: JSON.stringify({ url }),
  });
}

export function createBackendCrawl(
  url: string,
  options: {
    maxChapters: number;
    retryLimit: number;
    retryBackoffMs: number;
    skipFailed: boolean;
    retryFailedAtEnd: boolean;
  },
) {
  return apiRequest<BackendCrawlJob>('/api/crawl/jobs', {
    method: 'POST',
    body: JSON.stringify({ url, ...options }),
  });
}

export function listBackendCrawlJobs() {
  return apiRequest<BackendCrawlJob[]>('/api/crawl/jobs');
}

export function getBackendCrawlJob(id: string) {
  return apiRequest<BackendCrawlJob>(`/api/crawl/jobs/${id}`);
}

export function cancelBackendCrawl(id: string) {
  return apiRequest<{ ok: true }>(`/api/crawl/jobs/${id}/cancel`, {
    method: 'POST',
  });
}

export function listBackendCrawlItems(id: string) {
  return apiRequest<BackendCrawlItem[]>(`/api/crawl/jobs/${id}/items`);
}

export function resumeBackendCrawl(
  id: string,
  options: {
    maxChapters: number;
    retryLimit: number;
    retryBackoffMs: number;
    skipFailed: boolean;
    retryFailedAtEnd: boolean;
  },
) {
  return apiRequest<BackendCrawlJob>(`/api/crawl/jobs/${id}/resume`, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

export function subscribeToBackendCrawl(
  id: string,
  onUpdate: (job: BackendCrawlJob) => void,
  onError: () => void,
) {
  const source = new EventSource(`/api/crawl/jobs/${id}/events`);
  source.onmessage = (event) => {
    const job = JSON.parse(event.data) as BackendCrawlJob;
    onUpdate(job);
    if (
      ['done', 'done_with_errors', 'paused', 'failed', 'cancelled'].includes(
        job.state,
      )
    ) {
      source.close();
    }
  };
  source.onerror = () => {
    source.close();
    onError();
  };
  return () => source.close();
}
