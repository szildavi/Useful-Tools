"""The terminal application that converts videos without a graphical interface."""

from __future__ import annotations

import signal
import sys
import threading

from ..core.conversion_job import ConversionJob, ConversionOutcome, ConversionSummary
from ..core.conversion_planner import ConversionPlanner
from ..core.conversion_settings import ConversionSettings
from ..core.converter_factory import ConverterFactory
from ..core.ffmpeg_locator import FfmpegNotFoundError
from .argument_parser import ArgumentParser, CommandLineRequest
from .console_progress_reporter import ConsoleProgressReporter

EXIT_CODE_SUCCESS = 0
EXIT_CODE_FAILURE = 1
EXIT_CODE_NOTHING_TO_DO = 2
EXIT_CODE_CANCELLED = 130


class CliApplication:
    """Runs one batch conversion that was described on the command line."""

    def __init__(self) -> None:
        self._reporter = ConsoleProgressReporter()
        self._cancellation_event = threading.Event()

    def run(self, request: CommandLineRequest) -> int:
        """Run the command line application and return its exit code."""
        jobs = ConversionPlanner().plan(request.input_paths, request.settings)
        if not jobs:
            return self._report_that_there_is_nothing_to_do(request)
        if request.list_only:
            return self._list_jobs(jobs, request.settings)
        return self._convert_jobs(jobs, request.settings)

    def _report_that_there_is_nothing_to_do(self, request: CommandLineRequest) -> int:
        """Explain that no video file was found for the given paths."""
        if not request.input_paths:
            self._write_error("No input file or folder was given. Use --help to see the usage.")
        else:
            self._write_error("No convertible video file was found on the given paths.")
        return EXIT_CODE_NOTHING_TO_DO

    def _list_jobs(self, jobs: list[ConversionJob], settings: ConversionSettings) -> int:
        """Print what would be converted, without converting anything."""
        print(f"{len(jobs)} file(s) would be converted into {settings.output_directory}:")
        for job in jobs:
            print(f"  {job.source_path}  ->  {job.destination_path}")
        return EXIT_CODE_SUCCESS

    def _convert_jobs(self, jobs: list[ConversionJob], settings: ConversionSettings) -> int:
        """Convert every planned job and return the exit code of the batch."""
        try:
            converter_factory = ConverterFactory()
            self._warn_about_the_chosen_profile(converter_factory, jobs, settings)
            batch_converter = converter_factory.create_batch_converter(self._reporter)
        except FfmpegNotFoundError as error:
            self._write_error(str(error))
            return EXIT_CODE_FAILURE

        self._announce_parallel_work(jobs, settings)
        self._listen_for_interruption()
        summary = batch_converter.convert_all(jobs, settings, self._cancellation_event)
        return self._exit_code_of(summary)

    def _warn_about_the_chosen_profile(
        self,
        converter_factory: ConverterFactory,
        jobs: list[ConversionJob],
        settings: ConversionSettings,
    ) -> None:
        """Warn when the chosen profile stores more than the sources contain."""
        warning = converter_factory.create_compatibility_checker().check(jobs, settings)
        if warning is None:
            return
        self._write_error(f"\nWarning:\n{warning.describe()}\n")

    def _announce_parallel_work(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Tell how many files are going to be converted at the same time."""
        parallel_job_count = min(settings.parallel_job_count, len(jobs))
        if parallel_job_count < 2:
            return
        print(
            f"Converting {parallel_job_count} files at a time, "
            f"{settings.ffmpeg_thread_count} thread(s) for each of them."
        )

    def _listen_for_interruption(self) -> None:
        """Turn a Ctrl+C into a clean cancellation of the running batch."""
        signal.signal(signal.SIGINT, self._request_cancellation)
        signal.signal(signal.SIGTERM, self._request_cancellation)

    def _request_cancellation(self, signal_number, frame) -> None:
        """Ask the running batch to stop as soon as possible."""
        self._cancellation_event.set()

    def _exit_code_of(self, summary: ConversionSummary) -> int:
        """Return the exit code that belongs to a finished batch."""
        if summary.count_of(ConversionOutcome.CANCELLED) > 0:
            return EXIT_CODE_CANCELLED
        if summary.count_of(ConversionOutcome.FAILED) > 0:
            return EXIT_CODE_FAILURE
        return EXIT_CODE_SUCCESS

    def _write_error(self, message: str) -> None:
        """Print an error message to the error output of the terminal."""
        print(message, file=sys.stderr)
