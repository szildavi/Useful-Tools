"""Audio and video conversion through FFmpeg."""

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
from ..core.external_tool import FFMPEG, FFPROBE, ExternalTool, is_tool_available, require_tool
from ..core.format_families import (
    ANIMATION_FORMATS,
    AUDIO_FORMATS,
    AUDIO_ONLY_SOURCE_FORMATS,
    VIDEO_FORMATS,
    VIDEO_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_conversion_pairs,
    build_round_trip_pairs,
)


class MediaConverter(Converter):
    """Handles every audio/video pair, in both directions, via FFmpeg."""

    @property
    def display_name(self) -> str:
        return "FFmpeg (audio & video)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (FFMPEG,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        audio_pairs = build_round_trip_pairs(
            AUDIO_FORMATS, extra_sources=AUDIO_ONLY_SOURCE_FORMATS
        )
        video_pairs = build_round_trip_pairs(
            VIDEO_FORMATS | ANIMATION_FORMATS, extra_sources=VIDEO_ONLY_SOURCE_FORMATS
        )
        audio_extraction_pairs = build_conversion_pairs(
            VIDEO_FORMATS | VIDEO_ONLY_SOURCE_FORMATS, AUDIO_FORMATS
        )
        return audio_pairs | video_pairs | audio_extraction_pairs

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        if target_format in AUDIO_FORMATS:
            return AUDIO_OPTIONS
        if target_format == "gif":
            return ANIMATED_GIF_OPTIONS
        return VIDEO_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        if job.target_format in AUDIO_FORMATS:
            _require_audio_stream(job.source_path)
        command = [require_tool(FFMPEG), "-hide_banner", "-loglevel", "error", "-y"]
        command += ["-i", str(job.source_path)]
        command += self._build_stream_arguments(job.target_format, job.options)
        command.append(str(output_path))
        run_command(command)

    @staticmethod
    def _build_stream_arguments(target_format: str, options: dict) -> List[str]:
        """Pick the argument set that matches the requested output kind."""
        if target_format in AUDIO_FORMATS:
            return _build_audio_arguments(options)
        if target_format == "gif":
            return _build_animated_gif_arguments(options)
        return _build_video_arguments(options)


AUDIO_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "audio_bitrate",
        "Audio bitrate",
        (
            ("Same as source", AUTOMATIC),
            ("320 kbps (best)", "320k"),
            ("256 kbps", "256k"),
            ("192 kbps (high)", "192k"),
            ("128 kbps (standard)", "128k"),
            ("96 kbps", "96k"),
            ("64 kbps (voice)", "64k"),
        ),
        help_text="Ignored by lossless targets such as WAV and FLAC.",
    ),
    choice_option(
        "sample_rate",
        "Sample rate",
        (
            ("Same as source", AUTOMATIC),
            ("48000 Hz", "48000"),
            ("44100 Hz (CD)", "44100"),
            ("22050 Hz", "22050"),
            ("16000 Hz (voice)", "16000"),
        ),
    ),
    choice_option(
        "channels",
        "Channels",
        (
            ("Same as source", AUTOMATIC),
            ("Stereo", "2"),
            ("Mono", "1"),
        ),
    ),
)

VIDEO_OPTIONS: Sequence[ConversionOption] = (
    choice_option(
        "video_codec",
        "Video codec",
        (
            ("Automatic (best for format)", AUTOMATIC),
            ("H.264 (widest support)", "libx264"),
            ("H.265 / HEVC (smaller)", "libx265"),
            ("VP9 (web)", "libvpx-vp9"),
            ("AV1 (newest)", "libsvtav1"),
            ("Copy without re-encoding", "copy"),
        ),
        help_text="'Copy' is instant but only works when the codec fits the container.",
    ),
    choice_option(
        "quality",
        "Quality",
        (
            ("Balanced (CRF 23)", "23"),
            ("Visually lossless (CRF 18)", "18"),
            ("High (CRF 20)", "20"),
            ("Smaller file (CRF 28)", "28"),
            ("Smallest file (CRF 32)", "32"),
        ),
        help_text="Lower numbers mean better quality and larger files.",
    ),
    choice_option(
        "resolution",
        "Resolution",
        (
            ("Same as source", AUTOMATIC),
            ("2160p (4K)", "3840:-2"),
            ("1440p", "2560:-2"),
            ("1080p", "1920:-2"),
            ("720p", "1280:-2"),
            ("480p", "854:-2"),
            ("360p", "640:-2"),
        ),
    ),
    choice_option(
        "frame_rate",
        "Frame rate",
        (
            ("Same as source", AUTOMATIC),
            ("60 fps", "60"),
            ("30 fps", "30"),
            ("24 fps (cinema)", "24"),
            ("15 fps", "15"),
        ),
    ),
    choice_option(
        "encoding_speed",
        "Encoding speed",
        (
            ("Medium", "medium"),
            ("Very fast", "veryfast"),
            ("Fast", "fast"),
            ("Slow (smaller file)", "slow"),
            ("Very slow (smallest)", "veryslow"),
        ),
    ),
    choice_option(
        "audio_bitrate",
        "Audio bitrate",
        (
            ("192 kbps", "192k"),
            ("Same as source", AUTOMATIC),
            ("320 kbps", "320k"),
            ("128 kbps", "128k"),
            ("Remove audio", "none"),
        ),
    ),
)

