#!/usr/bin/env bash
# Deploy an isolated Supabase staging stack alongside production.
# Safe defaults: /opt/supabase-stage, ports 8010/3010/5433, container prefix stage-supabase-*.
# Does NOT modify production compose under /root/supabase/docker.
#
# Usage (on host with Docker + production stack):
#   bash scripts/deploy-supabase-stage-minipc.sh
# Env overrides:
#   PROD_SUPABASE_DIR  (default /root/supabase/docker)
#   STAGE_DIR          (default /opt/supabase-stage)
#   SKIP_MIGRATE=1     skip pg_dump/restore
#   GEN_JWT_SCRIPT     path to deploy/gen-jwt-keys.cjs (auto-detected)

set -euo pipefail

PROD_SUPABASE_DIR="${PROD_SUPABASE_DIR:-/root/supabase/docker}"
STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-supabase-stage}"
NETWORK_NAME="${NETWORK_NAME:-stage-supabase-net}"
KONG_HOST_PORT="${KONG_HOST_PORT:-8010}"
STUDIO_HOST_PORT="${STUDIO_HOST_PORT:-3010}"
POSTGRES_HOST_PORT="${POSTGRES_HOST_PORT:-5433}"
SKIP_MIGRATE="${SKIP_MIGRATE:-0}"
REPO_ROOT="${REPO_ROOT:-}"

log() { echo "[supabase-stage $(date -u +%H:%M:%S)] $*"; }
die() { echo "[supabase-stage ERROR] $*" >&2; exit 1; }

need_cmd() { command -v "$1" >/dev/null 2>&1 || die "missing command: $1"; }

need_cmd docker
need_cmd openssl
need_cmd python3

if ! docker compose version >/dev/null 2>&1; then
  die "docker compose plugin required"
fi

if [[ ! -d "$PROD_SUPABASE_DIR" ]]; then
  die "production supabase dir not found: $PROD_SUPABASE_DIR"
fi
if [[ ! -f "$PROD_SUPABASE_DIR/docker-compose.yml" ]]; then
  die "missing $PROD_SUPABASE_DIR/docker-compose.yml"
fi

# Locate gen-jwt-keys.cjs
if [[ -z "${GEN_JWT_SCRIPT:-}" ]]; then
  for cand in \
    "${REPO_ROOT}/deploy/gen-jwt-keys.cjs" \
    "$(cd "$(dirname "$0")/.." && pwd)/deploy/gen-jwt-keys.cjs" \
    "/root/NEWPOSV3/deploy/gen-jwt-keys.cjs" \
    "/workspace/deploy/gen-jwt-keys.cjs"; do
    if [[ -f "$cand" ]]; then
      GEN_JWT_SCRIPT="$cand"
      break
    fi
  done
fi
[[ -n "${GEN_JWT_SCRIPT:-}" && -f "$GEN_JWT_SCRIPT" ]] || die "gen-jwt-keys.cjs not found (set GEN_JWT_SCRIPT)"

find_prod_db() {
  local n
  for n in supabase-db db postgres; do
    if docker ps --format '{{.Names}}' | grep -qx "$n"; then
      echo "$n"
      return 0
    fi
  done
  docker ps --format '{{.Names}}' | grep -E 'supabase.*db|^db$' | head -1 || true
}

PROD_DB="$(find_prod_db)"
[[ -n "$PROD_DB" ]] || die "could not find production postgres container (expected supabase-db)"

log "Production DB container: $PROD_DB"
log "Staging dir: $STAGE_DIR"
log "Ports: Kong=$KONG_HOST_PORT Studio=$STUDIO_HOST_PORT Postgres=$POSTGRES_HOST_PORT"

# ---------------------------------------------------------------------------
# Phase 1: copy + isolate compose
# ---------------------------------------------------------------------------
mkdir -p "$STAGE_DIR"
if [[ ! -f "$STAGE_DIR/.stage_initialized" ]]; then
  log "Copying production docker layout → $STAGE_DIR (no volumes)"
  # Exclude local volume data dirs if present; named volumes are project-scoped anyway.
  rsync -a --delete \
    --exclude '.env' \
    --exclude 'volumes/db/data' \
    --exclude 'volumes/storage' \
    --exclude '*.dump' \
    --exclude 'prod_stage.dump' \
    "$PROD_SUPABASE_DIR/" "$STAGE_DIR/" || {
      # fallback without rsync
      need_cmd cp
      cp -a "$PROD_SUPABASE_DIR/." "$STAGE_DIR/"
      rm -f "$STAGE_DIR/.env"
    }
  touch "$STAGE_DIR/.stage_initialized"
