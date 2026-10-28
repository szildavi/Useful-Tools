"""User selectable options that describe how a conversion has to be performed."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path

from .cpu_capacity import CpuCapacity


class DnxhrProfile(Enum):
    """A DNxHR quality profile together with the pixel format it requires."""

    LB = ("lb", "dnxhr_lb", "yuv422p", "Low Bandwidth (offline editing)")
    SQ = ("sq", "dnxhr_sq", "yuv422p", "Standard Quality")
    HQ = ("hq", "dnxhr_hq", "yuv422p", "High Quality 8-bit")
    HQX = ("hqx", "dnxhr_hqx", "yuv422p10le", "High Quality 10-bit")
    RGB444 = ("444", "dnxhr_444", "yuv444p10le", "Finishing quality 10-bit 4:4:4")

    def __init__(self, option_name: str, ffmpeg_profile: str, pixel_format: str, description: str) -> None:
        self.option_name = option_name
        self.ffmpeg_profile = ffmpeg_profile
        self.pixel_format = pixel_format
        self.description = description

    @property
    def display_name(self) -> str:
        """Return the text shown to the user in the interfaces."""
        return f"{self.option_name} - {self.description}"

    @property
    def is_ten_bit(self) -> bool:
        """Tell whether the profile stores 10 bits for every colour channel."""
        return "10le" in self.pixel_format

    @property
    def keeps_full_chroma(self) -> bool:
        """Tell whether the profile stores the colour without subsampling."""
        return "444" in self.pixel_format

    @classmethod
    def option_names(cls) -> list[str]:
        """Return every profile name that a user is allowed to choose."""
        return [profile.option_name for profile in cls]

    @classmethod
    def from_option_name(cls, option_name: str) -> "DnxhrProfile":
        """Return the profile belonging to a user supplied profile name."""
        for profile in cls:
            if profile.option_name == option_name:
                return profile
        raise ValueError(f"Unknown DNxHR profile: {option_name}")

    @classmethod
    def from_display_name(cls, display_name: str) -> "DnxhrProfile":
        """Return the profile belonging to a text shown in the interfaces."""
        for profile in cls:
            if profile.display_name == display_name:
                return profile
        raise ValueError(f"Unknown DNxHR profile: {display_name}")


class AudioOption(Enum):
    """An audio handling choice for the resulting MOV file."""

    PCM_16_BIT = ("pcm16", "pcm_s16le", "Uncompressed PCM 16-bit")
    PCM_24_BIT = ("pcm24", "pcm_s24le", "Uncompressed PCM 24-bit")
    KEEP_ORIGINAL = ("copy", "copy", "Keep the original audio track")

    def __init__(self, option_name: str, ffmpeg_codec: str, description: str) -> None:
        self.option_name = option_name
        self.ffmpeg_codec = ffmpeg_codec
        self.description = description

    @property
    def display_name(self) -> str:
        """Return the text shown to the user in the interfaces."""
        return f"{self.option_name} - {self.description}"

    @property
    def codec_for_an_audio_file(self) -> str:
        """Return the codec of a converted audio file.

        A WAV file cannot hold a compressed track, so keeping the original codec
        is not possible there: those files become 16-bit PCM.
        """
        if self is AudioOption.KEEP_ORIGINAL:
            return AudioOption.PCM_16_BIT.ffmpeg_codec
        return self.ffmpeg_codec

    @classmethod
    def option_names(cls) -> list[str]:
        """Return every audio option name that a user is allowed to choose."""
        return [option.option_name for option in cls]

    @classmethod
    def from_option_name(cls, option_name: str) -> "AudioOption":
        """Return the audio option belonging to a user supplied name."""
        for option in cls:
            if option.option_name == option_name:
                return option
        raise ValueError(f"Unknown audio option: {option_name}")

    @classmethod
    def from_display_name(cls, display_name: str) -> "AudioOption":
        """Return the audio option belonging to a text shown in the interfaces."""
        for option in cls:
            if option.display_name == display_name:
                return option
        raise ValueError(f"Unknown audio option: {display_name}")


DEFAULT_PROFILE = DnxhrProfile.HQ
DEFAULT_AUDIO_OPTION = AudioOption.PCM_16_BIT


@dataclass(frozen=True)
class ConversionSettings:
    """Every option that is needed to convert a batch of video files."""

    output_directory: Path
    profile: DnxhrProfile = DEFAULT_PROFILE
    audio_option: AudioOption = DEFAULT_AUDIO_OPTION
    overwrite_existing: bool = False
    search_subfolders: bool = False
    convert_audio_files: bool = False
    parallel_job_count: int = field(default_factory=lambda: CpuCapacity().recommended_parallel_job_count())

    @property
    def ffmpeg_thread_count(self) -> int:
        """Return how many threads one ffmpeg may use next to the other jobs."""
        return CpuCapacity().threads_for_each_job(self.parallel_job_count)
