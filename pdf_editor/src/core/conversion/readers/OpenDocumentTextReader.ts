import {
  documentContentOf,
  type ContentBlock,
  type DocumentContent,
  type HeadingBlock,
} from '../DocumentContent';
import { DocumentReader } from '../DocumentReader';
import { fileNameWithoutExtension } from '../FileFormat';
import {
  attributeByLocalName,
  elementsByLocalName,
  localNameOf,
  ZippedXmlDocument,
} from './ZippedXmlDocument';

const CONTENT_PART = 'content.xml';

/**
 * Reads an OpenDocument text file by walking the body of `content.xml`.
 *
 * ODF marks up headings, paragraphs and lists explicitly, so the structure comes
 * across directly without needing a style mapping.
 */
export class OpenDocumentTextReader extends DocumentReader {
  readonly supportedExtensions = ['odt'] as const;
  readonly formatLabel = 'OpenDocument text';

  async read(file: File): Promise<DocumentContent> {
    const archive = await ZippedXmlDocument.open(file);
    const content = await archive.parsePart(CONTENT_PART);
    if (!content) {
      throw new Error(`The text content of "${file.name}" could not be read.`);
    }
    const body = elementsByLocalName(content, 'text')[0];
    const blocks = body ? [...body.children].flatMap((element) => blocksFor(element)) : [];
    return documentContentOf(fileNameWithoutExtension(file.name), blocks);
  }
}

function blocksFor(element: Element): ContentBlock[] {
  switch (localNameOf(element)) {
    case 'h':
      return headingBlocks(element);
    case 'p':
      return paragraphBlocks(element);
    case 'list':
      return listBlocks(element);
    case 'table':
      return tableBlocks(element);
    case 'section':
      return [...element.children].flatMap(blocksFor);
    default:
      return [];
  }
}

function headingBlocks(element: Element): ContentBlock[] {
  const text = textOf(element);
  if (!text) {
    return [];
  }
  const outlineLevel = Number(attributeByLocalName(element, 'outline-level') ?? '1');
  return [{ kind: 'heading', level: clampHeadingLevel(outlineLevel), text }];
}

function paragraphBlocks(element: Element): ContentBlock[] {
  const text = textOf(element);
  return text ? [{ kind: 'paragraph', text }] : [];
}

/** ODF nests each item's text in a paragraph inside `text:list-item`. */
function listBlocks(element: Element): ContentBlock[] {
  const items = elementsByLocalName(element, 'list-item')
    .map((item) => textOf(item))
    .filter((text) => text.length > 0);
  return items.length > 0 ? [{ kind: 'list', items, isNumbered: false }] : [];
}

function tableBlocks(element: Element): ContentBlock[] {
  const rows = elementsByLocalName(element, 'table-row').map((row) =>
    elementsByLocalName(row, 'table-cell').flatMap((cell) => repeatedCellText(cell)),
  );
  const filledRows = rows.filter((row) => row.some((cell) => cell.length > 0));
  if (filledRows.length === 0) {
    return [];
  }
  return [{ kind: 'table', rows: filledRows, hasHeaderRow: true }];
}

/** A cell may stand in for several identical columns. */
function repeatedCellText(cell: Element): string[] {
  const repeatCount = Number(attributeByLocalName(cell, 'number-columns-repeated') ?? '1');
  const text = textOf(cell);
  // A large repeat count is padding at the end of a row, not real data.
  const safeRepeatCount = Math.min(Math.max(repeatCount, 1), 16);
  return Array.from({ length: safeRepeatCount }, () => text);
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

function clampHeadingLevel(level: number): HeadingBlock['level'] {
  if (level <= 1) {
    return 1;
  }
  return level === 2 ? 2 : 3;
}
