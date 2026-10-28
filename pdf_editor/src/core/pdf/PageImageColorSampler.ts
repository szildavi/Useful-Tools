import { BLACK, WHITE, type RgbColor } from '../editor/annotations/RgbColor';

export interface SampledColors {
  /** The colour the region is drawn on, used to cover the original text. */
  readonly backgroundColor: RgbColor;
  /** The colour of the glyphs in the region, used for the replacement text. */
  readonly textColor: RgbColor;
}

export interface RegionInImage {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Colours are bucketed before counting so anti-aliased edges group together. */
const QUANTISATION_STEP = 16;
/** Buckets smaller than this share of the region are treated as artefacts. */
const MINIMUM_MEANINGFUL_SHARE = 0.01;
/** Below this difference a region counts as one flat colour with no text in it. */
const MINIMUM_TEXT_CONTRAST = 0.08;

/**
 * Reads the actual colours out of a rendered page.
 *
 * A PDF's text colour is not reported by pdf.js's text layer, and the colour
 * behind the text is not recorded anywhere at all. Both are needed to replace
 * text convincingly: the new wording should be the colour of the old, and the
 * block covering the old text has to match the page, or a white rectangle
 * appears on a coloured background.
 *
 * Reading them from the pixels that were actually drawn works whatever the PDF
 * does internally.
 */
export class PageImageColorSampler {
  private readonly context: CanvasRenderingContext2D;
  private readonly imageWidth: number;
  private readonly imageHeight: number;

  private constructor(
    context: CanvasRenderingContext2D,
    imageWidth: number,
    imageHeight: number,
  ) {
    this.context = context;
    this.imageWidth = imageWidth;
    this.imageHeight = imageHeight;
  }

  /**
   * The image comes from a blob this app created, so the canvas stays untainted
   * and its pixels remain readable.
   */
  static async forImage(imageUrl: string): Promise<PageImageColorSampler | null> {
    const image = await loadImage(imageUrl);
    if (!image) {
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = image.naturalWidth;
    canvas.height = image.naturalHeight;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) {
      return null;
    }
    context.drawImage(image, 0, 0);
    return new PageImageColorSampler(context, canvas.width, canvas.height);
  }

  /** The size of the image being sampled, so callers can scale their regions. */
  imageSize(): { width: number; height: number } {
    return { width: this.imageWidth, height: this.imageHeight };
  }

  sampleRegion(region: RegionInImage): SampledColors {
    const pixels = this.readPixels(region);
    if (!pixels) {
      return { backgroundColor: WHITE, textColor: BLACK };
    }
    const buckets = countColorBuckets(pixels);
    if (buckets.length === 0) {
      return { backgroundColor: WHITE, textColor: BLACK };
    }
    const backgroundColor = mostCommonColorOf(buckets);
    return {
      backgroundColor,
      textColor: mostContrastingColorOf(buckets, backgroundColor),
    };
  }

  private readPixels(region: RegionInImage): Uint8ClampedArray | null {
    const left = clamp(Math.floor(region.left), 0, this.imageWidth - 1);
    const top = clamp(Math.floor(region.top), 0, this.imageHeight - 1);
    const width = clamp(Math.ceil(region.width), 1, this.imageWidth - left);
    const height = clamp(Math.ceil(region.height), 1, this.imageHeight - top);
    try {
      return this.context.getImageData(left, top, width, height).data;
    } catch {
      return null;
    }
  }
}

interface ColorBucket {
  readonly color: RgbColor;
  readonly count: number;
}

interface BucketTotals {
  count: number;
  redTotal: number;
  greenTotal: number;
  blueTotal: number;
}

/**
 * Groups similar pixels together, then reports each group's **average true
 * colour** rather than the centre of its bucket.
 *
 * Bucketing alone would round the answer by up to half a step, which is enough
 * for a block covering the original text to show as a faintly different
 * rectangle against the page. Averaging the real values inside the winning
 * group gives back the exact colour.
 */
function countColorBuckets(pixels: Uint8ClampedArray): ColorBucket[] {
  const totalsByBucket = new Map<number, BucketTotals>();

  for (let offset = 0; offset < pixels.length; offset += 4) {
    // Transparent pixels say nothing about what the page looks like.
    if (pixels[offset + 3] < 128) {
      continue;
    }
    const red = pixels[offset];
    const green = pixels[offset + 1];
    const blue = pixels[offset + 2];
    const bucket = bucketOf(red, green, blue);

    const totals = totalsByBucket.get(bucket);
    if (totals) {
      totals.count += 1;
      totals.redTotal += red;
      totals.greenTotal += green;
      totals.blueTotal += blue;
    } else {
      totalsByBucket.set(bucket, {
        count: 1,
        redTotal: red,
        greenTotal: green,
        blueTotal: blue,
      });
    }
  }

  return [...totalsByBucket.values()].map((totals) => ({
    color: {
      red: totals.redTotal / totals.count / 255,
      green: totals.greenTotal / totals.count / 255,
      blue: totals.blueTotal / totals.count / 255,
    },
    count: totals.count,
  }));
}

function bucketOf(red: number, green: number, blue: number): number {
  const quantise = (component: number) => Math.round(component / QUANTISATION_STEP);
  return (quantise(red) << 16) | (quantise(green) << 8) | quantise(blue);
}

function mostCommonColorOf(buckets: readonly ColorBucket[]): RgbColor {
  return buckets.reduce((best, candidate) => (candidate.count > best.count ? candidate : best))
    .color;
}

/**
 * The text is whichever colour differs most from the background while still
 * covering a meaningful number of pixels, which avoids picking a stray
 * anti-aliasing artefact.
 */
function mostContrastingColorOf(
  buckets: readonly ColorBucket[],
  backgroundColor: RgbColor,
): RgbColor {
  const totalPixels = buckets.reduce((sum, bucket) => sum + bucket.count, 0);
  const meaningful = buckets.filter(
    (bucket) => bucket.count >= totalPixels * MINIMUM_MEANINGFUL_SHARE,
  );
  const candidates = meaningful.length > 0 ? meaningful : buckets;

  const furthest = candidates.reduce(
    (best, candidate) => {
      const distance = colorDistance(candidate.color, backgroundColor);
      return distance > best.distance ? { color: candidate.color, distance } : best;
    },
    { color: backgroundColor, distance: 0 },
  );

  return furthest.distance < MINIMUM_TEXT_CONTRAST
    ? readableColorOn(backgroundColor)
    : furthest.color;
}

function readableColorOn(backgroundColor: RgbColor): RgbColor {
  return luminanceOf(backgroundColor) > 0.5 ? BLACK : WHITE;
}

function colorDistance(left: RgbColor, right: RgbColor): number {
  return (
    (Math.abs(left.red - right.red) +
      Math.abs(left.green - right.green) +
      Math.abs(left.blue - right.blue)) /
    3
  );
}

function luminanceOf(color: RgbColor): number {
  return 0.2126 * color.red + 0.7152 * color.green + 0.0722 * color.blue;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

function loadImage(imageUrl: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = imageUrl;
  });
}
