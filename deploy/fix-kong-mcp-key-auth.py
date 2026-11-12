#!/usr/bin/env python3
"""
Replace localhost-only ip-restriction on Kong /mcp with key-auth + admin ACL.
Run: python3 deploy/fix-kong-mcp-key-auth.py /root/supabase/docker/volumes/api/kong.yml
"""
from __future__ import annotations

import sys

KEY_AUTH_ACL_LINES = [
    "      - name: key-auth\n",
    "        config:\n",
    "          hide_credentials: false\n",
    "      - name: acl\n",
    "        config:\n",
    "          hide_groups_header: true\n",
    "          allow:\n",
    "            - admin\n",
]


def main() -> int:
    path = sys.argv[1] if len(sys.argv) > 1 else "/root/supabase/docker/volumes/api/kong.yml"
    with open(path, "r", encoding="utf-8") as f:
        lines = f.readlines()

    out: list[str] = []
    i = 0
    replaced = False
    in_mcp_service = False

    while i < len(lines):
        line = lines[i]

        if line == "  - name: mcp\n":
            in_mcp_service = True
        elif in_mcp_service and (line.startswith("  ##") or line.startswith("  - name: ")):
            if not line.startswith("      "):
                in_mcp_service = False

        if (
            in_mcp_service
            and not replaced
            and line.strip() == "- name: ip-restriction"
        ):
            out.extend(KEY_AUTH_ACL_LINES)
            replaced = True
            i += 1
            while i < len(lines) and not (
                lines[i].startswith("  ##") or lines[i].startswith("  - name:")
            ):
                i += 1
            continue

        out.append(line)
        i += 1

    if not replaced:
        if any("name: key-auth" in l for l in out) and any(
            "name: mcp" in l for l in lines
        ):
            # Already patched — check mcp section has key-auth after cors
            text = "".join(lines)
            mcp_idx = text.find("  - name: mcp\n")
            if mcp_idx >= 0:
                section = text[mcp_idx : mcp_idx + 2500]
                if "key-auth" in section and "ip-restriction" not in section:
                    print("[fix-kong-mcp-key-auth] Already patched (key-auth present, no ip-restriction).")
                    return 0
        print("[fix-kong-mcp-key-auth] ERROR: ip-restriction block on mcp service not found.", file=sys.stderr)
        return 1

    with open(path, "w", encoding="utf-8") as f:
        f.writelines(out)
    print("[fix-kong-mcp-key-auth] Replaced ip-restriction with key-auth + admin ACL on /mcp.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
