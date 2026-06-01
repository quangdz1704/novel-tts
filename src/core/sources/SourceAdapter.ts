export interface SourceAdapter {
  id: string;
  label: string;
  baseUrl?: string;
  match(url: string): boolean;
  resolveCoverUrl?: (cover: string, meta: { sourceUrl?: string }) => string | undefined;

  getNovel(url: string): Promise<{
    id: string;
    title: string;
    cover?: string;
    source?: string;
    sourceHost?: string;
    sourceUrl?: string;
    author?: string;
    summary?: string;
    status?: string;
    latestChapter?: string;
    chapterCount?: number;
    url: string;
  }>;

  getChapters(
    novelUrl: string,
    opts?: { maxChapters?: number },
  ): Promise<Array<{ id: string; title: string; url: string }>>;

  getChapter(
    chapterUrl: string,
  ): Promise<{ id: string; title: string; content: string }>;
}
