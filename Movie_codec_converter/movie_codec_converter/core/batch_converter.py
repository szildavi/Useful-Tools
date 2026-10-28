"""Conversion of many files, alone or several of them at the same time."""

from __future__ import annotations

import threading
from concurrent.futures import Future, ThreadPoolExecutor
from functools import partial

from .conversion_job import ConversionJob, ConversionOutcome, ConversionResult, ConversionSummary
from .conversion_settings import ConversionSettings
from .media_converter import MediaConverter
from .progress_reporter import ProgressReporter, SilentProgressReporter

WORKER_THREAD_NAME = "conversion"


class BatchConverter:
    """Runs the jobs of a batch and reports what happens to each of them.

    The number of jobs running at the same time comes from the settings, so one
    single implementation covers both the parallel and the one by one work.
    """

    def __init__(self, media_converter: MediaConverter, reporter: ProgressReporter | None = None) -> None:
        self._media_converter = media_converter
        self._reporter = reporter or SilentProgressReporter()

    def convert_all(
        self,
        jobs: list[ConversionJob],
        settings: ConversionSettings,
        cancellation_event: threading.Event | None = None,
    ) -> ConversionSummary:
        """Convert every job and return the summary of the batch."""
        self._reporter.batch_started(jobs, settings)
        results = self._run_jobs(jobs, settings, cancellation_event)
        summary = ConversionSummary(results)
        self._reporter.batch_finished(summary)
        return summary

    def _run_jobs(
        self,
        jobs: list[ConversionJob],
        settings: ConversionSettings,
        cancellation_event: threading.Event | None,
    ) -> list[ConversionResult]:
        """Run every job on a pool of threads and collect the results in job order."""
        with ThreadPoolExecutor(
            max_workers=self._worker_count_for(jobs, settings),
            thread_name_prefix=WORKER_THREAD_NAME,
        ) as thread_pool:
            running_jobs = [
                thread_pool.submit(self._handle_job, job, job_number, len(jobs), settings, cancellation_event)
                for job_number, job in enumerate(jobs, start=1)
            ]
            return [self._result_of(running_job, job) for running_job, job in zip(running_jobs, jobs)]

    def _worker_count_for(self, jobs: list[ConversionJob], settings: ConversionSettings) -> int:
        """Return how many jobs may run at the same time, never more than the jobs."""
        return max(1, min(settings.parallel_job_count, len(jobs)))

    def _result_of(self, running_job: Future, job: ConversionJob) -> ConversionResult:
        """Return the result of a finished thread, even when the thread broke down."""
        try:
            return running_job.result()
        except Exception as error:  # a broken thread must not stop the whole batch
            return ConversionResult(job, ConversionOutcome.FAILED, f"Unexpected error: {error}")

    def _handle_job(
        self,
        job: ConversionJob,
        job_number: int,
        total_job_count: int,
        settings: ConversionSettings,
        cancellation_event: threading.Event | None,
    ) -> ConversionResult:
        """Convert, skip or cancel a single job and report its result."""
        self._reporter.job_started(job, job_number, total_job_count)
        result = self._resolve_job(job, settings, cancellation_event)
        self._reporter.job_finished(result)
        return result

    def _resolve_job(
        self,
        job: ConversionJob,
        settings: ConversionSettings,
        cancellation_event: threading.Event | None,
    ) -> ConversionResult:
        """Return the result of a job, without converting it when it must not run."""
        if self._is_cancelled(cancellation_event):
            return ConversionResult(job, ConversionOutcome.CANCELLED, "Cancelled before it started.")
        if self._would_overwrite_the_source(job):
            return ConversionResult(job, ConversionOutcome.FAILED, "The output file would replace the source file.")
        if self._must_be_skipped(job, settings):
            return ConversionResult(job, ConversionOutcome.SKIPPED, "The output file already exists.")
        return self._media_converter.convert(
            job,
            settings,
            on_progress=partial(self._reporter.job_progressed, job),
            cancellation_event=cancellation_event,
        )

    def _is_cancelled(self, cancellation_event: threading.Event | None) -> bool:
        """Tell whether the user already asked to stop the batch."""
        return cancellation_event is not None and cancellation_event.is_set()

    def _would_overwrite_the_source(self, job: ConversionJob) -> bool:
        """Tell whether the destination file is the source file itself."""
        return job.destination_path.resolve() == job.source_path.resolve()

    def _must_be_skipped(self, job: ConversionJob, settings: ConversionSettings) -> bool:
        """Tell whether an already existing output file has to be kept."""
        return job.destination_path.exists() and not settings.overwrite_existing
