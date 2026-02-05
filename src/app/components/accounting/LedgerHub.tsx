/**
 * Ledger content: same page, same Customer Ledger UI. Type comes from top-menu dropdown (no inner Ledger dropdown).
 * Only entity selector (Customer/Supplier/User/Worker) + date filter + summary cards + tabs.
 */

import { useState, useEffect } from 'react';
import { useSupabase } from '@/app/context/SupabaseContext';
import { customerLedgerAPI } from '@/app/services/customerLedgerApi';
import { contactService } from '@/app/services/contactService';
import { userService } from '@/app/services/userService';
import { studioService } from '@/app/services/studioService';
import CustomerLedgerPageOriginal from '@/app/components/customer-ledger-test/CustomerLedgerPageOriginal';
import { GenericLedgerView } from './GenericLedgerView';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/app/components/ui/select';

export type LedgerTypeOption = 'customer' | 'supplier' | 'user' | 'worker';

interface EntityOption {
  id: string;
  name: string;
}

interface LedgerHubProps {
  /** Set by top-menu Ledger dropdown (Customer / Supplier / User / Worker). No dropdown inside page. */
  ledgerType: LedgerTypeOption;
}

export function LedgerHub({ ledgerType }: LedgerHubProps) {
  const { companyId } = useSupabase();
  const [entityId, setEntityId] = useState<string>('');
  const [entities, setEntities] = useState<EntityOption[]>([]);
  const [loadingEntities, setLoadingEntities] = useState(false);

  useEffect(() => {
    if (!companyId) {
      setEntities([]);
      setEntityId('');
      return;
    }
    let cancelled = false;
    setLoadingEntities(true);
    (async () => {
      try {
        if (ledgerType === 'customer') {
          const list = await customerLedgerAPI.getCustomers(companyId);
          if (!cancelled) {
            setEntities(list.map((c) => ({ id: c.id, name: c.name || c.code || c.id })));
            setEntityId((prev) => (list.some((c) => c.id === prev) ? prev : list[0]?.id || ''));
          }
        } else if (ledgerType === 'supplier') {
          // Only suppliers: type = 'supplier' OR type = 'both' (dual role). Exclude pure customers.
          const list = await contactService.getAllContacts(companyId, 'supplier');
          const both = await contactService.getAllContacts(companyId, 'both');
          const typeOf = (c: { type?: string }) => (c.type || '').toLowerCase();
          const isSupplier = (c: { type?: string }) => typeOf(c) === 'supplier' || typeOf(c) === 'both';
          const combined = [...(list || []), ...(both || [])]
            .filter((c) => isSupplier(c))
            .filter((c, i, arr) => arr.findIndex((x) => x.id === c.id) === i);
          if (!cancelled) {
            setEntities(combined.map((c) => ({ id: c.id!, name: (c as { name?: string }).name || 'Supplier' })));
            setEntityId((prev) => (combined.some((c) => c.id === prev) ? prev : combined[0]?.id || ''));
          }
        } else if (ledgerType === 'user') {
          const list = await userService.getAllUsers(companyId);
          if (!cancelled) {
            setEntities((list || []).map((u) => ({ id: u.id, name: u.full_name || u.email || u.id })));
            setEntityId((prev) => (list?.some((u) => u.id === prev) ? prev : list?.[0]?.id || ''));
          }
        } else {
          const list = await studioService.getAllWorkers(companyId);
          const workers = (list || []) as { id: string; name?: string }[];
          if (!cancelled) {
            setEntities(workers.map((w) => ({ id: w.id, name: w.name || w.id })));
            setEntityId((prev) => (workers.some((w) => w.id === prev) ? prev : workers[0]?.id || ''));
          }
        }
      } catch (e) {
        if (!cancelled) setEntities([]);
      } finally {
        if (!cancelled) setLoadingEntities(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, ledgerType]);

  const selectedEntityName = entities.find((e) => e.id === entityId)?.name ?? '';

  const entityLabel = ledgerType === 'customer' ? 'Customer' : ledgerType === 'supplier' ? 'Supplier' : ledgerType === 'user' ? 'User' : 'Worker';

  return (
    <div className="space-y-4">
      {/* Only entity selector – same page, same filters, same date picker, same summary cards (no Ledger type dropdown here) */}
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400 whitespace-nowrap">{entityLabel}</span>
          <Select
            value={entityId || (entities[0]?.id ?? '')}
            onValueChange={setEntityId}
            disabled={loadingEntities || entities.length === 0}
          >
            <SelectTrigger className="min-w-[220px] bg-gray-900 border-gray-700 text-white">
              <SelectValue placeholder={loadingEntities ? 'Loading…' : `Select ${entityLabel}…`} />
            </SelectTrigger>
            <SelectContent>
              {entities.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {ledgerType === 'customer' && entityId ? (
        <CustomerLedgerPageOriginal
          initialCustomerId={entityId}
          embedded
        />
      ) : entityId && ledgerType !== 'customer' ? (
        <GenericLedgerView
          ledgerType={ledgerType}
          entityId={entityId}
          entityName={selectedEntityName}
        />
      ) : (
        <div className="py-8 text-center text-gray-400 text-sm">
          Select a {ledgerType === 'customer' ? 'customer' : ledgerType === 'supplier' ? 'supplier' : ledgerType === 'user' ? 'user' : 'worker'} from the dropdown above.
        </div>
      )}
    </div>
  );
}
