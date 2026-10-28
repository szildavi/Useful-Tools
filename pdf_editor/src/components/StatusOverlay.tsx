import type { BackgroundTaskState } from '../state/useBackgroundTask';
import './StatusOverlay.css';

interface StatusOverlayProps {
  readonly task: BackgroundTaskState;
}

/** Shows what the app is busy with, and any error it ran into. */
export function StatusOverlay({ task }: StatusOverlayProps) {
  return (
    <>
      {task.isBusy && (
        <div className="status-overlay" role="status">
          <span className="status-overlay__spinner" aria-hidden="true" />
          {task.busyMessage}
        </div>
      )}

      {task.errorMessage && (
        <div className="status-error" role="alert">
          <span className="status-error__message">{task.errorMessage}</span>
          <button
            type="button"
            className="button button--quiet status-error__dismiss"
            onClick={task.dismissError}
          >
            Dismiss
          </button>
        </div>
      )}
    </>
  );
}
