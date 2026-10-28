/**
 * Draws one dark module of the QR code. Neighbour information lets a shape
 * keep touching modules visually connected.
 */
class ModuleShape {
  /**
   * @param {number} x Left edge in module units.
   * @param {number} y Top edge in module units.
   * @param {{up: boolean, down: boolean, left: boolean, right: boolean}} neighbours Dark neighbours.
   * @returns {string} SVG path data.
   */
  buildPath(x, y, neighbours) {
    throw new Error('ModuleShape.buildPath must be implemented by a subclass');
  }
}

class SquareModuleShape extends ModuleShape {
  buildPath(x, y) {
    return PathGeometry.rectangle(x, y, 1, 1);
  }
}

class DotModuleShape extends ModuleShape {
  constructor(radius = 0.5) {
    super();
    this.radius = radius;
  }

  buildPath(x, y) {
    return PathGeometry.circle(x + 0.5, y + 0.5, this.radius);
  }
}

/**
 * A square that is rounded off only on corners where no neighbour touches it,
 * so runs of modules flow into each other.
 */
class RoundedModuleShape extends ModuleShape {
  constructor(radius) {
    super();
    this.radius = radius;
  }

  buildPath(x, y, neighbours) {
    return PathGeometry.roundedRectangleWithCorners(x, y, 1, 1, {
      topLeft: this.cornerRadius(neighbours.up, neighbours.left),
      topRight: this.cornerRadius(neighbours.up, neighbours.right),
      bottomRight: this.cornerRadius(neighbours.down, neighbours.right),
      bottomLeft: this.cornerRadius(neighbours.down, neighbours.left),
    });
  }

  cornerRadius(firstNeighbour, secondNeighbour) {
    return firstNeighbour || secondNeighbour ? 0 : this.radius;
  }
}

const MODULE_SHAPES = new ShapeRegistry([
  { name: 'square', label: 'Square', build: () => new SquareModuleShape() },
  { name: 'rounded', label: 'Rounded', build: () => new RoundedModuleShape(0.3) },
  { name: 'extra-rounded', label: 'Extra rounded', build: () => new RoundedModuleShape(0.5) },
  { name: 'dot', label: 'Dots', build: () => new DotModuleShape(0.5) },
  { name: 'small-dot', label: 'Small dots', build: () => new DotModuleShape(0.42) },
]);