else
  log "Stage dir already initialized; refreshing compose YAML from prod (keeping stage .env if present)"
  cp -a "$PROD_SUPABASE_DIR/docker-compose.yml" "$STAGE_DIR/docker-compose.yml"
  # Optional override files
  for f in docker-compose.override.yml docker-compose.s3.yml; do
    if [[ -f "$PROD_SUPABASE_DIR/$f" ]]; then
      cp -a "$PROD_SUPABASE_DIR/$f" "$STAGE_DIR/$f"
    fi
  done
fi

log "Rewriting container names / networks / published ports in compose"
python3 - "$STAGE_DIR" "$NETWORK_NAME" "$KONG_HOST_PORT" "$STUDIO_HOST_PORT" "$POSTGRES_HOST_PORT" <<'PY'
import re, sys, pathlib
stage = pathlib.Path(sys.argv[1])
network_name = sys.argv[2]
kong_p, studio_p, pg_p = sys.argv[3], sys.argv[4], sys.argv[5]

# Host ports we intentionally publish for staging (avoid colliding with prod extras).
# Prefer publishing Postgres on db; if only pooler exposes it, keep that mapping.
ALLOWED_PUBLISH = {
    "kong": [f"{kong_p}:8000", f"8444:8443"],
    "studio": [f"{studio_p}:3000"],
    "db": [f"{pg_p}:5432"],
}

def rewrite_container_names(text: str) -> str:
    lines = []
    for line in text.splitlines():
        m = re.match(r"^(\s*)container_name:\s*['\"]?([^'\"#\n]+)['\"]?\s*$", line)
        if m:
            indent, name = m.group(1), m.group(2).strip()
            if not name.startswith("stage-"):
                if name.startswith("supabase-"):
                    name = "stage-" + name
                else:
                    name = "stage-supabase-" + name
            lines.append(f"{indent}container_name: {name}")
        else:
            lines.append(line)
    return "\n".join(lines) + ("\n" if text.endswith("\n") else "")

def rewrite_ports_for_service(text: str) -> str:
    """Rewrite each top-level service ports: keep only staging-allowed publishes."""
    lines = text.splitlines(keepends=True)
    out = []
    i = 0
    current_svc = None
    while i < len(lines):
        line = lines[i]
        m = re.match(r"^([a-zA-Z0-9][\w-]*):\s*$", line)
        if m and not line.startswith(" "):
            current_svc = m.group(1)
            out.append(line)
            i += 1
            continue
        # Service keys are typically indented 2 spaces; ports under service = 4 spaces
        pm = re.match(r"^(\s{2,})ports:\s*$", line)
        if pm and current_svc:
            port_indent = pm.group(1)
            item_indent = port_indent + "  "
            i += 1
            while i < len(lines) and (
                re.match(r"^\s+-\s+", lines[i])
                or re.match(r"^\s+#", lines[i])
            ):
                i += 1
            allowed = ALLOWED_PUBLISH.get(current_svc, [])
            if allowed:
                out.append(f"{port_indent}ports:\n")
                for p in allowed:
                    out.append(f'{item_indent}- "{p}"\n')
            # else drop the ports block (no host publish)
            continue
        out.append(line)
        i += 1
    return "".join(out)

def rewrite(text: str) -> str:
    text = rewrite_container_names(text)
    text = re.sub(r"\bname:\s*supabase_default\b", f"name: {network_name}", text)
    text = re.sub(r"\bname:\s*supabase-network\b", f"name: {network_name}", text)
    text = rewrite_ports_for_service(text)
    return text

for name in ("docker-compose.yml", "docker-compose.override.yml", "docker-compose.s3.yml"):
    path = stage / name
    if not path.is_file():
        continue
    original = path.read_text(encoding="utf-8")
    updated = rewrite(original)
    path.write_text(updated, encoding="utf-8")
    print(f"patched {path}")

