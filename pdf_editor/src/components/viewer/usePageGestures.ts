import { useCallback, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import {
  DrawingAnnotation,
  TextBoxAnnotation,
  TextReplacementAnnotation,
  type Annotation,
} from '../../core/editor/annotations/Annotation';
import { BLACK, WHITE, type RgbColor } from '../../core/editor/annotations/RgbColor';
import type { TextStyle } from '../../core/editor/annotations/TextStyle';
import { createAnnotationId } from '../../core/editor/Identifiers';
import type { PageCoordinateMapper } from '../../core/editor/geometry/PageCoordinateMapper';
import {
  rectangleContainsPoint,
  rectangleFromCorners,
  type PointInPage,
} from '../../core/editor/geometry/PageGeometry';
import type { TextLine } from '../../core/pdf/TextLineGrouper';
import type { EditorTool } from '../../state/EditorTool';
import type { ToolSettings } from '../../state/ToolSettings';

/** The smallest text box worth creating, in points. */
const MINIMUM_TEXT_BOX_SIZE = 12;

export interface PageGestureHandlers {
  readonly onPointerDown: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerMove: (event: ReactPointerEvent<HTMLElement>) => void;
  readonly onPointerUp: (event: ReactPointerEvent<HTMLElement>) => void;
}

export interface PageGestures extends PageGestureHandlers {
  /** The edit being drawn right now, shown as a preview but not yet committed. */
  readonly draft: Annotation | null;
}

/** The colours found on the page where a line of text sits. */
export interface SampledLineColors {
  readonly textColor: RgbColor;
  readonly backgroundColor: RgbColor;
}

interface PageGestureOptions {
  readonly tool: EditorTool;
  readonly toolSettings: ToolSettings;
  readonly mapper: PageCoordinateMapper | null;
  readonly annotations: readonly Annotation[];
  readonly textLines: readonly TextLine[];
  /**
   * Reads the real colours behind a line of text, so a replacement keeps the
   * original's colour and its cover matches the page rather than being white.
   */
  readonly sampleColorsOfLine: (line: TextLine) => SampledLineColors | null;
  readonly onCommit: (annotation: Annotation) => void;
  readonly onUpdate: (annotation: Annotation) => void;
  readonly onSelect: (annotation: Annotation | null) => void;
  /** Called when a new text annotation should be opened for typing. */
  readonly onRequestTyping: (annotation: Annotation) => void;
}

/**
 * Turns pointer gestures on the page into edits, according to the active tool.
 *
 * Work in progress is kept in local state and only handed to the document when
 * the gesture finishes, so a single pen stroke becomes one undo step instead of
 * hundreds.
 */
export function usePageGestures(options: PageGestureOptions): PageGestures {
  const { tool, toolSettings, mapper, annotations, textLines } = options;
  const [draft, setDraft] = useState<Annotation | null>(null);
  const gestureStart = useRef<PointInPage | null>(null);
  const draggedAnnotation = useRef<{ annotation: Annotation; from: PointInPage } | null>(null);

  const pagePointOf = useCallback(
    (event: ReactPointerEvent<HTMLElement>): PointInPage | null => {
      if (!mapper) {
        return null;
      }
      const bounds = event.currentTarget.getBoundingClientRect();
      return mapper.toPagePoint({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });
    },
    [mapper],
  );

  const startDrawing = useCallback(
    (point: PointInPage) => {
      setDraft(
        new DrawingAnnotation(
          createAnnotationId(),
          [point],
          toolSettings.strokeColor,
          toolSettings.strokeWidthInPoints,
        ),
      );
    },
    [toolSettings],
  );

  const startTextBox = useCallback((point: PointInPage) => {
    gestureStart.current = point;
  }, []);

  /**
   * Replaces the wording of the line of existing text under the pointer,
   * matching the original's size, family, weight, slant and colour so the page
   * still looks like itself afterwards.
   */
  const replaceTextLineAt = useCallback(
    (point: PointInPage) => {
      const line = textLines.find((candidate) => rectangleContainsPoint(candidate.bounds, point));
      if (!line) {
        return;
      }

      // Clicking a line that has already been replaced reopens that edit, rather
      // than stacking a second block on top of the first.
      const existing = annotations.find(
        (annotation): annotation is TextReplacementAnnotation =>
          annotation instanceof TextReplacementAnnotation && annotation.containsPoint(point),
      );
      if (existing) {
        options.onRequestTyping(existing);
        return;
      }

      const sampled = options.sampleColorsOfLine(line);
      const style: TextStyle = {
        ...line.style,
        color: sampled?.textColor ?? BLACK,
      };
      const replacement = new TextReplacementAnnotation(
        createAnnotationId(),
        line.text,
        line.text,
        line.bounds,
        style,
        sampled?.backgroundColor ?? WHITE,
      );
      options.onCommit(replacement);
      options.onRequestTyping(replacement);
    },
    [textLines, annotations, options],
  );

  const startMovingOrSelecting = useCallback(
    (point: PointInPage) => {
      // Later annotations sit on top, so the topmost hit wins.
      const hit = [...annotations].reverse().find((annotation) => annotation.containsPoint(point));
      options.onSelect(hit ?? null);
      draggedAnnotation.current = hit ? { annotation: hit, from: point } : null;
    },
    [annotations, options],
  );

  const onPointerDown = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const point = pagePointOf(event);
      if (!point) {
        return;
      }
      event.currentTarget.setPointerCapture(event.pointerId);

      switch (tool) {
        case 'draw':
          startDrawing(point);
          return;
        case 'add-text':
          startTextBox(point);
          return;
        case 'edit-text':
          replaceTextLineAt(point);
          return;
        default:
          startMovingOrSelecting(point);
      }
    },
    [tool, pagePointOf, startDrawing, startTextBox, replaceTextLineAt, startMovingOrSelecting],
  );

  const onPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const point = pagePointOf(event);
      if (!point) {
        return;
      }
      if (tool === 'draw' && draft instanceof DrawingAnnotation) {
        setDraft(draft.withPointAdded(point));
        return;
      }
      if (tool === 'add-text' && gestureStart.current) {
        setDraft(
          new TextBoxAnnotation(
            createAnnotationId(),
            '',
            rectangleFromCorners(gestureStart.current, point),
            toolSettings.textStyle,
          ),
        );
        return;
      }
      const dragged = draggedAnnotation.current;
      if (tool === 'select' && dragged) {
        options.onUpdate(
          dragged.annotation.movedBy(point.x - dragged.from.x, point.y - dragged.from.y),
        );
      }
    },
    [tool, draft, pagePointOf, toolSettings, options],
  );

  const onPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLElement>) => {
      const point = pagePointOf(event);
      event.currentTarget.releasePointerCapture(event.pointerId);

      if (tool === 'draw' && draft instanceof DrawingAnnotation) {
        // A tap with no movement is not a stroke.
        if (draft.points.length > 1) {
          options.onCommit(draft);
        }
      }

      if (tool === 'add-text' && gestureStart.current && point) {
        const area = rectangleFromCorners(gestureStart.current, point);
        const textBox = new TextBoxAnnotation(
          createAnnotationId(),
          '',
          isLargeEnough(area) ? area : defaultTextBoxAt(gestureStart.current),
          toolSettings.textStyle,
        );
        options.onCommit(textBox);
        options.onRequestTyping(textBox);
      }

      setDraft(null);
      gestureStart.current = null;
      draggedAnnotation.current = null;
    },
    [tool, draft, pagePointOf, toolSettings, options],
  );

  return { draft, onPointerDown, onPointerMove, onPointerUp };
}

function isLargeEnough(area: { width: number; height: number }): boolean {
  return area.width >= MINIMUM_TEXT_BOX_SIZE && area.height >= MINIMUM_TEXT_BOX_SIZE;
}

/** A click without a drag still gets a usable box. */
function defaultTextBoxAt(point: PointInPage) {
  const width = 220;
  const height = 28;
  return { x: point.x, y: point.y - height, width, height };
}
