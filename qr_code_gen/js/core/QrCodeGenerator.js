/**
 * Entry point of the QR core: text in, finished QrMatrix out.
 */
class QrCodeGenerator {
  /**
   * @param {string} text                     Content to encode.
   * @param {object} [settings]
   * @param {ErrorCorrectionLevel} [settings.errorCorrectionLevel]
   * @param {boolean} [settings.boostErrorCorrection] Upgrade the level for free when the data still fits.
   */
  static generate(text, settings = {}) {
    const requestedLevel = settings.errorCorrectionLevel || ErrorCorrectionLevel.MEDIUM;
    const boostErrorCorrection = settings.boostErrorCorrection !== false;

    if (text.length === 0) {
      throw new Error('There is nothing to encode yet.');
    }

    const segment = QrSegmentEncoder.encode(text);
    const version = this.findSmallestFittingVersion(segment, requestedLevel);
    const errorCorrectionLevel = boostErrorCorrection
      ? this.findStrongestFittingLevel(segment, version, requestedLevel)
      : requestedLevel;

    const codewords = QrCodewordBuilder.build(segment, version, errorCorrectionLevel);
    const drawing = new QrMatrixBuilder(version, errorCorrectionLevel).build(codewords);

    return new QrMatrix({
      version,
      errorCorrectionLevel,
      mode: segment.mode,
      maskPattern: drawing.maskPattern,
      modules: drawing.modules,
      functionModules: drawing.functionModules,
    });
  }

  static findSmallestFittingVersion(segment, errorCorrectionLevel) {
    for (let version = QrVersionTable.MIN_VERSION; version <= QrVersionTable.MAX_VERSION; version++) {
      if (this.fitsInVersion(segment, version, errorCorrectionLevel)) {
        return version;
      }
    }
    throw new Error(
      `The content is too long for a QR code at error correction level ${errorCorrectionLevel.name}. ` +
        'Shorten the text or pick a lower error correction level.'
    );
  }

  /** Uses leftover capacity to raise the error-correction level without growing the code. */
  static findStrongestFittingLevel(segment, version, requestedLevel) {
    return ErrorCorrectionLevel.listOrderedByStrength().reduce((bestLevel, candidate) => {
      const isUpgrade = candidate.isStrongerThan(bestLevel);
      return isUpgrade && this.fitsInVersion(segment, version, candidate) ? candidate : bestLevel;
    }, requestedLevel);
  }

  static fitsInVersion(segment, version, errorCorrectionLevel) {
    return segment.countTotalBits(version) <= QrVersionTable.getDataCapacityBits(version, errorCorrectionLevel);
  }
}
