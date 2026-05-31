import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildMatrixParentSku, designIdFromName } from './productImportSku.ts';

describe('designIdFromName', () => {
  it('prefers trailing slash boutique code over price in name', () => {
    assert.equal(designIdFromName('BRIDAL - 400 - ASIF KG /952'), '952');
    assert.equal(designIdFromName('GRAIB CH - 2IMPORTED /596'), '596');
    assert.equal(designIdFromName('MAXI 315 -  - ANYA / 521'), '521');
  });

  it('uses design/dsn tags when no slash suffix', () => {
    assert.equal(designIdFromName('Design 2000 (Maxi)'), '2000');
    assert.equal(designIdFromName('DSN-4010-TSCR'), '4010');
  });

  it('falls back to first bare number then slug', () => {
    assert.equal(designIdFromName('BRIDAL - 400 - no slash'), '400');
    assert.equal(designIdFromName('Plain Product Name'), 'PLAIN-PRODUC');
  });
});

describe('buildMatrixParentSku', () => {
  it('builds unique SKUs for CSV-style bridal rows', () => {
    const a = buildMatrixParentSku({
      name: 'BRIDAL - 400 - ASIF KG /952',
      category: 'BRIDAL',
    });
    const b = buildMatrixParentSku({
      name: 'BRIDAL - 400 - ASHRAF /1263',
      category: 'BRIDAL',
    });
    assert.equal(a, 'BRD-952');
    assert.equal(b, 'BRD-1263');
    assert.notEqual(a, b);
  });
});
