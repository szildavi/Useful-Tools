/**
 * Produces Reed-Solomon error-correction codewords for a block of data codewords.
 */
class ReedSolomonEncoder {
  static buildDivisorPolynomial(errorCorrectionLength) {
    const divisor = new Array(errorCorrectionLength).fill(0);
    divisor[errorCorrectionLength - 1] = 1;

    let root = 1;
    for (let step = 0; step < errorCorrectionLength; step++) {
      for (let index = 0; index < errorCorrectionLength; index++) {
        divisor[index] = GaloisField256.multiply(divisor[index], root);
        if (index + 1 < errorCorrectionLength) {
          divisor[index] ^= divisor[index + 1];
        }
      }
      root = GaloisField256.multiply(root, 0x02);
    }
    return divisor;
  }

  static encode(dataCodewords, errorCorrectionLength) {
    const divisor = this.buildDivisorPolynomial(errorCorrectionLength);
    const remainder = new Array(errorCorrectionLength).fill(0);

    for (const codeword of dataCodewords) {
      const factor = codeword ^ remainder.shift();
      remainder.push(0);
      divisor.forEach((coefficient, index) => {
        remainder[index] ^= GaloisField256.multiply(coefficient, factor);
      });
    }
    return remainder;
  }
}
