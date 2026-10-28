import {
  DrawingAnnotation,
  TextBoxAnnotation,
  TextReplacementAnnotation,
  type Annotation,
} from '../../core/editor/annotations/Annotation';
import { colorToCss } from '../../core/editor/annotations/RgbColor';
import type { AnnotationId } from '../../core/editor/Identifiers';

interface LayerPanelProps {
  readonly annotations: readonly Annotation[];
  readonly selectedAnnotationId: AnnotationId | null;
  readonly onSelect: (annotationId: AnnotationId) => void;
  readonly onRaise: (annotationId: AnnotationId) => void;
  readonly onLower: (annotationId: AnnotationId) => void;
  readonly onRemove: (annotationId: AnnotationId) => void;
}

/**
 * Lists the edits on the page so the user can see and change which one is on
 * top.
 *
 * The list runs top-most first, matching what the eye sees on the page rather
 * than the order the edits were made in.
 */
export function LayerPanel({
  annotations,
  selectedAnnotationId,
  onSelect,
  onRaise,
  onLower,
  onRemove,
}: LayerPanelProps) {
  if (annotations.length === 0) {
    return (
      <section className="layers">
        <h2 className="layers__title">Layers</h2>
        <p className="layers__empty">
          Edits you make on this page appear here, with the top-most one first.
        </p>
      </section>
    );
  }

  const topMostFirst = [...annotations].reverse();

  return (
    <section className="layers">
      <h2 className="layers__title">Layers</h2>
      <ol className="layers__list">
        {topMostFirst.map((annotation, positionFromTop) => {
          const isTopMost = positionFromTop === 0;
          const isBottomMost = positionFromTop === topMostFirst.length - 1;
          return (
            <li key={annotation.id} className="layers__item">
              <button
                type="button"
                className={`layers__select ${
                  annotation.id === selectedAnnotationId ? 'layers__select--active' : ''
                }`}
                onClick={() => onSelect(annotation.id)}
              >
                <span className="layers__swatch" style={{ background: swatchColorOf(annotation) }} />
                <span className="layers__label">{describe(annotation)}</span>
              </button>
              <span className="layers__actions">
                <button
                  type="button"
                  className="button button--icon button--quiet"
                  onClick={() => onRaise(annotation.id)}
                  disabled={isTopMost}
                  title="Bring forward"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="button button--icon button--quiet"
                  onClick={() => onLower(annotation.id)}
                  disabled={isBottomMost}
                  title="Send backward"
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="button button--icon button--quiet"
                  onClick={() => onRemove(annotation.id)}
                  title="Remove this edit"
                >
                  ✕
                </button>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function describe(annotation: Annotation): string {
  if (annotation instanceof DrawingAnnotation) {
    return 'Drawing';
  }
  if (annotation instanceof TextReplacementAnnotation) {
    return summarise(annotation.text) || `Replacing “${summarise(annotation.originalText)}”`;
  }
  if (annotation instanceof TextBoxAnnotation) {
    return summarise(annotation.text) || 'Empty text box';
  }
  return 'Edit';
}

function summarise(text: string): string {
  const singleLine = text.replace(/\s+/g, ' ').trim();
  return singleLine.length > 26 ? `${singleLine.slice(0, 26)}…` : singleLine;
}

/** A dab of the edit's own colour makes entries easy to tell apart at a glance. */
function swatchColorOf(annotation: Annotation): string {
  if (annotation instanceof DrawingAnnotation) {
    return colorToCss(annotation.color);
  }
  if (annotation instanceof TextBoxAnnotation || annotation instanceof TextReplacementAnnotation) {
    return colorToCss(annotation.style.color);
  }
  return 'var(--text-muted)';
}
