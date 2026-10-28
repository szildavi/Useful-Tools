"""Runs a batch of conversion jobs across the machine's CPU cores."""

from __future__ import annotations

import os
import threading
from concurrent.futures import Future, ThreadPoolExecutor
from typing import Callable, List, Sequence

from .conversion_job import ConversionJob, JobStatus
from .conversion_registry import ConversionRegistry

JobListener = Callable[[ConversionJob], None]
BatchListener = Callable[[Sequence[ConversionJob]], None]


def default_worker_count() -> int:
    """Return one worker per CPU core, which is what the batch is sized to."""
    return max(1, os.cpu_count() or 1)


class ParallelConversionRunner:
    """Converts many files at once, one worker per core by default.

    The work is delegated to external programs, so threads spend their time
    waiting on subprocesses rather than competing for the interpreter lock.
    """

    def __init__(
        self,
        registry: ConversionRegistry,
        on_job_changed: JobListener,
        on_batch_finished: BatchListener,
    ) -> None:
        self._registry = registry
        self._on_job_changed = on_job_changed
        self._on_batch_finished = on_batch_finished
        self._cancellation = threading.Event()
        self._executor: ThreadPoolExecutor | None = None
        self._is_running = False

    @property
    def is_running(self) -> bool:
        """Report whether a batch is currently being converted."""
        return self._is_running

    def start(self, jobs: Sequence[ConversionJob], worker_count: int | None = None) -> None:
        """Begin converting ``jobs`` in the background."""
        if self._is_running:
            raise RuntimeError("A conversion batch is already running.")
        pending = [job for job in jobs if job.status is JobStatus.PENDING]
        if not pending:
            self._on_batch_finished(jobs)
            return
        self._cancellation.clear()
        self._is_running = True
        threading.Thread(
            target=self._run_batch,
            args=(list(jobs), pending, worker_count or default_worker_count()),
            daemon=True,
        ).start()

    def cancel(self) -> None:
        """Ask the batch to stop; running conversions finish their current file."""
        self._cancellation.set()

    def _run_batch(
        self,
        all_jobs: List[ConversionJob],
        pending_jobs: List[ConversionJob],
        worker_count: int,
    ) -> None:
        """Submit every pending job to a pool and wait for the pool to drain."""
        try:
            with ThreadPoolExecutor(max_workers=worker_count) as executor:
                self._executor = executor
                futures: List[Future] = [
                    executor.submit(self._run_single_job, job) for job in pending_jobs
                ]
                for future in futures:
                    future.result()
        finally:
            self._executor = None
            self._is_running = False
            self._on_batch_finished(all_jobs)

    def _run_single_job(self, job: ConversionJob) -> None:
        """Convert one file, reporting every status change to the listener."""
        if self._cancellation.is_set():
            job.mark_cancelled()
            self._on_job_changed(job)
            return
        job.mark_running()
        self._on_job_changed(job)
        try:
            output_path = self._convert(job)
            job.mark_done(output_path)
        except Exception as error:  # surfaced in the queue, never crashes the batch
            job.mark_failed(str(error))
        self._on_job_changed(job)

    def _convert(self, job: ConversionJob):
        """Perform the conversion and confirm the output file really exists."""
        converter = self._registry.converter_for(job.source_format, job.target_format)
        job.output_directory.mkdir(parents=True, exist_ok=True)
        output_path = job.build_output_path()
        converter.convert(job, output_path)
        if not output_path.exists():
            raise RuntimeError(
                f"{converter.display_name} reported success but produced no output file."
            )
        return output_path
