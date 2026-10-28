import { rgb, type PDFFont } from 'pdf-lib';
import type { PdfFontProvider } from '../../export/PdfFontProvider';
import { TextLineWrapper } from '../../export/TextLineWrapper';
import type { TextStyle } from '../../editor/annotations/TextStyle';
import type {
  ContentBlock,
  HeadingBlock,
  ListBlock,
  ParagraphBlock,
  TableBlock,
} from '../DocumentContent';
import { Typography } from './ContentTypography';
import { PageLayoutCursor } from './PageLayoutCursor';

export interface BlockRenderingContext {
  readonly cursor: PageLayoutCursor;
  readonly fonts: PdfFontProvider;
}

/** Renders one kind of content block into the flowing page layout. */
export abstract class ContentBlockRenderer<TBlock extends ContentBlock> {
  abstract render(block: TBlock, context: BlockRenderingContext): Promise<void>;

  /** Wraps styled text to the available width and writes it line by line. */
  protected async writeWrappedText(
    text: string,
    style: TextStyle,
    context: BlockRenderingContext,
    indentInPoints = 0,
  ): Promise<void> {
    const font = await context.fonts.fontFor(style);
    const availableWidth = context.cursor.contentWidthInPoints() - indentInPoints;
    const wrapper = new TextLineWrapper(font, style.fontSizeInPoints);
    const lineHeight = Typography.lineHeightFor(style.fontSizeInPoints);

    for (const line of wrapper.wrapToWidth(text, availableWidth)) {
      context.cursor.writeLine(
        {
          text: line,
          font,
          fontSizeInPoints: style.fontSizeInPoints,
          color: style.color,
          indentInPoints,
        },
        lineHeight,
      );
    }
  }
}

class HeadingRenderer extends ContentBlockRenderer<HeadingBlock> {
  async render(block: HeadingBlock, context: BlockRenderingContext): Promise<void> {
    await this.writeWrappedText(block.text, Typography.headingStyle(block), context);
  }
}

class ParagraphRenderer extends ContentBlockRenderer<ParagraphBlock> {
  async render(block: ParagraphBlock, context: BlockRenderingContext): Promise<void> {
    await this.writeWrappedText(block.text, Typography.paragraphStyle(block), context);
  }
}

class ListRenderer extends ContentBlockRenderer<ListBlock> {
  async render(block: ListBlock, context: BlockRenderingContext): Promise<void> {
    const style = Typography.listItemStyle();
    for (const [index, item] of block.items.entries()) {
      const marker = block.isNumbered ? `${index + 1}.` : '•';
      await this.writeWrappedText(
        `${marker}  ${item}`,
        style,
        context,
        Typography.listIndentInPoints,
      );
    }
  }
}

/** A table row that has been wrapped and measured, ready to be drawn. */
interface MeasuredTableRow {
  readonly cellLines: readonly string[][];
  readonly heightInPoints: number;
  readonly lineHeightInPoints: number;
  readonly columnWidthInPoints: number;
  readonly font: PDFFont;
  readonly style: TextStyle;
}

/**
 * Draws a table with even column widths and a ruled grid.
 *
 * Rows are measured before they are drawn, so a row that does not fit moves to
 * the next page as a whole and the header row can be repeated above it.
 */
class TableRenderer extends ContentBlockRenderer<TableBlock> {
  async render(block: TableBlock, context: BlockRenderingContext): Promise<void> {
    if (block.rows.length === 0) {
      return;
    }
    await this.writeCaption(block, context);

    const columnCount = Math.max(...block.rows.map((row) => row.length));
    const columnWidth = context.cursor.contentWidthInPoints() / columnCount;
    const headerRow = block.hasHeaderRow ? block.rows[0] : undefined;

    for (const [rowIndex, row] of block.rows.entries()) {
      const isHeaderRow = block.hasHeaderRow && rowIndex === 0;
      const measured = await this.measureRow(row, columnCount, columnWidth, isHeaderRow, context);

      const pageBeforeRow = context.cursor.pageIndex();
      context.cursor.ensureSpaceFor(measured.heightInPoints);
      const rowMovedToNewPage = context.cursor.pageIndex() !== pageBeforeRow;

      if (rowMovedToNewPage && headerRow && !isHeaderRow) {
        const repeatedHeader = await this.measureRow(
          headerRow,
          columnCount,
          columnWidth,
          true,
          context,
        );
        this.drawRow(repeatedHeader, context);
      }
      this.drawRow(measured, context);
    }
  }

