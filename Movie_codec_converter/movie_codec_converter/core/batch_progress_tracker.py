"""Following how much of a whole batch is done while files convert side by side."""

from __future__ import annotations

import threading

from .conversion_job import ConversionJob


class BatchProgressTracker:
    """Collects the progress of every running file into one batch progress.

    Several conversion threads report into it at the same time, so every change
    is made under a lock.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._total_job_count = 0
        self._finished_job_count = 0
        self._running_ratios: dict[ConversionJob, float] = {}

    def start_batch(self, total_job_count: int) -> None:
        """Forget the earlier batch and wait for the given number of files."""
        with self._lock:
            self._total_job_count = total_job_count
            self._finished_job_count = 0
            self._running_ratios.clear()

    def update_job(self, job: ConversionJob, completion_ratio: float) -> None:
        """Store how far one running file is."""
        with self._lock:
            self._running_ratios[job] = completion_ratio

    def finish_job(self, job: ConversionJob) -> None:
        """Count one file as done and stop following it."""
        with self._lock:
            self._running_ratios.pop(job, None)
            self._finished_job_count += 1

    @property
    def overall_ratio(self) -> float:
        """Return how much of the whole batch is done, between 0.0 and 1.0."""
        with self._lock:
            if self._total_job_count == 0:
                return 0.0
            done_jobs = self._finished_job_count + sum(self._running_ratios.values())
            return min(done_jobs / self._total_job_count, 1.0)

    @property
    def finished_job_count(self) -> int:
        """Return how many files are already done."""
        with self._lock:
            return self._finished_job_count

    @property
    def running_job_count(self) -> int:
        """Return how many files are being converted right now."""
        with self._lock:
            return len(self._running_ratios)
