"""E-book conversion through Calibre's ``ebook-convert`` command."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import (
    AUTOMATIC,
    ConversionOption,
    choice_option,
    is_automatic,
    toggle_option,
)
from ..core.converter import Converter
from ..core.external_tool import CALIBRE, ExternalTool, require_tool
from ..core.format_families import (
    EBOOK_FORMATS,
    EBOOK_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_round_trip_pairs,
)


class EbookConverter(Converter):
    """Converts between e-book formats and comic book archives."""

    @property
    def display_name(self) -> str:
        return "Calibre (e-books)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (CALIBRE,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_round_trip_pairs(
            EBOOK_FORMATS, extra_sources=EBOOK_ONLY_SOURCE_FORMATS
        )

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        options: List[ConversionOption] = list(SHARED_EBOOK_OPTIONS)
        if target_format == "pdf":
            options.extend(PDF_LAYOUT_OPTIONS)
        return tuple(options)

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        command = [require_tool(CALIBRE), str(job.source_path), str(output_path)]
        command += _metadata_arguments(job.options)
        command += _pdf_layout_arguments(job.target_format, job.options)
        run_command(command)


SHARED_EBOOK_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "output_profile",
        "Target device",
        (
            ("Generic e-reader", "generic_eink"),
            ("Kindle Paperwhite", "kindle_pw3"),
            ("Kobo", "kobo"),
            ("Tablet", "tablet"),
        ),
        help_text="Tunes margins and font scaling for the screen the book is read on.",
    ),
    toggle_option(
        "remove_first_image",
        "Drop the cover image",
        default=False,
        help_text="Useful when the source cover is a scanned placeholder page.",
    ),
)

PDF_LAYOUT_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "paper_size",
        "Page size",
        (
            ("A4", "a4"),
            ("US Letter", "letter"),
            ("A5", "a5"),
            ("B5", "b5"),
        ),
    ),
    choice_option(
        "base_font_size",
        "Base font size",
        (
            ("Default", AUTOMATIC),
            ("10 pt", "10"),
            ("12 pt", "12"),
            ("14 pt", "14"),
            ("16 pt (large print)", "16"),
        ),
    ),
)


def _metadata_arguments(options: dict) -> List[str]:
    """Return flags that change how the book is laid out for its reader."""
    arguments = ["--output-profile", options.get("output_profile", "generic_eink")]
    if options.get("remove_first_image"):
        arguments.append("--remove-first-image")
    return arguments


def _pdf_layout_arguments(target_format: str, options: dict) -> List[str]:
    """Return the page layout flags that only apply to PDF output."""
    if target_format != "pdf":
        return []
    arguments = ["--paper-size", options.get("paper_size", "a4")]
    font_size = options.get("base_font_size")
    if not is_automatic(font_size) and font_size:
        arguments += ["--pdf-default-font-size", str(font_size)]
    return arguments
