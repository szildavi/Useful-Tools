"""Showing the progress of a batch conversion inside a terminal."""

from __future__ import annotations

import sys
import threading
from pathlib import Path

from ..core.batch_description import BatchDescription
from ..core.batch_progress_tracker import BatchProgressTracker
from ..core.conversion_job import ConversionJob, ConversionOutcome, ConversionResult, ConversionSummary
from ..core.conversion_settings import ConversionSettings
from ..core.progress_reporter import ProgressReporter

PROGRESS_BAR_WIDTH = 30
PROGRESS_LINE_WIDTH = 70
OUTCOME_LABELS = {
    ConversionOutcome.CONVERTED: "done",
    ConversionOutcome.SKIPPED: "skipped",
    ConversionOutcome.FAILED: "failed",
    ConversionOutcome.CANCELLED: "cancelled",
}


class ConsoleProgressReporter(ProgressReporter):
    """Prints one progress bar for the whole batch and one line per finished file.

    Several files may be converted at the same time, so every printing is made
    under a lock and the bar always shows the progress of the whole batch.
    """

    def __init__(self, output_stream=sys.stdout) -> None:
        self._output_stream = output_stream
        self._can_redraw_lines = output_stream.isatty()
        self._progress_tracker = BatchProgressTracker()
        self._printing_lock = threading.Lock()
        self._total_job_count = 0
        self._output_directory = Path()

    def batch_started(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Announce what is going to be converted."""
        self._total_job_count = len(jobs)
        self._output_directory = settings.output_directory
        self._progress_tracker.start_batch(self._total_job_count)
        with self._printing_lock:
            self._write_line(f"Converting {BatchDescription(jobs).describe()}")

    def job_started(self, job: ConversionJob, job_number: int, total_job_count: int) -> None:
        """Announce that the conversion of one file has begun."""
        self._progress_tracker.update_job(job, 0.0)
        with self._printing_lock:
            destination = job.describe_destination(self._output_directory)
            self._write_line(f"[{job_number}/{total_job_count}] {job.source_path.name}  ->  {destination}")
            self._redraw_progress_bar()

    def job_progressed(self, job: ConversionJob, completion_ratio: float) -> None:
        """Redraw the progress bar of the whole batch."""
        self._progress_tracker.update_job(job, completion_ratio)
        with self._printing_lock:
            self._redraw_progress_bar()

    def job_finished(self, result: ConversionResult) -> None:
        """Print how the conversion of one file ended."""
        self._progress_tracker.finish_job(result.job)
        with self._printing_lock:
            self._write_line(self._describe_result(result))
            self._redraw_progress_bar()

    def batch_finished(self, summary: ConversionSummary) -> None:
        """Print the summary of the whole batch."""
        with self._printing_lock:
            self._write_line(f"\nFinished: {summary.describe()}")

    def _describe_result(self, result: ConversionResult) -> str:
        """Return the line that belongs to one finished file."""
        label = OUTCOME_LABELS[result.outcome]
        line = f"  {label}: {result.job.describe_destination(self._output_directory)}"
        if result.message:
            return f"{line} ({result.message})"
        return line

    def _redraw_progress_bar(self) -> None:
        """Draw the progress bar of the batch on the current line."""
        if not self._can_redraw_lines:
            return
        self._write_without_newline(f"\r  {self._render_progress_bar()}")

    def _render_progress_bar(self) -> str:
        """Return the text progress bar of the whole batch."""
        completion_ratio = self._progress_tracker.overall_ratio
        filled_width = int(completion_ratio * PROGRESS_BAR_WIDTH)
        bar = "#" * filled_width + "-" * (PROGRESS_BAR_WIDTH - filled_width)
        finished_count = self._progress_tracker.finished_job_count
        return f"[{bar}] {completion_ratio * 100:5.1f}%  ({finished_count}/{self._total_job_count} files)"

    def _write_line(self, text: str) -> None:
        """Print one finished line above the progress bar."""
        self._clear_progress_bar()
        print(text, file=self._output_stream, flush=True)

    def _clear_progress_bar(self) -> None:
        """Remove the progress bar so a message can be printed in its place."""
        if self._can_redraw_lines:
            self._write_without_newline("\r" + " " * PROGRESS_LINE_WIDTH + "\r")

    def _write_without_newline(self, text: str) -> None:
        """Print text that stays on the current line of the terminal."""
        self._output_stream.write(text)
        self._output_stream.flush()
