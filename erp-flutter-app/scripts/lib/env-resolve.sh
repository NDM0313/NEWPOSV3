#!/usr/bin/env bash
# Resolve Flutter build env file + anon key (never commit these files).
# Search order: repo .env.production → .env.local → erp-mobile-app/.env.production

resolve_flutter_env_file() {
  local repo_root="$1"
  FLUTTER_ENV_FILE=""
  for candidate in \
    "$repo_root/.env.production" \
    "$repo_root/.env.local" \
    "$repo_root/erp-mobile-app/.env.production"; do
    if [[ -f "$candidate" ]]; then
      FLUTTER_ENV_FILE="$candidate"
      return 0
    fi
  done
  return 1
}

read_flutter_env_value() {
  local file="$1"
  local var_name="$2"
  grep -E "^${var_name}=" "$file" | head -1 | cut -d= -f2- | tr -d '"' | tr -d "'" | xargs
}

read_flutter_anon_key() {
  local file="$1"
  FLUTTER_ANON_KEY="$(read_flutter_env_value "$file" VITE_SUPABASE_ANON_KEY)"
  if [[ -z "$FLUTTER_ANON_KEY" ]]; then
    FLUTTER_ANON_KEY="$(read_flutter_env_value "$file" SUPABASE_ANON_KEY)"
  fi
}

read_flutter_supabase_url() {
  local file="$1"
  FLUTTER_SUPABASE_URL="$(read_flutter_env_value "$file" VITE_SUPABASE_URL)"
  if [[ -z "$FLUTTER_SUPABASE_URL" ]]; then
    FLUTTER_SUPABASE_URL="$(read_flutter_env_value "$file" SUPABASE_URL)"
  fi
}
