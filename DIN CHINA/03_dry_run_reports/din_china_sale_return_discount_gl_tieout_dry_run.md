# DIN CHINA Sale Returns & Discount GL Tie-Out — Dry Run

**Generated:** 2026-06-15T18:32:51.597Z
**Company:** 30bd8592-3384-4f34-899a-f3907e336485
**Branch:** DIN CHINA (BL0002)

## Summary

| Metric | Value |
| --- | --- |
| Expected sell return total (legacy) | 1059903 |
| Legacy parsed return total | 1059903 |
| ERP sale_returns count | 4 |
| ERP sale_returns total | 1059903 |
| Expected discount total (report) | 148818 |
| ERP sales.discount_amount sum | 148818 |
| Sales with discount > 0 | 4 |
| GL 5200 posted (debit) | 148818 |
| 5200 gap vs ERP discounts | 0 |
| Missing return settlement JEs | 4 |
| AR gap reduction estimate (Phase 6) | 0 |
| Phase 6 eligible imports | 0 |
| Phase 7.5 screenshot discount backfill eligible | 0 |
| Phase 7 eligible discount amends | 0 |

## Import strategy

Original import excluded sell_return CN2025/0001 and related CN docs. Phase 6 imports settlement JEs when approved.

## Legacy sell returns (excluded from original import)

```json
[
  {
    "returnNo": "CN2025/0001",
    "legacyId": null,
    "amount": 0,
    "note": "Excluded in original import scope"
  },
  {
    "returnNo": "CN2025/0002",
    "amount": 0
  },
  {
    "returnNo": "CN2026/0003",
    "amount": 0
  },
  {
    "returnNo": "CN2026/0004",
    "amount": 0
  }
]
```

## Customer ledger vs summary (spotlight)

```json
[]
```

## Phase 6 — Proposed return imports (preview)

```json
[
  {
    "returnNo": "CN2025/0002",
    "existingId": "75750be5-a8f7-4a29-8a56-0af832c76a62",
    "estimatedTotal": 0,
    "status": "already_imported",
    "returnId": "75750be5-a8f7-4a29-8a56-0af832c76a62"
  },
  {
    "returnNo": "CN2026/0003",
    "existingId": "d9570ff0-1e6e-49b8-8b31-f276fcc760c0",
    "estimatedTotal": 0,
    "status": "already_imported",
    "returnId": "d9570ff0-1e6e-49b8-8b31-f276fcc760c0"
  },
  {
    "returnNo": "CN2026/0004",
    "existingId": "9578930f-9714-4a0d-8b0f-dfb0f433603b",
    "estimatedTotal": 0,
    "status": "already_imported",
    "returnId": "9578930f-9714-4a0d-8b0f-dfb0f433603b"
  }
]
```

## Phase 7.5 — Screenshot discount backfill (preview)

