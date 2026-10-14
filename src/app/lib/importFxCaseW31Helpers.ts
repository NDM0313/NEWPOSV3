/**
 * Import FX W3.1 — Custody & Routing pure helpers (no posting).
 */

export type ImportFxW31RoutingMode =
  | 'COMPANY_WALLET'
  | 'AGENT_CUSTODY'
  | 'THIRD_PARTY_CUSTODY'
  | 'DIRECT_DISTRIBUTION'
  | 'SPLIT_HOLD_AND_DISTRIBUTE';

export type ImportFxW31DistributionPurpose =
  | 'SUPPLIER_INVOICE_SETTLEMENT'
  | 'SUPPLIER_ADVANCE'
  | 'THIRD_PARTY_CUSTODY'
  | 'CONVERSION_COUNTERPARTY'
  | 'CUSTOMER_REFUND'
  | 'EXPENSE_PAYMENT_ON_BEHALF'
  | 'BRANCH_OR_INTERCOMPANY_TRANSFER'
  | 'OTHER_REVIEW_REQUIRED';

export const W31_ROUTING_LABELS: Record<ImportFxW31RoutingMode, string> = {
  COMPANY_WALLET: 'Company USD/TT Wallet',
  AGENT_CUSTODY: 'Held by FX Agent',
  THIRD_PARTY_CUSTODY: 'Held by Third Party',
  DIRECT_DISTRIBUTION: 'Direct Distribution',
  SPLIT_HOLD_AND_DISTRIBUTE: 'Split: Hold Balance + Distribute',
};

export const W31_PURPOSE_LABELS: Record<ImportFxW31DistributionPurpose, string> = {
  SUPPLIER_INVOICE_SETTLEMENT: 'Supplier invoice settlement (requires W5)',
  SUPPLIER_ADVANCE: 'Supplier advance (requires W5)',
  THIRD_PARTY_CUSTODY: 'Third-party custody / onward hold',
  CONVERSION_COUNTERPARTY: 'Conversion counterparty (requires W4)',
  CUSTOMER_REFUND: 'Customer refund (blocked)',
  EXPENSE_PAYMENT_ON_BEHALF: 'Expense on behalf (blocked)',
  BRANCH_OR_INTERCOMPANY_TRANSFER: 'Branch / intercompany (blocked)',
  OTHER_REVIEW_REQUIRED: 'Other — review required',
};

export const W31_HOLDING_NOT_AP_COPY =
  'Holding funds — supplier invoice not settled';

export const W31_REQUIRES_W5_COPY = 'Requires W5 settlement posting';

export const W31_ROUTING_QUESTION = 'Where will the acquired USD be held or used?';

export type W31DistributionDraftRow = {
  recipient_contact_id: string;
  recipient_role?: string | null;
  purpose: ImportFxW31DistributionPurpose;
  linked_purchase_id?: string | null;
  usd_qty: number;
  reference?: string;
  notes?: string;
};

export function purposeRequiresWave(
  purpose: ImportFxW31DistributionPurpose
): 'W4' | 'W5' | 'LATER' | 'REVIEW' | null {
  switch (purpose) {
    case 'CONVERSION_COUNTERPARTY':
      return 'W4';
    case 'SUPPLIER_INVOICE_SETTLEMENT':
    case 'SUPPLIER_ADVANCE':
      return 'W5';
    case 'THIRD_PARTY_CUSTODY':
      return null;
    case 'CUSTOMER_REFUND':
    case 'EXPENSE_PAYMENT_ON_BEHALF':
    case 'BRANCH_OR_INTERCOMPANY_TRANSFER':
      return 'LATER';
    default:
      return 'REVIEW';
  }
}

export function sumDistributionUsd(rows: { usd_qty: number }[]): number {
  return Math.round(rows.reduce((s, r) => s + (Number(r.usd_qty) || 0), 0) * 1e6) / 1e6;
}

