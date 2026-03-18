#!/usr/bin/env python3
"""
Add key-auth plugin to auth-v1 and rest-v1 in kong.yml (before cors).
Run on VPS: python3 deploy/add-kong-key-auth-to-auth-rest.py /root/supabase/docker/volumes/api/kong.yml
Without key-auth, ACL has no consumer and can return 401.
"""
import sys

KEY_AUTH_LINES = [
    "      - name: key-auth\n",
    "        config:\n",
    "          hide_credentials: false\n",
]

def main():
    path = sys.argv[1] if len(sys.argv) > 1 else "/root/supabase/docker/volumes/api/kong.yml"
    with open(path, "r") as f:
        lines = f.readlines()

    out = []
    i = 0
    added_auth = added_rest = False
    while i < len(lines):
        line = lines[i]
        out.append(line)
        # After "    plugins:" if next line is "      - name: cors" and we're in auth-v1 or rest-v1 block, add key-auth
        if line.strip() == "plugins:" and i + 1 < len(lines) and lines[i + 1].strip() == "- name: cors":
            # Check previous lines for path
            path_line = ""
            for j in range(i - 1, max(-1, i - 15), -1):
                if "auth/v1/" in lines[j] or "rest/v1/" in lines[j]:
                    path_line = lines[j]
                    break
            if "/auth/v1/" in path_line and not added_auth:
                out.extend(KEY_AUTH_LINES)
                added_auth = True
                print("[add-kong-key-auth] Added key-auth to auth-v1")
            elif "/rest/v1/" in path_line and not added_rest:
                out.extend(KEY_AUTH_LINES)
                added_rest = True
                print("[add-kong-key-auth] Added key-auth to rest-v1")
        i += 1

    with open(path, "w") as f:
        f.writelines(out)
    print("[add-kong-key-auth] Done. Restart Kong: cd /root/supabase/docker && docker compose up -d kong --force-recreate")

if __name__ == "__main__":
    main()
