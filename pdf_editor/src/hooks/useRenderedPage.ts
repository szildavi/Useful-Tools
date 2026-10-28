import { useEffect, useRef, useState } from 'react';
import type { EditorPage } from '../core/editor/EditorPage';
import type { PdfSource } from '../core/editor/PdfSource';
import {
  PdfPageRenderer,
  releaseRenderedPage,
  type RenderedPage,
} from '../core/pdf/PdfPageRenderer';
import { RenderQueue } from '../core/pdf/RenderQueue';

const renderer = new PdfPageRenderer();

/**
 * One queue for the whole app: pages share a single pdf.js worker, so letting
 * every mounted thumbnail render at once only makes them all slower.
 */
const renderQueue = new RenderQueue(3);

/** Rendering above twice the CSS resolution costs memory without looking better. */
const MAXIMUM_PIXEL_RATIO = 2;

export interface RenderedPageState {
  readonly rendered: RenderedPage | null;
  readonly isRendering: boolean;
  readonly errorMessage: string | null;
}

/**
 * Renders a page so that it fits the given area whole, and keeps it in sync with
 * the page's rotation.
 *
 * The area is given in CSS pixels and rendered at the screen's pixel density, so
 * pages stay sharp on high-resolution displays.
 *
 * The previous image stays on screen until the new one is ready, so changing
 * rotation or zoom does not flash. Each image is released exactly once - when it
 * is replaced, when a superseded render arrives late, or on unmount - so
 * browsing a long document does not leak memory.
 *
 * Only the properties that affect the raster are watched. Adding an annotation
 * produces a new page instance but must not trigger a re-render of the page
 * image, because annotations are drawn as an overlay.
 */
export function useRenderedPage(
  source: PdfSource,
  page: EditorPage,
  areaWidthInCssPixels: number,
  areaHeightInCssPixels: number,
): RenderedPageState {
  const [rendered, setRendered] = useState<RenderedPage | null>(null);
  const [isRendering, setIsRendering] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const displayedPage = useRef<RenderedPage | null>(null);

  const pageNumber = page.pageNumberInSource();
  const { rotation } = page;

  useEffect(() => {
    let isSuperseded = false;
    setIsRendering(true);

    const pixelRatio = Math.min(window.devicePixelRatio || 1, MAXIMUM_PIXEL_RATIO);
    const box = {
      maxWidthInPixels: areaWidthInCssPixels * pixelRatio,
      maxHeightInPixels: areaHeightInCssPixels * pixelRatio,
    };

    renderQueue
      .enqueue(() => renderer.renderPageWithinBox(source.renderer, pageNumber, box, rotation))
      .then((result) => {
        if (isSuperseded) {
          releaseRenderedPage(result);
          return;
        }
        if (displayedPage.current) {
          releaseRenderedPage(displayedPage.current);
        }
        displayedPage.current = result;
        setRendered(result);
        setErrorMessage(null);
      })
      .catch((failure: unknown) => {
        if (!isSuperseded) {
          setErrorMessage(
            failure instanceof Error ? failure.message : 'This page could not be shown.',
          );
        }
      })
      .finally(() => {
        if (!isSuperseded) {
          setIsRendering(false);
        }
      });

    return () => {
      isSuperseded = true;
    };
  }, [source, pageNumber, rotation, areaWidthInCssPixels, areaHeightInCssPixels]);

  useEffect(() => {
    return () => {
      if (displayedPage.current) {
        releaseRenderedPage(displayedPage.current);
        displayedPage.current = null;
      }
    };
  }, []);

  return { rendered, isRendering, errorMessage };
}
