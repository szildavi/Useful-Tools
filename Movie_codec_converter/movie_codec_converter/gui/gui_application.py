"""Starting of the graphical interface."""

from __future__ import annotations

import tkinter as tk

from .application_window import ApplicationWindow


class GuiUnavailableError(RuntimeError):
    """Raised when no graphical interface can be opened on this system."""


class GuiApplication:
    """Opens the main window and keeps it running until the user closes it."""

    def run(self) -> None:
        """Show the window of the converter."""
        try:
            window = ApplicationWindow()
        except tk.TclError as error:
            raise GuiUnavailableError(f"The graphical interface cannot be opened: {error}") from error
        window.mainloop()
