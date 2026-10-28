import { colorFromHex, type RgbColor } from '../core/editor/annotations/RgbColor';
import { DEFAULT_TEXT_STYLE, type TextStyle } from '../core/editor/annotations/TextStyle';

/** The current settings of the drawing and text tools. */
export interface ToolSettings {
  readonly strokeColor: RgbColor;
  readonly strokeWidthInPoints: number;
  readonly textStyle: TextStyle;
}

export const DEFAULT_TOOL_SETTINGS: ToolSettings = {
  strokeColor: colorFromHex('#d92d20'),
  strokeWidthInPoints: 2,
  textStyle: DEFAULT_TEXT_STYLE,
};

/** Colours offered in the toolbar swatches. */
export const COLOR_SWATCHES: readonly string[] = [
  '#101828',
  '#d92d20',
  '#1570ef',
  '#039855',
  '#dc6803',
  '#7839ee',
];
