import {
  documentContentOf,
  type ContentBlock,
  type DocumentContent,
} from '../DocumentContent';
import { DocumentReader } from '../DocumentReader';
import { fileNameWithoutExtension } from '../FileFormat';
import {
  attributeByLocalName,
  childrenByLocalName,
  elementsByLocalName,
  numberInPath,
  ZippedXmlDocument,
} from './ZippedXmlDocument';

/** A sheet with more columns than this is almost certainly padding. */
const MAXIMUM_COLUMNS = 24;
/** Guards against a spreadsheet producing a thousand-page PDF. */
const MAXIMUM_ROWS_PER_SHEET = 500;

interface Sheet {
  readonly name: string;
  readonly rows: readonly (readonly string[])[];
}

/**
 * Reads spreadsheets and renders each sheet as a table.
 *
 * Excel and OpenDocument spreadsheets are read directly from their XML rather
 * than through a spreadsheet library: the widely used one on npm ships with
 * unpatched security advisories, and this app parses files the user may not
 * trust. Cell *values* are read as displayed text; formulas are represented by
 * their last computed result, which is what the file stores.
 */
export class SpreadsheetReader extends DocumentReader {
  readonly supportedExtensions = ['xlsx', 'ods'] as const;
  readonly formatLabel = 'Spreadsheet';

  async read(file: File): Promise<DocumentContent> {
    const archive = await ZippedXmlDocument.open(file);
    const sheets = archive.hasPart('content.xml')
      ? await readOpenDocumentSheets(archive)
      : await readExcelSheets(archive);

    if (sheets.length === 0) {
      throw new Error(`No readable sheets were found in "${file.name}".`);
    }
    return documentContentOf(fileNameWithoutExtension(file.name), toBlocks(sheets));
  }
}

/** Each sheet becomes a heading and a table, starting on its own page. */
function toBlocks(sheets: readonly Sheet[]): ContentBlock[] {
  return sheets.flatMap((sheet, index) => {
    const blocks: ContentBlock[] = [];
    if (index > 0) {
      blocks.push({ kind: 'page-break' });
    }
    blocks.push({ kind: 'heading', level: 2, text: sheet.name });
    if (sheet.rows.length === 0) {
      blocks.push({ kind: 'paragraph', text: 'This sheet is empty.', isItalic: true });
    } else {
      blocks.push({ kind: 'table', rows: sheet.rows, hasHeaderRow: true });
    }
    return blocks;
  });
}

// ---------------------------------------------------------------- OpenDocument

async function readOpenDocumentSheets(archive: ZippedXmlDocument): Promise<Sheet[]> {
  const content = await archive.parsePart('content.xml');
  if (!content) {
    return [];
  }
  return elementsByLocalName(content, 'table').map((table, index) => ({
    name: attributeByLocalName(table, 'name') ?? `Sheet ${index + 1}`,
    rows: trimToUsedArea(
      elementsByLocalName(table, 'table-row')
        .slice(0, MAXIMUM_ROWS_PER_SHEET)
        .map(openDocumentRowValues),
    ),
  }));
}

function openDocumentRowValues(row: Element): string[] {
  return childrenByLocalName(row, 'table-cell')
    .flatMap((cell) => {
      const repeatCount = Number(attributeByLocalName(cell, 'number-columns-repeated') ?? '1');
      const text = (cell.textContent ?? '').replace(/\s+/g, ' ').trim();
      // A huge repeat is trailing empty padding, so it is not expanded.
      const safeCount = text === '' ? 1 : Math.min(Math.max(repeatCount, 1), MAXIMUM_COLUMNS);
      return Array.from({ length: safeCount }, () => text);
    })
    .slice(0, MAXIMUM_COLUMNS);
}

// ----------------------------------------------------------------------- Excel

async function readExcelSheets(archive: ZippedXmlDocument): Promise<Sheet[]> {
  const sharedStrings = await readSharedStrings(archive);
  const sheetNames = await readSheetNames(archive);
  const sheetPaths = archive
    .partPathsMatching(/^xl\/worksheets\/sheet\d+\.xml$/)
    .sort((left, right) => numberInPath(left) - numberInPath(right));

  const sheets: Sheet[] = [];
  for (const [index, path] of sheetPaths.entries()) {
    const sheetXml = await archive.parsePart(path);
    if (!sheetXml) {
      continue;
    }
    sheets.push({
      name: sheetNames[index] ?? `Sheet ${index + 1}`,
      rows: trimToUsedArea(readExcelRows(sheetXml, sharedStrings)),
    });
  }
  return sheets;
}

