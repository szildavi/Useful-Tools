"""A window listing which external tools were found and how to install the rest."""

from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk
from typing import Callable

from ..core.conversion_registry import ConversionRegistry
from ..core.external_tool import (
    ALL_EXTERNAL_TOOLS,
    ExternalTool,
    forget_cached_locations,
    locate_tool,
)
from . import theme
from .scrollable_frame import ScrollableFrame

DIALOG_WIDTH = 780
DIALOG_HEIGHT = 620
DETAIL_WRAP_PIXELS = 620


class ToolStatusDialog(tk.Toplevel):
    """Explains why some conversions are unavailable and how to enable them."""

    def __init__(
        self, parent: tk.Misc, registry: ConversionRegistry, on_tools_rechecked: Callable[[], None]
    ) -> None:
        super().__init__(parent)
        self._registry = registry
        self._on_tools_rechecked = on_tools_rechecked
        self.title("Installed conversion tools")
        self.configure(background=theme.BACKGROUND)
        self.geometry(f"{DIALOG_WIDTH}x{DIALOG_HEIGHT}")
        self.minsize(DIALOG_WIDTH, 400)
        self.transient(parent)
        self._body = ttk.Frame(self, style="TFrame", padding=16)
        self._body.pack(fill="both", expand=True)
        self._render()

    def _render(self) -> None:
        """Draw the whole dialog from the current tool availability."""
        for child in self._body.winfo_children():
            child.destroy()
        self._build_header()
        self._build_tool_rows()
        self._build_footer()

    def _build_header(self) -> None:
        """Show the headline count of ready conversions."""
        available = self._registry.count_conversion_pairs(only_available=True)
        total = self._registry.count_conversion_pairs(only_available=False)
        ttk.Label(self._body, text="Conversion tools", style="Title.TLabel").pack(anchor="w")
        ttk.Label(
            self._body,
            text=f"{available} of {total} conversions are ready to use on this computer.",
            style="Status.TLabel",
        ).pack(anchor="w", pady=(4, 14))

    def _build_tool_rows(self) -> None:
        """List every known tool with its state and install command."""
        blocked_counts = self._registry.blocked_conversions_by_tool()
        scroller = ScrollableFrame(self._body)
        scroller.pack(fill="both", expand=True)
        table = ttk.Frame(scroller.content, style="Panel.TFrame", padding=12)
        table.pack(fill="both", expand=True)
        table.columnconfigure(1, weight=1)
        for row_index, tool in enumerate(ALL_EXTERNAL_TOOLS):
            self._build_tool_row(table, tool, row_index, blocked_counts.get(tool, 0))

    def _build_tool_row(
        self, table: ttk.Frame, tool: ExternalTool, row_index: int, blocked_count: int
    ) -> None:
        """Draw one tool as a status marker beside a two-line description."""
        resolved_path = locate_tool(tool)
        self._build_status_marker(table, resolved_path is not None).grid(
            row=row_index, column=0, sticky="nw", pady=(6, 6)
        )
        description = ttk.Frame(table, style="Panel.TFrame")
        description.grid(row=row_index, column=1, sticky="ew", padx=(10, 0), pady=(6, 6))
        description.columnconfigure(0, weight=1)
        ttk.Label(
            description, text=f"{tool.display_name} - {tool.purpose}", style="Panel.TLabel"
        ).grid(row=0, column=0, sticky="w")
        ttk.Label(
            description,
            text=_detail_text(tool, resolved_path, blocked_count),
            style="Muted.TLabel",
            wraplength=DETAIL_WRAP_PIXELS,
            justify="left",
        ).grid(row=1, column=0, sticky="w", pady=(2, 0))

    @staticmethod
    def _build_status_marker(parent: tk.Misc, is_installed: bool) -> tk.Label:
        """Return the coloured OK/MISSING badge shown beside a tool."""
        return tk.Label(
            parent,
            text="OK" if is_installed else "MISSING",
            background=theme.PANEL_BACKGROUND,
            foreground=theme.SUCCESS if is_installed else theme.DANGER,
            font=theme.HEADING_FONT,
            width=8,
            anchor="w",
        )

    def _build_footer(self) -> None:
        """Add the buttons that close the dialog or re-check the tools."""
        footer = ttk.Frame(self._body, style="TFrame")
        footer.pack(fill="x", pady=(14, 0))
        ttk.Button(footer, text="Close", command=self.destroy).pack(side="right")
        ttk.Button(footer, text="Check again", command=self._recheck_tools).pack(
            side="right", padx=(0, 8)
        )

    def _recheck_tools(self) -> None:
        """Forget cached lookups so newly installed tools are picked up."""
        forget_cached_locations()
        self._render()
        self._on_tools_rechecked()


def _detail_text(tool: ExternalTool, resolved_path: str | None, blocked_count: int) -> str:
    """Return the right-hand column: the path, or how to install the tool."""
    if resolved_path:
        return resolved_path
    hint = tool.windows_install_hint if sys.platform == "win32" else tool.linux_install_hint
    return f"{blocked_count} conversions blocked - install with: {hint}"
