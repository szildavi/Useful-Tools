/**
 * Turns an encoded segment into the final interleaved codeword stream
 * that gets painted into the QR matrix.
 */
class QrCodewordBuilder {
  static PAD_CODEWORDS = [0xec, 0x11];

  static build(segment, version, errorCorrectionLevel) {
    const dataCodewords = this.buildDataCodewords(segment, version, errorCorrectionLevel);
    return this.addErrorCorrectionAndInterleave(dataCodewords, version, errorCorrectionLevel);
  }

  static buildDataCodewords(segment, version, errorCorrectionLevel) {
    const capacityBits = QrVersionTable.getDataCapacityBits(version, errorCorrectionLevel);
    const bits = new BitBuffer();

    bits.appendBits(segment.mode.indicator, 4);
    bits.appendBits(segment.characterCount, segment.mode.characterCountBits(version));
    bits.appendBuffer(segment.bits);

    bits.appendBits(0, Math.min(4, capacityBits - bits.length));
    bits.padToByteBoundary();

    for (let padIndex = 0; bits.length < capacityBits; padIndex++) {
      bits.appendBits(this.PAD_CODEWORDS[padIndex % this.PAD_CODEWORDS.length], 8);
    }
    return bits.toCodewords();
  }

  static addErrorCorrectionAndInterleave(dataCodewords, version, errorCorrectionLevel) {
    const blocks = this.splitIntoBlocksWithErrorCorrection(dataCodewords, version, errorCorrectionLevel);
    const shortBlockDataLength = this.getShortBlockDataLength(version, errorCorrectionLevel);
    const shortBlockCount = this.getShortBlockCount(version, errorCorrectionLevel);

    const interleaved = [];
    for (let position = 0; position < blocks[0].length; position++) {
      blocks.forEach((block, blockIndex) => {
        const isPaddingSlot = position === shortBlockDataLength && blockIndex < shortBlockCount;
        if (!isPaddingSlot) {
          interleaved.push(block[position]);
        }
      });
    }
    return interleaved;
  }

  static splitIntoBlocksWithErrorCorrection(dataCodewords, version, errorCorrectionLevel) {
    const blockCount = QrVersionTable.getBlockCount(version, errorCorrectionLevel);
    const errorCorrectionLength =
      QrVersionTable.getErrorCorrectionCodewordsPerBlock(version, errorCorrectionLevel);
    const shortBlockDataLength = this.getShortBlockDataLength(version, errorCorrectionLevel);
    const shortBlockCount = this.getShortBlockCount(version, errorCorrectionLevel);

    const blocks = [];
    let readPosition = 0;
    for (let blockIndex = 0; blockIndex < blockCount; blockIndex++) {
      const isShortBlock = blockIndex < shortBlockCount;
      const dataLength = shortBlockDataLength + (isShortBlock ? 0 : 1);
      const blockData = dataCodewords.slice(readPosition, readPosition + dataLength);
      readPosition += dataLength;

      const errorCorrection = ReedSolomonEncoder.encode(blockData, errorCorrectionLength);
      if (isShortBlock) {
        blockData.push(0); // Placeholder so every block has the same length while interleaving.
      }
      blocks.push(blockData.concat(errorCorrection));
    }
    return blocks;
  }

  /** Number of blocks that carry one data codeword less than the longest blocks. */
  static getShortBlockCount(version, errorCorrectionLevel) {
    const blockCount = QrVersionTable.getBlockCount(version, errorCorrectionLevel);
    return blockCount - (QrVersionTable.getTotalCodewordCount(version) % blockCount);
  }

  static getShortBlockDataLength(version, errorCorrectionLevel) {
    const blockCount = QrVersionTable.getBlockCount(version, errorCorrectionLevel);
    const errorCorrectionLength =
      QrVersionTable.getErrorCorrectionCodewordsPerBlock(version, errorCorrectionLevel);
    return Math.floor(QrVersionTable.getTotalCodewordCount(version) / blockCount) - errorCorrectionLength;
  }
}
