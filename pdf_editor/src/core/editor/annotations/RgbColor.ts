/** A colour with components in the 0..1 range, matching what pdf-lib expects. */
export interface RgbColor {
  readonly red: number;
  readonly green: number;
  readonly blue: number;
}

export const BLACK: RgbColor = { red: 0, green: 0, blue: 0 };
export const WHITE: RgbColor = { red: 1, green: 1, blue: 1 };

export function colorFromHex(hex: string): RgbColor {
  const digits = hex.replace('#', '');
  const expanded =
    digits.length === 3
      ? digits
          .split('')
          .map((digit) => digit + digit)
          .join('')
      : digits;
  return {
    red: parseInt(expanded.slice(0, 2), 16) / 255,
    green: parseInt(expanded.slice(2, 4), 16) / 255,
    blue: parseInt(expanded.slice(4, 6), 16) / 255,
  };
}

export function colorToCss(color: RgbColor): string {
  const toByte = (component: number) => Math.round(component * 255);
  return `rgb(${toByte(color.red)}, ${toByte(color.green)}, ${toByte(color.blue)})`;
}
