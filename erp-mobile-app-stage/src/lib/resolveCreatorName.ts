import { supabase } from './supabase';

/** Batch-resolve document creator display names (auth.users.id or legacy users.id). */
export async function enrichRowsWithCreatorNames(
  rows: Array<Record<string, unknown>>,
  createdByField = 'created_by',
): Promise<void> {
  const ids = [
    ...new Set(
      rows
        .map((r) => r[createdByField])
        .filter((id): id is string => typeof id === 'string' && id.trim() !== ''),
    ),
  ];
  if (!ids.length) return;

  const nameById = new Map<string, string>();

  const { data: usersByAuth } = await supabase
    .from('users')
    .select('auth_user_id, full_name, email')
    .in('auth_user_id', ids);
  for (const u of usersByAuth || []) {
    const rec = u as Record<string, unknown>;
    const authId = rec.auth_user_id != null ? String(rec.auth_user_id) : '';
    if (authId) {
      const name = String(rec.full_name ?? rec.email ?? '').trim();
      if (name) nameById.set(authId, name);
    }
  }

  const missing = ids.filter((id) => !nameById.has(id));
  if (missing.length) {
    const { data: usersById } = await supabase.from('users').select('id, full_name, email').in('id', missing);
    for (const u of usersById || []) {
      const rec = u as Record<string, unknown>;
      const id = rec.id != null ? String(rec.id) : '';
      if (id) {
        const name = String(rec.full_name ?? rec.email ?? '').trim();
        if (name) nameById.set(id, name);
      }
    }
  }

  for (const row of rows) {
    const uid = row[createdByField];
    if (uid && typeof uid === 'string') {
      row.created_by_id = uid;
      const name = nameById.get(uid) ?? null;
      row.created_by_name = name;
      row.created_by = { full_name: name };
    }
  }
}
