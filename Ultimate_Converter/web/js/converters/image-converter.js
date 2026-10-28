/** Raster image conversion using the browser's own image decoder and canvas. */

import {
  AUTOMATIC,
  choiceOption,
  integerOption,
  isAutomatic,
  toggleOption,
} from '../core/conversion-option.js';
import { Converter } from '../core/converter.js';
import {
  CANVAS_IMAGE_FORMATS,
  CANVAS_IMAGE_SOURCE_ONLY_FORMATS,
  CANVAS_IMAGE_TARGET_ONLY_FORMATS,
  buildRoundTripPairs,
} from '../core/format-families.js';
import { encodeBmp, encodeIco, encodeSingleImagePdf, fitsInIcoDirectory } from './image-encoders.js';

const CANVAS_MIME_TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  webp: 'image/webp',
};

const FORMATS_WITHOUT_TRANSPARENCY = ['jpg', 'bmp', 'pdf'];

const LOSSY_FORMATS = ['jpg', 'webp'];

export class ImageConverter extends Converter {
  get displayName() {
    return 'Canvas image converter';
  }

  declareConversionPairs() {
    return buildRoundTripPairs(CANVAS_IMAGE_FORMATS, {
      extraSources: CANVAS_IMAGE_SOURCE_ONLY_FORMATS,
      extraTargets: CANVAS_IMAGE_TARGET_ONLY_FORMATS,
    });
  }

  missingCapabilities() {
    const missing = [];
    if (typeof OffscreenCanvas === 'undefined') {
      missing.push('OffscreenCanvas');
    }
    if (typeof createImageBitmap === 'undefined') {
      missing.push('createImageBitmap');
    }
    return missing;
  }

  declareOptions(sourceFormat, targetFormat) {
    if (targetFormat === 'ico') {
      return [ICON_SIZE_OPTION];
    }
    const options = [...GEOMETRY_OPTIONS];
    if (LOSSY_FORMATS.includes(targetFormat)) {
      options.unshift(QUALITY_OPTION);
    }
    if (FORMATS_WITHOUT_TRANSPARENCY.includes(targetFormat)) {
      options.push(BACKGROUND_COLOUR_OPTION);
    }
    return options;
  }

  async convert(request) {
    const bitmap = await decodeImage(request);
    try {
      return await this.#encode(bitmap, request);
    } finally {
      bitmap.close();
    }
  }

  /** Pick the encoder that matches the requested output format. */
  async #encode(bitmap, request) {
    const { targetFormat, options } = request;
    if (targetFormat === 'ico') {
      return { blob: await buildIcon(bitmap, options) };
    }
    const canvas = drawTransformedImage(bitmap, options, targetFormat);
    if (targetFormat === 'bmp') {
      return { blob: encodeBmp(readPixels(canvas)) };
    }
    if (targetFormat === 'pdf') {
      return { blob: await buildPdf(canvas, options) };
    }
    return { blob: await encodeWithCanvas(canvas, targetFormat, options) };
  }
}

const QUALITY_OPTION = integerOption('quality', 'Quality', {
  value: 90,
  minimum: 1,
  maximum: 100,
  helpText: 'Higher keeps more detail and makes a larger file.',
});

const BACKGROUND_COLOUR_OPTION = choiceOption(
  'backgroundColour',
  'Background behind transparency',
  [
    ['White', '#ffffff'],
    ['Black', '#000000'],
    ['Light grey', '#f0f0f0'],
    ['Magenta (checking tool)', '#ff00ff'],
  ],
  'This format cannot store transparency, so it must be filled in.',
);

const ICON_SIZE_OPTION = choiceOption('iconSizes', 'Icon sizes', [
  ['16, 32, 48, 256 px (full set)', '16,32,48,256'],
  ['16, 32, 48 px (classic)', '16,32,48'],
  ['256 px only', '256'],
  ['32 px only', '32'],
]);

const GEOMETRY_OPTIONS = [
  choiceOption(
    'resize',
    'Resize',
    [
      ['Keep original size', AUTOMATIC],
      ['Fit within 3840 px', '3840'],
      ['Fit within 1920 px', '1920'],
      ['Fit within 1280 px', '1280'],
      ['Fit within 800 px', '800'],
      ['Fit within 400 px', '400'],
    ],
    'Images smaller than the limit are left untouched.',
  ),
  choiceOption('rotate', 'Rotate', [
    ['None', AUTOMATIC],
    ['90 degrees right', '90'],
    ['180 degrees', '180'],
    ['90 degrees left', '270'],
  ]),
  toggleOption('flipHorizontally', 'Flip horizontally'),
];

