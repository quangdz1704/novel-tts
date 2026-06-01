import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  saveNovelMetadata,
  listNovelsMetadata,
} from '../core/storage/indexeddb';

type NovelMeta = {
  id: string;
  title?: string;
  author?: string;
  cover?: string;
  url?: string;
};

type LibraryState = {
  novels: NovelMeta[];
  addNovel: (meta: NovelMeta) => Promise<void>;
  loadAll: () => Promise<void>;
};

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
      novels: [],
      addNovel: async (meta: NovelMeta) => {
        await saveNovelMetadata(meta.id, meta);
        set((s) => ({
          novels: [meta, ...s.novels.filter((n) => n.id !== meta.id)],
        }));
      },
      loadAll: async () => {
        const all = (await listNovelsMetadata()) as NovelMeta[];
        set({ novels: all || [] });
      },
    }),
    {
      name: 'library-storage',
    },
  ),
);
