"""Tabular and structured data conversion, implemented in pure Python.

Every supported format is first read into the same intermediate shape - a list
of row dictionaries - so adding a format means writing one reader and one
writer rather than touching every pair.
"""

from __future__ import annotations

import csv
import io
import json
import re
import xml.etree.ElementTree as ElementTree
from pathlib import Path
from typing import Any, Callable, Dict, List, Sequence, Set

from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption, choice_option
from ..core.converter import Converter
from ..core.format_families import (
    STRUCTURED_DATA_FORMATS,
    STRUCTURED_DATA_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_round_trip_pairs,
)

Row = Dict[str, Any]
XML_ROOT_ELEMENT = "records"
XML_ROW_ELEMENT = "record"


class DataConverter(Converter):
    """Converts between CSV, TSV, JSON, YAML and XML without external tools."""

    @property
    def display_name(self) -> str:
        return "Built-in data converter"

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_round_trip_pairs(
            STRUCTURED_DATA_FORMATS, extra_sources=STRUCTURED_DATA_ONLY_SOURCE_FORMATS
        )

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        options: List[ConversionOption] = []
        if source_format in {"csv", "tsv"}:
            options.append(INPUT_DELIMITER_OPTION)
        if target_format in {"csv", "tsv"}:
            options.append(OUTPUT_DELIMITER_OPTION)
        if target_format == "json":
            options.append(JSON_INDENT_OPTION)
        return tuple(options)

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        rows = self._read_rows(job)
        self._write_rows(rows, job, output_path)

    def _read_rows(self, job: ConversionJob) -> List[Row]:
        """Load the source file into the common row shape."""
        text = job.source_path.read_text(encoding="utf-8-sig", errors="replace")
        reader = _READERS[job.source_format]
        return reader(text, job.options)

    def _write_rows(self, rows: List[Row], job: ConversionJob, output_path: Path) -> None:
        """Serialise the common row shape into the target format."""
        writer = _WRITERS[job.target_format]
        output_path.write_text(writer(rows, job.options), encoding="utf-8")


INPUT_DELIMITER_OPTION = choice_option(
    "input_delimiter",
    "Column separator in the source",
    (
        ("Detect automatically", "auto"),
        ("Comma  ,", ","),
        ("Semicolon  ;", ";"),
        ("Tab", "\t"),
        ("Pipe  |", "|"),
    ),
)

OUTPUT_DELIMITER_OPTION = choice_option(
    "output_delimiter",
    "Column separator to write",
    (
        ("Match the format", "auto"),
        ("Comma  ,", ","),
        ("Semicolon  ;", ";"),
        ("Tab", "\t"),
        ("Pipe  |", "|"),
    ),
)

JSON_INDENT_OPTION = choice_option(
    "json_indent",
    "JSON layout",
    (
        ("Indented, 2 spaces", "2"),
        ("Indented, 4 spaces", "4"),
        ("Compact, single line", "0"),
    ),
)


def _read_delimited(text: str, options: dict, fallback_delimiter: str) -> List[Row]:
    """Read comma/tab style text using the chosen or detected separator."""
    delimiter = _resolve_input_delimiter(text, options, fallback_delimiter)
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    return [dict(row) for row in reader]


def _resolve_input_delimiter(text: str, options: dict, fallback_delimiter: str) -> str:
    """Return the separator to read with, sniffing the file when asked to."""
    chosen = options.get("input_delimiter", "auto")
    if chosen != "auto":
        return chosen
    try:
        return csv.Sniffer().sniff(text[:4096], delimiters=",;\t|").delimiter
    except csv.Error:
        return fallback_delimiter


def _read_csv(text: str, options: dict) -> List[Row]:
    return _read_delimited(text, options, fallback_delimiter=",")


def _read_tsv(text: str, options: dict) -> List[Row]:
    return _read_delimited(text, options, fallback_delimiter="\t")


def _read_json(text: str, options: dict) -> List[Row]:
    """Read JSON, accepting either a list of objects or a single object."""
    parsed = json.loads(text)
    return _as_row_list(parsed)


def _read_yaml(text: str, options: dict) -> List[Row]:
    """Read YAML through PyYAML, or explain that it is missing."""
    yaml_module = _import_yaml()
    return _as_row_list(yaml_module.safe_load(text))


def _read_xml(text: str, options: dict) -> List[Row]:
    """Read XML by treating every child of the root as one record."""
    root = ElementTree.fromstring(text)
    return [_element_to_row(child) for child in root]


