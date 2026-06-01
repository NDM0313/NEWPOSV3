/**
 * Upsert rows in fixed-size chunks with per-batch error handling.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} table
 * @param {object[]} rows
 * @param {{ batchSize?: number, onConflict?: string, label?: string }} [opts]
 */
export async function batchUpsert(supabase, table, rows, opts = {}) {
  const batchSize = opts.batchSize ?? 100;
  const onConflict = opts.onConflict ?? 'id';
  const label = opts.label ?? table;

  if (!rows.length) {
    console.log(`[${label}] 0 rows — skipped`);
    return { table: label, inserted: 0, batches: 0 };
  }

  let batches = 0;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    batches += 1;
    try {
      const { error } = await supabase.from(table).upsert(chunk, { onConflict });
      if (error) throw error;
      const done = Math.min(i + batchSize, rows.length);
      console.log(`[${label}] ${done}/${rows.length}`);
    } catch (err) {
      const message = err?.message || String(err);
      console.error(`[${label}] batch ${batches} (rows ${i + 1}-${i + chunk.length}) failed: ${message}`);
      throw err;
    }
  }

  return { table: label, inserted: rows.length, batches };
}
