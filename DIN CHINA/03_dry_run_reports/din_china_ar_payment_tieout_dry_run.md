# DIN CHINA AR / Payments Tie-Out — Dry Run

**Generated:** 2026-06-16T09:14:47.464Z

## Summary

| Metric | Value |
| --- | --- |
| Sales total | 49951100 |
| Paid on sales | 22402880 |
| Due on sales (expected AR) | 27548220 |
| Sales − payments | 27548220 |
| Payment records total | 22402880 |
| GL AR balance rollup | -20816540 |
| Expected vs actual AR gap | 48364760 |
| Payment JE count | 237 |
| Payment JE issues | 17 |
| Party reclass lines (Phase 4) | 17 |
| Party reclass amount | 1999040 |
| Customers with GL≠due (pre-reclass) | 5 |

## Party GL projections (after Phase 4 reclass)

```json
[
  {
    "contactId": "ed1abdc6-a701-488b-8a92-8efd1f9750a3",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "glBefore": 6009458,
    "glAfter": 4709458,
    "operationalDue": 5059563,
    "gapBefore": 949895,
    "gapAfter": -350105
  },
  {
    "contactId": "166142cd-98ee-4e0a-8827-0b666cb2e04d",
    "customerName": "MURAD  RAMDAS",
    "partyAccountCode": "AR-166142",
    "glBefore": 257140,
    "glAfter": 0,
    "operationalDue": 0,
    "gapBefore": 257140,
    "gapAfter": 0
  },
  {
    "contactId": "51a5ede0-6ae9-4a1a-8314-38ae5cb9f197",
    "customerName": "MR ALMAS NOW",
    "partyAccountCode": "AR-51A5ED",
    "glBefore": 196800,
    "glAfter": 300,
    "operationalDue": 300,
    "gapBefore": 196500,
    "gapAfter": 0
  },
  {
    "contactId": "b74d8b8e-7de4-4a5e-8931-bca7915570ed",
    "customerName": "PARVAISE  MARDAN",
    "partyAccountCode": "AR-B74D8B",
    "glBefore": 195286,
    "glAfter": 286,
    "operationalDue": 286,
    "gapBefore": 195000,
    "gapAfter": 0
  },
  {
    "contactId": "7c575448-3382-4587-a1c6-f05847733058",
    "customerName": "Walk-in Customer",
    "partyAccountCode": "AR-7C5754",
    "glBefore": 50400,
    "glAfter": 0,
    "operationalDue": 0,
    "gapBefore": 50400,
    "gapAfter": 0
  }
]
```

## Payment JE issues

