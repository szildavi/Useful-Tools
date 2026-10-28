import { BLACK, type RgbColor } from '../../editor/annotations/RgbColor';
import type { TextStyle } from '../../editor/annotations/TextStyle';
import type { ContentBlock, HeadingBlock, ParagraphBlock } from '../DocumentContent';

const BODY_FONT_SIZE_IN_POINTS = 11;
const HEADING_FONT_SIZES_IN_POINTS: Record<HeadingBlock['level'], number> = {
  1: 22,
  2: 16,
  3: 13,
};

const TABLE_TEXT_COLOR: RgbColor = BLACK;

/**
 * The single source of typographic decisions for generated PDFs: which size,
 * weight and family each kind of content is written in, and how much air sits
 * around it.
 */
export const Typography = {
  lineHeightFor(fontSizeInPoints: number): number {
    return fontSizeInPoints * 1.45;
  },

  headingStyle(block: HeadingBlock): TextStyle {
    return {
      fontFamily: 'sans-serif',
      fontSizeInPoints: HEADING_FONT_SIZES_IN_POINTS[block.level],
      color: BLACK,
      isBold: true,
      isItalic: false,
    };
  },

  paragraphStyle(block: ParagraphBlock): TextStyle {
    return {
      fontFamily: block.isMonospaced ? 'monospace' : 'sans-serif',
      fontSizeInPoints: BODY_FONT_SIZE_IN_POINTS,
      color: BLACK,
      isBold: block.isBold ?? false,
      isItalic: block.isItalic ?? false,
    };
  },

  listItemStyle(): TextStyle {
    return {
      fontFamily: 'sans-serif',
      fontSizeInPoints: BODY_FONT_SIZE_IN_POINTS,
      color: BLACK,
      isBold: false,
      isItalic: false,
    };
  },

  tableCellStyle(isHeaderCell: boolean): TextStyle {
    return {
      fontFamily: 'sans-serif',
      fontSizeInPoints: 9.5,
      color: TABLE_TEXT_COLOR,
      isBold: isHeaderCell,
      isItalic: false,
    };
  },

  /** Vertical breathing room to leave before a block starts. */
  spacingBefore(block: ContentBlock): number {
    switch (block.kind) {
      case 'heading':
        return block.level === 1 ? 14 : 12;
      case 'table':
        return 10;
      case 'list':
        return 6;
      default:
        return 4;
    }
  },

  /** Vertical breathing room to leave after a block ends. */
  spacingAfter(block: ContentBlock): number {
    switch (block.kind) {
      case 'heading':
        return 6;
      case 'table':
        return 12;
      default:
        return 6;
    }
  },

  listIndentInPoints: 16,
  tableCellPaddingInPoints: 4,
};
