import type { CrawlJob } from './types';
import { findAdapter } from '../sources';

export async function processJobBrowser(job: CrawlJob) {
  // lightweight browser worker using fetch + DOMParser and adapters when available
  const url = job.url;
  // If an adapter exists for the URL, delegate
  const adapter = findAdapter(url);
  if (adapter) {
    if (job.type === 'metadata') {
      return adapter.getNovel(url);
    }
    if (job.type === 'chapter') {
      return adapter.getChapter(url);
    }
  }

  // fallback: fetch and parse minimal content
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
  const html = await res.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');

  if (job.type === 'metadata') {
    const title = doc.querySelector('h1')?.textContent?.trim() || '';
    const author = doc.querySelector('.author')?.textContent?.trim() || '';
    const summary = doc.querySelector('.summary')?.textContent?.trim() || '';
    return { title, author, summary };
  }

  const title = doc.querySelector('h1')?.textContent?.trim() || doc.title || '';
  const contentEl =
    doc.querySelector('#content') ||
    doc.querySelector('.chapter-content') ||
    doc.querySelector('.read-content') ||
    doc.body;
  const content = contentEl ? contentEl.innerHTML : '';
  return { title, content };
}
