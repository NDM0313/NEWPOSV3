#!/usr/bin/env python3
"""
Fix malformed Kong YAML blocks where a CORS plugin is followed by a sibling
`config:` block that should actually be nested under `- name: cors`.

This script is intentionally conservative:
- It only rewrites the specific malformed pattern.
- It preserves everything else.
- It supports multiple occurrences.
"""
from __future__ import annotations

import argparse
import difflib
import pathlib
import re
import sys
from typing import List, Tuple


def leading_spaces(s: str) -> int:
    return len(s) - len(s.lstrip(" "))


def is_plugin_item(line: str, indent: int) -> bool:
    return re.match(rf"^ {{{indent}}}- name:\s+", line) is not None


def fix_lines(lines: List[str]) -> Tuple[List[str], int]:
    out: List[str] = []
    i = 0
    fixes = 0

    while i < len(lines):
        line = lines[i]
        cors_match = re.match(r"^(\s*)- name:\s+cors\s*$", line)
        if not cors_match:
            out.append(line)
            i += 1
            continue

        cors_indent = len(cors_match.group(1))
        out.append(line)
        i += 1

        # Preserve blank lines between the plugin item and what follows.
        while i < len(lines) and lines[i].strip() == "":
            out.append(lines[i])
            i += 1

        if i >= len(lines):
            continue

        # Broken pattern: sibling config block at same indent as plugin items.
        if re.match(rf"^ {{{cors_indent}}}config:\s*$", lines[i]):
            fixes += 1
            config_block: List[str] = []
            i += 1  # Skip the broken `config:` line itself.

            while i < len(lines):
                cur = lines[i]
                if cur.strip() == "":
                    config_block.append(cur)
                    i += 1
                    continue

                cur_indent = leading_spaces(cur)

                # Next sibling plugin item starts -> stop config capture.
                if is_plugin_item(cur, cors_indent):
                    break

                # If indentation drops back out of this block, stop.
                if cur_indent < cors_indent + 2:
                    break

                config_block.append(cur)
                i += 1

            out.append(" " * (cors_indent + 2) + "config:\n")
            for cfg_line in config_block:
                if cfg_line.strip() == "":
                    out.append(cfg_line)
                else:
                    out.append("  " + cfg_line)
            continue

        # Normal, already-correct block.
        continue

    return out, fixes


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path", help="Path to kong.yml")
    parser.add_argument("--write", action="store_true", help="Write changes in-place")
    parser.add_argument("--backup", action="store_true", help="Create .bak backup when writing")
    args = parser.parse_args()

    path = pathlib.Path(args.path)
    if not path.exists():
        print(f"ERROR: file not found: {path}", file=sys.stderr)
        return 1

    original = path.read_text(encoding="utf-8")
    original_lines = original.splitlines(keepends=True)
    fixed_lines, fixes = fix_lines(original_lines)
    fixed = "".join(fixed_lines)

    if original == fixed:
        print("No malformed CORS config block found. No changes made.")
        return 0

    diff = difflib.unified_diff(
        original.splitlines(),
        fixed.splitlines(),
        fromfile=str(path),
        tofile=str(path),
        lineterm="",
    )
    print("\n".join(diff))
    print(f"\nDetected and fixed {fixes} malformed CORS block(s).")

    if args.write:
        if args.backup:
            backup = path.with_suffix(path.suffix + ".bak")
            backup.write_text(original, encoding="utf-8")
            print(f"Backup written: {backup}")
        path.write_text(fixed, encoding="utf-8")
        print(f"Updated file: {path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
