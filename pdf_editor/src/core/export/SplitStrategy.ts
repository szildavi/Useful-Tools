import type { EditorDocument } from '../editor/EditorDocument';
import type { PageId } from '../editor/Identifiers';

/** A named group of pages that will become one output file. */
export interface PageGroup {
  readonly nameSuffix: string;
  readonly pageIds: readonly PageId[];
}

/**
 * Decides how a document is divided into separate files.
 *
 * Each way of splitting is its own strategy, so the splitter itself never has to
 * know which one the user picked.
 */
export abstract class SplitStrategy {
  abstract readonly label: string;
  abstract groupsOf(document: EditorDocument): readonly PageGroup[];
}

/** One output file per page. */
export class SplitIntoSinglePages extends SplitStrategy {
  readonly label = 'One file per page';

  groupsOf(document: EditorDocument): readonly PageGroup[] {
    return document.pages.map((page, index) => ({
      nameSuffix: `page-${index + 1}`,
      pageIds: [page.id],
    }));
  }
}

/** Output files of a fixed length, the last one holding whatever remains. */
export class SplitEveryNPages extends SplitStrategy {
  readonly label: string;
  private readonly pagesPerFile: number;

  constructor(pagesPerFile: number) {
    super();
    this.pagesPerFile = Math.max(1, Math.floor(pagesPerFile));
    this.label = `Every ${this.pagesPerFile} pages`;
  }

  groupsOf(document: EditorDocument): readonly PageGroup[] {
    const groups: PageGroup[] = [];
    for (let start = 0; start < document.pageCount(); start += this.pagesPerFile) {
      const pages = document.pages.slice(start, start + this.pagesPerFile);
      const firstNumber = start + 1;
      const lastNumber = start + pages.length;
      groups.push({
        nameSuffix:
          firstNumber === lastNumber
            ? `page-${firstNumber}`
            : `pages-${firstNumber}-${lastNumber}`,
        pageIds: pages.map((page) => page.id),
      });
    }
    return groups;
  }
}

/**
 * Two files: the pages the user selected, and everything else. Useful for
 * pulling a chapter or a signed page out of a larger document.
 */
export class SplitOutSelectedPages extends SplitStrategy {
  readonly label = 'Selected pages into their own file';
  private readonly selectedPageIds: ReadonlySet<PageId>;

  constructor(selectedPageIds: readonly PageId[]) {
    super();
    this.selectedPageIds = new Set(selectedPageIds);
  }

  groupsOf(document: EditorDocument): readonly PageGroup[] {
    const selected = document.pages.filter((page) => this.selectedPageIds.has(page.id));
    const remaining = document.pages.filter((page) => !this.selectedPageIds.has(page.id));

    return [
      { nameSuffix: 'selected', pageIds: selected.map((page) => page.id) },
      { nameSuffix: 'remaining', pageIds: remaining.map((page) => page.id) },
    ].filter((group) => group.pageIds.length > 0);
  }
}
