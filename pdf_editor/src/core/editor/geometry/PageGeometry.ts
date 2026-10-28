/**
 * All editor geometry is expressed in PDF points with the origin at the page's
 * bottom-left corner - the PDF's own coordinate system. Keeping a single
 * convention in the model means only the view layer has to convert, and the
 * exporter can write coordinates straight through.
 */
export interface PointInPage {
  readonly x: number;
  readonly y: number;
}

export interface RectangleInPage {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface PageSizeInPoints {
  readonly width: number;
  readonly height: number;
}

export function rectangleFromCorners(start: PointInPage, end: PointInPage): RectangleInPage {
  return {
    x: Math.min(start.x, end.x),
    y: Math.min(start.y, end.y),
    width: Math.abs(end.x - start.x),
    height: Math.abs(end.y - start.y),
  };
}

export function boundingRectangleOf(points: readonly PointInPage[]): RectangleInPage {
  if (points.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

export function rectangleContainsPoint(
  rectangle: RectangleInPage,
  point: PointInPage,
): boolean {
  return (
    point.x >= rectangle.x &&
    point.x <= rectangle.x + rectangle.width &&
    point.y >= rectangle.y &&
    point.y <= rectangle.y + rectangle.height
  );
}
