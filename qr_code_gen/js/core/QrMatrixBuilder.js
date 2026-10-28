/**
 * Paints a QR matrix: function patterns first, then the codeword stream,
 * then the best mask and the format/version information.
 */
class QrMatrixBuilder {
  static FORMAT_INFO_GENERATOR = 0x537;
  static FORMAT_INFO_MASK = 0x5412;
  static VERSION_INFO_GENERATOR = 0x1f25;

  constructor(version, errorCorrectionLevel) {
    this.version = version;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.size = QrVersionTable.getMatrixSize(version);
    this.modules = this.createEmptyGrid();
    this.functionModules = this.createEmptyGrid();
  }

  createEmptyGrid() {
    return Array.from({ length: this.size }, () => new Array(this.size).fill(false));
  }

  build(codewords) {
    this.drawFunctionPatterns();
    this.drawCodewords(codewords);

    const maskPattern = this.selectBestMaskPattern();
    this.applyMask(maskPattern);
    this.drawFormatInformation(maskPattern);

    return { modules: this.modules, functionModules: this.functionModules, maskPattern };
  }

  // --- Function patterns -------------------------------------------------

  drawFunctionPatterns() {
    this.drawTimingPatterns();
    this.drawFinderPatternAt(3, 3);
    this.drawFinderPatternAt(this.size - 4, 3);
    this.drawFinderPatternAt(3, this.size - 4);
    this.drawAlignmentPatterns();
    this.drawFormatInformation(0); // Placeholder; redrawn once the mask is known.
    this.drawVersionInformation();
  }

  drawTimingPatterns() {
    for (let index = 0; index < this.size; index++) {
      const isDark = index % 2 === 0;
      this.setFunctionModule(6, index, isDark);
      this.setFunctionModule(index, 6, isDark);
    }
  }

  /** Draws a 7x7 finder pattern (plus its light separator) around a centre point. */
  drawFinderPatternAt(centerColumn, centerRow) {
    for (let rowOffset = -4; rowOffset <= 4; rowOffset++) {
      for (let columnOffset = -4; columnOffset <= 4; columnOffset++) {
        const ringDistance = Math.max(Math.abs(columnOffset), Math.abs(rowOffset));
        const column = centerColumn + columnOffset;
        const row = centerRow + rowOffset;
        if (this.isInsideMatrix(column, row)) {
          this.setFunctionModule(column, row, ringDistance !== 2 && ringDistance !== 4);
        }
      }
    }
  }

  drawAlignmentPatterns() {
    const positions = QrVersionTable.getAlignmentPatternPositions(this.version);
    const lastIndex = positions.length - 1;

    positions.forEach((centerRow, rowIndex) => {
      positions.forEach((centerColumn, columnIndex) => {
        if (this.overlapsFinderPattern(rowIndex, columnIndex, lastIndex)) {
          return;
        }
        this.drawAlignmentPatternAt(centerColumn, centerRow);
      });
    });
  }

  overlapsFinderPattern(rowIndex, columnIndex, lastIndex) {
    const isCorner = (a, b) => rowIndex === a && columnIndex === b;
    return isCorner(0, 0) || isCorner(0, lastIndex) || isCorner(lastIndex, 0);
  }

  drawAlignmentPatternAt(centerColumn, centerRow) {
    for (let rowOffset = -2; rowOffset <= 2; rowOffset++) {
      for (let columnOffset = -2; columnOffset <= 2; columnOffset++) {
        const ringDistance = Math.max(Math.abs(columnOffset), Math.abs(rowOffset));
        this.setFunctionModule(centerColumn + columnOffset, centerRow + rowOffset, ringDistance !== 1);
      }
    }
  }

