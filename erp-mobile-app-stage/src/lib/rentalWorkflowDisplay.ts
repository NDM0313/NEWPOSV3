export type RentalWorkflowStepState = 'pending' | 'current' | 'done';

export type RentalWorkflowStepKey = 'booked' | 'pickup' | 'returned' | 'complete';

export interface RentalWorkflowStep {
  key: RentalWorkflowStepKey;
  label: string;
  state: RentalWorkflowStepState;
}

export interface RentalWorkflowInput {
  status: string;
  due: number;
}

function normalizeStatus(status: string): string {
  return String(status ?? '').toLowerCase().trim();
}

export function isRentalFullyComplete({ status, due }: RentalWorkflowInput): boolean {
  const st = normalizeStatus(status);
  return (st === 'returned' || st === 'closed') && due <= 0;
}

export function getRentalWorkflowSteps({ status, due }: RentalWorkflowInput): RentalWorkflowStep[] {
  const st = normalizeStatus(status);

  if (st === 'cancelled' || st === 'draft') {
    return [
      { key: 'booked', label: st === 'draft' ? 'Draft' : 'Cancelled', state: 'current' },
    ];
  }

  const bookedDone = true;
  const pickupDone = ['rented', 'overdue', 'returned', 'closed'].includes(st);
  const returnedDone = st === 'returned' || st === 'closed';
  const completeDone = isRentalFullyComplete({ status: st, due });

  let currentKey: RentalWorkflowStepKey | null = null;
  if (st === 'booked') currentKey = 'booked';
  else if (st === 'rented' || st === 'overdue') currentKey = 'pickup';
  else if (st === 'returned' || st === 'closed') {
    currentKey = completeDone ? 'complete' : 'returned';
  }

  const stepState = (key: RentalWorkflowStepKey, done: boolean): RentalWorkflowStepState => {
    if (done) return 'done';
    if (currentKey === key) return 'current';
    return 'pending';
  };

  return [
    { key: 'booked', label: 'Booked', state: stepState('booked', bookedDone) },
    { key: 'pickup', label: 'Pickup', state: stepState('pickup', pickupDone) },
    { key: 'returned', label: 'Return', state: stepState('returned', returnedDone) },
    { key: 'complete', label: 'Complete', state: stepState('complete', completeDone) },
  ];
}

export function rentalPrimaryStaffName(
  salesmanName?: string | null,
  createdByName?: string | null,
): string {
  return salesmanName?.trim() || createdByName?.trim() || '—';
}

export function rentalShowCreatedBySecondary(
  salesmanName?: string | null,
  createdByName?: string | null,
): boolean {
  const salesman = salesmanName?.trim();
  const creator = createdByName?.trim();
  return Boolean(salesman && creator && salesman !== creator);
}
