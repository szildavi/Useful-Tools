import { documentContentOf, type DocumentContent } from '../DocumentContent';
import { DocumentReader } from '../DocumentReader';
import { fileNameWithoutExtension } from '../FileFormat';
import { HtmlToContentBlocks } from './HtmlToContentBlocks';

/**
 * Reads a Word document by way of the HTML that mammoth produces.
 *
 * mammoth maps Word's styles onto semantic HTML, which gives headings, lists
 * and tables rather than a flat wall of text. Exact page layout, positioned
 * objects and images are not carried over - faithfully reproducing those needs a
 * full word processor, which this browser-only editor deliberately does without.
 */
export class WordDocumentReader extends DocumentReader {
  readonly supportedExtensions = ['docx'] as const;
  readonly formatLabel = 'Word document';

  private readonly htmlConverter = new HtmlToContentBlocks();

  async read(file: File): Promise<DocumentContent> {
    // Loaded only when a Word file is actually opened, so its size is not part
    // of the app's initial download.
    const { convertToHtml } = await import('mammoth');
    const { value: html } = await convertToHtml({ arrayBuffer: await file.arrayBuffer() });
    return documentContentOf(
      fileNameWithoutExtension(file.name),
      this.htmlConverter.convert(html),
    );
  }
}
