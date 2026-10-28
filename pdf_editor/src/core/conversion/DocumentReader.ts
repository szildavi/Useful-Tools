import type { DocumentContent } from './DocumentContent';

/**
 * Reads one family of file formats into the neutral content model.
 *
 * Implementations do parsing only - they never lay anything out and never touch
 * pdf-lib, which is what keeps one PDF layout engine serving every format.
 */
export abstract class DocumentReader {
  /** Lower-case extensions, without the dot, that this reader handles. */
  abstract readonly supportedExtensions: readonly string[];

  /** Shown to the user, e.g. in the list of accepted formats. */
  abstract readonly formatLabel: string;

  abstract read(file: File): Promise<DocumentContent>;

  handles(extension: string): boolean {
    return this.supportedExtensions.includes(extension.toLowerCase());
  }
}

export class UnsupportedFormatError extends Error {
  readonly extension: string;

  constructor(extension: string) {
    super(
      extension === ''
        ? 'This file has no extension, so its format could not be recognised.'
        : `Files of type ".${extension}" cannot be opened.`,
    );
    this.name = 'UnsupportedFormatError';
    this.extension = extension;
  }
}
