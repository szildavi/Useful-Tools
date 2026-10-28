"""The part of the window that shows how the conversion is going."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..core.conversion_job import ConversionJob
from .running_jobs_view import RunningJobsView

PROGRESS_BAR_MAXIMUM = 100.0


class ProgressPanel(ttk.LabelFrame):
    """Shows the running conversions, the progress of the batch and the log."""

    def __init__(self, parent: tk.Misc) -> None:
        super().__init__(parent, text="Progress", padding=8)
        self._build_widgets()

    def add_running_job(self, job: ConversionJob, headline: str) -> None:
        """Show a new line for a conversion that has just started."""
        self._running_jobs_view.add_job(job, headline)

    def update_running_job(self, job: ConversionJob, completion_ratio: float) -> None:
        """Move the progress bar of one running conversion."""
        self._running_jobs_view.update_job(job, completion_ratio)

    def remove_running_job(self, job: ConversionJob) -> None:
        """Remove the line of a conversion that has ended."""
        self._running_jobs_view.remove_job(job)

    def show_batch_progress(self, completion_ratio: float) -> None:
        """Move the progress bar of the whole batch."""
        self._batch_progress_bar["value"] = completion_ratio * PROGRESS_BAR_MAXIMUM

    def reset(self) -> None:
        """Put the panel back into its starting state."""
        self._running_jobs_view.clear()
        self.show_batch_progress(0.0)
        self._clear_log()

    def write_log_line(self, text: str) -> None:
        """Add one line to the log of the conversion."""
        self._log_view.configure(state="normal")
        self._log_view.insert(tk.END, f"{text}\n")
        self._log_view.see(tk.END)
        self._log_view.configure(state="disabled")

    def _build_widgets(self) -> None:
        """Create every widget of the panel."""
        self.columnconfigure(0, weight=1)
        self.rowconfigure(3, weight=1)
        self._build_running_jobs_view()
        self._build_batch_progress_bar()
        self._build_log_view()

    def _build_running_jobs_view(self) -> None:
        """Create the list of the conversions that are running now."""
        self._running_jobs_view = RunningJobsView(self)
        self._running_jobs_view.grid(row=0, column=0, sticky="ew")

    def _build_batch_progress_bar(self) -> None:
        """Create the progress bar that shows the state of the whole batch."""
        ttk.Label(self, text="All files", anchor="w").grid(row=1, column=0, sticky="ew", pady=(8, 0))
        self._batch_progress_bar = ttk.Progressbar(
            self,
            orient="horizontal",
            mode="determinate",
            maximum=PROGRESS_BAR_MAXIMUM,
        )
        self._batch_progress_bar.grid(row=2, column=0, sticky="ew", pady=(2, 0))

    def _build_log_view(self) -> None:
        """Create the read only text view that collects the messages."""
        log_frame = ttk.Frame(self)
        log_frame.grid(row=3, column=0, sticky="nsew", pady=(10, 0))
        log_frame.columnconfigure(0, weight=1)
        log_frame.rowconfigure(0, weight=1)
        self._log_view = tk.Text(log_frame, height=8, wrap="word", state="disabled")
        self._log_view.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(log_frame, orient="vertical", command=self._log_view.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self._log_view.configure(yscrollcommand=scrollbar.set)

    def _clear_log(self) -> None:
        """Remove every earlier message from the log."""
        self._log_view.configure(state="normal")
        self._log_view.delete("1.0", tk.END)
        self._log_view.configure(state="disabled")
