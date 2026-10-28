"""Format families and the helpers that turn them into conversion pairs.

Declaring families once and expanding them into pairs keeps every converter
free of hand-written conversion tables, and gives round-trip (A->B and B->A)
support automatically wherever a family is both readable and writable.
"""

from __future__ import annotations

from typing import Iterable, Set, Tuple

ConversionPair = Tuple[str, str]


AUDIO_FORMATS = frozenset({
    "mp3", "wav", "flac", "m4a", "aac", "ogg", "opus", "wma", "aiff", "amr", "ac3",
})

VIDEO_FORMATS = frozenset({
    "mp4", "mov", "mkv", "webm", "avi", "wmv", "flv", "m4v", "3gp", "mpg", "ts", "ogv",
})

VIDEO_ONLY_SOURCE_FORMATS = frozenset({"vob", "mts"})
"""Container formats ffmpeg reads reliably but should not be asked to write."""

AUDIO_ONLY_SOURCE_FORMATS = frozenset({"mid"})
"""Formats that are decoded into audio but never produced as output."""

ANIMATION_FORMATS = frozenset({"gif", "apng"})
"""Animated targets FFmpeg produces from video. Static image work stays with ImageMagick."""

RASTER_FORMATS = frozenset({
    "png", "jpg", "webp", "bmp", "tiff", "gif", "ico", "avif", "ppm", "tga",
})

RASTER_ONLY_SOURCE_FORMATS = frozenset({"heic", "jfif", "psd", "xcf"})
"""Raster formats read by ImageMagick that are rarely wanted as output."""

CAMERA_RAW_FORMATS = frozenset({
    "cr2", "cr3", "nef", "arw", "dng", "raf", "orf", "rw2", "pef", "srw",
})

TEXT_DOCUMENT_FORMATS = frozenset({"docx", "odt", "rtf", "txt", "html", "doc"})
TEXT_DOCUMENT_ONLY_SOURCE_FORMATS = frozenset({"wpd", "pages", "sxw", "md"})
"""``md`` needs LibreOffice 25.8 or newer, which is where Markdown import landed."""
TEXT_DOCUMENT_ONLY_TARGET_FORMATS = frozenset({"pdf"})

SPREADSHEET_FORMATS = frozenset({"xlsx", "ods", "csv", "xls"})
SPREADSHEET_ONLY_SOURCE_FORMATS = frozenset({"numbers", "sxc"})
SPREADSHEET_ONLY_TARGET_FORMATS = frozenset({"pdf", "html"})

PRESENTATION_FORMATS = frozenset({"pptx", "odp", "ppt"})
PRESENTATION_ONLY_SOURCE_FORMATS = frozenset({"key", "sxi"})
PRESENTATION_ONLY_TARGET_FORMATS = frozenset({"pdf", "html"})

STRUCTURED_DATA_FORMATS = frozenset({"csv", "tsv", "json", "yaml", "xml"})
STRUCTURED_DATA_ONLY_SOURCE_FORMATS = frozenset({"sql"})

EBOOK_FORMATS = frozenset(
    {"epub", "mobi", "azw3", "fb2", "lit", "pdb", "txt", "html", "rtf", "docx", "pdf"}
)
EBOOK_ONLY_SOURCE_FORMATS = frozenset({"cbz", "cbr", "lrf", "azw", "djvu", "snb"})

VECTOR_FORMATS = frozenset({"svg", "pdf", "eps", "ps", "emf", "wmf"})
VECTOR_ONLY_SOURCE_FORMATS = frozenset({"ai", "cdr", "dxf", "fig"})
VECTOR_ONLY_TARGET_FORMATS = frozenset({"png"})

MODEL_3D_FORMATS = frozenset({"obj", "stl", "ply", "dae", "gltf", "glb", "fbx", "3ds", "x3d"})
MODEL_3D_ONLY_SOURCE_FORMATS = frozenset({"blend", "lwo", "ms3d", "off", "b3d"})
"""Mesh formats Assimp imports but cannot write back out."""

ARCHIVE_FORMATS = frozenset({"zip", "7z", "tar", "tar.gz", "tar.bz2", "tar.xz"})
ARCHIVE_ONLY_SOURCE_FORMATS = frozenset({"rar", "iso", "cab", "gz", "bz2", "xz"})


def build_conversion_pairs(
    sources: Iterable[str],
    targets: Iterable[str],
) -> Set[ConversionPair]:
    """Return every (source, target) pair, skipping same-format conversions."""
    return {
        (source, target)
        for source in sources
        for target in targets
        if source != target
    }


def build_round_trip_pairs(
    formats: Iterable[str],
    extra_sources: Iterable[str] = (),
    extra_targets: Iterable[str] = (),
) -> Set[ConversionPair]:
    """Expand a family into pairs that convert in both directions.

    ``extra_sources`` are formats that can only be read, ``extra_targets``
    formats that can only be written.
    """
    readable = set(formats) | set(extra_sources)
    writable = set(formats) | set(extra_targets)
    return build_conversion_pairs(readable, writable)


def normalise_format(extension: str) -> str:
    """Turn any user-supplied extension into the registry's canonical form."""
    cleaned = extension.strip().lower().lstrip(".")
    return CANONICAL_FORMAT_ALIASES.get(cleaned, cleaned)


CANONICAL_FORMAT_ALIASES = {
    "jpeg": "jpg",
    "tif": "tiff",
    "yml": "yaml",
    "midi": "mid",
    "heif": "heic",
    "m2ts": "mts",
    "stp": "step",
    "tgz": "tar.gz",
}
"""Extensions that mean the same thing, collapsed onto one canonical name."""
