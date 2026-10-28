import { getConfiguredPdfJs, PDF_JS_ASSET_URLS, type PdfJsDocument } from './PdfJsRuntime';

/** Thrown when a file cannot be opened as a PDF, including password-protected files. */
export class PdfLoadError extends Error {
  readonly requiresPassword: boolean;

  constructor(message: string, requiresPassword: boolean = false) {
    super(message);
    this.name = 'PdfLoadError';
    this.requiresPassword = requiresPassword;
  }
}

/**
 * Opens raw PDF bytes with pdf.js so pages can be rendered and read.
 *
 * pdf.js takes ownership of (and detaches) the buffer it is given, while the
 * editor keeps its own copy for exporting. Every load therefore works on a
 * private copy of the bytes.
 */
export class PdfDocumentLoader {
  async load(bytes: Uint8Array, password?: string): Promise<PdfJsDocument> {
    const pdfJs = getConfiguredPdfJs();
    try {
      return await pdfJs.getDocument({
        data: copyOf(bytes),
        password,
        ...PDF_JS_ASSET_URLS,
      }).promise;
    } catch (cause) {
      throw asPdfLoadError(cause);
    }
  }
}

function copyOf(bytes: Uint8Array): Uint8Array {
  return new Uint8Array(bytes);
}

function asPdfLoadError(cause: unknown): PdfLoadError {
  const name = (cause as { name?: string })?.name;
  if (name === 'PasswordException') {
    return new PdfLoadError('This PDF is password protected.', true);
  }
  const message = cause instanceof Error ? cause.message : 'Unknown error';
  return new PdfLoadError(`The file could not be opened as a PDF: ${message}`);
}
