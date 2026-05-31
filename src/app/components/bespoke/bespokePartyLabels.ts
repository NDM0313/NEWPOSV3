export interface BespokePartyContact {
  id: string;
  name: string;
  type: string;
}

export function partyTypeLabel(type: string): 'Worker' | 'Supplier' {
  if (type === 'worker') return 'Worker';
  return 'Supplier';
}

export function formatPartyOption(contact: Pick<BespokePartyContact, 'name' | 'type'>): string {
  const name = contact.name?.trim() || 'Unnamed';
  return `${name} (${partyTypeLabel(contact.type)})`;
}

function extractErrorText(err: unknown): string {
  if (!err || typeof err !== 'object') {
    return err instanceof Error ? err.message : String(err ?? '');
  }
  const e = err as {
    message?: string;
    details?: string;
    hint?: string;
    code?: string;
  };
  return [e.message, e.details, e.hint, e.code].filter(Boolean).join(' — ');
}

export function mapCreateWorkOrderError(err: unknown): string {
  const msg = extractErrorText(err);
  const lower = msg.toLowerCase();

  if (lower.includes('cancelled') && lower.includes('cannot be edited')) {
    return 'Cancelled work orders cannot be edited.';
  }

  if (lower.includes('production cost must be greater than 0')) {
    return 'Enter a valid production cost greater than zero.';
  }

  if (lower.includes('forbidden')) {
    return 'You do not have permission to edit this work order.';
  }

  if (
    lower.includes('no branch set') ||
    lower.includes('invalid branch for work order') ||
    (lower.includes('invalid') && lower.includes('branch'))
  ) {
    return 'This sale has no branch set. Edit the sale and assign a branch first.';
  }

  if (
    lower.includes('bespoke_work_orders') &&
    (lower.includes('does not exist') || lower.includes('could not find the table'))
  ) {
    return 'Work orders are not set up on this database. Ask admin to run migrations.';
  }

  if (lower.includes('could not find a relationship') && lower.includes('contacts')) {
    return 'Work order setup is incomplete (contact link). Ask admin to run migrations and reload the API schema.';
  }

  if (lower.includes('foreign key constraint')) {
    if (lower.includes('created_by')) {
      return 'Could not link creator user; work order was not saved.';
    }
    return 'Invalid sale branch, line item, or worker/supplier contact.';
  }

  if (
    lower.includes('idx_bespoke_wo_sale_parent') ||
    lower.includes('duplicate key') ||
    lower.includes('unique constraint')
  ) {
    return 'A work order already exists for this line item.';
  }

  if (lower.includes('invalid') && lower.includes('uuid')) {
    return 'Invalid sale or contact reference for work order.';
  }

  return msg || 'Failed to create work order';
}

export function mapUpdateWorkOrderError(err: unknown): string {
  const msg = mapCreateWorkOrderError(err);
  if (msg.includes('create work order')) {
    return msg.replace('create work order', 'update work order');
  }
  return msg || 'Failed to update work order';
}