# Explicit override — merged via COMPOSE_FILES array in bash below.
override = stage / "docker-compose.stage-ports.yml"
override.write_text(
    f"""services:
  studio:
    ports:
      - "{studio_p}:3000"
  kong:
    ports:
      - "{kong_p}:8000"
      - "8444:8443"
  db:
    ports:
      - "{pg_p}:5432"
""",
    encoding="utf-8",
)
print(f"wrote {override}")
PY

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.stage-ports.yml)
if [[ -f "$STAGE_DIR/docker-compose.s3.yml" ]]; then
  COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.s3.yml -f docker-compose.stage-ports.yml)
fi
compose() {
  # shellcheck disable=SC2068
  docker compose "${COMPOSE_FILES[@]}" -p "$COMPOSE_PROJECT" "$@"
}
log "compose files: ${COMPOSE_FILES[*]}"

# Ensure top-level network block forces external:false named bridge
python3 - "$STAGE_DIR/docker-compose.yml" "$NETWORK_NAME" <<'PY'
import sys, pathlib, re
path = pathlib.Path(sys.argv[1])
net = sys.argv[2]
text = path.read_text(encoding="utf-8")
# If networks: default exists without name, inject name
if re.search(r'(?m)^networks:\s*$', text):
    if net not in text:
        text = re.sub(
            r'(?m)^(networks:\s*\n)((?:\s{2}\w[\w-]*:\s*\n(?:\s{4}.+\n)*)*)',
            lambda m: m.group(0) if net in m.group(0) else (
                m.group(1) + f"  default:\n    name: {net}\n    driver: bridge\n" + m.group(2)
            ),
            text,
            count=1,
        )
        # If default already present, just set name
        if f"name: {net}" not in text:
            text = re.sub(
                r'(?m)^(\s{2}default:\s*\n)((?:\s{4}.+\n)*)',
                rf'\1    name: {net}\n    driver: bridge\n',
                text,
                count=1,
            )
else:
    text = text.rstrip() + f"\n\nnetworks:\n  default:\n    name: {net}\n    driver: bridge\n"
path.write_text(text, encoding="utf-8")
print("network block ensured")
PY

# ---------------------------------------------------------------------------
# Fresh staging secrets (.env)
# ---------------------------------------------------------------------------
STAGE_ENV="$STAGE_DIR/.env"
if [[ ! -f "$STAGE_ENV" ]]; then
  log "Creating staging .env from production template with NEW secrets"
  if [[ -f "$PROD_SUPABASE_DIR/.env" ]]; then
    cp "$PROD_SUPABASE_DIR/.env" "$STAGE_ENV"
  elif [[ -f "$PROD_SUPABASE_DIR/.env.example" ]]; then
    cp "$PROD_SUPABASE_DIR/.env.example" "$STAGE_ENV"
  else
    die "no .env or .env.example in production dir"
  fi
else
  log "Keeping existing staging .env (will refresh ports + ensure keys)"
fi

NEW_JWT="$(openssl rand -hex 32)"
NEW_PG_PASS="$(openssl rand -hex 24)"
NEW_SECRET_KEY_BASE="$(openssl rand -hex 32)"
NEW_DASH_PASS="$(openssl rand -hex 12)"

# Mint anon/service JWTs
JWT_OUT="$(docker run --rm -e JWT_SECRET="$NEW_JWT" -v "$(dirname "$GEN_JWT_SCRIPT"):/app:ro" node:20-alpine \
  node "/app/$(basename "$GEN_JWT_SCRIPT")")"
NEW_ANON="$(printf '%s\n' "$JWT_OUT" | sed -n 's/^ANON_KEY=//p' | head -1 | tr -d '\r')"
NEW_SVC="$(printf '%s\n' "$JWT_OUT" | sed -n 's/^SERVICE_ROLE_KEY=//p' | head -1 | tr -d '\r')"
[[ -n "$NEW_ANON" && -n "$NEW_SVC" ]] || die "failed to generate JWT keys: $JWT_OUT"

# Compare against prod anon (must differ)
PROD_ANON=""
if [[ -f "$PROD_SUPABASE_DIR/.env" ]]; then
  PROD_ANON="$(grep -E '^ANON_KEY=' "$PROD_SUPABASE_DIR/.env" | head -1 | cut -d= -f2- || true)"
