"""Launcher for the Ultimate Converter desktop application.

This is the file PyInstaller freezes into the standalone executable. It is also
a perfectly good way to start the application from source:

    python run_ultimate_converter.py

which is equivalent to ``python -m app.main``.
"""

from __future__ import annotations

import multiprocessing
import sys

from app.main import run_application
from app.self_check import build_self_check_report

SELF_TEST_FLAG = "--self-test"


def show_self_check() -> int:
    """Print the self check, falling back to a window when there is no console.

    A windowed Windows build has no console attached, so printing would silently
    go nowhere; the report is shown in a scrollable window instead.
    """
    report, exit_code = build_self_check_report()
    try:
        print(report)
    except (OSError, AttributeError):
        _show_report_window(report)
    return exit_code


def _show_report_window(report: str) -> None:
    """Display the report in a plain, scrollable, read-only window."""
    import tkinter as tk
    from tkinter import scrolledtext

    window = tk.Tk()
    window.title("Ultimate Converter - self check")
    window.geometry("760x560")
    text = scrolledtext.ScrolledText(window, font=("Courier New", 10), wrap="none")
    text.insert("1.0", report)
    text.configure(state="disabled")
    text.pack(fill="both", expand=True)
    window.mainloop()


if __name__ == "__main__":
    # Required so a frozen Windows build does not re-launch itself in a loop
    # if any part of the program ever spawns a process.
    multiprocessing.freeze_support()
    if SELF_TEST_FLAG in sys.argv:
        sys.exit(show_self_check())
    run_application()
