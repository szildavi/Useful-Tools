/**
 * Reads the control panel and turns it into a design description that the
 * generator, the renderers and the exporter all understand.
 */
class QrFormReader {
  static DEFAULT_FILE_NAME = 'qr-code';

  constructor(elements) {
    this.elements = elements;
  }

  read(logo) {
    return {
      text: this.elements.content.value,
      errorCorrectionLevel: ErrorCorrectionLevel.fromName(this.elements.errorCorrection.value),
      boostErrorCorrection: this.elements.boostErrorCorrection.checked,
      pixelSize: this.readNumber(this.elements.outputSize, 1024, 64, 8192),
      fileName: this.readFileName(),
      renderOptions: this.readRenderOptions(logo),
    };
  }

  readRenderOptions(logo) {
    const foregroundFill = this.readForegroundFill();
    return new QrRenderOptions({
      quietZoneModules: this.readNumber(this.elements.quietZone, 4, 0, 16),
      moduleShape: MODULE_SHAPES.create(this.elements.moduleShape.value),
      eyeFrameShape: EYE_FRAME_SHAPES.create(this.elements.eyeFrameShape.value),
      eyeBallShape: EYE_BALL_SHAPES.create(this.elements.eyeBallShape.value),
      foregroundFill,
      backgroundFill: new SolidColorFill(this.elements.backgroundColor.value),
      hasTransparentBackground: this.elements.backgroundTransparent.checked,
      eyeFrameFill: this.readEyeFill(this.elements.eyeFrameColor, foregroundFill),
      eyeBallFill: this.readEyeFill(this.elements.eyeBallColor, foregroundFill),
      logo: this.readLogoSettings(logo),
    });
  }

  readForegroundFill() {
    if (this.elements.foregroundType.value !== 'gradient') {
      return new SolidColorFill(this.elements.foregroundColor.value);
    }
    return new LinearGradientFill(
      this.elements.foregroundColor.value,
      this.elements.foregroundColorEnd.value,
      this.readNumber(this.elements.foregroundAngle, 45, -360, 360)
    );
  }

  readEyeFill(colorElement, foregroundFill) {
    if (!this.elements.customEyeColors.checked) {
      return foregroundFill;
    }
    return new SolidColorFill(colorElement.value);
  }

  readLogoSettings(logo) {
    if (!logo) {
      return null;
    }
    return {
      image: logo.image,
      dataUrl: logo.dataUrl,
      sizeRatio: this.readNumber(this.elements.logoSize, 20, 5, 40) / 100,
      paddingModules: this.readNumber(this.elements.logoPadding, 1, 0, 6),
      hasBackdrop: this.elements.logoBackdrop.checked,
      backdropFill: new SolidColorFill(this.elements.logoBackdropColor.value),
      cornerRadiusRatio: this.readNumber(this.elements.logoCornerRadius, 15, 0, 50) / 100,
    };
  }

  readNumber(element, fallback, minimum, maximum) {
    const value = Number(element.value);
    if (!Number.isFinite(value)) {
      return fallback;
    }
    return Math.min(Math.max(value, minimum), maximum);
  }

  /** Keeps the download name safe for every operating system. */
  readFileName() {
    const typed = this.elements.fileName.value.trim();
    const safe = typed.replace(/[\\/:*?"<>|]/g, '-').replace(/\.+$/, '');
    return safe || QrFormReader.DEFAULT_FILE_NAME;
  }
}
