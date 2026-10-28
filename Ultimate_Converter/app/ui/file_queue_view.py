"""The table listing every queued file and how its conversion is going."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import Callable, Dict, List, Sequence

from ..core.conversion_job import ConversionJob, JobStatus
from . import theme

SelectionCallback = Callable[[Sequence[ConversionJob]], None]

COLUMNS = (
    ("name", "File", 300, "w"),
    ("source", "From", 70, "center"),
    ("target", "To", 70, "center"),
    ("size", "Size", 90, "e"),
    ("status", "Status", 110, "w"),
)


class FileQueueView(ttk.Frame):
    """Shows the batch, keeps the selection, and repaints rows as jobs finish."""

    def __init__(self, parent: tk.Misc, on_selection_changed: SelectionCallback) -> None:
        super().__init__(parent, style="TFrame")
        self._on_selection_changed = on_selection_changed
        self._jobs_by_row: Dict[str, ConversionJob] = {}
        self._tree = self._build_tree()
        self._build_scrollbar()

    def _build_tree(self) -> ttk.Treeview:
        """Create the treeview with one column per piece of job information."""
        tree = ttk.Treeview(
            self,
            columns=[key for key, _, _, _ in COLUMNS],
            show="headings",
            style="Queue.Treeview",
            selectmode="extended",
        )
        for key, heading, width, anchor in COLUMNS:
            tree.heading(key, text=heading)
            tree.column(key, width=width, anchor=anchor, stretch=(key == "name"))
        for status in JobStatus:
            tree.tag_configure(status.name, foreground=theme.STATUS_COLOURS[status.value])
        tree.bind("<<TreeviewSelect>>", self._publish_selection)
        tree.grid(row=0, column=0, sticky="nsew")
        self.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)
        return tree

    def _build_scrollbar(self) -> None:
        """Attach a vertical scrollbar to the table."""
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=self._tree.yview)
        self._tree.configure(yscrollcommand=scrollbar.set)
        scrollbar.grid(row=0, column=1, sticky="ns")

    def add_job(self, job: ConversionJob) -> None:
        """Append one job to the bottom of the table."""
        row_id = str(job.job_id)
        self._jobs_by_row[row_id] = job
        self._tree.insert("", "end", iid=row_id, values=_row_values(job), tags=(job.status.name,))

    def refresh_job(self, job: ConversionJob) -> None:
        """Repaint one row after its target format or status changed."""
        row_id = str(job.job_id)
        if self._tree.exists(row_id):
            self._tree.item(row_id, values=_row_values(job), tags=(job.status.name,))

    def remove_selected_jobs(self) -> List[ConversionJob]:
        """Delete the highlighted rows and return the jobs they held."""
        removed = self.selected_jobs()
        for job in removed:
            row_id = str(job.job_id)
            self._tree.delete(row_id)
            self._jobs_by_row.pop(row_id, None)
        self._publish_selection()
        return removed

    def clear(self) -> None:
        """Empty the table."""
        self._tree.delete(*self._tree.get_children())
        self._jobs_by_row.clear()
        self._publish_selection()

    def selected_jobs(self) -> List[ConversionJob]:
        """Return the jobs whose rows are highlighted."""
        return [self._jobs_by_row[row_id] for row_id in self._tree.selection()]

    def all_jobs(self) -> List[ConversionJob]:
        """Return every job in table order."""
        return [self._jobs_by_row[row_id] for row_id in self._tree.get_children()]

    def _publish_selection(self, _event: tk.Event | None = None) -> None:
        self._on_selection_changed(self.selected_jobs())


def _row_values(job: ConversionJob) -> tuple:
    """Return the five cell values shown for one job."""
    return (
        job.source_name,
        f".{job.source_format}",
        f".{job.target_format}",
        _readable_size(job.source_path),
        _status_text(job),
    )


def _status_text(job: ConversionJob) -> str:
    """Return the status cell, shortened to fit the column when it failed."""
    if job.status is JobStatus.FAILED:
        return f"Failed - {job.error_message}"
    return job.status.value


def _readable_size(path) -> str:
    """Format a file size in the largest unit that keeps it readable."""
    try:
        size = float(path.stat().st_size)
    except OSError:
        return "-"
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.0f} {unit}" if unit == "B" else f"{size:.1f} {unit}"
        size /= 1024
    return f"{size:.1f} TB"
