"""The contract every conversion engine implements."""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path
from typing import Sequence, Set

from .conversion_job import ConversionJob
from .conversion_option import ConversionOption
from .external_tool import ExternalTool, is_tool_available
from .format_families import ConversionPair, normalise_format


class Converter(ABC):
    """Turns files of one format into another using a single backing engine."""

    @property
    @abstractmethod
    def display_name(self) -> str:
        """Human readable engine name shown in the interface."""

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        """External programs this converter cannot work without."""
        return ()

    @abstractmethod
    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        """Every (source, target) pair this converter handles."""

    def declare_options(self, source_format: str, target_format: str) -> Sequence[ConversionOption]:
        """Settings the user may tune for one conversion. Empty when none apply."""
        return ()

    @abstractmethod
    def convert(self, job: ConversionJob, output_path: Path) -> None:
        """Produce ``output_path`` from ``job``; raise on failure."""

    def is_available(self) -> bool:
        """Report whether every required tool is installed."""
        return all(is_tool_available(tool) for tool in self.required_tools)

    def missing_tools(self) -> Sequence[ExternalTool]:
        """Return the required tools that are not installed."""
        return [tool for tool in self.required_tools if not is_tool_available(tool)]

    def supported_conversion_pairs(self) -> Set[ConversionPair]:
        """Declared pairs with both formats reduced to canonical spellings."""
        return {
            (normalise_format(source), normalise_format(target))
            for source, target in self.declare_conversion_pairs()
            if normalise_format(source) != normalise_format(target)
        }
