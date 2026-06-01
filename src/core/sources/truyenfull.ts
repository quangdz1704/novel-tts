import type { SourceAdapter } from './SourceAdapter';

function absolute(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch (e) {
    return href;
  }
}

export const truyenfullAdapter: SourceAdapter = {
  match(url: string) {
    try {
      const host = new URL(url).hostname;
      return host.includes('truyenfull') || url.includes('truyenfull');
    } catch (e) {
      return false;
    }
  },

  async getNovel(url: string) {
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const title = doc.querySelector('h1')?.textContent?.trim() || '';
    const cover =
      doc.querySelector('.book-image img')?.getAttribute('src') || '';
    const author =
      doc.querySelector('.info .author')?.textContent?.trim() || '';
    const summary = doc.querySelector('.summary')?.textContent?.trim() || '';

    return {
      id: url,
      title,
      cover: cover ? absolute(cover, url) : undefined,
      author: author || undefined,
      summary: summary || undefined,
      url,
    };
  },

  async getChapters(novelUrl: string) {
    const res = await fetch(novelUrl);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');

    const anchors = Array.from(doc.querySelectorAll('.list-chapter a'));
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
      doc.querySelector('#chapter-content') ||
      doc.querySelector('.chapter-content') ||
      doc.querySelector('.read-content');
    const content = contentEl ? contentEl.textContent || '' : '';

    return { id: chapterUrl, title, content };
  },
};
