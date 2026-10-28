import { isQuarterTurn, type PageRotation } from '../../pdf/PageRotation';
import type { PageSizeInPoints, PointInPage, RectangleInPage } from './PageGeometry';

export interface PointOnScreen {
  readonly x: number;
  readonly y: number;
}

export interface RectangleOnScreen {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/**
 * Translates between the browser's pixel space (origin top-left, y grows
 * downwards) and the page's point space (origin bottom-left, y grows upwards),
 * taking the page's display rotation into account.
 *
 * This is the only place in the app that knows about the flip and the rotation,
 * so the model can stay in PDF coordinates and the components in CSS pixels.
 *
 * The rotation cases below follow from which page corner ends up at the
 * top-left of the rotated rendering, for a page of width W and height H:
 *
 *   rotation |  corner at display top-left  |  display size
 *   ---------+------------------------------+--------------
 *        0   |  top-left      (0, H)        |  W x H
 *       90   |  bottom-left   (0, 0)        |  H x W
 *      180   |  bottom-right  (W, 0)        |  W x H
 *      270   |  top-right     (W, H)        |  H x W
 */
export class PageCoordinateMapper {
  private readonly unrotatedPageSize: PageSizeInPoints;
  private readonly rotation: PageRotation;
  private readonly pointsPerPixel: number;

  constructor(
    unrotatedPageSize: PageSizeInPoints,
    renderedWidthInPixels: number,
    rotation: PageRotation,
  ) {
    this.unrotatedPageSize = unrotatedPageSize;
    this.rotation = rotation;
    const displayedWidthInPoints = isQuarterTurn(rotation)
      ? unrotatedPageSize.height
      : unrotatedPageSize.width;
    this.pointsPerPixel = displayedWidthInPoints / renderedWidthInPixels;
  }

  /** The page size as displayed, i.e. with width and height swapped on quarter turns. */
  displayedSizeInPoints(): PageSizeInPoints {
    const { width, height } = this.unrotatedPageSize;
    return isQuarterTurn(this.rotation)
      ? { width: height, height: width }
      : { width, height };
  }

  renderedHeightInPixels(): number {
    return this.displayedSizeInPoints().height / this.pointsPerPixel;
  }

  toPagePoint(screenPoint: PointOnScreen): PointInPage {
    return this.fromDisplayedToUnrotated({
      x: screenPoint.x * this.pointsPerPixel,
      y: screenPoint.y * this.pointsPerPixel,
    });
  }

  toScreenPoint(pagePoint: PointInPage): PointOnScreen {
    const displayed = this.fromUnrotatedToDisplayed(pagePoint);
    return {
      x: displayed.x / this.pointsPerPixel,
      y: displayed.y / this.pointsPerPixel,
    };
  }

  toScreenRectangle(pageRectangle: RectangleInPage): RectangleOnScreen {
    const firstCorner = this.toScreenPoint({ x: pageRectangle.x, y: pageRectangle.y });
    const oppositeCorner = this.toScreenPoint({
      x: pageRectangle.x + pageRectangle.width,
      y: pageRectangle.y + pageRectangle.height,
    });
    return {
      left: Math.min(firstCorner.x, oppositeCorner.x),
      top: Math.min(firstCorner.y, oppositeCorner.y),
      width: Math.abs(oppositeCorner.x - firstCorner.x),
      height: Math.abs(oppositeCorner.y - firstCorner.y),
    };
  }

  toScreenLength(lengthInPoints: number): number {
    return lengthInPoints / this.pointsPerPixel;
  }

  /**
   * Maps a point measured on the rotated, top-left-origin rendering back onto
   * the page's own bottom-left-origin, unrotated coordinates.
   */
  private fromDisplayedToUnrotated(displayed: PointInPage): PointInPage {
    const { width, height } = this.unrotatedPageSize;
    switch (this.rotation) {
      case 90:
        return { x: displayed.y, y: displayed.x };
      case 180:
        return { x: width - displayed.x, y: displayed.y };
      case 270:
        return { x: width - displayed.y, y: height - displayed.x };
      default:
        return { x: displayed.x, y: height - displayed.y };
    }
  }

  private fromUnrotatedToDisplayed(page: PointInPage): PointInPage {
    const { width, height } = this.unrotatedPageSize;
    switch (this.rotation) {
      case 90:
        return { x: page.y, y: page.x };
      case 180:
        return { x: width - page.x, y: page.y };
      case 270:
        return { x: height - page.y, y: width - page.x };
      default:
        return { x: page.x, y: height - page.y };
    }
  }
}
