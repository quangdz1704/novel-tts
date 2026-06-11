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
  retryLimit: number;
  retryBackoffMs: number;
  skipFailed: boolean;
  retryFailedAtEnd: boolean;
  error?: string;
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
