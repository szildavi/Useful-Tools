import type { ContentBlock, HeadingBlock } from '../DocumentContent';

const HEADING_LEVELS: Record<string, HeadingBlock['level']> = {
  H1: 1,
  H2: 2,
  H3: 3,
  H4: 3,
  H5: 3,
  H6: 3,
};

/**
 * Turns the HTML produced from a word processing document into content blocks.
 *
 * Kept separate from any particular format so that anything able to produce
 * HTML can reuse it.
 */
export class HtmlToContentBlocks {
  convert(html: string): ContentBlock[] {
    const parsed = new DOMParser().parseFromString(html, 'text/html');
    return [...parsed.body.children].flatMap((element) => this.blocksFor(element));
  }

  private blocksFor(element: Element): ContentBlock[] {
    const tagName = element.tagName.toUpperCase();

    if (tagName in HEADING_LEVELS) {
      return this.headingBlock(element, HEADING_LEVELS[tagName]);
    }
    if (tagName === 'UL' || tagName === 'OL') {
      return this.listBlock(element, tagName === 'OL');
    }
    if (tagName === 'TABLE') {
      return this.tableBlock(element);
    }
    if (tagName === 'BLOCKQUOTE' || tagName === 'DIV') {
      return [...element.children].flatMap((child) => this.blocksFor(child));
    }
    if (tagName === 'PRE') {
      return this.preformattedBlock(element);
    }
    return this.paragraphBlock(element);
  }

  private headingBlock(element: Element, level: HeadingBlock['level']): ContentBlock[] {
    const text = textOf(element);
    return text ? [{ kind: 'heading', level, text }] : [];
  }

  private listBlock(element: Element, isNumbered: boolean): ContentBlock[] {
    const items = [...element.querySelectorAll(':scope > li')]
      .map((item) => textOf(item))
      .filter((text) => text.length > 0);
    return items.length > 0 ? [{ kind: 'list', items, isNumbered }] : [];
  }

  private tableBlock(element: Element): ContentBlock[] {
    const rows = [...element.querySelectorAll('tr')].map((row) =>
      [...row.querySelectorAll('th, td')].map((cell) => textOf(cell)),
    );
    if (rows.length === 0) {
      return [];
    }
    const hasHeaderRow = element.querySelector('th') !== null;
    return [{ kind: 'table', rows, hasHeaderRow }];
  }

  private preformattedBlock(element: Element): ContentBlock[] {
    const text = element.textContent ?? '';
    return text.trim() ? [{ kind: 'paragraph', text, isMonospaced: true }] : [];
  }

  private paragraphBlock(element: Element): ContentBlock[] {
    const text = textOf(element);
    if (!text) {
      return [];
    }
    return [
      {
        kind: 'paragraph',
        text,
        isBold: isEntirelyWrappedIn(element, ['STRONG', 'B']),
        isItalic: isEntirelyWrappedIn(element, ['EM', 'I']),
      },
    ];
  }
}

function textOf(element: Element): string {
  return (element.textContent ?? '').replace(/\s+/g, ' ').trim();
}

/**
 * True when the whole paragraph is emphasised, which is worth carrying over.
 * Emphasis on part of a paragraph is dropped, because the content model styles
 * whole blocks rather than spans.
 */
function isEntirelyWrappedIn(element: Element, tagNames: readonly string[]): boolean {
  const onlyChild = element.children.length === 1 ? element.children[0] : null;
  return (
    onlyChild !== null &&
    tagNames.includes(onlyChild.tagName.toUpperCase()) &&
    textOf(onlyChild) === textOf(element)
  );
}
