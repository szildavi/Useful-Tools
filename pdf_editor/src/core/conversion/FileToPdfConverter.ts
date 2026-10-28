import { DocumentReader, UnsupportedFormatError } from './DocumentReader';
import { extensionOf, fileNameWithoutExtension } from './FileFormat';
import { OpenDocumentTextReader } from './readers/OpenDocumentTextReader';
import { PlainTextReader } from './readers/PlainTextReader';
import { PresentationReader } from './readers/PresentationReader';
import { SpreadsheetReader } from './readers/SpreadsheetReader';
import { WordDocumentReader } from './readers/WordDocumentReader';
import { PdfContentRenderer } from './rendering/PdfContentRenderer';

export interface ConvertedPdf {
  readonly bytes: Uint8Array;
  readonly fileName: string;
}

/**
 * Converts a non-PDF file into PDF bytes the editor can open.
 *
 * Reading and rendering are deliberately separate: a reader turns a format into
 * the neutral content model, and one renderer turns that model into a PDF. New
 * input formats therefore only need a reader.
 */
export class FileToPdfConverter {
  private readonly readers: readonly DocumentReader[];
  private readonly renderer = new PdfContentRenderer();

  constructor(readers: readonly DocumentReader[] = defaultReaders()) {
    this.readers = readers;
  }

  supportedExtensions(): string[] {
    return this.readers.flatMap((reader) => [...reader.supportedExtensions]);
  }

  canConvert(fileName: string): boolean {
    return this.readerFor(fileName) !== undefined;
  }

  async convert(file: File): Promise<ConvertedPdf> {
    const reader = this.readerFor(file.name);
    if (!reader) {
      throw new UnsupportedFormatError(extensionOf(file.name));
    }
    const content = await reader.read(file);
    return {
      bytes: await this.renderer.render(content),
      fileName: `${fileNameWithoutExtension(file.name)}.pdf`,
    };
  }

  private readerFor(fileName: string): DocumentReader | undefined {
    const extension = extensionOf(fileName);
    return this.readers.find((reader) => reader.handles(extension));
  }
}

function defaultReaders(): DocumentReader[] {
  return [
    new PlainTextReader(),
    new WordDocumentReader(),
    new OpenDocumentTextReader(),
    new SpreadsheetReader(),
    new PresentationReader(),
  ];
}
