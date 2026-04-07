/**
 * Server-side Supabase client for admin scripts (service role).
 * Do not import from src/ (Vite/browser). Use only @supabase/supabase-js.
 *
 * Loads project env files on import (Node scripts): .env.local → .env → .env.development.local.
 * Does not override variables already set in the shell.
 */

import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/** Absolute paths probed for dotenv (in load order). */
export const ADMIN_SCRIPT_ENV_PATHS_CHECKED: readonly string[] = (() => {
  const root = process.cwd();
  return [
    resolve(root, '.env.local'),
    resolve(root, '.env'),
    resolve(root, '.env.development.local'),
  ];
})();

/** Subset of ADMIN_SCRIPT_ENV_PATHS_CHECKED that existed and were passed to dotenv. */
export const ADMIN_SCRIPT_ENV_PATHS_LOADED: string[] = [];

function loadScriptEnvFromProjectRoot(): void {
  for (const envPath of ADMIN_SCRIPT_ENV_PATHS_CHECKED) {
    if (existsSync(envPath)) {
      loadDotenv({ path: envPath, override: false });
      ADMIN_SCRIPT_ENV_PATHS_LOADED.push(envPath);
    }
  }
}

loadScriptEnvFromProjectRoot();

/** Env var names tried for URL (first non-empty wins). */
export const SUPABASE_URL_ENV_KEYS = ['SUPABASE_URL', 'VITE_SUPABASE_URL'] as const;

/** Env var names tried for service role (first non-empty wins). */
export const SERVICE_ROLE_ENV_KEYS = ['SUPABASE_SERVICE_ROLE_KEY', 'VITE_SUPABASE_SERVICE_ROLE_KEY'] as const;

function formatMissingEnvError(intro: string, missingLines: string[]): string {
  const checked = ADMIN_SCRIPT_ENV_PATHS_CHECKED.map((p) => `  - ${p}`).join('\n');
  const loaded =
    ADMIN_SCRIPT_ENV_PATHS_LOADED.length > 0
      ? ADMIN_SCRIPT_ENV_PATHS_LOADED.map((p) => `  - ${p}`).join('\n')
      : '  (none — no matching files found at paths above)';
  const missing = missingLines.map((m) => `  - ${m}`).join('\n');
  return [
    intro,
    '',
    'Missing variables:',
    missing,
    '',
    'Env files checked (in order; first file wins per key; shell exports are never overwritten):',
    checked,
    '',
    'Env files that existed and were loaded:',
    loaded,
    '',
    'Tip: add SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY to .env.local. See .env.example.',
  ].join('\n');
}

export function getSupabaseUrl(): string {
  let url: string | undefined;
  for (const k of SUPABASE_URL_ENV_KEYS) {
    const v = process.env[k]?.trim();
    if (v) {
      url = v;
      break;
    }
  }
  if (!url) {
    throw new Error(
      formatMissingEnvError('Admin script: no Supabase URL in environment.', [
        `One of: ${SUPABASE_URL_ENV_KEYS.join(', ')}`,
      ])
    );
  }
  return url.replace(/\/+$/, '');
}

