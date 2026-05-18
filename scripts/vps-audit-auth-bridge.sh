#!/bin/bash
# Read-only: verify baked Supabase URL in JS + auth health through public ERP and local port.
# Run from repo root: bash scripts/vps-audit-auth-bridge.sh
set -euo pipefail
ROOT="$(git -C "$(dirname "$0")/.." rev-parse --show-toplevel 2>/dev/null)" || ROOT=""
if [ -z "$ROOT" ] || [ ! -f "$ROOT/.env.production" ]; then
  ROOT="${VPS_AUDIT_REPO:-/root/NEWPOSV3}"
fi
cd "$ROOT"

echo "=== JS bundles mentioning erp.dincouture.pk (first 5 files) ==="
if docker exec erp-frontend sh -c 'test -d /usr/share/nginx/html/assets' 2>/dev/null; then
  docker exec erp-frontend sh -c 'grep -l "erp.dincouture.pk" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -5' || true
else
  echo "(erp-frontend container not running — skip bundle grep)"
fi

echo "=== placeholder.supabase.co occurrences (should be empty) ==="
docker exec erp-frontend sh -c 'grep -l "placeholder.supabase.co" /usr/share/nginx/html/assets/*.js 2>/dev/null | head -3' || true

SUPABASE_DOCKER_ENV="${SUPABASE_DOCKER_ENV:-/root/supabase/docker/.env}" \
REPO_ROOT="$ROOT" \
python3 <<'PY'
import json
import os
import sys
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

root = Path(os.environ["REPO_ROOT"])
sb_env = Path(os.environ.get("SUPABASE_DOCKER_ENV", "/root/supabase/docker/.env"))


def load_val(path: Path, key: str) -> str:
    if not path.is_file():
        return ""
    text = path.read_text(encoding="utf-8", errors="replace")
    for line in text.splitlines():
        if line.startswith(f"{key}="):
            return line[len(key) + 1 :].strip().strip('"').strip("'")
    return ""


def jwt_segments(s: str) -> int:
    return len(s.split(".")) if s else 0


def get_health(url: str, apikey: str) -> tuple[int, str]:
    if not apikey:
        return 0, "(no apikey)"
    req = Request(
        url,
        headers={"apikey": apikey, "Authorization": f"Bearer {apikey}"},
        method="GET",
    )
    try:
        with urlopen(req, timeout=25) as r:
            body = r.read(400).decode("utf-8", errors="replace")
            return r.getcode() or 200, body
    except HTTPError as e:
        body = e.read(400).decode("utf-8", errors="replace")
        return e.code, body
    except URLError as e:
        return -1, str(e.reason)[:200]
    except Exception as e:
        return -2, str(e)[:200]


prod = root / ".env.production"
url = load_val(prod, "VITE_SUPABASE_URL")
erp_anon = load_val(prod, "VITE_SUPABASE_ANON_KEY")
kong_anon = load_val(sb_env, "ANON_KEY") if sb_env.is_file() else ""

print("=== .env.production (URL + anon length only) ===")
print(f"VITE_SUPABASE_URL={url or '(missing)'}")
print(f"erp_anon_length={len(erp_anon)} jwt_segments={jwt_segments(erp_anon)}")
if kong_anon:
    print(f"kong_anon_length={len(kong_anon)} jwt_segments={jwt_segments(kong_anon)} (from {sb_env})")
else:
    print(f"kong_anon_length=0 (no {sb_env})")

if kong_anon and erp_anon and kong_anon != erp_anon:
    print(
        "WARN: VITE_SUPABASE_ANON_KEY in .env.production differs from Supabase docker ANON_KEY; "
        "re-run deploy write-erp-env / rebuild erp-frontend so the browser matches Kong."
    )

checks = [
    ("public_erp_http", "https://erp.dincouture.pk/auth/v1/health", erp_anon, "ERP .env anon"),
    ("local_3001_http", "http://127.0.0.1:3001/auth/v1/health", erp_anon, "ERP .env anon"),
]
if kong_anon and kong_anon != erp_anon:
    checks += [
        ("public_erp_kong_anon_http", "https://erp.dincouture.pk/auth/v1/health", kong_anon, "docker ANON_KEY"),
        ("local_3001_kong_anon_http", "http://127.0.0.1:3001/auth/v1/health", kong_anon, "docker ANON_KEY"),
    ]

for code_name, health_url, key, key_label in checks:
    print(f"=== Auth /health ({code_name}) [{key_label}] ===")
    code, body = get_health(health_url, key)
    print(f"{code_name}={code}")
    snippet = body.strip().replace("\n", " ")[:220]
    print(snippet)
PY
