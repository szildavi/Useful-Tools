/**
 * Checks a finished design for choices that commonly stop a QR code from
 * scanning, and reports them as plain-language hints.
 */
class ScanSafetyAdvisor {
  static MINIMUM_QUIET_ZONE_MODULES = 4;
  static MINIMUM_PIXELS_PER_MODULE = 4;
  static MINIMUM_CONTRAST_RATIO = 3;
  static LARGE_LOGO_RATIO = 0.25;

  static collectWarnings(matrix, options, pixelSize) {
    return [
      this.checkQuietZone(options),
      this.checkModuleSharpness(matrix, options, pixelSize),
      this.checkContrast(options),
      this.checkForegroundIsDarker(options),
      this.checkLogoSize(options),
      this.checkLogoErrorCorrection(matrix, options),
      this.checkTransparentBackground(options),
    ].filter((warning) => warning !== null);
  }

  static checkQuietZone(options) {
    if (options.quietZoneModules >= this.MINIMUM_QUIET_ZONE_MODULES) {
      return null;
    }
    return `The quiet zone is only ${options.quietZoneModules} modules. Scanners expect at least ${this.MINIMUM_QUIET_ZONE_MODULES} modules of empty margin.`;
  }

  static checkModuleSharpness(matrix, options, pixelSize) {
    const totalModules = matrix.size + options.quietZoneModules * 2;
    const pixelsPerModule = pixelSize / totalModules;
    if (pixelsPerModule >= this.MINIMUM_PIXELS_PER_MODULE) {
      return null;
    }
    return `Each module is only ${pixelsPerModule.toFixed(1)} px wide. Increase the export size so the code stays sharp.`;
  }

  static checkContrast(options) {
    if (options.hasTransparentBackground) {
      return null;
    }
    const ratio = ColorContrast.lowestRatioBetween(
      options.foregroundFill.listColors(),
      options.backgroundFill.listColors()
    );
    if (ratio >= this.MINIMUM_CONTRAST_RATIO) {
      return null;
    }
    return `The contrast between the pattern and the background is only ${ratio.toFixed(1)}:1. Aim for at least ${this.MINIMUM_CONTRAST_RATIO}:1.`;
  }

  static checkForegroundIsDarker(options) {
    if (options.hasTransparentBackground) {
      return null;
    }
    const foregroundLuminance = this.averageLuminance(options.foregroundFill);
    const backgroundLuminance = this.averageLuminance(options.backgroundFill);
    if (foregroundLuminance <= backgroundLuminance) {
      return null;
    }
    return 'The pattern is lighter than the background. Most scanners expect a dark pattern on a light background.';
  }

  static averageLuminance(fill) {
    const colors = fill.listColors();
    const total = colors.reduce((sum, color) => sum + ColorContrast.relativeLuminance(color), 0);
    return total / colors.length;
  }

  static checkLogoSize(options) {
    if (!options.logo || options.logo.sizeRatio <= this.LARGE_LOGO_RATIO) {
      return null;
    }
    const coverage = Math.round(options.logo.sizeRatio * 100);
    return `The logo spans ${coverage}% of the code. Above ${Math.round(this.LARGE_LOGO_RATIO * 100)}% it often becomes unreadable.`;
  }

  static checkLogoErrorCorrection(matrix, options) {
    if (!options.logo || !ErrorCorrectionLevel.QUARTILE.isStrongerThan(matrix.errorCorrectionLevel)) {
      return null;
    }
    return `A logo hides part of the pattern. Switch error correction to Q or H (currently ${matrix.errorCorrectionLevel.name}).`;
  }

  static checkTransparentBackground(options) {
    if (!options.hasTransparentBackground) {
      return null;
    }
    return 'A transparent background only scans reliably when the code is placed on a light surface.';
  }
}
