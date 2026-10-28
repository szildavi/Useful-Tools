import type { FontFamily } from '../editor/annotations/TextStyle';
import type { PdfJsPageWithFonts } from './PdfJsInternals';

export interface FontStyleOfRun {
  readonly fontFamily: FontFamily;
  readonly isBold: boolean;
  readonly isItalic: boolean;
}

const PLAIN_STYLE: FontStyleOfRun = {
  fontFamily: 'sans-serif',
  isBold: false,
  isItalic: false,
};

/**
 * Works out the weight, slant and family of the fonts a page draws with, so that
 * replacement text can be written in the same style as the text it replaces.
 *
 * pdf.js reports a family guess in the text content's `styles` map, but nothing
 * about weight or slant. Those live on the font objects it hands the renderer,
 * which is why this reads them from there.
 */
export class PdfFontStyleReader {
  private readonly familyByFontName: Map<string, FontFamily>;
  private readonly page: PdfJsPageWithFonts;

  constructor(page: PdfJsPageWithFonts, familyHintsByFontName: Record<string, string>) {
    this.page = page;
    this.familyByFontName = new Map(
      Object.entries(familyHintsByFontName).map(([fontName, hint]) => [
        fontName,
        toFontFamily(hint),
      ]),
    );
  }

  styleOf(fontName: string): FontStyleOfRun {
    const font = this.loadedFont(fontName);
    return {
      fontFamily: this.familyByFontName.get(fontName) ?? PLAIN_STYLE.fontFamily,
      isBold: font?.bold === true || font?.black === true,
      isItalic: font?.italic === true,
    };
  }

  /**
   * Fonts only appear once the page has been drawn, and asking for one too early
   * throws. A page whose fonts are not ready simply reports plain text, which is
   * a better outcome than failing to open the text tool.
   */
  private loadedFont(fontName: string) {
    try {
      const fonts = this.page.commonObjs;
      if (!fonts?.has?.(fontName)) {
        return undefined;
      }
      return fonts.get(fontName);
    } catch {
      return undefined;
    }
  }
}

/** pdf.js reports a CSS-like family such as "serif" or an actual font name. */
function toFontFamily(hint: string): FontFamily {
  const lowerCaseHint = hint.toLowerCase();
  if (lowerCaseHint.includes('mono') || lowerCaseHint.includes('courier')) {
    return 'monospace';
  }
  if (
    lowerCaseHint.includes('serif') &&
    !lowerCaseHint.includes('sans-serif') &&
    !lowerCaseHint.includes('sans serif')
  ) {
    return 'serif';
  }
  if (
    lowerCaseHint.includes('times') ||
    lowerCaseHint.includes('georgia') ||
    lowerCaseHint.includes('garamond') ||
    lowerCaseHint.includes('book')
  ) {
    return 'serif';
  }
  return 'sans-serif';
}
