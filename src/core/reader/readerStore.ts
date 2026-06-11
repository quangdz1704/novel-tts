import { create } from "zustand";
import {
  getBackendChapter,
  getBackendReadingProgress,
  saveBackendReadingProgress,
} from "../backend/client";

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
      const chapter = await getBackendChapter(chapterId);
      if (chapter.content) {
        set({ content: chapter.content });
        const previous = await getBackendReadingProgress(novelId);
        await saveBackendReadingProgress(novelId, {
          chapterId,
          position:
            previous?.chapterId === chapterId
              ? previous.position
              : { scrollY: 0 },
        });
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
      await saveBackendReadingProgress(novelId, {
        chapterId: get().chapterId,
        position: pos,
      });
    } catch (e) {
      console.error("saveProgress failed", e);
    }
  },
  async restoreProgress(novelId: string) {
    try {
      const p = await getBackendReadingProgress(novelId);
      return p?.position || null;
    } catch (e) {
      return null;
    }
  },
}));
