# Temp Manager QA user plan

**Run local date/time:** 2026-07-02 19:54:54 +05:00  
**Classification:** `NEED_OPERATOR_EMAIL` — **user not created**

## Planned user (pending operator inputs)

| Field | Planned value |
|-------|---------------|
| Role | `manager` |
| Company | DIN BRIDAL (`597a5292-14c8-4cd8-96bd-c61b5a0d8c92`) |
| Branch | Main Branch / HQ (`cc920703-97a0-43a4-95d4-9262996c2af7`) |
| Display name | Mobile QA Manager |
| Email | **NOT PROVIDED** — operator must supply exact address before creation |
| Password | **NOT PROVIDED** — set out-of-band at creation time; never commit |
| PIN | unknown until QA session |
| Active | yes during QA |
| Cleanup | disable or delete after role QA with separate operator approval |

## Suggested email format (operator must confirm)

`mobile.manager.qa+20260702@<operator-approved-domain>`

Examples operator may use: dedicated Yahoo/Gmail alias under Nadeem Khan control. **Do not invent domain without operator confirmation.**

## Blockers

1. **NEED_OPERATOR_EMAIL** — no exact email in this run or approved `.env` vars.
2. **NEED_SECURE_PASSWORD** — password must be entered at apply time (not in repo).

## Salesman (unchanged)

Use existing account (e.g. Noman Ali) when operator provides password out-of-band — **no salesman user creation**.
