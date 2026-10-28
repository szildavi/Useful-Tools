"""The one place that decides which converters exist and who wins a tie.

Order matters: when two converters declare the same format pair the first one
listed keeps it, so more specialised engines are registered ahead of general
purpose ones.
"""

from __future__ import annotations

from typing import Sequence

from ..core.conversion_registry import ConversionRegistry
from ..core.converter import Converter
from .archive_converter import ArchiveConverter
from .cad_converter import CadConverter
from .data_converter import DataConverter
from .ebook_converter import EbookConverter
from .image_converter import ImageConverter
from .latex_converter import LatexConverter
from .media_converter import MediaConverter
from .model_converter import ModelConverter
from .office_converter import OfficeConverter
from .pdf_converter import PdfTextConverter
from .vector_converter import ImageTracingConverter, VectorConverter


def build_all_converters() -> Sequence[Converter]:
    """Return every converter in priority order."""
    return (
        MediaConverter(),
        ImageConverter(),
        PdfTextConverter(),
        OfficeConverter(),
        DataConverter(),
        EbookConverter(),
        LatexConverter(),
        VectorConverter(),
        CadConverter(),
        ImageTracingConverter(),
        ArchiveConverter(),
        ModelConverter(),
    )


def build_conversion_registry() -> ConversionRegistry:
    """Return the registry the desktop application runs on."""
    return ConversionRegistry(build_all_converters())