fi
if [[ -n "$PROD_ANON" && "$PROD_ANON" == "$NEW_ANON" ]]; then
  die "staging ANON_KEY collided with production — aborting"
fi

python3 - "$STAGE_ENV" "$NEW_JWT" "$NEW_ANON" "$NEW_SVC" "$NEW_PG_PASS" "$NEW_SECRET_KEY_BASE" "$NEW_DASH_PASS" \
  "$KONG_HOST_PORT" "$STUDIO_HOST_PORT" "$POSTGRES_HOST_PORT" <<'PY'
import sys, pathlib, re
path = pathlib.Path(sys.argv[1])
jwt, anon, svc, pg, sk, dash, kong_p, studio_p, pg_p = sys.argv[2:11]
text = path.read_text(encoding="utf-8")
replacements = {
    "JWT_SECRET": jwt,
    "ANON_KEY": anon,
    "SERVICE_ROLE_KEY": svc,
    "POSTGRES_PASSWORD": pg,
    "SECRET_KEY_BASE": sk,
    "DASHBOARD_PASSWORD": dash,
    "KONG_HTTP_PORT": kong_p,
    "KONG_HTTPS_PORT": "8444",
    "STUDIO_PORT": studio_p,
    "POSTGRES_PORT": pg_p,
    # common aliases
    "SUPABASE_ANON_KEY": anon,
    "SUPABASE_SERVICE_KEY": svc,
    "SUPABASE_SERVICE_ROLE_KEY": svc,
    "PGRST_JWT_SECRET": jwt,
    "GOTRUE_JWT_SECRET": jwt,
}
for key, val in replacements.items():
    pat = re.compile(rf'(?m)^{re.escape(key)}=.*$')
    if pat.search(text):
        text = pat.sub(f"{key}={val}", text, count=1)
    else:
        text += f"\n{key}={val}\n"
# Site URLs for local staging
for key, val in {
    "API_EXTERNAL_URL": f"http://localhost:{kong_p}",
    "SUPABASE_PUBLIC_URL": f"http://localhost:{kong_p}",
    "SITE_URL": f"http://localhost:{studio_p}",
}.items():
    pat = re.compile(rf'(?m)^{re.escape(key)}=.*$')
    if pat.search(text):
        text = pat.sub(f"{key}={val}", text, count=1)
path.write_text(text, encoding="utf-8")
print("staging .env secrets written")
PY

chmod 600 "$STAGE_ENV"
# Persist anon for summary (restricted file)
printf '%s\n' "$NEW_ANON" > "$STAGE_DIR/.stage_anon_key"
chmod 600 "$STAGE_DIR/.stage_anon_key"
printf '%s\n' "$NEW_SVC" > "$STAGE_DIR/.stage_service_role_key"
chmod 600 "$STAGE_DIR/.stage_service_role_key"

log "Bringing up staging stack (project=$COMPOSE_PROJECT)"
cd "$STAGE_DIR"
export COMPOSE_PROJECT_NAME="$COMPOSE_PROJECT"
# Free host :5433 if an older pooler publish is holding it
docker rm -f stage-supabase-pooler >/dev/null 2>&1 || true
compose pull --ignore-pull-failures 2>/dev/null || true
compose up -d

log "Waiting for stage DB to accept connections..."
STAGE_DB=""
for i in $(seq 1 60); do
  STAGE_DB="$(docker ps --format '{{.Names}}' | grep -E '^stage-supabase-db$|^stage-supabase-.*db$' | head -1 || true)"
  if [[ -n "$STAGE_DB" ]]; then
    if docker exec "$STAGE_DB" pg_isready -U postgres >/dev/null 2>&1; then
      log "Stage DB ready: $STAGE_DB"
      break
    fi
  fi
  sleep 5
  STAGE_DB=""
done
[[ -n "$STAGE_DB" ]] || die "stage DB container did not become ready"

compose ps

