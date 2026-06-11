import { create } from "zustand";
import {
  getLibraryPath,
  readJsonFile,
} from "../storage/localLibraryStorage";
import {
  saveReadingProgress,
  getReadingProgress,
  getNovelMetadata,
  saveNovelMetadata,
} from "../storage/indexeddb";

type ReaderState = {
  novelId?: string;
  chapterId?: string;
  content?: string;
  loadChapter: (novelId: string, chapterId: string) => Promise<boolean>;
  openChapter: (novelId: string, chapterId: string) => Promise<boolean>;
  setNovelId: (novelId: string) => void;
  setChapterId: (chapterId: string) => void;
  saveProgress: (pos: { scrollY: number }) => Promise<void>;
  restoreProgress: (novelId: string) => Promise<any>;
};

export const useReaderStore = create<ReaderState>((set, get) => ({
  chapterTitle: undefined,
  novelTitle: undefined,
  novelId: undefined,
  chapterId: undefined,
  content: undefined,
  setNovelId(novelId: string) {
    set({ novelId });
  },
  setChapterId(chapterId: string) {
    set({ chapterId });
  },
  async loadChapter(novelId: string, chapterId: string) {
    set({ novelId, chapterId, content: undefined });
    try {
      const base = await getLibraryPath();
      const path = `${base}/${novelId}/chapters/${chapterId}.json`;
      const data: any = await readJsonFile(path);
      if (data && data.content) {
        set({ content: data.content });
        try {
          const meta: any = await getNovelMetadata(novelId);
          await saveNovelMetadata(novelId, {
            ...(meta || { id: novelId }),
            lastReadAt: new Date().toISOString(),
            lastReadChapterId: chapterId,
            lastReadChapterTitle: data.title,
          });
        } catch (e) {}
        return true;
      }
    } catch (e) {
      console.error("loadChapter error", e);
    }
    return false;
  },
  async openChapter(novelId: string, chapterId: string) {
    set({ novelId, chapterId, content: undefined });
    return get().loadChapter(novelId, chapterId);
  },
  async saveProgress(pos) {
    const { novelId } = get();
    if (!novelId) return;
    try {
      await saveReadingProgress(novelId, {
        chapterId: get().chapterId,
        updatedAt: new Date().toISOString(),
        position: pos,
      });
    } catch (e) {
      console.error("saveProgress failed", e);
    }
  },
  async restoreProgress(novelId: string) {
    try {
      const p: any = await getReadingProgress(novelId);
      return p?.position || null;
    } catch (e) {
      return null;
    }
  },
}));
