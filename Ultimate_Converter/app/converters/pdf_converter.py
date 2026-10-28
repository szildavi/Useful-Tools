"""Text and markup extraction from PDF files using Poppler."""

from __future__ import annotations

import shutil
import tempfile
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
from ..core.external_tool import PDFTOHTML, PDFTOTEXT, ExternalTool, require_tool
from ..core.format_families import ConversionPair


class PdfTextConverter(Converter):
    """Pulls the text layer out of a PDF as plain text or HTML.

    This runs ahead of the e-book converter because Poppler keeps the original
    line and column layout, which is what people want from a PDF text export.
    """

    @property
    def display_name(self) -> str:
        return "Poppler (PDF text extraction)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (PDFTOTEXT, PDFTOHTML)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return {("pdf", "txt"), ("pdf", "html")}

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format == "html":
            return HTML_EXTRACTION_OPTIONS
        return TEXT_EXTRACTION_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        if job.target_format == "html":
            _extract_html(job, output_path)
            return
        _extract_text(job, output_path)


TEXT_EXTRACTION_OPTIONS: Sequence[ConversionOption] = (
    toggle_option(
        "preserve_layout",
        "Keep the original page layout",
        default=True,
        help_text="Off produces one continuous reading order instead of columns.",
    ),
    choice_option(
        "page_range",
        "Pages",
        (
            ("All pages", AUTOMATIC),
            ("First page only", "1-1"),
            ("First 10 pages", "1-10"),
            ("First 50 pages", "1-50"),
        ),
    ),
)

HTML_EXTRACTION_OPTIONS: Sequence[ConversionOption] = (
    toggle_option(
        "ignore_images",
        "Skip images",
        default=False,
        help_text="Produces a single self-contained HTML file with text only.",
    ),
    choice_option(
        "page_range",
        "Pages",
        (
            ("All pages", AUTOMATIC),
            ("First page only", "1-1"),
            ("First 10 pages", "1-10"),
            ("First 50 pages", "1-50"),
        ),
    ),
)


def _extract_text(job: ConversionJob, output_path: Path) -> None:
    """Run pdftotext with the chosen layout and page range."""
    command = [require_tool(PDFTOTEXT)]
    if job.options.get("preserve_layout", True):
        command.append("-layout")
    command += _page_range_arguments(job.options)
    command += [str(job.source_path), str(output_path)]
    run_command(command)


def _extract_html(job: ConversionJob, output_path: Path) -> None:
    """Run pdftohtml into a workspace, then keep the single HTML file it wrote."""
    with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
        produced_stem = Path(workspace) / "extracted"
        command = [require_tool(PDFTOHTML), "-s", "-noframes", "-q"]
        if job.options.get("ignore_images"):
            command.append("-i")
        command += _page_range_arguments(job.options)
        command += [str(job.source_path), str(produced_stem)]
        run_command(command)
        shutil.move(str(produced_stem.with_suffix(".html")), str(output_path))


def _page_range_arguments(options: dict) -> List[str]:
    """Translate the page choice into Poppler's first/last page flags."""
    page_range = options.get("page_range")
    if is_automatic(page_range) or not page_range:
        return []
    first_page, last_page = page_range.split("-")
    return ["-f", first_page, "-l", last_page]
