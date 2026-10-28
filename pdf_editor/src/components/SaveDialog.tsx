import { useEffect, useRef, useState } from 'react';
import {
  EXPORT_FORMATS,
  isImageFormat,
  type ExportFormat,
} from '../core/export/DocumentFormatExporter';
import {
  IMAGE_RESOLUTIONS,
  type ImageResolution,
} from '../core/export/PageImageExporter';
import { fileNameWithoutExtension } from '../core/conversion/FileFormat';
import {
  SplitEveryNPages,
  SplitIntoSinglePages,
  SplitOutSelectedPages,
  type SplitStrategy,
} from '../core/export/SplitStrategy';
import type { EditorSession } from '../state/useEditorSession';
import './SaveDialog.css';

type SaveMode = 'whole-document' | 'split';

type SplitChoice = 'single-pages' | 'every-n' | 'selected';

interface SaveDialogProps {
  readonly session: EditorSession;
  readonly onClose: () => void;
}

/** Chooses the file name, the format, and whether to split before saving. */
export function SaveDialog({ session, onClose }: SaveDialogProps) {
  const [fileName, setFileName] = useState(() =>
    fileNameWithoutExtension(session.suggestedFileName),
  );
  const [mode, setMode] = useState<SaveMode>('whole-document');
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [imageResolution, setImageResolution] = useState<ImageResolution>('print');
  const [splitChoice, setSplitChoice] = useState<SplitChoice>('single-pages');
  const [pagesPerFile, setPagesPerFile] = useState(2);
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, []);

  const hasSelection = session.selection.selectedCount > 0;
  const chosenFormat = EXPORT_FORMATS.find((option) => option.format === format);

  const save = async () => {
    onClose();
    if (mode === 'split') {
      await session.splitDocument(
        splitStrategyFor(splitChoice, pagesPerFile, session),
        fileName,
      );
    } else {
      await session.exportAs(fileName, format, imageResolution);
    }
  };

  return (
    <div
      className="dialog-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <form
        className="dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Save document"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
        onKeyDown={(event) => {
          if (event.key === 'Escape') {
            onClose();
          }
        }}
      >
        <h2 className="dialog__title">Save</h2>

        <label className="dialog__field">
          <span className="dialog__label">File name</span>
          <input
            ref={nameInputRef}
            className="dialog__input"
            value={fileName}
            onChange={(event) => setFileName(event.target.value)}
          />
        </label>

        <fieldset className="dialog__fieldset">
          <legend className="dialog__label">What to save</legend>
          <RadioRow
            name="save-mode"
            checked={mode === 'whole-document'}
            onChoose={() => setMode('whole-document')}
            title="The whole document as one file"
            description={`All ${session.document.pageCount()} pages, in their current order.`}
          />
          <RadioRow
            name="save-mode"
            checked={mode === 'split'}
            onChoose={() => setMode('split')}
            title="Split into several files"
            description="Each part becomes its own PDF, delivered as a zip."
          />
        </fieldset>

        {mode === 'whole-document' && (
          <fieldset className="dialog__fieldset">
            <legend className="dialog__label">Format</legend>
            {EXPORT_FORMATS.map((option) => (
              <RadioRow
                key={option.format}
                name="format"
                checked={format === option.format}
                onChoose={() => setFormat(option.format)}
                title={option.label}
                description={option.note}
              />
            ))}
          </fieldset>
        )}

        {mode === 'split' && (
          <fieldset className="dialog__fieldset">
            <legend className="dialog__label">How to split</legend>
            <RadioRow
              name="split"
              checked={splitChoice === 'single-pages'}
              onChoose={() => setSplitChoice('single-pages')}
              title="One file per page"
              description={`${session.document.pageCount()} files.`}
            />
            <RadioRow
              name="split"
              checked={splitChoice === 'every-n'}
              onChoose={() => setSplitChoice('every-n')}
              title="Fixed number of pages per file"
              description={
                <span className="dialog__inline">
                  Every
                  <input
                    className="dialog__number"
                    type="number"
                    min={1}
                    max={Math.max(1, session.document.pageCount())}
                    value={pagesPerFile}
                    onChange={(event) => setPagesPerFile(Number(event.target.value))}
                    onClick={(event) => event.stopPropagation()}
                  />
                  pages.
                </span>
              }
            />
            <RadioRow
              name="split"
              checked={splitChoice === 'selected'}
              onChoose={() => setSplitChoice('selected')}
              disabled={!hasSelection}
              title="Selected pages into their own file"
              description={
                hasSelection
                  ? `${session.selection.selectedCount} selected, the rest into a second file.`
                  : 'Select some pages first to use this.'
              }
            />
          </fieldset>
        )}

        {mode === 'whole-document' && isImageFormat(format) && (
          <label className="dialog__field">
            <span className="dialog__label">Image detail</span>
            <select
              className="dialog__input"
              value={imageResolution}
              onChange={(event) => setImageResolution(event.target.value as ImageResolution)}
            >
              {IMAGE_RESOLUTIONS.map((option) => (
                <option key={option.resolution} value={option.resolution}>
                  {option.label}
                </option>
              ))}
            </select>
            <span className="dialog__option-note">
              {session.document.pageCount() === 1
                ? 'One image file.'
                : `${session.document.pageCount()} images, delivered as a zip.`}
            </span>
          </label>
        )}

        {mode === 'whole-document' && (format === 'txt' || format === 'docx') && (
          <p className="dialog__warning">
            {chosenFormat?.label} keeps the wording of your document, including the text you
            replaced or added, but not its layout, images or fonts.
          </p>
        )}

        <div className="dialog__actions">
          <button type="button" className="button button--quiet" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="button button--primary">
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

interface RadioRowProps {
  readonly name: string;
  readonly checked: boolean;
  readonly onChoose: () => void;
  readonly title: string;
  readonly description: React.ReactNode;
  readonly disabled?: boolean;
}

function RadioRow({
  name,
  checked,
  onChoose,
  title,
  description,
  disabled = false,
}: RadioRowProps) {
  return (
    <label className={`dialog__option ${disabled ? 'dialog__option--disabled' : ''}`}>
      <input
        type="radio"
        name={name}
        checked={checked}
        disabled={disabled}
        onChange={onChoose}
      />
      <span>
        <span className="dialog__option-title">{title}</span>
        <span className="dialog__option-note">{description}</span>
      </span>
    </label>
  );
}

function splitStrategyFor(
  choice: SplitChoice,
  pagesPerFile: number,
  session: EditorSession,
): SplitStrategy {
  switch (choice) {
    case 'every-n':
      return new SplitEveryNPages(pagesPerFile);
    case 'selected':
      return new SplitOutSelectedPages(session.selection.selectedPageIds);
    default:
      return new SplitIntoSinglePages();
  }
}