def _read_sql(text: str, options: dict) -> List[Row]:
    """Extract the rows from ``INSERT INTO ... VALUES ...`` statements."""
    rows: List[Row] = []
    for statement in _SQL_INSERT_PATTERN.finditer(text):
        column_names = _split_sql_list(statement.group("columns"))
        for value_group in _SQL_VALUE_GROUP_PATTERN.finditer(statement.group("values")):
            values = _split_sql_list(value_group.group(1))
            rows.append(dict(zip(column_names, values)))
    if not rows:
        raise ValueError("No INSERT statements with values were found in the SQL file.")
    return rows


def _write_delimited(rows: List[Row], options: dict, fallback_delimiter: str) -> str:
    """Write rows as separated text using the union of all row keys."""
    chosen = options.get("output_delimiter", "auto")
    delimiter = fallback_delimiter if chosen == "auto" else chosen
    buffer = io.StringIO()
    writer = csv.DictWriter(
        buffer, fieldnames=_collect_column_names(rows), delimiter=delimiter, extrasaction="ignore"
    )
    writer.writeheader()
    writer.writerows(rows)
    return buffer.getvalue()


def _write_csv(rows: List[Row], options: dict) -> str:
    return _write_delimited(rows, options, fallback_delimiter=",")


def _write_tsv(rows: List[Row], options: dict) -> str:
    return _write_delimited(rows, options, fallback_delimiter="\t")


def _write_json(rows: List[Row], options: dict) -> str:
    indent = int(options.get("json_indent", "2"))
    return json.dumps(rows, indent=indent or None, ensure_ascii=False)


def _write_yaml(rows: List[Row], options: dict) -> str:
    yaml_module = _import_yaml()
    return yaml_module.safe_dump(rows, allow_unicode=True, sort_keys=False)


def _write_xml(rows: List[Row], options: dict) -> str:
    root = ElementTree.Element(XML_ROOT_ELEMENT)
    for row in rows:
        record = ElementTree.SubElement(root, XML_ROW_ELEMENT)
        for name, value in row.items():
            ElementTree.SubElement(record, _safe_xml_tag(name)).text = _as_text(value)
    ElementTree.indent(root, space="  ")
    return ElementTree.tostring(root, encoding="unicode", xml_declaration=True)


_READERS: Dict[str, Callable[[str, dict], List[Row]]] = {
    "csv": _read_csv,
    "tsv": _read_tsv,
    "json": _read_json,
    "yaml": _read_yaml,
    "xml": _read_xml,
    "sql": _read_sql,
}

_WRITERS: Dict[str, Callable[[List[Row], dict], str]] = {
    "csv": _write_csv,
    "tsv": _write_tsv,
    "json": _write_json,
    "yaml": _write_yaml,
    "xml": _write_xml,
}

_SQL_INSERT_PATTERN = re.compile(
    r"INSERT\s+INTO\s+\S+\s*\((?P<columns>[^)]*)\)\s*VALUES\s*(?P<values>.+?);",
    re.IGNORECASE | re.DOTALL,
)
_SQL_VALUE_GROUP_PATTERN = re.compile(r"\(([^)]*)\)")
_INVALID_XML_TAG_CHARACTERS = re.compile(r"[^A-Za-z0-9_.-]")


def _as_row_list(parsed: Any) -> List[Row]:
    """Normalise parsed data into a list of dictionaries."""
    if isinstance(parsed, list):
        return [item if isinstance(item, dict) else {"value": item} for item in parsed]
    if isinstance(parsed, dict):
        return [parsed]
    return [{"value": parsed}]


def _element_to_row(element: ElementTree.Element) -> Row:
    """Turn one XML element into a flat record."""
    row: Row = dict(element.attrib)
    for child in element:
        row[child.tag] = child.text
    if not row:
        row["value"] = element.text
    return row


def _collect_column_names(rows: List[Row]) -> List[str]:
    """Return every key seen across the rows, keeping first-seen order."""
    names: List[str] = []
    for row in rows:
        for key in row:
            if key not in names:
                names.append(key)
    return names or ["value"]


def _split_sql_list(raw: str) -> List[str]:
    """Split a comma separated SQL list and strip quotes and backticks."""
    return [part.strip().strip("`\"'") for part in raw.split(",")]


def _safe_xml_tag(name: str) -> str:
    """Turn an arbitrary column name into a legal XML tag."""
    cleaned = _INVALID_XML_TAG_CHARACTERS.sub("_", str(name)).strip("_")
    return cleaned if cleaned and not cleaned[0].isdigit() else f"field_{cleaned}"


def _as_text(value: Any) -> str:
    """Render a cell value as text for formats that only hold strings."""
    return "" if value is None else str(value)


def _import_yaml():
    """Import PyYAML, or raise a message that names the missing package."""
    try:
        import yaml
    except ImportError as error:
        raise RuntimeError(
            "YAML support needs the PyYAML package. Install it with: pip install pyyaml"
        ) from error
    return yaml