function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  const parts = jwt.split('.');
  if (parts.length !== 3) return null;
  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = (4 - (b64.length % 4)) % 4;
    b64 += '='.repeat(pad);
    const json = Buffer.from(b64, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function maskKeyHint(key: string): string {
  if (!key || key.length < 8) return '(too short)';
  return `length=${key.length}, prefix=${JSON.stringify(key.slice(0, 12))}…`;
}

/**
 * `sb_secret_*` and similar short strings are not valid `apikey` values for PostgREST.
 * The JS client requires the **JWT** shown in Dashboard → Settings → API as **service_role** (long, starts with `eyJ`).
 */
function assertServiceRoleKeyShape(key: string, sourceEnvName: string): void {
  const k = key.trim();
  if (k.startsWith('sb_secret_')) {
    throw new Error(
      [
        `Admin script: ${sourceEnvName} uses a value starting with "sb_secret_" — that is not the PostgREST API key.`,
        '',
        '@supabase/supabase-js sends this string as the apikey JWT. It must be the **long JWT** from the dashboard,',
        'not a short "secret" or CLI-style token.',
        '',
        'Fix: Supabase Dashboard → your project → Settings → API → **Project API keys** →',
        'copy **service_role** (the value that looks like eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.... — hundreds of characters).',
        '',
        `What you have: ${maskKeyHint(k)}`,
      ].join('\n')
    );
  }
  const parts = k.split('.');
  if (parts.length !== 3 || !k.startsWith('eyJ')) {
    throw new Error(
      [
        `Admin script: ${sourceEnvName} does not look like a Supabase API JWT.`,
        '',
        'Expected: a long string with two dots (three segments), typically starting with "eyJ".',
        'That is the **service_role** key from Dashboard → Settings → API.',
        '',
        `What you have: ${maskKeyHint(k)}`,
      ].join('\n')
    );
  }
}

/**
 * Reject the common mistake: pasting the anon/public key into the service role slot.
 * Supabase returns `{ message: 'Invalid authentication credentials' }` for that case.
 */
function assertServiceRoleJwtOrExplain(key: string, sourceEnvName: string): void {
  assertServiceRoleKeyShape(key, sourceEnvName);

  const payload = decodeJwtPayload(key);
  if (!payload) {
    throw new Error(
      [
        `Admin script: ${sourceEnvName} looks like a JWT shape but the payload could not be decoded.`,
        'Copy the **service_role** key again from Dashboard → Settings → API (full string, no spaces or quotes).',
        maskKeyHint(key),
      ].join('\n')
    );
  }
  const role = String(payload.role ?? '');
  if (role === 'anon') {
    throw new Error(
      [
        `Admin script: ${sourceEnvName} holds the anon (public) API key, not the service_role secret.`,
        '',
        'PostgREST returns "Invalid authentication credentials" when the wrong key is used.',
        '',
        'Fix: In Supabase Dashboard → Project Settings → API, copy the **service_role** key',
        '(secret), and set SUPABASE_SERVICE_ROLE_KEY in .env.local to that value.',
        '',
        'Do not use VITE_SUPABASE_ANON_KEY or SUPABASE_ANON_KEY for admin scripts.',
        `Detected JWT role: "${role}" (${maskKeyHint(key)})`,
      ].join('\n')
    );
  }
  if (role !== 'service_role') {
    console.warn(
      `[adminSupabase] JWT role is "${role}" (expected service_role for admin). If requests fail, verify URL + key are from the same project. ${maskKeyHint(key)}`
    );
  }
}

export function getServiceRoleKey(): string {
  let key: string | undefined;
  let sourceName = 'SUPABASE_SERVICE_ROLE_KEY';
  for (const k of SERVICE_ROLE_ENV_KEYS) {
    const v = process.env[k]?.trim();
    if (v) {
      key = v;
      sourceName = k;
      break;
    }
  }
  if (!key) {
    throw new Error(
      formatMissingEnvError('Admin script: no service role key in environment.', [
        `One of: ${SERVICE_ROLE_ENV_KEYS.join(', ')} (service_role secret from Dashboard → API, not the anon key)`,
      ])
    );
  }
  assertServiceRoleJwtOrExplain(key, sourceName);
  return key;
}

/** Admin client: bypasses RLS. Use only in trusted scripts. */
export function createAdminSupabase(): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getServiceRoleKey();
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

/**
 * Turns PostgREST / Supabase `{ message: 'Invalid authentication credentials' }` into actionable text.
 */
export function formatSupabaseAuthError(err: unknown): string {
  const msg =
    err instanceof Error
      ? err.message
      : err && typeof err === 'object' && 'message' in err
        ? String((err as { message?: unknown }).message)
        : String(err);
  if (!/invalid authentication credentials/i.test(msg)) {
    return msg;
  }
  return [
    msg,
    '',
    'This usually means the API key is not the **service_role** JWT for this project,',
    'or the key does not match SUPABASE_URL / VITE_SUPABASE_URL (wrong project).',
    '',
    'Wrong formats: short `sb_secret_…` strings, database passwords, or anon keys — use the long JWT (starts with eyJ).',
    'Check: Dashboard → Settings → API → **service_role** (JWT) → SUPABASE_SERVICE_ROLE_KEY',
    'Env key names tried: ' + SERVICE_ROLE_ENV_KEYS.join(', '),
    'URL env key names tried: ' + SUPABASE_URL_ENV_KEYS.join(', '),
  ].join('\n');
}
