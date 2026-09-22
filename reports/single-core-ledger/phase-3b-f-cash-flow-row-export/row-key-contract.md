# Cash Flow row key contract — Phase 3B-F

Diagnostic-only identity contract. Does **not** change business totals.

## Key tiers

| Confidence | Key format | When |
|------------|------------|------|
| EXACT_KEY | `jel:{journal_entry_line_id}` | Line id present |
| STRONG_KEY | `je:{id}\|{date}\|in:\|out:` or `pay:{id}\|...` | JE or payment + date + amounts |
| WEAK_KEY | `weak:{date}\|{ref}\|{acct}\|in:\|out:` | Date + ref + account + amounts |
| BUCKET_ONLY | `bucket:{ref}\|in:\|out:` | Module/ref bucket only |
| UNMATCHABLE_NEEDS_EXPORT_FIELD | `unmatch:{descHash}\|...` | Fallback |

## Row side

`cash_in` · `cash_out` · `transfer_in` · `transfer_out` · `opening` · `reversal` · `void` · `unknown`

## Classifications

- **Visibility:** normal / audit / reversal / void / correction / opening
- **Transfer:** internal_transfer_in / internal_transfer_out / not_transfer

## Match tiers (diff)

exact → strong → weak → legacy-only / preview-only
