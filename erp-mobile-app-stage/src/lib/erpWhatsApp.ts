import { Capacitor, registerPlugin } from '@capacitor/core';

export interface ErpWhatsAppSharePdfOptions {
  uri: string;
  /** E.164 digits without + (e.g. 923115524523). */
  phone: string;
  text?: string;
}

export interface ErpWhatsAppSharePdfResult {
  ok: boolean;
}

export interface ErpWhatsAppPlugin {
  sharePdf(options: ErpWhatsAppSharePdfOptions): Promise<ErpWhatsAppSharePdfResult>;
}

const ErpWhatsAppNative = registerPlugin<ErpWhatsAppPlugin>('ErpWhatsApp', {
  web: () => import('./erpWhatsApp.web').then((m) => new m.ErpWhatsAppWeb()),
});

/** Android: open WhatsApp chat with PDF attached. Other platforms return ok: false. */
export async function sharePdfToWhatsAppContact(
  options: ErpWhatsAppSharePdfOptions,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') {
    return false;
  }
  try {
    const { ok } = await ErpWhatsAppNative.sharePdf(options);
    return !!ok;
  } catch {
    return false;
  }
}
