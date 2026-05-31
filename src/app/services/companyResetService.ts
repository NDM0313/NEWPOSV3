import { supabase } from '@/lib/supabase';

export type CompanyResetMode = 'transactional' | 'selective' | 'complete';

export interface CompanyResetDomains {
  transactional: boolean;
  contacts: boolean;
  products: boolean;
  accounts: boolean;
  workers: boolean;
}

export interface CompanyResetOptions {
  mode: CompanyResetMode;
  domains: CompanyResetDomains;
  reseed_accounts?: boolean;
}

export interface CompanyResetPreview {
  success: boolean;
  mode?: string;
  options?: CompanyResetOptions;
  requires_reset_all?: boolean;
  preserve?: Record<string, number>;
  transactional?: Record<string, number>;
  master?: Record<string, number>;
  error?: string;
}

export interface CompanyResetExecuteResult {
  success: boolean;
  auditId?: string;
  preview?: CompanyResetPreview;
  deleted?: Record<string, number>;
  options?: CompanyResetOptions;
  reseed_accounts?: boolean;
  error?: string;
}

export const DEFAULT_TRANSACTIONAL_RESET_OPTIONS: CompanyResetOptions = {
  mode: 'transactional',
  domains: {
    transactional: true,
    contacts: false,
    products: false,
    accounts: false,
    workers: false,
  },
  reseed_accounts: false,
};

export const DEFAULT_COMPLETE_RESET_OPTIONS: CompanyResetOptions = {
  mode: 'complete',
  domains: {
    transactional: true,
    contacts: true,
    products: true,
    accounts: true,
    workers: true,
  },
  reseed_accounts: true,
};

export function buildResetOptionsForMode(
  mode: CompanyResetMode,
  domains?: Partial<CompanyResetDomains>
): CompanyResetOptions {
  if (mode === 'complete') return { ...DEFAULT_COMPLETE_RESET_OPTIONS };
  if (mode === 'transactional') return { ...DEFAULT_TRANSACTIONAL_RESET_OPTIONS };
  return {
    mode: 'selective',
    domains: {
      transactional: domains?.transactional ?? true,
      contacts: domains?.contacts ?? false,
      products: domains?.products ?? false,
      accounts: domains?.accounts ?? false,
      workers: domains?.workers ?? false,
    },
    reseed_accounts: domains?.accounts ?? false,
  };
}

export function requiredConfirmationPhrase(options: CompanyResetOptions): 'RESET' | 'RESET ALL' {
  const d = options.domains;
  if (
    options.mode === 'complete' ||
    d.contacts ||
    d.products ||
    d.accounts ||
    d.workers
  ) {
    return 'RESET ALL';
  }
  return 'RESET';
}

const RESET_RPC_MAX_RETRIES = 2;
const RESET_RPC_RETRY_DELAY_MS = 900;

function isTransientGatewayError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { message?: string; code?: string; status?: number; statusCode?: number };
  const status = Number(e.status ?? e.statusCode ?? 0);
  if (status === 502 || status === 503 || status === 504) return true;
  const msg = String(e.message || '').toLowerCase();
  return (
    msg.includes('bad gateway') ||
    msg.includes('gateway timeout') ||
    msg.includes('service unavailable') ||
    /\b50[234]\b/.test(msg)
  );
}

function normalizeRpcError(err: unknown): string {
  if (isTransientGatewayError(err)) {
    return 'Service temporarily unavailable (gateway). Please retry in a few seconds.';
  }
  const e = err as { message?: string };
  return e?.message || 'Request failed';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function callResetRpcWithRetry<T>(fn: () => Promise<{ data: T | null; error: any }>): Promise<{ data: T | null; error: any }> {
  let lastError: any = null;
  for (let attempt = 0; attempt <= RESET_RPC_MAX_RETRIES; attempt += 1) {
    const { data, error } = await fn();
    if (!error) return { data, error: null };
    lastError = error;
    if (!isTransientGatewayError(error) || attempt === RESET_RPC_MAX_RETRIES) {
      return { data, error };
    }
    await sleep(RESET_RPC_RETRY_DELAY_MS * (attempt + 1));
  }
  return { data: null, error: lastError };
}

function optionsToRpcPayload(options?: CompanyResetOptions): Record<string, unknown> | null {
  if (!options) return null;
  return {
    mode: options.mode,
    domains: options.domains,
    reseed_accounts: options.reseed_accounts ?? false,
  };
}

export const companyResetService = {
  async preview(companyId: string, options?: CompanyResetOptions): Promise<CompanyResetPreview> {
    const { data, error } = await callResetRpcWithRetry(() =>
      supabase.rpc('preview_company_transaction_reset', {
        p_company_id: companyId,
        p_options: optionsToRpcPayload(options),
      })
    );
    if (error) {
      return { success: false, error: normalizeRpcError(error) };
    }
    const raw = (data || { success: false, error: 'No preview response' }) as CompanyResetPreview & {
      options?: CompanyResetOptions;
    };
    if (raw.options && typeof raw.options === 'object') {
      const o = raw.options as CompanyResetOptions;
      raw.requires_reset_all =
        raw.requires_reset_all ?? requiredConfirmationPhrase(o) === 'RESET ALL';
    }
    return raw;
  },

  async execute(
    companyId: string,
    confirmation: string,
    options?: CompanyResetOptions
  ): Promise<CompanyResetExecuteResult> {
    const { data, error } = await callResetRpcWithRetry(() =>
      supabase.rpc('execute_company_transaction_reset', {
        p_company_id: companyId,
        p_confirmation: confirmation,
        p_options: optionsToRpcPayload(options),
      })
    );
    if (error) {
      return { success: false, error: normalizeRpcError(error) };
    }
    return (data || { success: false, error: 'No reset response' }) as CompanyResetExecuteResult;
  },
};
