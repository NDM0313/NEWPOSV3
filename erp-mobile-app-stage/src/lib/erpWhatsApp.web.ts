import type { ErpWhatsAppPlugin, ErpWhatsAppSharePdfOptions, ErpWhatsAppSharePdfResult } from './erpWhatsApp';

export class ErpWhatsAppWeb implements ErpWhatsAppPlugin {
  async sharePdf(_options: ErpWhatsAppSharePdfOptions): Promise<ErpWhatsAppSharePdfResult> {
    return { ok: false };
  }
}
