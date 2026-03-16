# Expense category → account mapping

User-facing expense categories (Rent, Utilities, Salary, etc.) are **not** raw Chart of Accounts. They come from `expense_categories` or the fallback list and map to one COA expense account for posting.

## Source

- **Main Expenses module** and **Add Entry V2 → Expense Payment** both use:
  - `expenseCategoryService.getOperatingCategoriesForPicker(companyId)` for the category dropdown, or
  - `expenseCategoryService.getTree(companyId)` (main module) with fallback to FALLBACK_CATEGORIES when no DB categories.

## Slug → code (operating expense only)

Used by `getExpenseAccountIdForCategory(companyId, categorySlug)` when resolving which account to use for posting. Internal/backend accounts are excluded from the picker and from this mapping.

| Category slug     | Preferred code |
|-------------------|----------------|
| rent              | 5400           |
| utilities         | 5500           |
| salaries / salary | 5600           |
| marketing         | 5700           |
| travel            | 5800           |
| office_supplies   | 5810           |
| repairs / repairs_maintenance | 5820 |
| other / miscellaneous | 5900        |

## Excluded from user-facing picker

- Cost of Production (5000, 5010)
- Shipping Expense (5100)
- Extra Expense (5200, 5300) – sales-linked
- Courier Payable / child courier accounts
- AP, AR, Worker Payable, control accounts

These remain in COA and in backend flows (shipment, production, sales); they are not shown in the general expense category dropdown.

## Payment accounts only

`accountService.getPaymentAccountsOnly(companyId)` returns only Cash, Bank, Mobile Wallet (by type/account_role or code 1000/1010/1020). Used for:

- Main Expenses → Paid From
- Add Entry V2 → Payment account (Cr) for all payment entry types

AP, AR, expense, revenue, payable, receivable, production, shipping accounts are excluded from payment account dropdowns.
