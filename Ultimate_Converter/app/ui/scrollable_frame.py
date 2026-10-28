"""A frame whose contents scroll vertically when they outgrow the space."""

from __future__ import annotations

import sys
import tkinter as tk
from tkinter import ttk

from . import theme


class ScrollableFrame(ttk.Frame):
    """Hosts one child area that scrolls, with the scrollbar hidden when unused.

    Widgets are added to :attr:`content`, never to the ``ScrollableFrame``
    itself.
    """

    def __init__(self, parent: tk.Misc) -> None:
        super().__init__(parent, style="Panel.TFrame")
        self._canvas = self._build_canvas()
        self._scrollbar = self._build_scrollbar()
        self.content = ttk.Frame(self._canvas, style="Panel.TFrame")
        self._content_window = self._canvas.create_window(
            (0, 0), window=self.content, anchor="nw"
        )
        self._connect_resize_events()

    def _build_canvas(self) -> tk.Canvas:
        """Create the canvas that does the actual scrolling."""
        canvas = tk.Canvas(
            self,
            background=theme.PANEL_BACKGROUND,
            highlightthickness=0,
            borderwidth=0,
        )
        canvas.grid(row=0, column=0, sticky="nsew")
        self.rowconfigure(0, weight=1)
        self.columnconfigure(0, weight=1)
        return canvas

    def _build_scrollbar(self) -> ttk.Scrollbar:
        """Create the vertical scrollbar bound to the canvas."""
        scrollbar = ttk.Scrollbar(
            self, orient="vertical", command=self._canvas.yview, style="Panel.Vertical.TScrollbar"
        )
        self._canvas.configure(yscrollcommand=scrollbar.set)
        return scrollbar

    def _connect_resize_events(self) -> None:
        """Keep the scroll region and the content width in step with the canvas."""
        self.content.bind("<Configure>", lambda _event: self._update_scroll_region())
        self._canvas.bind("<Configure>", self._match_content_width)
        for widget in (self._canvas, self.content):
            widget.bind("<MouseWheel>", self._scroll_with_wheel)
            widget.bind("<Button-4>", self._scroll_with_wheel)
            widget.bind("<Button-5>", self._scroll_with_wheel)

    def _update_scroll_region(self) -> None:
        """Resize the scrollable area and show the scrollbar only when needed."""
        self._canvas.configure(scrollregion=self._canvas.bbox("all"))
        if self.content.winfo_reqheight() > self._canvas.winfo_height():
            self._scrollbar.grid(row=0, column=1, sticky="ns")
        else:
            self._scrollbar.grid_remove()
            self._canvas.yview_moveto(0)

    def _match_content_width(self, event: tk.Event) -> None:
        """Stretch the content to the canvas width so labels wrap correctly."""
        self._canvas.itemconfigure(self._content_window, width=event.width)
        self._update_scroll_region()

    def _scroll_with_wheel(self, event: tk.Event) -> None:
        """Scroll on a mouse wheel turn, using whichever event this platform sends."""
        if self._scrollbar.winfo_ismapped():
            self._canvas.yview_scroll(_wheel_steps(event), "units")


def _wheel_steps(event: tk.Event) -> int:
    """Turn a wheel event into a number of scroll steps."""
    if event.num == 4:
        return -1
    if event.num == 5:
        return 1
    divisor = 120 if sys.platform == "win32" else 1
    return -int(event.delta / divisor)
