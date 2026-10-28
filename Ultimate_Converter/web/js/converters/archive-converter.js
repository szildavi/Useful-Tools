/** Archive repacking: read every entry, then write them into another container. */

import { toggleOption } from '../core/conversion-option.js';
import { Converter } from '../core/converter.js';
import { ARCHIVE_FORMATS, buildRoundTripPairs } from '../core/format-families.js';
import { readTar, readZip, transformBytes, writeTar, writeZip } from './archive-formats.js';

export class ArchiveConverter extends Converter {
  get displayName() {
    return 'Built-in archive converter';
  }

  declareConversionPairs() {
    return buildRoundTripPairs(ARCHIVE_FORMATS);
  }

  missingCapabilities() {
    return typeof CompressionStream === 'undefined' ? ['CompressionStream'] : [];
  }

  declareOptions(sourceFormat, targetFormat) {
    return targetFormat === 'zip' ? ZIP_OPTIONS : [];
  }

  async convert(request) {
    const entries = await readEntries(request);
    return { blob: await writeEntries(entries, request.targetFormat, request.options) };
  }
}

const ZIP_OPTIONS = [
  toggleOption('compress', 'Compress the entries', {
    value: true,
    helpText: 'Turn off to repack without compressing, which is much faster.',
  }),
];

/** Unpack the incoming archive into a list of named byte arrays. */
async function readEntries(request) {
  const { sourceFormat, buffer } = request;
  if (sourceFormat === 'zip') {
    return readZip(buffer);
  }
  if (sourceFormat === 'tar') {
    return readTar(buffer);
  }
  if (sourceFormat === 'tar.gz') {
    const unzipped = await transformBytes(new Uint8Array(buffer), new DecompressionStream('gzip'));
    return readTar(unzipped.buffer);
  }
  throw new Error(`Reading .${sourceFormat} archives is not supported in the browser.`);
}

/** Pack the entries into the requested container. */
async function writeEntries(entries, targetFormat, options) {
  if (targetFormat === 'zip') {
    return writeZip(entries, { compress: options.compress ?? true });
  }
  if (targetFormat === 'tar') {
    return writeTar(entries);
  }
  if (targetFormat === 'tar.gz') {
    const tarBytes = new Uint8Array(await writeTar(entries).arrayBuffer());
    const gzipped = await transformBytes(tarBytes, new CompressionStream('gzip'));
    return new Blob([gzipped], { type: 'application/gzip' });
  }
  throw new Error(`Writing .${targetFormat} archives is not supported in the browser.`);
}
