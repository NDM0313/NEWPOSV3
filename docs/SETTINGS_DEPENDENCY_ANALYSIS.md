# Settings Dependency Analysis

**Purpose:** Identify which settings are critical at business creation time vs. configurable later, for Create Business wizard design.

**Source:** Settings documentation, SettingsPageNew, SettingsContext, create_business_transaction.

---

## 1. Company Settings

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Business Name | ✅ Yes | Yes | No | Yes (company name in all records) |
| Business Address | No | ✅ Yes | No | No |
| Business Phone | No | ✅ Yes | No | No |
| Business Email | ✅ Yes | Yes | No | Yes (company email) |
| Tax ID / NTN | No | ✅ Yes | No | No |
| Logo URL | No | ✅ Yes | No | No |
| Currency | ✅ **Yes** | No (locked) | ✅ Yes | ✅ Yes |
| Date Format | No | ✅ Yes | No | No |
| Time Format | No | ✅ Yes | No | No |
| Timezone | No | ✅ Yes | No | No |
| Decimal Precision | No | ✅ Yes | No | No |

---

## 2. Branch Settings

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| First Branch Name | ✅ **Yes** | Yes | No | Yes |
| Branch Code | ✅ **Yes** | Yes | No | Yes |
| Branch Address | No | ✅ Yes | No | No |
| Default Cash Account | No | ✅ Yes | ✅ Yes | No |
| Default Bank Account | No | ✅ Yes | ✅ Yes | No |
| POS Cash Drawer | No | ✅ Yes | ✅ Yes | No |
| Enable Multi-Branch | ✅ **Yes** | Yes | No | Yes (structure) |

---

## 3. Financial Year

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Fiscal Year Start | ✅ **Yes** | No (locked) | ✅ Yes | ✅ Yes |
| Fiscal Year End | ✅ Derived | No | ✅ Yes | Yes |
| Accounting Method (Accrual/Cash) | No | ✅ Yes | ✅ Yes | No |
| Lock Accounting Date | No | ✅ Yes | ✅ Yes | Yes |

---

## 4. Currency

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Currency | ✅ **Yes** | No (locked) | ✅ Yes | ✅ Yes |
| Multi-Currency | No | ✅ Yes | ✅ Yes | Yes |

---

## 5. Tax Settings

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Default Tax Rate | No | ✅ Yes | ✅ Yes | No |
| Tax Mode (Inclusive/Exclusive) | No | ✅ Yes | ✅ Yes | No |
| Multiple Tax Rates | No | ✅ Yes | ✅ Yes | No |

---

## 6. Units of Measurement

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Base Unit (Piece) | ✅ Auto-created | Yes | No | Yes (products) |
| Additional Units | No | ✅ Yes | No | Yes |
| Default Unit System | No | ✅ Yes | No | No |

---

## 7. Modules Enable/Disable

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Sales | No | ✅ Yes | No | No |
| Purchases | No | ✅ Yes | No | No |
| Rentals | No | ✅ Yes | No | No |
| POS | No | ✅ Yes | No | No |
| Studio Production | No | ✅ Yes | No | No |
| Accounting | No | ✅ Yes | No | No |
| Expenses | No | ✅ Yes | No | No |
| Reports | No | ✅ Yes | No | No |
| Payroll (future) | No | ✅ Yes | No | No |

**Note:** Modules affect sidebar visibility. At least one module required.

---

## 8. Chart of Accounts Defaults

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Default Chart | ✅ **Yes** (auto-generated) | Yes | ✅ Yes | No |
| Cash | ✅ Auto | Yes | ✅ Yes | No |
| Bank | ✅ Auto | Yes | ✅ Yes | No |
| Mobile Wallet | ✅ Auto | Yes | ✅ Yes | No |
| AR / AP | ✅ Auto | Yes | ✅ Yes | No |

---

## 9. Logo & Branding

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Logo Upload | No | ✅ Yes | No | No |
| Primary Color | No | ✅ Yes | No | No |
| Theme | No | ✅ Yes | No | No |

---

## 10. Numbering Formats

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Invoice Prefix | No | ✅ Yes | No | No |
| Sale Prefix | No | ✅ Yes | No | No |
| Purchase Prefix | No | ✅ Yes | No | No |
| Journal Prefix | No | ✅ Yes | No | No |
| Expense Prefix | No | ✅ Yes | No | No |
| Rental Prefix | No | ✅ Yes | No | No |
| POS Prefix | No | ✅ Yes | No | No |
| Studio Prefix | No | ✅ Yes | No | No |
| Starting Numbers | No | ✅ Yes | No | No |

---

## 11. Inventory Settings

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Costing Method (FIFO/Avg) | No | ✅ Yes | ✅ Yes | Yes |
| Allow Negative Stock | No | ✅ Yes | No | Yes |
| Low Stock Threshold | No | ✅ Yes | No | No |
| Default Unit | No | ✅ Yes | No | No |

---

## 12. POS Settings

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Default Cash Account | No | ✅ Yes | ✅ Yes | No |
| Default Tax Rate | No | ✅ Yes | No | No |
| Auto Print Receipt | No | ✅ Yes | No | No |
| Negative Stock | No | ✅ Yes | No | Yes |

---

## 13. Payment Methods

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Cash | ✅ Auto | Yes | ✅ Yes | No |
| Bank | ✅ Auto | Yes | ✅ Yes | No |
| Mobile Wallet | ✅ Auto | Yes | ✅ Yes | No |
| Default Payment Method | No | ✅ Yes | No | No |

---

## 14. Roles & Permissions

| Setting | Critical at Creation | Can Configure Later | Affects Accounting | Affects Data Integrity |
|---------|---------------------|-------------------|-------------------|------------------------|
| Super Admin | ✅ Auto | Yes | No | Yes |
| Default Roles | No | ✅ Yes | No | No |
| RBAC | No | ✅ Yes | No | No |

---

## Summary: Critical at Creation Time

### Must Have (Required)

1. **Business Name** — unique per owner
2. **Currency** — mandatory
3. **Financial Year Start** — mandatory
4. **At least one branch** — required
5. **At least one module** — required

### Optional but Recommended

- Business Type (Retail/Rental/Manufacturing)
- Logo URL
- Phone, Email, Address
- Country, Timezone
- Accounting method (Accrual/Cash)
- Default tax mode
- Default tax %
- Enable multi-branch
- Default costing method
- Allow negative stock
- Base units

### Auto-Generated

- Default chart of accounts
- Default payment methods (Cash, Bank, Mobile Wallet)
- Default units (Piece)
- Numbering sequences
- Super Admin role

---

## Future-Safe Design

- **GST modules:** Add tax config step in wizard
- **Multi-currency:** Add currency toggle at creation
- **Payroll:** Add module checkbox (future-ready)
- **Subscription plans:** Add plan selection step (future)
