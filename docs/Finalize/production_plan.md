# Execution Plan: NEWPOSV3 Pre-Launch Finalization

This document outlines the step-by-step plan to finalize the `erp-mobile-app` (React/Vite frontend) and Supabase backend. Please operate in Plan Mode and execute these steps sequentially. Do not proceed to the next step until the current one is fully implemented, reviewed, and confirmed.

## Step 1: User Permissions & Legacy Keys Cleanup
- **Goal:** Sanitize the RBAC system to ensure database stability and a clean UI.
- **Actions:**
  1. Scan the Supabase database schema and the React codebase for extra, legacy, or test permission keys that are redundant.
  2. Present a highlighted list of these extra keys to the user for review.
  3. Upon user confirmation, safely delete them from the database and remove/hide them from the UI.
  4. Ensure the core hierarchy is untouched: Owner/Admin (bypass/full access) > Manager (branch/assigned access) > Salesman (self access only).

## Step 2: Automated Devaluation Logic for Rentals
- **Goal:** Eliminate manual devaluation entries and ensure correct accounting routes (Devaluation must hit rental income, NOT physical cash).
- **Actions:**
  1. Create a global setting in the database (e.g., `default_dress_devaluation`) initialized at 5000.
  2. Build a UI field in the Owner Settings (Mobile App/React) to modify this amount dynamically (e.g., update from 5000 to 10000).
  3. Automate the rental entry workflow: When a new rental transaction is created, automatically pass a double entry for devaluation expense and rental income using this default amount. 
  4. **Critical Accounting Rule:** Ensure this automated devaluation strictly routes through the 'Rental Income' accounts. It must NEVER deduct from the 'Cash' account to avoid cash drawer shortages.

## Step 3: Company-Specific Backup and Restore
- **Goal:** Provide a safe, isolated backup system for Owners to secure data before providing salesman access.
- **Actions:**
  1. **Backup:** Implement a JSON export function that is strictly filtered by the active `company_id` of the logged-in Owner. Do not dump the entire database.
  2. **Restore:** Build a highly secure restore function that:
     - Validates the uploaded JSON matches the correct `company_id`.
     - Issues a strict UI warning about overwriting current data.
     - Clears the existing company data in the correct order to prevent foreign-key constraint violations.
     - Inserts the new backed-up data hierarchically (e.g., users/items first, then transactions/ledgers).
  3. Restrict this entire Backup/Restore feature exclusively to the 'Owner' role.

## Step 4: Phase 2 Deferral
- **Note to Agent:** Do NOT build the Developer Database Mapping UI right now. Keep the existing hardcoded mappings intact to ensure fast deployment. This will be handled in Phase 2 after the system is live.