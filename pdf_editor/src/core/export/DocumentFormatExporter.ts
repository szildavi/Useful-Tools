import type { EditorDocument } from '../editor/EditorDocument';
import { fileNameWithoutExtension } from '../conversion/FileFormat';
import {
  DOCX_MIME_TYPE,
  PDF_MIME_TYPE,
  PLAIN_TEXT_MIME_TYPE,
  ZIP_MIME_TYPE,
} from './FileDownloader';
import {
  imageMimeTypeFor,
  PageImageExporter,
  type ImageFormat,
  type ImageResolution,
} from './PageImageExporter';
import type { ExportedFile } from './PdfExporter';
import { PdfExporter } from './PdfExporter';
import { PdfTextReader, type PageTextContent } from './PdfTextReader';
import { ZipArchiveWriter } from './ZipArchiveWriter';

/** The formats the edited document can be saved as. */
export type ExportFormat = 'pdf' | 'txt' | 'docx' | ImageFormat;

export interface ExportFormatDescription {
  readonly format: ExportFormat;
  readonly label: string;
  readonly extension: string;
  readonly note: string;
}

export const EXPORT_FORMATS: readonly ExportFormatDescription[] = [
  {
    format: 'pdf',
    label: 'PDF',
    extension: 'pdf',
    note: 'Keeps every page exactly as it looks, with your edits applied.',
  },
  {
    format: 'png',
    label: 'PNG images',
    extension: 'png',
    note: 'One sharp image per page, with your edits. Several pages arrive as a zip.',
  },
  {
    format: 'jpg',
    label: 'JPG images',
    extension: 'jpg',
    note: 'One image per page, smaller files than PNG but slightly softer.',
  },
  {
    format: 'txt',
    label: 'Plain text',
    extension: 'txt',
    note: 'The wording only. Layout, images and formatting are not kept.',
  },
  {
    format: 'docx',
    label: 'Word document',
    extension: 'docx',
    note: 'Editable paragraphs of text. Layout and images are not kept.',
  },
];

export function isImageFormat(format: ExportFormat): format is ImageFormat {
  return format === 'png' || format === 'jpg';
}

/**
 * The type a saved file is served as. Image formats fall back to zip when the
 * document had more than one page, which is why the exported file is consulted
 * rather than the requested format alone.
 */
export function mimeTypeOf(exported: ExportedFile, format: ExportFormat): string {
  if (exported.fileName.endsWith('.zip')) {
    return ZIP_MIME_TYPE;
  }
  if (isImageFormat(format)) {
    return imageMimeTypeFor(format);
  }
  switch (format) {
    case 'txt':
      return PLAIN_TEXT_MIME_TYPE;
    case 'docx':
      return DOCX_MIME_TYPE;
    default:
      return PDF_MIME_TYPE;
  }
}

/**
 * Saves the edited document in whichever format the user asked for.
 *
 * PDF is a true export of the pages; text and Word carry the wording across,
 * including the user's replacements and added text, but not the page layout.
 */
export class DocumentFormatExporter {
  private readonly pdfExporter = new PdfExporter();
  private readonly textReader = new PdfTextReader();
  private readonly imageExporter = new PageImageExporter();
  private readonly archiveWriter = new ZipArchiveWriter();

  async export(
    document: EditorDocument,
    fileName: string,
    format: ExportFormat,
    imageResolution: ImageResolution = 'print',
  ): Promise<ExportedFile> {
    const baseName = fileNameWithoutExtension(fileName);

    if (format === 'pdf') {
      return this.pdfExporter.export(document, fileName);
    }
    if (isImageFormat(format)) {
      return this.toImages(document, fileName, baseName, format, imageResolution);
    }

    const pages = await this.textReader.readDocument(document);
    return format === 'txt' ? toPlainTextFile(pages, baseName) : toWordFile(pages, baseName);
  }

  /**
   * Images are rendered from the exported PDF, so every edit that the PDF shows
   * appears in them as well.
   */
  private async toImages(
    document: EditorDocument,
    fileName: string,
    baseName: string,
    format: ImageFormat,
    resolution: ImageResolution,
  ): Promise<ExportedFile> {
    const exportedPdf = await this.pdfExporter.export(document, fileName);
    const images = await this.imageExporter.export(exportedPdf, format, resolution);
    return this.archiveWriter.bundleIfSeveral(images, `${baseName}-${format}.zip`);
  }
}

function toPlainTextFile(pages: readonly PageTextContent[], baseName: string): ExportedFile {
  const text = pages
    .map((page) => `--- Page ${page.pageNumber} ---\n\n${page.paragraphs.join('\n\n')}`)
    .join('\n\n');
  return {
    bytes: new TextEncoder().encode(text),
    fileName: `${baseName}.txt`,
  };
}

async function toWordFile(
  pages: readonly PageTextContent[],
  baseName: string,
): Promise<ExportedFile> {
  // The Word writer is fetched only when saving as Word.
  const { Document, Packer, Paragraph, TextRun } = await import('docx');

  const paragraphs = pages.flatMap((page, index) => [
    // Every page after the first starts on a new page in Word too.
    new Paragraph({
      children: [new TextRun({ text: `Page ${page.pageNumber}`, bold: true })],
      pageBreakBefore: index > 0,
      spacing: { after: 200 },
    }),
    ...page.paragraphs.map(
      (text) => new Paragraph({ children: [new TextRun(text)], spacing: { after: 140 } }),
    ),
  ]);

  const wordDocument = new Document({ sections: [{ children: paragraphs }] });
  const blob = await Packer.toBlob(wordDocument);
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    fileName: `${baseName}.docx`,
  };
}
