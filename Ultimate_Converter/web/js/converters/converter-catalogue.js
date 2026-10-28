/**
 * The one place that decides which browser converters exist and who wins a tie.
 *
 * Order matters: when two converters declare the same format pair the first one
 * listed keeps it, so more specialised engines are registered ahead of general
 * purpose ones.
 */

import { ConversionRegistry } from '../core/conversion-registry.js';
import { ArchiveConverter } from './archive-converter.js';
import { AudioConverter } from './audio-converter.js';
import { DataConverter } from './data-converter.js';
import { ImageConverter } from './image-converter.js';
import { TextConverter } from './text-converter.js';

/** Return every browser converter in priority order. */
export function buildAllConverters() {
  return [
    new ImageConverter(),
    new AudioConverter(),
    new DataConverter(),
    new TextConverter(),
    new ArchiveConverter(),
  ];
}

/** Return the registry the website runs on. */
export function buildConversionRegistry() {
  return new ConversionRegistry(buildAllConverters());
}
