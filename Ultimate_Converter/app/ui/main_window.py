"""The application window: queue on the left, conversion settings on the right."""

from __future__ import annotations

import queue
import subprocess
import sys
import tkinter as tk
from pathlib import Path
from tkinter import filedialog, messagebox, ttk
from typing import Any, Dict, List, Sequence

from ..core.bundled_resources import resource_path
from ..core.conversion_job import ConversionJob, JobStatus
from ..core.conversion_option import apply_option_defaults
from ..core.conversion_registry import ConversionRegistry
from ..core import format_families as families
from ..core.parallel_conversion_runner import ParallelConversionRunner, default_worker_count
from . import theme
from .file_queue_view import FileQueueView
from .option_panel import OptionPanel
from .scrollable_frame import ScrollableFrame
from .tool_status_dialog import ToolStatusDialog

WINDOW_TITLE = "Ultimate Converter"
QUEUE_POLL_MILLISECONDS = 60
PREFERRED_WINDOW_WIDTH = 1180
PREFERRED_WINDOW_HEIGHT = 720
MINIMUM_WINDOW_WIDTH = 940
MINIMUM_WINDOW_HEIGHT = 560
TOOLBAR_MARGIN = 24
QUEUE_WIDTH_SHARE = 0.68


class MainWindow(tk.Tk):
    """Owns the queue, the conversion settings and the background runner."""

    def __init__(self, registry: ConversionRegistry) -> None:
        super().__init__()
        self._registry = registry
        self._output_directory = Path.home() / "Converted"
        self._pending_updates: queue.Queue = queue.Queue()
        self._runner = ParallelConversionRunner(
            registry,
            on_job_changed=self._pending_updates.put,
            on_batch_finished=lambda jobs: self._pending_updates.put(_BATCH_FINISHED),
        )
        self._configure_window()
        self._build_layout()
        self._refresh_controls()
        self.after(QUEUE_POLL_MILLISECONDS, self._drain_pending_updates)

    def _configure_window(self) -> None:
        """Set the title, icon and colour scheme; the size is fixed once laid out."""
        self.title(WINDOW_TITLE)
        self._apply_window_icon()
        theme.apply_theme(self)

    def _apply_window_icon(self) -> None:
        """Show the application icon in the title bar and task switcher.

        A missing or unreadable icon is not worth refusing to start over, so the
        window simply keeps the toolkit's default.
        """
        icon_path = resource_path("ui", "assets", "icon.png")
        try:
            self._window_icon = tk.PhotoImage(file=str(icon_path))
            self.iconphoto(True, self._window_icon)
        except tk.TclError:
            pass

    # ------------------------------------------------------------------ layout

    def _build_layout(self) -> None:
        """Assemble the toolbar, the split view and the status bar."""
        self.columnconfigure(0, weight=1)
        self.rowconfigure(1, weight=1)
        self._toolbar = self._build_toolbar()
        self._build_split_view()
        self._build_status_bar()
        self._show_empty_sidebar()
        self._apply_window_size()

    def _apply_window_size(self) -> None:
        """Size the window so the toolbar never clips, whatever font is in use.

        Interface fonts differ in width between operating systems, so the
        minimum width is measured rather than guessed.
        """
        self.update_idletasks()
        minimum_width = max(MINIMUM_WINDOW_WIDTH, self._toolbar.winfo_reqwidth() + TOOLBAR_MARGIN)
        self.minsize(minimum_width, MINIMUM_WINDOW_HEIGHT)
        self.geometry(f"{max(minimum_width, PREFERRED_WINDOW_WIDTH)}x{PREFERRED_WINDOW_HEIGHT}")
        self.after_idle(self._place_initial_split)

    def _place_initial_split(self) -> None:
        """Give the queue most of the width, whatever the sidebar text asks for.

        Left to itself the paned window divides the space by requested size, so
        a long hint in the sidebar would squeeze the file table.
        """
        available_width = self._split_view.winfo_width()
        if available_width > 1:
            self._split_view.sashpos(0, int(available_width * QUEUE_WIDTH_SHARE))

    def _build_toolbar(self) -> ttk.Frame:
        """Build the top row: queue actions on the left, run buttons on the right.

        The window title bar already names the application, so the space goes to
        the buttons instead and the toolbar stays intact at the minimum width.
        """
        toolbar = ttk.Frame(self, style="TFrame", padding=(16, 12))
        toolbar.grid(row=0, column=0, sticky="ew")
        toolbar.columnconfigure(1, weight=1, minsize=24)
        self._build_queue_action_buttons(toolbar).grid(row=0, column=0, sticky="w")
        self._build_run_buttons(toolbar).grid(row=0, column=2, sticky="e")
        return toolbar

    def _build_queue_action_buttons(self, parent: tk.Misc) -> ttk.Frame:
        """Build the buttons that change what is in the queue."""
        group = ttk.Frame(parent, style="TFrame")
        actions = (
            ("Add files", self._choose_files),
            ("Add folder", self._choose_folder),
            ("Remove", self._remove_selected),
            ("Clear", self._clear_queue),
            ("Tools…", self._open_tool_status),
        )
        for column, (label, command) in enumerate(actions):
            ttk.Button(group, text=label, command=command).grid(row=0, column=column, padx=(0, 6))
        return group

    def _build_run_buttons(self, parent: tk.Misc) -> ttk.Frame:
        """Build the convert and cancel buttons."""
        group = ttk.Frame(parent, style="TFrame")
        self._cancel_button = ttk.Button(group, text="Cancel", command=self._runner.cancel)
        self._cancel_button.grid(row=0, column=0, padx=(0, 8))
        self._convert_button = ttk.Button(
            group, text="Convert all", style="Accent.TButton", command=self._start_conversion
        )
        self._convert_button.grid(row=0, column=1)
        return group

    def _build_split_view(self) -> None:
        """Put the queue table beside the settings sidebar."""
        self._split_view = ttk.PanedWindow(self, orient="horizontal")
        self._split_view.grid(row=1, column=0, sticky="nsew", padx=16)
        self._queue_view = FileQueueView(
            self._split_view, on_selection_changed=self._on_selection_changed
        )
        self._split_view.add(self._queue_view, weight=3)
        self._split_view.add(self._build_sidebar(self._split_view), weight=1)

    def _build_sidebar(self, parent: tk.Misc) -> ttk.Frame:
        """Build the right-hand column: target format, options and output folder."""
        sidebar = ttk.Frame(parent, style="TFrame", padding=(12, 0, 0, 0))
        sidebar.rowconfigure(1, weight=1)
        sidebar.columnconfigure(0, weight=1)
        self._build_target_format_card(sidebar).grid(row=0, column=0, sticky="ew")
        self._build_options_card(sidebar).grid(row=1, column=0, sticky="nsew", pady=10)
        self._build_output_card(sidebar).grid(row=2, column=0, sticky="ew")
        return sidebar

    def _build_target_format_card(self, parent: tk.Misc) -> ttk.Widget:
        """Build the dropdown that chooses what the selected files become."""
        card = ttk.Labelframe(parent, text="Convert to", style="Card.TLabelframe", padding=12)
        card.columnconfigure(0, weight=1)
        self._target_format_variable = tk.StringVar()
        self._target_format_combobox = ttk.Combobox(
            card, textvariable=self._target_format_variable, state="readonly"
        )
        self._target_format_combobox.grid(row=0, column=0, sticky="ew")
        self._target_format_combobox.bind(
            "<<ComboboxSelected>>", lambda _event: self._apply_target_format()
        )
        self._selection_summary = ttk.Label(card, text="", style="Muted.TLabel", wraplength=290)
        self._selection_summary.grid(row=1, column=0, sticky="w", pady=(8, 0))
        return card

    def _build_options_card(self, parent: tk.Misc) -> ttk.Widget:
        """Build the scrollable panel holding the conversion settings."""
        card = ttk.Labelframe(parent, text="Settings", style="Card.TLabelframe", padding=2)
        card.rowconfigure(0, weight=1)
        card.columnconfigure(0, weight=1)
        scroller = ScrollableFrame(card)
        scroller.grid(row=0, column=0, sticky="nsew")
        self._option_panel = OptionPanel(scroller.content, on_options_changed=self._apply_options)
        self._option_panel.pack(fill="both", expand=True)
        return card

    def _build_output_card(self, parent: tk.Misc) -> ttk.Widget:
        """Build the output folder chooser."""
        card = ttk.Labelframe(parent, text="Save results to", style="Card.TLabelframe", padding=12)
        card.columnconfigure(0, weight=1)
        self._output_label = ttk.Label(card, text="", style="Muted.TLabel", wraplength=290)
        self._output_label.grid(row=0, column=0, sticky="w")
        buttons = ttk.Frame(card, style="Panel.TFrame")
        buttons.grid(row=1, column=0, sticky="ew", pady=(8, 0))
        ttk.Button(buttons, text="Change…", command=self._choose_output_directory).pack(side="left")
        ttk.Button(buttons, text="Open folder", command=self._open_output_directory).pack(
            side="left", padx=8
        )
        self._update_output_label()
        return card

    def _build_status_bar(self) -> None:
        """Build the bottom row: progress bar, counters and worker count."""
        status_bar = ttk.Frame(self, style="TFrame", padding=(16, 10))
        status_bar.grid(row=2, column=0, sticky="ew")
        status_bar.columnconfigure(2, weight=1)
        self._worker_count_variable = tk.IntVar(value=default_worker_count())
        ttk.Label(status_bar, text="Parallel conversions:", style="Status.TLabel").grid(
            row=0, column=0, sticky="w", padx=(0, 8)
        )
        ttk.Spinbox(
            status_bar,
            from_=1,
            to=max(1, default_worker_count() * 2),
            width=4,
            textvariable=self._worker_count_variable,
        ).grid(row=0, column=1, sticky="w")
        self._progress_bar = ttk.Progressbar(status_bar, mode="determinate")
        self._progress_bar.grid(row=0, column=2, sticky="ew", padx=20)
        self._status_label = ttk.Label(status_bar, text="", style="Status.TLabel")
        self._status_label.grid(row=0, column=3, sticky="e")

    # ------------------------------------------------------------- queue edits

    def _choose_files(self) -> None:
        """Ask for files and queue every one the application can convert."""
        chosen = filedialog.askopenfilenames(title="Choose files to convert")
        self._enqueue_paths([Path(path) for path in chosen])

    def _choose_folder(self) -> None:
        """Ask for a folder and queue every convertible file inside it."""
        chosen = filedialog.askdirectory(title="Choose a folder to convert")
        if not chosen:
            return
        self._enqueue_paths(sorted(path for path in Path(chosen).rglob("*") if path.is_file()))

    def _enqueue_paths(self, paths: Sequence[Path]) -> None:
        """Add one job per readable file and report the ones that were skipped."""
        skipped: List[Path] = []
        for path in paths:
            if not self._enqueue_single_path(path):
                skipped.append(path)
        self._refresh_controls()
        if skipped:
            self._report_skipped_files(skipped)

    def _enqueue_single_path(self, path: Path) -> bool:
        """Queue one file; report whether a conversion target was found."""
        job = ConversionJob(path, "", self._output_directory)
        targets = self._registry.target_formats_for(job.source_format)
        if not targets:
            return False
        job.target_format = _preferred_target_format(job.source_format, targets)
        job.options = self._default_options_for(job)
        self._queue_view.add_job(job)
        return True

    def _remove_selected(self) -> None:
        self._queue_view.remove_selected_jobs()
        self._refresh_controls()

    def _clear_queue(self) -> None:
        self._queue_view.clear()
        self._refresh_controls()

    def _report_skipped_files(self, skipped: Sequence[Path]) -> None:
        """Explain which files had no available conversion."""
        names = "\n".join(f"  {path.name}" for path in skipped[:12])
        remainder = f"\n  …and {len(skipped) - 12} more" if len(skipped) > 12 else ""
        messagebox.showinfo(
            "Some files were skipped",
            "These files have no conversion available on this computer:\n\n"
            f"{names}{remainder}\n\nOpen Tools… to see what can be installed.",
            parent=self,
        )

    # --------------------------------------------------------------- selection

    def _on_selection_changed(self, selected_jobs: Sequence[ConversionJob]) -> None:
        """Rebuild the sidebar to describe whatever is highlighted."""
        if not selected_jobs:
            self._show_empty_sidebar()
            return
        self._populate_target_formats(selected_jobs)
        self._populate_options(selected_jobs)
        self._selection_summary.configure(text=_selection_summary_text(selected_jobs))

    def _show_empty_sidebar(self) -> None:
        """Reset the sidebar when nothing is selected."""
        self._target_format_combobox.configure(values=(), state="disabled")
        self._target_format_variable.set("")
        self._selection_summary.configure(text="Select a file in the queue to change its settings.")
        self._option_panel.show_message("Nothing selected.")

    def _populate_target_formats(self, selected_jobs: Sequence[ConversionJob]) -> None:
        """Offer only the targets every selected file can reach."""
        shared_targets = self._shared_target_formats(selected_jobs)
        self._target_format_combobox.configure(
            values=[f".{target}" for target in shared_targets],
            state="readonly" if shared_targets else "disabled",
        )
        current = selected_jobs[0].target_format
        self._target_format_variable.set(f".{current}" if current in shared_targets else "")

    def _shared_target_formats(self, selected_jobs: Sequence[ConversionJob]) -> List[str]:
        """Return the targets reachable from every selected source format."""
        target_sets = [
            set(self._registry.target_formats_for(job.source_format)) for job in selected_jobs
        ]
        return sorted(set.intersection(*target_sets)) if target_sets else []

    def _populate_options(self, selected_jobs: Sequence[ConversionJob]) -> None:
        """Show the settings for the selection, when they all share one conversion."""
        conversions = {(job.source_format, job.target_format) for job in selected_jobs}
        if len(conversions) != 1:
            self._option_panel.show_message(
                "The selected files use different conversions. "
                "Pick one conversion to change its settings."
            )
            return
        source_format, target_format = conversions.pop()
        if not target_format:
            self._option_panel.show_message("Choose a target format first.")
            return
        options = self._registry.options_for(source_format, target_format)
        self._option_panel.show_options(options, selected_jobs[0].options)

    # ------------------------------------------------------------------ edits

    def _apply_target_format(self) -> None:
        """Write the chosen target format onto every selected job."""
        target_format = self._target_format_variable.get().lstrip(".")
        if not target_format:
            return
        selected_jobs = self._queue_view.selected_jobs()
        for job in selected_jobs:
            job.target_format = target_format
            job.options = self._default_options_for(job)
            self._queue_view.refresh_job(job)
        self._populate_options(selected_jobs)

    def _apply_options(self, values: Dict[str, Any]) -> None:
        """Write the edited settings onto every selected job."""
        for job in self._queue_view.selected_jobs():
            job.options.update(values)

    def _default_options_for(self, job: ConversionJob) -> Dict[str, Any]:
        """Return the option defaults for a job's current conversion."""
        if not job.target_format:
            return {}
        options = self._registry.options_for(job.source_format, job.target_format)
        return apply_option_defaults(options, {})

    # ------------------------------------------------------------- conversion

    def _start_conversion(self) -> None:
        """Hand every pending job to the background runner."""
        jobs = self._queue_view.all_jobs()
        if not jobs:
            messagebox.showinfo("Nothing to convert", "Add some files first.", parent=self)
            return
        self._reset_finished_jobs(jobs)
        self._progress_bar.configure(maximum=len(jobs), value=0)
        self._runner.start(jobs, worker_count=self._worker_count_variable.get())
        self._refresh_controls()

    def _reset_finished_jobs(self, jobs: Sequence[ConversionJob]) -> None:
        """Let a cancelled or failed job be retried by the next run."""
        for job in jobs:
            if job.status in (JobStatus.FAILED, JobStatus.CANCELLED):
                job.status = JobStatus.PENDING
                self._queue_view.refresh_job(job)

    def _drain_pending_updates(self) -> None:
        """Move the runner's messages onto the interface thread."""
        while True:
            try:
                update = self._pending_updates.get_nowait()
            except queue.Empty:
                break
            self._handle_update(update)
        self.after(QUEUE_POLL_MILLISECONDS, self._drain_pending_updates)

    def _handle_update(self, update: Any) -> None:
        """React to one message from the runner."""
        if update is _BATCH_FINISHED:
            self._refresh_controls()
            self._announce_batch_result()
            return
        self._queue_view.refresh_job(update)
        self._refresh_progress()

    def _announce_batch_result(self) -> None:
        """Summarise the finished batch, listing failures if there were any."""
        jobs = self._queue_view.all_jobs()
        failed = [job for job in jobs if job.status is JobStatus.FAILED]
        if not failed:
            return
        details = "\n".join(f"  {job.source_name}: {job.error_message}" for job in failed[:10])
        messagebox.showwarning(
            "Some conversions failed",
            f"{len(failed)} of {len(jobs)} files could not be converted:\n\n{details}",
            parent=self,
        )

    # ----------------------------------------------------------------- output

    def _choose_output_directory(self) -> None:
        """Pick where converted files are written, and retarget queued jobs."""
        chosen = filedialog.askdirectory(title="Choose the output folder")
        if not chosen:
            return
        self._output_directory = Path(chosen)
        for job in self._queue_view.all_jobs():
            job.output_directory = self._output_directory
        self._update_output_label()

    def _open_output_directory(self) -> None:
        """Show the output folder in the system file manager."""
        self._output_directory.mkdir(parents=True, exist_ok=True)
        _reveal_in_file_manager(self._output_directory)

    def _update_output_label(self) -> None:
        self._output_label.configure(text=str(self._output_directory))

    def _open_tool_status(self) -> None:
        ToolStatusDialog(self, self._registry, on_tools_rechecked=self._refresh_controls)

    # ------------------------------------------------------------------ state

    def _refresh_controls(self) -> None:
        """Enable or disable the buttons to match what is possible right now."""
        is_running = self._runner.is_running
        has_jobs = bool(self._queue_view.all_jobs())
        self._convert_button.configure(
            state="disabled" if is_running or not has_jobs else "normal",
            text="Converting…" if is_running else "Convert all",
        )
        self._cancel_button.configure(state="normal" if is_running else "disabled")
        self._refresh_progress()

    def _refresh_progress(self) -> None:
        """Update the progress bar and the counter beside it."""
        jobs = self._queue_view.all_jobs()
        finished = [job for job in jobs if job.status in _FINISHED_STATUSES]
        self._progress_bar.configure(maximum=max(len(jobs), 1), value=len(finished))
        self._status_label.configure(text=_status_bar_text(jobs, finished, self._registry))


