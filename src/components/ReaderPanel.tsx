import React, { useEffect, useRef } from 'react';
import { useReaderStore } from '../core/reader/readerStore';

export default function ReaderPanel() {
  const novelId = useReaderStore((s) => s.novelId ?? 'demo_novel');
  const chapterId = useReaderStore((s) => s.chapterId ?? '1');
  const content = useReaderStore((s) => s.content);
  const saveProgress = useReaderStore((s) => s.saveProgress);
  const restoreProgress = useReaderStore((s) => s.restoreProgress);
  const setNovelId = useReaderStore((s) => s.setNovelId);
  const setChapterId = useReaderStore((s) => s.setChapterId);
  const openChapter = useReaderStore((s) => s.openChapter);

  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let id: any;
    if (containerRef.current) {
      const el = containerRef.current;
      id = setInterval(() => {
        saveProgress({ scrollY: el.scrollTop });
      }, 2000);
    }
    return () => clearInterval(id);
  }, [containerRef.current]);

  useEffect(() => {
    if (!content || !novelId) return;
    const restore = async () => {
      const pos = await restoreProgress(novelId);
      if (pos && containerRef.current)
        containerRef.current.scrollTop = pos.scrollY || 0;
    };
    restore();
  }, [content, novelId, restoreProgress]);

  const open = async () => {
    await openChapter(novelId, chapterId);
  };

  return (
    <div className="p-4 glass-card rounded-2xl shadow">
      <h2 className="text-lg font-semibold">Reader</h2>
      <div className="mt-2 flex gap-2">
        <input
          className="p-2 bg-white/5"
          value={novelId}
          onChange={(e) => setNovelId(e.target.value)}
        />
        <input
          className="p-2 bg-white/5 w-24"
          value={chapterId}
          onChange={(e) => setChapterId(e.target.value)}
        />
        <button className="px-3 py-2 rounded bg-indigo-600" onClick={open}>
          Open
        </button>
      </div>

      <div
        ref={containerRef}
        className="mt-3 h-72 overflow-auto p-4 bg-white/3 rounded"
        style={{ lineHeight: 1.8 }}
      >
        {content ? (
          <div dangerouslySetInnerHTML={{ __html: content }} />
        ) : (
          <div className="text-gray-400">
            No content loaded. Use the crawler to download chapters first.
          </div>
        )}
      </div>
    </div>
  );
}
