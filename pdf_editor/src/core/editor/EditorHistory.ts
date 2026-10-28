import type { EditorDocument } from './EditorDocument';

const MAXIMUM_REMEMBERED_STEPS = 50;

/**
 * Undo/redo for the edited document.
 *
 * Because every document operation returns a new immutable document, a history
 * step is just a previous instance - no change tracking or inverse operations
 * are needed.
 */
export class EditorHistory {
  readonly present: EditorDocument;
  private readonly past: readonly EditorDocument[];
  private readonly future: readonly EditorDocument[];

  private constructor(
    present: EditorDocument,
    past: readonly EditorDocument[],
    future: readonly EditorDocument[],
  ) {
    this.present = present;
    this.past = past;
    this.future = future;
  }

  static startingAt(document: EditorDocument): EditorHistory {
    return new EditorHistory(document, [], []);
  }

  /** Records a new state, discarding any redo steps beyond it. */
  advancedTo(document: EditorDocument): EditorHistory {
    if (document === this.present) {
      return this;
    }
    const past = [...this.past, this.present].slice(-MAXIMUM_REMEMBERED_STEPS);
    return new EditorHistory(document, past, []);
  }

  canUndo(): boolean {
    return this.past.length > 0;
  }

  canRedo(): boolean {
    return this.future.length > 0;
  }

  undone(): EditorHistory {
    if (!this.canUndo()) {
      return this;
    }
    const previous = this.past[this.past.length - 1];
    return new EditorHistory(previous, this.past.slice(0, -1), [this.present, ...this.future]);
  }

  redone(): EditorHistory {
    if (!this.canRedo()) {
      return this;
    }
    const [next, ...remainingFuture] = this.future;
    return new EditorHistory(next, [...this.past, this.present], remainingFuture);
  }
}
