"""Checking whether the chosen profile really fits the source videos."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

from .conversion_job import ConversionJob
from .conversion_settings import ConversionSettings, DnxhrProfile
from .media_inspector import MediaInspector
from .media_kind import MediaKind

LISTED_FILE_LIMIT = 10


@dataclass(frozen=True)
class ProfileWarning:
    """Tells that a chosen profile stores more than the sources contain."""

    profile: DnxhrProfile
    total_source_count: int
    eight_bit_sources: list[Path]
    subsampled_sources: list[Path]

    @property
    def is_empty(self) -> bool:
        """Tell whether there is nothing to warn about."""
        return not self.eight_bit_sources and not self.subsampled_sources

    def describe(self) -> str:
        """Return the whole warning as a readable text."""
        return "\n".join(self._warning_parts())

    def _warning_parts(self) -> list[str]:
        """Return the paragraphs the warning is built from."""
        parts = [f"The chosen profile is '{self.profile.display_name}'."]
        if self.eight_bit_sources:
            parts.append(self._describe_bit_depth_problem())
        if self.subsampled_sources:
            parts.append(self._describe_chroma_problem())
        parts.append(self._describe_advice())
        return parts

    def _describe_advice(self) -> str:
        """Return the closing part that tells what the user can do about it."""
        if self.eight_bit_sources:
            return (
                "The conversion works, but a 10-bit profile cannot add quality that is\n"
                "not in the source, it only makes much bigger files. An 8-bit profile\n"
                "(lb, sq or hq) gives the same picture in smaller files."
            )
        return (
            "The conversion works, but a 4:4:4 profile cannot add colour detail that\n"
            "is not in the source, it only makes much bigger files. The hqx profile\n"
            "gives the same picture in smaller files."
        )

    def _describe_bit_depth_problem(self) -> str:
        """Return the part of the warning about the 8-bit sources."""
        return (
            f"It stores 10-bit video, but {self._count_files(self.eight_bit_sources)} only 8-bit:\n"
            f"{self._list_files(self.eight_bit_sources)}"
        )

    def _describe_chroma_problem(self) -> str:
        """Return the part of the warning about the subsampled colour."""
        return (
            f"It also stores full 4:4:4 colour, but {self._count_files(self.subsampled_sources)} "
            f"subsampled colour:\n{self._list_files(self.subsampled_sources)}"
        )

    def _count_files(self, source_paths: list[Path]) -> str:
        """Return a readable count like 'all 3 chosen videos have' or '1 of the 5 has'."""
        found_count = len(source_paths)
        if found_count == self.total_source_count == 1:
            return "the chosen video has"
        if found_count == self.total_source_count:
            return f"all {found_count} chosen videos have"
        if found_count == 1:
            return f"1 of the {self.total_source_count} chosen videos has"
        return f"{found_count} of the {self.total_source_count} chosen videos have"

    def _list_files(self, source_paths: list[Path]) -> str:
        """Return the file names of a warning, without making the text endless."""
        listed_names = [f"  - {path.name}" for path in source_paths[:LISTED_FILE_LIMIT]]
        hidden_count = len(source_paths) - len(listed_names)
        if hidden_count > 0:
            listed_names.append(f"  - ... and {hidden_count} more")
        return "\n".join(listed_names)


class SourceCompatibilityChecker:
    """Compares the source videos with the profile the user has chosen."""

    def __init__(self, media_inspector: MediaInspector) -> None:
        self._media_inspector = media_inspector

    def check(self, jobs: list[ConversionJob], settings: ConversionSettings) -> ProfileWarning | None:
        """Return the warning of a batch, or None when the profile fits the sources.

        The profile only describes the video, so the audio files of the batch are
        not looked at.
        """
        if not self._profile_can_be_wasted(settings.profile):
            return None
        video_jobs = [job for job in jobs if job.media_kind is MediaKind.VIDEO]
        if not video_jobs:
            return None
        warning = self._collect_warning(video_jobs, settings.profile)
        return None if warning.is_empty else warning

    def _profile_can_be_wasted(self, profile: DnxhrProfile) -> bool:
        """Tell whether the profile stores more than a simple source contains."""
        return profile.is_ten_bit or profile.keeps_full_chroma

    def _collect_warning(self, jobs: list[ConversionJob], profile: DnxhrProfile) -> ProfileWarning:
        """Look at every source file and collect the ones that do not fit."""
        eight_bit_sources: list[Path] = []
        subsampled_sources: list[Path] = []
        for job in jobs:
            media_info = self._media_inspector.inspect(job.source_path)
            if profile.is_ten_bit and media_info.is_eight_bit:
                eight_bit_sources.append(job.source_path)
            if profile.keeps_full_chroma and media_info.pixel_format and not media_info.has_full_chroma:
                subsampled_sources.append(job.source_path)
        return ProfileWarning(
            profile=profile,
            total_source_count=len(jobs),
            eight_bit_sources=eight_bit_sources,
            subsampled_sources=subsampled_sources,
        )
