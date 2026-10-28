"""The reporter that forwards conversion events to the graphical interface."""

from __future__ import annotations

from ..core.conversion_job import ConversionJob, ConversionResult, ConversionSummary
from ..core.conversion_settings import ConversionSettings
from ..core.progress_reporter import ProgressReporter
from .conversion_events import ConversionEventName, ConversionEventQueue


class GuiProgressReporter(ProgressReporter):
    """Sends every conversion event into the queue of the graphical interface."""

    def __init__(self, event_queue: ConversionEventQueue) -> None:
        self._event_queue = event_queue

    def batch_started(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Tell the interface what is going to be converted."""
        self._event_queue.publish(ConversionEventName.BATCH_STARTED, jobs=jobs, settings=settings)

    def job_started(self, job: ConversionJob, job_number: int, total_job_count: int) -> None:
        """Tell the interface which file is being converted now."""
        self._event_queue.publish(
            ConversionEventName.JOB_STARTED,
            job=job,
            job_number=job_number,
            total_job_count=total_job_count,
        )

    def job_progressed(self, job: ConversionJob, completion_ratio: float) -> None:
        """Tell the interface how far the running conversion is."""
        self._event_queue.publish(ConversionEventName.JOB_PROGRESSED, job=job, completion_ratio=completion_ratio)

    def job_finished(self, result: ConversionResult) -> None:
        """Tell the interface how the conversion of one file ended."""
        self._event_queue.publish(ConversionEventName.JOB_FINISHED, result=result)

    def batch_finished(self, summary: ConversionSummary) -> None:
        """Tell the interface that the whole batch is done."""
        self._event_queue.publish(ConversionEventName.BATCH_FINISHED, summary=summary)
