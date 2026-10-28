"""Colours, fonts and ttk styles shared by every part of the window."""

from __future__ import annotations

import tkinter as tk
from tkinter import font as tkfont
from tkinter import ttk

BACKGROUND = "#1e2128"
PANEL_BACKGROUND = "#262a33"
BORDER = "#343945"
TEXT = "#e6e8ee"
MUTED_TEXT = "#9aa2b4"
ACCENT = "#4c8dff"
SUCCESS = "#3fbf7f"
WARNING = "#e8b23a"
DANGER = "#e5605e"

STATUS_COLOURS = {
    "Pending": MUTED_TEXT,
    "Converting": ACCENT,
    "Done": SUCCESS,
    "Failed": DANGER,
    "Cancelled": WARNING,
}

PREFERRED_FONT_FAMILIES = (
    "Segoe UI",          # Windows
    "SF Pro Text",       # macOS
    "Helvetica Neue",    # macOS fallback
    "Inter",
    "Cantarell",         # GNOME
    "Noto Sans",
    "DejaVu Sans",       # almost every Linux distribution
)
"""Interface fonts in order of preference; the first installed one wins."""

TITLE_FONT = ("TkDefaultFont", 15, "bold")
HEADING_FONT = ("TkDefaultFont", 10, "bold")
BODY_FONT = ("TkDefaultFont", 10)
SMALL_FONT = ("TkDefaultFont", 9)


def apply_theme(root: tk.Tk) -> None:
    """Give the whole application one consistent dark appearance."""
    root.configure(background=BACKGROUND)
    _resolve_fonts(root)
    style = ttk.Style(root)
    style.theme_use("clam")
    _style_containers(style)
    _style_text(style)
    _style_controls(style)
    _style_scrollbars(style)
    _style_queue_table(style)


def _resolve_fonts(root: tk.Tk) -> None:
    """Point every font constant at a family this computer actually has."""
    global TITLE_FONT, HEADING_FONT, BODY_FONT, SMALL_FONT
    family = _first_installed_font_family(root)
    TITLE_FONT = (family, 15, "bold")
    HEADING_FONT = (family, 10, "bold")
    BODY_FONT = (family, 10)
    SMALL_FONT = (family, 9)


def _first_installed_font_family(root: tk.Tk) -> str:
    """Return the best available interface font, falling back to Tk's own."""
    installed = set(tkfont.families(root))
    for family in PREFERRED_FONT_FAMILIES:
        if family in installed:
            return family
    return tkfont.nametofont("TkDefaultFont").actual("family")


def _style_containers(style: ttk.Style) -> None:
    """Frames, panes and the separators between them."""
    style.configure("TFrame", background=BACKGROUND)
    style.configure("Panel.TFrame", background=PANEL_BACKGROUND)
    style.configure(
        "Card.TLabelframe",
        background=PANEL_BACKGROUND,
        bordercolor=BORDER,
        relief="solid",
        borderwidth=1,
    )
    style.configure(
        "Card.TLabelframe.Label",
        background=PANEL_BACKGROUND,
        foreground=MUTED_TEXT,
        font=HEADING_FONT,
    )
    style.configure("TPanedwindow", background=BACKGROUND)
    style.configure("TSeparator", background=BORDER)


def _style_text(style: ttk.Style) -> None:
    """Every label variant used in the window."""
    style.configure("TLabel", background=BACKGROUND, foreground=TEXT, font=BODY_FONT)
    style.configure("Panel.TLabel", background=PANEL_BACKGROUND, foreground=TEXT, font=BODY_FONT)
    style.configure("Title.TLabel", background=BACKGROUND, foreground=TEXT, font=TITLE_FONT)
    style.configure(
        "Heading.TLabel", background=PANEL_BACKGROUND, foreground=TEXT, font=HEADING_FONT
    )
    style.configure(
        "Muted.TLabel", background=PANEL_BACKGROUND, foreground=MUTED_TEXT, font=SMALL_FONT
    )
    style.configure("Status.TLabel", background=BACKGROUND, foreground=MUTED_TEXT, font=SMALL_FONT)


