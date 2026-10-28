/** Clockwise rotation applied by the editor on top of a page's own rotation. */
export type PageRotation = 0 | 90 | 180 | 270;

const QUARTER_TURN = 90;
const FULL_TURN = 360;

export function rotatedClockwise(rotation: PageRotation): PageRotation {
  return normalizeRotation(rotation + QUARTER_TURN);
}

export function rotatedCounterClockwise(rotation: PageRotation): PageRotation {
  return normalizeRotation(rotation - QUARTER_TURN);
}

export function normalizeRotation(degrees: number): PageRotation {
  const positiveDegrees = ((degrees % FULL_TURN) + FULL_TURN) % FULL_TURN;
  return positiveDegrees as PageRotation;
}

export function isQuarterTurn(rotation: PageRotation): boolean {
  return rotation === 90 || rotation === 270;
}
