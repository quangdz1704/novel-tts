import { pool } from './client';

export async function migrate() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS novels (
      id BIGSERIAL PRIMARY KEY,
      source_key TEXT NOT NULL,
      source_url TEXT NOT NULL,
      title TEXT NOT NULL,
      author TEXT,
      summary TEXT,
      cover_url TEXT,
      status TEXT,
      chapter_count INTEGER,
      latest_chapter TEXT,
      last_crawled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (source_key, source_url)
    );

    CREATE TABLE IF NOT EXISTS chapters (
      id BIGSERIAL PRIMARY KEY,
      novel_id BIGINT NOT NULL REFERENCES novels(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT NOT NULL,
      content_html TEXT NOT NULL,
      content_text TEXT NOT NULL,
      content_hash TEXT NOT NULL,
      crawled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (novel_id, source_url)
    );

    CREATE INDEX IF NOT EXISTS chapters_novel_position_idx
      ON chapters (novel_id, position);

    CREATE TABLE IF NOT EXISTS crawl_jobs (
      id UUID PRIMARY KEY,
      source_url TEXT NOT NULL,
      source_key TEXT NOT NULL,
      state TEXT NOT NULL DEFAULT 'pending',
      max_chapters INTEGER NOT NULL DEFAULT 0,
      discovered_count INTEGER NOT NULL DEFAULT 0,
      completed_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      current_url TEXT,
      novel_id BIGINT REFERENCES novels(id) ON DELETE SET NULL,
      retry_limit INTEGER NOT NULL DEFAULT 3,
      retry_backoff_ms INTEGER NOT NULL DEFAULT 2000,
      skip_failed BOOLEAN NOT NULL DEFAULT FALSE,
      retry_failed_at_end BOOLEAN NOT NULL DEFAULT TRUE,
      error TEXT,
      cancel_requested BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      started_at TIMESTAMPTZ,
      finished_at TIMESTAMPTZ,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS crawl_jobs_state_created_idx
      ON crawl_jobs (state, created_at);

    ALTER TABLE crawl_jobs
      ADD COLUMN IF NOT EXISTS retry_limit INTEGER NOT NULL DEFAULT 3,
      ADD COLUMN IF NOT EXISTS retry_backoff_ms INTEGER NOT NULL DEFAULT 2000,
      ADD COLUMN IF NOT EXISTS skip_failed BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS retry_failed_at_end BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE TABLE IF NOT EXISTS crawl_job_items (
      id BIGSERIAL PRIMARY KEY,
      job_id UUID NOT NULL REFERENCES crawl_jobs(id) ON DELETE CASCADE,
      source_url TEXT NOT NULL,
      position INTEGER NOT NULL,
      title TEXT,
      state TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      next_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (job_id, source_url)
    );

    CREATE INDEX IF NOT EXISTS crawl_job_items_job_state_idx
      ON crawl_job_items (job_id, state, position);

    INSERT INTO crawl_job_items (
      job_id, source_url, position, title, state, attempts
    )
    SELECT
      j.id, c.source_url, c.position, c.title, 'done', 1
    FROM crawl_jobs j
    JOIN chapters c ON c.novel_id = j.novel_id
    WHERE c.position <= j.completed_count
    ON CONFLICT (job_id, source_url) DO NOTHING;
  `);
}
