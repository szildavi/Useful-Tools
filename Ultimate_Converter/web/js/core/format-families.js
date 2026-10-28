/**
 * Format families and the helpers that expand them into conversion pairs.
 *
 * This mirrors the desktop application's approach: a family is declared once
 * and turned into pairs automatically, so both directions of a conversion come
 * for free and no converter carries a hand-written table.
 */

export const CANVAS_IMAGE_FORMATS = ['png', 'jpg', 'webp'];
/** Formats the browser can both decode and encode through a canvas. */

export const CANVAS_IMAGE_SOURCE_ONLY_FORMATS = ['bmp', 'gif', 'avif', 'svg', 'ico'];
/** Formats the browser decodes but cannot encode back out. */

export const CANVAS_IMAGE_TARGET_ONLY_FORMATS = ['bmp', 'ico', 'pdf'];
/** Formats written by hand-built encoders rather than by the canvas itself. */

export const DECODABLE_AUDIO_FORMATS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac', 'opus', 'webm'];
/** Formats the Web Audio API can decode into raw samples. */

export const ENCODABLE_AUDIO_FORMATS = ['wav'];
/** Formats written by the built-in encoder. */

export const STRUCTURED_DATA_FORMATS = ['csv', 'tsv', 'json', 'xml', 'yaml'];

export const TEXT_FORMATS = ['txt', 'md', 'html'];

export const ARCHIVE_FORMATS = ['zip', 'tar', 'tar.gz'];

export const COMPRESSED_STREAM_FORMATS = ['gz'];

const FORMAT_ALIASES = {
  jpeg: 'jpg',
  tif: 'tiff',
  yml: 'yaml',
  htm: 'html',
  markdown: 'md',
  tgz: 'tar.gz',
  midi: 'mid',
  heif: 'heic',
};

/** Turn any user-supplied extension into the registry's canonical spelling. */
export function normaliseFormat(extension) {
  const cleaned = String(extension).trim().toLowerCase().replace(/^\./, '');
  return FORMAT_ALIASES[cleaned] ?? cleaned;
}

/** Return the extension of a file name, keeping `.tar.gz` style suffixes whole. */
export function formatOfFileName(fileName) {
  const lowered = fileName.toLowerCase();
  const compound = ['.tar.gz', '.tar.bz2', '.tar.xz'].find((suffix) => lowered.endsWith(suffix));
  if (compound) {
    return normaliseFormat(compound.slice(1));
  }
  const lastDot = lowered.lastIndexOf('.');
  return lastDot === -1 ? '' : normaliseFormat(lowered.slice(lastDot + 1));
}

/** Return the file name without its extension. */
export function baseNameOfFileName(fileName) {
  const format = formatOfFileName(fileName);
  if (!format) {
    return fileName;
  }
  return fileName.slice(0, fileName.length - format.length - 1);
}

/** Return every (source, target) pair, skipping same-format conversions. */
export function buildConversionPairs(sources, targets) {
  const pairs = [];
  for (const source of sources) {
    for (const target of targets) {
      if (source !== target) {
        pairs.push([source, target]);
      }
    }
  }
  return pairs;
}

/**
 * Expand a family into pairs that convert in both directions.
 *
 * `extraSources` are formats that can only be read, `extraTargets` formats that
 * can only be written.
 */
export function buildRoundTripPairs(formats, { extraSources = [], extraTargets = [] } = {}) {
  const readable = [...new Set([...formats, ...extraSources])];
  const writable = [...new Set([...formats, ...extraTargets])];
  return buildConversionPairs(readable, writable);
}
