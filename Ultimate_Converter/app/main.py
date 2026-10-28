"""Entry point of the Ultimate Converter desktop application.

Run it from the project root with:  python -m app.main
"""

from __future__ import annotations

from .converters.converter_catalogue import build_conversion_registry
from .ui.main_window import MainWindow


def run_application() -> None:
    """Build the registry and open the main window."""
    MainWindow(build_conversion_registry()).mainloop()


if __name__ == "__main__":
    run_application()
