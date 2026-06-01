import React from 'react';

export default function NovelCard({
  novelId,
  meta,
  onOpen,
}: {
  novelId: string;
  meta?: any;
  onOpen?: () => void;
}) {
  return (
    <div className="p-3 bg-white/5 rounded-lg flex items-start gap-3">
      <div className="w-16 h-20 bg-gray-700 rounded" />
      <div className="flex-1">
        <div className="font-semibold">{meta?.title || novelId}</div>
        <div className="text-sm text-gray-400">
          {meta?.author || 'unknown author'}
        </div>
        <div className="mt-2 flex gap-2">
          <button
            className="px-2 py-1 rounded bg-indigo-600 text-sm"
            onClick={() => {
              navigator.clipboard?.writeText(novelId);
              alert('Novel ID copied: ' + novelId);
            }}
          >
            Copy ID
          </button>
          <button
            className="px-2 py-1 rounded bg-green-600 text-sm"
            onClick={onOpen}
          >
            Open
          </button>
        </div>
      </div>
    </div>
  );
}
