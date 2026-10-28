/**
 * One of the four QR-code error-correction levels.
 * A stronger level survives more damage (or more logo coverage) but stores less data.
 */
class ErrorCorrectionLevel {
  constructor(name, label, recoveryPercentage, formatBits, tableIndex) {
    this.name = name;
    this.label = label;
    this.recoveryPercentage = recoveryPercentage;
    this.formatBits = formatBits;
    this.tableIndex = tableIndex;
  }

  static LOW = new ErrorCorrectionLevel('L', 'Low', 7, 1, 0);
  static MEDIUM = new ErrorCorrectionLevel('M', 'Medium', 15, 0, 1);
  static QUARTILE = new ErrorCorrectionLevel('Q', 'Quartile', 25, 3, 2);
  static HIGH = new ErrorCorrectionLevel('H', 'High', 30, 2, 3);

  static listOrderedByStrength() {
    return [this.LOW, this.MEDIUM, this.QUARTILE, this.HIGH];
  }

  static fromName(name) {
    const level = this.listOrderedByStrength().find((candidate) => candidate.name === name);
    if (!level) {
      throw new Error(`Unknown error correction level: ${name}`);
    }
    return level;
  }

  isStrongerThan(otherLevel) {
    return this.tableIndex > otherLevel.tableIndex;
  }
}
