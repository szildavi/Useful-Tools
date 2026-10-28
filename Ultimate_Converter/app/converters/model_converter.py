"""3D mesh conversion through the Open Asset Import Library."""

from __future__ import annotations

from pathlib import Path
from typing import List, Sequence, Set

from ..core.command_runner import run_command
from ..core.conversion_job import ConversionJob
from ..core.conversion_option import ConversionOption, choice_option, toggle_option
from ..core.converter import Converter
from ..core.external_tool import ASSIMP, ExternalTool, require_tool
from ..core.format_families import (
    MODEL_3D_FORMATS,
    MODEL_3D_ONLY_SOURCE_FORMATS,
    ConversionPair,
    build_round_trip_pairs,
)

ASSIMP_EXPORT_IDENTIFIERS = {
    "obj": "obj",
    "stl": "stl",
    "ply": "ply",
    "dae": "collada",
    "gltf": "gltf2",
    "glb": "glb2",
    "fbx": "fbx",
    "3ds": "3ds",
    "x3d": "x3d",
}
"""Target extensions mapped to the exporter identifier Assimp expects."""


class ModelConverter(Converter):
    """Converts 3D meshes between the common interchange formats."""

    @property
    def display_name(self) -> str:
        return "Assimp (3D models)"

    @property
    def required_tools(self) -> Sequence[ExternalTool]:
        return (ASSIMP,)

    def declare_conversion_pairs(self) -> Set[ConversionPair]:
        return build_round_trip_pairs(
            MODEL_3D_FORMATS, extra_sources=MODEL_3D_ONLY_SOURCE_FORMATS
        )

    def declare_options(
        self, source_format: str, target_format: str
    ) -> Sequence[ConversionOption]:
        return MESH_OPTIONS

    def convert(self, job: ConversionJob, output_path: Path) -> None:
        command = [
            require_tool(ASSIMP),
            "export",
            str(job.source_path),
            str(output_path),
            f"--format={_exporter_identifier(job.target_format)}",
        ]
        command += _post_processing_arguments(job.options)
        run_command(command)


MESH_OPTIONS: Sequence[ConversionOption] = (
    toggle_option(
        "join_vertices",
        "Merge duplicate vertices",
        default=True,
        help_text="Shrinks the file and repairs meshes exported with split seams.",
    ),
    toggle_option(
        "triangulate",
        "Split faces into triangles",
        default=True,
        help_text="Required by STL and by most 3D printing and game engines.",
    ),
    toggle_option(
        "generate_normals",
        "Generate smooth normals",
        default=False,
        help_text="Adds shading data when the source mesh has none.",
    ),
    choice_option(
        "pretransform",
        "Scene hierarchy",
        (
            ("Keep the node hierarchy", "keep"),
            ("Flatten into a single mesh", "flatten"),
        ),
        help_text="Flattening is safer for formats that cannot store a hierarchy.",
    ),
)


def _exporter_identifier(target_format: str) -> str:
    """Return the Assimp exporter id for a target extension."""
    identifier = ASSIMP_EXPORT_IDENTIFIERS.get(target_format)
    if identifier is None:
        raise RuntimeError(f"Assimp cannot write .{target_format} files.")
    return identifier


def _post_processing_arguments(options: dict) -> List[str]:
    """Translate the mesh options into Assimp post-processing flags."""
    arguments: List[str] = []
    if options.get("join_vertices", True):
        arguments.append("-jiv")
    if options.get("triangulate", True):
        arguments.append("-tri")
    if options.get("generate_normals"):
        arguments.append("-gsn")
    if options.get("pretransform") == "flatten":
        arguments.append("-ptv")
    return arguments
