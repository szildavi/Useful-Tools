import { useCallback, useEffect, useState, type RefObject } from 'react';

export interface ElementSize {
  readonly widthInPixels: number;
  readonly heightInPixels: number;
}

/**
 * Reports an element's size and keeps it up to date as the window or layout
 * changes, so the page can be rendered to exactly the space available.
 */
export function useElementSize<TElement extends HTMLElement>(
  elementRef: RefObject<TElement | null>,
): ElementSize {
  const [size, setSize] = useState<ElementSize>({ widthInPixels: 0, heightInPixels: 0 });

  const measure = useCallback(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const { width, height } = element.getBoundingClientRect();
    setSize((current) =>
      // Rounding avoids a re-render storm from sub-pixel changes.
      Math.round(current.widthInPixels) === Math.round(width) &&
      Math.round(current.heightInPixels) === Math.round(height)
        ? current
        : { widthInPixels: width, heightInPixels: height },
    );
  }, [elementRef]);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [elementRef, measure]);

  return size;
}
