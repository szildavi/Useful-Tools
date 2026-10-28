/**
 * A paint that can be applied both to a canvas context and to SVG markup.
 */
class ColorFill {
  createCanvasStyle() {
    throw new Error('ColorFill.createCanvasStyle must be implemented by a subclass');
  }

  /** @returns {{definition: string, reference: string}} SVG <defs> markup and the value for fill="". */
  createSvgPaint() {
    throw new Error('ColorFill.createSvgPaint must be implemented by a subclass');
  }

  /** Every colour this fill paints with, used for contrast checks. */
  listColors() {
    throw new Error('ColorFill.listColors must be implemented by a subclass');
  }
}

class SolidColorFill extends ColorFill {
  constructor(color) {
    super();
    this.color = color;
  }

  createCanvasStyle() {
    return this.color;
  }

  createSvgPaint() {
    return { definition: '', reference: this.color };
  }

  listColors() {
    return [this.color];
  }
}

class LinearGradientFill extends ColorFill {
  constructor(startColor, endColor, angleDegrees) {
    super();
    this.startColor = startColor;
    this.endColor = endColor;
    this.angleDegrees = angleDegrees;
  }

  createCanvasStyle(context, width, height) {
    const { startX, startY, endX, endY } = this.computeEndpoints(width, height);
    const gradient = context.createLinearGradient(startX, startY, endX, endY);
    gradient.addColorStop(0, this.startColor);
    gradient.addColorStop(1, this.endColor);
    return gradient;
  }

  createSvgPaint(paintId, width, height) {
    const { startX, startY, endX, endY } = this.computeEndpoints(width, height);
    const definition =
      `<linearGradient id="${paintId}" gradientUnits="userSpaceOnUse" ` +
      `x1="${startX}" y1="${startY}" x2="${endX}" y2="${endY}">` +
      `<stop offset="0" stop-color="${this.startColor}"/>` +
      `<stop offset="1" stop-color="${this.endColor}"/>` +
      '</linearGradient>';
    return { definition, reference: `url(#${paintId})` };
  }

  listColors() {
    return [this.startColor, this.endColor];
  }

  /** Spreads the gradient across the whole drawing area at the requested angle. */
  computeEndpoints(width, height) {
    const radians = (this.angleDegrees * Math.PI) / 180;
    const halfSpan = (Math.abs(width * Math.cos(radians)) + Math.abs(height * Math.sin(radians))) / 2;
    const offsetX = Math.cos(radians) * halfSpan;
    const offsetY = Math.sin(radians) * halfSpan;
    return {
      startX: width / 2 - offsetX,
      startY: height / 2 - offsetY,
      endX: width / 2 + offsetX,
      endY: height / 2 + offsetY,
    };
  }
}
