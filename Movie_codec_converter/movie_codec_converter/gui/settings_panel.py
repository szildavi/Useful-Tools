"""The part of the window where the user chooses the output and the quality."""

from __future__ import annotations

import tkinter as tk
from pathlib import Path
from tkinter import filedialog, ttk

from ..core.conversion_settings import (
    DEFAULT_AUDIO_OPTION,
    DEFAULT_PROFILE,
    AudioOption,
    ConversionSettings,
    DnxhrProfile,
)
from ..core.cpu_capacity import CpuCapacity
from .file_list_panel import SourceSelection

DEFAULT_OUTPUT_FOLDER_NAME = "DNxHR_converted"


class SettingsPanel(ttk.LabelFrame):
    """Shows the output folder and the encoding options of the conversion."""

    def __init__(self, parent: tk.Misc) -> None:
        super().__init__(parent, text="Output and quality", padding=8)
        self._cpu_capacity = CpuCapacity()
        self._output_directory = tk.StringVar(value=str(Path.home() / DEFAULT_OUTPUT_FOLDER_NAME))
        self._profile_name = tk.StringVar(value=DEFAULT_PROFILE.display_name)
        self._audio_name = tk.StringVar(value=DEFAULT_AUDIO_OPTION.display_name)
        self._overwrite_existing = tk.BooleanVar(value=False)
        self._parallel_job_count = tk.StringVar(value=str(self._cpu_capacity.recommended_parallel_job_count()))
        self._build_widgets()

    def build_settings(self, selection: SourceSelection) -> ConversionSettings:
        """Return the conversion settings of the panel and of the chosen sources."""
        return ConversionSettings(
            output_directory=Path(self._output_directory.get()).expanduser(),
            profile=DnxhrProfile.from_display_name(self._profile_name.get()),
            audio_option=AudioOption.from_display_name(self._audio_name.get()),
            overwrite_existing=self._overwrite_existing.get(),
            search_subfolders=selection.search_subfolders,
            convert_audio_files=selection.convert_audio_files,
            parallel_job_count=self._read_parallel_job_count(),
        )

    def _read_parallel_job_count(self) -> int:
        """Return how many files may convert at once, whatever was typed in."""
        try:
            return max(1, int(self._parallel_job_count.get()))
        except ValueError:
            return self._cpu_capacity.recommended_parallel_job_count()

    def set_enabled(self, is_enabled: bool) -> None:
        """Enable or disable every input of the panel."""
        state = "normal" if is_enabled else "disabled"
        combobox_state = "readonly" if is_enabled else "disabled"
        self._output_entry.configure(state=state)
        self._browse_button.configure(state=state)
        self._overwrite_checkbox.configure(state=state)
        self._parallel_job_spinbox.configure(state=state)
        self._profile_combobox.configure(state=combobox_state)
        self._audio_combobox.configure(state=combobox_state)

    def _build_widgets(self) -> None:
        """Create every widget of the panel."""
        self.columnconfigure(1, weight=1)
        self._build_output_folder_row()
        self._build_profile_row()
        self._build_audio_row()
        self._build_parallel_job_row()
        self._build_overwrite_row()

    def _build_output_folder_row(self) -> None:
        """Create the row where the output folder is chosen."""
        ttk.Label(self, text="Output folder:").grid(row=0, column=0, sticky="w", pady=4)
        self._output_entry = ttk.Entry(self, textvariable=self._output_directory)
        self._output_entry.grid(row=0, column=1, sticky="ew", padx=6, pady=4)
        self._browse_button = ttk.Button(self, text="Browse...", command=self._choose_output_directory)
        self._browse_button.grid(row=0, column=2, pady=4)

    def _build_profile_row(self) -> None:
        """Create the row where the DNxHR profile is chosen."""
        ttk.Label(self, text="DNxHR profile:").grid(row=1, column=0, sticky="w", pady=4)
        self._profile_combobox = ttk.Combobox(
            self,
            textvariable=self._profile_name,
            values=[profile.display_name for profile in DnxhrProfile],
            state="readonly",
        )
        self._profile_combobox.grid(row=1, column=1, columnspan=2, sticky="ew", padx=6, pady=4)

    def _build_audio_row(self) -> None:
        """Create the row where the audio handling is chosen."""
        ttk.Label(self, text="Audio:").grid(row=2, column=0, sticky="w", pady=4)
        self._audio_combobox = ttk.Combobox(
            self,
            textvariable=self._audio_name,
            values=[option.display_name for option in AudioOption],
            state="readonly",
        )
        self._audio_combobox.grid(row=2, column=1, columnspan=2, sticky="ew", padx=6, pady=4)

    def _build_parallel_job_row(self) -> None:
        """Create the row where the number of parallel conversions is chosen."""
        core_count = self._cpu_capacity.available_core_count()
        ttk.Label(self, text="Files at once:").grid(row=3, column=0, sticky="w", pady=4)
        self._parallel_job_spinbox = ttk.Spinbox(
            self,
            from_=1,
            to=core_count,
            width=6,
            textvariable=self._parallel_job_count,
        )
        self._parallel_job_spinbox.grid(row=3, column=1, sticky="w", padx=6, pady=4)
        ttk.Label(self, text=f"(this machine has {core_count} processor cores)").grid(
            row=3, column=2, sticky="w", pady=4
        )

    def _build_overwrite_row(self) -> None:
        """Create the switch that allows overwriting existing output files."""
        self._overwrite_checkbox = ttk.Checkbutton(
            self,
            text="Convert again even when the output file already exists",
            variable=self._overwrite_existing,
        )
        self._overwrite_checkbox.grid(row=4, column=0, columnspan=3, sticky="w", pady=(8, 0))

    def _choose_output_directory(self) -> None:
        """Ask the user for the folder the MOV files have to be written into."""
        selected_folder = filedialog.askdirectory(title="Choose the output folder")
        if selected_folder:
            self._output_directory.set(selected_folder)
