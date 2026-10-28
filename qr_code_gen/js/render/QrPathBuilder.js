/**
 * Converts a QR matrix into three SVG path strings: the data modules,
 * the finder-pattern frames and the finder-pattern centres.
 * The paths are expressed in module units so any output size can reuse them.
 */
class QrPathBuilder {
  constructor(matrix, options) {
    this.matrix = matrix;
    this.options = options;
    this.offset = options.quietZoneModules;
    this.totalModules = matrix.size + options.quietZoneModules * 2;
    this.clearedArea = options.computeLogoArea(this.totalModules);
  }

  build() {
    return {
      totalModules: this.totalModules,
      bodyPath: this.buildBodyPath(),
      eyeFramePath: this.buildEyeFramePath(),
      eyeBallPath: this.buildEyeBallPath(),
    };
  }

  buildBodyPath() {
    const segments = [];
    for (let row = 0; row < this.matrix.size; row++) {
      for (let column = 0; column < this.matrix.size; column++) {
        if (!this.isBodyModule(column, row)) {
          continue;
        }
        segments.push(
          this.options.moduleShape.buildPath(
            column + this.offset,
            row + this.offset,
            this.collectNeighbours(column, row)
          )
        );
      }
    }
    return segments.join('');
  }

  buildEyeFramePath() {
    return this.eyeOrigins()
      .map(([column, row]) => this.options.eyeFrameShape.buildPath(column + this.offset, row + this.offset))
      .join('');
  }

  buildEyeBallPath() {
    return this.eyeOrigins()
      .map(([column, row]) => this.options.eyeBallShape.buildPath(column + this.offset, row + this.offset))
      .join('');
  }

  eyeOrigins() {
    const far = this.matrix.size - 7;
    return [
      [0, 0],
      [far, 0],
      [0, far],
    ];
  }

  /** Data modules exclude the finder patterns, which the eye shapes draw instead. */
  isBodyModule(column, row) {
    if (!this.matrix.isDark(column, row)) {
      return false;
    }
    if (this.isInsideFinderPattern(column, row)) {
      return false;
    }
    return !this.isCleared(column, row);
  }

  isInsideFinderPattern(column, row) {
    const far = this.matrix.size - 7;
    const inBlock = (startColumn, startRow) =>
      column >= startColumn && column < startColumn + 7 && row >= startRow && row < startRow + 7;
    return inBlock(0, 0) || inBlock(far, 0) || inBlock(0, far);
  }

  /** True when the module is hidden underneath the logo. */
  isCleared(column, row) {
    if (!this.clearedArea) {
      return false;
    }
    const left = column + this.offset;
    const top = row + this.offset;
    const area = this.clearedArea;
    return (
      left + 1 > area.paddedX &&
      left < area.paddedX + area.paddedSize &&
      top + 1 > area.paddedY &&
      top < area.paddedY + area.paddedSize
    );
  }

  collectNeighbours(column, row) {
    return {
      up: this.isBodyModuleAt(column, row - 1),
      down: this.isBodyModuleAt(column, row + 1),
      left: this.isBodyModuleAt(column - 1, row),
      right: this.isBodyModuleAt(column + 1, row),
    };
  }

  isBodyModuleAt(column, row) {
    const isInside = column >= 0 && column < this.matrix.size && row >= 0 && row < this.matrix.size;
    return isInside && this.isBodyModule(column, row);
  }
}
