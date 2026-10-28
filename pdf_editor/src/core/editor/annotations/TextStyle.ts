import { BLACK, type RgbColor } from './RgbColor';

/** The font families the editor can embed into an exported PDF. */
export type FontFamily = 'sans-serif' | 'serif' | 'monospace';

/**
 * Shared appearance of every piece of text the editor writes. Held by
 * composition rather than inheritance so that both new text boxes and text
 * replacements describe their styling the same way.
 */
export interface TextStyle {
  readonly fontFamily: FontFamily;
  readonly fontSizeInPoints: number;
  readonly color: RgbColor;
  readonly isBold: boolean;
  readonly isItalic: boolean;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: 'sans-serif',
  fontSizeInPoints: 12,
  color: BLACK,
  isBold: false,
  isItalic: false,
};

export function cssFontFamilyOf(style: TextStyle): string {
  switch (style.fontFamily) {
    case 'serif':
      return 'Georgia, "Times New Roman", serif';
    case 'monospace':
      return '"Courier New", monospace';
    default:
      return 'Arial, Helvetica, sans-serif';
  }
}
