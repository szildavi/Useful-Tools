"""User-facing settings that fine-tune a single conversion."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Sequence, Tuple


class OptionKind(Enum):
    """How the user interface should render an option."""

    CHOICE = "choice"
    INTEGER = "integer"
    TEXT = "text"
    TOGGLE = "toggle"


@dataclass(frozen=True)
class ConversionOption:
    """One tunable setting, described independently of any toolkit."""

    key: str
    label: str
    kind: OptionKind
    default: Any
    choices: Sequence[Tuple[str, Any]] = field(default_factory=tuple)
    minimum: int | None = None
    maximum: int | None = None
    help_text: str = ""

    def coerce(self, raw_value: Any) -> Any:
        """Return ``raw_value`` converted to this option's value type."""
        if raw_value is None or raw_value == "":
            return self.default
        if self.kind is OptionKind.INTEGER:
            return self._coerce_integer(raw_value)
        if self.kind is OptionKind.TOGGLE:
            return self._coerce_toggle(raw_value)
        return raw_value

    def _coerce_integer(self, raw_value: Any) -> Any:
        try:
            number = int(raw_value)
        except (TypeError, ValueError):
            return self.default
        if self.minimum is not None:
            number = max(self.minimum, number)
        if self.maximum is not None:
            number = min(self.maximum, number)
        return number

    @staticmethod
    def _coerce_toggle(raw_value: Any) -> bool:
        if isinstance(raw_value, str):
            return raw_value.strip().lower() in {"1", "true", "yes", "on"}
        return bool(raw_value)


def choice_option(
    key: str,
    label: str,
    choices: Sequence[Tuple[str, Any]],
    help_text: str = "",
) -> ConversionOption:
    """Build a dropdown option whose first entry is the default."""
    return ConversionOption(
        key=key,
        label=label,
        kind=OptionKind.CHOICE,
        default=choices[0][1],
        choices=tuple(choices),
        help_text=help_text,
    )


def integer_option(
    key: str,
    label: str,
    default: int,
    minimum: int,
    maximum: int,
    help_text: str = "",
) -> ConversionOption:
    """Build a bounded numeric option."""
    return ConversionOption(
        key=key,
        label=label,
        kind=OptionKind.INTEGER,
        default=default,
        minimum=minimum,
        maximum=maximum,
        help_text=help_text,
    )


def toggle_option(
    key: str,
    label: str,
    default: bool = False,
    help_text: str = "",
) -> ConversionOption:
    """Build an on/off option."""
    return ConversionOption(
        key=key,
        label=label,
        kind=OptionKind.TOGGLE,
        default=default,
        help_text=help_text,
    )


def apply_option_defaults(
    options: Sequence[ConversionOption],
    chosen_values: Dict[str, Any],
) -> Dict[str, Any]:
    """Merge user choices onto defaults, dropping keys the conversion ignores."""
    return {option.key: option.coerce(chosen_values.get(option.key)) for option in options}


AUTOMATIC = "__automatic__"
"""Sentinel value meaning "let the underlying tool decide"."""


def is_automatic(value: Any) -> bool:
    """Report whether an option value asks the tool to pick for itself."""
    return value == AUTOMATIC

