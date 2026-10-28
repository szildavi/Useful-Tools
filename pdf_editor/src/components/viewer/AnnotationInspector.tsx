import { useEffect, useRef } from 'react';
import {
  DrawingAnnotation,
  TextBoxAnnotation,
  TextReplacementAnnotation,
  type Annotation,
} from '../../core/editor/annotations/Annotation';
import { colorFromHex, colorToCss, WHITE } from '../../core/editor/annotations/RgbColor';
import { COLOR_SWATCHES } from '../../state/ToolSettings';

interface AnnotationInspectorProps {
  readonly annotation: Annotation;
  readonly isTyping: boolean;
  readonly onChange: (annotation: Annotation) => void;
  readonly onRemove: () => void;
  readonly onClose: () => void;
}

/**
 * Edits the currently selected annotation: its wording, its styling, and for a
 * text replacement the colour used to cover the original text.
 */
export function AnnotationInspector({
  annotation,
  isTyping,
  onChange,
  onRemove,
  onClose,
}: AnnotationInspectorProps) {
  return (
    <aside className="inspector">
      <header className="inspector__header">
        <h2 className="inspector__title">{titleOf(annotation)}</h2>
        <button type="button" className="button button--quiet button--icon" onClick={onClose}>
          ✕
        </button>
      </header>

      {isTextual(annotation) && (
        <TextAnnotationFields annotation={annotation} isTyping={isTyping} onChange={onChange} />
      )}

      {annotation instanceof DrawingAnnotation && (
        <p className="inspector__note">
          This stroke has {annotation.points.length} points. Drag it with the Select tool to move
          it.
        </p>
      )}

      <button type="button" className="button button--danger inspector__remove" onClick={onRemove}>
        Remove this edit
      </button>
    </aside>
  );
}

interface TextAnnotationFieldsProps {
  readonly annotation: TextBoxAnnotation | TextReplacementAnnotation;
  readonly isTyping: boolean;
  readonly onChange: (annotation: Annotation) => void;
}

function TextAnnotationFields({ annotation, isTyping, onChange }: TextAnnotationFieldsProps) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  // Opening a brand new text edit should put the cursor straight into it.
  useEffect(() => {
    if (isTyping) {
      textAreaRef.current?.focus();
      textAreaRef.current?.select();
    }
  }, [isTyping, annotation.id]);

  return (
    <>
      {annotation instanceof TextReplacementAnnotation && (
        <p className="inspector__original">
          Replacing: <q>{annotation.originalText}</q>
        </p>
      )}

      <label className="inspector__field">
        <span className="inspector__label">Text</span>
        <textarea
          ref={textAreaRef}
          className="inspector__textarea"
          value={annotation.text}
          rows={4}
          onChange={(event) => onChange(annotation.withText(event.target.value))}
        />
      </label>

      <label className="inspector__field">
        <span className="inspector__label">Size</span>
        <input
          className="inspector__number"
          type="number"
          min={4}
          max={200}
          step={0.5}
          value={round(annotation.style.fontSizeInPoints)}
          onChange={(event) =>
            onChange(
              annotation.withStyle({
                ...annotation.style,
                fontSizeInPoints: Number(event.target.value),
              }),
            )
          }
        />
      </label>

      <div className="inspector__field">
        <span className="inspector__label">Text colour</span>
        <div className="inspector__swatches">
          {COLOR_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              className={`tool-palette__swatch ${
                colorToCss(colorFromHex(hex)) === colorToCss(annotation.style.color)
                  ? 'tool-palette__swatch--selected'
                  : ''
              }`}
              style={{ background: hex }}
              onClick={() =>
                onChange(annotation.withStyle({ ...annotation.style, color: colorFromHex(hex) }))
              }
              aria-label={`Text colour ${hex}`}
            />
          ))}
        </div>
      </div>

      {annotation instanceof TextReplacementAnnotation && (
        <div className="inspector__field">
          <span className="inspector__label">Cover colour</span>
          <p className="inspector__help">
            Match this to the page background so the original text disappears cleanly.
          </p>
          <div className="inspector__swatches">
            {['#ffffff', '#f9fafb', '#f2f4f7', ...COLOR_SWATCHES].map((hex) => (
              <button
                key={hex}
                type="button"
                className={`tool-palette__swatch ${
                  colorToCss(colorFromHex(hex)) === colorToCss(annotation.backgroundColor)
                    ? 'tool-palette__swatch--selected'
                    : ''
                }`}
                style={{ background: hex, borderColor: 'var(--border-strong)' }}
                onClick={() => onChange(withCoverColor(annotation, hex))}
                aria-label={`Cover colour ${hex}`}
              />
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function withCoverColor(
  annotation: TextReplacementAnnotation,
  hex: string,
): TextReplacementAnnotation {
  return new TextReplacementAnnotation(
    annotation.id,
    annotation.originalText,
    annotation.text,
    annotation.area,
    annotation.style,
    colorFromHex(hex) ?? WHITE,
  );
}

function isTextual(
  annotation: Annotation,
): annotation is TextBoxAnnotation | TextReplacementAnnotation {
  return annotation instanceof TextBoxAnnotation || annotation instanceof TextReplacementAnnotation;
}

function titleOf(annotation: Annotation): string {
  switch (annotation.kind) {
    case 'drawing':
      return 'Drawing';
    case 'text-box':
      return 'Added text';
    default:
      return 'Replaced text';
  }
}

function round(value: number): number {
  return Math.round(value * 10) / 10;
}
