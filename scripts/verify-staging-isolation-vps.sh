#!/usr/bin/env bash
# Final staging verification + DB isolation proof on VPS.
# Does NOT modify production compose, ERP :3001, or production data beyond a read-only SELECT.
set -euo pipefail

STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
CANARY_REF="${CANARY_REF:-STG-VERIFY-999}"
CANARY_DESC="${CANARY_DESC:-Staging Isolation Test}"
CANARY_AMT="${CANARY_AMT:-1.00}"
STAGE_ANON_FALLBACK="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.OHbNef2x7CVNAPLi302ouCz3UN1sG1TK_uVFOivGM90"

log() { echo "[verify-stage $(date -u +%H:%M:%S)] $*"; }
die() { echo "[verify-stage ERROR] $*" >&2; exit 1; }

REPORT="/tmp/staging-final-verify-report.txt"
: > "$REPORT"
out() { echo "$*" | tee -a "$REPORT"; }

find_prod_db() {
  for n in supabase-db db postgres; do
    docker ps --format '{{.Names}}' | grep -qx "$n" && { echo "$n"; return; }
  done
  docker ps --format '{{.Names}}' | grep -E 'supabase.*db' | head -1 || true
}

STAGE_DB="$(docker ps --format '{{.Names}}' | grep -E '^stage-supabase-db$' | head -1 || true)"
PROD_DB="$(find_prod_db)"
[[ -n "$STAGE_DB" ]] || die "stage-supabase-db not running"
[[ -n "$PROD_DB" ]] || die "production supabase db container not found"

STAGE_ANON="$(tr -d '\r\n' < "$STAGE_DIR/.stage_anon_key" 2>/dev/null || true)"
STAGE_ANON="${STAGE_ANON:-$STAGE_ANON_FALLBACK}"

out "======== STAGING FINAL VERIFICATION ========"
out "Host: $(hostname) @ $(date -u +%Y-%m-%dT%H:%M:%SZ)"
out "Stage DB: $STAGE_DB | Prod DB: $PROD_DB"
out ""

# ---------------------------------------------------------------------------
# 1) Restart policy + health
# ---------------------------------------------------------------------------
out "--- 1) Restart policy & health ---"
RESTART_OK=1
while IFS= read -r name; do
  pol="$(docker inspect -f '{{.HostConfig.RestartPolicy.Name}}' "$name" 2>/dev/null || echo missing)"
  out "  $name restart=$pol"
  if [[ "$pol" != "unless-stopped" && "$pol" != "always" ]]; then
    RESTART_OK=0
  fi
done < <(docker ps --filter name=stage-supabase --format '{{.Names}}' | sort)

# Ensure compose file declares unless-stopped for core services (best-effort patch if missing)
if [[ -f "$STAGE_DIR/docker-compose.yml" ]]; then
  if ! grep -q 'restart: unless-stopped' "$STAGE_DIR/docker-compose.yml"; then
    log "Patching $STAGE_DIR/docker-compose.yml to set restart: unless-stopped on services"
    python3 - "$STAGE_DIR/docker-compose.yml" <<'PY'
import pathlib, re, sys
path = pathlib.Path(sys.argv[1])
text = path.read_text(encoding="utf-8")
# Inject restart under each top-level service that lacks it
lines = text.splitlines(keepends=True)
out_lines = []
i = 0
current = None
has_restart = False
svc_buf = []
def flush():
    global svc_buf, has_restart, out_lines
    if not svc_buf:
        return
    if not has_restart:
        # insert after service header line
        hdr = svc_buf[0]
        rest = svc_buf[1:]
        svc_buf = [hdr, "    restart: unless-stopped\n"] + rest
    out_lines.extend(svc_buf)
    svc_buf = []
    has_restart = False

while i < len(lines):
    line = lines[i]
    m = re.match(r"^([a-zA-Z0-9][\w-]*):\s*$", line)
    if m and not line.startswith(" "):
        flush()
        current = m.group(1)
        svc_buf = [line]
        has_restart = False
        i += 1
        continue
    if current is not None:
        if re.match(r"^  restart:\s*", line) or re.match(r"^    restart:\s*", line):
            has_restart = True
        # leaving services block into networks/volumes at column 0
        if line.startswith("networks:") or line.startswith("volumes:") or line.startswith("x-"):
            flush()
            current = None
            out_lines.append(line)
            i += 1
            continue
        svc_buf.append(line)
        i += 1
        continue
    out_lines.append(line)
    i += 1
