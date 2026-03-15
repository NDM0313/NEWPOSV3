#!/usr/bin/env python3
"""
Fix malformed CORS plugin blocks in Kong declarative kong.yml.

Problem: In some configs, `config:` (and its children: origins, credentials,
methods, headers, preflight_continue) appears as a SIBLING of the plugins list
(same indent as "- name: cors" OR less—e.g. same as "plugins:"), causing:
  "failed parsing declarative configuration: N:27: did not find expected key"

Fix: Remove each such misplaced block so only "- name: cors" remains (Kong
uses default CORS behaviour). Nested config under other plugins is left alone.

Usage:
  python3 fix-kong-cors-yaml.py /path/to/kong.yml           # fix in place (idempotent)
  python3 fix-kong-cors-yaml.py --check-only /path/to/kong.yml  # report only, no write

Exit: 0 if ok or fixed; 1 if --check-only and fix would be needed.
"""

import re
import sys
from pathlib import Path


def find_misplaced_cors_blocks(lines: list) -> list:
    """Return list of (start_line_1based, end_line_1based) for misplaced config blocks."""
    blocks = []
    i = 0
    while i < len(lines):
        line = lines[i]
        if not re.match(r"^\s*-\s+name:\s+cors\s*$", line):
            i += 1
            continue
        list_indent = len(line) - len(line.lstrip())
        i += 1
        while i < len(lines) and not lines[i].strip():
            i += 1
        if i >= len(lines):
            break
        next_line = lines[i]
        # Misplaced: "config:" at same indent or less (sibling of list item or of "plugins:")
        next_indent = len(next_line) - len(next_line.lstrip())
        if re.match(r"^\s*config:\s*$", next_line) and next_indent <= list_indent:
            start_1based = i + 1
            while i < len(lines):
                ln = lines[i]
                if ln.strip():
                    indent = len(ln) - len(ln.lstrip())
                    if indent <= list_indent and re.match(r"^\s*-\s+name:\s*", ln):
                        break
                i += 1
            end_1based = i  # last removed line is i-1 (0-based) = line i (1-based)
            blocks.append((start_1based, end_1based))
        else:
            i += 1
    return blocks


def apply_fix(lines: list) -> tuple[list, int]:
    """Remove misplaced CORS config blocks. Returns (new_lines, number_of_blocks_removed)."""
    out = []
    i = 0
    removed = 0
    while i < len(lines):
        line = lines[i]
        if re.match(r"^\s*-\s+name:\s+cors\s*$", line):
            out.append(line)
            i += 1
            while i < len(lines) and not lines[i].strip():
                out.append(lines[i])
                i += 1
            if i >= len(lines):
                continue
            list_indent = len(line) - len(line.lstrip())
            config_indent = len(lines[i]) - len(lines[i].lstrip())
            if re.match(r"^\s*config:\s*$", lines[i]) and config_indent <= list_indent:
                # Skip from this line until next plugin at same indent
                while i < len(lines):
                    ln = lines[i]
                    if ln.strip():
                        indent = len(ln) - len(ln.lstrip())
                        if indent <= list_indent and re.match(r"^\s*-\s+name:\s*", ln):
                            break
                    i += 1
                removed += 1
                continue
        out.append(line)
        i += 1
    return out, removed


def main() -> int:
    check_only = "--check-only" in sys.argv
    args = [a for a in sys.argv[1:] if a != "--check-only"]
    if len(args) != 1:
        print("Usage: fix-kong-cors-yaml.py [--check-only] /path/to/kong.yml", file=sys.stderr)
        return 2
    path = Path(args[0])
    if not path.exists():
        print(f"[ERROR] File not found: {path}", file=sys.stderr)
        return 2
    text = path.read_text()
    lines = text.splitlines(keepends=True)
    blocks = find_misplaced_cors_blocks(lines)
    if check_only:
        if blocks:
            print(f"[CHECK] Found {len(blocks)} misplaced CORS config block(s) at line(s):", file=sys.stderr)
            for start, end in blocks:
                print(f"  {start}-{end}", file=sys.stderr)
            print("Run kong-safe-repair.sh or fix-kong-cors-yaml.py without --check-only to fix.", file=sys.stderr)
            return 1
        print("[CHECK] No misplaced CORS config blocks found. kong.yml structure is OK.")
        return 0
    if not blocks:
        print("[FIX] No misplaced CORS config blocks. No change (idempotent).")
        return 0
    new_lines, removed = apply_fix(lines)
    path.write_text("".join(new_lines))
    print(f"[FIX] Removed {removed} misplaced CORS config block(s). kong.yml updated.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
