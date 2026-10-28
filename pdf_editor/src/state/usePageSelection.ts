import { useCallback, useMemo, useState } from 'react';
import type { EditorDocument } from '../core/editor/EditorDocument';
import type { PageId } from '../core/editor/Identifiers';

export interface PageSelectionState {
  /** Only ever contains pages that still exist in the document. */
  readonly selectedPageIds: readonly PageId[];
  readonly selectedCount: number;
  readonly isSelected: (pageId: PageId) => boolean;
  /** Replaces the selection with this one page. */
  readonly selectOnly: (pageId: PageId) => void;
  /** Adds or removes one page, for ctrl-click style multi-selection. */
  readonly toggle: (pageId: PageId) => void;
  readonly selectAll: () => void;
  readonly clear: () => void;
}

/**
 * Tracks which pages the user has selected in the page list.
 *
 * Deleting or undoing can remove pages while they are still selected, so the
 * selection is filtered against the current document on every read rather than
 * being cleaned up from every operation that changes the page list.
 */
export function usePageSelection(document: EditorDocument): PageSelectionState {
  const [rawSelection, setRawSelection] = useState<ReadonlySet<PageId>>(new Set());

  const selectOnly = useCallback((pageId: PageId) => {
    setRawSelection(new Set([pageId]));
  }, []);

  const toggle = useCallback((pageId: PageId) => {
    setRawSelection((current) => {
      const updated = new Set(current);
      if (!updated.delete(pageId)) {
        updated.add(pageId);
      }
      return updated;
    });
  }, []);

  const clear = useCallback(() => setRawSelection(new Set()), []);

  const selectAll = useCallback(() => {
    setRawSelection(new Set(document.pages.map((page) => page.id)));
  }, [document]);

  // Kept in document order so that acting on a selection is predictable.
  const selectedPageIds = useMemo(
    () => document.pages.map((page) => page.id).filter((pageId) => rawSelection.has(pageId)),
    [document, rawSelection],
  );

  return useMemo(
    () => ({
      selectedPageIds,
      selectedCount: selectedPageIds.length,
      isSelected: (pageId: PageId) => rawSelection.has(pageId),
      selectOnly,
      toggle,
      selectAll,
      clear,
    }),
    [selectedPageIds, rawSelection, selectOnly, toggle, selectAll, clear],
  );
}
