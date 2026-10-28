"""Reading of the command line arguments of the converter."""

from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

from .. import APPLICATION_NAME, APPLICATION_VERSION
from ..core.conversion_settings import (
    DEFAULT_AUDIO_OPTION,
    DEFAULT_PROFILE,
    AudioOption,
    ConversionSettings,
    DnxhrProfile,
)
from ..core.cpu_capacity import CpuCapacity

USAGE_EXAMPLES = """examples:
  %(prog)s holiday.mp4 -o ~/Videos/DNxHR
  %(prog)s ~/Videos/raw -r -o ~/Videos/DNxHR --profile hqx
  %(prog)s clip1.mp4 clip2.mkv -o ./edit_ready --audio copy --overwrite
  %(prog)s ~/Videos/raw -r -o ~/Videos/DNxHR --jobs 4
  %(prog)s ~/Videos/raw -r --audio-files -o ~/Videos/DNxHR
  %(prog)s song.mp3 -o ~/Music/edit_ready
  %(prog)s --gui
"""


@dataclass(frozen=True)
class CommandLineRequest:
    """Everything the command line interface was asked to do."""

    input_paths: list[Path]
    settings: ConversionSettings
    start_gui: bool
    list_only: bool


class ArgumentParser:
    """Describes and reads the arguments accepted by the converter."""

    def parse(self, arguments: list[str] | None = None) -> CommandLineRequest:
        """Return the request that belongs to the given command line arguments."""
        parsed_arguments = self._build_parser().parse_args(arguments)
        return CommandLineRequest(
            input_paths=[Path(path).expanduser() for path in parsed_arguments.inputs],
            settings=self._build_settings(parsed_arguments),
            start_gui=parsed_arguments.gui,
            list_only=parsed_arguments.list_only,
        )

    def _build_parser(self) -> argparse.ArgumentParser:
        """Return the argparse parser with every supported option."""
        parser = argparse.ArgumentParser(
            prog="movie-codec-converter",
            description=f"{APPLICATION_NAME} - convert H.264/H.265/AAC videos into DNxHR MOV files.",
            epilog=USAGE_EXAMPLES,
            formatter_class=argparse.RawDescriptionHelpFormatter,
        )
        self._add_input_arguments(parser)
        self._add_output_arguments(parser)
        self._add_quality_arguments(parser)
        self._add_speed_arguments(parser)
        self._add_mode_arguments(parser)
        return parser

    def _add_input_arguments(self, parser: argparse.ArgumentParser) -> None:
        """Add the arguments that select the source videos."""
        parser.add_argument(
            "inputs",
            nargs="*",
            help="video files and/or folders that have to be converted",
        )
        parser.add_argument(
            "-r",
            "--recursive",
            action="store_true",
            help="also look for videos inside the subfolders of the given folders",
        )
        parser.add_argument(
            "--audio-files",
            action="store_true",
            help=(
                "also convert the audio files (mp3, aac, flac, ...) of the given folders "
                "into WAV; audio files named one by one are always converted"
            ),
        )

    def _add_output_arguments(self, parser: argparse.ArgumentParser) -> None:
        """Add the arguments that describe where the results are written."""
        parser.add_argument(
            "-o",
            "--output",
            default=None,
            help="folder the MOV files are written into, it is created when missing",
        )
        parser.add_argument(
            "--overwrite",
            action="store_true",
            help="convert again even when the output file already exists",
        )

    def _add_speed_arguments(self, parser: argparse.ArgumentParser) -> None:
        """Add the argument that tells how many files may convert at once."""
        cpu_capacity = CpuCapacity()
        recommended_job_count = cpu_capacity.recommended_parallel_job_count()
        parser.add_argument(
            "-j",
            "--jobs",
            type=self._read_positive_number,
            default=recommended_job_count,
            metavar="COUNT",
            help=(
                "how many files are converted at the same time "
                f"(default: {recommended_job_count} on this machine, "
                f"which has {cpu_capacity.available_core_count()} cores)"
            ),
        )

    def _read_positive_number(self, raw_value: str) -> int:
        """Return a whole number that is at least one, or refuse the argument."""
        try:
            number = int(raw_value)
        except ValueError:
            raise argparse.ArgumentTypeError(f"'{raw_value}' is not a whole number.") from None
        if number < 1:
            raise argparse.ArgumentTypeError("at least 1 file has to be converted at a time.")
        return number

    def _add_quality_arguments(self, parser: argparse.ArgumentParser) -> None:
        """Add the arguments that describe the wanted quality."""
        parser.add_argument(
            "-p",
            "--profile",
            choices=DnxhrProfile.option_names(),
            default=DEFAULT_PROFILE.option_name,
            help=f"DNxHR profile (default: {DEFAULT_PROFILE.option_name})",
        )
        parser.add_argument(
            "-a",
            "--audio",
            choices=AudioOption.option_names(),
            default=DEFAULT_AUDIO_OPTION.option_name,
            help=f"audio handling (default: {DEFAULT_AUDIO_OPTION.option_name})",
        )

    def _add_mode_arguments(self, parser: argparse.ArgumentParser) -> None:
        """Add the arguments that choose how the program has to run."""
        parser.add_argument(
            "-g",
            "--gui",
            action="store_true",
            help="open the graphical interface instead of converting in the terminal",
        )
        parser.add_argument(
            "-l",
            "--list",
            dest="list_only",
            action="store_true",
            help="only list what would be converted, without converting anything",
        )
        parser.add_argument(
            "-v",
            "--version",
            action="version",
            version=f"{APPLICATION_NAME} {APPLICATION_VERSION}",
        )

    def _build_settings(self, parsed_arguments: argparse.Namespace) -> ConversionSettings:
        """Return the conversion settings described by the arguments."""
        return ConversionSettings(
            output_directory=self._read_output_directory(parsed_arguments.output),
            profile=DnxhrProfile.from_option_name(parsed_arguments.profile),
            audio_option=AudioOption.from_option_name(parsed_arguments.audio),
            overwrite_existing=parsed_arguments.overwrite,
            search_subfolders=parsed_arguments.recursive,
            convert_audio_files=parsed_arguments.audio_files,
            parallel_job_count=parsed_arguments.jobs,
        )

    def _read_output_directory(self, raw_output: str | None) -> Path:
        """Return the chosen output folder, or the current folder when it is missing."""
        if raw_output is None:
            return Path.cwd()
        return Path(raw_output).expanduser()
