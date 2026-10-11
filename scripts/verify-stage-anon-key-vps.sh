#!/usr/bin/env bash
# Compare staging Kong ANON_KEY on VPS with the frontend staging key.
set -euo pipefail
STAGE_DIR="${STAGE_DIR:-/opt/supabase-stage}"
EXPECT_ANON="${EXPECT_ANON:-eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoiYW5vbiIsImlzcyI6InN1cGFiYXNlIiwiaWF0IjoxNjQxNzY5MjAwLCJleHAiOjE3OTk1MzU2MDB9.OHbNef2x7CVNAPLi302ouCz3UN1sG1TK_uVFOivGM90}"

die() { echo "ERROR: $*" >&2; exit 1; }
[[ -f "$STAGE_DIR/.env" ]] || die "missing $STAGE_DIR/.env"

STAGE_ANON="$(grep -E '^(ANON_KEY|SUPABASE_ANON_KEY)=' "$STAGE_DIR/.env" | head -1 | cut -d= -f2- | tr -d '\r"')"
STAGE_ANON="${STAGE_ANON:-$(tr -d '\r\n' < "$STAGE_DIR/.stage_anon_key" 2>/dev/null || true)}"
[[ -n "$STAGE_ANON" ]] || die "ANON_KEY not found in staging .env"

echo "stage_anon_len=${#STAGE_ANON}"
echo "expect_anon_len=${#EXPECT_ANON}"
echo "stage_anon_suffix=…${STAGE_ANON: -16}"
echo "expect_anon_suffix=…${EXPECT_ANON: -16}"

CODE="$(curl -skS -o /tmp/stage_rest.json -w '%{http_code}' \
  -H "apikey: ${STAGE_ANON}" -H "Authorization: Bearer ${STAGE_ANON}" \
  http://127.0.0.1:8010/rest/v1/ || true)"
echo "local_kong_rest=${CODE}"
head -c 120 /tmp/stage_rest.json; echo

PUB="$(curl -skS -o /tmp/stage_rest_pub.json -w '%{http_code}' \
  -H "apikey: ${EXPECT_ANON}" -H "Authorization: Bearer ${EXPECT_ANON}" \
  https://api-stage.ndmcore.com/rest/v1/ || true)"
echo "public_kong_rest_with_frontend_key=${PUB}"

if [[ "$STAGE_ANON" != "$EXPECT_ANON" ]]; then
  echo "MISMATCH: frontend staging anon key != /opt/supabase-stage ANON_KEY"
  echo "Update erp-mobile-app/.env VITE_SUPABASE_ANON_KEY to match stage, or rotate stage keys."
  exit 2
fi

[[ "$CODE" == "200" || "$CODE" == "401" ]] || true
# 200 with OpenAPI is success; 401 means Kong rejected this key
if [[ "$PUB" != "200" ]]; then
  die "Frontend key rejected by public api-stage (HTTP $PUB)"
fi
echo "ANON_KEY_MATCH_OK"
