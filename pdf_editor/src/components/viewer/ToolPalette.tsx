import { colorFromHex, colorToCss } from '../../core/editor/annotations/RgbColor';
import { TOOL_DESCRIPTIONS, type EditorTool } from '../../state/EditorTool';
import { COLOR_SWATCHES, type ToolSettings } from '../../state/ToolSettings';

const STROKE_WIDTHS_IN_POINTS: readonly number[] = [1, 2, 4, 8];
const FONT_SIZES_IN_POINTS: readonly number[] = [8, 10, 12, 14, 18, 24, 32, 48];

interface ToolPaletteProps {
  readonly tool: EditorTool;
  readonly onChooseTool: (tool: EditorTool) => void;
  readonly settings: ToolSettings;
  readonly onChangeSettings: (changes: Partial<ToolSettings>) => void;
}

/** Chooses what a gesture on the page does, and how the result looks. */
export function ToolPalette({
  tool,
  onChooseTool,
  settings,
  onChangeSettings,
}: ToolPaletteProps) {
  const activeTool = TOOL_DESCRIPTIONS.find((description) => description.tool === tool);

  return (
    <div className="tool-palette">
      <div className="tool-palette__row" role="toolbar" aria-label="Editing tools">
        {TOOL_DESCRIPTIONS.map((description) => (
          <button
            key={description.tool}
            type="button"
            className={`button ${tool === description.tool ? 'button--active' : ''}`}
            onClick={() => onChooseTool(description.tool)}
            title={description.hint}
          >
            <span aria-hidden="true">{description.icon}</span>
            {description.label}
          </button>
        ))}
      </div>

      {tool === 'draw' && (
        <div className="tool-palette__row">
          <ColorSwatches
            selected={colorToCss(settings.strokeColor)}
            onChoose={(hex) => onChangeSettings({ strokeColor: colorFromHex(hex) })}
          />
          <span className="tool-palette__divider" aria-hidden="true" />
          {STROKE_WIDTHS_IN_POINTS.map((width) => (
            <button
              key={width}
              type="button"
              className={`button button--icon ${
                settings.strokeWidthInPoints === width ? 'button--active' : ''
              }`}
              onClick={() => onChangeSettings({ strokeWidthInPoints: width })}
              title={`${width} point stroke`}
            >
              <span
                className="tool-palette__stroke-preview"
                style={{ height: Math.max(1, width) }}
              />
            </button>
          ))}
        </div>
      )}

      {(tool === 'add-text' || tool === 'edit-text') && (
        <div className="tool-palette__row">
          <ColorSwatches
            selected={colorToCss(settings.textStyle.color)}
            onChoose={(hex) =>
              onChangeSettings({
                textStyle: { ...settings.textStyle, color: colorFromHex(hex) },
              })
            }
          />
          <span className="tool-palette__divider" aria-hidden="true" />
          <select
            className="tool-palette__select"
            value={settings.textStyle.fontFamily}
            onChange={(event) =>
              onChangeSettings({
                textStyle: {
                  ...settings.textStyle,
                  fontFamily: event.target.value as ToolSettings['textStyle']['fontFamily'],
                },
              })
            }
            aria-label="Font"
          >
            <option value="sans-serif">Sans serif</option>
            <option value="serif">Serif</option>
            <option value="monospace">Monospace</option>
          </select>
          <select
            className="tool-palette__select"
            value={settings.textStyle.fontSizeInPoints}
            onChange={(event) =>
              onChangeSettings({
                textStyle: {
                  ...settings.textStyle,
                  fontSizeInPoints: Number(event.target.value),
                },
              })
            }
            aria-label="Font size"
          >
            {FONT_SIZES_IN_POINTS.map((size) => (
              <option key={size} value={size}>
                {size} pt
              </option>
            ))}
          </select>
          <button
            type="button"
            className={`button button--icon ${
              settings.textStyle.isBold ? 'button--active' : ''
            }`}
            onClick={() =>
              onChangeSettings({
                textStyle: { ...settings.textStyle, isBold: !settings.textStyle.isBold },
              })
            }
            title="Bold"
          >
            <strong>B</strong>
          </button>
          <button
            type="button"
            className={`button button--icon ${
              settings.textStyle.isItalic ? 'button--active' : ''
            }`}
            onClick={() =>
              onChangeSettings({
                textStyle: { ...settings.textStyle, isItalic: !settings.textStyle.isItalic },
              })
            }
            title="Italic"
          >
            <em>I</em>
          </button>
        </div>
      )}

      {activeTool && <p className="tool-palette__hint">{activeTool.hint}</p>}
    </div>
  );
}

interface ColorSwatchesProps {
  readonly selected: string;
  readonly onChoose: (hex: string) => void;
}

function ColorSwatches({ selected, onChoose }: ColorSwatchesProps) {
  return (
    <div className="tool-palette__swatches">
      {COLOR_SWATCHES.map((hex) => (
        <button
          key={hex}
          type="button"
          className={`tool-palette__swatch ${
            colorToCss(colorFromHex(hex)) === selected ? 'tool-palette__swatch--selected' : ''
          }`}
          style={{ background: hex }}
          onClick={() => onChoose(hex)}
          title={hex}
          aria-label={`Colour ${hex}`}
        />
      ))}
    </div>
  );
}
