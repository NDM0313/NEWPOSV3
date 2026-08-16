# Phase 2.12 — preview deploy waiver

**Date:** 2026-06-26

Preview container `erp-frontend-preview` :3003 built successfully (`phase-212-preview`).

Browser QA via tunnel **waived** for baseline/candidate: lazy-loaded JS chunks resolve to `https://erp.dincouture.pk/assets/*` because `VITE_SUPABASE_URL=https://erp.dincouture.pk`. Preview shell cannot isolate Phase 2.12 bundle without a dedicated preview origin.

**Mitigation:** Production frontend deployed with TB loader OFF first; baseline/candidate/rollback/soak executed on `https://erp.dincouture.pk`.
