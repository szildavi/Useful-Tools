"""Reading of the technical details of a video file with ffprobe."""

from __future__ import annotations

import json
import re
import subprocess
import threading
from dataclasses import dataclass
from pathlib import Path

PROBE_TIMEOUT_SECONDS = 30
DEFAULT_BIT_DEPTH = 8
DEEP_PIXEL_FORMAT_PATTERN = re.compile(r"(\d+)(?:le|be)$")


@dataclass(frozen=True)
class MediaInfo:
    """The details of a source video that the converter needs."""

    duration_seconds: float
    video_codec: str
    audio_codec: str
    pixel_format: str
    bit_depth: int

    @property
    def has_known_duration(self) -> bool:
        """Tell whether the duration can be used for progress calculation."""
        return self.duration_seconds > 0

    @property
    def is_eight_bit(self) -> bool:
        """Tell whether the video stores only 8 bits for every colour channel."""
        return self.bit_depth == DEFAULT_BIT_DEPTH

    @property
    def has_full_chroma(self) -> bool:
        """Tell whether the video stores the colour without subsampling."""
        return "444" in self.pixel_format

    def describe_video_format(self) -> str:
        """Return a short text about the picture format of the source file."""
        if not self.pixel_format:
            return "unknown format"
        return f"{self.pixel_format}, {self.bit_depth}-bit"

    def describe_codecs(self) -> str:
        """Return a short text about the codecs of the source file."""
        audio_description = self.audio_codec or "no audio"
        return f"{self.video_codec or 'unknown video'} / {audio_description}"


UNKNOWN_MEDIA_INFO = MediaInfo(
    duration_seconds=0.0,
    video_codec="",
    audio_codec="",
    pixel_format="",
    bit_depth=0,
)


class MediaInspector:
    """Asks ffprobe about the details of a video file and remembers the answer.

    The answers are kept, because the same file is looked at both when the
    profile is checked and when the conversion starts, and several conversion
    threads may ask at the same time.
    """

    def __init__(self, ffprobe_path: str) -> None:
        self._ffprobe_path = ffprobe_path
        self._lock = threading.Lock()
        self._known_files: dict[str, MediaInfo] = {}

    def inspect(self, video_path: Path) -> MediaInfo:
        """Return the details of a video file, or unknown details on failure."""
        cache_key = str(video_path)
        with self._lock:
            remembered_info = self._known_files.get(cache_key)
        if remembered_info is not None:
            return remembered_info

        media_info = self._read_media_info(video_path)
        with self._lock:
            self._known_files[cache_key] = media_info
        return media_info

    def _read_media_info(self, video_path: Path) -> MediaInfo:
        """Return the details ffprobe reports about a video file."""
        probe_report = self._run_ffprobe(video_path)
        if probe_report is None:
            return UNKNOWN_MEDIA_INFO
        video_stream = self._find_stream(probe_report, "video")
        return MediaInfo(
            duration_seconds=self._read_duration(probe_report),
            video_codec=str(video_stream.get("codec_name", "")),
            audio_codec=str(self._find_stream(probe_report, "audio").get("codec_name", "")),
            pixel_format=str(video_stream.get("pix_fmt", "")),
            bit_depth=self._read_bit_depth(video_stream),
        )

    def _run_ffprobe(self, video_path: Path) -> dict | None:
        """Return the parsed ffprobe report of a file, or None when it fails."""
        command = [
            self._ffprobe_path,
            "-hide_banner",
            "-loglevel",
            "error",
            "-show_format",
            "-show_streams",
            "-of",
            "json",
            str(video_path),
        ]
        try:
            completed_process = subprocess.run(
                command,
                capture_output=True,
                text=True,
                timeout=PROBE_TIMEOUT_SECONDS,
                check=False,
            )
        except (OSError, subprocess.TimeoutExpired):
            return None
        if completed_process.returncode != 0:
            return None
        try:
            return json.loads(completed_process.stdout)
        except json.JSONDecodeError:
            return None

    def _find_stream(self, probe_report: dict, stream_type: str) -> dict:
        """Return the first stream of the given type, or an empty description."""
        for stream in probe_report.get("streams", []):
            if stream.get("codec_type") == stream_type:
                return stream
        return {}

    def _read_duration(self, probe_report: dict) -> float:
        """Return the duration in seconds found in an ffprobe report."""
        raw_duration = probe_report.get("format", {}).get("duration")
        try:
            return max(float(raw_duration), 0.0)
        except (TypeError, ValueError):
            return 0.0

    def _read_bit_depth(self, video_stream: dict) -> int:
        """Return how many bits one colour channel of the video uses."""
        try:
            return int(video_stream["bits_per_raw_sample"])
        except (KeyError, TypeError, ValueError):
            return self._guess_bit_depth(str(video_stream.get("pix_fmt", "")))

    def _guess_bit_depth(self, pixel_format: str) -> int:
        """Return the bit depth that belongs to a pixel format name."""
        if not pixel_format:
            return 0
        deep_format_match = DEEP_PIXEL_FORMAT_PATTERN.search(pixel_format)
        if deep_format_match:
            return int(deep_format_match.group(1))
        return DEFAULT_BIT_DEPTH
