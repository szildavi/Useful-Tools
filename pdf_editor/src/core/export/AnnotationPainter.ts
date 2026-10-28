import { rgb, type PDFPage } from 'pdf-lib';
import type {
  Annotation,
  AnnotationKind,
} from '../editor/annotations/Annotation';
import {
  DrawingAnnotation,
  TextBoxAnnotation,
  TextReplacementAnnotation,
} from '../editor/annotations/Annotation';
import type { RgbColor } from '../editor/annotations/RgbColor';
import type { RectangleInPage } from '../editor/geometry/PageGeometry';
import type { TextStyle } from '../editor/annotations/TextStyle';
import type { PdfFontProvider } from './PdfFontProvider';
import { TextLineWrapper } from './TextLineWrapper';

/** How much of the font size sits above the baseline, used to place the first line. */
const BASELINE_OFFSET_RATIO = 0.8;
const LINE_HEIGHT_RATIO = 1.2;

/**
 * Draws one kind of annotation onto an exported PDF page.
 *
 * A painter exists per annotation kind so that adding a new annotation type
 * means adding one painter, without touching the exporter.
 */
export abstract class AnnotationPainter<TAnnotation extends Annotation> {
  abstract paint(
    annotation: TAnnotation,
    page: PDFPage,
    fonts: PdfFontProvider,
  ): Promise<void>;
}

class DrawingPainter extends AnnotationPainter<DrawingAnnotation> {
  async paint(annotation: DrawingAnnotation, page: PDFPage): Promise<void> {
    const { points } = annotation;
    if (points.length < 2) {
      return;
    }
    for (let index = 1; index < points.length; index += 1) {
      page.drawLine({
        start: points[index - 1],
        end: points[index],
        thickness: annotation.strokeWidthInPoints,
        color: toPdfColor(annotation.color),
        lineCap: 1, // round, so joined segments look like one smooth stroke
      });
    }
  }
}

class TextBoxPainter extends AnnotationPainter<TextBoxAnnotation> {
  async paint(
    annotation: TextBoxAnnotation,
    page: PDFPage,
    fonts: PdfFontProvider,
  ): Promise<void> {
    // A box the user drew is a paragraph, so its text wraps inside it.
    await paintTextInArea(annotation.text, annotation.area, annotation.style, page, fonts, true);
  }
}

class TextReplacementPainter extends AnnotationPainter<TextReplacementAnnotation> {
  async paint(
    annotation: TextReplacementAnnotation,
    page: PDFPage,
    fonts: PdfFontProvider,
  ): Promise<void> {
    coverArea(annotation.area, annotation.backgroundColor, page);
    // A replacement stands in for one line of the page, so it stays on one line
    // and runs on past the original if the substituted font is wider, rather
    // than wrapping and pushing itself down over whatever follows.
    await paintTextInArea(annotation.text, annotation.area, annotation.style, page, fonts, false);
  }
}

/** Hides the original content of a region by painting an opaque rectangle over it. */
function coverArea(area: RectangleInPage, color: RgbColor, page: PDFPage): void {
  page.drawRectangle({
    x: area.x,
    y: area.y,
    width: area.width,
    height: area.height,
    color: toPdfColor(color),
  });
}

/**
 * Writes text into a page-space rectangle, starting at its top edge and flowing
 * downwards, mirroring how the on-screen overlay lays it out.
 *
 * With `wrapToWidth` off, only the line breaks the user typed create new lines.
 */
async function paintTextInArea(
  text: string,
  area: RectangleInPage,
  style: TextStyle,
  page: PDFPage,
  fonts: PdfFontProvider,
  wrapToWidth: boolean,
): Promise<void> {
  if (text.trim().length === 0) {
    return;
  }
  const font = await fonts.fontFor(style);
  const wrapper = new TextLineWrapper(font, style.fontSizeInPoints);
  const lines = wrapToWidth ? wrapper.wrapToWidth(text, area.width) : text.split('\n');
  const lineHeight = style.fontSizeInPoints * LINE_HEIGHT_RATIO;
  const topOfArea = area.y + area.height;

  lines.forEach((line, lineIndex) => {
    page.drawText(line, {
      x: area.x,
      y: topOfArea - style.fontSizeInPoints * BASELINE_OFFSET_RATIO - lineIndex * lineHeight,
      size: style.fontSizeInPoints,
      font,
      color: toPdfColor(style.color),
    });
  });
}

function toPdfColor(color: RgbColor) {
  return rgb(color.red, color.green, color.blue);
}

/**
 * Chooses the painter for an annotation. Kept as a single lookup so the
 * exporter never branches on annotation kinds itself.
 */
export class AnnotationPainterRegistry {
  private readonly paintersByKind: Record<
    AnnotationKind,
    AnnotationPainter<never>
  > = {
    drawing: new DrawingPainter(),
    'text-box': new TextBoxPainter(),
    'text-replacement': new TextReplacementPainter(),
  };

  async paintOnto(
    annotation: Annotation,
    page: PDFPage,
    fonts: PdfFontProvider,
  ): Promise<void> {
    const painter = this.paintersByKind[annotation.kind] as AnnotationPainter<Annotation>;
    await painter.paint(annotation, page, fonts);
  }
}
