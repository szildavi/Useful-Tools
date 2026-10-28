"""LaTeX typesetting through whichever TeX engine is installed."""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import List, Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption, choice_option, toggle_option
from ..core.converter import Converter
from ..core.external_tool import TEX_ENGINE, ExternalTool, require_tool
from ..core.format_families import ConversionPair


class LatexConverter(Converter):
    """Typesets a LaTeX document into a PDF.

    The document is built inside a temporary directory so the auxiliary files
    TeX writes never land next to the user's source file.
    """

    @property
    def display_name(self) -> str:
        return "LaTeX (TeX distribution)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (TEX_ENGINE,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return {("tex", "pdf"), ("latex", "pdf")}

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        return LATEX_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
            build_directory = Path(workspace)
            source_copy = build_directory / f"document.{job.source_format}"
            shutil.copyfile(job.source_path, source_copy)
            self._typeset(source_copy, build_directory, job.options)
            shutil.move(str(build_directory / "document.pdf"), str(output_path))

    @staticmethod
    def _typeset(source_copy: Path, build_directory: Path, options: dict) -> None:
        """Run the TeX engine, twice when cross-references must settle."""
        engine = require_tool(TEX_ENGINE)
        command = _build_engine_command(engine, source_copy, options)
        for _pass in range(2 if options.get("resolve_references", True) else 1):
            run_command(command, working_directory=build_directory)
        if not (build_directory / "document.pdf").exists():
            raise RuntimeError(
                "The TeX engine finished without producing a PDF. "
                "The document may be missing a package or contain an error."
            )


LATEX_OPTIONS: Sequence[ConversionOption] = (
    toggle_option(
        "resolve_references",
        "Run twice to resolve references",
        default=True,
        help_text="Needed for a table of contents, citations and cross-references.",
    ),
    choice_option(
        "error_handling",
        "When the document has an error",
        (
            ("Carry on and typeset what is valid", "nonstopmode"),
            ("Stop at the first error", "errorstopmode"),
        ),
    ),
)


def _build_engine_command(engine: str, source_copy: Path, options: dict) -> List[str]:
    """Return the command line for the detected engine."""
    if Path(engine).stem == "tectonic":
        return [engine, "--outdir", str(source_copy.parent), str(source_copy)]
    interaction = options.get("error_handling", "nonstopmode")
    command = [engine, f"-interaction={interaction}", str(source_copy)]
    if interaction == "errorstopmode":
        command.insert(2, "-halt-on-error")
    return command
