import type { PageRotation } from '../pdf/PageRotation';
import { rotatedClockwise, rotatedCounterClockwise } from '../pdf/PageRotation';
import type { Annotation } from './annotations/Annotation';
import type { AnnotationId, PageId, SourceId } from './Identifiers';
import { createPageId } from './Identifiers';

/**
 * One page of the document being edited.
 *
 * A page is a *reference* into a loaded source file plus the edits layered on
 * top of it. Nothing is copied until export, so reordering, duplicating and
 * merging are all cheap, and the original bytes are never mutated.
 */
export class EditorPage {
  readonly id: PageId;
  readonly sourceId: SourceId;
  /** Zero-based index of the page inside its source file. */
  readonly sourcePageIndex: number;
  readonly rotation: PageRotation;
  readonly annotations: readonly Annotation[];

  constructor(
    id: PageId,
    sourceId: SourceId,
    sourcePageIndex: number,
    rotation: PageRotation = 0,
    annotations: readonly Annotation[] = [],
  ) {
    this.id = id;
    this.sourceId = sourceId;
    this.sourcePageIndex = sourcePageIndex;
    this.rotation = rotation;
    this.annotations = annotations;
  }

  static referencing(sourceId: SourceId, sourcePageIndex: number): EditorPage {
    return new EditorPage(createPageId(), sourceId, sourcePageIndex);
  }

  /** pdf.js numbers pages from one, while the model counts from zero. */
  pageNumberInSource(): number {
    return this.sourcePageIndex + 1;
  }

  turnedClockwise(): EditorPage {
    return this.withRotation(rotatedClockwise(this.rotation));
  }

  turnedCounterClockwise(): EditorPage {
    return this.withRotation(rotatedCounterClockwise(this.rotation));
  }

  withRotation(rotation: PageRotation): EditorPage {
    return new EditorPage(this.id, this.sourceId, this.sourcePageIndex, rotation, this.annotations);
  }

  withAnnotationAdded(annotation: Annotation): EditorPage {
    return this.withAnnotations([...this.annotations, annotation]);
  }

  withAnnotationReplaced(annotation: Annotation): EditorPage {
    return this.withAnnotations(
      this.annotations.map((existing) => (existing.id === annotation.id ? annotation : existing)),
    );
  }

  withoutAnnotation(annotationId: AnnotationId): EditorPage {
    return this.withAnnotations(
      this.annotations.filter((annotation) => annotation.id !== annotationId),
    );
  }

  withoutAnnotations(): EditorPage {
    return this.withAnnotations([]);
  }

  findAnnotation(annotationId: AnnotationId): Annotation | undefined {
    return this.annotations.find((annotation) => annotation.id === annotationId);
  }

  /**
   * Edits are drawn in the order they are stored, so the last one is on top.
   * Moving an edit within the list is what raises or lowers it, both on screen
   * and in the exported file.
   */
  withAnnotationMoved(annotationId: AnnotationId, positions: number): EditorPage {
    const currentIndex = this.annotations.findIndex(
      (annotation) => annotation.id === annotationId,
    );
    if (currentIndex < 0) {
      return this;
    }
    const targetIndex = Math.min(
      Math.max(currentIndex + positions, 0),
      this.annotations.length - 1,
    );
    if (targetIndex === currentIndex) {
      return this;
    }
    const reordered = [...this.annotations];
    const [moved] = reordered.splice(currentIndex, 1);
    reordered.splice(targetIndex, 0, moved);
    return this.withAnnotations(reordered);
  }

  hasEdits(): boolean {
    return this.annotations.length > 0 || this.rotation !== 0;
  }

  /** A copy that is an independent page, used when duplicating. */
  duplicated(): EditorPage {
    return new EditorPage(
      createPageId(),
      this.sourceId,
      this.sourcePageIndex,
      this.rotation,
      this.annotations,
    );
  }

  private withAnnotations(annotations: readonly Annotation[]): EditorPage {
    return new EditorPage(
      this.id,
      this.sourceId,
      this.sourcePageIndex,
      this.rotation,
      annotations,
    );
  }
}
