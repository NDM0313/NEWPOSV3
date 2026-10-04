/** Lean Day Book / journal list select — headers only, no nested lines or wide jsonb. */
export const JOURNAL_ENTRIES_LIST_SELECT =
  'id,entry_no,entry_date,created_at,description,reference_type,reference_id,total_debit,total_credit,is_void,payment_id,branch_id,company_id,action_fingerprint,economic_event_id';

/** Default Day Book page size (AccountingContext). */
export const ENTRIES_FETCH_LIMIT = 100;

/** Fallback page size after Postgres statement timeout (57014). */
export const ENTRIES_FETCH_LIMIT_ON_TIMEOUT = 50;
