import type { PageSizeInPoints } from '../editor/geometry/PageGeometry';
import { normalizeRotation, type PageRotation } from './PageRotation';
import type { PdfJsDocument } from './PdfJsRuntime';

export interface SourcePageGeometry {
  /** The page box as authored, ignoring any rotation recorded in the PDF. */
  readonly unrotatedSize: PageSizeInPoints;
  /** The rotation the PDF itself asks viewers to apply. */
  readonly intrinsicRotation: PageRotation;
}

/**
 * Reads the geometry the editor needs to place edits on a page.
 *
 * Annotations are stored in the page's unrotated coordinate space, which is the
 * space PDF content streams use. Both the on-screen overlay and the exporter
 * therefore need the same two facts about a page, and both must combine the
 * PDF's own rotation with the rotation the user applied. Reading them in one
 * place keeps those two paths from drifting apart.
 */
export class SourcePageGeometryReader {
  async read(document: PdfJsDocument, pageNumber: number): Promise<SourcePageGeometry> {
    const page = await document.getPage(pageNumber);
    const unrotatedViewport = page.getViewport({ scale: 1, rotation: 0 });
    return {
      unrotatedSize: {
        width: unrotatedViewport.width,
        height: unrotatedViewport.height,
      },
      intrinsicRotation: normalizeRotation(page.rotate),
    };
  }
}

/** The rotation a page is actually displayed at: the PDF's own plus the user's. */
export function totalRotationOf(
  geometry: SourcePageGeometry,
  editorRotation: PageRotation,
): PageRotation {
  return normalizeRotation(geometry.intrinsicRotation + editorRotation);
}
