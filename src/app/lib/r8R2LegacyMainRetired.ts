/**
 * R8-R2: in-page legacy main loaders retired.
 * Resolvers may still report `legacy` (kill/flags OFF); pages fail closed.
 * Production rollback after deletion is L2 (pre-delete tag) and/or L1 flags only with restored code.
 */
export const R8_R2_LEGACY_MAIN_RETIRED_MESSAGE =
  'Legacy main loader retired (R8-R2). Unified path required; restore pre-deletion tag or L1 flags with retained code for rollback.';

export function assertUnifiedMainLoaderSource(mainSource: 'legacy' | 'unified'): asserts mainSource is 'unified' {
  if (mainSource !== 'unified') {
    throw new Error(R8_R2_LEGACY_MAIN_RETIRED_MESSAGE);
  }
}
