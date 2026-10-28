import { PDFDocument } from 'pdf-lib';
import { PdfFontProvider } from '../../export/PdfFontProvider';
import type { DocumentContent } from '../DocumentContent';
import { ContentBlockRendererRegistry } from './ContentBlockRenderers';
import { Typography } from './ContentTypography';
import { A4_PORTRAIT, PageLayoutCursor, type PageLayoutOptions } from './PageLayoutCursor';

/**
 * Turns the neutral content model into a PDF file.
 *
 * This is the only place that lays out generated PDFs, so every source format -
 * text, Word, spreadsheets, presentations - comes out looking consistent.
 */
export class PdfContentRenderer {
  private readonly blockRenderers = new ContentBlockRendererRegistry();

  async render(
    content: DocumentContent,
    layout: PageLayoutOptions = A4_PORTRAIT,
  ): Promise<Uint8Array> {
    const document = await PDFDocument.create();
    document.setTitle(content.title);
    document.setCreator('PDF Editor');

    const context = {
      cursor: new PageLayoutCursor(document, layout),
      fonts: new PdfFontProvider(document),
    };

    for (const block of content.blocks) {
      context.cursor.skip(Typography.spacingBefore(block));
      await this.blockRenderers.render(block, context);
      context.cursor.skip(Typography.spacingAfter(block));
    }

    return document.save();
  }
}
