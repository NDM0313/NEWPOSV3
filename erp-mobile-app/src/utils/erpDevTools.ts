/**
 * Extra gate for connection debug / verbose sync logs: requires local dev (`npm run dev`)
 * AND `VITE_SHOW_ERP_DEV_TOOLS=true`. Production builds never show these (DEV is false).
 */
export function showErpDevTools(): boolean {
  return Boolean(import.meta.env.DEV && import.meta.env.VITE_SHOW_ERP_DEV_TOOLS === 'true');
}
