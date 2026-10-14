# Decision outcome matrix — Phase 3B-G

Maps finance choices on Q4/Q5/Q7 to allowed future work. **No runtime change until decisions are APPROVED in writing.**

## Q7 — Delta treatment outcomes

| If finance chooses | Runtime now | Future work | Loader swap |
|--------------------|-------------|-------------|---------------|
| **A — Keep legacy official** | No fix needed | Preview stays diagnostic-only | **Blocked / closed as not approved** for unified Cash Flow |
| **B — Align preview to legacy** | No change yet | **Phase 3B-H** preview-alignment fix; re-capture + finance re-review | Blocked until 3B-H passes golden re-capture |
| **C — Align legacy to unified** | No change yet | Controlled behavior-change plan; operator approval mandatory; full rollback plan | Blocked until controlled phase + sign-off |
| **D — More review** | Diagnostic mode only | Continue row-keyed exports; no behavior change | **Blocked** |

## Q5 — Internal transfers (DIN CHINA)

| Option | Implication |
|--------|-------------|
| A — Gross both legs | Preview may be closer to target; legacy may need change if adopted officially |
| B — Net transfers | Both engines may need rule alignment |
| C — Exclude from normal | Preview filter change likely in 3B-H |
| D — Keep legacy | Q7-A path; loader swap for unified Cash Flow not justified |

## Q4 — Opening balance (DIN BRIDAL)

| Option | Implication |
|--------|-------------|
| A — Summary/opening only | Preview mapper may exclude period cash-in for opening_balance_account |
| B — Period cash-in rows | Legacy may be under-reporting vs unified |
| C — Company-specific | Document per-company rule table before any fix |

## Hard blocks (all outcomes)

- No migrations, flags, GL mutations without separate approved phase
- BS/P&L finance remains **PENDING**
- R7 **DESIGN_ONLY** · R8 **BLOCKED** · next company **BLOCKED**
- Do not mark finance APPROVED without explicit reviewer + date on decision form
