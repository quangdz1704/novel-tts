import React from 'react';

export default function NovelCard({
  novelId,
  meta,
  chapterCount = 0,
  selected,
  onSelect,
  onOpen,
}: {
  novelId: string;
  meta?: any;
  chapterCount?: number;
  selected?: boolean;
  onSelect?: () => void;
  onOpen?: () => void;
}) {
  return (
    <div
      className={`flex h-full cursor-pointer flex-col overflow-hidden rounded-xl border bg-white transition hover:border-slate-300 hover:shadow-sm ${
        selected ? 'border-slate-950 ring-2 ring-slate-200' : 'border-slate-200'
      }`}
      onClick={onSelect}
    >
      {meta?.cover ? (
        <img
          src={meta.cover}
          alt=""
          className="aspect-[3/4] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center bg-slate-100 text-4xl font-semibold text-slate-400">
          {(meta?.title || novelId).slice(0, 1).toUpperCase()}
        </div>
      )}
      <div className="min-w-0 flex-1 p-3">
        <div className="line-clamp-2 min-h-10 font-semibold leading-5 text-slate-950">
          {meta?.title || novelId}
        </div>
        <div className="truncate text-sm text-slate-500">
          {meta?.author || 'unknown author'}
        </div>
        <div className="mt-1 text-xs text-slate-400">
          {chapterCount} saved chapters
        </div>
        <div className="mt-3 flex gap-2">
          <button
            className="ghost-button"
            onClick={(e) => {
              e.stopPropagation();
              navigator.clipboard?.writeText(novelId);
            }}
          >
            Copy ID
          </button>
          <button
            className="secondary-button"
            onClick={(e) => {
              e.stopPropagation();
              onOpen?.();
            }}
            disabled={!onOpen}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
