import {
  findFirstWikiCvChapter,
  parseWikiCvChapter,
  parseWikiCvNovel,
} from '../../src/core/sources/parsers/wikicv';
import { parseCheerioHtml } from './cheerioHtml';
import { config } from '../config';
import { fetchHtml, getFetchRetryDelay } from './fetcher';
import {
  finishJob,
  getLastDoneJobItem,
  getJobItemCounts,
  getJobItemByUrl,
  getCrawlJob,
  listRetryableFailedItems,
  markJobItemAttempt,
  markJobItemDone,
  markJobItemFailed,
  saveChapter,
  updateJobProgress,
  upsertJobItem,
  upsertNovel,
  type CrawlJobRow,
} from '../db/repository';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWikiCv(url: string, expected: RegExp) {
  const result = await fetchHtml(url, (html) => expected.test(html));
  return {
    documentNode: parseCheerioHtml(result.html),
    transport: result.transport,
  };
}

async function processChapter(
  job: CrawlJobRow,
  novelId: string,
  url: string,
  position: number,
) {
  const item = await upsertJobItem(job.id, url, position);
  let parsedChapter:
    | ReturnType<typeof parseWikiCvChapter>
    | undefined;
  let lastError: unknown;

  for (let attempt = 0; attempt <= job.retry_limit; attempt += 1) {
    await markJobItemAttempt(item.id);
    try {
      const chapterPage = await fetchWikiCv(url, /bookContent|chapter-name/i);
      parsedChapter = parseWikiCvChapter(
        chapterPage.documentNode,
        url,
        position,
      );
      await saveChapter(novelId, parsedChapter, position);
      await markJobItemDone(
        item.id,
        parsedChapter.title,
        parsedChapter.nextUrl,
      );
      return {
        ok: true as const,
        nextUrl: parsedChapter.nextUrl,
      };
    } catch (error) {
      lastError = error;
      if (attempt < job.retry_limit) {
        const exponentialDelay = job.retry_backoff_ms * 2 ** attempt;
        await delay(
          getFetchRetryDelay(
            error,
            exponentialDelay + Math.floor(Math.random() * job.retry_backoff_ms),
          ),
        );
      }
    }
  }

  const error = String(lastError);
  const nextUrl = parsedChapter?.nextUrl || item.next_url;
  await markJobItemFailed(item.id, error, nextUrl);
  return {
    ok: false as const,
    error,
    nextUrl,
  };
}

async function syncJobCounts(
  jobId: string,
  novelId: string,
  currentUrl?: string,
) {
  const counts = await getJobItemCounts(jobId);
  await updateJobProgress(jobId, {
    novelId,
    currentUrl,
    discoveredCount: counts.discovered_count,
    completedCount: counts.completed_count,
    failedCount: counts.failed_count,
  });
  return counts;
}

export async function previewWikiCv(url: string, maxChapters = 3) {
  const novelPage = await fetchWikiCv(url, /book-info|\/chuong-/i);
  const meta = parseWikiCvNovel(novelPage.documentNode, url);
  const first = findFirstWikiCvChapter(novelPage.documentNode, url);
  const chapters = [];
  const seen = new Set<string>();
  let currentUrl: string | undefined = first?.url;

  while (currentUrl && chapters.length < maxChapters && !seen.has(currentUrl)) {
    seen.add(currentUrl);
    const chapterPage = await fetchWikiCv(currentUrl, /bookContent|chapter-name/i);
    const chapter = parseWikiCvChapter(
      chapterPage.documentNode,
      currentUrl,
      chapters.length + 1,
    );
    chapters.push({ id: chapter.id, title: chapter.title, url: chapter.url });
    currentUrl = chapter.nextUrl;
  }

  return {
    novelId: String(meta.title || url)
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 80),
    meta: {
      ...meta,
      chapters,
      chapterCount: meta.chapterCount || chapters.length,
      lastCrawledAt: new Date().toISOString(),
    },
    chapters,
    transport: novelPage.transport,
  };
}

export async function crawlWikiCv(job: CrawlJobRow) {
  try {
    const novelPage = await fetchWikiCv(job.source_url, /book-info|\/chuong-/i);
    const meta = parseWikiCvNovel(novelPage.documentNode, job.source_url);
    const novelId = await upsertNovel(meta);
    const first = findFirstWikiCvChapter(novelPage.documentNode, job.source_url);
    if (!first) throw new Error('Could not find the first WikiCV chapter');

    const limit =
      job.max_chapters > 0
        ? Math.min(job.max_chapters, config.maxChapters)
        : config.maxChapters;
    const seen = new Set<string>();
    let currentUrl: string | undefined = job.current_url;
    let position = job.completed_count + job.failed_count + 1;

    if (!currentUrl && job.completed_count > 0) {
      const lastItem = await getLastDoneJobItem(job.id);
      if (lastItem) {
        const lastPage = await fetchWikiCv(
          lastItem.source_url,
          /bookContent|chapter-name/i,
        );
        currentUrl = parseWikiCvChapter(
          lastPage.documentNode,
          lastItem.source_url,
          lastItem.position,
        ).nextUrl;
      }
    }
    if (!currentUrl && job.completed_count === 0) currentUrl = first.url;
    if (currentUrl) {
      const existingItem = await getJobItemByUrl(job.id, currentUrl);
      if (existingItem) position = existingItem.position;
    }

    while (currentUrl && position <= limit && !seen.has(currentUrl)) {
      const latestJob = await getCrawlJob(job.id);
      if (latestJob?.cancel_requested) {
        await finishJob(job.id, 'cancelled');
        return;
      }

      seen.add(currentUrl);
      const result = await processChapter(
        job,
        novelId,
        currentUrl,
        position,
      );

      if (!result.ok) {
        await syncJobCounts(job.id, novelId, currentUrl);
        if (!job.skip_failed || !result.nextUrl) {
          const reason = result.nextUrl
            ? 'Chapter failed after retries. Resume to retry it, or enable skip failed.'
            : 'Chapter failed after retries and its next URL is unknown. Resume later to continue from this chapter.';
          await finishJob(job.id, 'paused', `${reason} ${result.error}`);
          return;
        }
      }

      currentUrl = result.nextUrl;
      position += 1;
      await syncJobCounts(job.id, novelId, currentUrl);
    }

    if (job.retry_failed_at_end) {
      const failedItems = await listRetryableFailedItems(job.id);
      for (const item of failedItems) {
        const latestJob = await getCrawlJob(job.id);
        if (latestJob?.cancel_requested) {
          await finishJob(job.id, 'cancelled');
          return;
        }
        await processChapter(
          job,
          novelId,
          item.source_url,
          item.position,
        );
        await syncJobCounts(job.id, novelId, currentUrl);
      }
    }

    const counts = await syncJobCounts(job.id, novelId, currentUrl);
    await finishJob(
      job.id,
      counts.failed_count > 0 ? 'done_with_errors' : 'done',
      counts.failed_count > 0
        ? `${counts.failed_count} chapter(s) still failed after retry`
        : undefined,
    );
  } catch (error) {
    await finishJob(
      job.id,
      'paused',
      `Crawler paused with persisted progress: ${String(error)}`,
    );
  }
}
