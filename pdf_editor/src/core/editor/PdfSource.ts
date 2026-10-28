import type { PdfJsDocument } from '../pdf/PdfJsRuntime';
import type { SourceId } from './Identifiers';

/**
 * One opened file backing the pages of the edited document.
 *
 * `bytes` is the untouched original, used when exporting; `renderer` is the
 * pdf.js view of the same bytes, used for on-screen previews. Several editor
 * pages may point at the same source, which is what makes duplicating a page
 * and merging files cheap.
 */
export interface PdfSource {
  readonly id: SourceId;
  readonly fileName: string;
  readonly bytes: Uint8Array;
  readonly renderer: PdfJsDocument;
  readonly pageCount: number;
}

/** Releases the pdf.js worker resources held by a source. */
export function closePdfSource(source: PdfSource): void {
  void source.renderer.destroy();
}
