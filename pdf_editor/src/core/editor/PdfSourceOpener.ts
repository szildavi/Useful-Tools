import { PdfDocumentLoader } from '../pdf/PdfDocumentLoader';
import { createSourceId } from './Identifiers';
import type { PdfSource } from './PdfSource';

/**
 * Turns a file the user picked into a source the editor can use.
 *
 * The file is read into memory in the browser and never sent anywhere.
 */
export class PdfSourceOpener {
  private readonly loader = new PdfDocumentLoader();

  async open(file: File, password?: string): Promise<PdfSource> {
    const bytes = new Uint8Array(await file.arrayBuffer());
    return this.openBytes(bytes, file.name, password);
  }

  async openBytes(bytes: Uint8Array, fileName: string, password?: string): Promise<PdfSource> {
    const renderer = await this.loader.load(bytes, password);
    return {
      id: createSourceId(),
      fileName,
      bytes,
      renderer,
      pageCount: renderer.numPages,
    };
  }
}
