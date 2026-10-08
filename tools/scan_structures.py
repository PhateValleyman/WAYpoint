#!/usr/bin/env python3
"""Scan Bedrock .mcstructure files and generate their exact X/Y/Z dimensions.

.mcstructure is uncompressed little-endian NBT. The root compound contains a
`size` list of three integers. See: https://wiki.bedrock.dev/nbt/mcstructure
"""
from __future__ import annotations

import json
import struct
import sys
from pathlib import Path

# NBT tag identifiers used by Bedrock's little-endian .mcstructure format.
TAG_END = 0
TAG_BYTE = 1
TAG_SHORT = 2
TAG_INT = 3
TAG_LONG = 4
TAG_FLOAT = 5
TAG_DOUBLE = 6
TAG_BYTE_ARRAY = 7
TAG_STRING = 8
TAG_LIST = 9
TAG_COMPOUND = 10
TAG_INT_ARRAY = 11
TAG_LONG_ARRAY = 12


class Reader:
    def __init__(self, data: bytes) -> None:
        self.data = data
        self.pos = 0

    # Read a fixed number of bytes and fail cleanly on truncated files.
    def take(self, count: int) -> bytes:
        end = self.pos + count
        if end > len(self.data):
            raise ValueError("truncated NBT data")
        out = self.data[self.pos:end]
        self.pos = end
        return out

    # Read an unsigned little-endian NBT string length followed by UTF-8 text.
    def string(self) -> str:
        length = struct.unpack("<H", self.take(2))[0]
        return self.take(length).decode("utf-8")

    # Skip one NBT payload without constructing the complete structure tree.
    def skip_payload(self, tag: int) -> None:
        if tag == TAG_BYTE:
            self.take(1)
        elif tag == TAG_SHORT:
            self.take(2)
        elif tag == TAG_INT:
            self.take(4)
        elif tag == TAG_LONG:
            self.take(8)
        elif tag == TAG_FLOAT:
            self.take(4)
        elif tag == TAG_DOUBLE:
            self.take(8)
        elif tag == TAG_BYTE_ARRAY:
            self.take(struct.unpack("<i", self.take(4))[0])
        elif tag == TAG_STRING:
            self.take(struct.unpack("<H", self.take(2))[0])
        elif tag == TAG_LIST:
            child = self.take(1)[0]
            count = struct.unpack("<i", self.take(4))[0]
            if count < 0:
                raise ValueError("negative NBT list length")
            for _ in range(count):
                self.skip_payload(child)
        elif tag == TAG_COMPOUND:
            while True:
                child = self.take(1)[0]
                if child == TAG_END:
                    return
                self.string()
                self.skip_payload(child)
        elif tag == TAG_INT_ARRAY:
            self.take(struct.unpack("<i", self.take(4))[0] * 4)
        elif tag == TAG_LONG_ARRAY:
            self.take(struct.unpack("<i", self.take(4))[0] * 8)
        else:
            raise ValueError(f"unsupported NBT tag {tag}")

    # Read an NBT list of little-endian integers, used by the mcstructure `size` field.
    def int_list(self) -> list[int]:
        child = self.take(1)[0]
        count = struct.unpack("<i", self.take(4))[0]
        if child != TAG_INT or count != 3:
            raise ValueError("size is not a list of three integers")
        return [struct.unpack("<i", self.take(4))[0] for _ in range(count)]

    # Walk the root compound until the top-level `size` field is found.
    def read_size(self) -> list[int]:
        root_tag = self.take(1)[0]
        if root_tag != TAG_COMPOUND:
            raise ValueError("mcstructure root is not a compound")
        self.string()  # Root name is normally empty but is part of NBT.
        while True:
            tag = self.take(1)[0]
            if tag == TAG_END:
                break
            name = self.string()
            if name == "size":
                return self.int_list()
            self.skip_payload(tag)
        raise ValueError("missing top-level size field")


def structure_id(root: Path, path: Path) -> str:
    relative = path.relative_to(root).with_suffix("")
    parts = relative.parts
    if len(parts) == 1:
        return f"mystructure:{parts[0]}"
    return f"{parts[0]}:{'/'.join(parts[1:])}"


def main() -> int:
    root = Path(sys.argv[1] if len(sys.argv) > 1 else "pack/behavior_pack/QuickCraft/structures")
    output = Path(sys.argv[2] if len(sys.argv) > 2 else "pack/behavior_pack/QuickCraft/scripts/structure_dimensions.js")
    files = sorted(root.rglob("*.mcstructure"))
    result: dict[str, dict[str, object]] = {}
    errors: list[str] = []

    for path in files:
        try:
            size = Reader(path.read_bytes()).read_size()
            if any(value < 1 for value in size):
                raise ValueError(f"invalid dimensions {size}")
            result[structure_id(root, path)] = {
                "size": size,
                "file": path.relative_to(root).as_posix(),
            }
        except (OSError, ValueError, UnicodeError) as exc:
            errors.append(f"{path}: {exc}")

    output.parent.mkdir(parents=True, exist_ok=True)
    header = "// GENERATED FILE - do not edit manually. Run: make scan\n"
    output.write_text(header + "export const STRUCTURE_DIMENSIONS = " + json.dumps(result, ensure_ascii=False, indent=2) + ";\n", encoding="utf-8")

    print(f"INFO: scanned {len(files)} .mcstructure files")
    print(f"OK: generated {output}")
    if errors:
        print(f"WARN: {len(errors)} structures could not be parsed", file=sys.stderr)
        for error in errors:
            print(f"  {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
