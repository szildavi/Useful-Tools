/**
 * Draws the 7x7 ring of a finder pattern ("eye frame").
 * The returned path relies on the even-odd fill rule to punch out its middle.
 */
class EyeFrameShape {
  buildPath(originX, originY) {
    throw new Error('EyeFrameShape.buildPath must be implemented by a subclass');
  }
}

/** Draws the 3x3 centre of a finder pattern ("eye ball"). */
class EyeBallShape {
  buildPath(originX, originY) {
    throw new Error('EyeBallShape.buildPath must be implemented by a subclass');
  }
}

class SquareEyeFrameShape extends EyeFrameShape {
  buildPath(originX, originY) {
    return (
      PathGeometry.rectangle(originX, originY, 7, 7) +
      PathGeometry.rectangle(originX + 1, originY + 1, 5, 5)
    );
  }
}

class RoundedEyeFrameShape extends EyeFrameShape {
  constructor(outerRadius, innerRadius) {
    super();
    this.outerRadius = outerRadius;
    this.innerRadius = innerRadius;
  }

  buildPath(originX, originY) {
    return (
      PathGeometry.roundedRectangle(originX, originY, 7, 7, this.outerRadius) +
      PathGeometry.roundedRectangle(originX + 1, originY + 1, 5, 5, this.innerRadius)
    );
  }
}

class CircleEyeFrameShape extends EyeFrameShape {
  buildPath(originX, originY) {
    const centerX = originX + 3.5;
    const centerY = originY + 3.5;
    return PathGeometry.circle(centerX, centerY, 3.5) + PathGeometry.circle(centerX, centerY, 2.5);
  }
}

class SquareEyeBallShape extends EyeBallShape {
  buildPath(originX, originY) {
    return PathGeometry.rectangle(originX + 2, originY + 2, 3, 3);
  }
}

class RoundedEyeBallShape extends EyeBallShape {
  constructor(radius) {
    super();
    this.radius = radius;
  }

  buildPath(originX, originY) {
    return PathGeometry.roundedRectangle(originX + 2, originY + 2, 3, 3, this.radius);
  }
}

class CircleEyeBallShape extends EyeBallShape {
  buildPath(originX, originY) {
    return PathGeometry.circle(originX + 3.5, originY + 3.5, 1.5);
  }
}

const EYE_FRAME_SHAPES = new ShapeRegistry([
  { name: 'square', label: 'Square', build: () => new SquareEyeFrameShape() },
  { name: 'rounded', label: 'Rounded', build: () => new RoundedEyeFrameShape(1.75, 1) },
  { name: 'extra-rounded', label: 'Extra rounded', build: () => new RoundedEyeFrameShape(2.6, 1.9) },
  { name: 'circle', label: 'Circle', build: () => new CircleEyeFrameShape() },
]);

const EYE_BALL_SHAPES = new ShapeRegistry([
  { name: 'square', label: 'Square', build: () => new SquareEyeBallShape() },
  { name: 'rounded', label: 'Rounded', build: () => new RoundedEyeBallShape(0.75) },
  { name: 'extra-rounded', label: 'Extra rounded', build: () => new RoundedEyeBallShape(1.2) },
  { name: 'circle', label: 'Circle', build: () => new CircleEyeBallShape() },
]);
