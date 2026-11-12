# DIN COLLECTION supplier dual CoA merge — dry-run flash

**Date:** 2026-09-16  
**Company:** DIN COLLECTION (`e08a04af-22a8-4869-9b4d-da31fce13158`)  
**Backup schema:** `backup_coa_merge_20260916` (pairs=33, accounts=66, lines=927, je=927)

## Summary

| Status | Count |
|---|---|
| eligible_remap | 26 |
| skip_already_clean (0 lines, inactive) | 7 — still clear `linked_contact_id` |

FAROOQ already merged earlier (not in this pair list).

## Both-active (list confusion)

ABC, ALAM BNRS, ALEEM BNRS, FAHAD LACE, GULZAR BNRS, HASSAN BNRS, IBRAHIM BNRS, MOHSIN BNRS

## Pair CSV

```csv
contact_code,contact_name,legacy_code,legacy_active,legacy_open_lines,legacy_dr,legacy_cr,ap_code,ap_active,ap_open_lines,ap_dr,ap_cr,status
SUP-ZHD-0011,ABC,210011,true,54,5699170,5699170,AP-SUPZHD0011,true,0,0,0,eligible_remap
SUP-ZHD-0013,AHMED BHWL,210013,false,3,267000,267000,AP-SUPZHD0013,true,0,0,0,eligible_remap
SUP-ZHD-0149,ALAM BNRS,210149,true,65,3630000,4885100,AP-SUPZHD0149,true,1,150000,0,eligible_remap
SUP-ZHD-0096,ALEEM BNRS,210096,true,182,22693669,28658297,AP-SUPZHD0096,true,1,300000,0,eligible_remap
SUP-ZHD-0089,AL FAJAR SLM,210089,false,2,45000,45000,AP-SUPZHD0089,true,0,0,0,eligible_remap
SUP-ZHD-0141,ALL U DIN BNRS,210141,false,2,67000,67725,AP-SUPZHD0141,true,0,0,0,eligible_remap
SUP-ZHD-0015,AMIR BNRS,210015,false,6,250000,250000,AP-SUPZHD0015,true,0,0,0,eligible_remap
SUP-ZHD-0016,AMNA ARTS,210016,false,11,883800,899100,AP-SUPZHD0016,true,0,0,0,eligible_remap
SUP-ZHD-0062,DIN SILK IMPORTED PURCHASE,210062,false,2,211150,211150,AP-SUPZHD0062,true,0,0,0,eligible_remap
SUP-ZHD-0022,FAHAD LACE,210022,true,64,4294500,3501935,AP-SUPZHD0022,true,2,200000,0,eligible_remap
SUP-ZHD-0140,GALAXY LACE,210140,false,2,43000,43464,AP-SUPZHD0140,true,0,0,0,eligible_remap
SUP-ZHD-0169,GMK NOOR UK,210169,false,0,0,0,AP-SUPZHD0169,true,0,0,0,skip_already_clean
SUP-ZHD-0024,GULZAR BNRS,210024,true,75,7992400,8055100,AP-SUPZHD0024,true,1,150000,0,eligible_remap
SUP-ZHD-0125,HAFIZ SUFYAN GUJ,210125,false,2,150000,150000,AP-SUPZHD0125,true,0,0,0,eligible_remap
SUP-ZHD-0091,HASSAN BNRS,210091,true,104,10449974,10788585,AP-SUPZHD0091,true,1,50000,0,eligible_remap
SUP-ZHD-0026,IBRAHIM BNRS,210026,true,259,33902904,38556823,AP-SUPZHD0026,true,1,300000,0,eligible_remap
SUP-ZHD-0029,INR,210029,false,0,0,0,AP-SUPZHD0029,true,0,0,0,skip_already_clean
SUP-ZHD-0006,INR CARGO,210006,false,0,0,0,AP-SUPZHD0006,true,0,0,0,skip_already_clean
SUP-ZHD-0031,INR SLM,210031,false,0,0,0,AP-SUPZHD0031,true,0,0,0,skip_already_clean
SUP-ZHD-0077,IZHAR VELVET,210077,false,11,1059700,0,AP-SUPZHD0077,true,0,0,0,eligible_remap
SUP-ZHD-0178,MOHSIN BNRS,210178,true,23,2350000,2743868,AP-SUPZHD0178,true,1,150000,0,eligible_remap
SUP-ZHD-0069,MUNA BNRS,210069,false,5,337000,340300,AP-SUPZHD0069,true,0,0,0,eligible_remap
SUP-ZHD-0039,NSR BNRS,210039,false,0,0,0,AP-SUPZHD0039,true,0,0,0,skip_already_clean
SUP-ZHD-0093,SARA BNRS,210093,false,2,302000,302400,AP-SUPZHD0093,true,0,0,0,eligible_remap
SUP-ZHD-0101,SHABIR TR,210101,false,0,0,0,AP-SUPZHD0101,true,0,0,0,skip_already_clean
SUP-ZHD-0081,SKT GAZI,210081,false,2,100000,103000,AP-SUPZHD0081,true,0,0,0,eligible_remap
SUP-ZHD-0010,SLM BNRS ATLAS PURE,210010,false,0,0,0,AP-SUPZHD0010,true,0,0,0,skip_already_clean
SUP-ZHD-0065,SUBRANG,210065,false,4,86000,86000,AP-SUPZHD0065,true,0,0,0,eligible_remap
SUP-ZHD-0152,THAI CLOTH NOW,210152,false,4,255000,255600,AP-SUPZHD0152,true,0,0,0,eligible_remap
SUP-ZHD-0048,UK FASHION,210048,false,17,1470420,1479260,AP-SUPZHD0048,true,0,0,0,eligible_remap
SUP-ZHD-0084,WALI SARDAR,210084,false,2,105000,105700,AP-SUPZHD0084,true,0,0,0,eligible_remap
SUP-ZHD-0049,ZABI LHR,210049,false,3,263000,263000,AP-SUPZHD0049,true,0,0,0,eligible_remap
SUP-ZHD-0021,ZAMAN ARTS,210021,false,5,407000,431600,AP-SUPZHD0021,true,0,0,0,eligible_remap
```

## Rollback

```sql
-- Restore line account_ids from backup, then account flags/balances from backup.accounts
UPDATE journal_entry_lines jel
SET account_id = b.account_id
FROM backup_coa_merge_20260916.journal_entry_lines b
WHERE jel.id = b.id;

UPDATE accounts a
SET is_active = b.is_active,
    linked_contact_id = b.linked_contact_id,
    balance = b.balance
FROM backup_coa_merge_20260916.accounts b
WHERE a.id = b.id;
```
