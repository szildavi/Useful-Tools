"""Telling in words what a batch of jobs is made of."""

from __future__ import annotations

from .conversion_job import ConversionJob
from .media_kind import MediaKind


class BatchDescription:
    """Describes the kinds of files a batch converts and what they become."""

    def __init__(self, jobs: list[ConversionJob]) -> None:
        self._jobs = jobs

    @property
    def job_count(self) -> int:
        """Return how many files the batch handles."""
        return len(self._jobs)

    def describe(self) -> str:
        """Return a text like '3 videos to DNxHR MOV and 2 audio files to WAV'."""
        parts = [
            self._describe_kind(MediaKind.VIDEO, "video", "videos", "DNxHR MOV"),
            self._describe_kind(MediaKind.AUDIO, "audio file", "audio files", "WAV"),
        ]
        described_parts = [part for part in parts if part]
        if not described_parts:
            return "no file"
        return " and ".join(described_parts)

    def _describe_kind(self, media_kind: MediaKind, single_name: str, many_name: str, target: str) -> str:
        """Return the part of the text that belongs to one kind of file."""
        found_count = self._count_of(media_kind)
        if found_count == 0:
            return ""
        name = single_name if found_count == 1 else many_name
        return f"{found_count} {name} to {target}"

    def _count_of(self, media_kind: MediaKind) -> int:
        """Return how many files of the given kind the batch has."""
        return sum(1 for job in self._jobs if job.media_kind is media_kind)