_BATCH_FINISHED = object()
"""Sentinel telling the interface thread that the runner has drained its pool."""

_FINISHED_STATUSES = (JobStatus.DONE, JobStatus.FAILED, JobStatus.CANCELLED)

DEFAULT_TARGETS_BY_FAMILY = (
    (families.VIDEO_FORMATS | families.VIDEO_ONLY_SOURCE_FORMATS, ("mp4", "mkv", "webm")),
    (families.AUDIO_FORMATS | families.AUDIO_ONLY_SOURCE_FORMATS, ("mp3", "wav")),
    (families.CAMERA_RAW_FORMATS, ("jpg", "png")),
    (families.RASTER_FORMATS | families.RASTER_ONLY_SOURCE_FORMATS, ("png", "jpg", "webp")),
    (families.VECTOR_FORMATS | families.VECTOR_ONLY_SOURCE_FORMATS, ("svg", "pdf", "png")),
    (families.SPREADSHEET_FORMATS, ("xlsx", "csv", "pdf")),
    (families.PRESENTATION_FORMATS, ("pptx", "pdf")),
    (families.EBOOK_FORMATS | families.EBOOK_ONLY_SOURCE_FORMATS, ("epub", "pdf")),
    (families.TEXT_DOCUMENT_FORMATS | families.TEXT_DOCUMENT_ONLY_SOURCE_FORMATS, ("pdf", "docx")),
    (families.STRUCTURED_DATA_FORMATS | families.STRUCTURED_DATA_ONLY_SOURCE_FORMATS, ("json", "csv")),
    (families.ARCHIVE_FORMATS | families.ARCHIVE_ONLY_SOURCE_FORMATS, ("zip", "7z")),
    (families.MODEL_3D_FORMATS | families.MODEL_3D_ONLY_SOURCE_FORMATS, ("glb", "obj", "stl")),
)
"""Which target a newly queued file is aimed at, chosen by its own family."""


