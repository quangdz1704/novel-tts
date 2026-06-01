import React from 'react';
import BookCover from './BookCover';

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
      className={`book-card ${
        selected ? 'border-[var(--accent)] ring-2 ring-[var(--accent-soft)]' : ''
      }`}
      onClick={onSelect}
    >
      <BookCover
        title={meta?.title || novelId}
        meta={meta}
        className="book-card-cover"
      />
      <div className="min-w-0 flex-1 p-3">
        <div className="line-clamp-2 min-h-10 font-semibold leading-5 text-[var(--app-fg)]">
          {meta?.title || novelId}
        </div>
        <div className="truncate text-sm text-[var(--muted)]">
          {meta?.author || 'unknown author'}
        </div>
        <div className="mt-1 text-xs text-[var(--muted)]">
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
