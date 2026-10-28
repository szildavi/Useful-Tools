import type { EditorDocument } from '../editor/EditorDocument';
import { fileNameWithoutExtension } from '../conversion/FileFormat';
import { PdfExporter, type ExportedFile } from './PdfExporter';
import type { SplitStrategy } from './SplitStrategy';
import { ZipArchiveWriter } from './ZipArchiveWriter';

/**
 * Splits a document into several PDFs according to a strategy.
 *
 * A single output file is handed back as it is; several are bundled into one zip
 * so the user gets one download instead of many.
 */
export class DocumentSplitter {
  private readonly exporter = new PdfExporter();
  private readonly archiveWriter = new ZipArchiveWriter();

  async split(
    document: EditorDocument,
    strategy: SplitStrategy,
    baseFileName: string,
  ): Promise<ExportedFile> {
    const groups = strategy.groupsOf(document);
    if (groups.length === 0) {
      throw new Error('This way of splitting produced no files.');
    }

    const baseName = fileNameWithoutExtension(baseFileName);
    const files = await Promise.all(
      groups.map((group) =>
        this.exporter.export(document.selection(group.pageIds), `${baseName}-${group.nameSuffix}`),
      ),
    );

    return this.archiveWriter.bundleIfSeveral(files, `${baseName}-split.zip`);
  }
}
