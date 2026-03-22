'use client';

/**
 * Legacy entry point: customer “ledger” mixed journal + subledger is retired.
 * Canonical UI: Operational / GL (journal) / Reconciliation — same as Contacts → statement.
 */
import React from 'react';
import CustomerLedgerPageOriginal from '@/app/components/customer-ledger-test/CustomerLedgerPageOriginal';

export interface CustomerLedgerPageProps {
  customerId: string;
  customerName?: string;
  customerCode?: string;
  onClose: () => void;
}

export const CustomerLedgerPage: React.FC<CustomerLedgerPageProps> = ({ customerId, onClose }) => (
  <CustomerLedgerPageOriginal initialCustomerId={customerId} onClose={onClose} embedded={false} />
);