/** Decode the incoming bytes into a bitmap the canvas can draw. */
async function decodeImage(request) {
  const blob = new Blob([request.buffer], { type: guessSourceMimeType(request.sourceFormat) });
  try {
    return await createImageBitmap(blob);
  } catch (error) {
    throw new Error(`This browser cannot decode .${request.sourceFormat} images.`);
  }
}

function guessSourceMimeType(sourceFormat) {
  const mimeTypes = {
    png: 'image/png',
    jpg: 'image/jpeg',
    webp: 'image/webp',
    bmp: 'image/bmp',
    gif: 'image/gif',
    avif: 'image/avif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
  };
  return mimeTypes[sourceFormat] ?? 'application/octet-stream';
}

/** Draw the bitmap onto a canvas, applying resize, rotation and flipping. */
function drawTransformedImage(bitmap, options, targetFormat) {
  const scale = resolveScale(bitmap, options.resize);
  const rotationDegrees = isAutomatic(options.rotate) ? 0 : Number(options.rotate ?? 0);
  const scaledWidth = Math.max(1, Math.round(bitmap.width * scale));
  const scaledHeight = Math.max(1, Math.round(bitmap.height * scale));
  const isQuarterTurn = rotationDegrees === 90 || rotationDegrees === 270;
  const canvas = new OffscreenCanvas(
    isQuarterTurn ? scaledHeight : scaledWidth,
    isQuarterTurn ? scaledWidth : scaledHeight,
  );
  const context = canvas.getContext('2d');
  paintBackground(context, canvas, options, targetFormat);
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate((rotationDegrees * Math.PI) / 180);
  context.scale(options.flipHorizontally ? -1 : 1, 1);
  context.drawImage(bitmap, -scaledWidth / 2, -scaledHeight / 2, scaledWidth, scaledHeight);
  return canvas;
}

/** Return the factor that fits the image inside the chosen limit. */
function resolveScale(bitmap, resize) {
  if (isAutomatic(resize) || !resize) {
    return 1;
  }
  const limit = Number(resize);
  const longestEdge = Math.max(bitmap.width, bitmap.height);
  return longestEdge <= limit ? 1 : limit / longestEdge;
}

/** Fill formats that cannot store transparency with the chosen colour. */
function paintBackground(context, canvas, options, targetFormat) {
  if (!FORMATS_WITHOUT_TRANSPARENCY.includes(targetFormat)) {
    return;
  }
  context.fillStyle = options.backgroundColour ?? '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
}

function readPixels(canvas) {
  return canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height);
}

async function encodeWithCanvas(canvas, targetFormat, options) {
  const type = CANVAS_MIME_TYPES[targetFormat];
  const blob = await canvas.convertToBlob({ type, quality: (options.quality ?? 90) / 100 });
  if (blob.type !== type) {
    throw new Error(`This browser cannot write .${targetFormat} images.`);
  }
  return blob;
}

/** Render the image at each requested icon size and pack them into one ICO. */
async function buildIcon(bitmap, options) {
  const edges = String(options.iconSizes ?? '16,32,48,256')
    .split(',')
    .map((edge) => Number(edge.trim()))
    .filter((edge) => edge > 0 && fitsInIcoDirectory(edge));
  const entries = await Promise.all(edges.map((edge) => renderIconEntry(bitmap, edge)));
  return encodeIco(entries);
}

async function renderIconEntry(bitmap, edge) {
  const canvas = new OffscreenCanvas(edge, edge);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, edge, edge);
  const blob = await canvas.convertToBlob({ type: 'image/png' });
  return { edge, bytes: new Uint8Array(await blob.arrayBuffer()) };
}

/** Encode the canvas as JPEG and wrap it in a one-page PDF. */
async function buildPdf(canvas, options) {
  const jpegBlob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: (options.quality ?? 90) / 100,
  });
  const jpegBytes = new Uint8Array(await jpegBlob.arrayBuffer());
  return encodeSingleImagePdf(jpegBytes, canvas.width, canvas.height);
}
