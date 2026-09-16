/**
 * Next unique child account code under a COA parent (mirrors src/app/lib/addAccountCoaPicker.ts).
 */
export function getNextChildAccountCode(parent, allAccounts) {
  const siblings = allAccounts.filter((x) => x.parent_id === parent.id);
  const allCodes = new Set(allAccounts.map((x) => String(x.code ?? '').trim()).filter(Boolean));
  const p = String(parent.code ?? '').trim();
  if (/^\d+$/.test(p)) {
    const base = parseInt(p, 10);
    let max = base;
    for (const s of siblings) {
      const c = String(s.code ?? '').trim();
      if (/^\d+$/.test(c)) {
        const n = parseInt(c, 10);
        if (n > max) max = n;
      }
    }
    let candidate = max + 1;
    while (allCodes.has(String(candidate))) candidate += 1;
    return String(candidate);
  }
  if (p) {
    let n = 1;
    let cand = `${p}-${n}`;
    while (allCodes.has(cand)) {
      n += 1;
      cand = `${p}-${n}`;
    }
    return cand;
  }
  let k = 1;
  let gen = `SUB-${k}`;
  while (allCodes.has(gen)) {
    k += 1;
    gen = `SUB-${k}`;
  }
  return gen;
}

/** Next free numeric group code in asset header range 1100–1999. */
export function nextAssetGroupCode(allAccounts, preferMin = 1190) {
  const allCodes = new Set(allAccounts.map((a) => String(a.code ?? '').trim()).filter(Boolean));
  const numeric = allAccounts
    .map((a) => parseInt(String(a.code ?? '').trim(), 10))
    .filter((n) => Number.isFinite(n) && n >= 1100 && n < 2000);
  let candidate = numeric.length ? Math.max(preferMin, Math.max(...numeric) + 1) : preferMin;
  while (allCodes.has(String(candidate))) candidate += 1;
  return String(candidate);
}
