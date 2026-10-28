"""Planning of the jobs of a batch before anything is converted."""

from __future__ import annotations

from pathlib import Path
from typing import Iterable

from .conversion_job import ConversionJob
from .conversion_settings import ConversionSettings
from .media_file_finder import FoundMedia, MediaFileFinder
from .output_path_builder import OutputPathBuilder


class ConversionPlanner:
    """Turns the paths chosen by the user into the jobs that have to be run."""

    def plan(self, chosen_paths: Iterable[Path], settings: ConversionSettings) -> list[ConversionJob]:
        """Return one job for every media file found under the chosen paths."""
        found_media = self._find_source_files(chosen_paths, settings)
        return self._build_jobs(found_media, settings.output_directory)

    def _find_source_files(self, chosen_paths: Iterable[Path], settings: ConversionSettings) -> list[FoundMedia]:
        """Return every media file the user wants to convert."""
        file_finder = MediaFileFinder(
            search_subfolders=settings.search_subfolders,
            include_audio_files=settings.convert_audio_files,
        )
        return file_finder.find_in_paths(chosen_paths)

    def _build_jobs(self, found_media: list[FoundMedia], output_directory: Path) -> list[ConversionJob]:
        """Pair every source file with its own destination path."""
        path_builder = OutputPathBuilder(
            output_directory,
            group_by_search_root=self._several_folders_were_added(found_media),
        )
        return [
            ConversionJob(one_media.path, path_builder.build_for(one_media), one_media.kind)
            for one_media in found_media
        ]

    def _several_folders_were_added(self, found_media: list[FoundMedia]) -> bool:
        """Tell whether the files come from more than one added folder."""
        added_folders = {one_media.search_root for one_media in found_media if one_media.search_root is not None}
        return len(added_folders) > 1
