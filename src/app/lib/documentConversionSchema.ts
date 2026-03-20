import { supabase } from '@/lib/supabase';

const STORAGE_KEY = 'erp_doc_conv_schema_v2';

export type DocumentConversionSchemaFlags = {
  salesConvertedColumn: boolean;
  purchasesConvertedColumn: boolean;
};

let resolvedCache: DocumentConversionSchemaFlags | null = null;
let loadingPromise: Promise<DocumentConversionSchemaFlags> | null = null;

/** Clear after logout or if schema was migrated mid-session. */
export function clearDocumentConversionSchemaCache(): void {
  resolvedCache = null;
  loadingPromise = null;
  try {
    if (typeof window !== 'undefined') sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

async function fetchFlags(): Promise<DocumentConversionSchemaFlags> {
  const { data, error } = await supabase.rpc('app_document_conversion_schema');
  if (error || data == null || typeof data !== 'object') {
    return { salesConvertedColumn: false, purchasesConvertedColumn: false };
  }
  const d = data as Record<string, unknown>;
  return {
    salesConvertedColumn: Boolean(d.sales_converted),
    purchasesConvertedColumn: Boolean(d.purchases_converted),
  };
}

/**
 * Cached flags: whether `converted` exists on sales/purchases (PostgREST-safe filters).
 * If RPC is missing or errors, returns false — callers omit `converted=eq.false` (no 400 spam).
 */
export async function getDocumentConversionSchemaFlags(): Promise<DocumentConversionSchemaFlags> {
  if (resolvedCache) return resolvedCache;

  if (typeof window !== 'undefined') {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const p = JSON.parse(raw) as DocumentConversionSchemaFlags;
        if (typeof p.salesConvertedColumn === 'boolean' && typeof p.purchasesConvertedColumn === 'boolean') {
          resolvedCache = p;
          return p;
        }
      }
    } catch {
      /* ignore */
    }
  }

  if (!loadingPromise) {
    loadingPromise = fetchFlags()
      .then((f) => {
        resolvedCache = f;
        loadingPromise = null;
        try {
          if (typeof window !== 'undefined') sessionStorage.setItem(STORAGE_KEY, JSON.stringify(f));
        } catch {
          /* ignore */
        }
        return f;
      })
      .catch(() => {
        loadingPromise = null;
        const fallback = { salesConvertedColumn: false, purchasesConvertedColumn: false };
        resolvedCache = fallback;
        return fallback;
      });
  }

  return loadingPromise;
}
