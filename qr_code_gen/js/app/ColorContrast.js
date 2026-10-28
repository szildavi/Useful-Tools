/**
 * Measures how strongly two colours stand apart, using the WCAG relative
 * luminance formula. Scanners need a clear light/dark difference.
 */
class ColorContrast {
  static parseHex(hexColor) {
    const digits = hexColor.replace('#', '');
    const expanded = digits.length === 3 ? digits.split('').map((digit) => digit + digit).join('') : digits;
    return {
      red: parseInt(expanded.substring(0, 2), 16),
      green: parseInt(expanded.substring(2, 4), 16),
      blue: parseInt(expanded.substring(4, 6), 16),
    };
  }

  static relativeLuminance(hexColor) {
    const { red, green, blue } = this.parseHex(hexColor);
    const [r, g, b] = [red, green, blue].map((channel) => this.linearizeChannel(channel / 255));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  static linearizeChannel(value) {
    return value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4);
  }

  static ratio(firstColor, secondColor) {
    const first = this.relativeLuminance(firstColor);
    const second = this.relativeLuminance(secondColor);
    const lighter = Math.max(first, second);
    const darker = Math.min(first, second);
    return (lighter + 0.05) / (darker + 0.05);
  }

  /** The weakest contrast between any foreground colour and any background colour. */
  static lowestRatioBetween(foregroundColors, backgroundColors) {
    const ratios = foregroundColors.flatMap((foreground) =>
      backgroundColors.map((background) => this.ratio(foreground, background))
    );
    return Math.min(...ratios);
  }
}
