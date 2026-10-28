"""CAD drawing conversion: DWG is translated to DXF, then rendered by Inkscape.

DWG is a closed format that Inkscape cannot open, so LibreDWG's ``dwg2dxf``
translates it into DXF first. Both steps live in this one converter, which keeps
the two-stage pipeline invisible to the rest of the application.
"""

from __future__ import annotations

import shutil
import tempfile
from pathlib import Path
from typing import Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption
from ..core.converter import Converter
from ..core.external_tool import DWG2DXF, INKSCAPE, ExternalTool, require_tool
from ..core.format_families import ConversionPair, build_conversion_pairs
from .vector_converter import RASTERISE_OPTIONS, VECTOR_EXPORT_OPTIONS, build_inkscape_command

RENDERABLE_TARGETS = frozenset({"pdf", "svg", "png", "eps", "ps"})


class CadConverter(Converter):
    """Opens AutoCAD drawings and exports them as shareable documents."""

    @property
    def display_name(self) -> str:
        return "LibreDWG + Inkscape (CAD drawings)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (DWG2DXF, INKSCAPE)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_conversion_pairs({"dwg"}, RENDERABLE_TARGETS | {"dxf"})

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format == "dxf":
            return ()
        return RASTERISE_OPTIONS if target_format == "png" else VECTOR_EXPORT_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
            drawing_path = _translate_to_dxf(job.source_path, Path(workspace))
            if job.target_format == "dxf":
                shutil.move(str(drawing_path), str(output_path))
                return
            run_command(build_inkscape_command(drawing_path, output_path, job))


def _translate_to_dxf(source_path: Path, workspace: Path) -> Path:
    """Turn a DWG drawing into the DXF that Inkscape can read."""
    dxf_path = workspace / "drawing.dxf"
    run_command([require_tool(DWG2DXF), "-o", str(dxf_path), str(source_path)])
    if not dxf_path.exists():
        raise RuntimeError(
            "LibreDWG could not read this drawing. Very new AutoCAD versions are "
            "not supported yet; re-save the file as DXF from your CAD program."
        )
    return dxf_path
