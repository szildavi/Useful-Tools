/** A growable little-endian byte buffer used by the hand-written encoders. */

export class BinaryWriter {
  #bytes = [];

  get length() {
    return this.#bytes.length;
  }

  writeUint8(value) {
    this.#bytes.push(value & 0xff);
    return this;
  }

  writeUint16(value) {
    return this.writeUint8(value).writeUint8(value >>> 8);
  }

  writeUint32(value) {
    return this.writeUint16(value).writeUint16(value >>> 16);
  }

  writeInt32(value) {
    return this.writeUint32(value >>> 0);
  }

  writeBytes(bytes) {
    for (const byte of bytes) {
      this.#bytes.push(byte & 0xff);
    }
    return this;
  }

  writeAscii(text) {
    for (let index = 0; index < text.length; index += 1) {
      this.#bytes.push(text.charCodeAt(index) & 0xff);
    }
    return this;
  }

  toUint8Array() {
    return new Uint8Array(this.#bytes);
  }
}
