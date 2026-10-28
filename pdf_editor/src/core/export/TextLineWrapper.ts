import type { PDFFont } from 'pdf-lib';

/**
 * Breaks text into lines that fit a given width, so that typed paragraphs wrap
 * inside their box in the exported PDF the same way they do on screen.
 *
 * Explicit line breaks in the text are always honoured; long words that cannot
 * fit on a line of their own are left overflowing rather than split, which
 * matches what the on-screen editor shows.
 */
export class TextLineWrapper {
  private readonly font: PDFFont;
  private readonly fontSizeInPoints: number;

  constructor(font: PDFFont, fontSizeInPoints: number) {
    this.font = font;
    this.fontSizeInPoints = fontSizeInPoints;
  }

  wrapToWidth(text: string, maximumWidthInPoints: number): string[] {
    return text
      .split('\n')
      .flatMap((paragraph) => this.wrapParagraph(paragraph, maximumWidthInPoints));
  }

  widthOf(text: string): number {
    return this.font.widthOfTextAtSize(text, this.fontSizeInPoints);
  }

  private wrapParagraph(paragraph: string, maximumWidthInPoints: number): string[] {
    const words = paragraph.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const candidate = currentLine === '' ? word : `${currentLine} ${word}`;
      if (this.widthOf(candidate) <= maximumWidthInPoints || currentLine === '') {
        currentLine = candidate;
      } else {
        lines.push(currentLine);
        currentLine = word;
      }
    }
    lines.push(currentLine);
    return lines;
  }
}
