import { useCallback, useMemo, useState } from 'react';
import type { Annotation } from '../core/editor/annotations/Annotation';
import { EditorDocument } from '../core/editor/EditorDocument';
import type { EditorPage } from '../core/editor/EditorPage';
import { FileOpeningService } from '../core/editor/FileOpeningService';
import type { AnnotationId, PageId } from '../core/editor/Identifiers';
import { closePdfSource } from '../core/editor/PdfSource';
import { FileDownloader, PDF_MIME_TYPE, ZIP_MIME_TYPE } from '../core/export/FileDownloader';
import {
  DocumentFormatExporter,
  mimeTypeOf,
  type ExportFormat,
} from '../core/export/DocumentFormatExporter';
import { DocumentSplitter } from '../core/export/DocumentSplitter';
import type { ImageResolution } from '../core/export/PageImageExporter';
import type { SplitStrategy } from '../core/export/SplitStrategy';
import type { EditorTool } from './EditorTool';
import { DEFAULT_TOOL_SETTINGS, type ToolSettings } from './ToolSettings';
import { useBackgroundTask, type BackgroundTaskState } from './useBackgroundTask';
import { useDocumentHistory } from './useDocumentHistory';
import { usePageSelection, type PageSelectionState } from './usePageSelection';

const fileOpeningService = new FileOpeningService();
const formatExporter = new DocumentFormatExporter();
const documentSplitter = new DocumentSplitter();
const fileDownloader = new FileDownloader();

export interface EditorSession {
  readonly document: EditorDocument;
  readonly selection: PageSelectionState;
  readonly task: BackgroundTaskState;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  readonly undo: () => void;
  readonly redo: () => void;

  readonly tool: EditorTool;
  readonly chooseTool: (tool: EditorTool) => void;
  readonly toolSettings: ToolSettings;
  readonly changeToolSettings: (changes: Partial<ToolSettings>) => void;

  readonly activePage: EditorPage | null;
  readonly openPage: (pageId: PageId) => void;
  readonly closePage: () => void;

  readonly acceptedFileExtensions: string;
  readonly openFiles: (files: readonly File[]) => Promise<void>;
  readonly closeDocument: () => void;

  readonly deleteSelectedPages: () => void;
  readonly duplicateSelectedPages: () => void;
  readonly rotateSelectedPagesClockwise: () => void;
  readonly rotateSelectedPagesCounterClockwise: () => void;
  readonly movePageTo: (pageId: PageId, targetIndex: number) => void;
  readonly reversePageOrder: () => void;

  readonly addAnnotation: (pageId: PageId, annotation: Annotation) => void;
  readonly replaceAnnotation: (pageId: PageId, annotation: Annotation) => void;
  readonly removeAnnotation: (pageId: PageId, annotationId: AnnotationId) => void;
  readonly selectedAnnotationId: AnnotationId | null;
  readonly selectAnnotation: (annotationId: AnnotationId | null) => void;
  readonly raiseAnnotation: (pageId: PageId, annotationId: AnnotationId) => void;
  readonly lowerAnnotation: (pageId: PageId, annotationId: AnnotationId) => void;

  readonly exportAs: (
    fileName: string,
    format: ExportFormat,
    imageResolution?: ImageResolution,
  ) => Promise<void>;
  readonly splitDocument: (strategy: SplitStrategy, fileName: string) => Promise<void>;
  readonly suggestedFileName: string;
}

/**
 * The application's single source of truth, wiring the document model to the UI.
 *
 * Each action is intentionally tiny: it describes one change to the document and
 * hands it to the history, which decides how to remember it.
 */
