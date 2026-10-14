/** Broadcast when printing settings are saved so report pages refresh cached options. */
export const PRINTING_SETTINGS_SAVED = 'printing-settings-saved';

export function notifyPrintingSettingsSaved(companyId: string): void {
  window.dispatchEvent(
    new CustomEvent(PRINTING_SETTINGS_SAVED, { detail: { companyId } }),
  );
}

export function onPrintingSettingsSaved(
  companyId: string,
  handler: () => void,
): () => void {
  const listener = (e: Event) => {
    const detail = (e as CustomEvent<{ companyId?: string }>).detail;
    if (detail?.companyId === companyId) handler();
  };
  window.addEventListener(PRINTING_SETTINGS_SAVED, listener);
  return () => window.removeEventListener(PRINTING_SETTINGS_SAVED, listener);
}
