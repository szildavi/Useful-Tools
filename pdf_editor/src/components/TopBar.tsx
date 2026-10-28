import { useState } from 'react';
import type { EditorSession } from '../state/useEditorSession';
import { FilePicker } from './FilePicker';
import { SaveDialog } from './SaveDialog';
import './TopBar.css';

interface TopBarProps {
  readonly session: EditorSession;
}

/** The document-level actions: opening more files, page operations, and export. */
export function TopBar({ session }: TopBarProps) {
  const { selection, document } = session;
  const hasSelection = selection.selectedCount > 0;

  return (
    <header className="top-bar">
      <div className="top-bar__group">
        <span className="top-bar__brand">PDF Editor</span>
        <span className="top-bar__meta">
          {document.pageCount()} {document.pageCount() === 1 ? 'page' : 'pages'}
          {hasSelection && ` · ${selection.selectedCount} selected`}
        </span>
      </div>

      <div className="top-bar__group">
        <FilePicker
          accept={session.acceptedFileExtensions}
          onFilesChosen={session.openFiles}
          className="button"
        >
          Add files
        </FilePicker>

        <span className="top-bar__divider" aria-hidden="true" />

        <button
          type="button"
          className="button button--icon button--quiet"
          onClick={session.undo}
          disabled={!session.canUndo}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          type="button"
          className="button button--icon button--quiet"
          onClick={session.redo}
          disabled={!session.canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>

        <span className="top-bar__divider" aria-hidden="true" />

        <button
          type="button"
          className="button button--icon"
          onClick={session.rotateSelectedPagesCounterClockwise}
          disabled={!hasSelection}
          title="Rotate left"
        >
          ⟲
        </button>
        <button
          type="button"
          className="button button--icon"
          onClick={session.rotateSelectedPagesClockwise}
          disabled={!hasSelection}
          title="Rotate right"
        >
          ⟳
        </button>
        <button
          type="button"
          className="button"
          onClick={session.duplicateSelectedPages}
          disabled={!hasSelection}
        >
          Duplicate
        </button>
        <button
          type="button"
          className="button button--danger"
          onClick={session.deleteSelectedPages}
          disabled={!hasSelection}
        >
          Delete
        </button>

        <span className="top-bar__divider" aria-hidden="true" />

        <button
          type="button"
          className="button button--quiet"
          onClick={selection.selectAll}
          title="Select every page (Ctrl+A)"
        >
          Select all
        </button>
        <button
          type="button"
          className="button button--quiet"
          onClick={session.reversePageOrder}
          title="Put the pages in the opposite order"
        >
          Reverse
        </button>
        <button
          type="button"
          className="button button--quiet"
          onClick={session.closeDocument}
          title="Close these files and start again"
        >
          Close
        </button>
        <SaveButton session={session} />
      </div>
    </header>
  );
}

/** Opens the dialog that chooses the file name, format and splitting. */
function SaveButton({ session }: TopBarProps) {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button button--primary"
        onClick={() => setIsDialogOpen(true)}
        disabled={session.document.isEmpty()}
      >
        Save…
      </button>
      {isDialogOpen && (
        <SaveDialog session={session} onClose={() => setIsDialogOpen(false)} />
      )}
    </>
  );
}
