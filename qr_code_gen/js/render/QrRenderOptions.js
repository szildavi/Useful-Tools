/**
 * Every visual choice a rendered QR code can have, with sensible defaults.
 * Both renderers and the exporter read their settings from here.
 */
class QrRenderOptions {
  constructor(settings = {}) {
    this.quietZoneModules = settings.quietZoneModules ?? 4;

    this.moduleShape = settings.moduleShape || MODULE_SHAPES.create('square');
    this.eyeFrameShape = settings.eyeFrameShape || EYE_FRAME_SHAPES.create('square');
    this.eyeBallShape = settings.eyeBallShape || EYE_BALL_SHAPES.create('square');

    this.foregroundFill = settings.foregroundFill || new SolidColorFill('#101828');
    this.backgroundFill = settings.backgroundFill || new SolidColorFill('#ffffff');
    this.hasTransparentBackground = settings.hasTransparentBackground ?? false;
    this.eyeFrameFill = settings.eyeFrameFill || this.foregroundFill;
    this.eyeBallFill = settings.eyeBallFill || this.foregroundFill;

    this.logo = settings.logo || null;
  }

  /**
   * Where the logo sits, in module units, or null when there is no logo.
   * The padded area is the space cleared of QR modules.
   */
  computeLogoArea(totalModules) {
    if (!this.logo) {
      return null;
    }
    const size = totalModules * this.logo.sizeRatio;
    const padding = this.logo.paddingModules;
    const paddedSize = size + padding * 2;
    return {
      x: (totalModules - size) / 2,
      y: (totalModules - size) / 2,
      size,
      paddedX: (totalModules - paddedSize) / 2,
      paddedY: (totalModules - paddedSize) / 2,
      paddedSize,
    };
  }

  /** A copy that always paints an opaque background, used for formats without alpha. */
  withOpaqueBackground(fallbackColor) {
    return new QrRenderOptions({
      ...this,
      hasTransparentBackground: false,
      backgroundFill: this.hasTransparentBackground ? new SolidColorFill(fallbackColor) : this.backgroundFill,
    });
  }
}