def _style_controls(style: ttk.Style) -> None:
    """Buttons, dropdowns, checkboxes and the progress bar."""
    style.configure(
        "TButton",
        background=PANEL_BACKGROUND,
        foreground=TEXT,
        bordercolor=BORDER,
        focuscolor=BORDER,
        font=BODY_FONT,
        padding=(9, 5),
    )
    style.map(
        "TButton",
        background=[("active", BORDER), ("disabled", PANEL_BACKGROUND)],
        foreground=[("disabled", MUTED_TEXT)],
    )
    style.configure("Accent.TButton", background=ACCENT, foreground="#0d1220", font=HEADING_FONT)
    style.map(
        "Accent.TButton",
        background=[("active", "#6ba1ff"), ("disabled", BORDER)],
        foreground=[("disabled", MUTED_TEXT)],
    )
    style.configure(
        "TCombobox",
        fieldbackground=BACKGROUND,
        background=PANEL_BACKGROUND,
        foreground=TEXT,
        arrowcolor=TEXT,
        bordercolor=BORDER,
        lightcolor=BORDER,
        darkcolor=BORDER,
        padding=5,
    )
    style.map(
        "TCombobox",
        fieldbackground=[("readonly", BACKGROUND), ("disabled", PANEL_BACKGROUND)],
        foreground=[("readonly", TEXT), ("disabled", MUTED_TEXT)],
        selectbackground=[("readonly", BACKGROUND)],
        selectforeground=[("readonly", TEXT)],
        arrowcolor=[("disabled", MUTED_TEXT)],
    )
    style.configure(
        "TCheckbutton",
        background=PANEL_BACKGROUND,
        foreground=TEXT,
        focuscolor=PANEL_BACKGROUND,
        font=BODY_FONT,
    )
    style.map("TCheckbutton", background=[("active", PANEL_BACKGROUND)])
    style.configure(
        "TSpinbox",
        fieldbackground=BACKGROUND,
        background=PANEL_BACKGROUND,
        foreground=TEXT,
        arrowcolor=TEXT,
        bordercolor=BORDER,
    )
    style.configure(
        "Horizontal.TProgressbar",
        background=ACCENT,
        troughcolor=PANEL_BACKGROUND,
        bordercolor=BORDER,
        lightcolor=ACCENT,
        darkcolor=ACCENT,
    )


def _style_scrollbars(style: ttk.Style) -> None:
    """Make both scrollbar variants match the dark surfaces they sit on."""
    for style_name, trough in (
        ("Vertical.TScrollbar", BACKGROUND),
        ("Panel.Vertical.TScrollbar", PANEL_BACKGROUND),
    ):
        style.configure(
            style_name,
            background=BORDER,
            troughcolor=trough,
            bordercolor=trough,
            arrowcolor=MUTED_TEXT,
            relief="flat",
        )
        style.map(style_name, background=[("active", MUTED_TEXT)])


def _style_queue_table(style: ttk.Style) -> None:
    """The treeview that lists the queued files."""
    style.configure(
        "Queue.Treeview",
        background=PANEL_BACKGROUND,
        fieldbackground=PANEL_BACKGROUND,
        foreground=TEXT,
        bordercolor=BORDER,
        rowheight=28,
        font=BODY_FONT,
    )
    style.configure(
        "Queue.Treeview.Heading",
        background=BACKGROUND,
        foreground=MUTED_TEXT,
        font=HEADING_FONT,
        relief="flat",
        padding=(8, 6),
    )
    style.map("Queue.Treeview.Heading", background=[("active", BORDER)])
    style.map(
        "Queue.Treeview",
        background=[("selected", ACCENT)],
        foreground=[("selected", "#0d1220")],
    )
