import { FileToPdfConverter } from '../conversion/FileToPdfConverter';
import { UnsupportedFormatError } from '../conversion/DocumentReader';
import { extensionOf, isPdfFileName } from '../conversion/FileFormat';
import type { PdfSource } from './PdfSource';
import { PdfSourceOpener } from './PdfSourceOpener';

/**
 * The single entry point for getting a user's file into the editor.
 *
 * PDFs are opened as they are; anything else is converted to PDF first. Callers
 * therefore never have to care which format the user picked.
 */
export class FileOpeningService {
  private readonly opener = new PdfSourceOpener();
  private readonly converter = new FileToPdfConverter();

  acceptedExtensions(): string[] {
    return ['pdf', ...this.converter.supportedExtensions()];
  }

  acceptAttributeValue(): string {
    return this.acceptedExtensions()
      .map((extension) => `.${extension}`)
      .join(',');
  }

  async open(file: File): Promise<PdfSource> {
    if (isPdfFileName(file.name)) {
      return this.opener.open(file);
    }
    if (!this.converter.canConvert(file.name)) {
      throw new UnsupportedFormatError(extensionOf(file.name));
    }
    const converted = await this.converter.convert(file);
    return this.opener.openBytes(converted.bytes, converted.fileName);
  }
}