```json
[
  {
    "phase": 7.5,
    "saleId": "ca23d0f6-3ae4-45b7-8099-586c3fd182ec",
    "invoiceNo": "DC-0041",
    "customerName": "AZIZ JAMURAD",
    "legacyTransactionId": 53,
    "journalEntryId": "f09b6694-e635-4ab1-8402-f62e7aad2ebe",
    "discountAmount": 13540,
    "forgiveRemainingDue": true,
    "saleBefore": {
      "total": 323594,
      "discount_amount": 13540,
      "paid_amount": 323594,
      "due_amount": 0,
      "payment_status": "paid"
    },
    "saleAfter": {
      "total": 323594,
      "discount_amount": 13540,
      "paid_amount": 323594,
      "due_amount": 0,
      "payment_status": "paid"
    },
    "jeBefore": {
      "arDebit": 323594,
      "revenueCredit": 337134,
      "discountDebit": 13540
    },
    "jeAfter": {
      "arDebit": 323594,
      "revenueCredit": 337134,
      "discountDebit": 13540
    },
    "alreadyComplete": true,
    "ok": true
  },
  {
    "phase": 7.5,
    "saleId": "1fd33e3e-9e10-4e78-8b03-6eff10bce58a",
    "invoiceNo": "DC-0004",
    "customerName": "SHAHURKH KHAN",
    "legacyTransactionId": 7,
    "journalEntryId": "fd665df3-4a41-4d8d-89cd-bffa53bf8374",
    "discountAmount": 35218,
    "forgiveRemainingDue": true,
    "saleBefore": {
      "total": 100000,
      "discount_amount": 35218,
      "paid_amount": 0,
      "due_amount": 0,
      "payment_status": "paid"
    },
    "saleAfter": {
      "total": 100000,
      "discount_amount": 35218,
      "paid_amount": 0,
      "due_amount": 0,
      "payment_status": "paid"
    },
    "jeBefore": {
      "arDebit": 100000,
      "revenueCredit": 135218,
      "discountDebit": 35218
    },
    "jeAfter": {
      "arDebit": 100000,
      "revenueCredit": 135218,
      "discountDebit": 35218
    },
    "alreadyComplete": true,
    "ok": true
  },
  {
    "phase": 7.5,
    "saleId": "66bfeeeb-a216-4906-8256-08067a3ac53a",
    "invoiceNo": "DC-0002",
    "customerName": "LAL MOHAMMAD",
    "legacyTransactionId": 5,
    "journalEntryId": "b3cc690c-c218-4eb7-87eb-bd26e7e3b6b5",
    "discountAmount": 100000,
    "forgiveRemainingDue": false,
    "saleBefore": {
      "total": 1093124,
      "discount_amount": 100000,
      "paid_amount": 1028700,
      "due_amount": 64424,
      "payment_status": "partial"
    },
    "saleAfter": {
      "total": 1093124,
      "discount_amount": 100000,
      "paid_amount": 1028700,
      "due_amount": 64424,
      "payment_status": "partial"
    },
    "jeBefore": {
      "arDebit": 1093124,
      "revenueCredit": 1193124,
      "discountDebit": 100000
    },
    "jeAfter": {
      "arDebit": 1093124,
      "revenueCredit": 1193124,
      "discountDebit": 100000
    },
    "alreadyComplete": true,
    "ok": true
  }
]
```

**Phase 7.5 strategy:** Screenshot backfill: UPDATE sales.discount_amount/total/due, then amend document JE — reduce Dr AR, increase Cr 4100, add Dr 5200.

## Phase 7 — Proposed discount GL amends (preview)

```json
[
  {
    "saleId": "ca23d0f6-3ae4-45b7-8099-586c3fd182ec",
    "invoiceNo": "DC-0041",
    "discountAmount": 13540,
    "journalEntryId": "f09b6694-e635-4ab1-8402-f62e7aad2ebe",
    "alreadyComplete": true,
    "ok": true
  },
  {
    "saleId": "1fd33e3e-9e10-4e78-8b03-6eff10bce58a",
    "invoiceNo": "DC-0004",
    "discountAmount": 35218,
    "journalEntryId": "fd665df3-4a41-4d8d-89cd-bffa53bf8374",
    "alreadyComplete": true,
    "ok": true
  },
  {
    "saleId": "720e9153-23dd-4416-8d0e-b7f49102f20e",
    "invoiceNo": "DC-0014",
    "discountAmount": 60,
    "journalEntryId": "30a0961e-c154-489f-8589-35d9c2e0e723",
    "alreadyComplete": true,
    "ok": true
  },
  {
    "saleId": "66bfeeeb-a216-4906-8256-08067a3ac53a",
    "invoiceNo": "DC-0002",
    "discountAmount": 100000,
    "journalEntryId": "b3cc690c-c218-4eb7-87eb-bd26e7e3b6b5",
    "alreadyComplete": true,
    "ok": true
  }
]
```

**Phase 7 strategy:** Phase 7 amends document JE: Cr 4100 gross, Dr AR net, Dr 5200 discount. Phase 7.5 handles screenshot-only discounts.