import { useEffect, useState } from 'react';
import type { EditorPage } from '../core/editor/EditorPage';
import type { PdfSource } from '../core/editor/PdfSource';
import { PdfTextExtractor } from '../core/pdf/PdfTextExtractor';
import { TextLineGrouper, type TextLine } from '../core/pdf/TextLineGrouper';

const textExtractor = new PdfTextExtractor();
const lineGrouper = new TextLineGrouper();

/**
 * The lines of existing text on a page, so the user can click one and retype it.
 *
 * Only read when the text tool needs it, because extracting text is more
 * expensive than rendering the page image.
 */
export function usePageTextLines(
  source: PdfSource,
  page: EditorPage,
  isNeeded: boolean,
): readonly TextLine[] {
  const [lines, setLines] = useState<readonly TextLine[]>([]);
  const pageNumber = page.pageNumberInSource();

  useEffect(() => {
    if (!isNeeded) {
      return;
    }
    let isSuperseded = false;
    textExtractor
      .extractPageText(source.renderer, pageNumber)
      .then((pageText) => {
        if (!isSuperseded) {
          setLines(lineGrouper.group(pageText));
        }
      })
      .catch(() => {
        if (!isSuperseded) {
          setLines([]);
        }
      });
    return () => {
      isSuperseded = true;
    };
  }, [source, pageNumber, isNeeded]);

  return lines;
}
