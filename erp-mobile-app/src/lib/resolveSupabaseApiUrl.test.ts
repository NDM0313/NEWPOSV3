import assert from 'node:assert/strict';
import test from 'node:test';

test('native and production resolve to canonical ndmcore API', async () => {
  const { CANONICAL_SUPABASE_API_URL, resolveSupabaseApiUrl } = await import('./resolveSupabaseApiUrl.ts');

  assert.equal(
    resolveSupabaseApiUrl('https://supabase.dincouture.pk', {
      isNativeCapacitor: true,
      isDev: false,
    }),
    CANONICAL_SUPABASE_API_URL,
  );

  assert.equal(
    resolveSupabaseApiUrl('https://erp.dincouture.pk', {
      isNativeCapacitor: false,
      isDev: false,
    }),
    CANONICAL_SUPABASE_API_URL,
  );

  assert.equal(
    resolveSupabaseApiUrl('https://supabase.dincouture.pk', {
      isNativeCapacitor: false,
      isDev: true,
    }),
    CANONICAL_SUPABASE_API_URL,
  );

  assert.equal(
    resolveSupabaseApiUrl('http://72.62.254.176:8000', {
      isNativeCapacitor: false,
      isDev: true,
    }),
    CANONICAL_SUPABASE_API_URL,
  );

  assert.equal(
    resolveSupabaseApiUrl('http://localhost:5174', {
      isNativeCapacitor: false,
      isDev: true,
    }),
    'http://localhost:5174',
  );
});