export function useEditorSession(): EditorSession {
  const history = useDocumentHistory();
  const { document, applyChange } = history;
  const selection = usePageSelection(document);
  const task = useBackgroundTask();

  const [tool, setTool] = useState<EditorTool>('select');
  const [toolSettings, setToolSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [activePageId, setActivePageId] = useState<PageId | null>(null);
  const [selectedAnnotationId, setSelectedAnnotationId] = useState<AnnotationId | null>(null);

  const activePage = useMemo(
    () => (activePageId ? document.findPage(activePageId) ?? null : null),
    [document, activePageId],
  );

  const changeToolSettings = useCallback((changes: Partial<ToolSettings>) => {
    setToolSettings((current) => ({ ...current, ...changes }));
  }, []);

  const openFiles = useCallback(
    async (files: readonly File[]) => {
      if (files.length === 0) {
        return;
      }
      await task.run(openingMessageFor(files), async () => {
        for (const file of files) {
          const source = await fileOpeningService.open(file);
          applyChange((current) => current.withSourceAppended(source));
        }
      });
    },
    [applyChange, task],
  );

  const closeDocument = useCallback(() => {
    document.allSources().forEach(closePdfSource);
    history.replaceAll(EditorDocument.empty());
    setActivePageId(null);
    setSelectedAnnotationId(null);
    selection.clear();
  }, [document, history, selection]);

  const deleteSelectedPages = useCallback(() => {
    const pageIds = selection.selectedPageIds;
    if (pageIds.length === 0) {
      return;
    }
    applyChange((current) => current.withPagesRemoved(pageIds));
    selection.clear();
  }, [applyChange, selection]);

  const duplicateSelectedPages = useCallback(() => {
    const pageIds = selection.selectedPageIds;
    applyChange((current) =>
      pageIds.reduce((document_, pageId) => document_.withPageDuplicated(pageId), current),
    );
  }, [applyChange, selection]);

  const rotateSelectedPages = useCallback(
    (turn: (page: EditorPage) => EditorPage) => {
      const pageIds = pagesToActOn(selection, activePageId);
      applyChange((current) =>
        pageIds.reduce((document_, pageId) => {
          const page = document_.findPage(pageId);
          return page ? document_.withPageReplaced(turn(page)) : document_;
        }, current),
      );
    },
    [applyChange, selection, activePageId],
  );

  const rotateSelectedPagesClockwise = useCallback(
    () => rotateSelectedPages((page) => page.turnedClockwise()),
    [rotateSelectedPages],
  );

  const rotateSelectedPagesCounterClockwise = useCallback(
    () => rotateSelectedPages((page) => page.turnedCounterClockwise()),
    [rotateSelectedPages],
  );

  const movePageTo = useCallback(
    (pageId: PageId, targetIndex: number) => {
      applyChange((current) => current.withPageMoved(pageId, targetIndex));
    },
    [applyChange],
  );

  const reversePageOrder = useCallback(() => {
    applyChange((current) => current.withPageOrder([...current.pages].reverse().map((p) => p.id)));
  }, [applyChange]);

  const changePage = useCallback(
    (pageId: PageId, change: (page: EditorPage) => EditorPage) => {
      applyChange((current) => {
        const page = current.findPage(pageId);
        return page ? current.withPageReplaced(change(page)) : current;
      });
    },
    [applyChange],
  );

  const addAnnotation = useCallback(
    (pageId: PageId, annotation: Annotation) => {
      changePage(pageId, (page) => page.withAnnotationAdded(annotation));
    },
    [changePage],
  );

  const replaceAnnotation = useCallback(
    (pageId: PageId, annotation: Annotation) => {
      changePage(pageId, (page) => page.withAnnotationReplaced(annotation));
    },
    [changePage],
  );

  const removeAnnotation = useCallback(
    (pageId: PageId, annotationId: AnnotationId) => {
      changePage(pageId, (page) => page.withoutAnnotation(annotationId));
      setSelectedAnnotationId((current) => (current === annotationId ? null : current));
    },
    [changePage],
  );

  /** Moving an edit within a page's list is what changes which one is on top. */
  const moveAnnotation = useCallback(
    (pageId: PageId, annotationId: AnnotationId, positions: number) => {
      changePage(pageId, (page) => page.withAnnotationMoved(annotationId, positions));
    },
    [changePage],
  );

  const raiseAnnotation = useCallback(
    (pageId: PageId, annotationId: AnnotationId) => moveAnnotation(pageId, annotationId, 1),
    [moveAnnotation],
  );

  const lowerAnnotation = useCallback(
    (pageId: PageId, annotationId: AnnotationId) => moveAnnotation(pageId, annotationId, -1),
    [moveAnnotation],
  );

  const suggestedFileName = useMemo(() => suggestFileNameFor(document), [document]);

  const exportAs = useCallback(
    async (fileName: string, format: ExportFormat, imageResolution?: ImageResolution) => {
      await task.run(`Building your ${format.toUpperCase()} file…`, async () => {
        const exported = await formatExporter.export(
          document,
          fileName,
          format,
          imageResolution,
        );
        fileDownloader.download(
          exported.bytes,
          exported.fileName,
          mimeTypeOf(exported, format),
        );
      });
    },
    [document, task],
  );

  const splitDocument = useCallback(
    async (strategy: SplitStrategy, fileName: string) => {
      await task.run('Splitting your document…', async () => {
        const exported = await documentSplitter.split(document, strategy, fileName);
        // Several output files arrive bundled as a single zip.
        const mimeType = exported.fileName.endsWith('.zip') ? ZIP_MIME_TYPE : PDF_MIME_TYPE;
        fileDownloader.download(exported.bytes, exported.fileName, mimeType);
      });
    },
    [document, task],
  );

  return {
    document,
    selection,
    task,
    canUndo: history.canUndo,
    canRedo: history.canRedo,
    undo: history.undo,
    redo: history.redo,
    tool,
    chooseTool: setTool,
    toolSettings,
    changeToolSettings,
    activePage,
    openPage: setActivePageId,
    closePage: useCallback(() => setActivePageId(null), []),
    acceptedFileExtensions: fileOpeningService.acceptAttributeValue(),
    openFiles,
    closeDocument,
    deleteSelectedPages,
    duplicateSelectedPages,
    rotateSelectedPagesClockwise,
    rotateSelectedPagesCounterClockwise,
    movePageTo,
    reversePageOrder,
    addAnnotation,
    replaceAnnotation,
    removeAnnotation,
    selectedAnnotationId,
    selectAnnotation: setSelectedAnnotationId,
    raiseAnnotation,
    lowerAnnotation,
    exportAs,
    splitDocument,
    suggestedFileName,
  };
}

/** Rotation applies to the selection, or to the page being viewed if nothing is selected. */
function pagesToActOn(
  selection: PageSelectionState,
  activePageId: PageId | null,
): readonly PageId[] {
  if (selection.selectedCount > 0) {
    return selection.selectedPageIds;
  }
  return activePageId ? [activePageId] : [];
}

function openingMessageFor(files: readonly File[]): string {
  return files.length === 1 ? `Opening ${files[0].name}…` : `Opening ${files.length} files…`;
}

function suggestFileNameFor(document: EditorDocument): string {
  const firstSource = document.allSources()[0];
  return firstSource ? firstSource.fileName : 'document.pdf';
}
