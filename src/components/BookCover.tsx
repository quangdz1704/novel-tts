import React, { useMemo, useState } from "react";
import { findAdapterById } from "../core/sources";

export function normalizeCoverUrl({
  cover,
  source,
  sourceUrl,
  sourceHost,
}: {
  cover?: string;
  source?: string;
  sourceUrl?: string;
  sourceHost?: string;
}) {
  if (!cover) return undefined;
  try {
    const adapter = findAdapterById(source);
    const resolved = adapter?.resolveCoverUrl?.(cover, { sourceUrl });
    if (resolved) return resolved;

    if (cover.startsWith("http://") || cover.startsWith("https://")) {
      return cover;
    }
    if (cover.startsWith("//")) return `https:${cover}`;
    if (sourceUrl) return new URL(cover, sourceUrl).href;
    if (sourceHost) return new URL(cover, `https://${sourceHost}`).href;
    return cover;
  } catch (e) {
    return undefined;
  }
}

export default function BookCover({
  title,
  cover,
  sourceUrl,
  source,
  sourceHost,
  meta,
  className = "",
}: {
  title?: string;
  cover?: string;
  sourceUrl?: string;
  source?: string;
  sourceHost?: string;
  meta?: any;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = useMemo(
    () =>
      normalizeCoverUrl({
        cover: cover || meta?.cover,
        source: source || meta?.source,
        sourceUrl: sourceUrl || meta?.sourceUrl || meta?.url,
        sourceHost: sourceHost || meta?.sourceHost,
      }),
    [cover, source, sourceHost, sourceUrl, meta],
  );
  const initial = (title || "N").trim().slice(0, 1).toUpperCase();

  if (!src || failed) {
    return (
      <div className={`book-cover-fallback ${className}`}>
        <div className="book-cover-mark">{initial}</div>
        <div className="book-cover-title">{title || "Novel TTS"}</div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title || ""}
      className={className}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
