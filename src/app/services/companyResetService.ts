import { supabase } from '@/lib/supabase';

export interface CompanyResetPreview {
  success: boolean;
  mode?: string;
  preserve?: Record<string, number>;
  transactional?: Record<string, number>;
  error?: string;
}

export interface CompanyResetExecuteResult {
  success: boolean;
  auditId?: string;
  preview?: CompanyResetPreview;
  deleted?: Record<string, number>;
  error?: string;
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

export const companyResetService = {
  async preview(companyId: string): Promise<CompanyResetPreview> {
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H2',location:'companyResetService.ts:preview:start',message:'preview_company_transaction_reset called',data:{companyIdPresent:Boolean(companyId)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { data, error } = await callResetRpcWithRetry(() =>
      supabase.rpc('preview_company_transaction_reset', {
        p_company_id: companyId,
      })
    );
    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H2',location:'companyResetService.ts:preview:error',message:'preview_company_transaction_reset error',data:{code:(error as any)?.code||null,message:error.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return { success: false, error: normalizeRpcError(error) };
    }
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H2',location:'companyResetService.ts:preview:success',message:'preview_company_transaction_reset success',data:{success:(data as any)?.success===true},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return (data || { success: false, error: 'No preview response' }) as CompanyResetPreview;
  },

  async execute(companyId: string, confirmation: string): Promise<CompanyResetExecuteResult> {
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H3',location:'companyResetService.ts:execute:start',message:'execute_company_transaction_reset called',data:{companyIdPresent:Boolean(companyId),confirmation:confirmation?.trim()?.toUpperCase()||''},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    const { data, error } = await callResetRpcWithRetry(() =>
      supabase.rpc('execute_company_transaction_reset', {
        p_company_id: companyId,
        p_confirmation: confirmation,
      })
    );
    if (error) {
      // #region agent log
      fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H3',location:'companyResetService.ts:execute:error',message:'execute_company_transaction_reset error',data:{code:(error as any)?.code||null,message:error.message},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return { success: false, error: normalizeRpcError(error) };
    }
    // #region agent log
    fetch('http://127.0.0.1:7640/ingest/5a1d8cd1-36ee-48f0-a16a-f5008fbf5b6b',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'91c22f'},body:JSON.stringify({sessionId:'91c22f',runId:'run1',hypothesisId:'H3',location:'companyResetService.ts:execute:success',message:'execute_company_transaction_reset response',data:{success:(data as any)?.success===true,error:(data as any)?.error||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return (data || { success: false, error: 'No reset response' }) as CompanyResetExecuteResult;
  },
};