export function validateRoutingAllocation(args: {
  routingMode: ImportFxW31RoutingMode;
  acquiredUsd: number;
  retainedUsd: number;
  distributionRows: W31DistributionDraftRow[];
  destinationWalletId?: string | null;
  holderContactId?: string | null;
  agentContactId?: string | null;
}): { ok: true } | { ok: false; code: string; message: string } {
  const acquired = Number(args.acquiredUsd) || 0;
  if (!(acquired > 0)) {
    return { ok: false, code: 'INVALID_AMOUNT', message: 'USD quantity must be > 0' };
  }
  const distributed = sumDistributionUsd(args.distributionRows);
  const retained = Number(args.retainedUsd) || 0;

  for (const row of args.distributionRows) {
    if (!row.recipient_contact_id) {
      return { ok: false, code: 'RECIPIENT_REQUIRED', message: 'Each distribution row needs a recipient' };
    }
    if (!(row.usd_qty > 0)) {
      return { ok: false, code: 'INVALID_DISTRIBUTION', message: 'Distribution qty must be > 0' };
    }
    if (row.purpose === 'SUPPLIER_INVOICE_SETTLEMENT' && !row.linked_purchase_id) {
      return {
        ok: false,
        code: 'SUPPLIER_LINK_REQUIRED',
        message: 'Supplier invoice settlement requires a linked purchase/open item',
      };
    }
    // Contact being supplier does not imply AP settlement — only explicit purpose + link does.
  }

  switch (args.routingMode) {
    case 'COMPANY_WALLET':
      if (!args.destinationWalletId) {
        return { ok: false, code: 'WALLET_REQUIRED', message: 'Select a Company USD/TT wallet' };
      }
      if (distributed > 0) {
        return { ok: false, code: 'INVALID_DISTRIBUTION', message: 'Company wallet mode cannot include distributions' };
      }
      return { ok: true };
    case 'AGENT_CUSTODY':
      if (distributed > 0) {
        return { ok: false, code: 'INVALID_DISTRIBUTION', message: 'Agent custody is a full hold — use Split to distribute' };
      }
      return { ok: true };
    case 'THIRD_PARTY_CUSTODY':
      if (!args.holderContactId) {
        return { ok: false, code: 'HOLDER_REQUIRED', message: 'Select a third-party holder' };
      }
      if (args.agentContactId && args.holderContactId === args.agentContactId) {
        return { ok: false, code: 'HOLDER_REQUIRED', message: 'Third party must differ from the FX agent (use Agent custody)' };
      }
      if (distributed > 0) {
        return { ok: false, code: 'INVALID_DISTRIBUTION', message: 'Third-party custody is a full hold — use Split to distribute' };
      }
      return { ok: true };
    case 'DIRECT_DISTRIBUTION':
      if (Math.round(distributed * 1e6) / 1e6 !== Math.round(acquired * 1e6) / 1e6) {
        return {
          ok: false,
          code: 'UNALLOCATED_USD',
          message: `Direct distribution must allocate all USD (acquired ${acquired}, allocated ${distributed})`,
        };
      }
      return { ok: true };
    case 'SPLIT_HOLD_AND_DISTRIBUTE': {
      if (retained < 0) {
        return { ok: false, code: 'SPLIT_MISMATCH', message: 'Retained USD cannot be negative' };
      }
      if (Math.round((retained + distributed) * 1e6) / 1e6 !== Math.round(acquired * 1e6) / 1e6) {
        return {
          ok: false,
          code: 'SPLIT_MISMATCH',
          message: `Retained (${retained}) + distributed (${distributed}) must equal acquired (${acquired})`,
        };
      }
      return { ok: true };
    }
    default:
      return { ok: false, code: 'INVALID_ROUTING', message: 'Unknown routing mode' };
  }
}

export function operationalStatusLabels(args: {
  routingMode: ImportFxW31RoutingMode;
  distributedUsd: number;
  retainedUsd: number;
  reversed?: boolean;
}): string[] {
  if (args.reversed) return ['Reversed'];
  const labels = ['Acquired'];
  if (args.routingMode === 'COMPANY_WALLET') labels.push('Held in Company Wallet');
  if (args.routingMode === 'AGENT_CUSTODY') labels.push('Held by Agent');
  if (args.routingMode === 'THIRD_PARTY_CUSTODY') labels.push('Held by Third Party');
  if (args.distributedUsd > 0) {
    labels.push(args.retainedUsd > 0 ? 'Partially Distributed' : 'Distribution Planned');
    labels.push('Requires W4 Conversion');
    labels.push('Requires W5 Supplier Settlement');
  }
  return labels;
}

/** Supplier contact as recipient with non-settlement purpose must not claim AP paid. */
export function supplierAsIntermediaryWarning(args: {
  recipientIsSupplier: boolean;
  purpose: ImportFxW31DistributionPurpose;
}): string | null {
  if (!args.recipientIsSupplier) return null;
  if (args.purpose === 'SUPPLIER_INVOICE_SETTLEMENT') return W31_REQUIRES_W5_COPY;
  return W31_HOLDING_NOT_AP_COPY;
}
