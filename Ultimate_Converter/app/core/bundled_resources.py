"""Locates files that ship alongside the code, from source or from a binary.

A frozen PyInstaller build unpacks its data files into a temporary directory and
records the path in ``sys._MEIPASS``. Everything that needs a bundled file asks
here rather than deriving paths from ``__file__``, which does not survive
freezing.
"""

from __future__ import annotations

import sys
from pathlib import Path


def is_running_as_binary() -> bool:
    """Report whether the application is running from a frozen executable."""
    return getattr(sys, "frozen", False)


def resource_directory() -> Path:
    """Return the directory bundled resources are read from."""
    if is_running_as_binary():
        return Path(getattr(sys, "_MEIPASS"))
    return Path(__file__).resolve().parent.parent


def resource_path(*parts: str) -> Path:
    """Return the path of one bundled resource, such as an icon."""
    return resource_directory().joinpath(*parts)
