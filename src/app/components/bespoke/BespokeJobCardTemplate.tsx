import React from 'react';
import { getBespokeInstructionBullets } from '@/app/types/bespoke';
import type { BespokeWorkOrder } from '@/app/services/bespokeWorkOrderService';

export interface BespokeJobCardTemplateProps {
  workOrder: BespokeWorkOrder;
  partyName: string;
  formatCurrency: (n: number) => string;
}

/**
 * Internal job card: design instructions + production cost only (no customer retail).
 */
export function BespokeJobCardTemplate({
  workOrder,
  partyName,
  formatCurrency,
}: BespokeJobCardTemplateProps) {
  const bullets = getBespokeInstructionBullets(workOrder.instructions_snapshot);

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto font-sans text-sm">
      <header className="border-b-2 border-gray-800 pb-3 mb-4">
        <h1 className="text-xl font-bold">Work Order / Job Card</h1>
        <p className="text-gray-600 mt-1">
          {workOrder.work_order_no} · {new Date().toLocaleDateString()}
        </p>
        <p className="mt-2">
          <span className="font-semibold">Assigned to:</span> {partyName}
        </p>
      </header>

      <section className="mb-6">
        <h2 className="font-semibold text-base mb-2">Design instructions</h2>
        {bullets.length === 0 ? (
          <p className="text-gray-500 italic">No instructions recorded.</p>
        ) : (
          <ul className="list-disc pl-5 space-y-1">
            {bullets.map((b) => (
              <li key={`${b.label}-${b.value}`}>
                <span className="font-medium">{b.label}:</span> {b.value}
              </li>
            ))}
          </ul>
        )}
        {workOrder.notes && (
          <p className="mt-3 text-gray-700">
            <span className="font-medium">Internal notes:</span> {workOrder.notes}
          </p>
        )}
      </section>

      <section className="border-t border-gray-300 pt-4">
        <p className="text-lg font-bold">
          Agreed production cost: {formatCurrency(Number(workOrder.production_cost) || 0)}
        </p>
        <p className="text-xs text-gray-500 mt-2">
          This document does not show customer selling price. For internal use only.
        </p>
      </section>
    </div>
  );
}
