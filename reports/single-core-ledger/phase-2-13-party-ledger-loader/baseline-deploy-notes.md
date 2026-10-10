# Phase 2.13 — Preview deploy waiver

**Decision:** Skip isolated preview bundle QA (same waiver as Phase 2.12).

**Reason:** Browser loads lazy JS chunks from `https://erp.dincouture.pk/assets/*`; tunnel to `erp-frontend-preview:3003` does not isolate bundle.

**Mitigation:** Production-safe baseline pattern:

1. Deploy production frontend with Party Ledger loader **OFF**
2. Baseline QA on `https://erp.dincouture.pk`
3. Enable flags in controlled window
4. Candidate QA + L1 rollback proof on production URL

**Reference:** Phase 2.12 `preview-deploy-notes.md` waiver.
