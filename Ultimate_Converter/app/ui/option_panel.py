"""Renders a conversion's options as editable controls."""

from __future__ import annotations

import tkinter as tk
from tkinter import ttk
from typing import Any, Callable, Dict, Sequence

from ..core.conversion_option import ConversionOption, OptionKind

OptionsChangedCallback = Callable[[Dict[str, Any]], None]


class OptionPanel(ttk.Frame):
    """Builds one control per option and reports every edit straight away."""

    def __init__(self, parent: tk.Misc, on_options_changed: OptionsChangedCallback) -> None:
        super().__init__(parent, style="Panel.TFrame", padding=(14, 10))
        self._on_options_changed = on_options_changed
        self._variables: Dict[str, Any] = {}
        self._shown_options: Sequence[ConversionOption] = ()
        self._placeholder = ttk.Label(self, text="", style="Muted.TLabel", wraplength=280)

    def show_options(
        self, options: Sequence[ConversionOption], current_values: Dict[str, Any]
    ) -> None:
        """Replace the panel's contents with controls for ``options``."""
        self._clear()
        self._shown_options = options
        if not options:
            self._show_placeholder("This conversion has no extra settings.")
            return
        for row_index, option in enumerate(options):
            self._build_option_row(option, current_values.get(option.key, option.default), row_index)
        self.columnconfigure(0, weight=1)

    def show_message(self, message: str) -> None:
        """Replace the panel's contents with a single explanatory line."""
        self._clear()
        self._shown_options = ()
        self._show_placeholder(message)

    def collect_values(self) -> Dict[str, Any]:
        """Return the value currently shown for every option."""
        return {
            option.key: option.coerce(self._variables[option.key].get())
            for option in self._shown_options
            if option.key in self._variables
        }

    def _clear(self) -> None:
        """Remove every widget so a new conversion can be described."""
        for child in self.winfo_children():
            child.destroy()
        self._variables.clear()
        self._placeholder = ttk.Label(self, text="", style="Muted.TLabel", wraplength=280)

    def _show_placeholder(self, message: str) -> None:
        self._placeholder.configure(text=message)
        self._placeholder.grid(row=0, column=0, sticky="w", pady=(4, 0))

    def _build_option_row(self, option: ConversionOption, value: Any, row_index: int) -> None:
        """Add the label, control and help text for one option."""
        container = ttk.Frame(self, style="Panel.TFrame")
        container.grid(row=row_index, column=0, sticky="ew", pady=(0, 12))
        container.columnconfigure(0, weight=1)
        if option.kind is not OptionKind.TOGGLE:
            ttk.Label(container, text=option.label, style="Panel.TLabel").grid(
                row=0, column=0, sticky="w", pady=(0, 4)
            )
        self._build_control(container, option, value).grid(row=1, column=0, sticky="ew")
        if option.help_text:
            ttk.Label(
                container, text=option.help_text, style="Muted.TLabel", wraplength=290
            ).grid(row=2, column=0, sticky="w", pady=(4, 0))

    def _build_control(self, parent: ttk.Frame, option: ConversionOption, value: Any) -> tk.Widget:
        """Return the widget that edits one option's value."""
        builders = {
            OptionKind.CHOICE: self._build_choice_control,
            OptionKind.INTEGER: self._build_integer_control,
            OptionKind.TOGGLE: self._build_toggle_control,
            OptionKind.TEXT: self._build_text_control,
        }
        return builders[option.kind](parent, option, value)

    def _build_choice_control(
        self, parent: ttk.Frame, option: ConversionOption, value: Any
    ) -> tk.Widget:
        labels = [label for label, _ in option.choices]
        variable = tk.StringVar(value=_label_for_value(option, value))
        combobox = ttk.Combobox(parent, textvariable=variable, values=labels, state="readonly")
        combobox.bind("<<ComboboxSelected>>", lambda _event: self._publish_change())
        self._variables[option.key] = _ChoiceVariable(variable, option)
        return combobox

    def _build_integer_control(
        self, parent: ttk.Frame, option: ConversionOption, value: Any
    ) -> tk.Widget:
        variable = tk.StringVar(value=str(value))
        spinbox = ttk.Spinbox(
            parent,
            from_=option.minimum or 0,
            to=option.maximum or 100,
            textvariable=variable,
            command=self._publish_change,
        )
        spinbox.bind("<FocusOut>", lambda _event: self._publish_change())
        spinbox.bind("<Return>", lambda _event: self._publish_change())
        self._variables[option.key] = variable
        return spinbox

    def _build_toggle_control(
        self, parent: ttk.Frame, option: ConversionOption, value: Any
    ) -> tk.Widget:
        variable = tk.BooleanVar(value=bool(value))
        checkbutton = ttk.Checkbutton(
            parent, text=option.label, variable=variable, command=self._publish_change
        )
        self._variables[option.key] = variable
        return checkbutton

    def _build_text_control(
        self, parent: ttk.Frame, option: ConversionOption, value: Any
    ) -> tk.Widget:
        variable = tk.StringVar(value=str(value))
        entry = ttk.Entry(parent, textvariable=variable)
        entry.bind("<FocusOut>", lambda _event: self._publish_change())
        self._variables[option.key] = variable
        return entry

    def _publish_change(self) -> None:
        """Hand the freshly edited values back to the window."""
        self._on_options_changed(self.collect_values())


class _ChoiceVariable:
    """Adapts a dropdown's visible label back to the option's real value."""

    def __init__(self, label_variable: tk.StringVar, option: ConversionOption) -> None:
        self._label_variable = label_variable
        self._option = option

    def get(self) -> Any:
        """Return the value behind the label the user picked."""
        chosen_label = self._label_variable.get()
        for label, value in self._option.choices:
            if label == chosen_label:
                return value
        return self._option.default


def _label_for_value(option: ConversionOption, value: Any) -> str:
    """Return the dropdown label that stands for ``value``."""
    for label, choice_value in option.choices:
        if choice_value == value:
            return label
    return option.choices[0][0] if option.choices else ""
