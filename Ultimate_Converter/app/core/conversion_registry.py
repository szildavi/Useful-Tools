"""The catalogue that answers "what can this file become, and who does it?"."""

from __future__ import annotations

from typing import Dict, List, Sequence, Tuple

from .conversion_option import ConversionOption
from .converter import Converter
from .external_tool import ExternalTool
from .format_families import ConversionPair, normalise_format


class ConversionRegistry:
    """Indexes every converter so lookups by format stay instant."""

    def __init__(self, converters: Sequence[Converter]) -> None:
        self._converters = list(converters)
        self._converter_by_pair: Dict[ConversionPair, Converter] = {}
        self._index_converters()

    def _index_converters(self) -> None:
        """Map every declared pair to the converter that claimed it first."""
        for converter in self._converters:
            for pair in converter.supported_conversion_pairs():
                self._converter_by_pair.setdefault(pair, converter)

    @property
    def converters(self) -> Sequence[Converter]:
        """Every registered converter, in registration order."""
        return tuple(self._converters)

    def target_formats_for(self, source_format: str, only_available: bool = True) -> List[str]:
        """Return the sorted formats ``source_format`` can be converted into."""
        source = normalise_format(source_format)
        targets = [
            target
            for (declared_source, target), converter in self._converter_by_pair.items()
            if declared_source == source and (converter.is_available() or not only_available)
        ]
        return sorted(set(targets))

    def source_formats(self, only_available: bool = True) -> List[str]:
        """Return every format the application can read."""
        sources = [
            source
            for (source, _), converter in self._converter_by_pair.items()
            if converter.is_available() or not only_available
        ]
        return sorted(set(sources))

    def converter_for(self, source_format: str, target_format: str) -> Converter:
        """Return the converter handling one pair, or raise a clear error."""
        pair = (normalise_format(source_format), normalise_format(target_format))
        converter = self._converter_by_pair.get(pair)
        if converter is None:
            raise UnsupportedConversionError(*pair)
        return converter

    def supports(self, source_format: str, target_format: str) -> bool:
        """Report whether a pair is known, regardless of tool availability."""
        pair = (normalise_format(source_format), normalise_format(target_format))
        return pair in self._converter_by_pair

    def options_for(self, source_format: str, target_format: str) -> Sequence[ConversionOption]:
        """Return the tunable settings for one conversion."""
        converter = self.converter_for(source_format, target_format)
        return converter.declare_options(
            normalise_format(source_format), normalise_format(target_format)
        )

    def count_conversion_pairs(self, only_available: bool = True) -> int:
        """Return how many conversions are currently on offer."""
        return sum(
            1
            for converter in self._converter_by_pair.values()
            if converter.is_available() or not only_available
        )

    def blocked_conversions_by_tool(self) -> Dict[ExternalTool, int]:
        """Return how many conversions each missing tool is holding back."""
        blocked: Dict[ExternalTool, int] = {}
        for pair, converter in self._converter_by_pair.items():
            for tool in converter.missing_tools():
                blocked[tool] = blocked.get(tool, 0) + 1
        return blocked

    def conversion_pairs_by_converter(self) -> List[Tuple[Converter, int]]:
        """Return each converter with the number of pairs it owns."""
        counts: Dict[int, int] = {}
        for converter in self._converter_by_pair.values():
            counts[id(converter)] = counts.get(id(converter), 0) + 1
        return [(converter, counts.get(id(converter), 0)) for converter in self._converters]


class UnsupportedConversionError(LookupError):
    """Raised when no converter claims a requested format pair."""

    def __init__(self, source_format: str, target_format: str) -> None:
        super().__init__(f"Converting .{source_format} to .{target_format} is not supported.")
        self.source_format = source_format
        self.target_format = target_format
