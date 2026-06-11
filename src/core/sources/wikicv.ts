import type { SourceAdapter } from './SourceAdapter';
import { extractReadableContent } from '../reader/content';
import { parseBrowserHtml } from './parsers/browserHtml';
import {
  findFirstWikiCvChapter,
  getWikiCvChapterLinks,
  parseWikiCvChapter,
  parseWikiCvNovel,
} from './parsers/wikicv';

const BASE_URL = 'https://wikicv.net';
const MAX_DISCOVERY_CHAPTERS = 3000;

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const wikicvAdapter: SourceAdapter = {
  id: 'wikicv',
  label: 'WikiCV',
  baseUrl: BASE_URL,
  resolveCoverUrl(cover: string, meta: { sourceUrl?: string }) {
    try {
      if (cover.startsWith('http://') || cover.startsWith('https://')) {
        const parsed = new URL(cover);
        if (
          parsed.pathname.startsWith('/photo/') &&
          ['localhost', '127.0.0.1'].includes(parsed.hostname)
        ) {
          return new URL(parsed.pathname + parsed.search, BASE_URL).href;
        }
        return cover;
      }
      if (cover.startsWith('//')) return `https:${cover}`;
      return new URL(cover, meta.sourceUrl || BASE_URL).href;
    } catch (e) {
      return undefined;
    }
  },
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
    return parseWikiCvNovel(parseBrowserHtml(await res.text()), url);
  },

  async getChapters(novelUrl: string, opts: { maxChapters?: number } = {}) {
    const res = await fetch(novelUrl);
    if (!res.ok) throw new Error(`WikiCV chapter list failed: HTTP ${res.status}`);
    const documentNode = parseBrowserHtml(await res.text());
    const first = findFirstWikiCvChapter(documentNode, novelUrl);
    if (!first) return getWikiCvChapterLinks(documentNode, novelUrl);

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
      const chapter = parseWikiCvChapter(
        parseBrowserHtml(await chapterRes.text()),
        currentUrl,
        chapters.length + 1,
      );
      chapters.push({
        id: currentUrl,
        title: chapter.title,
        url: currentUrl,
      });

      if (chapters.length >= limit) break;
      currentUrl = chapter.nextUrl;
      if (currentUrl) await delay(120);
    }

    return chapters;
  },

  async getChapter(chapterUrl: string) {
    const res = await fetch(chapterUrl);
    if (!res.ok) throw new Error(`WikiCV chapter failed: HTTP ${res.status}`);
    const chapter = parseWikiCvChapter(
      parseBrowserHtml(await res.text()),
      chapterUrl,
    );
    return {
      id: chapterUrl,
      title: chapter.title,
      content: extractReadableContent(chapter.content),
    };
  },
};
