export interface SourceAdapter {
  match(url: string): boolean;

  getNovel(url: string): Promise<{
    id: string;
    title: string;
    cover?: string;
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
