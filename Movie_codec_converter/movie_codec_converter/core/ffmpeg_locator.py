"""Lookup of the external ffmpeg tools the converter depends on."""

from __future__ import annotations

import shutil
from dataclasses import dataclass

INSTALL_HINT = (
    "Install it first, for example:\n"
    "  Fedora : sudo dnf install ffmpeg\n"
    "  Debian : sudo apt install ffmpeg\n"
    "  Arch   : sudo pacman -S ffmpeg\n"
    "  macOS  : brew install ffmpeg"
)


class FfmpegNotFoundError(RuntimeError):
    """Raised when a required ffmpeg executable is missing from the system."""


@dataclass(frozen=True)
class FfmpegTools:
    """The absolute paths of the ffmpeg executables used by the converter."""

    ffmpeg_path: str
    ffprobe_path: str


class FfmpegLocator:
    """Finds the ffmpeg and ffprobe executables on the current system."""

    def locate(self) -> FfmpegTools:
        """Return the paths of both required executables."""
        return FfmpegTools(
            ffmpeg_path=self._locate_executable("ffmpeg"),
            ffprobe_path=self._locate_executable("ffprobe"),
        )

    def _locate_executable(self, executable_name: str) -> str:
        """Return the path of one executable or explain how to install it."""
        executable_path = shutil.which(executable_name)
        if executable_path is None:
            raise FfmpegNotFoundError(f"'{executable_name}' was not found on this system.\n{INSTALL_HINT}")
        return executable_path
