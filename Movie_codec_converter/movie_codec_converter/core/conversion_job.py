"""The description and the result of a single file conversion."""

from __future__ import annotations

from dataclasses import dataclass
from enum import Enum
from pathlib import Path

from .media_kind import MediaKind


class ConversionOutcome(Enum):
    """Tells how the conversion of a single file ended."""

    CONVERTED = "converted"
    SKIPPED = "skipped"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass(frozen=True)
class ConversionJob:
    """One source file and the file that has to be created from it."""

    source_path: Path
    destination_path: Path
    media_kind: MediaKind = MediaKind.VIDEO

    def describe_destination(self, output_directory: Path) -> str:
        """Return the destination with its folders, as seen in the output folder."""
        try:
            return str(self.destination_path.relative_to(output_directory))
        except ValueError:
            return self.destination_path.name


@dataclass(frozen=True)
class ConversionResult:
    """The outcome of one finished conversion job."""

    job: ConversionJob
    outcome: ConversionOutcome
    message: str = ""

    @property
    def is_successful(self) -> bool:
        """Tell whether the job produced a new MOV file."""
        return self.outcome is ConversionOutcome.CONVERTED


class ConversionSummary:
    """Counts the outcomes of a finished batch."""

    def __init__(self, results: list[ConversionResult]) -> None:
        self._results = results

    def count_of(self, outcome: ConversionOutcome) -> int:
        """Return how many jobs ended with the given outcome."""
        return sum(1 for result in self._results if result.outcome is outcome)

    @property
    def failed_results(self) -> list[ConversionResult]:
        """Return every job that ended with an error."""
        return [result for result in self._results if result.outcome is ConversionOutcome.FAILED]

    def describe(self) -> str:
        """Return a short human readable summary of the whole batch."""
        return (
            f"{self.count_of(ConversionOutcome.CONVERTED)} converted, "
            f"{self.count_of(ConversionOutcome.SKIPPED)} skipped, "
            f"{self.count_of(ConversionOutcome.FAILED)} failed, "
            f"{self.count_of(ConversionOutcome.CANCELLED)} cancelled"
        )
