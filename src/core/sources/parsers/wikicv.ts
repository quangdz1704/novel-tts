import type { HtmlDocument, HtmlNode } from './html';

export type ChapterLink = {
  id: string;
  title: string;
  url: string;
};

export type ParsedWikiCvChapter = ChapterLink & {
  content: string;
  contentText: string;
  nextUrl?: string;
};

export function absoluteUrl(href: string, base: string) {
  try {
    return new URL(href, base).href;
  } catch {
    return href;
  }
}

function getInfoLine(text: string, label: string) {
  const re = new RegExp(`${label}:\\s*([^\\n]+)`, 'i');
  return text.match(re)?.[1]?.trim();
}

export function getWikiCvChapterLinks(
  documentNode: HtmlDocument,
  baseUrl: string,
) {
  const seen = new Set<string>();
  return documentNode
    .findAll('a[href]')
    .map((anchor) => {
      const url = absoluteUrl(anchor.attr('href') || '', baseUrl);
      return {
        id: url,
        title: anchor.text().trim(),
        url,
      };
    })
    .filter((item) => /\/truyen\/[^/]+\/chuong-/.test(item.url))
    .filter((item) => {
      if (seen.has(item.url)) return false;
      seen.add(item.url);
      return true;
    });
}

export function parseWikiCvNovel(documentNode: HtmlDocument, url: string) {
  const info = documentNode.find('.book-info');
  const infoText = info?.text().replace(/[ \t]+/g, ' ') || '';
  const title =
    info?.find('h2')?.text().trim() || documentNode.title().trim() || '';
  const cover = info?.find('img')?.attr('src');
  const latest = getWikiCvChapterLinks(documentNode, url)
    .map((chapter) => {
      const number =
        Number(chapter.title.match(/Chương\s+(\d+)/i)?.[1]) ||
        Number(chapter.url.match(/\/chuong-(\d+)/i)?.[1]) ||
        0;
      return { chapter, number };
    })
    .sort((a, b) => b.number - a.number)[0];

  return {
    id: url,
    title,
    cover: cover ? absoluteUrl(cover, url) : undefined,
    source: 'wikicv',
    sourceHost: new URL(url).hostname,
    sourceUrl: url,
    author: getInfoLine(infoText, 'Tác giả'),
    summary:
      documentNode
        .find('.book-desc, .desc, #bookDescription')
        ?.text()
        .trim() || undefined,
    status: getInfoLine(infoText, 'Tình trạng'),
    latestChapter: latest?.chapter.title,
    chapterCount: latest?.number || undefined,
    url,
  };
}

function findNextChapterUrl(documentNode: HtmlDocument, baseUrl: string) {
  const next = documentNode
    .findAll('a[href]')
    .find((anchor) => /chương sau/i.test(anchor.text()));
  return next
    ? absoluteUrl(next.attr('href') || '', baseUrl)
    : undefined;
}

function contentNode(documentNode: HtmlDocument): HtmlNode {
  return documentNode.find('#bookContent') || documentNode;
}

export function parseWikiCvChapter(
  documentNode: HtmlDocument,
  url: string,
  position?: number,
): ParsedWikiCvChapter {
  const title =
    documentNode.find('.chapter-name')?.text().trim() ||
    documentNode.title().trim() ||
    `Chapter ${position || ''}`.trim();
  const content = contentNode(documentNode);

  return {
    id: url,
    title,
    url,
    content: content.html(),
    contentText: content.text().replace(/\s+/g, ' ').trim(),
    nextUrl: findNextChapterUrl(documentNode, url),
  };
}

export function findFirstWikiCvChapter(
  documentNode: HtmlDocument,
  novelUrl: string,
) {
  const links = getWikiCvChapterLinks(documentNode, novelUrl);
  return links.find((chapter) => /chuong-1(?:-|$)/i.test(chapter.url)) || links[0];
}
