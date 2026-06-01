/** Child code suggestion — same rules as web addAccountCoaPicker.ts */

export type CoaPickerAccount = {
  id: string;
  parent_id?: string | null;
  code?: string | null;
};

export function getNextChildAccountCode(parent: CoaPickerAccount, allAccounts: CoaPickerAccount[]): string {
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
