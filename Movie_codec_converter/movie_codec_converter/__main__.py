"""The entry point of the converter: python3 -m movie_codec_converter"""

from __future__ import annotations

import sys

from .application_launcher import ApplicationLauncher


def main() -> int:
    """Start the converter and return the exit code of the program."""
    return ApplicationLauncher().launch()


if __name__ == "__main__":
    sys.exit(main())
