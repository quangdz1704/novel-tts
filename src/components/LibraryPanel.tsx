import React, { useEffect, useState } from 'react';
import { listNovels } from '../core/storage/fsAdapter';
import { listNovelsMetadata } from '../core/storage/indexeddb';
import NovelCard from './NovelCard';
import VirtualList from './VirtualList';
import { useReaderStore } from '../core/reader/readerStore';

export default function LibraryPanel() {
  const [novels, setNovels] = useState<string[]>([]);
  const [meta, setMeta] = useState<Record<string, any>>({});
  const openChapter = useReaderStore((s) => s.openChapter);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const files = await listNovels();
        if (!mounted) return;
        setNovels(files.filter((name): name is string => Boolean(name)));
        const metas: any = {};
        try {
          const dbMeta: any = await listNovelsMetadata();
          (dbMeta || []).forEach((m: any) => (metas[m.id] = m));
        } catch (e) {}
        if (mounted) setMeta(metas);
      } catch (e) {
        console.error('LibraryPanel load error', e);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">Library</h2>
      <div className="mt-3">
        {novels.length === 0 ? (
          <div className="text-gray-400">No novels found in library.</div>
        ) : (
          <VirtualList
            items={novels}
            itemHeight={96}
            height={360}
            renderItem={(nid) => (
              <NovelCard
                key={nid}
                novelId={nid}
                meta={meta[nid]}
                onOpen={() => openChapter(nid, '1')}
              />
            )}
          />
        )}
      </div>
    </div>
  );
}
