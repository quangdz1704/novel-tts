import { createHash, randomUUID } from 'node:crypto';
import { pool, withTransaction } from './client';

export type CrawlJobRow = {
  id: string;
  source_url: string;
  source_key: string;
  state: string;
  max_chapters: number;
  discovered_count: number;
  completed_count: number;
  failed_count: number;
  current_url?: string;
  novel_id?: string;
  retry_limit: number;
  retry_backoff_ms: number;
  skip_failed: boolean;
  retry_failed_at_end: boolean;
  error?: string;
  cancel_requested: boolean;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  updated_at: string;
  novel_title?: string;
};

export type CrawlJobItemRow = {
  id: string;
  job_id: string;
  source_url: string;
  position: number;
  title?: string;
  state: 'pending' | 'running' | 'done' | 'failed';
  attempts: number;
  error?: string;
  next_url?: string;
  created_at: string;
  updated_at: string;
};

export function serializeJob(job: CrawlJobRow) {
  return {
    id: job.id,
    sourceUrl: job.source_url,
    sourceKey: job.source_key,
    state: job.state,
    maxChapters: job.max_chapters,
    discoveredCount: job.discovered_count,
    completedCount: job.completed_count,
    failedCount: job.failed_count,
    currentUrl: job.current_url,
    novelId: job.novel_id,
    novelTitle: job.novel_title,
    retryLimit: job.retry_limit,
    retryBackoffMs: job.retry_backoff_ms,
    skipFailed: job.skip_failed,
    retryFailedAtEnd: job.retry_failed_at_end,
    error: job.error,
    cancelRequested: job.cancel_requested,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    updatedAt: job.updated_at,
  };
}

export function serializeJobItem(item: CrawlJobItemRow) {
  return {
    id: item.id,
    sourceUrl: item.source_url,
    position: item.position,
    title: item.title,
    state: item.state,
    attempts: item.attempts,
    error: item.error,
    nextUrl: item.next_url,
    updatedAt: item.updated_at,
  };
}

