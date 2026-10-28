/**
 * A QR-code data encoding mode. The mode decides how many bits each input
 * character costs and how long the character-count field is.
 */
class QrMode {
  constructor(name, indicator, characterCountBitsPerVersionGroup) {
    this.name = name;
    this.indicator = indicator;
    this.characterCountBitsPerVersionGroup = characterCountBitsPerVersionGroup;
  }

  static NUMERIC = new QrMode('Numeric', 0x1, [10, 12, 14]);
  static ALPHANUMERIC = new QrMode('Alphanumeric', 0x2, [9, 11, 13]);
  static BYTE = new QrMode('Byte (UTF-8)', 0x4, [8, 16, 16]);

  characterCountBits(version) {
    return this.characterCountBitsPerVersionGroup[this.versionGroupIndex(version)];
  }

  versionGroupIndex(version) {
    if (version <= 9) {
      return 0;
    }
    if (version <= 26) {
      return 1;
    }
    return 2;
  }
}
