import * as pdfJs from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

/**
 * pdf.js needs its worker script registered once before any document is opened.
 * The worker is bundled with the app, so opening a file never triggers a network
 * request - a hard requirement of the privacy-first design.
 */
let workerIsRegistered = false;

export function getConfiguredPdfJs(): typeof pdfJs {
  if (!workerIsRegistered) {
    pdfJs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;
    workerIsRegistered = true;
  }
  return pdfJs;
}

/**
 * Locations of the support files pdf.js loads on demand: character maps for
 * CJK encodings, the fourteen standard PDF fonts, the WebAssembly image
 * decoders and the predefined colour profiles.
 *
 * pdf.js would otherwise fetch these from a public CDN. Serving them from the
 * app's own origin is what makes the editor work offline and keeps the fact
 * that a document uses, say, a Japanese font from ever leaving the machine.
 */
export const PDF_JS_ASSET_URLS = {
  cMapUrl: `${import.meta.env.BASE_URL}pdfjs/cmaps/`,
  standardFontDataUrl: `${import.meta.env.BASE_URL}pdfjs/standard_fonts/`,
  wasmUrl: `${import.meta.env.BASE_URL}pdfjs/wasm/`,
  iccUrl: `${import.meta.env.BASE_URL}pdfjs/iccs/`,
} as const;

export type PdfJsDocument = pdfJs.PDFDocumentProxy;
