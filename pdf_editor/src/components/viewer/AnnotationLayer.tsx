import {
  DrawingAnnotation,
  TextBoxAnnotation,
  TextReplacementAnnotation,
  type Annotation,
} from '../../core/editor/annotations/Annotation';
import { colorToCss } from '../../core/editor/annotations/RgbColor';
import { cssFontFamilyOf } from '../../core/editor/annotations/TextStyle';
import type { PageCoordinateMapper } from '../../core/editor/geometry/PageCoordinateMapper';
import type { AnnotationId } from '../../core/editor/Identifiers';

interface AnnotationLayerProps {
  readonly annotations: readonly Annotation[];
  readonly draft: Annotation | null;
  readonly mapper: PageCoordinateMapper;
  readonly selectedAnnotationId: AnnotationId | null;
}

/**
 * Draws the user's edits over the page image, mirroring how the exporter will
 * paint them into the PDF.
 *
 * Edits are rendered strictly in the order the page stores them, each in its own
 * stacked element. That order is the same one the exporter paints in, so what is
 * on top here is on top in the exported file. Grouping by kind - all drawings,
 * then all text - would have put every text edit above every drawing on screen
 * while the export kept the real order, and a text edit's opaque backing would
 * appear to swallow a drawing made after it.
 */
export function AnnotationLayer({
  annotations,
  draft,
  mapper,
  selectedAnnotationId,
}: AnnotationLayerProps) {
  const visible = draft ? [...annotations, draft] : annotations;

  return (
    <div className="annotation-layer" aria-hidden="true">
      {visible.map((annotation, stackingOrder) => (
        <div
          key={annotation.id}
          className="annotation-layer__item"
          style={{ zIndex: stackingOrder + 1 }}
        >
          <AnnotationView
            annotation={annotation}
            mapper={mapper}
            isSelected={annotation.id === selectedAnnotationId}
          />
        </div>
      ))}
    </div>
  );
}

interface AnnotationViewProps {
  readonly annotation: Annotation;
  readonly mapper: PageCoordinateMapper;
  readonly isSelected: boolean;
}

function AnnotationView({ annotation, mapper, isSelected }: AnnotationViewProps) {
  if (annotation instanceof DrawingAnnotation) {
    return <DrawingView annotation={annotation} mapper={mapper} isSelected={isSelected} />;
  }
  if (annotation instanceof TextBoxAnnotation || annotation instanceof TextReplacementAnnotation) {
    return <TextView annotation={annotation} mapper={mapper} isSelected={isSelected} />;
  }
  return null;
}

interface DrawingViewProps {
  readonly annotation: DrawingAnnotation;
  readonly mapper: PageCoordinateMapper;
  readonly isSelected: boolean;
}

function DrawingView({ annotation, mapper, isSelected }: DrawingViewProps) {
  if (annotation.points.length < 2) {
    return null;
  }
  return (
    <svg className="annotation-drawing">
      <polyline
        points={toSvgPoints(annotation, mapper)}
        fill="none"
        stroke={colorToCss(annotation.color)}
        strokeWidth={mapper.toScreenLength(annotation.strokeWidthInPoints)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {isSelected && <SelectionOutline annotation={annotation} mapper={mapper} />}
    </svg>
  );
}

interface SelectionOutlineProps {
  readonly annotation: DrawingAnnotation;
  readonly mapper: PageCoordinateMapper;
}

/** Shows which stroke is selected, since a thin line is hard to see picked out. */
function SelectionOutline({ annotation, mapper }: SelectionOutlineProps) {
  const box = mapper.toScreenRectangle(annotation.boundsInPage());
  const padding = 3;
  return (
    <rect
      x={box.left - padding}
      y={box.top - padding}
      width={box.width + padding * 2}
      height={box.height + padding * 2}
      fill="none"
      stroke="var(--accent)"
      strokeWidth={1.5}
      strokeDasharray="4 3"
    />
  );
}

interface TextViewProps {
  readonly annotation: TextBoxAnnotation | TextReplacementAnnotation;
  readonly mapper: PageCoordinateMapper;
  readonly isSelected: boolean;
}

/** One text edit, positioned and styled the way it will be exported. */
function TextView({ annotation, mapper, isSelected }: TextViewProps) {
  const box = mapper.toScreenRectangle(annotation.area);
  const { style } = annotation;
  const isReplacement = annotation instanceof TextReplacementAnnotation;

  return (
    <div
      className={[
        'annotation-text',
        // A replacement stands in for a single line, so it must not wrap here
        // either, or the preview would disagree with the exported file.
        isReplacement ? 'annotation-text--single-line' : '',
        isSelected ? 'annotation-text--selected' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        // A replacement hides the original wording behind an opaque block.
        background: isReplacement ? colorToCss(annotation.backgroundColor) : 'transparent',
      }}
    >
      <span
        style={{
          color: colorToCss(style.color),
          fontFamily: cssFontFamilyOf(style),
          fontSize: mapper.toScreenLength(style.fontSizeInPoints),
          fontWeight: style.isBold ? 700 : 400,
          fontStyle: style.isItalic ? 'italic' : 'normal',
          lineHeight: 1.2,
        }}
      >
        {annotation.text}
      </span>
    </div>
  );
}

function toSvgPoints(annotation: DrawingAnnotation, mapper: PageCoordinateMapper): string {
  return annotation.points
    .map((point) => {
      const screenPoint = mapper.toScreenPoint(point);
      return `${screenPoint.x},${screenPoint.y}`;
    })
    .join(' ');
}