  drawFormatInformation(maskPattern) {
    const formatData = (this.errorCorrectionLevel.formatBits << 3) | maskPattern;
    const formatBits = this.appendBchRemainder(formatData, 10, QrMatrixBuilder.FORMAT_INFO_GENERATOR);
    const maskedBits = formatBits ^ QrMatrixBuilder.FORMAT_INFO_MASK;

    for (let index = 0; index <= 5; index++) {
      this.setFunctionModule(8, index, this.readBit(maskedBits, index));
    }
    this.setFunctionModule(8, 7, this.readBit(maskedBits, 6));
    this.setFunctionModule(8, 8, this.readBit(maskedBits, 7));
    this.setFunctionModule(7, 8, this.readBit(maskedBits, 8));
    for (let index = 9; index < 15; index++) {
      this.setFunctionModule(14 - index, 8, this.readBit(maskedBits, index));
    }

    for (let index = 0; index < 8; index++) {
      this.setFunctionModule(this.size - 1 - index, 8, this.readBit(maskedBits, index));
    }
    for (let index = 8; index < 15; index++) {
      this.setFunctionModule(8, this.size - 15 + index, this.readBit(maskedBits, index));
    }
    this.setFunctionModule(8, this.size - 8, true); // The always-dark module.
  }

  drawVersionInformation() {
    if (this.version < 7) {
      return;
    }
    const versionBits = this.appendBchRemainder(this.version, 12, QrMatrixBuilder.VERSION_INFO_GENERATOR);

    for (let index = 0; index < 18; index++) {
      const isDark = this.readBit(versionBits, index);
      const farPosition = this.size - 11 + (index % 3);
      const nearPosition = Math.floor(index / 3);
      this.setFunctionModule(farPosition, nearPosition, isDark);
      this.setFunctionModule(nearPosition, farPosition, isDark);
    }
  }

  /** Shifts the value left and appends its BCH error-correction remainder. */
  appendBchRemainder(value, remainderBitCount, generator) {
    let remainder = value;
    for (let step = 0; step < remainderBitCount; step++) {
      remainder = (remainder << 1) ^ ((remainder >>> (remainderBitCount - 1)) * generator);
    }
    return (value << remainderBitCount) | remainder;
  }

  // --- Data ---------------------------------------------------------------

  /** Walks the zig-zag column pairs from bottom-right and drops in the codeword bits. */
  drawCodewords(codewords) {
    let bitIndex = 0;
    const totalBits = codewords.length * 8;

    for (let rightColumn = this.size - 1; rightColumn >= 1; rightColumn -= 2) {
      if (rightColumn === 6) {
        rightColumn = 5; // Skip the vertical timing pattern column.
      }
      for (let verticalStep = 0; verticalStep < this.size; verticalStep++) {
        for (let columnOffset = 0; columnOffset < 2; columnOffset++) {
          const column = rightColumn - columnOffset;
          const isUpward = ((rightColumn + 1) & 2) === 0;
          const row = isUpward ? this.size - 1 - verticalStep : verticalStep;

          if (!this.functionModules[row][column] && bitIndex < totalBits) {
            this.modules[row][column] = this.readBit(codewords[bitIndex >>> 3], 7 - (bitIndex & 7));
            bitIndex++;
          }
        }
      }
    }
  }

  // --- Masking ------------------------------------------------------------

  selectBestMaskPattern() {
    let bestPattern = 0;
    let lowestPenalty = Infinity;

    for (let pattern = 0; pattern < QrMaskPattern.COUNT; pattern++) {
      this.applyMask(pattern);
      this.drawFormatInformation(pattern);
      const penalty = new QrPenaltyScorer(this.modules).score();
      if (penalty < lowestPenalty) {
        lowestPenalty = penalty;
        bestPattern = pattern;
      }
      this.applyMask(pattern); // Masking twice restores the unmasked matrix.
    }
    return bestPattern;
  }

  applyMask(maskPattern) {
    for (let row = 0; row < this.size; row++) {
      for (let column = 0; column < this.size; column++) {
        if (this.functionModules[row][column]) {
          continue;
        }
        if (QrMaskPattern.shouldFlip(maskPattern, column, row)) {
          this.modules[row][column] = !this.modules[row][column];
        }
      }
    }
  }

  // --- Small helpers ------------------------------------------------------

  setFunctionModule(column, row, isDark) {
    this.modules[row][column] = isDark;
    this.functionModules[row][column] = true;
  }

  isInsideMatrix(column, row) {
    return column >= 0 && column < this.size && row >= 0 && row < this.size;
  }

  readBit(value, position) {
    return ((value >>> position) & 1) !== 0;
  }
}
