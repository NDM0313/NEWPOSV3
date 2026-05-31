import React from 'react';
import { getBespokeInstructionBullets } from '@/app/types/bespoke';

export interface BespokeInstructionBulletsProps {
  customizationDetails?: Record<string, unknown> | null;
  variant?: 'screen' | 'print';
}

export function BespokeInstructionBullets({
  customizationDetails,
  variant = 'screen',
}: BespokeInstructionBulletsProps) {
  const bullets = getBespokeInstructionBullets(customizationDetails);
  if (bullets.length === 0) return null;

  const isPrint = variant === 'print';

  if (isPrint) {
    return (
      <ul style={{ margin: '4px 0 0 0', paddingLeft: '16px', fontSize: '10px', color: '#374151', lineHeight: 1.4 }}>
        {bullets.map((b) => (
          <li key={`${b.label}-${b.value}`}>
            <span style={{ fontWeight: 500 }}>{b.label}:</span> {b.value}
          </li>
        ))}
      </ul>
    );
  }

  return (
    <ul className="mt-1.5 space-y-0.5 text-[11px] text-gray-400 list-disc list-inside pl-0.5">
      {bullets.map((b) => (
        <li key={`${b.label}-${b.value}`}>
          <span className="text-gray-500">{b.label}:</span>{' '}
          <span className="text-gray-300">{b.value}</span>
        </li>
      ))}
    </ul>
  );
}
