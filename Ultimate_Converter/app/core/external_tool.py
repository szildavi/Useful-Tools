"""Discovery of the command line programs the converters delegate to."""

from __future__ import annotations

import shutil
from dataclasses import dataclass
from functools import lru_cache
from typing import Sequence, Tuple


@dataclass(frozen=True)
class ExternalTool:
    """A third-party program plus the hints needed to install it."""

    tool_id: str
    display_name: str
    candidate_commands: Tuple[str, ...]
    purpose: str
    linux_install_hint: str
    windows_install_hint: str


FFMPEG = ExternalTool(
    tool_id="ffmpeg",
    display_name="FFmpeg",
    candidate_commands=("ffmpeg",),
    purpose="Audio and video conversion",
    linux_install_hint="sudo dnf install ffmpeg  /  sudo apt install ffmpeg",
    windows_install_hint="winget install Gyan.FFmpeg",
)

FFPROBE = ExternalTool(
    tool_id="ffprobe",
    display_name="FFprobe",
    candidate_commands=("ffprobe",),
    purpose="Reading media stream details",
    linux_install_hint="sudo dnf install ffmpeg  /  sudo apt install ffmpeg",
    windows_install_hint="winget install Gyan.FFmpeg",
)

IMAGEMAGICK = ExternalTool(
    tool_id="imagemagick",
    display_name="ImageMagick",
    candidate_commands=("magick", "convert"),
    purpose="Raster image and camera RAW conversion",
    linux_install_hint="sudo dnf install ImageMagick  /  sudo apt install imagemagick",
    windows_install_hint="winget install ImageMagick.ImageMagick",
)

LIBREOFFICE = ExternalTool(
    tool_id="libreoffice",
    display_name="LibreOffice",
    candidate_commands=("soffice", "libreoffice"),
    purpose="Documents, spreadsheets and presentations",
    linux_install_hint="sudo dnf install libreoffice  /  sudo apt install libreoffice",
    windows_install_hint="winget install TheDocumentFoundation.LibreOffice",
)

GHOSTSCRIPT = ExternalTool(
    tool_id="ghostscript",
    display_name="Ghostscript",
    candidate_commands=("gs", "gswin64c"),
    purpose="PDF and PostScript rendering, used by ImageMagick",
    linux_install_hint="sudo dnf install ghostscript  /  sudo apt install ghostscript",
    windows_install_hint="winget install ArtifexSoftware.GhostScript",
)

CALIBRE = ExternalTool(
    tool_id="calibre",
    display_name="Calibre (ebook-convert)",
    candidate_commands=("ebook-convert",),
    purpose="E-book conversion",
    linux_install_hint="sudo dnf install calibre  /  sudo apt install calibre",
    windows_install_hint="winget install calibre.calibre",
)

INKSCAPE = ExternalTool(
    tool_id="inkscape",
    display_name="Inkscape",
    candidate_commands=("inkscape",),
    purpose="Vector graphics conversion",
    linux_install_hint="sudo dnf install inkscape  /  sudo apt install inkscape",
    windows_install_hint="winget install Inkscape.Inkscape",
)

POTRACE = ExternalTool(
    tool_id="potrace",
    display_name="Potrace",
    candidate_commands=("potrace",),
    purpose="Tracing raster images into vectors",
    linux_install_hint="sudo dnf install potrace  /  sudo apt install potrace",
    windows_install_hint="Download from https://potrace.sourceforge.net",
)

PDFTOTEXT = ExternalTool(
    tool_id="pdftotext",
    display_name="Poppler (pdftotext)",
    candidate_commands=("pdftotext",),
    purpose="Extracting the text layer from PDF files",
    linux_install_hint="sudo dnf install poppler-utils  /  sudo apt install poppler-utils",
    windows_install_hint="winget install oschwartz10612.Poppler",
)

PDFTOHTML = ExternalTool(
    tool_id="pdftohtml",
    display_name="Poppler (pdftohtml)",
    candidate_commands=("pdftohtml",),
    purpose="Extracting HTML from PDF files",
    linux_install_hint="sudo dnf install poppler-utils  /  sudo apt install poppler-utils",
    windows_install_hint="winget install oschwartz10612.Poppler",
)

TEX_ENGINE = ExternalTool(
    tool_id="tex",
    display_name="LaTeX engine",
    candidate_commands=("pdflatex", "xelatex", "lualatex", "tectonic"),
    purpose="Typesetting LaTeX documents into PDF",
    linux_install_hint="sudo dnf install texlive-scheme-basic  /  sudo apt install texlive",
    windows_install_hint="winget install MiKTeX.MiKTeX",
)

DWG2DXF = ExternalTool(
    tool_id="dwg2dxf",
    display_name="LibreDWG (dwg2dxf)",
    candidate_commands=("dwg2dxf",),
    purpose="Reading AutoCAD DWG drawings",
    linux_install_hint="sudo dnf install libredwg  /  sudo apt install libredwg-tools",
    windows_install_hint="Download from https://github.com/LibreDWG/libredwg/releases",
)

SEVEN_ZIP = ExternalTool(
    tool_id="7zip",
    display_name="7-Zip",
    candidate_commands=("7z", "7za", "7zz"),
    purpose="Archive extraction and repacking",
    linux_install_hint="sudo dnf install p7zip p7zip-plugins  /  sudo apt install p7zip-full",
    windows_install_hint="winget install 7zip.7zip",
)

ASSIMP = ExternalTool(
    tool_id="assimp",
    display_name="Open Asset Import Library",
    candidate_commands=("assimp",),
    purpose="3D model conversion",
    linux_install_hint="sudo dnf install assimp  /  sudo apt install assimp-utils",
    windows_install_hint="Download from https://github.com/assimp/assimp/releases",
)

ALL_EXTERNAL_TOOLS: Sequence[ExternalTool] = (
    FFMPEG,
    FFPROBE,
    IMAGEMAGICK,
    LIBREOFFICE,
    GHOSTSCRIPT,
    CALIBRE,
    INKSCAPE,
    POTRACE,
    PDFTOTEXT,
    PDFTOHTML,
    TEX_ENGINE,
    DWG2DXF,
    SEVEN_ZIP,
    ASSIMP,
)


@lru_cache(maxsize=None)
def locate_tool(tool: ExternalTool) -> str | None:
    """Return the runnable path of ``tool``, or ``None`` when it is absent."""
    for command in tool.candidate_commands:
        resolved = shutil.which(command)
        if resolved:
            return resolved
    return None


def is_tool_available(tool: ExternalTool) -> bool:
    """Report whether ``tool`` can be executed on this machine."""
    return locate_tool(tool) is not None


def require_tool(tool: ExternalTool) -> str:
    """Return the path of ``tool`` or explain how to install it."""
    resolved = locate_tool(tool)
    if resolved is None:
        raise ToolNotAvailableError(tool)
    return resolved


def forget_cached_locations() -> None:
    """Drop cached lookups so a freshly installed tool is picked up."""
    locate_tool.cache_clear()


class ToolNotAvailableError(RuntimeError):
    """Raised when a conversion needs a program that is not installed."""

    def __init__(self, tool: ExternalTool) -> None:
        super().__init__(
            f"{tool.display_name} is not installed. "
            f"Linux: {tool.linux_install_hint} | Windows: {tool.windows_install_hint}"
        )
        self.tool = tool
