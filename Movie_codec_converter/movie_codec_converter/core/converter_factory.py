"""Creation of a ready to use conversion engine for any interface."""

from __future__ import annotations

from .batch_converter import BatchConverter
from .ffmpeg_command_builder import CommandBuilderSelector
from .ffmpeg_locator import FfmpegLocator, FfmpegTools
from .media_converter import MediaConverter
from .media_inspector import MediaInspector
from .progress_reporter import ProgressReporter
from .source_compatibility_checker import SourceCompatibilityChecker


class ConverterFactory:
    """Builds the object graph of the conversion engine in one single place.

    One factory keeps one media inspector, so a file that was already looked at
    for the profile check is not read again when the conversion starts.
    """

    def __init__(self, locator: FfmpegLocator | None = None) -> None:
        self._locator = locator or FfmpegLocator()
        self._ffmpeg_tools: FfmpegTools | None = None
        self._media_inspector: MediaInspector | None = None

    def create_batch_converter(self, reporter: ProgressReporter | None = None) -> BatchConverter:
        """Return a batch converter that reports its progress to the given reporter."""
        media_converter = MediaConverter(
            command_builder_selector=CommandBuilderSelector(self._locate_tools().ffmpeg_path),
            media_inspector=self.create_media_inspector(),
        )
        return BatchConverter(media_converter, reporter)

    def create_compatibility_checker(self) -> SourceCompatibilityChecker:
        """Return a checker that compares the sources with the chosen profile."""
        return SourceCompatibilityChecker(self.create_media_inspector())

    def create_media_inspector(self) -> MediaInspector:
        """Return the inspector that reads the details of the source files."""
        if self._media_inspector is None:
            self._media_inspector = MediaInspector(self._locate_tools().ffprobe_path)
        return self._media_inspector

    def _locate_tools(self) -> FfmpegTools:
        """Return the ffmpeg executables, looking for them only once."""
        if self._ffmpeg_tools is None:
            self._ffmpeg_tools = self._locator.locate()
        return self._ffmpeg_tools
