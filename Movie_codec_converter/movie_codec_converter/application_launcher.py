"""The decision between the graphical and the command line interface."""

from __future__ import annotations

import sys

from .cli.argument_parser import ArgumentParser, CommandLineRequest
from .cli.cli_application import EXIT_CODE_FAILURE, EXIT_CODE_SUCCESS, CliApplication

GUI_IMPORT_HINT = (
    "The graphical interface needs the Tk bindings of Python.\n"
    "  Fedora : sudo dnf install python3-tkinter\n"
    "  Debian : sudo apt install python3-tk\n"
    "  Arch   : sudo pacman -S tk\n"
    "Until then the converter can be used from the terminal, see --help."
)


class ApplicationLauncher:
    """Starts the interface that fits the given command line arguments."""

    def launch(self, arguments: list[str] | None = None) -> int:
        """Start the converter and return the exit code of the program."""
        given_arguments = list(sys.argv[1:] if arguments is None else arguments)
        request = ArgumentParser().parse(given_arguments)
        if self._is_gui_wanted(request, given_arguments):
            return self._launch_gui()
        return CliApplication().run(request)

    def _is_gui_wanted(self, request: CommandLineRequest, given_arguments: list[str]) -> bool:
        """Tell whether the graphical interface has to be opened."""
        return request.start_gui or not given_arguments

    def _launch_gui(self) -> int:
        """Open the main window and return the exit code of the program."""
        try:
            from .gui.gui_application import GuiApplication, GuiUnavailableError
        except ImportError:
            print(GUI_IMPORT_HINT, file=sys.stderr)
            return EXIT_CODE_FAILURE
        try:
            GuiApplication().run()
        except GuiUnavailableError as error:
            print(f"{error}\nUse the terminal interface instead, see --help.", file=sys.stderr)
            return EXIT_CODE_FAILURE
        return EXIT_CODE_SUCCESS
