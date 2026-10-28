"""Archive repacking: extract with 7-Zip, then compress into the wanted format."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption, choice_option
from ..core.converter import Converter
from ..core.external_tool import SEVEN_ZIP, ExternalTool, require_tool
from ..core.format_families import (
    ARCHIVE_FORMATS,
    ARCHIVE_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_round_trip_pairs,
)

SHUTIL_ARCHIVE_NAMES = {
    "zip": "zip",
    "tar": "tar",
    "tar.gz": "gztar",
    "tar.bz2": "bztar",
    "tar.xz": "xztar",
}
"""Targets that Python's own archiver can write, mapped to its format names."""


class ArchiveConverter(Converter):
    """Rewrites an archive into another container without losing its contents."""

    @property
    def display_name(self) -> str:
        return "7-Zip (archives)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (SEVEN_ZIP,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_round_trip_pairs(
            ARCHIVE_FORMATS, extra_sources=ARCHIVE_ONLY_SOURCE_FORMATS
        )

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format == "7z":
            return (COMPRESSION_LEVEL_OPTION,)
        return ()

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
            extracted = Path(workspace) / "contents"
            self._extract(job.source_path, extracted)
            self._pack(extracted, output_path, job.target_format, job.options)

    @staticmethod
    def _extract(archive_path: Path, destination: Path) -> None:
        """Unpack any supported archive into an empty directory."""
        destination.mkdir(parents=True, exist_ok=True)
        run_command(
            [require_tool(SEVEN_ZIP), "x", str(archive_path), f"-o{destination}", "-y", "-bso0"]
        )

    @staticmethod
    def _pack(source_directory: Path, output_path: Path, target_format: str, options: dict) -> None:
        """Compress a directory tree into the requested archive format."""
        if target_format == "7z":
            _pack_with_seven_zip(source_directory, output_path, options)
            return
        _pack_with_python(source_directory, output_path, target_format)


COMPRESSION_LEVEL_OPTION = choice_option(
    "compression_level",
    "Compression level",
    (
        ("Normal", "5"),
        ("Fast", "1"),
        ("Maximum", "9"),
        ("Store without compressing", "0"),
    ),
    help_text="Higher levels take longer and produce smaller archives.",
)


def _pack_with_seven_zip(source_directory: Path, output_path: Path, options: dict) -> None:
    """Create a 7z archive of everything inside ``source_directory``."""
    level = options.get("compression_level", "5")
    run_command(
        [require_tool(SEVEN_ZIP), "a", f"-mx={level}", "-bso0", str(output_path), "."],
        working_directory=source_directory,
    )


def _pack_with_python(source_directory: Path, output_path: Path, target_format: str) -> None:
    """Create a zip or tar archive using the standard library."""
    archive_name = SHUTIL_ARCHIVE_NAMES.get(target_format)
    if archive_name is None:
        raise RuntimeError(f"Writing .{target_format} archives is not supported.")
    with tempfile.TemporaryDirectory(prefix="ultimate-converter-pack-") as staging:
        produced = shutil.make_archive(
            base_name=str(Path(staging) / "archive"),
            format=archive_name,
            root_dir=str(source_directory),
        )
        shutil.move(produced, str(output_path))
