"""Builds the Ultimate Converter desktop application into one executable file.

Run it from the project root:

    python build_binary.py

The result lands in ``dist/`` - a single file you can run or hand to someone
else. PyInstaller cannot cross-compile, so run this on Linux to get a Linux
binary and on Windows to get a ``.exe``.

The conversion tools (FFmpeg, ImageMagick, LibreOffice and the rest) are *not*
bundled. The application finds them on the system at startup and greys out
whatever is missing, which is what keeps the binary small and avoids taking on
FFmpeg's redistribution obligations.
"""

from __future__ import annotations

import importlib.util
import shutil
import subprocess
import sys
from pathlib import Path

APPLICATION_NAME = "UltimateConverter"
ENTRY_POINT = "run_ultimate_converter.py"
PROJECT_ROOT = Path(__file__).resolve().parent
ICON_PNG = PROJECT_ROOT / "app" / "ui" / "assets" / "icon.png"
ICON_ICO = PROJECT_ROOT / "app" / "ui" / "assets" / "icon.ico"
BUILD_DIRECTORIES = ("build", "dist")

HIDDEN_IMPORTS = ("yaml",)
"""Packages imported lazily, which PyInstaller cannot discover by itself."""

EXCLUDED_PACKAGES = (
    "numpy",
    "pandas",
    "matplotlib",
    "PIL",
    "pytest",
    "setuptools",
    "pip",
)
"""Large packages that may sit in the environment but are never imported."""


def main() -> int:
    """Build the executable and report where it ended up."""
    if not _check_prerequisites():
        return 1
    _remove_previous_build()
    exit_code = _run_pyinstaller()
    if exit_code != 0:
        print("\nThe build failed. The PyInstaller output above explains why.")
        return exit_code
    _report_result()
    return 0


REQUIRED_PACKAGES = {
    "PyInstaller": "PyInstaller is missing. Install it with: pip install pyinstaller",
    "tkinter": (
        "Tkinter is missing. Install it with: "
        "sudo dnf install python3-tkinter  /  sudo apt install python3-tk"
    ),
}


def _check_prerequisites() -> bool:
    """Confirm everything the build needs is importable before starting."""
    problems = [
        message
        for package, message in REQUIRED_PACKAGES.items()
        if importlib.util.find_spec(package) is None
    ]
    for problem in problems:
        print(f"  {problem}")
    return not problems


def _remove_previous_build() -> None:
    """Delete the output of an earlier build so nothing stale survives."""
    for directory in BUILD_DIRECTORIES:
        shutil.rmtree(PROJECT_ROOT / directory, ignore_errors=True)


def _run_pyinstaller() -> int:
    """Run PyInstaller with the options this application needs."""
    command = [
        sys.executable,
        "-m",
        "PyInstaller",
        "--noconfirm",
        "--clean",
        "--onefile",
        "--windowed",
        f"--name={APPLICATION_NAME}",
        # Keep PyInstaller's generated spec inside the throwaway build folder
        # rather than beside the source.
        f"--specpath={PROJECT_ROOT / 'build'}",
        f"--add-data={_data_argument(ICON_PNG, 'ui/assets')}",
        *_icon_argument(),
        *[f"--hidden-import={name}" for name in HIDDEN_IMPORTS],
        *[f"--exclude-module={name}" for name in EXCLUDED_PACKAGES],
        ENTRY_POINT,
    ]
    print(f"Building {APPLICATION_NAME} for {sys.platform}…\n")
    return subprocess.run(command, cwd=PROJECT_ROOT).returncode


def _data_argument(source: Path, destination: str) -> str:
    """Format one --add-data value using this platform's path separator."""
    return f"{source}{os_path_separator()}{destination}"


def os_path_separator() -> str:
    """Return the separator PyInstaller expects inside --add-data."""
    return ";" if sys.platform == "win32" else ":"


def _icon_argument() -> tuple[str, ...]:
    """Return the --icon option on the platforms that can embed one.

    Linux executables carry no icon resource - the desktop environment takes it
    from the window instead, which the application sets for itself.
    """
    icons_by_platform = {"win32": ICON_ICO, "darwin": ICON_PNG}
    icon = icons_by_platform.get(sys.platform)
    return (f"--icon={icon}",) if icon and icon.exists() else ()


def _report_result() -> None:
    """Print where the executable is and how big it turned out."""
    executable = _built_executable_path()
    if not executable.exists():
        print("\nThe build reported success but no executable was found.")
        return
    megabytes = executable.stat().st_size / 1024 / 1024
    print(f"\nBuilt {executable.relative_to(PROJECT_ROOT)}  ({megabytes:.1f} MB)")
    print(f"Run it with:  {_run_instruction(executable)}")
    print(
        "\nThe conversion tools are not bundled. Open Tools… inside the "
        "application to see which are installed on this computer."
    )


def _built_executable_path() -> Path:
    """Return where PyInstaller puts the finished single file."""
    suffix = ".exe" if sys.platform == "win32" else ""
    return PROJECT_ROOT / "dist" / f"{APPLICATION_NAME}{suffix}"


def _run_instruction(executable: Path) -> str:
    """Return the command a user types to start the built application."""
    relative = executable.relative_to(PROJECT_ROOT)
    return str(relative) if sys.platform == "win32" else f"./{relative}"


if __name__ == "__main__":
    sys.exit(main())
