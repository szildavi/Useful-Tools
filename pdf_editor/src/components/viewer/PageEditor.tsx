import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Annotation } from '../../core/editor/annotations/Annotation';
import type { EditorPage } from '../../core/editor/EditorPage';
import type { PdfSource } from '../../core/editor/PdfSource';
import { PageCoordinateMapper } from '../../core/editor/geometry/PageCoordinateMapper';
import { totalRotationOf } from '../../core/pdf/SourcePageGeometry';
import type { TextLine } from '../../core/pdf/TextLineGrouper';
import { useElementSize } from '../../hooks/useElementSize';
import { usePageImageColorSampler } from '../../hooks/usePageImageColorSampler';
import { useRenderedPage } from '../../hooks/useRenderedPage';
import { useSourcePageGeometry } from '../../hooks/useSourcePageGeometry';
import { usePageTextLines } from '../../hooks/usePageTextLines';
import type { EditorSession } from '../../state/useEditorSession';
import { AnnotationInspector } from './AnnotationInspector';
import { AnnotationLayer } from './AnnotationLayer';
import { LayerPanel } from './LayerPanel';
import { PageFilmstrip } from './PageFilmstrip';
import { ToolPalette } from './ToolPalette';
import { usePageGestures, type SampledLineColors } from './usePageGestures';
import './PageEditor.css';

/** Room left around the page so it never touches the edges of the work area. */
const WORK_AREA_PADDING_IN_PIXELS = 48;

interface PageEditorProps {
  readonly session: EditorSession;
  /** Passed in rather than read from the session so the hooks below always run. */
  readonly activePage: EditorPage;
  readonly source: PdfSource;
}

/**
 * The single-page editing view: one page shown large, with the user's edits
 * drawn over it and the tools that create them.
 */
