export type ExtraExpenseType =

  | 'stitching'

  | 'lining'

  | 'dying'

  | 'cargo'

  | 'Mobile Wallet'

  | 'other';



export interface ExtraExpense {

  id: string;

  type: ExtraExpenseType;

  amount: number;

  notes?: string;

  /** Tailor/dyer expense sub-category (preferred). */
  tailorExpenseCategoryId?: string;
  /** Legacy contact id (hydrate only). */
  tailorContactId?: string;

}



export const EXTRA_EXPENSE_TYPE_OPTIONS: { value: ExtraExpenseType; label: string }[] = [

  { value: 'stitching', label: 'Stitching' },

  { value: 'lining', label: 'Lining' },

  { value: 'dying', label: 'Dying' },

  { value: 'cargo', label: 'Cargo' },

  { value: 'Mobile Wallet', label: 'Mobile Wallet' },

  { value: 'other', label: 'Other' },

];


