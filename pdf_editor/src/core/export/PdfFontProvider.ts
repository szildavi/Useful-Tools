import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';
import type { FontFamily, TextStyle } from '../editor/annotations/TextStyle';

/**
 * Supplies embedded fonts for text written into an exported PDF.
 *
 * pdf-lib's built-in fonts only cover the WinAnsi character set, which cannot
 * encode common letters such as "ő" or "ű". DejaVu fonts are therefore bundled
 * with the app and embedded instead, so any text the user types survives the
 * export. The files are served from the app's own origin and fetched only when
 * an export actually needs them.
 */
export class PdfFontProvider {
  private readonly document: PDFDocument;
  private readonly embeddedFontsByFile = new Map<string, PDFFont>();

  constructor(document: PDFDocument) {
    this.document = document;
    this.document.registerFontkit(fontkit);
  }

  async fontFor(style: TextStyle): Promise<PDFFont> {
    return this.embedFontFile(fontFileNameFor(style));
  }

  private async embedFontFile(fileName: string): Promise<PDFFont> {
    const alreadyEmbedded = this.embeddedFontsByFile.get(fileName);
    if (alreadyEmbedded) {
      return alreadyEmbedded;
    }
    const fontBytes = await fetchFontBytes(fileName);
    // `subset` keeps only the glyphs actually used, so exports stay small even
    // though the source files are large.
    const embedded = await this.document.embedFont(fontBytes, { subset: true });
    this.embeddedFontsByFile.set(fileName, embedded);
    return embedded;
  }
}

const FONT_FILE_STEMS: Record<FontFamily, string> = {
  'sans-serif': 'DejaVuSans',
  serif: 'DejaVuSerif',
  monospace: 'DejaVuSansMono',
};

/**
 * DejaVu names its slanted faces "Oblique" for the sans and mono families but
 * "Italic" for the serif family, so the suffix depends on the family.
 */
function fontFileNameFor(style: TextStyle): string {
  const stem = FONT_FILE_STEMS[style.fontFamily];
  const slantedName = style.fontFamily === 'serif' ? 'Italic' : 'Oblique';
  const suffixes: string[] = [];
  if (style.isBold) {
    suffixes.push('Bold');
  }
  if (style.isItalic) {
    suffixes.push(slantedName);
  }
  return suffixes.length === 0 ? `${stem}.ttf` : `${stem}-${suffixes.join('')}.ttf`;
}

async function fetchFontBytes(fileName: string): Promise<ArrayBuffer> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${fileName}`);
  if (!response.ok) {
    throw new Error(`The font "${fileName}" needed for this text could not be loaded.`);
  }
  return response.arrayBuffer();
}
