# Dashboard & reports overview — basis map

Goal: stop comparing **Reports Overview** / **executive** metrics to **canonical P&L** as if they were the same.

## Reports — Enhanced (used by `App.tsx`)

| Card / area | Basis | Notes |
|-------------|--------|--------|
| Overview **Total Sales / Purchases / Expenses** | **Operational** — documents in selected date range from context | Sales/purchases/expenses feeds |
| Overview **Net Profit (operational)** | **Operational** — `sales − purchases − expenses` style from those feeds | **Not** journal P&L |
| Financial tab / P&L statement | **Canonical GL** | Journal-based |

**UI:** Amber banner + **Net Profit (operational)** title on Overview.

## Reports — legacy `ReportsDashboard`

| Overview cards | Basis |
|----------------|--------|
| Total Revenue, Net Profit (operational), Expense Ratio | Operational (same family as Enhanced) |

**UI:** Matching banner and **Net Profit (operational)** label.

## Main `Dashboard.tsx` (executive)

| Stat card | Basis |
|-----------|--------|
| Receivables / Payables | **Operational** — `get_contact_balances_summary` via dashboard metrics |
| Net profit / Revenue (period) | **Operational** — period metrics from financial/executive context |
| Cash / Bank (where shown) | **GL** — journal-derived (see `get_financial_dashboard_metrics`) |

**UI:** Titles updated to **operational** where applicable.

## Accounting `AccountingDashboard`

| Cards | Basis |
|-------|--------|
| Income, Expense, Net Profit | **GL** — stated on cards |
| Receivables / Payables | **GL** — journal legs |

No change required for this task — already labeled.

## Verdict

- **Dashboard basis map:** **FIXED** (labels + banners; no silent mixing of GL vs operational on Overview).
