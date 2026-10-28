import { useFileDropTarget } from '../hooks/useFileDropTarget';
import { FilePicker } from './FilePicker';
import './WelcomeScreen.css';

interface WelcomeScreenProps {
  readonly acceptedFileExtensions: string;
  readonly onFilesChosen: (files: readonly File[]) => void;
}

const PRIVACY_POINTS: readonly string[] = [
  'Your files are opened and edited inside this browser tab.',
  'Nothing is uploaded, and there is no server to upload to.',
  'Closing the tab erases everything.',
];

export function WelcomeScreen({ acceptedFileExtensions, onFilesChosen }: WelcomeScreenProps) {
  const { isDraggingOver, dropHandlers } = useFileDropTarget(onFilesChosen);

  return (
    <div className="welcome" {...dropHandlers}>
      <div className={`welcome__panel ${isDraggingOver ? 'welcome__panel--active' : ''}`}>
        <div className="welcome__mark" aria-hidden="true">
          PDF
        </div>
        <h1 className="welcome__title">PDF Editor</h1>
        <p className="welcome__subtitle">
          Reorder, rotate, merge, split, draw on and retype your PDFs - entirely on your own
          computer.
        </p>

        <FilePicker
          accept={acceptedFileExtensions}
          onFilesChosen={onFilesChosen}
          className="button button--primary welcome__action"
        >
          Choose files
        </FilePicker>
        <p className="welcome__hint">or drop them anywhere on this page</p>

        <ul className="welcome__privacy">
          {PRIVACY_POINTS.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
