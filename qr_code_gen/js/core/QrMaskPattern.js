/**
 * The eight standard mask patterns. A mask flips data modules according to
 * a formula so the finished symbol has a balanced, scannable appearance.
 */
class QrMaskPattern {
  static COUNT = 8;

  static shouldFlip(patternIndex, column, row) {
    switch (patternIndex) {
      case 0:
        return (column + row) % 2 === 0;
      case 1:
        return row % 2 === 0;
      case 2:
        return column % 3 === 0;
      case 3:
        return (column + row) % 3 === 0;
      case 4:
        return (Math.floor(column / 3) + Math.floor(row / 2)) % 2 === 0;
      case 5:
        return ((column * row) % 2) + ((column * row) % 3) === 0;
      case 6:
        return (((column * row) % 2) + ((column * row) % 3)) % 2 === 0;
      case 7:
        return (((column + row) % 2) + ((column * row) % 3)) % 2 === 0;
      default:
        throw new Error(`Unknown mask pattern: ${patternIndex}`);
    }
  }
}
