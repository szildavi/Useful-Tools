import { BLACK } from '../editor/annotations/RgbColor';
import type { TextStyle } from '../editor/annotations/TextStyle';
import type { RectangleInPage } from '../editor/geometry/PageGeometry';
import type { PageText, TextRun } from './PdfTextExtractor';

/**
 * One visual line of text on a page, assembled from the fragments pdf.js
 * reports.
 *
 * A PDF stores text as positioned runs with no notion of lines, and a single
 * sentence is often split across several runs. Grouping them back into lines is
 * what lets the user click a sentence and replace it as a whole, rather than
 * having to edit each fragment.
 */
export interface TextLine {
  readonly text: string;
  readonly bounds: RectangleInPage;
  /**
   * The size, family, weight and slant the line is drawn in, so replacement text
   * can match it. The colour is a placeholder: it is not recoverable from the
   * text layer and is sampled from the rendered page instead.
   */
  readonly style: TextStyle;
}

/** Runs whose baselines differ by less than this share a line. */
const BASELINE_TOLERANCE_RATIO = 0.5;
/** A horizontal gap wider than this many spaces starts a new line. */
const COLUMN_GAP_IN_SPACES = 4;

export class TextLineGrouper {
  group(pageText: PageText): TextLine[] {
    const runsInReadingOrder = [...pageText.runs].sort(byReadingOrder);
    return this.splitIntoLines(runsInReadingOrder).map(toTextLine);
  }

  private splitIntoLines(runs: readonly TextRun[]): TextRun[][] {
    const lines: TextRun[][] = [];
    let currentLine: TextRun[] = [];

    for (const run of runs) {
      const previousRun = currentLine[currentLine.length - 1];
      if (previousRun && this.belongsToSameLine(previousRun, run)) {
        currentLine.push(run);
      } else {
        if (currentLine.length > 0) {
          lines.push(currentLine);
        }
        currentLine = [run];
      }
    }
    if (currentLine.length > 0) {
      lines.push(currentLine);
    }
    return lines;
  }

  /**
   * Two runs share a line when they sit on the same baseline and are not
   * separated by a gap wide enough to mean separate columns.
   */
  private belongsToSameLine(previousRun: TextRun, run: TextRun): boolean {
    const baselineTolerance = run.fontSizeInPoints * BASELINE_TOLERANCE_RATIO;
    const isOnSameBaseline = Math.abs(previousRun.yInPoints - run.yInPoints) <= baselineTolerance;
    if (!isOnSameBaseline) {
      return false;
    }
    const gap = run.xInPoints - (previousRun.xInPoints + previousRun.widthInPoints);
    return gap <= run.fontSizeInPoints * COLUMN_GAP_IN_SPACES;
  }
}

/** Top to bottom, then left to right; y grows upwards in PDF space. */
function byReadingOrder(left: TextRun, right: TextRun): number {
  const verticalDifference = right.yInPoints - left.yInPoints;
  if (Math.abs(verticalDifference) > left.fontSizeInPoints * BASELINE_TOLERANCE_RATIO) {
    return verticalDifference;
  }
  return left.xInPoints - right.xInPoints;
}

function toTextLine(runs: readonly TextRun[]): TextLine {
  const fontSizeInPoints = mostCommonFontSizeOf(runs);
  const dominantRun = widestRunOf(runs);
  return {
    text: joinRuns(runs),
    bounds: boundsOf(runs, fontSizeInPoints),
    style: {
      fontFamily: dominantRun.fontFamily,
      fontSizeInPoints,
      color: BLACK,
      isBold: dominantRun.isBold,
      isItalic: dominantRun.isItalic,
    },
  };
}

/** The run covering the most of the line decides the style of the whole line. */
function widestRunOf(runs: readonly TextRun[]): TextRun {
  return runs.reduce((widest, run) =>
    run.widthInPoints > widest.widthInPoints ? run : widest,
  );
}

/**
 * Runs are concatenated directly unless there is a visible gap between them, in
 * which case a space is inserted - PDFs frequently omit space characters and
 * express the gap through positioning alone.
 */
function joinRuns(runs: readonly TextRun[]): string {
  return runs
    .map((run, index) => {
      if (index === 0) {
        return run.text;
      }
      const previousRun = runs[index - 1];
      const gap = run.xInPoints - (previousRun.xInPoints + previousRun.widthInPoints);
      const needsSpace = gap > run.fontSizeInPoints * 0.18 && !run.text.startsWith(' ');
      return needsSpace ? ` ${run.text}` : run.text;
    })
    .join('')
    .trim();
}

/**
 * The box covering the line, from its descenders to the top of its capitals.
 * The reported baseline is the bottom of the glyphs excluding descenders, so a
 * little room is added below it.
 */
function boundsOf(runs: readonly TextRun[], fontSizeInPoints: number): RectangleInPage {
  const left = Math.min(...runs.map((run) => run.xInPoints));
  const right = Math.max(...runs.map((run) => run.xInPoints + run.widthInPoints));
  const baseline = Math.min(...runs.map((run) => run.yInPoints));
  const tallestRun = Math.max(...runs.map((run) => run.heightInPoints));
  const descender = fontSizeInPoints * 0.22;
  return {
    x: left,
    y: baseline - descender,
    width: right - left,
    height: Math.max(tallestRun, fontSizeInPoints) + descender,
  };
}

function mostCommonFontSizeOf(runs: readonly TextRun[]): number {
  const totalWidth = runs.reduce((sum, run) => sum + run.widthInPoints, 0);
  if (totalWidth === 0) {
    return runs[0].fontSizeInPoints;
  }
  // Weighting by width lets the dominant size win over short outliers.
  const weightedSize = runs.reduce(
    (sum, run) => sum + run.fontSizeInPoints * run.widthInPoints,
    0,
  );
  return weightedSize / totalWidth;
}
