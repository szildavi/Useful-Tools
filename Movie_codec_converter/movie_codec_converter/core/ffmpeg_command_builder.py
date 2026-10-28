"""Assembly of the ffmpeg command lines that perform one conversion."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from .conversion_settings import ConversionSettings
from .media_kind import MediaKind

PROGRESS_OUTPUT_TARGET = "pipe:1"


class FfmpegCommandBuilder(ABC):
    """Builds the ffmpeg call of one conversion.

    The parts that every conversion needs are written here, the kind of the
    source only decides how the streams are encoded.
    """

    def __init__(self, ffmpeg_path: str) -> None:
        self._ffmpeg_path = ffmpeg_path

    def build(self, source_path: Path, destination_path: Path, settings: ConversionSettings) -> list[str]:
        """Return the full ffmpeg command of a single conversion."""
        return [
            self._ffmpeg_path,
            *self._general_arguments(),
            *self._input_arguments(source_path, settings),
            *self._encoding_arguments(settings),
            *self._progress_arguments(),
            str(destination_path),
        ]

    def describe(self, source_path: Path, destination_path: Path, settings: ConversionSettings) -> str:
        """Return the command as a single readable line, useful for logging."""
        return " ".join(self.build(source_path, destination_path, settings))

    @abstractmethod
    def _encoding_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the arguments that describe what is written into the output."""

    def _general_arguments(self) -> list[str]:
        """Return the arguments that keep ffmpeg quiet and non interactive."""
        return ["-hide_banner", "-nostdin", "-loglevel", "error", "-y"]

    def _input_arguments(self, source_path: Path, settings: ConversionSettings) -> list[str]:
        """Return the arguments that select the source file."""
        return ["-i", str(source_path)]

    def _progress_arguments(self) -> list[str]:
        """Return the arguments that make ffmpeg report machine readable progress."""
        return ["-nostats", "-progress", PROGRESS_OUTPUT_TARGET]


class VideoCommandBuilder(FfmpegCommandBuilder):
    """Builds the call that converts a video into a DNxHR MOV file."""

    def _input_arguments(self, source_path: Path, settings: ConversionSettings) -> list[str]:
        """Return the source file with the thread limit of the decoding."""
        return [*self._thread_arguments(settings), "-i", str(source_path)]

    def _encoding_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the arguments of the DNxHR video and of its audio track."""
        return [
            *self._stream_mapping_arguments(),
            *self._thread_arguments(settings),
            *self._video_arguments(settings),
            *self._audio_arguments(settings),
        ]

    def _stream_mapping_arguments(self) -> list[str]:
        """Return the arguments that keep the video and every audio track."""
        return ["-map", "0:v:0", "-map", "0:a?"]

    def _thread_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the thread limit that leaves room for the other parallel jobs.

        It is used twice: before the input it limits the decoding, before the
        output it limits the DNxHR encoding.
        """
        return ["-threads", str(settings.ffmpeg_thread_count)]

    def _video_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the arguments that describe the DNxHR video encoding."""
        return [
            "-c:v",
            "dnxhd",
            "-profile:v",
            settings.profile.ffmpeg_profile,
            "-pix_fmt",
            settings.profile.pixel_format,
            "-fps_mode",
            "cfr",
        ]

    def _audio_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the arguments that describe the audio handling."""
        return ["-c:a", settings.audio_option.ffmpeg_codec]


class AudioCommandBuilder(FfmpegCommandBuilder):
    """Builds the call that converts an audio file into a WAV file."""

    def _encoding_arguments(self, settings: ConversionSettings) -> list[str]:
        """Return the arguments of the uncompressed audio, without any picture."""
        return [
            "-map",
            "0:a:0",
            "-vn",
            "-c:a",
            settings.audio_option.codec_for_an_audio_file,
        ]


class CommandBuilderSelector:
    """Gives the command builder that belongs to a kind of source file."""

    def __init__(self, ffmpeg_path: str) -> None:
        self._builders: dict[MediaKind, FfmpegCommandBuilder] = {
            MediaKind.VIDEO: VideoCommandBuilder(ffmpeg_path),
            MediaKind.AUDIO: AudioCommandBuilder(ffmpeg_path),
        }

    def builder_for(self, media_kind: MediaKind) -> FfmpegCommandBuilder:
        """Return the builder that knows how to convert the given kind."""
        return self._builders[media_kind]
