"use client";

import { useEffect, useRef, useState, type RefCallback } from "react";

interface UseInfiniteScrollOptions {
  cursor?: string;
  disabled?: boolean;
  onLoadMore: () => void;
}

/** Observes the pagination boundary while preserving the adjacent button as the keyboard fallback. */
export function useInfiniteScroll({
  cursor,
  disabled = false,
  onLoadMore,
}: UseInfiniteScrollOptions): RefCallback<HTMLElement> {
  const [target, setTarget] = useState<HTMLElement | null>(null);
  const onLoadMoreRef = useRef(onLoadMore);

  useEffect(() => {
    onLoadMoreRef.current = onLoadMore;
  }, [onLoadMore]);

  useEffect(() => {
    if (!target || !cursor || disabled || typeof window === "undefined" || !window.IntersectionObserver) return;

    let requested = false;
    const observer = new window.IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || requested) return;
        requested = true;
        onLoadMoreRef.current();
      },
      { rootMargin: "320px 0px" },
    );

    observer.observe(target);
    return () => observer.disconnect();
  }, [cursor, disabled, target]);

  return setTarget;
}
