"""Raster image and camera RAW conversion through ImageMagick."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import (
    AUTOMATIC,
    ConversionOption,
    choice_option,
    integer_option,
    is_automatic,
    toggle_option,
)
from ..core.converter import Converter
from ..core.external_tool import IMAGEMAGICK, ExternalTool, require_tool
from ..core.format_families import (
    CAMERA_RAW_FORMATS,
    RASTER_FORMATS,
    RASTER_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_conversion_pairs,
    build_round_trip_pairs,
)

FORMATS_WITHOUT_TRANSPARENCY = frozenset({"jpg", "bmp", "ppm"})
"""Targets that need a solid background painted under transparent pixels."""

LOSSY_FORMATS = frozenset({"jpg", "webp", "avif"})
"""Targets where the quality option actually changes the result."""


class ImageConverter(Converter):
    """Converts between raster formats, and develops camera RAW into pictures."""

    @property
    def display_name(self) -> str:
        return "ImageMagick (images & RAW)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (IMAGEMAGICK,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        raster_pairs = build_round_trip_pairs(
            RASTER_FORMATS,
            extra_sources=RASTER_ONLY_SOURCE_FORMATS,
            extra_targets={"pdf"},
        )
        raw_development_pairs = build_conversion_pairs(CAMERA_RAW_FORMATS, RASTER_FORMATS)
        pdf_page_pairs = build_conversion_pairs({"pdf"}, RASTER_FORMATS)
        return raster_pairs | raw_development_pairs | pdf_page_pairs

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        options: List[ConversionOption] = list(GEOMETRY_OPTIONS)
        if target_format in LOSSY_FORMATS:
            options.insert(0, QUALITY_OPTION)
        if target_format in FORMATS_WITHOUT_TRANSPARENCY:
            options.append(BACKGROUND_COLOUR_OPTION)
        if source_format == "pdf":
            options.append(PDF_RENDER_DENSITY_OPTION)
        if target_format == "ico":
            return (ICON_SIZE_OPTION,)
        return tuple(options)

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        command = [require_tool(IMAGEMAGICK)]
        command += _input_arguments(job.source_format, job.options)
        command.append(_first_frame_selector(job.source_path))
        command += _transformation_arguments(job.target_format, job.options)
        command.append(str(output_path))
        run_command(command)


QUALITY_OPTION = integer_option(
    "quality",
    "Quality",
    default=90,
    minimum=1,
    maximum=100,
    help_text="Higher keeps more detail and makes a larger file.",
)

BACKGROUND_COLOUR_OPTION = choice_option(
    "background_colour",
    "Background behind transparency",
    (
        ("White", "white"),
        ("Black", "black"),
        ("Light grey", "#f0f0f0"),
        ("Magenta (checking tool)", "magenta"),
    ),
    help_text="This format cannot store transparency, so it must be filled in.",
)

PDF_RENDER_DENSITY_OPTION = choice_option(
    "render_density",
    "PDF render resolution",
    (
        ("150 DPI (screen)", "150"),
        ("300 DPI (print)", "300"),
        ("600 DPI (archival)", "600"),
        ("72 DPI (thumbnail)", "72"),
    ),
)

ICON_SIZE_OPTION = choice_option(
    "icon_sizes",
    "Icon sizes",
    (
        ("16, 32, 48, 256 px (full set)", "16,32,48,256"),
        ("16, 32, 48 px (classic)", "16,32,48"),
        ("256 px only", "256"),
        ("32 px only", "32"),
    ),
)

GEOMETRY_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "resize",
        "Resize",
        (
            ("Keep original size", AUTOMATIC),
            ("Fit within 3840 px", "3840x3840>"),
            ("Fit within 1920 px", "1920x1920>"),
            ("Fit within 1280 px", "1280x1280>"),
            ("Fit within 800 px", "800x800>"),
            ("Fit within 400 px", "400x400>"),
            ("Half size", "50%"),
        ),
        help_text="Images smaller than the limit are left untouched.",
    ),
    choice_option(
        "rotate",
        "Rotate",
        (
            ("None", AUTOMATIC),
            ("90 degrees right", "90"),
            ("180 degrees", "180"),
            ("90 degrees left", "270"),
        ),
    ),
    toggle_option(
        "strip_metadata",
        "Remove metadata (EXIF, GPS)",
        default=False,
        help_text="Shrinks the file and drops camera and location details.",
    ),
)


def _input_arguments(source_format: str, options: dict) -> List[str]:
    """Return flags that must appear before the input file name."""
    if source_format == "pdf":
        return ["-density", str(options.get("render_density", "150"))]
    return []


def _first_frame_selector(source_path: Path) -> str:
    """Reference the first frame only, so multi-page inputs yield one image."""
    return f"{source_path}[0]"


def _transformation_arguments(target_format: str, options: dict) -> List[str]:
    """Return the flags that shape the output image."""
    if target_format == "ico":
        return ["-define", f"icon:auto-resize={options.get('icon_sizes', '16,32,48,256')}"]
    arguments: List[str] = []
    arguments += _flatten_arguments(target_format, options)
    arguments += _resize_arguments(options.get("resize"))
    arguments += _rotate_arguments(options.get("rotate"))
    if options.get("strip_metadata"):
        arguments.append("-strip")
    if "quality" in options:
        arguments += ["-quality", str(options["quality"])]
    return arguments


def _flatten_arguments(target_format: str, options: dict) -> List[str]:
    """Paint a solid colour behind transparency for formats that need it."""
    if target_format not in FORMATS_WITHOUT_TRANSPARENCY:
        return []
    colour = options.get("background_colour", "white")
    return ["-background", colour, "-alpha", "remove", "-alpha", "off"]


def _resize_arguments(resize: str | None) -> List[str]:
    """Return a resize flag unless the original size is kept."""
    if is_automatic(resize) or not resize:
        return []
    return ["-resize", resize]


def _rotate_arguments(rotate: str | None) -> List[str]:
    """Return a rotate flag unless no rotation was asked for."""
    if is_automatic(rotate) or not rotate:
        return []
    return ["-rotate", rotate]
