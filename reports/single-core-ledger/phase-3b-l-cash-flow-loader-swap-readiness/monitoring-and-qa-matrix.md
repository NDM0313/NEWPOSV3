# Monitoring and QA matrix — Phase 3B-L

## Pre-swap monitoring

```bash
npm run monitor:three-company-unified-ledger
```

| Check | Expected |
|-------|----------|
| din-china | PASS |
| din-bridal | PASS |
| din-couture | PASS |
| other_company_loaders_on | 0 |
| gl_mutations | false |

## Post-swap monitoring (future Phase 3B-M)

Same command immediately after loader flag enable and frontend deploy.

## Company coverage

DIN CHINA · DIN BRIDAL · DIN COUTURE

## Report coverage

| Report | Pre-swap | Post-swap (future) |
|--------|----------|-------------------|
| Five unified loaders | ON / stable | Must remain stable |
| Cash Flow main | Legacy `getCashFlowReport` | Unified finance-aligned (when flag ON) |
| Cash Flow preview | Toggle compare (optional) | Per UX decision |

## Browser smoke checks

1. https://erp.dincouture.pk loads  
2. Login (per-company credentials)  
3. Accounting → Cash Flow  
4. Main totals visible  
5. No material console/RPC errors  
6. Row-keyed export if compare retained  

## Finance acceptance checks

| Company | Post-swap main closing should align with |
|---------|----------------------------------------|
| DIN CHINA | Phase 3B-I aligned preview (PKR -32,503,237) |
| DIN BRIDAL | Phase 3B-I aligned preview (PKR 60,720) |
| DIN COUTURE | Phase 3B-I aligned preview (PKR 50,500) |

## Failure triage

1. **Disable** `unified_ledger_loader_cash_flow` — no GL changes  
2. Run monitoring — save JSON artifact  
3. Compare totals vs [`phase-3b-i` exports](../phase-3b-i-cash-flow-aligned-golden-capture/exports/)  
4. Frontend revert if code defect  
5. Incident notes in Phase 3B-M evidence  
