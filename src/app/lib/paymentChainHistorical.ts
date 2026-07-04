/** PF-14 payment chain historical marker prefix (sync checks without DB). */
export const HISTORICAL_PREFIX = 'PAYMENT_CHAIN_HISTORICAL:';

export function isPaymentChainHistoricalErrorMessage(msg: string | undefined): boolean {
  return Boolean(msg && msg.startsWith(HISTORICAL_PREFIX));
}

export function stripPaymentChainHistoricalPrefix(msg: string): string {
  return msg.startsWith(HISTORICAL_PREFIX) ? msg.slice(HISTORICAL_PREFIX.length) : msg;
}
