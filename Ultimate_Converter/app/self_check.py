"""Reports what this installation can convert, without opening the main window.

Useful for confirming a freshly built binary works, and for seeing which tools a
machine is missing:

    UltimateConverter --self-test

Building the report and showing it are kept apart, because a windowed Windows
build has no console to print to and has to display the text instead.
"""

from __future__ import annotations

import importlib.util
import sys
from typing import List, Tuple

from .converters.converter_catalogue import build_conversion_registry
from .core.bundled_resources import is_running_as_binary, resource_path
from .core.conversion_registry import ConversionRegistry
from .core.external_tool import ALL_EXTERNAL_TOOLS, locate_tool


def build_self_check_report() -> Tuple[str, int]:
    """Return the report text and an exit code: 0 when conversions are possible."""
    registry = build_conversion_registry()
    lines = [
        "Ultimate Converter - self check",
        "",
        *_environment_lines(),
        "",
        *_tool_lines(),
        "",
        *_converter_lines(registry),
        "",
    ]
    verdict_lines, exit_code = _verdict(registry)
    lines.extend(verdict_lines)
    return "\n".join(lines), exit_code


def _environment_lines() -> List[str]:
    """Describe how the application is running and whether its assets are present."""
    icon = resource_path("ui", "assets", "icon.png")
    return [
        f"  running as   : {'standalone binary' if is_running_as_binary() else 'source'}",
        f"  python       : {sys.version.split()[0]}",
        f"  bundled icon : {'found' if icon.exists() else 'MISSING'}",
        f"  yaml support : {'yes' if _has_yaml() else 'no (pip install pyyaml)'}",
    ]


def _tool_lines() -> List[str]:
    """List every external tool and where it was found."""
    lines = ["  Conversion tools"]
    for tool in ALL_EXTERNAL_TOOLS:
        resolved = locate_tool(tool)
        marker = "OK" if resolved else "--"
        lines.append(f"    {marker}  {tool.display_name:<30} {resolved or 'missing'}")
    return lines


def _converter_lines(registry: ConversionRegistry) -> List[str]:
    """List each converter with how many conversions it currently offers."""
    lines = ["  Converters"]
    for converter, count in registry.conversion_pairs_by_converter():
        marker = "OK" if converter.is_available() else "--"
        state = "ready" if converter.is_available() else "needs a tool installed"
        lines.append(f"    {marker}  {converter.display_name:<34} {count:>5} pairs  {state}")
    return lines


def _verdict(registry: ConversionRegistry) -> Tuple[List[str], int]:
    """Summarise the result and decide the exit code."""
    available = registry.count_conversion_pairs(only_available=True)
    total = registry.count_conversion_pairs(only_available=False)
    lines = [f"  {available} of {total} conversions are available on this computer."]
    if available == 0:
        lines.append("  No conversion tools were found. Install FFmpeg or ImageMagick to start.")
        return lines, 1
    return lines, 0


def _has_yaml() -> bool:
    """Report whether PyYAML is importable, which YAML conversions need."""
    return importlib.util.find_spec("yaml") is not None
