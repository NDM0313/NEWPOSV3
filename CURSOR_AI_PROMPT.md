# 🤖 CURSOR AI PROMPT - DIN COLLECTION ERP UPDATE

## 📋 **COPY THIS PROMPT AND PASTE IN CURSOR**

---

## 🎯 **PROMPT FOR CURSOR AI**

```
I need to update my Din Collection ERP system with new features. I have a ZIP file with updated code. Please help me implement these changes step-by-step.

## CONTEXT:
- Project: Din Collection Bridal Rental ERP
- Tech Stack: React + TypeScript + Tailwind CSS
- Current Status: Phase 1 complete (Settings, Accounting, Basic Modules)
- Update Goal: Add Auto-Numbering + Enhanced Reports + Keyboard Shortcuts

## WHAT NEEDS TO BE DONE:

### STEP 1: CREATE NEW CONTEXT FILES
Please create these 3 new context files:

1. `/src/app/context/SalesContext.tsx`
   - Auto-numbering for invoices (INV-0001) and quotations (QUO-0001)
   - Complete CRUD operations
   - Payment recording
   - Shipping status management
   - Accounting integration

2. `/src/app/context/PurchaseContext.tsx`
   - Auto-numbering for purchase orders (PO-0001)
   - Complete CRUD operations
   - Payment recording
   - Stock receiving workflow
   - Status management (Draft → Ordered → Received → Completed)

3. `/src/app/context/ExpenseContext.tsx`
   - Auto-numbering for expenses (EXP-0001)
   - Categories (Rent, Utilities, Salaries, Marketing, etc.)
   - Approval workflow (Draft → Submitted → Approved → Paid)
   - Category-wise filtering and totals

### STEP 2: CREATE HOOKS
Please create these 2 hook files:

1. `/src/app/hooks/useDocumentNumbering.ts`
   - Generate document numbers with customizable prefix and padding
   - Support for: invoice, quotation, purchase, rental, studio, expense
   - Settings integration for custom patterns
   - Increment next number functionality

2. `/src/app/hooks/useKeyboardShortcuts.ts`
   - Global keyboard shortcuts
   - Ctrl+1-9 for navigation
   - Ctrl+N for new entry
   - Ctrl+S for save
   - Ctrl+F for search
   - Ctrl+/ for help modal
   - Disable in input fields

### STEP 3: CREATE COMPONENTS
Please create these 2 component files:

1. `/src/app/components/shared/KeyboardShortcutsModal.tsx`
   - Modal that opens with Ctrl+/
   - Display all keyboard shortcuts in a table
   - Grouped by category (Navigation, Actions, Search, Help)
   - Export KeyboardShortcutsButton for settings page

2. `/src/app/components/reports/ReportsDashboardEnhanced.tsx`
   - Real-time data from all contexts (Sales, Purchases, Expenses)
   - Comprehensive metrics (Revenue, Expenses, Profit, Margin)
   - 4 charts: Line (Monthly Trend), Pie (Payment Status), Bar (Expenses), Summary
   - Use recharts library
   - Date range filtering
   - Export PDF button (placeholder)

### STEP 4: UPDATE EXISTING FILES

1. `/src/app/App.tsx`
   ADD IMPORTS:
   ```typescript
   import { SalesProvider } from './context/SalesContext';
   import { PurchaseProvider } from './context/PurchaseContext';
   import { ExpenseProvider } from './context/ExpenseContext';
   import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
   import { KeyboardShortcutsModal } from './components/shared/KeyboardShortcutsModal';
   import { ReportsDashboardEnhanced } from './components/reports/ReportsDashboardEnhanced';
   ```
   
   IN AppContent():
   ```typescript
   const AppContent = () => {
     const { currentView } = useNavigation();
     useKeyboardShortcuts(); // ADD THIS
     // ... rest of code
   ```
   
   UPDATE PROVIDER HIERARCHY:
   ```typescript
   <SettingsProvider>
     <SalesProvider>
       <PurchaseProvider>
         <ExpenseProvider>
           <NavigationProvider>
             <AppContent />
             <Toaster position="bottom-right" theme="dark" />
             <KeyboardShortcutsModal />
           </NavigationProvider>
         </ExpenseProvider>
       </PurchaseProvider>
     </SalesProvider>
   </SettingsProvider>
   ```
   
   CHANGE REPORTS VIEW:
   ```typescript
   {currentView === 'reports' && <ReportsDashboardEnhanced />}
   ```

2. `/src/app/components/shared/UnifiedPaymentDialog.tsx`
   ADD:
   ```typescript
   import { useSettings } from '@/app/context/SettingsContext';
   
   // Inside component:
   const settings = useSettings();
   
   // Replace useEffect for paymentMethod:
   React.useEffect(() => {
     const defaultPayment = settings.defaultAccounts?.paymentMethods?.find(
       p => p.method === paymentMethod
     );
     
     if (defaultPayment?.defaultAccount) {
       const matchingAccount = accounting.accounts.find(
         acc => acc.type === paymentMethod && acc.name === defaultPayment.defaultAccount
       );
       
       if (matchingAccount) {
         setSelectedAccount(matchingAccount.id);
         return;
       }
     }
     
     setSelectedAccount('');
   }, [paymentMethod, settings.defaultAccounts, accounting.accounts]);
   ```

3. `/src/app/components/ui/chart.tsx`
   UPDATE ChartContainer:
   ```typescript
   <div ref={ref} className={cn("min-h-[320px] h-full w-full", className)}>
   ```

## REQUIREMENTS:
- Use TypeScript with proper types
- Follow existing code patterns
- Use dark theme (#111827 background)
- Add toast notifications (using sonner)
- Integrate with existing AccountingContext
- Integrate with existing SettingsContext
- Follow double-entry accounting principles
- All contexts should auto-post to accounting

## DEPENDENCIES NEEDED:
- recharts (for charts)
- sonner (for toasts) - already installed
- lucide-react (for icons) - already installed

Please implement these changes step-by-step. After each file, confirm it's created successfully before moving to the next one.

Start with STEP 1: Create SalesContext.tsx
```

---

## 🎯 **ALTERNATIVE: SHORT PROMPT (If you have files ready)**

```
I have updated files for my Din Collection ERP. Please help me add them to the project:

NEW FILES TO CREATE:
1. /src/app/context/SalesContext.tsx [I'll paste content]
2. /src/app/context/PurchaseContext.tsx [I'll paste content]
3. /src/app/context/ExpenseContext.tsx [I'll paste content]
4. /src/app/hooks/useDocumentNumbering.ts [I'll paste content]
5. /src/app/hooks/useKeyboardShortcuts.ts [I'll paste content]
6. /src/app/components/shared/KeyboardShortcutsModal.tsx [I'll paste content]
7. /src/app/components/reports/ReportsDashboardEnhanced.tsx [I'll paste content]

FILES TO UPDATE:
1. /src/app/App.tsx - Add new providers and imports
2. /src/app/components/shared/UnifiedPaymentDialog.tsx - Add auto-select logic
3. /src/app/components/ui/chart.tsx - Add min-h-[320px] class

Let's start with creating the first file. I'll paste the content next.
```

---

## 🎯 **STEP-BY-STEP CURSOR WORKFLOW**

### **METHOD 1: AI-Generated (Recommended for understanding)**

1. **Open Cursor**
2. **Press Ctrl+L** (or Cmd+L on Mac) to open AI chat
3. **Paste the main prompt above**
4. **AI will create files one-by-one**
5. **Confirm each file before proceeding**
6. **Test after all files are created**

### **METHOD 2: Copy-Paste (Fastest)**

1. **Open Cursor**
2. **For each NEW file:**
   - Right-click on folder → New File
   - Create file with exact name
   - Paste content from ZIP
   - Save (Ctrl+S)

3. **For each MODIFIED file:**
   - Open existing file
   - Use Cursor AI: "Update this file according to UPDATE_GUIDE_FOR_CURSOR.md"
   - Or manually apply changes

---

## 🎯 **CURSOR AI COMMANDS - USEFUL SHORTCUTS**

### **Create New File:**
```
@workspace Create a new file at /src/app/context/SalesContext.tsx with the following content:
[paste content]
```

### **Update Existing File:**
```
@workspace Update /src/app/App.tsx:
- Add these imports: [list]
- Add these providers: [list]
- Add this hook call: [code]
```

### **Fix Imports:**
```
@workspace Fix all import errors in the current file
```

### **Add Missing Dependencies:**
```
@workspace Check and install missing dependencies for this project
```

### **Explain Code:**
```
@workspace Explain what this context/hook does and how to use it
```

---

## 🎯 **CURSOR COMPOSER MODE (Best for Large Updates)**

### **How to Use Composer:**

1. **Press Ctrl+I** (or Cmd+I) in Cursor
2. **Paste this prompt:**

```
I need to update my Din Collection ERP with new features. Here's what needs to be done:

PHASE 1: Create Contexts
- Create SalesContext.tsx with auto-numbering (INV-XXXX)
- Create PurchaseContext.tsx with auto-numbering (PO-XXXX)
- Create ExpenseContext.tsx with auto-numbering (EXP-XXXX)
All should integrate with AccountingContext and SettingsContext.

PHASE 2: Create Hooks
- Create useDocumentNumbering.ts for auto-generating numbers
- Create useKeyboardShortcuts.ts for global shortcuts

PHASE 3: Create Components
- Create KeyboardShortcutsModal.tsx (opens with Ctrl+/)
- Create ReportsDashboardEnhanced.tsx with recharts

PHASE 4: Update Files
- Update App.tsx with new providers
- Update UnifiedPaymentDialog.tsx with auto-select
- Update chart.tsx with min-h class

Use existing patterns from AccountingContext and SettingsContext. Follow dark theme #111827.

Start with Phase 1 - Create SalesContext.tsx first.
```

3. **AI will create multiple files**
4. **Review and accept changes**
5. **Test incrementally**

---

## 🎯 **CURSOR INLINE EDIT PROMPTS**

### **For App.tsx:**
Select the provider section, press Ctrl+K, then:
```
Add SalesProvider, PurchaseProvider, and ExpenseProvider wrapping NavigationProvider. Also add KeyboardShortcutsModal before closing NavigationProvider.
```

### **For UnifiedPaymentDialog.tsx:**
Select the useEffect, press Ctrl+K, then:
```
Update this useEffect to auto-select default account from settings.defaultAccounts based on paymentMethod
```

### **For chart.tsx:**
Select ChartContainer div, press Ctrl+K, then:
```
Add min-h-[320px] h-full w-full classes to prevent dimension errors
```

---

## 🎯 **CURSOR TERMINAL COMMANDS**

After creating files, run these in Cursor terminal:

```bash
# Check TypeScript errors
npm run build

# Start dev server
npm run dev

# Install missing dependencies (if needed)
npm install recharts

# Check for unused imports
npm run lint
```

---

## 🎯 **TROUBLESHOOTING IN CURSOR**

### **Import Errors:**
```
@workspace Fix all import paths in this file to use @ alias correctly
```

### **Type Errors:**
```
@workspace Fix TypeScript errors in this file while maintaining functionality
```

### **Missing Types:**
```
@workspace Add proper TypeScript types for this context/hook
```

### **Integration Issues:**
```
@workspace Check if this context integrates correctly with AccountingContext and SettingsContext
```

---

## 🎯 **CURSOR AI VERIFICATION PROMPTS**

### **After Creating All Files:**
```
@workspace Verify that:
1. All new contexts are properly typed
2. All hooks have correct dependencies
3. All components follow existing patterns
4. App.tsx has correct provider hierarchy
5. No import errors exist
```

### **Before Testing:**
```
@workspace Check if the following features will work:
1. Auto-numbering for INV, PO, EXP
2. Keyboard shortcuts (Ctrl+1-9)
3. Enhanced reports with charts
4. Default account auto-selection
5. Toast notifications on CRUD operations
```

---

## 📋 **COMPLETE CURSOR WORKFLOW**

### **FULL PROCESS:**

1. **Open Cursor IDE**
2. **Open your Din Collection ERP project**
3. **Open AI Chat (Ctrl+L)**
4. **Paste the main prompt from top of this file**
5. **Let AI create files one by one**
6. **For each file created:**
   - Review the code
   - Check imports
   - Save the file
   - Confirm with AI to proceed
7. **After all files created:**
   - Run `npm run build`
   - Check for errors
   - Run `npm run dev`
   - Test features
8. **Use testing checklist from UPDATE_GUIDE_FOR_CURSOR.md**

---

## 🎯 **QUICK REFERENCE - CURSOR SHORTCUTS**

```
Ctrl+L          Open AI Chat
Ctrl+K          Inline Edit
Ctrl+I          Composer Mode
Ctrl+Shift+P    Command Palette
Ctrl+P          Quick Open File
Ctrl+`          Toggle Terminal
Ctrl+B          Toggle Sidebar
Ctrl+/          Toggle Comment
Ctrl+S          Save File
Ctrl+Shift+F    Search in Files
```

---

## 💡 **PRO TIPS FOR CURSOR**

1. **Use @workspace** - Let AI see your whole project
2. **Use Composer Mode** - Best for multi-file updates
3. **Accept Incrementally** - Review each change
4. **Test Frequently** - Don't wait till end
5. **Use Inline Edit** - Quick fixes with Ctrl+K
6. **Save Often** - Ctrl+S after each file
7. **Check Terminal** - Watch for TypeScript errors

---

## 🎊 **FINAL CURSOR VERIFICATION PROMPT**

After everything is done, paste this:

```
@workspace Please verify the Din Collection ERP update is complete:

CHECK:
- ✅ SalesContext.tsx exists and exports useSales
- ✅ PurchaseContext.tsx exists and exports usePurchases
- ✅ ExpenseContext.tsx exists and exports useExpenses
- ✅ useDocumentNumbering.ts generates numbers correctly
- ✅ useKeyboardShortcuts.ts has 15+ shortcuts
- ✅ KeyboardShortcutsModal.tsx opens with Ctrl+/
- ✅ ReportsDashboardEnhanced.tsx shows 4 charts
- ✅ App.tsx has all providers in correct order
- ✅ UnifiedPaymentDialog.tsx auto-selects defaults
- ✅ chart.tsx has min-h-[320px] class
- ✅ No TypeScript errors
- ✅ All imports resolve correctly

Generate a summary of what was implemented.
```

---

## 📊 **EXPECTED RESULT**

After using this prompt, you should have:

✅ **7 new files created**
✅ **3 files updated**
✅ **No TypeScript errors**
✅ **Dev server running**
✅ **All features working:**
   - Auto-numbering (INV-0001, PO-0001, EXP-0001)
   - Keyboard shortcuts (15+)
   - Enhanced reports with charts
   - Default account auto-selection
   - Toast notifications

---

## 🚀 **START NOW!**

**Copy the main prompt above and paste it in Cursor AI Chat (Ctrl+L)**

**Good Luck! 🎉**

---

**Last Updated:** January 18, 2026  
**For:** Din Collection ERP v1.0.0  
**Cursor Version:** Any recent version
