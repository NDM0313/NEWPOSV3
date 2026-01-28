# Customer Ledger Test Page - Instructions

## Overview

The Test Ledger page (`/src/app/TestLedger.tsx`) is a comprehensive testing tool for all Customer Ledger API endpoints and database operations. **DO NOT modify the main application until all tests pass successfully.**

## Accessing the Test Page

### Option 1: Via Navigation Context
Add to your navigation menu or access programmatically:
```typescript
import { useNavigation } from '@/app/context/NavigationContext';

const { setCurrentView } = useNavigation();
setCurrentView('test-ledger');
```

### Option 2: Direct URL (if routing is configured)
Navigate to: `/test-ledger`

### Option 3: Add to Sidebar
Add a menu item in `src/app/components/layout/Sidebar.tsx`:
```typescript
{ id: 'test-ledger', label: 'Test Ledger', icon: FlaskConical }
```

## Test Coverage

The test page validates the following operations:

### 1. Get All Customers
- ✅ Fetches all customers for the current company
- ✅ Validates array structure
- ✅ Handles empty results gracefully

### 2. Get Customer By ID
- ✅ Fetches individual customer details
- ✅ Validates customer data structure
- ✅ Verifies all required fields

### 3. Get Ledger Summary
- ✅ Fetches ledger summary with date range
- ✅ Validates opening balance calculation
- ✅ Validates closing balance calculation
- ✅ Verifies invoice counts and amounts

### 4. Get Transactions
- ✅ Fetches all transactions for a customer
- ✅ Validates transaction structure
- ✅ Verifies running balance calculation
- ✅ Validates transaction types (Sale, Payment, Discount)

### 5. Get Invoices
- ✅ Fetches all invoices for a customer
- ✅ Validates invoice structure
- ✅ Verifies invoice status mapping
- ✅ Validates line items

### 6. Get Payments
- ✅ Fetches all payments for a customer
- ✅ Validates payment structure
- ✅ Verifies payment-to-invoice linkage
- ✅ Validates payment methods

### 7. Get Aging Report
- ✅ Fetches aging report
- ✅ Validates aging bucket calculations
- ✅ Verifies total outstanding amount

## Running Tests

1. **Ensure you are logged in** - The test page requires a valid company ID
2. **Click "Run All Tests"** - This will execute all API endpoint tests sequentially
3. **Check Console** - Open browser DevTools (F12) to see detailed logs
4. **Review Results** - Each test shows:
   - Status (Success/Error/Running)
   - Execution time
   - Error messages (if any)
   - Data preview

## Test Results Interpretation

### Success Indicators
- ✅ Green checkmark icon
- "✅ Test passed" message
- Execution time displayed
- Data preview available

### Error Indicators
- ❌ Red X icon
- Error message displayed
- Stack trace in console
- Detailed error information

### Performance Metrics
- Each test shows execution time in milliseconds
- Monitor for slow queries (>1000ms may indicate issues)

## Console Logging

The test page provides detailed console logging:

```
[TEST SUITE] Starting Customer Ledger API Tests
[TEST] Company ID: <company-id>
[TEST] User ID: <user-id>
[TEST] Starting: 1. Get All Customers
[TEST] ✅ Success: 1. Get All Customers (234ms)
[TEST] Found 5 customers: [...]
...
[TEST SUITE] Test Summary
[TEST SUITE] Total: 7, Passed: 7, Failed: 0
```

## Data Validation

The test page validates:

1. **Data Structure** - Ensures all required fields are present
2. **Data Types** - Verifies correct data types (strings, numbers, arrays)
3. **Data Relationships** - Checks linkages between entities
4. **Calculations** - Validates computed values (balances, totals)

## Common Issues & Solutions

### Issue: "Company ID not available"
**Solution:** Ensure you are logged in and have a valid company assigned

### Issue: "No customers found"
**Solution:** This is expected if the database is empty. Create test customers first.

### Issue: "Column does not exist" errors
**Solution:** Check database schema matches expected structure. Review `LEDGER_INTEGRATION_ANALYSIS.md`

### Issue: "400 Bad Request" errors
**Solution:** Check API query structure. Review `customerLedgerApi.ts` for query syntax.

### Issue: "406 Not Acceptable" errors
**Solution:** Check Supabase RLS policies and column permissions.

## Next Steps After Tests Pass

Once all tests pass successfully:

1. ✅ Review test data preview to ensure data mapping is correct
2. ✅ Verify all calculations are accurate
3. ✅ Check performance metrics (all tests should complete in <1000ms)
4. ✅ Proceed to Phase 4: API Service Layer updates
5. ✅ Proceed to Phase 5-8: Main application integration

## Important Notes

- **DO NOT** modify main application components until tests pass
- **DO NOT** skip test failures - fix underlying issues first
- **DO** review console logs for detailed debugging information
- **DO** verify data structure matches frontend expectations
- **DO** test with real data before deploying to production

## Support

If tests fail:
1. Check browser console for detailed error messages
2. Review `LEDGER_INTEGRATION_ANALYSIS.md` for schema requirements
3. Verify Supabase connection and permissions
4. Check `customerLedgerApi.ts` for query syntax issues
