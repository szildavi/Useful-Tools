"""The part of the window where the user chooses the videos to convert."""

from __future__ import annotations

import tkinter as tk
from dataclasses import dataclass
from pathlib import Path
from tkinter import filedialog, ttk

VIDEO_PATTERNS = "*.mp4 *.m4v *.mov *.mkv *.avi *.mts *.m2ts *.ts *.mpg *.mpeg *.webm *.wmv *.flv *.3gp"
AUDIO_PATTERNS = "*.mp3 *.aac *.m4a *.m4b *.wav *.flac *.ogg *.oga *.opus *.wma *.aiff *.aif *.ac3 *.dts *.mka *.amr"
MEDIA_FILE_TYPES = [
    ("Video and audio files", f"{VIDEO_PATTERNS} {AUDIO_PATTERNS}"),
    ("Video files", VIDEO_PATTERNS),
    ("Audio files", AUDIO_PATTERNS),
    ("All files", "*.*"),
]


@dataclass(frozen=True)
class SourceSelection:
    """Everything the user has chosen about the source files."""

    paths: list[Path]
    search_subfolders: bool
    convert_audio_files: bool


class FileListPanel(ttk.LabelFrame):
    """Shows the chosen files and folders and lets the user change the list."""

    def __init__(self, parent: tk.Misc) -> None:
        super().__init__(parent, text="Files to convert", padding=8)
        self._chosen_paths: list[Path] = []
        self._search_subfolders = tk.BooleanVar(value=False)
        self._convert_audio_files = tk.BooleanVar(value=False)
        self._build_widgets()

    @property
    def selection(self) -> SourceSelection:
        """Return the files, folders and search options the user has chosen."""
        return SourceSelection(
            paths=list(self._chosen_paths),
            search_subfolders=self._search_subfolders.get(),
            convert_audio_files=self._convert_audio_files.get(),
        )

    def set_enabled(self, is_enabled: bool) -> None:
        """Enable or disable every button of the panel."""
        state = "normal" if is_enabled else "disabled"
        for button in self._buttons:
            button.configure(state=state)

    def _build_widgets(self) -> None:
        """Create every widget of the panel."""
        self.columnconfigure(0, weight=1)
        self.rowconfigure(0, weight=1)
        self._build_path_list()
        self._build_buttons()
        self._build_search_options()

    def _build_path_list(self) -> None:
        """Create the list that shows the chosen files and folders."""
        self._path_list = tk.Listbox(self, height=8, selectmode=tk.EXTENDED, activestyle="none")
        self._path_list.grid(row=0, column=0, sticky="nsew")
        scrollbar = ttk.Scrollbar(self, orient="vertical", command=self._path_list.yview)
        scrollbar.grid(row=0, column=1, sticky="ns")
        self._path_list.configure(yscrollcommand=scrollbar.set)

    def _build_buttons(self) -> None:
        """Create the buttons that change the list."""
        button_row = ttk.Frame(self)
        button_row.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(8, 0))
        self._buttons = [
            ttk.Button(button_row, text="Add files...", command=self._add_files),
            ttk.Button(button_row, text="Add folder...", command=self._add_folder),
            ttk.Button(button_row, text="Remove selected", command=self._remove_selected_paths),
            ttk.Button(button_row, text="Clear list", command=self._clear_paths),
        ]
        for column, button in enumerate(self._buttons):
            button.grid(row=0, column=column, padx=(0, 6))

    def _build_search_options(self) -> None:
        """Create the switches that tell what has to be taken from a folder."""
        ttk.Checkbutton(
            self,
            text="Also search the subfolders of the added folders",
            variable=self._search_subfolders,
        ).grid(row=2, column=0, columnspan=2, sticky="w", pady=(8, 0))
        ttk.Checkbutton(
            self,
            text="Also convert the audio files of the added folders (they become WAV)",
            variable=self._convert_audio_files,
        ).grid(row=3, column=0, columnspan=2, sticky="w", pady=(2, 0))

    def _add_files(self) -> None:
        """Ask the user for media files and add them to the list."""
        selected_files = filedialog.askopenfilenames(
            title="Choose video or audio files",
            filetypes=MEDIA_FILE_TYPES,
        )
        self._add_paths([Path(file_path) for file_path in selected_files])

    def _add_folder(self) -> None:
        """Ask the user for a folder and add it to the list."""
        selected_folder = filedialog.askdirectory(title="Choose a folder with videos")
        if selected_folder:
            self._add_paths([Path(selected_folder)])

    def _add_paths(self, paths: list[Path]) -> None:
        """Add new paths to the list without adding anything twice."""
        for path in paths:
            if path not in self._chosen_paths:
                self._chosen_paths.append(path)
        self._refresh_path_list()

    def _remove_selected_paths(self) -> None:
        """Remove the paths the user selected in the list."""
        for index in sorted(self._path_list.curselection(), reverse=True):
            del self._chosen_paths[index]
        self._refresh_path_list()

    def _clear_paths(self) -> None:
        """Remove every path from the list."""
        self._chosen_paths.clear()
        self._refresh_path_list()

    def _refresh_path_list(self) -> None:
        """Show the current paths in the list widget."""
        self._path_list.delete(0, tk.END)
        for path in self._chosen_paths:
            self._path_list.insert(tk.END, self._describe_path(path))

    def _describe_path(self, path: Path) -> str:
        """Return the text that represents one path in the list."""
        if path.is_dir():
            return f"[folder]  {path}"
        return f"[file]    {path}"