ANIMATED_GIF_OPTIONS: Sequence[ConversionOption] = (
    integer_option("frame_rate", "Frame rate", default=15, minimum=1, maximum=50),
    integer_option(
        "gif_width",
        "Width in pixels",
        default=480,
        minimum=32,
        maximum=1920,
        help_text="Height follows automatically to keep the aspect ratio.",
    ),
    toggle_option(
        "optimise_palette",
        "Optimise colour palette",
        default=True,
        help_text="Two-pass palette generation; better colours, slightly slower.",
    ),
)


def _require_audio_stream(source_path: Path) -> None:
    """Fail with a readable message when a silent video is asked for its audio."""
    if not is_tool_available(FFPROBE):
        return
    streams = run_command(
        [
            require_tool(FFPROBE),
            "-loglevel", "error",
            "-select_streams", "a",
            "-show_entries", "stream=index",
            "-of", "csv=p=0",
            str(source_path),
        ]
    )
    if not streams.strip():
        raise RuntimeError(f"{source_path.name} has no audio track to extract.")


def _build_audio_arguments(options: dict) -> List[str]:
    """Translate audio options into FFmpeg flags."""
    arguments = ["-vn"]
    arguments += _optional_flag("-b:a", options.get("audio_bitrate"))
    arguments += _optional_flag("-ar", options.get("sample_rate"))
    arguments += _optional_flag("-ac", options.get("channels"))
    return arguments


def _build_video_arguments(options: dict) -> List[str]:
    """Translate video options into FFmpeg flags."""
    arguments: List[str] = []
    codec = options.get("video_codec")
    if not is_automatic(codec) and codec:
        arguments += ["-c:v", codec]
    if codec != "copy":
        arguments += ["-crf", str(options.get("quality", "23"))]
        arguments += _optional_flag("-preset", options.get("encoding_speed"))
        arguments += _scale_filter(options.get("resolution"))
        arguments += _optional_flag("-r", options.get("frame_rate"))
    arguments += _audio_track_arguments(options.get("audio_bitrate"))
    return arguments


def _build_animated_gif_arguments(options: dict) -> List[str]:
    """Build the filter chain that turns video into a looping GIF."""
    frame_rate = options.get("frame_rate", 15)
    width = options.get("gif_width", 480)
    scale = f"fps={frame_rate},scale={width}:-1:flags=lanczos"
    if options.get("optimise_palette", True):
        filter_chain = f"{scale},split[a][b];[a]palettegen[p];[b][p]paletteuse"
        return ["-filter_complex", filter_chain, "-loop", "0"]
    return ["-vf", scale, "-loop", "0"]


def _audio_track_arguments(audio_bitrate: str | None) -> List[str]:
    """Return the flags controlling the audio track of a video output."""
    if audio_bitrate == "none":
        return ["-an"]
    return _optional_flag("-b:a", audio_bitrate)


def _scale_filter(resolution: str | None) -> List[str]:
    """Return a scale filter, or nothing when the source size is kept."""
    if is_automatic(resolution) or not resolution:
        return []
    return ["-vf", f"scale={resolution}"]


def _optional_flag(flag: str, value: str | None) -> List[str]:
    """Return ``[flag, value]`` unless the value asks to keep the source setting."""
    if is_automatic(value) or value in (None, "", "none"):
        return []
    return [flag, str(value)]
