/**
 * Builds SVG path strings for the basic shapes the renderers need.
 * Both the canvas and the SVG renderer consume these strings, so the geometry
 * of a QR code is described in exactly one place.
 */
class PathGeometry {
  static DECIMALS = 4;

  static format(value) {
    return Number(value.toFixed(this.DECIMALS)).toString();
  }

  static rectangle(x, y, width, height) {
    const [left, top] = [this.format(x), this.format(y)];
    return `M${left} ${top}h${this.format(width)}v${this.format(height)}h${this.format(-width)}Z`;
  }

  static circle(centerX, centerY, radius) {
    const [left, middle] = [this.format(centerX - radius), this.format(centerY)];
    const [across, back] = [this.format(radius * 2), this.format(-radius * 2)];
    const arc = `${this.format(radius)} ${this.format(radius)} 0 1 0`;
    return `M${left} ${middle}a${arc} ${across} 0a${arc} ${back} 0Z`;
  }

  static roundedRectangle(x, y, width, height, radius) {
    const limited = Math.min(radius, width / 2, height / 2);
    return this.roundedRectangleWithCorners(x, y, width, height, {
      topLeft: limited,
      topRight: limited,
      bottomRight: limited,
      bottomLeft: limited,
    });
  }

  /** A rectangle whose four corners can each be rounded by a different amount. */
  static roundedRectangleWithCorners(x, y, width, height, corners) {
    const limit = Math.min(width, height) / 2;
    const topLeft = Math.min(corners.topLeft, limit);
    const topRight = Math.min(corners.topRight, limit);
    const bottomRight = Math.min(corners.bottomRight, limit);
    const bottomLeft = Math.min(corners.bottomLeft, limit);

    const right = x + width;
    const bottom = y + height;

    return [
      `M${this.format(x + topLeft)} ${this.format(y)}`,
      `L${this.format(right - topRight)} ${this.format(y)}`,
      this.cornerArc(topRight, right, y + topRight),
      `L${this.format(right)} ${this.format(bottom - bottomRight)}`,
      this.cornerArc(bottomRight, right - bottomRight, bottom),
      `L${this.format(x + bottomLeft)} ${this.format(bottom)}`,
      this.cornerArc(bottomLeft, x, bottom - bottomLeft),
      `L${this.format(x)} ${this.format(y + topLeft)}`,
      this.cornerArc(topLeft, x + topLeft, y),
      'Z',
    ].join('');
  }

  static cornerArc(radius, endX, endY) {
    if (radius <= 0) {
      return `L${this.format(endX)} ${this.format(endY)}`;
    }
    const size = this.format(radius);
    return `A${size} ${size} 0 0 1 ${this.format(endX)} ${this.format(endY)}`;
  }
}
