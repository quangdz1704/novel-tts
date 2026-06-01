import type { CrawlJob } from './types';
import * as cheerio from 'cheerio';
import { fetchWithPlaywright } from './playwrightClient';

export async function processJob(
  job: CrawlJob,
  opts: { timeoutMs?: number } = {},
) {
  // job.type: 'metadata' | 'chapter'
  const { url } = job;

  // Use Playwright to handle JS-heavy sites, fallback to fetch in playwrightClient
  const { ok, status, content } = await fetchWithPlaywright(url, {
    timeoutMs: opts.timeoutMs,
  });
  if (!ok) throw new Error(`Fetch failed: ${status}`);

  // Parse with Cheerio for structured extraction
  const $ = cheerio.load(content);

  if (job.type === 'metadata') {
    const title = $('h1').first().text().trim();
    const author = $('.author').first().text().trim();
    const summary = $('.summary').first().text().trim();
    return { title, author, summary };
  }

  // chapter
  const title = $('h1').first().text().trim() || $('title').text().trim();
  // prefer common selectors, fall back to body
  const contentEl =
    $('#content').html() ||
    $('.chapter-content').html() ||
    $('.read-content').html() ||
    $('body').html() ||
    '';

  // normalize minimal whitespace
  const normalized = contentEl.replace(/\r/g, '');

  return { title, content: normalized };
}
