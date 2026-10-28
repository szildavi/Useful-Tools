/**
 * The finished square grid of a QR code plus the metadata that produced it.
 */
class QrMatrix {
  constructor({ version, errorCorrectionLevel, mode, maskPattern, modules, functionModules }) {
    this.version = version;
    this.errorCorrectionLevel = errorCorrectionLevel;
    this.mode = mode;
    this.maskPattern = maskPattern;
    this.modules = modules;
    this.functionModules = functionModules;
    this.size = modules.length;
  }

  isDark(column, row) {
    return this.modules[row][column];
  }

  isFunctionModule(column, row) {
    return this.functionModules[row][column];
  }
}
