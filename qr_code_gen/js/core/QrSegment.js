/**
 * A block of input text already converted to bits under a single QR mode.
 */
class QrSegment {
  constructor(mode, characterCount, bits) {
    this.mode = mode;
    this.characterCount = characterCount;
    this.bits = bits;
  }

  /**
   * Total bit cost of this segment inside the given version,
   * or Infinity when the character count does not fit the version's header field.
   */
  countTotalBits(version) {
    const characterCountBits = this.mode.characterCountBits(version);
    if (this.characterCount >= 1 << characterCountBits) {
      return Infinity;
    }
    return 4 + characterCountBits + this.bits.length;
  }
}