export async function createCrawlJob(
  sourceUrl: string,
  options: {
    maxChapters: number;
    retryLimit: number;
    retryBackoffMs: number;
    skipFailed: boolean;
    retryFailedAtEnd: boolean;
  },
) {
  const id = randomUUID();
  const result = await pool.query<CrawlJobRow>(
    `INSERT INTO crawl_jobs (
       id, source_url, source_key, max_chapters, retry_limit,
       retry_backoff_ms, skip_failed, retry_failed_at_end
     )
     VALUES ($1, $2, 'wikicv', $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      id,
      sourceUrl,
      options.maxChapters,
      options.retryLimit,
      options.retryBackoffMs,
      options.skipFailed,
      options.retryFailedAtEnd,
    ],
  );
  return result.rows[0];
}

export async function createOrResumeCrawlJob(
  sourceUrl: string,
  options: {
    maxChapters: number;
    retryLimit: number;
    retryBackoffMs: number;
    skipFailed: boolean;
    retryFailedAtEnd: boolean;
  },
) {
  return withTransaction(async (client) => {
    const existing = await client.query<CrawlJobRow>(
      `SELECT * FROM crawl_jobs
       WHERE source_url = $1
       ORDER BY created_at DESC
       LIMIT 1
       FOR UPDATE`,
      [sourceUrl],
    );
    const job = existing.rows[0];
    if (!job) {
      const inserted = await client.query<CrawlJobRow>(
        `INSERT INTO crawl_jobs (
           id, source_url, source_key, max_chapters, retry_limit,
           retry_backoff_ms, skip_failed, retry_failed_at_end
         )
         VALUES ($1, $2, 'wikicv', $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          randomUUID(),
          sourceUrl,
          options.maxChapters,
          options.retryLimit,
          options.retryBackoffMs,
          options.skipFailed,
          options.retryFailedAtEnd,
        ],
      );
      return inserted.rows[0];
    }

    if (['pending', 'running'].includes(job.state)) return job;

    const resumed = await client.query<CrawlJobRow>(
      `UPDATE crawl_jobs
       SET state = 'pending', max_chapters = $2, retry_limit = $3,
           retry_backoff_ms = $4, skip_failed = $5,
           retry_failed_at_end = $6, error = NULL,
           cancel_requested = FALSE, finished_at = NULL, updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [
        job.id,
        options.maxChapters,
        options.retryLimit,
        options.retryBackoffMs,
        options.skipFailed,
        options.retryFailedAtEnd,
      ],
    );
    return resumed.rows[0];
  });
}

export async function getCrawlJob(id: string) {
  const result = await pool.query<CrawlJobRow>(
    'SELECT * FROM crawl_jobs WHERE id = $1',
    [id],
  );
  return result.rows[0];
}

export async function listCrawlJobs(limit = 50) {
  const result = await pool.query<CrawlJobRow>(
    `SELECT j.*, n.title AS novel_title
     FROM crawl_jobs j
     LEFT JOIN novels n ON n.id = j.novel_id
     ORDER BY j.updated_at DESC
     LIMIT $1`,
    [limit],
  );
  return result.rows;
}

export async function claimCrawlJob() {
  return withTransaction(async (client) => {
    const result = await client.query<CrawlJobRow>(
      `UPDATE crawl_jobs
       SET state = 'running', started_at = COALESCE(started_at, NOW()),
           updated_at = NOW(), error = NULL
       WHERE id = (
         SELECT id FROM crawl_jobs
         WHERE state = 'pending'
           AND cancel_requested = FALSE
         ORDER BY created_at
         FOR UPDATE SKIP LOCKED
         LIMIT 1
       )
       RETURNING *`,
    );
    return result.rows[0];
  });
}

export async function recoverInterruptedJobs() {
  await withTransaction(async (client) => {
    await client.query(
      `UPDATE crawl_job_items SET state = 'pending', updated_at = NOW()
       WHERE state = 'running'`,
    );
    await client.query(
      `UPDATE crawl_jobs
       SET state = 'pending', error = 'Worker restarted; resuming persisted job',
           updated_at = NOW()
       WHERE state = 'running'`,
    );
  });
}

export async function upsertNovel(meta: Record<string, unknown>) {
  const result = await pool.query<{ id: string }>(
    `INSERT INTO novels (
       source_key, source_url, title, author, summary, cover_url, status,
       chapter_count, latest_chapter, last_crawled_at
     )
     VALUES ('wikicv', $1, $2, $3, $4, $5, $6, $7, $8, NOW())
     ON CONFLICT (source_key, source_url) DO UPDATE SET
       title = EXCLUDED.title,
       author = EXCLUDED.author,
       summary = EXCLUDED.summary,
       cover_url = EXCLUDED.cover_url,
       status = EXCLUDED.status,
       chapter_count = EXCLUDED.chapter_count,
       latest_chapter = EXCLUDED.latest_chapter,
       last_crawled_at = NOW(),
       updated_at = NOW()
     RETURNING id`,
    [
      meta.sourceUrl,
      meta.title,
      meta.author || null,
      meta.summary || null,
      meta.cover || null,
      meta.status || null,
      meta.chapterCount || null,
      meta.latestChapter || null,
    ],
  );
  return result.rows[0].id;
}

export async function saveChapter(
  novelId: string,
  chapter: {
    url: string;
    title: string;
    content: string;
    contentText: string;
  },
  position: number,
) {
  const hash = createHash('sha256').update(chapter.content).digest('hex');
  await pool.query(
    `INSERT INTO chapters (
       novel_id, source_url, position, title, content_html, content_text,
       content_hash
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (novel_id, source_url) DO UPDATE SET
       position = EXCLUDED.position,
       title = EXCLUDED.title,
       content_html = EXCLUDED.content_html,
       content_text = EXCLUDED.content_text,
       content_hash = EXCLUDED.content_hash,
       crawled_at = NOW(),
       updated_at = NOW()`,
    [
      novelId,
      chapter.url,
      position,
      chapter.title,
      chapter.content,
      chapter.contentText,
      hash,
    ],
  );
}

export async function updateJobProgress(
  id: string,
  data: {
    novelId?: string;
    currentUrl?: string | null;
    discoveredCount?: number;
    completedCount?: number;
    failedCount?: number;
  },
) {
  await pool.query(
    `UPDATE crawl_jobs SET
       novel_id = COALESCE($2, novel_id),
       current_url = $3,
       discovered_count = COALESCE($4, discovered_count),
       completed_count = COALESCE($5, completed_count),
       failed_count = COALESCE($6, failed_count),
       updated_at = NOW()
     WHERE id = $1`,
    [
      id,
      data.novelId || null,
      data.currentUrl ?? null,
      data.discoveredCount ?? null,
      data.completedCount ?? null,
      data.failedCount ?? null,
    ],
  );
}

export async function finishJob(
  id: string,
  state: 'done' | 'done_with_errors' | 'failed' | 'paused' | 'cancelled',
  error?: string,
) {
  await pool.query(
    `UPDATE crawl_jobs
     SET state = $2, error = $3, finished_at = NOW(), updated_at = NOW()
     WHERE id = $1`,
    [id, state, error || null],
  );
}

export async function resumeJob(
  id: string,
  options: {
    maxChapters?: number;
    retryLimit?: number;
    retryBackoffMs?: number;
    skipFailed?: boolean;
    retryFailedAtEnd?: boolean;
  } = {},
) {
  const result = await pool.query<CrawlJobRow>(
    `UPDATE crawl_jobs
     SET state = 'pending', error = NULL, cancel_requested = FALSE,
         max_chapters = COALESCE($2, max_chapters),
         retry_limit = COALESCE($3, retry_limit),
         retry_backoff_ms = COALESCE($4, retry_backoff_ms),
         skip_failed = COALESCE($5, skip_failed),
         retry_failed_at_end = COALESCE($6, retry_failed_at_end),
         finished_at = NULL, updated_at = NOW()
     WHERE id = $1
       AND state IN (
         'paused', 'failed', 'done', 'done_with_errors', 'cancelled'
       )
     RETURNING *`,
    [
      id,
      options.maxChapters ?? null,
      options.retryLimit ?? null,
      options.retryBackoffMs ?? null,
      options.skipFailed ?? null,
      options.retryFailedAtEnd ?? null,
    ],
  );
  return result.rows[0];
}

export async function requestCancel(id: string) {
  await pool.query(
    `UPDATE crawl_jobs SET cancel_requested = TRUE, updated_at = NOW()
     WHERE id = $1`,
    [id],
  );
}

export async function upsertJobItem(
  jobId: string,
  sourceUrl: string,
  position: number,
) {
  const result = await pool.query<CrawlJobItemRow>(
    `INSERT INTO crawl_job_items (job_id, source_url, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (job_id, source_url) DO UPDATE SET
       position = EXCLUDED.position,
       updated_at = NOW()
     RETURNING *`,
    [jobId, sourceUrl, position],
  );
  return result.rows[0];
}

export async function markJobItemAttempt(id: string) {
  const result = await pool.query<CrawlJobItemRow>(
    `UPDATE crawl_job_items
     SET state = 'running', attempts = attempts + 1, error = NULL,
         updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id],
  );
  return result.rows[0];
}

