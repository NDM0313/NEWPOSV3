/** PostgREST / Postgres errors when a requested column is absent from schema cache. */
export function isPostgrestMissingColumnError(
  error: { code?: string; message?: string } | null | undefined,
): boolean {
  if (!error) return false;
  const m = (error.message ?? '').toLowerCase();
  return (
    error.code === 'PGRST204'
    || error.code === '42703'
    || m.includes('schema cache')
    || (m.includes('could not find') && m.includes('column'))
    || (m.includes('column') && m.includes('does not exist'))
    || m.includes('pgrst')
  );
}
