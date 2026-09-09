"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface VirtualRowsOptions {
  /** Total rows the list would render unwindowed. */
  count: number;
  /**
   * Height of one row in pixels, or a per-row array when the rows differ — the
   * grouped list interleaves 36px headers with 38px rows.
   */
  rowHeight: number | number[];
  /** Rows drawn above and below the viewport so a fast scroll does not show gaps. */
  overscan?: number;
  /** Below this many rows the cost of windowing exceeds the cost of rendering. */
  threshold?: number;
}

interface VirtualRows {
  /** Attach to the element that scrolls. */
  scrollRef: React.RefObject<HTMLDivElement | null>;
  /** Index of the first row to render, inclusive. */
  start: number;
  /** Index one past the last row to render. */
  end: number;
  /** Spacer height above the rendered slice. */
  paddingTop: number;
  /** Spacer height below the rendered slice. */
  paddingBottom: number;
  /** False below the threshold, when every row is rendered. */
  enabled: boolean;
}

/**
 * Fixed-height row windowing.
 *
 * Written by hand rather than pulled from a library because the dependency set
 * in docs/03-TRD.md is closed and this is the whole of what the two flat,
 * fixed-height layouts need: every row is exactly one height, so which rows are
 * on screen is arithmetic on scrollTop rather than a measurement problem.
 *
 * Below `threshold` rows it disables itself and reports the full range. Two
 * hundred DOM nodes are cheaper than the scroll handler that would avoid them,
 * and a list that windows at twenty rows is a list where Cmd+F finds nothing.
 */
export function useVirtualRows({
  count,
  rowHeight,
  overscan = 8,
  threshold = 100,
}: VirtualRowsOptions): VirtualRows {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const enabled = count > threshold;

  const measure = useCallback(() => {
    const element = scrollRef.current;
    if (!element) return;
    setScrollTop(element.scrollTop);
    setViewportHeight(element.clientHeight);
  }, []);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element || !enabled) return;

    measure();

    // Passive: this handler only reads, so the browser never has to wait on it
    // before painting the scroll.
    element.addEventListener("scroll", measure, { passive: true });

    const observer = new ResizeObserver(measure);
    observer.observe(element);

    return () => {
      element.removeEventListener("scroll", measure);
      observer.disconnect();
    };
  }, [enabled, measure]);

  // Prefix sums, so a variable-height list can answer "which row is at this
  // scroll offset" by binary search rather than by measuring the DOM.
  const offsets = useMemo(() => {
    if (typeof rowHeight === "number") return null;
    const sums = new Array<number>(rowHeight.length + 1);
    sums[0] = 0;
    for (let i = 0; i < rowHeight.length; i += 1) {
      sums[i + 1] = sums[i] + rowHeight[i];
    }
    return sums;
  }, [rowHeight]);

  return useMemo(() => {
    if (!enabled) {
      return {
        scrollRef,
        start: 0,
        end: count,
        paddingTop: 0,
        paddingBottom: 0,
        enabled: false,
      };
    }

    // A viewport of zero means the element has not been measured yet; drawing
    // one screen's worth is better than drawing nothing on the first paint.
    const height = viewportHeight || 600;

    if (offsets) {
      const total = offsets[count];
      const findIndex = (offset: number): number => {
        let low = 0;
        let high = count;
        while (low < high) {
          const mid = (low + high) >> 1;
          if (offsets[mid + 1] <= offset) low = mid + 1;
          else high = mid;
        }
        return low;
      };

      const first = Math.max(0, findIndex(scrollTop) - overscan);
      const last = Math.min(
        count,
        findIndex(scrollTop + height) + 1 + overscan,
      );

      return {
        scrollRef,
        start: first,
        end: last,
        paddingTop: offsets[first],
        paddingBottom: Math.max(0, total - offsets[last]),
        enabled: true,
      };
    }

    const fixed = typeof rowHeight === "number" ? rowHeight : 1;
    const first = Math.max(0, Math.floor(scrollTop / fixed) - overscan);
    const visible = Math.ceil(height / fixed) + overscan * 2;
    const last = Math.min(count, first + visible);

    return {
      scrollRef,
      start: first,
      end: last,
      paddingTop: first * fixed,
      paddingBottom: Math.max(0, (count - last) * fixed),
      enabled: true,
    };
  }, [count, enabled, offsets, overscan, rowHeight, scrollTop, viewportHeight]);
}