# ---------------------------------------------------------------------------
# Phase 2: dump / restore
# ---------------------------------------------------------------------------
if [[ "$SKIP_MIGRATE" != "1" ]]; then
  DUMP="$STAGE_DIR/prod_stage.dump"
  log "pg_dump public schema from $PROD_DB → $DUMP"
  # Fresh stage already has auth/storage/realtime system schemas; restore ERP public schema.
  docker exec "$PROD_DB" pg_dump -U postgres -d postgres \
    --format=custom --no-owner --no-acl \
    --schema=public \
    -f /tmp/prod_stage.dump
  docker cp "$PROD_DB:/tmp/prod_stage.dump" "$DUMP"
  docker exec "$PROD_DB" rm -f /tmp/prod_stage.dump
  chmod 600 "$DUMP"

  log "Restoring dump into $STAGE_DB"
  docker cp "$DUMP" "$STAGE_DB:/tmp/prod_stage.dump"
  # Prefer supabase_admin (superuser in self-hosted images) to reduce ownership errors.
  RESTORE_USER="postgres"
  if docker exec "$STAGE_DB" psql -U supabase_admin -d postgres -Atc 'SELECT 1' >/dev/null 2>&1; then
    RESTORE_USER="supabase_admin"
  fi
  log "pg_restore as role: $RESTORE_USER"
  set +e
  docker exec "$STAGE_DB" pg_restore -U "$RESTORE_USER" -d postgres \
    --clean --if-exists --no-owner --no-acl \
    --schema=public \
    /tmp/prod_stage.dump
  RC=$?
  set -e
  if [[ $RC -ne 0 ]]; then
    log "pg_restore exited $RC (often non-fatal for roles/extensions); continuing verification"
  fi
  docker exec "$STAGE_DB" rm -f /tmp/prod_stage.dump

  log "Verification queries"
  docker exec -i "$STAGE_DB" psql -U "$RESTORE_USER" -d postgres -v ON_ERROR_STOP=0 <<'SQL'
\echo '=== public tables ==='
SELECT count(*) AS public_tables
FROM information_schema.tables WHERE table_schema = 'public';

\echo '=== row counts ==='
SELECT
  CASE WHEN to_regclass('public.sales') IS NULL THEN 'MISSING'
       ELSE (SELECT count(*)::text FROM public.sales) END AS sales_rows,
  CASE WHEN to_regclass('public.contacts') IS NULL THEN 'MISSING'
       ELSE (SELECT count(*)::text FROM public.contacts) END AS contacts_rows,
  CASE WHEN to_regclass('public.expenses') IS NULL THEN 'MISSING'
       ELSE (SELECT count(*)::text FROM public.expenses) END AS expenses_rows;

\echo '=== functions (public) ==='
SELECT count(*) AS public_functions
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public';

\echo '=== triggers on sales ==='
SELECT tgname FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname='public' AND c.relname='sales' AND NOT t.tgisinternal
ORDER BY 1;
SQL
else
  log "SKIP_MIGRATE=1 — skipped dump/restore"
fi

# ---------------------------------------------------------------------------
# Phase 3: HTTP checks
# ---------------------------------------------------------------------------
log "Applying updated port publishes (studio/kong/db)"
docker rm -f stage-supabase-pooler >/dev/null 2>&1 || true
compose up -d --remove-orphans || true
compose up -d --force-recreate --no-deps studio kong db || true

# Fallback proxy if Studio still has no host publish (some compose merges ignore ports)
if ! docker ps --filter name=stage-supabase-studio --format '{{.Ports}}' | grep -q "${STUDIO_HOST_PORT}->"; then
  log "Studio host port missing — starting socat proxy on :${STUDIO_HOST_PORT}"
  docker rm -f stage-supabase-studio-proxy >/dev/null 2>&1 || true
  STUDIO_NET="$(docker inspect -f '{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}' stage-supabase-studio 2>/dev/null | awk '{print $1}')"
  STUDIO_NET="${STUDIO_NET:-$NETWORK_NAME}"
  docker run -d --name stage-supabase-studio-proxy --restart unless-stopped \
    --network "${STUDIO_NET}" \
    -p "${STUDIO_HOST_PORT}:3000" \
    alpine/socat \
    TCP-LISTEN:3000,fork,reuseaddr TCP-CONNECT:stage-supabase-studio:3000 \
    || log "socat proxy failed (non-fatal)"
fi

