"""Vector graphics conversion through Inkscape, plus raster tracing via Potrace."""

from __future__ import annotations

import tempfile
from pathlib import Path
from typing import List, Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import (
    ConversionOption,
    choice_option,
    integer_option,
    toggle_option,
)
from ..core.converter import Converter
from ..core.external_tool import (
    IMAGEMAGICK,
    INKSCAPE,
    POTRACE,
    ExternalTool,
    require_tool,
)
from ..core.format_families import (
    VECTOR_FORMATS,
    VECTOR_ONLY_SOURCE_FORMATS,
    VECTOR_ONLY_TARGET_FORMATS,
    ConversionPair,
    build_conversion_pairs,
    build_round_trip_pairs,
)

TRACEABLE_SOURCE_FORMATS = frozenset({"png", "jpg", "bmp", "gif", "tiff", "webp"})


class VectorConverter(Converter):
    """Converts between vector formats and rasterises them at a chosen size."""

    @property
    def display_name(self) -> str:
        return "Inkscape (vector graphics)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (INKSCAPE,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_round_trip_pairs(
            VECTOR_FORMATS,
            extra_sources=VECTOR_ONLY_SOURCE_FORMATS,
            extra_targets=VECTOR_ONLY_TARGET_FORMATS,
        )

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format == "png":
            return RASTERISE_OPTIONS
        return VECTOR_EXPORT_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        run_command(build_inkscape_command(job.source_path, output_path, job))


class ImageTracingConverter(Converter):
    """Turns a raster picture into a scalable vector drawing with Potrace.

    Potrace only reads bitmap formats, so ImageMagick first flattens the input
    into a black and white PBM at the requested threshold.
    """

    @property
    def display_name(self) -> str:
        return "Potrace (image tracing)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (POTRACE, IMAGEMAGICK)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_conversion_pairs(TRACEABLE_SOURCE_FORMATS, {"svg", "eps"})

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        return TRACING_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        with tempfile.TemporaryDirectory(prefix="ultimate-converter-") as workspace:
            bitmap_path = Path(workspace) / "traced.pbm"
            self._prepare_bitmap(job, bitmap_path)
            self._trace_bitmap(bitmap_path, output_path, job.target_format, job.options)

    @staticmethod
    def _prepare_bitmap(job: ConversionJob, bitmap_path: Path) -> None:
        """Flatten the source image into the black and white bitmap Potrace needs."""
        threshold = job.options.get("threshold", 50)
        run_command(
            [
                require_tool(IMAGEMAGICK),
                f"{job.source_path}[0]",
                "-alpha", "remove",
                "-colorspace", "gray",
                "-threshold", f"{threshold}%",
                str(bitmap_path),
            ]
        )

    @staticmethod
    def _trace_bitmap(
        bitmap_path: Path, output_path: Path, target_format: str, options: dict
    ) -> None:
        """Run Potrace over the prepared bitmap."""
        command = [
            require_tool(POTRACE),
            "--backend", target_format,
            "--output", str(output_path),
            "--turdsize", str(options.get("speckle_size", 2)),
            "--alphamax", str(options.get("corner_smoothing", "1.0")),
        ]
        if options.get("invert_colours"):
            command.append("--invert")
        command.append(str(bitmap_path))
        run_command(command)


RASTERISE_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "export_dpi",
        "Export resolution",
        (
            ("96 DPI (screen)", "96"),
            ("192 DPI (retina)", "192"),
            ("300 DPI (print)", "300"),
            ("600 DPI (large print)", "600"),
        ),
    ),
    integer_option(
        "export_width",
        "Width in pixels (0 keeps the DPI setting)",
        default=0,
        minimum=0,
        maximum=10000,
    ),
    toggle_option(
        "export_area_drawing",
        "Crop to the drawing instead of the page",
        default=False,
    ),
)

VECTOR_EXPORT_OPTIONS: Sequence[ConversionOption] = (
    toggle_option(
        "convert_text_to_paths",
        "Convert text to outlines",
        default=False,
        help_text="Keeps the look identical on machines without the original fonts.",
    ),
    toggle_option(
        "export_area_drawing",
        "Crop to the drawing instead of the page",
        default=False,
    ),
)

TRACING_OPTIONS: Sequence[ConversionOption] = (
    integer_option(
        "threshold",
        "Black/white threshold (%)",
        default=50,
        minimum=1,
        maximum=99,
        help_text="Lower values keep more of the image as white.",
    ),
    integer_option(
        "speckle_size",
        "Ignore specks smaller than (pixels)",
        default=2,
        minimum=0,
        maximum=100,
    ),
    choice_option(
        "corner_smoothing",
        "Corner smoothing",
        (
            ("Balanced", "1.0"),
            ("Sharp corners", "0.0"),
            ("Very smooth", "1.334"),
        ),
    ),
    toggle_option("invert_colours", "Trace the light areas instead", default=False),
)


def build_inkscape_command(
    source_path: Path, output_path: Path, job: ConversionJob
) -> List[str]:
    """Return the Inkscape command that exports one drawing.

    Shared with the CAD converter, which feeds Inkscape a translated DXF rather
    than the file the user originally chose.
    """
    return [
        require_tool(INKSCAPE),
        str(source_path),
        f"--export-filename={output_path}",
        f"--export-type={job.target_format}",
        *_export_arguments(job.target_format, job.options),
    ]


def _export_arguments(target_format: str, options: dict) -> List[str]:
    """Return the Inkscape flags that match the requested output."""
    arguments: List[str] = []
    if options.get("export_area_drawing"):
        arguments.append("--export-area-drawing")
    if target_format == "png":
        arguments += _rasterise_arguments(options)
    elif options.get("convert_text_to_paths"):
        arguments.append("--export-text-to-path")
    return arguments


def _rasterise_arguments(options: dict) -> List[str]:
    """Return the size flags used when drawing a vector into a PNG."""
    width = options.get("export_width", 0)
    if width:
        return [f"--export-width={width}"]
    return [f"--export-dpi={options.get('export_dpi', '96')}"]
