import type { TextItem, TextMarkedContent } from 'pdfjs-dist/types/src/display/api';
import type { FontFamily } from '../editor/annotations/TextStyle';
import { PdfFontStyleReader } from './PdfFontStyleReader';
import type { PdfJsPageWithFonts } from './PdfJsInternals';
import type { PdfJsDocument } from './PdfJsRuntime';

/**
 * A run of text as it is drawn on the page, in PDF user-space units with the
 * origin at the bottom-left corner.
 */
export interface TextRun {
  readonly text: string;
  readonly xInPoints: number;
  readonly yInPoints: number;
  readonly widthInPoints: number;
  readonly heightInPoints: number;
  readonly fontSizeInPoints: number;
  readonly fontFamily: FontFamily;
  readonly isBold: boolean;
  readonly isItalic: boolean;
}

export interface PageText {
  readonly runs: readonly TextRun[];
  readonly widthInPoints: number;
  readonly heightInPoints: number;
}

/** Reads the positioned text of a page, which the editor needs to place overlays on it. */
export class PdfTextExtractor {
  async extractPageText(document: PdfJsDocument, pageNumber: number): Promise<PageText> {
    const page = (await document.getPage(pageNumber)) as PdfJsPageWithFonts;
    const unrotatedViewport = page.getViewport({ scale: 1, rotation: 0 });
    const textContent = await page.getTextContent();

    const fontStyles = new PdfFontStyleReader(page, familyHintsOf(textContent.styles));
    const runs = textContent.items
      .filter(isTextItem)
      .filter((item) => item.str.trim().length > 0)
      .map((item) => toTextRun(item, fontStyles));

    return {
      runs,
      widthInPoints: unrotatedViewport.width,
      heightInPoints: unrotatedViewport.height,
    };
  }

  async extractPlainText(document: PdfJsDocument, pageNumber: number): Promise<string> {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    return textContent.items
      .map((item) => (isTextItem(item) ? textOf(item) : '\n'))
      .join('')
      .trim();
  }
}

function familyHintsOf(styles: Record<string, { fontFamily?: string }>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(styles).map(([fontName, style]) => [fontName, style.fontFamily ?? '']),
  );
}

function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
  return 'str' in item;
}

/** pdf.js marks the end of a visual line with `hasEOL` rather than a newline character. */
function textOf(item: TextItem): string {
  return item.hasEOL ? `${item.str}\n` : item.str;
}

/**
 * pdf.js reports each item's placement as a 2D transform matrix
 * `[scaleX, skewY, skewX, scaleY, translateX, translateY]`. The vertical scale
 * is the rendered font size, and the translation is the text baseline.
 */
function toTextRun(item: TextItem, fontStyles: PdfFontStyleReader): TextRun {
  const [, , , verticalScale, translateX, baselineY] = item.transform as number[];
  const fontSizeInPoints = Math.abs(verticalScale);
  const style = fontStyles.styleOf(item.fontName);
  return {
    text: item.str,
    xInPoints: translateX,
    yInPoints: baselineY,
    widthInPoints: item.width,
    heightInPoints: item.height || fontSizeInPoints,
    fontSizeInPoints,
    fontFamily: style.fontFamily,
    isBold: style.isBold,
    isItalic: style.isItalic,
  };
}
