import { useEffect } from 'react';

export interface KeyboardShortcuts {
  readonly undo: () => void;
  readonly redo: () => void;
  readonly selectAll: () => void;
  readonly deleteSelection: () => void;
}

/**
 * The document-level keyboard shortcuts, matching the ones the toolbar advertises
 * in its tooltips.
 *
 * Shortcuts are ignored while the user is typing in a field, so Ctrl+A in a text
 * box still selects that text rather than every page.
 */
export function useKeyboardShortcuts(shortcuts: KeyboardShortcuts): void {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingInAField(event.target)) {
        return;
      }
      const hasModifier = event.ctrlKey || event.metaKey;

      if (hasModifier && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        // Ctrl+Shift+Z redoes, matching the toolbar's tooltip.
        if (event.shiftKey) {
          shortcuts.redo();
        } else {
          shortcuts.undo();
        }
        return;
      }
      if (hasModifier && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        shortcuts.redo();
        return;
      }
      if (hasModifier && event.key.toLowerCase() === 'a') {
        event.preventDefault();
        shortcuts.selectAll();
        return;
      }
      if (event.key === 'Delete') {
        shortcuts.deleteSelection();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [shortcuts]);
}

function isTypingInAField(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable)
  );
}