export function PageEditor({ session, activePage, source }: PageEditorProps) {
  const editorDocument = session.document;
  const workAreaRef = useRef<HTMLDivElement>(null);
  const workAreaSize = useElementSize(workAreaRef);
  const [isTyping, setIsTyping] = useState(false);

  const availableWidth = Math.max(1, workAreaSize.widthInPixels - WORK_AREA_PADDING_IN_PIXELS);
  const availableHeight = Math.max(1, workAreaSize.heightInPixels - WORK_AREA_PADDING_IN_PIXELS);

  const { rendered, errorMessage } = useRenderedPage(
    source,
    activePage,
    availableWidth,
    availableHeight,
  );
  const geometry = useSourcePageGeometry(source, activePage);
  const textLines = usePageTextLines(source, activePage, session.tool === 'edit-text');

  /** The image is rendered at device resolution but displayed in CSS pixels. */
  const displayedWidth = rendered
    ? Math.min(availableWidth, rendered.widthInPixels)
    : 0;
  const displayedHeight = rendered
    ? (rendered.heightInPixels / rendered.widthInPixels) * displayedWidth
    : 0;

  const mapper = useMemo(() => {
    if (!geometry || displayedWidth === 0) {
      return null;
    }
    return new PageCoordinateMapper(
      geometry.unrotatedSize,
      displayedWidth,
      totalRotationOf(geometry, activePage.rotation),
    );
  }, [geometry, displayedWidth, activePage.rotation]);

  const selectedAnnotation = session.selectedAnnotationId
    ? activePage.findAnnotation(session.selectedAnnotationId) ?? null
    : null;

  const colorSampler = usePageImageColorSampler(rendered?.imageUrl ?? null);

  /**
   * The sampler works in the pixels of the rendered image, while a text line is
   * measured in page points, so the line's box is mapped to screen pixels and
   * then scaled up to the image's own resolution.
   */
  const sampleColorsOfLine = useCallback(
    (line: { bounds: Parameters<PageCoordinateMapper['toScreenRectangle']>[0] }):
      | SampledLineColors
      | null => {
      if (!colorSampler || !mapper || displayedWidth === 0) {
        return null;
      }
      const box = mapper.toScreenRectangle(line.bounds);
      const imagePixelsPerCssPixel = colorSampler.imageSize().width / displayedWidth;
      return colorSampler.sampleRegion({
        left: box.left * imagePixelsPerCssPixel,
        top: box.top * imagePixelsPerCssPixel,
        width: box.width * imagePixelsPerCssPixel,
        height: box.height * imagePixelsPerCssPixel,
      });
    },
    [colorSampler, mapper, displayedWidth],
  );

  const gestures = usePageGestures({
    tool: session.tool,
    toolSettings: session.toolSettings,
    mapper,
    annotations: activePage.annotations,
    textLines,
    sampleColorsOfLine,
    onCommit: (annotation) => session.addAnnotation(activePage.id, annotation),
    onUpdate: (annotation) => session.replaceAnnotation(activePage.id, annotation),
    onSelect: (annotation) => {
      session.selectAnnotation(annotation?.id ?? null);
      setIsTyping(false);
    },
    onRequestTyping: (annotation: Annotation) => {
      session.selectAnnotation(annotation.id);
      setIsTyping(true);
    },
  });

  // Delete removes the selected edit, unless the user is typing into it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const isEditingText =
        event.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName);
      if (isEditingText) {
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && session.selectedAnnotationId) {
        session.removeAnnotation(activePage.id, session.selectedAnnotationId);
      }
      if (event.key === 'Escape') {
        session.selectAnnotation(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [session, activePage.id]);

  const pageIndex = editorDocument.indexOfPage(activePage.id);

  return (
    <div className="page-editor">
      <PageFilmstrip session={session} />

      <div className="page-editor__main">
        <div className="page-editor__bar">
          <button type="button" className="button" onClick={session.closePage}>
            ← All pages
          </button>
          <ToolPalette
            tool={session.tool}
            onChooseTool={session.chooseTool}
            settings={session.toolSettings}
            onChangeSettings={session.changeToolSettings}
          />
          <span className="page-editor__position">
            Page {pageIndex + 1} of {editorDocument.pageCount()}
          </span>
        </div>

        <div className="page-editor__work-area" ref={workAreaRef}>
          {errorMessage && <p className="page-editor__error">{errorMessage}</p>}

          {rendered && (
            <div
              className={`page-editor__page page-editor__page--${session.tool}`}
              style={{ width: displayedWidth, height: displayedHeight }}
              onPointerDown={gestures.onPointerDown}
              onPointerMove={gestures.onPointerMove}
              onPointerUp={gestures.onPointerUp}
            >
              <img className="page-editor__image" src={rendered.imageUrl} alt="" draggable={false} />

              {mapper && (
                <AnnotationLayer
                  annotations={activePage.annotations}
                  draft={gestures.draft}
                  mapper={mapper}
                  selectedAnnotationId={session.selectedAnnotationId}
                />
              )}

              {session.tool === 'edit-text' && mapper && (
                <EditableTextHints textLines={textLines} mapper={mapper} />
              )}
            </div>
          )}
        </div>
      </div>

      <aside className="page-editor__side">
        {selectedAnnotation && (
          <AnnotationInspector
            annotation={selectedAnnotation}
            isTyping={isTyping}
            onChange={(annotation) => session.replaceAnnotation(activePage.id, annotation)}
            onRemove={() => session.removeAnnotation(activePage.id, selectedAnnotation.id)}
            onClose={() => {
              session.selectAnnotation(null);
              setIsTyping(false);
            }}
          />
        )}

        <LayerPanel
          annotations={activePage.annotations}
          selectedAnnotationId={session.selectedAnnotationId}
          onSelect={(annotationId) => {
            session.selectAnnotation(annotationId);
            setIsTyping(false);
          }}
          onRaise={(annotationId) => session.raiseAnnotation(activePage.id, annotationId)}
          onLower={(annotationId) => session.lowerAnnotation(activePage.id, annotationId)}
          onRemove={(annotationId) => session.removeAnnotation(activePage.id, annotationId)}
        />
      </aside>
    </div>
  );
}

interface EditableTextHintsProps {
  readonly textLines: readonly TextLine[];
  readonly mapper: PageCoordinateMapper;
}

/** Outlines the existing text so the user can see what is clickable. */
function EditableTextHints({ textLines, mapper }: EditableTextHintsProps) {
  return (
    <div className="text-hints" aria-hidden="true">
      {textLines.map((line, index) => {
        const box = mapper.toScreenRectangle(line.bounds);
        return (
          <span
            key={`${index}-${line.text.slice(0, 12)}`}
            className="text-hints__line"
            style={{ left: box.left, top: box.top, width: box.width, height: box.height }}
          />
        );
      })}
    </div>
  );
}
