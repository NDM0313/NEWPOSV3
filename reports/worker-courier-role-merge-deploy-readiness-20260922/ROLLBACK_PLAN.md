# Rollback plan — capability-only (pre-T0)

Because business T0 was **not** executed, rollback remains relatively simple.

## Anchors

| Anchor | SHA / note |
|--------|------------|
| App rollback | Redeploy `c253d4c17e77f3353650a2bd6eee760516e6e95d` |
| Capability product SHA | `356819d0759948f1583c3b9f22e9dded4d9f2529` |
| Docs-only commits after deploy | Do **not** force redeploy solely for docs |

## App failure

1. On VPS: checkout/reset to app rollback SHA.
2. `bash deploy/deploy.sh` (or equivalent established workflow).
3. Verify `/` and `/health` 200; container healthy.

## Function / migration defect

Prefer **additive forward-fix** migration under `migrations/`.

Do **not**:

- drop accounting data
- delete historical accounts
- reverse historical JEs
- run Ibrahim rollback
- change target contact types (DHL/KIRAN/SHAHMIM)

## Severe capability regression

Stop role-model rollout; restore app behavior while **preserving** applied schema safely until forward-fix lands.

## After T0 (future — not authorized here)

If a party has already posted role transactions after type flip, do **not** blindly revert type — enter `POST_FIRST_POST_INCIDENT` for that party.
