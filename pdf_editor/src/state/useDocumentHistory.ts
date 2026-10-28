import { useCallback, useMemo, useState } from 'react';
import { EditorDocument } from '../core/editor/EditorDocument';
import { EditorHistory } from '../core/editor/EditorHistory';

export interface DocumentHistoryState {
  readonly document: EditorDocument;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Applies a change to the current document and remembers the previous state. */
  readonly applyChange: (change: (document: EditorDocument) => EditorDocument) => void;
  readonly undo: () => void;
  readonly redo: () => void;
  readonly replaceAll: (document: EditorDocument) => void;
}

/** Holds the edited document together with its undo/redo stack. */
export function useDocumentHistory(): DocumentHistoryState {
  const [history, setHistory] = useState(() => EditorHistory.startingAt(EditorDocument.empty()));

  const applyChange = useCallback((change: (document: EditorDocument) => EditorDocument) => {
    setHistory((current) => current.advancedTo(change(current.present)));
  }, []);

  const undo = useCallback(() => setHistory((current) => current.undone()), []);
  const redo = useCallback(() => setHistory((current) => current.redone()), []);

  const replaceAll = useCallback(
    (document: EditorDocument) => setHistory(EditorHistory.startingAt(document)),
    [],
  );

  return useMemo(
    () => ({
      document: history.present,
      canUndo: history.canUndo(),
      canRedo: history.canRedo(),
      applyChange,
      undo,
      redo,
      replaceAll,
    }),
    [history, applyChange, undo, redo, replaceAll],
  );
}
