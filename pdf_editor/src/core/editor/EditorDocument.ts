import { EditorPage } from './EditorPage';
import type { PageId, SourceId } from './Identifiers';
import type { PdfSource } from './PdfSource';

/**
 * The document the user is editing: an ordered list of pages, each referencing
 * one of the opened source files.
 *
 * Every operation returns a new document instead of mutating this one. That is
 * what lets the history stack simply remember previous instances, and lets
 * React re-render from a plain identity check.
 */
export class EditorDocument {
  readonly sources: ReadonlyMap<SourceId, PdfSource>;
  readonly pages: readonly EditorPage[];

  private constructor(sources: ReadonlyMap<SourceId, PdfSource>, pages: readonly EditorPage[]) {
    this.sources = sources;
    this.pages = pages;
  }

  static empty(): EditorDocument {
    return new EditorDocument(new Map(), []);
  }

  isEmpty(): boolean {
    return this.pages.length === 0;
  }

  pageCount(): number {
    return this.pages.length;
  }

  /** Adds a source file and appends all of its pages to the end of the document. */
  withSourceAppended(source: PdfSource): EditorDocument {
    const sources = new Map(this.sources).set(source.id, source);
    const appendedPages = Array.from({ length: source.pageCount }, (_unused, index) =>
      EditorPage.referencing(source.id, index),
    );
    return new EditorDocument(sources, [...this.pages, ...appendedPages]);
  }

  findPage(pageId: PageId): EditorPage | undefined {
    return this.pages.find((page) => page.id === pageId);
  }

  indexOfPage(pageId: PageId): number {
    return this.pages.findIndex((page) => page.id === pageId);
  }

  sourceOf(page: EditorPage): PdfSource {
    const source = this.sources.get(page.sourceId);
    if (!source) {
      throw new Error(`The source file for page ${page.id} is no longer loaded.`);
    }
    return source;
  }

  withPageReplaced(page: EditorPage): EditorDocument {
    return this.withPages(
      this.pages.map((existing) => (existing.id === page.id ? page : existing)),
    );
  }

  withPagesRemoved(pageIds: readonly PageId[]): EditorDocument {
    const removed = new Set<PageId>(pageIds);
    return this.withPages(this.pages.filter((page) => !removed.has(page.id)));
  }

  /** Moves one page so that it sits at `targetIndex` in the new order. */
  withPageMoved(pageId: PageId, targetIndex: number): EditorDocument {
    const currentIndex = this.indexOfPage(pageId);
    if (currentIndex < 0 || currentIndex === targetIndex) {
      return this;
    }
    const reordered = [...this.pages];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(clamp(targetIndex, 0, reordered.length), 0, moved);
    return this.withPages(reordered);
  }

  withPageOrder(orderedPageIds: readonly PageId[]): EditorDocument {
    const pagesById = new Map(this.pages.map((page) => [page.id, page]));
    const reordered = orderedPageIds
      .map((pageId) => pagesById.get(pageId))
      .filter((page): page is EditorPage => page !== undefined);
    if (reordered.length !== this.pages.length) {
      throw new Error('A page order must list every page of the document exactly once.');
    }
    return this.withPages(reordered);
  }

  withPageDuplicated(pageId: PageId): EditorDocument {
    const index = this.indexOfPage(pageId);
    if (index < 0) {
      return this;
    }
    const withCopy = [...this.pages];
    withCopy.splice(index + 1, 0, this.pages[index].duplicated());
    return this.withPages(withCopy);
  }

  /** A document containing only the given pages, sharing the same sources. */
  selection(pageIds: readonly PageId[]): EditorDocument {
    const selected = new Set<PageId>(pageIds);
    return this.withPages(this.pages.filter((page) => selected.has(page.id)));
  }

  /**
   * Sources are deliberately never dropped when their last page is deleted:
   * undoing that deletion has to be able to bring the page back. They are
   * released only when the whole document is closed.
   */
  allSources(): readonly PdfSource[] {
    return [...this.sources.values()];
  }

  private withPages(pages: readonly EditorPage[]): EditorDocument {
    return new EditorDocument(this.sources, pages);
  }
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}
