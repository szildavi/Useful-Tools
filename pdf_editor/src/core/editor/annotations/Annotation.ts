import type { AnnotationId } from '../Identifiers';
import type { PointInPage, RectangleInPage } from '../geometry/PageGeometry';
import {
  boundingRectangleOf,
  rectangleContainsPoint,
} from '../geometry/PageGeometry';
import type { RgbColor } from './RgbColor';
import type { TextStyle } from './TextStyle';

export type AnnotationKind = 'drawing' | 'text-box' | 'text-replacement';

/**
 * Something the editor draws on top of an original PDF page.
 *
 * Annotations are immutable: moving or restyling one produces a new instance,
 * which keeps undo/redo and React change detection trivial. Subclasses only
 * have to describe their own geometry through `boundsInPage`.
 */
export abstract class Annotation {
  readonly id: AnnotationId;

  protected constructor(id: AnnotationId) {
    this.id = id;
  }

  abstract readonly kind: AnnotationKind;

  /** The smallest page-space rectangle containing the annotation. */
  abstract boundsInPage(): RectangleInPage;

  /** Used for hit-testing when the user clicks a page. */
  containsPoint(point: PointInPage): boolean {
    return rectangleContainsPoint(this.boundsInPage(), point);
  }

  abstract movedBy(deltaX: number, deltaY: number): Annotation;
}

/** A freehand stroke, stored as the polyline the pointer travelled. */
export class DrawingAnnotation extends Annotation {
  readonly kind = 'drawing' as const;
  readonly points: readonly PointInPage[];
  readonly color: RgbColor;
  readonly strokeWidthInPoints: number;

  constructor(
    id: AnnotationId,
    points: readonly PointInPage[],
    color: RgbColor,
    strokeWidthInPoints: number,
  ) {
    super(id);
    this.points = points;
    this.color = color;
    this.strokeWidthInPoints = strokeWidthInPoints;
  }

  boundsInPage(): RectangleInPage {
    return boundingRectangleOf(this.points);
  }

  withPointAdded(point: PointInPage): DrawingAnnotation {
    return new DrawingAnnotation(
      this.id,
      [...this.points, point],
      this.color,
      this.strokeWidthInPoints,
    );
  }

  movedBy(deltaX: number, deltaY: number): DrawingAnnotation {
    const movedPoints = this.points.map((point) => ({
      x: point.x + deltaX,
      y: point.y + deltaY,
    }));
    return new DrawingAnnotation(this.id, movedPoints, this.color, this.strokeWidthInPoints);
  }
}

/** Text the user adds to a page, anchored by the top-left corner of its box. */
export class TextBoxAnnotation extends Annotation {
  readonly kind = 'text-box' as const;
  readonly text: string;
  readonly area: RectangleInPage;
  readonly style: TextStyle;

  constructor(id: AnnotationId, text: string, area: RectangleInPage, style: TextStyle) {
    super(id);
    this.text = text;
    this.area = area;
    this.style = style;
  }

  boundsInPage(): RectangleInPage {
    return this.area;
  }

  withText(text: string): TextBoxAnnotation {
    return new TextBoxAnnotation(this.id, text, this.area, this.style);
  }

  withStyle(style: TextStyle): TextBoxAnnotation {
    return new TextBoxAnnotation(this.id, this.text, this.area, style);
  }

  withArea(area: RectangleInPage): TextBoxAnnotation {
    return new TextBoxAnnotation(this.id, this.text, area, this.style);
  }

  movedBy(deltaX: number, deltaY: number): TextBoxAnnotation {
    return this.withArea({
      ...this.area,
      x: this.area.x + deltaX,
      y: this.area.y + deltaY,
    });
  }
}

/**
 * Replaces a region of the original page's text: the region is painted over
 * with `backgroundColor` and the replacement text is written in its place.
 *
 * This is the editor's answer to "editing" text in a PDF. The original glyphs
 * are covered rather than rewritten, which works reliably across every PDF
 * regardless of how its fonts are embedded or subset.
 */
export class TextReplacementAnnotation extends Annotation {
  readonly kind = 'text-replacement' as const;
  readonly originalText: string;
  readonly text: string;
  readonly area: RectangleInPage;
  readonly style: TextStyle;
  readonly backgroundColor: RgbColor;

  constructor(
    id: AnnotationId,
    originalText: string,
    text: string,
    area: RectangleInPage,
    style: TextStyle,
    backgroundColor: RgbColor,
  ) {
    super(id);
    this.originalText = originalText;
    this.text = text;
    this.area = area;
    this.style = style;
    this.backgroundColor = backgroundColor;
  }

  boundsInPage(): RectangleInPage {
    return this.area;
  }

  withText(text: string): TextReplacementAnnotation {
    return new TextReplacementAnnotation(
      this.id,
      this.originalText,
      text,
      this.area,
      this.style,
      this.backgroundColor,
    );
  }

  withStyle(style: TextStyle): TextReplacementAnnotation {
    return new TextReplacementAnnotation(
      this.id,
      this.originalText,
      this.text,
      this.area,
      style,
      this.backgroundColor,
    );
  }

  movedBy(deltaX: number, deltaY: number): TextReplacementAnnotation {
    return new TextReplacementAnnotation(
      this.id,
      this.originalText,
      this.text,
      { ...this.area, x: this.area.x + deltaX, y: this.area.y + deltaY },
      this.style,
      this.backgroundColor,
    );
  }

  /** True when the user has not actually changed the wording yet. */
  isUnchanged(): boolean {
    return this.text === this.originalText;
  }
}