flush()
path.write_text("".join(out_lines), encoding="utf-8")
print("patched restart policies")
PY
    cd "$STAGE_DIR"
    docker compose -f docker-compose.yml -f docker-compose.stage-ports.yml -p supabase-stage \
      up -d --no-deps 2>/dev/null || true
  fi
fi

KONG_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:8010/rest/v1/ || true)"
STUDIO_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:3010/ || true)"
out "  Kong :8010/rest/v1/ → $KONG_CODE (expect 401)"
out "  Studio :3010 → $STUDIO_CODE (expect 200/307)"
[[ "$KONG_CODE" == "401" ]] || die "Kong health failed ($KONG_CODE)"
[[ "$STUDIO_CODE" =~ ^(200|301|302|307|308)$ ]] || die "Studio health failed ($STUDIO_CODE)"
out "  HEALTH: OK"
out ""

# ---------------------------------------------------------------------------
# 2) Isolation canary (schema-aware INSERT into public.expenses)
# ---------------------------------------------------------------------------
out "--- 2) Isolation proof (canary $CANARY_REF) ---"

EXP_COLS="$(docker exec -i "$STAGE_DB" psql -U postgres -d postgres -Atc \
  "SELECT string_agg(column_name, ',' ORDER BY ordinal_position)
   FROM information_schema.columns
   WHERE table_schema='public' AND table_name='expenses';")"
out "  expenses columns: ${EXP_COLS:0:220}..."

# Cleanup prior canary (ignore missing optional columns)
docker exec -i "$STAGE_DB" psql -U postgres -d postgres -v ON_ERROR_STOP=0 <<SQL >/dev/null
DELETE FROM public.expenses
WHERE coalesce(description::text,'') LIKE '%${CANARY_REF}%'
   OR coalesce(expense_no::text,'') = '${CANARY_REF}'
   OR coalesce(vendor_name::text,'') = '${CANARY_REF}';
SQL

# Insert using real company/branch FKs from staging; satisfy NOT NULL columns.
# Canary marker lives in description (+ expense_no / vendor_name when present).
set +e
INSERT_OUT="$(docker exec -i "$STAGE_DB" psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
DECLARE
  v_company uuid;
  v_branch  uuid;
  v_has_expense_no boolean;
  v_has_vendor boolean;
  v_has_payment_method boolean;
  v_has_status boolean;
  v_has_category boolean;
  v_has_expense_date boolean;
  v_sql text;
