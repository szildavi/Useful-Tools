import { fileNameWithoutExtension } from '../conversion/FileFormat';
import { PdfDocumentLoader } from '../pdf/PdfDocumentLoader';
import type { PdfJsDocument } from '../pdf/PdfJsRuntime';
import type { ExportedFile } from './PdfExporter';

/** How much detail the exported images carry. */
export type ImageResolution = 'screen' | 'print' | 'high';

export interface ImageResolutionDescription {
  readonly resolution: ImageResolution;
  readonly label: string;
  readonly dotsPerInch: number;
}

export const IMAGE_RESOLUTIONS: readonly ImageResolutionDescription[] = [
  { resolution: 'screen', label: 'Screen — 96 DPI', dotsPerInch: 96 },
  { resolution: 'print', label: 'Print — 150 DPI', dotsPerInch: 150 },
  { resolution: 'high', label: 'High — 300 DPI', dotsPerInch: 300 },
];

export type ImageFormat = 'png' | 'jpg';

/** A PDF point is 1/72 inch, which is what turns a DPI into a render scale. */
const POINTS_PER_INCH = 72;
const JPEG_QUALITY = 0.92;

/**
 * Turns the edited document into one image per page.
 *
 * The images are rendered from the *exported* PDF rather than from the original
 * files, which is what makes drawings and replaced text appear in them. Anything
 * that shows up in the exported PDF shows up here too, and there is no second
 * drawing path that could disagree with it.
 */
export class PageImageExporter {
  private readonly loader = new PdfDocumentLoader();

  async export(
    exportedPdf: ExportedFile,
    format: ImageFormat,
    resolution: ImageResolution,
  ): Promise<readonly ExportedFile[]> {
    const pdfDocument = await this.loader.load(exportedPdf.bytes);
    const baseName = fileNameWithoutExtension(exportedPdf.fileName);
    const scale = scaleFor(resolution);

    try {
      const images: ExportedFile[] = [];
      for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        images.push(await this.renderPage(pdfDocument, pageNumber, baseName, format, scale));
      }
      return images;
    } finally {
      await pdfDocument.destroy();
    }
  }

  private async renderPage(
    pdfDocument: PdfJsDocument,
    pageNumber: number,
    baseName: string,
    format: ImageFormat,
    scale: number,
  ): Promise<ExportedFile> {
    const page = await pdfDocument.getPage(pageNumber);
    const viewport = page.getViewport({ scale });
    const canvas = createCanvas(viewport.width, viewport.height);
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('A canvas for the exported image could not be created.');
    }

    // JPEG cannot store transparency, so the page background is painted first;
    // without this, unpainted areas would come out black.
    if (format === 'jpg') {
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, canvas.width, canvas.height);
    }

    await page.render({ canvas, canvasContext: context, viewport }).promise;

    return {
      bytes: await toImageBytes(canvas, format),
      fileName: `${baseName}-page-${pageNumber}.${format}`,
    };
  }
}

function scaleFor(resolution: ImageResolution): number {
  const chosen =
    IMAGE_RESOLUTIONS.find((option) => option.resolution === resolution) ?? IMAGE_RESOLUTIONS[0];
  return chosen.dotsPerInch / POINTS_PER_INCH;
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.floor(width));
  canvas.height = Math.max(1, Math.floor(height));
  return canvas;
}

async function toImageBytes(canvas: HTMLCanvasElement, format: ImageFormat): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(
      resolve,
      imageMimeTypeFor(format),
      format === 'jpg' ? JPEG_QUALITY : undefined,
    );
  });
  if (!blob) {
    throw new Error('The page could not be turned into an image.');
  }
  return new Uint8Array(await blob.arrayBuffer());
}

export function imageMimeTypeFor(format: ImageFormat): string {
  return format === 'png' ? 'image/png' : 'image/jpeg';
}
