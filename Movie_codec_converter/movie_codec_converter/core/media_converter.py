"""Conversion of a single media file by running ffmpeg."""

from __future__ import annotations

import subprocess
import tempfile
import threading
from pathlib import Path
from typing import Callable

from .conversion_job import ConversionJob, ConversionOutcome, ConversionResult
from .conversion_settings import ConversionSettings
from .ffmpeg_command_builder import CommandBuilderSelector
from .ffmpeg_progress_parser import FfmpegProgressParser
from .media_inspector import MediaInspector

CANCELLATION_CHECK_INTERVAL_SECONDS = 0.2
PROCESS_SHUTDOWN_TIMEOUT_SECONDS = 5
ERROR_MESSAGE_LINE_LIMIT = 6

ProgressCallback = Callable[[float], None]


class MediaConverter:
    """Converts one source file with ffmpeg.

    A video becomes a DNxHR MOV file and an audio file becomes a WAV file, the
    command of the right kind comes from the selector.
    """

    def __init__(self, command_builder_selector: CommandBuilderSelector, media_inspector: MediaInspector) -> None:
        self._command_builder_selector = command_builder_selector
        self._media_inspector = media_inspector

    def convert(
        self,
        job: ConversionJob,
        settings: ConversionSettings,
        on_progress: ProgressCallback | None = None,
        cancellation_event: threading.Event | None = None,
    ) -> ConversionResult:
        """Convert one file and return how the conversion ended."""
        try:
            self._prepare_destination_directory(job.destination_path)
        except OSError as error:
            return self._failure(job, f"The output folder cannot be created: {error}")

        duration_seconds = self._media_inspector.inspect(job.source_path).duration_seconds
        progress_parser = FfmpegProgressParser(duration_seconds)
        command_builder = self._command_builder_selector.builder_for(job.media_kind)
        command = command_builder.build(job.source_path, job.destination_path, settings)

        try:
            return self._run_ffmpeg(job, command, progress_parser, on_progress, cancellation_event)
        except OSError as error:
            return self._failure(job, f"ffmpeg could not be started: {error}")

    def _prepare_destination_directory(self, destination_path: Path) -> None:
        """Create the folder of the destination file when it does not exist."""
        destination_path.parent.mkdir(parents=True, exist_ok=True)

    def _run_ffmpeg(
        self,
        job: ConversionJob,
        command: list[str],
        progress_parser: FfmpegProgressParser,
        on_progress: ProgressCallback | None,
        cancellation_event: threading.Event | None,
    ) -> ConversionResult:
        """Run the ffmpeg command and follow it until it ends or is cancelled."""
        with tempfile.TemporaryFile(mode="w+", encoding="utf-8", errors="replace") as error_output:
            process = subprocess.Popen(
                command,
                stdin=subprocess.DEVNULL,
                stdout=subprocess.PIPE,
                stderr=error_output,
                text=True,
                bufsize=1,
            )
            was_cancelled = self._follow_process(process, progress_parser, on_progress, cancellation_event)
            return_code = process.wait()
            if was_cancelled:
                return self._cancellation(job)
            if return_code != 0:
                return self._failure(job, self._read_error_message(error_output, return_code))

        self._report_progress(on_progress, progress_parser.mark_as_finished())
        return ConversionResult(job=job, outcome=ConversionOutcome.CONVERTED)

    def _follow_process(
        self,
        process: subprocess.Popen,
        progress_parser: FfmpegProgressParser,
        on_progress: ProgressCallback | None,
        cancellation_event: threading.Event | None,
    ) -> bool:
        """Read the progress of ffmpeg and tell whether it had to be cancelled."""
        assert process.stdout is not None
        for line in process.stdout:
            if self._is_cancellation_requested(cancellation_event):
                self._stop_process(process)
                return True
            updated_ratio = progress_parser.read_line(line)
            if updated_ratio is not None:
                self._report_progress(on_progress, updated_ratio)
        return False

    def _is_cancellation_requested(self, cancellation_event: threading.Event | None) -> bool:
        """Tell whether the user asked to stop the conversion."""
        return cancellation_event is not None and cancellation_event.is_set()

    def _stop_process(self, process: subprocess.Popen) -> None:
        """Stop a running ffmpeg process as gently as possible."""
        process.terminate()
        try:
            process.wait(timeout=PROCESS_SHUTDOWN_TIMEOUT_SECONDS)
        except subprocess.TimeoutExpired:
            process.kill()

    def _report_progress(self, on_progress: ProgressCallback | None, completion_ratio: float) -> None:
        """Hand the current completion ratio over to the caller."""
        if on_progress is not None:
            on_progress(completion_ratio)

    def _read_error_message(self, error_output, return_code: int) -> str:
        """Return the last ffmpeg error lines as one readable message."""
        error_output.seek(0)
        error_lines = [line.strip() for line in error_output.read().splitlines() if line.strip()]
        if not error_lines:
            return f"ffmpeg stopped with exit code {return_code}."
        return " | ".join(error_lines[-ERROR_MESSAGE_LINE_LIMIT:])

    def _failure(self, job: ConversionJob, message: str) -> ConversionResult:
        """Return a failed result and remove the unusable output file."""
        self._delete_incomplete_output(job.destination_path)
        return ConversionResult(job=job, outcome=ConversionOutcome.FAILED, message=message)

    def _cancellation(self, job: ConversionJob) -> ConversionResult:
        """Return a cancelled result and remove the unfinished output file."""
        self._delete_incomplete_output(job.destination_path)
        return ConversionResult(job=job, outcome=ConversionOutcome.CANCELLED, message="Cancelled by the user.")

    def _delete_incomplete_output(self, destination_path: Path) -> None:
        """Delete a half written destination file so it cannot be mistaken for a good one."""
        try:
            destination_path.unlink(missing_ok=True)
        except OSError:
            pass
