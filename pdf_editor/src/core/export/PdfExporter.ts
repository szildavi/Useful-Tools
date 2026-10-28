import { PDFDocument, degrees, type PDFPage } from 'pdf-lib';
import type { EditorDocument } from '../editor/EditorDocument';
import type { EditorPage } from '../editor/EditorPage';
import type { SourceId } from '../editor/Identifiers';
import { normalizeRotation } from '../pdf/PageRotation';
import { AnnotationPainterRegistry } from './AnnotationPainter';
import { PdfFontProvider } from './PdfFontProvider';

export interface ExportedFile {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

export class EmptyDocumentError extends Error {
  constructor() {
    super('There are no pages to export.');
    this.name = 'EmptyDocumentError';
  }
}

/**
 * Builds a real PDF file out of the edited document.
 *
 * Pages are copied from their original files, so untouched pages keep their
 * exact original content, fonts and quality. Only the user's own edits are
 * drawn on top.
 */
export class PdfExporter {
  private readonly painters = new AnnotationPainterRegistry();

  async export(document: EditorDocument, fileName: string): Promise<ExportedFile> {
    if (document.isEmpty()) {
      throw new EmptyDocumentError();
    }
    const outputDocument = await PDFDocument.create();
    const fonts = new PdfFontProvider(outputDocument);
    const sourceDocuments = new SourceDocumentCache(document);

    for (const page of document.pages) {
      const copiedPage = await this.copyPageInto(outputDocument, sourceDocuments, page);
      outputDocument.addPage(copiedPage);
      await this.paintEditsOnto(copiedPage, page, fonts);
    }

    return {
      bytes: await outputDocument.save(),
      fileName: ensurePdfExtension(fileName),
    };
  }

  private async copyPageInto(
    outputDocument: PDFDocument,
    sourceDocuments: SourceDocumentCache,
    page: EditorPage,
  ): Promise<PDFPage> {
    const sourceDocument = await sourceDocuments.documentFor(page.sourceId);
    const [copiedPage] = await outputDocument.copyPages(sourceDocument, [page.sourcePageIndex]);
    this.applyRotationTo(copiedPage, page);
    return copiedPage;
  }

  /**
   * The user's rotation is added to whatever rotation the page already carried,
   * matching how the page is shown in the editor.
   */
  private applyRotationTo(copiedPage: PDFPage, page: EditorPage): void {
    if (page.rotation === 0) {
      return;
    }
    const intrinsicRotation = copiedPage.getRotation().angle;
    copiedPage.setRotation(degrees(normalizeRotation(intrinsicRotation + page.rotation)));
  }

  /**
   * Annotations are stored in the page's unrotated coordinate space, which is
   * exactly the space a PDF content stream draws in, so they can be painted
   * without any conversion and will rotate along with the page.
   */
  private async paintEditsOnto(
    copiedPage: PDFPage,
    page: EditorPage,
    fonts: PdfFontProvider,
  ): Promise<void> {
    for (const annotation of page.annotations) {
      await this.painters.paintOnto(annotation, copiedPage, fonts);
    }
  }
}

/** Loads each source file into pdf-lib once, however many pages reference it. */
class SourceDocumentCache {
  private readonly editorDocument: EditorDocument;
  private readonly loadedBySourceId = new Map<SourceId, PDFDocument>();

  constructor(editorDocument: EditorDocument) {
    this.editorDocument = editorDocument;
  }

  async documentFor(sourceId: SourceId): Promise<PDFDocument> {
    const alreadyLoaded = this.loadedBySourceId.get(sourceId);
    if (alreadyLoaded) {
      return alreadyLoaded;
    }
    const source = this.editorDocument.sources.get(sourceId);
    if (!source) {
      throw new Error('A page refers to a file that is no longer open.');
    }
    const loaded = await PDFDocument.load(source.bytes, { ignoreEncryption: true });
    this.loadedBySourceId.set(sourceId, loaded);
    return loaded;
  }
}

export function ensurePdfExtension(fileName: string): string {
  return fileName.toLowerCase().endsWith('.pdf') ? fileName : `${fileName}.pdf`;
}
