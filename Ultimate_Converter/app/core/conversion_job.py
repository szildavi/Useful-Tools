"""The unit of work shared by the queue, the runner and the user interface."""

from __future__ import annotations

import itertools
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Dict

from .format_families import normalise_format


class JobStatus(Enum):
    """Lifecycle of a single file conversion."""

    PENDING = "Pending"
    RUNNING = "Converting"
    DONE = "Done"
    FAILED = "Failed"
    CANCELLED = "Cancelled"


_job_id_counter = itertools.count(1)


@dataclass
class ConversionJob:
    """One input file on its way to one output file."""

    source_path: Path
    target_format: str
    output_directory: Path
    options: Dict[str, Any] = field(default_factory=dict)
    status: JobStatus = JobStatus.PENDING
    error_message: str = ""
    output_path: Path | None = None
    job_id: int = field(default_factory=lambda: next(_job_id_counter))

    @property
    def source_format(self) -> str:
        """Canonical extension of the input file."""
        return normalise_format(_full_suffix(self.source_path))

    @property
    def source_name(self) -> str:
        """File name shown in the queue."""
        return self.source_path.name

    def build_output_path(self) -> Path:
        """Return a free path in the output directory for this job's result."""
        candidate = self.output_directory / f"{self.source_path.stem}.{self.target_format}"
        return _first_unused_path(candidate)

    def mark_running(self) -> None:
        self.status = JobStatus.RUNNING
        self.error_message = ""

    def mark_done(self, output_path: Path) -> None:
        self.status = JobStatus.DONE
        self.output_path = output_path

    def mark_failed(self, error_message: str) -> None:
        self.status = JobStatus.FAILED
        self.error_message = error_message

    def mark_cancelled(self) -> None:
        self.status = JobStatus.CANCELLED


def _full_suffix(path: Path) -> str:
    """Return the extension, keeping compound ones such as ``.tar.gz`` intact."""
    suffixes = [suffix.lower() for suffix in path.suffixes[-2:]]
    if len(suffixes) == 2 and suffixes[0] == ".tar":
        return "tar" + suffixes[1]
    return path.suffix


def _first_unused_path(candidate: Path) -> Path:
    """Append ``(1)``, ``(2)``… until the path does not exist yet."""
    if not candidate.exists():
        return candidate
    for attempt in itertools.count(1):
        numbered = candidate.with_name(f"{candidate.stem} ({attempt}){candidate.suffix}")
        if not numbered.exists():
            return numbered
    raise RuntimeError("unreachable")
