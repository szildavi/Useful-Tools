import type { ExportedFile } from './PdfExporter';

/**
 * Bundles several generated files into one zip, so the user gets a single
 * download instead of one per page.
 *
 * Used by both splitting and image export, which is why it lives on its own.
 */
export class ZipArchiveWriter {
  async bundle(
    files: readonly ExportedFile[],
    zipFileName: string,
  ): Promise<ExportedFile> {
    // Fetched only when a zip is actually needed.
    const { default: JSZip } = await import('jszip');
    const archive = new JSZip();
    for (const file of files) {
      archive.file(file.fileName, file.bytes);
    }
    return {
      bytes: await archive.generateAsync({ type: 'uint8array' }),
      fileName: zipFileName,
    };
  }

  /** One file needs no archive; several do. */
  async bundleIfSeveral(
    files: readonly ExportedFile[],
    zipFileName: string,
  ): Promise<ExportedFile> {
    if (files.length === 0) {
      throw new Error('There was nothing to save.');
    }
    return files.length === 1 ? files[0] : this.bundle(files, zipFileName);
  }
}
