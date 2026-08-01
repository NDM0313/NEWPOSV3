import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { resolveGlCorrectionDisplayRef } from '@/app/lib/glCorrectionDisplayRef';

describe('gl_correction display ref', () => {
  it('resolves HQ-SL-0003 orphan fingerprint', () => {
    const ui = resolveGlCorrectionDisplayRef(
      {
        id: 'je-1',
        entry_no: 'JV-000203',
        reference_type: 'gl_correction',
        reference_id: 'sale-uuid',
        action_fingerprint: 'developer_repair:gl_correction:hq-sl-0003-orphan-ar',
        description: 'GL correction: JE-0161',
      },
      { sales: new Map(), sourceJournals: new Map(), rentals: new Map() }
    );
    assert.equal(ui.documentResolved, true);
    assert.match(ui.displayRef, /HQ-SL-0003/);
    assert.equal(ui.sourceLabel, 'GL correction');
  });

  it('resolves rental leakage via source JE and booking', () => {
    const sourceJeId = '47c91f30-779c-4557-901d-ca78ee78b988';
    const rentalId = 'rental-uuid';
    const ui = resolveGlCorrectionDisplayRef(
      {
        id: 'je-2',
        entry_no: 'JV-000207',
        reference_type: 'gl_correction',
        reference_id: sourceJeId,
        action_fingerprint: 'developer_repair:gl_correction:rental-1100-leakage:line-id',
        description: 'GL correction: rental 1100 leakage',
      },
      {
        sales: new Map(),
        sourceJournals: new Map([
          [
            sourceJeId,
            {
              id: sourceJeId,
              entry_no: 'JE-0003',
              reference_type: 'rental',
              reference_id: rentalId,
            },
          ],
        ]),
        rentals: new Map([[rentalId, { booking_no: 'REN-0002' }]]),
      }
    );
    assert.equal(ui.documentResolved, true);
    assert.match(ui.displayRef, /JE-0003/);
    assert.match(ui.displayRef, /REN-0002/);
  });
});
