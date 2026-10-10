# Settings search bar + Import FX (2026-08-01)

## Settings search

Sticky header search on Settings finds nav sections and deep keywords (e.g. **packing** → **Operations → Inventory — General** for Enable Packing).

| Piece | Location |
|---|---|
| Keyword index + `searchSettingsNav` | `src/app/components/settings/settingsNavigation.ts` |
| Search UI (dropdown, ↑/↓/Enter/Esc) | `src/app/components/settings/SettingsLayout.tsx` |

Keywords include packing / enable packing / boxes / pieces / thaans, plus multi-currency / FX shortcuts to Fiscal & Tax.

## Import purchasing FX (related batch)

- Settings: `accounting_settings.multiCurrencyEnabled` + `activeCurrencies`
- Currency-first purchase lines when FX is on; PKR remains GL base
- Agent FX wizard + dual-credit schema/RPCs (`migrations/20260801190000_*`, `20260801190100_*`)
- Roadmap / rule: `docs/accounting/MULTI_CURRENCY_IMPORT_FX_ROADMAP.md`, `.cursor/rules/multi-currency-import-fx.mdc`

## Deploy

```bash
# Local → GitHub
git push origin main

# VPS frontend
ssh dincouture-vps "cd /root/NEWPOSV3 && git fetch origin main && git pull origin main && bash deploy/deploy.sh"
```

DB migrations for FX were applied via Supabase MCP earlier; VPS pull ships the web UI.
