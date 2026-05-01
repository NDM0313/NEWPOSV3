Mobile–Web Data Sync & Balance Discrepancy — Implementation Plan
Problem Summary
Do alag alag masle hain:

1. Account Pre-Selection (FIXED ✅)
Edit form kholne par pehle se saved account select nahi hota tha. Fix: Saved account ko hamesha list mein include karo, chahe uska type filter se match na kare. Files fixed: EntryEditSheet.tsx, TransactionEditSheet.tsx

2. Balance Discrepancy (Web vs Mobile)
Web mein SATTAR ka closing balance alag, mobile mein alag.

Root Cause Analysis:

Mobile aur web dono ek hi Supabase database use karte hain — alag database nahi hain. Lekin balance alag isliye dikhta hai kyunki:

Issue	Detail
Cancel/Reversal entries	Web par purchase/sale cancel hone par reversal journal entries banti hain. Mobile ki ledger query mein yeh reversal entries count nahi ho rahi ya alag filter se aa rahi hain
Offline queue (IndexedDB)	Agar mobile offline tha jab cancel hua — to woh action queue mein hai aur abhi tak Supabase tak nahi pahuncha
Ledger computation difference	Web get_contact_party_gl_balances RPC use karta hai. Mobile getPaymentTransactions() use karta hai — dono alag queries hain
Branch filter	Mobile branch filter apply karta hai, web All Branches dikh sakta hai
Proposed Changes
Phase 1 — Immediate Fix: Offline Queue Sync Missing Items
[MODIFY] registerSyncHandlers.ts
purchase type ke liye sync handler register nahi tha — add karo
Cancel/void actions ke liye sync handler add karo
[NEW] lib/syncPurchase.ts
Purchase create/edit/cancel ko offline queue se Supabase tak push karne ka handler
[MODIFY] PurchaseModule.tsx
Jab purchase create ya cancel ho, addPending('purchase', ...) call karo taake offline bhi queue ho
Phase 2 — Balance Query Fix
[MODIFY] api/accounts.ts — getJournalEntries()
Reversal / cancellation entries ko bhi include karo (currently might be filtered)
is_void = false filter check karo — shayad cancelled entries ko bhi include karo
[MODIFY] Mobile Ledger Computation
Party ledger (supplier/customer) ko web ki tarah RPC se compute karo ya same SQL logic use karo
Currently getPaymentTransactions() sirf payments table se data le raha hai — journal entries se nahi
Phase 3 — Offline Sync Verification
[MODIFY] App.tsx — Sync status UI
Jab unsynced records hon to user ko clearly dikhao kitne records pending hain
Manual "Sync Now" button add karo
[NEW] lib/syncDebug.ts
Console mein log karo kon sa record sync nahi hua aur kyun
Verification Plan
Automated
bash
# TypeScript check
cd erp-mobile-app && npx tsc --noEmit
Manual Verification Steps
Web par ek sale cancel karo
Mobile par same party ki ledger check karo — balance match karna chahiye
Mobile offline karo, ek sale karo, online karo — verify karo sync hua
Edit form kholo — account pre-selected hona chahiye
Open Questions
IMPORTANT

Q1: Kya mobile ka balance discrepancy sirf SATTAR supplier ke liye hai ya sab parties ke liye? Agar sirf SATTAR ke liye hai, to issue specific cancelled purchases ka hai jo mobile mein reverse nahi hue.

WARNING

Q2: Mobile app offline mode actually use ho raha hai ya sirf code mein hai? Agar offline mode use nahi ho raha aur dono direct Supabase se connect hain, to IndexedDB queue ka data stale ho sakta hai aur double entries create ho sakti hain.

IMPORTANT

Q3: Kya purchase type ka registerSyncHandler missing hai? Agar haan, to offline pe li gayi purchases kabhi sync nahi hoti.