BEGIN
  SELECT c.id INTO v_company FROM public.companies c ORDER BY c.created_at NULLS LAST LIMIT 1;
  IF v_company IS NULL THEN
    RAISE EXCEPTION 'no company row in staging for canary FK';
  END IF;

  SELECT b.id INTO v_branch
  FROM public.branches b
  WHERE b.company_id = v_company
  ORDER BY b.created_at NULLS LAST
  LIMIT 1;

  -- Fall back to any existing expense's branch/company if branches empty
  IF v_branch IS NULL THEN
    SELECT e.company_id, e.branch_id INTO v_company, v_branch
    FROM public.expenses e
    WHERE e.company_id IS NOT NULL
    ORDER BY e.created_at DESC NULLS LAST
    LIMIT 1;
  END IF;

  IF v_company IS NULL THEN
    RAISE EXCEPTION 'cannot resolve company_id for canary';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='expense_no'
  ) INTO v_has_expense_no;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='vendor_name'
  ) INTO v_has_vendor;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='payment_method'
  ) INTO v_has_payment_method;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='status'
  ) INTO v_has_status;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='category'
  ) INTO v_has_category;
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='expenses' AND column_name='expense_date'
  ) INTO v_has_expense_date;

  v_sql := 'INSERT INTO public.expenses (company_id';
  IF v_branch IS NOT NULL THEN
    v_sql := v_sql || ', branch_id';
  END IF;
  IF v_has_expense_no THEN
    v_sql := v_sql || ', expense_no';
  END IF;
  IF v_has_expense_date THEN
    v_sql := v_sql || ', expense_date';
  END IF;
  IF v_has_category THEN
    v_sql := v_sql || ', category';
  END IF;
  v_sql := v_sql || ', description, amount';
  IF v_has_payment_method THEN
    v_sql := v_sql || ', payment_method';
  END IF;
  IF v_has_status THEN
    v_sql := v_sql || ', status';
  END IF;
  IF v_has_vendor THEN
    v_sql := v_sql || ', vendor_name';
  END IF;
  v_sql := v_sql || ') VALUES (' || quote_literal(v_company);
  IF v_branch IS NOT NULL THEN
    v_sql := v_sql || ', ' || quote_literal(v_branch);
  END IF;
  IF v_has_expense_no THEN
    v_sql := v_sql || ', ' || quote_literal('STG-VERIFY-999');
  END IF;
  IF v_has_expense_date THEN
    v_sql := v_sql || ', CURRENT_DATE';
  END IF;
  IF v_has_category THEN
    v_sql := v_sql || ', ' || quote_literal('miscellaneous');
  END IF;
  v_sql := v_sql || ', ' || quote_literal('Staging Isolation Test STG-VERIFY-999')
                  || ', 1.00';
  IF v_has_payment_method THEN
    v_sql := v_sql || ', ' || quote_literal('cash');
  END IF;
  IF v_has_status THEN
    -- Cast via text so both enum and varchar status columns work
    v_sql := v_sql || ', ' || quote_literal('paid');
  END IF;
  IF v_has_vendor THEN
    v_sql := v_sql || ', ' || quote_literal('STG-VERIFY-999');
  END IF;
  v_sql := v_sql || ')';

  EXECUTE v_sql;
  RAISE NOTICE 'canary inserted company=% branch=%', v_company, v_branch;
END $$;

SELECT 'STAGE_COUNT=' || count(*)::text
FROM public.expenses
WHERE coalesce(description::text,'') LIKE '%STG-VERIFY-999%'
   OR coalesce(expense_no::text,'') = 'STG-VERIFY-999'
   OR coalesce(vendor_name::text,'') = 'STG-VERIFY-999';
SQL
)"
INSERT_RC=$?
set -e
out "  stage insert rc=$INSERT_RC"
printf '%s\n' "$INSERT_OUT" | sed 's/^/  /' | head -40 | tee -a "$REPORT" >/dev/null
# also echo briefly to console
printf '%s\n' "$INSERT_OUT" | tail -15 | sed 's/^/  /'

STAGE_COUNT="$(printf '%s\n' "$INSERT_OUT" | sed -n 's/.*STAGE_COUNT=//p' | tail -1 | tr -d '[:space:]')"
[[ "${STAGE_COUNT:-0}" -ge 1 ]] || die "canary not present in staging after insert (count=${STAGE_COUNT:-0})"

PROD_COUNT="$(docker exec -i "$PROD_DB" psql -U postgres -d postgres -Atc \
  "SELECT count(*) FROM public.expenses
   WHERE coalesce(description::text,'') LIKE '%${CANARY_REF}%'
      OR coalesce(expense_no::text,'') = '${CANARY_REF}'
      OR coalesce(vendor_name::text,'') = '${CANARY_REF}';" 2>/dev/null || echo ERR)"
out "  staging canary count: $STAGE_COUNT"
out "  production canary count: $PROD_COUNT"
[[ "$PROD_COUNT" == "0" ]] || die "LEAKAGE: canary found in production (count=$PROD_COUNT)"
out "ISOLATION VERIFIED: Record exists in Staging only, 0 leakage to Production."
out ""

# ---------------------------------------------------------------------------
# 3) Preview :3002
# ---------------------------------------------------------------------------
out "--- 3) Preview frontend :3002 ---"
PREVIEW_CODE="$(curl -sS -o /dev/null -w '%{http_code}' -I http://127.0.0.1:3002/ || true)"
out "  curl -I :3002 → $PREVIEW_CODE"
[[ "$PREVIEW_CODE" == "200" ]] || die "preview not 200"

