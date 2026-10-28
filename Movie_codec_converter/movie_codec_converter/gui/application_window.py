"""The main window of the graphical interface."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import messagebox, ttk

from .. import APPLICATION_NAME
from ..core.batch_description import BatchDescription
from ..core.batch_progress_tracker import BatchProgressTracker
from ..core.conversion_job import ConversionJob, ConversionOutcome, ConversionResult, ConversionSummary
from ..core.conversion_planner import ConversionPlanner
from ..core.conversion_settings import ConversionSettings
from ..core.converter_factory import ConverterFactory
from ..core.ffmpeg_locator import FfmpegNotFoundError
from .conversion_events import ConversionEvent, ConversionEventName, ConversionEventQueue
from .conversion_worker import ConversionWorker
from .file_list_panel import FileListPanel
from .progress_panel import ProgressPanel
from .settings_panel import SettingsPanel

EVENT_POLL_INTERVAL_MILLISECONDS = 100
WINDOW_MINIMUM_SIZE = (780, 780)
OUTCOME_LABELS = {
    ConversionOutcome.CONVERTED: "Done",
    ConversionOutcome.SKIPPED: "Skipped",
    ConversionOutcome.FAILED: "Failed",
    ConversionOutcome.CANCELLED: "Cancelled",
}


class ApplicationWindow(tk.Tk):
    """The window that lets the user convert videos into DNxHR MOV files."""

    def __init__(self) -> None:
        super().__init__()
        self._converter_factory = ConverterFactory()
        self._event_queue = ConversionEventQueue()
        self._worker = ConversionWorker(self._event_queue, self._converter_factory)
        self._progress_tracker = BatchProgressTracker()
        self._output_directory = Path()
        self._build_window()
        self._start_event_polling()

    def _build_window(self) -> None:
        """Create the window and every panel inside it."""
        self.title(APPLICATION_NAME)
        self.minsize(*WINDOW_MINIMUM_SIZE)
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)
        self.rowconfigure(2, weight=1)
        self.protocol("WM_DELETE_WINDOW", self._handle_close_request)
        self._build_panels()
        self._build_action_bar()

    def _build_panels(self) -> None:
        """Create the three panels of the window."""
        self._file_list_panel = FileListPanel(self)
        self._file_list_panel.grid(row=0, column=0, sticky="nsew", padx=10, pady=(10, 6))
        self._settings_panel = SettingsPanel(self)
        self._settings_panel.grid(row=1, column=0, sticky="ew", padx=10, pady=6)
        self._progress_panel = ProgressPanel(self)
        self._progress_panel.grid(row=2, column=0, sticky="nsew", padx=10, pady=6)

    def _build_action_bar(self) -> None:
        """Create the row with the start and the cancel button."""
        action_bar = ttk.Frame(self)
        action_bar.grid(row=3, column=0, sticky="ew", padx=10, pady=(6, 10))
        action_bar.columnconfigure(0, weight=1)
        self._start_button = ttk.Button(action_bar, text="Start conversion", command=self._start_conversion)
        self._start_button.grid(row=0, column=1, padx=(0, 6))
        self._cancel_button = ttk.Button(action_bar, text="Cancel", command=self._cancel_conversion, state="disabled")
        self._cancel_button.grid(row=0, column=2)

    def _start_conversion(self) -> None:
        """Plan the batch of the chosen paths and start converting it."""
        selection = self._file_list_panel.selection
        settings = self._settings_panel.build_settings(selection)
        jobs = ConversionPlanner().plan(selection.paths, settings)
        if not jobs:
            messagebox.showwarning(
                APPLICATION_NAME,
                "No convertible file was found. Add files or folders first.",
                parent=self,
            )
            return
        self._prepare_for_batch(jobs, settings)
        if not self._user_accepts_the_chosen_profile(jobs, settings):
            self._progress_panel.write_log_line("The conversion was not started.")
            self._set_controls_enabled(True)
            return
        self._worker.start(jobs, settings)

    def _prepare_for_batch(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Put the window into the running state before a batch starts."""
        self._progress_tracker.start_batch(len(jobs))
        self._progress_panel.reset()
        self._progress_panel.write_log_line(f"Output folder: {settings.output_directory}")
        self._progress_panel.write_log_line(
            f"Profile: {settings.profile.display_name} | Audio: {settings.audio_option.display_name}"
        )
        self._progress_panel.write_log_line(self._describe_parallel_work(jobs, settings))
        self._set_controls_enabled(False)

    def _describe_parallel_work(self, jobs: list[ConversionJob], settings: ConversionSettings) -> str:
        """Return the log line about how many files convert at the same time."""
        parallel_job_count = min(settings.parallel_job_count, len(jobs))
        if parallel_job_count < 2:
            return "Converting one file at a time."
        return (
            f"Converting {parallel_job_count} files at a time, "
            f"{settings.ffmpeg_thread_count} thread(s) for each of them."
        )

    def _user_accepts_the_chosen_profile(self, jobs: list[ConversionJob], settings: ConversionSettings) -> bool:
        """Warn about a profile that stores more than the sources contain."""
        self._progress_panel.write_log_line("Checking the source videos...")
        self.update_idletasks()
        try:
            warning = self._converter_factory.create_compatibility_checker().check(jobs, settings)
        except FfmpegNotFoundError as error:
            self._on_engine_failed(str(error))
            return False
        if warning is None:
            return True
        self._progress_panel.write_log_line(warning.describe())
        return messagebox.askokcancel(
            f"{APPLICATION_NAME} - warning",
            f"{warning.describe()}\n\nDo you want to convert them anyway?",
            icon=messagebox.WARNING,
            parent=self,
        )

    def _cancel_conversion(self) -> None:
        """Ask the running conversion to stop."""
        self._worker.cancel()
        self._cancel_button.configure(state="disabled")
        self._progress_panel.write_log_line("Stopping after the running files...")

    def _set_controls_enabled(self, is_enabled: bool) -> None:
        """Enable the settings or lock them while a conversion is running."""
        self._file_list_panel.set_enabled(is_enabled)
        self._settings_panel.set_enabled(is_enabled)
        self._start_button.configure(state="normal" if is_enabled else "disabled")
        self._cancel_button.configure(state="disabled" if is_enabled else "normal")

    def _start_event_polling(self) -> None:
        """Start checking the events sent by the conversion threads."""
        self.after(EVENT_POLL_INTERVAL_MILLISECONDS, self._handle_pending_events)

    def _handle_pending_events(self) -> None:
        """Show every event that arrived from the conversion threads."""
        for event in self._event_queue.collect_pending():
            self._handle_event(event)
        self._start_event_polling()

    def _handle_event(self, event: ConversionEvent) -> None:
        """Send one event to the method that knows how to show it."""
        handlers = {
            ConversionEventName.BATCH_STARTED: self._on_batch_started,
            ConversionEventName.JOB_STARTED: self._on_job_started,
            ConversionEventName.JOB_PROGRESSED: self._on_job_progressed,
            ConversionEventName.JOB_FINISHED: self._on_job_finished,
            ConversionEventName.BATCH_FINISHED: self._on_batch_finished,
            ConversionEventName.ENGINE_FAILED: self._on_engine_failed,
        }
        handlers[event.name](**event.details)

    def _on_batch_started(self, jobs: list[ConversionJob], settings: ConversionSettings) -> None:
        """Show that the batch has started."""
        self._progress_tracker.start_batch(len(jobs))
        self._output_directory = settings.output_directory
        self._progress_panel.write_log_line(f"Converting {BatchDescription(jobs).describe()}...")

    def _on_job_started(self, job: ConversionJob, job_number: int, total_job_count: int) -> None:
        """Show a new line for the file that is being converted now."""
        self._progress_tracker.update_job(job, 0.0)
        headline = f"[{job_number}/{total_job_count}] {job.describe_destination(self._output_directory)}"
        self._progress_panel.add_running_job(job, headline)

    def _on_job_progressed(self, job: ConversionJob, completion_ratio: float) -> None:
        """Move the progress bar of one file and the one of the batch."""
        self._progress_tracker.update_job(job, completion_ratio)
        self._progress_panel.update_running_job(job, completion_ratio)
        self._show_batch_progress()

    def _on_job_finished(self, result: ConversionResult) -> None:
        """Show how the conversion of one file ended."""
        self._progress_tracker.finish_job(result.job)
        self._progress_panel.remove_running_job(result.job)
        self._show_batch_progress()
        self._progress_panel.write_log_line(self._describe_result(result))

    def _on_batch_finished(self, summary: ConversionSummary) -> None:
        """Show the summary of the finished batch and unlock the window."""
        self._progress_panel.show_batch_progress(1.0)
        self._progress_panel.write_log_line(f"Finished: {summary.describe()}")
        self._set_controls_enabled(True)
        self._show_summary_message(summary)

    def _on_engine_failed(self, message: str) -> None:
        """Show that the conversion could not be started at all."""
        self._progress_panel.write_log_line(message)
        self._set_controls_enabled(True)
        messagebox.showerror(APPLICATION_NAME, message, parent=self)

    def _show_batch_progress(self) -> None:
        """Move the progress bar that belongs to the whole batch."""
        self._progress_panel.show_batch_progress(self._progress_tracker.overall_ratio)

    def _describe_result(self, result: ConversionResult) -> str:
        """Return the log line that belongs to one finished job."""
        label = OUTCOME_LABELS[result.outcome]
        line = f"{label}: {result.job.source_path.name} -> {result.job.describe_destination(self._output_directory)}"
        if result.message:
            return f"{line} ({result.message})"
        return line

    def _show_summary_message(self, summary: ConversionSummary) -> None:
        """Show a message box with the result of the finished batch."""
        if summary.failed_results:
            messagebox.showerror(APPLICATION_NAME, f"{summary.describe()}\n\nSee the log for the details.", parent=self)
            return
        messagebox.showinfo(APPLICATION_NAME, summary.describe(), parent=self)

    def _handle_close_request(self) -> None:
        """Ask before closing the window while a conversion is running."""
        if self._worker.is_running:
            if not messagebox.askyesno(
                APPLICATION_NAME,
                "A conversion is still running. Do you want to stop it and quit?",
                parent=self,
            ):
                return
            self._worker.cancel()
        self.destroy()
