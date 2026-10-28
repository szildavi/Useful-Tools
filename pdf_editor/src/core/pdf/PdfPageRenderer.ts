import type { PdfJsDocument } from './PdfJsRuntime';
import type { PageRotation } from './PageRotation';

export interface RenderedPage {
  readonly imageUrl: string;
  readonly widthInPixels: number;
  readonly heightInPixels: number;
}

/** The area a page has to fit inside, in device pixels. */
export interface RenderBox {
  readonly maxWidthInPixels: number;
  readonly maxHeightInPixels: number;
}

/**
 * Draws a single PDF page into an off-screen canvas and returns it as a blob URL.
 *
 * Callers own the returned `imageUrl` and must pass it to `releaseRenderedPage`
 * when it is no longer displayed, otherwise the blob stays in memory.
 */
export class PdfPageRenderer {
  /**
   * Renders the page as large as it can be while still fitting the box whole.
   *
   * Fitting both dimensions - rather than scaling to a target width - is what
   * keeps a rotated page fully visible: once rotated, a portrait page becomes
   * landscape, and its width alone says nothing about whether it still fits.
   */
  async renderPageWithinBox(
    document: PdfJsDocument,
    pageNumber: number,
    box: RenderBox,
    rotation: PageRotation = 0,
  ): Promise<RenderedPage> {
    const page = await document.getPage(pageNumber);
    // The rotation the page is actually shown at: its own plus the user's.
    const displayRotation = page.rotate + rotation;
    const unscaledViewport = page.getViewport({ scale: 1, rotation: displayRotation });
    const scale = scaleToFit(unscaledViewport, box);
    const viewport = page.getViewport({ scale, rotation: displayRotation });

    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('A 2D canvas context could not be created for rendering.');
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    return {
      imageUrl: await toBlobUrl(canvas),
      widthInPixels: canvas.width,
      heightInPixels: canvas.height,
    };
  }
}

export function releaseRenderedPage(page: RenderedPage): void {
  URL.revokeObjectURL(page.imageUrl);
}

/** The larger of the two scales would overflow the box, so the smaller one wins. */
function scaleToFit(
  unscaledSize: { width: number; height: number },
  box: RenderBox,
): number {
  return Math.min(
    box.maxWidthInPixels / unscaledSize.width,
    box.maxHeightInPixels / unscaledSize.height,
  );
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

function toBlobUrl(canvas: HTMLCanvasElement): Promise<string> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(URL.createObjectURL(blob));
      } else {
        reject(new Error('The rendered page could not be converted to an image.'));
      }
    }, 'image/png');
  });
}
