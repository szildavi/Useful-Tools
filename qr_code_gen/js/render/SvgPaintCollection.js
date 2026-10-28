/**
 * Collects the paints an SVG document needs. A fill that is used more than
 * once is defined only once and referenced again.
 */
class SvgPaintCollection {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.definitions = [];
    this.referencesByFill = new Map();
  }

  reference(fill, paintId) {
    if (!this.referencesByFill.has(fill)) {
      this.referencesByFill.set(fill, this.definePaint(fill, paintId));
    }
    return this.referencesByFill.get(fill);
  }

  definePaint(fill, paintId) {
    const paint = fill.createSvgPaint(paintId, this.width, this.height);
    if (paint.definition) {
      this.definitions.push(paint.definition);
    }
    return paint.reference;
  }

  toDefinitionsMarkup() {
    return this.definitions.length ? `<defs>${this.definitions.join('')}</defs>` : '';
  }
}