  private async writeCaption(
    block: TableBlock,
    context: BlockRenderingContext,
  ): Promise<void> {
    if (!block.caption) {
      return;
    }
    await this.writeWrappedText(
      block.caption,
      Typography.headingStyle({ kind: 'heading', level: 3, text: block.caption }),
      context,
    );
  }

  private async measureRow(
    row: readonly string[],
    columnCount: number,
    columnWidthInPoints: number,
    isHeaderRow: boolean,
    context: BlockRenderingContext,
  ): Promise<MeasuredTableRow> {
    const style = Typography.tableCellStyle(isHeaderRow);
    const font = await context.fonts.fontFor(style);
    const lineHeightInPoints = Typography.lineHeightFor(style.fontSizeInPoints);
    const padding = Typography.tableCellPaddingInPoints;
    const wrapper = new TextLineWrapper(font, style.fontSizeInPoints);

    const cellLines = Array.from({ length: columnCount }, (_unused, columnIndex) =>
      wrapper.wrapToWidth(row[columnIndex] ?? '', columnWidthInPoints - 2 * padding),
    );
    const tallestCellLineCount = Math.max(...cellLines.map((lines) => lines.length));

    return {
      cellLines,
      heightInPoints: tallestCellLineCount * lineHeightInPoints + 2 * padding,
      lineHeightInPoints,
      columnWidthInPoints,
      font,
      style,
    };
  }

  private drawRow(row: MeasuredTableRow, context: BlockRenderingContext): void {
    const page = context.cursor.currentPage();
    const rowTop = context.cursor.topOfCursorInPdfSpace();
    const left = context.cursor.leftMarginInPoints();
    const padding = Typography.tableCellPaddingInPoints;
    const borderColor = rgb(0.75, 0.75, 0.75);

    row.cellLines.forEach((lines, columnIndex) => {
      const cellLeft = left + columnIndex * row.columnWidthInPoints;
      page.drawRectangle({
        x: cellLeft,
        y: rowTop - row.heightInPoints,
        width: row.columnWidthInPoints,
        height: row.heightInPoints,
        borderColor,
        borderWidth: 0.5,
      });
      lines.forEach((line, lineIndex) => {
        page.drawText(line, {
          x: cellLeft + padding,
          y:
            rowTop -
            padding -
            (lineIndex + 1) * row.lineHeightInPoints +
            row.lineHeightInPoints * 0.25,
          size: row.style.fontSizeInPoints,
          font: row.font,
          color: rgb(row.style.color.red, row.style.color.green, row.style.color.blue),
        });
      });
    });

    context.cursor.skip(row.heightInPoints);
  }
}

/** Looks up the renderer responsible for a block. */
export class ContentBlockRendererRegistry {
  private readonly headingRenderer = new HeadingRenderer();
  private readonly paragraphRenderer = new ParagraphRenderer();
  private readonly listRenderer = new ListRenderer();
  private readonly tableRenderer = new TableRenderer();

  async render(block: ContentBlock, context: BlockRenderingContext): Promise<void> {
    switch (block.kind) {
      case 'heading':
        return this.headingRenderer.render(block, context);
      case 'paragraph':
        return this.paragraphRenderer.render(block, context);
      case 'list':
        return this.listRenderer.render(block, context);
      case 'table':
        return this.tableRenderer.render(block, context);
      case 'page-break':
        context.cursor.startNewPage();
        return;
    }
  }
}