def _preferred_target_format(source_format: str, available_targets: Sequence[str]) -> str:
    """Pick a sensible default target so a queued file is ready to convert.

    A video defaults to another video rather than to its audio track, and the
    same idea applies to every other family, so the first guess is rarely wrong.
    """
    for family, preferences in DEFAULT_TARGETS_BY_FAMILY:
        if source_format not in family:
            continue
        for preferred in preferences:
            if preferred in available_targets and preferred != source_format:
                return preferred
    return available_targets[0]


def _selection_summary_text(selected_jobs: Sequence[ConversionJob]) -> str:
    """Describe the current selection in one line."""
    if len(selected_jobs) == 1:
        return f"1 file selected  ·  {selected_jobs[0].source_name}"
    formats = sorted({f".{job.source_format}" for job in selected_jobs})
    return f"{len(selected_jobs)} files selected  ·  {', '.join(formats)}"


def _status_bar_text(
    jobs: Sequence[ConversionJob],
    finished: Sequence[ConversionJob],
    registry: ConversionRegistry,
) -> str:
    """Return the right-hand status text."""
    if not jobs:
        available = registry.count_conversion_pairs(only_available=True)
        return f"{available} conversions available  ·  add files to begin"
    succeeded = sum(1 for job in finished if job.status is JobStatus.DONE)
    return f"{len(finished)} of {len(jobs)} finished  ·  {succeeded} succeeded"


def _reveal_in_file_manager(directory: Path) -> None:
    """Open a folder using whichever command this operating system provides."""
    openers = {"win32": ("explorer",), "darwin": ("open",)}
    command = openers.get(sys.platform, ("xdg-open",))
    subprocess.Popen([*command, str(directory)])
