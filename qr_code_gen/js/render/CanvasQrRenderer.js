/**
 * Draws a QR code onto a canvas at any pixel size, which is what both the
 * live preview and the PNG/JPG exports use.
 */
class CanvasQrRenderer extends QrRenderer {
  render(canvas, matrix, pixelSize) {
    const paths = this.buildPaths(matrix);
    const totalModules = paths.totalModules;

    canvas.width = pixelSize;
    canvas.height = pixelSize;

    const context = canvas.getContext('2d');
    context.clearRect(0, 0, pixelSize, pixelSize);
    context.imageSmoothingQuality = 'high';

    context.save();
    context.scale(pixelSize / totalModules, pixelSize / totalModules);
    this.paintBackground(context, totalModules);
    this.paintPath(context, paths.bodyPath, this.options.foregroundFill, totalModules);
    this.paintPath(context, paths.eyeFramePath, this.options.eyeFrameFill, totalModules);
    this.paintPath(context, paths.eyeBallPath, this.options.eyeBallFill, totalModules);
    this.paintLogo(context, totalModules);
    context.restore();

    return canvas;
  }

  paintBackground(context, totalModules) {
    if (this.options.hasTransparentBackground) {
      return;
    }
    context.fillStyle = this.options.backgroundFill.createCanvasStyle(context, totalModules, totalModules);
    context.fillRect(0, 0, totalModules, totalModules);
  }

  paintPath(context, pathData, fill, totalModules) {
    if (!pathData) {
      return;
    }
    context.fillStyle = fill.createCanvasStyle(context, totalModules, totalModules);
    context.fill(new Path2D(pathData), 'evenodd');
  }

  paintLogo(context, totalModules) {
    const area = this.options.computeLogoArea(totalModules);
    if (!area) {
      return;
    }
    const logo = this.options.logo;
    if (logo.hasBackdrop) {
      this.paintPath(
        context,
        QrRenderer.buildLogoBackdropPath(area, logo.cornerRadiusRatio),
        logo.backdropFill,
        totalModules
      );
    }
    this.paintLogoImage(context, area, logo);
  }

  paintLogoImage(context, area, logo) {
    const { width, height } = QrRenderer.fitInsideSquare(
      logo.image.naturalWidth,
      logo.image.naturalHeight,
      area.size
    );
    const left = area.x + (area.size - width) / 2;
    const top = area.y + (area.size - height) / 2;
    context.drawImage(logo.image, left, top, width, height);
  }
}
