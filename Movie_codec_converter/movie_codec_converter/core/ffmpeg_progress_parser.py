"""Reading of the progress lines that ffmpeg writes during an encoding."""

from __future__ import annotations

MICROSECONDS_IN_A_SECOND = 1_000_000
FULLY_COMPLETED_RATIO = 1.0


class FfmpegProgressParser:
    """Turns the key=value progress lines of ffmpeg into a completion ratio."""

    def __init__(self, total_duration_seconds: float) -> None:
        self._total_duration_seconds = total_duration_seconds
        self._completion_ratio = 0.0

    @property
    def completion_ratio(self) -> float:
        """Return the last known completion ratio between 0.0 and 1.0."""
        return self._completion_ratio

    def read_line(self, line: str) -> float | None:
        """Update the ratio from one ffmpeg progress line and return it when it changed."""
        encoded_seconds = self._read_encoded_seconds(line)
        if encoded_seconds is None:
            return None
        updated_ratio = self._calculate_ratio(encoded_seconds)
        if updated_ratio <= self._completion_ratio:
            return None
        self._completion_ratio = updated_ratio
        return self._completion_ratio

    def mark_as_finished(self) -> float:
        """Set the progress to complete, used when ffmpeg reported the end."""
        self._completion_ratio = FULLY_COMPLETED_RATIO
        return self._completion_ratio

    def _read_encoded_seconds(self, line: str) -> float | None:
        """Return the already encoded seconds reported by one progress line."""
        key, separator, value = line.strip().partition("=")
        if not separator:
            return None
        if key == "out_time_us" or key == "out_time_ms":
            return self._parse_microseconds(value)
        if key == "out_time":
            return self._parse_timestamp(value)
        return None

    def _parse_microseconds(self, value: str) -> float | None:
        """Return seconds from a microsecond value reported by ffmpeg."""
        try:
            return int(value) / MICROSECONDS_IN_A_SECOND
        except ValueError:
            return None

    def _parse_timestamp(self, value: str) -> float | None:
        """Return seconds from a HH:MM:SS.mmm timestamp reported by ffmpeg."""
        parts = value.split(":")
        if len(parts) != 3:
            return None
        try:
            hours, minutes, seconds = float(parts[0]), float(parts[1]), float(parts[2])
        except ValueError:
            return None
        return hours * 3600 + minutes * 60 + seconds

    def _calculate_ratio(self, encoded_seconds: float) -> float:
        """Return the completion ratio that belongs to the encoded seconds."""
        if self._total_duration_seconds <= 0:
            return 0.0
        return min(encoded_seconds / self._total_duration_seconds, FULLY_COMPLETED_RATIO)
