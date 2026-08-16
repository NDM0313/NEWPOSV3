# Finance approval manifest — template

**Status:** `PENDING` — do not fill `APPROVED` without explicit finance approval text from operator.

Copy this template to `finance-approval-manifest.json` (future phase) when finance provides written approval. Do **not** commit approval without operator sign-off.

---

## Template fields

| Field | Default |
|-------|---------|
| `finance_status` | `PENDING` |
| `approved_by` | null |
| `approved_at` | null |
| `loader_swap_approved` | **false** |
| `migrations_approved` | **false** |

See [`finance-approval-manifest-template.json`](finance-approval-manifest-template.json) for machine-readable template.

---

## When finance approves

1. Operator provides explicit approval text (e.g. "finance approved").
2. Complete checklist in [`finance-signoff-pack.md`](finance-signoff-pack.md).
3. Copy template → `finance-approval-manifest.json` with reviewer name, date, and `finance_status: APPROVED`.
4. Commit approval manifest in a **separate** approval phase only.
5. Loader swap still requires [`bs-pl-loader-swap-gate.md`](bs-pl-loader-swap-gate.md) gates — approval manifest alone is insufficient.