export async function markJobItemDone(
  id: string,
  title: string,
  nextUrl?: string,
) {
  await pool.query(
    `UPDATE crawl_job_items
     SET state = 'done', title = $2, next_url = $3, error = NULL,
         updated_at = NOW()
     WHERE id = $1`,
    [id, title, nextUrl || null],
  );
}

export async function markJobItemFailed(
  id: string,
  error: string,
  nextUrl?: string,
) {
  await pool.query(
    `UPDATE crawl_job_items
     SET state = 'failed', error = $2, next_url = $3, updated_at = NOW()
     WHERE id = $1`,
    [id, error, nextUrl || null],
  );
}

export async function listRetryableFailedItems(jobId: string) {
  const result = await pool.query<CrawlJobItemRow>(
    `SELECT * FROM crawl_job_items
     WHERE job_id = $1 AND state = 'failed' AND next_url IS NOT NULL
     ORDER BY position`,
    [jobId],
  );
  return result.rows;
}

export async function getLastDoneJobItem(jobId: string) {
  const result = await pool.query<CrawlJobItemRow>(
    `SELECT * FROM crawl_job_items
     WHERE job_id = $1 AND state = 'done'
     ORDER BY position DESC
     LIMIT 1`,
    [jobId],
  );
  return result.rows[0];
}

