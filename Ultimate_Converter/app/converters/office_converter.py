"""Documents, spreadsheets and presentations through LibreOffice."""

from __future__ import annotations

import json
import shutil
import tempfile
from pathlib import Path
from typing import Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption, choice_option
from ..core.converter import Converter
from ..core.external_tool import LIBREOFFICE, ExternalTool, require_tool
from ..core.format_families import (
    PRESENTATION_FORMATS,
    PRESENTATION_ONLY_SOURCE_FORMATS,
    PRESENTATION_ONLY_TARGET_FORMATS,
    SPREADSHEET_FORMATS,
    SPREADSHEET_ONLY_SOURCE_FORMATS,
    SPREADSHEET_ONLY_TARGET_FORMATS,
    TEXT_DOCUMENT_FORMATS,
    TEXT_DOCUMENT_ONLY_SOURCE_FORMATS,
    TEXT_DOCUMENT_ONLY_TARGET_FORMATS,
    ConversionPair,
    build_round_trip_pairs,
)

LIBREOFFICE_FILTERS = {
    ("docx", "pdf"): "pdf:writer_pdf_Export",
    ("xlsx", "pdf"): "pdf:calc_pdf_Export",
    ("pptx", "pdf"): "pdf:impress_pdf_Export",
    ("txt", "docx"): "docx:MS Word 2007 XML",
    ("csv", "xlsx"): "xlsx:Calc MS Excel 2007 XML",
}
"""Explicit export filters where LibreOffice's guess is not the wanted one."""

DEFAULT_PDF_QUALITY = "__libreoffice_default__"
"""Marker meaning "add no filter data", which keeps old LibreOffice builds happy."""


class OfficeConverter(Converter):
    """Converts office file formats by driving LibreOffice in headless mode.

    LibreOffice refuses to run two instances against one user profile, so each
    job is given a private throwaway profile and can therefore run in parallel
    with the rest of the batch.
    """

    @property
    def display_name(self) -> str:
        return "LibreOffice (office documents)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (LIBREOFFICE,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        document_pairs = build_round_trip_pairs(
            TEXT_DOCUMENT_FORMATS,
            extra_sources=TEXT_DOCUMENT_ONLY_SOURCE_FORMATS,
            extra_targets=TEXT_DOCUMENT_ONLY_TARGET_FORMATS,
        )
        spreadsheet_pairs = build_round_trip_pairs(
            SPREADSHEET_FORMATS,
            extra_sources=SPREADSHEET_ONLY_SOURCE_FORMATS,
            extra_targets=SPREADSHEET_ONLY_TARGET_FORMATS,
        )
        presentation_pairs = build_round_trip_pairs(
            PRESENTATION_FORMATS,
            extra_sources=PRESENTATION_ONLY_SOURCE_FORMATS,
            extra_targets=PRESENTATION_ONLY_TARGET_FORMATS,
        )
        return document_pairs | spreadsheet_pairs | presentation_pairs

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format == "pdf":
            return PDF_EXPORT_OPTIONS
        return ()

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
            produced = self._run_libreoffice(job, Path(workspace))
            shutil.move(str(produced), str(output_path))

    def _run_libreoffice(self, job: ConversionJob, workspace: Path) -> Path:
        """Convert into ``workspace`` and return the file LibreOffice wrote."""
        command = [
            require_tool(LIBREOFFICE),
            "--headless",
            "--norestore",
            f"-env:UserInstallation={workspace.joinpath('profile').as_uri()}",
            "--convert-to",
            _export_filter(job.source_format, job.target_format, job.options),
            "--outdir",
            str(workspace),
            str(job.source_path),
        ]
        run_command(command)
        return _only_produced_file(workspace, job.target_format)


PDF_EXPORT_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "pdf_image_quality",
        "Embedded image quality",
        (
            ("Keep LibreOffice default", DEFAULT_PDF_QUALITY),
            ("High (print, 300 DPI)", "300"),
            ("Medium (150 DPI)", "150"),
            ("Small file (96 DPI)", "96"),
        ),
        help_text="Downsamples pictures inside the document to shrink the PDF.",
    ),
)


def _export_filter(source_format: str, target_format: str, options: dict) -> str:
    """Return LibreOffice's ``--convert-to`` argument for one pair."""
    base_filter = LIBREOFFICE_FILTERS.get((source_format, target_format), target_format)
    filter_data = _pdf_filter_data(target_format, options)
    return f"{base_filter}:{filter_data}" if filter_data else base_filter


def _pdf_filter_data(target_format: str, options: dict) -> str:
    """Return the JSON filter data that downsamples images inside a PDF."""
    resolution = options.get("pdf_image_quality", DEFAULT_PDF_QUALITY)
    if target_format != "pdf" or resolution == DEFAULT_PDF_QUALITY:
        return ""
    return json.dumps(
        {
            "ReduceImageResolution": {"type": "boolean", "value": "true"},
            "MaxImageResolution": {"type": "long", "value": resolution},
        },
        separators=(",", ":"),
    )


def _only_produced_file(workspace: Path, target_format: str) -> Path:
    """Return the single converted file, or explain that none was written."""
    produced = [
        path
        for path in workspace.iterdir()
        if path.is_file() and path.suffix.lower() == f".{target_format}"
    ]
    if not produced:
        raise RuntimeError(
            f"LibreOffice did not produce a .{target_format} file; "
            "the source may be password protected or corrupt."
        )
    return produced[0]
