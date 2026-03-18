#!/usr/bin/env python3
"""Write ANON_KEY and SERVICE_ROLE_KEY to Supabase .env from gen-jwt-keys output. No shell $ expansion."""
import os
import re
import subprocess
import sys

def main():
    env_path = "/root/supabase/docker/.env"
    erp_env_path = "/root/NEWPOSV3/.env.production"
    if not os.path.isfile(env_path):
        print("Missing", env_path)
        sys.exit(1)
    jwt_secret = None
    with open(env_path) as f:
        for line in f:
            if line.startswith("JWT_SECRET="):
                jwt_secret = line.split("=", 1)[1].strip().strip("\r\n")
                break
    if not jwt_secret:
        print("JWT_SECRET not found in", env_path)
        sys.exit(1)
    out = subprocess.run(
        ["docker", "run", "--rm", "-e", "JWT_SECRET=" + jwt_secret,
         "-v", "/root/NEWPOSV3/deploy:/app", "node:20-alpine", "node", "/app/gen-jwt-keys.cjs"],
        capture_output=True, text=True, cwd="/root/NEWPOSV3", timeout=30
    )
    if out.returncode != 0:
        print("gen-jwt-keys failed:", out.stderr)
        sys.exit(1)
    text = (out.stdout or "").strip()
    anon_m = re.search(r"ANON_KEY=([^\s]+)", text)
    svc_m = re.search(r"SERVICE_ROLE_KEY=([^\s]+)", text)
    if not anon_m or not svc_m:
        print("Could not parse keys from output")
        sys.exit(1)
    new_anon = anon_m.group(1).rstrip()
    new_svc = svc_m.group(1).rstrip()
    lines = []
    with open(env_path) as f:
        for line in f:
            if line.startswith("ANON_KEY=") or line.startswith("SERVICE_ROLE_KEY="):
                continue
            lines.append(line)
    lines.append("ANON_KEY=%s\n" % new_anon)
    lines.append("SERVICE_ROLE_KEY=%s\n" % new_svc)
    with open(env_path, "w") as f:
        f.writelines(lines)
    print("Updated", env_path, "Anon length:", len(new_anon))
    if os.path.isfile(erp_env_path):
        erp_lines = []
        with open(erp_env_path) as f:
            for line in f:
                if line.startswith("VITE_SUPABASE_ANON_KEY="):
                    continue
                erp_lines.append(line)
        erp_lines.append("VITE_SUPABASE_ANON_KEY=%s\n" % new_anon)
        with open(erp_env_path, "w") as f:
            f.writelines(erp_lines)
        print("Updated", erp_env_path)
    # Recreate Kong
    subprocess.run(["docker", "compose", "up", "-d", "kong", "studio", "storage", "functions", "--force-recreate"],
                   cwd="/root/supabase/docker", timeout=120, capture_output=True)
    subprocess.run(["docker", "compose", "restart", "auth", "rest"], cwd="/root/supabase/docker", timeout=60, capture_output=True)
    print("Kong recreated.")

if __name__ == "__main__":
    main()
