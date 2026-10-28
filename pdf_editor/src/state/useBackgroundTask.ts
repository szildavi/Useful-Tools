import { useCallback, useMemo, useState } from 'react';

export interface BackgroundTaskState {
  readonly isBusy: boolean;
  readonly busyMessage: string | null;
  readonly errorMessage: string | null;
  readonly dismissError: () => void;
  /**
   * Runs an async job while showing a busy message, turning any failure into a
   * message for the user instead of an unhandled rejection.
   */
  readonly run: <TResult>(
    busyMessage: string,
    job: () => Promise<TResult>,
  ) => Promise<TResult | undefined>;
}

/** Shared busy and error handling for the app's asynchronous work. */
export function useBackgroundTask(): BackgroundTaskState {
  const [busyMessage, setBusyMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const dismissError = useCallback(() => setErrorMessage(null), []);

  const run = useCallback(
    async <TResult,>(
      message: string,
      job: () => Promise<TResult>,
    ): Promise<TResult | undefined> => {
      setBusyMessage(message);
      setErrorMessage(null);
      try {
        return await job();
      } catch (failure) {
        setErrorMessage(describeFailure(failure));
        return undefined;
      } finally {
        setBusyMessage(null);
      }
    },
    [],
  );

  return useMemo(
    () => ({
      isBusy: busyMessage !== null,
      busyMessage,
      errorMessage,
      dismissError,
      run,
    }),
    [busyMessage, errorMessage, dismissError, run],
  );
}

function describeFailure(failure: unknown): string {
  if (failure instanceof Error) {
    return failure.message;
  }
  return 'Something went wrong.';
}
