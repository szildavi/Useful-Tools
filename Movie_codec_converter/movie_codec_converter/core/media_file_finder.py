"""Collection of the media files that have to be converted."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

from .media_kind import MediaKind

VIDEO_FILE_EXTENSIONS = frozenset(
    {
        ".mp4",
        ".m4v",
        ".mov",
        ".mkv",
        ".avi",
        ".mts",
        ".m2ts",
        ".ts",
        ".mpg",
        ".mpeg",
        ".webm",
        ".wmv",
        ".flv",
        ".3gp",
    }
)

AUDIO_FILE_EXTENSIONS = frozenset(
    {
        ".mp3",
        ".aac",
        ".m4a",
        ".m4b",
        ".wav",
        ".flac",
        ".ogg",
        ".oga",
        ".opus",
        ".wma",
        ".aiff",
        ".aif",
        ".ac3",
        ".dts",
        ".mka",
        ".amr",
    }
)


@dataclass(frozen=True)
class FoundMedia:
    """One media file, its kind, and the folder the user added it with.

    The folder is needed to be able to recreate the subfolders of the source in
    the output folder. It is empty when the user added the file itself.
    """

    path: Path
    kind: MediaKind
    search_root: Path | None = None

    @property
    def folder_inside_the_search_root(self) -> Path:
        """Return the subfolder of the file inside the folder the user added."""
        if self.search_root is None:
            return Path()
        try:
            return self.path.parent.relative_to(self.search_root)
        except ValueError:
            return Path()


class MediaFileFinder:
    """Turns files and folders given by the user into a list of media files.

    A folder gives its videos, and its audio files as well when the user asked
    for them. A file the user added itself is always converted.
    """

    def __init__(self, search_subfolders: bool = False, include_audio_files: bool = False) -> None:
        self._search_subfolders = search_subfolders
        self._include_audio_files = include_audio_files

    def find_in_paths(self, paths: Iterable[Path]) -> list[FoundMedia]:
        """Return every media file found under the given files and folders."""
        found_media: dict[Path, FoundMedia] = {}
        for path in paths:
            for one_media in self._find_in_path(path):
                found_media.setdefault(one_media.path, one_media)
        return sorted(found_media.values(), key=lambda one_media: one_media.path)

    def _find_in_path(self, path: Path) -> list[FoundMedia]:
        """Return the media files of a single file or folder."""
        if path.is_dir():
            return self._find_in_directory(path)
        media_kind = self.kind_of(path)
        if media_kind is None:
            return []
        return [FoundMedia(path.resolve(), media_kind)]

    def _find_in_directory(self, directory: Path) -> list[FoundMedia]:
        """Return the media files of a folder, optionally including subfolders."""
        search_root = directory.resolve()
        search_pattern = "**/*" if self._search_subfolders else "*"
        found_media = []
        for entry in sorted(directory.glob(search_pattern)):
            media_kind = self.kind_of(entry)
            if media_kind is not None and self._is_wanted_from_a_folder(media_kind):
                found_media.append(FoundMedia(entry.resolve(), media_kind, search_root))
        return found_media

    def _is_wanted_from_a_folder(self, media_kind: MediaKind) -> bool:
        """Tell whether a kind found in a folder has to be converted."""
        return media_kind is MediaKind.VIDEO or self._include_audio_files

    @staticmethod
    def kind_of(path: Path) -> MediaKind | None:
        """Return the kind of a file, or None when it is not a media file."""
        if not path.is_file():
            return None
        extension = path.suffix.lower()
        if extension in VIDEO_FILE_EXTENSIONS:
            return MediaKind.VIDEO
        if extension in AUDIO_FILE_EXTENSIONS:
            return MediaKind.AUDIO
        return None