async function readSheetNames(archive: ZippedXmlDocument): Promise<string[]> {
  const workbook = await archive.parsePart('xl/workbook.xml');
  if (!workbook) {
    return [];
  }
  return elementsByLocalName(workbook, 'sheet').map(
    (sheet) => attributeByLocalName(sheet, 'name') ?? '',
  );
}

/** Excel stores repeated text once in a shared table and refers to it by index. */
async function readSharedStrings(archive: ZippedXmlDocument): Promise<string[]> {
  const shared = await archive.parsePart('xl/sharedStrings.xml');
  if (!shared) {
    return [];
  }
  return elementsByLocalName(shared, 'si').map((item) =>
    elementsByLocalName(item, 't')
      .map((textNode) => textNode.textContent ?? '')
      .join(''),
  );
}

function readExcelRows(sheetXml: Document, sharedStrings: readonly string[]): string[][] {
  return elementsByLocalName(sheetXml, 'row')
    .slice(0, MAXIMUM_ROWS_PER_SHEET)
    .map((row) => readExcelRow(row, sharedStrings));
}

/**
 * Cells carry a reference such as `C5`, and empty cells are simply absent, so
 * values are placed at the column their reference names rather than in sequence.
 */
function readExcelRow(row: Element, sharedStrings: readonly string[]): string[] {
  const values: string[] = [];
  for (const cell of childrenByLocalName(row, 'c')) {
    const columnIndex = columnIndexOf(attributeByLocalName(cell, 'r') ?? '');
    if (columnIndex >= MAXIMUM_COLUMNS) {
      continue;
    }
    while (values.length < columnIndex) {
      values.push('');
    }
    values[columnIndex] = excelCellText(cell, sharedStrings);
  }
  return values;
}

function excelCellText(cell: Element, sharedStrings: readonly string[]): string {
  const type = attributeByLocalName(cell, 't');
  if (type === 's') {
    const index = Number(childTextByLocalName(cell, 'v'));
    return sharedStrings[index] ?? '';
  }
  if (type === 'inlineStr') {
    return elementsByLocalName(cell, 't')
      .map((node) => node.textContent ?? '')
      .join('');
  }
  return childTextByLocalName(cell, 'v');
}

function childTextByLocalName(cell: Element, localName: string): string {
  const child = childrenByLocalName(cell, localName)[0];
  return (child?.textContent ?? '').trim();
}

/** Turns the letters of a cell reference such as `AB7` into a zero-based column. */
function columnIndexOf(reference: string): number {
  const letters = reference.replace(/\d+/g, '').toUpperCase();
  let index = 0;
  for (const letter of letters) {
    index = index * 26 + (letter.charCodeAt(0) - 64);
  }
  return Math.max(0, index - 1);
}

// ----------------------------------------------------------------------- shared

/**
 * Drops the empty rows and columns that spreadsheets keep beyond their content,
 * so the table in the PDF is only as big as the data.
 */
function trimToUsedArea(rows: readonly string[][]): string[][] {
  const lastFilledRow = findLastIndex(rows, (row) => row.some((cell) => cell !== ''));
  if (lastFilledRow < 0) {
    return [];
  }
  const usedRows = rows.slice(0, lastFilledRow + 1);
  const columnCount = Math.max(
    ...usedRows.map((row) => findLastIndex(row, (cell) => cell !== '') + 1),
  );
  return usedRows.map((row) =>
    Array.from({ length: Math.max(columnCount, 1) }, (_unused, index) => row[index] ?? ''),
  );
}

function findLastIndex<TItem>(
  items: readonly TItem[],
  matches: (item: TItem) => boolean,
): number {
  for (let index = items.length - 1; index >= 0; index -= 1) {
    if (matches(items[index])) {
      return index;
    }
  }
  return -1;
}
