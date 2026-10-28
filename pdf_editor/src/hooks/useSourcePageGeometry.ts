import { useEffect, useState } from 'react';
import type { EditorPage } from '../core/editor/EditorPage';
import type { PdfSource } from '../core/editor/PdfSource';
import {
  SourcePageGeometryReader,
  type SourcePageGeometry,
} from '../core/pdf/SourcePageGeometry';

const geometryReader = new SourcePageGeometryReader();

/**
 * Reads the unrotated size and intrinsic rotation of a page, which the overlay
 * needs in order to place edits in the page's own coordinate space.
 */
export function useSourcePageGeometry(
  source: PdfSource,
  page: EditorPage,
): SourcePageGeometry | null {
  const [geometry, setGeometry] = useState<SourcePageGeometry | null>(null);
  const pageNumber = page.pageNumberInSource();

  useEffect(() => {
    let isSuperseded = false;
    setGeometry(null);
    geometryReader
      .read(source.renderer, pageNumber)
      .then((result) => {
        if (!isSuperseded) {
          setGeometry(result);
        }
      })
      .catch(() => {
        // A page whose geometry cannot be read simply gets no overlay; the
        // renderer reports the underlying problem to the user already.
      });
    return () => {
      isSuperseded = true;
    };
  }, [source, pageNumber]);

  return geometry;
}
