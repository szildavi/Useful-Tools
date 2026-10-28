/**
 * Builds a standalone SVG document for a QR code. Vector output stays sharp
 * at any size, so it is the best choice for print.
 */
class SvgQrRenderer extends QrRenderer {
  render(matrix, pixelSize) {
    const paths = this.buildPaths(matrix);
    const totalModules = paths.totalModules;
    const paints = new SvgPaintCollection(totalModules, totalModules);

    const body = [
      this.buildBackgroundMarkup(totalModules, paints),
      this.buildPathMarkup(paths.bodyPath, paints.reference(this.options.foregroundFill, 'qr-foreground')),
      this.buildPathMarkup(paths.eyeFramePath, paints.reference(this.options.eyeFrameFill, 'qr-eye-frame')),
      this.buildPathMarkup(paths.eyeBallPath, paints.reference(this.options.eyeBallFill, 'qr-eye-ball')),
      this.buildLogoMarkup(totalModules, paints),
    ].join('');

    return (
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" ' +
      `width="${pixelSize}" height="${pixelSize}" viewBox="0 0 ${totalModules} ${totalModules}">` +
      paints.toDefinitionsMarkup() +
      body +
      '</svg>'
    );
  }

  buildBackgroundMarkup(totalModules, paints) {
    if (this.options.hasTransparentBackground) {
      return '';
    }
    const paint = paints.reference(this.options.backgroundFill, 'qr-background');
    return `<rect width="${totalModules}" height="${totalModules}" fill="${paint}"/>`;
  }

  buildPathMarkup(pathData, paint) {
    if (!pathData) {
      return '';
    }
    return `<path d="${pathData}" fill="${paint}" fill-rule="evenodd"/>`;
  }

  buildLogoMarkup(totalModules, paints) {
    const area = this.options.computeLogoArea(totalModules);
    if (!area) {
      return '';
    }
    const logo = this.options.logo;
    const backdrop = logo.hasBackdrop
      ? this.buildPathMarkup(
          QrRenderer.buildLogoBackdropPath(area, logo.cornerRadiusRatio),
          paints.reference(logo.backdropFill, 'qr-logo-backdrop')
        )
      : '';
    return backdrop + this.buildLogoImageMarkup(area, logo);
  }

  buildLogoImageMarkup(area, logo) {
    const source = SvgQrRenderer.escapeAttribute(logo.dataUrl);
    return (
      `<image href="${source}" xlink:href="${source}" ` +
      `x="${area.x}" y="${area.y}" width="${area.size}" height="${area.size}" ` +
      'preserveAspectRatio="xMidYMid meet"/>'
    );
  }

  static escapeAttribute(value) {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  }
}
