"""The list of the files that are being converted right now."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk

from ..core.conversion_job import ConversionJob

IDLE_TEXT = "Waiting for the start"
PROGRESS_BAR_MAXIMUM = 100.0


class RunningJobsView(ttk.Frame):
    """Shows one line with its own progress bar for every running conversion."""

    def __init__(self, parent: tk.Misc) -> None:
        super().__init__(parent)
        self.columnconfigure(0, weight=1)
        self._rows: dict[ConversionJob, tuple[ttk.Label, ttk.Progressbar]] = {}
        self._idle_label = ttk.Label(self, text=IDLE_TEXT, anchor="w")
        self._show_idle_label()

    def add_job(self, job: ConversionJob, headline: str) -> None:
        """Add a new line for a conversion that has just started."""
        if job in self._rows:
            return
        self._rows[job] = (
            ttk.Label(self, text=headline, anchor="w"),
            ttk.Progressbar(self, orient="horizontal", mode="determinate", maximum=PROGRESS_BAR_MAXIMUM),
        )
        self._refresh_rows()

    def update_job(self, job: ConversionJob, completion_ratio: float) -> None:
        """Move the progress bar of one running conversion."""
        row = self._rows.get(job)
        if row is not None:
            row[1]["value"] = completion_ratio * PROGRESS_BAR_MAXIMUM

    def remove_job(self, job: ConversionJob) -> None:
        """Remove the line of a conversion that has ended."""
        row = self._rows.pop(job, None)
        if row is None:
            return
        for widget in row:
            widget.destroy()
        self._refresh_rows()

    def clear(self) -> None:
        """Remove every line and show the waiting text again."""
        for job in list(self._rows):
            self.remove_job(job)

    def _refresh_rows(self) -> None:
        """Place every line under the other, or show the waiting text."""
        if not self._rows:
            self._show_idle_label()
            return
        self._idle_label.grid_forget()
        for row_index, (label, progress_bar) in enumerate(self._rows.values()):
            label.grid(row=row_index * 2, column=0, sticky="ew")
            progress_bar.grid(row=row_index * 2 + 1, column=0, sticky="ew", pady=(2, 6))

    def _show_idle_label(self) -> None:
        """Show the text that says that nothing is running."""
        self._idle_label.grid(row=0, column=0, sticky="ew")
