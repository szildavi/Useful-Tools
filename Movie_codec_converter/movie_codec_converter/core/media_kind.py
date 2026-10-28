"""The kinds of media the converter can handle."""

from __future__ import annotations

from enum import Enum


class MediaKind(Enum):
    """A kind of source file, together with the file it is converted into."""

    VIDEO = ("video", ".mov")
    AUDIO = ("audio", ".wav")

    def __init__(self, description: str, output_extension: str) -> None:
        self.description = description
        self.output_extension = output_extension
