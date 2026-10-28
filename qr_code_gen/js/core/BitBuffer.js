/**
 * An append-only sequence of bits, used while assembling QR-code data.
 */
class BitBuffer {
  constructor() {
    this.bits = [];
  }

  get length() {
    return this.bits.length;
  }

  appendBit(bit) {
    this.bits.push(bit ? 1 : 0);
  }

  appendBits(value, bitCount) {
    for (let position = bitCount - 1; position >= 0; position--) {
      this.appendBit((value >>> position) & 1);
    }
  }

  appendBuffer(otherBuffer) {
    for (const bit of otherBuffer.bits) {
      this.appendBit(bit);
    }
  }

  padToByteBoundary() {
    this.appendBits(0, (8 - (this.length % 8)) % 8);
  }

  toCodewords() {
    const codewords = new Array(Math.ceil(this.length / 8)).fill(0);
    this.bits.forEach((bit, index) => {
      codewords[index >>> 3] |= bit << (7 - (index & 7));
    });
    return codewords;
  }
}
