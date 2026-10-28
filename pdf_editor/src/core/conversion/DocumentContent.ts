/**
 * A format-neutral description of a document's content.
 *
 * Every "convert to PDF" path produces this, and a single renderer turns it
 * into a PDF. That way each input format only has to describe what it contains,
 * and the layout, pagination and font handling live in one place instead of
 * being re-implemented per format.
 */
export type ContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | TableBlock
  | PageBreakBlock;

export interface HeadingBlock {
  readonly kind: 'heading';
  /** 1 is the most prominent heading. */
  readonly level: 1 | 2 | 3;
  readonly text: string;
}

export interface ParagraphBlock {
  readonly kind: 'paragraph';
  readonly text: string;
  readonly isBold?: boolean;
  readonly isItalic?: boolean;
  readonly isMonospaced?: boolean;
}

export interface ListBlock {
  readonly kind: 'list';
  readonly items: readonly string[];
  readonly isNumbered: boolean;
}

export interface TableBlock {
  readonly kind: 'table';
  readonly caption?: string;
  readonly rows: readonly (readonly string[])[];
  readonly hasHeaderRow: boolean;
}

export interface PageBreakBlock {
  readonly kind: 'page-break';
}

export interface DocumentContent {
  readonly title: string;
  readonly blocks: readonly ContentBlock[];
}

export function documentContentOf(title: string, blocks: readonly ContentBlock[]): DocumentContent {
  return { title, blocks };
}
