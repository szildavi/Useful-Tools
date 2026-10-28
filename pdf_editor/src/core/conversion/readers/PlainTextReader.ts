import { documentContentOf, type ContentBlock, type DocumentContent } from '../DocumentContent';
import { DocumentReader } from '../DocumentReader';
import { fileNameWithoutExtension } from '../FileFormat';

/**
 * Reads a plain text file, treating blank-line-separated chunks as paragraphs
 * and a leading form feed as a page break.
 */
export class PlainTextReader extends DocumentReader {
  readonly supportedExtensions = ['txt'] as const;
  readonly formatLabel = 'Plain text';

  async read(file: File): Promise<DocumentContent> {
    const text = await file.text();
    return documentContentOf(fileNameWithoutExtension(file.name), toBlocks(text));
  }
}

const FORM_FEED = '\f';

function toBlocks(text: string): ContentBlock[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .flatMap((chunk) => blocksForChunk(chunk))
    .filter((block) => block.kind !== 'paragraph' || block.text.length > 0);
}

/** A chunk may contain form feeds, each of which starts a new page. */
function blocksForChunk(chunk: string): ContentBlock[] {
  const pageChunks = chunk.split(FORM_FEED);
  return pageChunks.flatMap((pageChunk, index) => {
    const paragraph: ContentBlock = { kind: 'paragraph', text: collapseLineBreaks(pageChunk) };
    return index === 0 ? [paragraph] : [{ kind: 'page-break' }, paragraph];
  });
}

/** Single line breaks inside a paragraph become spaces so the text reflows. */
function collapseLineBreaks(chunk: string): string {
  return chunk.replace(/\r?\n/g, ' ').replace(/[ \t]+/g, ' ').trim();
}
