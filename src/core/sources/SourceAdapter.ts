export interface SourceAdapter {
  match(url: string): boolean;

  getNovel(url: string): Promise<{
    id: string;
    title: string;
    cover?: string;
    author?: string;
    summary?: string;
    url: string;
  }>;

  getChapters(
    novelUrl: string,
  ): Promise<Array<{ id: string; title: string; url: string }>>;

  getChapter(
    chapterUrl: string,
  ): Promise<{ id: string; title: string; content: string }>;
}
