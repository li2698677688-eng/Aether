"use client";

import { useVirtualizer } from "@tanstack/react-virtual";
import { useEffect, useRef, useState, type RefObject } from "react";

import { SiteCard } from "@/components/feed/site-card";
import type { Site } from "@/types/site";

const FEED_GAP_PX = 10;

interface VirtualizedSiteGridProps {
  favorites: Set<string>;
  onFavorite: (siteId: string) => void;
  scrollRef: RefObject<HTMLElement | null>;
  sites: Site[];
}

export function VirtualizedSiteGrid({ favorites, onFavorite, scrollRef, sites }: VirtualizedSiteGridProps) {
  const widthRef = useRef<HTMLDivElement>(null);
  const [contentWidth, setContentWidth] = useState(0);
  const [columns, setColumns] = useState(1);

  useEffect(() => {
    const node = widthRef.current;
    if (!node) return;
    const updateWidth = () => setContentWidth(node.clientWidth);
    const observer = new ResizeObserver(updateWidth);
    observer.observe(node);
    updateWidth();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const updateColumns = () => setColumns(media.matches ? 2 : 1);
    media.addEventListener("change", updateColumns);
    updateColumns();
    return () => media.removeEventListener("change", updateColumns);
  }, []);

  const rowCount = Math.ceil(sites.length / columns);
  const cardWidth = contentWidth ? (contentWidth - FEED_GAP_PX * (columns - 1)) / columns : 500;
  const rowHeight = cardWidth * (18 / 25) + FEED_GAP_PX;
  // TanStack Virtual intentionally owns mutable scroll state; React Compiler skips this isolated component.
  // eslint-disable-next-line react-hooks/incompatible-library
  const virtualizer = useVirtualizer({
    count: rowCount,
    estimateSize: () => rowHeight,
    getScrollElement: () => scrollRef.current,
    overscan: 3,
  });

  useEffect(() => {
    virtualizer.measure();
  }, [rowHeight, virtualizer]);

  return (
    <div className="p-2 sm:p-2.5" ref={widthRef}>
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const rowSites = sites.slice(virtualRow.index * columns, virtualRow.index * columns + columns);
          return (
            <div
              className="absolute left-0 top-0 grid w-full grid-cols-1 gap-[var(--feed-gap)] lg:grid-cols-2"
              data-index={virtualRow.index}
              key={virtualRow.key}
              style={{ transform: `translateY(${virtualRow.start}px)` }}
            >
              {rowSites.map((site, index) => {
                const siteIndex = virtualRow.index * columns + index;
                return (
                  <SiteCard
                    isFavorite={favorites.has(site.id)}
                    key={site.id}
                    onFavorite={onFavorite}
                    priority={siteIndex < 2}
                    site={site}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
