import type { PdfJsDocument } from './PdfJsRuntime';

/**
 * The one place that reaches past pdf.js's published types.
 *
 * The loaded font objects carry the weight and slant of each font, which the
 * text tool needs to match the style of text it replaces, but they are not part
 * of the typed API. Confining the cast here keeps the rest of the code honest
 * and gives a single place to revisit if pdf.js changes.
 */
export interface LoadedPdfFont {
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly black?: boolean;
}

export interface LoadedFontStore {
  has?: (name: string) => boolean;
  get: (name: string) => LoadedPdfFont | undefined;
}

export type PdfJsPageWithFonts = Awaited<ReturnType<PdfJsDocument['getPage']>> & {
  readonly commonObjs?: LoadedFontStore;
};
