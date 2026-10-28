import { rgb, type PDFDocument, type PDFFont, type PDFPage } from 'pdf-lib';
import type { RgbColor } from '../../editor/annotations/RgbColor';

export interface PageLayoutOptions {
  readonly pageWidthInPoints: number;
  readonly pageHeightInPoints: number;
  readonly marginInPoints: number;
}

/** A4 portrait, the usual default for generated documents. */
export const A4_PORTRAIT: PageLayoutOptions = {
  pageWidthInPoints: 595.28,
  pageHeightInPoints: 841.89,
  marginInPoints: 56,
};

export interface DrawnLine {
  readonly text: string;
  readonly font: PDFFont;
  readonly fontSizeInPoints: number;
  readonly color: RgbColor;
  readonly indentInPoints?: number;
}

/**
 * Fills pages from top to bottom, starting a new page whenever the content no
 * longer fits.
 *
 * All vertical flow and page-break logic for generated PDFs lives here, so the
 * individual block renderers only have to say what to draw, never where a page
 * ends.
 */
export class PageLayoutCursor {
  private readonly document: PDFDocument;
  private readonly options: PageLayoutOptions;
  private page: PDFPage;
  private verticalPositionFromTop: number;

  constructor(document: PDFDocument, options: PageLayoutOptions = A4_PORTRAIT) {
    this.document = document;
    this.options = options;
    this.page = this.appendPage();
    this.verticalPositionFromTop = options.marginInPoints;
  }

  contentWidthInPoints(): number {
    return this.options.pageWidthInPoints - 2 * this.options.marginInPoints;
  }

  remainingHeightInPoints(): number {
    return (
      this.options.pageHeightInPoints - this.options.marginInPoints - this.verticalPositionFromTop
    );
  }

  currentPage(): PDFPage {
    return this.page;
  }

  /** Lets callers notice that a page break happened, e.g. to repeat a table header. */
  pageIndex(): number {
    return this.document.getPageCount() - 1;
  }

  startNewPage(): void {
    this.page = this.appendPage();
    this.verticalPositionFromTop = this.options.marginInPoints;
  }

  /** Starts a new page unless `requiredHeightInPoints` still fits on this one. */
  ensureSpaceFor(requiredHeightInPoints: number): void {
    if (requiredHeightInPoints > this.remainingHeightInPoints() && !this.isAtTopOfPage()) {
      this.startNewPage();
    }
  }

  /** Draws one line at the cursor and moves the cursor below it. */
  writeLine(line: DrawnLine, lineHeightInPoints: number): void {
    this.ensureSpaceFor(lineHeightInPoints);
    this.page.drawText(line.text, {
      x: this.options.marginInPoints + (line.indentInPoints ?? 0),
      y: this.baselineOf(lineHeightInPoints),
      size: line.fontSizeInPoints,
      font: line.font,
      color: rgb(line.color.red, line.color.green, line.color.blue),
    });
    this.skip(lineHeightInPoints);
  }

  /** Moves the cursor down without drawing anything, e.g. for spacing. */
  skip(heightInPoints: number): void {
    this.verticalPositionFromTop += heightInPoints;
  }

  /** The y coordinate, in PDF space, of the top of the current cursor row. */
  topOfCursorInPdfSpace(): number {
    return this.options.pageHeightInPoints - this.verticalPositionFromTop;
  }

  leftMarginInPoints(): number {
    return this.options.marginInPoints;
  }

  private isAtTopOfPage(): boolean {
    return this.verticalPositionFromTop === this.options.marginInPoints;
  }

  /**
   * Text is positioned by its baseline, which sits a little above the bottom of
   * the line box.
   */
  private baselineOf(lineHeightInPoints: number): number {
    const descenderAllowance = lineHeightInPoints * 0.25;
    return this.topOfCursorInPdfSpace() - lineHeightInPoints + descenderAllowance;
  }

  private appendPage(): PDFPage {
    return this.document.addPage([
      this.options.pageWidthInPoints,
      this.options.pageHeightInPoints,
    ]);
  }
}
