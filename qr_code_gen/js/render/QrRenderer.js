/**
 * Shared behaviour of every QR renderer: it turns a matrix into paths and
 * knows how to place a logo. Subclasses decide which medium they draw into.
 */
class QrRenderer {
  constructor(options) {
    this.options = options;
  }

  buildPaths(matrix) {
    return new QrPathBuilder(matrix, this.options).build();
  }

  /** Scales an image down so it fits a square box without distorting it. */
  static fitInsideSquare(imageWidth, imageHeight, boxSize) {
    const longestSide = Math.max(imageWidth, imageHeight);
    if (!longestSide) {
      return { width: boxSize, height: boxSize }; // Vector logos may not report a size.
    }
    const scale = boxSize / longestSide;
    return { width: imageWidth * scale, height: imageHeight * scale };
  }

  static buildLogoBackdropPath(area, cornerRadiusRatio) {
    const radius = area.paddedSize * cornerRadiusRatio;
    return PathGeometry.roundedRectangle(area.paddedX, area.paddedY, area.paddedSize, area.paddedSize, radius);
  }

  render() {
    throw new Error('QrRenderer.render must be implemented by a subclass');
  }
}
