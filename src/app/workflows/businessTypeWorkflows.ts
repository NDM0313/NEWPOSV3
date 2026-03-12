/**
 * Business type workflow templates.
 * Each type has an ordered list of steps; UI can show "Next: …" or guide the user.
 */

export type BusinessTypeId = 'retail' | 'wholesale' | 'manufacturing' | 'rental' | 'mixed';

export interface WorkflowStep {
  id: string;
  label: string;
  /** Route path (e.g. /sales) for navigation; optional */
  route?: string;
  /** Module this step belongs to (sales, purchases, rentals, studio, etc.) */
  module?: string;
}

/** Workflow definition: ordered steps for a business type */
export interface WorkflowTemplate {
  type: BusinessTypeId;
  label: string;
  steps: WorkflowStep[];
}

const RETAIL_STEPS: WorkflowStep[] = [
  { id: 'sale', label: 'Sale', route: '/sales', module: 'sales' },
  { id: 'payment', label: 'Payment', module: 'sales' },
  { id: 'receipt', label: 'Receipt', module: 'sales' },
];

const WHOLESALE_STEPS: WorkflowStep[] = [
  { id: 'sale', label: 'Sale', route: '/sales', module: 'sales' },
  { id: 'packing_list', label: 'Packing List', module: 'sales' },
  { id: 'courier', label: 'Courier / Shipment', module: 'sales' },
  { id: 'payment', label: 'Payment', module: 'sales' },
];

const MANUFACTURING_STEPS: WorkflowStep[] = [
  { id: 'purchase_rm', label: 'Purchase Raw Material', route: '/purchases', module: 'purchases' },
  { id: 'production', label: 'Production', route: '/studio', module: 'studio' },
  { id: 'finished_goods', label: 'Finished Goods', module: 'inventory' },
  { id: 'sale', label: 'Sale', route: '/sales', module: 'sales' },
];

const RENTAL_STEPS: WorkflowStep[] = [
  { id: 'booking', label: 'Rental Booking', route: '/rentals', module: 'rentals' },
  { id: 'dispatch', label: 'Dispatch', module: 'rentals' },
  { id: 'return', label: 'Return', module: 'rentals' },
  { id: 'payment', label: 'Payment', module: 'rentals' },
];

/** Mixed: no fixed order; all modules available */
const MIXED_STEPS: WorkflowStep[] = [
  { id: 'sale', label: 'Sale', route: '/sales', module: 'sales' },
  { id: 'purchase', label: 'Purchase', route: '/purchases', module: 'purchases' },
  { id: 'rental', label: 'Rental', route: '/rentals', module: 'rentals' },
  { id: 'studio', label: 'Studio Production', route: '/studio', module: 'studio' },
  { id: 'payment', label: 'Payment', module: 'sales' },
];

export const WORKFLOW_TEMPLATES: Record<BusinessTypeId, WorkflowTemplate> = {
  retail: { type: 'retail', label: 'Retail', steps: RETAIL_STEPS },
  wholesale: { type: 'wholesale', label: 'Wholesale', steps: WHOLESALE_STEPS },
  manufacturing: { type: 'manufacturing', label: 'Manufacturing', steps: MANUFACTURING_STEPS },
  rental: { type: 'rental', label: 'Rental', steps: RENTAL_STEPS },
  mixed: { type: 'mixed', label: 'Mixed', steps: MIXED_STEPS },
};

/**
 * Get workflow steps for a business type.
 * Returns mixed workflow if type is unknown or null.
 */
export function getWorkflowForBusinessType(
  businessType: string | null | undefined
): WorkflowTemplate {
  const id = (businessType ?? 'mixed').toLowerCase() as BusinessTypeId;
  return WORKFLOW_TEMPLATES[id] ?? WORKFLOW_TEMPLATES.mixed;
}

/**
 * Get the next step in the workflow after the given step id.
 * Returns undefined if current is last or not found.
 */
export function getNextWorkflowStep(
  businessType: string | null | undefined,
  currentStepId: string
): WorkflowStep | undefined {
  const workflow = getWorkflowForBusinessType(businessType);
  const idx = workflow.steps.findIndex((s) => s.id === currentStepId);
  if (idx < 0 || idx >= workflow.steps.length - 1) return undefined;
  return workflow.steps[idx + 1];
}