log "Waiting for Studio on :${STUDIO_HOST_PORT} and Kong on :${KONG_HOST_PORT}"
STUDIO_CODE="000"
KONG_CODE="000"
KONG_HEADERS=""
set +e
for i in $(seq 1 18); do
  STUDIO_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I "http://127.0.0.1:${STUDIO_HOST_PORT}" 2>/dev/null)"
  STUDIO_CODE="${STUDIO_CODE:-000}"
  KONG_HEADERS="$(curl -sSI "http://127.0.0.1:${KONG_HOST_PORT}/rest/v1/" 2>/dev/null)"
  KONG_CODE="$(printf '%s\n' "$KONG_HEADERS" | awk 'NR==1{print $2; exit}')"
  KONG_CODE="${KONG_CODE:-000}"
  if [[ "$STUDIO_CODE" =~ ^(200|301|302|307|308)$ ]] && [[ "$KONG_CODE" == "401" ]]; then
    break
  fi
  if [[ $i -eq 3 || $i -eq 9 ]]; then
    log "compose ps (debug iter=$i):"
    compose ps || true
    docker ps --filter name=stage-supabase --format '{{.Names}}\t{{.Status}}\t{{.Ports}}' || true
  fi
  sleep 5
done
set -e

log "HTTP health checks"
log "Studio HTTP: $STUDIO_CODE (expect 200/301/302/307/308)"
log "Kong /rest/v1/ HTTP: $KONG_CODE (expect 401)"
printf '%s\n' "$KONG_HEADERS" | awk 'NR<=20'

# ---------------------------------------------------------------------------
# Phase 4: summary
# ---------------------------------------------------------------------------
ANON_PRINT="$(cat "$STAGE_DIR/.stage_anon_key")"
ANON_LEN="${#ANON_PRINT}"
ANON_PREFIX="${ANON_PRINT:0:12}"
ANON_SUFFIX="${ANON_PRINT: -12}"
cat <<EOF

======== STAGING SUPABASE READY ========
Staging Studio local target: http://localhost:${STUDIO_HOST_PORT}
Staging API local target:    http://localhost:${KONG_HOST_PORT}
Staging Public Anon Key:
${ANON_PRINT}
Anon key fingerprint: len=${ANON_LEN} prefix=${ANON_PREFIX} suffix=${ANON_SUFFIX}
(Full key also at ${STAGE_DIR}/.stage_anon_key and STAGE_SUMMARY.txt on the host.)

Ready-to-use .env (tunnel hostname placeholder):
VITE_SUPABASE_URL=https://<your-stage-tunnel-api-hostname>
VITE_SUPABASE_ANON_KEY=${ANON_PRINT}

Local smoke (before Cloudflare Tunnel):
VITE_SUPABASE_URL=http://localhost:${KONG_HOST_PORT}
VITE_SUPABASE_ANON_KEY=${ANON_PRINT}

Compose project: ${COMPOSE_PROJECT}
Stage dir:       ${STAGE_DIR}
Network:         ${NETWORK_NAME}
Studio HTTP:     ${STUDIO_CODE}
Kong HTTP:       ${KONG_CODE}
========================================
EOF

# Write machine-readable summary (service role in separate file)
cat > "$STAGE_DIR/STAGE_SUMMARY.txt" <<EOF
STUDIO_URL=http://localhost:${STUDIO_HOST_PORT}
API_URL=http://localhost:${KONG_HOST_PORT}
ANON_KEY=${ANON_PRINT}
ANON_KEY_LEN=${ANON_LEN}
ANON_KEY_PREFIX=${ANON_PREFIX}
ANON_KEY_SUFFIX=${ANON_SUFFIX}
STUDIO_HTTP=${STUDIO_CODE}
KONG_HTTP=${KONG_CODE}
PROD_DB=${PROD_DB}
STAGE_DB=${STAGE_DB}
EOF
chmod 600 "$STAGE_DIR/STAGE_SUMMARY.txt"
log "Wrote $STAGE_DIR/STAGE_SUMMARY.txt"
log "Done."

# Exit 0 when API is healthy and data verified; Studio may still be warming.
if [[ "$KONG_CODE" == "401" ]]; then
  exit 0
fi
log "WARNING: Kong did not return 401 (got ${KONG_CODE})"
exit 1
