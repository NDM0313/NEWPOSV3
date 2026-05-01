#!/usr/bin/env bash
# Repository check: required SQL migrations exist locally.
# Remote Supabase: apply these in timestamp order via Dashboard → SQL or `supabase db push`.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
for f in \
  "$ROOT/migrations/20260450_record_customer_payment_reference_retry.sql" \
  "$ROOT/migrations/20260455_self_healing_numbering_and_payment_retry.sql" \
  "$ROOT/migrations/20260457_record_customer_payment_last_resort_reference.sql"
do
  if [[ ! -f "$f" ]]; then
    echo "missing: $f" >&2
    exit 1
  fi
done
echo "OK: payment numbering migration files present."
echo "Ensure Supabase has 20260450 and 20260455 applied before 20260457."
