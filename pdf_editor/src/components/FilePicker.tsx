import { useId, useRef, type ReactNode } from 'react';

interface FilePickerProps {
  readonly accept: string;
  readonly onFilesChosen: (files: readonly File[]) => void;
  readonly className?: string;
  readonly children: ReactNode;
}

/**
 * A button that opens the browser's file dialog.
 *
 * Wrapping the hidden input here means no other component has to deal with file
 * input plumbing.
 */
export function FilePicker({ accept, onFilesChosen, className, children }: FilePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        id={inputId}
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          // Clearing the value lets the same file be chosen again later.
          event.target.value = '';
          if (files.length > 0) {
            onFilesChosen(files);
          }
        }}
      />
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
    </>
  );
}
