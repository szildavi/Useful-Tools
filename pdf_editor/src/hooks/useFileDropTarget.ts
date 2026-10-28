import { useCallback, useState, type DragEvent } from 'react';

export interface FileDropTarget {
  readonly isDraggingOver: boolean;
  /** Spread onto the element that should accept dropped files. */
  readonly dropHandlers: {
    readonly onDragOver: (event: DragEvent) => void;
    readonly onDragEnter: (event: DragEvent) => void;
    readonly onDragLeave: (event: DragEvent) => void;
    readonly onDrop: (event: DragEvent) => void;
  };
}

/** Lets any element accept files dropped from the desktop. */
export function useFileDropTarget(onFilesDropped: (files: readonly File[]) => void): FileDropTarget {
  const [dragDepth, setDragDepth] = useState(0);

  const onDragOver = useCallback((event: DragEvent) => {
    event.preventDefault();
  }, []);

  // Dragging over child elements fires enter/leave repeatedly, so the events are
  // counted rather than treated as a simple on/off flag.
  const onDragEnter = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragDepth((depth) => depth + 1);
  }, []);

  const onDragLeave = useCallback((event: DragEvent) => {
    event.preventDefault();
    setDragDepth((depth) => Math.max(0, depth - 1));
  }, []);

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDragDepth(0);
      const files = Array.from(event.dataTransfer?.files ?? []);
      if (files.length > 0) {
        onFilesDropped(files);
      }
    },
    [onFilesDropped],
  );

  return {
    isDraggingOver: dragDepth > 0,
    dropHandlers: { onDragOver, onDragEnter, onDragLeave, onDrop },
  };
}
