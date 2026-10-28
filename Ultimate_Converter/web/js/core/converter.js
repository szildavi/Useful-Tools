/** The contract every browser conversion engine implements. */

import { normaliseFormat } from './format-families.js';

export class Converter {
  /** Human readable engine name shown in the interface. */
  get displayName() {
    throw new Error('displayName must be provided by the converter.');
  }

  /**
   * Whether this converter can run inside a Web Worker.
   *
   * Anything that needs the Web Audio API has to stay on the main thread,
   * because audio contexts are not exposed to workers.
   */
  get runsInWorker() {
    return true;
  }

  /** Every [source, target] pair this converter handles. */
  declareConversionPairs() {
    throw new Error('declareConversionPairs must be provided by the converter.');
  }

  /** Settings the user may tune for one conversion. Empty when none apply. */
  declareOptions() {
    return [];
  }

  /** Report whether this browser supports everything the converter needs. */
  isAvailable() {
    return this.missingCapabilities().length === 0;
  }

  /** Return the browser features this converter needs but cannot find. */
  missingCapabilities() {
    return [];
  }

  /**
   * Convert `request.data` and return `{ blob, fileName }`.
   *
   * `request` carries `{ data, sourceFormat, targetFormat, options, fileName }`.
   */
  async convert() {
    throw new Error('convert must be provided by the converter.');
  }

  /** Declared pairs with both formats reduced to canonical spellings. */
  supportedConversionPairs() {
    return this.declareConversionPairs()
      .map(([source, target]) => [normaliseFormat(source), normaliseFormat(target)])
      .filter(([source, target]) => source !== target);
  }
}
