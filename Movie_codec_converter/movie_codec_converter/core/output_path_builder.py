"""Creation of the destination file paths of the converted media."""

from __future__ import annotations

from pathlib import Path

from .media_file_finder import FoundMedia


class OutputPathBuilder:
    """Builds the destination paths and keeps the folders of the sources.

    The subfolders of an added folder are recreated in the output folder. When
    the user added several folders, every one of them gets its own folder named
    after it, so two subfolders with the same name never mix. The extension of
    the destination comes from the kind of the source: a video becomes a MOV
    file, an audio file becomes a WAV file.
    """

    def __init__(self, output_directory: Path, group_by_search_root: bool = False) -> None:
        self._output_directory = output_directory
        self._group_by_search_root = group_by_search_root
        self._used_paths: set[Path] = set()

    def build_for(self, found_media: FoundMedia) -> Path:
        """Return the destination path that belongs to one source file."""
        destination_directory = self._output_directory / self._subfolder_of(found_media)
        destination_path = self._build_unique_path(destination_directory, found_media)
        self._used_paths.add(destination_path)
        return destination_path

    def _subfolder_of(self, found_media: FoundMedia) -> Path:
        """Return the folder of one file inside the output folder."""
        if found_media.search_root is None:
            return Path()
        folder_inside_the_output = found_media.folder_inside_the_search_root
        if self._group_by_search_root:
            return Path(found_media.search_root.name) / folder_inside_the_output
        return folder_inside_the_output

    def _build_unique_path(self, destination_directory: Path, found_media: FoundMedia) -> Path:
        """Return a path that was not handed out for another source yet."""
        source_stem = found_media.path.stem
        extension = found_media.kind.output_extension
        candidate_path = destination_directory / f"{source_stem}{extension}"
        duplicate_counter = 2
        while candidate_path in self._used_paths:
            candidate_path = destination_directory / f"{source_stem}_{duplicate_counter}{extension}"
            duplicate_counter += 1
        return candidate_path
