"""A single place where external commands are executed."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path
from typing import Sequence


class CommandFailedError(RuntimeError):
    """Raised when an external command exits with a non-zero status."""

    def __init__(self, command: Sequence[str], exit_code: int, output: str) -> None:
        super().__init__(
            f"{Path(command[0]).name} exited with code {exit_code}: {_last_meaningful_line(output)}"
        )
        self.command = list(command)
        self.exit_code = exit_code
        self.output = output


def run_command(
    command: Sequence[str],
    timeout_seconds: int = 1800,
    working_directory: Path | None = None,
) -> str:
    """Run ``command`` and return its combined output, raising on failure."""
    completed = subprocess.run(
        list(command),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        timeout=timeout_seconds,
        cwd=str(working_directory) if working_directory else None,
        creationflags=_console_suppression_flags(),
    )
    output = completed.stdout.decode("utf-8", errors="replace")
    if completed.returncode != 0:
        raise CommandFailedError(command, completed.returncode, output)
    return output


def _console_suppression_flags() -> int:
    """Keep Windows from flashing a console window for every conversion."""
    if sys.platform == "win32":
        return subprocess.CREATE_NO_WINDOW
    return 0


def _last_meaningful_line(output: str) -> str:
    """Pick the most useful line of tool output for an error message."""
    lines = [line.strip() for line in output.splitlines() if line.strip()]
    return lines[-1] if lines else "no output"
