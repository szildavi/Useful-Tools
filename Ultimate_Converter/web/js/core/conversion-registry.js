/** The catalogue that answers "what can this file become, and who does it?". */

import { normaliseFormat } from './format-families.js';

export class ConversionRegistry {
  #converterByPair = new Map();
  #converters;

  constructor(converters) {
    this.#converters = converters;
    this.#indexConverters();
  }

  /** Map every declared pair to the converter that claimed it first. */
  #indexConverters() {
    for (const converter of this.#converters) {
      for (const [source, target] of converter.supportedConversionPairs()) {
        const key = pairKey(source, target);
        if (!this.#converterByPair.has(key)) {
          this.#converterByPair.set(key, converter);
        }
      }
    }
  }

  get converters() {
    return [...this.#converters];
  }

  /** Return the sorted formats `sourceFormat` can be converted into. */
  targetFormatsFor(sourceFormat, { onlyAvailable = true } = {}) {
    const source = normaliseFormat(sourceFormat);
    const targets = new Set();
    for (const [key, converter] of this.#converterByPair) {
      const [declaredSource, target] = splitPairKey(key);
      if (declaredSource === source && (converter.isAvailable() || !onlyAvailable)) {
        targets.add(target);
      }
    }
    return [...targets].sort();
  }

  /** Return every format the website can read. */
  sourceFormats({ onlyAvailable = true } = {}) {
    const sources = new Set();
    for (const [key, converter] of this.#converterByPair) {
      if (converter.isAvailable() || !onlyAvailable) {
        sources.add(splitPairKey(key)[0]);
      }
    }
    return [...sources].sort();
  }

  /** Return the converter handling one pair, or throw a clear error. */
  converterFor(sourceFormat, targetFormat) {
    const source = normaliseFormat(sourceFormat);
    const target = normaliseFormat(targetFormat);
    const converter = this.#converterByPair.get(pairKey(source, target));
    if (!converter) {
      throw new Error(`Converting .${source} to .${target} is not supported in the browser.`);
    }
    return converter;
  }

  /** Report whether a pair is known, regardless of browser support. */
  supports(sourceFormat, targetFormat) {
    return this.#converterByPair.has(
      pairKey(normaliseFormat(sourceFormat), normaliseFormat(targetFormat)),
    );
  }

  /** Return the tunable settings for one conversion. */
  optionsFor(sourceFormat, targetFormat) {
    const converter = this.converterFor(sourceFormat, targetFormat);
    return converter.declareOptions(normaliseFormat(sourceFormat), normaliseFormat(targetFormat));
  }

  /** Return how many conversions are currently on offer. */
  countConversionPairs({ onlyAvailable = true } = {}) {
    let total = 0;
    for (const converter of this.#converterByPair.values()) {
      if (converter.isAvailable() || !onlyAvailable) {
        total += 1;
      }
    }
    return total;
  }

  /** Return each converter with the number of pairs it owns. */
  conversionCountsByConverter() {
    const counts = new Map();
    for (const converter of this.#converterByPair.values()) {
      counts.set(converter, (counts.get(converter) ?? 0) + 1);
    }
    return this.#converters.map((converter) => ({
      converter,
      count: counts.get(converter) ?? 0,
    }));
  }
}

function pairKey(source, target) {
  return `${source}>${target}`;
}

function splitPairKey(key) {
  return key.split('>');
}
