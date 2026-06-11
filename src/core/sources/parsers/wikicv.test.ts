import { describe, expect, it } from 'vitest';
import { parseCheerioHtml } from '../../../../server/crawler/cheerioHtml';
import {
  findFirstWikiCvChapter,
  parseWikiCvChapter,
  parseWikiCvNovel,
} from './wikicv';

describe('WikiCV shared parser', () => {
  it('parses novel metadata and the first chapter link', () => {
    const documentNode = parseCheerioHtml(`
      <html>
        <head><title>Fallback title</title></head>
        <body>
          <section class="book-info">
            <h2>Ngu Tien Mon</h2>
            <img src="/photo/cover.jpg" />
            <div>Tác giả: Test Author\nTình trạng: Đang ra</div>
          </section>
          <div class="book-desc">A summary</div>
          <a href="/truyen/ngu-tien-mon/chuong-1-start">Chương 1</a>
          <a href="/truyen/ngu-tien-mon/chuong-20-end">Chương 20</a>
        </body>
      </html>
    `);

    const url = 'https://wikicv.net/truyen/ngu-tien-mon';
    const meta = parseWikiCvNovel(documentNode, url);
    const first = findFirstWikiCvChapter(documentNode, url);

    expect(meta.title).toBe('Ngu Tien Mon');
    expect(meta.author).toBe('Test Author');
    expect(meta.status).toBe('Đang ra');
    expect(meta.cover).toBe('https://wikicv.net/photo/cover.jpg');
    expect(meta.chapterCount).toBe(20);
    expect(first?.url).toBe(
      'https://wikicv.net/truyen/ngu-tien-mon/chuong-1-start',
    );
  });

  it('parses chapter content and next URL', () => {
    const documentNode = parseCheerioHtml(`
      <html>
        <head><title>Fallback chapter</title></head>
        <body>
          <h1 class="chapter-name">Chương 1: Khởi đầu</h1>
          <div id="bookContent"><p>First paragraph.</p></div>
          <a href="/truyen/ngu-tien-mon/chuong-2-next">Chương sau</a>
        </body>
      </html>
    `);

    const chapter = parseWikiCvChapter(
      documentNode,
      'https://wikicv.net/truyen/ngu-tien-mon/chuong-1-start',
      1,
    );

    expect(chapter.title).toBe('Chương 1: Khởi đầu');
    expect(chapter.content).toContain('First paragraph.');
    expect(chapter.contentText).toBe('First paragraph.');
    expect(chapter.nextUrl).toBe(
      'https://wikicv.net/truyen/ngu-tien-mon/chuong-2-next',
    );
  });
});
