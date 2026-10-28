/**
 * Converts input text into a QR segment, choosing the most compact mode
 * that can represent the whole text.
 */
class QrSegmentEncoder {
  static ALPHANUMERIC_CHARSET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';
  static NUMERIC_PATTERN = /^[0-9]+$/;
  static ALPHANUMERIC_PATTERN = /^[A-Z0-9 $%*+\-./:]+$/;

  static encode(text) {
    if (this.NUMERIC_PATTERN.test(text)) {
      return this.encodeNumeric(text);
    }
    if (this.ALPHANUMERIC_PATTERN.test(text)) {
      return this.encodeAlphanumeric(text);
    }
    return this.encodeBytes(text);
  }

  static encodeNumeric(text) {
    const bits = new BitBuffer();
    for (let index = 0; index < text.length; index += 3) {
      const group = text.substring(index, index + 3);
      bits.appendBits(parseInt(group, 10), group.length * 3 + 1);
    }
    return new QrSegment(QrMode.NUMERIC, text.length, bits);
  }

  static encodeAlphanumeric(text) {
    const bits = new BitBuffer();
    for (let index = 0; index + 1 < text.length; index += 2) {
      const pairValue =
        this.alphanumericValueOf(text[index]) * 45 + this.alphanumericValueOf(text[index + 1]);
      bits.appendBits(pairValue, 11);
    }
    if (text.length % 2 === 1) {
      bits.appendBits(this.alphanumericValueOf(text[text.length - 1]), 6);
    }
    return new QrSegment(QrMode.ALPHANUMERIC, text.length, bits);
  }

  static encodeBytes(text) {
    const bytes = new TextEncoder().encode(text);
    const bits = new BitBuffer();
    for (const byte of bytes) {
      bits.appendBits(byte, 8);
    }
    return new QrSegment(QrMode.BYTE, bytes.length, bits);
  }

  static alphanumericValueOf(character) {
    return this.ALPHANUMERIC_CHARSET.indexOf(character);
  }
}