```json
[
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0004",
    "invoiceNo": "DC-0006",
    "customerName": "PARVAISE  MARDAN",
    "partyAccountCode": "AR-B74D8B",
    "amount": 80000,
    "journalEntryNo": "RCV-0004",
    "lineId": "8869a4fc-49c5-44e0-bd83-4a68d2987acd"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0005",
    "invoiceNo": "DC-0007",
    "customerName": "MURAD  RAMDAS",
    "partyAccountCode": "AR-166142",
    "amount": 70000,
    "journalEntryNo": "RCV-0005",
    "lineId": "6c4389d7-21ec-4233-96f8-feda6df81384"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0006",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 200000,
    "journalEntryNo": "RCV-0006",
    "lineId": "66867f5b-0d21-416f-a56b-3b355eec167d"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0011",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 200000,
    "journalEntryNo": "RCV-0011",
    "lineId": "45fccad2-2b60-4983-93a4-e6ed67ae15d8"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0017",
    "invoiceNo": "DC-0007",
    "customerName": "MURAD  RAMDAS",
    "partyAccountCode": "AR-166142",
    "amount": 70000,
    "journalEntryNo": "RCV-0017",
    "lineId": "e0b1dd07-870e-4629-9064-ab4fb1370a5c"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0024",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 300000,
    "journalEntryNo": "RCV-0024",
    "lineId": "ff3d3e26-9e1c-4a3d-848d-d04978c15a75"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0028",
    "invoiceNo": "DC-0006",
    "customerName": "PARVAISE  MARDAN",
    "partyAccountCode": "AR-B74D8B",
    "amount": 70000,
    "journalEntryNo": "RCV-0028",
    "lineId": "c1a3d5cb-6e3f-40d7-ad49-40b3c2ed2222"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0031",
    "invoiceNo": "DC-0025",
    "customerName": "Walk-In Customer",
    "partyAccountCode": "AR-7C5754",
    "amount": 13400,
    "journalEntryNo": "RCV-0031",
    "lineId": "6350371f-56e2-40bb-8aa3-a3674d774c20"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0032",
    "invoiceNo": "DC-0025",
    "customerName": "Walk-In Customer",
    "partyAccountCode": "AR-7C5754",
    "amount": 37000,
    "journalEntryNo": "RCV-0032",
    "lineId": "049e6f67-4ffd-4c5b-946a-30c033712d4d"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0034",
    "invoiceNo": "DC-0007",
    "customerName": "MURAD  RAMDAS",
    "partyAccountCode": "AR-166142",
    "amount": 70000,
    "journalEntryNo": "RCV-0034",
    "lineId": "27e0ccdc-6261-481d-8ab8-0872d822744e"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0038",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 200000,
    "journalEntryNo": "RCV-0038",
    "lineId": "d8cd7fad-a63f-49e1-878d-956e1607af1d"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0043",
    "invoiceNo": "DC-0007",
    "customerName": "MURAD  RAMDAS",
    "partyAccountCode": "AR-166142",
    "amount": 47140,
    "journalEntryNo": "RCV-0043",
    "lineId": "552a282c-af4c-42e1-a2b6-8df1113d2c07"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0052",
    "invoiceNo": "DC-0006",
    "customerName": "PARVAISE  MARDAN",
    "partyAccountCode": "AR-B74D8B",
    "amount": 45000,
    "journalEntryNo": "RCV-0052",
    "lineId": "8f2fef50-3634-4318-9917-54e5efd3c1e5"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0053",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 200000,
    "journalEntryNo": "RCV-0053",
    "lineId": "42ee18da-dd5b-49b7-8897-87a9ec5a937d"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0057",
    "invoiceNo": "DC-0024",
    "customerName": "MR ALMAS NOW",
    "partyAccountCode": "AR-51A5ED",
    "amount": 196500,
    "journalEntryNo": "RCV-0057",
    "lineId": "8ce7baad-2d18-460e-97f6-7a5e0b156a58"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0060",
    "invoiceNo": "DC-0008",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 76839,
    "journalEntryNo": "RCV-0060",
    "lineId": "3830f099-3634-445e-bd09-c9f90647ccda"
  },
  {
    "kind": "ar_credit_on_control_not_party",
    "paymentRef": "RCV-0061",
    "invoiceNo": "DC-0009",
    "customerName": "HASSAN   MARDAN",
    "partyAccountCode": "AR-ED1ABD",
    "amount": 123161,
    "journalEntryNo": "RCV-0061",
    "lineId": "5283f1cf-d4d8-4547-b450-c34f3d052d21"
  }
]
```

## Customer rollups (top 10)

```json
[
  {
    "invoiceNo": "DC-0073",
    "total": 287725,
    "paid": 0,
    "due": 287725
  },
  {
    "invoiceNo": "DC-0041",
    "total": 323594,
    "paid": 323594,
    "due": 0
  },
  {
    "invoiceNo": "DC-0044",
    "total": 646000,
    "paid": 0,
    "due": 646000
  },
  {
    "invoiceNo": "DC-0054",
    "total": 799400,
    "paid": 0,
    "due": 799400
  },
  {
    "invoiceNo": "DC-0046",
    "total": 27740,
    "paid": 14848,
    "due": 12892
  },
  {
    "invoiceNo": "DC-0037",
    "total": 191026,
    "paid": 0,
    "due": 191026
  },
  {
    "invoiceNo": "DC-0017",
    "total": 463626,
    "paid": 0,
    "due": 463626
  },
  {
    "invoiceNo": "DC-0036",
    "total": 255864,
    "paid": 0,
    "due": 255864
  },
  {
    "invoiceNo": "DC-0042",
    "total": 204948,
    "paid": 0,
    "due": 204948
  },
  {
    "invoiceNo": "DC-0078",
    "total": 287700,
    "paid": 0,
    "due": 287700
  }
]
```