export async function getJobItemByUrl(jobId: string, sourceUrl: string) {
  const result = await pool.query<CrawlJobItemRow>(
    `SELECT * FROM crawl_job_items
     WHERE job_id = $1 AND source_url = $2`,
    [jobId, sourceUrl],
  );
  return result.rows[0];
}

export async function listJobItems(jobId: string) {
  const result = await pool.query<CrawlJobItemRow>(
    `SELECT * FROM crawl_job_items
     WHERE job_id = $1
     ORDER BY position`,
    [jobId],
  );
  return result.rows;
}

export async function getJobItemCounts(jobId: string) {
  const result = await pool.query<{
    completed_count: number;
    failed_count: number;
    discovered_count: number;
  }>(
    `SELECT
       COUNT(*) FILTER (WHERE state = 'done')::int AS completed_count,
       COUNT(*) FILTER (WHERE state = 'failed')::int AS failed_count,
       COUNT(*)::int AS discovered_count
     FROM crawl_job_items
     WHERE job_id = $1`,
    [jobId],
  );
  return result.rows[0];
}

export async function listNovels() {
  const result = await pool.query(
    `SELECT n.id, n.source_key, n.source_url, n.title, n.author, n.summary,
            n.cover_url, n.status, n.chapter_count, n.latest_chapter,
            n.last_crawled_at, p.chapter_id AS last_read_chapter_id,
            c.title AS last_read_chapter_title,
            p.position AS reading_position, p.updated_at AS last_read_at
     FROM novels n
     LEFT JOIN reading_progress p ON p.novel_id = n.id
     LEFT JOIN chapters c ON c.id = p.chapter_id
     ORDER BY COALESCE(p.updated_at, n.updated_at) DESC`,
  );
  return result.rows;
}

export async function getNovel(id: string) {
  const result = await pool.query('SELECT * FROM novels WHERE id = $1', [id]);
  return result.rows[0];
}

export async function listChapters(novelId: string) {
  const result = await pool.query(
    `SELECT id, novel_id, source_url, position, title, crawled_at
     FROM chapters WHERE novel_id = $1 ORDER BY position`,
    [novelId],
  );
  return result.rows;
}

export async function getChapter(id: string) {
  const result = await pool.query('SELECT * FROM chapters WHERE id = $1', [id]);
  return result.rows[0];
}

export async function getReadingProgress(novelId: string) {
  const result = await pool.query(
    `SELECT novel_id, chapter_id, position, updated_at
     FROM reading_progress WHERE novel_id = $1`,
    [novelId],
  );
  return result.rows[0];
}

export async function saveReadingProgress(
  novelId: string,
  data: { chapterId?: string; position: Record<string, unknown> },
) {
  const result = await pool.query(
    `INSERT INTO reading_progress (novel_id, chapter_id, position)
     VALUES ($1, $2, $3)
     ON CONFLICT (novel_id) DO UPDATE SET
       chapter_id = EXCLUDED.chapter_id,
       position = EXCLUDED.position,
       updated_at = NOW()
     RETURNING novel_id, chapter_id, position, updated_at`,
    [novelId, data.chapterId || null, data.position],
  );
  return result.rows[0];
}