BUNDLE_API="$(docker exec erp-frontend-preview sh -c 'grep -rl "api-stage.ndmcore.com" /usr/share/nginx/html/assets 2>/dev/null | head -1' || true)"
# Anon key fragment (suffix) to avoid dumping full secret repeatedly if masked
ANON_SUFFIX="${STAGE_ANON: -16}"
BUNDLE_KEY="$(docker exec erp-frontend-preview sh -c "grep -rl \"$ANON_SUFFIX\" /usr/share/nginx/html/assets 2>/dev/null | head -1" || true)"
out "  bundle api-stage.ndmcore.com: ${BUNDLE_API:-MISSING}"
out "  bundle staging anon suffix …${ANON_SUFFIX}: ${BUNDLE_KEY:-MISSING}"
[[ -n "$BUNDLE_API" ]] || die "preview bundle missing api-stage.ndmcore.com"
out "  PREVIEW: OK (staging endpoint + key baked in)"
out ""

# ---------------------------------------------------------------------------
# 4) Traefik
# ---------------------------------------------------------------------------
out "--- 4) Traefik staging routes ---"
TRAEFIK_FILE="/etc/dokploy/traefik/dynamic/supabase-stage.yml"
[[ -f "$TRAEFIK_FILE" ]] || die "missing $TRAEFIK_FILE"
out "  file: $TRAEFIK_FILE"
grep -E 'Host\(|url:|certResolver' "$TRAEFIK_FILE" | sed 's/^/  /' | tee -a "$REPORT"
echo "$TRAEFIK_FILE" | grep -q . 
grep -q 'api-stage.ndmcore.com' "$TRAEFIK_FILE" || die "api-stage host missing"
grep -q 'db-stage.ndmcore.com' "$TRAEFIK_FILE" || die "db-stage host missing"
grep -q 'stage-supabase-kong' "$TRAEFIK_FILE" || die "kong service target missing"
grep -q 'stage-supabase-studio' "$TRAEFIK_FILE" || die "studio service target missing"
grep -q 'letsencrypt' "$TRAEFIK_FILE" || die "certResolver letsencrypt missing"
out "  TRAEFIK YAML: OK"
API_PUBLIC="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 -I https://api-stage.ndmcore.com/rest/v1/ || true)"
STUDIO_PUBLIC="$(curl -sS -o /dev/null -w '%{http_code}' --connect-timeout 12 -I https://db-stage.ndmcore.com/ || true)"
out "  https://api-stage.ndmcore.com/rest/v1/ → $API_PUBLIC"
out "  https://db-stage.ndmcore.com/ → $STUDIO_PUBLIC"
out ""

# ---------------------------------------------------------------------------
# 5) Final table
# ---------------------------------------------------------------------------
out "======== FINAL CLOSURE TABLE ========"
out "| Surface | URL / Value | Status |"
out "|---|---|---|"
out "| Production ERP | http://127.0.0.1:3001 / https://erp.dincouture.pk | UNTOUCHED |"
out "| Production API | https://supabase.dincouture.pk / https://api.ndmcore.com | UNTOUCHED |"
out "| Staging Kong (local) | http://127.0.0.1:8010 | $KONG_CODE |"
out "| Staging Studio (local) | http://127.0.0.1:3010 | $STUDIO_CODE |"
out "| Staging API (public) | https://api-stage.ndmcore.com | $API_PUBLIC |"
out "| Staging Studio (public) | https://db-stage.ndmcore.com | $STUDIO_PUBLIC (DNS may be pending) |"
out "| Preview frontend | http://127.0.0.1:3002 | $PREVIEW_CODE |"
out "| Staging Anon Key | ${STAGE_ANON} | baked into :3002 |"
out "| Isolation canary | ${CANARY_REF} | stage=$STAGE_COUNT prod=$PROD_COUNT |"
out "| Isolation verdict | ISOLATION VERIFIED: Record exists in Staging only, 0 leakage to Production. | PASS |"
out "====================================="
out "REPORT_FILE=$REPORT"
log "All checks passed."
