import type { SourceAdapter } from './SourceAdapter';

function absolute(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}

export const novelbinAdapter: SourceAdapter = {
  id: 'novelbin',
  label: 'NovelBin',
  baseUrl: 'https://novelbin.me',
  resolveCoverUrl(cover: string, meta: { sourceUrl?: string }) {
    try {
      if (cover.startsWith('//')) return `https:${cover}`;
      return new URL(cover, meta.sourceUrl || this.baseUrl).href;
    } catch (e) {
      return undefined;
    }
  },
  match(url: string) {
    try {
      const host = new URL(url).hostname;
      return host.includes('novelbin') || url.includes('novelbin');
    } catch (e) {
      return false;
    }
  },

  async getNovel(url: string) {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const title =
      doc.querySelector('h1')?.textContent?.trim() ||
      doc.querySelector('.book-title')?.textContent?.trim() ||
      '';
    const cover =
      doc.querySelector('img.cover')?.getAttribute('src') ||
      doc.querySelector('.book-cover img')?.getAttribute('src') ||
      '';
    const author = doc.querySelector('.author')?.textContent?.trim() || '';
    const summary =
      doc.querySelector('.summary')?.textContent?.trim() ||
      doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
      '';

    return {
      id: url,
      title,
      cover: cover ? absolute(cover, url) : undefined,
      source: this.id,
      sourceHost: new URL(url).hostname,
      sourceUrl: url,
      author: author || undefined,
      summary: summary || undefined,
      url,
    };
  },

  async getChapters(novelUrl: string) {
    const res = await fetch(novelUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const anchors = Array.from(
      doc.querySelectorAll('a.chapter, .chapter-list a'),
    );
    const chapters = anchors.map((a) => {
      const href = a.getAttribute('href') || '';
      const title = a.textContent?.trim() || href;
      const url = absolute(href, novelUrl);
      return { id: url, title, url };
    });

    return chapters;
  },

  async getChapter(chapterUrl: string) {
    const res = await fetch(chapterUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const title = doc.querySelector('h1')?.textContent?.trim() || '';
    const contentEl =
      doc.querySelector('#content') ||
      doc.querySelector('.read-content') ||
      doc.querySelector('.chapter-content');
    const content = contentEl ? contentEl.textContent || '' : '';

    return { id: chapterUrl, title, content };
  },
};
