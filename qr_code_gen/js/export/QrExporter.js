/**
 * Saves a rendered QR code as a high-quality image file.
 */
class QrExporter {
  static JPG_FALLBACK_BACKGROUND = '#ffffff';
  static JPG_QUALITY = 0.95;

  constructor(matrix, options, pixelSize) {
    this.matrix = matrix;
    this.options = options;
    this.pixelSize = pixelSize;
  }

  async downloadPng(fileName) {
    const blob = await this.renderToBlob(this.options, 'image/png');
    FileDownloader.download(blob, `${fileName}.png`);
  }

  async downloadJpg(fileName) {
    const opaqueOptions = this.options.withOpaqueBackground(QrExporter.JPG_FALLBACK_BACKGROUND);
    const blob = await this.renderToBlob(opaqueOptions, 'image/jpeg', QrExporter.JPG_QUALITY);
    FileDownloader.download(blob, `${fileName}.jpg`);
  }

  downloadSvg(fileName) {
    const markup = new SvgQrRenderer(this.options).render(this.matrix, this.pixelSize);
    const blob = new Blob([markup], { type: 'image/svg+xml;charset=utf-8' });
    FileDownloader.download(blob, `${fileName}.svg`);
  }

  renderToBlob(options, mimeType, quality) {
    const canvas = document.createElement('canvas');
    new CanvasQrRenderer(options).render(canvas, this.matrix, this.pixelSize);

    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error(`This browser could not create a ${mimeType} file.`))),
        mimeType,
        quality
      );
    });
  }
}
