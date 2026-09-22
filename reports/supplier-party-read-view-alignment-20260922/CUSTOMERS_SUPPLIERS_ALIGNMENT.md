# Customers & Suppliers Alignment

`loadCustomersSuppliersReport` still reads document totals from `get_customers_suppliers_report`.

After RPC map, supplier rows overlay:

```
due = max(0, businessNet)
advanceGl = max(0, -businessNet)
```

via `loadSupplierBusinessGlBalancesMap` + `mapSupplierBusinessNetToDueAdvance`.

| Contact type | Due/Advance (GL) |
|--------------|------------------|
| supplier / both / money_exchange | Business-attributed net |
| worker / courier | Filtered out of report (unchanged) |
| customer | RPC Due/Advance unchanged |

Document totals (purchases/payments/sales) are **not** altered.

ARIF: Due (GL) = **39,937**, Advance (GL) = **0**.
