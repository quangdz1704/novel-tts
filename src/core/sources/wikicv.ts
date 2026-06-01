import type { SourceAdapter } from './SourceAdapter';
import { extractReadableContent } from '../reader/content';

const BASE_URL = 'https://wikicv.net';
const MAX_DISCOVERY_CHAPTERS = 3000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function absolute(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}

function getDoc(html: string) {
  return new DOMParser().parseFromString(html, 'text/html');
}

function getInfoLine(text: string, label: string) {
  const re = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
  return text.match(re)?.[1]?.trim();
}

function uniqueChapterLinks(doc: Document, baseUrl: string) {
  const seen = new Set<string>();
  return Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'))
    .map((a) => ({
      id: absolute(a.getAttribute('href') || '', baseUrl),
      title: a.textContent?.trim() || '',
      url: absolute(a.getAttribute('href') || '', baseUrl),
    }))
    .filter((item) => /\/truyen\/[^/]+\/chuong-/.test(item.url))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
}

function nextChapterUrl(doc: Document, baseUrl: string) {
  const links = Array.from(doc.querySelectorAll<HTMLAnchorElement>('a[href]'));
  const next = links.find((a) => /chương sau/i.test(a.textContent || ''));
  return next ? absolute(next.getAttribute('href') || '', baseUrl) : undefined;
}

export const wikicvAdapter: SourceAdapter = {
  match(url: string) {
    try {
      return new URL(url).hostname.includes('wikicv.net');
    } catch (e) {
      return url.includes('wikicv.net');
    }
  },

  async getNovel(url: string) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`WikiCV metadata failed: HTTP ${res.status}`);
    const html = await res.text();
    const doc = getDoc(html);
    const info = doc.querySelector('.book-info');
    const infoText = info?.textContent?.replace(/[ \t]+/g, ' ') || '';
    const title =
      info?.querySelector('h2')?.textContent?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      '';
    const cover = doc.querySelector<HTMLImageElement>('.book-info img')?.src;
    const latest = uniqueChapterLinks(doc, url).find((ch) =>
      /chuong-\d+/i.test(ch.url),
    );

    return {
      id: url,
      title,
      cover: cover ? absolute(cover, url) : undefined,
      author: getInfoLine(infoText, 'Tác giả'),
      summary:
        doc.querySelector('.book-desc, .desc, #bookDescription')
          ?.textContent?.trim() || undefined,
      status: getInfoLine(infoText, 'Tình trạng'),
      latestChapter: latest?.title,
      chapterCount: latest?.title.match(/Chương\s+(\d+)/i)?.[1]
        ? Number(latest.title.match(/Chương\s+(\d+)/i)?.[1])
        : undefined,
      url,
    };
  },

  async getChapters(novelUrl: string, opts: { maxChapters?: number } = {}) {
    const res = await fetch(novelUrl);
    if (!res.ok) throw new Error(`WikiCV chapter list failed: HTTP ${res.status}`);
    const html = await res.text();
    const doc = getDoc(html);
    const first = uniqueChapterLinks(doc, novelUrl).find((ch) =>
      /chuong-1-/i.test(ch.url),
    );
    if (!first) return uniqueChapterLinks(doc, novelUrl);

    const chapters: Array<{ id: string; title: string; url: string }> = [];
    const seen = new Set<string>();
    let currentUrl: string | undefined = first.url;

    const limit =
      opts.maxChapters === 0
        ? MAX_DISCOVERY_CHAPTERS
        : opts.maxChapters || MAX_DISCOVERY_CHAPTERS;

    while (currentUrl && !seen.has(currentUrl)) {
      seen.add(currentUrl);
      const chapterRes = await fetch(currentUrl);
      if (!chapterRes.ok) break;
      const chapterHtml = await chapterRes.text();
      const chapterDoc = getDoc(chapterHtml);
      const title =
        chapterDoc.querySelector('.chapter-name')?.textContent?.trim() ||
        chapterDoc.querySelector('title')?.textContent?.trim() ||
        `Chapter ${chapters.length + 1}`;
      chapters.push({
        id: currentUrl,
        title,
        url: currentUrl,
      });

      if (chapters.length >= limit) break;
      currentUrl = nextChapterUrl(chapterDoc, currentUrl);
      if (currentUrl) await delay(120);
    }

    return chapters;
  },

  async getChapter(chapterUrl: string) {
    const res = await fetch(chapterUrl);
    if (!res.ok) throw new Error(`WikiCV chapter failed: HTTP ${res.status}`);
    const html = await res.text();
    const doc = getDoc(html);
    const title =
      doc.querySelector('.chapter-name')?.textContent?.trim() ||
      doc.querySelector('title')?.textContent?.trim() ||
      '';
    const contentEl = doc.querySelector('#bookContent') || doc.body;
    return {
      id: chapterUrl,
      title,
      content: extractReadableContent(contentEl?.innerHTML || html),
    };
  },
};
