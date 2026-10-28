"""The abstraction that lets any interface follow the conversion of a batch."""

from __future__ import annotations

from abc import ABC

from .conversion_job import ConversionJob, ConversionResult, ConversionSummary
from .conversion_settings import ConversionSettings


class ProgressReporter(ABC):
    """Receives every event of a running batch conversion.

    Every method does nothing by default, so an interface only has to override
    the events it really wants to show.
    """

    def batch_started(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Called once before the first file is converted."""

    def job_started(self, job: ConversionJob, job_number: int, total_job_count: int) -> None:
        """Called when the conversion of one file begins."""

    def job_progressed(self, job: ConversionJob, completion_ratio: float) -> None:
        """Called while a file is being converted, with a ratio between 0 and 1."""

    def job_finished(self, result: ConversionResult) -> None:
        """Called when one file is converted, skipped, cancelled or failed."""

    def batch_finished(self, summary: ConversionSummary) -> None:
        """Called once after the last file was handled."""


class SilentProgressReporter(ProgressReporter):
    """A reporter that shows nothing, used when no interface is attached."""
