import React, { useRef, useState, useEffect, CSSProperties } from 'react';

type VirtualListProps<T> = {
  items: T[];
  itemHeight: number;
  height: number;
  renderItem: (item: T, index: number) => React.ReactNode;
};

export default function VirtualList<T>({
  items,
  itemHeight,
  height,
  renderItem,
}: VirtualListProps<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);

  const totalHeight = items.length * itemHeight;
  const startIndex = Math.floor(scrollTop / itemHeight);
  const visibleCount = Math.ceil(height / itemHeight) + 2;
  const endIndex = Math.min(items.length, startIndex + visibleCount);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onScroll = () => setScrollTop(el.scrollTop);
    el.addEventListener('scroll', onScroll);
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const innerStyle: CSSProperties = { height: totalHeight };
  return (
    <div ref={containerRef} style={{ height, overflow: 'auto' }}>
      <div style={innerStyle}>
        <div style={{ transform: `translateY(${startIndex * itemHeight}px)` }}>
          {items.slice(startIndex, endIndex).map((it, i) => (
            <div key={startIndex + i} style={{ height: itemHeight }}>
              {renderItem(it, startIndex + i)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
