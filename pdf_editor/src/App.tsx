import { useCallback, useMemo } from 'react';
import './App.css';
import { PageGrid } from './components/PageGrid';
import { StatusOverlay } from './components/StatusOverlay';
import { TopBar } from './components/TopBar';
import { PageEditor } from './components/viewer/PageEditor';
import { WelcomeScreen } from './components/WelcomeScreen';
import type { EditorPage } from './core/editor/EditorPage';
import { useFileDropTarget } from './hooks/useFileDropTarget';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useEditorSession } from './state/useEditorSession';

export function App() {
  const session = useEditorSession();
  const { isDraggingOver, dropHandlers } = useFileDropTarget(session.openFiles);
  const isEditingOnePage = session.activePage !== null;

  useKeyboardShortcuts(
    useMemo(
      () => ({
        undo: session.undo,
        redo: session.redo,
        selectAll: session.selection.selectAll,
        // While one page is open, Delete belongs to the selected edit on that
        // page, which the editor handles itself.
        deleteSelection: isEditingOnePage ? () => undefined : session.deleteSelectedPages,
      }),
      [session.undo, session.redo, session.selection.selectAll, session.deleteSelectedPages, isEditingOnePage],
    ),
  );

  const selectPage = useCallback(
    (page: EditorPage, addToSelection: boolean) => {
      if (addToSelection) {
        session.selection.toggle(page.id);
      } else {
        session.selection.selectOnly(page.id);
      }
    },
    [session.selection],
  );

  if (session.document.isEmpty()) {
    return (
      <>
        <WelcomeScreen
          acceptedFileExtensions={session.acceptedFileExtensions}
          onFilesChosen={session.openFiles}
        />
        <StatusOverlay task={session.task} />
      </>
    );
  }

  const { activePage } = session;

  return (
    <div className="app" {...dropHandlers}>
      <TopBar session={session} />

      {activePage ? (
        <PageEditor
          session={session}
          activePage={activePage}
          source={session.document.sourceOf(activePage)}
        />
      ) : (
        <main className="app__body">
          <PageGrid
            document={session.document}
            isSelected={session.selection.isSelected}
            onSelect={selectPage}
            onOpen={(page) => session.openPage(page.id)}
            onMovePage={session.movePageTo}
          />
        </main>
      )}

      {isDraggingOver && <div className="app__drop-hint">Drop files to add them</div>}
      <StatusOverlay task={session.task} />
    </div>
  );
}
